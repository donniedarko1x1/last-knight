const STORY_WAVE_ANOMALY_COUNTS=Object.freeze({2:2,3:3,4:2,5:3});
const TWO_EVENT_FRACTIONS=Object.freeze([0.30,0.72]);
const THREE_EVENT_FRACTIONS=Object.freeze([0.20,0.50,0.80]);

function deterministicSeed(wave,ordinal){
 return Math.abs((Number(wave)||0)*97+(Number(ordinal)||0)*53);
}

class StoryEnemyAnomalySystem {
 constructor(scene){
  this.scene=scene;
  this.currentWave=0;
  this.waveTarget=0;
  this.selectedOrdinals=new Set();
  this.pendingReturns=0;
  this.installed=false;
 }

 install(){
  this.installed=true;
  return this;
 }

 destroy(){
  this.selectedOrdinals.clear();
  this.pendingReturns=0;
  this.installed=false;
  this.scene=null;
 }

 hasPendingReturns(){return this.pendingReturns>0;}

 beginWave(wave,waveTarget){
  this.currentWave=Number(wave)||0;
  this.waveTarget=Math.max(0,Math.floor(Number(waveTarget)||0));
  this.selectedOrdinals.clear();

  const count=STORY_WAVE_ANOMALY_COUNTS[this.currentWave]||0;
  if(count<=0 || this.waveTarget<=0)return;

  const fractions=count===2?TWO_EVENT_FRACTIONS:THREE_EVENT_FRACTIONS;
  for(const fraction of fractions){
   let ordinal=Math.round(this.waveTarget*fraction);
   ordinal=Math.max(1,Math.min(this.waveTarget,ordinal));
   while(this.selectedOrdinals.has(ordinal) && ordinal<this.waveTarget)ordinal++;
   while(this.selectedOrdinals.has(ordinal) && ordinal>1)ordinal--;
   this.selectedOrdinals.add(ordinal);
  }
 }

 registerEnemy(enemy,{wave=this.currentWave,spawnOrdinal=0}={}){
  if(!this.installed || !enemy || enemy.type==='champion')return false;
  const normalizedWave=Number(wave)||0;
  const ordinal=Math.max(1,Math.floor(Number(spawnOrdinal)||0));
  if(normalizedWave!==this.currentWave || !this.selectedOrdinals.has(ordinal))return false;

  const seed=deterministicSeed(normalizedWave,ordinal);
  const baseDistance=enemy.type==='mage'?238:(enemy.type==='shield'?142:152);
  const triggerDistance=baseDistance+(seed%31)-15;
  const armDelay=650+(seed%1450);
  // Give the player enough time to notice the broken behaviour before the mob bolts.
  const hesitateMs=5000;
  const returnDelayMs=4200+((seed*11)%1800);

  enemy.storyAnomaly={
   wave:normalizedWave,
   spawnOrdinal:ordinal,
   seed,
   phase:'waiting',
   armedAt:(this.scene?.time?.now||0)+armDelay,
   triggerDistance,
   hesitateMs,
   hesitateUntil:0,
   fleeAngle:0,
   fleeStartedAt:0,
   returnDelayMs
  };
  return true;
 }

 isEnemyAnomalyActive(enemy,time=this.scene?.time?.now||0){
  const state=enemy?.storyAnomaly;
  if(!state)return false;
  return state.phase==='hesitate' || state.phase==='flee' || time<(enemy.storyAnomalyFreezeUntil||0);
 }

 chooseFleeAngle(enemy){
  const scene=this.scene;
  const view=scene?.cameras?.main?.worldView;
  if(!view)return Math.atan2(enemy.y-(scene?.player?.y||enemy.y),enemy.x-(scene?.player?.x||enemy.x));

  const distances=[
   {edge:'left',value:Math.abs(enemy.x-view.left),angle:Math.PI},
   {edge:'right',value:Math.abs(view.right-enemy.x),angle:0},
   {edge:'top',value:Math.abs(enemy.y-view.top),angle:-Math.PI/2},
   {edge:'bottom',value:Math.abs(view.bottom-enemy.y),angle:Math.PI/2}
  ];
  distances.sort((a,b)=>a.value-b.value);
  return distances[0].angle;
 }

 isOutsideFocusedView(enemy,margin=72){
  const view=this.scene?.cameras?.main?.worldView;
  if(!view)return false;
  return enemy.x<view.left-margin || enemy.x>view.right+margin || enemy.y<view.top-margin || enemy.y>view.bottom+margin;
 }

 vanishAndScheduleReturn(enemy,state){
  const scene=this.scene;
  if(!scene || !enemy?.active || state.phase==='vanished')return false;

  state.phase='vanished';
  const enemyType=enemy.type||'skeleton';
  this.pendingReturns++;

  try{enemy.visual?.destroy?.();}catch{}
  try{enemy.auraVisual?.destroy?.();}catch{}
  try{enemy.reflectVisual?.destroy?.();}catch{}
  try{scene.destroyEnemyReadabilityShadow?.(enemy);}catch{}
  try{enemy.destroy?.();}catch{}
  scene.enemies=(scene.enemies||[]).filter(item=>item && item!==enemy && item.active);

  scene.time?.delayedCall?.(state.returnDelayMs||4200,()=>{
   try{
    if(!scene || scene.gameOver)return;
    scene.spawnEnemy?.(enemyType,null,{skipStoryAnomaly:true});
   }finally{
    this.pendingReturns=Math.max(0,this.pendingReturns-1);
   }
  });
  return true;
 }

 updateEnemy(enemy,time,distance){
  const state=enemy?.storyAnomaly;
  if(!state || state.phase==='done' || state.phase==='vanished')return null;

  if(state.phase==='waiting'){
   const focusedEnemy=this.scene?.storyAnomalyCueState?.enemy;
   if(focusedEnemy && focusedEnemy!==enemy)return null;
   if(time<state.armedAt || distance>state.triggerDistance)return null;
   if(time<(enemy.staggerUntil||0) || time<(enemy.skillLiftUntil||0) || time<(enemy.skillTremorUntil||0))return null;

   state.phase='hesitate';
   state.hesitateUntil=time+state.hesitateMs;
   enemy.storyAnomalyFreezeUntil=state.hesitateUntil;
   enemy.pendingMeleeHitAt=0;
   enemy.pendingMeleeDamage=0;
   enemy.pendingMeleeRange=0;
   enemy.attackAnimUntil=0;
   enemy.lastAttack=Math.max(enemy.lastAttack||0,time);
   enemy.lastShot=Math.max(enemy.lastShot||0,time);
   this.scene?.highlightStoryAnomaly?.(enemy,{durationMs:5000});
  }

  if(state.phase==='hesitate'){
   if(time<state.hesitateUntil)return {kind:'hesitate'};
   state.phase='flee';
   state.fleeAngle=this.chooseFleeAngle(enemy);
   state.fleeStartedAt=time;
   enemy.storyAnomalyFreezeUntil=0;
   if(enemy.body?.checkCollision)enemy.body.checkCollision.none=true;
  }

  if(state.phase==='flee'){
   if(this.isOutsideFocusedView(enemy,72) || time-(state.fleeStartedAt||time)>1800){
    this.vanishAndScheduleReturn(enemy,state);
    return {kind:'vanished'};
   }
   return {kind:'flee',speedFactor:3.15,angle:state.fleeAngle};
  }

  return null;
 }
}

export {STORY_WAVE_ANOMALY_COUNTS};
export default StoryEnemyAnomalySystem;

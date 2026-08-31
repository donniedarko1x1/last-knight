const STORY_WAVE_ANOMALY_COUNTS=Object.freeze({2:1,3:2,4:1,5:2});
const ONE_EVENT_FRACTIONS=Object.freeze([0.52]);
const TWO_EVENT_FRACTIONS=Object.freeze([0.30,0.72]);
const ANOMALY_RELEASE_MS=120;

function deterministicSeed(wave,ordinal){
 return Math.abs((Number(wave)||0)*97+(Number(ordinal)||0)*53);
}

class StoryEnemyAnomalySystem {
 constructor(scene){
  this.scene=scene;
  this.currentWave=0;
  this.waveTarget=0;
  this.selectedOrdinals=new Set();
  this.installed=false;
 }

 install(){
  this.installed=true;
  return this;
 }

 destroy(){
  this.selectedOrdinals.clear();
  this.installed=false;
  this.scene=null;
 }

 hasPendingReturns(){return false;}

 beginWave(wave,waveTarget){
  this.currentWave=Number(wave)||0;
  this.waveTarget=Math.max(0,Math.floor(Number(waveTarget)||0));
  this.selectedOrdinals.clear();

  const count=STORY_WAVE_ANOMALY_COUNTS[this.currentWave]||0;
  if(count<=0 || this.waveTarget<=0)return;

  const fractions=count===1?ONE_EVENT_FRACTIONS:TWO_EVENT_FRACTIONS;
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

  enemy.storyAnomaly={
   wave:normalizedWave,
   spawnOrdinal:ordinal,
   seed,
   phase:'waiting',
   armedAt:(this.scene?.time?.now||0)+armDelay,
   triggerDistance,
   hesitateMs,
   hesitateUntil:0,
   releaseUntil:0,
   fleeAngle:0,
   fleeStartedAt:0
  };
  return true;
 }

 isEnemyAnomalyActive(enemy,time=this.scene?.time?.now||0){
  const state=enemy?.storyAnomaly;
  if(!state)return false;
  return state.phase==='hesitate' || state.phase==='release' || state.phase==='flee' || time<(enemy.storyAnomalyFreezeUntil||0);
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

 vanishAsDefeated(enemy,state){
  const scene=this.scene;
  if(!scene || !enemy?.active || state.phase==='escaped')return false;

  // Escaping the battlefield is permanent. No replacement is spawned; wave
  // progression treats this mob as defeated once it leaves the focused view.
  state.phase='escaped';
  enemy.hp=0;
  try{enemy.visual?.destroy?.();}catch{}
  try{enemy.auraVisual?.destroy?.();}catch{}
  try{enemy.reflectVisual?.destroy?.();}catch{}
  try{scene.destroyEnemyReadabilityShadow?.(enemy);}catch{}
  try{enemy.destroy?.();}catch{}
  scene.enemies=(scene.enemies||[]).filter(item=>item && item!==enemy && item.active);
  return true;
 }

 updateEnemy(enemy,time,distance){
  const state=enemy?.storyAnomaly;
  if(!state || state.phase==='done' || state.phase==='escaped')return null;

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
   // Give the vignette a fraction of a second to clear before the skeleton bolts.
   // This creates a readable beat: focus ends -> world returns -> sudden escape.
   state.phase='release';
   state.releaseUntil=time+ANOMALY_RELEASE_MS;
   enemy.storyAnomalyFreezeUntil=state.releaseUntil;
   return {kind:'release'};
  }

  if(state.phase==='release'){
   if(time<state.releaseUntil)return {kind:'release'};
   state.phase='flee';
   state.fleeAngle=this.chooseFleeAngle(enemy);
   state.fleeStartedAt=time;
   enemy.storyAnomalyFreezeUntil=0;
   if(enemy.body?.checkCollision)enemy.body.checkCollision.none=true;
  }

  if(state.phase==='flee'){
   if(this.isOutsideFocusedView(enemy,72) || time-(state.fleeStartedAt||time)>1800){
    this.vanishAsDefeated(enemy,state);
    return {kind:'vanished'};
   }
   return {kind:'flee',speedFactor:3.15,angle:state.fleeAngle};
  }

  return null;
 }
}

export {STORY_WAVE_ANOMALY_COUNTS,ANOMALY_RELEASE_MS};
export default StoryEnemyAnomalySystem;

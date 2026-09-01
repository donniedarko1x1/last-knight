const DEFAULT_TRIGGER_FRACTION=0.52;
const ANOMALY_RELEASE_MS=120;

function deterministicSeed(wave,ordinal){
 return Math.abs((Number(wave)||0)*97+(Number(ordinal)||0)*53);
}

function toOrdinal(definition,waveTarget){
 const exactOrdinal=Math.floor(Number(definition?.triggerOrdinal)||0);
 if(exactOrdinal>0)return Math.max(1,Math.min(waveTarget,exactOrdinal));
 const fraction=Number.isFinite(Number(definition?.triggerFraction))
  ? Number(definition.triggerFraction)
  : DEFAULT_TRIGGER_FRACTION;
 const normalized=Math.max(0.05,Math.min(0.95,fraction));
 return Math.max(1,Math.min(waveTarget,Math.round(waveTarget*normalized)));
}

class StoryEnemyAnomalySystem {
 constructor(scene,{definitions=[]}={}){
  this.scene=scene;
  this.currentWave=0;
  this.waveTarget=0;
  this.selectedOrdinals=new Map();
  this.consumedDefinitionIds=new Set();
  this.definitions=Array.isArray(definitions)?definitions.filter(Boolean):[];
  this.installed=false;
 }

 install(){
  this.installed=true;
  return this;
 }

 destroy(){
  this.selectedOrdinals.clear();
  this.consumedDefinitionIds.clear();
  this.installed=false;
  this.scene=null;
 }

 hasPendingReturns(){return false;}

 getDefinitionsForWave(wave){
  const regionIndex=Number(this.scene?.regionIndex)||0;
  return this.definitions.filter(def=>{
   if(!def)return false;
   if((Number(def.wave)||0)!==(Number(wave)||0))return false;
   if(def.once && this.consumedDefinitionIds.has(def.id))return false;
   if(def.regionIndex===undefined || def.regionIndex===null)return true;
   return (Number(def.regionIndex)||0)===regionIndex;
  });
 }

 beginWave(wave,waveTarget){
  this.currentWave=Number(wave)||0;
  this.waveTarget=Math.max(0,Math.floor(Number(waveTarget)||0));
  this.selectedOrdinals.clear();
  if(this.waveTarget<=0)return;

  const definitions=this.getDefinitionsForWave(this.currentWave);
  if(!definitions.length)return;

  for(const definition of definitions){
   let ordinal=toOrdinal(definition,this.waveTarget);
   while(this.selectedOrdinals.has(ordinal) && ordinal<this.waveTarget)ordinal++;
   while(this.selectedOrdinals.has(ordinal) && ordinal>1)ordinal--;
   if(this.selectedOrdinals.has(ordinal))continue;
   this.selectedOrdinals.set(ordinal,definition);
  }
 }

 registerEnemy(enemy,{wave=this.currentWave,spawnOrdinal=0}={}){
  if(!this.installed || !enemy || enemy.type==='champion')return false;
  const normalizedWave=Number(wave)||0;
  const ordinal=Math.max(1,Math.floor(Number(spawnOrdinal)||0));
  if(normalizedWave!==this.currentWave || !this.selectedOrdinals.has(ordinal))return false;

  const definition=this.selectedOrdinals.get(ordinal);
  this.selectedOrdinals.delete(ordinal);

  const seed=deterministicSeed(normalizedWave,ordinal);
  const baseDistance=enemy.type==='mage'?238:(enemy.type==='shield'?142:152);
  const triggerDistance=baseDistance+(seed%31)-15;
  const armDelay=650+(seed%1450);

  enemy.storyAnomaly={
   wave:normalizedWave,
   spawnOrdinal:ordinal,
   seed,
   definition,
   phase:'waiting',
   armedAt:(this.scene?.time?.now||0)+armDelay,
   triggerDistance,
   releaseUntil:0,
   fleeAngle:0,
   fleeStartedAt:0
  };
  return true;
 }

 isEnemyAnomalyActive(enemy,time=this.scene?.time?.now||0){
  const state=enemy?.storyAnomaly;
  if(!state)return false;
  return state.phase==='dialogue' || state.phase==='release' || state.phase==='flee' || time<(enemy.storyAnomalyFreezeUntil||0);
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

  state.phase='escaped';
  if(state.definition?.id) this.consumedDefinitionIds.add(state.definition.id);
  enemy.hp=0;
  try{enemy.visual?.destroy?.();}catch{}
  try{enemy.auraVisual?.destroy?.();}catch{}
  try{enemy.reflectVisual?.destroy?.();}catch{}
  try{scene.destroyEnemyReadabilityShadow?.(enemy);}catch{}
  try{enemy.destroy?.();}catch{}
  scene.enemies=(scene.enemies||[]).filter(item=>item && item!==enemy && item.active);
  return true;
 }

 finishDialogue(enemy){
  const state=enemy?.storyAnomaly;
  if(!state || state.phase!=='dialogue')return false;
  if(state.definition?.id)this.consumedDefinitionIds.add(state.definition.id);
  state.phase='release';
  state.releaseUntil=(this.scene?.time?.now||0)+ANOMALY_RELEASE_MS;
  enemy.storyAnomalyFreezeUntil=state.releaseUntil;
  return true;
 }

 cancelDialogue(enemy){
  const state=enemy?.storyAnomaly;
  if(!state || state.phase!=='dialogue')return false;
  state.phase=enemy.active && enemy.hp>0?'waiting':'done';
  state.armedAt=(this.scene?.time?.now||0)+500;
  enemy.storyAnomalyFreezeUntil=0;
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

   // A rejected start (another conversation/menu/focus lock) remains waiting.
   // Do not consume the event or start a flee timer until the shared UI accepts it.
   const started=this.scene?.highlightStoryAnomaly?.(enemy,{cue:state.definition});
   if(!started)return null;
   state.phase='dialogue';
   enemy.storyAnomalyFreezeUntil=0;
  }

  if(state.phase==='dialogue')return {kind:'hesitate'};

  if(state.phase==='release'){
   if(time<state.releaseUntil)return {kind:'release'};
   if((state.definition?.behaviorAfter||'flee')!=='flee'){
    state.phase='done';
    enemy.storyAnomalyFreezeUntil=0;
    if(state.definition?.id) this.consumedDefinitionIds.add(state.definition.id);
    return null;
   }
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

export {ANOMALY_RELEASE_MS};
export default StoryEnemyAnomalySystem;

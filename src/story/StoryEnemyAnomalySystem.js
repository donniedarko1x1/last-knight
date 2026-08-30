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
  const hesitateMs=560+(seed%220);
  const retreatMs=330+((seed*7)%170);

  enemy.storyAnomaly={
   wave:normalizedWave,
   spawnOrdinal:ordinal,
   phase:'waiting',
   armedAt:(this.scene?.time?.now||0)+armDelay,
   triggerDistance,
   hesitateMs,
   retreatMs,
   hesitateUntil:0,
   retreatUntil:0
  };
  return true;
 }

 isEnemyAnomalyActive(enemy,time=this.scene?.time?.now||0){
  const state=enemy?.storyAnomaly;
  if(!state)return false;
  return state.phase==='hesitate' || state.phase==='retreat' || time<(enemy.storyAnomalyFreezeUntil||0);
 }

 updateEnemy(enemy,time,distance){
  const state=enemy?.storyAnomaly;
  if(!state || state.phase==='done')return null;

  if(state.phase==='waiting'){
   if(time<state.armedAt || distance>state.triggerDistance)return null;
   if(time<(enemy.staggerUntil||0) || time<(enemy.skillLiftUntil||0) || time<(enemy.skillTremorUntil||0))return null;

   state.phase='hesitate';
   state.hesitateUntil=time+state.hesitateMs;
   state.retreatUntil=state.hesitateUntil+state.retreatMs;
   enemy.storyAnomalyFreezeUntil=state.hesitateUntil;
   enemy.pendingMeleeHitAt=0;
   enemy.pendingMeleeDamage=0;
   enemy.pendingMeleeRange=0;
   enemy.attackAnimUntil=0;
   enemy.lastAttack=Math.max(enemy.lastAttack||0,time);
   enemy.lastShot=Math.max(enemy.lastShot||0,time);
  }

  if(state.phase==='hesitate'){
   if(time<state.hesitateUntil)return {kind:'hesitate'};
   state.phase='retreat';
   enemy.storyAnomalyFreezeUntil=0;
  }

  if(state.phase==='retreat'){
   if(time<state.retreatUntil)return {kind:'retreat',speedFactor:0.62};
   state.phase='done';
   enemy.storyAnomalyFreezeUntil=0;
   // Do not let the enemy immediately snap into an attack on the same frame.
   enemy.lastAttack=Math.max(enemy.lastAttack||0,time);
   enemy.lastShot=Math.max(enemy.lastShot||0,time);
  }

  return null;
 }
}

export {STORY_WAVE_ANOMALY_COUNTS};
export default StoryEnemyAnomalySystem;

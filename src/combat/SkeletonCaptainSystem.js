import CombatBarkSystem from './CombatBarkSystem.js';
import {createCaptainAttackTelegraph} from './CaptainAttackTelegraph.mjs';
import {CAPTAIN, captainStats, commandDelay, direction8, direction4, skillFrame, strikeHits,
 ringRadiusAt, ringIsBroken, chooseFleeing} from '../config/captainConfig.mjs';

const alive=e=>Boolean(e?.active && e.hp>0);
const stop=e=>e?.body?.setVelocity(0,0);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const minimumSurvivors=count=>Math.max(CAPTAIN.minSoldiers,Math.floor(count/2)+1);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

export default class SkeletonCaptainSystem {
 constructor(scene){
  this.scene=scene;this.barks=new CombatBarkSystem(scene);this.captains=new Set();
  this.ring=null;this.guards=new Map();this.nextGuardAt=0;this.stunUntil=0;this.commandsUsed=0;
 }
 soldiers(){return this.scene.enemies.filter(e=>alive(e) && e.type==='skeleton' && !e.captainFlee);}
 attach(e,wave){
  const s=this.scene,stats=captainStats(wave);
  e.hp=e.maxHp=stats.hp;e.speed=stats.speed;e.attackDamage=stats.damage;e.hitRadius=16.1;
  e.captainFacing='south';e.captainBornAt=s.time.now;e.captainNextCommand=s.time.now+commandDelay(true);
  e.captainNextStrike=s.time.now+1600;e.captainPhase='walk';
  e.captainSpecialChoice=null;e.captainPendingSpecial=null;e.captainDisableRing=false;
  e.visual.stop();
  e.captainGroundLight=s.add.ellipse(e.x,e.y+10,136,82,0xd86543,.12)
   .setBlendMode(Phaser.BlendModes.SCREEN).setDepth(12);
  e.captainAura=s.add.image(e.x,e.y,'skeleton_captain_scarlet_cast_01').setDepth(16).setVisible(false);
  this.captains.add(e);
  this.render(e,s.time.now);
 }
 isStunned(now=this.scene.time.now){return now<this.stunUntil;}
 onPlayerDamaged(attacker,source,now){
  if(attacker?.type!=='captain' || source!=='melee:captain' || this.isStunned(now))return;
  this.stunUntil=now+CAPTAIN.stunMs;
  stop(this.scene.player);
  this.barks.show(this.scene.player,'Не могу двигаться...',CAPTAIN.stunMs,65);
 }
 clearRing(){
  this.ring?.visual?.destroy();this.ring=null;
  for(const e of this.scene.enemies||[]){
   e.captainFormationTarget=null;e.captainFormationSpeedLimit=0;
   if(e.visual?.anims){ e.visual.anims.timeScale=1; }
  }
 }
 clear(){
  this.clearRing();this.guards.clear();this.nextGuardAt=0;this.stunUntil=0;this.commandsUsed=0;this.barks.clear();
  for(const e of this.captains){
   e.captainGroundLight?.destroy();e.captainGroundLight=null;
   e.captainAura?.destroy();e.captainAura=null;e.captainTelegraph?.destroy();
   e.captainTelegraph=null;e.captainPhase='walk';e.captainImpactAt=0;e.captainCommandSoldiers=null;
   e.captainPendingSpecial=null;e.captainSpecialChoice=null;e.captainDisableRing=false;
  }
  this.captains.clear();
 }
 remove(e){
  this.barks.remove(e);e.captainGroundLight?.destroy();e.captainAura?.destroy();e.captainTelegraph?.destroy();
  e.captainGroundLight=null;e.captainAura=null;e.captainTelegraph=null;
  e.captainCommandSoldiers=null;e.captainPendingSpecial=null;
  this.captains.delete(e);this.guards.delete(e);
  if(this.ring?.captain===e)this.clearRing();
 }
 onDeath(e,now){
  if(e.type!=='captain' || e.captainMoraleTriggered)return;
  e.captainMoraleTriggered=true;
  this.clearRing();this.guards.clear();this.remove(e);
  const zone=this.scene.getCaptainZoneBounds();
  for(const soldier of chooseFleeing(this.soldiers())){
   const north=soldier.y<this.scene.player.y;
   soldier.captainFlee={until:now+CAPTAIN.fleeMs,target:{
    // Never run back through the west/entry gate.
    x:Math.min(zone.end-45,Math.max(zone.start+220,soldier.x+250)),
    y:north?32:zone.height-32
   }};
   soldier.pendingMeleeHitAt=0;soldier.pendingMeleeDamage=0;soldier.pendingMeleeRange=0;
   soldier.attackAnimUntil=0;soldier.captainFormationTarget=null;
  }
 }
 retireFleeing(e){
  this.remove(e);
  for(const key of ['visual','auraVisual','reflectVisual','saintsNailMarkVisual'])e[key]?.destroy();
  this.scene.destroyEnemyReadabilityShadow(e);
  e.destroy(); // Deliberately no finalizeEnemyDeath, XP, heart, kill or relic proc.
 }
 updateFlee(e,now){
  const f=e.captainFlee;if(!f)return false;
  const remaining=f.until-now;
  if(remaining<=0 || dist(e,f.target)<24){this.retireFleeing(e);return true;}
  this.move(e,f.target,Math.max(210,e.speed*2),now);
  if(remaining<650){e.visual?.setAlpha(Math.max(0,remaining/650));e.shadowVisual?.setAlpha(Math.max(0,remaining/650)*.25);}
  return true;
 }
 move(e,target,speed,now){
  const dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy);
  if(d<5){stop(e);return;}
  this.scene.setEnemySteeredVelocity(e,dx/d*Math.min(speed,d*5),dy/d*Math.min(speed,d*5),now,target);
 }
 update(now){
  const s=this.scene;
  this.barks.update();
  for(const e of [...this.captains]){
   if(!alive(e)){
    if(e?.active && e.hp<=0)this.onDeath(e,now);else this.remove(e);
    continue;
   }
   // Windup and command are committed actions. Player CC may have set a timer
   // immediately before the phase began, but it must not cancel the Captain's
   // telegraphed strike or ring command once he has committed to it.
   const committed=e.captainPhase==='windup' || e.captainPhase==='command';
   if(!committed && (now<(e.staggerUntil||0) || now<(e.skillLiftUntil||0) || now<(e.skillTremorUntil||0))){
    stop(e);
   }
  }
  const soldiers=this.soldiers();
  for(const e of s.enemies){e.captainFormationTarget=null;e.captainFormationSpeedLimit=0;}
  if(s.devFlags?.enemyAiFrozen || s.devFlags?.enemyMovementFrozen){this.clearRing();this.guards.clear();return;}
  if(this.ring){
   this.updateRing(now);
   return;
  }
  const leader=[...this.captains].find(alive);
  if(!leader){this.guards.clear();return;}
  if(now>=this.nextGuardAt && leader.captainPhase==='walk'){
   this.guards.clear();this.nextGuardAt=now+CAPTAIN.guardIntervalMs;
   for(const e of [...soldiers].sort((a,b)=>dist(a,leader)-dist(b,leader)).slice(0,CAPTAIN.guardCount)){
    this.guards.set(e,now+CAPTAIN.guardDurationMs);
   }
  }
  const angle=Math.atan2(s.player.y-leader.y,s.player.x-leader.x);
  let i=0;
  for(const [e,until] of this.guards){
   if(!alive(e) || e.captainFlee || now>=until){this.guards.delete(e);continue;}
   const slot=angle+(i++-1)*.65;
   e.captainFormationTarget={x:leader.x+Math.cos(slot)*58,y:leader.y+Math.sin(slot)*58,ring:false};
  }
  this.applySummonedBodyguards(leader);
 }
 assignRingSlots(soldiers){
  const r=this.ring;
  r.members=[...soldiers].sort((a,b)=>Math.atan2(a.y-r.y,a.x-r.x)-Math.atan2(b.y-r.y,b.x-r.x));
  // Stable circular ordering prevents needless swapping while the hero moves.
  const step=Math.PI*2/r.members.length;
  const residuals=r.members.map((e,i)=>Math.atan2(e.y-r.y,e.x-r.x)-i*step);
  const offset=Math.atan2(residuals.reduce((sum,a)=>sum+Math.sin(a),0),
   residuals.reduce((sum,a)=>sum+Math.cos(a),0));
  r.slots=new Map(r.members.map((e,i)=>[e,offset+i*step]));
 }
 ringGoal(e,now){
  const r=this.ring,angle=r.slots.get(e),radius=ringRadiusAt(r,now);
  return {x:r.x+Math.cos(angle)*radius,y:r.y+Math.sin(angle)*radius,
   ring:true,gather:r.phase==='gather',angle};
 }
 updateRing(now){
  const r=this.ring,p=this.scene.player;
  const survivors=r.members.filter(e=>alive(e)&&!e.captainFlee);
  if(!alive(r.captain)||ringIsBroken(r,p,now,survivors.length)){this.clearRing();return;}
  if(r.phase==='gather'){
   const elapsed=(now-r.updatedAt)/1000;
   r.vx=elapsed>0?(p.x-r.x)/elapsed:0;r.vy=elapsed>0?(p.y-r.y)/elapsed:0;
   r.x=p.x;r.y=p.y;r.updatedAt=now;
   if(survivors.length!==r.members.length)this.assignRingSlots(survivors);
   const ready=r.members.filter(e=>dist(e,this.ringGoal(e,now))<=CAPTAIN.ringSlotTolerance);
   const allReady=ready.length===r.members.length && now-r.startedAt>=CAPTAIN.ringMinGatherMs;
   if(allReady || now-r.startedAt>=CAPTAIN.ringGatherMs){
    if(ready.length<CAPTAIN.minSoldiers){this.clearRing();return;}
    // Stragglers resume normal AI. No teleports or extra time to rebuild the ring.
    r.members=ready;r.slots=new Map(ready.map(e=>[e,r.slots.get(e)]));
    r.minimumMembers=minimumSurvivors(ready.length);
    r.phase='contract';r.contractStartedAt=now;r.vx=0;r.vy=0;
   }
  }else{
   r.members=survivors; // Keep casualty gaps; no redistributing during contraction.
  }
  r.visual.setPosition(r.x,r.y).setRadius(ringRadiusAt(r,now)).setAlpha(r.phase==='gather'?.10:.16);
  for(const e of r.members)e.captainFormationTarget=this.ringGoal(e,now);
 }
 canFormRing(){
  const s=this.scene,p=s.player,z=s.getCaptainZoneBounds(),margin=CAPTAIN.ringRadius+35;
  if(p.x<z.start+margin || p.x>z.end-margin || p.y<margin || p.y>z.height-margin)return false;
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6,x=p.x+Math.cos(a)*CAPTAIN.ringRadius,y=p.y+Math.sin(a)*CAPTAIN.ringRadius;
   if(s.isAshPathBlocked(p.x,p.y,x,y,20))return false;
  }
  return true;
 }
 beginRing(e,now){
  const cohort=e.captainCommandSoldiers||this.soldiers();
  e.captainCommandSoldiers=null;
  const soldiers=cohort.filter(s=>alive(s)&&!s.captainFlee);
  const minimumMembers=minimumSurvivors(cohort.length);
  if(!alive(e) || !this.canFormRing() || soldiers.length<minimumMembers)return false;
  this.clearRing();this.guards.clear();
  const p=this.scene.player;
  this.ring={captain:e,x:p.x,y:p.y,startedAt:now,updatedAt:now,phase:'gather',
   members:[],slots:new Map(),minimumMembers,vx:0,vy:0,
   visual:this.scene.add.circle(p.x,p.y,CAPTAIN.ringRadius,0x9c2a20,0)
    .setStrokeStyle(1.5,0xd45239,.6).setDepth(1)};
  for(const soldier of soldiers){
   soldier.pendingMeleeHitAt=0;soldier.pendingMeleeDamage=0;soldier.pendingMeleeRange=0;
   soldier.attackAnimUntil=0;
  }
  this.assignRingSlots(soldiers);
  this.updateRing(now);
  return true;
 }
 originalEscortSoldiers(){
  return this.soldiers().filter(e=>!e.captainSummonKind);
 }
 reinforcementSpawnPoint(leader,index,total){
  const s=this.scene,z=s.getCaptainZoneBounds();
  const angle=(index/Math.max(1,total))*Math.PI*2 + ((index%2)?0.18:-0.18);
  const radius=Phaser.Math.Between(430,560);
  return {
   x:Math.max(z.start+70,Math.min(z.end-70,leader.x+Math.cos(angle)*radius)),
   y:Math.max(70,Math.min(z.height-70,leader.y+Math.sin(angle)*radius))
  };
 }
 spawnSpecialEnemy(leader,type,index,total,kind,role,slot=0,count=1){
  const enemy=this.scene.spawnEnemy(type,this.reinforcementSpawnPoint(leader,index,total),{skipStoryAnomaly:true});
  if(!enemy)return null;
  enemy.captainSummonKind=kind;
  enemy.captainSummonRole=role;
  enemy.captainSummonSlot=slot;
  enemy.captainSummonCount=count;
  enemy.captainSummonLeader=leader;
  if(role==='aggressive') enemy.speed=Math.round((enemy.speed||90)*CAPTAIN.reinforcementAggressionSpeedFactor);
  return enemy;
 }
 summonReinforcements(leader){
  if(!alive(leader))return;
  const skeletons=CAPTAIN.reinforcementSkeletons;
  const shields=CAPTAIN.reinforcementShields;
  const mages=CAPTAIN.reinforcementMages;
  const total=skeletons+shields+mages;
  let index=0;
  for(let i=0;i<skeletons;i++,index++)this.spawnSpecialEnemy(leader,'skeleton',index,total,'reinforcement','aggressive',i,skeletons);
  for(let i=0;i<shields;i++,index++)this.spawnSpecialEnemy(leader,'shield',index,total,'reinforcement','bodyguard',i,shields);
  for(let i=0;i<mages;i++,index++)this.spawnSpecialEnemy(leader,'mage',index,total,'reinforcement','rearMage',i,mages);
 }
 summonEmergencyGuard(leader){
  if(!alive(leader))return;
  const total=CAPTAIN.emergencyGuardShields;
  for(let i=0;i<total;i++)this.spawnSpecialEnemy(leader,'shield',i,total,'guard','bodyguard',i,total);
 }
 startSpecialCommand(e,now,kind){
  if(!alive(e) || e.captainSpecialChoice || e.captainPhase!=='walk')return false;
  e.captainSpecialChoice=kind;
  e.captainPendingSpecial=kind;
  e.captainDisableRing=true;
  e.captainPhase='command';
  e.captainPhaseUntil=now+CAPTAIN.specialCommandMs;
  e.captainFacing=direction8(this.scene.player.x-e.x,this.scene.player.y-e.y,e.captainFacing);
  this.clearRing();this.guards.clear();stop(e);
  this.barks.show(e,kind==='reinforcement'?'ПОДКРЕПЛЕНИЕ':'ОХРАНА',CAPTAIN.specialCommandMs,96);
  return true;
 }
 resolveSpecialCommand(e){
  const kind=e.captainPendingSpecial;
  e.captainPendingSpecial=null;
  if(kind==='reinforcement')this.summonReinforcements(e);
  else if(kind==='guard')this.summonEmergencyGuard(e);
 }
 applySummonedBodyguards(leader){
  if(!alive(leader))return;
  const guards=(this.scene.enemies||[]).filter(e=>alive(e)&&e.captainSummonLeader===leader&&e.captainSummonRole==='bodyguard');
  if(!guards.length)return;
  const front=Math.atan2(this.scene.player.y-leader.y,this.scene.player.x-leader.x);
  guards.sort((a,b)=>(a.captainSummonSlot||0)-(b.captainSummonSlot||0));
  const count=guards.length;
  guards.forEach((e,i)=>{
   const angle=front+(i/count)*Math.PI*2;
   e.captainFormationTarget={x:leader.x+Math.cos(angle)*CAPTAIN.summonedGuardRadius,y:leader.y+Math.sin(angle)*CAPTAIN.summonedGuardRadius,ring:false,summonedGuard:true};
  });
 }
 moveSupport(e,now){
  if(!alive(e) || e.captainSummonRole!=='rearMage')return false;
  const leader=e.captainSummonLeader;
  if(!alive(leader))return false;
  const p=this.scene.player;
  let dx=leader.x-p.x,dy=leader.y-p.y,d=Math.hypot(dx,dy);
  if(d<1){dx=1;dy=0;d=1;}
  dx/=d;dy/=d;
  const sideX=-dy,sideY=dx;
  const count=Math.max(1,e.captainSummonCount||2);
  const slot=e.captainSummonSlot||0;
  const centered=slot-(count-1)/2;
  const target={
   x:leader.x+dx*CAPTAIN.summonedMageBackDistance+sideX*centered*CAPTAIN.summonedMageSideSpacing,
   y:leader.y+dy*CAPTAIN.summonedMageBackDistance+sideY*centered*CAPTAIN.summonedMageSideSpacing
  };
  this.move(e,target,Math.max(e.speed||80,105),now);
  return true;
 }

 startCommand(e,now){
  if(this.commandsUsed>=CAPTAIN.maxCommandsPerWave)return false;
  this.commandsUsed++;
  e.captainCommandSoldiers=this.soldiers();
  e.captainPhase='command';e.captainPhaseUntil=now+CAPTAIN.commandMs;
  e.captainNextCommand=now+commandDelay(false);
  e.captainFacing=direction8(this.scene.player.x-e.x,this.scene.player.y-e.y,e.captainFacing);
  this.guards.clear();stop(e);
  this.barks.show(e,'Кольцо',CAPTAIN.commandMs,90);
  return true;
 }
 startStrike(e,now){
  const p=this.scene.player,dx=p.x-e.x,dy=p.y-e.y;
  e.captainPhase='windup';e.captainImpactAt=now+CAPTAIN.windupMs;
  e.captainStrikeAngle=Math.atan2(dy,dx);e.captainStrikeDirection=direction4(dx,dy);
  e.captainNextStrike=now+CAPTAIN.attackCooldownMs;
  stop(e);
  e.captainTelegraph?.destroy();
  e.captainTelegraph=createCaptainAttackTelegraph(this.scene,e.x,e.y,
   e.captainStrikeAngle,CAPTAIN.strikeRange,CAPTAIN.strikeHalfAngle);
 }
 impact(e,now){
  e.captainImpactAt=0;e.captainPhase='recovery';e.captainPhaseUntil=now+CAPTAIN.recoveryMs;
  e.captainTelegraph?.destroy();e.captainTelegraph=null;
  const s=this.scene;
  s.cameras.main.shake(180,.004,false);
  const impactScale=CAPTAIN.strikeRange/282;
  const x=e.x+Math.cos(e.captainStrikeAngle)*(192*impactScale),y=e.y+Math.sin(e.captainStrikeAngle)*(192*impactScale);
  const dust=s.add.ellipse(x,y,144*impactScale,60*impactScale,0xc9ad85,.30).setDepth(14);
  s.tweens.add({targets:dust,scale:1.8,alpha:0,duration:320,onComplete:()=>dust.destroy()});
  s.playHeroSwordImpactSfx();
  if(!s.devFlags?.enemyAttacksDisabled && strikeHits(e,s.player,e.captainStrikeAngle))s.damagePlayer(e.attackDamage,'melee:captain',e);
 }
 updateCaptain(e,now){
  const s=this.scene,p=s.player;
  if(e.captainPhase==='command'){
   stop(e);
   if(now>=e.captainPhaseUntil){
    e.captainPhase='walk';
    if(e.captainPendingSpecial)this.resolveSpecialCommand(e);
    else this.beginRing(e,now);
   }
   return;
  }
  if(e.captainPhase==='windup'){
   e.captainTelegraph?.setPosition(e.x,e.y);
   stop(e);if(now>=e.captainImpactAt)this.impact(e,now);return;
  }
  if(e.captainPhase==='recovery'){
   stop(e);if(now>=e.captainPhaseUntil)e.captainPhase='walk';return;
  }
  if(!e.captainSpecialChoice && !s.devFlags?.enemyAttacksDisabled && !this.ring){
   const originalAlive=this.originalEscortSoldiers().length;
   const originalWaveFullySpawned=s.spawned>=s.waveTarget;
   if(originalWaveFullySpawned && originalAlive===0){
    if(this.startSpecialCommand(e,now,'reinforcement'))return;
   } else if(originalAlive>0 && e.maxHp>0 && e.hp/e.maxHp<=CAPTAIN.emergencyGuardHpRatio){
    if(this.startSpecialCommand(e,now,'guard'))return;
   }
  }
  if(!e.captainDisableRing && this.commandsUsed<CAPTAIN.maxCommandsPerWave && !s.devFlags?.enemyAttacksDisabled && now>=e.captainNextCommand && !this.ring && this.soldiers().length>=CAPTAIN.minSoldiers && this.canFormRing()){
   this.startCommand(e,now);return;
  }
  if(!s.devFlags?.enemyAttacksDisabled && dist(e,p)<=CAPTAIN.strikeStartRange && now>=e.captainNextStrike){this.startStrike(e,now);return;}
  if(dist(e,p)>72)this.move(e,p,e.speed,now);else stop(e);
 }
 moveSoldier(e,now){
  if(e?.captainSummonRole==='aggressive'){
   if(now<(e.attackAnimUntil||0)){stop(e);return true;}
   const p=this.scene.player;
   if(!p?.active)return false;
   this.move(e,p,Math.max(e.speed||90,110),now);
   return true;
  }
  const goal=e.captainFormationTarget;
  if(!goal)return false;
  if(!goal.ring){
   if(now<(e.attackAnimUntil||0)){stop(e);return true;}
   this.move(e,goal,e.speed*1.25,now);return true;
  }
  const r=this.ring;
  if(!r)return false;
  if(!goal.gather && now<(e.attackAnimUntil||0)){stop(e);return true;}
  let target=goal;
  if(goal.gather){
   // Approach distant slots around the outside, not through the hero's body.
   const dx=e.x-r.x,dy=e.y-r.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
   const delta=wrap(goal.angle-angle);
   if(Math.abs(delta)>.30){
    const turn=angle+Math.max(-.45,Math.min(.45,delta));
    const radius=Math.max(CAPTAIN.ringRadius+20,Math.min(d,CAPTAIN.ringRadius+55));
    target={x:r.x+Math.cos(turn)*radius,y:r.y+Math.sin(turn)*radius};
   }
  }
  const leaderSpeed=Math.hypot(r.vx,r.vy);
  const cap=goal.gather?Math.max(CAPTAIN.ringCatchupSpeed,leaderSpeed+CAPTAIN.ringCatchupBonus):CAPTAIN.ringSpeed;
  const radialSpeed=-(CAPTAIN.ringRadius-CAPTAIN.ringMinRadius)/CAPTAIN.ringContractMs*1000;
  const feedX=goal.gather?r.vx:Math.cos(goal.angle)*radialSpeed;
  const feedY=goal.gather?r.vy:Math.sin(goal.angle)*radialSpeed;
  let vx=feedX+(target.x-e.x)*7,vy=feedY+(target.y-e.y)*7;
  const speed=Math.hypot(vx,vy);
  if(speed>cap){vx*=cap/speed;vy*=cap/speed;}
  e.captainFormationSpeedLimit=cap;
  this.scene.setEnemySteeredVelocity(e,vx,vy,now,target);
  return true;
 }
 render(e,now){
  if(!e.visual?.active)return;
  const s=this.scene,v=e.visual;
  let key;
  if(e.captainPhase==='command')key=skillFrame(e.captainFacing);
  else if(e.captainPhase==='windup' || e.captainPhase==='recovery')key=`skeleton_captain_attack_${e.captainStrikeDirection}_${e.captainPhase==='windup'?'01':'ground'}`;
  else{
   const vx=e.body?.velocity.x||0,vy=e.body?.velocity.y||0,moving=Math.hypot(vx,vy)>5;
   if(moving)e.captainFacing=direction8(vx,vy,e.captainFacing);
   const frame=moving?Math.floor((now-e.captainBornAt)/230)%2+1:1;
   key=`skeleton_captain_walk_${e.captainFacing}_0${frame}`;
  }
  const meta=s.cache.json.get('skeleton_captain_frames')?.[key];
  if(!meta || !s.textures.exists(key))return;
  v.stop();v.setTexture(key);
  // Ordinary skeleton body is 115 px at scale .5; body +15%, not PNG +15%.
  const height=115*.5*CAPTAIN.bodyScale,scale=height/meta.bodyHeight;
  const feetOffset=(184-192*.78)*.5*CAPTAIN.bodyScale;
  v.setOrigin(meta.x,meta.ground-feetOffset/(v.height*scale)).setScale(scale).setPosition(e.x,e.y);
  e.visualBaseScale=scale;
  if(now<(e.skillLiftUntil||0)){
   const t=(now-e.skillLiftStartAt)/Math.max(1,e.skillLiftUntil-e.skillLiftStartAt);
   v.y-=Math.sin(Math.max(0,Math.min(1,t))*Math.PI)*(e.skillLiftHeight||112);
  }
  const aura=e.captainAura;
  if(e.captainGroundLight?.active){
   e.captainGroundLight.setPosition(e.x,e.y+height*.17);
  }
  if(aura?.active){
   const casting=e.captainPhase==='command';aura.setVisible(casting);
   if(casting){
    const elapsed=CAPTAIN.commandMs-(e.captainPhaseUntil-now);
    aura.setTexture(`skeleton_captain_scarlet_cast_0${Math.floor(elapsed/180)%2+1}`)
     .setPosition(e.x,e.y-height*.32).setDisplaySize(height*2,height*2)
     .setAlpha(Math.min(1,elapsed/160,(e.captainPhaseUntil-now)/180));
   }
  }
 }
}

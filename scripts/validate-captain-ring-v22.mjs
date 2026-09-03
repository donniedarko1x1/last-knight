import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import SkeletonCaptainSystem from '../src/combat/SkeletonCaptainSystem.js';
import {CAPTAIN,ringRadiusAt} from '../src/config/captainConfig.mjs';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const navigation=readFileSync(new URL('../src/world/NavigationSystem.js',import.meta.url),'utf8');
const separationStart=navigation.indexOf('\n applyEnemySoftSeparation(');
const separation=vm.runInNewContext(`({${navigation.slice(separationStart,navigation.indexOf('\n }',separationStart)+3)}})`).applyEnemySoftSeparation;
const name='setEnemySteeredVelocity',start=main.indexOf(`\n ${name}(`);
const steering=vm.runInNewContext(`({${main.slice(start,main.indexOf('\n }',start)+3)}})`,{
 Phaser:{Math:{Angle:{Wrap:a=>Math.atan2(Math.sin(a),Math.cos(a)),Between:(x,y,a,b)=>Math.atan2(b-y,a-x)},
 Distance:{Squared:(x,y,a,b)=>(a-x)**2+(b-y)**2}}}
})[name];
function velocity(){return {x:0,y:0,length(){return Math.hypot(this.x,this.y);},lengthSq(){return this.x*this.x+this.y*this.y;},scale(k){this.x*=k;this.y*=k;}};}
function entity(x,y,type='skeleton'){
 const v=velocity();return {x,y,active:true,hp:100,type,speed:110,hitRadius:14,
  body:{enable:true,velocity:v,setVelocity(x,y){v.x=x;v.y=y;}},
  setPosition(){throw Error('Formation must never teleport an actor');}};
}
function visual(){return {active:true,setStrokeStyle(){return this;},setDepth(){return this;},
 setPosition(x,y){this.x=x;this.y=y;return this;},setRadius(r){this.radius=r;return this;},
 setAlpha(){return this;},destroy(){this.active=false;}};}
function fixture(count=8){
 const player=entity(5500,864,'hero'),captain=entity(5820,864,'captain');
 const soldiers=Array.from({length:count},(_,i)=>{
  const a=i*Math.PI*2/count;return entity(player.x+Math.cos(a)*145,player.y+Math.sin(a)*145);
 });
 const s={player,enemies:[...soldiers,captain],time:{now:0},devFlags:{},add:{circle:visual},
  getCaptainZoneBounds:()=>({start:4000,end:7600,height:1728}),isAshPathBlocked:()=>false,
  setEnemySteeredVelocity:steering,updateEnemyStuckState(){},getEnemyNavigationWaypoint:()=>null,
  getEnemyMovementSpeed:e=>e.speed};
 const system=new SkeletonCaptainSystem(s);
 system.barks={show(owner,text,duration){this.last={owner,text,duration};},update(){},remove(){},clear(){}};
 system.captains.add(captain);captain.captainPhase='walk';
 return {s,system,player,captain,soldiers};
}
function begin(f){assert.equal(f.system.beginRing(f.captain,0),true);return f.system.ring;}
function tick(f,now){f.s.time.now=now;f.system.update(now);}

// Settled units inherit real hero displacement; only laggards need extra speed.
const follow=fixture(),r=begin(follow),slots=new Map(r.slots);
follow.player.x+=22;for(const e of follow.soldiers)e.x+=22;
tick(follow,100);
for(const e of follow.soldiers){
 follow.system.moveSoldier(e,100);
 assert.ok(Math.abs(e.body.velocity.x-220)<.001);assert.ok(Math.abs(e.body.velocity.y)<.001);
 assert.equal(r.slots.get(e),slots.get(e));
}
assert.equal(r.x,follow.player.x);assert.equal(r.visual.x,r.x);
const laggard=follow.soldiers[0];laggard.x-=80;
follow.system.moveSoldier(laggard,100);assert.ok(laggard.body.velocity.length()>220);
separation.call(follow.s,100);
assert.ok(laggard.body.velocity.length()>220,'crowd limiter must not erase formation boost');

// Damage during the shout counts, and fresh spawns cannot repair the command.
const shout=fixture();assert.equal(shout.system.startCommand(shout.captain,0),true);
assert.equal(shout.system.barks.last.text,'Кольцо');assert.equal(shout.system.barks.last.duration,1000);
for(const e of shout.soldiers.slice(0,4))e.hp=0;
shout.s.enemies.push(...Array.from({length:4},()=>entity(5700,864)));
assert.equal(shout.system.beginRing(shout.captain,1000),false);
assert.equal(shout.system.commandsUsed,1);

// One casualty redistributes gathering slots without resetting the 4-second window.
const casualties=fixture();const gathering=begin(casualties);
casualties.soldiers[0].hp=0;tick(casualties,100);
assert.equal(gathering.members.length,7);assert.equal(gathering.startedAt,0);
for(const e of casualties.soldiers.slice(1,4))e.hp=0;
tick(casualties,200);assert.equal(casualties.system.ring,null,'half lost breaks gathering');

// All ready may settle early. The centre must remain fixed afterwards.
const locked=fixture();const lr=begin(locked);tick(locked,450);
assert.equal(lr.phase,'contract');assert.equal(lr.contractStartedAt,450);
const fixed={x:lr.x,y:lr.y};locked.player.x+=35;tick(locked,700);
assert.equal(lr.x,fixed.x);assert.equal(lr.y,fixed.y);assert.ok(ringRadiusAt(lr,700)<145);
const survivor=lr.members[1],angle=lr.slots.get(survivor);
lr.members[0].hp=0;tick(locked,750);
assert.equal(lr.slots.get(survivor),angle,'do not close a killed soldier’s gap by shuffling');
survivor.attackAnimUntil=1200;locked.system.moveSoldier(survivor,800);
assert.equal(survivor.body.velocity.length(),0,'no skating during planted attack');
locked.player.x=lr.x+ringRadiusAt(lr,900)+CAPTAIN.ringEscapeTolerance+1;
tick(locked,900);assert.equal(locked.system.ring,null,'escape after contraction is allowed');

// Deadline: commit the ready subset, no rescheduling, teleport or late recruitment.
const partial=fixture(6);const pr=begin(partial);
for(const e of partial.soldiers.slice(3)){e.x+=900;e.y+=900;}
tick(partial,CAPTAIN.ringGatherMs);
assert.equal(pr.phase,'contract');assert.equal(pr.members.length,3);
assert.ok(partial.soldiers.slice(3).every(e=>!e.captainFormationTarget));
const newcomer=entity(5500,1010);partial.s.enemies.push(newcomer);tick(partial,CAPTAIN.ringGatherMs+100);
assert.equal(newcomer.captainFormationTarget,null);assert.equal(pr.members.length,3);
tick(partial,CAPTAIN.ringGatherMs+CAPTAIN.ringContractMs);assert.equal(partial.system.ring,null,'bounded contraction time');
const failed=fixture();begin(failed);for(const e of failed.soldiers.slice(2))e.x+=1000;
tick(failed,CAPTAIN.ringGatherMs);assert.equal(failed.system.ring,null,'fewer than three ready cancels');

// Captain death cancels either phase, still scatters half of the living soldiers.
for(const phase of ['gather','contract']){
 const f=fixture();const ring=begin(f);if(phase==='contract')tick(f,450);
 f.captain.hp=0;tick(f,500);
 assert.equal(f.system.ring,null);assert.equal(ring.visual.active,false);
 assert.equal(f.soldiers.filter(e=>e.captainFlee).length,4);
 assert.ok(f.soldiers.every(e=>!e.captainFormationTarget&&!e.captainFormationSpeedLimit));
}
const limit=fixture();
assert.equal(limit.system.startCommand(limit.captain,0),true);
assert.equal(limit.system.startCommand(limit.captain,10000),true);
assert.equal(limit.system.startCommand(limit.captain,20000),false);
limit.system.clear();assert.equal(limit.system.commandsUsed,0);

// Simulate actual steering + crowd separation at several frame rates. Physics
// integration here is a headless adapter, not a full browser/Arcade playthrough.
const results=[];
for(const layout of ['surround','front'])for(const hz of [30,60,120])for(const kind of ['east','west','north','south','diagonal','turn','boost']){
 const f=fixture();
 f.soldiers.forEach((e,i)=>{
  const a=i*Math.PI*2/8;
  const radius=i%2?270:190;e.x=f.player.x+Math.cos(a)*radius;e.y=f.player.y+Math.sin(a)*radius;
  if(layout==='front'){e.x=f.player.x+220+i*25;e.y=f.player.y+(i-3.5)*35;}
 });
 begin(f);let maxSpeed=0,ready=0;
 for(let frame=1;frame<=Math.ceil(CAPTAIN.ringGatherMs*hz/1000)+1;frame++){
  const dt=1/hz,now=frame*1000/hz;
  const speed=kind==='boost'?297:220;
  let direction={east:0,west:Math.PI,north:-Math.PI/2,south:Math.PI/2,diagonal:Math.PI/4,turn:now<700?0:(now<1400?Math.PI/2:Math.PI),boost:0}[kind];
  f.player.x+=Math.cos(direction)*speed*dt;f.player.y+=Math.sin(direction)*speed*dt;
  tick(f,now);
  if(!f.system.ring)break;
  if(f.system.ring.phase==='contract'){ready=f.system.ring.members.length;break;}
  for(const e of f.soldiers){f.system.moveSoldier(e,now);}
  separation.call(f.s,now);
  for(const e of f.soldiers){
   const v=e.body.velocity;maxSpeed=Math.max(maxSpeed,v.length());
   assert.ok(v.length()<=Math.max(CAPTAIN.ringCatchupSpeed,speed+CAPTAIN.ringCatchupBonus)+.01);
   e.x+=v.x*dt;e.y+=v.y*dt;
  }
 }
 assert.ok(ready>=3,`${layout}/${kind} at ${hz}Hz should assemble a viable moving ring (got ${ready})`);
 results.push(`${layout}/${kind}/${hz}Hz:${ready}`);
}
// Control effects and normal attack limits still precede / gate formation movement.
assert.ok(main.indexOf("if(time<(e.skillTremorUntil||0))",main.indexOf('const storyMomentActive='))<main.indexOf('this.captainSystem?.moveSoldier(e,time)'));
assert.match(main,/if\(!gatheringRing && !storyMomentActive/);
assert.match(main,/e\.captainFlee \|\| e\.captainFormationTarget\?\.ring/);
assert.match(main,/e\.visual\.anims\.timeScale=rate/);
console.log('v22 PASSED: moving slots, speed cap, partial deadline, losses, captain death, planted attacks, fixed centre, escape, two commands.');
console.log('Moving-ring simulations: '+results.join(', '));

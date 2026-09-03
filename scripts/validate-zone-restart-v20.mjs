import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import vm from 'node:vm';
import {captureZoneBuild,restoreZoneBuild,restartZoneIndex} from '../src/world/ZoneRestartState.mjs';
import {strikeTelegraphAlpha,createCaptainAttackTelegraph} from '../src/combat/CaptainAttackTelegraph.mjs';
import SkeletonCaptainSystem from '../src/combat/SkeletonCaptainSystem.js';
import HeroMelee from '../src/combat/HeroMelee.js';
import {WORLD_DESIGN} from '../src/config/worldConfig.mjs';
import {CAPTAIN,globalWave} from '../src/config/captainConfig.mjs';
import {STAGE0,BALANCE,HERO_SOCKET_VISUAL_SCALE} from '../src/config/gameplayConfig.mjs';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const main=source.slice(source.indexOf('class MainScene'));
class Client{install(){return this;}clear(){}beginWave(){this.begun=true;}}
function display(x=0,y=0){
 const events=new EventEmitter();
 const o={active:true,x,y,body:{enable:true,setCollideWorldBounds(){},setVelocity(){}},
  destroy(){this.active=false;},on:(...a)=>{events.on(...a);return o;},emit:(...a)=>events.emit(...a)};
 for(const method of ['setDepth','setScrollFactor','setAlpha','setVisible','setOrigin',
  'setScale','setText','setStrokeStyle','setInteractive','play','setResolution'])o[method]=()=>o;
 o.setPosition=(x,y)=>{o.x=x;o.y=y;return o;};
 return o;
}
const globals={WORLD_DESIGN,CAPTAIN,STAGE0,BALANCE,HERO_SOCKET_VISUAL_SCALE,
 captureZoneBuild,restoreZoneBuild,restartZoneIndex,globalWave,HeroMelee,SkeletonCaptainSystem,
 StoryDirector:Client,WorldDialogueSystem:Client,WoundedKnightInteractionSystem:Client,
 ChampionDialogueSystem:Client,StoryEnemyAnomalySystem:Client,StoryObjectiveMarker:Client,
 LastKnightDevTools:Client,STORY_EVENTS:[],STORY_ANOMALY_DEFINITIONS:[],
 window:{matchMedia:()=>({matches:false})},lkAddText:(_s,x,y)=>display(x,y),
 Phaser:{Scenes:{Events:{SHUTDOWN:'shutdown'}},Input:{Keyboard:{KeyCodes:{R:82,ONE:49,TWO:50,THREE:51}}}}};
function method(name,body=main){
 const start=body.indexOf(`\n ${name}(`);
 assert.ok(start>=0,name);
 return vm.runInNewContext(`({${body.slice(start,body.indexOf('\n }',start)+3)}})`,globals)[name];
}
const methods=['init','create','createWorldDesignPrototype','captureZoneEntryCheckpoint',
 'restartCurrentZone','updateWorldRegion','updateWorldStreaming','startZoneWaveSequence','startWave',
 'getZoneCameraMinX','applyWorldCameraBounds','updateWorldCameraBoundary'];
function fixture(){
 const s={time:{now:10000,paused:true},events:new EventEmitter(),scale:new EventEmitter(),
  sys:{game:{device:{input:{touch:false}}}},enemies:[],loaded:[],released:[],sealed:[],
  add:{rectangle:display,circle:display,sprite:display},
  physics:{world:{setBounds(){}},add:{group:()=>({}),staticGroup:()=>({}),existing(){},collider(){}},
   resume(){this.resumed=true;}},
  input:{keyboard:{addKeys:()=>({}),createCursorKeys:()=>({}),addKey:()=>({})}},
  cameras:{main:{worldView:{left:0},setBackgroundColor(){},setBounds(){}}},
  scene:{isActive:()=>false,launch(){},restart(data){s.restarted=data;}},
  loadWorldZone(index){if(!this.loaded.includes(index))this.loaded.push(index);if(this.retiredAsh)assert.notEqual(index,0,'no retired Ash art');},
  releaseRetiredWorldZoneTextures(index){this.released.push(index);},
  createBacktrackSeal(gate){this.sealed.push(gate.id);},
  unloadWorldZone(index){this.released.push(index);},
  findNearestFreeGroundPoint:(x,y)=>({x,y}),
  getGlobalWave(){return globalWave(this.currentWorldZoneIndex,this.wave);},
  getChampionForWave:()=>null,getWaveProfile:()=>({name:'CAPTAIN',subtitle:'',spawnInterval:1400}),
  calculateWaveSpawnInterval:()=>1400,calculateWaveTarget:()=>17,
  getWorldZoneIndexAtX:x=>x>=WORLD_DESIGN.GATES[0].x?1:0};
 for(const name of ['createSpriteAnimations','updateLowHealthState','createHeroWeaponAttachment',
  'updateHeroWeaponAttachment','createReadabilityLayers','applyRegionalHeroBalance',
  'setupResponsiveWorldCamera','bindProgressionGateCollision','setupBackgroundMusic',
  'syncOrientationPause','showWaveBanner','stopAshSwordAmbientAnimation',
  'handleSkillInput','handleViewportResize'])s[name]=()=>{};
 for(const name of methods)s[name]=method(name);
 return s;
}

const s=fixture();s.init();s.create();
assert.equal(s.currentWorldZoneIndex,0);assert.deepEqual(s.loaded,[0]);assert.equal(s.getGlobalWave(),1);
s.level=7;s.xp=13;s.kills=62;s.meleeAttack.damage=42;s.meleeAttack.cooldown=780;
s.championRelics.add('fallenBlessing');s.championSkillEvolutions.add('test-evolution');
s.championEssences.add('will');s.championManaRegenMultiplier=.92;s.manaRegenMs=736;
s.weaponLevels.sword=4;s.player.hp=73;s.player.maxHp=118;
s.player.x=WORLD_DESIGN.GATES[0].x+1;
s.updateWorldRegion(); // Also covers death in the first 360 units after the gate.
const checkpoint=s.zoneEntryCheckpoint;
assert.equal(checkpoint.zoneIndex,1);assert.equal(checkpoint.hero.hp,73);
s.startZoneWaveSequence(1);assert.equal(s.getGlobalWave(),6);
assert.equal(s.zoneEntryCheckpoint,checkpoint);

for(let attempt=0;attempt<3;attempt++){
 s.level=99;s.xp=999;s.weaponLevels.sword=99;s.meleeAttack.damage=999;
 s.championRelics.add('failed-attempt-loot');s.player.hp=0;s.wave=4;
 s.gameOver=true;s.gameOverUiReady=false;
 assert.equal(s.restartCurrentZone(),false,'wait for death UI');
 s.gameOverUiReady=true;assert.equal(s.restartCurrentZone(),true);
 s.init(s.restarted);s.loaded=[];s.retiredAsh=true;s.create();
 assert.equal(s.currentWorldZoneIndex,1);assert.equal(s.progressionBalanceZoneIndex,1);
 assert.equal(s.worldCameraMinX,WORLD_DESIGN.GATES[0].x+120,'restart locks the entry camera boundary immediately');
 assert.equal(s.getGlobalWave(),6);assert.deepEqual(s.loaded,[1]);
 assert.equal(s.player.hp,73);assert.equal(s.player.maxHp,118);
 assert.equal(s.level,7);assert.equal(s.xp,13);assert.equal(s.weaponLevels.sword,4);
 assert.equal(s.meleeAttack.damage,42);assert.equal(s.meleeAttack.cooldown,780);
 assert.equal(s.manaRegenMs,736);assert.equal(s.championRelics.has('fallenBlessing'),true);
 assert.equal(s.championRelics.has('failed-attempt-loot'),false);
 assert.equal(s.championSkillEvolutions.has('test-evolution'),true);
 assert.equal(s.player.x,WORLD_DESIGN.ZONES[1].start+360);
 assert.equal(s.gameOver,false);assert.equal(s.time.paused,false);assert.equal(s.physics.resumed,true);
 assert.equal(s.captainSystem.stunUntil,0);assert.equal(s.captainSystem.commandsUsed,0);
 assert.equal(s.spawned,0);assert.equal(s.waveTarget,17);assert.equal(s.championRetryCheckpoint,null);
 assert.equal(checkpoint.hero.weaponLevels.sword,4,'checkpoint must be a copy');
}
const dev=fixture();dev.init();dev.create();dev.currentWorldZoneIndex=1;
dev.startZoneWaveSequence(1);assert.equal(dev.zoneEntryCheckpoint.zoneIndex,1);
assert.equal(dev.getGlobalWave(),6,'DEV zone selection starts at wave 6');
const first=fixture();first.init();first.create();first.gameOver=first.gameOverUiReady=true;
first.restartCurrentZone();first.init(first.restarted);first.loaded=[];first.create();
assert.equal(first.getGlobalWave(),1);assert.deepEqual(first.loaded,[0]);
for(const invalid of [-1,5,NaN,1.5,'1',undefined])assert.equal(restartZoneIndex({zoneRestart:{zoneIndex:invalid}},5),0);

// Real button binding and real keyboard restart branch both delegate to the same method.
const hud={mainScene:s,add:s.add};method('buildGameOver',source).call(hud);
let clicks=0;hud.mainScene={restartCurrentZone(){clicks++;}};
hud.restartButton.emit('pointerdown');assert.equal(clicks,1);
assert.match(main,/JustDown\(this\.restartKey\)\)\{\s*this\.restartCurrentZone\(\)/);

// Streaming still seals the entry, but never pans or unloads a visible prior zone.
assert.doesNotMatch(main,/ZoneEntryCameraHandoff|targetOffsetX|setWorldCameraFollowOffset/);
assert.match(main,/cam\.startFollow\(this\.player,true,1,1\)/);
const gate=WORLD_DESIGN.GATES[0];s.player.x=gate.x+WORLD_DESIGN.UNLOAD_DEPTH+1;
s.released=[];s.cameras.main.worldView.left=gate.x-100;s.updateWorldStreaming();
assert.deepEqual(s.released,[]);
s.cameras.main.worldView.left=gate.x+80;s.updateWorldStreaming();assert.deepEqual(s.released,[0]);
assert.match(main,/const fallbackSides=forwardOnly \? \['top','right','bottom'\]/);

// Stun and notification use the same scene-clock deadline, including interruption cleanup.
const combat={time:{now:2000},player:display(),enemies:[]};
const captain=new SkeletonCaptainSystem(combat);let bark;
captain.barks={show(...args){bark=args;},clear(){}};
captain.onPlayerDamaged({type:'captain'},'melee:captain',2000);
assert.equal(CAPTAIN.stunMs,1500);assert.equal(bark[2],1500);
assert.equal(captain.isStunned(3499),true);assert.equal(captain.isStunned(3500),false);
captain.clear();assert.equal(captain.isStunned(2000),false);
assert.equal(CAPTAIN.strikeRange,240);assert.equal(CAPTAIN.damage,10);

// Smoothly declining radial/side alpha; no pixels or stroke beyond the hit sector.
const h=CAPTAIN.strikeHalfAngle;
assert.equal(strikeTelegraphAlpha(1,0,h),0);
assert.equal(strikeTelegraphAlpha(.5,h,h),0);
assert.ok(strikeTelegraphAlpha(.99,0,h)<.001);
let previous=1;
for(let r=.48;r<=1.001;r+=.005){const a=strikeTelegraphAlpha(r,0,h);assert.ok(a<=previous);previous=a;}
const textures=new Map();let generated=0;
const graphics={textures:{exists:key=>textures.has(key),createCanvas(key,w,height){
 generated++;const context={createImageData:()=>({data:new Uint8ClampedArray(w*height*4)}),putImageData(){}};
 const t={context,refresh(){}};textures.set(key,t);return t;
}},add:{image(x,y,key){return {x,y,key,setDisplaySize(w,h){this.w=w;this.h=h;return this;},
 setRotation(a){this.angle=a;return this;},setDepth(){return this;}};}}};
for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
 const visual=createCaptainAttackTelegraph(graphics,20,30,angle,CAPTAIN.strikeRange,h);
 assert.equal(visual.angle,angle);assert.equal(visual.x,20);assert.ok(visual.w>480);
}
assert.equal(generated,1,'texture is shared across attacks and retries');
console.log('v20 PASSED: zone 1/2 create + three repeated restarts, entry build, DEV, button/R, wave 6, streaming, camera, 1.5s stun and feathered reusable telegraph.');

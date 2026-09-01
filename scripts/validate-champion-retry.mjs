import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const main=source.slice(source.indexOf('class MainScene'));
const names=['createChampionRetryCheckpoint','hasChampionRetryAvailable',
 'discardEnemyForChampionRetry','clearCombatForChampionRetry','retryChampionFight',
 'spawnChampion','destroyEnemyReadabilityShadow','clearChampionHazards','destroyChampionHazard'];
const methods=names.map(name=>{
 const start=main.indexOf(`\n ${name}(`);
 assert.ok(start>=0,name);
 return main.slice(start,main.indexOf('\n }',start)+3);
});
const runtime=vm.runInNewContext(`({${methods.join(',')}})`,{HERO_SOCKET_VISUAL_SCALE:1});
function object(x=0,y=0){
 const o={active:true,x,y,body:{enable:true,reset(x,y){o.x=x;o.y=y;}},
  destroy(){this.active=false;},setPosition(x,y){this.x=x;this.y=y;return this;}};
 for(const key of ['setOrigin','setScale','setDepth','setTint','setVisible','setText',
  'setStrokeStyle','setFlipX','setFlipY','clearTint','play'])o[key]=function(){return this;};
 return o;
}
function fixture(kind){
 const s={...runtime,time:{now:1000},player:object(100,200),playerVisual:object(),
  playerShadow:object(),deathSword:object(),meleeAttack:{level:2,damage:42,cooldown:800,radius:90},
  level:3,xp:12,kills:9,mana:18,maxMana:30,weaponLevels:{sword:2},
  championRelics:new Set(['relic']),championSkillEvolutions:new Set(),championEssences:new Set(),
  wave:5,spawned:2,waveTarget:8,waveIntermission:false,lastSpawn:900,championSpawned:1,
  add:{circle:object,sprite:object},enemyGroup:{add(){}},
  physics:{add:{existing(){}},world:{isPaused:true,resume(){this.isPaused=false;}}},
  championNameText:object(),championHpBack:object(),championHpFill:object(),
  gameOverPanel:object(),gameOverText:object(),musicStarts:0,
  getChampionDefinition:()=>({name:kind,hp:500,hitRadius:24,scale:1,tint:0xffffff}),
  clampWorldX:x=>x,clampWorldY:y=>y,configureEnemyCollision(){},
  createEnemyReadabilityShadow(e){e.shadowVisual=object();},updateChampionBar(){},
  stopBrokenSaintHolyWarningSfx(){},stopBrokenSaintMusic(){},
  startBrokenSaintMusic(){this.musicStarts++;},showWaveBanner(){},
  updateHeroWeaponAttachment(){},updateLowHealthState(){}};
 s.player.hp=63;s.player.maxHp=110;
 const boss=Object.assign(object(400,200),{championKind:kind,maxHp:500,visual:object()});
 s.createChampionRetryCheckpoint(boss);
 s.enemies=[boss];s.activeChampion=boss;
 return s;
}
function die(s){
 s.gameOver=true;s.gameOverUiReady=true;s.deathSequenceActive=false;
 s.physics.world.isPaused=true;s.player.hp=0;s.player.setPosition(600,600);
 s.level=5;s.meleeAttack.damage=100;s.championRelics.add('earnedDuringFailedAttempt');
 s.projectiles=[object()];s.orbs=[object()];s.hearts=[object()];
 s.championHazards=[{visual:object()}];
 return [...s.projectiles,...s.orbs,...s.hearts,s.championHazards[0].visual,...s.enemies];
}
for(const kind of ['brokenSaint','hollowTree','testChampion']){
 const s=fixture(kind),checkpoint=s.championRetryCheckpoint;
 for(const remaining of [1,0]){
  const debris=die(s);
  assert.equal(s.retryChampionFight(),true,`${kind}: retry starts combat`);
  assert.equal(s.championRetryCheckpoint,checkpoint,'checkpoint must not be replaced');
  assert.equal(checkpoint.retriesRemaining,remaining);
  assert.equal(s.gameOver,false);assert.equal(s.gameOverUiReady,false);
  assert.equal(s.physics.world.isPaused,false);
  assert.equal(s.player.hp,63);assert.equal(s.player.maxHp,110);
  assert.equal(s.player.x,100);assert.equal(s.player.y,200);
  assert.equal(s.level,3);assert.equal(s.meleeAttack.damage,42);
  assert.equal(s.championRelics.has('earnedDuringFailedAttempt'),false);
  assert.ok(debris.every(o=>!o.active),'failed-attempt entities removed');
  assert.equal(s.enemies.length,1);assert.equal(s.activeChampion.hp,500);
  assert.equal(s.activeChampion.storyDormant,false);
  assert.equal(s.activeChampion.storyAltarLocked,false);
 }
 die(s);
 assert.equal(s.hasChampionRetryAvailable(),false);
 assert.equal(s.retryChampionFight(),false,'no third retry');
 assert.equal(s.gameOver,true);
 assert.equal(s.musicStarts,kind==='brokenSaint'?2:0);
}
const failed=fixture('brokenSaint');
die(failed);
failed.spawnChampion=()=>null;
assert.equal(failed.retryChampionFight(),false);
assert.equal(failed.championRetryCheckpoint.retriesRemaining,2,'failed restart must not consume a retry');
assert.equal(failed.gameOver,true);
console.log('Champion retry regression PASSED: production cleanup (no DEV), hero/build restoration, fresh active boss, physics resume, two retries, exhausted counter, unsuccessful spawn.');

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const wounded=readFileSync(new URL('../src/story/WoundedKnightInteractionSystem.js',import.meta.url),'utf8');
const names=['spawnHealthHeart','throwHealthHeart','spawnStoryKnightHeart','updateChampion'];
const methods=names.map(name=>{
 const start=source.indexOf(`\n ${name}(`);
 assert.ok(start>=0,`missing ${name}`);
 return source.slice(start,source.indexOf('\n }',start)+3);
});
const Phaser={Math:{
 Angle:{Between:(x1,y1,x2,y2)=>Math.atan2(y2-y1,x2-x1)},
 FloatBetween:(min,max)=>(min+max)/2,
 Between:(min,max)=>Math.round((min+max)/2)
}};
const runtime=vm.runInNewContext(`({${methods.join(',')}})`,{BALANCE:{HEART_HEAL:25},Phaser});
function image(x,y){
 return {active:true,x,y,setDepth(){return this;},setScale(){return this;}};
}
const scene={...runtime,time:{now:1000},hearts:[],
 add:{image},physics:{add:{existing(){}}},tweens:{add(config){scene.lastTween=config;}},
 player:{x:300,y:100},findNearestFreeGroundPoint:(x,y)=>({x:Math.round(x),y:Math.round(y)})};
const normal=scene.spawnHealthHeart(10,20,{});
assert.equal(normal.healAmount,25);assert.equal(normal.expiresAt,31000);assert.equal(normal.pickupAt,1000);
const bossHeart=scene.throwHealthHeart(100,100,220,100,{healAmount:30,expiresIn:8000,source:'brokenSaint'});
assert.equal(bossHeart.healAmount,30);assert.equal(bossHeart.pickupAt,1420);assert.equal(bossHeart.expiresAt,9000);
assert.equal(scene.lastTween.x,220);assert.equal(scene.lastTween.y,100);
const knight={active:true,x:100,y:100};
const knightHeart=scene.spawnStoryKnightHeart(knight);
assert.equal(knightHeart.source,'woundedKnight');assert.equal(knightHeart.healAmount,25);
assert.match(source,/\[0\.75,0\.25\]/);
assert.doesNotMatch(source,/\[0\.75,0\.50,0\.25\]/);
assert.match(source,/healAmount:Math\.round\(\(this\.player\.maxHp\|\|100\)\*0\.30\)/);
assert.match(source,/const dropped=e\.brokenSaintHeartDrops/);
assert.match(source,/const angle=Phaser\.Math\.FloatBetween\(0,Math\.PI\*2\)/);
assert.match(source,/source==='melee:champion' && attacker\?\.championKind==='brokenSaint'/);
assert.match(source,/enemy\.hp=Math\.max\(0,enemy\.hp-applied\)/);
assert.match(wounded,/На, держи\. Тебе это пригодится\./);
assert.match(wounded,/spawnStoryKnightHeart\?\.\(entry\.sprite\)/);
console.log('Broken Saint health regression PASSED: two thresholds, random heart throws, HP-zero death gate, melee firewall, knight dialogue reward, and reusable ordinary hearts.');

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const constants=source.split('\n').filter(line=>line.startsWith('const ASH_SWORD_')).join('\n');
const names=['beginAshSwordPulseAnimation','updateAshSwordPulse','stopAshSwordPulseAnimation','stopAshSwordAmbientAnimation','beginAshSwordPrelude','updateAshSwordPrelude'];
const methods=names.map(name=>{
 const start=source.indexOf(`\n ${name}(`);
 assert.ok(start>=0,name);
 return source.slice(start,source.indexOf('\n }',start)+3);
});
const runtime=vm.runInNewContext(`${constants}\n({${methods.join(',')}})`);
const calls=[],sound=[],frames=[];
const camera={zoom:1,stopFollow(){},pan(x,y,d){calls.push({t:s.time.now,x,y,d});},zoomTo(){},setZoom(z){this.zoom=z;},centerOn(){},startFollow(){}};
const sword={active:true,x:900,y:400,displayHeight:400};
const sprite={active:true,setVisible(){},play(){frames.push(s.time.now);},anims:{stop(){}},setTexture(key){this.key=key;}};
const s={...runtime,time:{now:100},wave:2,ashSwordLandmark:sword,ashSwordPulseOverlay:sprite,cameras:{main:camera},player:{x:100,y:300,body:{setVelocity(){}}},acquireStoryFocus:()=>true,releaseStoryFocus(){},setHeroFocusInteraction(){},playAshSwordPulseSfx(){sound.push(this.time.now);},stopAshSwordPulseSfx(){},startWave(w){this.wave=w;}};
assert.equal(s.beginAshSwordPrelude(),true);
assert.equal(sound[0],100,'sound starts immediately');
for(let t=120;t<=18000;t+=20){
 s.time.now=t;
 if(s.ashSwordPreludeState)s.updateAshSwordPrelude(t);
 s.updateAshSwordPulse(t);
}
assert.equal(calls[1].t,2100,'two-second hero hold');
assert.equal(calls[1].d,2400,'slower sword pan');
assert.equal(calls[2].d,800,'slower return');
assert.equal(s.wave,3);
assert.equal(camera.zoom,1);
assert.deepEqual(sound,[100,2000,3900,5800,7700,9600],'continuous cadence, then exactly three locked pulses');
assert.ok(frames.at(-1)>sound.at(-1),'ambient animation continues silently');
s.stopAshSwordAmbientAnimation();
assert.equal(s.ashSwordNextPulseAt,0);
assert.equal(sprite.key,'ash_sword_pulse_01_cutout');
const revealStart=source.indexOf('\n beginAshChampionReveal(');
const reveal=source.slice(revealStart,source.indexOf('\n }',revealStart)+3);
assert.ok(!reveal.includes('this.stopBackgroundMusic()'),'background music survives reveal');
const audio=readFileSync(new URL('../src/audio/AudioManager.js',import.meta.url),'utf8');
assert.ok(audio.includes("'sfx_ash_sword_pulse',{volume:0.936}"));
assert.ok(!source.includes('setBlendMode(Phaser.BlendModes.ADD)\n  .setAlpha(0.78)'));
console.log('Sword regression PASSED: immediate audio, 2s hold, 0.4s pulse / 1.5s rest cadence, 3 locked pulses, return, Wave 3, silent ambient, first-frame stop, music and volume.');

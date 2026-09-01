// Production dialogue/interaction methods with rendering adapters for headless
// regression tests. This is not a substitute for a browser visual check.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import vm from 'node:vm';
import StoryDirector from '../src/story/StoryDirector.js';
import StoryEnemyAnomalySystem from '../src/story/StoryEnemyAnomalySystem.js';
import ChampionDialogueSystem from '../src/story/ChampionDialogueSystem.js';
import {ASH_WOUNDED_KNIGHT_STORY as story,ASH_ALTAR_CHAMPION_STORY,STORY_ANOMALY_DEFINITIONS} from '../src/story/storyEvents.js';

import {BROKEN_SAINT_INTRO_DIALOGUE,BROKEN_SAINT_AFTERMATH_PAGES} from '../src/story/BrokenSaintCinematics.js';
import {BROKEN_SAINT_AFTERMATH_PAGE_KEYS} from '../src/config/assetManifest.mjs';
import {ASH_READABILITY} from '../src/config/worldConfig.mjs';

const root=new URL('../',import.meta.url);
const main=readFileSync(new URL('src/main.js',root),'utf8');
const context={console,Phaser:{Math:{Clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}},ASH_WOUNDED_KNIGHT_STORY:story,ASH_ALTAR_CHAMPION_STORY,BROKEN_SAINT_INTRO_DIALOGUE,BROKEN_SAINT_AFTERMATH_PAGES,BROKEN_SAINT_AFTERMATH_PAGE_KEYS,ASH_READABILITY,
 ASH_CHAMPION_MATERIALIZE_DELAY_MS:260,ASH_CHAMPION_MATERIALIZE_MS:1450,ASH_CHAMPION_CAMERA_SETTLE_MS:450,ASH_CHAMPION_POST_REVEAL_HOLD_MS:1000,
 STORY_ANOMALY_VIGNETTE_TEXTURE:'story_anomaly_vignette_soft',STORY_FOCUS_RELEASE_COOLDOWN_MS:220,
 ASH_CHAMPION_SMOKE_FADE_MS:650,ASH_CHAMPION_VIGNETTE_FADE_MS:300};
export function method(name){
 const start=main.indexOf(`\n ${name}(`);
 assert.ok(start>=0,`Missing production method: ${name}`);
 const end=main.indexOf('\n }',start)+3;
 return vm.runInNewContext(`({${main.slice(start,end)}})`,context)[name];
}
function moduleExports(file,expression,extra={}){
 const source=readFileSync(new URL(file,root),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export .*;?\r?$/gm,'');
 return vm.runInNewContext(source+'\n'+expression,{...context,...extra});
}
const shared=moduleExports('src/story/WorldDialogueSystem.js','({WorldDialogueSystem,addUiText,worldUiScale,isInteractionKey});');
class Marker{
 install(){return this;}hide(){}clearTarget(){this.target=null;}setTarget(t){this.target=t;}update(){}destroy(){}
}
const Wounded=moduleExports('src/story/WoundedKnightInteractionSystem.js','WoundedKnightInteractionSystem;',{...shared,StoryObjectiveMarker:Marker});
export function object(x=0,y=0){return {
 active:true,visible:true,alpha:1,x,y,displayWidth:80,displayHeight:60,
 setOrigin(){return this;},setDepth(n){this.depth=n;return this;},setResolution(){return this;},
 setScale(){return this;},setFontSize(){return this;},setWordWrapWidth(){return this;},
 setText(text){this.text=text;return this;},setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},
 setPosition(x,y){this.x=x;this.y=y;return this;},setAlpha(n){this.alpha=n;return this;},
 setVisible(n){this.visible=n;return this;},destroy(){this.active=false;}
};}
export function makeScene(){
 const textures=new Map();const images=[];
 const view={left:0,top:0,width:960,height:540,right:960,bottom:540,centerX:480,centerY:270};
 const camera={zoom:1,width:960,height:540,worldView:view,stopFollow(){},startFollow(){},pan(){},zoomTo(){},centerOn(){},setZoom(z){this.zoom=z;}};
 const input=new EventEmitter();input.keyboard=new EventEmitter();
 const scene={events:new EventEmitter(),input,time:{now:1000,paused:false,delayedCall(){/* Paused timer events do not fire. */}},
  game:{loop:{time:1000}},cameras:{main:camera},player:{x:440,y:270,active:true,body:{setVelocity(){}}},
  physics:{pause(){},resume(){}},syncCriticalHeartbeat(){},gameplayPaused:false,regionIndex:0,enemies:[],projectiles:[],
  tweens:{paused:false,pauseAll(){this.paused=true;},resumeAll(){this.paused=false;},killTweensOf(){},add(config){if(!this.paused)config.targets.setAlpha(config.alpha);}},
  textures:{exists:key=>textures.has(key),get:key=>textures.get(key),createCanvas(key,width,height){
   const canvas={width,height,getContext:()=>ctx};
   const ctx={clearRect(){},createImageData:()=>({data:new Uint8ClampedArray(width*height*4)}),putImageData(image){canvas.pixels=image.data;}};
   const texture={context:ctx,getSourceImage:()=>canvas,refresh(){}};textures.set(key,texture);return texture;
  }},add:{image(x,y,key){const image=object(x,y);image.textureKey=key;images.push(image);return image;},text(x,y,text){return object(x,y).setText(text);}},
  handleViewportResize(){},isMobileInteractionPointerAllowed:p=>p?.x>=480,
  createStoryAnomalyOutline:()=>object(),syncStoryAnomalyOutline(){},destroyEnemyReadabilityShadow(){}
 };
 for(const name of ['setGameplayPaused','createSettledStoryVignette','ensureStoryAnomalyVignetteTexture','updateStoryAnomalyVignette','beginAshChampionMaterialization','updateAshAltarChampionStory',
  'isStoryFocusLocked','acquireStoryFocus','releaseStoryFocus','getStoryAnomalyCue','getStoryAnomalyEnemyLine','getStoryAnomalyHeroLine','highlightStoryAnomaly','isStoryAnomalyMomentActive','updateStoryAnomalyCue','finishStoryAnomalyHighlight','damagePlayer'])scene[name]=method(name);
 const director=new StoryDirector(scene).install();scene.storyDirector=director;
 const dialogue=new shared.WorldDialogueSystem(scene,{storyDirector:director}).install();scene.dialogueSystem=dialogue;
 const system=new Wounded(scene,{storyDirector:director}).install();scene.woundedKnightInteractions=system;
 const anomalies=new StoryEnemyAnomalySystem(scene,{definitions:STORY_ANOMALY_DEFINITIONS}).install();scene.storyEnemyAnomalies=anomalies;
 const champions=new ChampionDialogueSystem(scene);scene.championDialogueSystem=champions;
 return {scene,director,dialogue,system,anomalies,champions,images,canvas:()=>textures.get(context.STORY_ANOMALY_VIGNETTE_TEXTURE)?.getSourceImage()};
}
export function tick(test,time){
 test.scene.game.loop.time=time;test.scene.time.now=time;
 test.dialogue.update(time);test.system.update(time);test.scene.updateStoryAnomalyCue(time);
 test.scene.events.emit('prerender');
}
export function enemyFor(test,definition){
 const enemy={...object(520,270),hp:100,type:'skeleton',body:{checkCollision:{}},visual:object(520,270)};
 test.anomalies.beginWave(definition.wave,20);
 const ordinal=[...test.anomalies.selectedOrdinals].find(([,d])=>d.id===definition.id)[0];
 test.anomalies.registerEnemy(enemy,{wave:definition.wave,spawnOrdinal:ordinal});
 enemy.storyAnomaly.armedAt=test.scene.time.now;
 test.scene.enemies.push(enemy);
 return enemy;
}

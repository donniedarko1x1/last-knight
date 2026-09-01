// Geometry checks use production layout/HUD methods and real sprite dimensions.
// Text measurement is an adapter, not a browser screenshot or font-render test.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {makeScene,method,object} from './story-test-fixture.mjs';
const require=createRequire(import.meta.url);
const Matrix=require('phaser/src/gameobjects/components/TransformMatrix');
const rect=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,centerX:left+width/2,centerY:top+height/2});
const shape=b=>({...object(b.centerX,b.centerY),getBounds:()=>b});
const sprite=(x,y,w,h,ox,oy)=>shape(rect(x-w*ox,y-h*oy,w,h));
const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
function textBox(){
 return {...object(),fontSize:18,scale:1,wrap:300,
  measure(){
   // Approximate Georgia's variable advances and word wrapping, plus Phaser
   // padding/stroke. Layout assertions use the resulting measured rectangle.
   const measure=s=>[...s].reduce((w,c)=>w+(/[MWШЩЮ]/u.test(c)?0.9:/[.,! :«»]/u.test(c)?0.32:0.57)*this.fontSize,0);
   let line='',width=0,lines=1;
   for(const word of (this.text||'').split(' ')){
    const next=line?line+' '+word:word;
    if(line&&measure(next)>this.wrap){width=Math.max(width,measure(line));lines++;line=word;}else line=next;
   }
   width=Math.max(width,measure(line));
   this.displayWidth=(width+26)*this.scale;
   this.displayHeight=(lines*this.fontSize*1.25+18)*this.scale;
   return this;
  },setScale(s){this.scale=s;return this.measure();},setFontSize(n){this.fontSize=n;return this.measure();},
  setWordWrapWidth(w){this.wrap=w;return this.measure();},setText(t){this.text=t;return this.measure();}
 };
}
const specs={knight:[540*(224*0.28*1.25/440),540*(224*0.28*1.25/440),280/540,403.2/540],
 skeleton:[192*0.5,192*0.5,0.5,0.78],brokenSaint:[151*0.96,157*0.96,0.5,0.80]};
let cases=0;
for(const [w,h,touch] of [[1280,720,false],[960,540,false],[844,390,true],[667,375,true],[390,844,true]]){
 for(const backing of [1,1.5,1.75])for(const kind of Object.keys(specs))for(const speaker of ['npc','hero']){
  const t=makeScene(),{scene,dialogue}=t,cam=scene.cameras.main;
  scene.isTouchDevice=touch;
  scene.game.canvas={width:w*backing,height:h*backing,getBoundingClientRect:()=>({width:w,height:h})};
  const hud={cameras:{main:{width:w*backing,height:h*backing,zoom:backing,originX:0,originY:0}},
   // Representative compact HUD, including the full drawn background bounds.
   heroPanelShell:shape(rect(10,8,touch?230:330,touch?120:168)),
   wavePanel:shape(rect(w/2-80,8,160,50)),
   championPanel:shape(rect(w/2-130,8,260,50)),
   skills:[{back:shape(rect(w-76,h-76,64,64))},{back:shape(rect(w-115,h-135,64,64))}],
   joyBack:shape(rect(12,h-122,108,108)),fullscreenButton:shape(rect(10,h-(touch?163:52),38,38)),
   getDialogueAvoidBounds:method('getDialogueAvoidBounds')};
  hud.wavePanel.visible=kind!=='brokenSaint';hud.championPanel.visible=kind==='brokenSaint';hud.joyBack.visible=touch;
  scene.scene={get:()=>hud};
  const target={...object(),hp:100};
  dialogue.dialogueText=textBox();
  dialogue.active={target,speakerName:kind==='brokenSaint'?'Broken Saint':'Рыцарь',lines:[{speaker,text:'Ты даже имя своё забыл. Тогда я напомню.'}],closing:false};
  // Evaluate incoming/settled zoom, resize, speaker changes, and moving framing.
  for(const zoomFactor of [0.9,1,1.18])for(const spoken of ['Это он?..','Наш командир повёл уцелевших на север. К старой часовне у тракта. Найди его прямо по дороге. Увидишь чёрные знамёна — значит, почти дошёл.','Ты даже имя своё забыл. Хорошо. Тогда я напомню.']){
   cam.width=w*backing;cam.height=h*backing;cam.zoom=backing*zoomFactor;
   cam.scrollX=2000-cam.width/2;cam.scrollY=1000-cam.height/2;
   // worldView is deliberately stale: the real renderer refreshes it later.
   cam.worldView={left:-9999,top:-9999};
   const world=(x,y)=>({x:2000+(x-w/2)/zoomFactor,y:1000+(y-h/2)/zoomFactor});
   Object.assign(scene.player,world(w*0.46,h*0.59));Object.assign(target,world(w*0.59,h*0.59));
   scene.playerVisual=sprite(scene.player.x,scene.player.y,172*0.28,224*0.28,0.5,0.78);
   target.visual=sprite(target.x,target.y,...specs[kind]);
   dialogue.active.lines[0].text=spoken;
   dialogue.showDialogueLine();
   // These callbacks run after HUD updates, as in Phaser's scene prerender.
   scene.events.emit('prerender');
   const text=dialogue.dialogueText;
   const screen=rect(w/2+(text.x-2000)*zoomFactor-text.displayWidth*zoomFactor/2,
    h/2+(text.y-1000)*zoomFactor-text.displayHeight*zoomFactor,text.displayWidth*zoomFactor,text.displayHeight*zoomFactor);
   const label=`${w}x${h} @${backing}/${zoomFactor} ${kind}/${speaker}`;
   assert.ok(screen.left>=0&&screen.top>=0&&screen.right<=w&&screen.bottom<=h,label+' stays on screen');
   for(const b of hud.getDialogueAvoidBounds()){
    const obstacle=rect(b.left/backing,b.top/backing,(b.right-b.left)/backing,(b.bottom-b.top)/backing);
    assert.equal(overlap(screen,obstacle),0,label+' avoids visible HUD');
   }
   for(const actor of [scene.playerVisual,target.visual]){
    const b=actor.getBounds();
    const obstacle=rect(w/2+(b.left-2000)*zoomFactor,h/2+(b.top-1000)*zoomFactor,(b.right-b.left)*zoomFactor,(b.bottom-b.top)*zoomFactor);
    assert.equal(overlap(screen,obstacle),0,label+' avoids both characters');
   }
   cases++;
  }
 }
}
// Graphics have no getBounds(). Respect their drawn bounds, transforms and
// visibility, instead of mistaking an invisible boss panel for an obstacle.
{
 const matrix=new Matrix().applyITRS(20,30,0,1.5,0.75);
 const g={...object(),dialogueLocalBounds:rect(100,40,300,80),getWorldTransformMatrix:()=>matrix};
 const hud={cameras:{main:{width:1920,height:1080,zoom:1.5,originX:0,originY:0}},championPanel:g,getDialogueAvoidBounds:method('getDialogueAvoidBounds')};
 const [b]=hud.getDialogueAvoidBounds();
 assert.deepEqual({...b},{left:255,top:90,right:930,bottom:180});
 g.visible=false;assert.equal(hud.getDialogueAvoidBounds().length,0);
 g.visible=true;g.parentContainer={visible:false};assert.equal(hud.getDialogueAvoidBounds().length,0);
 g.parentContainer=null;hud.sys={isVisible:()=>false};assert.equal(hud.getDialogueAvoidBounds().length,0);
}
// A clear knight placement remains over the speaker. A HUD panel moved there
// forces another slot, including between obstacle edges (not just old corners).
{
 const {dialogue,scene}=makeScene();
 const safe=rect(0,0,1000,600),speaker=rect(540,310,80,90);
 const params={safe,width:280,height:70,speaker,pairX:500,obstacles:[speaker],scale:1};
 let p=dialogue.findDialoguePosition(params);
 assert.equal(p.x,speaker.centerX);assert.equal(p.y,speaker.top-18);
 params.obstacles.push(rect(380,210,380,100));p=dialogue.findDialoguePosition(params);
 assert.equal(p.overlap,0);assert.notEqual(p.y,speaker.top-18);
 assert.equal(scene.events.listenerCount('prerender'),1);
 dialogue.destroy();assert.equal(scene.events.listenerCount('prerender'),0);
}
console.log(`Dialogue layout PASSED: ${cases} viewport/scale/speaker/actor cases, HUD transforms/visibility, camera freshness, knight placement and cleanup.`);

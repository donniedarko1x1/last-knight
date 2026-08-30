import Phaser from 'phaser';
import HeroMelee from './combat/HeroMelee.js';
import {
 STAGE0,
 PURSUIT,
 BALANCE,
 LOW_HEALTH_CONFIG,
 HERO_SOCKET_DIRS,
 HERO_SOCKET_SPIN_FRAME_COUNT,
 HERO_SOCKET_VISUAL_SCALE,
 HERO_SOCKET_SPIN_FRAME_RATE,
 HERO_SOCKET_SPIN_DURATION_MS,
 HERO_DEATH_FRAME_COUNT,
 HERO_DEATH_ANIMATION_MS,
 HERO_DEATH_HOLD_MS,
 HERO_DEATH_VISUAL_SCALE
} from './config/gameplayConfig.mjs';
import {
 WORLD_DESIGN,
 REGION_BALANCE,
 ASH_FIELDS_CLUSTER_LIBRARY,
 ASH_FIELDS_SEGMENTS,
 ASH_FIELDS_BAKED_LAYOUT,
 ASH_READABILITY
} from './config/worldConfig.mjs';
import { cinematicFadeIn, cinematicSwapWithFade, cinematicFadeOutAndRun } from './ui/cinematicTransitions.js';
import NavigationSystem from './world/NavigationSystem.js';
import AudioManager from './audio/AudioManager.js';
import StoryDirector from './story/StoryDirector.js';
import {PROLOGUE_STORY_PAGES,STORY_EVENTS} from './story/storyEvents.js';
import {
 ASSET_CATEGORY,
 ASSET_REQUIREMENT,
 SKILL_ICON_KEYS,
 PROLOGUE_PAGE_KEYS,
 getAssetSpec,
 queueAssetCategories,
 releaseTextureKeys
} from './config/assetManifest.mjs';

// This artifact is an explicit development build. Set false for release; ?dev=1 still unlocks the tuner.
const DEV_BUILD=true;

// DEV HiDPI experiment. Phaser 3.90 no longer honors the old GameConfig `resolution`
// option, so this build renders a larger backing canvas and lets ScaleManager FIT it
// into the CSS viewport. World cameras naturally compensate via their height-based
// zoom; HUD cameras explicitly zoom by the same factor to keep CSS-logical sizing.
const LK_DEFAULT_RENDER_SCALE = 1.75;
const LK_RENDER_SCALE_MAX = 2;
const LK_RENDER_SCALE_STORAGE_KEY = 'lastKnight.dev.renderScale.v2';
let LK_RENDER_SCALE = LK_DEFAULT_RENDER_SCALE;
const LK_TEXT_RESOLUTION = 2;

function lkAddText(scene,...args){
 const text=scene.add.text(...args);
 text?.setResolution?.(LK_TEXT_RESOLUTION);
 return text;
}

function lkCssViewport(){
 const gameHost=typeof document!=='undefined'?document.getElementById('game'):null;
 const hostRect=gameHost?.getBoundingClientRect?.();
 const vv=typeof window!=='undefined' ? window.visualViewport : null;
 const width=Math.max(1,Math.round((hostRect?.width>1?hostRect.width:0) || vv?.width || (typeof window!=='undefined'?window.innerWidth:1280) || 1280));
 const height=Math.max(1,Math.round((hostRect?.height>1?hostRect.height:0) || vv?.height || (typeof window!=='undefined'?window.innerHeight:720) || 720));
 return {width,height};
}
function lkLogicalSceneSize(scene){
 const scale=Math.max(0.01,LK_RENDER_SCALE||1);
 return {width:Math.max(1,scene.scale.width/scale),height:Math.max(1,scene.scale.height/scale)};
}
function lkUiPointer(scene,pointer){
 const cam=scene?.cameras?.main;
 if(cam?.getWorldPoint){
  try{return cam.getWorldPoint(pointer.x,pointer.y); }catch{}
 }
 return {x:pointer.x/Math.max(0.01,LK_RENDER_SCALE||1),y:pointer.y/Math.max(0.01,LK_RENDER_SCALE||1)};
}
function lkApplyTextResolution(game){
 const res=LK_TEXT_RESOLUTION;
 for(const scene of game?.scene?.getScenes?.(true)||[]){
  for(const obj of scene?.children?.list||[]){
   if(obj?.type==='Text' && typeof obj.setResolution==='function'){
    try{obj.setResolution(res);}catch{}
   }
  }
 }
}
function lkApplyRenderScale(game,value,{remember=true}={}){
 let target=value==='dpr' ? (typeof window!=='undefined'?window.devicePixelRatio||1:1) : Number(value);
 target=Phaser.Math.Clamp(Number.isFinite(target)?target:1,1,LK_RENDER_SCALE_MAX);
 LK_RENDER_SCALE=target;
 if(remember){try{localStorage.setItem(LK_RENDER_SCALE_STORAGE_KEY,String(target));}catch{}}
 const css=lkCssViewport();
 const renderW=Math.max(1,Math.round(css.width*target));
 const renderH=Math.max(1,Math.round(css.height*target));
 const scale=game?.scale;
 if(scale){
  try{scale.setGameSize(renderW,renderH);}catch{}
  try{scale.refresh?.();}catch{}
 }
 const canvas=game?.canvas;
 if(canvas){
  canvas.style.width=`${css.width}px`;
  canvas.style.height=`${css.height}px`;
 }
 for(const scene of game?.scene?.getScenes?.(true)||[]){
  const key=scene?.sys?.settings?.key;
  if(key==='HUDScene'){
   scene.cameras?.main?.setOrigin?.(0,0);
   scene.cameras?.main?.setZoom?.(target);
   scene.layout?.();
  }else if(key==='main'){
   scene.handleViewportResize?.();
  }else if(key==='BootScene'){
   scene.cameras?.main?.setOrigin?.(0,0);
   scene.cameras?.main?.setZoom?.(target);
  }else if(key==='PreloadScene'){
   scene.cameras?.main?.setOrigin?.(0,0);
   scene.cameras?.main?.setZoom?.(target);
   scene.layoutLoadingScreen?.();
  }else if(key==='CinematicScene'){
   scene.cameras?.main?.setOrigin?.(0,0);
   scene.cameras?.main?.setZoom?.(target);
   scene.layout?.();
  }
 }
 lkApplyTextResolution(game);
 return target;
}






const LOADING_ART_KEY='lastknight_loading_art';
const LOADING_SCREEN_STATUS='Loading Ash Fields...';



const INITIAL_ASSET_CATEGORIES=[
 ASSET_CATEGORY.CORE,
 ASSET_CATEGORY.PROLOGUE,
 ASSET_CATEGORY.REGION_ASH
];

class LastKnightUiLayoutEditor {
 constructor(devTools){
  this.devTools=devTools;
  this.scene=devTools.scene;
  this.editMode=false;
  this.selectedId='hpBar';
  this.profileMode='auto';
  this.snap=1;
  this.showSafeArea=true;
  this.showGrid=false;
  this.showBounds=true;
  this.dragState=null;
  this.positionClipboard=null;
  this.history=[];
  this.redoStack=[];
  this.maxHistory=160;
  this.storageKey='lastKnightDevUiLayoutV1';
  this.data=this.readSaved();
  this.graphics=null;
  this.lastHud=null;
  this.appliedHud=null;
 }

 defaultTransform(){
  return {dx:0,dy:0,scale:1,width:1,height:1,alpha:1,depth:0,fontScale:1,locked:false};
 }
 defaultData(){return {version:1,profiles:{desktop:{},mobileLandscape:{}}};}
 readSaved(){
  try{
   const raw=localStorage.getItem(this.storageKey);
   const parsed=raw?JSON.parse(raw):null;
   if(parsed?.profiles) return parsed;
  }catch{}
  return this.defaultData();
 }
 saveLocal(){
  try{localStorage.setItem(this.storageKey,JSON.stringify(this.data));}catch{}
  this.outputExport();
 }
 loadLocal(){
  this.data=this.readSaved();
  this.history=[];this.redoStack=[];
  this.apply();this.refreshPanel();
 }
 clearLocal(){try{localStorage.removeItem(this.storageKey);}catch{};}

 currentAutoProfile(){
  const hud=this.getHud();
  const logical=hud?lkLogicalSceneSize(hud):lkLogicalSceneSize(this.scene);
  const w=logical.width||1280;
  const h=logical.height||720;
  return (this.scene.isTouchDevice || h<520 || w<900)?'mobileLandscape':'desktop';
 }
 currentProfile(){return this.profileMode==='auto'?this.currentAutoProfile():this.profileMode;}
 profileData(profile=this.currentProfile()){
  if(!this.data.profiles[profile])this.data.profiles[profile]={};
  return this.data.profiles[profile];
 }
 getTransform(id=this.selectedId,profile=this.currentProfile()){
  const profileData=this.profileData(profile);
  if(!profileData[id])profileData[id]=this.defaultTransform();
  return profileData[id];
 }
 cloneData(){return JSON.parse(JSON.stringify(this.data));}
 pushHistory(){
  this.history.push(this.cloneData());
  if(this.history.length>this.maxHistory)this.history.shift();
  this.redoStack=[];
 }
 undo(){
  if(!this.history.length)return;
  this.redoStack.push(this.cloneData());
  this.data=this.history.pop();this.apply();this.refreshPanel();
 }
 redo(){
  if(!this.redoStack.length)return;
  this.history.push(this.cloneData());
  this.data=this.redoStack.pop();this.apply();this.refreshPanel();
 }

 getHud(){
  const hud=this.scene.scene?.get?.('HUDScene');
  if(hud && hud.sys?.isActive?.()){
   this.lastHud=hud;
   return hud;
  }
  return this.lastHud;
 }
 getGroups(){return this.getHud()?.getDevUiGroups?.()||{};}
 getGroup(id=this.selectedId){return this.getGroups()[id]||null;}
 getGroupBounds(group){
  if(!group)return null;
  const rects=[];
  for(const o of group.objects||[]){
   if(!o?.active||o.visible===false||!o.getBounds)continue;
   try{
    const b=o.getBounds();
    if(Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.width>=0&&b.height>=0)rects.push(b);
   }catch{}
  }
  if(!rects.length)return null;
  const left=Math.min(...rects.map(r=>r.x)),top=Math.min(...rects.map(r=>r.y));
  const right=Math.max(...rects.map(r=>r.right??(r.x+r.width))),bottom=Math.max(...rects.map(r=>r.bottom??(r.y+r.height)));
  return {x:left,y:top,left,top,right,bottom,width:right-left,height:bottom-top,centerX:(left+right)/2,centerY:(top+bottom)/2};
 }
 listElementIds(){return Object.keys(this.getGroups());}
 select(id){
  if(!this.getGroups()[id])return;
  this.selectedId=id;
  const sel=document.getElementById('lkdev-ui-element');if(sel)sel.value=id;
  this.refreshPanel();
 }

 setEditMode(on){
  this.editMode=Boolean(on);
  if(this.editMode){
   this.devTools.setEditMode(false);
   this.scene.setGameplayPaused('devUiEdit',true);
   this.ensureGraphics();
  }else{
   this.scene.setGameplayPaused('devUiEdit',false);
   this.dragState=null;
  }
  this.refreshPanel();this.devTools.refreshStateButtons();
 }
 ensureGraphics(){
  const hud=this.getHud();
  if(!hud)return null;
  if(this.graphics && this.graphics.scene===hud)return this.graphics;
  try{this.graphics?.destroy();}catch{}
  this.graphics=hud.add.graphics().setDepth(10000).setScrollFactor(0);
  return this.graphics;
 }
 destroy(){
  this.setEditMode(false);
  try{this.graphics?.destroy();}catch{}
  this.graphics=null;
 }

 snapValue(v){const s=Math.max(1,Number(this.snap)||1);return Math.round(v/s)*s;}
 mutate(mutator,{history=true}={}){
  if(!this.selectedId)return;
  const t=this.getTransform();
  if(t.locked && history)return;
  if(history)this.pushHistory();
  mutator(t);
  t.scale=Phaser.Math.Clamp(Number(t.scale)||1,0.15,4);
  t.width=Phaser.Math.Clamp(Number(t.width)||1,0.20,4);
  t.height=Phaser.Math.Clamp(Number(t.height)||1,0.20,4);
  t.alpha=Phaser.Math.Clamp(Number(t.alpha)||1,0.05,1);
  t.fontScale=Phaser.Math.Clamp(Number(t.fontScale)||1,0.35,3);
  t.depth=Math.round(Number(t.depth)||0);
  this.apply();this.refreshPanel();
 }
 apply(){
  const hud=this.getHud();
  if(!hud)return;
  hud.layout?.();
 }
 resetSelected(){
  if(!this.selectedId)return;
  this.pushHistory();
  this.profileData()[this.selectedId]=this.defaultTransform();
  this.apply();this.refreshPanel();
 }
 resetProfile(){
  this.pushHistory();
  this.data.profiles[this.currentProfile()]={};
  this.apply();this.refreshPanel();
 }
 resetAll(){
  this.pushHistory();
  this.data=this.defaultData();
  this.apply();this.refreshPanel();
 }
 toggleLock(){
  const t=this.getTransform();
  this.pushHistory();t.locked=!t.locked;this.refreshPanel();
 }
 copyPosition(){const t=this.getTransform();this.positionClipboard={dx:t.dx,dy:t.dy};this.refreshPanel();}
 pastePosition(){if(!this.positionClipboard)return;this.mutate(t=>{t.dx=this.positionClipboard.dx;t.dy=this.positionClipboard.dy;});}

 align(axis,mode){
  const hud=this.getHud(),group=this.getGroup();if(!hud||!group)return;
  const b=this.getGroupBounds(group);if(!b)return;
  const safe=hud.safe||hud.getSafeArea?.()||{top:0,right:0,bottom:0,left:0};
  const logical=lkLogicalSceneSize(hud),w=logical.width,h=logical.height;
  let delta=0;
  if(axis==='x'){
   const target=mode==='left'?safe.left:(mode==='right'?w-safe.right:w/2);
   const current=mode==='left'?b.left:(mode==='right'?b.right:b.centerX);
   delta=target-current;
   this.mutate(t=>{t.dx=this.snapValue(t.dx+delta)});
  }else{
   const target=mode==='top'?safe.top:(mode==='bottom'?h-safe.bottom:h/2);
   const current=mode==='top'?b.top:(mode==='bottom'?b.bottom:b.centerY);
   delta=target-current;
   this.mutate(t=>{t.dy=this.snapValue(t.dy+delta)});
  }
 }

 applyExactFromPanel(){
  const num=(id,fallback)=>{const v=Number(document.getElementById(id)?.value);return Number.isFinite(v)?v:fallback};
  this.mutate(t=>{
   t.dx=num('lkdev-ui-x',t.dx);t.dy=num('lkdev-ui-y',t.dy);
   t.scale=num('lkdev-ui-scale',t.scale);t.width=num('lkdev-ui-width',t.width);t.height=num('lkdev-ui-height',t.height);
   t.alpha=num('lkdev-ui-alpha',t.alpha);t.depth=num('lkdev-ui-depth',t.depth);t.fontScale=num('lkdev-ui-font',t.fontScale);
  });
 }

 handlePointerDown(pointer){
  if(!this.editMode)return false;
  const hud=this.getHud(),pp=hud?lkUiPointer(hud,pointer):{x:pointer.x,y:pointer.y};
  const x=pp.x,y=pp.y;
  const groups=this.getGroups();
  const candidates=[];
  for(const [id,g] of Object.entries(groups)){
   const b=this.getGroupBounds(g);if(!b)continue;
   if(x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom)candidates.push({id,b,area:Math.max(1,b.width*b.height),priority:g.priority||0});
  }
  if(candidates.length){
   candidates.sort((a,b)=>(b.priority-a.priority)||(a.area-b.area));
   this.select(candidates[0].id);
  }
  const t=this.getTransform();
  if(!t.locked){
   this.pushHistory();
   this.dragState={pointerId:pointer.id,startX:x,startY:y,startDx:t.dx,startDy:t.dy};
  }
  return true;
 }
 handlePointerMove(pointer){
  if(!this.editMode||!this.dragState||pointer.id!==this.dragState.pointerId)return false;
  const t=this.getTransform();
  const hud=this.getHud(),pp=hud?lkUiPointer(hud,pointer):{x:pointer.x,y:pointer.y};
  t.dx=this.snapValue(this.dragState.startDx+(pp.x-this.dragState.startX));
  t.dy=this.snapValue(this.dragState.startDy+(pp.y-this.dragState.startY));
  this.apply();this.refreshPanel(false);
  return true;
 }
 handlePointerUp(pointer){
  if(!this.editMode)return false;
  if(this.dragState&&pointer.id===this.dragState.pointerId)this.dragState=null;
  return true;
 }

 refreshElementSelect(){
  const select=document.getElementById('lkdev-ui-element');if(!select)return;
  const ids=this.listElementIds();
  const current=[...select.options].map(o=>o.value).join('|');
  if(current!==ids.join('|')){
   select.innerHTML='';
   for(const id of ids){const o=document.createElement('option');o.value=id;o.textContent=this.getGroups()[id]?.label||id;select.appendChild(o);}
  }
  if(ids.includes(this.selectedId))select.value=this.selectedId;
  else if(ids.length){this.selectedId=ids[0];select.value=this.selectedId;}
 }
 refreshPanel(updateSelect=true){
  if(updateSelect)this.refreshElementSelect();
  const psel=document.getElementById('lkdev-ui-profile');if(psel)psel.value=this.profileMode;
  const snap=document.getElementById('lkdev-ui-snap');if(snap)snap.value=String(this.snap);
  const t=this.getTransform();
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v};
  set('lkdev-ui-x',Math.round(t.dx));set('lkdev-ui-y',Math.round(t.dy));set('lkdev-ui-scale',Number(t.scale).toFixed(2));
  set('lkdev-ui-width',Number(t.width).toFixed(2));set('lkdev-ui-height',Number(t.height).toFixed(2));set('lkdev-ui-alpha',Number(t.alpha).toFixed(2));
  set('lkdev-ui-depth',Math.round(t.depth));set('lkdev-ui-font',Number(t.fontScale).toFixed(2));
  const info=document.getElementById('lkdev-ui-selected');
  const g=this.getGroup();const b=this.getGroupBounds(g);
  if(info)info.textContent=`${g?.label||this.selectedId} · ${this.currentProfile()}${t.locked?' · LOCKED':''}\nOffset ${Math.round(t.dx)},${Math.round(t.dy)} · Scale ${t.scale.toFixed(2)} · W ${t.width.toFixed(2)} · H ${t.height.toFixed(2)}${b?`\nScreen ${Math.round(b.centerX)},${Math.round(b.centerY)} · ${Math.round(b.width)}×${Math.round(b.height)}`:''}`;
  const root=this.devTools.root;
  root?.querySelector('[data-action="uiEdit"]')?.classList.toggle('on',this.editMode);
  root?.querySelector('[data-action="uiLock"]')?.classList.toggle('on',Boolean(t.locked));
  root?.querySelector('[data-action="uiSafeArea"]')?.classList.toggle('on',this.showSafeArea);
  root?.querySelector('[data-action="uiGrid"]')?.classList.toggle('on',this.showGrid);
  root?.querySelector('[data-action="uiBounds"]')?.classList.toggle('on',this.showBounds);
 }

 exportObject(){
  const out={version:1,generatedAt:new Date().toISOString(),profileMode:this.profileMode,profiles:{}};
  for(const profile of ['desktop','mobileLandscape']){
   out.profiles[profile]={};
   const pd=this.data.profiles[profile]||{};
   for(const id of Object.keys(this.getGroups())){
    const t={...this.defaultTransform(),...(pd[id]||{})};
    out.profiles[profile][id]=t;
   }
  }
  out.active={profile:this.currentProfile(),element:this.selectedId,screen:{}};
  for(const [id,g] of Object.entries(this.getGroups())){
   const b=this.getGroupBounds(g);if(!b)continue;
   out.active.screen[id]={x:Math.round(b.x),y:Math.round(b.y),width:Math.round(b.width),height:Math.round(b.height),centerX:Math.round(b.centerX),centerY:Math.round(b.centerY)};
  }
  return out;
 }
 outputExport(){
  const txt=JSON.stringify(this.exportObject(),null,2);
  const out=document.getElementById('lkdev-ui-output');if(out)out.value=txt;
  return txt;
 }
 copyExport(){const txt=this.outputExport();try{navigator.clipboard?.writeText(txt);}catch{};}
 downloadExport(){
  const txt=this.outputExport();
  try{
   const blob=new Blob([txt],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=`last-knight-ui-layout-${this.currentProfile()}-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{}
 }

 draw(){
  const g=this.ensureGraphics();if(!g)return;g.clear();if(!this.editMode)return;
  const hud=this.getHud();if(!hud)return;
  const logical=lkLogicalSceneSize(hud),w=logical.width,h=logical.height,safe=hud.safe||{top:0,right:0,bottom:0,left:0};
  if(this.showGrid&&this.snap>=5){
   const step=this.snap===10?50:25;g.lineStyle(1,0xffffff,0.07);for(let x=0;x<w;x+=step){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.strokePath();}for(let y=0;y<h;y+=step){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.strokePath();}
  }
  if(this.showSafeArea){g.lineStyle(2,0x65d9ff,0.58);g.strokeRect(safe.left,safe.top,w-safe.left-safe.right,h-safe.top-safe.bottom);}
  if(this.showBounds){
   for(const [id,group] of Object.entries(this.getGroups())){
    if(id===this.selectedId)continue;
    const q=this.getGroupBounds(group);if(!q)continue;
    const outside=q.left<safe.left||q.top<safe.top||q.right>w-safe.right||q.bottom>h-safe.bottom;
    if(outside){g.lineStyle(1,0xff5f5f,0.45);g.strokeRect(q.x,q.y,q.width,q.height);}
   }
  }
  const b=this.getGroupBounds(this.getGroup());
  if(b&&this.showBounds){
   const outside=b.left<safe.left||b.top<safe.top||b.right>w-safe.right||b.bottom>h-safe.bottom;
   g.lineStyle(3,outside?0xff5f5f:0xffdf69,0.95);g.strokeRect(b.x,b.y,b.width,b.height);
   g.fillStyle(outside?0xff5f5f:0xffdf69,0.9);g.fillCircle(b.centerX,b.centerY,4);
  }
 }
 update(){
  const hud=this.scene.scene?.get?.('HUDScene');
  if(hud?.sys?.isActive?.() && hud!==this.appliedHud){this.appliedHud=hud;this.lastHud=hud;hud.layout?.();this.refreshPanel();}
  this.draw();
 }
}

class LastKnightDevTools {
 constructor(scene){
  this.scene=scene;
  this.enabled=DEV_BUILD || (typeof location!=='undefined' && new URLSearchParams(location.search).get('dev')==='1');
  this.open=false;
  this.editMode=false;
  this.selected=null;
  this.history=[];
  this.redoStack=[];
  this.maxHistory=120;
  this.hiddenSegments=new Set();
  this.envVisibility={props:true,trees:true,rocks:true,grass:true,landmarks:true,shadows:true};
  this.overlayFlags={hitboxes:false,enemyRange:false,meleeRadius:false,championRange:false,propColliders:false,navigation:false,safeLane:false,cameraBounds:false,mobileFrame:false,desktopFrame:false};
  this.freeCamera=false;
  this.cameraLocked=false;
  this.cameraPan=null;
  this.envDrag=null;
  this.placingProp=false;
  this.createdPropCounter=0;
  this.hideGameUi=false;
  this.lastInfoAt=0;
  this.lastUpdateReal=performance.now();
  this.savedLayout=this.readSavedLayout();
  this.uiEditor=new LastKnightUiLayoutEditor(this);
  this.root=null;
  this.button=null;
  this.graphics=null;
  this.camKeys=null;
  this.pointerHandler=(pointer)=>this.handleWorldPointer(pointer);
  this.pointerMoveHandler=(pointer)=>this.handleDevPointerMove(pointer);
  this.pointerUpHandler=(pointer)=>this.handleDevPointerUp(pointer);
  this.wheelHandler=(pointer,gameObjects,deltaX,deltaY,deltaZ)=>this.handleCameraWheel(pointer,deltaY);
  this.contextMenuHandler=(event)=>{if(this.freeCamera||this.editMode)event.preventDefault();};
  this.keyHandler=(event)=>{
   if(event.key==='F2'){event.preventDefault();this.togglePanel();}
   if(event.key==='Escape' && this.editMode){this.setEditMode(false);}
  };
 }

 install(){
  if(!this.enabled || typeof document==='undefined') return;
  this.installStyle();
  this.buildDom();
  this.graphics=this.scene.add.graphics().setDepth(5000);
  this.camKeys=this.scene.input.keyboard.addKeys({up:'I',down:'K',left:'J',right:'L'});
  this.scene.input.on('pointerdown',this.pointerHandler);
  this.scene.input.on('pointermove',this.pointerMoveHandler);
  this.scene.input.on('pointerup',this.pointerUpHandler);
  this.scene.input.on('pointerupoutside',this.pointerUpHandler);
  this.scene.input.on('wheel',this.wheelHandler);
  this.scene.game?.canvas?.addEventListener?.('contextmenu',this.contextMenuHandler);
  document.addEventListener('keydown',this.keyHandler);
  for(const object of this.scene.devEnvironmentObjects||[]) this.applySavedOverrideToObject(object);
  this.restoreCreatedObjectsFromSaved();
  // Saved environment layout must never reopen the game with an editor selection.
  this.selected=null;
  this.applyAllEnvironmentVisibility();
  this.refreshSelectedPanel();
  this.refreshStateButtons();
  this.uiEditor.refreshPanel();
  window.__LK_DEV=this;
 }

 destroy(){
  try{this.scene.input.off('pointerdown',this.pointerHandler);}catch{}
  try{this.scene.input.off('pointermove',this.pointerMoveHandler);}catch{}
  try{this.scene.input.off('pointerup',this.pointerUpHandler);}catch{}
  try{this.scene.input.off('pointerupoutside',this.pointerUpHandler);}catch{}
  try{this.scene.input.off('wheel',this.wheelHandler);}catch{}
  try{this.scene.game?.canvas?.removeEventListener?.('contextmenu',this.contextMenuHandler);}catch{}
  document.removeEventListener('keydown',this.keyHandler);
  this.uiEditor?.destroy();
  this.graphics?.destroy();
  this.root?.remove();
  this.button?.remove();
  if(window.__LK_DEV===this) delete window.__LK_DEV;
 }

 installStyle(){
  if(document.getElementById('lk-dev-style')) return;
  const style=document.createElement('style');
  style.id='lk-dev-style';
  style.textContent=`
   #lk-dev-button{position:fixed;right:12px;top:12px;z-index:100001;border:1px solid #d7b86d;background:#17140fdd;color:#ffe6a3;border-radius:7px;padding:8px 12px;font:700 12px/1 system-ui;letter-spacing:.08em;box-shadow:0 3px 18px #0009;cursor:pointer;touch-action:manipulation}
   #lk-dev-panel{position:fixed;right:10px;top:10px;bottom:10px;width:min(390px,calc(100vw - 20px));z-index:100002;background:#0d0d0dec;color:#eee;border:1px solid #9b7d47;border-radius:10px;box-shadow:0 8px 36px #000c;display:none;overflow:hidden;font:12px/1.3 system-ui,sans-serif;touch-action:pan-y}
   #lk-dev-panel.open{display:flex;flex-direction:column}
   #lk-dev-panel *{box-sizing:border-box}
   .lkdev-head{display:flex;align-items:center;gap:8px;padding:9px 10px;background:#17140f;border-bottom:1px solid #5e4d2f;flex:0 0 auto}.lkdev-title{font-weight:800;color:#ffe3a0;flex:1;letter-spacing:.05em}.lkdev-close{font-size:18px;background:none!important;border:0!important;padding:0 5px!important;color:#ddd!important}
   .lkdev-scroll{overflow:auto;padding:7px;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch}.lkdev-section{border:1px solid #343028;border-radius:7px;margin:0 0 7px;background:#151512cc}.lkdev-section>summary{cursor:pointer;padding:7px 9px;font-weight:800;color:#d9c28a;background:#1c1a15;border-radius:7px;position:sticky;top:0}.lkdev-body{padding:7px}.lkdev-row{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0}.lkdev-row>*{flex:1 1 auto}
   #lk-dev-panel button,#lk-dev-panel select,#lk-dev-panel input,#lk-dev-panel textarea{background:#23231f;color:#eee;border:1px solid #4a463b;border-radius:5px;padding:6px 7px;font:11px system-ui;min-height:29px}#lk-dev-panel button{cursor:pointer;touch-action:manipulation}#lk-dev-panel button:hover{background:#333126}#lk-dev-panel button.on{background:#5c4926;border-color:#e0b85b;color:#fff0b8}#lk-dev-panel button.danger{border-color:#7e3934;color:#ffb4aa}#lk-dev-panel button.good{border-color:#416d42;color:#b8f5b9}
   .lkdev-info{white-space:pre-wrap;color:#bfc9bc;background:#090a09;padding:7px;border-radius:5px;font:11px/1.35 ui-monospace,monospace}.lkdev-selected{color:#ffdf8e;font:11px/1.35 ui-monospace,monospace;white-space:pre-wrap}.lkdev-label{color:#918b7c;font-size:10px;margin:5px 0 2px}.lkdev-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.lkdev-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.lkdev-output{width:100%;height:92px;resize:vertical;font:10px/1.2 ui-monospace,monospace!important}
   @media(max-height:620px){#lk-dev-panel{width:min(430px,calc(100vw - 20px))}.lkdev-section>summary{padding:5px 8px}.lkdev-body{padding:5px}#lk-dev-panel button,#lk-dev-panel select,#lk-dev-panel input{min-height:25px;padding:4px 5px}}
  `;
  document.head.appendChild(style);
 }

 buildDom(){
  this.button=document.createElement('button');
  this.button.id='lk-dev-button';
  this.button.textContent='DEV';
  this.button.title='Scene Tuner (F2)';
  this.button.onclick=()=>this.togglePanel();
  document.body.appendChild(this.button);

  const root=document.createElement('div');
  root.id='lk-dev-panel';
  root.innerHTML=`
   <div class="lkdev-head"><div class="lkdev-title">LAST KNIGHT · DEV SCENE TUNER</div><button class="lkdev-close" data-action="close">×</button></div>
   <div class="lkdev-scroll">
    <details class="lkdev-section" open><summary>WORLD / TIME</summary><div class="lkdev-body">
     <div class="lkdev-row"><button data-action="pause">Pause World</button><button data-action="resume" class="good">Resume</button><button data-action="autoSpawns">Auto Spawns</button></div>
     <div class="lkdev-grid4"><button data-action="time" data-value="0.25">0.25×</button><button data-action="time" data-value="0.5">0.5×</button><button data-action="time" data-value="1">1×</button><button data-action="time" data-value="2">2×</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>ENEMIES</summary><div class="lkdev-body">
     <div class="lkdev-grid3"><button data-action="spawn" data-value="skeleton">+ Skeleton</button><button data-action="spawn" data-value="mage">+ Mage</button><button data-action="spawn" data-value="shield">+ Shield</button></div>
     <div class="lkdev-row"><button data-action="spawnMixed" data-value="5">+5 Mixed</button><button data-action="spawnMixed" data-value="10">+10 Mixed</button><button data-action="clearProjectiles">Clear Shots</button></div>
     <div class="lkdev-row"><button data-action="enemyFreezeAI">Freeze AI</button><button data-action="enemyFreezeMove">Freeze Move</button><button data-action="enemyAttacks">Disable Attacks</button></div>
     <div class="lkdev-row"><button data-action="killEnemies" class="danger">Kill All</button><button data-action="deleteEnemies" class="danger">Delete All</button></div>
     <div class="lkdev-label">REGION POPULATION TEST · recalculates current wave</div>
     <div class="lkdev-grid3"><button data-action="regionPopulation" data-value="auto">AUTO</button><button data-action="regionPopulation" data-value="1">1.00×</button><button data-action="regionPopulation" data-value="1.15">1.15×</button><button data-action="regionPopulation" data-value="1.30">1.30×</button><button data-action="regionPopulation" data-value="1.45">1.45×</button><button data-action="regionPopulation" data-value="1.60">1.60×</button></div>
    </div></details>

    <details class="lkdev-section"><summary>CHAMPION</summary><div class="lkdev-body">
     <select id="lkdev-champion" style="width:100%"><option value="brokenSaint">Broken Saint</option><option value="necromancer">Necromancer</option><option value="shieldWarden">Shield Warden</option><option value="hollowTree">Hollow Tree</option></select>
     <div class="lkdev-row"><button data-action="spawnChampion">Spawn</button><button data-action="resetChampion">Reset</button><button data-action="clearHazards">Clear Hazards</button><button data-action="killChampion" class="danger">Kill</button><button data-action="deleteChampion" class="danger">Delete</button></div>
     <div class="lkdev-row"><button data-action="championFreeze">Freeze Champion</button><button data-action="championMove">Freeze Move</button></div>
     <div class="lkdev-row"><button data-action="championAttacks">Disable Attacks</button><button data-action="championSkills">Disable Skills</button></div>
     <div class="lkdev-grid3"><button data-action="championHp" data-value="10">HP 10%</button><button data-action="championHp" data-value="50">HP 50%</button><button data-action="championHp" data-value="100">HP 100%</button></div>
    </div></details>

    <details class="lkdev-section"><summary>PLAYER</summary><div class="lkdev-body">
     <div class="lkdev-row"><button data-action="god">God Mode</button><button data-action="oneHit">One Hit</button><button data-action="noCollision">No Collision</button><button data-action="infiniteMana">Mana ∞</button></div>
     <div class="lkdev-grid4"><button data-action="playerHp" data-value="100">Full HP</button><button data-action="playerHp" data-value="30">HP 30%</button><button data-action="playerHp" data-value="20">HP 20%</button><button data-action="playerHp" data-value="10">HP 10%</button></div>
     <div class="lkdev-row"><button data-action="levelUp">+1 Level</button><button data-action="xp100">+100 XP</button><button data-action="resetUpgrades">Reset Sword</button><button data-action="clearRelics">Clear Relics</button></div>
     <div class="lkdev-grid4"><button data-action="damage" data-value="-3">Dmg −</button><button data-action="damage" data-value="3">Dmg +</button><button data-action="cooldown" data-value="50">Speed −</button><button data-action="cooldown" data-value="-50">Speed +</button></div>
     <div class="lkdev-row"><button data-action="radius" data-value="-10">Radius −</button><button data-action="radius" data-value="10">Radius +</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>TRAVEL</summary><div class="lkdev-body">
     <div class="lkdev-grid4"><button data-action="travel" data-value="400">Start</button><button data-action="travel" data-value="900">x900</button><button data-action="travel" data-value="1900">x1900</button><button data-action="travel" data-value="2900">x2900</button></div>
     <div class="lkdev-row"><button data-action="travel" data-value="2260">Sword</button><button data-action="travel" data-value="3030">Altar</button><button data-action="travel" data-value="3700">Boss Gate</button></div>
     <div class="lkdev-row"><input id="lkdev-goto-x" type="number" min="0" max="18400" step="10" value="2000"><button data-action="gotoX">GO X</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>SCENE / OVERLAYS</summary><div class="lkdev-body">
     <div class="lkdev-grid3"><button data-action="envToggle" data-value="props">Props</button><button data-action="envToggle" data-value="trees">Trees</button><button data-action="envToggle" data-value="rocks">Rocks</button><button data-action="envToggle" data-value="grass">Grass</button><button data-action="envToggle" data-value="landmarks">Landmarks</button><button data-action="envToggle" data-value="shadows">Shadows</button></div>
     <div class="lkdev-row"><button data-action="groundOnly">Ground Only</button><button data-action="collisionTest">Collision Test</button></div>
     <div class="lkdev-grid3"><button data-action="overlay" data-value="hitboxes">Hitboxes</button><button data-action="overlay" data-value="enemyRange">Enemy Range</button><button data-action="overlay" data-value="meleeRadius">Melee Radius</button><button data-action="overlay" data-value="championRange">Champion Range</button><button data-action="overlay" data-value="propColliders">Prop Colliders</button><button data-action="overlay" data-value="navigation">Navigation</button><button data-action="overlay" data-value="safeLane">Safe Lane</button><button data-action="overlay" data-value="cameraBounds">Camera Bounds</button><button data-action="overlay" data-value="mobileFrame">Mobile Frame</button><button data-action="overlay" data-value="desktopFrame">Desktop Frame</button></div>
     <div class="lkdev-label">Ash Fields segments</div><div class="lkdev-grid4"><button data-action="segment" data-value="intro">Intro</button><button data-action="segment" data-value="burntEdge">Burnt Edge</button><button data-action="segment" data-value="brokenSword">Sword</button><button data-action="segment" data-value="postLandmark">Post</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>EDIT ENVIRONMENT</summary><div class="lkdev-body">
     <div class="lkdev-row"><button data-action="editEnv">EDIT ENV</button><button data-action="undo">Undo</button><button data-action="redo">Redo</button></div>
     <div class="lkdev-label">Prop palette · choose asset, then place it</div>
     <select id="lkdev-env-prop" style="width:100%">
      <option value="ash_tree_01">Tree 01</option><option value="ash_tree_02">Tree 02</option>
      <option value="ash_rock_01">Rock 01</option><option value="ash_rock_02">Rock 02</option><option value="ash_rock_03">Rock 03</option>
      <option value="ash_grass_01">Grass 01</option><option value="ash_grass_02">Grass 02</option><option value="ash_grass_03">Grass 03</option>
      <option value="ash_landmark_sword">Landmark · Sword</option><option value="ash_landmark_altar">Landmark · Altar</option>
     </select>
     <div class="lkdev-row"><button data-action="placeProp" class="good">PLACE ON CLICK</button><button data-action="addPropCenter">+ AT VIEW CENTER</button><button data-action="deleteSelected" class="danger">DELETE SELECTED</button></div>
     <div class="lkdev-label">Tip: in EDIT ENV drag a prop with left mouse. Right/middle drag pans the camera.</div>
     <div id="lkdev-selected" class="lkdev-selected">No object selected</div>
     <div class="lkdev-grid4"><button data-action="moveX" data-value="-20">X−20</button><button data-action="moveX" data-value="-5">X−5</button><button data-action="moveX" data-value="5">X+5</button><button data-action="moveX" data-value="20">X+20</button><button data-action="moveY" data-value="-20">Y−20</button><button data-action="moveY" data-value="-5">Y−5</button><button data-action="moveY" data-value="5">Y+5</button><button data-action="moveY" data-value="20">Y+20</button></div>
     <div class="lkdev-row"><button data-action="scale" data-value="-0.02">Scale −</button><button data-action="scale" data-value="0.02">Scale +</button><button data-action="rotate" data-value="-0.035">Rotate −</button><button data-action="rotate" data-value="0.035">Rotate +</button></div>
     <div class="lkdev-row"><button data-action="alpha" data-value="-0.05">Alpha −</button><button data-action="alpha" data-value="0.05">Alpha +</button><button data-action="flip">Flip X</button><button data-action="duplicateSelected">Duplicate</button></div>
     <div class="lkdev-label">Exact selected values</div><div class="lkdev-grid3"><input id="lkdev-env-x" type="number" step="1" placeholder="X"><input id="lkdev-env-y" type="number" step="1" placeholder="Y"><input id="lkdev-env-scale" type="number" step="0.01" placeholder="Scale"><input id="lkdev-env-rotation" type="number" step="0.01" placeholder="Rotation"><input id="lkdev-env-alpha" type="number" step="0.05" placeholder="Alpha"></div><div class="lkdev-row"><button data-action="applyExact">Apply values</button></div>
     <div class="lkdev-row"><button data-action="resetSelected">Reset Selected</button><button data-action="resetSegment">Reset Segment</button><button data-action="resetAll">Reset All</button></div>
     <div class="lkdev-row"><button data-action="saveLocal" class="good">Save Local</button><button data-action="loadLocal">Load Local</button><button data-action="copyLayout">Copy Layout</button></div>
     <textarea id="lkdev-output" class="lkdev-output" readonly placeholder="Layout JSON appears here"></textarea>
    </div></details>

    <details class="lkdev-section" open><summary>EDIT INTERFACE / UI LAYOUT</summary><div class="lkdev-body">
     <div class="lkdev-row"><button data-action="uiEdit">EDIT UI</button><button data-action="uiUndo">Undo</button><button data-action="uiRedo">Redo</button><button data-action="uiLock">Lock</button></div>
     <div class="lkdev-label">Profile</div><div class="lkdev-row"><select id="lkdev-ui-profile" data-ui-change="profile"><option value="auto">Auto (device)</option><option value="desktop">Desktop</option><option value="mobileLandscape">Mobile Landscape</option></select><select id="lkdev-ui-element" data-ui-change="element"></select><select id="lkdev-ui-snap" data-ui-change="snap"><option value="1">Snap 1 px</option><option value="5">Snap 5 px</option><option value="10">Snap 10 px</option></select></div>
     <div id="lkdev-ui-selected" class="lkdev-selected">UI editor loading…</div>
     <div class="lkdev-label">Drag on screen, or fine tune</div>
     <div class="lkdev-grid4"><button data-action="uiMoveX" data-value="-10">X−10</button><button data-action="uiMoveX" data-value="-1">X−1</button><button data-action="uiMoveX" data-value="1">X+1</button><button data-action="uiMoveX" data-value="10">X+10</button><button data-action="uiMoveY" data-value="-10">Y−10</button><button data-action="uiMoveY" data-value="-1">Y−1</button><button data-action="uiMoveY" data-value="1">Y+1</button><button data-action="uiMoveY" data-value="10">Y+10</button></div>
     <div class="lkdev-grid4"><button data-action="uiScale" data-value="-0.05">Scale−.05</button><button data-action="uiScale" data-value="-0.01">Scale−.01</button><button data-action="uiScale" data-value="0.01">Scale+.01</button><button data-action="uiScale" data-value="0.05">Scale+.05</button></div>
     <div class="lkdev-row"><button data-action="uiWidth" data-value="-0.05">Width −</button><button data-action="uiWidth" data-value="0.05">Width +</button><button data-action="uiHeight" data-value="-0.05">Height −</button><button data-action="uiHeight" data-value="0.05">Height +</button></div>
     <div class="lkdev-row"><button data-action="uiAlpha" data-value="-0.05">Alpha −</button><button data-action="uiAlpha" data-value="0.05">Alpha +</button><button data-action="uiFont" data-value="-0.05">Font −</button><button data-action="uiFont" data-value="0.05">Font +</button><button data-action="uiDepth" data-value="-1">Depth −</button><button data-action="uiDepth" data-value="1">Depth +</button></div>
     <div class="lkdev-label">Exact overrides</div><div class="lkdev-grid4"><input id="lkdev-ui-x" type="number" step="1" placeholder="X offset"><input id="lkdev-ui-y" type="number" step="1" placeholder="Y offset"><input id="lkdev-ui-scale" type="number" step="0.01" placeholder="Scale"><input id="lkdev-ui-width" type="number" step="0.01" placeholder="Width"><input id="lkdev-ui-height" type="number" step="0.01" placeholder="Height"><input id="lkdev-ui-alpha" type="number" step="0.05" placeholder="Alpha"><input id="lkdev-ui-depth" type="number" step="1" placeholder="Depth"><input id="lkdev-ui-font" type="number" step="0.05" placeholder="Font"></div><div class="lkdev-row"><button data-action="uiApplyExact">Apply values</button></div>
     <div class="lkdev-label">Align / duplicate position</div><div class="lkdev-grid3"><button data-action="uiAlignX" data-value="left">Align Left</button><button data-action="uiAlignX" data-value="center">Center X</button><button data-action="uiAlignX" data-value="right">Align Right</button><button data-action="uiAlignY" data-value="top">Align Top</button><button data-action="uiAlignY" data-value="middle">Center Y</button><button data-action="uiAlignY" data-value="bottom">Align Bottom</button></div>
     <div class="lkdev-row"><button data-action="uiCopyPos">Copy Pos</button><button data-action="uiPastePos">Paste Pos</button><button data-action="uiSafeArea">Safe Area</button><button data-action="uiGrid">Grid</button><button data-action="uiBounds">Bounds</button></div>
     <div class="lkdev-row"><button data-action="uiResetSelected">Reset Selected</button><button data-action="uiResetProfile">Reset Profile</button><button data-action="uiResetAll" class="danger">Reset All UI</button></div>
     <div class="lkdev-row"><button data-action="uiSaveLocal" class="good">Save Local</button><button data-action="uiLoadLocal">Load Local</button><button data-action="uiCopyLayout">Copy UI JSON</button><button data-action="uiDownload">Download JSON</button></div>
     <textarea id="lkdev-ui-output" class="lkdev-output" readonly placeholder="UI layout JSON appears here"></textarea>
    </div></details>

    <details class="lkdev-section" open><summary>RENDER / DPI TEST</summary><div class="lkdev-body">
     <div class="lkdev-label">High-DPI backing canvas. Compare 1× and 2× on the same phone.</div>
     <div class="lkdev-grid4"><button data-action="renderScale" data-value="1">1×</button><button data-action="renderScale" data-value="1.5">1.5×</button><button data-action="renderScale" data-value="1.75">1.75×</button><button data-action="renderScale" data-value="2">2×</button></div><div style="display:grid;margin-top:6px"><button data-action="renderScale" data-value="dpr" class="good">AUTO DPR (max 2×)</button></div>
     <div id="lkdev-render-info" class="lkdev-info">Render diagnostics…</div>
    </div></details>

    <details class="lkdev-section" open><summary>CAMERA / SCENE VIEW</summary><div class="lkdev-body">
     <div class="lkdev-grid4"><button data-action="zoom" data-value="0.30">0.30</button><button data-action="zoom" data-value="0.50">0.50</button><button data-action="zoom" data-value="0.75">0.75</button><button data-action="zoom" data-value="1">1.0</button></div>
     <div class="lkdev-grid4"><button data-action="zoom" data-value="1.25">1.25</button><button data-action="zoom" data-value="1.5">1.5</button><button data-action="zoom" data-value="2">2.0</button><button data-action="fitAsh" class="good">FIT ASH</button></div>
     <div class="lkdev-row"><button data-action="followCamera">Follow Player</button><button data-action="lockCamera">Lock Camera</button><button data-action="freeCamera">Free Camera · Drag / IJKL</button></div>
     <div class="lkdev-label">Free Camera: left-drag empty scene to pan. In EDIT ENV use right/middle-drag. Mouse wheel zooms around cursor.</div>
    </div></details>

    <details class="lkdev-section"><summary>QUICK SCENARIOS</summary><div class="lkdev-body">
     <div class="lkdev-grid3"><button data-action="scenario" data-value="empty">Empty Scene</button><button data-action="scenario" data-value="skeleton10">10 Skeletons</button><button data-action="scenario" data-value="mage5">5 Mages</button><button data-action="scenario" data-value="mixed">Mixed Horde</button><button data-action="scenario" data-value="champion">Champion Only</button><button data-action="scenario" data-value="heavy">Heavy Combat</button><button data-action="scenario" data-value="critical">Critical HP</button><button data-action="scenario" data-value="lowHorde">Low HP + Horde</button></div>
    </div></details>

    <details class="lkdev-section"><summary>STRESS / SCREENSHOT</summary><div class="lkdev-body">
     <div class="lkdev-row"><button data-action="stress" data-value="50">50 Enemies</button><button data-action="stress" data-value="100">100 Enemies</button><button data-action="hideUi">Hide Game UI</button><button data-action="screenshot">Capture PNG</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>LIVE INFO</summary><div class="lkdev-body"><div id="lkdev-info" class="lkdev-info"></div></div></details>
   </div>`;
  root.addEventListener('click',(event)=>{
   const btn=event.target.closest('[data-action]');
   if(!btn) return;
   event.preventDefault();event.stopPropagation();
   this.handleAction(btn.dataset.action,btn.dataset.value,btn);
  });
  root.addEventListener('change',(event)=>{
   const el=event.target.closest('[data-ui-change]');
   if(!el)return;
   const kind=el.dataset.uiChange;
   if(kind==='profile'){this.uiEditor.profileMode=el.value;this.uiEditor.apply();this.uiEditor.refreshPanel();}
   else if(kind==='element')this.uiEditor.select(el.value);
   else if(kind==='snap'){this.uiEditor.snap=Number(el.value)||1;this.uiEditor.refreshPanel();}
  });
  document.body.appendChild(root);
  this.root=root;
 }

 togglePanel(force=null){
  this.open=force===null?!this.open:Boolean(force);
  this.root?.classList.toggle('open',this.open);
  if(this.button) this.button.style.display=this.open?'none':'';
 }

 handleAction(action,value,button){
  const s=this.scene,f=s.devFlags;
  switch(action){
   case 'close':this.togglePanel(false);break;
   case 'pause':s.setGameplayPaused('devPanel',true);break;
   case 'resume':s.setGameplayPaused('devPanel',false);break;
   case 'time':this.setTimeScale(Number(value));break;
   case 'autoSpawns':f.autoSpawnsDisabled=!f.autoSpawnsDisabled;if(!f.autoSpawnsDisabled&&s.championEventActive&&!s.activeChampion){const k=s.getChampionForWave(s.wave);if(k)s.spawnChampion(k,true);}break;
   case 'spawn':this.spawnEnemies(value,1);break;
   case 'spawnMixed':this.spawnMixed(Number(value));break;
   case 'regionPopulation':s.devRegionPopulationOverride=value==='auto'?null:Number(value);s.recalculateCurrentWaveRegionBalance();break;
   case 'clearProjectiles':this.clearProjectiles();break;
   case 'clearHazards':this.clearHazards();break;
   case 'enemyFreezeAI':f.enemyAiFrozen=!f.enemyAiFrozen;break;
   case 'enemyFreezeMove':f.enemyMovementFrozen=!f.enemyMovementFrozen;break;
   case 'enemyAttacks':f.enemyAttacksDisabled=!f.enemyAttacksDisabled;if(f.enemyAttacksDisabled){this.clearProjectiles();for(const e of s.enemies){if(e.type!=='champion'){e.pendingMeleeHitAt=0;e.pendingMeleeDamage=0;e.pendingMeleeRange=0;}}}break;
   case 'killEnemies':this.killOrdinaryEnemies();break;
   case 'deleteEnemies':this.deleteOrdinaryEnemies();break;
   case 'spawnChampion':this.spawnSelectedChampion();break;
   case 'resetChampion':this.resetChampion();break;
   case 'killChampion':this.killChampion();break;
   case 'deleteChampion':this.deleteChampion();break;
   case 'championFreeze':f.championFrozen=!f.championFrozen;if(f.championFrozen)this.clearHazards();break;
   case 'championMove':f.championMovementFrozen=!f.championMovementFrozen;break;
   case 'championAttacks':f.championAttacksDisabled=!f.championAttacksDisabled;if(f.championAttacksDisabled)this.clearHazards();break;
   case 'championSkills':f.championSkillsDisabled=!f.championSkillsDisabled;if(f.championSkillsDisabled)this.clearHazards();break;
   case 'championHp':this.setChampionHp(Number(value));break;
   case 'god':f.godMode=!f.godMode;break;
   case 'oneHit':f.oneHitKill=!f.oneHitKill;break;
   case 'noCollision':f.noCollision=!f.noCollision;this.applyNoCollision();break;
   case 'infiniteMana':f.infiniteMana=!f.infiniteMana;if(f.infiniteMana)s.mana=s.maxMana;break;
   case 'playerHp':this.setPlayerHp(Number(value));break;
   case 'levelUp':s.level++;break;
   case 'xp100':s.grantXp(100);break;
   case 'resetUpgrades':this.resetUpgrades();break;
   case 'clearRelics':s.championRelics.clear();s.killStreakBonus=0;break;
   case 'damage':s.meleeAttack.damage=Math.max(1,s.meleeAttack.damage+Number(value));break;
   case 'cooldown':s.meleeAttack.cooldown=Math.max(100,s.meleeAttack.cooldown+Number(value));break;
   case 'radius':s.meleeAttack.radius=Math.max(20,s.meleeAttack.radius+Number(value));break;
   case 'travel':this.teleport(Number(value));break;
   case 'gotoX':this.teleport(Number(document.getElementById('lkdev-goto-x')?.value||0));break;
   case 'envToggle':this.envVisibility[value]=!this.envVisibility[value];this.applyAllEnvironmentVisibility();break;
   case 'groundOnly':this.toggleGroundOnly();break;
   case 'collisionTest':this.toggleCollisionTest();break;
   case 'overlay':this.overlayFlags[value]=!this.overlayFlags[value];break;
   case 'segment':this.toggleSegment(value);break;
   case 'editEnv':this.setEditMode(!this.editMode);break;
   case 'placeProp':this.togglePropPlacement();break;
   case 'addPropCenter':this.addSelectedPropAtViewCenter();break;
   case 'duplicateSelected':this.duplicateSelected();break;
   case 'undo':this.undo();break;
   case 'redo':this.redo();break;
   case 'moveX':this.mutateSelected(o=>{o.x+=Number(value)});break;
   case 'moveY':this.mutateSelected(o=>{o.y+=Number(value)});break;
   case 'scale':this.mutateSelected(o=>{const n=Math.max(0.05,Math.abs(o.scaleX)+Number(value));o.setScale(n)});break;
   case 'rotate':this.mutateSelected(o=>{o.rotation+=Number(value)});break;
   case 'alpha':this.mutateSelected(o=>{o.alpha=Phaser.Math.Clamp(o.alpha+Number(value),0.05,1)});break;
   case 'flip':this.mutateSelected(o=>o.setFlipX(!o.flipX));break;
   case 'deleteSelected':this.deleteSelected();break;
   case 'applyExact':this.applyExactSelectedValues();break;
   case 'resetSelected':this.resetSelected();break;
   case 'resetSegment':this.resetSelectedSegment();break;
   case 'resetAll':this.resetAllEnvironment();break;
   case 'saveLocal':this.saveLocal();break;
   case 'loadLocal':this.loadLocal();break;
   case 'copyLayout':this.copyLayout();break;
   case 'uiEdit':this.uiEditor.setEditMode(!this.uiEditor.editMode);break;
   case 'uiUndo':this.uiEditor.undo();break;
   case 'uiRedo':this.uiEditor.redo();break;
   case 'uiLock':this.uiEditor.toggleLock();break;
   case 'uiMoveX':this.uiEditor.mutate(t=>{t.dx=this.uiEditor.snapValue(t.dx+Number(value))});break;
   case 'uiMoveY':this.uiEditor.mutate(t=>{t.dy=this.uiEditor.snapValue(t.dy+Number(value))});break;
   case 'uiScale':this.uiEditor.mutate(t=>{t.scale+=Number(value)});break;
   case 'uiWidth':this.uiEditor.mutate(t=>{t.width+=Number(value)});break;
   case 'uiHeight':this.uiEditor.mutate(t=>{t.height+=Number(value)});break;
   case 'uiAlpha':this.uiEditor.mutate(t=>{t.alpha+=Number(value)});break;
   case 'uiFont':this.uiEditor.mutate(t=>{t.fontScale+=Number(value)});break;
   case 'uiDepth':this.uiEditor.mutate(t=>{t.depth+=Number(value)});break;
   case 'uiApplyExact':this.uiEditor.applyExactFromPanel();break;
   case 'uiAlignX':this.uiEditor.align('x',value);break;
   case 'uiAlignY':this.uiEditor.align('y',value);break;
   case 'uiCopyPos':this.uiEditor.copyPosition();break;
   case 'uiPastePos':this.uiEditor.pastePosition();break;
   case 'uiSafeArea':this.uiEditor.showSafeArea=!this.uiEditor.showSafeArea;this.uiEditor.refreshPanel();break;
   case 'uiGrid':this.uiEditor.showGrid=!this.uiEditor.showGrid;this.uiEditor.refreshPanel();break;
   case 'uiBounds':this.uiEditor.showBounds=!this.uiEditor.showBounds;this.uiEditor.refreshPanel();break;
   case 'uiResetSelected':this.uiEditor.resetSelected();break;
   case 'uiResetProfile':this.uiEditor.resetProfile();break;
   case 'uiResetAll':this.uiEditor.resetAll();break;
   case 'uiSaveLocal':this.uiEditor.saveLocal();break;
   case 'uiLoadLocal':this.uiEditor.loadLocal();break;
   case 'uiCopyLayout':this.uiEditor.copyExport();break;
   case 'uiDownload':this.uiEditor.downloadExport();break;
   case 'renderScale':this.setRenderScale(value);break;
   case 'zoom':this.setCameraZoom(Number(value));break;
   case 'fitAsh':this.fitAshFields();break;
   case 'followCamera':this.followCamera();break;
   case 'lockCamera':this.lockCamera();break;
   case 'freeCamera':this.toggleFreeCamera();break;
   case 'scenario':this.runScenario(value);break;
   case 'stress':this.runStress(Number(value));break;
   case 'hideUi':this.setGameUiHidden(!this.hideGameUi);break;
   case 'screenshot':this.captureScreenshot();break;
  }
  this.refreshStateButtons();this.refreshSelectedPanel();this.updateInfo(true);
 }

 setTimeScale(scale){
  scale=Phaser.Math.Clamp(scale,0.1,4);
  this.scene.devTimeScale=scale;
  this.scene.time.timeScale=scale;
  this.scene.tweens.timeScale=scale;
  // Arcade Physics timeScale is inverse: 2 = half speed.
  this.scene.physics.world.timeScale=1/scale;
 }

 spawnPosition(index,total){
  const s=this.scene,r=190+(index%3)*45,a=(index/Math.max(1,total))*Math.PI*2;
  return {x:s.clampWorldX(s.player.x+Math.cos(a)*r,35),y:s.clampWorldY(s.player.y+Math.sin(a)*r,35)};
 }
 spawnEnemies(type,count){for(let i=0;i<count;i++)this.scene.spawnEnemy(type,this.spawnPosition(i,count));}
 spawnMixed(count){const types=['skeleton','skeleton','mage','shield'];for(let i=0;i<count;i++)this.scene.spawnEnemy(types[i%types.length],this.spawnPosition(i,count));}
 clearProjectiles(){for(const p of this.scene.projectiles||[])if(p?.active)p.destroy();this.scene.projectiles=[];}
 clearHazards(){this.scene.clearChampionHazards?.();}

 destroyEnemyEntity(enemy){
  if(!enemy) return;
  if(enemy.visual?.active)enemy.visual.destroy();
  if(enemy.auraVisual?.active)enemy.auraVisual.destroy();
  if(enemy.reflectVisual?.active)enemy.reflectVisual.destroy();
  this.scene.destroyEnemyReadabilityShadow(enemy);
  if(enemy.active)enemy.destroy();
  this.scene.enemies=this.scene.enemies.filter(e=>e&&e!==enemy&&e.active);
  if(this.scene.activeChampion===enemy){this.scene.activeChampion=null;this.scene.championEventActive=false;this.scene.championNameText?.setVisible(false);this.scene.championHpBack?.setVisible(false);this.scene.championHpFill?.setVisible(false);this.clearHazards();}
 }
 killOrdinaryEnemies(){for(const e of [...this.scene.enemies])if(e.active&&e.type!=='champion'){e.hp=0;this.scene.finalizeEnemyDeath(e,this.scene.time.now);}this.scene.enemies=this.scene.enemies.filter(e=>e?.active);}
 deleteOrdinaryEnemies(){for(const e of [...this.scene.enemies])if(e.type!=='champion')this.destroyEnemyEntity(e);this.clearProjectiles();}

 championKind(){return document.getElementById('lkdev-champion')?.value||'brokenSaint';}
 spawnSelectedChampion(){if(this.scene.activeChampion?.active)this.deleteChampion();this.scene.spawnChampion(this.championKind(),true);}
 resetChampion(){const e=this.scene.activeChampion;if(!e?.active)return;e.hp=e.maxHp;e.staggerUntil=0;e.skillLiftUntil=0;e.skillTremorUntil=0;e.nextSkillAt=this.scene.time.now+1200;e.nextSecondaryAt=this.scene.time.now+2600;e.reflectUntil=0;e.guardUntil=0;this.clearHazards();this.scene.updateChampionBar();}
 killChampion(){const e=this.scene.activeChampion;if(!e?.active)return;e.hp=0;this.scene.finalizeEnemyDeath(e,this.scene.time.now);this.scene.enemies=this.scene.enemies.filter(x=>x?.active);}
 deleteChampion(){const e=this.scene.activeChampion;if(e)this.destroyEnemyEntity(e);}
 setChampionHp(percent){const e=this.scene.activeChampion;if(!e?.active)return;e.hp=Math.max(1,Math.round(e.maxHp*percent/100));this.scene.updateChampionBar();}

 setPlayerHp(percent){const s=this.scene;s.player.hp=Math.max(1,Math.round((s.player.maxHp||100)*percent/100));s.gameOver=false;s.updateLowHealthState(true);}
 resetUpgrades(){const s=this.scene;s.meleeAttack.level=1;s.meleeAttack.damage=15;s.meleeAttack.cooldown=1000;s.meleeAttack.radius=99;s.weaponLevels={sword:1};}
 applyNoCollision(){const enabled=!this.scene.devFlags.noCollision;if(this.scene.playerEnemyCollider)this.scene.playerEnemyCollider.active=enabled;if(this.scene.playerAshCollider)this.scene.playerAshCollider.active=enabled;if(this.scene.enemyAshCollider)this.scene.enemyAshCollider.active=enabled;this.applyAllEnvironmentVisibility();}
 teleport(x){const s=this.scene;x=Phaser.Math.Clamp(x,25,STAGE0.WORLD_WIDTH-25);const pos=s.findNearestFreeGroundPoint(x,WORLD_DESIGN.ROUTE_Y,24,320,18);s.player.setPosition(pos.x,pos.y);s.player.body?.setVelocity(0,0);s.playerVisual?.setPosition(pos.x,pos.y);if(this.freeCamera||this.cameraLocked)s.cameras.main.centerOn(pos.x,pos.y);s.updateWorldRegion();s.progressionBalanceZoneIndex=s.currentWorldZoneIndex;s.applyRegionalHeroBalance(s.progressionBalanceZoneIndex,false);s.recalculateCurrentWaveRegionBalance();s.updateWorldStreaming();}

 toggleGroundOnly(){const on=!(this.groundOnly||false);this.groundOnly=on;if(on){this.envVisibility.props=false;this.envVisibility.landmarks=false;}else{this.envVisibility.props=true;this.envVisibility.trees=true;this.envVisibility.rocks=true;this.envVisibility.grass=true;this.envVisibility.landmarks=true;}this.applyAllEnvironmentVisibility();}
 toggleCollisionTest(){this.collisionTest=!this.collisionTest;const f=this.scene.devFlags;if(this.collisionTest){this.collisionTestPrevious={godMode:f.godMode,autoSpawnsDisabled:f.autoSpawnsDisabled,propColliders:this.overlayFlags.propColliders,hitboxes:this.overlayFlags.hitboxes,safeLane:this.overlayFlags.safeLane};f.godMode=true;f.autoSpawnsDisabled=true;this.deleteOrdinaryEnemies();this.deleteChampion();this.overlayFlags.propColliders=true;this.overlayFlags.hitboxes=true;this.overlayFlags.safeLane=true;}else if(this.collisionTestPrevious){f.godMode=this.collisionTestPrevious.godMode;f.autoSpawnsDisabled=this.collisionTestPrevious.autoSpawnsDisabled;this.overlayFlags.propColliders=this.collisionTestPrevious.propColliders;this.overlayFlags.hitboxes=this.collisionTestPrevious.hitboxes;this.overlayFlags.safeLane=this.collisionTestPrevious.safeLane;this.collisionTestPrevious=null;}this.refreshStateButtons();}
 toggleSegment(id){if(this.hiddenSegments.has(id))this.hiddenSegments.delete(id);else this.hiddenSegments.add(id);this.applyAllEnvironmentVisibility();}

 isObjectVisibleByFilters(object){
  const m=object.devEnvMeta||{};
  if(object.devDeleted)return false;
  if(this.hiddenSegments.has(m.segment))return false;
  if(m.landmark)return this.envVisibility.landmarks;
  if(!this.envVisibility.props)return false;
  if(m.kind==='tree'&&!this.envVisibility.trees)return false;
  if(m.kind==='rock'&&!this.envVisibility.rocks)return false;
  if(m.kind==='grass'&&!this.envVisibility.grass)return false;
  return true;
 }
 applyObjectVisibility(object){
  if(!object)return;
  const visible=this.isObjectVisibleByFilters(object);
  object.setVisible(visible);
  for(const shadow of object.devLinkedShadows||[])shadow.setVisible(visible&&this.envVisibility.shadows);
  for(const collider of object.devLinkedColliders||[]){if(collider.body)collider.body.enable=visible&&!this.scene.devFlags.noCollision;}
  this.scene.markNavigationDirty?.();
 }
 applyAllEnvironmentVisibility(){for(const o of this.scene.devEnvironmentObjects||[])this.applyObjectVisibility(o);}

 snapshot(object){return {id:object.devEnvMeta.id,x:object.x,y:object.y,scaleX:object.scaleX,scaleY:object.scaleY,rotation:object.rotation,alpha:object.alpha,flipX:Boolean(object.flipX),deleted:Boolean(object.devDeleted)};}
 findEnv(id){return (this.scene.devEnvironmentObjects||[]).find(o=>o?.devEnvMeta?.id===id);}
 applySnapshot(state){const o=this.findEnv(state.id);if(!o)return;o.setPosition(state.x,state.y);o.setScale(Math.abs(state.scaleX),Math.abs(state.scaleY));o.rotation=state.rotation;o.alpha=state.alpha;o.setFlipX(Boolean(state.flipX));o.devDeleted=Boolean(state.deleted);this.scene.updateDevEnvironmentLinks(o);this.applyObjectVisibility(o);if(this.selected===o)this.refreshSelectedPanel();}
 pushHistory(states){this.history.push(states);if(this.history.length>this.maxHistory)this.history.shift();this.redoStack=[];}
 mutateSelected(mutator){if(!this.selected)return;this.pushHistory([this.snapshot(this.selected)]);mutator(this.selected);this.scene.updateDevEnvironmentLinks(this.selected);this.applyObjectVisibility(this.selected);this.refreshSelectedPanel();}
 deleteSelected(){if(!this.selected)return;this.pushHistory([this.snapshot(this.selected)]);this.selected.devDeleted=true;this.applyObjectVisibility(this.selected);this.refreshSelectedPanel();}
 undo(){const states=this.history.pop();if(!states)return;const current=states.map(st=>{const o=this.findEnv(st.id);return o?this.snapshot(o):null}).filter(Boolean);this.redoStack.push(current);states.forEach(st=>this.applySnapshot(st));}
 redo(){const states=this.redoStack.pop();if(!states)return;const current=states.map(st=>{const o=this.findEnv(st.id);return o?this.snapshot(o):null}).filter(Boolean);this.history.push(current);states.forEach(st=>this.applySnapshot(st));}
 resetSelected(){if(!this.selected)return;this.pushHistory([this.snapshot(this.selected)]);this.restoreInitial(this.selected);}
 restoreInitial(o){const st=o?.devInitialState;if(!st)return;o.setPosition(st.x,st.y);o.setScale(Math.abs(st.scaleX),Math.abs(st.scaleY));o.rotation=st.rotation;o.alpha=st.alpha;o.setFlipX(st.flipX);o.devDeleted=false;this.scene.updateDevEnvironmentLinks(o);this.applyObjectVisibility(o);}
 resetSelectedSegment(){if(!this.selected)return;const seg=this.selected.devEnvMeta.segment;const list=(this.scene.devEnvironmentObjects||[]).filter(o=>o.devEnvMeta?.segment===seg);this.pushHistory(list.map(o=>this.snapshot(o)));list.forEach(o=>{if(o.devEnvMeta?.created){o.devDeleted=true;this.applyObjectVisibility(o);}else this.restoreInitial(o);});}
 resetAllEnvironment(){const list=(this.scene.devEnvironmentObjects||[]);this.pushHistory(list.map(o=>this.snapshot(o)));list.forEach(o=>{if(o.devEnvMeta?.created){o.devDeleted=true;this.applyObjectVisibility(o);}else this.restoreInitial(o);});}
 applyExactSelectedValues(){if(!this.selected)return;const x=Number(document.getElementById('lkdev-env-x')?.value),y=Number(document.getElementById('lkdev-env-y')?.value),scale=Number(document.getElementById('lkdev-env-scale')?.value),rotation=Number(document.getElementById('lkdev-env-rotation')?.value),alpha=Number(document.getElementById('lkdev-env-alpha')?.value);this.mutateSelected(o=>{if(Number.isFinite(x))o.x=x;if(Number.isFinite(y))o.y=y;if(Number.isFinite(scale)&&scale>0)o.setScale(scale);if(Number.isFinite(rotation))o.rotation=rotation;if(Number.isFinite(alpha))o.alpha=Phaser.Math.Clamp(alpha,0.05,1);});}

 serializeLayout(){
  const out={version:2,generatedAt:new Date().toISOString(),objects:{}};
  for(const o of this.scene.devEnvironmentObjects||[]){
   const st=this.snapshot(o),m=o.devEnvMeta||{};
   // A user-created object that was later deleted is equivalent to never adding it.
   if(m.created&&st.deleted)continue;
   out.objects[st.id]={x:Math.round(st.x*100)/100,y:Math.round(st.y*100)/100,scale:Math.round(Math.abs(st.scaleX)*1000)/1000,rotation:Math.round(st.rotation*10000)/10000,alpha:Math.round(st.alpha*1000)/1000,flipX:st.flipX,deleted:st.deleted,key:m.key,kind:m.kind,segment:m.segment,landmark:Boolean(m.landmark),created:Boolean(m.created)};
  }
  return out;
 }
 readSavedLayout(){try{return JSON.parse(localStorage.getItem('lastKnight.dev.ashLayout.v2')||'null');}catch{return null;}}
 saveLocal(){const data=this.serializeLayout();localStorage.setItem('lastKnight.dev.ashLayout.v2',JSON.stringify(data));this.savedLayout=data;this.output(JSON.stringify(data,null,2));}
 loadLocal(){this.savedLayout=this.readSavedLayout();this.restoreCreatedObjectsFromSaved();for(const o of this.scene.devEnvironmentObjects||[])this.applySavedOverrideToObject(o);this.selected=null;this.envDrag=null;this.applyAllEnvironmentVisibility();this.refreshSelectedPanel();}
 applySavedOverrideToObject(object){const state=this.savedLayout?.objects?.[object?.devEnvMeta?.id];if(!state)return;object.setPosition(state.x,state.y);object.setScale(Math.max(0.05,state.scale||Math.abs(object.scaleX)));object.rotation=state.rotation??object.rotation;object.alpha=state.alpha??object.alpha;object.setFlipX(Boolean(state.flipX));object.devDeleted=Boolean(state.deleted);this.scene.updateDevEnvironmentLinks(object);this.applyObjectVisibility(object);}
 async copyLayout(){const txt=JSON.stringify(this.serializeLayout(),null,2);this.output(txt);try{await navigator.clipboard.writeText(txt);}catch{}}
 output(txt){const el=document.getElementById('lkdev-output');if(el)el.value=txt;}

 inferPropKind(key){if(key.includes('landmark_'))return 'landmark';if(key.includes('tree_'))return 'tree';if(key.includes('rock_'))return 'rock';return 'grass';}
 propDefaultScale(key){const kind=this.inferPropKind(key);if(kind==='tree')return 0.36;if(kind==='rock')return 0.24;if(kind==='grass')return 0.24;return key.includes('sword')?0.58:0.50;}
 selectedPropKey(){return document.getElementById('lkdev-env-prop')?.value||'ash_tree_01';}
 segmentAtX(x){return ASH_FIELDS_SEGMENTS.find(seg=>x>=seg.start&&x<seg.end)?.id||'ash';}
 nextCreatedId(){this.createdPropCounter++;return `devCreated:${Date.now().toString(36)}:${this.createdPropCounter}`;}
 createEnvironmentPropAt(x,y,key=this.selectedPropKey(),options={}){
  const s=this.scene;if(!s.textures.exists(key))return null;
  x=Phaser.Math.Clamp(Number(x)||0,0,4000);y=Phaser.Math.Clamp(Number(y)||WORLD_DESIGN.ROUTE_Y,0,STAGE0.WORLD_HEIGHT);
  const kind=options.kind||this.inferPropKind(key),landmark=kind==='landmark';
  const objects=s.loadedWorldZones.get(0)||[];
  const prop=s.add.image(x,y,key).setDepth(landmark?-28:(kind==='grass'?-46:-44)).setScale(options.scale||this.propDefaultScale(key)).setAlpha(options.alpha??(kind==='grass'?0.40:0.96)).setRotation(options.rotation||0);
  if(options.flipX)prop.setFlipX(true);
  objects.push(prop);if(!s.loadedWorldZones.has(0))s.loadedWorldZones.set(0,objects);
  if(landmark){s.createAshLandmarkShadow(objects,prop,key);s.addAshLandmarkCollision(objects,prop,key);s.worldLandmarkObjects.push(prop);}
  else{s.createAshPropShadow(objects,prop,kind);s.addAshPropCollision(objects,prop,kind,key);}
  const id=options.id||this.nextCreatedId();
  s.registerDevEnvironmentObject(prop,{id,segment:options.segment||this.segmentAtX(x),cluster:null,kind,key,landmark,created:true});
  prop.devDeleted=Boolean(options.deleted);
  s.updateDevEnvironmentLinks(prop);this.applyObjectVisibility(prop);
  if(options.history!==false){const before=this.snapshot(prop);before.deleted=true;this.pushHistory([before]);}
  if(options.select!==false)this.selected=prop;
  this.refreshSelectedPanel();return prop;
 }
 restoreCreatedObjectsFromSaved(){
  const entries=Object.entries(this.savedLayout?.objects||{});
  for(const [id,state] of entries){
   if(!state?.created||this.findEnv(id))continue;
   this.createEnvironmentPropAt(state.x,state.y,state.key,{id,kind:state.kind,segment:state.segment,scale:state.scale,alpha:state.alpha,rotation:state.rotation,flipX:state.flipX,deleted:state.deleted,history:false,select:false});
  }
 }
 togglePropPlacement(){this.placingProp=!this.placingProp;if(this.placingProp)this.setEditMode(true);this.refreshStateButtons();this.refreshSelectedPanel();}
 addSelectedPropAtViewCenter(){const c=this.scene.cameras.main;if(!this.editMode)this.setEditMode(true);this.createEnvironmentPropAt(c.worldView.centerX,c.worldView.centerY,this.selectedPropKey());}
 duplicateSelected(){if(!this.selected)return;const o=this.selected,m=o.devEnvMeta||{};this.createEnvironmentPropAt(o.x+32,o.y+24,m.key,{kind:m.kind,segment:this.segmentAtX(o.x+32),scale:Math.abs(o.scaleX),alpha:o.alpha,rotation:o.rotation,flipX:o.flipX});}

 setEditMode(on){this.editMode=Boolean(on);if(this.editMode){this.uiEditor?.setEditMode(false);this.overlayFlags.propColliders=true;this.scene.setGameplayPaused('devEdit',true);}else{this.scene.setGameplayPaused('devEdit',false);this.placingProp=false;this.envDrag=null;this.selected=null;}this.refreshStateButtons();this.refreshSelectedPanel();}
 pointerWorld(pointer){const c=this.scene.cameras.main;try{return c.getWorldPoint(pointer.x,pointer.y);}catch{return {x:pointer.worldX,y:pointer.worldY};}}
 pointerButton(pointer){return Number(pointer?.event?.button??0);}
 findEnvironmentAt(x,y){const candidates=(this.scene.devEnvironmentObjects||[]).filter(o=>o?.active&&!o.devDeleted&&o.visible!==false&&o.getBounds?.().contains(x,y));if(!candidates.length)return null;candidates.sort((a,b)=>{const aa=a.displayWidth*a.displayHeight,bb=b.displayWidth*b.displayHeight;return aa-bb;});return candidates[0];}
 handleWorldPointer(pointer){
  if(!pointer)return;
  const button=this.pointerButton(pointer),world=this.pointerWorld(pointer);
  const panButton=button===1||button===2;
  if((this.freeCamera&&!this.editMode)||panButton){
   this.cameraPan={pointerId:pointer.id,startX:pointer.x,startY:pointer.y,startScrollX:this.scene.cameras.main.scrollX,startScrollY:this.scene.cameras.main.scrollY};
   return;
  }
  if(!this.editMode)return;
  if(this.placingProp&&button===0){this.createEnvironmentPropAt(world.x,world.y,this.selectedPropKey());this.placingProp=false;this.refreshStateButtons();return;}
  const picked=this.findEnvironmentAt(world.x,world.y);
  if(!picked){this.selected=null;this.envDrag=null;this.refreshSelectedPanel();return;}
  this.selected=picked;this.refreshSelectedPanel();
  if(button===0){this.pushHistory([this.snapshot(picked)]);this.envDrag={pointerId:pointer.id,object:picked,startWorldX:world.x,startWorldY:world.y,startX:picked.x,startY:picked.y};}
 }
 handleDevPointerMove(pointer){
  if(this.cameraPan&&pointer.id===this.cameraPan.pointerId){const c=this.scene.cameras.main,zoom=Math.max(0.05,c.zoom||1);c.scrollX=this.cameraPan.startScrollX-(pointer.x-this.cameraPan.startX)/zoom;c.scrollY=this.cameraPan.startScrollY-(pointer.y-this.cameraPan.startY)/zoom;return;}
  if(this.editMode&&this.envDrag&&pointer.id===this.envDrag.pointerId){const world=this.pointerWorld(pointer),o=this.envDrag.object;if(!o?.active)return;o.x=Phaser.Math.Clamp(this.envDrag.startX+(world.x-this.envDrag.startWorldX),0,4000);o.y=Phaser.Math.Clamp(this.envDrag.startY+(world.y-this.envDrag.startWorldY),0,STAGE0.WORLD_HEIGHT);o.devEnvMeta.segment=this.segmentAtX(o.x);this.scene.updateDevEnvironmentLinks(o);this.applyObjectVisibility(o);this.refreshSelectedPanel();}
 }
 handleDevPointerUp(pointer){if(this.cameraPan&&pointer.id===this.cameraPan.pointerId)this.cameraPan=null;if(this.envDrag&&pointer.id===this.envDrag.pointerId)this.envDrag=null;}
 handleCameraWheel(pointer,deltaY){if(!this.freeCamera&&!this.cameraLocked&&!this.editMode)return;const c=this.scene.cameras.main,before=this.pointerWorld(pointer),factor=deltaY>0?0.90:1.10;const next=Phaser.Math.Clamp((c.zoom||1)*factor,0.18,2.5);c.setZoom(next);const after=this.pointerWorld(pointer);c.scrollX+=before.x-after.x;c.scrollY+=before.y-after.y;this.updateInfo(true);}
 refreshSelectedPanel(){const el=document.getElementById('lkdev-selected');if(!el)return;if(!this.selected){el.textContent=this.placingProp?'PLACE mode · click on the map':(this.editMode?'EDIT active · click / drag an environment object':'No object selected');return;}const o=this.selected,m=o.devEnvMeta;el.textContent=`${m.id}${m.created?' · NEW':''}\n${m.key} · ${m.kind} · ${m.segment}\nX ${o.x.toFixed(0)}  Y ${o.y.toFixed(0)}  Scale ${Math.abs(o.scaleX).toFixed(2)}  Alpha ${o.alpha.toFixed(2)}${o.devDeleted?' · DELETED':''}`;const set=(id,v)=>{const i=document.getElementById(id);if(i)i.value=v};set('lkdev-env-x',Math.round(o.x));set('lkdev-env-y',Math.round(o.y));set('lkdev-env-scale',Math.abs(o.scaleX).toFixed(2));set('lkdev-env-rotation',o.rotation.toFixed(3));set('lkdev-env-alpha',o.alpha.toFixed(2));}


 followCamera(){const c=this.scene.cameras.main;this.freeCamera=false;this.cameraLocked=false;this.cameraPan=null;c.startFollow(this.scene.player,true,0.10,0.10);this.scene.setupResponsiveWorldCamera?.();}
 lockCamera(){const c=this.scene.cameras.main;this.freeCamera=false;this.cameraLocked=true;this.cameraPan=null;c.stopFollow();}
 toggleFreeCamera(){this.freeCamera=!this.freeCamera;this.cameraLocked=false;this.cameraPan=null;const c=this.scene.cameras.main;if(this.freeCamera)c.stopFollow();else this.followCamera();}
 setRenderScale(value){
  const applied=lkApplyRenderScale(this.scene.game,value);
  this.refreshStateButtons();this.updateRenderInfo(true);this.updateInfo(true);
  return applied;
 }
 updateRenderInfo(force=false){
  const el=document.getElementById('lkdev-render-info');if(!el)return;
  const game=this.scene.game,canvas=game.canvas,css=lkCssViewport(),rect=canvas?.getBoundingClientRect?.();
  const cw=canvas?.width||0,ch=canvas?.height||0,rw=rect?.width||canvas?.clientWidth||0,rh=rect?.height||canvas?.clientHeight||0;
  const bx=rw?cw/rw:0,by=rh?ch/rh:0;
  const renderer=game.renderer?.type===Phaser.WEBGL?'WEBGL':(game.renderer?.type===Phaser.CANVAS?'CANVAS':String(game.renderer?.type||'?'));
  const hud=this.scene.scene?.get?.('HUDScene');
  const textRes=hud?.hpText?.resolution||'-';
  el.textContent=`Device DPR ${Number(window.devicePixelRatio||1).toFixed(2)}   Active ${LK_RENDER_SCALE.toFixed(2)}×
Viewport CSS ${css.width}×${css.height}
Canvas backing ${cw}×${ch}
Canvas CSS ${Math.round(rw)}×${Math.round(rh)}
Backing/CSS ${bx.toFixed(2)}× / ${by.toFixed(2)}×
Renderer ${renderer}   HUD Text res ${textRes}`;
 }
 setCameraZoom(value){const c=this.scene.cameras.main;c.setZoom(Phaser.Math.Clamp(Number(value)||1,0.18,2.5));}
 fitAshFields(){const c=this.scene.cameras.main;c.stopFollow();this.freeCamera=true;this.cameraLocked=false;const z=Math.min(c.width/4000,c.height/STAGE0.WORLD_HEIGHT)*0.94;c.setZoom(Phaser.Math.Clamp(z,0.18,1));c.centerOn(2000,STAGE0.WORLD_HEIGHT/2);this.refreshStateButtons();this.updateInfo(true);}

 runScenario(name){const s=this.scene;s.devFlags.autoSpawnsDisabled=true;this.deleteOrdinaryEnemies();this.deleteChampion();this.clearProjectiles();this.clearHazards();switch(name){case'empty':break;case'skeleton10':this.spawnEnemies('skeleton',10);break;case'mage5':this.spawnEnemies('mage',5);break;case'mixed':this.spawnMixed(14);break;case'champion':this.spawnSelectedChampion();break;case'heavy':this.spawnMixed(26);break;case'critical':this.setPlayerHp(18);break;case'lowHorde':this.setPlayerHp(18);this.spawnMixed(18);break;}this.refreshStateButtons();}
 runStress(count){this.scene.devFlags.autoSpawnsDisabled=true;this.deleteOrdinaryEnemies();this.clearProjectiles();this.spawnMixed(count);}

 setGameUiHidden(hidden){this.hideGameUi=Boolean(hidden);const hud=this.scene.scene.get('HUDScene');if(this.scene.scene?.setVisible)this.scene.scene.setVisible(!hidden,'HUDScene');else if(hud?.sys?.setVisible)hud.sys.setVisible(!hidden);this.scene.hud?.setVisible(!hidden);this.scene.waveText?.setVisible(!hidden);this.scene.waveSubText?.setVisible(!hidden);this.scene.regionText?.setVisible(!hidden);}
 captureScreenshot(){const previous=this.hideGameUi,wasOpen=this.open,wasDevPaused=this.scene.gameplayPauseReasons?.has('devPanel'),overlayVisible=this.graphics?.visible!==false;this.scene.setGameplayPaused('devPanel',true);this.setGameUiHidden(true);if(this.graphics)this.graphics.setVisible(false);this.togglePanel(false);if(this.button)this.button.style.display='none';const restore=()=>{this.setGameUiHidden(previous);if(this.graphics)this.graphics.setVisible(overlayVisible);if(!wasDevPaused)this.scene.setGameplayPaused('devPanel',false);if(wasOpen)this.togglePanel(true);else if(this.button)this.button.style.display='';};setTimeout(()=>{try{this.scene.game.renderer.snapshot(image=>{const link=document.createElement('a');link.download=`last-knight-x${Math.round(this.scene.player.x)}-${Date.now()}.png`;link.href=image.src;link.click();restore();});}catch{restore();}},80);}

 refreshStateButtons(){if(!this.root)return;const f=this.scene.devFlags;const state={autoSpawns:!f.autoSpawnsDisabled,enemyFreezeAI:f.enemyAiFrozen,enemyFreezeMove:f.enemyMovementFrozen,enemyAttacks:f.enemyAttacksDisabled,championFreeze:f.championFrozen,championMove:f.championMovementFrozen,championAttacks:f.championAttacksDisabled,championSkills:f.championSkillsDisabled,god:f.godMode,oneHit:f.oneHitKill,noCollision:f.noCollision,infiniteMana:f.infiniteMana,editEnv:this.editMode,collisionTest:this.collisionTest,groundOnly:this.groundOnly,hideUi:this.hideGameUi,freeCamera:this.freeCamera,lockCamera:this.cameraLocked,placeProp:this.placingProp};this.root.querySelectorAll('[data-action]').forEach(btn=>{const a=btn.dataset.action,v=btn.dataset.value;let on=Boolean(state[a]);if(a==='envToggle')on=this.envVisibility[v];if(a==='overlay')on=this.overlayFlags[v];if(a==='segment')on=!this.hiddenSegments.has(v);if(a==='renderScale'){const target=v==='dpr'?Math.min(Math.max(window.devicePixelRatio||1,1),LK_RENDER_SCALE_MAX):Number(v);on=Math.abs(target-LK_RENDER_SCALE)<0.01;}if(a==='regionPopulation'){const override=this.scene.devRegionPopulationOverride;on=v==='auto'?override===null:override!==null&&Math.abs(Number(v)-override)<0.001;}btn.classList.toggle('on',on);if(a==='autoSpawns')btn.textContent=f.autoSpawnsDisabled?'Auto Spawns OFF':'Auto Spawns ON';});}

 getCurrentSegment(){const x=this.scene.player?.x||0;return ASH_FIELDS_SEGMENTS.find(seg=>x>=seg.start&&x<seg.end)?.id||'-';}
 updateInfo(force=false){const now=performance.now();if(!force&&now-this.lastInfoAt<200)return;this.updateRenderInfo(force);this.lastInfoAt=now;const s=this.scene,e=s.enemies||[],fps=s.game.loop.actualFps||0,champ=s.activeChampion,rb=s.getRegionBalance(),effectiveSword=s.getEffectiveMeleeDamage(),population=s.getWavePopulationMultiplier();const txt=`FPS ${fps.toFixed(0)}   Time ${(s.devTimeScale||1).toFixed(2)}×
Player ${Math.round(s.player.x)},${Math.round(s.player.y)}   HP ${Math.round(s.player.hp)}/${s.player.maxHp||100}   Mana ${s.mana}/${s.maxMana}
Wave ${s.wave}   Level ${s.level}   XP ${s.xp}/${s.getXpRequiredForLevel()}
Enemies ${e.filter(x=>x.active&&x.type!=='champion').length}   Projectiles ${s.projectiles.length}
Wave target ${s.spawned}/${s.waveTarget}   Population ${population.toFixed(2)}×   Spawn ${rb.spawnRateMultiplier.toFixed(2)}×
Region balance ${WORLD_DESIGN.ZONES[s.progressionBalanceZoneIndex]?.name||'-'}   HP ×${rb.playerMaxHpMultiplier.toFixed(2)}   Melee +${rb.meleeDamageBonus}
Champion ${champ?.active?champ.championName+' '+Math.ceil(champ.hp)+'/'+champ.maxHp:'none'}
Segment ${this.getCurrentSegment()}   Camera zoom ${s.cameras.main.zoom.toFixed(2)}
Sword ${s.meleeAttack.damage}+${rb.meleeDamageBonus}=${effectiveSword} dmg / ${s.meleeAttack.cooldown}ms / R${s.meleeAttack.radius}
Pause ${Array.from(s.gameplayPauseReasons||[]).join(', ')||'-'}
EDIT ${this.editMode?'ON':'off'}${this.placingProp?' / PLACE':''}   Selected ${this.selected?.devEnvMeta?.id||'-'}
Camera ${Math.round(s.cameras.main.worldView.centerX)},${Math.round(s.cameras.main.worldView.centerY)}   Drag ${this.freeCamera?'ON':'off'}`;const el=document.getElementById('lkdev-info');if(el)el.textContent=txt;}

 drawOverlays(){if(!this.graphics)return;const g=this.graphics,s=this.scene,c=s.cameras.main;g.clear();
  if(this.overlayFlags.safeLane){g.fillStyle(0x4ea7ff,0.055);g.fillRect(0,WORLD_DESIGN.ROUTE_Y-270,4000,540);g.lineStyle(2,0x62b4ff,0.35);g.strokeRect(0,WORLD_DESIGN.ROUTE_Y-270,4000,540);}
  if(this.overlayFlags.meleeRadius){g.lineStyle(2,0xffdf6a,0.8);g.strokeCircle(s.player.x,s.player.y,s.meleeAttack.radius);}
  if(this.overlayFlags.hitboxes){g.lineStyle(2,0x62e8ff,0.85);g.strokeCircle(s.player.x,s.player.y,s.player.hitRadius||16);for(const e of s.enemies){if(e.active){g.lineStyle(1,0xff6677,0.7);g.strokeCircle(e.x,e.y,e.hitRadius||14);}}}
  if(this.overlayFlags.enemyRange){for(const e of s.enemies){if(!e.active||e.type==='champion')continue;const r=e.type==='mage'?210:(e.type==='shield'?75:62);g.lineStyle(1,e.type==='mage'?0x66ff88:0xffa65c,0.32);g.strokeCircle(e.x,e.y,r);}}
  if(this.overlayFlags.championRange&&s.activeChampion?.active){const e=s.activeChampion;let r=e.championKind==='hollowTree'?175:(e.championKind==='shieldWarden'?128:110);g.lineStyle(2,0xd879ff,0.55);g.strokeCircle(e.x,e.y,r);}
  if(this.overlayFlags.propColliders){for(const b of s.devEnvironmentColliders||[]){if(!b?.active||!b.body?.enable)continue;const q=s.getAshBlockerBounds(b);if(q){g.lineStyle(1,0x72ff8b,0.7);g.strokeRect(q.left,q.top,q.right-q.left,q.bottom-q.top);}}}
  if(this.overlayFlags.navigation){
   const nav=s.ensureNavigationGrid?.();
   if(nav){
    const view=c.worldView;
    const minCol=Phaser.Math.Clamp(Math.floor(view.left/nav.cellSize)-1,0,nav.cols-1),maxCol=Phaser.Math.Clamp(Math.floor(view.right/nav.cellSize)+1,0,nav.cols-1);
    const minRow=Phaser.Math.Clamp(Math.floor(view.top/nav.cellSize)-1,0,nav.rows-1),maxRow=Phaser.Math.Clamp(Math.floor(view.bottom/nav.cellSize)+1,0,nav.rows-1);
    g.lineStyle(1,0x6aa8ff,0.13);
    for(let col=minCol;col<=maxCol+1;col++)g.lineBetween(col*nav.cellSize,view.top,col*nav.cellSize,view.bottom);
    for(let row=minRow;row<=maxRow+1;row++)g.lineBetween(view.left,row*nav.cellSize,view.right,row*nav.cellSize);
    for(let row=minRow;row<=maxRow;row++)for(let col=minCol;col<=maxCol;col++)if(nav.blocked[row*nav.cols+col]){g.fillStyle(0xff4d5f,0.18);g.fillRect(col*nav.cellSize,row*nav.cellSize,nav.cellSize,nav.cellSize);}
    for(const e of s.enemies||[]){
     if(!e?.active||!e.navPath?.length)continue;
     const start=Math.min(e.navPathIndex||0,e.navPath.length-1);
     g.lineStyle(2,e.type==='champion'?0xff9dff:0xffd45a,0.72);
     let px=e.x,py=e.y;
     for(let i=start;i<e.navPath.length;i++){const wp=e.navPath[i];g.lineBetween(px,py,wp.x,wp.y);px=wp.x;py=wp.y;}
     const wp=e.navPath[start];if(wp){g.fillStyle(0xffef7a,0.9);g.fillCircle(wp.x,wp.y,4);}
    }
   }
  }
  if(this.overlayFlags.cameraBounds){const v=c.worldView;g.lineStyle(2,0xffffff,0.55);g.strokeRect(v.x,v.y,v.width,v.height);}
  const centerX=s.player.x,centerY=s.player.y;if(this.overlayFlags.mobileFrame){g.lineStyle(2,0x56d8ff,0.48);g.strokeRect(centerX-800,centerY-360,1600,720);}if(this.overlayFlags.desktopFrame){g.lineStyle(2,0xffcc55,0.48);g.strokeRect(centerX-640,centerY-360,1280,720);}
  if(this.editMode&&this.selected?.active&&!this.selected.devDeleted){const b=this.selected.getBounds();g.lineStyle(3,0xffe169,0.95);g.strokeRect(b.x,b.y,b.width,b.height);g.fillStyle(0xffe169,0.8);g.fillCircle(this.selected.x,this.selected.y,5);}
 }

 update(){
  const now=performance.now(),dt=Math.min(50,now-this.lastUpdateReal);this.lastUpdateReal=now;
  if(this.freeCamera&&this.camKeys){const c=this.scene.cameras.main,spd=0.72*dt/Math.max(0.1,c.zoom);if(this.camKeys.left.isDown)c.scrollX-=spd;if(this.camKeys.right.isDown)c.scrollX+=spd;if(this.camKeys.up.isDown)c.scrollY-=spd;if(this.camKeys.down.isDown)c.scrollY+=spd;}
  if(this.scene.devFlags.infiniteMana)this.scene.mana=this.scene.maxMana;
  this.drawOverlays();this.uiEditor?.update();this.updateInfo(false);
 }
}


class BootScene extends Phaser.Scene {
 constructor(){
  super('BootScene');
 }
 preload(){
  this.cameras.main.setBackgroundColor('#060505');
  this.cameras.main.setOrigin(0,0).setZoom(LK_RENDER_SCALE);
  const logical=lkLogicalSceneSize(this),w=logical.width,h=logical.height;
  const cx=w/2,cy=h/2;
  const title=lkAddText(this,cx,cy-48,'LAST KNIGHT',{fontFamily:'Arial, sans-serif',fontSize:'30px',fontStyle:'bold',color:'#f0dfaf',stroke:'#130e09',strokeThickness:4}).setOrigin(0.5);
  const subtitle=lkAddText(this,cx,cy-14,'ПЕПЕЛ КОРОЛЕВСТВА',{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#c8b48a',letterSpacing:1}).setOrigin(0.5);
  const frameW=Math.min(320,w-48),frameH=18;
  const barBg=this.add.rectangle(cx,cy+32,frameW,frameH,0x130f0d,0.96).setStrokeStyle(2,0x8c7447,0.9);
  const fill=this.add.rectangle(cx-frameW/2+4,cy+32,Math.max(1,frameW-8),frameH-8,0xc69e4f,1).setOrigin(0,0.5);
  fill.displayWidth=0;
  const pct=lkAddText(this,cx,cy+66,'0%',{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#f5e4b3'}).setOrigin(0.5);
  this.load.on('progress',(value)=>{
   fill.displayWidth=Math.max(2,(frameW-8)*value);
   pct.setText(`${Math.round(value*100)}%`);
  });
  this.load.once('complete',()=>{
   fill.displayWidth=frameW-8;
   pct.setText('100%');
   this.time.delayedCall(80,()=>this.scene.start('PreloadScene'));
  });
  [title,subtitle,pct].forEach(t=>t.setResolution?.(LK_TEXT_RESOLUTION));
  const useMobileLoadingArt=typeof window!=='undefined' && (window.matchMedia?.('(pointer: coarse)').matches || (navigator.maxTouchPoints||0)>0);
  this.load.image(LOADING_ART_KEY,useMobileLoadingArt?'/assets/ui/loading_key_art_mobile.jpg':'/assets/ui/loading_key_art_4k.jpg');
 }
}

class PreloadScene extends Phaser.Scene {
 constructor(){
  super('PreloadScene');
  this.loadingFailed=false;
  this.requiredLoadErrors=[];
  this.optionalLoadErrors=[];
  this.queuedAssetCount=0;
 }
 create(){
  this.loadingFailed=false;
  this.requiredLoadErrors=[];
  this.optionalLoadErrors=[];
  this.cameras.main.setOrigin(0,0).setZoom(LK_RENDER_SCALE);
  this.buildLoadingScreen();
  const queued=queueAssetCategories(this,INITIAL_ASSET_CATEGORIES);
  this.queuedAssetCount=queued.length;
  this.registerLoadingEvents();
  this.load.start();
 }
 buildLoadingScreen(){
  this.bg=this.add.image(0,0,LOADING_ART_KEY).setDepth(0);
  this.vignette=this.add.rectangle(0,0,100,100,0x050403,0.16).setOrigin(0).setDepth(1);
  this.overlayShadow=this.add.rectangle(0,0,100,100,0x000000,0.22).setDepth(2);
  this.overlay=this.add.rectangle(0,0,100,100,0x080706,0.62).setStrokeStyle(2,0x8e7547,0.92).setDepth(3);
  this.overlayInner=this.add.rectangle(0,0,100,100,0x12100d,0.38).setStrokeStyle(1,0xd9c180,0.18).setDepth(4);
  this.loadingTitle=lkAddText(this,0,0,'LAST KNIGHT',{fontFamily:'Arial, sans-serif',fontSize:'30px',fontStyle:'bold',color:'#f1e0b1',stroke:'#130e09',strokeThickness:4}).setOrigin(0.5).setDepth(5);
  this.loadingSubtitle=lkAddText(this,0,0,'ПЕПЕЛ КОРОЛЕВСТВА',{fontFamily:'Arial, sans-serif',fontSize:'15px',fontStyle:'bold',color:'#ccb68a',letterSpacing:1}).setOrigin(0.5).setDepth(5);
  this.loadingStatus=lkAddText(this,0,0,LOADING_SCREEN_STATUS,{fontFamily:'Arial, sans-serif',fontSize:'14px',color:'#dfd6c5'}).setOrigin(0.5).setDepth(5);
  this.progressBack=this.add.rectangle(0,0,100,18,0x100d0b,0.96).setStrokeStyle(2,0x8d7445,0.95).setDepth(5);
  this.progressFill=this.add.rectangle(0,0,100,10,0xc39a4a,1).setOrigin(0,0.5).setDepth(6);
  this.progressGlow=this.add.rectangle(0,0,100,3,0xf6d691,0.34).setOrigin(0,0.5).setDepth(6);
  this.progressPct=lkAddText(this,0,0,'0%',{fontFamily:'Arial, sans-serif',fontSize:'15px',fontStyle:'bold',color:'#f7e5b5'}).setOrigin(0.5).setDepth(6);
  this.retryHint=lkAddText(this,0,0,'Loading failed — tap to retry',{fontFamily:'Arial, sans-serif',fontSize:'13px',fontStyle:'bold',color:'#ffcfbf'}).setOrigin(0.5).setDepth(6).setVisible(false).setInteractive({useHandCursor:true});
  [this.loadingTitle,this.loadingSubtitle,this.loadingStatus,this.progressPct,this.retryHint].forEach(t=>t?.setResolution?.(LK_TEXT_RESOLUTION));
  this.retryHint.on('pointerdown',()=>{
   if(!this.loadingFailed) return;
   this.scene.restart();
  });
  this.scale.on('resize',this.layoutLoadingScreen,this);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
   this.scale.off('resize',this.layoutLoadingScreen,this);
   this.load.off('progress');
   this.load.off('fileprogress');
   this.load.off('complete');
   this.load.off('loaderror');
  });
  this.layoutLoadingScreen();
 }
 layoutLoadingScreen(){
  this.cameras.main.setOrigin(0,0).setZoom(LK_RENDER_SCALE);
  const logical=lkLogicalSceneSize(this),w=logical.width,h=logical.height;
  const mobile=h<760 || w<1100;
  const cx=w/2,cy=h/2;
  const bgScale=Math.max(w/this.bg.width,h/this.bg.height);
  this.bg.setPosition(cx,cy).setScale(bgScale);
  this.vignette.setPosition(0,0).setSize(w,h).setDisplaySize(w,h);
  const overlayW=Math.min(mobile?Math.max(300,w*0.56):560,w-36);
  const overlayH=mobile?162:186;
  this.overlayShadow.setPosition(cx,cy+4).setSize(overlayW,overlayH).setDisplaySize(overlayW,overlayH);
  this.overlay.setPosition(cx,cy).setSize(overlayW,overlayH).setDisplaySize(overlayW,overlayH);
  this.overlayInner.setPosition(cx,cy).setSize(overlayW-10,overlayH-10).setDisplaySize(overlayW-10,overlayH-10);
  this.loadingTitle.setPosition(cx,cy-(mobile?42:50)).setFontSize(mobile?24:30);
  this.loadingSubtitle.setPosition(cx,cy-(mobile?16:20)).setFontSize(mobile?13:15);
  const barW=overlayW-(mobile?42:64);
  this.progressBack.setPosition(cx,cy+(mobile?18:22)).setSize(barW,20).setDisplaySize(barW,20);
  this.progressFill.setPosition(cx-barW/2+5,cy+(mobile?18:22)).setSize(barW-10,10).setDisplaySize(Math.max(0,Math.min(barW-10,this.progressFill.displayWidth||0)),10);
  this.progressGlow.setPosition(cx-barW/2+5,cy+(mobile?14:18)).setSize(barW-10,3).setDisplaySize(Math.max(0,Math.min(barW-10,this.progressGlow.displayWidth||0)),3);
  this.progressPct.setPosition(cx,cy+(mobile?47:54)).setFontSize(mobile?14:15);
  this.loadingStatus.setPosition(cx,cy+(mobile?73:82)).setFontSize(mobile?12:14);
  this.retryHint.setPosition(cx,cy+(mobile?97:108)).setFontSize(mobile?11:13);
 }
 registerLoadingEvents(){
  const totalFiles=Math.max(1,this.queuedAssetCount || this.load.list.size + this.load.inflight.size);
  this.load.on('progress',(value)=>this.setProgress(value));
  this.load.on('fileprogress',(file)=>{
   const raw=file?.key || LOADING_SCREEN_STATUS;
   const friendly=String(raw).replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
   this.loadingStatus.setText(`Loading: ${friendly}`);
  });
  this.load.on('loaderror',(file)=>{
   const key=String(file?.key||'unknown');
   const spec=getAssetSpec(key);
   const optional=spec?.requirement===ASSET_REQUIREMENT.OPTIONAL;
   if(optional){
    this.optionalLoadErrors.push(key);
    console.warn(`[AssetPipeline] Optional asset skipped: ${key}`,spec?.url||file?.url||'');
    this.loadingStatus.setText(`Optional asset skipped: ${key.replace(/_/g,' ')}`);
    return;
   }

   this.loadingFailed=true;
   this.requiredLoadErrors.push(key);
   console.error(`[AssetPipeline] Required asset failed: ${key}`,spec?.url||file?.url||'');
   this.loadingStatus.setText('Required asset failed');
   this.retryHint.setVisible(true);
  });
  this.load.once('complete',()=>{
   if(this.loadingFailed){
    const count=this.requiredLoadErrors.length;
    this.loadingStatus.setText(`Loading failed (${count} required asset${count===1?'':'s'})`);
    this.retryHint.setVisible(true);
    return;
   }
   this.setProgress(1);
   const skipped=this.optionalLoadErrors.length;
   this.loadingStatus.setText(skipped?`Opening prologue... (${skipped} optional skipped)`:'Opening prologue...');
   this.time.delayedCall(220,()=>{
    this.cameras.main.fadeOut(220,0,0,0);
    this.time.delayedCall(230,()=>{
     if(this.loadingFailed) return;
     // Loading key art is one-shot. Destroy the display object first, then
     // release the shared texture before entering the cinematic scene.
     if(this.bg?.active) this.bg.destroy();
     releaseTextureKeys(this,[LOADING_ART_KEY]);
     this.scene.start('CinematicScene');
    });
   });
  });
  this.loadingStatus.setText(`${LOADING_SCREEN_STATUS} (${totalFiles} assets)`);
 }
 setProgress(value){
  const progress=Phaser.Math.Clamp(value,0,1);
  const maxW=(this.progressBack.displayWidth||this.progressBack.width)-10;
  this.progressFill.displayWidth=Math.max(0,maxW*progress);
  this.progressGlow.displayWidth=Math.max(0,maxW*progress);
  this.progressPct.setText(`${Math.round(progress*100)}%`);
 }
}



class CinematicScene extends Phaser.Scene {
 constructor(){
  super('CinematicScene');
  this.transitioning=false;
  this.stoneFramePieces=[];
  this.pageIndex=0;
  this.prologueMusic=null;
  this.musicHandedOff=false;
  this.fullscreenButton=null;
  this.fullscreenIcon=null;
  this.isCompactMobile=false;
  this.cinematicImageAspect=2.75;
  this.prologuePages=PROLOGUE_STORY_PAGES;
  this.cinematicMode='prologue';
  this.cinematicPages=this.prologuePages;
  this.runtimeReleaseTextureKeys=[];
  this.runtimeOnComplete=null;
  this.runtimeOnCancel=null;
  this.runtimeCompletionDispatched=false;
 }

 init(data={}){
  const runtimePages=Array.isArray(data?.pages)
   ? data.pages.filter(page=>page && page.image && page.text!==undefined)
   : [];
  this.cinematicMode=data?.mode==='story' ? 'story' : 'prologue';
  this.cinematicPages=this.cinematicMode==='story' && runtimePages.length
   ? runtimePages
   : this.prologuePages;
  this.runtimeReleaseTextureKeys=Array.isArray(data?.releaseTextureKeys)
   ? [...new Set(data.releaseTextureKeys.filter(Boolean))]
   : [];
  this.runtimeOnComplete=typeof data?.onComplete==='function' ? data.onComplete : null;
  this.runtimeOnCancel=typeof data?.onCancel==='function' ? data.onCancel : null;
  this.runtimeCompletionDispatched=false;
  this.transitioning=false;
  this.pageIndex=0;
  this.musicHandedOff=false;
 }

 create(){
  this.cameras.main.setBackgroundColor('#050505');
  this.cameras.main.setOrigin(0,0).setZoom(LK_RENDER_SCALE);

  this.buildCinematicUi();
  this.setProloguePage(0);
  this.layout();
  if(this.cinematicMode==='prologue') this.startPrologueMusic();
  cinematicFadeIn(this);

  this._cinematicResizeHandler=()=>this.layout();
  this.scale.on('resize',this._cinematicResizeHandler);

  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
   if(this._cinematicResizeHandler){
    this.scale.off('resize',this._cinematicResizeHandler);
   }
   if(this._fullscreenChangeHandler && typeof document!=='undefined'){
    document.removeEventListener('fullscreenchange',this._fullscreenChangeHandler);
   }
   if(!this.musicHandedOff) this.stopPrologueMusic();
   if(this.cinematicMode==='story' && !this.runtimeCompletionDispatched){
    this.dispatchRuntimeCinematicCancel();
   }
  });

  this.input.keyboard?.on('keydown-RIGHT',()=>this.advancePrologue());
  this.input.keyboard?.on('keydown-ENTER',()=>this.advancePrologue());
  this.input.keyboard?.on('keydown-SPACE',()=>this.advancePrologue());
 }

 buildCinematicUi(){
  this.upperPanel=this.add.rectangle(0,0,100,100,0x050505,1)
   .setOrigin(0)
   .setDepth(0);
  this.lowerPanel=this.add.rectangle(0,0,100,100,0x050505,1)
   .setOrigin(0)
   .setDepth(0)
   .setInteractive({useHandCursor:true});
  this.lowerPanel.on('pointerup',()=>this.advancePrologue());

  const firstImageKey=this.cinematicPages?.[0]?.image || this.prologuePages?.[0]?.image || 'prologue_scene_01';
  this.cinematicImage=this.add.image(0,0,firstImageKey)
   .setOrigin(0)
   .setDepth(2);

  this.dialogueText=lkAddText(this,0,0,'',{
   fontFamily:'Georgia, serif',
   fontSize:'24px',
   color:'#ece2d1',
   align:'center',
   wordWrap:{width:760,useAdvancedWrap:true},
   lineSpacing:8
  }).setOrigin(0.5).setDepth(5);

  this.nextArrowHit=this.add.rectangle(0,0,96,84,0xffffff,0.001)
   .setDepth(20)
   .setInteractive({useHandCursor:true});

  this.nextArrowText=lkAddText(this,0,0,'→',{
   fontFamily:'Georgia, serif',
   fontSize:'48px',
   color:'#dcc59d',
   stroke:'#080706',
   strokeThickness:2
  }).setOrigin(0.5).setDepth(21);

  this.nextArrowHit.on('pointerover',()=>{
   if(!this.transitioning) this.nextArrowText.setColor('#fff0cc');
  });
  this.nextArrowHit.on('pointerout',()=>{
   this.nextArrowText.setColor('#dcc59d');
  });
  this.nextArrowHit.on('pointerup',()=>this.advancePrologue());

  this.buildFullscreenButton();
 }

 buildFullscreenButton(){
  this.fullscreenButton=this.add.circle(0,0,24,0x11100e,0.92)
   .setStrokeStyle(2,0xc4a662,0.92)
   .setDepth(40)
   .setScrollFactor(0)
   .setInteractive({useHandCursor:true});
  this.fullscreenIconLabel=lkAddText(this,0,0,'⛶',{
   fontFamily:'Arial, sans-serif',
   fontSize:'24px',
   color:'#f1dfaa'
  }).setOrigin(0.5).setDepth(41).setScrollFactor(0);

  this.fullscreenButton.on('pointerdown',()=>this.toggleFullscreen());
  this.fullscreenIconLabel.setInteractive({useHandCursor:true});
  this.fullscreenIconLabel.on('pointerdown',()=>this.toggleFullscreen());

  if(typeof document!=='undefined'){
   this._fullscreenChangeHandler=()=>{
    this.updateFullscreenLabel();
    this.time.delayedCall(80,()=>this.layout());
   };
   document.addEventListener('fullscreenchange',this._fullscreenChangeHandler);
  }
  this.updateFullscreenLabel();
 }

 updateFullscreenLabel(){
  if(!this.fullscreenIconLabel)return;
  const active=typeof document!=='undefined' && Boolean(document.fullscreenElement);
  this.fullscreenIconLabel.setText(active?'🗗':'⛶');
 }

 async toggleFullscreen(){
  if(typeof document==='undefined') return;
  try{
   if(document.fullscreenElement){
    if(document.exitFullscreen) await document.exitFullscreen();
   } else {
    const target=document.documentElement;
    const request=target.requestFullscreen || target.webkitRequestFullscreen;
    if(request) await request.call(target);
    if(screen.orientation?.lock){
     try{ await screen.orientation.lock('landscape'); }catch(e){}
    }
   }
  }catch(e){
   console.warn('Fullscreen request was blocked by the browser',e);
  }
  this.time.delayedCall(80,()=>this.layout());
 }

 startPrologueMusic(){
  if(!this.sound || !this.cache.audio.exists('bgm_veil_of_the_past')) return;

  this.prologueMusic=this.sound.add(
   'bgm_veil_of_the_past',
   {loop:true,volume:0.50}
  );

  const startMusic=()=>{
   if(!this.prologueMusic || this.prologueMusic.isPlaying) return;
   this.prologueMusic.play();
  };

  if(this.sound.locked) this.sound.once('unlocked',startMusic);
  else startMusic();
 }

 stopPrologueMusic(){
  if(!this.prologueMusic)return;
  try{this.prologueMusic.stop();}catch{}
  try{this.prologueMusic.destroy();}catch{}
  this.prologueMusic=null;
 }

 setProloguePage(index){
  const page=this.cinematicPages[index];
  if(!page)return;

  this.pageIndex=index;
  this.dialogueText.setText(page.text);
  this.cinematicImage.setTexture(page.image);
  this.nextArrowText.setText('→');

  if(this._lastImageBounds){
   this.fitCinematicImage(...this._lastImageBounds);
  }
  if(this._lastTextLayout){
   this.layoutDialogueText(...this._lastTextLayout);
  }
 }

 advancePrologue(){
  if(this.transitioning)return;

  if(this.pageIndex<this.cinematicPages.length-1){
   const nextIndex=this.pageIndex+1;
   cinematicSwapWithFade(this,()=>this.setProloguePage(nextIndex));
   return;
  }

  this.continueToGame();
 }

 clearStoneFrame(){
  for(const piece of this.stoneFramePieces){
   if(piece?.active) piece.destroy();
  }
  this.stoneFramePieces.length=0;
 }

 addStoneBar(x1,y1,x2,y2,thickness,depth=10){
  const dx=x2-x1;
  const dy=y2-y1;
  const length=Math.hypot(dx,dy);
  if(length<=0)return;

  const source=this.textures.get('cinematic_stone_bar').getSourceImage();
  const aspect=(source?.width&&source?.height)
   ? source.width/source.height
   : 3.2;

  const segmentLength=thickness*aspect;
  const count=Math.max(1,Math.ceil(length/segmentLength));
  const angle=Math.atan2(dy,dx);
  const ux=dx/length;
  const uy=dy/length;

  for(let i=0;i<count;i++){
   const along=Math.min(length-segmentLength/2, segmentLength*(i+0.5));
   const safeAlong=Math.max(segmentLength/2,along);
   const x=x1+ux*safeAlong;
   const y=y1+uy*safeAlong;

   const piece=this.add.image(x,y,'cinematic_stone_bar')
    .setOrigin(0.5)
    .setDepth(depth)
    .setDisplaySize(segmentLength+1,thickness)
    .setRotation(angle)
    .setFlipX(i%2===1);

   this.stoneFramePieces.push(piece);
  }
 }

 addStoneJoint(x,y,size,depth=12){
  const joint=this.add.image(x,y,'cinematic_stone_joint')
   .setOrigin(0.5)
   .setDepth(depth)
   .setDisplaySize(size,size);

  this.stoneFramePieces.push(joint);
  return joint;
 }

 fitCinematicImage(x,y,w,h){
  if(!this.cinematicImage?.texture)return;

  const source=this.cinematicImage.texture.getSourceImage();
  const sw=source?.width||1536;
  const sh=source?.height||864;
  const scale=Math.min(w/sw,h/sh);
  const displayW=sw*scale;
  const displayH=sh*scale;
  const drawX=x+(w-displayW)*0.5;
  const drawY=y+(h-displayH)*0.5;

  this.cinematicImage
   .setCrop()
   .setPosition(drawX,drawY)
   .setDisplaySize(displayW,displayH);

  this._lastImageBounds=[x,y,w,h];
 }

 layoutDialogueText(textX,textY,textW,textH){
  if(!this.dialogueText)return;

  this._lastTextLayout=[textX,textY,textW,textH];

  const centerX=textX+textW*0.5;
  const centerY=textY+textH*0.5;
  const targetLines=Math.max(1,this.dialogueText.text.split('\n').length);
  const {width:sceneW,height:sceneH}=lkLogicalSceneSize(this);

  // 1280x720 is the reference cinematic viewport. The font now scales with
  // the real screen/frame size instead of staying at 28px until it overflows.
  const responsiveScale=Math.min(sceneW/1280,sceneH/720);
  const responsiveBase=Phaser.Math.Clamp(28*responsiveScale,10,28);
  const contentLimit=Math.min(textH/(targetLines+0.65),textW/18);
  let fontSize=Math.floor(Phaser.Math.Clamp(Math.min(responsiveBase,contentLimit),9,28));
  const minFontSize=9;

  this.dialogueText
   .setAlign('center')
   .setOrigin(0.5)
   .setPosition(centerX,centerY);

  while(fontSize>=minFontSize){
   this.dialogueText
    .setFontSize(fontSize)
    .setLineSpacing(Math.max(2,Math.round(fontSize*0.18)))
    .setWordWrapWidth(textW,true)
    .setPosition(centerX,centerY);

   const bounds=this.dialogueText.getBounds();
   if(bounds.width<=textW+2 && bounds.height<=textH+2){
    break;
   }
   fontSize-=1;
  }
 }


 layout(){
  if(!this.upperPanel)return;
  this.clearStoneFrame();

  const {width:w,height:h}=lkLogicalSceneSize(this);
  this.isCompactMobile=(w<=760 || h<=460);

  // Variant 1: 10% are safe margins, not mandatory frame size.
  // The cinematic frame may become narrower than 80% width so the
  // lower text block always remains visible on ultra-wide mobile screens.
  const marginX=Math.round(w*0.10);
  const marginY=Math.round(h*0.10);
  const maxFrameW=Math.max(260,w-marginX*2);
  const maxFrameH=Math.max(220,h-marginY*2);

  const preferredTextShare=this.isCompactMobile?0.37:0.35;
  const minTextBlockH=Phaser.Math.Clamp(maxFrameH*(this.isCompactMobile?0.24:0.22),88,170);

  // Width limited by both available width and the need to preserve room
  // for the fixed-ratio image plus the lower dialogue block.
  let frameW=Math.min(maxFrameW,maxFrameH*this.cinematicImageAspect*(1-preferredTextShare));
  frameW=Math.max(260,frameW);

  let imageH=frameW/this.cinematicImageAspect;
  let frameH=imageH/(1-preferredTextShare);
  let lowerPanelH=frameH-imageH;

  if(lowerPanelH<minTextBlockH){
   lowerPanelH=minTextBlockH;
   imageH=Math.min(frameW/this.cinematicImageAspect,maxFrameH-lowerPanelH);
   frameH=imageH+lowerPanelH;
   if(frameH>maxFrameH){
    frameH=maxFrameH;
    lowerPanelH=Math.max(minTextBlockH,frameH*(this.isCompactMobile?0.26:0.24));
    imageH=frameH-lowerPanelH;
    frameW=Math.min(frameW,imageH*this.cinematicImageAspect);
   }
  }

  // Final safety clamp: if the frame is still too wide for the chosen height,
  // shrink it and recompute the image height.
  const maxFrameWFromHeight=Math.max(260,(maxFrameH-minTextBlockH)*this.cinematicImageAspect);
  if(frameW>maxFrameWFromHeight){
   frameW=maxFrameWFromHeight;
   imageH=frameW/this.cinematicImageAspect;
   lowerPanelH=Math.max(minTextBlockH,Math.min(maxFrameH-imageH, imageH*(preferredTextShare/(1-preferredTextShare))));
   frameH=imageH+lowerPanelH;
  }

  frameW=Math.min(frameW,maxFrameW);
  frameH=Math.min(frameH,maxFrameH);
  imageH=Math.min(imageH,frameH-minTextBlockH);
  lowerPanelH=frameH-imageH;

  const left=Math.round((w-frameW)*0.5);
  const top=Math.round((h-frameH)*0.5);
  const right=left+frameW;
  const bottom=top+frameH;

  const borderThickness=Phaser.Math.Clamp(Math.min(frameW,frameH)*0.030,16,28);
  const jointSize=borderThickness*1.85;
  const halfBorder=borderThickness*0.58;

  const innerLeft=left+halfBorder;
  const innerRight=right-halfBorder;
  const innerTop=top+halfBorder;
  const innerBottom=bottom-halfBorder;
  const innerWidth=Math.max(180,innerRight-innerLeft);

  const dividerY=top+imageH;

  this.upperPanel
   .setPosition(left,top)
   .setSize(frameW,imageH)
   .setDisplaySize(frameW,imageH);
  this.lowerPanel
   .setPosition(left,dividerY)
   .setSize(frameW,lowerPanelH)
   .setDisplaySize(frameW,lowerPanelH);

  this.fitCinematicImage(left,top,frameW,imageH);

  this.addStoneBar(left,top,right,top,borderThickness);
  this.addStoneBar(left,bottom,right,bottom,borderThickness);
  this.addStoneBar(left,dividerY,right,dividerY,borderThickness);
  this.addStoneBar(left,top,left,bottom,borderThickness);
  this.addStoneBar(right,top,right,bottom,borderThickness);

  this.addStoneJoint(left,top,jointSize);
  this.addStoneJoint(right,top,jointSize);
  this.addStoneJoint(left,bottom,jointSize);
  this.addStoneJoint(right,bottom,jointSize);
  this.addStoneJoint(left,dividerY,jointSize);
  this.addStoneJoint(right,dividerY,jointSize);

  const lowerTop=dividerY+halfBorder;
  const lowerHeight=Math.max(1,innerBottom-lowerTop);

  const showArrow=!this.isCompactMobile;
  this.nextArrowHit.setVisible(showArrow);
  this.nextArrowText.setVisible(showArrow);
  if(showArrow){
   const arrowPadX=Phaser.Math.Clamp(frameW*0.040,16,30);
   const arrowHitW=Phaser.Math.Clamp(frameW*0.10,64,104);
   const arrowHitH=Phaser.Math.Clamp(lowerHeight*0.46,52,84);
   const arrowX=innerRight-arrowPadX-arrowHitW*0.5;
   const arrowY=lowerTop+lowerHeight*0.5;
   this.nextArrowHit.setPosition(arrowX,arrowY).setSize(arrowHitW,arrowHitH).setDisplaySize(arrowHitW,arrowHitH);
   this.nextArrowText.setPosition(arrowX,arrowY).setFontSize(Phaser.Math.Clamp(lowerHeight*0.30,30,52));
  }

  const textPadX=Phaser.Math.Clamp(frameW*0.06,20,52);
  const textPadY=Phaser.Math.Clamp(lowerHeight*0.12,4,20);
  const reservedArrowW=showArrow ? Phaser.Math.Clamp(frameW*0.12,72,120) : 0;
  const textX=innerLeft+textPadX;
  const textY=lowerTop+textPadY;
  const textW=Math.max(140,innerWidth-textPadX*2-reservedArrowW);
  const textH=Math.max(1,lowerHeight-textPadY*2);
  this.layoutDialogueText(textX,textY,textW,textH);

  if(this.fullscreenButton && this.fullscreenIconLabel){
   const fsRadius=Phaser.Math.Clamp(borderThickness*1.02,22,28);
   const fsMargin=Phaser.Math.Clamp(borderThickness*0.85,16,24);
   const fsX=w-fsMargin-fsRadius;
   const fsY=fsMargin+fsRadius;
   this.fullscreenButton.setRadius(fsRadius).setPosition(fsX,fsY);
   this.fullscreenIconLabel.setPosition(fsX,fsY).setFontSize(Math.round(fsRadius*1.02));
   this.updateFullscreenLabel();
  }
 }

 continueToGame(){
  if(this.transitioning)return;

  this.nextArrowHit.disableInteractive();
  this.lowerPanel.disableInteractive();
  this.fullscreenButton?.disableInteractive();
  this.fullscreenIconLabel?.disableInteractive();

  if(this.cinematicMode==='story'){
   cinematicFadeOutAndRun(this,()=>{
    if(this.runtimeReleaseTextureKeys.length){
     if(this.cinematicImage?.active) this.cinematicImage.destroy();
     releaseTextureKeys(this,this.runtimeReleaseTextureKeys);
    }
    this.dispatchRuntimeCinematicComplete();
    this.scene.stop();
   });
   return;
  }

  if(this.prologueMusic){
   this.registry.set('lastKnightBgmHandoff',this.prologueMusic);
   this.musicHandedOff=true;
   this.prologueMusic=null;
  }

  cinematicFadeOutAndRun(this,()=>{
   // Prologue illustrations are one-shot textures. The reusable stone frame
   // stays resident for future story cinematics, but the four large page images
   // are released before gameplay begins.
   if(this.cinematicImage?.active) this.cinematicImage.destroy();
   releaseTextureKeys(this,PROLOGUE_PAGE_KEYS);
   this.scene.start('main');
  });
 }

 dispatchRuntimeCinematicComplete(){
  if(this.runtimeCompletionDispatched)return;
  this.runtimeCompletionDispatched=true;
  const callback=this.runtimeOnComplete;
  this.runtimeOnComplete=null;
  this.runtimeOnCancel=null;
  if(callback){
   try{callback();}catch(error){console.error('[CinematicScene] story completion callback failed',error);}
  }
 }

 dispatchRuntimeCinematicCancel(){
  if(this.runtimeCompletionDispatched)return;
  this.runtimeCompletionDispatched=true;
  const callback=this.runtimeOnCancel;
  this.runtimeOnComplete=null;
  this.runtimeOnCancel=null;
  if(callback){
   try{callback();}catch(error){console.error('[CinematicScene] story cancel callback failed',error);}
  }
 }
}

class MainScene extends Phaser.Scene {
 preload(){}

 createSpriteAnimations(){
  for(const dir of HERO_SOCKET_DIRS){
   const walkKey=`hero_socket_walk_${dir}`;
   const idleKey=`hero_socket_idle_${dir}`;
   if(!this.anims.exists(walkKey)){
    this.anims.create({
     key:walkKey,
     frames:[
      {key:`hero_socket_walk_${dir}_01`},
      {key:`hero_socket_walk_${dir}_02`}
     ],
     frameRate:7,
     repeat:-1
    });
   }
   if(!this.anims.exists(idleKey)){
    this.anims.create({
     key:idleKey,
     frames:[{key:`hero_socket_walk_${dir}_01`}],
     frameRate:1,
     repeat:-1
    });
   }
  }
  if(!this.anims.exists('hero_socket_spin')){
   this.anims.create({
    key:'hero_socket_spin',
    frames:Array.from(
     {length:HERO_SOCKET_SPIN_FRAME_COUNT},
     (_,i)=>({key:`hero_socket_spin_${String(i+1).padStart(2,'0')}`})
    ),
    frameRate:HERO_SOCKET_SPIN_FRAME_RATE,
    repeat:0
   });
  }
  if(!this.anims.exists('hero_death')){
   this.anims.create({
    key:'hero_death',
    frames:Array.from(
     {length:HERO_DEATH_FRAME_COUNT},
     (_,i)=>({key:`hero_death_${String(i+1).padStart(2,'0')}`})
    ),
    duration:HERO_DEATH_ANIMATION_MS,
    repeat:0
   });
  }

  const dirs=['down','left','right','up'];

  for(const dir of dirs){
   const defs=[
    [`skeleton_${dir}_idle`,4,6,-1],
    [`skeleton_${dir}_walk`,6,10,-1],
    [`skeleton_${dir}_attack`,6,12,0],
    [`mage_${dir}_idle`,3,6,-1],
    [`mage_${dir}_walk`,6,10,-1],
    [`mage_${dir}_cast`,6,12,0],
    [`shield_${dir}_idle`,4,6,-1],
    [`shield_${dir}_walk`,6,10,-1],
    [`shield_${dir}_attack`,6,12,0]
   ];

   for(const [key,count,frameRate,repeat] of defs){
    if(this.anims.exists(key)) continue;

    this.anims.create({
     key,
     frames:Array.from(
      {length:count},
      (_,i)=>({key:`${key}_${String(i).padStart(2,'0')}`})
     ),
     frameRate,
     repeat
    });
   }
  }

  const brokenSaintDirs=[
   'down','down_left','left','up_left',
   'up','up_right','right','down_right'
  ];
  for(const dir of brokenSaintDirs){
   const defs=[
    [`broken_saint_${dir}_idle`,1,1,-1,'walk'],
    [`broken_saint_${dir}_walk`,4,8,-1,'walk'],
    [`broken_saint_${dir}_attack`,3,11,0,'attack']
   ];
   for(const [key,count,frameRate,repeat,sourceAction] of defs){
    if(this.anims.exists(key)) continue;
    this.anims.create({
     key,
     frames:Array.from(
      {length:count},
      (_,i)=>({key:`broken_saint_${dir}_${sourceAction}_${String(i).padStart(2,'0')}`})
     ),
     frameRate,
     repeat
    });
   }
  }

  // Ash Fields wounded knights: 3-frame heavy breathing. The middle frame is
  // played twice so the chest expansion/contraction reads clearly at gameplay scale.
  for(let knight=1;knight<=3;knight++){
   const index=String(knight).padStart(2,'0');
   const key=`ash_wounded_knight_${index}_breathe`;
   if(this.anims.exists(key)) continue;
   this.anims.create({
    key,
    frames:[
     {key:`ash_wounded_knight_${index}_00`,duration:300},
     {key:`ash_wounded_knight_${index}_01`,duration:180},
     {key:`ash_wounded_knight_${index}_02`,duration:300},
     {key:`ash_wounded_knight_${index}_01`,duration:180}
    ],
    frameRate:4,
    repeat:-1
   });
  }

  if(!this.anims.exists('ring_sweep')){
   this.anims.create({
    key:'ring_sweep',
    frames:Array.from(
     {length:8},
     (_,i)=>({key:`ring_sweep_${String(i).padStart(2,'0')}`})
    ),
    // Slightly longer visual sword-ring trail: ~0.47 s instead of 0.40 s.
    // Gameplay hit timing, damage and melee cooldown are unchanged.
    frameRate:17,
    repeat:0
   });
  }

  if(!this.anims.exists('hit_burst')){
   this.anims.create({
    key:'hit_burst',
    frames:Array.from(
     {length:6},
     (_,i)=>({key:`hit_burst_${String(i).padStart(2,'0')}`})
    ),
    frameRate:26,
    repeat:0
   });
  }

  if(!this.anims.exists('mage_projectile_fly')){
   this.anims.create({
    key:'mage_projectile_fly',
    frames:[
     {key:'mage_projectile_00'},
     {key:'mage_projectile_01'}
    ],
    frameRate:10,
    repeat:-1
   });
  }

  const brokenSaintAnims=[
   ['broken_saint_holy_mark',4,8,-1],
   ['broken_saint_holy_impact',4,16,0],
   ['broken_saint_holy_beam_idle',4,6,-1],
   ['broken_saint_reflect_shield',4,9,-1],
   ['broken_saint_reflect_spark',2,18,0]
  ];
  for(const [key,count,frameRate,repeat] of brokenSaintAnims){
   if(this.anims.exists(key)) continue;
   const frames = key==='broken_saint_holy_beam_idle'
    ? [
      {key:'broken_saint_holy_beam_02'},
      {key:'broken_saint_holy_beam_01'},
      {key:'broken_saint_holy_beam_02'},
      {key:'broken_saint_holy_beam_01'}
     ]
    : Array.from(
      {length:count},
      (_,i)=>({key:`${key}_${String(i).padStart(2,'0')}`})
     );
   this.anims.create({
    key,
    frames,
    frameRate,
    repeat
   });
  }

 }

 constructor(){
  super('main');
  this.enemies=[];
  this.orbs=[];
  this.kills=0;
  this.xp=0;
  this.level=1;
  this.wave=1;
  this.spawned=0;
  this.waveTarget=10;
  this.lastSpawn=0;
  this.mageSpawned=0;
  this.skeletonSpawned=0;
  this.shieldSpawned=0;
  this.championSpawned=0;
  this.projectiles=[];
  this.hearts=[];
  this.gameOver=false;
  this.gameOverUiReady=false;
  this.deathSequenceActive=false;
  this.deathSword=null;
  this.deathFlipX=false;
  this.gameplayPauseReasons=new Set();
  this.gameplayPaused=false;
  this.levelChoiceOpen=false;
  this.levelChoiceObjects=[];
  this.currentLevelChoices=[];
  this.weaponLevels={sword:1};
  this.waveProfile=null;
  this.waveSpawnInterval=1050;
  this.waveIntermission=false;
  this.nextWaveAt=0;
  this.waveBannerObjects=[];
  this.lastPlayerHitAt=-9999;
  this.playerInvulnerableUntil=0;
  this.heartPityKills=0;
  this.lowHealthState='normal';
  this.lowHealthRatio=1;
  this.heartbeatTimer=null;
  this.heartbeatSound=null;
  this.backgroundMusic=null;
  this.brokenSaintMusic=null;
  this.brokenSaintHolyWarningSound=null;
  this.lastSkeletonAttackSfxAt=-9999;
  this.lastMageCastSfxAt=-9999;
  this.heartbeatState=null;

  this.activeChampion=null;
  this.championEventActive=false;
  this.championRewardOpen=false;
  this.championRewardObjects=[];
  this.championHazards=[];
  this.relicZones=[];
  this.championRelics=new Set();
  this.nextSoulSkullAt=0;
  this.nextCursedGroundAt=0;
  this.killStreakBonus=0;
  this.lastShieldRelicBlockAt=-999999;
  this.fallenBlessingUsed=false;

  this.playerSlowUntil=0;
  this.playerSlowFactor=1;
  this.playerForcedUntil=0;
  this.playerForcedVX=0;
  this.playerForcedVY=0;

  this.mobileMoveX=0;
  this.mobileMoveY=0;
  this.mobileMovePointerId=null;
  this.mobileControls=[];
  this.isTouchDevice=false;

  this.currentWorldZoneIndex=0;
  this.progressionBalanceZoneIndex=0;
  this.devRegionPopulationOverride=null;
  this.unlockedWorldGates=new Set();
  this.worldGateObjects=new Map();
  this.pendingWorldAdvance=null;
  this.awaitingWorldAdvance=false;
  this.worldAdvanceTargetZone=null;
  this.zoneBannerCooldownUntil=0;

  // Stage 1.1 forward-only streaming world.
  this.loadedWorldZones=new Map();
  this.loadedWorldPreviews=new Map();
  this.closedWorldGates=new Set();
  this.backtrackBlockers=[];
  this.lastStreamingZoneIndex=0;

  this.emptyScreenRushActive=false;

  // DEV Scene Tuner state. These collections are populated only by environment art.
  this.devEnvironmentObjects=[];
  this.devEnvironmentShadows=[];
  this.devEnvironmentColliders=[];
  this.devTools=null;
  this.storyDirector=null;
  this.devFlags={
   autoSpawnsDisabled:false,
   enemyAiFrozen:false,
   enemyMovementFrozen:false,
   enemyAttacksDisabled:false,
   championFrozen:false,
   championMovementFrozen:false,
   championAttacksDisabled:false,
   championSkillsDisabled:false,
   godMode:false,
   oneHitKill:false,
   infiniteMana:false,
   noCollision:false
  };

  // Build 1.2: functional mana + three combat skills.
  this.maxMana=3;
  this.mana=3;
  this.manaRegenMs=BALANCE.MANA_REGEN_MS;
  this.nextManaRegenAt=0;
  this.skillLockUntil=0;
 }

 create(){
  this.enemies=[];
  this.orbs=[];
  this.projectiles=[];
  this.hearts=[];
  this.kills=0;
  this.xp=0;
  this.level=1;
  this.wave=1;
  this.spawned=0;
  this.waveTarget=10;
  this.lastSpawn=0;
  this.mageSpawned=0;
  this.skeletonSpawned=0;
  this.shieldSpawned=0;
  this.championSpawned=0;
  this.gameOver=false;
  this.gameOverUiReady=false;
  this.deathSequenceActive=false;
  this.deathSword=null;
  this.deathFlipX=false;
  this.gameplayPauseReasons=new Set();
  this.gameplayPaused=false;
  this.levelChoiceOpen=false;
  this.levelChoiceObjects=[];
  this.currentLevelChoices=[];
  this.weaponLevels={sword:1};
  this.waveProfile=null;
  this.waveSpawnInterval=1050;
  this.waveIntermission=false;
  this.nextWaveAt=0;
  this.waveBannerObjects=[];
  this.lastPlayerHitAt=-9999;
  this.playerInvulnerableUntil=0;
  this.heartPityKills=0;
  this.lowHealthState='normal';
  this.lowHealthRatio=1;
  this.heartbeatTimer=null;
  this.heartbeatSound=null;
  this.lastSkeletonAttackSfxAt=-9999;
  this.lastMageCastSfxAt=-9999;
  this.heartbeatState=null;

  this.activeChampion=null;
  this.championEventActive=false;
  this.championRewardOpen=false;
  this.championRewardObjects=[];
  this.championHazards=[];
  this.relicZones=[];
  this.championRelics=new Set();
  this.nextSoulSkullAt=0;
  this.nextCursedGroundAt=0;
  this.killStreakBonus=0;
  this.lastShieldRelicBlockAt=-999999;
  this.fallenBlessingUsed=false;

  this.playerSlowUntil=0;
  this.playerSlowFactor=1;
  this.playerForcedUntil=0;
  this.playerForcedVX=0;
  this.playerForcedVY=0;

  this.mobileMoveX=0;
  this.mobileMoveY=0;
  this.mobileMovePointerId=null;
  this.mobileControls=[];
  this.isTouchDevice=Boolean(
   this.sys.game.device.input.touch ||
   (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
  );

  this.currentWorldZoneIndex=0;
  this.progressionBalanceZoneIndex=0;
  this.devRegionPopulationOverride=null;
  this.unlockedWorldGates=new Set();
  this.worldGateObjects=new Map();
  this.pendingWorldAdvance=null;
  this.awaitingWorldAdvance=false;
  this.worldAdvanceTargetZone=null;
  this.zoneBannerCooldownUntil=0;

  this.loadedWorldZones=new Map();
  this.loadedWorldPreviews=new Map();
  this.closedWorldGates=new Set();
  this.backtrackBlockers=[];
  this.lastStreamingZoneIndex=0;

  this.emptyScreenRushActive=false;

  this.devEnvironmentObjects=[];
  this.devEnvironmentShadows=[];
  this.devEnvironmentColliders=[];
  this.devFlags={
   autoSpawnsDisabled:false,
   enemyAiFrozen:false,
   enemyMovementFrozen:false,
   enemyAttacksDisabled:false,
   championFrozen:false,
   championMovementFrozen:false,
   championAttacksDisabled:false,
   championSkillsDisabled:false,
   godMode:false,
   oneHitKill:false,
   infiniteMana:false,
   noCollision:false
  };

  this.maxMana=3;
  this.mana=3;
  this.manaRegenMs=BALANCE.MANA_REGEN_MS;
  this.nextManaRegenAt=0;
  this.skillLockUntil=0;

  this.cameras.main.setBackgroundColor('#16120f');
  this.createSpriteAnimations();

  this.physics.world.setBounds(0,0,STAGE0.WORLD_WIDTH,STAGE0.WORLD_HEIGHT);

  // World Navigation v2: a coarse navigation grid sits above static world
  // colliders. It is rebuilt only when blockers change, never every frame.
  this.navigationCellSize=56;
  this.navigationClearance=20;
  this.navigationGrid=null;
  this.navigationGridDirty=true;
  this.navigationGridVersion=0;
  this.navigationPathfindBudget=0;

  // Stage 1 World Design prototype. These shapes are diagnostic placeholders,
  // not final environment art.
  this.worldGround=this.add.rectangle(
   STAGE0.WORLD_WIDTH/2,STAGE0.WORLD_HEIGHT/2,
   STAGE0.WORLD_WIDTH,STAGE0.WORLD_HEIGHT,0x151916,1
  ).setDepth(-110);

  this.createWorldDesignPrototype();

  this.enemyGroup=this.physics.add.group();

  this.player=this.add.circle(
   WORLD_DESIGN.START_X,WORLD_DESIGN.ROUTE_Y,16,0x33aaff,0
  );
  this.physics.add.existing(this.player);
  this.player.body.setCollideWorldBounds(true);
  this.player.hitRadius=16;
  this.player.maxHp=BALANCE.PLAYER_BASE_MAX_HP;
  this.player.hp=this.player.maxHp;
  this.updateLowHealthState(true);

  this.playerVisual=this.add.sprite(
   this.player.x,
   this.player.y,
   'hero_socket_walk_s_01'
  ).setOrigin(0.5,0.78).setScale(HERO_SOCKET_VISUAL_SCALE).setDepth(20);

  this.playerDir='down';
  this.playerVisualDir8='s';
  this.playerAttackDir='down';
  this.playerVisualState='hero_socket_idle_s';
  this.playerVisual.play(this.playerVisualState);
  this.playerAttackUntil=0;
  this.activeAttackFx=null;
  this.createHeroWeaponAttachment();
  this.updateHeroWeaponAttachment();

  this.createReadabilityLayers();

  this.meleeAttack=new HeroMelee(this,this.player);

  this.keys=this.input.keyboard.addKeys('W,A,S,D');
  this.cursors=this.input.keyboard.createCursorKeys();
  this.restartKey=this.input.keyboard.addKey(
   Phaser.Input.Keyboard.KeyCodes.R
  );
  this.skillKeys=this.input.keyboard.addKeys({
   skill1:Phaser.Input.Keyboard.KeyCodes.ONE,
   skill2:Phaser.Input.Keyboard.KeyCodes.TWO,
   skill3:Phaser.Input.Keyboard.KeyCodes.THREE
  });
  this.events.on('mobile-skill',this.handleSkillInput,this);

  this.hud=lkAddText(this,14,12,'',{fontSize:'18px',color:'#fff'})
   .setScrollFactor(0).setDepth(140).setAlpha(0);

  this.waveText=lkAddText(this,0,20,'WAVE 1',{fontSize:'24px',color:'#fff'})
   .setOrigin(0.5,0).setScrollFactor(0).setDepth(140).setAlpha(0);
  this.waveSubText=lkAddText(this,0,50,'',{fontSize:'13px',color:'#d9e6d6'})
   .setOrigin(0.5).setScrollFactor(0).setDepth(140).setAlpha(0);

  this.regionText=lkAddText(this,
   0,69,'ASH FIELDS',
   {fontSize:'12px',color:'#b9c2b6',stroke:'#101510',strokeThickness:2}
  ).setOrigin(0.5).setScrollFactor(0).setDepth(139).setAlpha(0);

  this.championNameText=lkAddText(this,
   400,72,'',
   {fontSize:'17px',color:'#ffe8a8',stroke:'#15100a',strokeThickness:3}
  ).setOrigin(0.5).setDepth(145).setScrollFactor(0).setVisible(false).setAlpha(0);

  this.championHpBack=this.add.rectangle(
   400,96,430,16,0x0b0b0b,0.82
  ).setDepth(144).setScrollFactor(0).setVisible(false).setAlpha(0);

  this.championHpFill=this.add.rectangle(
   187,96,426,10,0xd6aa52,1
  ).setOrigin(0,0.5).setDepth(145).setScrollFactor(0).setVisible(false).setAlpha(0);

  this.gameOverPanel=this.add.rectangle(
   400,300,430,170,0x000000,0.78
  ).setDepth(100).setScrollFactor(0).setVisible(false).setAlpha(0);

  this.gameOverText=lkAddText(this,
   400,300,
   '',
   {
    fontSize:'28px',
    color:'#ffffff',
    align:'center'
   }
  ).setOrigin(0.5).setDepth(101).setScrollFactor(0).setVisible(false).setAlpha(0);

  this.playerEnemyCollider=this.physics.add.collider(this.player,this.enemyGroup);
  this.playerAshCollider=this.physics.add.collider(this.player,this.ashLandmarkColliderGroup);
  this.enemyAshCollider=this.physics.add.collider(this.enemyGroup,this.ashLandmarkColliderGroup);

  // Enemy/enemy hard Arcade collision was intentionally removed in World Navigation v2.
  // A soft-separation pass keeps the crowd readable without creating rigid traffic jams.

  this.setupResponsiveWorldCamera();
  this.bindProgressionGateCollision();
  if(this.scene.isActive('HUDScene')) this.scene.stop('HUDScene');
  this.scene.launch('HUDScene',{mainScene:this});

  this.currentWorldZoneIndex=0;
  this.regionText.setText(WORLD_DESIGN.ZONES[0].name);
  this.updateWorldStreaming();

  // StoryDirector v1 owns story state, one-shot flags and declarative triggers.
  // STORY_EVENTS is intentionally empty in this build, so wiring the director
  // changes no current gameplay until story beats are explicitly authored.
  this.storyDirector=new StoryDirector(this,{events:STORY_EVENTS}).install();

  // Development-only Scene Tuner. The DEV build exposes it by button and F2.
  this.devTools=new LastKnightDevTools(this);
  this.devTools.install();

  this.scale.on('resize',this.handleViewportResize,this);
  this.scale.on('resize',this.syncOrientationPause,this);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
   this.scale.off('resize',this.handleViewportResize,this);
   this.scale.off('resize',this.syncOrientationPause,this);
   this.events.off('mobile-skill',this.handleSkillInput,this);
   this.gameplayPauseReasons?.clear();
   this.stopCriticalHeartbeat(true);
   try{this.physics.world.resume();}catch{}
   this.stopBrokenSaintHolyWarningSfx();
   this.clearChampionHazards();
   this.stopBrokenSaintMusic();
   this.stopBackgroundMusic();
   this.storyDirector?.destroy();
   this.storyDirector=null;
   this.devTools?.destroy();
   this.devTools=null;
  });

  this.setupBackgroundMusic();
  this.startWave(1,true);
  this.syncOrientationPause();
 }

 setupBackgroundMusic(){ return AudioManager.prototype.setupBackgroundMusic.call(this); }
 stopBackgroundMusic(){ return AudioManager.prototype.stopBackgroundMusic.call(this); }
 startBrokenSaintMusic(){ return AudioManager.prototype.startBrokenSaintMusic.call(this); }
 stopBrokenSaintMusic(){ return AudioManager.prototype.stopBrokenSaintMusic.call(this); }

 isPortraitInputBlocked(){
  if(typeof window==='undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse) and (orientation: portrait)').matches;
 }

 syncOrientationPause(){
  this.setGameplayPaused('orientation',this.isPortraitInputBlocked());
 }

 setGameplayPaused(reason,shouldPause){
  if(!reason) return;
  if(!this.gameplayPauseReasons) this.gameplayPauseReasons=new Set();

  if(shouldPause) this.gameplayPauseReasons.add(reason);
  else this.gameplayPauseReasons.delete(reason);

  const nextPaused=this.gameplayPauseReasons.size>0;
  if(nextPaused===this.gameplayPaused) return;
  this.gameplayPaused=nextPaused;

  if(nextPaused){
   this.physics.pause();
   this.time.paused=true;
   this.tweens.pauseAll();
  } else {
   this.time.paused=false;
   this.physics.resume();
   this.tweens.resumeAll();
  }
  this.syncCriticalHeartbeat();
 }

 getLowHealthState(){
  if(!this.player) return 'normal';
  const maxHp=Math.max(1,this.player.maxHp||100);
  const ratio=Phaser.Math.Clamp((this.player.hp||0)/maxHp,0,1);
  if(ratio<=LOW_HEALTH_CONFIG.DEATH_DOOR_THRESHOLD && ratio>0) return 'deathDoor';
  if(ratio<=LOW_HEALTH_CONFIG.CRITICAL_THRESHOLD && ratio>0) return 'critical';
  if(ratio<=LOW_HEALTH_CONFIG.LOW_THRESHOLD && ratio>0) return 'low';
  return 'normal';
 }

 updateLowHealthState(force=false){
  if(!this.player) return 'normal';
  const maxHp=Math.max(1,this.player.maxHp||100);
  const ratio=Phaser.Math.Clamp((this.player.hp||0)/maxHp,0,1);
  const nextState=this.getLowHealthState();
  const previous=this.lowHealthState||'normal';
  this.lowHealthRatio=ratio;
  if(force || nextState!==previous){
   this.lowHealthState=nextState;
   this.events.emit('healthStateChanged',nextState,previous,ratio);
  }
  this.syncCriticalHeartbeat();
  return nextState;
 }

 getHeartbeatIntervalMs(state=this.lowHealthState){
  if(state==='deathDoor') return LOW_HEALTH_CONFIG.HEARTBEAT_DEATH_DOOR_INTERVAL_MS;
  if(state==='critical') return LOW_HEALTH_CONFIG.HEARTBEAT_CRITICAL_INTERVAL_MS;
  return LOW_HEALTH_CONFIG.HEARTBEAT_LOW_INTERVAL_MS;
 }

 isHeartbeatHealthState(state=this.lowHealthState){
  return state==='low' || state==='critical' || state==='deathDoor';
 }

 playCriticalHeartbeatOnce(){
  if(this.gameOver || this.gameplayPaused || !this.isHeartbeatHealthState()) return;
  if(!this.sound || this.sound.locked || !this.cache.audio.exists('critical_heartbeat')) return;
  if(!this.heartbeatSound){
   this.heartbeatSound=this.sound.add('critical_heartbeat',{volume:LOW_HEALTH_CONFIG.HEARTBEAT_VOLUME});
  } else {
   this.heartbeatSound.setVolume(LOW_HEALTH_CONFIG.HEARTBEAT_VOLUME);
  }
  if(!this.heartbeatSound.isPlaying) this.heartbeatSound.play();
 }

 startCriticalHeartbeat(){
  if(this.gameOver || this.gameplayPaused || !this.isHeartbeatHealthState()) return;
  const state=this.lowHealthState;
  const delay=this.getHeartbeatIntervalMs(state);
  if(this.heartbeatTimer && this.heartbeatState===state) return;
  if(this.heartbeatTimer){
   this.heartbeatTimer.remove(false);
   this.heartbeatTimer=null;
  }
  this.heartbeatState=state;
  this.playCriticalHeartbeatOnce();
  this.heartbeatTimer=this.time.addEvent({
   delay,
   loop:true,
   callback:()=>this.playCriticalHeartbeatOnce()
  });
 }

 stopCriticalHeartbeat(destroySound=false){
  if(this.heartbeatTimer){
   this.heartbeatTimer.remove(false);
   this.heartbeatTimer=null;
  }
  this.heartbeatState=null;
  if(this.heartbeatSound){
   this.heartbeatSound.stop();
   if(destroySound){
    this.heartbeatSound.destroy();
    this.heartbeatSound=null;
  this.lastSkeletonAttackSfxAt=-9999;
   }
  }
 }

 syncCriticalHeartbeat(){
  if(this.isHeartbeatHealthState() && !this.gameOver && !this.gameplayPaused){
   this.startCriticalHeartbeat();
  } else {
   this.stopCriticalHeartbeat(false);
  }
 }

 spawnEnemy(forcedType=null,forcedPosition=null){
  const rawSpawn=forcedPosition || this.getSpawnPointAroundCamera(52);
  const spawn=this.findSafeEnemySpawnPoint(rawSpawn.x,rawSpawn.y,{padding:28,minPlayerDistance:120,maxRadius:420});

  let e=this.add.circle(
    spawn.x,
    spawn.y,
    14,
    0xcc3333
  );

  this.physics.add.existing(e);

  const livingMages=this.enemies.filter(
   enemy=>enemy.active && enemy.type==='mage'
  ).length;
  const livingShields=this.enemies.filter(
   enemy=>enemy.active && enemy.type==='shield'
  ).length;
  const mageEvery=(this.waveProfile && this.waveProfile.mageEvery) || 5;
  const shieldEvery=(this.waveProfile && this.waveProfile.shieldEvery) || 6;

  const isMage = forcedType
   ? forcedType==='mage'
   : (this.wave >= 3 &&
      (this.spawned % mageEvery === mageEvery-1) &&
      livingMages < 2);

  const isShield = forcedType
   ? forcedType==='shield'
   : (!isMage &&
      this.wave >= 4 &&
      (this.spawned % shieldEvery === shieldEvery-1) &&
      livingShields < 3);

  e.type = forcedType || (isMage ? 'mage' : (isShield ? 'shield' : 'skeleton'));

  if(isMage){
   e.setFillStyle(0x44ff66,0);
   e.hp=20 + this.wave*3;
   e.maxHp=e.hp;
   e.speed=72 + this.wave*3.3;
   e.hitRadius=14;

   e.visual=this.add.sprite(
    e.x,
    e.y,
    'mage_down_idle_00'
   ).setOrigin(0.5,0.80).setScale(0.5).setDepth(15);

   e.dir='down';
   e.attackDir='down';
   e.visualState='mage_down_idle';
   e.visual.play(e.visualState);

   this.mageSpawned++;
  } else if(isShield){
   e.setFillStyle(0x8799aa,0);
   e.hp=95 + this.wave*10;
   e.maxHp=e.hp;
   e.speed=72 + this.wave*2.8;
   e.blockNext=true;
   e.blockReadyAt=0;
   e.attackDamage=3.2;
   e.hitRadius=18;

   e.visual=this.add.sprite(
    e.x,
    e.y,
    'shield_down_idle_00'
   ).setOrigin(0.5,0.80).setScale(0.5).setDepth(15);

   e.dir='down';
   e.attackDir='down';
   e.visualState='shield_down_idle';
   e.visual.play(e.visualState);

   this.shieldSpawned++;
  } else {
   e.setFillStyle(0xcc3333,0);
   e.hp=30 + this.wave*5;
   e.maxHp=e.hp;
   e.speed=80 + this.wave*5;
   e.attackDamage=8;
   e.hitRadius=14;

   e.visual=this.add.sprite(
    e.x,
    e.y,
    'skeleton_down_walk_00'
   ).setOrigin(0.5,0.78).setScale(0.5).setDepth(15);

   e.dir='down';
   e.attackDir='down';
   e.visualState='skeleton_down_walk';
   e.visual.play(e.visualState);

   this.skeletonSpawned++;
  }

  e.lastAttack=0;
  e.lastShot=0;
  e.attackAnimUntil=0;
  e.staggerUntil=0;
  e.pendingMeleeHitAt=0;
  e.pendingMeleeDamage=0;
  e.pendingMeleeRange=0;
  e.knockbackVX=0;
  e.knockbackVY=0;
  e.visualBaseScale=e.visual ? e.visual.scaleX : 0.5;
  this.createEnemyReadabilityShadow(e);
  this.configureEnemyCollision(e,4);
  this.enemyGroup.add(e);
  this.enemies.push(e);
 }

 getChampionForWave(wave){
  return ({
   5:'brokenSaint',
   7:'necromancer',
   9:'shieldWarden',
   10:'hollowTree'
  })[wave] || null;
 }

 getChampionDefinition(kind){
  return ({
   brokenSaint:{name:'BROKEN SAINT',hp:520,speed:48,damage:12,hitRadius:34,crowdRadius:44,crowdKeepoutRadius:96,collisionPadding:10,scale:0.96,tint:0xffffff,rewardColor:'#ffe59a'},
   necromancer:{name:'THE SOUL HERALD',hp:640,speed:42,damage:10,hitRadius:24,scale:0.58,tint:0x78ff7c,rewardColor:'#7cff95'},
   shieldWarden:{name:'SHIELD WARDEN',hp:820,speed:38,damage:16,hitRadius:27,scale:0.62,tint:0xc9d0da,rewardColor:'#d9e1ea'},
   hollowTree:{name:'HOLLOW TREE',hp:1120,speed:0,damage:10,hitRadius:36,scale:0.72,tint:0x91b967,rewardColor:'#b8df85'}
  })[kind];
 }


 createReadabilityLayers(){
  this.playerGroundLight=this.add.ellipse(
   this.player.x,
   this.player.y+6,
   ASH_READABILITY.PLAYER_AURA_WIDTH,
   ASH_READABILITY.PLAYER_AURA_HEIGHT,
   0xf0d886,
   ASH_READABILITY.PLAYER_ROUTE_LIGHT_ALPHA
  ).setDepth(12);
  this.playerGroundLight.setBlendMode(Phaser.BlendModes.SCREEN);

  this.playerShadow=this.add.ellipse(
   this.player.x,
   this.player.y+12,
   ASH_READABILITY.PLAYER_SHADOW_WIDTH,
   ASH_READABILITY.PLAYER_SHADOW_HEIGHT,
   0x000000,
   0.34
  ).setDepth(19);
 }

 createEnemyReadabilityShadow(enemy){
  if(!enemy || enemy.shadowVisual) return;

  const r=enemy.hitRadius||14;
  const isMage=enemy.type==='mage';
  const width=isMage
   ? ASH_READABILITY.MAGE_SHADOW_WIDTH
   : Math.max(26,r*2.25);
  const height=isMage
   ? ASH_READABILITY.MAGE_SHADOW_HEIGHT
   : Math.max(12,r*1.02);
  const alpha=enemy.type==='champion'
   ? ASH_READABILITY.CHAMPION_SHADOW_ALPHA
   : (isMage ? ASH_READABILITY.MAGE_SHADOW_ALPHA : ASH_READABILITY.ENEMY_SHADOW_ALPHA);
  const yOffset=isMage
   ? ASH_READABILITY.MAGE_SHADOW_Y_OFFSET
   : (enemy.type==='shield' ? ASH_READABILITY.SHIELD_SHADOW_Y_OFFSET : r*0.82);

  enemy.shadowVisual=this.add.ellipse(
   enemy.x,
   enemy.y+yOffset,
   width,
   height,
   0x000000,
   alpha
  ).setDepth(enemy.type==='champion' ? 15 : 14);
 }

 destroyEnemyReadabilityShadow(enemy){
  if(enemy && enemy.shadowVisual && enemy.shadowVisual.active){
   enemy.shadowVisual.destroy();
  }
 }

 updateReadabilityLayers(){
  if(this.playerGroundLight && this.playerGroundLight.active){
   this.playerGroundLight.setPosition(this.player.x,this.player.y+8);
   const targetW=Math.max(250,(this.meleeAttack ? this.meleeAttack.radius*2.05 : 250));
   const targetH=Math.max(190,(this.meleeAttack ? this.meleeAttack.radius*1.55 : 190));
   this.playerGroundLight.width=targetW;
   this.playerGroundLight.height=targetH;
  }

  if(this.playerShadow && this.playerShadow.active){
   const playerShadowYOffset=this.playerVisualState==='hero_death'
    ? ASH_READABILITY.PLAYER_DEATH_SHADOW_Y_OFFSET
    : ASH_READABILITY.PLAYER_SHADOW_Y_OFFSET;
   this.playerShadow.setPosition(this.player.x,this.player.y+playerShadowYOffset);
  }
 }

 createWorldDesignPrototype(){
  this.worldZoneVisuals=[];
  this.worldLandmarkObjects=[];
  this.worldGateObjects=new Map();

  this.worldGateGroup=this.physics.add.staticGroup();
  this.ashLandmarkColliderGroup=this.physics.add.staticGroup();

  // Load only the starting biome. The next biome is streamed when the player
  // approaches its transition or when its champion is defeated.
  this.loadWorldZone(0);
  this.ensureProgressionGate(0);
  this.createBiomePreview(0);
 }

 getZoneStart(index){
  const zone=WORLD_DESIGN.ZONES[index];
  return zone ? zone.start : 0;
 }

 getZoneEnd(index){
  const zone=WORLD_DESIGN.ZONES[index];
  return zone ? zone.end : STAGE0.WORLD_WIDTH;
 }

 getZoneTravelProgress(index=this.currentWorldZoneIndex){
  const zone=WORLD_DESIGN.ZONES[index];
  if(!zone) return 0;

  const entryX=index===0 ? WORLD_DESIGN.START_X : zone.start;
  const exitX=zone.end;
  return Phaser.Math.Clamp(
   (this.player.x-entryX)/Math.max(1,exitX-entryX),
   0,
   1
  );
 }


 artNoise(seed){
  const raw=Math.sin(seed*12.9898+78.233)*43758.5453123;
  return raw-Math.floor(raw);
 }




 markNavigationDirty(){ return NavigationSystem.prototype.markNavigationDirty.call(this); }
 ensureNavigationGrid(){ return NavigationSystem.prototype.ensureNavigationGrid.call(this); }
 rebuildNavigationGrid(){ return NavigationSystem.prototype.rebuildNavigationGrid.call(this); }
 worldToNavCell(x,y){ return NavigationSystem.prototype.worldToNavCell.call(this,x,y); }
 navCellToWorld(col,row){ return NavigationSystem.prototype.navCellToWorld.call(this,col,row); }
 isNavCellWalkable(col,row){ return NavigationSystem.prototype.isNavCellWalkable.call(this,col,row); }
 findNearestWalkableNavCell(col,row,maxRadius=10){ return NavigationSystem.prototype.findNearestWalkableNavCell.call(this,col,row,maxRadius); }
 isNavigationLineBlocked(x1,y1,x2,y2){ return NavigationSystem.prototype.isNavigationLineBlocked.call(this,x1,y1,x2,y2); }
 findNavigationPath(startX,startY,targetX,targetY,enemy=null,maxVisited=3200){ return NavigationSystem.prototype.findNavigationPath.call(this,startX,startY,targetX,targetY,enemy,maxVisited); }
 updateEnemyStuckState(enemy,time,intendedSpeed){ return NavigationSystem.prototype.updateEnemyStuckState.call(this,enemy,time,intendedSpeed); }
 getEnemyNavigationWaypoint(enemy,time,targetX,targetY,radius){ return NavigationSystem.prototype.getEnemyNavigationWaypoint.call(this,enemy,time,targetX,targetY,radius); }
 applyEnemySoftSeparation(time){ return NavigationSystem.prototype.applyEnemySoftSeparation.call(this,time); }
 findSafeNavSpawnPoint(x,y,options={}){ return NavigationSystem.prototype.findSafeNavSpawnPoint.call(this,x,y,options); }

 getAshPropPhysicsClass(prop,kind='grass'){
  if(kind==='landmark') return 'blocking';
  if(kind==='grass') return 'decorative';

  const displayW=Math.max(1,prop?.displayWidth||0);
  const displayH=Math.max(1,prop?.displayHeight||0);

  // Trees are meaningful silhouettes and always block movement. Tiny rock chips
  // remain decorative so combat lanes do not become cluttered with invisible walls.
  if(kind==='tree') return 'blocking';
  if(kind==='rock') return (displayW<70 && displayH<40) ? 'decorative' : 'blocking';
  return 'decorative';
 }

 isAshCircleBlocked(x,y,radius=0){
  if(!this.ashLandmarkColliderGroup) return false;
  for(const blocker of this.ashLandmarkColliderGroup.getChildren()){
   if(!blocker?.active || !blocker.body || blocker.body.enable===false) continue;
   const b=this.getAshBlockerBounds(blocker,0);
   if(!b) continue;
   const nearestX=Phaser.Math.Clamp(x,b.left,b.right);
   const nearestY=Phaser.Math.Clamp(y,b.top,b.bottom);
   const dx=x-nearestX;
   const dy=y-nearestY;
   if(dx*dx+dy*dy<=radius*radius) return true;
  }
  return false;
 }

 isAshPathBlocked(x1,y1,x2,y2,radius=0){
  if(!this.ashLandmarkColliderGroup) return false;
  const dx=x2-x1;
  const dy=y2-y1;
  const distance=Math.hypot(dx,dy);
  const step=Math.max(8,Math.min(20,radius||12));
  const samples=Math.max(1,Math.ceil(distance/step));
  for(let i=1;i<=samples;i++){
   const t=i/samples;
   if(this.isAshCircleBlocked(x1+dx*t,y1+dy*t,radius)) return true;
  }
  return false;
 }

 isSafeEnemySpawnPoint(x,y,padding=26,minPlayerDistance=120){
  const px=this.clampWorldX(x,padding+6);
  const py=this.clampWorldY(y,padding+6);
  if(this.isAshCircleBlocked(px,py,padding)) return false;

  if(this.player?.active){
   const d=Phaser.Math.Distance.Between(px,py,this.player.x,this.player.y);
   if(d<minPlayerDistance) return false;
  }

  for(const other of (this.enemies||[])){
   if(!other?.active || other.hp<=0) continue;
   const minDist=padding+(other.hitRadius||14)+10;
   if(Phaser.Math.Distance.Between(px,py,other.x,other.y)<minDist) return false;
  }
  return true;
 }

 findSafeEnemySpawnPoint(x,y,{padding=26,minPlayerDistance=120,searchStep=30,maxRadius=360}={}){
  const startX=this.clampWorldX(x,padding+6);
  const startY=this.clampWorldY(y,padding+6);
  const startCell=this.worldToNavCell(startX,startY);
  if(this.isNavCellWalkable(startCell.col,startCell.row) && this.isSafeEnemySpawnPoint(startX,startY,padding,minPlayerDistance)){
   return {x:startX,y:startY};
  }

  const navPoint=this.findSafeNavSpawnPoint(startX,startY,{padding,minPlayerDistance,maxRadius});
  if(navPoint) return navPoint;

  // Last-resort geometric fallback for malformed/debug-edited navigation layouts.
  return this.findNearestFreeGroundPoint(startX,startY,searchStep,maxRadius,padding);
 }

 setEnemySteeredVelocity(enemy,vx,vy,time){
  if(!enemy?.body){return;}
  if(this.devFlags?.noCollision){enemy.body.setVelocity(vx,vy);return;}

  const speed=Math.hypot(vx,vy);
  if(speed<1){enemy.body.setVelocity(0,0);return;}
  this.updateEnemyStuckState(enemy,time,speed);

  const radius=(enemy.hitRadius||14)+5;
  let desiredAngle=Math.atan2(vy,vx);
  const toPlayerX=(this.player?.x??enemy.x)-enemy.x;
  const toPlayerY=(this.player?.y??enemy.y)-enemy.y;
  const towardPlayer=(vx*toPlayerX+vy*toPlayerY)>0;

  // Global A* routing is used only while pursuing the player. Retreating mages
  // keep their direct/local-steering behaviour and do not try to path back toward him.
  if(towardPlayer && this.player?.active){
   const waypoint=this.getEnemyNavigationWaypoint(enemy,time,this.player.x,this.player.y,radius);
   if(waypoint){
    desiredAngle=Phaser.Math.Angle.Between(enemy.x,enemy.y,waypoint.x,waypoint.y);
   }
  }

  const probeDistance=Math.max(34,radius*1.55+speed*0.16);
  const probeX=enemy.x+Math.cos(desiredAngle)*probeDistance;
  const probeY=enemy.y+Math.sin(desiredAngle)*probeDistance;

  if(!this.isAshPathBlocked(enemy.x,enemy.y,probeX,probeY,radius)){
   enemy.obstacleSteerUntil=0;
   enemy.body.setVelocity(Math.cos(desiredAngle)*speed,Math.sin(desiredAngle)*speed);
   return;
  }

  if(!enemy.obstacleTurnSign || time>=(enemy.obstacleSteerUntil||0)){
   const leftAngle=desiredAngle-Math.PI*0.38;
   const rightAngle=desiredAngle+Math.PI*0.38;
   const leftBlocked=this.isAshPathBlocked(enemy.x,enemy.y,enemy.x+Math.cos(leftAngle)*probeDistance,enemy.y+Math.sin(leftAngle)*probeDistance,radius);
   const rightBlocked=this.isAshPathBlocked(enemy.x,enemy.y,enemy.x+Math.cos(rightAngle)*probeDistance,enemy.y+Math.sin(rightAngle)*probeDistance,radius);
   if(leftBlocked!==rightBlocked) enemy.obstacleTurnSign=leftBlocked?1:-1;
   else {
    const target=enemy.navPath?.[enemy.navPathIndex||0]||this.player;
    const leftD=Phaser.Math.Distance.Squared(enemy.x+Math.cos(leftAngle)*probeDistance,enemy.y+Math.sin(leftAngle)*probeDistance,target.x,target.y);
    const rightD=Phaser.Math.Distance.Squared(enemy.x+Math.cos(rightAngle)*probeDistance,enemy.y+Math.sin(rightAngle)*probeDistance,target.x,target.y);
    enemy.obstacleTurnSign=leftD<=rightD?-1:1;
   }
   enemy.obstacleSteerUntil=time+300;
  }

  const sign=enemy.obstacleTurnSign||1;
  const turns=[0.28,0.42,0.58,0.74,0.92,1.0];
  for(const fraction of turns){
   for(const direction of [sign,-sign]){
    const angle=desiredAngle+direction*Math.PI*fraction;
    const tx=enemy.x+Math.cos(angle)*probeDistance;
    const ty=enemy.y+Math.sin(angle)*probeDistance;
    if(this.isAshPathBlocked(enemy.x,enemy.y,tx,ty,radius)) continue;
    enemy.obstacleTurnSign=direction;
    enemy.body.setVelocity(Math.cos(angle)*speed,Math.sin(angle)*speed);
    return;
   }
  }

  // Hard stop only as a last resort; the stuck detector will force a fresh A* path.
  enemy.navForceRepath=true;
  enemy.navNextRepathAt=0;
  enemy.body.setVelocity(0,0);
 }

 createAshLandmarkBlocker(objects,x,y,width,height,name){
  const blocker=this.add.zone(x,y,width,height);
  blocker.ashLandmarkName=name;
  this.ashLandmarkColliderGroup.add(blocker);
  if(blocker.body){
   blocker.body.setSize(width,height);
   blocker.body.updateFromGameObject();
  }
  objects.push(blocker);
  this.devEnvironmentColliders.push(blocker);
  this.markNavigationDirty();
  return blocker;
 }

 getAshBlockerBounds(blocker,padding=0){
  if(!blocker || !blocker.body) return null;
  const body=blocker.body;
  const left=('left' in body) ? body.left : blocker.x-body.width*0.5;
  const right=('right' in body) ? body.right : blocker.x+body.width*0.5;
  const top=('top' in body) ? body.top : blocker.y-body.height*0.5;
  const bottom=('bottom' in body) ? body.bottom : blocker.y+body.height*0.5;
  return {left:left-padding,right:right+padding,top:top-padding,bottom:bottom+padding};
 }

 isPointInsideAshBlocker(x,y,padding=0){
  if(!this.ashLandmarkColliderGroup) return false;
  for(const blocker of this.ashLandmarkColliderGroup.getChildren()){
   if(!blocker?.active || !blocker.body) continue;
   const b=this.getAshBlockerBounds(blocker,padding);
   if(!b) continue;
   if(x>=b.left && x<=b.right && y>=b.top && y<=b.bottom) return true;
  }
  return false;
 }

 findNearestFreeGroundPoint(x,y,searchStep=26,maxRadius=220,padding=14){
  const startX=this.clampWorldX(x,28);
  const startY=this.clampWorldY(y,28);
  if(!this.isPointInsideAshBlocker(startX,startY,padding)) return {x:startX,y:startY};
  for(let radius=searchStep;radius<=maxRadius;radius+=searchStep){
   for(let i=0;i<24;i++){
    const angle=(Math.PI*2*i)/24;
    const px=this.clampWorldX(startX+Math.cos(angle)*radius,28);
    const py=this.clampWorldY(startY+Math.sin(angle)*radius,28);
    if(!this.isPointInsideAshBlocker(px,py,padding)) return {x:px,y:py};
   }
  }
  return {x:startX,y:startY};
 }

 
addAshLandmarkCollision(objects,landmark,key){
 landmark.worldPhysicsClass='blocking';
 landmark.devLinkedColliders=[];
 const displayW=Math.max(1,landmark.displayWidth);
 const displayH=Math.max(1,landmark.displayHeight);
 const x=landmark.x;
 const y=landmark.y;

 const shapes={
  ash_landmark_sword:[
   {dx:0,dy:displayH*0.24,w:displayW*0.78,h:Math.max(44,displayH*0.30),name:'base'},
   {dx:displayW*0.02,dy:-displayH*0.07,w:displayW*0.18,h:Math.max(90,displayH*0.56),name:'blade'},
   {dx:displayW*0.18,dy:-displayH*0.30,w:displayW*0.20,h:Math.max(34,displayH*0.12),name:'hilt'}
  ],
  ash_landmark_altar:[
   {dx:0,dy:displayH*0.15,w:displayW*0.74,h:Math.max(40,displayH*0.30),name:'base'},
   {dx:-displayW*0.22,dy:-displayH*0.10,w:displayW*0.20,h:Math.max(36,displayH*0.32),name:'left_mass'},
   {dx:displayW*0.22,dy:-displayH*0.08,w:displayW*0.20,h:Math.max(34,displayH*0.28),name:'right_mass'},
   {dx:0,dy:-displayH*0.24,w:displayW*0.48,h:Math.max(28,displayH*0.20),name:'crown'}
  ]
 };

 for(const shape of (shapes[key]||[])){
  landmark.devLinkedColliders.push(
   this.createAshLandmarkBlocker(objects,x+shape.dx,y+shape.dy,shape.w,shape.h,key+'_'+shape.name)
  );
 }
}

createAshPropShadow(objects,prop,kind){
  if(kind==='grass') return;
  const displayW=Math.max(1,prop.displayWidth);
  const displayH=Math.max(1,prop.displayHeight);
  const isLarge=(kind==='tree' ? displayH>=150 : displayW>=95);

  // Build 1.3.14.2: readable contact shadow. Still restrained, but large props
  // now visibly sit on the ground instead of looking pasted onto the tile.
  const shadowW=displayW*(kind==='tree' ? (isLarge?0.98:0.80) : (isLarge?1.02:0.84));
  const shadowH=Math.max(10,displayH*(kind==='tree' ? (isLarge?0.16:0.11) : (isLarge?0.22:0.15)));
  const shadowX=prop.x+displayW*(isLarge?0.035:0.02);
  const shadowY=prop.y+displayH*(kind==='tree' ? 0.43 : 0.35);
  const outerAlpha=kind==='tree' ? (isLarge?0.31:0.23) : (isLarge?0.29:0.21);

  const shadow=this.add.ellipse(shadowX,shadowY,shadowW,shadowH,0x0a0807,outerAlpha)
   .setDepth(-45);
  const core=this.add.ellipse(
   shadowX-displayW*0.02,
   shadowY+Math.max(1,displayH*0.008),
   shadowW*(kind==='tree'?0.72:0.78),
   Math.max(7,shadowH*0.54),
   0x000000,
   outerAlpha*0.62
  ).setDepth(-45);
  objects.push(shadow,core);
  prop.devLinkedShadows=[shadow,core];
  this.devEnvironmentShadows.push(shadow,core);
  return prop.devLinkedShadows;
 }

 addAshPropCollision(objects,prop,kind,key){
  prop.devLinkedColliders=[];
  prop.worldPhysicsClass=this.getAshPropPhysicsClass(prop,kind);
  if(prop.worldPhysicsClass!=='blocking') return;
  const displayW=Math.max(1,prop.displayWidth);
  const displayH=Math.max(1,prop.displayHeight);
  const isLarge=(kind==='tree' ? displayH>=150 : displayW>=95);

  if(isLarge){
   // Large scenery is a real obstacle now. One broad base collider plus a tall
   // vertical body collider prevents the hero from walking through the visual.
   // The vertical collider deliberately reaches through almost the full visible
   // height while staying narrower than the transparent sprite bounds.
   if(kind==='tree'){
    const baseW=displayW*0.68;
    const baseH=Math.max(30,displayH*0.24);
    const baseY=prop.y+displayH*0.36;
    prop.devLinkedColliders.push(this.createAshLandmarkBlocker(objects,prop.x,baseY,baseW,baseH,key+'_base'));

    const verticalW=displayW*0.54;
    const verticalH=Math.max(80,displayH*0.82);
    const verticalY=prop.y-displayH*0.015;
    prop.devLinkedColliders.push(this.createAshLandmarkBlocker(objects,prop.x,verticalY,verticalW,verticalH,key+'_vertical'));
   }else{
    const baseW=displayW*0.94;
    const baseH=Math.max(28,displayH*0.38);
    const baseY=prop.y+displayH*0.27;
    prop.devLinkedColliders.push(this.createAshLandmarkBlocker(objects,prop.x,baseY,baseW,baseH,key+'_base'));

    const verticalW=displayW*0.82;
    const verticalH=Math.max(54,displayH*0.78);
    const verticalY=prop.y-displayH*0.015;
    prop.devLinkedColliders.push(this.createAshLandmarkBlocker(objects,prop.x,verticalY,verticalW,verticalH,key+'_vertical'));
   }
   return;
  }

  // Smaller rocks / trees keep a forgiving footprint so the route does not feel cramped.
  const width=displayW*(kind==='tree'?0.42:0.72);
  const height=Math.max(20,displayH*(kind==='tree'?0.16:0.28));
  const y=prop.y+displayH*(kind==='tree'?0.39:0.31);
  prop.devLinkedColliders.push(this.createAshLandmarkBlocker(objects,prop.x,y,width,height,key));
 }

 
createAshLandmarkShadow(objects,landmark,key){
 const displayW=Math.max(1,landmark.displayWidth);
 const displayH=Math.max(1,landmark.displayHeight);
 const isSword=key==='ash_landmark_sword';
 const shadowX=landmark.x+displayW*(isSword?0.02:0.01);
 const shadowY=landmark.y+displayH*(isSword?0.28:0.24);
 const shadowW=displayW*(isSword?0.76:0.84);
 const shadowH=Math.max(24,displayH*(isSword?0.14:0.18));
 const outerAlpha=isSword?0.33:0.28;

 const outer=this.add.ellipse(shadowX,shadowY,shadowW,shadowH,0x090706,outerAlpha)
  .setDepth(-29);
 const core=this.add.ellipse(
  shadowX-displayW*0.018,
  shadowY+displayH*0.01,
  shadowW*0.72,
  shadowH*0.50,
  0x000000,
  outerAlpha*0.62
 ).setDepth(-29);
 objects.push(outer,core);
 landmark.devLinkedShadows=[outer,core];
 this.devEnvironmentShadows.push(outer,core);
 return landmark.devLinkedShadows;
}

createAshCluster(objects,anchorX,anchorY,clusterKey,segmentId='ash',instanceIndex=0){
 const items=ASH_FIELDS_CLUSTER_LIBRARY[clusterKey]||[];
 items.forEach((item,itemIndex)=>{
  if(!this.textures.exists(item.key)) return;
  const sprite=this.add.image(anchorX+item.ox,anchorY+item.oy,item.key)
   .setDepth(item.kind==='grass'?-46:-44)
   .setScale(item.scale)
   .setAlpha(item.alpha ?? 1)
   .setRotation(item.rotation ?? 0);
  if(item.flipX) sprite.setFlipX(true);
  objects.push(sprite);
  this.createAshPropShadow(objects,sprite,item.kind);
  this.addAshPropCollision(objects,sprite,item.kind,item.key);
  this.registerDevEnvironmentObject(sprite,{
   id:`${segmentId}:cluster${instanceIndex}:item${itemIndex}`,
   segment:segmentId,cluster:clusterKey,kind:item.kind,key:item.key,landmark:false
  });
 });
}


createAshFieldsBakedLayout(objects){
 const entries=Object.entries(ASH_FIELDS_BAKED_LAYOUT.objects||{});
 for(const [id,state] of entries){
  if(!state || state.deleted || !this.textures.exists(state.key)) continue;
  const kind=state.kind || (state.key?.includes('tree_')?'tree':state.key?.includes('rock_')?'rock':state.key?.includes('landmark_')?'landmark':'grass');
  const landmark=Boolean(state.landmark)||kind==='landmark';
  const prop=this.add.image(state.x,state.y,state.key)
   .setDepth(landmark?-28:(kind==='grass'?-46:-44))
   .setScale(Math.max(0.01,Number(state.scale)||1))
   .setAlpha(state.alpha??(kind==='grass'?0.40:0.96))
   .setRotation(state.rotation??0);
  if(state.flipX) prop.setFlipX(true);
  objects.push(prop);
  if(landmark){
   this.createAshLandmarkShadow(objects,prop,state.key);
   this.worldLandmarkObjects.push(prop);
   this.addAshLandmarkCollision(objects,prop,state.key);
  }else{
   this.createAshPropShadow(objects,prop,kind);
   this.addAshPropCollision(objects,prop,kind,state.key);
  }
  this.registerDevEnvironmentObject(prop,{
   id,segment:state.segment||'ash',cluster:null,kind,key:state.key,landmark,created:false
  });
 }
}


createAshFieldsSegment(objects,segment){
 (segment.clusters||[]).forEach((instance,instanceIndex)=>{
  this.createAshCluster(objects,instance.x,instance.y,instance.cluster,segment.id,instanceIndex);
 });

 (segment.landmarks||[]).forEach(({key,x,y,scale,rotation},landmarkIndex)=>{
  if(!this.textures.exists(key)) return;
  const landmark=this.add.image(x,y,key)
   .setDepth(-28)
   .setScale(scale)
   .setRotation(rotation)
   .setAlpha(0.98);

  this.createAshLandmarkShadow(objects,landmark,key);
  objects.push(landmark);
  this.worldLandmarkObjects.push(landmark);
  this.addAshLandmarkCollision(objects,landmark,key);
  this.registerDevEnvironmentObject(landmark,{
   id:`${segment.id}:landmark${landmarkIndex}`,segment:segment.id,cluster:null,kind:'landmark',key,landmark:true
  });
 });
}

registerDevEnvironmentObject(object,meta){
 if(!object) return;
 object.devEnvMeta={...meta};
 object.devInitialState={
  x:object.x,y:object.y,scaleX:object.scaleX,scaleY:object.scaleY,rotation:object.rotation,
  alpha:object.alpha,flipX:Boolean(object.flipX),visible:object.visible,deleted:false
 };
 const baseScale=Math.max(0.0001,Math.abs(object.scaleX||1));
 const capture=(link,type)=>{
  if(!link) return;
  link.devOwnerId=meta.id;
  link.devLinkBase={
   type,dx:link.x-object.x,dy:link.y-object.y,
   displayWidth:Math.max(1,link.displayWidth||link.width||1),
   displayHeight:Math.max(1,link.displayHeight||link.height||1),
   ownerScale:baseScale
  };
 };
 (object.devLinkedShadows||[]).forEach(link=>capture(link,'shadow'));
 (object.devLinkedColliders||[]).forEach(link=>capture(link,'collider'));
 this.devEnvironmentObjects.push(object);
 if(this.devTools?.applySavedOverrideToObject) this.devTools.applySavedOverrideToObject(object);
}

updateDevEnvironmentLinks(object){
 if(!object?.devInitialState) return;
 const factor=Math.max(0.02,Math.abs(object.scaleX||1)/Math.max(0.0001,Math.abs(object.devInitialState.scaleX||1)));
 const update=(link)=>{
  if(!link?.devLinkBase) return;
  const b=link.devLinkBase;
  link.setPosition(object.x+b.dx*factor,object.y+b.dy*factor);
  const w=Math.max(1,b.displayWidth*factor),h=Math.max(1,b.displayHeight*factor);
  if(b.type==='collider'){
   if(link.setSize) link.setSize(w,h);
   if(link.body){link.body.setSize(w,h);link.body.updateFromGameObject();}
  }else if(link.setDisplaySize){
   link.setDisplaySize(w,h);
  }else{
   link.width=w;link.height=h;
  }
 };
 (object.devLinkedShadows||[]).forEach(update);
 (object.devLinkedColliders||[]).forEach(update);
 this.markNavigationDirty?.();
}

createAshWoundedKnights(objects){
 const placements=[
  {type:1,x:620,y:1080,flipX:false,delay:0},
  {type:2,x:1120,y:850,flipX:true,delay:210},
  {type:3,x:1480,y:1180,flipX:false,delay:430},
  {type:1,x:2700,y:800,flipX:true,delay:650},
  {type:2,x:2860,y:1320,flipX:false,delay:880},
  {type:3,x:3750,y:760,flipX:true,delay:1120}
 ];

 const heroSource=this.textures.get('hero_socket_walk_s_01').getSourceImage();
 const heroDisplayHeight=(heroSource?.height||224)*HERO_SOCKET_VISUAL_SCALE;
 const targetWoundedHeight=heroDisplayHeight*1.25;
 // Breathing frames are aligned on a larger transparent canvas so the body
 // stays anchored while only the chest visibly expands/contracts.
 const woundedArtReferenceSize=440;
 const woundedScale=targetWoundedHeight/woundedArtReferenceSize;
 const woundedVisualSize=woundedArtReferenceSize*woundedScale;

 placements.forEach((placement,index)=>{
  const type=String(placement.type).padStart(2,'0');
  const texture=`ash_wounded_knight_${type}_00`;
  if(!this.textures.exists(texture)) return;

  const knight=this.add.sprite(placement.x,placement.y,texture)
   .setOrigin(280/540,403.2/540)
   .setScale(woundedScale)
   .setDepth(12)
   .setFlipX(Boolean(placement.flipX));

  objects.push(knight);
  knight.play({
   key:`ash_wounded_knight_${type}_breathe`,
   startFrame:index%3,
   delay:placement.delay||0,
   repeat:-1
  });

  // The collider covers the body, not the nearby weapon/blood. It is static and
  // joins the same blocker group used by player collision, enemy A* and projectiles.
  const colliderW=Math.max(46,woundedVisualSize*(placement.type===1?0.62:0.70));
  const colliderH=Math.max(24,woundedVisualSize*(placement.type===1?0.34:0.30));
  const collider=this.createAshLandmarkBlocker(
   objects,
   knight.x,
   knight.y+woundedVisualSize*0.08,
   colliderW,
   colliderH,
   `ash_wounded_knight_${type}_${index}`
  );
  knight.devLinkedColliders=[collider];

  this.registerDevEnvironmentObject(knight,{
   id:`ash:wounded_knight:${index}`,
   segment:'ash',
   cluster:null,
   kind:'wounded_knight',
   key:texture,
   landmark:false,
   created:false
  });
 });
}

createAshFieldsEnvironment(objects,zone){
  const width=zone.end-zone.start;

  // Minimal Ash Fields ground: one plain base plus four directional edges.
  // The approved art repeats cleanly in its native orientation.
  // Do not mirror or flip tiles here: cropped + flipped edge tiles produced
  // the black lower-right gap and the horizontal seam in the lower-left area.
  const baseTexture=this.textures.get('ash_ground_base_01').getSourceImage();
  const tileW=baseTexture.width;
  const tileH=baseTexture.height;

  const cols=Math.ceil(width/tileW);
  const rows=Math.ceil(STAGE0.WORLD_HEIGHT/tileH);

  for(let row=0;row<rows;row++){
   for(let col=0;col<cols;col++){
    const x=zone.start+col*tileW;
    const y=row*tileH;
    const cropW=Math.min(tileW,zone.end-x);
    const cropH=Math.min(tileH,STAGE0.WORLD_HEIGHT-y);
    if(cropW<=0||cropH<=0) continue;

    const tile=this.add.image(x,y,'ash_ground_base_01')
     .setOrigin(0,0)
     .setDepth(-110);

    if(cropW<tileW||cropH<tileH){
     tile.setCrop(0,0,cropW,cropH);
    }
    objects.push(tile);
   }
  }

  const northTexture=this.textures.get('ash_edge_north_01').getSourceImage();
  const southTexture=this.textures.get('ash_edge_south_01').getSourceImage();
  const westTexture=this.textures.get('ash_edge_west_01').getSourceImage();
  const eastTexture=this.textures.get('ash_edge_east_01').getSourceImage();

  // North/south repeat horizontally without mirroring.
  const edgeCols=Math.ceil(width/northTexture.width);
  for(let col=0;col<edgeCols;col++){
   const x=zone.start+col*northTexture.width;
   const cropW=Math.min(northTexture.width,zone.end-x);
   if(cropW<=0) continue;

   const north=this.add.image(x,0,'ash_edge_north_01')
    .setOrigin(0,0).setDepth(-104);
   const south=this.add.image(x,STAGE0.WORLD_HEIGHT,'ash_edge_south_01')
    .setOrigin(0,1).setDepth(-104);
   if(cropW<northTexture.width){
    north.setCrop(0,0,cropW,northTexture.height);
    south.setCrop(0,0,cropW,southTexture.height);
   }
   objects.push(north,south);
  }

  // West/east repeat vertically without mirroring.
  const edgeRows=Math.ceil(STAGE0.WORLD_HEIGHT/westTexture.height);
  for(let row=0;row<edgeRows;row++){
   const y=row*westTexture.height;
   const cropH=Math.min(westTexture.height,STAGE0.WORLD_HEIGHT-y);
   if(cropH<=0) continue;

   const west=this.add.image(zone.start,y,'ash_edge_west_01')
    .setOrigin(0,0).setDepth(-103);
   const east=this.add.image(zone.end,y,'ash_edge_east_01')
    .setOrigin(1,0).setDepth(-103);
   if(cropH<westTexture.height){
    west.setCrop(0,0,westTexture.width,cropH);
    east.setCrop(0,0,eastTexture.width,cropH);
   }
   objects.push(west,east);
  }



 // Approved editor composition: exact baked positions/scales/alpha/flip for all Ash Fields props.
 // Segment definitions remain above for travel/editor grouping, but scenery itself comes from
 // ASH_FIELDS_BAKED_LAYOUT so manually adjusted individual props are preserved exactly.
 this.createAshFieldsBakedLayout(objects);
 this.createAshWoundedKnights(objects);
}



 loadWorldZone(index){
  if(index<0 || index>=WORLD_DESIGN.ZONES.length) return;
  if(this.loadedWorldZones.has(index)) return;

  const zone=WORLD_DESIGN.ZONES[index];
  const objects=[];

  if(index===0){
   this.createAshFieldsEnvironment(objects,zone);
  }

  // Until a biome receives approved art, keep its streamed chunk visually empty.
  // This prevents deleted/rejected prototype tiles and diagnostic markers from
  // appearing on the game field while preserving progression/gameplay systems.
  this.loadedWorldZones.set(index,objects);
  this.markNavigationDirty();

  if(index<WORLD_DESIGN.GATES.length){
   this.ensureProgressionGate(index);
   this.createBiomePreview(index);
  }
 }
 unloadWorldZone(index){
  if(index<0 || index>=WORLD_DESIGN.ZONES.length) return;
  if(index>=this.currentWorldZoneIndex) return;

  const objects=this.loadedWorldZones.get(index);
  if(objects){
   for(const obj of objects){
    if(obj && obj.active) obj.destroy();
   }
   this.loadedWorldZones.delete(index);
   this.markNavigationDirty();
  }

  const preview=this.loadedWorldPreviews.get(index);
  if(preview){
   for(const obj of preview){
    if(obj && obj.active) obj.destroy();
   }
   this.loadedWorldPreviews.delete(index);
  }
 }

 createBiomePreview(fromIndex){
  if(fromIndex<0 || fromIndex>=WORLD_DESIGN.ZONES.length-1) return;
  if(this.loadedWorldPreviews.has(fromIndex)) return;

  // No preview art is drawn until approved transition assets exist on disk.
  this.loadedWorldPreviews.set(fromIndex,[]);
 }
 ensureProgressionGate(index){
  if(index<0 || index>=WORLD_DESIGN.GATES.length) return;

  const gate=WORLD_DESIGN.GATES[index];
  if(this.worldGateObjects.has(gate.id)) return;

  const blocker=this.add.rectangle(
   gate.x,
   STAGE0.WORLD_HEIGHT/2,
   34,
   STAGE0.WORLD_HEIGHT,
   gate.color,
   0.04
  ).setDepth(-20);

  this.physics.add.existing(blocker,true);
  this.worldGateGroup.add(blocker);

  const visible=this.add.rectangle(
   gate.x,
   WORLD_DESIGN.ROUTE_Y,
   38,
   820,
   gate.color,
   0.16
  ).setStrokeStyle(3,gate.color,0.62).setDepth(-19);

  const label=lkAddText(this,
   gate.x-28,
   WORLD_DESIGN.ROUTE_Y-350,
   `LOCKED\n${gate.name}`,
   {
    fontSize:'15px',
    align:'right',
    color:'#f3ead4',
    stroke:'#121612',
    strokeThickness:3
   }
  ).setOrigin(1,0.5).setDepth(-18);

  this.worldGateObjects.set(gate.id,{
   gate,
   blocker,
   visible,
   label,
   unlocked:false
  });
 }

 createBacktrackSeal(gate){
  if(!gate || this.closedWorldGates.has(gate.id)) return;

  this.closedWorldGates.add(gate.id);

  const x=gate.x+120;
  const blocker=this.add.rectangle(
   x,
   STAGE0.WORLD_HEIGHT/2,
   42,
   STAGE0.WORLD_HEIGHT,
   gate.color,
   0.08
  ).setDepth(-16);

  this.physics.add.existing(blocker,true);
  this.worldGateGroup.add(blocker);

  const curtain=this.add.rectangle(
   x-170,
   STAGE0.WORLD_HEIGHT/2,
   360,
   STAGE0.WORLD_HEIGHT,
   0x101411,
   0.58
  ).setDepth(-17);

  const visible=this.add.rectangle(
   x,
   WORLD_DESIGN.ROUTE_Y,
   46,
   860,
   gate.color,
   0.20
  ).setStrokeStyle(4,gate.color,0.68).setDepth(-15);

  const label=lkAddText(this,
   x+38,
   WORLD_DESIGN.ROUTE_Y-350,
   `PATH SEALED\n${gate.closeName}`,
   {
    fontSize:'14px',
    color:'#d9ded4',
    stroke:'#101510',
    strokeThickness:3
   }
  ).setOrigin(0,0.5).setDepth(-14);

  this.backtrackBlockers.push(blocker,curtain,visible,label);

  this.showWaveBanner(
   'THE WAY BACK IS CLOSED',
   'The journey continues forward',
   '#c8d0c2'
  );
 }

 updateWorldStreaming(){
  const zoneIndex=this.currentWorldZoneIndex;
  const zone=WORLD_DESIGN.ZONES[zoneIndex];
  if(!zone) return;

  // Current biome must always be present.
  this.loadWorldZone(zoneIndex);

  // Stream the next biome near the transition so it can be glimpsed beyond
  // the gate and is ready the instant the champion opens the path.
  if(zoneIndex<WORLD_DESIGN.ZONES.length-1){
   const gate=WORLD_DESIGN.GATES[zoneIndex];
   const preloadAt=gate.x-WORLD_DESIGN.PREVIEW_WIDTH-500;

   if(
    this.player.x>=preloadAt ||
    (this.pendingWorldAdvance &&
     this.pendingWorldAdvance.targetZoneIndex===zoneIndex+1)
   ){
    this.loadWorldZone(zoneIndex+1);
   }
  }

  // After walking about three quarters of a wide mobile screen into the new
  // biome, permanently seal the route behind.
  if(zoneIndex>0){
   const previousGate=WORLD_DESIGN.GATES[zoneIndex-1];
   if(
    previousGate &&
    this.player.x>=previousGate.x+WORLD_DESIGN.BACK_LOCK_DEPTH
   ){
    this.createBacktrackSeal(previousGate);
   }

   // Once the old biome is >1.5 wide mobile screens behind us, discard its
   // diagnostic environment objects. Final tiles will use the same policy.
   if(
    previousGate &&
    this.player.x>=previousGate.x+WORLD_DESIGN.UNLOAD_DEPTH
   ){
    this.unloadWorldZone(zoneIndex-1);
   }
  }

  this.lastStreamingZoneIndex=zoneIndex;
 }

 bindProgressionGateCollision(){
  if(this.worldGateCollider) this.worldGateCollider.destroy();
  this.worldGateCollider=this.physics.add.collider(
   this.player,
   this.worldGateGroup
  );
 }

 getWorldZoneIndexAtX(x){
  // Gates are the progression truth. Overlap regions are assigned according
  // to the nearest progression checkpoint rather than a hard art boundary.
  if(x<WORLD_DESIGN.GATES[0].x) return 0;
  if(x<WORLD_DESIGN.GATES[1].x) return 1;
  if(x<WORLD_DESIGN.GATES[2].x) return 2;
  if(x<WORLD_DESIGN.GATES[3].x) return 3;
  return 4;
 }

 updateWorldRegion(){
  const nextIndex=this.getWorldZoneIndexAtX(this.player.x);
  if(nextIndex===this.currentWorldZoneIndex) return;

  this.currentWorldZoneIndex=nextIndex;
  const zone=WORLD_DESIGN.ZONES[nextIndex];
  if(this.regionText) this.regionText.setText(zone.name);

  if(this.time.now>=this.zoneBannerCooldownUntil){
   this.zoneBannerCooldownUntil=this.time.now+900;
   this.showWaveBanner(zone.name,zone.subtitle,'#dfe7d8');
  }
 }

 unlockWorldGateForChampion(championKind){
  const entry=WORLD_DESIGN.GATES.find(g=>g.champion===championKind);
  if(!entry) return null;

  // Ensure the destination biome exists before the gate disappears.
  this.loadWorldZone(entry.toZone);
  this.ensureProgressionGate(entry.fromZone);

  const obj=this.worldGateObjects.get(entry.id);
  if(obj && !obj.unlocked){
   obj.unlocked=true;
   this.unlockedWorldGates.add(entry.id);

   if(obj.blocker && obj.blocker.active){
    this.worldGateGroup.remove(obj.blocker,false,false);
    obj.blocker.destroy();
   }

   if(obj.visible && obj.visible.active){
    this.tweens.add({
     targets:obj.visible,
     alpha:0,
     scaleX:3.4,
     duration:520,
     ease:'Quad.easeOut',
     onComplete:()=>obj.visible.destroy()
    });
   }

   if(obj.label && obj.label.active){
    obj.label.setText(`OPEN\n${entry.name}`);
    this.tweens.add({
     targets:obj.label,
     alpha:0,
     x:obj.label.x-40,
     duration:700,
     onComplete:()=>obj.label.destroy()
    });
   }
  }

  return entry;
 }

 requestWorldAdvance(championKind){
  const gate=this.unlockWorldGateForChampion(championKind);
  if(!gate) return;

  this.pendingWorldAdvance={
   gateId:gate.id,
   gateX:gate.x,
   targetZoneIndex:gate.toZone
  };
 }

 beginWorldTravel(){
  if(!this.pendingWorldAdvance) return;

  this.waveIntermission=true;
  this.awaitingWorldAdvance=true;
  this.worldAdvanceTargetZone=this.pendingWorldAdvance.targetZoneIndex;
  this.nextWaveAt=Number.POSITIVE_INFINITY;

  const zone=WORLD_DESIGN.ZONES[this.worldAdvanceTargetZone];
  this.waveSubText.setText('TRAVEL ONWARD');
  this.showWaveBanner(
   'PATH OPEN',
   `Enter ${zone.name} to continue`,
   '#cde8b4'
  );
 }

 updateWorldTravel(time){
  if(!this.awaitingWorldAdvance || !this.pendingWorldAdvance) return;

  const threshold=this.pendingWorldAdvance.gateX+360;
  if(this.player.x<threshold) return;

  const arrivedZoneIndex=this.worldAdvanceTargetZone;
  const zone=WORLD_DESIGN.ZONES[arrivedZoneIndex];
  this.awaitingWorldAdvance=false;
  this.pendingWorldAdvance=null;
  this.worldAdvanceTargetZone=null;

  this.progressionBalanceZoneIndex=arrivedZoneIndex;
  this.applyRegionalHeroBalance(arrivedZoneIndex,false);
  this.currentWorldZoneIndex=this.getWorldZoneIndexAtX(this.player.x);
  if(this.regionText) this.regionText.setText(zone.name);

  this.waveSubText.setText('NEW REGION');
  const regionBalance=this.getRegionBalance(arrivedZoneIndex);
  this.showWaveBanner(
   zone.name,
   `${zone.subtitle} · Max HP ${this.player.maxHp} · melee +${regionBalance.meleeDamageBonus}`,
   '#e2eadb'
  );

  // Small arrival beat before combat resumes.
  this.nextWaveAt=time+1250;
 }

 getRegionBalance(index=this.progressionBalanceZoneIndex){
  const maxIndex=REGION_BALANCE.ZONES.length-1;
  const safeIndex=Phaser.Math.Clamp(Number.isFinite(index)?index:0,0,maxIndex);
  return REGION_BALANCE.ZONES[safeIndex] || REGION_BALANCE.ZONES[0];
 }

 getWavePopulationMultiplier(index=this.progressionBalanceZoneIndex){
  if(Number.isFinite(this.devRegionPopulationOverride)) return this.devRegionPopulationOverride;
  return this.getRegionBalance(index).populationMultiplier;
 }

 getEffectiveMeleeDamage(baseDamage=this.meleeAttack?.damage||15,index=this.progressionBalanceZoneIndex){
  return Math.max(1,baseDamage+this.getRegionBalance(index).meleeDamageBonus);
 }

 getRegionalPlayerMaxHp(index=this.progressionBalanceZoneIndex){
  const balance=this.getRegionBalance(index);
  return Math.max(1,Math.round(BALANCE.PLAYER_BASE_MAX_HP*balance.playerMaxHpMultiplier));
 }

 applyRegionalHeroBalance(index=this.progressionBalanceZoneIndex,showFeedback=true){
  if(!this.player) return;
  const balance=this.getRegionBalance(index);
  const previousMax=Math.max(1,this.player.maxHp||BALANCE.PLAYER_BASE_MAX_HP);
  const nextMax=this.getRegionalPlayerMaxHp(index);
  if(nextMax!==previousMax){
   const delta=nextMax-previousMax;
   this.player.maxHp=nextMax;
   const currentHp=Math.max(0,Number.isFinite(this.player.hp)?this.player.hp:nextMax);
   this.player.hp=delta>0
    ? Math.min(nextMax,currentHp+delta)
    : Math.min(nextMax,currentHp);
   this.updateLowHealthState(true);
  }
  if(showFeedback && index>0){
   this.showWaveBanner(
    'REGIONAL POWER',
    `Max HP ${nextMax} · melee +${balance.meleeDamageBonus}`,
    '#d8e5c9'
   );
  }
 }

 calculateWaveTarget(wave=this.wave,profile=this.waveProfile,championKind=this.getChampionForWave(wave)){
  const baseTarget=wave===1 ? 10 : 8+wave*3;
  const targetBonus=profile?.targetBonus||0;
  const championScale=championKind ? 0.70 : 1;
  return Math.max(1,Math.ceil((baseTarget+targetBonus)*championScale*this.getWavePopulationMultiplier()));
 }

 calculateWaveSpawnInterval(profile=this.waveProfile){
  const baseInterval=profile?.spawnInterval||1050;
  const spawnRate=this.getRegionBalance().spawnRateMultiplier;
  return Math.max(520,Math.round(baseInterval/Math.max(0.1,spawnRate)));
 }

 recalculateCurrentWaveRegionBalance(){
  if(!this.waveProfile) return;
  const championKind=this.getChampionForWave(this.wave);
  this.waveTarget=Math.max(this.spawned,this.calculateWaveTarget(this.wave,this.waveProfile,championKind));
  this.waveSpawnInterval=this.calculateWaveSpawnInterval(this.waveProfile);
  this.devTools?.refreshStateButtons?.();
  this.devTools?.updateInfo?.(true);
 }

 getWorldProgressName(){
  const zone=WORLD_DESIGN.ZONES[this.currentWorldZoneIndex];
  return zone ? zone.name : 'UNKNOWN';
 }

 clampWorldX(x,margin=20){
  return Phaser.Math.Clamp(x,margin,STAGE0.WORLD_WIDTH-margin);
 }

 clampWorldY(y,margin=20){
  return Phaser.Math.Clamp(y,margin,STAGE0.WORLD_HEIGHT-margin);
 }

 getUiMetrics(){
  const cam=this.cameras.main;
  const zoom=cam.zoom || 1;
  const width=cam.width/zoom;
  const height=cam.height/zoom;
  return {width,height,cx:width/2,cy:height/2,zoom};
 }

 getSpawnPointAroundCamera(margin=52){
  const view=this.cameras.main.worldView;
  const pad=42;
  const sides=[];
  if(view.top-margin>0) sides.push('top');
  if(view.right+margin<STAGE0.WORLD_WIDTH) sides.push('right');
  if(view.bottom+margin<STAGE0.WORLD_HEIGHT) sides.push('bottom');
  if(view.left-margin>0) sides.push('left');
  const side=Phaser.Utils.Array.GetRandom(sides.length ? sides : ['top','right','bottom','left']);
  const minX=this.clampWorldX(view.left+pad,pad);
  const maxX=this.clampWorldX(view.right-pad,pad);
  const minY=this.clampWorldY(view.top+pad,pad);
  const maxY=this.clampWorldY(view.bottom-pad,pad);
  if(side==='top') return {x:Phaser.Math.Between(Math.round(minX),Math.round(maxX)),y:this.clampWorldY(view.top-margin,pad)};
  if(side==='right') return {x:this.clampWorldX(view.right+margin,pad),y:Phaser.Math.Between(Math.round(minY),Math.round(maxY))};
  if(side==='bottom') return {x:Phaser.Math.Between(Math.round(minX),Math.round(maxX)),y:this.clampWorldY(view.bottom+margin,pad)};
  return {x:this.clampWorldX(view.left-margin,pad),y:Phaser.Math.Between(Math.round(minY),Math.round(maxY))};
 }

 getEdgeSpawnPoint(margin=64){
  return this.getSpawnPointAroundCamera(margin);
 }

 setupResponsiveWorldCamera(){
  const cam=this.cameras.main;
  cam.setBounds(0,0,STAGE0.WORLD_WIDTH,STAGE0.WORLD_HEIGHT);
  cam.setRoundPixels(true);
  cam.startFollow(this.player,true,1,1);
  this.handleViewportResize();
  cam.centerOn(this.player.x,this.player.y);
 }

 handleViewportResize(){
  if(!this.cameras || !this.cameras.main) return;
  const gameW=Math.max(1,this.scale.width);
  const gameH=Math.max(1,this.scale.height);
  // Mobile Display Fix: always use the full browser viewport.
  // The old 20:9 cap created side bars on ultra-wide phones.
  const cameraW=gameW;
  const cameraX=0;
  const cam=this.cameras.main;
  cam.setViewport(cameraX,0,cameraW,gameH);
  const baseZoom=gameH/STAGE0.REFERENCE_HEIGHT;
  // Mobile camera pass: bring the action closer so character/enemy art reads on phones
  // without sacrificing too much crowd awareness. Desktop keeps the wider 720px reference view.
  const mobileCamera=Boolean(this.isTouchDevice || gameH<560 || gameW<900);
  const cameraZoomMultiplier=mobileCamera ? 1.35 : 1;
  cam.setZoom(Math.max(0.01,baseZoom*cameraZoomMultiplier));
  const metrics=this.getUiMetrics();
  cam.setDeadzone(metrics.width*STAGE0.CAMERA_DEADZONE_WIDTH,metrics.height*STAGE0.CAMERA_DEADZONE_HEIGHT);
  this.layoutScreenUI();
  this.layoutMobileControls();
 }

 layoutScreenUI(){
  if(!this.cameras || !this.cameras.main) return;
  const {cx,cy}=this.getUiMetrics();
  if(this.hud) this.hud.setPosition(14,12);
  if(this.waveText) this.waveText.setPosition(cx,18);
  if(this.waveSubText) this.waveSubText.setPosition(cx,50);
  if(this.regionText) this.regionText.setPosition(cx,69);
  if(this.championNameText) this.championNameText.setPosition(cx,88);
  if(this.championHpBack) this.championHpBack.setPosition(cx,113);
  if(this.championHpFill) this.championHpFill.setPosition(cx-213,113);
  if(this.gameOverPanel) this.gameOverPanel.setPosition(cx,cy);
  if(this.gameOverText) this.gameOverText.setPosition(cx,cy);
 }

 createMobileControls(){
  if(!this.isTouchDevice) return;
  const base=this.add.circle(0,0,74,0x0a0f0b,0.20).setStrokeStyle(3,0xffffff,0.24).setScrollFactor(0).setDepth(500);
  const knob=this.add.circle(0,0,31,0xffffff,0.22).setStrokeStyle(2,0xffffff,0.30).setScrollFactor(0).setDepth(501);
  const skillButtons=[];
  for(let i=0;i<3;i++){
   const button=this.add.circle(0,0,44,0x111811,0.28).setStrokeStyle(2,0xffffff,0.24).setScrollFactor(0).setDepth(500).setInteractive({useHandCursor:true});
   const label=lkAddText(this,0,0,`S${i+1}`,{fontSize:'18px',color:'#ffffff'}).setOrigin(0.5).setScrollFactor(0).setDepth(501);
   button.on('pointerdown',()=>this.events.emit('mobile-skill',i+1));
   skillButtons.push({button,label});
  }
  this.mobileControls=[base,knob];
  this.mobileJoystickBase=base; this.mobileJoystickKnob=knob; this.mobileSkillButtons=skillButtons;
  for(const pair of skillButtons) this.mobileControls.push(pair.button,pair.label);
  this.input.on('pointerdown',this.handleMobilePointerDown,this);
  this.input.on('pointermove',this.handleMobilePointerMove,this);
  this.input.on('pointerup',this.handleMobilePointerUp,this);
  this.input.on('pointerupoutside',this.handleMobilePointerUp,this);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
   this.input.off('pointerdown',this.handleMobilePointerDown,this);
   this.input.off('pointermove',this.handleMobilePointerMove,this);
   this.input.off('pointerup',this.handleMobilePointerUp,this);
   this.input.off('pointerupoutside',this.handleMobilePointerUp,this);
  });
  this.layoutMobileControls();
 }

 getPointerUiPosition(pointer){
  const cam=this.cameras.main;
  return {x:(pointer.x-cam.x)/(cam.zoom||1),y:(pointer.y-cam.y)/(cam.zoom||1)};
 }

 handleMobilePointerDown(pointer){
  if(this.devTools?.freeCamera||this.devTools?.editMode) return;
  if(!this.mobileJoystickBase || this.mobileMovePointerId!==null) return;
  const p=this.getPointerUiPosition(pointer);
  const dx=p.x-this.mobileJoystickBase.x,dy=p.y-this.mobileJoystickBase.y;
  if(Math.hypot(dx,dy)<=105){this.mobileMovePointerId=pointer.id;this.updateMobileJoystick(pointer);}
 }

 handleMobilePointerMove(pointer){
  if(this.devTools?.freeCamera||this.devTools?.editMode) return;
  if(pointer.id===this.mobileMovePointerId) this.updateMobileJoystick(pointer);
 }

 handleMobilePointerUp(pointer){
  if(pointer.id!==this.mobileMovePointerId) return;
  this.mobileMovePointerId=null; this.mobileMoveX=0; this.mobileMoveY=0;
  if(this.mobileJoystickKnob && this.mobileJoystickBase) this.mobileJoystickKnob.setPosition(this.mobileJoystickBase.x,this.mobileJoystickBase.y);
 }

 updateMobileJoystick(pointer){
  if(!this.mobileJoystickBase || !this.mobileJoystickKnob) return;
  const p=this.getPointerUiPosition(pointer);
  const dx=p.x-this.mobileJoystickBase.x,dy=p.y-this.mobileJoystickBase.y;
  const len=Math.hypot(dx,dy),max=58,scale=len>max ? max/len : 1;
  this.mobileJoystickKnob.setPosition(this.mobileJoystickBase.x+dx*scale,this.mobileJoystickBase.y+dy*scale);
  if(len<8){this.mobileMoveX=0;this.mobileMoveY=0;} else {this.mobileMoveX=dx/len;this.mobileMoveY=dy/len;}
 }

 layoutMobileControls(){
  if(!this.isTouchDevice || !this.mobileJoystickBase) return;
  const {width,height}=this.getUiMetrics();
  const joyX=118,joyY=height-112;
  this.mobileJoystickBase.setPosition(joyX,joyY);
  if(this.mobileMovePointerId===null) this.mobileJoystickKnob.setPosition(joyX,joyY);
  const positions=[{x:width-112,y:height-104},{x:width-210,y:height-92},{x:width-158,y:height-190}];
  this.mobileSkillButtons.forEach((pair,i)=>{pair.button.setPosition(positions[i].x,positions[i].y);pair.label.setPosition(positions[i].x,positions[i].y);});
 }

 spawnChampion(kind,forcedByDev=false){
  if(this.devFlags?.autoSpawnsDisabled && !forcedByDev) return;
  if(this.activeChampion && this.activeChampion.active) return;
  const def=this.getChampionDefinition(kind);
  if(!def) return;

  let pos=this.getEdgeSpawnPoint(50);
  if(kind==='hollowTree'){
   const view=this.cameras.main.worldView;
   const dx=Math.min(300,view.width*0.32);
   const dy=Math.min(230,view.height*0.30);
   const candidates=[
    {x:this.clampWorldX(this.player.x+dx,70),y:this.player.y},
    {x:this.clampWorldX(this.player.x-dx,70),y:this.player.y},
    {x:this.player.x,y:this.clampWorldY(this.player.y+dy,70)},
    {x:this.player.x,y:this.clampWorldY(this.player.y-dy,70)}
   ];
   candidates.sort((a,b)=>Phaser.Math.Distance.Between(b.x,b.y,this.player.x,this.player.y)-Phaser.Math.Distance.Between(a.x,a.y,this.player.x,this.player.y));
   pos=candidates[0];
  }
  pos=this.findSafeEnemySpawnPoint(pos.x,pos.y,{padding:(def.hitRadius||24)+8,minPlayerDistance:150,maxRadius:460});

  const e=this.add.circle(pos.x,pos.y,def.hitRadius,0xb34cff,0);
  this.physics.add.existing(e);

  e.type='champion';
  e.championKind=kind;
  e.championName=def.name;
  e.hp=def.hp+Math.max(0,this.wave-5)*12;
  e.maxHp=e.hp;
  e.speed=def.speed;
  e.attackDamage=def.damage;
  e.hitRadius=def.hitRadius;
  e.crowdRadius=def.crowdRadius || def.hitRadius;
  e.crowdKeepoutRadius=def.crowdKeepoutRadius || 0;
  e.lastAttack=0;
  e.lastShot=0;
  e.attackAnimUntil=0;
  e.staggerUntil=0;
  e.pendingMeleeHitAt=0;
  e.pendingMeleeDamage=0;
  e.pendingMeleeRange=0;
  e.knockbackVX=0;
  e.knockbackVY=0;
  e.nextSkillAt=this.time.now+1600;
  e.nextSecondaryAt=this.time.now+3900;
  e.reflectUntil=0;
  e.guardUntil=0;
  e.lastCounterAt=-99999;
  e.lastAuraTick=0;

  const isBrokenSaint=kind==='brokenSaint';
  // Later champions do not have final art yet. Use the existing skeleton set as a
  // deliberate temporary fallback instead of referencing removed champion_* frames.
  const initialTexture=isBrokenSaint ? 'broken_saint_down_walk_00' : 'skeleton_down_idle_00';
  e.visual=this.add.sprite(e.x,e.y,initialTexture)
   .setOrigin(0.5,0.80).setScale(def.scale).setDepth(16).setTint(def.tint);
  e.dir='down';
  e.attackDir='down';
  e.visualState=isBrokenSaint ? 'broken_saint_down_idle' : 'skeleton_down_idle';
  e.visual.play(e.visualState);
  e.visualBaseScale=def.scale;
  this.createEnemyReadabilityShadow(e);

  if(kind==='hollowTree'){
   e.auraVisual=this.add.circle(e.x,e.y,175,0x89b85d,0.055)
    .setStrokeStyle(2,0xa8d975,0.38)
    .setDepth(8);
  }

  this.configureEnemyCollision(e,def.collisionPadding ?? 4);
  this.enemyGroup.add(e);
  this.enemies.push(e);
  this.activeChampion=e;
  this.championEventActive=true;
  this.championSpawned++;

  if(isBrokenSaint) this.startBrokenSaintMusic();

  this.championNameText.setText(def.name).setVisible(true);
  this.championHpBack.setVisible(true);
  this.championHpFill.setVisible(true);
  this.updateChampionBar();

  this.showWaveBanner(def.name,'CHAMPION EVENT — ordinary pressure reduced by 30%',def.rewardColor);
  this.cameras.main.flash(240,70,48,25,false);
 }

 destroyChampionHazard(hazard){
  if(!hazard) return;
  for(const key of ['visual','beamVisual']){
   const obj=hazard[key];
   if(!obj) continue;
   try{this.tweens?.killTweensOf?.(obj);}catch{}
   try{obj.stop?.();}catch{}
   try{obj.destroy?.();}catch{}
   hazard[key]=null;
  }
  for(const key of ['timer','event','delayedCall']){
   const event=hazard[key];
   if(!event) continue;
   try{event.remove?.(false);}catch{}
   try{event.destroy?.();}catch{}
   hazard[key]=null;
  }
 }

 clearChampionHazards(){
  for(const hazard of this.championHazards||[]){
   this.destroyChampionHazard(hazard);
  }
  this.championHazards=[];
 }

 spawnChampionHazard(x,y,radius,delay,duration,damage,color=0xffd76a,kind='mark'){
  let visual;
  let beamVisual=null;
  if(kind==='holyMark'){
   visual=this.add.sprite(x,y,'broken_saint_holy_mark_00')
    .setOrigin(0.5)
    .setDisplaySize(radius*2.35,radius*2.35)
    .setDepth(10);
   visual.play('broken_saint_holy_mark');
   beamVisual=this.add.sprite(x,y+4,'broken_saint_holy_beam_02')
    .setOrigin(0.5,0.86)
    .setDisplaySize(radius*3.15,radius*3.15)
    .setDepth(16)
    .setAlpha(0.72);
   beamVisual.play('broken_saint_holy_beam_idle');
  } else {
   visual=this.add.circle(x,y,radius,color,0.08)
    .setStrokeStyle(3,color,0.72).setDepth(10);
  }

  this.championHazards.push({
   x,y,radius,damage,color,kind,visual,beamVisual,
   activateAt:this.time.now+delay,
   expiresAt:this.time.now+delay+duration,
   lastTick:-99999,
   tickEvery:kind==='deathZone' ? 450 : 99999,
   activeVisual:false,
   hitPlayer:false
  });
 }

 spawnHolyMarkPlayerHitFeedback(){
  const x=this.player.x;
  const y=this.player.y-8;

  // A clear sacred-impact burst on the player, separate from the ground mark.
  const burst=this.add.sprite(x,y,'hit_burst_00')
   .setOrigin(0.5)
   .setDepth(72)
   .setScale(0.78)
   .setTint(0xffe58a);
  burst.play('hit_burst');
  burst.once(Phaser.Animations.Events.ANIMATION_COMPLETE,()=>{
   if(burst.active) burst.destroy();
  });

  const ring=this.add.circle(x,this.player.y,20,0xffe8a0,0.10)
   .setStrokeStyle(4,0xffe8a0,0.92)
   .setDepth(71);
  this.tweens.add({
   targets:ring,
   scale:2.05,
   alpha:0,
   duration:220,
   ease:'Quad.easeOut',
   onComplete:()=>{ if(ring.active) ring.destroy(); }
  });

  this.cameras.main.shake(70,0.0038);
 }

 updateChampionHazards(time){
  for(const h of this.championHazards){
   if(!h.visual || !h.visual.active) continue;

   if(time>=h.activateAt && !h.activeVisual){
    h.activeVisual=true;
    if(h.kind==='holyMark'){
     h.visual
      .setTexture('broken_saint_holy_impact_00')
      .setOrigin(0.5,0.93)
      .setDisplaySize(h.radius*3.20,h.radius*3.20)
      .setDepth(18);
     h.visual.play('broken_saint_holy_impact',true);
     if(h.beamVisual && h.beamVisual.active){
      h.beamVisual.stop();
      h.beamVisual
       .setTexture('broken_saint_holy_beam_00')
       .setOrigin(0.5,0.86)
       .setDisplaySize(h.radius*3.35,h.radius*3.35)
       .setDepth(19)
       .setAlpha(0.95);
     }
    } else {
     h.visual.setFillStyle(h.color,h.kind==='deathZone' ? 0.20 : 0.30);
     h.visual.setStrokeStyle(3,h.color,0.95);
    }
   }

   if(h.activeVisual && time<h.expiresAt){
    const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,h.x,h.y);

    if(h.kind==='deathZone'){
     if(d<=h.radius && time-h.lastTick>=h.tickEvery){
      h.lastTick=time;
      this.damagePlayer(h.damage,'champion:deathZone');
     }
    } else if(!h.hitPlayer && d<=h.radius){
     h.hitPlayer=true;

     if(h.kind==='roots'){
      this.damagePlayer(h.damage,'champion:roots');
      this.applyPlayerRootSlow(1450,0.45);
     } else if(h.kind==='holyMark'){
      this.damagePlayer(h.damage,'champion:holyMark');
      this.spawnHolyMarkPlayerHitFeedback();
     } else {
      this.damagePlayer(h.damage,`champion:${h.kind}`);
     }
    }
   }

   if(time>=h.expiresAt){
    if(h.visual && h.visual.active) h.visual.destroy();
    if(h.beamVisual && h.beamVisual.active) h.beamVisual.destroy();
   }
  }
  this.championHazards=this.championHazards.filter(h=>
   (h.visual && h.visual.active) || (h.beamVisual && h.beamVisual.active)
  );
 }

 spawnChampionMinion(x,y){
  const safeSpawn=this.findSafeEnemySpawnPoint(x,y,{padding:22,minPlayerDistance:90,maxRadius:280});
  const e=this.add.circle(safeSpawn.x,safeSpawn.y,14,0xcc3333,0);
  this.physics.add.existing(e);
  e.type='skeleton';
  e.hp=24+this.wave*4;
  e.maxHp=e.hp;
  e.speed=86+this.wave*4;
  e.attackDamage=8;
  e.hitRadius=14;
  e.lastAttack=0;
  e.lastShot=0;
  e.attackAnimUntil=0;
  e.staggerUntil=0;
  e.pendingMeleeHitAt=0;
  e.pendingMeleeDamage=0;
  e.pendingMeleeRange=0;
  e.knockbackVX=0;
  e.knockbackVY=0;
  e.visual=this.add.sprite(e.x,e.y,'skeleton_down_walk_00')
   .setOrigin(0.5,0.78).setScale(0.5).setDepth(15);
  e.dir='down';
  e.attackDir='down';
  e.visualState='skeleton_down_walk';
  e.visual.play(e.visualState);
  e.visualBaseScale=0.5;
  this.configureEnemyCollision(e,4);
  this.enemyGroup.add(e);
  this.enemies.push(e);
 }

 updateChampion(e,time,a,distance){
  const kind=e.championKind;
  if(this.devFlags?.championFrozen){
   if(e.body)e.body.setVelocity(0,0);
   e.pendingMeleeHitAt=0;
   return;
  }
  const devNoChampionSkills=Boolean(this.devFlags?.championSkillsDisabled);
  const devNoChampionAttacks=Boolean(this.devFlags?.championAttacksDisabled);

  if(kind==='brokenSaint'){
   this.setEnemySteeredVelocity(e,Math.cos(a)*e.speed,Math.sin(a)*e.speed,time);

   if(!devNoChampionSkills && time>=e.nextSkillAt){
    e.nextSkillAt=time+3000;
    e.attackAnimUntil=time+650;
    e.attackDir=e.dir;
    const predictX=this.clampWorldX(
     this.player.x+(this.player.body.velocity.x||0)*0.22,
     34
    );
    const predictY=this.clampWorldY(
     this.player.y+(this.player.body.velocity.y||0)*0.22,
     34
    );

    this.startBrokenSaintHolyWarningSfx();
    const holyMarkPoints=[[predictX,predictY]];

    this.spawnChampionHazard(
     predictX,predictY,34,850,300,12,0xffdc72,'holyMark'
    );

    const baseAngle=Phaser.Math.FloatBetween(0,Math.PI*2);
    for(let i=0;i<2;i++){
     const angle=baseAngle+i*Math.PI;
     const r=58;
     const x=this.clampWorldX(predictX+Math.cos(angle)*r,34);
     const y=this.clampWorldY(predictY+Math.sin(angle)*r,34);
     holyMarkPoints.push([x,y]);
     this.spawnChampionHazard(
      x,y,30,850,300,12,0xffdc72,'holyMark'
     );
    }

    let extraMarks=0;
    let attempts=0;
    while(extraMarks<5 && attempts<40){
     attempts++;
     const angle=Phaser.Math.FloatBetween(0,Math.PI*2);
     const dist=Phaser.Math.Between(120,300);
     const x=this.clampWorldX(this.player.x+Math.cos(angle)*dist,34);
     const y=this.clampWorldY(this.player.y+Math.sin(angle)*dist,34);

     let tooClose=false;
     for(const [px,py] of holyMarkPoints){
      if(Phaser.Math.Distance.Between(x,y,px,py)<92){
       tooClose=true;
       break;
      }
     }
     if(tooClose) continue;

     holyMarkPoints.push([x,y]);
     extraMarks++;
     this.spawnChampionHazard(
      x,y,30,950+Phaser.Math.Between(0,250),300,12,0xffdc72,'holyMark'
     );
    }

    this.time.delayedCall(850,()=>{
     this.stopBrokenSaintHolyWarningSfx();
     if(e.active && e.hp>0) this.playBrokenSaintHolyBeamSfx();
    });
   }

   if(!devNoChampionSkills && time>=e.nextSecondaryAt){
    // 5s shield uptime, then a full 10s vulnerability window.
    e.nextSecondaryAt=time+15000;
    e.reflectUntil=time+5000;
    if(e.reflectVisual && e.reflectVisual.active) e.reflectVisual.destroy();
    const shieldSize=(e.hitRadius||24)*4.9;
    e.reflectVisual=this.add.sprite(e.x,e.y-8,'broken_saint_reflect_shield_00')
     .setOrigin(0.5)
     .setDisplaySize(shieldSize,shieldSize)
     .setDepth(17);
    e.reflectVisual.play('broken_saint_reflect_shield');
    this.time.delayedCall(5000,()=>{
     if(e.reflectVisual && e.reflectVisual.active) e.reflectVisual.destroy();
     e.reflectVisual=null;
    });
   }
   return;
  }

  if(kind==='necromancer'){
   if(distance>220){
    this.setEnemySteeredVelocity(e,Math.cos(a)*e.speed,Math.sin(a)*e.speed,time);
   } else if(distance<165){
    this.setEnemySteeredVelocity(e,-Math.cos(a)*e.speed,-Math.sin(a)*e.speed,time);
   } else {
    e.body.setVelocity(0,0);
   }

   if(!devNoChampionSkills && time>=e.nextSkillAt){
    e.nextSkillAt=time+3500;
    e.attackAnimUntil=time+650;
    e.attackDir=e.dir;
    this.spawnChampionHazard(this.player.x,this.player.y,58,700,2300,7,0x48ff6e,'deathZone');
   }

   if(!devNoChampionSkills && time>=e.nextSecondaryAt){
    e.nextSecondaryAt=time+6200;
    for(let i=0;i<2;i++){
     const angle=Phaser.Math.FloatBetween(0,Math.PI*2);
     const r=Phaser.Math.Between(65,100);
     this.spawnChampionMinion(
      this.clampWorldX(e.x+Math.cos(angle)*r,25),
      this.clampWorldY(e.y+Math.sin(angle)*r,25)
     );
    }
    const pulse=this.add.circle(e.x,e.y,22,0x55ff77,0.18)
     .setStrokeStyle(3,0x55ff77,0.9).setDepth(17);
    this.tweens.add({targets:pulse,scale:3.1,alpha:0,duration:480,onComplete:()=>pulse.destroy()});
   }
   return;
  }

  if(kind==='shieldWarden'){
   this.setEnemySteeredVelocity(e,Math.cos(a)*e.speed,Math.sin(a)*e.speed,time);

   if(!devNoChampionSkills && time>=e.nextSecondaryAt){
    e.nextSecondaryAt=time+6200;
    e.guardUntil=time+1700;
    const guard=this.add.circle(e.x,e.y,46,0xd7e1ee,0.05)
     .setStrokeStyle(5,0xd7e1ee,0.95).setDepth(17);
    this.tweens.add({
     targets:guard,alpha:0.30,duration:180,yoyo:true,repeat:3,
     onUpdate:()=>{ if(guard.active) guard.setPosition(e.x,e.y); },
     onComplete:()=>{ if(guard.active) guard.destroy(); }
    });
   }

   if(!devNoChampionAttacks && !devNoChampionSkills && distance<115 && time>=e.nextSkillAt){
    e.nextSkillAt=time+3200;
    const windup=480;
    e.attackAnimUntil=time+760;
    e.attackDir=e.dir;
    e.body.setVelocity(0,0);

    const warning=this.add.circle(e.x,e.y,46,0xe4edf7,0.05)
     .setStrokeStyle(4,0xffffff,0.88).setDepth(20);
    this.tweens.add({
     targets:warning,scale:1.35,alpha:0.26,duration:windup,yoyo:false,
     onUpdate:()=>{ if(warning.active && e.active) warning.setPosition(e.x,e.y); },
     onComplete:()=>{ if(warning.active) warning.destroy(); }
    });

    this.time.delayedCall(windup,()=>{
     if(!e || !e.active || e.hp<=0 || this.gameOver || this.devFlags?.championAttacksDisabled || this.devFlags?.championFrozen) return;
     if(this.time.now<(e.staggerUntil||0) || this.time.now<(e.skillLiftUntil||0)) return;
     const currentDistance=Phaser.Math.Distance.Between(e.x,e.y,this.player.x,this.player.y);
     if(currentDistance>128) return;

     this.damagePlayer(17,'champion:shieldBash');
     const pushAngle=Phaser.Math.Angle.Between(e.x,e.y,this.player.x,this.player.y);
     const bashVX=Math.cos(pushAngle)*310;
     const bashVY=Math.sin(pushAngle)*310;
     this.applyPlayerForcedMotion(bashVX,bashVY,190);
     this.player.body.setVelocity(bashVX,bashVY);

     const bash=this.add.circle(this.player.x,this.player.y,20,0xe4edf7,0.30)
      .setStrokeStyle(4,0xffffff,0.9).setDepth(21);
     this.tweens.add({targets:bash,scale:2.0,alpha:0,duration:220,onComplete:()=>bash.destroy()});
    });
   }
   return;
  }

  if(kind==='hollowTree'){
   e.body.setVelocity(0,0);

   if(!devNoChampionSkills && time>=e.nextSkillAt){
    e.nextSkillAt=time+3200;
    e.attackAnimUntil=time+600;
    const rootX=this.clampWorldX(
     this.player.x+(this.player.body.velocity.x||0)*0.28,
     38
    );
    const rootY=this.clampWorldY(
     this.player.y+(this.player.body.velocity.y||0)*0.28,
     38
    );

    // A center root forces movement; three side roots punish a bad escape.
    this.spawnChampionHazard(
     rootX,rootY,36,850,720,8,0xb0d66d,'roots'
    );

    for(let i=0;i<3;i++){
     const angle=i*(Math.PI*2/3)+Phaser.Math.FloatBetween(-0.18,0.18);
     const r=58;
     this.spawnChampionHazard(
      this.clampWorldX(rootX+Math.cos(angle)*r,36),
      this.clampWorldY(rootY+Math.sin(angle)*r,36),
      32,850,720,8,0xb0d66d,'roots'
     );
    }
   }

   if(!devNoChampionSkills && time>=e.nextSecondaryAt){
    e.nextSecondaryAt=time+5700;
    for(let i=0;i<2;i++){
     const angle=Phaser.Math.FloatBetween(0,Math.PI*2);
     this.spawnChampionMinion(
      this.clampWorldX(e.x+Math.cos(angle)*85,25),
      this.clampWorldY(e.y+Math.sin(angle)*85,25)
     );
    }
   }

   if(!devNoChampionAttacks && distance<175 && time-e.lastAuraTick>700){
    e.lastAuraTick=time;
    this.damagePlayer(6,'champion:corruption');
   }
  }
 }

 updateChampionBar(){
  const e=this.activeChampion;
  if(!e || !e.active){
   this.championNameText.setVisible(false);
   this.championHpBack.setVisible(false);
   this.championHpFill.setVisible(false);
   return;
  }
  const ratio=Phaser.Math.Clamp(e.hp/e.maxHp,0,1);
  this.championHpFill.displayWidth=426*ratio;
  this.championNameText.setText(`${e.championName}  ${Math.ceil(Math.max(0,e.hp))}/${e.maxHp}`);
 }

 getChampionRewardChoices(kind){
  return ({
   brokenSaint:[
    ['HOLY FRAGMENT','Every 5th sword swing releases a light slash','holyFragment'],
    ['MERCY SEAL','Sword deals +25% damage to enemies below 30% HP','mercySeal'],
    ['FALLEN BLESSING','Survive one lethal hit and restore 30 HP','fallenBlessing']
   ],
   necromancer:[
    ['SOUL SKULL','A spectral skull attacks a nearby enemy periodically','soulSkull'],
    ['GREEN CURSE','Dead enemies can leave damaging cursed ground','greenCurse'],
    ['NECROMANCER SOUL','Kills stack sword damage until you are hit','necromancerSoul']
   ],
   shieldWarden:[
    ['SHIELD FRAGMENT','Automatically block one hit every 25 seconds','shieldFragment'],
    ['HEAVY STRIKE','Sword hits can heavily stagger enemies','heavyStrike'],
    ['IRON WILL','Take 30% less damage while below 35 HP','ironWill']
   ],
   hollowTree:[
    ['ROOT HEART','Kills can lash a nearby enemy with a root','rootHeart'],
    ['CURSED GROUND','Periodically create a damaging aura around you','cursedGround'],
    ['ANCIENT BLOOD','Healing received is increased by 50%','ancientBlood']
   ]
  })[kind] || [];
 }

 openChampionRewards(kind){
  if(this.championRewardOpen) return;
  const choices=this.getChampionRewardChoices(kind);
  if(!choices.length) return;

  this.championRewardOpen=true;
  this.setGameplayPaused('championReward',true);
  const def=this.getChampionDefinition(kind);
  this.currentChampionRewardChoices=choices;
  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.showChampionRewards==='function'){
   hudScene.showChampionRewards(def.name,def.rewardColor,choices);
   this.championRewardObjects=[];
   return;
  }

  const {cx,cy}=this.getUiMetrics();
  const panel=this.add.rectangle(cx,cy,650,360,0x080b08,0.94)
   .setStrokeStyle(3,0xd8b65c,0.85).setDepth(230).setScrollFactor(0);
  const title=lkAddText(this,cx,cy-145,`${def.name} DEFEATED`,{fontSize:'27px',color:def.rewardColor,stroke:'#111111',strokeThickness:4})
   .setOrigin(0.5).setDepth(231).setScrollFactor(0);
  const subtitle=lkAddText(this,cx,cy-110,'CHOOSE ONE CHAMPION RELIC',{fontSize:'15px',color:'#ffffff'})
   .setOrigin(0.5).setDepth(231).setScrollFactor(0);

  this.championRewardObjects=[panel,title,subtitle];

  choices.forEach((choice,i)=>{
   const [name,desc,id]=choice;
   const y=cy-55+i*82;
   const card=this.add.rectangle(cx,y,570,66,0x243323,0.96)
    .setStrokeStyle(2,0x7f9b68,0.8).setDepth(231).setScrollFactor(0).setInteractive({useHandCursor:true});
   const nameText=lkAddText(this,cx-265,y-17,name,{fontSize:'18px',color:'#ffe8a8'}).setDepth(232).setScrollFactor(0);
   const descText=lkAddText(this,cx-265,y+7,desc,{fontSize:'13px',color:'#dbe8d7',wordWrap:{width:500}}).setDepth(232).setScrollFactor(0);

   card.on('pointerover',()=>card.setFillStyle(0x354b32,1));
   card.on('pointerout',()=>card.setFillStyle(0x243323,0.96));
   card.on('pointerdown',()=>{
    this.grantChampionRelic(id);
    this.closeChampionRewards(name);
   });

   this.championRewardObjects.push(card,nameText,descText);
  });
 }

 selectChampionReward(index){
  if(!this.championRewardOpen) return;
  const choice=this.currentChampionRewardChoices?.[index];
  if(!choice) return;
  const [name,,id]=choice;
  this.grantChampionRelic(id);
  this.closeChampionRewards(name);
 }

 closeChampionRewards(rewardName){
  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.hideChampionRewards==='function') hudScene.hideChampionRewards();
  for(const obj of this.championRewardObjects){
   if(obj && obj.destroy) obj.destroy();
  }
  this.championRewardObjects=[];
  this.currentChampionRewardChoices=[];
  this.championRewardOpen=false;
  this.setGameplayPaused('championReward',false);

  this.grantXp(40);

  const txt=lkAddText(this,
   this.player.x,this.player.y-62,
   `${rewardName}\nRELIC ACQUIRED`,
   {fontSize:'17px',color:'#ffe49b',align:'center',stroke:'#17120a',strokeThickness:3}
  ).setOrigin(0.5).setDepth(100);

  this.tweens.add({
   targets:txt,y:txt.y-35,alpha:0,duration:1300,
   onComplete:()=>txt.destroy()
  });
 }

 grantChampionRelic(id){
  this.championRelics.add(id);
  if(id==='fallenBlessing') this.fallenBlessingUsed=false;
  if(id==='soulSkull') this.nextSoulSkullAt=this.time.now+1400;
  if(id==='cursedGround') this.nextCursedGroundAt=this.time.now+4000;
 }

 updateMana(time){
  if(this.devFlags?.infiniteMana){this.mana=this.maxMana;this.nextManaRegenAt=0;return;}
  if(this.mana>=this.maxMana){
   this.mana=this.maxMana;
   this.nextManaRegenAt=0;
   return;
  }
  if(!this.nextManaRegenAt) this.nextManaRegenAt=time+this.manaRegenMs;
  while(this.mana<this.maxMana && time>=this.nextManaRegenAt){
   this.mana++;
   if(this.mana<this.maxMana) this.nextManaRegenAt+=this.manaRegenMs;
   else this.nextManaRegenAt=0;
  }
 }

 spendMana(){
  if(this.devFlags?.infiniteMana){this.mana=this.maxMana;return true;}
  if(this.mana<=0) return false;
  const wasFull=this.mana>=this.maxMana;
  this.mana--;
  if(wasFull || !this.nextManaRegenAt) this.nextManaRegenAt=this.time.now+this.manaRegenMs;
  return true;
 }

 handleSkillInput(index){
  if(this.gameOver || this.levelChoiceOpen || this.championRewardOpen) return;
  if(this.time.now<(this.skillLockUntil||0)) return;
  if(this.mana<=0){
   this.showNoManaFeedback();
   return;
  }
  if(!this.spendMana()) return;
  if(index===1){
   this.playSkillSfx('sfx_skill_quake',0.294);
   this.castGroundTremor();
  } else if(index===2){
   this.playSkillSfx('sfx_skill_lift');
   this.castLift();
  } else if(index===3){
   this.playSkillSfx('sfx_skill_spin');
   this.castSpin();
  } else this.mana=Math.min(this.maxMana,this.mana+1);
 }

 showNoManaFeedback(){
  if(this.time.now-(this.lastNoManaFxAt||-9999)<600) return;
  this.lastNoManaFxAt=this.time.now;
  const txt=lkAddText(this,this.player.x,this.player.y-48,'NO MANA',{fontSize:'14px',fontStyle:'bold',color:'#8fd8ff',stroke:'#10202d',strokeThickness:3})
   .setOrigin(0.5).setDepth(75);
  this.tweens.add({targets:txt,y:txt.y-20,alpha:0,duration:620,ease:'Quad.easeOut',onComplete:()=>txt.destroy()});
 }

 getHeroSocketDirectionFromVector(dx,dy,fallback='s'){
  if(Math.abs(dx)<1 && Math.abs(dy)<1) return fallback;
  const dir=this.getEightDirectionFromVector(dx,dy,'down');
  return ({
   up:'n',up_right:'ne',right:'e',down_right:'se',
   down:'s',down_left:'sw',left:'w',up_left:'nw'
  })[dir] || fallback;
 }

 startHeroSpinAttack(duration=HERO_SOCKET_SPIN_DURATION_MS){
  this.playerAttackUntil=Math.max(this.playerAttackUntil||0,this.time.now+duration);
  if(this.playerVisual && this.playerVisual.active){
   this.playerVisualState='hero_socket_spin';
   this.playerVisual.play('hero_socket_spin',true);
  }
  this.updateHeroWeaponAttachment();
 }

 createHeroWeaponAttachment(){
  this.heroWeaponSocketProject=this.cache.json.get('last_knight_weapon_socket_project')||null;
  const defaultTexture='weapon_socket_sword_n';
  this.playerWeaponBack=this.add.sprite(this.player.x,this.player.y,defaultTexture)
   .setDepth((this.playerVisual?.depth||20)-0.05)
   .setVisible(false);
  this.playerWeaponFront=this.add.sprite(this.player.x,this.player.y,defaultTexture)
   .setDepth((this.playerVisual?.depth||20)+0.05)
   .setVisible(false);
  this.playerWeaponMaskShape=this.make.graphics({x:0,y:0,add:false});
  this.playerWeaponFrontMask=this.playerWeaponMaskShape.createGeometryMask();
 }

 getHeroWeaponPlacementForCurrentFrame(){
  if(!this.playerVisual || !this.playerVisual.active) return null;
  const textureKey=this.playerVisual.texture?.key||'';
  if(!textureKey.startsWith('hero_socket_')) return null;
  const sourceName=textureKey.replace(/^hero_socket_/,'hero_')+'.png';
  return this.heroWeaponSocketProject?.sockets?.frames?.[sourceName]||null;
 }

 updateHeroWeaponAttachment(){
  const back=this.playerWeaponBack;
  const front=this.playerWeaponFront;
  const hero=this.playerVisual;
  if(!back || !front || !hero || !hero.active){
   if(back) back.setVisible(false);
   if(front) front.setVisible(false);
   return;
  }

  const placement=this.getHeroWeaponPlacementForCurrentFrame();
  if(!placement){
   back.setVisible(false);
   front.setVisible(false);
   return;
  }

  const variant=placement.variant||'sword_n';
  const weaponMeta=this.heroWeaponSocketProject?.weapon?.variants?.[variant];
  if(!weaponMeta){
   back.setVisible(false);
   front.setVisible(false);
   return;
  }

  const textureKey=`weapon_socket_${variant}`;
  const heroScaleX=hero.scaleX||1;
  const heroScaleY=hero.scaleY||1;
  const sourceW=placement.width||hero.frame?.realWidth||hero.frame?.width||1;
  const sourceH=placement.height||hero.frame?.realHeight||hero.frame?.height||1;
  const heroLeft=hero.x-sourceW*heroScaleX*hero.originX;
  const heroTop=hero.y-sourceH*heroScaleY*hero.originY;
  const socketX=heroLeft+(placement.socketX||0)*heroScaleX;
  const socketY=heroTop+(placement.socketY||0)*heroScaleY;
  const weaponScale=Math.abs(heroScaleX)*(placement.scale??1);
  const originX=(weaponMeta.gripX||0)/Math.max(1,weaponMeta.width||1);
  const originY=(weaponMeta.gripY||0)/Math.max(1,weaponMeta.height||1);
  const rotation=Phaser.Math.DegToRad(placement.rotationDeg||0);

  for(const sprite of [back,front]){
   if(sprite.texture?.key!==textureKey) sprite.setTexture(textureKey);
   sprite.setOrigin(originX,originY);
   sprite.setPosition(socketX,socketY);
   sprite.setScale(weaponScale);
   sprite.setRotation(rotation);
   sprite.setFlipX(!!placement.flipX);
   sprite.setFlipY(!!placement.flipY);
  }

  back.setDepth((hero.depth||20)-0.05);
  front.setDepth((hero.depth||20)+0.05);
  front.clearMask();
  const layer=placement.layer||'front';
  back.setVisible(layer==='back'||layer==='split'||layer==='splitInvert');
  front.setVisible(layer==='front'||layer==='split'||layer==='splitInvert');

  if(layer==='split'||layer==='splitInvert'){
   const radius=Math.max(0,placement.frontRevealRadius||0)*weaponScale;
   this.playerWeaponMaskShape.clear();
   this.playerWeaponMaskShape.fillStyle(0xffffff,1);
   this.playerWeaponMaskShape.fillCircle(socketX,socketY,Math.max(0.01,radius));
   this.playerWeaponFrontMask.setInvertAlpha(layer==='splitInvert');
   front.setMask(this.playerWeaponFrontMask);
  }
 }

 setSkillAttackPose(duration){
  this.skillLockUntil=Math.max(this.skillLockUntil||0,this.time.now+duration);
  this.playerAttackDir=this.playerDir||'down';
  this.startHeroSpinAttack(duration);
 }

 consumeShieldBlock(enemy){
  if(!enemy || enemy.type!=='shield' || !enemy.active || enemy.hp<=0) return false;
  const now=this.time.now;
  if(!enemy.blockNext && now>=(enemy.blockReadyAt||0)) enemy.blockNext=true;
  if(!enemy.blockNext) return false;

  enemy.blockNext=false;
  enemy.blockReadyAt=now+BALANCE.SHIELD_BLOCK_RESET_MS;
  if(enemy.visual && enemy.visual.active){
   enemy.visual.setTint(0xffffff);
   this.time.delayedCall(120,()=>{ if(enemy.visual && enemy.visual.active) enemy.visual.clearTint(); });
  }
  return true;
 }

 applySkillDamage(enemy,baseDamage,source,tint=0xffd77a,knockback=105){
  if(!enemy || !enemy.active || enemy.hp<=0) return false;
  if(this.consumeShieldBlock(enemy)) return false;
  const resolved=this.getSwordDamageAgainst ? this.getSwordDamageAgainst(enemy,baseDamage) : baseDamage;
  const killed=this.damageEnemy(enemy,resolved,source,tint);
  if(!killed && enemy.body && enemy.body.enable && enemy.active){
   const angle=Phaser.Math.Angle.Between(this.player.x,this.player.y,enemy.x,enemy.y);
   this.applyEnemyHitReaction(enemy,angle,knockback);
  }
  return killed;
 }

 castGroundTremor(){
  const radius=190;
  // Ground Tremor is primarily an escape / space-making tool, not a damage nuke.
  const damage=this.getEffectiveMeleeDamage()*0.4;
  const maxPushDistance=220;
  const pushMs=430;
  this.setSkillAttackPose(520);
  const x=this.player.x,y=this.player.y;
  const core=this.add.circle(x,y,34,0xe0b85d,0.18).setStrokeStyle(4,0xf5d98c,0.92).setDepth(18);
  const wave=this.add.circle(x,y,64,0x6b4d2b,0.06).setStrokeStyle(6,0xd5a84f,0.86).setDepth(17);
  this.tweens.add({targets:core,scale:1.8,alpha:0,duration:300,onComplete:()=>core.destroy()});
  this.tweens.add({targets:wave,scale:radius/64,alpha:0,duration:380,ease:'Quad.easeOut',onComplete:()=>wave.destroy()});
  this.cameras.main.shake(220,0.008);
  for(const enemy of this.enemies){
   if(!enemy.active || enemy.hp<=0) continue;
   const d=Phaser.Math.Distance.Between(x,y,enemy.x,enemy.y);
   if(d>radius+(enemy.hitRadius||0)) continue;

   this.applySkillDamage(enemy,damage,'skill:tremor',0xffd77a,0);
   if(!enemy.active || enemy.hp<=0 || !enemy.body) continue;

   // Strong in the centre, progressively softer near the edge. Enemy class then
   // modifies the displacement so heavy targets keep their identity.
   let resistance={skeleton:1.0,mage:0.70,shield:0.55,champion:0.18}[enemy.type] ?? 0.75;
   if(enemy.type==='champion' && enemy.championKind==='shieldWarden') resistance=0.12;
   if(enemy.type==='champion' && enemy.championKind==='hollowTree') resistance=0;
   if(resistance<=0) continue;

   const angle=d>1
    ? Phaser.Math.Angle.Between(x,y,enemy.x,enemy.y)
    : Phaser.Math.FloatBetween(-Math.PI,Math.PI);
   const normalized=Phaser.Math.Clamp(d/Math.max(1,radius),0,1);
   const falloff=Phaser.Math.Linear(1.0,0.28,normalized);
   const pushDistance=maxPushDistance*falloff*resistance;
   const pushSpeed=(pushDistance/(pushMs/1000));
   enemy.skillTremorVX=Math.cos(angle)*pushSpeed;
   enemy.skillTremorVY=Math.sin(angle)*pushSpeed;
   enemy.skillTremorUntil=this.time.now+pushMs;
   enemy.staggerUntil=Math.max(enemy.staggerUntil||0,enemy.skillTremorUntil+500);
   enemy.body.setVelocity(enemy.skillTremorVX,enemy.skillTremorVY);
  }
 }

 castLift(){
  const radius=175;
  const initialDamage=this.getEffectiveMeleeDamage()*0.75;
  const landingDamage=this.getEffectiveMeleeDamage()*0.75;
  this.setSkillAttackPose(650);
  const x=this.player.x,y=this.player.y;
  const field=this.add.circle(x,y,58,0x75b7ff,0.09).setStrokeStyle(4,0x9dd7ff,0.82).setDepth(16);
  this.tweens.add({targets:field,scale:radius/58,alpha:0,duration:560,ease:'Sine.easeOut',onComplete:()=>field.destroy()});
  this.cameras.main.shake(200,0.007);

  let longestLiftMs=0;
  for(const enemy of this.enemies){
   if(!enemy.active || enemy.hp<=0) continue;
   const d=Phaser.Math.Distance.Between(x,y,enemy.x,enemy.y);
   if(d>radius+(enemy.hitRadius||0)) continue;

   // Hollow Tree is rooted into the arena: Lift can hurt it, but cannot launch,
   // stagger or otherwise disable its AI.
   if(enemy.type==='champion' && enemy.championKind==='hollowTree'){
    const resolved=this.getSwordDamageAgainst(enemy,initialDamage);
    this.damageEnemy(enemy,resolved,'skill:lift',0x9dd7ff);
    continue;
   }

   this.applySkillDamage(enemy,initialDamage,'skill:lift',0x9dd7ff,16);
   if(!enemy.active || enemy.hp<=0) continue;

   let liftMs=1200;
   let heightMin=118,heightMax=146;
   let drift=24;
   let landingKnockback=100;
   if(enemy.type==='shield'){
    liftMs=650;
    heightMin=72;heightMax=92;drift=15;landingKnockback=70;
   } else if(enemy.type==='champion'){
    liftMs=300;
    heightMin=28;heightMax=40;drift=7;landingKnockback=18;
   }
   longestLiftMs=Math.max(longestLiftMs,liftMs);

   enemy.skillLiftStartAt=this.time.now;
   enemy.skillLiftUntil=this.time.now+liftMs;
   enemy.skillLiftHeight=Phaser.Math.Between(heightMin,heightMax);
   enemy.skillLiftDriftX=Phaser.Math.Between(-drift,drift);
   enemy.skillLiftDriftY=Phaser.Math.Between(-Math.max(4,Math.round(drift*0.6)),Math.max(4,Math.round(drift*0.6)));
   enemy.skillLiftMotion=enemy.type==='champion' ? 0 : Phaser.Math.Between(0,2);
   enemy.skillLiftTilt=Phaser.Math.FloatBetween(-0.32,0.32);
   enemy.staggerUntil=Math.max(enemy.staggerUntil||0,enemy.skillLiftUntil+(enemy.type==='champion'?40:160));
   if(enemy.body) enemy.body.setVelocity(enemy.skillLiftDriftX,enemy.skillLiftDriftY);

   this.time.delayedCall(liftMs,()=>{
    if(!enemy || !enemy.active || enemy.hp<=0) return;
    enemy.skillLiftUntil=0;
    if(enemy.visual && enemy.visual.active){
     enemy.visual.setRotation(0);
     enemy.visual.setScale(enemy.visualBaseScale||enemy.visual.scaleX||0.5);
    }
    this.applySkillDamage(enemy,landingDamage,'skill:lift-landing',0xb9e5ff,landingKnockback);
    const impact=this.add.circle(enemy.x,enemy.y,18,0x9dd7ff,0.12).setStrokeStyle(3,0xd9f1ff,0.8).setDepth(17);
    this.tweens.add({targets:impact,scale:2.15,alpha:0,duration:260,onComplete:()=>impact.destroy()});
   });
  }

  if(longestLiftMs>0){
   this.time.delayedCall(longestLiftMs,()=>{
    if(!this.gameOver) this.cameras.main.shake(210,0.007);
   });
  }
 }

 castSpin(){
  const radius=132;
  const perHit=this.getEffectiveMeleeDamage()*0.55;
  const x0=this.player.x,y0=this.player.y;
  this.setSkillAttackPose(760);
  for(let hit=0;hit<4;hit++){
   this.time.delayedCall(hit*165,()=>{
    if(this.gameOver) return;
    const x=this.player.x,y=this.player.y;
    const ring=this.add.circle(x,y,46,0xe1c575,0.04).setStrokeStyle(5,0xf0cf78,0.78).setDepth(18);
    this.tweens.add({targets:ring,scale:radius/46,alpha:0,duration:180,ease:'Quad.easeOut',onComplete:()=>ring.destroy()});
    for(const enemy of this.enemies){
     if(!enemy.active || enemy.hp<=0) continue;
     const d=Phaser.Math.Distance.Between(x,y,enemy.x,enemy.y);
     if(d<=radius+(enemy.hitRadius||0)) this.applySkillDamage(enemy,perHit,`skill:spin-${hit+1}`,0xffe197,70);
    }
   });
  }
 }

 markEnemyDefeated(enemy){
  if(!enemy || !enemy.active) return false;
  enemy.hp=0;
  enemy.attackAnimUntil=0;
  enemy.staggerUntil=0;
  if(enemy.body){
   enemy.body.setVelocity(0,0);
   enemy.body.enable=false;
  }
  return true;
 }

 damageEnemy(enemy,amount,source='effect',tint=0x8cff77){
  if(!enemy || !enemy.active || enemy.hp<=0 || amount<=0) return false;

  const applied=Math.max(1,Math.round(amount));
  enemy.hp-=applied;
  if(enemy.hp<=0) this.markEnemyDefeated(enemy);

  // Special/relic damage was previously almost invisible, so working DOTs
  // looked broken. A small throttled tick makes every proc testable in-game.
  const now=this.time.now;
  if(now-(enemy.lastSpecialDamageFxAt||-99999)>=240){
   enemy.lastSpecialDamageFxAt=now;

   if(enemy.visual && enemy.visual.active){
    enemy.visual.setTint(tint);
    this.time.delayedCall(85,()=>{
     if(enemy.visual && enemy.visual.active) enemy.visual.clearTint();
    });
   }

   const tick=lkAddText(this,
    enemy.x,enemy.y-24,`-${applied}`,
    {
     fontSize:'11px',
     color:source.includes('poison') || source.includes('curse') ? '#76ff83' : '#ffe6a6',
     stroke:'#101510',
     strokeThickness:2
    }
   ).setOrigin(0.5).setDepth(35);

   this.tweens.add({
    targets:tick,
    y:tick.y-13,
    alpha:0,
    duration:330,
    onComplete:()=>tick.destroy()
   });
  }

  return enemy.hp<=0;
 }

 finalizeEnemyDeath(enemy,time=this.time.now){
  if(!enemy || !enemy.active || enemy.hp>0 || enemy.deathFinalized) return false;
  enemy.deathFinalized=true;
  this.markEnemyDefeated(enemy);

  const deathX=enemy.x;
  const deathY=enemy.y;
  const enemyType=enemy.type;
  const orbCount=enemyType==='champion' ? 0 : 1;

  for(let i=0;i<orbCount;i++){
   const offsetX=Phaser.Math.Between(-18,18);
   const offsetY=Phaser.Math.Between(-18,18);
   const dropPos=this.findNearestFreeGroundPoint(deathX+offsetX,deathY+offsetY,20,520,16);
   const orb=this.add.image(dropPos.x,dropPos.y,'xp_crystal').setDepth(12);
   this.physics.add.existing(orb);
   this.orbs.push(orb);
  }

  if(enemyType!=='champion'){
   const lowHp=this.player && this.player.hp<BALANCE.HEART_PITY_HP_THRESHOLD;
   if(lowHp) this.heartPityKills=(this.heartPityKills||0)+1;
   else this.heartPityKills=0;

   const pityBonus=lowHp
    ? Math.max(0,(this.heartPityKills-BALANCE.HEART_PITY_START_KILLS))*BALANCE.HEART_PITY_STEP
    : 0;
   const heartChance=Math.min(BALANCE.HEART_PITY_MAX_CHANCE,BALANCE.HEART_BASE_CHANCE+pityBonus);

   if(Math.random()<heartChance){
    const heartPos=this.findNearestFreeGroundPoint(deathX,deathY,20,520,16);
    const heart=this.add.image(heartPos.x,heartPos.y,'health_heart').setDepth(12);
    this.physics.add.existing(heart);
    heart.expiresAt=time+30000;
    this.hearts.push(heart);
    this.heartPityKills=0;
   }
  }

  this.onEnemyKilled(enemy,deathX,deathY);
  if(enemyType==='champion') this.onChampionDefeated(enemy);
  this.createDeathBurst(enemy,deathX,deathY);

  if(enemy.visual && enemy.visual.active) enemy.visual.destroy();
  if(enemy.auraVisual && enemy.auraVisual.active) enemy.auraVisual.destroy();
  if(enemy.reflectVisual && enemy.reflectVisual.active) enemy.reflectVisual.destroy();
  this.destroyEnemyReadabilityShadow(enemy);

  enemy.destroy();
  this.kills++;
  return true;
 }

 cleanupDefeatedEnemies(time=this.time.now){
  let finalized=false;
  for(const enemy of [...this.enemies]){
   if(enemy && enemy.active && enemy.hp<=0){
    finalized=this.finalizeEnemyDeath(enemy,time) || finalized;
   }
  }
  this.enemies=this.enemies.filter(enemy=>enemy && enemy.active);
  return finalized;
 }

 applyPlayerRootSlow(duration=1450,factor=0.45){
  this.playerSlowUntil=Math.max(this.playerSlowUntil||0,this.time.now+duration);
  this.playerSlowFactor=Math.min(this.playerSlowFactor||1,factor);

  if(this.playerVisual && this.playerVisual.active){
   this.playerVisual.setTint(0xb4d97d);
   this.time.delayedCall(duration,()=>{
    if(
     this.playerVisual &&
     this.playerVisual.active &&
     this.time.now>=this.playerSlowUntil
    ){
     this.playerVisual.clearTint();
     this.playerSlowFactor=1;
    }
   });
  }

  const txt=lkAddText(this,
   this.player.x,this.player.y-48,'ROOTED',
   {fontSize:'14px',color:'#c9ee8e',stroke:'#13200d',strokeThickness:3}
  ).setOrigin(0.5).setDepth(40);

  this.tweens.add({
   targets:txt,y:txt.y-18,alpha:0,duration:650,
   onComplete:()=>txt.destroy()
  });
 }

 applyPlayerForcedMotion(vx,vy,duration=190){
  this.playerForcedVX=vx;
  this.playerForcedVY=vy;
  this.playerForcedUntil=Math.max(
   this.playerForcedUntil||0,
   this.time.now+duration
  );
 }

 damagePlayer(amount,source='enemy'){
  if(this.devFlags?.godMode) return false;
  if(this.gameOver || amount<=0) return false;
  const now=this.time.now;
  if(now<(this.playerInvulnerableUntil||0)) return false;

  if(
   this.championRelics.has('shieldFragment') &&
   now-this.lastShieldRelicBlockAt>=BALANCE.SHIELD_RELIC_COOLDOWN_MS
  ){
   this.lastShieldRelicBlockAt=now;
   const block=this.add.circle(this.player.x,this.player.y,22,0xe6f1ff,0.18)
    .setStrokeStyle(4,0xe6f1ff,0.95).setDepth(30);
   this.tweens.add({targets:block,scale:1.9,alpha:0,duration:260,onComplete:()=>block.destroy()});
   return false;
  }

  let finalDamage=amount;
  if(this.championRelics.has('ironWill') && this.player.hp<=35){
   finalDamage=Math.max(1,Math.round(finalDamage*0.70));
  }

  if(this.championRelics.has('necromancerSoul')){
   this.killStreakBonus=0;
  }

  if(
   this.championRelics.has('fallenBlessing') &&
   !this.fallenBlessingUsed &&
   this.player.hp-finalDamage<=0
  ){
   this.fallenBlessingUsed=true;
   this.playerInvulnerableUntil=now+BALANCE.PLAYER_IFRAME_MS;
   this.player.hp=30;
   this.updateLowHealthState();
   this.applyPlayerHitFeedback(finalDamage);
   this.playHeroHitSfx();
   this.cameras.main.flash(320,255,230,160,false);
   this.showWaveBanner('FALLEN BLESSING','Death refused — 30 HP restored','#fff0b0');
   return false;
  }

  this.playerInvulnerableUntil=now+BALANCE.PLAYER_IFRAME_MS;
  this.player.hp=Math.max(0,this.player.hp-finalDamage);
  this.updateLowHealthState();
  this.applyPlayerHitFeedback(finalDamage);
  this.playHeroHitSfx();

  if(this.player.hp<=0){
   this.endRun();
   return true;
  }
  return false;
 }

 spawnBrokenSaintReflectSpark(x,y){
  const spark=this.add.sprite(
   x+Phaser.Math.Between(-10,10),
   y+Phaser.Math.Between(-8,8),
   'broken_saint_reflect_spark_00'
  ).setOrigin(0.5).setDisplaySize(38,38).setDepth(24);
  spark.play('broken_saint_reflect_spark');
  spark.once(Phaser.Animations.Events.ANIMATION_COMPLETE,()=>{
   if(spark.active) spark.destroy();
  });
 }

 getSwordDamageAgainst(enemy,baseDamage){
  if(this.devFlags?.oneHitKill && enemy?.maxHp) return Math.max(enemy.hp||0,enemy.maxHp*2);
  let damage=baseDamage;

  if(this.championRelics.has('mercySeal') && enemy.maxHp && enemy.hp/enemy.maxHp<=0.30){
   damage*=1.25;
  }

  if(this.championRelics.has('necromancerSoul')){
   damage*=1+Math.min(25,this.killStreakBonus)*0.01;
  }

  if(
   enemy.type==='champion' &&
   enemy.championKind==='brokenSaint' &&
   this.time.now<(enemy.reflectUntil||0)
  ){
   damage*=0.10;
   this.spawnBrokenSaintReflectSpark(enemy.x,enemy.y-8);
   this.damagePlayer(4,'reflection');
  }

  if(
   enemy.type==='champion' &&
   enemy.championKind==='shieldWarden' &&
   this.time.now<(enemy.guardUntil||0)
  ){
   damage*=0.20;
   if(this.time.now-(enemy.lastCounterAt||0)>500){
    enemy.lastCounterAt=this.time.now;
    this.damagePlayer(6,'counter');
   }
  }

  return Math.max(1,Math.round(damage));
 }

 playHeroSwordAttackSfx(){ return AudioManager.prototype.playHeroSwordAttackSfx.call(this); }
 playHeroDeathSfx(){ return AudioManager.prototype.playHeroDeathSfx.call(this); }
 playHeroHitSfx(){ return AudioManager.prototype.playHeroHitSfx.call(this); }
 playSkillSfx(key,volume=0.42){ return AudioManager.prototype.playSkillSfx.call(this,key,volume); }
 startBrokenSaintHolyWarningSfx(){ return AudioManager.prototype.startBrokenSaintHolyWarningSfx.call(this); }
 stopBrokenSaintHolyWarningSfx(){ return AudioManager.prototype.stopBrokenSaintHolyWarningSfx.call(this); }
 playBrokenSaintHolyBeamSfx(){ return AudioManager.prototype.playBrokenSaintHolyBeamSfx.call(this); }
 playHeroSwordImpactSfx(){ return AudioManager.prototype.playHeroSwordImpactSfx.call(this); }
 playSkeletonAttackSfx(time=this.time.now){ return AudioManager.prototype.playSkeletonAttackSfx.call(this,time); }
 playMageCastSfx(time=this.time.now){ return AudioManager.prototype.playMageCastSfx.call(this,time); }

 onSwordAttack(attackCounter){
  if(!this.championRelics.has('holyFragment') || attackCounter%5!==0) return;

  const vectors={
   down:{x:0,y:1,angle:Math.PI/2},
   up:{x:0,y:-1,angle:-Math.PI/2},
   left:{x:-1,y:0,angle:Math.PI},
   right:{x:1,y:0,angle:0}
  };
  const v=vectors[this.playerDir] || vectors.down;
  const length=260;
  const cx=this.player.x+v.x*length/2;
  const cy=this.player.y+v.y*length/2;
  const slash=this.add.rectangle(cx,cy,length,10,0xffefaa,0.62)
   .setRotation(v.angle).setDepth(19);

  this.tweens.add({targets:slash,alpha:0,scaleY:2.2,duration:190,onComplete:()=>slash.destroy()});

  for(const enemy of this.enemies){
   if(!enemy.active) continue;
   const dx=enemy.x-this.player.x;
   const dy=enemy.y-this.player.y;
   const projection=dx*v.x+dy*v.y;
   const lateral=Math.abs(dx*v.y-dy*v.x);
   if(projection>=0 && projection<=length && lateral<=34){
    const killed=this.damageEnemy(enemy,this.getEffectiveMeleeDamage()*0.70,'holyFragment',0xffed9a);
    if(!killed){
     const angle=Phaser.Math.Angle.Between(this.player.x,this.player.y,enemy.x,enemy.y);
     this.applyEnemyHitReaction(enemy,angle,75);
    }
   }
  }
 }

 onSwordHit(enemy){
  if(this.championRelics.has('heavyStrike') && Math.random()<0.20){
   enemy.staggerUntil=Math.max(
    enemy.staggerUntil||0,
    this.time.now+(enemy.type==='champion' ? 180 : 420)
   );

   const shock=this.add.circle(enemy.x,enemy.y,18,0xffffff,0.10)
    .setStrokeStyle(3,0xe8f1ff,0.9).setDepth(23);
   this.tweens.add({
    targets:shock,scale:1.9,alpha:0,duration:190,
    onComplete:()=>shock.destroy()
   });
  }
 }

 createRelicZone(x,y,radius,duration,damage,color,kind){
  const visual=this.add.circle(
   x,y,radius,color,
   kind==='poison' ? 0.18 : 0.11
  ).setStrokeStyle(
   kind==='poison' ? 3 : 2,
   color,
   kind==='poison' ? 0.78 : 0.58
  ).setDepth(9);

  this.relicZones.push({
   x,y,radius,damage,kind,visual,
   expiresAt:this.time.now+duration,
   lastTick:-99999,
   tickEvery:kind==='poison' ? 420 : 500
  });
 }

 updateRelics(time){
  if(this.championRelics.has('soulSkull') && time>=this.nextSoulSkullAt){
   this.nextSoulSkullAt=time+2400;
   let target=null;
   let best=340;
   for(const e of this.enemies){
    if(!e.active || e.hp<=0) continue;
    const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,e.x,e.y);
    if(d<best){ best=d; target=e; }
   }
   if(target && target.hp>0){
    this.damageEnemy(target,this.getEffectiveMeleeDamage()*0.48,'soulSkull',0x69ff87);
    const orb=this.add.circle(this.player.x,this.player.y-24,7,0x69ff87,0.90).setDepth(24);
    this.tweens.add({
     targets:orb,x:target.x,y:target.y-8,duration:220,ease:'Quad.easeIn',
     onComplete:()=>{ if(orb.active) orb.destroy(); }
    });
   }
  }

  if(this.championRelics.has('cursedGround') && time>=this.nextCursedGroundAt){
   this.nextCursedGroundAt=time+30000;
   this.createRelicZone(this.player.x,this.player.y,82,6000,Math.max(4,this.getEffectiveMeleeDamage()*0.18),0x8fd45a,'cursedGround');
  }

  for(const zone of this.relicZones){
   if(!zone.visual || !zone.visual.active) continue;
   if(zone.kind==='cursedGround'){
    zone.x=this.player.x;
    zone.y=this.player.y;
    zone.visual.setPosition(zone.x,zone.y);
   }

   if(time-zone.lastTick>=zone.tickEvery){
    zone.lastTick=time;

    let hitCount=0;
    for(const e of this.enemies){
     if(!e.active || e.hp<=0) continue;

     if(
      Phaser.Math.Distance.Between(e.x,e.y,zone.x,zone.y) <=
      zone.radius+(e.hitRadius||14)*0.35
     ){
      hitCount++;
      this.damageEnemy(
       e,
       zone.damage,
       zone.kind==='poison' ? 'poison' : 'curseAura',
       zone.kind==='poison' ? 0x62ff78 : 0xb4de76
      );
     }
    }

    if(hitCount>0 && zone.visual && zone.visual.active){
     this.tweens.add({
      targets:zone.visual,
      alpha:0.28,
      duration:70,
      yoyo:true
     });
    }
   }

   if(time>=zone.expiresAt){
    zone.visual.destroy();
   }
  }
  this.relicZones=this.relicZones.filter(z=>z.visual && z.visual.active);
 }

 onEnemyKilled(enemy,x,y){
  if(this.championRelics.has('necromancerSoul')){
   this.killStreakBonus=Math.min(25,this.killStreakBonus+1);
  }

  if(this.championRelics.has('greenCurse') && Math.random()<0.22){
   this.createRelicZone(x,y,56,4600,Math.max(3,this.getEffectiveMeleeDamage()*0.16),0x4cff6a,'poison');
  }

  if(this.championRelics.has('rootHeart') && Math.random()<0.22){
   let target=null;
   let best=180;
   for(const e of this.enemies){
    if(!e.active || e.hp<=0 || e===enemy) continue;
    const d=Phaser.Math.Distance.Between(x,y,e.x,e.y);
    if(d<best){ best=d; target=e; }
   }
   if(target && target.hp>0){
    this.damageEnemy(target,this.getEffectiveMeleeDamage()*0.55,'rootHeart',0xb9e27f);
    target.staggerUntil=Math.max(target.staggerUntil||0,this.time.now+220);
    const root=this.add.rectangle(target.x,target.y+8,5,34,0xa8ce6b,0.9).setDepth(17);
    this.tweens.add({targets:root,y:root.y-18,alpha:0,duration:260,onComplete:()=>root.destroy()});
   }
  }
 }

 onChampionDefeated(enemy){
  const kind=enemy.championKind;
  if(kind==='brokenSaint'){
   this.stopBrokenSaintHolyWarningSfx();
   this.stopBrokenSaintMusic();
  }
  this.activeChampion=null;
  if(kind==='brokenSaint') this.setupBackgroundMusic();
  this.championEventActive=false;
  this.championNameText.setVisible(false);
  this.championHpBack.setVisible(false);
  this.championHpFill.setVisible(false);

  this.clearChampionHazards();

  this.cameras.main.flash(300,230,200,110,false);

  // Defeating a champion opens the thematic passage to the next region.
  this.requestWorldAdvance(kind);
  this.openChampionRewards(kind);
 }

 isEnemyVisibleOnScreen(enemy){
  if(!enemy || !enemy.active || enemy.hp<=0) return false;

  const view=this.cameras.main.worldView;
  const radius=enemy.hitRadius||14;

  return (
   enemy.x+radius>=view.left &&
   enemy.x-radius<=view.right &&
   enemy.y+radius>=view.top &&
   enemy.y-radius<=view.bottom
  );
 }

 isEnemyAtNormalSpawnBand(enemy){
  if(!enemy || !enemy.active) return false;

  const view=this.cameras.main.worldView;
  const margin=PURSUIT.NORMAL_SPAWN_BAND;

  // This expanded rectangle corresponds to the same area where normal
  // camera-relative spawns enter the fight.
  return (
   enemy.x>=view.left-margin &&
   enemy.x<=view.right+margin &&
   enemy.y>=view.top-margin &&
   enemy.y<=view.bottom+margin
  );
 }

 updateEmptyScreenRush(){
  // No special acceleration during deliberate calm states.
  if(
   this.gameOver ||
   this.waveIntermission ||
   this.awaitingWorldAdvance ||
   this.levelChoiceOpen ||
   this.championRewardOpen ||
   (this.activeChampion && this.activeChampion.active)
  ){
   this.emptyScreenRushActive=false;
   for(const enemy of this.enemies){
    if(enemy) enemy.emptyScreenRush=false;
   }
   return;
  }

  const livingOrdinary=this.enemies.filter(
   enemy=>
    enemy &&
    enemy.active &&
    enemy.hp>0 &&
    enemy.type!=='champion'
  );

  const visible=livingOrdinary.some(
   enemy=>this.isEnemyVisibleOnScreen(enemy)
  );

  this.emptyScreenRushActive=(
   livingOrdinary.length>0 &&
   !visible
  );

  // Once the screen becomes empty, every currently unseen enemy gets the
  // simple 4x run flag. It keeps that flag until reaching the normal spawn band,
  // even if another enemy reaches the screen first.
  if(this.emptyScreenRushActive){
   for(const enemy of livingOrdinary){
    if(!this.isEnemyAtNormalSpawnBand(enemy)){
     enemy.emptyScreenRush=true;
    }
   }
  }

  // Each enemy independently returns to normal speed at the usual spawn area.
  for(const enemy of livingOrdinary){
   if(
    enemy.emptyScreenRush &&
    this.isEnemyAtNormalSpawnBand(enemy)
   ){
    enemy.emptyScreenRush=false;
   }
  }
 }

 getEnemyMovementSpeed(enemy){
  if(!enemy || enemy.type==='champion') return enemy?.speed||0;

  if(enemy.emptyScreenRush){
   return (enemy.speed||0)*PURSUIT.EMPTY_SCREEN_SPEED_MULTIPLIER;
  }

  return enemy.speed||0;
 }

 configureEnemyCollision(enemy,padding=4){
  if(!enemy || !enemy.body) return;
  const radius=(enemy.hitRadius || 14)+padding;
  const sourceWidth=Number(enemy.width)||radius*2;
  const sourceHeight=Number(enemy.height)||radius*2;
  const offsetX=(sourceWidth-radius*2)/2;
  const offsetY=(sourceHeight-radius*2)/2;
  enemy.body.setCircle(radius,offsetX,offsetY);
 }

 applyBrokenSaintCrowdKeepout(enemy){
  const champ=this.activeChampion;
  if(
   !enemy || !enemy.active || !enemy.body ||
   enemy.type==='champion' ||
   !champ || !champ.active || champ.championKind!=='brokenSaint'
  ) return;

  const minDist=champ.crowdKeepoutRadius || 96;
  const dx=enemy.x-champ.x;
  const dy=enemy.y-champ.y;
  const dist=Math.max(0.001,Math.hypot(dx,dy));
  if(dist>=minDist) return;

  const nx=dx/dist;
  const ny=dy/dist;
  const penetration=minDist-dist;
  // Strong radial separation: even x4-rush enemies cannot sit on the champion.
  const push=240+penetration*12;
  enemy.body.velocity.x+=nx*push;
  enemy.body.velocity.y+=ny*push;
 }

 getDirectionFromVector(dx,dy,fallback='down'){
  if(Math.abs(dx)<1 && Math.abs(dy)<1){
   return fallback;
  }

  if(Math.abs(dx)>Math.abs(dy)){
   return dx<0 ? 'left' : 'right';
  }

  return dy<0 ? 'up' : 'down';
 }

 getEightDirectionFromVector(dx,dy,fallback='down'){
  if(Math.abs(dx)<1 && Math.abs(dy)<1) return fallback;
  const angle=Math.atan2(dy,dx);
  const octant=Math.round(angle/(Math.PI/4));
  const dirs=['right','down_right','down','down_left','left','up_left','up','up_right'];
  return dirs[(octant+8)%8];
 }

 getEnemyVisualPrefix(enemyType){
  if(enemyType==='mage') return 'mage';
  if(enemyType==='shield') return 'shield';
  // Unfinished non-Broken-Saint champions intentionally reuse skeleton animation
  // keys until their dedicated art packs are added.
  if(enemyType==='champion') return 'skeleton';
  return 'skeleton';
 }

 getEnemyAttackAction(enemyType){
  return enemyType==='mage' ? 'cast' : 'attack';
 }

 getWaveProfile(wave){
  const baseInterval=Math.max(760,1050-(wave-1)*18);

  if(wave>1 && wave%5===0){
   return {name:'SURGE',subtitle:'Dense assault',spawnInterval:Math.max(690,baseInterval-110),mageEvery:4,shieldEvery:5,targetBonus:2};
  }
  if(wave>=4 && wave%4===0){
   return {name:'BULWARK',subtitle:'More armored enemies',spawnInterval:baseInterval+50,mageEvery:6,shieldEvery:4,targetBonus:0};
  }
  if(wave>=3 && wave%3===0){
   return {name:'ARCANE PRESSURE',subtitle:'More ranged threats',spawnInterval:baseInterval,mageEvery:4,shieldEvery:7,targetBonus:0};
  }
  return {name:wave===1?'THE OUTSKIRTS':'MIXED ASSAULT',subtitle:wave===1?'The dead are approaching':'Balanced enemy pressure',spawnInterval:baseInterval,mageEvery:5,shieldEvery:6,targetBonus:0};
 }

 showWaveBanner(title,subtitle,color='#fff06a'){
  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.showEventBanner==='function'){
   hudScene.showEventBanner(title,subtitle,color);
   return;
  }
  for(const obj of this.waveBannerObjects){ if(obj && obj.destroy) obj.destroy(); }
  this.waveBannerObjects=[];
  const {cx,cy}=this.getUiMetrics();
  const titleText=lkAddText(this,cx,cy-65,title,{fontSize:'34px',color,stroke:'#101610',strokeThickness:5}).setOrigin(0.5).setDepth(190).setScrollFactor(0).setAlpha(0);
  const subText=lkAddText(this,cx,cy-25,subtitle,{fontSize:'16px',color:'#ffffff',stroke:'#101610',strokeThickness:3}).setOrigin(0.5).setDepth(190).setScrollFactor(0).setAlpha(0);
  this.waveBannerObjects=[titleText,subText];
  this.tweens.add({targets:[titleText,subText],alpha:1,duration:180,hold:850,yoyo:true,onComplete:()=>{
   for(const obj of this.waveBannerObjects){ if(obj && obj.active) obj.destroy(); }
   this.waveBannerObjects=[];
  }});
 }

 startWave(wave,initial=false){
  this.wave=wave;
  this.spawned=0;
  this.waveIntermission=false;
  this.waveProfile=this.getWaveProfile(wave);
  const championKind=this.getChampionForWave(wave);
  this.championEventActive=Boolean(championKind);
  this.waveSpawnInterval=this.calculateWaveSpawnInterval(this.waveProfile);
  this.waveTarget=this.calculateWaveTarget(wave,this.waveProfile,championKind);

  this.waveText.setText(`WAVE ${wave}`);
  this.waveSubText.setText(championKind ? 'CHAMPION EVENT' : this.waveProfile.name);
  if(!initial) this.lastSpawn=this.time.now-250;

  if(championKind){
   const def=this.getChampionDefinition(championKind);
   const region=this.getWorldProgressName();
   this.showWaveBanner(
    'CHAMPION APPROACHES',
    `${def.name} · ${region} · ordinary enemies -30%`,
    def.rewardColor
   );
   this.time.delayedCall(1100,()=>{
    if(!this.gameOver && this.wave===wave){
     this.spawnChampion(championKind);
    }
   });
  } else {
   this.showWaveBanner(`WAVE ${wave}`,`${this.waveProfile.name} · ${this.waveProfile.subtitle}`);
  }
 }

 beginWaveIntermission(time){
  if(this.waveIntermission) return;
  this.waveIntermission=true;
  this.nextWaveAt=time+2200;
  this.waveSubText.setText('BREATHER');
  this.showWaveBanner('WAVE CLEARED','Next assault in 2 seconds','#bfe8ff');
 }

 applyEnemyHitReaction(enemy,angle,baseForce=120){
  if(!enemy || !enemy.active || !enemy.body) return;
  let resistance={skeleton:1.0,mage:0.88,shield:0.48,champion:0.30}[enemy.type] || 0.75;
  let staggerMs={skeleton:135,mage:120,shield:85,champion:60}[enemy.type] || 100;

  if(enemy.type==='champion'){
   if(enemy.championKind==='shieldWarden'){
    resistance=0.16;
    staggerMs=45;
   } else if(enemy.championKind==='hollowTree'){
    resistance=0;
    staggerMs=30;
   }
  }
  const force=baseForce*resistance;
  enemy.knockbackVX=Math.cos(angle)*force;
  enemy.knockbackVY=Math.sin(angle)*force;
  enemy.staggerUntil=Math.max(enemy.staggerUntil||0,this.time.now+staggerMs);
  enemy.body.setVelocity(enemy.knockbackVX,enemy.knockbackVY);

  if(enemy.visual && enemy.visual.active){
   const base=enemy.visualBaseScale || 0.5;
   this.tweens.add({targets:enemy.visual,scaleX:base*1.08,scaleY:base*0.92,duration:45,yoyo:true,ease:'Sine.easeOut',onComplete:()=>{
    if(enemy.visual && enemy.visual.active) enemy.visual.setScale(base);
   }});
  }
 }

 applyPlayerHitFeedback(damage){
  if(!this.playerVisual || !this.playerVisual.active) return;
  this.playerVisual.setTint(0xff8d8d);
  this.time.delayedCall(90,()=>{ if(this.playerVisual && this.playerVisual.active) this.playerVisual.clearTint(); });
  if(this.time.now-this.lastPlayerHitAt>90){
   this.cameras.main.shake(45,0.0024);
   this.lastPlayerHitAt=this.time.now;
  }
  const dmg=lkAddText(this,this.player.x+Phaser.Math.Between(-8,8),this.player.y-34,`-${damage}`,{fontSize:'15px',color:'#ffb0a6',stroke:'#351010',strokeThickness:3})
   .setOrigin(0.5).setDepth(70);
  this.tweens.add({targets:dmg,y:dmg.y-22,alpha:0,duration:520,ease:'Quad.easeOut',onComplete:()=>dmg.destroy()});
 }

 createDeathBurst(enemy,x,y){
  const color={skeleton:0xc7b8a0,mage:0x68ff87,shield:0xb8aa91,champion:0xd58cff}[enemy.type] || 0xffffff;
  for(let i=0;i<5;i++){
   const p=this.add.circle(x,y-8,Phaser.Math.Between(2,4),color,0.80).setDepth(18);
   const angle=(Math.PI*2*i/5)+Phaser.Math.FloatBetween(-0.25,0.25);
   const distance=Phaser.Math.Between(18,34);
   this.tweens.add({targets:p,x:x+Math.cos(angle)*distance,y:y-8+Math.sin(angle)*distance,alpha:0,scale:0.35,duration:Phaser.Math.Between(220,340),ease:'Quad.easeOut',onComplete:()=>p.destroy()});
  }
 }

 getXpRequiredForLevel(level=this.level){
  return BALANCE.XP_BASE+Math.max(0,level-1)*BALANCE.XP_PER_LEVEL;
 }

 grantXp(amount){
  if(amount<=0) return false;
  this.xp+=amount;
  const required=this.getXpRequiredForLevel();
  if(this.xp>=required){
   this.xp-=required;
   this.applyLevelUp();
   return true;
  }
  return false;
 }

 applyLevelUp(){
  this.level++;
  this.openLevelChoices();
 }

 openLevelChoices(){
  if(this.levelChoiceOpen) return;

  this.levelChoiceOpen=true;
  this.setGameplayPaused('levelChoice',true);

  const choices=[];
  if(this.meleeAttack.damage<BALANCE.SWORD_DAMAGE_CAP){
   choices.push(['⚔ Sword Damage +3',()=>{
    this.weaponLevels.sword++;
    this.meleeAttack.level=this.weaponLevels.sword;
    this.meleeAttack.damage=Math.min(BALANCE.SWORD_DAMAGE_CAP,this.meleeAttack.damage+BALANCE.SWORD_DAMAGE_STEP);
   }]);
  }
  if(this.meleeAttack.cooldown>BALANCE.SWORD_COOLDOWN_CAP){
   choices.push(['⚡ Sword Speed +12%',()=>{
    this.weaponLevels.sword++;
    this.meleeAttack.level=this.weaponLevels.sword;
    this.meleeAttack.cooldown=Math.max(BALANCE.SWORD_COOLDOWN_CAP,Math.round(this.meleeAttack.cooldown*BALANCE.SWORD_SPEED_FACTOR));
   }]);
  }
  if(this.meleeAttack.radius<BALANCE.SWORD_RADIUS_CAP){
   choices.push(['🌀 Sword Radius +18',()=>{
    this.weaponLevels.sword++;
    this.meleeAttack.level=this.weaponLevels.sword;
    this.meleeAttack.radius=Math.min(BALANCE.SWORD_RADIUS_CAP,this.meleeAttack.radius+BALANCE.SWORD_RADIUS_STEP);
   }]);
  }

  if(choices.length===0){
   this.levelChoiceOpen=false;
   this.setGameplayPaused('levelChoice',false);
   this.showWaveBanner('WEAPON MAXED','All sword upgrades reached their cap','#ffe49b');
   return;
  }

  this.currentLevelChoices=choices;

  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.showLevelChoices==='function'){
   hudScene.showLevelChoices(this.level,choices.map(([label])=>label));
   this.levelChoiceObjects=[];
   return;
  }

  const {cx,cy}=this.getUiMetrics();
  const panel=this.add.rectangle(cx,cy,520,260,0x000000,0.85).setDepth(200).setScrollFactor(0);
  const title=lkAddText(this,cx,cy-95,`LEVEL ${this.level} - CHOOSE UPGRADE`,{fontSize:'26px',color:'#fff06a'})
   .setOrigin(0.5).setDepth(201).setScrollFactor(0);

  this.levelChoiceObjects=[panel,title];

  choices.forEach((c,i)=>{
   const b=lkAddText(this,
    cx,cy-45+i*55,c[0],
    {
     fontSize:'22px',
     color:'#ffffff',
     backgroundColor:'#263b22',
     padding:{x:16,y:8}
    }
   )
   .setOrigin(0.5)
   .setDepth(202)
   .setInteractive({useHandCursor:true});

   b.setScrollFactor(0);
   b.on('pointerdown',()=>this.selectLevelChoice(i));

   this.levelChoiceObjects.push(b);
  });
 }

 selectLevelChoice(index){
  if(!this.levelChoiceOpen) return;
  const choice=this.currentLevelChoices[index];
  if(!choice) return;
  choice[1]();
  this.closeLevelChoices();
 }

 closeLevelChoices(){
  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.hideLevelChoices==='function') hudScene.hideLevelChoices();

  for(const o of this.levelChoiceObjects){
   if(o && o.destroy) o.destroy();
  }

  this.levelChoiceObjects=[];
  this.currentLevelChoices=[];
  this.levelChoiceOpen=false;
  this.setGameplayPaused('levelChoice',false);

  const txt=lkAddText(this,
   this.player.x,this.player.y-55,
   `LEVEL ${this.level}!`,
   {fontSize:'18px',color:'#fff06a'}
  ).setOrigin(0.5).setDepth(80);

  this.tweens.add({
   targets:txt,
   y:txt.y-35,
   alpha:0,
   duration:900,
   onComplete:()=>txt.destroy()
  });
 }

 freezeCombatForDeath(){
  try{this.physics.world.pause();}catch{}
  if(this.player?.body) this.player.body.setVelocity(0,0);

  for(const enemy of this.enemies){
   if(!enemy?.active) continue;
   if(enemy.body) enemy.body.setVelocity(0,0);
   enemy.pendingMeleeHitAt=0;
   enemy.pendingMeleeDamage=0;
   enemy.pendingMeleeRange=0;
   if(enemy.visual?.anims?.isPlaying) enemy.visual.anims.pause();
   if(enemy.auraVisual?.anims?.isPlaying) enemy.auraVisual.anims.pause();
   if(enemy.reflectVisual?.anims?.isPlaying) enemy.reflectVisual.anims.pause();
  }

  for(const projectile of this.projectiles){
   if(!projectile?.active) continue;
   if(projectile.body) projectile.body.setVelocity(0,0);
   if(projectile.anims?.isPlaying) projectile.anims.pause();
  }

  for(const hazard of this.championHazards){
   if(hazard?.visual?.anims?.isPlaying) hazard.visual.anims.pause();
   if(hazard?.beamVisual?.anims?.isPlaying) hazard.beamVisual.anims.pause();
  }

  if(this.activeAttackFx?.active){
   this.activeAttackFx.destroy();
   this.activeAttackFx=null;
  }
 }

 launchDeathSword(){
  const front=this.playerWeaponFront;
  const back=this.playerWeaponBack;
  const source=front?.visible ? front : (back?.visible ? back : (front||back));
  if(!source?.texture?.key) return;

  const sword=this.add.sprite(source.x,source.y,source.texture.key)
   .setOrigin(source.originX,source.originY)
   .setScale(source.scaleX,source.scaleY)
   .setRotation(source.rotation)
   .setFlipX(source.flipX)
   .setFlipY(source.flipY)
   .setDepth((this.playerVisual?.depth||20)+0.4);
  sword.clearMask();
  this.deathSword=sword;

  if(back) back.setVisible(false).clearMask();
  if(front) front.setVisible(false).clearMask();

  // Default death art ends with the head to screen-right. Mirror flips that side,
  // so throw the sword in the opposite direction for a clearer silhouette.
  const dir=this.deathFlipX ? 1 : -1;
  const startX=sword.x;
  const startY=sword.y;
  const groundY=this.player.y+10;
  const spin=dir*Phaser.Math.DegToRad(520);

  this.tweens.add({
   targets:sword,
   x:startX+dir*62,
   y:startY-58,
   rotation:sword.rotation+spin*0.42,
   duration:330,
   ease:'Quad.easeOut',
   onComplete:()=>{
    if(!sword.active) return;
    this.tweens.add({
     targets:sword,
     x:startX+dir*128,
     y:groundY,
     rotation:sword.rotation+spin*0.58,
     duration:570,
     ease:'Quad.easeIn',
     onComplete:()=>{
      if(!sword.active) return;
      this.tweens.add({
       targets:sword,
       y:groundY-2,
       duration:70,
       yoyo:true,
       ease:'Sine.easeOut'
      });
     }
    });
   }
  });
 }

 finishDeathSequence(){
  if(!this.gameOver || this.gameOverUiReady) return;
  this.deathSequenceActive=false;
  this.gameOverUiReady=true;
  this.gameOverPanel.setVisible(true);
  this.gameOverText.setText(
   `GAME OVER\nWave ${this.wave}  •  Kills ${this.kills}\nPress R to restart`
  ).setVisible(true);
 }

 endRun(){
  if(this.gameOver) return;

  // Set gameOver immediately: every existing attack/cast callback that checks it
  // is silenced now. The visible death UI is deliberately delayed below.
  this.gameOver=true;
  this.gameOverUiReady=false;
  this.deathSequenceActive=true;
  this.stopCriticalHeartbeat(false);
  this.stopBrokenSaintHolyWarningSfx();
  this.playHeroDeathSfx();
  this.freezeCombatForDeath();

  // One random orientation for the complete six-frame sequence.
  this.deathFlipX=Math.random()<0.5;
  this.launchDeathSword();

  if(this.playerVisual?.active){
   this.playerVisual.clearTint();
   this.playerVisual.stop();
   this.playerVisual
    .setPosition(this.player.x,this.player.y)
    .setOrigin(0.5,0.78)
    .setScale(HERO_DEATH_VISUAL_SCALE)
    .setFlipX(this.deathFlipX)
    .setFlipY(false)
    .setTexture('hero_death_01')
    .play('hero_death',true);
   this.playerVisualState='hero_death';
  }

  if(this.playerShadow?.active){
   this.playerShadow.setVisible(true);
   const hideShadowAt=HERO_DEATH_ANIMATION_MS*(2/HERO_DEATH_FRAME_COUNT);
   this.time.delayedCall(hideShadowAt,()=>{
    if(this.gameOver && this.playerShadow?.active) this.playerShadow.setVisible(false);
   });
  }

  // 3 seconds falling, then 1 second motionless on the final frame.
  this.time.delayedCall(HERO_DEATH_ANIMATION_MS,()=>{
   if(!this.gameOver || !this.playerVisual?.active) return;
   this.playerVisual.stop();
   this.playerVisual.setTexture('hero_death_06');
  });
  this.time.delayedCall(HERO_DEATH_ANIMATION_MS+HERO_DEATH_HOLD_MS,()=>{
   this.finishDeathSequence();
  });
 }

 update(time){
  this.syncOrientationPause();
  this.updateLowHealthState();
  this.devTools?.update();
  if(this.storyDirector?.update(time)) return;
  if(this.gameplayPaused || this.levelChoiceOpen || this.championRewardOpen) return;

  // Scene Clock pauses with gameplay overlays, unlike the global update timestamp.
  // Using it here prevents cooldowns/waves/mana from jumping forward after a menu.
  time=this.time.now;

  if(this.gameOver){
   if(this.gameOverUiReady && Phaser.Input.Keyboard.JustDown(this.restartKey)){
    this.scene.restart();
   }
   return;
  }

  this.updateMana(time);

  if(Phaser.Input.Keyboard.JustDown(this.skillKeys.skill1)) this.handleSkillInput(1);
  if(Phaser.Input.Keyboard.JustDown(this.skillKeys.skill2)) this.handleSkillInput(2);
  if(Phaser.Input.Keyboard.JustDown(this.skillKeys.skill3)) this.handleSkillInput(3);

  // Keep world lists accurate before progression checks.
  this.enemies=this.enemies.filter(e=>e && e.active);

  let vx=0,vy=0;
  let s=BALANCE.PLAYER_SPEED;

  if(time<this.playerSlowUntil){
   s*=this.playerSlowFactor||0.45;
  } else {
   this.playerSlowFactor=1;
  }

  if(time<this.playerForcedUntil){
   vx=this.playerForcedVX||0;
   vy=this.playerForcedVY||0;
  } else {
   if(this.keys.A.isDown||this.cursors.left.isDown)vx=-s;
   if(this.keys.D.isDown||this.cursors.right.isDown)vx=s;
   if(this.keys.W.isDown||this.cursors.up.isDown)vy=-s;
   if(this.keys.S.isDown||this.cursors.down.isDown)vy=s;
   if(vx===0 && vy===0 && Math.abs(this.mobileMoveX)+Math.abs(this.mobileMoveY)>0.01){
    vx=this.mobileMoveX*s;
    vy=this.mobileMoveY*s;
   }
   const moveMagnitude=Math.hypot(vx,vy);
   if(moveMagnitude>s && moveMagnitude>0){
    vx=vx/moveMagnitude*s;
    vy=vy/moveMagnitude*s;
   }
  }

  this.player.body.setVelocity(vx,vy);

  this.playerVisual.setPosition(
   this.player.x,
   this.player.y
  );

  if(this.activeAttackFx && this.activeAttackFx.active){
   this.activeAttackFx.setPosition(
    this.player.x,
    this.player.y
   );
  }

  this.updateReadabilityLayers();

  const playerMoving=Math.abs(vx)+Math.abs(vy)>0;
  this.playerDir=this.getDirectionFromVector(
   vx,
   vy,
   this.playerDir
  );
  this.playerVisualDir8=this.getHeroSocketDirectionFromVector(
   vx,
   vy,
   this.playerVisualDir8||'s'
  );

  if(time>=this.playerAttackUntil){
   const nextPlayerKey=`hero_socket_${
    playerMoving ? 'walk' : 'idle'
   }_${this.playerVisualDir8}`;

   if(this.playerVisualState!==nextPlayerKey){
    this.playerVisualState=nextPlayerKey;
    this.playerVisual.play(nextPlayerKey,true);
   }
  }
  this.updateHeroWeaponAttachment();

  this.updateWorldRegion();
  this.updateWorldStreaming();

  if(this.waveIntermission){
   if(this.awaitingWorldAdvance){
    this.updateWorldTravel(time);
   } else if(time>=this.nextWaveAt){
    this.startWave(this.wave+1);
   }
  } else {
   if(!this.devFlags?.autoSpawnsDisabled && this.spawned<this.waveTarget && time-this.lastSpawn>this.waveSpawnInterval){
    this.lastSpawn=time;
    this.spawnEnemy();
    this.spawned++;
   }
   if(
    this.spawned>=this.waveTarget &&
    this.enemies.length===0 &&
    !this.activeChampion
   ){
    if(this.pendingWorldAdvance){
     this.beginWorldTravel();
    } else {
     this.beginWaveIntermission(time);
    }
   }
  }

  this.updateChampionHazards(time);
  this.updateRelics(time);
  this.meleeAttack.update(time,this.enemies);
  this.updateHeroWeaponAttachment();
  this.cleanupDefeatedEnemies(time);
  if(this.gameplayPaused || this.levelChoiceOpen || this.championRewardOpen) return;

  this.updateEmptyScreenRush();

  // Spread A* work across frames. Direct line-of-sight chasers spend no budget;
  // only enemies whose route is actually blocked request a path.
  this.navigationPathfindBudget=2;

  // Crowd melee rule: at most the four closest ordinary skeletons are allowed
  // to deal contact damage at once. The rest still chase and surround the player.
  // This keeps a mob dangerous without turning a full surround into instant death.
  const skeletonAttackSlots=new Set(
   this.enemies
    .filter(e=>e.active && e.hp>0 && e.type==='skeleton')
    .sort((a,b)=>
     Phaser.Math.Distance.Squared(a.x,a.y,this.player.x,this.player.y)-
     Phaser.Math.Distance.Squared(b.x,b.y,this.player.x,this.player.y)
    )
    .slice(0,4)
  );

  for(const e of this.enemies){
   if(!e.active) continue;
   if(e.hp<=0){
    this.finalizeEnemyDeath(e,time);
    if(this.gameplayPaused || this.levelChoiceOpen || this.championRewardOpen) return;
    continue;
   }

   let a=Phaser.Math.Angle.Between(
    e.x,e.y,this.player.x,this.player.y
   );

   const distance=Phaser.Math.Distance.Between(
    e.x,e.y,this.player.x,this.player.y
   );

   const pursuitSpeed=this.getEnemyMovementSpeed(e);
   const devFreezeAI=e.type==='champion' ? this.devFlags?.championFrozen : this.devFlags?.enemyAiFrozen;
   const devFreezeMove=e.type==='champion' ? this.devFlags?.championMovementFrozen : this.devFlags?.enemyMovementFrozen;

   if(devFreezeAI){
    if(e.body)e.body.setVelocity(0,0);
    e.pendingMeleeHitAt=0;e.pendingMeleeDamage=0;e.pendingMeleeRange=0;
   }

   if(!devFreezeAI && e.pendingMeleeHitAt && time>=e.pendingMeleeHitAt){
    const pendingDamage=e.pendingMeleeDamage||e.attackDamage||8;
    const pendingRange=e.pendingMeleeRange||70;
    e.pendingMeleeHitAt=0;
    e.pendingMeleeDamage=0;
    e.pendingMeleeRange=0;
    if(distance<=pendingRange && !(e.type==='champion'?this.devFlags?.championAttacksDisabled:this.devFlags?.enemyAttacksDisabled)){
     if(this.damagePlayer(pendingDamage,`melee:${e.type}`)) return;
    }
   }

   if(!devFreezeAI){
    if(time<(e.skillTremorUntil||0)){
     e.body.setVelocity(e.skillTremorVX||0,e.skillTremorVY||0);
    } else if(time<(e.skillLiftUntil||0)){
     e.body.setVelocity(e.skillLiftDriftX||0,e.skillLiftDriftY||0);
    } else if(time<(e.staggerUntil||0)){
     e.body.setVelocity(e.knockbackVX||0,e.knockbackVY||0);
     e.knockbackVX*=0.82;
     e.knockbackVY*=0.82;
    } else if(e.type==='champion'){
     this.updateChampion(e,time,a,distance);
    } else if(e.type==='mage'){
     if(distance>210){
      this.setEnemySteeredVelocity(e,Math.cos(a)*pursuitSpeed,Math.sin(a)*pursuitSpeed,time);
     } else if(distance<160){
      this.setEnemySteeredVelocity(e,-Math.cos(a)*pursuitSpeed,-Math.sin(a)*pursuitSpeed,time);
     } else {
      e.body.setVelocity(0,0);
     }

     const activeMageShots=this.projectiles.filter(
      projectile=>projectile.active && projectile.owner===e
     ).length;

     if(!this.devFlags?.enemyAttacksDisabled && time-e.lastShot>1700 && activeMageShots<2){
      e.lastShot=time;
      const castWindup=320;
      e.attackAnimUntil=time+620;
      e.attackDir=e.dir;
      this.playMageCastSfx(time);

      if(e.visual && e.visual.active){
       const castKey=`mage_${e.attackDir}_cast`;
       if(e.visualState!==castKey){
        e.visualState=castKey;
        e.visual.play(castKey,true);
       }
      }

      // The projectile is released after a visible cast window. A small lead makes
      // lateral movement matter without turning the shot into perfect aim-bot tracking.
      this.time.delayedCall(castWindup,()=>{
       if(!e || !e.active || e.hp<=0 || this.gameOver || this.devFlags?.enemyAttacksDisabled || this.devFlags?.enemyAiFrozen) return;
       if(this.time.now<(e.staggerUntil||0) || this.time.now<(e.skillLiftUntil||0)) return;

       const leadX=this.clampWorldX(
        this.player.x+(this.player.body.velocity.x||0)*BALANCE.MAGE_LEAD_SECONDS,
        20
       );
       const leadY=this.clampWorldY(
        this.player.y+(this.player.body.velocity.y||0)*BALANCE.MAGE_LEAD_SECONDS,
        20
       );
       const shotAngle=Phaser.Math.Angle.Between(e.x,e.y,leadX,leadY);

       const projectile=this.add.sprite(
        e.x,e.y,'mage_projectile_00'
       ).setOrigin(0.5).setDepth(18).setRotation(shotAngle);
       projectile.play('mage_projectile_fly');
       this.physics.add.existing(projectile);
       projectile.body.setVelocity(
        Math.cos(shotAngle)*BALANCE.MAGE_PROJECTILE_SPEED,
        Math.sin(shotAngle)*BALANCE.MAGE_PROJECTILE_SPEED
       );
       projectile.damage=BALANCE.MAGE_PROJECTILE_DAMAGE;
       projectile.born=this.time.now;
       projectile.owner=e;
       projectile.lastWorldX=projectile.x;
       projectile.lastWorldY=projectile.y;
       this.projectiles.push(projectile);
      });
     }
    } else {
     const hasMeleeSlot=e.type!=='skeleton' || skeletonAttackSlots.has(e);

     if(e.type==='skeleton'){
      // Front-line skeletons stop at a readable melee distance instead of
      // walking into the player's center. Skeletons without one of the four
      // melee slots form a second ring slightly farther out.
      const desiredRange=hasMeleeSlot ? 56 : 76;
      const deadZone=4;

      if(time<e.attackAnimUntil){
       e.body.setVelocity(0,0);
      } else if(distance>desiredRange+deadZone){
       this.setEnemySteeredVelocity(e,Math.cos(a)*pursuitSpeed,Math.sin(a)*pursuitSpeed,time);
      } else if(distance<desiredRange-deadZone){
       // If crowd pressure pushes a skeleton inside its ring, gently push it
       // back out rather than letting bodies stack on the hero.
       const retreatSpeed=Math.max(34,pursuitSpeed*0.55);
       this.setEnemySteeredVelocity(e,-Math.cos(a)*retreatSpeed,-Math.sin(a)*retreatSpeed,time);
      } else {
       e.body.setVelocity(0,0);
      }
     } else if(e.type==='shield' && time<e.attackAnimUntil){
      e.body.setVelocity(0,0);
     } else {
      this.setEnemySteeredVelocity(e,Math.cos(a)*pursuitSpeed,Math.sin(a)*pursuitSpeed,time);
     }

     const attackRange=e.type==='skeleton'
      ? 62
      : (e.type==='shield'
       ? 58
       : (this.player.hitRadius||16)+(e.hitRadius||14)+8);
     const attackDamage=e.attackDamage || 5;

     const attackCooldown=e.type==='shield' ? 1300 : 1100;
     if(!this.devFlags?.enemyAttacksDisabled && hasMeleeSlot && !e.pendingMeleeHitAt && distance<=attackRange && time-e.lastAttack>attackCooldown){
      e.lastAttack=time;
      if(e.type==='skeleton') this.playSkeletonAttackSfx(time);
      const windup=e.type==='shield' ? 480 : 350;
      e.pendingMeleeHitAt=time+windup;
      e.pendingMeleeDamage=attackDamage;
      e.pendingMeleeRange=attackRange+10;
      e.attackAnimUntil=time+windup+260;
      e.attackDir=e.dir;
      e.body.setVelocity(0,0);

      if(e.visual && e.visual.active){
       const prefix=this.getEnemyVisualPrefix(e.type);
       const attackKey=`${prefix}_${e.attackDir}_attack`;
       if(e.visualState!==attackKey){
        e.visualState=attackKey;
        e.visual.play(attackKey,true);
       }
      }
     }
    }
   }
   if(devFreezeMove && e.body)e.body.setVelocity(0,0);
   this.applyBrokenSaintCrowdKeepout(e);
   if((devFreezeMove||devFreezeAI) && e.body)e.body.setVelocity(0,0);

   if(e.auraVisual && e.auraVisual.active){
    e.auraVisual.setPosition(e.x,e.y);
   }
   if(e.reflectVisual && e.reflectVisual.active){
    e.reflectVisual.setPosition(e.x,e.y-8);
   }
   if(e.shadowVisual && e.shadowVisual.active){
    const shadowYOffset=e.type==='mage'
     ? ASH_READABILITY.MAGE_SHADOW_Y_OFFSET
     : (e.type==='shield' ? ASH_READABILITY.SHIELD_SHADOW_Y_OFFSET : (e.hitRadius||14)*0.82);
    e.shadowVisual.setPosition(e.x,e.y+shadowYOffset);
   }

   if(e.visual && e.visual.active){
    let liftOffset=0;
    let liftRotation=0;
    let liftScaleX=e.visualBaseScale||e.visual.scaleX||0.5;
    const liftScaleY=e.visualBaseScale||e.visual.scaleY||0.5;
    if(time<(e.skillLiftUntil||0) && e.skillLiftStartAt!==undefined){
     const duration=Math.max(1,e.skillLiftUntil-e.skillLiftStartAt);
     const progress=Phaser.Math.Clamp((time-e.skillLiftStartAt)/duration,0,1);
     // Higher arc with a tiny hang near the apex.
     const arc=Math.pow(Math.sin(progress*Math.PI),0.78);
     liftOffset=-arc*(e.skillLiftHeight||112);
     if(e.skillLiftMotion===1){
      liftRotation=(e.skillLiftTilt||0)+progress*Math.PI;
     } else if(e.skillLiftMotion===2){
      liftRotation=(e.skillLiftTilt||0)+progress*Math.PI*2*(e.skillLiftTilt<0?-1:1);
     } else {
      liftRotation=(e.skillLiftTilt||0)*Math.sin(progress*Math.PI);
     }
     // A small mid-air squash/stretch sells the vertical momentum.
     const squash=Math.sin(progress*Math.PI)*0.08;
     liftScaleX*=1+squash;
     e.visual.setScale(liftScaleX,liftScaleY*(1-squash*0.55));
    } else if(Math.abs(e.visual.rotation)>0.001){
     e.visual.setRotation(0);
     e.visual.setScale(e.visualBaseScale||0.5);
    }
    e.visual.setRotation(liftRotation);
    e.visual.setPosition(e.x,e.y+liftOffset);
    const isBrokenSaint=e.type==='champion' && e.championKind==='brokenSaint';
    e.dir=isBrokenSaint
     ? this.getEightDirectionFromVector(
       this.player.x-e.x,
       this.player.y-e.y,
       e.dir||'down'
      )
     : this.getDirectionFromVector(
       this.player.x-e.x,
       this.player.y-e.y,
       e.dir||'down'
      );

    const prefix=isBrokenSaint ? 'broken_saint' : this.getEnemyVisualPrefix(e.type);
    let action='idle';

    if(time<(e.staggerUntil||0)){
     action='idle';
    } else if(time<e.attackAnimUntil){
     action=this.getEnemyAttackAction(e.type);
    } else if(e.body && e.body.velocity.lengthSq()>4){
     action='walk';
    }

    const visualDir=time<e.attackAnimUntil ? (e.attackDir||e.dir) : e.dir;
    const enemyAnimKey=`${prefix}_${visualDir}_${action}`;

    if(e.visualState!==enemyAnimKey){
     e.visualState=enemyAnimKey;
     e.visual.play(enemyAnimKey,true);
    }
   }

   if(e.type==='champion' && e===this.activeChampion){
    this.updateChampionBar();
   }

  }

  this.applyEnemySoftSeparation(time);

  for(const o of this.orbs){
   if(o.active && Phaser.Math.Distance.Between(o.x,o.y,this.player.x,this.player.y)<40){
    o.destroy();
    if(this.grantXp(10)) return;
   }
  }

  for(const heart of this.hearts){
   if(!heart.active) continue;

   if(time>=heart.expiresAt){
    heart.destroy();
    continue;
   }

   const heartDistance=Phaser.Math.Distance.Between(
    heart.x,heart.y,this.player.x,this.player.y
   );

   if(heartDistance<38){
    const healAmount=this.championRelics.has('ancientBlood') ? Math.round(BALANCE.HEART_HEAL*1.5) : BALANCE.HEART_HEAL;
    const hpBefore=this.player.hp;
    this.player.hp=Math.min(
     this.player.maxHp||100,
     this.player.hp+healAmount
    );
    this.updateLowHealthState();

    const healed=this.player.hp-hpBefore;
    if(healed>0){
     const healText=lkAddText(this,
      this.player.x,this.player.y-30,`+${healed}`,
      {fontSize:'13px',color:'#8dff9d',stroke:'#102010',strokeThickness:2}
     ).setOrigin(0.5).setDepth(35);
     this.tweens.add({
      targets:healText,y:healText.y-16,alpha:0,duration:420,
      onComplete:()=>healText.destroy()
     });
    }

    heart.destroy();
   }
  }

  for(const projectile of this.projectiles){
   if(!projectile.active) continue;

   const lastProjectileX=Number.isFinite(projectile.lastWorldX)?projectile.lastWorldX:projectile.x;
   const lastProjectileY=Number.isFinite(projectile.lastWorldY)?projectile.lastWorldY:projectile.y;
   if(!this.devFlags?.noCollision && this.isAshPathBlocked(lastProjectileX,lastProjectileY,projectile.x,projectile.y,6)){
    projectile.destroy();
    continue;
   }
   projectile.lastWorldX=projectile.x;
   projectile.lastWorldY=projectile.y;

   const projectileDistance=Phaser.Math.Distance.Between(
    projectile.x,projectile.y,
    this.player.x,this.player.y
   );

   if(projectileDistance<(this.player.hitRadius+10)){
    const lethal=this.damagePlayer(projectile.damage,'mageProjectile');
    projectile.destroy();

    if(lethal){
     return;
    }

    continue;
   }

   const expired=time-projectile.born>4000;
   const outside=
    projectile.x < -80 ||
    projectile.x > STAGE0.WORLD_WIDTH+80 ||
    projectile.y < -80 ||
    projectile.y > STAGE0.WORLD_HEIGHT+80;

   if(expired || outside){
    projectile.destroy();
   }
  }

  this.enemies=this.enemies.filter(e=>e.active);
  this.orbs=this.orbs.filter(o=>o.active);
  this.hearts=this.hearts.filter(heart=>heart.active);
  this.projectiles=this.projectiles.filter(p=>p.active);

  const aliveMages=this.enemies.filter(e=>e.active && e.type==='mage').length;
  const aliveShields=this.enemies.filter(e=>e.active && e.type==='shield').length;
  const aliveChampions=this.enemies.filter(e=>e.active && e.type==='champion').length;
  const aliveSkeletons=this.enemies.filter(e=>e.active && e.type==='skeleton').length;

  this.hud.setText(
   `Wave: ${this.wave} (${this.waveProfile ? this.waveProfile.name : '---'})\nHP: ${this.player.hp}\nLevel: ${this.level}\nXP: ${this.xp}/${this.getXpRequiredForLevel()}\nKills: ${this.kills}\nSword Lv${this.meleeAttack.level}: ${this.getEffectiveMeleeDamage()} dmg (${this.meleeAttack.damage}+${this.getRegionBalance().meleeDamageBonus}) / ${this.meleeAttack.cooldown}ms / R${this.meleeAttack.radius}\nMage alive: ${aliveMages} / spawned: ${this.mageSpawned}\nShield alive: ${aliveShields} / spawned: ${this.shieldSpawned}\nChampion alive: ${aliveChampions} / spawned: ${this.championSpawned}\nSkeleton alive: ${aliveSkeletons} / spawned: ${this.skeletonSpawned}\nRelics: ${Array.from(this.championRelics).join(', ') || 'none'}\nSoul stacks: ${this.championRelics.has('necromancerSoul') ? this.killStreakBonus : '-'}  Iron Will: ${this.championRelics.has('ironWill') && this.player.hp<=35 ? 'ACTIVE' : '-'}\nRegion: ${this.getWorldProgressName()}  Progress: ${Math.round(this.getZoneTravelProgress()*100)}%\nGates open: ${this.unlockedWorldGates.size}/4  Back seals: ${this.closedWorldGates.size}\nEmpty-screen x4 rush: ${this.emptyScreenRushActive ? 'ACTIVE' : '-'}\nWorld: ${Math.round(this.player.x)},${Math.round(this.player.y)}  View: ${Math.round(this.cameras.main.worldView.width)}x${Math.round(this.cameras.main.worldView.height)}\nProjectiles: ${this.projectiles.length}\nHearts: ${this.hearts.length}\nBuild 1.0.6 SOCKET TEST: separate sword + 8-dir hero + regional progression\nR: restart after death`
  );
 }
}


class HUDScene extends Phaser.Scene {
 constructor(){
  super({key:'HUDScene'});
 }

 init(data){
  this.mainScene=data?.mainScene || null;
  this.movePointerId=null;
  this.moveVector={x:0,y:0};
  this.safe={top:0,right:0,bottom:0,left:0};
  this.lowHealthState='normal';
  this.lowHealthRatio=1;
  this.lowHealthVisualPaused=false;
  this.hpPulseTween=null;
  this.vignettePulseTween=null;
  this.vignetteFadeTween=null;
  this.criticalFlashTween=null;
  this.hpPulseDriver={value:0};
 }

 create(){
  this.mainScene=this.mainScene || this.scene.get('main');
  this.cameras.main.setScroll(0,0).setOrigin(0,0).setZoom(LK_RENDER_SCALE).setRoundPixels(true);
  this.buildLowHealthOverlay();
  this.buildHeroPanel();
  this.buildWavePanel();
  this.buildChampionPanel();
  this.buildEventBanner();
  this.buildSkillCluster();
  this.buildJoystick();
  this.buildGameOver();
  this.buildLevelChoiceOverlay();
  this.buildChampionRewardOverlay();
  this.buildFullscreenButton();
  for(const obj of this.children.list){if(obj?.type==='Text')obj.setResolution?.(LK_TEXT_RESOLUTION);}

  this.scale.on('resize',this.layout,this);
  this.input.on('pointerdown',this.onPointerDown,this);
  this.input.on('pointermove',this.onPointerMove,this);
  this.input.on('pointerup',this.onPointerUp,this);
  this.input.on('pointerupoutside',this.onPointerUp,this);

  this.onMainSceneShutdown=()=>{
   if(this.scene && this.scene.isActive()) this.scene.stop();
  };
  this.onHealthStateChanged=(state,previous,ratio)=>this.setHealthState(state,previous,ratio);
  if(this.mainScene){
   this.mainScene.events.once(Phaser.Scenes.Events.SHUTDOWN,this.onMainSceneShutdown,this);
   this.mainScene.events.on('healthStateChanged',this.onHealthStateChanged,this);
  }
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
   this.scale.off('resize',this.layout,this);
   this.input.off('pointerdown',this.onPointerDown,this);
   this.input.off('pointermove',this.onPointerMove,this);
   this.input.off('pointerup',this.onPointerUp,this);
   this.input.off('pointerupoutside',this.onPointerUp,this);
   if(this.mainScene && this.onMainSceneShutdown){
    this.mainScene.events.off(Phaser.Scenes.Events.SHUTDOWN,this.onMainSceneShutdown,this);
   }
   if(this.mainScene && this.onHealthStateChanged){
    this.mainScene.events.off('healthStateChanged',this.onHealthStateChanged,this);
   }
   this.stopHpPulse(true);
   this.stopVignetteTweens();
  });
  this.layout();
  if(this.mainScene){
   const state=this.mainScene.getLowHealthState?.() || 'normal';
   const maxHp=Math.max(1,this.mainScene.player?.maxHp||100);
   const ratio=Phaser.Math.Clamp((this.mainScene.player?.hp||0)/maxHp,0,1);
   this.setHealthState(state,'normal',ratio,true);
  }
  if(this.pendingEventBanner){
   const pending=this.pendingEventBanner;
   this.pendingEventBanner=null;
   this.showEventBanner(pending.title,pending.subtitle,pending.color);
  }
 }

 getSafeArea(){
  if(typeof window==='undefined' || typeof getComputedStyle==='undefined') return {top:0,right:0,bottom:0,left:0};
  const s=getComputedStyle(document.documentElement);
  const read=(name)=>Math.max(0,parseFloat(s.getPropertyValue(name))||0);
  return {top:read('--safe-top'),right:read('--safe-right'),bottom:read('--safe-bottom'),left:read('--safe-left')};
 }

 addPanelGraphics(depth=10){
  const g=this.add.graphics().setDepth(depth);
  return g;
 }

 buildLowHealthOverlay(){
  this.lowHealthVignette=this.add.graphics().setDepth(8).setScrollFactor(0).setVisible(false).setAlpha(0);
  this.lowHealthFlash=this.add.graphics().setDepth(9).setScrollFactor(0).setVisible(false).setAlpha(0);
 }

 drawVignette(graphics,maxAlpha){
  if(!graphics) return;
  const logical=lkLogicalSceneSize(this),w=logical.width,h=logical.height;
  const depth=Math.max(
   LOW_HEALTH_CONFIG.VIGNETTE_DEPTH_MIN,
   Math.min(LOW_HEALTH_CONFIG.VIGNETTE_DEPTH_MAX,Math.round(Math.min(w,h)*LOW_HEALTH_CONFIG.VIGNETTE_DEPTH_RATIO))
  );
  const bands=LOW_HEALTH_CONFIG.VIGNETTE_BANDS;
  const step=depth/bands;
  graphics.clear();
  for(let i=0;i<bands;i++){
   const t=i/bands;
   const alpha=maxAlpha*Math.pow(1-t,1.55);
   const inset=i*step;
   const thick=Math.ceil(step+1);
   graphics.fillStyle(0x790b0b,alpha);
   graphics.fillRect(inset,inset,Math.max(0,w-inset*2),thick);
   graphics.fillRect(inset,Math.max(inset,h-inset-thick),Math.max(0,w-inset*2),thick);
   graphics.fillRect(inset,inset,thick,Math.max(0,h-inset*2));
   graphics.fillRect(Math.max(inset,w-inset-thick),inset,thick,Math.max(0,h-inset*2));
  }
 }

 stopVignetteTweens(){
  for(const key of ['vignettePulseTween','vignetteFadeTween','criticalFlashTween']){
   if(this[key]){ this[key].stop(); this[key]=null; }
  }
 }

 playCriticalFlash(){
  if(!this.lowHealthFlash) return;
  if(this.criticalFlashTween){ this.criticalFlashTween.stop(); this.criticalFlashTween=null; }
  this.drawVignette(this.lowHealthFlash,LOW_HEALTH_CONFIG.CRITICAL_FLASH_ALPHA);
  this.lowHealthFlash.setVisible(true).setAlpha(0);
  this.criticalFlashTween=this.tweens.add({
   targets:this.lowHealthFlash,
   alpha:{from:0,to:1},
   duration:Math.max(60,Math.round(LOW_HEALTH_CONFIG.CRITICAL_FLASH_MS*0.45)),
   yoyo:true,
   hold:20,
   ease:'Sine.easeOut',
   onComplete:()=>{
    this.lowHealthFlash.setVisible(false).setAlpha(0);
    this.criticalFlashTween=null;
   }
  });
 }

 startVignette(state){
  if(!this.lowHealthVignette) return;
  if(this.vignetteFadeTween){ this.vignetteFadeTween.stop(); this.vignetteFadeTween=null; }
  if(this.vignettePulseTween){ this.vignettePulseTween.stop(); this.vignettePulseTween=null; }
  const deathDoor=state==='deathDoor';
  const maxAlpha=deathDoor ? LOW_HEALTH_CONFIG.DEATH_DOOR_VIGNETTE_ALPHA : LOW_HEALTH_CONFIG.CRITICAL_VIGNETTE_ALPHA;
  const pulseMs=deathDoor ? LOW_HEALTH_CONFIG.DEATH_DOOR_PULSE_MS : LOW_HEALTH_CONFIG.CRITICAL_PULSE_MS;
  this.drawVignette(this.lowHealthVignette,maxAlpha);
  this.lowHealthVignette.setVisible(true).setAlpha(0.78);
  this.vignettePulseTween=this.tweens.add({
   targets:this.lowHealthVignette,
   alpha:{from:0.72,to:1},
   duration:Math.round(pulseMs/2),
   yoyo:true,
   repeat:-1,
   ease:'Sine.easeInOut'
  });
  if(this.lowHealthVisualPaused) this.vignettePulseTween.pause();
 }

 hideVignette(immediate=false){
  if(!this.lowHealthVignette) return;
  if(this.vignettePulseTween){ this.vignettePulseTween.stop(); this.vignettePulseTween=null; }
  if(this.vignetteFadeTween){ this.vignetteFadeTween.stop(); this.vignetteFadeTween=null; }
  if(immediate){
   this.lowHealthVignette.setAlpha(0).setVisible(false);
   return;
  }
  if(!this.lowHealthVignette.visible) return;
  this.vignetteFadeTween=this.tweens.add({
   targets:this.lowHealthVignette,
   alpha:0,
   duration:LOW_HEALTH_CONFIG.RECOVERY_FADE_MS,
   ease:'Sine.easeOut',
   onComplete:()=>{
    this.lowHealthVignette.setVisible(false);
    this.vignetteFadeTween=null;
   }
  });
  if(this.lowHealthVisualPaused) this.vignetteFadeTween.pause();
 }

 getHpPulseSettings(state){
  if(state==='deathDoor') return {duration:LOW_HEALTH_CONFIG.DEATH_DOOR_PULSE_MS,amount:1.045,minAlpha:0.72};
  if(state==='critical') return {duration:LOW_HEALTH_CONFIG.CRITICAL_PULSE_MS,amount:1.035,minAlpha:0.78};
  return {duration:LOW_HEALTH_CONFIG.LOW_PULSE_MS,amount:1.022,minAlpha:0.84};
 }

 startHpPulse(state){
  const settings=this.getHpPulseSettings(state);
  if(this.hpPulseTween){ this.hpPulseTween.stop(); this.hpPulseTween=null; }
  this.hpPulseSettings=settings;
  this.hpPulseDriver.value=0;
  this.hpPulseTween=this.tweens.add({
   targets:this.hpPulseDriver,
   value:1,
   duration:Math.round(settings.duration/2),
   yoyo:true,
   repeat:-1,
   ease:'Sine.easeInOut'
  });
  if(this.lowHealthVisualPaused) this.hpPulseTween.pause();
 }

 stopHpPulse(immediate=false){
  if(this.hpPulseTween){ this.hpPulseTween.stop(); this.hpPulseTween=null; }
  this.hpPulseDriver.value=0;
  this.hpPulseSettings=null;
  if(immediate) this.applyHpPulseFrame();
 }

 applyHpPulseFrame(){
  if(!this.hpFrame || !this.hpFill || !this.hpText) return;
  const p=Phaser.Math.Clamp(this.hpPulseDriver?.value||0,0,1);
  const settings=this.hpPulseSettings;
  const amount=settings ? settings.amount : 1;
  const factor=1+(amount-1)*p;
  const uiHp=this.mainScene?.devTools?.uiEditor?.getTransform?.('hpBar');
  const uiHpSx=uiHp?(uiHp.scale||1)*(uiHp.width||1):1;
  const uiHpSy=uiHp?(uiHp.scale||1)*(uiHp.height||1):1;
  if(this.hpFrameBaseScaleX && this.hpFrameBaseScaleY){
   this.hpFrame.setScale(this.hpFrameBaseScaleX*factor*uiHpSx,this.hpFrameBaseScaleY*factor*uiHpSy);
  }
  this.hpText.setScale(factor*uiHpSx,factor*uiHpSy);
  // IMPORTANT: never reconstruct HP scaleX from 1. displayWidth in update()
  // encodes the current HP ratio; UI editor width scaling is applied there.
  this.hpFill.scaleY=(1+0.10*p)*uiHpSy;
  this.hpShine.scaleY=(1+0.08*p)*uiHpSy;
  const minAlpha=settings ? settings.minAlpha : 1;
  this.hpFill.setAlpha(Phaser.Math.Linear(1,minAlpha,p));
  this.hpFrame.setAlpha(Phaser.Math.Linear(1,Math.max(0.82,minAlpha),p));
  this.hpText.setAlpha(Phaser.Math.Linear(1,Math.max(0.88,minAlpha),p));
 }

 setLowHealthVisualPaused(paused){
  if(this.lowHealthVisualPaused===paused) return;
  this.lowHealthVisualPaused=paused;
  for(const tween of [this.hpPulseTween,this.vignettePulseTween,this.vignetteFadeTween,this.criticalFlashTween]){
   if(!tween) continue;
   if(paused) tween.pause();
   else tween.resume();
  }
 }

 setHealthState(state,previous='normal',ratio=1,force=false){
  const next=['normal','low','critical','deathDoor'].includes(state) ? state : 'normal';
  const prev=this.lowHealthState||'normal';
  if(!force && next===prev){
   this.lowHealthRatio=ratio;
   return;
  }
  this.lowHealthState=next;
  this.lowHealthRatio=ratio;

  if(next==='normal'){
   this.stopHpPulse();
   this.hideVignette(false);
   this.hpFill?.setFillStyle(0xb51f24,1);
  } else {
   this.startHpPulse(next);
   if(next==='low'){
    this.hideVignette(false);
    this.hpFill?.setFillStyle(0xc92b30,1);
   } else {
    this.hpFill?.setFillStyle(next==='deathDoor'?0xf01c24:0xdc242b,1);
    this.startVignette(next);
    const wasCritical=prev==='critical' || prev==='deathDoor' || previous==='critical' || previous==='deathDoor';
    if(!wasCritical) this.playCriticalFlash();
   }
  }
 }

 buildHeroPanel(){
  // Art-driven responsive HUD. The decorative pieces are independent sprites so
  // the panel can grow horizontally without stretching the corners.
  this.heroPanel=this.add.container(0,0).setDepth(20);
  const addHud=(key,depth=20)=>this.add.image(0,0,`hero_hud_${key}`).setDepth(depth);
  // Hybrid HUD shell: simple vector geometry stays razor-clean at any mobile DPR.
  // The ornate raster art is reserved for the medallion and the resource frames,
  // where it can be scaled uniformly instead of being stretched in two axes.
  this.heroPanelShell=this.add.graphics().setDepth(20);
  this.heroPanelFill=null;
  this.heroFrameParts=null;
  this.levelBadge=null;
  this.levelBadgeSimple=this.add.graphics().setDepth(25);
  this.levelCaption=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'9px',fontStyle:'bold',color:'#ad9c78'}).setOrigin(0.5).setDepth(27);
  this.levelText=lkAddText(this,0,0,'1',{fontFamily:'Georgia, serif',fontSize:'28px',fontStyle:'bold',color:'#fff0cf',stroke:'#140d08',strokeThickness:4}).setOrigin(0.5).setDepth(27);

  this.hpFill=this.add.rectangle(0,0,200,18,0xb51f24,1).setOrigin(0,0.5).setDepth(21);
  this.hpShine=this.add.rectangle(0,0,200,4,0xff8a78,0.25).setOrigin(0,0.5).setDepth(22);
  this.hpFrame=addHud('hp_bar_frame',24);
  this.hpText=lkAddText(this,0,0,'100 / 100',{fontFamily:'Arial, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#fff4e8',stroke:'#24100e',strokeThickness:3}).setOrigin(0.5).setDepth(26);
  this.hpLabel=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'1px'}).setVisible(false);

  // Clean mana slots are drawn as simple vector rings.
  this.manaHousing=null;
  this.manaRingsSimple=this.add.graphics().setDepth(23);
  this.manaLabel=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'1px'}).setVisible(false);
  this.manaGems=[];
  for(let i=0;i<3;i++) this.manaGems.push(this.add.image(0,0,'hero_hud_mana_bottle_blue').setDepth(25));

  this.xpFill=this.add.rectangle(0,0,190,5,0xf0bd28,1).setOrigin(0,0.5).setDepth(21);
  this.xpFrame=addHud('xp_bar_frame',24);
  this.xpLabel=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'1px'}).setVisible(false);
 }
 buildWavePanel(){
  this.wavePanel=this.addPanelGraphics(20);
  this.waveTitle=lkAddText(this,0,0,'WAVE 1',{fontFamily:'Arial, sans-serif',fontSize:'22px',fontStyle:'bold',color:'#f7e8c1',stroke:'#17120d',strokeThickness:4}).setOrigin(0.5).setDepth(23);
  this.waveSub=lkAddText(this,0,0,'ASH FIELDS',{fontFamily:'Arial, sans-serif',fontSize:'11px',fontStyle:'bold',color:'#b9b6aa',letterSpacing:1}).setOrigin(0.5).setDepth(23);
 }

 buildChampionPanel(){
  this.championPanel=this.addPanelGraphics(30).setVisible(false);
  this.bossName=lkAddText(this,0,0,'BROKEN SAINT',{fontFamily:'Arial, sans-serif',fontSize:'20px',fontStyle:'bold',color:'#f5d78f',stroke:'#17100a',strokeThickness:4}).setOrigin(0.5).setDepth(33).setVisible(false);
  this.bossHpBack=this.add.rectangle(0,0,500,22,0x130f0d,0.96).setStrokeStyle(2,0x8d7445,1).setDepth(32).setVisible(false);
  this.bossHpFill=this.add.rectangle(0,0,494,14,0xc59b46,1).setOrigin(0,0.5).setDepth(33).setVisible(false);
  this.bossHpText=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#fff2cf',stroke:'#16100a',strokeThickness:3}).setOrigin(0.5).setDepth(34).setVisible(false);
 }

 buildEventBanner(){
  this.eventBannerPanel=this.addPanelGraphics(88).setVisible(false);
  this.eventBannerTitle=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'30px',fontStyle:'bold',color:'#fff06a',stroke:'#101610',strokeThickness:5,align:'center'}).setOrigin(0.5).setDepth(90).setVisible(false);
  this.eventBannerSub=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'15px',color:'#ffffff',stroke:'#101610',strokeThickness:3,align:'center'}).setOrigin(0.5).setDepth(90).setVisible(false);
  this.eventBannerTween=null;
 }

 showEventBanner(title,subtitle,color='#fff06a'){
  // MainScene can request the first wave banner immediately after launching HUDScene.
  // Phaser exposes the HUD scene object before HUDScene.create() has finished, so queue
  // the request until the banner objects actually exist instead of touching undefined UI.
  if(!this.eventBannerTitle || !this.eventBannerSub || !this.eventBannerPanel){
   this.pendingEventBanner={title,subtitle,color};
   return;
  }
  if(this.eventBannerTween){ this.eventBannerTween.stop(); this.eventBannerTween=null; }
  this.eventBannerTitle.setText(title||'').setColor(color).setAlpha(0).setVisible(true);
  this.eventBannerSub.setText(subtitle||'').setAlpha(0).setVisible(Boolean(subtitle));
  this.eventBannerPanel.setAlpha(0).setVisible(true);
  this.layoutEventBanner();
  const targets=[this.eventBannerPanel,this.eventBannerTitle];
  if(subtitle) targets.push(this.eventBannerSub);
  this.eventBannerTween=this.tweens.add({targets,alpha:1,duration:180,hold:850,yoyo:true,onComplete:()=>{
   this.eventBannerPanel.setVisible(false);
   this.eventBannerTitle.setVisible(false);
   this.eventBannerSub.setVisible(false);
   this.eventBannerTween=null;
  }});
 }

 layoutEventBanner(){
  if(!this.eventBannerPanel) return;
  const logical=lkLogicalSceneSize(this),w=logical.width,h=logical.height;
  const mobile=Boolean(this.mainScene?.isTouchDevice || h<560 || w<900);
  const cx=w/2,cy=h/2;
  const panelW=Math.min(mobile?420:620,w-(mobile?28:64));
  const panelH=mobile?104:126;
  const x=cx-panelW/2,y=cy-panelH/2;
  const radius=mobile?9:12;
  this.eventBannerPanel.clear();
  this.eventBannerPanel.fillStyle(0x070605,0.34); this.eventBannerPanel.fillRoundedRect(x+4,y+4,panelW,panelH,radius);
  this.eventBannerPanel.fillStyle(0x15130f,0.78); this.eventBannerPanel.fillRoundedRect(x,y,panelW,panelH,radius);
  this.eventBannerPanel.lineStyle(mobile?1.5:2,0x8c7447,0.82); this.eventBannerPanel.strokeRoundedRect(x,y,panelW,panelH,radius);
  this.eventBannerTitle.setPosition(cx,cy-(mobile?15:19)).setFontSize(mobile?24:32).setWordWrapWidth(panelW-28,true);
  this.eventBannerSub.setPosition(cx,cy+(mobile?23:28)).setFontSize(mobile?12:16).setWordWrapWidth(panelW-34,true);
 }

 makeSkillButton(index,title,kind){
  // Simple Phaser-built button: no decorative frame asset. This keeps the icon
  // readable on small mobile displays and lets the whole button scale cleanly.
  const back=this.add.circle(0,0,42,0x0d0f0d,0.86).setStrokeStyle(2,0xb79a58,0.96).setDepth(25).setInteractive({useHandCursor:true});
  const inner=this.add.circle(0,0,34,0x000000,0.18).setStrokeStyle(1,0xe0c678,0.28).setDepth(26);
  const iconImage=this.add.image(0,0,SKILL_ICON_KEYS[kind]).setDepth(27);
  const iconMaskShape=this.add.graphics().setDepth(27).setVisible(false);
  const iconMask=iconMaskShape.createGeometryMask();
  iconImage.setMask(iconMask);
  const key=lkAddText(this,0,0,String(index),{fontFamily:'Arial, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#ead9ad',backgroundColor:'#18140f',padding:{x:5,y:2}}).setOrigin(0.5).setDepth(29);
  const label=lkAddText(this,0,0,title,{fontFamily:'Arial, sans-serif',fontSize:'11px',fontStyle:'bold',color:'#eee4cf',stroke:'#17120d',strokeThickness:3}).setOrigin(0.5,0).setDepth(29).setVisible(false);
  back.on('pointerdown',()=>{
   if(this.mainScene?.devTools?.uiEditor?.editMode)return;
   this.mainScene?.events.emit('mobile-skill',index);
   this.tweens.add({targets:[back,inner,iconImage],scale:0.94,duration:70,yoyo:true});
  });
  return {back,inner,icon:iconImage,iconMaskShape,key,label,index,kind};
 }

 drawSkillIcon(skill,x,y,buttonRadius){
  const innerRadius=buttonRadius*0.78;
  const iconDiameter=innerRadius*2;
  skill.icon.setPosition(x,y).setDisplaySize(iconDiameter,iconDiameter);
  skill.iconMaskShape.clear();
  skill.iconMaskShape.fillStyle(0xffffff,1);
  skill.iconMaskShape.fillCircle(x,y,innerRadius);
 }
 buildSkillCluster(){
  this.skill1=this.makeSkillButton(1,'QUAKE','quake');
  this.skill2=this.makeSkillButton(2,'LIFT','lift');
  this.skill3=this.makeSkillButton(3,'SPIN','spin');
  this.skills=[this.skill1,this.skill2,this.skill3];
  this.skillCaption=lkAddText(this,0,0,'SKILLS',{fontFamily:'Arial, sans-serif',fontSize:'11px',fontStyle:'bold',color:'#b6aa8e',letterSpacing:2}).setOrigin(0.5).setDepth(24).setVisible(false);
 }

 buildJoystick(){
  this.joyBack=this.add.circle(0,0,66,0x080b09,0.32).setStrokeStyle(3,0xbeb49c,0.35).setDepth(24);
  this.joyRing=this.add.circle(0,0,47,0x171b17,0.20).setStrokeStyle(2,0xd9cfbb,0.22).setDepth(25);
  this.joyKnob=this.add.circle(0,0,29,0xbeb7a6,0.28).setStrokeStyle(2,0xf3ead8,0.35).setDepth(26);
  this.joyHint=lkAddText(this,0,0,'MOVE',{fontFamily:'Arial, sans-serif',fontSize:'10px',fontStyle:'bold',color:'#c8c0ad'}).setOrigin(0.5).setDepth(27).setVisible(false);
 }


 buildLevelChoiceOverlay(){
  this.levelChoiceVisible=false;
  this.levelChoiceLabels=[];
  this.levelChoiceButtons=[];
  this.levelChoiceShade=this.add.rectangle(0,0,100,100,0x050403,0.58).setOrigin(0).setDepth(108).setVisible(false);
  this.levelChoicePanel=this.addPanelGraphics(109).setVisible(false);
  this.levelChoiceTitle=lkAddText(this,0,0,'LEVEL 2 - CHOOSE UPGRADE',{fontFamily:'Arial, sans-serif',fontSize:'24px',fontStyle:'bold',color:'#f1df97',stroke:'#17110c',strokeThickness:4}).setOrigin(0.5).setDepth(110).setVisible(false);

  for(let i=0;i<3;i++){
   const card=this.add.rectangle(0,0,100,44,0x243323,0.96).setStrokeStyle(2,0x789561,0.88).setDepth(110).setVisible(false).setInteractive({useHandCursor:true});
   const label=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'18px',fontStyle:'bold',color:'#ffffff',stroke:'#14210f',strokeThickness:3,wordWrap:{width:360,useAdvancedWrap:true},align:'center'}).setOrigin(0.5).setDepth(111).setVisible(false).setInteractive({useHandCursor:true});
   card.on('pointerover',()=>{ if(this.levelChoiceVisible) card.setFillStyle(0x30482c,1); });
   card.on('pointerout',()=>card.setFillStyle(0x243323,0.96));
   card.on('pointerdown',()=>this.mainScene?.selectLevelChoice?.(i));
   label.on('pointerdown',()=>this.mainScene?.selectLevelChoice?.(i));
   this.levelChoiceButtons.push({card,label});
  }
 }

 showLevelChoices(level,labels=[]){
  this.levelChoiceVisible=true;
  this.levelChoiceLabels=labels.slice(0,3);
  this.levelChoiceTitle.setText(`LEVEL ${level} - CHOOSE UPGRADE`);
  this.levelChoiceShade.setVisible(true);
  this.levelChoicePanel.setVisible(true);
  this.levelChoiceTitle.setVisible(true);
  this.levelChoiceButtons.forEach((entry,i)=>{
   const visible=Boolean(this.levelChoiceLabels[i]);
   entry.card.setVisible(visible).setFillStyle(0x243323,0.96);
   entry.label.setVisible(visible).setText(this.levelChoiceLabels[i] || '');
  });
  this.layoutLevelChoiceOverlay();
  this.layoutEventBanner();
 }

 hideLevelChoices(){
  this.levelChoiceVisible=false;
  this.levelChoiceLabels=[];
  this.levelChoiceShade.setVisible(false);
  this.levelChoicePanel.setVisible(false);
  this.levelChoiceTitle.setVisible(false);
  this.levelChoiceButtons.forEach(({card,label})=>{
   card.setVisible(false).setFillStyle(0x243323,0.96);
   label.setVisible(false).setText('');
  });
 }

 layoutLevelChoiceOverlay(){
  if(!this.levelChoiceVisible) return;
  const logical=lkLogicalSceneSize(this),w=logical.width,h=logical.height;
  const mobile=Boolean(this.mainScene?.isTouchDevice || h<560 || w<900);
  const screenCx=w/2,screenCy=h/2;
  const panelW=Math.min(mobile?420:560,w-(mobile?28:64));
  const rowH=mobile?50:56;
  const gap=mobile?12:14;
  const count=Math.max(1,this.levelChoiceLabels.length || 3);
  const panelH=(mobile?106:126) + (count*rowH) + ((count-1)*gap);
  const panelX=screenCx-panelW/2,panelY=screenCy-panelH/2;
  const radius=mobile?10:12;

  this.levelChoiceShade.setPosition(0,0).setSize(w,h).setDisplaySize(w,h);
  this.levelChoicePanel.clear();
  this.levelChoicePanel.fillStyle(0x070605,0.44); this.levelChoicePanel.fillRoundedRect(panelX+5,panelY+5,panelW,panelH,radius);
  this.levelChoicePanel.fillStyle(0x15130f,0.94); this.levelChoicePanel.fillRoundedRect(panelX,panelY,panelW,panelH,radius);
  this.levelChoicePanel.lineStyle(mobile?2:2.5,0x8e7547,0.94); this.levelChoicePanel.strokeRoundedRect(panelX,panelY,panelW,panelH,radius);
  this.levelChoicePanel.lineStyle(1,0xd6bd7b,0.16); this.levelChoicePanel.strokeRoundedRect(panelX+4,panelY+4,panelW-8,panelH-8,Math.max(5,radius-4));

  this.levelChoiceTitle.setPosition(screenCx,panelY+(mobile?26:31)).setFontSize(mobile?18:24);

  const cardW=panelW-(mobile?34:48);
  const startY=panelY+(mobile?76:94);
  this.levelChoiceButtons.forEach((entry,i)=>{
   const visible=Boolean(this.levelChoiceLabels[i]);
   entry.card.setVisible(visible);
   entry.label.setVisible(visible);
   if(!visible) return;
   const y=startY+i*(rowH+gap);
   entry.card.setPosition(screenCx,y).setSize(cardW,rowH).setDisplaySize(cardW,rowH).setStrokeStyle(2,0x789561,0.88);
   entry.label.setPosition(screenCx,y).setFontSize(mobile?15:18).setWordWrapWidth(cardW-28,true);
  });
 }

 buildFullscreenButton(){
  this.fullscreenButton=this.add.circle(0,0,22,0x11100e,0.88).setStrokeStyle(2,0xc4a662,0.82).setDepth(95).setInteractive({useHandCursor:true});
  this.fullscreenIcon=this.add.graphics().setDepth(96);
  this.fullscreenButton.on('pointerdown',()=>{if(this.mainScene?.devTools?.uiEditor?.editMode)return;this.toggleFullscreen();});
  this.fullscreenIcon.setInteractive(new Phaser.Geom.Rectangle(-24,-24,48,48),Phaser.Geom.Rectangle.Contains);
  this.fullscreenIcon.on('pointerdown',()=>{if(this.mainScene?.devTools?.uiEditor?.editMode)return;this.toggleFullscreen();});
  if(typeof document!=='undefined'){
   this._fullscreenChangeHandler=()=>{ this.drawFullscreenIcon(); this.time.delayedCall(80,()=>this.layout()); };
   document.addEventListener('fullscreenchange',this._fullscreenChangeHandler);
   this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
    if(this._fullscreenChangeHandler) document.removeEventListener('fullscreenchange',this._fullscreenChangeHandler);
   });
  }
  this.drawFullscreenIcon();
 }

 drawFullscreenIcon(){
  if(!this.fullscreenIcon || !this.fullscreenButton) return;
  const x=this.fullscreenButton.x,y=this.fullscreenButton.y;
  const active=typeof document!=='undefined' && Boolean(document.fullscreenElement);
  const g=this.fullscreenIcon;
  g.clear();
  g.lineStyle(2.2,0xf1dfaa,0.95);
  const r=active?8:10, arm=active?7:6;
  // Four-corner fullscreen / exit-fullscreen glyph.
  if(!active){
   g.beginPath();
   g.moveTo(x-r,y-r+arm); g.lineTo(x-r,y-r); g.lineTo(x-r+arm,y-r);
   g.moveTo(x+r-arm,y-r); g.lineTo(x+r,y-r); g.lineTo(x+r,y-r+arm);
   g.moveTo(x-r,y+r-arm); g.lineTo(x-r,y+r); g.lineTo(x-r+arm,y+r);
   g.moveTo(x+r-arm,y+r); g.lineTo(x+r,y+r); g.lineTo(x+r,y+r-arm);
   g.strokePath();
  } else {
   g.beginPath();
   g.moveTo(x-r-arm,y-r); g.lineTo(x-r,y-r); g.lineTo(x-r,y-r-arm);
   g.moveTo(x+r+arm,y-r); g.lineTo(x+r,y-r); g.lineTo(x+r,y-r-arm);
   g.moveTo(x-r-arm,y+r); g.lineTo(x-r,y+r); g.lineTo(x-r,y+r+arm);
   g.moveTo(x+r+arm,y+r); g.lineTo(x+r,y+r); g.lineTo(x+r,y+r+arm);
   g.strokePath();
  }
 }

 async toggleFullscreen(){
  if(typeof document==='undefined') return;
  try{
   if(document.fullscreenElement){
    if(document.exitFullscreen) await document.exitFullscreen();
   } else {
    const target=document.documentElement;
    const request=target.requestFullscreen || target.webkitRequestFullscreen;
    if(request) await request.call(target);
    if(screen.orientation?.lock){
     try{ await screen.orientation.lock('landscape'); }catch(e){}
    }
   }
  }catch(e){
   console.warn('Fullscreen request was blocked by the browser',e);
  }
  this.time.delayedCall(80,()=>this.layout());
 }

 buildChampionRewardOverlay(){
  this.championRewardVisible=false;
  this.championRewardData=[];
  this.championRewardShade=this.add.rectangle(0,0,100,100,0x050403,0.62).setOrigin(0).setDepth(118).setVisible(false);
  this.championRewardPanel=this.addPanelGraphics(119).setVisible(false);
  this.championRewardTitle=lkAddText(this,0,0,'CHAMPION DEFEATED',{fontFamily:'Arial, sans-serif',fontSize:'26px',fontStyle:'bold',color:'#f5d78f',stroke:'#111111',strokeThickness:4,align:'center'}).setOrigin(0.5).setDepth(120).setVisible(false);
  this.championRewardSubtitle=lkAddText(this,0,0,'CHOOSE ONE CHAMPION RELIC',{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#ffffff'}).setOrigin(0.5).setDepth(120).setVisible(false);
  this.championRewardCards=[];
  for(let i=0;i<3;i++){
   const card=this.add.rectangle(0,0,100,60,0x243323,0.96).setStrokeStyle(2,0x7f9b68,0.82).setDepth(120).setVisible(false).setInteractive({useHandCursor:true});
   const name=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'17px',fontStyle:'bold',color:'#ffe8a8'}).setOrigin(0,0.5).setDepth(121).setVisible(false);
   const desc=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'12px',color:'#dbe8d7',wordWrap:{width:460,useAdvancedWrap:true}}).setOrigin(0,0.5).setDepth(121).setVisible(false);
   card.on('pointerover',()=>{ if(this.championRewardVisible) card.setFillStyle(0x354b32,1); });
   card.on('pointerout',()=>card.setFillStyle(0x243323,0.96));
   card.on('pointerdown',()=>this.mainScene?.selectChampionReward?.(i));
   this.championRewardCards.push({card,name,desc});
  }
 }

 showChampionRewards(championName,rewardColor,choices=[]){
  this.championRewardVisible=true;
  this.championRewardData=choices.slice(0,3);
  this.championRewardTitle.setText(`${championName} DEFEATED`).setColor(rewardColor||'#f5d78f');
  this.championRewardShade.setVisible(true);
  this.championRewardPanel.setVisible(true);
  this.championRewardTitle.setVisible(true);
  this.championRewardSubtitle.setVisible(true);
  this.championRewardCards.forEach((entry,i)=>{
   const c=this.championRewardData[i];
   const visible=Boolean(c);
   entry.card.setVisible(visible).setFillStyle(0x243323,0.96);
   entry.name.setVisible(visible).setText(c?.[0]||'');
   entry.desc.setVisible(visible).setText(c?.[1]||'');
  });
  this.layoutChampionRewardOverlay();
 }

 hideChampionRewards(){
  this.championRewardVisible=false;
  this.championRewardData=[];
  this.championRewardShade.setVisible(false);
  this.championRewardPanel.setVisible(false);
  this.championRewardTitle.setVisible(false);
  this.championRewardSubtitle.setVisible(false);
  this.championRewardCards.forEach(({card,name,desc})=>{card.setVisible(false);name.setVisible(false);desc.setVisible(false);});
 }

 layoutChampionRewardOverlay(){
  if(!this.championRewardVisible) return;
  const logical=lkLogicalSceneSize(this),w=logical.width,h=logical.height;
  const mobile=Boolean(this.mainScene?.isTouchDevice || h<560 || w<900);
  const cx=w/2,cy=h/2;
  const panelW=Math.min(mobile?560:650,w-(mobile?28:64));
  const cardH=mobile?58:66,gap=mobile?10:14;
  const panelH=(mobile?116:132)+3*cardH+2*gap;
  const x=cx-panelW/2,y=cy-panelH/2,r=mobile?10:12;
  this.championRewardShade.setPosition(0,0).setSize(w,h).setDisplaySize(w,h);
  this.championRewardPanel.clear();
  this.championRewardPanel.fillStyle(0x070605,0.46); this.championRewardPanel.fillRoundedRect(x+5,y+5,panelW,panelH,r);
  this.championRewardPanel.fillStyle(0x11100d,0.96); this.championRewardPanel.fillRoundedRect(x,y,panelW,panelH,r);
  this.championRewardPanel.lineStyle(mobile?2:2.5,0x9b7d47,0.94); this.championRewardPanel.strokeRoundedRect(x,y,panelW,panelH,r);
  this.championRewardTitle.setPosition(cx,y+(mobile?27:32)).setFontSize(mobile?20:27);
  this.championRewardSubtitle.setPosition(cx,y+(mobile?55:67)).setFontSize(mobile?11:14);
  const cardW=panelW-(mobile?30:48),startY=y+(mobile?98:112);
  this.championRewardCards.forEach((entry,i)=>{
   const c=this.championRewardData[i];
   const visible=Boolean(c);
   entry.card.setVisible(visible); entry.name.setVisible(visible); entry.desc.setVisible(visible);
   if(!visible) return;
   const yy=startY+i*(cardH+gap);
   entry.card.setPosition(cx,yy).setSize(cardW,cardH).setDisplaySize(cardW,cardH);
   const leftX=cx-cardW/2+(mobile?14:18);
   entry.name.setPosition(leftX,yy-(mobile?13:16)).setFontSize(mobile?14:17);
   entry.desc.setPosition(leftX,yy+(mobile?10:12)).setFontSize(mobile?10:12).setWordWrapWidth(cardW-(mobile?28:36),true);
  });
 }

 buildGameOver(){
  this.gameOverShade=this.add.rectangle(0,0,100,100,0x050403,0.72).setOrigin(0).setDepth(100).setVisible(false);
  this.gameOverFrame=this.add.rectangle(0,0,410,180,0x16120f,0.98).setStrokeStyle(3,0xa98649,1).setDepth(101).setVisible(false);
  this.gameOverTitle=lkAddText(this,0,0,'YOU HAVE FALLEN',{fontFamily:'Arial, sans-serif',fontSize:'28px',fontStyle:'bold',color:'#e6cf9a',stroke:'#1a1009',strokeThickness:4}).setOrigin(0.5).setDepth(102).setVisible(false);
  this.gameOverHint=lkAddText(this,0,0,'Press R to restart',{fontFamily:'Arial, sans-serif',fontSize:'15px',color:'#d1c7b5'}).setOrigin(0.5).setDepth(102).setVisible(false);
  this.restartButton=this.add.rectangle(0,0,180,44,0x2b2418,1).setStrokeStyle(2,0xc3a35d,1).setDepth(102).setVisible(false).setInteractive({useHandCursor:true});
  this.restartLabel=lkAddText(this,0,0,'RESTART',{fontFamily:'Arial, sans-serif',fontSize:'15px',fontStyle:'bold',color:'#f5dfad'}).setOrigin(0.5).setDepth(103).setVisible(false);
  this.restartButton.on('pointerdown',()=>{ if(this.mainScene?.gameOver) this.mainScene.scene.restart(); });
 }

 getDevUiGroups(){
  return {
   heroShell:{label:'Hero panel background',priority:0,objects:[this.heroPanelShell],boundsObjects:[this.levelText,this.hpFrame,this.xpFrame]},
   levelBadge:{label:'Level badge',priority:5,objects:[this.levelBadgeSimple,this.levelText,this.levelCaption],boundsObjects:[this.levelText]},
   hpBar:{label:'HP bar',priority:6,objects:[this.hpFill,this.hpShine,this.hpFrame,this.hpText],boundsObjects:[this.hpFrame]},
   xpBar:{label:'XP bar',priority:6,objects:[this.xpFill,this.xpFrame],boundsObjects:[this.xpFrame]},
   mana:{label:'Mana cluster',priority:6,objects:[this.manaRingsSimple,...this.manaGems],boundsObjects:this.manaGems},
   wavePanel:{label:'Wave panel background',priority:1,objects:[this.wavePanel],boundsObjects:[this.waveTitle,this.waveSub]},
   waveTitle:{label:'Wave title',priority:8,objects:[this.waveTitle],boundsObjects:[this.waveTitle]},
   waveRegion:{label:'Region subtitle',priority:9,objects:[this.waveSub],boundsObjects:[this.waveSub]},
   bossPanel:{label:'Champion panel background',priority:1,objects:[this.championPanel],boundsObjects:[this.bossName,this.bossHpBack]},
   bossName:{label:'Champion name',priority:8,objects:[this.bossName],boundsObjects:[this.bossName]},
   bossHp:{label:'Champion HP bar',priority:8,objects:[this.bossHpBack,this.bossHpFill,this.bossHpText],boundsObjects:[this.bossHpBack]},
   skillQuake:{label:'Skill 1 · Quake',priority:10,objects:[this.skill1.back,this.skill1.inner,this.skill1.icon,this.skill1.iconMaskShape,this.skill1.key,this.skill1.label],boundsObjects:[this.skill1.back]},
   skillLift:{label:'Skill 2 · Lift',priority:10,objects:[this.skill2.back,this.skill2.inner,this.skill2.icon,this.skill2.iconMaskShape,this.skill2.key,this.skill2.label],boundsObjects:[this.skill2.back]},
   skillSpin:{label:'Skill 3 · Spin',priority:10,objects:[this.skill3.back,this.skill3.inner,this.skill3.icon,this.skill3.iconMaskShape,this.skill3.key,this.skill3.label],boundsObjects:[this.skill3.back]},
   joystick:{label:'Movement joystick',priority:7,objects:[this.joyBack,this.joyRing,this.joyKnob,this.joyHint],boundsObjects:[this.joyBack]},
   fullscreen:{label:'Fullscreen button',priority:9,objects:[this.fullscreenButton,this.fullscreenIcon],boundsObjects:[this.fullscreenButton]}
  };
 }

 resetDevUiObjectsForLayout(){
  if(!DEV_BUILD)return;
  const seen=new Set();
  for(const group of Object.values(this.getDevUiGroups())){
   for(const o of group.objects||[]){
    if(!o||seen.has(o))continue;seen.add(o);
    const af=Number(o.__devUiAlphaFactor)||1;
    if(af!==1)o.setAlpha(Phaser.Math.Clamp(o.alpha/af,0,1));
    o.__devUiAlphaFactor=1;
    const depthOffset=Number(o.__devUiDepthOffset)||0;
    if(depthOffset)o.setDepth(o.depth-depthOffset);
    o.__devUiDepthOffset=0;
    o.setScale?.(1);
    if(o.type==='Graphics' || o.constructor?.name==='Graphics')o.setPosition?.(0,0);
   }
  }
 }

 getDevUiBoundsForObjects(objects=[]){
  const rects=[];
  for(const o of objects){
   if(!o?.active||!o.getBounds)continue;
   try{const b=o.getBounds();if(Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.width>=0&&b.height>=0)rects.push(b);}catch{}
  }
  if(!rects.length)return null;
  const left=Math.min(...rects.map(r=>r.x)),top=Math.min(...rects.map(r=>r.y));
  const right=Math.max(...rects.map(r=>r.right??r.x+r.width)),bottom=Math.max(...rects.map(r=>r.bottom??r.y+r.height));
  return {left,top,right,bottom,centerX:(left+right)/2,centerY:(top+bottom)/2};
 }

 applyDevUiLayoutOverrides(){
  const editor=this.mainScene?.devTools?.uiEditor;if(!editor)return;
  const groups=this.getDevUiGroups(),bounds={};
  for(const [id,group] of Object.entries(groups))bounds[id]=this.getDevUiBoundsForObjects(group.boundsObjects||group.objects);
  for(const [id,group] of Object.entries(groups)){
   const b=bounds[id];if(!b)continue;
   const t=editor.getTransform(id);
   const sx=(t.scale||1)*(t.width||1),sy=(t.scale||1)*(t.height||1),dx=t.dx||0,dy=t.dy||0;
   for(const o of group.objects||[]){
    if(!o?.active)continue;
    const bx=o.x||0,by=o.y||0,bsx=o.scaleX??1,bsy=o.scaleY??1;
    o.setPosition?.(b.centerX+dx+(bx-b.centerX)*sx,b.centerY+dy+(by-b.centerY)*sy);
    const isText=Boolean(o.setFontSize&&o.style);
    // Width / Height reshape the panel artwork, not the typography. Text follows
    // the group's position, but keeps its aspect ratio and has its own Font Scale.
    if(isText)o.setScale?.(bsx*(t.scale||1),bsy*(t.scale||1));
    else o.setScale?.(bsx*sx,bsy*sy);
    if(isText){
     const fs=parseFloat(o.style?.fontSize)||0;if(fs>0)o.setFontSize(Math.max(1,fs*(t.fontScale||1)));
    }
    const alphaFactor=Phaser.Math.Clamp(t.alpha??1,0.05,1);
    o.setAlpha?.(Phaser.Math.Clamp(o.alpha*alphaFactor,0,1));o.__devUiAlphaFactor=alphaFactor;
    const d=Math.round(t.depth||0);if(d){o.setDepth?.(o.depth+d);o.__devUiDepthOffset=d;}
   }
  }
  if(this.joyBack){this.joyCenter={x:this.joyBack.x,y:this.joyBack.y,r:Math.max(1,this.joyBack.displayWidth*0.5)};}
 }


 resetDevUiRuntimeAlpha(){
  if(!DEV_BUILD)return;
  const seen=new Set();
  for(const group of Object.values(this.getDevUiGroups()))for(const o of group.objects||[]){
   if(!o||seen.has(o))continue;seen.add(o);
   const af=Number(o.__devUiAlphaFactor)||1;if(af!==1)o.setAlpha?.(Phaser.Math.Clamp(o.alpha/af,0,1));o.__devUiAlphaFactor=1;
  }
 }
 applyDevUiRuntimeAlpha(){
  const editor=this.mainScene?.devTools?.uiEditor;if(!editor)return;
  for(const [id,group] of Object.entries(this.getDevUiGroups())){
   const af=Phaser.Math.Clamp(editor.getTransform(id).alpha??1,0.05,1);
   for(const o of group.objects||[]){if(!o?.active)continue;o.setAlpha?.(Phaser.Math.Clamp(o.alpha*af,0,1));o.__devUiAlphaFactor=af;}
  }
 }

 layout(){
  this.resetDevUiObjectsForLayout();
  this.cameras.main.setOrigin(0,0).setZoom(LK_RENDER_SCALE);
  const logical=lkLogicalSceneSize(this),w=logical.width,h=logical.height;
  this.safe=this.getSafeArea();
  if(this.lowHealthState==='critical' || this.lowHealthState==='deathDoor'){
   const maxAlpha=this.lowHealthState==='deathDoor' ? LOW_HEALTH_CONFIG.DEATH_DOOR_VIGNETTE_ALPHA : LOW_HEALTH_CONFIG.CRITICAL_VIGNETTE_ALPHA;
   this.drawVignette(this.lowHealthVignette,maxAlpha);
  }
  if(this.lowHealthFlash?.visible) this.drawVignette(this.lowHealthFlash,LOW_HEALTH_CONFIG.CRITICAL_FLASH_ALPHA);
  const mobile=Boolean(this.mainScene?.isTouchDevice || h<520 || w<900);
  const left=this.safe.left+(mobile?10:22);
  const top=this.safe.top+(mobile?8:20);
  const right=w-this.safe.right-(mobile?10:24);
  const bottom=h-this.safe.bottom-(mobile?8:22);
  const screenCx=w/2;

  // Fullscreen belongs to the lower-left utility corner. On touch screens the
  // joystick occupies the literal corner, so the button sits directly above it.
  if(this.fullscreenButton){
   const fsR=mobile?19:22;
   const fsX=left+fsR;
   const fsY=this.mainScene?.isTouchDevice ? bottom-(mobile?126:148) : bottom-fsR;
   this.fullscreenButton.setPosition(fsX,fsY).setRadius(fsR).setStrokeStyle(mobile?1.5:2,0xc4a662,0.82);
   this.drawFullscreenIcon();
  }

  // Build 1.3.6: clean stacked hero HUD. The information hierarchy is fixed:
  // Level + HP -> vertical gap -> XP -> vertical gap -> Mana.
  // Only HP/XP use decorative raster frames; level/mana geometry is vector-clean.
  const basePanelW=430,basePanelH=194;
  const desiredW=mobile ? Phaser.Math.Clamp(w*0.34,218,292) : Math.min(430,Math.max(300,w*0.42));
  const rawScale=desiredW/basePanelW;
  const uiScale=Phaser.Math.Clamp(Math.round(rawScale*8)/8,mobile?0.50:0.625,1);
  const panelW=Math.round(basePanelW*uiScale),panelH=Math.round(basePanelH*uiScale);
  const px=Math.round(left),py=Math.round(top);

  const levelD=Math.round(104*uiScale);
  const levelR=levelD*0.5;
  const topRowY=Math.round(py+levelR+Math.max(3,5*uiScale));
  const badgeX=Math.round(px+levelR),badgeY=topRowY;
  const contentLeft=Math.round(px+levelD*0.92);
  const contentRight=Math.round(px+panelW-Math.max(8,14*uiScale));
  const contentW=Math.max(Math.round(120*uiScale),contentRight-contentLeft);

  // Compute the restrained backplate geometry first, but draw it after HP/XP
  // are positioned so the shell height can tightly fit that compact stack.
  this.heroPanelShell.clear();
  const bodyX=Math.round(px+levelD*0.40),bodyY=Math.round(py+3*uiScale);
  const bodyW=Math.round(panelW-levelD*0.36);
  const shellRadius=Math.max(5,Math.round(8*uiScale));

  // Simple level badge: same dark centre, one clean gold ring, no ornamental spikes.
  this.levelBadgeSimple.clear();
  this.levelBadgeSimple.fillStyle(0x171512,0.98);
  this.levelBadgeSimple.fillCircle(badgeX,badgeY,levelR-2);
  this.levelBadgeSimple.lineStyle(Math.max(2,Math.round(4*uiScale)),0xd39a35,1);
  this.levelBadgeSimple.strokeCircle(badgeX,badgeY,levelR-2);
  this.levelBadgeSimple.lineStyle(Math.max(1,Math.round(1*uiScale)),0xffd47a,0.62);
  this.levelBadgeSimple.strokeCircle(badgeX,badgeY,Math.max(4,levelR-Math.max(5,Math.round(7*uiScale))));
  this.levelCaption.setVisible(false);
  this.levelText.setPosition(badgeX,badgeY).setFontSize(Math.max(15,Math.round(31*uiScale)));

  // HP stays the primary visual element on the top row.
  const hpSrc=this.hpFrame.frame;
  const hpAspect=(hpSrc?.realWidth||351)/(hpSrc?.realHeight||119);
  const hpW=Math.round(contentW);
  // Build 1.3.13 baseline: approved slimmer HP frame.
  const hpHeightScale=0.68;
  const hpH=Math.max(16,Math.round((hpW/hpAspect)*hpHeightScale));
  const hpY=topRowY;
  this.hpFrame.setPosition(Math.round(contentLeft+hpW/2),hpY).setDisplaySize(hpW,hpH);
  this.hpFrameBaseScaleX=this.hpFrame.scaleX;
  this.hpFrameBaseScaleY=this.hpFrame.scaleY;
  const hpInnerX=Math.round(contentLeft+hpW*0.115),hpInnerW=Math.round(hpW*0.77),hpInnerH=Math.max(3,Math.round(hpH*0.29));
  this.hpFill.setPosition(hpInnerX,hpY).setSize(hpInnerW,hpInnerH).setDisplaySize(hpInnerW,hpInnerH);
  this.hpShine.setPosition(hpInnerX,Math.round(hpY-hpInnerH*0.23)).setSize(hpInnerW,Math.max(1,Math.round(hpInnerH*0.22))).setDisplaySize(hpInnerW,Math.max(1,Math.round(hpInnerH*0.22)));
  this.hpText.setPosition(Math.round(contentLeft+hpW/2),hpY).setFontSize(Math.max(7,Math.round(12*uiScale)));

  // XP is deliberately thinner and kept close to HP with only a small gap.
  const xpSrc=this.xpFrame.frame;
  const xpAspect=(xpSrc?.realWidth||313)/(xpSrc?.realHeight||100);
  const xpW=Math.round(contentW*0.95);
  const naturalXpH=Math.round(xpW/xpAspect);
  const xpH=Math.max(9,Math.round(naturalXpH*0.62));
  const hpBottom=hpY+hpH*0.5;
  const hpXpGap=Math.max(2,Math.round(3*uiScale));
  // Visual correction: the decorative XP frame reads lower than its sprite bounds.
  // Lift the whole XP element (frame + fill) toward HP, matching the approved mockup.
  const xpVisualLift=Math.max(12,Math.round(20*uiScale));
  const xpY=Math.round(hpBottom+hpXpGap+xpH*0.5-xpVisualLift);
  const xpX=Math.round(contentLeft+xpW/2);
  this.xpFrame.setPosition(xpX,xpY).setDisplaySize(xpW,xpH);
  const xpInnerX=Math.round(contentLeft+xpW*0.105),xpInnerW=Math.round(xpW*0.79),xpInnerH=Math.max(2,Math.round(xpH*0.13));
  // Build 1.3.13 baseline: optical centering inside the ornate XP opening.
  const xpFillY=Math.round(xpY+Math.max(1,Math.round(3*uiScale)));
  this.xpFill.setPosition(xpInnerX,xpFillY).setSize(xpInnerW,xpInnerH).setDisplaySize(xpInnerW,xpInnerH);

  // One restrained dark backplate; 50% opacity and fitted tightly around HP + XP.
  const xpBottom=Math.round(xpY+xpH*0.5);
  const shellBottomPad=Math.max(4,Math.round(7*uiScale));
  const bodyH=Math.round((xpBottom+shellBottomPad)-bodyY);
  this.heroPanelShell.fillStyle(0x080706,0.50);
  this.heroPanelShell.fillRoundedRect(bodyX,bodyY,bodyW,bodyH,shellRadius);
  this.heroPanelShell.lineStyle(Math.max(1,Math.round(1.5*uiScale)),0x8f743b,0.58);
  this.heroPanelShell.strokeRoundedRect(bodyX,bodyY,bodyW,bodyH,shellRadius);

  // Mana: three independent simple gold rings, centered beneath the backplate.
  this.manaRingsSimple.clear();
  const manaPanelGap=Math.max(6,Math.round(8*uiScale));
  const manaR=Math.max(13,Math.round(25*uiScale));
  const manaY=Math.round(bodyY+bodyH+manaPanelGap+manaR);
  const ringGap=Math.max(8,Math.round(12*uiScale));
  const clusterW=manaR*6+ringGap*2;
  const clusterCx=Math.round(bodyX+bodyW*0.5);
  const manaCenters=[clusterCx-(manaR*2+ringGap),clusterCx,clusterCx+(manaR*2+ringGap)];
  manaCenters.forEach(cx=>{
   this.manaRingsSimple.fillStyle(0x171512,0.96);
   this.manaRingsSimple.fillCircle(cx,manaY,manaR-1);
   this.manaRingsSimple.lineStyle(Math.max(2,Math.round(3*uiScale)),0xd39a35,1);
   this.manaRingsSimple.strokeCircle(cx,manaY,manaR-1);
   this.manaRingsSimple.lineStyle(1,0xffd47a,0.50);
   this.manaRingsSimple.strokeCircle(cx,manaY,Math.max(5,manaR-Math.max(4,Math.round(5*uiScale))));
  });
  const bottleSize=Math.max(12,Math.round(manaR*1.05));
  const opticalLift=Math.max(0,Math.round(manaR*0.04));
  this.manaGems.forEach((gem,i)=>gem.setPosition(manaCenters[i],manaY-opticalLift).setDisplaySize(bottleSize,bottleSize));

  this.heroHpMaxWidth=hpInnerW;
  this.heroXpMaxWidth=xpInnerW;

  // Top-center status slot: WAVE normally, CHAMPION replaces it during boss events.
  const waveW=mobile?150:220,waveH=mobile?48:64;
  const cx=screenCx;
  const waveX=cx-waveW/2,waveY=top;
  this.wavePanel.clear();
  this.wavePanel.fillStyle(0x15130f,0.90); this.wavePanel.fillRoundedRect(waveX,waveY,waveW,waveH,mobile?7:9);
  this.wavePanel.lineStyle(mobile?1.5:2,0x7c6842,0.9); this.wavePanel.strokeRoundedRect(waveX,waveY,waveW,waveH,mobile?7:9);
  this.waveTitle.setPosition(cx,waveY+(mobile?15:20)).setFontSize(mobile?14:21);
  this.waveSub.setPosition(cx,waveY+(mobile?34:44)).setFontSize(mobile?8:10);

  const bossW=Math.min(mobile?260:360,w-this.safe.left-this.safe.right-(mobile?24:40));
  const bossH=waveH;
  const bossX=screenCx-bossW/2,bossY=waveY;
  this.championPanel.clear();
  this.championPanel.fillStyle(0x15110d,0.94); this.championPanel.fillRoundedRect(bossX,bossY,bossW,bossH,mobile?7:9);
  this.championPanel.lineStyle(mobile?1.5:2,0xa28346,0.95); this.championPanel.strokeRoundedRect(bossX,bossY,bossW,bossH,mobile?7:9);
  this.bossName.setPosition(screenCx,bossY+(mobile?13:17)).setFontSize(mobile?12:17);
  const bossHpY=bossY+(mobile?34:44);
  this.bossHpBack.setPosition(screenCx,bossHpY).setSize(bossW-(mobile?24:30),mobile?14:17).setDisplaySize(bossW-(mobile?24:30),mobile?14:17);
  this.bossHpFill.setPosition(screenCx-(bossW-(mobile?24:30))/2+(mobile?3:4),bossHpY).setSize(bossW-(mobile?30:38),mobile?8:10).setDisplaySize(bossW-(mobile?30:38),mobile?8:10);
  this.bossHpText.setPosition(screenCx,bossHpY).setFontSize(mobile?8:10);

  // Compact skill cluster. Labels/caption are intentionally hidden in 1.1.1.
  const skillR=mobile?31:39;
  const gap=mobile?8:14;
  const sx3=right-skillR,sy3=bottom-skillR;
  const sx1=sx3-(skillR*2+gap),sy1=sy3;
  const sx2=(sx1+sx3)/2,sy2=sy3-(skillR*1.48+gap);
  const pos=[[sx1,sy1],[sx2,sy2],[sx3,sy3]];
  this.skills.forEach((skill,i)=>{
   const [x,y]=pos[i];
   skill.back.setPosition(x,y).setRadius(skillR).setStrokeStyle(mobile?2:2.5,0xb79a58,0.96);
   skill.inner.setPosition(x,y).setRadius(skillR-(mobile?5:6)).setStrokeStyle(1,0xe0c678,0.28);
   skill.key.setPosition(x-skillR*0.70,y-skillR*0.70).setFontSize(mobile?9:11);
   skill.label.setVisible(false);
   this.drawSkillIcon(skill,x,y,skillR);
  });
  this.skillCaption.setVisible(false);

  // Slightly larger fixed joystick; the whole left half of the screen acts as its touch zone.
  const joyR=mobile?54:62;
  const jx=left+joyR+(mobile?2:6),jy=bottom-joyR-(mobile?2:4);
  this.joyBack.setPosition(jx,jy).setRadius(joyR).setStrokeStyle(mobile?2:3,0xbeb49c,0.35);
  this.joyRing.setPosition(jx,jy).setRadius(joyR*0.72).setStrokeStyle(mobile?1.5:2,0xd9cfbb,0.22);
  if(this.movePointerId===null) this.joyKnob.setPosition(jx,jy);
  this.joyKnob.setRadius(joyR*0.40);
  this.joyHint.setPosition(jx,jy).setVisible(false);
  this.joyCenter={x:jx,y:jy,r:joyR};

  const showTouch=Boolean(this.mainScene?.isTouchDevice);
  [this.joyBack,this.joyRing,this.joyKnob].forEach(o=>o.setVisible(showTouch));
  this.joyHint.setVisible(false);

  this.gameOverShade.setPosition(0,0).setSize(w,h).setDisplaySize(w,h);
  const goW=Math.min(mobile?330:430,w-24);
  const goH=mobile?142:180;
  this.gameOverFrame.setPosition(screenCx,h/2).setSize(goW,goH).setDisplaySize(goW,goH);
  this.gameOverTitle.setPosition(screenCx,h/2-(mobile?20:25)).setFontSize(mobile?20:26);
  this.gameOverHint.setPosition(screenCx,h/2+(mobile?14:20)).setFontSize(mobile?11:13);
  this.restartButton.setPosition(screenCx,h/2+(mobile?49:66)).setSize(mobile?150:180,mobile?38:44).setDisplaySize(mobile?150:180,mobile?38:44).setStrokeStyle(2,0xc3a35d,1);
  this.restartLabel.setPosition(screenCx,h/2+(mobile?49:66)).setFontSize(mobile?12:14);

  this.layoutLevelChoiceOverlay();
  this.layoutEventBanner();
  this.layoutChampionRewardOverlay();
  this.applyDevUiLayoutOverrides();
 }

 onPointerDown(pointer){
  if(this.mainScene?.devTools?.uiEditor?.editMode){this.mainScene.devTools.uiEditor.handlePointerDown(pointer);return;}
  if(!this.mainScene?.isTouchDevice || !this.joyCenter || this.movePointerId!==null || this.levelChoiceVisible || this.championRewardVisible || this.mainScene?.gameOver) return;
  const logical=lkLogicalSceneSize(this),w=logical.width;
  const pp=lkUiPointer(this,pointer);
  // Any press that STARTS on the left half becomes the movement pointer.
  if(pp.x>w*0.5) return;
  this.movePointerId=pointer.id;
  this.joyTouchOrigin={x:pp.x,y:pp.y};
  this.mainScene.mobileMoveX=0;
  this.mainScene.mobileMoveY=0;
  this.joyKnob.setPosition(this.joyCenter.x,this.joyCenter.y);
 }

 onPointerMove(pointer){
  if(this.mainScene?.devTools?.uiEditor?.editMode){this.mainScene.devTools.uiEditor.handlePointerMove(pointer);return;}
  if(pointer.id===this.movePointerId) this.updateJoystick(pointer);
 }

 onPointerUp(pointer){
  if(this.mainScene?.devTools?.uiEditor?.editMode){this.mainScene.devTools.uiEditor.handlePointerUp(pointer);return;}
  if(pointer.id!==this.movePointerId) return;
  this.movePointerId=null;
  this.joyTouchOrigin=null;
  if(this.mainScene){this.mainScene.mobileMoveX=0;this.mainScene.mobileMoveY=0;}
  if(this.joyCenter) this.joyKnob.setPosition(this.joyCenter.x,this.joyCenter.y);
 }

 updateJoystick(pointer){
  if(!this.joyCenter || !this.mainScene || !this.joyTouchOrigin) return;
  // Movement is relative to where the finger first touched the left half.
  // The visible joystick stays fixed in the corner and mirrors that gesture.
  const pp=lkUiPointer(this,pointer);
  const dx=pp.x-this.joyTouchOrigin.x,dy=pp.y-this.joyTouchOrigin.y;
  const len=Math.max(0.001,Math.hypot(dx,dy));
  const max=this.joyCenter.r*0.62;
  const k=Math.min(1,max/len);
  this.joyKnob.setPosition(this.joyCenter.x+dx*k,this.joyCenter.y+dy*k);
  const deadzone=Math.max(8,this.joyCenter.r*0.13);
  if(len<deadzone){this.mainScene.mobileMoveX=0;this.mainScene.mobileMoveY=0;}
  else {this.mainScene.mobileMoveX=dx/len;this.mainScene.mobileMoveY=dy/len;}
 }

 update(){
  this.resetDevUiRuntimeAlpha();
  const m=this.mainScene;
  if(!m || !m.player) return;
  this.setLowHealthVisualPaused(Boolean(m.gameplayPaused || m.gameOver));
  const maxHp=Math.max(1,m.player.maxHp||100);
  const hp=Math.max(0,Math.min(maxHp,m.player.hp||0));
  const hpRatio=hp/maxHp;
  const fullHpWidth=this.heroHpMaxWidth || this.hpFill.width || 1;
  const hpUi=this.mainScene?.devTools?.uiEditor?.getTransform?.('hpBar');
  const hpUiSx=hpUi?(hpUi.scale||1)*(hpUi.width||1):1;
  this.hpFill.displayWidth=Math.max(0.1,fullHpWidth*hpRatio*hpUiSx);
  this.hpShine.displayWidth=Math.max(0.1,fullHpWidth*hpRatio*hpUiSx);
  this.hpText.setText(`${Math.ceil(hp)} / ${Math.ceil(maxHp)}`);
  this.applyHpPulseFrame();
  this.levelText.setText(String(m.level||1));
  const xpRequired=typeof m.getXpRequiredForLevel==='function' ? m.getXpRequiredForLevel() : BALANCE.XP_BASE;
  const xpRatio=Phaser.Math.Clamp((m.xp||0)/Math.max(1,xpRequired),0,1);
  const xpUi=this.mainScene?.devTools?.uiEditor?.getTransform?.('xpBar');
  const xpUiSx=xpUi?(xpUi.scale||1)*(xpUi.width||1):1;
  this.xpFill.displayWidth=Math.max(0.1,(this.heroXpMaxWidth||this.xpFill.width||1)*xpRatio*xpUiSx);

  this.waveTitle.setText(`WAVE ${m.wave||1}`);
  this.waveSub.setText(m.getWorldProgressName ? m.getWorldProgressName() : 'ASH FIELDS');

  const mana=Phaser.Math.Clamp(m.mana??0,0,m.maxMana??3);
  this.manaGems.forEach((gem,i)=>{
   const active=i<mana;
   gem.setAlpha(active?1:0.22);
   if(active) gem.clearTint();
   else gem.setTint(0x4a5560);
  });
  const canCast=mana>0 && !m.gameOver;
  this.skills.forEach(skill=>{
   skill.back.setAlpha(canCast?1:0.62);
   skill.inner.setAlpha(canCast?1:0.50);
   skill.icon.setAlpha(canCast?1:0.46);
  });

  const champ=m.activeChampion && m.activeChampion.active ? m.activeChampion : null;
  const bossVisible=Boolean(champ);
  // Champion takes over the exact top-center status slot; never stack WAVE + boss UI.
  [this.wavePanel,this.waveTitle,this.waveSub].forEach(o=>o.setVisible(!bossVisible));
  [this.championPanel,this.bossName,this.bossHpBack,this.bossHpFill,this.bossHpText].forEach(o=>o.setVisible(bossVisible));
  if(champ){
   const ratio=Phaser.Math.Clamp(champ.hp/champ.maxHp,0,1);
   const maxW=this.bossHpBack.displayWidth-8;
   this.bossHpFill.displayWidth=Math.max(0.1,maxW*ratio);
   this.bossName.setText(champ.championName || 'CHAMPION');
   this.bossHpText.setText(`${Math.ceil(Math.max(0,champ.hp))} / ${champ.maxHp}`);
  }

  const over=Boolean(m.gameOver && m.gameOverUiReady);
  [this.gameOverShade,this.gameOverFrame,this.gameOverTitle,this.gameOverHint,this.restartButton,this.restartLabel].forEach(o=>o.setVisible(over));
  if(over && m.isTouchDevice) this.gameOverHint.setText('Tap restart to continue');
  else this.gameOverHint.setText('Press R or click restart');
  this.applyDevUiRuntimeAlpha();
 }
}

const LK_INITIAL_CSS=lkCssViewport();
try{
 const saved=Number(localStorage.getItem(LK_RENDER_SCALE_STORAGE_KEY));
 if(Number.isFinite(saved)&&saved>=1)LK_RENDER_SCALE=Phaser.Math.Clamp(saved,1,LK_RENDER_SCALE_MAX);
}catch{}

const game=new Phaser.Game({
 type:Phaser.AUTO,
 parent:'game',
 backgroundColor:'#0b160d',
 antialias:true,
 roundPixels:true,
 scale:{
  mode:Phaser.Scale.FIT,
  autoCenter:Phaser.Scale.CENTER_BOTH,
  width:Math.max(1,Math.round(LK_INITIAL_CSS.width*LK_RENDER_SCALE)),
  height:Math.max(1,Math.round(LK_INITIAL_CSS.height*LK_RENDER_SCALE))
 },
 physics:{default:'arcade',arcade:{debug:false}},
 scene:[BootScene,PreloadScene,CinematicScene,MainScene,HUDScene]
});

let lkResizeRaf=0;
function lkSyncViewport(){
 if(lkResizeRaf)return;
 lkResizeRaf=requestAnimationFrame(()=>{lkResizeRaf=0;lkApplyRenderScale(game,LK_RENDER_SCALE,{remember:false});});
}
if(typeof window!=='undefined'){
 window.addEventListener('resize',lkSyncViewport,{passive:true});
 window.visualViewport?.addEventListener?.('resize',lkSyncViewport,{passive:true});
 window.setTimeout(()=>lkApplyRenderScale(game,LK_RENDER_SCALE,{remember:false}),120);
}

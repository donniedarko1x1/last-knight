import Phaser from 'phaser';

const CAMERA_IN_MS=300;
const CAMERA_OUT_MS=300;
const DIALOGUE_INPUT_LOCK_MS=220;
const STORY_FOCUS_OWNER='worldDialogue';

// The same physical E key starts an interaction and advances its dialogue,
// including when the keyboard layout produces the Russian letter «у».
function isInteractionKey(event){
 if(event?.code && event.code!=='Unidentified')return event.code==='KeyE';
 return event?.keyCode===69 || String(event?.key||'').toLowerCase()==='e';
}

function addUiText(scene,x,y,text,style){
 const object=scene.add.text(x,y,text,style);
 object.setResolution?.(2);
 return object;
}

// World-space story text should keep a stable CSS-pixel size even when the
// backing render scale changes. Convert one CSS pixel into the current camera's
// world units instead of letting HiDPI scale shrink speech panels.
function worldUiScale(scene){
 const cam=scene?.cameras?.main;
 const zoom=Math.max(0.01,cam?.zoom||1);
 const canvas=scene?.game?.canvas;
 let backingScale=1;
 try{
  const rect=canvas?.getBoundingClientRect?.();
  if(rect?.width>0&&rect?.height>0){
   const sx=(canvas.width||scene?.scale?.width||rect.width)/rect.width;
   const sy=(canvas.height||scene?.scale?.height||rect.height)/rect.height;
   if(Number.isFinite(sx)&&Number.isFinite(sy)&&sx>0&&sy>0)backingScale=(sx+sy)*0.5;
  }
 }catch{}
 return Math.max(0.05,backingScale/zoom);
}

function cssViewportWidth(scene){
 try{
  const rect=scene?.game?.canvas?.getBoundingClientRect?.();
  if(rect?.width>0)return rect.width;
 }catch{}
 return Math.max(320,(scene?.scale?.width||1280)/Math.max(0.01,worldUiScale(scene)*(scene?.cameras?.main?.zoom||1)));
}

// Shared presentation and input for hero- and NPC-initiated conversations.
// Interaction clients own their trigger/quest logic; this class owns the session.
class WorldDialogueSystem {
 constructor(scene,{storyDirector=null}={}){
  this.scene=scene;
  this.storyDirector=storyDirector;
  this.active=null;
  this.installed=false;
  this.dialogueControls=null;
  this.dialogueLineIndex=0;
  this.dialogueInputLockUntil=0;
  this.closeAt=0;
  this.cameraRestore=null;
  this.dialogueVignetteState=null;
  this.combatSnapshot=null;
  this._onKeyDown=this.onKeyDown.bind(this);
  this._onMobileWorldInteract=this.onMobileWorldInteract.bind(this);
  this._onDialogueStart=this.onDialogueStart.bind(this);
  this._onPreRender=()=>this.positionDialogueUi();
  this._onStoryStateChanged=next=>{
   if(this.active && next!=='DIALOGUE')this.finishDialogue({cancelled:true,notifyDirector:false});
  };
 }

 install(){
  if(this.installed)return this;
  this.installed=true;
  const scene=this.scene;
  this.dialogueText=addUiText(scene,0,0,'',{
   fontFamily:'Georgia, serif',fontSize:'18px',color:'#f3e8d5',
   stroke:'#090807',strokeThickness:2,backgroundColor:'#11100ee8',
   padding:{x:12,y:8},align:'center',wordWrap:{width:360,useAdvancedWrap:true}
  }).setOrigin(0.5,1).setDepth(640).setVisible(false);
  this.dialogueFontSize=null;
  this.dialogueWrapWidth=null;
  scene.input.keyboard?.on('keydown',this._onKeyDown);
  scene.events.on('mobile-world-interact',this._onMobileWorldInteract);
  scene.events.on('story-dialogue-start',this._onDialogueStart);
  scene.events.on('prerender',this._onPreRender);
  scene.events.on('story-state-changed',this._onStoryStateChanged);
  return this;
 }

 destroy(){
  if(!this.scene)return;
  this.cancel({restoreCamera:false});
  const scene=this.scene;
  scene.input.keyboard?.off('keydown',this._onKeyDown);
  scene.events.off('mobile-world-interact',this._onMobileWorldInteract);
  scene.events.off('story-dialogue-start',this._onDialogueStart);
  scene.events.off('prerender',this._onPreRender);
  scene.events.off('story-state-changed',this._onStoryStateChanged);
  this.dialogueText?.destroy();
  this.dialogueText=null;
  this.installed=false;
  this.scene=null;
  this.storyDirector=null;
 }

 begin({target,lines=[],initiator='npc',speakerName='Собеседник',owner='npc',kind='npc',
        entry=null,eventId=null,once=true,onComplete=null,onCancel=null}={}){
  const scene=this.scene;
  if(!this.installed || !scene || this.active || this.storyDirector?.isBusy?.())return false;
  if(scene.gameOver || scene.gameplayPaused || scene.levelChoiceOpen || scene.championRewardOpen)return false;
  if(!target?.active || target.hp<=0 || !scene.player?.active || !['hero','npc'].includes(initiator))return false;
  const dialogueLines=Array.isArray(lines)?lines.filter(line=>line && String(line.text||'').trim()).map(line=>({
   speaker:line.speaker==='hero'?'hero':'npc',text:String(line.text).trim()
  })):[];
  if(!dialogueLines.length || (once && eventId && this.storyDirector?.hasCompleted?.(eventId)))return false;
  if(scene.isStoryFocusLocked?.() || !scene.acquireStoryFocus?.(STORY_FOCUS_OWNER))return false;
  const started=this.storyDirector?.beginDialogue?.({kind:'world-dialogue',session:{
   target,lines:dialogueLines,initiator,speakerName,owner,kind,entry,onComplete,onCancel
  }},{eventId,once});
  if(!started || !this.active){
   scene.releaseStoryFocus?.(STORY_FOCUS_OWNER,{cooldownMs:0});
   return false;
  }
  return true;
 }

 onKeyDown(event){
  if(!this.active || event?.repeat || !isInteractionKey(event))return;
  this.advanceDialogue(this.scene.game?.loop?.time||0);
 }

 onMobileWorldInteract(pointer){
  if(!this.active || !this.scene.isTouchDevice)return;
  if(!this.scene.isMobileInteractionPointerAllowed?.(pointer))return;
  this.advanceDialogue(this.scene.game?.loop?.time||0);
 }

 freezeCombat(){
  const scene=this.scene;
  const now=scene.time.now;
  scene.player?.body?.setVelocity?.(0,0);
  scene.mobileMoveX=0;
  scene.mobileMoveY=0;
  scene.mobileMovePointerId=null;
  scene.playerAttackUntil=now;
  if(scene.activeAttackFx?.active)scene.activeAttackFx.destroy();
  scene.activeAttackFx=null;
  if(scene.meleeAttack)scene.meleeAttack.lastAttack=now;
  const animations=[];
  const projectiles=(scene.projectiles||[]).filter(p=>p?.active);
  for(const enemy of scene.enemies||[]){
   if(!enemy?.active)continue;
   enemy.pendingMeleeHitAt=0;
   enemy.pendingMeleeDamage=0;
   enemy.pendingMeleeRange=0;
   enemy.attackAnimUntil=0;
  }
  for(const actor of [...(scene.enemies||[]).map(e=>e?.visual||e),...projectiles]){
   if(actor?.active && actor.anims?.isPlaying && !actor.anims.isPaused){
    actor.anims.pause();
    animations.push(actor);
   }
  }
  this.combatSnapshot={startedAt:now,projectiles,animations};
 }

 resumeCombat(){
  const scene=this.scene;
  const snapshot=this.combatSnapshot;
  this.combatSnapshot=null;
  if(!snapshot)return;
  const now=scene.time.now;
  // Phaser still advances Clock.now while paused; preserve projectile lifetimes.
  const elapsed=Math.max(0,now-snapshot.startedAt);
  for(const projectile of snapshot.projectiles){
   if(!projectile?.active)continue;
   if(scene.player?.active && Math.hypot(projectile.x-scene.player.x,projectile.y-scene.player.y)<(scene.player.hitRadius||16)+54){
    projectile.destroy();
    continue;
   }
   if(Number.isFinite(projectile.born))projectile.born+=elapsed;
   projectile.lastWorldX=projectile.x;
   projectile.lastWorldY=projectile.y;
  }
  for(const actor of snapshot.animations){
   if(actor?.active)actor.anims?.resume?.();
  }
  for(const enemy of scene.enemies||[]){
   if(!enemy?.active)continue;
   enemy.lastAttack=now;
   enemy.lastShot=now;
  }
  if(scene.meleeAttack)scene.meleeAttack.lastAttack=now;
 }

 onDialogueStart(payload,controls){
  if(payload?.kind!=='world-dialogue')return;
  if(!payload.session?.target?.active){controls?.cancel?.();return;}
  this.active={...payload.session,closing:false};
  this.dialogueControls=controls||null;
  this.dialogueLineIndex=0;
  this.dialogueInputLockUntil=(this.scene.game?.loop?.time||0)+DIALOGUE_INPUT_LOCK_MS;
  this.closeAt=0;
  this.freezeCombat();
  const scene=this.scene;
  const cam=scene.cameras.main;
  this.cameraRestore={zoom:cam.zoom};
  cam.stopFollow();

  const midpointX=(scene.player.x+this.active.target.x)*0.5;
  const midpointY=(scene.player.y+this.active.target.y)*0.5-18;
  let focusX=midpointX;
  let focusY=midpointY;
  // Keep enough context around both actors so long dialogue panels have real
  // screen space to avoid the hero/NPC instead of filling the whole camera.
  let targetZoom=Math.min(cam.zoom*1.18,cam.zoom+0.20);

  if(scene.isTouchDevice){
   // Keep both actors inside the unobstructed middle-right gameplay area rather
   // than under HP/Wave panels or the bottom touch controls. A light zoom is
   // enough on phones; the old 1.52x close-up made speech bubbles enormous.
   targetZoom=Math.min(cam.zoom*1.08,cam.zoom+0.12);
   const targetViewW=cam.width/Math.max(0.01,targetZoom);
   const targetViewH=cam.height/Math.max(0.01,targetZoom);
   focusX=midpointX-targetViewW*0.06; // actors appear ~6% right of screen center
   focusY=midpointY-targetViewH*0.05; // actors appear ~5% below screen center
  }

  cam.pan(focusX,focusY,CAMERA_IN_MS,'Sine.easeOut',true);
  cam.zoomTo(targetZoom,CAMERA_IN_MS,'Sine.easeOut',true);

  // StoryDirector pauses the scene Clock and TweenManager during dialogue.
  // Drive the skeleton's vignette from update's game-loop time instead: a
  // delayedCall here would never fire until AFTER the dialogue had finished.
  try{this.dialogueVignetteState?.vignette?.destroy?.();}catch{}
  this.dialogueVignetteState={
   target:this.active.target,kind:this.active.kind,cameraLocked:false,vignette:null,
   focusX,focusY,focusZoom:targetZoom,
   cameraSettledAt:(scene.game?.loop?.time||0)+CAMERA_IN_MS+25,
   fadeInAt:null,fadeOutAt:null,fadeOutAlpha:0,
   vignetteKeyX:null,vignetteKeyY:null,vignetteKeyW:null,vignetteKeyH:null
  };

  this.showDialogueLine();
 }

 showDialogueLine(){
  if(!this.active || !this.dialogueText)return;
  const line=this.active.lines[this.dialogueLineIndex];
  if(!line)return;
  const speakerLabel=line.speaker==='hero'?'Ты':this.active.speakerName;
  const spokenText=String(line.text||'').trim();
  this.dialogueText.setText(`${speakerLabel}: «${spokenText}»`).setVisible(true);
  this.positionDialogueUi();
 }

 getDialogueActorBounds(actor){
  const scene=this.scene;
  if(!actor || !scene)return null;
  const visual=actor===scene.player ? scene.playerVisual : (actor.visual||actor);
  const bounds=visual?.getBounds?.() || actor?.getBounds?.();
  if(bounds){
   return {left:bounds.left,right:bounds.right,top:bounds.top,bottom:bounds.bottom,centerX:bounds.centerX,centerY:bounds.centerY};
  }
  const radius=Math.max(18,actor.hitRadius||18);
  return {left:actor.x-radius,right:actor.x+radius,top:actor.y-radius*1.6,bottom:actor.y+radius,centerX:actor.x,centerY:actor.y-radius*0.3};
 }

 expandDialogueAvoidRect(rect,pad=28){
  if(!rect)return null;
  return {left:rect.left-pad,right:rect.right+pad,top:rect.top-pad,bottom:rect.bottom+pad};
 }

 dialogueOverlapArea(a,b){
  if(!a||!b)return 0;
  const w=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
  const h=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  return w*h;
 }

 // Camera.worldView/matrix are refreshed at render time, after scene update.
 // Derive this frame's view from scroll/zoom so zooming cannot move a panel
 // into the HUD for one frame. Dialogue cameras have no rotation.
 getDialogueView(){
  const cam=this.scene.cameras.main;
  const zoom=Math.max(0.01,cam.zoom||1);
  const width=cam.width/zoom,height=cam.height/zoom;
  let sx=cam.scrollX,sy=cam.scrollY;
  if(cam.useBounds){sx=cam.clampX(sx);sy=cam.clampY(sy);}
  if(cam.roundPixels){sx=Math.floor(sx);sy=Math.floor(sy);}
  const left=Number.isFinite(sx)?sx+cam.width*(cam.originX??0.5)*(1-1/zoom):cam.worldView.left;
  const top=Number.isFinite(sy)?sy+cam.height*(cam.originY??0.5)*(1-1/zoom):cam.worldView.top;
  return {left,top,right:left+width,bottom:top+height,width,height};
 }

 getDialogueHudBounds(view,scale){
  const scene=this.scene,cam=scene.cameras.main;
  const hud=scene.scene?.get?.('HUDScene');
  const zoom=Math.max(0.01,cam.zoom||1);
  return (hud?.getDialogueAvoidBounds?.()||[]).map(rect=>this.expandDialogueAvoidRect({
   left:view.left+(rect.left-(cam.x||0))/zoom,right:view.left+(rect.right-(cam.x||0))/zoom,
   top:view.top+(rect.top-(cam.y||0))/zoom,bottom:view.top+(rect.bottom-(cam.y||0))/zoom
  },12*scale)).filter(rect=>this.dialogueOverlapArea(rect,view)>0);
 }

 findDialoguePosition({safe,width,height,speaker,pairX,obstacles,scale}){
  if(width>safe.right-safe.left || height>safe.bottom-safe.top)return null;
  const halfW=width/2;
  const minX=safe.left+halfW,maxX=safe.right-halfW;
  const minY=safe.top+height,maxY=safe.bottom;
  const preferred={x:speaker.centerX,y:speaker.top-18*scale};
  const centerX=(safe.left+safe.right)/2;
  // Start with the knight's placement over the speaker. Add all obstacle edges
  // and their intersections: seven fixed guesses can miss a clear central slot.
  const candidates=[preferred,{x:pairX,y:preferred.y},
   {x:centerX,y:(safe.top+safe.bottom+height)/2}];
  const xs=new Set([minX,maxX,...candidates.map(p=>Phaser.Math.Clamp(p.x,minX,maxX))]);
  const ys=new Set([minY,maxY,...candidates.map(p=>Phaser.Math.Clamp(p.y,minY,maxY))]);
  for(const rect of obstacles){
   for(const x of [rect.left-halfW,rect.right+halfW])if(x>=minX&&x<=maxX)xs.add(x);
   for(const y of [rect.top,rect.bottom+height])if(y>=minY&&y<=maxY)ys.add(y);
  }
  let best=null;
  for(const x of xs)for(const y of ys){
   const rect={left:x-halfW,right:x+halfW,top:y-height,bottom:y};
   const overlap=obstacles.reduce((sum,o)=>sum+this.dialogueOverlapArea(rect,o),0)/(scale*scale);
   const distance=Math.hypot(x-preferred.x,y-preferred.y)/scale;
   const centrality=Math.hypot(x-centerX,(y-height/2)-(safe.top+safe.bottom)/2)/scale;
   const score=distance+centrality*0.25;
   // Collision is a separate priority, never traded for a shorter distance.
   if(!best || overlap<best.overlap-0.01 || (Math.abs(overlap-best.overlap)<0.01&&score<best.score)){
    best={x,y,overlap,score};
   }
  }
  return best;
 }

 setDialogueTextLayout(fontSize,wrapWidth){
  // Phaser's style setters redraw the text canvas even if the value is equal.
  if(this.dialogueFontSize!==fontSize){
   this.dialogueText.setFontSize(fontSize);
   this.dialogueFontSize=fontSize;
  }
  if(this.dialogueWrapWidth!==wrapWidth){
   this.dialogueText.setWordWrapWidth(wrapWidth,true);
   this.dialogueWrapWidth=wrapWidth;
  }
 }

 positionDialogueUi(){
  if(!this.active || this.active.closing || !this.dialogueText)return;
  const scene=this.scene,target=this.active.target;
  const line=this.active.lines[this.dialogueLineIndex];
  const actor=line?.speaker==='hero'?scene.player:target;
  const speaker=this.getDialogueActorBounds(actor);
  if(!speaker)return;
  const view=this.getDialogueView();
  const dialogueScale=worldUiScale(scene);
  this.dialogueText.setScale(dialogueScale);
  const margin=14*dialogueScale;
  // Prefer the middle of the screen. Actual HUD rectangles, including touch
  // controls and boss/banner panels, remain obstacles in the fallback frame too.
  const safe=scene.isTouchDevice
   ? {left:view.left+view.width*0.06,right:view.right-view.width*0.06,top:view.top+view.height*0.16,bottom:view.top+view.height*0.80}
   : {left:view.left+view.width*0.035,right:view.right-view.width*0.035,top:view.top+view.height*0.16,bottom:view.top+view.height*0.84};
  const fallback={left:view.left+margin,right:view.right-margin,top:view.top+margin,bottom:view.bottom-margin};
  const obstacles=[this.expandDialogueAvoidRect(this.getDialogueActorBounds(scene.player),14*dialogueScale),
   this.expandDialogueAvoidRect(this.getDialogueActorBounds(target),14*dialogueScale),
   ...this.getDialogueHudBounds(view,dialogueScale)].filter(Boolean);
  const cssW=cssViewportWidth(scene);
  const defaultWrap=scene.isTouchDevice?Math.min(300,Math.max(220,cssW*0.34)):Math.min(390,Math.max(300,cssW*0.30));
  const maxWrap=Math.max(60,(safe.right-safe.left)/dialogueScale-28);
  const wrap=Math.min(defaultWrap,maxWrap);
  const pairX=(scene.player.x+target.x)/2;
  let best=null;
  // Keep the usual text size first; narrower wrapping can open a clear slot
  // beside a large boss. A smaller font is only a last resort on short screens.
  for(const fontSize of [18,16,14]){
   for(const wrapWidth of [...new Set([wrap,Math.max(Math.min(180,wrap),wrap*0.78)])]){
    this.setDialogueTextLayout(fontSize,wrapWidth);
    const width=this.dialogueText.displayWidth,height=this.dialogueText.displayHeight;
    for(const frame of [safe,fallback]){
     const position=this.findDialoguePosition({safe:frame,width,height,speaker,pairX,obstacles,scale:dialogueScale});
     if(position && (!best || position.overlap<best.overlap-0.01))best={...position,fontSize,wrapWidth};
     if(best?.overlap<0.01)break;
    }
    if(best?.overlap<0.01)break;
   }
   if(best?.overlap<0.01)break;
  }
  if(best){
   this.setDialogueTextLayout(best.fontSize,best.wrapWidth);
   this.dialogueText.setPosition(best.x,best.y);
  }
 }

 update(time=0){
  if(!this.active)return;
  if(!this.active.target?.active || this.active.target.hp<=0 || !this.scene.player?.active || this.scene.gameOver){
   this.cancel();
   return;
  }
  const state=this.dialogueVignetteState;
  const cam=this.scene?.cameras?.main;
  if(state && !this.active.closing && time>=state.cameraSettledAt){
   if(!state.cameraLocked){
    cam.setZoom(state.focusZoom);
    cam.centerOn(state.focusX,state.focusY);
    state.cameraLocked=true;
   }
   if(!state.vignette?.active){
    this.scene.createSettledStoryVignette?.(state,cam,{fadeMs:0});
    state.fadeInAt=time;
   }
  }
  if(state?.vignette?.active){
   this.scene.updateStoryAnomalyVignette?.(state,cam);
   if(this.active.closing){
    const progress=Phaser.Math.Clamp((time-state.fadeOutAt)/Math.min(220,CAMERA_OUT_MS),0,1);
    state.vignette.setAlpha(state.fadeOutAlpha*Math.cos(progress*Math.PI/2));
   }else{
    const progress=Phaser.Math.Clamp((time-state.fadeInAt)/220,0,1);
    state.vignette.setAlpha(Math.sin(progress*Math.PI/2));
   }
  }
  if(this.active.closing && time>=this.closeAt){
   this.finishDialogue();
  }
 }

 advanceDialogue(now=0){
  if(!this.active || this.active.closing || now<this.dialogueInputLockUntil)return;
  this.dialogueInputLockUntil=now+DIALOGUE_INPUT_LOCK_MS;
  if(this.dialogueLineIndex<this.active.lines.length-1){
   this.dialogueLineIndex++;
   this.showDialogueLine();
   return;
  }
  this.beginClose(now);
 }

 beginClose(now=0){
  if(!this.active || this.active.closing)return;
  this.active.closing=true;
  this.dialogueText?.setVisible(false);
  const scene=this.scene;
  const cam=scene.cameras.main;
  const restoreZoom=this.cameraRestore?.zoom||cam.zoom;
  const vignette=this.dialogueVignetteState?.vignette;
  if(vignette?.active){
   scene.tweens?.killTweensOf?.(vignette);
   this.dialogueVignetteState.fadeOutAt=now;
   this.dialogueVignetteState.fadeOutAlpha=vignette.alpha;
  }
  cam.zoomTo(restoreZoom,CAMERA_OUT_MS,'Sine.easeInOut',true);
  cam.pan(scene.player.x,scene.player.y,CAMERA_OUT_MS,'Sine.easeInOut',true);
  this.closeAt=now+CAMERA_OUT_MS+20;
 }

 finishDialogue({cancelled=false,notifyDirector=true,restoreCamera=true}={}){
  if(!this.active || !this.scene)return;
  const session=this.active;
  const scene=this.scene;
  const controls=this.dialogueControls;
  const cam=scene.cameras.main;
  if(restoreCamera && scene.player?.active){
   cam.panEffect?.reset?.();
   cam.zoomEffect?.reset?.();
   if(this.cameraRestore?.zoom)cam.setZoom(this.cameraRestore.zoom);
   scene.handleViewportResize?.();
   cam.startFollow(scene.player,true,1,1);
   cam.centerOn(scene.player.x,scene.player.y);
  }
  this.dialogueText?.setVisible(false);
  this.dialogueVignetteState?.vignette?.destroy?.();
  this.dialogueVignetteState=null;
  this.active=null;
  this.dialogueControls=null;
  this.cameraRestore=null;
  this.dialogueLineIndex=0;
  this.closeAt=0;
  this.resumeCombat();
  // Clear presentation before completing StoryDirector to avoid reentrant cleanup.
  if(notifyDirector){
   if(cancelled)controls?.cancel?.();
   else controls?.complete?.();
  }
  scene.releaseStoryFocus?.(STORY_FOCUS_OWNER);
  const callback=cancelled?session.onCancel:session.onComplete;
  if(typeof callback==='function'){
   try{callback(session);}catch(error){console.error('[WorldDialogueSystem] completion callback failed',error);}
  }
 }

 cancel(options={}){
  if(!this.active)return false;
  this.finishDialogue({...options,cancelled:true});
  return true;
 }
}

export {addUiText,worldUiScale,isInteractionKey};
export default WorldDialogueSystem;

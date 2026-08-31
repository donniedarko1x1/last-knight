import Phaser from 'phaser';
import StoryObjectiveMarker from './StoryObjectiveMarker.js';
import {ASH_WOUNDED_KNIGHT_STORY} from './storyEvents.js';

const INTERACTION_DISTANCE=112;
const CAMERA_IN_MS=300;
const CAMERA_OUT_MS=300;
const DIALOGUE_INPUT_LOCK_MS=220;

const STORY_KNIGHT_ID=ASH_WOUNDED_KNIGHT_STORY.characterId;
const STORY_EVENT_ID=ASH_WOUNDED_KNIGHT_STORY.dialogueEventId;
const STORY_OBJECTIVE_ID=ASH_WOUNDED_KNIGHT_STORY.objectiveId;
const STORY_FLAG=ASH_WOUNDED_KNIGHT_STORY.metFlag;

const STORY_DIALOGUE=Object.freeze([
 Object.freeze({speaker:'knight',text:'Воды...'}),
 Object.freeze({speaker:'hero',text:'Держись. Я отведу тебя к своим.'}),
 Object.freeze({speaker:'knight',text:'К своим?.. Там уже никого нет.'}),
 Object.freeze({speaker:'knight',text:'Ты из северного гарнизона?'}),
 Object.freeze({speaker:'hero',text:'Не знаю. Я почти ничего не помню о том времени.'}),
 Object.freeze({speaker:'knight',text:'Может... оно и к лучшему.'}),
 Object.freeze({speaker:'hero',text:'Что ты сказал?'})
]);

const AMBIENT_DIALOGUES=Object.freeze([
 Object.freeze([
  Object.freeze({speaker:'knight',text:'Помоги...'}),
  Object.freeze({speaker:'hero',text:'Держись. Я найду кого-нибудь.'})
 ]),
 Object.freeze([
  Object.freeze({speaker:'knight',text:'Воды... хоть глоток...'}),
  Object.freeze({speaker:'hero',text:'Потерпи. Если найду воду — вернусь.'})
 ]),
 Object.freeze([
  Object.freeze({speaker:'knight',text:'Скажи дома... я не отступил.'}),
  Object.freeze({speaker:'hero',text:'Передам. Ты сражался до конца.'})
 ]),
 Object.freeze([
  Object.freeze({speaker:'knight',text:'Хх... ног не чувствую...'}),
  Object.freeze({speaker:'hero',text:'Не двигайся. Береги силы.'})
 ]),
 Object.freeze([
  Object.freeze({speaker:'knight',text:'Они всех перебили...'}),
  Object.freeze({speaker:'hero',text:'Не всех. Я ещё здесь.'})
 ])
]);

function addUiText(scene,x,y,text,style){
 const object=scene.add.text(x,y,text,style);
 object.setResolution?.(2);
 return object;
}

class WoundedKnightInteractionSystem {
 constructor(scene,{storyDirector=null}={}){
  this.scene=scene;
  this.storyDirector=storyDirector;
  this.knights=new Map();
  this.nearest=null;
  this.active=null;
  this.installed=false;
  this.dialogueControls=null;
  this.dialogueLineIndex=0;
  this.dialogueInputLockUntil=0;
  this.closeAt=0;
  this.cameraRestore=null;
  this.activeStoryTargetId=null;
  this.objectiveMarker=null;

  this._onKeyDown=this.onKeyDown.bind(this);
  this._onPointerDown=this.onPointerDown.bind(this);
  this._onMobileWorldInteract=this.onMobileWorldInteract.bind(this);
  this._onDialogueStart=this.onDialogueStart.bind(this);
  this._onObjectiveActivated=this.onObjectiveActivated.bind(this);
  this._onObjectiveUpdated=this.onObjectiveActivated.bind(this);
  this._onObjectiveCompleted=this.onObjectiveCompleted.bind(this);
  this._onObjectiveCleared=this.onObjectiveCleared.bind(this);
 }

 install(){
  if(this.installed)return this;
  this.installed=true;
  const scene=this.scene;

  this.promptText=addUiText(scene,0,0,'',{
   fontFamily:'Arial, sans-serif',fontSize:'15px',color:'#fff3cf',
   stroke:'#0a0908',strokeThickness:3,backgroundColor:'#11100edb',
   padding:{x:10,y:6},align:'center'
  }).setOrigin(0.5,1).setDepth(620).setVisible(false);

  this.dialogueText=addUiText(scene,0,0,'',{
   fontFamily:'Georgia, serif',fontSize:'18px',color:'#f3e8d5',
   stroke:'#090807',strokeThickness:2,backgroundColor:'#11100ee8',
   padding:{x:12,y:8},align:'center',wordWrap:{width:360,useAdvancedWrap:true}
  }).setOrigin(0.5,1).setDepth(640).setVisible(false);

  this.continueHint=addUiText(scene,0,0,'',{
   fontFamily:'Arial, sans-serif',fontSize:'12px',color:'#d8cdb8',
   stroke:'#080706',strokeThickness:2,backgroundColor:'#0b0a09bd',
   padding:{x:8,y:4},align:'center'
  }).setOrigin(0.5,1).setScrollFactor(0).setDepth(641).setVisible(false);

  // Generic reusable objective compass. It is deliberately separate from
  // wounded-knight dialogue logic so later story NPCs/items/bosses can use the
  // same strict 10%-inset screen-frame navigation.
  this.objectiveMarker=new StoryObjectiveMarker(scene,{insetRatio:0.10}).install();

  scene.input.keyboard?.on('keydown',this._onKeyDown);
  // Desktop mouse keeps its old dialogue-advance behavior. Touch interaction is
  // routed by HUDScene so the left movement half can never trigger an NPC.
  scene.input.on('pointerdown',this._onPointerDown);
  scene.events.on('mobile-world-interact',this._onMobileWorldInteract);
  scene.events.on('story-dialogue-start',this._onDialogueStart);
  scene.events.on('story-objective-activated',this._onObjectiveActivated);
  scene.events.on('story-objective-updated',this._onObjectiveUpdated);
  scene.events.on('story-objective-completed',this._onObjectiveCompleted);
  scene.events.on('story-objective-cleared',this._onObjectiveCleared);

  // The starting Ash Fields chunk can exist before this system is installed.
  this.registerExistingKnightsFromScene();
  this.syncStoryObjectiveFromDirector();
  return this;
 }

 registerExistingKnightsFromScene(){
  const objects=this.scene?.devEnvironmentObjects;
  if(!Array.isArray(objects))return 0;
  let registered=0;
  for(const sprite of objects){
   const meta=sprite?.devEnvMeta;
   if(meta?.kind!=='wounded_knight' || !meta.id)continue;
   const match=String(meta.id).match(/:(\d+)$/);
   const index=match?Number(match[1]):registered;
   if(this.registerKnight(sprite,{
    id:String(meta.id),
    index,
    story:String(meta.id)===STORY_KNIGHT_ID
   })) registered++;
  }
  return registered;
 }

 destroy(){
  if(!this.installed)return;
  const scene=this.scene;
  scene?.input?.keyboard?.off('keydown',this._onKeyDown);
  scene?.input?.off('pointerdown',this._onPointerDown);
  scene?.events?.off('mobile-world-interact',this._onMobileWorldInteract);
  scene?.events?.off('story-dialogue-start',this._onDialogueStart);
  scene?.events?.off('story-objective-activated',this._onObjectiveActivated);
  scene?.events?.off('story-objective-updated',this._onObjectiveUpdated);
  scene?.events?.off('story-objective-completed',this._onObjectiveCompleted);
  scene?.events?.off('story-objective-cleared',this._onObjectiveCleared);
  for(const object of [this.promptText,this.dialogueText,this.continueHint]){
   try{object?.destroy();}catch{}
  }
  this.objectiveMarker?.destroy();
  this.objectiveMarker=null;
  this.knights.clear();
  this.active=null;
  this.nearest=null;
  this.activeStoryTargetId=null;
  this.installed=false;
  this.scene=null;
  this.storyDirector=null;
 }

 registerKnight(sprite,{id,index=0,story=false}={}){
  if(!sprite || !id)return null;
  const entry={
   id:String(id),index:Number(index)||0,sprite,story:Boolean(story),
   eventId:story?STORY_EVENT_ID:`ash_wounded_knight_talk_${index}`
  };
  this.knights.set(entry.id,entry);
  sprite.woundedKnightInteractionId=entry.id;

  // Objective activation may have happened before streamed/late-created target
  // registration. Resolve it as soon as the entity becomes available.
  const objective=this.storyDirector?.getActiveObjective?.();
  if(entry.story && objective?.id===STORY_OBJECTIVE_ID && objective.targetId===entry.id){
   this.activateStoryTarget(entry.id);
  }
  return entry;
 }

 isCompleted(entry){
  return Boolean(entry && this.storyDirector?.hasCompleted?.(entry.eventId));
 }

 isStoryEntryUnlocked(entry){
  if(!entry?.story)return true;
  return Boolean(
   this.activeStoryTargetId===entry.id &&
   this.storyDirector?.isObjectiveActive?.(STORY_OBJECTIVE_ID)
  );
 }

 getDialogue(entry){
  if(entry?.story)return STORY_DIALOGUE;
  const nonStoryIndex=entry.index>3?entry.index-1:entry.index;
  return AMBIENT_DIALOGUES[Math.abs(nonStoryIndex)%AMBIENT_DIALOGUES.length];
 }

 syncStoryObjectiveFromDirector(){
  const objective=this.storyDirector?.getActiveObjective?.();
  if(objective?.id===STORY_OBJECTIVE_ID && objective.targetId===STORY_KNIGHT_ID){
   this.onObjectiveActivated(objective);
  }else{
   this.deactivateStoryTarget();
  }
 }

 onObjectiveActivated(objective){
  if(!objective || objective.id!==STORY_OBJECTIVE_ID || objective.targetId!==STORY_KNIGHT_ID)return;
  this.activateStoryTarget(objective.targetId);
 }

 onObjectiveCompleted(objective){
  if(objective?.id!==STORY_OBJECTIVE_ID)return;
  this.deactivateStoryTarget();
 }

 onObjectiveCleared(objective){
  if(objective?.id!==STORY_OBJECTIVE_ID)return;
  this.deactivateStoryTarget();
 }

 activateStoryTarget(targetId){
  const id=String(targetId||'');
  if(!id)return false;
  this.activeStoryTargetId=id;
  const entry=this.knights.get(id);
  this.objectiveMarker?.setTarget(entry?.sprite||null);
  return Boolean(entry);
 }

 deactivateStoryTarget(){
  const previous=this.activeStoryTargetId;
  this.activeStoryTargetId=null;
  this.objectiveMarker?.clearTarget();
  if(this.nearest?.id===previous){
   this.nearest=null;
   this.promptText?.setVisible(false);
  }
 }

 update(time=0){
  if(!this.scene)return;

  if(this.active){
   this.updateActiveDialogue(time);
   this.updateObjectiveMarker(time,true);
   return;
  }

  if(this.scene.gameOver || this.scene.levelChoiceOpen || this.scene.championRewardOpen || this.storyDirector?.isBusy?.()){
   this.nearest=null;
   this.promptText?.setVisible(false);
   this.updateObjectiveMarker(time,false);
   return;
  }

  this.nearest=this.findNearestAvailableKnight();
  this.updateInteractionPrompt();
  this.updateObjectiveMarker(time,false);
 }

 findNearestAvailableKnight(){
  const player=this.scene?.player;
  if(!player)return null;
  let best=null;
  let bestDistance=INTERACTION_DISTANCE;
  for(const entry of this.knights.values()){
   const sprite=entry.sprite;
   if(!sprite?.active || !sprite.visible || this.isCompleted(entry))continue;
   // A potential story NPC is intentionally inert until StoryDirector says the
   // player currently needs to talk to it.
   if(entry.story && !this.isStoryEntryUnlocked(entry))continue;
   const distance=Phaser.Math.Distance.Between(player.x,player.y,sprite.x,sprite.y);
   if(distance<=bestDistance){best=entry;bestDistance=distance;}
  }
  return best;
 }

 updateInteractionPrompt(){
  const scene=this.scene;
  const prompt=this.promptText;
  if(!prompt)return;
  if(!this.nearest || !scene?.player){prompt.setVisible(false);return;}
  const touch=Boolean(scene.isTouchDevice);
  prompt.setText('Нажмите для взаимодействия');
  prompt.setFontSize(touch?16:15);
  const target=this.nearest.sprite;
  const promptOffset=Math.max(58,(target?.displayHeight||60)*0.60);
  prompt.setPosition(target.x,target.y-promptOffset).setVisible(true);
 }

 onKeyDown(event){
  if(!this.scene || event?.repeat)return;
  const now=this.scene.game?.loop?.time||0;
  if(this.active){
   this.advanceDialogue(now);
   return;
  }
  if((event?.code==='KeyE' || String(event?.key||'').toLowerCase()==='e') && this.nearest){
   this.startInteraction(this.nearest,now);
  }
 }

 onPointerDown(){
  if(!this.scene || this.scene.isTouchDevice)return;
  const now=this.scene.game?.loop?.time||0;
  if(this.active)this.advanceDialogue(now);
 }

 onMobileWorldInteract(){
  if(!this.scene?.isTouchDevice)return;
  const now=this.scene.game?.loop?.time||0;
  if(this.active){
   this.advanceDialogue(now);
   return;
  }
  if(this.nearest)this.startInteraction(this.nearest,now);
 }

 startInteraction(entry,now=0){
  if(!entry || this.active || this.isCompleted(entry) || this.storyDirector?.isBusy?.())return false;
  if(entry.story && !this.isStoryEntryUnlocked(entry))return false;
  const lines=this.getDialogue(entry);
  if(!Array.isArray(lines) || !lines.length)return false;

  this.promptText?.setVisible(false);
  if(this.scene.player?.body)this.scene.player.body.setVelocity(0,0);
  this.scene.mobileMoveX=0;
  this.scene.mobileMoveY=0;
  this.scene.mobileMovePointerId=null;

  const started=this.storyDirector?.beginDialogue?.({
   kind:'wounded-knight',entryId:entry.id,story:entry.story,lines
  },{eventId:entry.eventId,once:true});
  if(started)this.dialogueInputLockUntil=now+DIALOGUE_INPUT_LOCK_MS;
  return Boolean(started);
 }

 onDialogueStart(payload,controls){
  if(payload?.kind!=='wounded-knight')return;
  const entry=this.knights.get(String(payload.entryId));
  if(!entry?.sprite?.active || (entry.story && !this.isStoryEntryUnlocked(entry))){
   controls?.cancel?.();
   return;
  }

  this.active={entry,lines:payload.lines||[],closing:false};
  this.dialogueControls=controls||null;
  this.dialogueLineIndex=0;
  this.closeAt=0;
  this.promptText?.setVisible(false);
  this.objectiveMarker?.hide();

  const scene=this.scene;
  const cam=scene.cameras.main;
  this.cameraRestore={zoom:cam.zoom};
  cam.stopFollow();

  const midpointX=(scene.player.x+entry.sprite.x)*0.5;
  const midpointY=(scene.player.y+entry.sprite.y)*0.5-18;
  let focusX=midpointX;
  let focusY=midpointY;
  let targetZoom=Math.min(cam.zoom*1.52,cam.zoom+0.85);

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

  this.continueHint
   ?.setText(scene.isTouchDevice?'Коснитесь справа — продолжить':'Любая клавиша — продолжить')
   .setVisible(true);
  this.showDialogueLine();
 }

 showDialogueLine(){
  if(!this.active || !this.dialogueText)return;
  const line=this.active.lines[this.dialogueLineIndex];
  if(!line)return;
  const speakerLabel=line.speaker==='hero'?'Ты':'Раненый рыцарь';
  const spokenText=String(line.text||'').trim();
  this.dialogueText.setText(`${speakerLabel}: «${spokenText}»`).setVisible(true);
  this.positionDialogueUi();
 }

 positionDialogueUi(){
  if(!this.active || !this.scene)return;
  const scene=this.scene;
  const line=this.active.lines[this.dialogueLineIndex];
  const knight=this.active.entry.sprite;
  const actor=line?.speaker==='hero'?scene.player:knight;
  if(actor && this.dialogueText){
   const yOffset=line?.speaker==='hero'?74:Math.max(54,(knight.displayHeight||60)*0.54);
   let x=actor.x;
   let y=actor.y-yOffset;

   if(scene.isTouchDevice){
    const cam=scene.cameras.main;
    const view=cam.worldView;
    const safe={
     left:view.left+view.width*0.20,
     right:view.left+view.width*0.82,
     top:view.top+view.height*0.22,
     bottom:view.top+view.height*0.76
    };
    const wrapWidth=Math.min(300,Math.max(220,view.width*0.30));
    this.dialogueText.setWordWrapWidth?.(wrapWidth,true);
    this.dialogueText.setPosition(x,y);
    const halfW=Math.min((this.dialogueText.displayWidth||wrapWidth)*0.5,Math.max(20,(safe.right-safe.left)*0.48));
    const bubbleH=Math.min(this.dialogueText.displayHeight||70,Math.max(40,(safe.bottom-safe.top)*0.72));
    x=Phaser.Math.Clamp(x,safe.left+halfW+8,safe.right-halfW-8);
    // dialogueText origin is (0.5,1), so y is the lower edge of the bubble.
    y=Phaser.Math.Clamp(y,safe.top+bubbleH+8,safe.bottom-8);
   }else{
    this.dialogueText.setWordWrapWidth?.(360,true);
   }

   this.dialogueText.setPosition(x,y);
  }
  if(this.continueHint){
   const metrics=scene.getUiMetrics?.()||{cx:400,height:720};
   this.continueHint.setPosition(metrics.cx,metrics.height-(scene.isTouchDevice?46:18));
  }
 }

 updateActiveDialogue(time){
  if(!this.active)return;
  this.positionDialogueUi();
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
  this.continueHint?.setVisible(false);
  const scene=this.scene;
  const cam=scene.cameras.main;
  const restoreZoom=this.cameraRestore?.zoom||cam.zoom;
  cam.zoomTo(restoreZoom,CAMERA_OUT_MS,'Sine.easeInOut',true);
  cam.pan(scene.player.x,scene.player.y,CAMERA_OUT_MS,'Sine.easeInOut',true);
  this.closeAt=now+CAMERA_OUT_MS+20;
 }

 finishDialogue(){
  if(!this.active || !this.scene)return;
  const {entry}=this.active;
  const scene=this.scene;
  const controls=this.dialogueControls;

  if(entry.story){
   this.storyDirector?.setFlag?.(STORY_FLAG,true);
   this.storyDirector?.completeObjective?.(STORY_OBJECTIVE_ID);
  }

  const cam=scene.cameras.main;
  if(this.cameraRestore?.zoom)cam.setZoom(this.cameraRestore.zoom);
  scene.handleViewportResize?.();
  cam.startFollow(scene.player,true,1,1);
  cam.centerOn(scene.player.x,scene.player.y);

  this.active=null;
  this.dialogueControls=null;
  this.cameraRestore=null;
  this.dialogueLineIndex=0;
  this.closeAt=0;
  controls?.complete?.();
 }

 updateObjectiveMarker(time=0,forceHide=false){
  if(!this.objectiveMarker)return;
  const entry=this.activeStoryTargetId?this.knights.get(this.activeStoryTargetId):null;
  const objectiveActive=this.storyDirector?.isObjectiveActive?.(STORY_OBJECTIVE_ID);
  if(!objectiveActive || !entry?.sprite?.active || this.isCompleted(entry)){
   this.objectiveMarker.hide();
   return;
  }
  if(this.objectiveMarker.target!==entry.sprite)this.objectiveMarker.setTarget(entry.sprite);
  this.objectiveMarker.update(time,{forceHide});
 }
}

export {STORY_KNIGHT_ID,STORY_EVENT_ID,STORY_OBJECTIVE_ID,STORY_FLAG};
export default WoundedKnightInteractionSystem;

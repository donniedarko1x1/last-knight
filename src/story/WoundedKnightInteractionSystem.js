import Phaser from 'phaser';
import StoryObjectiveMarker from './StoryObjectiveMarker.js';
import {ASH_WOUNDED_KNIGHT_STORY} from './storyEvents.js';

const INTERACTION_DISTANCE=112;
const CAMERA_IN_MS=300;
const CAMERA_OUT_MS=300;
const DIALOGUE_INPUT_LOCK_MS=220;
const STORY_FOCUS_OWNER='woundedKnightDialogue';

const STORY_KNIGHT_ID=ASH_WOUNDED_KNIGHT_STORY.characterId;
const STORY_EVENT_ID=ASH_WOUNDED_KNIGHT_STORY.dialogueEventId;
const STORY_OBJECTIVE_ID=ASH_WOUNDED_KNIGHT_STORY.objectiveId;
const STORY_FLAG=ASH_WOUNDED_KNIGHT_STORY.metFlag;

const STORY_DIALOGUE=Object.freeze([
 Object.freeze({speaker:'knight',text:'Воды...'}),
 Object.freeze({speaker:'hero',text:'Дыши. Кто вас разбил?'}),
 Object.freeze({speaker:'knight',text:'Не знаю... Всё смешалось.'}),
 Object.freeze({speaker:'hero',text:'Где остальные?'}),
 Object.freeze({speaker:'knight',text:'Кто мог — ушёл к северной дороге. Остальные...'}),
 Object.freeze({speaker:'hero',text:'Понял.'}),
 Object.freeze({speaker:'knight',text:'Ты ведь не из нашего отряда.'}),
 Object.freeze({speaker:'hero',text:'Нет.'}),
 Object.freeze({speaker:'knight',text:'Тогда зачем ты здесь?'}),
 Object.freeze({speaker:'hero',text:'Хотел бы я сам знать.'}),
 Object.freeze({speaker:'knight',text:'Не помнишь?'}),
 Object.freeze({speaker:'hero',text:'Почти ничего.'}),
 Object.freeze({speaker:'knight',text:'Тогда тебе тем более нельзя здесь оставаться.'}),
 Object.freeze({speaker:'hero',text:'Почему?'}),
 Object.freeze({speaker:'knight',text:'Наш командир повёл уцелевших на север. К старой часовне у тракта.'}),
 Object.freeze({speaker:'hero',text:'Он знает, что здесь произошло?'}),
 Object.freeze({speaker:'knight',text:'Если кто и знает — то он.'}),
 Object.freeze({speaker:'hero',text:'Как его найти?'}),
 Object.freeze({speaker:'knight',text:'Иди за дорогой. Увидишь чёрные знамёна — значит, почти дошёл.'}),
 Object.freeze({speaker:'hero',text:'А ты?'}),
 Object.freeze({speaker:'knight',text:'Я немного полежу.'}),
 Object.freeze({speaker:'hero',text:'Я вернусь.'}),
 Object.freeze({speaker:'knight',text:'Не спеши. Мне уже некуда идти.'})
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
  for(const object of [this.promptText,this.dialogueText]){
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

  if(this.scene.gameOver || this.scene.levelChoiceOpen || this.scene.championRewardOpen || this.storyDirector?.isBusy?.() || this.scene?.isStoryFocusLocked?.(STORY_FOCUS_OWNER)){
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
  prompt.setText(touch?'Нажмите для взаимодействия':'Нажмите E для взаимодействия');
  prompt.setFontSize(touch?16:15);
  const target=this.nearest.sprite;
  const promptOffset=Math.max(58,(target?.displayHeight||60)*0.60);
  prompt.setPosition(target.x,target.y-promptOffset).setVisible(true);
 }

 onKeyDown(event){
  if(!this.scene || event?.repeat)return;
  const now=this.scene.game?.loop?.time||0;
  if(!this.active && this.scene?.isStoryFocusLocked?.(STORY_FOCUS_OWNER)) return;
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

 onMobileWorldInteract(pointer){
  if(!this.scene?.isTouchDevice)return;
  // Defense in depth: even if another system accidentally emits the world
  // interaction event in the future, left-half touches are rejected here too.
  if(!this.scene?.isMobileInteractionPointerAllowed?.(pointer))return;
  if(!this.active && this.scene?.isStoryFocusLocked?.(STORY_FOCUS_OWNER)) return;
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
  if(this.scene?.isStoryFocusLocked?.(STORY_FOCUS_OWNER) || !this.scene?.acquireStoryFocus?.(STORY_FOCUS_OWNER))return false;
  const lines=this.getDialogue(entry);
  if(!Array.isArray(lines) || !lines.length){
   this.scene?.releaseStoryFocus?.(STORY_FOCUS_OWNER,{cooldownMs:0});
   return false;
  }

  this.promptText?.setVisible(false);
  if(this.scene.player?.body)this.scene.player.body.setVelocity(0,0);
  this.scene.mobileMoveX=0;
  this.scene.mobileMoveY=0;
  this.scene.mobileMovePointerId=null;

  const started=this.storyDirector?.beginDialogue?.({
   kind:'wounded-knight',entryId:entry.id,story:entry.story,lines
  },{eventId:entry.eventId,once:true});
  if(started)this.dialogueInputLockUntil=now+DIALOGUE_INPUT_LOCK_MS;
  else this.scene?.releaseStoryFocus?.(STORY_FOCUS_OWNER,{cooldownMs:0});
  return Boolean(started);
 }

 onDialogueStart(payload,controls){
  if(payload?.kind!=='wounded-knight')return;
  if(this.scene?.isStoryFocusLocked?.(STORY_FOCUS_OWNER) && !this.active){
   controls?.cancel?.();
   return;
  }
  const entry=this.knights.get(String(payload.entryId));
  if(!entry?.sprite?.active || (entry.story && !this.isStoryEntryUnlocked(entry))){
   controls?.cancel?.();
   this.scene?.releaseStoryFocus?.(STORY_FOCUS_OWNER,{cooldownMs:0});
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

 getDialogueActorBounds(actor){
  const scene=this.scene;
  if(!actor || !scene)return null;
  const visual=actor===scene.player ? scene.playerVisual : actor;
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

 positionDialogueUi(){
  if(!this.active || !this.scene)return;
  const scene=this.scene;
  const line=this.active.lines[this.dialogueLineIndex];
  const knight=this.active.entry.sprite;
  const actor=line?.speaker==='hero'?scene.player:knight;
  if(actor && this.dialogueText){
   const cam=scene.cameras.main;
   const view=cam.worldView;
   // Dialogue is a world object, but it should read like UI. Compensate only
   // zoom-in so camera focus never inflates the panel over the characters.
   const dialogueScale=1/Math.max(1,cam.zoom||1);
   this.dialogueText.setScale(dialogueScale);
   const wrapWidth=scene.isTouchDevice
    ? Math.min(300,Math.max(220,view.width*0.30))
    : Math.min(390,Math.max(300,view.width*0.34));
   this.dialogueText.setWordWrapWidth?.(wrapWidth,true);

   // Measure after wrapping. The text uses origin (0.5, 1), therefore each
   // candidate stores the lower-center anchor of the speech panel.
   const bubbleW=Math.max(120,this.dialogueText.displayWidth||wrapWidth);
   const bubbleH=Math.max(42,this.dialogueText.displayHeight||70);
   const halfW=bubbleW*0.5;
   const margin=scene.isTouchDevice?12:18;
   const safe=scene.isTouchDevice
    ? {left:view.left+view.width*0.19,right:view.left+view.width*0.83,top:view.top+view.height*0.18,bottom:view.top+view.height*0.78}
    : {left:view.left+view.width*0.035,right:view.right-view.width*0.035,top:view.top+view.height*0.12,bottom:view.bottom-view.height*0.07};

   const actorBounds=this.getDialogueActorBounds(actor);
   const heroBounds=this.expandDialogueAvoidRect(this.getDialogueActorBounds(scene.player),34);
   const knightBounds=this.expandDialogueAvoidRect(this.getDialogueActorBounds(knight),32);
   const other=line?.speaker==='hero'?knightBounds:heroBounds;
   const speakerAvoid=line?.speaker==='hero'?heroBounds:knightBounds;
   const pairCenterX=((scene.player?.x||actor.x)+(knight?.x||actor.x))*0.5;
   const topOfPair=Math.min(heroBounds?.top??actor.y,knightBounds?.top??actor.y);
   const gap=18;

   const candidates=[
    {x:actorBounds?.centerX??actor.x,y:(actorBounds?.top??actor.y)-gap,bias:0},
    {x:pairCenterX,y:topOfPair-gap,bias:90},
    {x:(actorBounds?.right??actor.x)+halfW+26,y:(actorBounds?.centerY??actor.y)+bubbleH*0.45,bias:180},
    {x:(actorBounds?.left??actor.x)-halfW-26,y:(actorBounds?.centerY??actor.y)+bubbleH*0.45,bias:180},
    {x:safe.left+halfW+margin,y:safe.top+bubbleH+margin,bias:320},
    {x:safe.right-halfW-margin,y:safe.top+bubbleH+margin,bias:320},
    {x:(safe.left+safe.right)*0.5,y:safe.top+bubbleH+margin,bias:360}
   ];

   let best=null;
   for(const candidate of candidates){
    const x=Phaser.Math.Clamp(candidate.x,safe.left+halfW+margin,safe.right-halfW-margin);
    const y=Phaser.Math.Clamp(candidate.y,safe.top+bubbleH+margin,safe.bottom-margin);
    const rect={left:x-halfW,right:x+halfW,top:y-bubbleH,bottom:y};
    const outside=
     Math.max(0,safe.left-rect.left)+Math.max(0,rect.right-safe.right)+
     Math.max(0,safe.top-rect.top)+Math.max(0,rect.bottom-safe.bottom);
    // Never cover either actor when another viable slot exists. Covering the
    // current speaker is penalized too: long lines should move away instead of
    // expanding down over the character model.
    const actorOverlap=this.dialogueOverlapArea(rect,speakerAvoid);
    const otherOverlap=this.dialogueOverlapArea(rect,other);
    const distance=Math.hypot(x-(actorBounds?.centerX??actor.x),y-(actorBounds?.top??actor.y));
    const score=candidate.bias+outside*5000+actorOverlap*35+otherOverlap*55+distance*0.08;
    if(!best || score<best.score)best={x,y,score};
   }

   if(best)this.dialogueText.setPosition(best.x,best.y);
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
  scene?.releaseStoryFocus?.(STORY_FOCUS_OWNER);
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

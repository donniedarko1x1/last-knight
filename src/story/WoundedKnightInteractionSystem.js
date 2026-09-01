import Phaser from 'phaser';
import {addUiText,worldUiScale,isInteractionKey} from './WorldDialogueSystem.js';
import StoryObjectiveMarker from './StoryObjectiveMarker.js';
import {ASH_WOUNDED_KNIGHT_STORY} from './storyEvents.js';

const INTERACTION_DISTANCE=112;

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
 Object.freeze({speaker:'hero',text:'Хотел бы я знать.'}),
 Object.freeze({speaker:'knight',text:'Не помнишь?'}),
 Object.freeze({speaker:'hero',text:'Почти ничего.'}),
 Object.freeze({speaker:'knight',text:'Тогда тебе тем более нельзя здесь оставаться.'}),
 Object.freeze({speaker:'hero',text:'Почему?'}),
 Object.freeze({speaker:'knight',text:'Скелеты — не самое страшное, что здесь видели.'}),
 Object.freeze({speaker:'knight',text:'...'}),
 Object.freeze({speaker:'knight',text:'Наш командир повёл уцелевших на север. К старой часовне у тракта. Найди его прямо по дороге. Увидишь чёрные знамёна — значит, почти дошёл.'}),
 Object.freeze({speaker:'hero',text:'А ты?'}),
 Object.freeze({speaker:'knight',text:'Я немного полежу здесь.'}),
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

class WoundedKnightInteractionSystem {
 constructor(scene,{storyDirector=null,dialogueSystem=scene?.dialogueSystem}={}){
  this.scene=scene;
  this.storyDirector=storyDirector;
  this.dialogueSystem=dialogueSystem;
  this.knights=new Map();
  this.nearest=null;
  this.installed=false;
  this.activeStoryTargetId=null;
  this.objectiveMarker=null;
  this.storyMarkerAnchor=null;

  this._onKeyDown=this.onKeyDown.bind(this);
  this._onMobileWorldInteract=this.onMobileWorldInteract.bind(this);
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

  // Generic reusable objective compass. It is deliberately separate from
  // wounded-knight dialogue logic so later story NPCs/items/bosses can use the
  // same strict 10%-inset screen-frame navigation.
  this.objectiveMarker=new StoryObjectiveMarker(scene,{insetRatio:0.10}).install();

  scene.input.keyboard?.on('keydown',this._onKeyDown);
  // The shared dialogue module handles advancing; this client handles starting.
  scene.events.on('mobile-world-interact',this._onMobileWorldInteract);
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
  if(this.active)this.dialogueSystem.cancel();
  const scene=this.scene;
  scene?.input?.keyboard?.off('keydown',this._onKeyDown);
  scene?.events?.off('mobile-world-interact',this._onMobileWorldInteract);
  scene?.events?.off('story-objective-activated',this._onObjectiveActivated);
  scene?.events?.off('story-objective-updated',this._onObjectiveUpdated);
  scene?.events?.off('story-objective-completed',this._onObjectiveCompleted);
  scene?.events?.off('story-objective-cleared',this._onObjectiveCleared);
  for(const object of [this.promptText]){
   try{object?.destroy();}catch{}
  }
  try{this.dialogueVignetteState?.vignette?.destroy?.();}catch{}
  this.dialogueVignetteState=null;
  this.objectiveMarker?.destroy();
  this.objectiveMarker=null;
  this.storyMarkerAnchor=null;
  this.knights.clear();
  this.nearest=null;
  this.activeStoryTargetId=null;
  this.installed=false;
  this.scene=null;
  this.storyDirector=null;
  this.dialogueSystem=null;
 }

 resolveStoryMarkerAnchor(targetId=STORY_KNIGHT_ID,objective=null){
  const id=String(targetId||'');
  if(!id)return null;

  // The StoryDirector objective/world story spec is authoritative. A rendered
  // knight may not exist yet because of streaming, and runtime culling may hide
  // it. Neither state is allowed to affect navigation.
  const point=objective?.markerPoint || (id===STORY_KNIGHT_ID?ASH_WOUNDED_KNIGHT_STORY.markerPoint:null);
  const x=Number(point?.x),y=Number(point?.y);
  if(Number.isFinite(x) && Number.isFinite(y)){
   if(!this.storyMarkerAnchor || this.storyMarkerAnchor.id!==id){
    this.storyMarkerAnchor={id,x,y,active:true};
   }else{
    this.storyMarkerAnchor.x=x;
    this.storyMarkerAnchor.y=y;
    this.storyMarkerAnchor.active=true;
   }
   return this.storyMarkerAnchor;
  }

  // Legacy/non-story fallback only: if an objective has no declared point,
  // derive it from an already registered entity. Story objectives should not
  // rely on this path.
  const entry=this.knights.get(id);
  return this.syncKnightMarkerAnchor(entry);
 }

 resolveStoryMarkerAnchor(targetId=STORY_KNIGHT_ID,objective=null){
  const id=String(targetId||'');
  if(!id)return null;

  // The StoryDirector objective/world story spec is authoritative. A rendered
  // knight may not exist yet because of streaming, and runtime culling may hide
  // it. Neither state is allowed to affect navigation.
  const point=objective?.markerPoint || (id===STORY_KNIGHT_ID?ASH_WOUNDED_KNIGHT_STORY.markerPoint:null);
  const x=Number(point?.x),y=Number(point?.y);
  if(Number.isFinite(x) && Number.isFinite(y)){
   if(!this.storyMarkerAnchor || this.storyMarkerAnchor.id!==id){
    this.storyMarkerAnchor={id,x,y,active:true};
   }else{
    this.storyMarkerAnchor.x=x;
    this.storyMarkerAnchor.y=y;
    this.storyMarkerAnchor.active=true;
   }
   return this.storyMarkerAnchor;
  }

  // Legacy/non-story fallback only: if an objective has no declared point,
  // derive it from an already registered entity. Story objectives should not
  // rely on this path.
  const entry=this.knights.get(id);
  return this.syncKnightMarkerAnchor(entry);
 }

 registerKnight(sprite,{id,index=0,story=false}={}){
  if(!sprite || !id)return null;
  const previous=this.knights.get(String(id));
  const entry={
   id:String(id),index:Number(index)||0,sprite,story:Boolean(story),
   eventId:story?STORY_EVENT_ID:`ash_wounded_knight_talk_${index}`,
   markerAnchor:previous?.markerAnchor||{id:String(id),x:Number(sprite.x)||0,y:Number(sprite.y)||0,active:true,visible:true}
  };
  entry.markerAnchor.x=Number(sprite.x)||entry.markerAnchor.x||0;
  entry.markerAnchor.y=Number(sprite.y)||entry.markerAnchor.y||0;
  this.knights.set(entry.id,entry);
  sprite.woundedKnightInteractionId=entry.id;

  // Objective activation may have happened before streamed/late-created target
  // registration. Resolve it as soon as the entity becomes available.
  const objective=this.storyDirector?.getActiveObjective?.();
  if(entry.story && objective?.id===STORY_OBJECTIVE_ID && objective.targetId===entry.id){
   this.activateStoryTarget(entry.id,objective);
  }
  return entry;
 }

 syncKnightMarkerAnchor(entry){
  if(!entry)return null;
  if(!entry.markerAnchor){
   entry.markerAnchor={id:entry.id,x:0,y:0,active:true,visible:true};
  }
  const sprite=entry.sprite;
  const x=Number(sprite?.x),y=Number(sprite?.y);
  if(Number.isFinite(x))entry.markerAnchor.x=x;
  if(Number.isFinite(y))entry.markerAnchor.y=y;
  entry.markerAnchor.active=true;
  entry.markerAnchor.visible=true;
  return entry.markerAnchor;
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
  this.activateStoryTarget(objective.targetId,objective);
 }

 onObjectiveCompleted(objective){
  if(objective?.id!==STORY_OBJECTIVE_ID)return;
  this.deactivateStoryTarget();
 }

 onObjectiveCleared(objective){
  if(objective?.id!==STORY_OBJECTIVE_ID)return;
  this.deactivateStoryTarget();
 }

 activateStoryTarget(targetId,objective=this.storyDirector?.getActiveObjective?.()){
  const id=String(targetId||'');
  if(!id)return false;
  this.activeStoryTargetId=id;
  const anchor=this.resolveStoryMarkerAnchor(id,objective);
  this.objectiveMarker?.setTarget(anchor||null);
  // Marker activation is a story-data operation. The NPC can still be absent
  // from the render/streaming layer at this moment and navigation must work.
  return Boolean(anchor);
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
   this.promptText?.setVisible(false);
   this.updateObjectiveMarker(time,true);
   return;
  }

  if(this.scene.gameOver || this.scene.levelChoiceOpen || this.scene.championRewardOpen || this.storyDirector?.isBusy?.() || this.scene?.isStoryFocusLocked?.()){
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
  prompt.setScale(worldUiScale(scene));
  const target=this.nearest.sprite;
  const promptOffset=Math.max(58,(target?.displayHeight||60)*0.60);
  prompt.setPosition(target.x,target.y-promptOffset).setVisible(true);
 }

 get active(){
  const session=this.dialogueSystem?.active;
  return session?.owner==='woundedKnight'?session:null;
 }

 onKeyDown(event){
  if(!this.scene || event?.repeat || this.dialogueSystem?.active)return;
  if(isInteractionKey(event) && this.nearest){
   this.startInteraction(this.nearest);
  }
 }

 onMobileWorldInteract(pointer){
  if(!this.scene?.isTouchDevice || this.dialogueSystem?.active)return;
  if(!this.scene?.isMobileInteractionPointerAllowed?.(pointer))return;
  if(this.nearest)this.startInteraction(this.nearest);
 }

 startInteraction(entry){
  if(!entry || this.dialogueSystem?.active || this.isCompleted(entry) || this.storyDirector?.isBusy?.())return false;
  if(entry.story && !this.isStoryEntryUnlocked(entry))return false;
  const started=this.dialogueSystem?.begin({
   target:entry.sprite,entry,owner:'woundedKnight',kind:'woundedKnight',
   initiator:'hero',speakerName:'Раненый рыцарь',lines:this.getDialogue(entry),
   eventId:entry.eventId,once:true,
   onComplete:()=>{
    if(entry.story){
     this.storyDirector?.setFlag?.(STORY_FLAG,true);
     this.storyDirector?.completeObjective?.(STORY_OBJECTIVE_ID);
    }
   }
  });
  if(started){
   this.promptText?.setVisible(false);
   this.objectiveMarker?.hide();
  }
  return Boolean(started);
 }

 updateObjectiveMarker(time=0,forceHide=false){
  if(!this.objectiveMarker)return;
  const objective=this.storyDirector?.getActiveObjective?.();
  const objectiveActive=Boolean(objective?.id===STORY_OBJECTIVE_ID && objective?.targetId===this.activeStoryTargetId);
  if(!objectiveActive || this.storyDirector?.hasCompletedObjective?.(STORY_OBJECTIVE_ID)){
   this.objectiveMarker.hide();
   return;
  }

  // Never consult this.knights / sprite.active / sprite.visible here. The point
  // comes from story data and therefore exists from objective activation even
  // if streaming has not created the NPC yet.
  const anchor=this.resolveStoryMarkerAnchor(this.activeStoryTargetId,objective);
  if(!anchor){
   this.objectiveMarker.hide();
   return;
  }
  if(this.objectiveMarker.target!==anchor)this.objectiveMarker.setTarget(anchor);
  this.objectiveMarker.update(time,{forceHide});
 }
}

export {STORY_KNIGHT_ID,STORY_EVENT_ID,STORY_OBJECTIVE_ID,STORY_FLAG};
export default WoundedKnightInteractionSystem;

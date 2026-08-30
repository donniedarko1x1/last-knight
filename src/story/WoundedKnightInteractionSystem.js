import Phaser from 'phaser';

const INTERACTION_DISTANCE=112;
const CAMERA_IN_MS=300;
const CAMERA_OUT_MS=300;
const DIALOGUE_INPUT_LOCK_MS=220;
const STORY_KNIGHT_ID='ash:wounded_knight:3';
const STORY_EVENT_ID='ash_story_wounded_knight';
const STORY_FLAG='ash_story_wounded_knight_met';

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

  this._onKeyDown=this.onKeyDown.bind(this);
  this._onPointerDown=this.onPointerDown.bind(this);
  this._onDialogueStart=this.onDialogueStart.bind(this);
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

  this.storyWorldMarker=addUiText(scene,0,0,'◆',{
   fontFamily:'Georgia, serif',fontSize:'27px',color:'#ffd66b',
   stroke:'#211607',strokeThickness:4
  }).setOrigin(0.5).setDepth(625).setVisible(false);

  const markerGraphics=scene.add.graphics();
  markerGraphics.fillStyle(0x4b3514,0.78);
  markerGraphics.fillCircle(0,0,18);
  markerGraphics.lineStyle(2,0xffd66b,0.95);
  markerGraphics.strokeCircle(0,0,17);
  markerGraphics.fillStyle(0xffd66b,1);
  markerGraphics.fillPoints([
   new Phaser.Geom.Point(0,-11),new Phaser.Geom.Point(9,0),
   new Phaser.Geom.Point(0,11),new Phaser.Geom.Point(-9,0)
  ],true);
  markerGraphics.fillTriangle(-5,-19,5,-19,0,-28);
  this.edgeMarker=scene.add.container(0,0,[markerGraphics])
   .setScrollFactor(0).setDepth(626).setVisible(false);

  scene.input.keyboard?.on('keydown',this._onKeyDown);
  scene.input.on('pointerdown',this._onPointerDown);
  scene.events.on('story-dialogue-start',this._onDialogueStart);

  // The starting Ash Fields chunk is created before this system is installed.
  // Register any wounded knights that already exist, otherwise their optional
  // registration call was missed and interaction silently never becomes active.
  this.registerExistingKnightsFromScene();
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
  scene?.events?.off('story-dialogue-start',this._onDialogueStart);
  for(const object of [this.promptText,this.dialogueText,this.continueHint,this.storyWorldMarker,this.edgeMarker]){
   try{object?.destroy();}catch{}
  }
  this.knights.clear();
  this.active=null;
  this.nearest=null;
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
  return entry;
 }

 isCompleted(entry){
  return Boolean(entry && this.storyDirector?.hasCompleted?.(entry.eventId));
 }

 getDialogue(entry){
  if(entry?.story)return STORY_DIALOGUE;
  const nonStoryIndex=entry.index>3?entry.index-1:entry.index;
  return AMBIENT_DIALOGUES[Math.abs(nonStoryIndex)%AMBIENT_DIALOGUES.length];
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
  prompt.setText(touch?'Коснитесь, чтобы поговорить':'Нажмите E, чтобы поговорить');
  prompt.setFontSize(touch?16:15);
  prompt.setPosition(scene.player.x,scene.player.y-64).setVisible(true);
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

 onPointerDown(pointer){
  if(!this.scene)return;
  const now=this.scene.game?.loop?.time||0;
  if(this.active){
   this.advanceDialogue(now);
   return;
  }
  if(this.scene.isTouchDevice && this.nearest){
   this.startInteraction(this.nearest,now);
  }
 }

 startInteraction(entry,now=0){
  if(!entry || this.active || this.isCompleted(entry) || this.storyDirector?.isBusy?.())return false;
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
  if(!entry?.sprite?.active){controls?.cancel?.();return;}

  this.active={entry,lines:payload.lines||[],closing:false};
  this.dialogueControls=controls||null;
  this.dialogueLineIndex=0;
  this.closeAt=0;
  this.promptText?.setVisible(false);
  this.edgeMarker?.setVisible(false);
  this.storyWorldMarker?.setVisible(false);

  const scene=this.scene;
  const cam=scene.cameras.main;
  this.cameraRestore={zoom:cam.zoom};
  cam.stopFollow();
  const focusX=(scene.player.x+entry.sprite.x)*0.5;
  const focusY=(scene.player.y+entry.sprite.y)*0.5-18;
  const targetZoom=Math.min(cam.zoom*1.52,cam.zoom+0.85);
  cam.pan(focusX,focusY,CAMERA_IN_MS,'Sine.easeOut',true);
  cam.zoomTo(targetZoom,CAMERA_IN_MS,'Sine.easeOut',true);

  this.continueHint
   ?.setText(scene.isTouchDevice?'Коснитесь экрана':'Любая клавиша — продолжить')
   .setVisible(true);
  this.showDialogueLine();
 }

 showDialogueLine(){
  if(!this.active || !this.dialogueText)return;
  const line=this.active.lines[this.dialogueLineIndex];
  if(!line)return;
  this.dialogueText.setText(line.text||'').setVisible(true);
  this.positionDialogueUi();
 }

 positionDialogueUi(){
  if(!this.active || !this.scene)return;
  const line=this.active.lines[this.dialogueLineIndex];
  const knight=this.active.entry.sprite;
  const actor=line?.speaker==='hero'?this.scene.player:knight;
  if(actor && this.dialogueText){
   const yOffset=line?.speaker==='hero'?74:Math.max(54,(knight.displayHeight||60)*0.54);
   this.dialogueText.setPosition(actor.x,actor.y-yOffset);
  }
  if(this.continueHint){
   const metrics=this.scene.getUiMetrics?.()||{cx:400,height:720};
   this.continueHint.setPosition(metrics.cx,metrics.height-18);
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
  const scene=this.scene;
  if(!scene || !this.edgeMarker || !this.storyWorldMarker)return;
  const entry=this.knights.get(STORY_KNIGHT_ID);
  if(forceHide || !entry?.sprite?.active || this.isCompleted(entry)){
   this.edgeMarker.setVisible(false);
   this.storyWorldMarker.setVisible(false);
   return;
  }

  const cam=scene.cameras.main;
  const view=cam.worldView;
  const metrics=scene.getUiMetrics?.()||{width:view.width,height:view.height,cx:view.width*0.5,cy:view.height*0.5};
  const sx=entry.sprite.x-view.left;
  const sy=entry.sprite.y-view.top;
  const inset=36;
  const onScreen=sx>=inset && sx<=metrics.width-inset && sy>=inset && sy<=metrics.height-inset;

  if(onScreen){
   this.edgeMarker.setVisible(false);
   const floatY=Math.sin(time*0.006)*4;
   this.storyWorldMarker.setPosition(entry.sprite.x,entry.sprite.y-58+floatY).setVisible(true);
   return;
  }

  this.storyWorldMarker.setVisible(false);
  const dx=entry.sprite.x-(view.left+view.width*0.5);
  const dy=entry.sprite.y-(view.top+view.height*0.5);
  const len=Math.max(0.001,Math.hypot(dx,dy));
  const ux=dx/len,uy=dy/len;
  const halfW=Math.max(1,metrics.width*0.5-inset);
  const halfH=Math.max(1,metrics.height*0.5-inset);
  const tx=Math.abs(ux)>0.0001?halfW/Math.abs(ux):Infinity;
  const ty=Math.abs(uy)>0.0001?halfH/Math.abs(uy):Infinity;
  const t=Math.min(tx,ty);
  const x=metrics.cx+ux*t;
  const y=metrics.cy+uy*t;
  this.edgeMarker
   .setPosition(x,y)
   .setRotation(Math.atan2(dy,dx)+Math.PI/2)
   .setVisible(true);
 }
}

export {STORY_KNIGHT_ID,STORY_EVENT_ID,STORY_FLAG};
export default WoundedKnightInteractionSystem;

const STORY_STATE=Object.freeze({
 NORMAL:'NORMAL',
 DIALOGUE:'DIALOGUE',
 CINEMATIC:'CINEMATIC',
 SCRIPTED_EVENT:'SCRIPTED_EVENT'
});

const STORY_ACTION=Object.freeze({
 CINEMATIC:'cinematic',
 DIALOGUE:'dialogue',
 CALLBACK:'callback'
});

function normalizeRegion(value){
 return String(value??'').trim().toLowerCase();
}

class StoryDirector {
 constructor(scene,{events=[]}={}){
  this.scene=scene;
  this.events=Array.isArray(events)?events:[];
  this.state=STORY_STATE.NORMAL;
  this.flags=new Map();
  this.completedEvents=new Set();
  this.activeEvent=null;
  this.installed=false;
  this.lastEvaluationAt=-Infinity;
  this.evaluationIntervalMs=120;
  this._cinematicSceneKey='CinematicScene';
 }

 install(){
  if(this.installed)return this;
  this.installed=true;
  return this;
 }

 destroy(){
  if(!this.installed && !this.scene)return;
  try{
   if(this.scene?.scene?.isActive?.(this._cinematicSceneKey)){
    this.scene.scene.stop(this._cinematicSceneKey);
   }
  }catch{}
  try{this.scene?.setGameplayPaused?.('story',false);}catch{}
  this.activeEvent=null;
  this.state=STORY_STATE.NORMAL;
  this.installed=false;
  this.scene=null;
 }

 setState(nextState,meta=null){
  if(!Object.values(STORY_STATE).includes(nextState)){
   throw new Error(`Unknown story state: ${nextState}`);
  }
  if(this.state===nextState)return;
  const previous=this.state;
  this.state=nextState;
  this.scene?.events?.emit?.('story-state-changed',nextState,previous,meta);
 }

 getState(){return this.state;}
 isBusy(){return this.state!==STORY_STATE.NORMAL;}

 setFlag(key,value=true){
  if(!key)return value;
  this.flags.set(String(key),value);
  this.scene?.events?.emit?.('story-flag-changed',String(key),value);
  return value;
 }

 getFlag(key,fallback=false){
  const normalized=String(key??'');
  return this.flags.has(normalized)?this.flags.get(normalized):fallback;
 }

 hasCompleted(id){return this.completedEvents.has(String(id));}

 markCompleted(id){
  if(!id)return;
  const normalized=String(id);
  this.completedEvents.add(normalized);
  this.scene?.events?.emit?.('story-event-completed',normalized);
 }

 getContext(){
  const scene=this.scene;
  const zoneIndex=scene?.currentWorldZoneIndex??0;
  const zone=scene?.worldZones?.[zoneIndex] ?? null;
  const region=zone?.name ?? scene?.regionText?.text ?? null;
  return {
   x:scene?.player?.x??0,
   y:scene?.player?.y??0,
   kills:scene?.kills??0,
   wave:scene?.wave??1,
   level:scene?.level??1,
   region,
   regionIndex:zoneIndex,
   gameOver:Boolean(scene?.gameOver),
   championActive:Boolean(scene?.activeChampion?.active),
   flags:this.flags,
   completedEvents:this.completedEvents,
   scene
  };
 }

 evaluateTrigger(trigger={},context=this.getContext()){
  if(!trigger || typeof trigger!=='object')return true;
  if(trigger.region!==undefined && normalizeRegion(context.region)!==normalizeRegion(trigger.region))return false;
  if(trigger.regionIndex!==undefined && context.regionIndex!==trigger.regionIndex)return false;
  if(trigger.kills!==undefined && context.kills<Number(trigger.kills))return false;
  if(trigger.wave!==undefined && context.wave<Number(trigger.wave))return false;
  if(trigger.level!==undefined && context.level<Number(trigger.level))return false;
  if(trigger.xMin!==undefined && context.x<Number(trigger.xMin))return false;
  if(trigger.xMax!==undefined && context.x>Number(trigger.xMax))return false;
  if(trigger.yMin!==undefined && context.y<Number(trigger.yMin))return false;
  if(trigger.yMax!==undefined && context.y>Number(trigger.yMax))return false;
  if(trigger.championActive!==undefined && context.championActive!==Boolean(trigger.championActive))return false;
  if(trigger.flag!==undefined && !this.getFlag(trigger.flag,false))return false;
  if(trigger.notFlag!==undefined && this.getFlag(trigger.notFlag,false))return false;
  if(Array.isArray(trigger.allFlags) && trigger.allFlags.some(flag=>!this.getFlag(flag,false)))return false;
  if(Array.isArray(trigger.noFlags) && trigger.noFlags.some(flag=>this.getFlag(flag,false)))return false;
  if(typeof trigger.predicate==='function' && !trigger.predicate(context,this))return false;
  return true;
 }

 update(time=0){
  if(!this.installed || !this.scene || this.isBusy())return false;
  if(this.scene.gameOver || this.scene.levelChoiceOpen || this.scene.championRewardOpen)return false;
  if(time-this.lastEvaluationAt<this.evaluationIntervalMs)return false;
  this.lastEvaluationAt=time;
  const context=this.getContext();

  for(const event of this.events){
   if(!event || event.enabled===false || !event.id)continue;
   if(event.once!==false && this.hasCompleted(event.id))continue;
   if(!this.evaluateTrigger(event.trigger,context))continue;
   return this.startEvent(event,context);
  }
  return false;
 }

 triggerEvent(id,context=this.getContext()){
  const event=this.events.find(item=>item?.id===id);
  if(!event)return false;
  if(event.once!==false && this.hasCompleted(event.id))return false;
  return this.startEvent(event,context);
 }

 startEvent(event,context=this.getContext()){
  if(this.isBusy() || !event)return false;
  this.activeEvent=event;
  this.scene?.events?.emit?.('story-event-started',event,context);
  const action=event.action||{};

  if(action.type===STORY_ACTION.CINEMATIC){
   return this.playCinematic(action.pages||[],{
    eventId:event.id,
    once:event.once!==false,
    releaseTextureKeys:action.releaseTextureKeys||[],
    onComplete:action.onComplete
   });
  }

  if(action.type===STORY_ACTION.DIALOGUE){
   return this.beginDialogue(action,{eventId:event.id,once:event.once!==false});
  }

  if(action.type===STORY_ACTION.CALLBACK && typeof action.run==='function'){
   this.setState(STORY_STATE.SCRIPTED_EVENT,{eventId:event.id});
   this.scene?.setGameplayPaused?.('story',true);
   try{
    const result=action.run(context,this);
    if(result?.then){
     result.then(()=>this.completeActiveEvent()).catch(error=>{
      console.error('[StoryDirector] scripted event failed',error);
      this.cancelActiveEvent();
     });
    }else{
     this.completeActiveEvent();
    }
   }catch(error){
    console.error('[StoryDirector] scripted event failed',error);
    this.cancelActiveEvent();
   }
   return true;
  }

  console.warn('[StoryDirector] Unsupported story action',action.type,event.id);
  this.activeEvent=null;
  return false;
 }

 playCinematic(pages,{eventId=null,once=true,releaseTextureKeys=[],onComplete=null}={}){
  const scene=this.scene;
  if(!scene || this.isBusy() || !Array.isArray(pages) || pages.length===0)return false;
  const usablePages=pages.filter(page=>page && page.image && page.text!==undefined);
  if(usablePages.length===0)return false;

  const missing=usablePages.filter(page=>!scene.textures?.exists?.(page.image)).map(page=>page.image);
  if(missing.length){
   console.warn(`[StoryDirector] Cinematic skipped; missing texture(s): ${[...new Set(missing)].join(', ')}`);
   return false;
  }

  this.activeEvent=this.activeEvent||{id:eventId,once};
  this.setState(STORY_STATE.CINEMATIC,{eventId});
  scene.setGameplayPaused?.('story',true);

  const finish=()=>{
   if(typeof onComplete==='function'){
    try{onComplete(this.getContext(),this);}catch(error){console.error('[StoryDirector] cinematic onComplete failed',error);}
   }
   if(eventId && once)this.markCompleted(eventId);
   this.activeEvent=null;
   this.setState(STORY_STATE.NORMAL,{eventId});
   scene.setGameplayPaused?.('story',false);
  };

  const cancel=()=>{
   this.activeEvent=null;
   this.setState(STORY_STATE.NORMAL,{eventId,cancelled:true});
   scene.setGameplayPaused?.('story',false);
  };

  try{
   if(scene.scene.isActive(this._cinematicSceneKey)){
    console.warn('[StoryDirector] CinematicScene is already active');
    cancel();
    return false;
   }
   scene.scene.launch(this._cinematicSceneKey,{
    mode:'story',
    pages:usablePages,
    releaseTextureKeys,
    onComplete:finish,
    onCancel:cancel
   });
   scene.scene.bringToTop(this._cinematicSceneKey);
   return true;
  }catch(error){
   console.error('[StoryDirector] Failed to launch cinematic',error);
   cancel();
   return false;
  }
 }

 beginDialogue(payload={},meta={}){
  if(this.isBusy())return false;
  this.activeEvent=this.activeEvent||{id:meta.eventId,once:meta.once!==false};
  this.setState(STORY_STATE.DIALOGUE,{eventId:meta.eventId});
  this.scene?.setGameplayPaused?.('story',true);
  this.scene?.events?.emit?.('story-dialogue-start',payload,{
   complete:()=>this.completeDialogue(meta),
   cancel:()=>this.cancelActiveEvent()
  });
  return true;
 }

 completeDialogue(meta={}){
  if(this.state!==STORY_STATE.DIALOGUE)return false;
  if(meta.eventId && meta.once!==false)this.markCompleted(meta.eventId);
  this.activeEvent=null;
  this.setState(STORY_STATE.NORMAL,{eventId:meta.eventId});
  this.scene?.setGameplayPaused?.('story',false);
  return true;
 }

 completeActiveEvent(){
  const event=this.activeEvent;
  if(!event)return false;
  if(event.id && event.once!==false)this.markCompleted(event.id);
  this.activeEvent=null;
  this.setState(STORY_STATE.NORMAL,{eventId:event.id});
  this.scene?.setGameplayPaused?.('story',false);
  return true;
 }

 cancelActiveEvent(){
  const event=this.activeEvent;
  this.activeEvent=null;
  this.setState(STORY_STATE.NORMAL,{eventId:event?.id,cancelled:true});
  this.scene?.setGameplayPaused?.('story',false);
  return true;
 }
}

export {STORY_STATE,STORY_ACTION};
export default StoryDirector;

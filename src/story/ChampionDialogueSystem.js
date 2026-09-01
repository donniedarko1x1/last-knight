// Compatibility entry point for scripted champions/NPCs. Presentation and input
// belong to WorldDialogueSystem, exactly as for E-initiated knight conversations.
class ChampionDialogueSystem{
 constructor(scene){this.scene=scene;}
 get active(){
  const session=this.scene?.dialogueSystem?.active;
  return session?.owner==='championDialogue'?session:null;
 }
 begin(lines=[],meta={}){
  return Boolean(this.scene?.dialogueSystem?.begin({
   target:meta.target||this.scene.activeChampion,lines,
   initiator:meta.initiator||'npc',speakerName:meta.speakerName||'Собеседник',
   owner:'championDialogue',kind:'champion',eventId:meta.eventId||null,
   once:meta.once??false,onComplete:meta.onComplete,onCancel:meta.onCancel
  }));
 }
 advance(){if(this.active)this.scene.dialogueSystem.advanceDialogue(this.scene.game?.loop?.time||0);}
 finish(){if(this.active)this.scene.dialogueSystem.beginClose(this.scene.game?.loop?.time||0);}
 destroy(){
  if(this.active)this.scene.dialogueSystem.cancel();
  this.scene=null;
 }
}
export default ChampionDialogueSystem;

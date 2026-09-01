import assert from 'node:assert/strict';
import {makeScene,object,tick,enemyFor,method} from './story-test-fixture.mjs';
import {ASH_WOUNDED_KNIGHT_STORY as story,ASH_ALTAR_CHAMPION_STORY as altar,STORY_ANOMALY_DEFINITIONS as definitions} from '../src/story/storyEvents.js';
import {BROKEN_SAINT_INTRO,BROKEN_SAINT_AFTERMATH_PAGES} from '../src/story/BrokenSaintCinematics.js';
import {BROKEN_SAINT_AFTERMATH_PAGE_KEYS} from '../src/config/assetManifest.mjs';

const key=(t,code='KeyE',repeat=false)=>t.scene.input.keyboard.emit('keydown',{code,key:code==='KeyE'?'e':' ',repeat});
function complete(t){
 let now=t.scene.time.now;
 while(t.dialogue.active && !t.dialogue.active.closing){tick(t,now+=240);key(t);}
 tick(t,now+340);
}
// The original post-wave-3 NPC still requires E, advances one line per press,
// and unlocks the next objective only after the complete conversation closes.
{
 const t=makeScene();const {system,dialogue,director}=t;
 const entry=system.registerKnight(object(520,270),{id:story.characterId,index:3,story:true});
 tick(t,1000);key(t,'KeyE');assert.equal(dialogue.active,null,'Story knight locked before objective');
 director.activateObjective({id:story.objectiveId,targetId:story.characterId,markerPoint:story.markerPoint});
 tick(t,1010);assert.equal(dialogue.active,null,'Proximity alone never starts a hero interaction');
 key(t,'KeyE');assert.equal(dialogue.active.initiator,'hero');assert.equal(dialogue.dialogueLineIndex,0);
 assert.equal(dialogue.dialogueText.text,'Раненый рыцарь: «Воды...»');
 tick(t,1050);key(t);assert.equal(dialogue.dialogueLineIndex,0,'Opening press/tap lock');
 tick(t,1400);key(t,'KeyE',true);assert.equal(dialogue.dialogueLineIndex,0,'No key-repeat skipping');
 key(t);assert.equal(dialogue.dialogueLineIndex,1);assert.equal(dialogue.dialogueText.text,'Ты: «Дыши. Кто вас разбил?»');
 assert.equal(director.hasCompletedObjective(story.objectiveId),false);
 complete(t);assert.equal(dialogue.active,null);assert.equal(system.active,null);
 assert.equal(director.hasCompletedObjective(story.objectiveId),true);
 assert.equal(director.getFlag(story.metFlag),true);
 tick(t,t.scene.time.now+500);assert.equal(system.startInteraction(entry),false,'Knight speaks only once');
}
// Walking/attacking must never consume an NPC's first line, the hero's reply,
// or the closing press. Exercise all shared callers, including future NPCs.
for(const kind of ['knight','skeleton','brokenSaint','futureNpc']){
 const t=makeScene();const {scene,dialogue}=t;
 const ignoredInput=()=>{
  const index=dialogue.dialogueLineIndex;
  for(const code of ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space','Enter','Escape','Digit1']){
   tick(t,scene.time.now+300);key(t,code);key(t,code,true);
   assert.equal(dialogue.dialogueLineIndex,index,kind+': '+code+' does not advance');
   assert.equal(dialogue.active.closing,false,kind+': other keys cannot close');
  }
  for(const button of [0,1,2]){
   tick(t,scene.time.now+300);scene.input.emit('pointerdown',{button});
   assert.equal(dialogue.dialogueLineIndex,index,kind+': mouse does not advance');
   assert.equal(dialogue.active.closing,false);
  }
 };
 key(t,'KeyW');key(t,'KeyE'); // Both were pressed before the NPC started.
 if(kind==='knight'){
  t.system.registerKnight(object(520,270),{id:'input-knight',index:0});tick(t,1000);
  key(t,'KeyE');
 }else if(kind==='skeleton'){
  const enemy=enemyFor(t,definitions[0]);t.anomalies.updateEnemy(enemy,1000,90);
 }else{
  t.champions.begin([{speaker:'npc',text:'Стой.'},{speaker:'hero',text:'Слушаю.'}],{
   target:object(520,270),speakerName:kind
  });
 }
 assert.ok(dialogue.active);assert.equal(dialogue.dialogueLineIndex,0);
 // Opening E cannot consume the first line; holding E through the lock cannot
 // consume it either, even if movement keys are released/repressed meanwhile.
 tick(t,1050);key(t);assert.equal(dialogue.dialogueLineIndex,0);
 for(const time of [1500,3000,5000]){tick(t,time);key(t,'KeyE',true);assert.equal(dialogue.dialogueLineIndex,0);}
 ignoredInput();
 for(let index=1;index<dialogue.active.lines.length;index++){
  tick(t,scene.time.now+300);key(t);
  assert.equal(dialogue.dialogueLineIndex,index,kind+': one fresh E advances exactly one line');
  tick(t,scene.time.now+400);key(t,'KeyE',true);assert.equal(dialogue.dialogueLineIndex,index);
  ignoredInput();
 }
 tick(t,scene.time.now+300);key(t);assert.equal(dialogue.active.closing,true);
 tick(t,dialogue.closeAt+1);assert.equal(dialogue.active,null);
}
// E uses the physical key in Russian layout too; interaction and advancing
// share the same key recognition.
{
 const t=makeScene();t.system.registerKnight(object(520,270),{id:'russian-key',index:0});tick(t,1000);
 t.scene.input.keyboard.emit('keydown',{code:'KeyE',key:'у',repeat:false});
 assert.equal(t.dialogue.dialogueLineIndex,0);assert.ok(t.dialogue.active);
 tick(t,1400);t.scene.input.keyboard.emit('keydown',{code:'KeyE',key:'у',repeat:false});
 assert.equal(t.dialogue.dialogueLineIndex,1);
}
// Every existing anomaly starts itself, keeps each line indefinitely, and flees
// only after the player closes the last line and the camera return completes.
for(const definition of definitions){
 const t=makeScene();const e=enemyFor(t,definition);const {scene,dialogue,anomalies,director}=t;
 assert.equal(anomalies.updateEnemy(e,scene.time.now,9999),null,'No auto-start out of range');
 assert.equal(dialogue.active,null);
 assert.equal(anomalies.updateEnemy(e,scene.time.now,90).kind,'hesitate');
 assert.equal(dialogue.active.initiator,'npc');assert.equal(scene.isStoryAnomalyMomentActive(),true);
 assert.equal(dialogue.dialogueText.text,`Скелет: «${definition.dialogue[0].text}»`);
 tick(t,31000);assert.equal(dialogue.dialogueLineIndex,0,'Thirty seconds must not auto-advance');
 assert.equal(e.storyAnomaly.phase,'dialogue');assert.equal(scene.time.paused,true);
 assert.equal(anomalies.updateEnemy(e,31000,90).kind,'hesitate');
 assert.equal(scene.damagePlayer(8,'enemy'),false,'Every damage source blocked during dialogue');
 assert.equal(scene.damagePlayer(8,'mageProjectile'),false);
 for(let i=1;i<definition.dialogue.length;i++){
  key(t);
  assert.equal(dialogue.dialogueLineIndex,i);
  assert.equal(dialogue.dialogueText.text,`Ты: «${definition.dialogue[i].text}»`);
  tick(t,scene.time.now+240);
 }
 key(t);assert.equal(dialogue.active.closing,true);assert.equal(e.storyAnomaly.phase,'dialogue');
 const closeAt=dialogue.closeAt;tick(t,closeAt+1);
 assert.equal(dialogue.active,null);assert.equal(scene.storyAnomalyCueState,null);
 assert.equal(e.storyAnomaly.phase,'release');assert.equal(scene.time.paused,false);
 assert.equal(director.hasCompleted(definition.id),true);
 assert.equal(anomalies.updateEnemy(e,scene.time.now,90).kind,'release');
 scene.time.now+=121;assert.equal(anomalies.updateEnemy(e,scene.time.now,90).kind,'flee');
 e.x=-1000;assert.equal(anomalies.updateEnemy(e,scene.time.now+20,90).kind,'vanished');
 assert.equal(e.active,false);assert.equal(scene.enemies.includes(e),false);
 anomalies.beginWave(definition.wave,20);
 assert.equal([...anomalies.selectedOrdinals.values()].some(d=>d.id===definition.id),false);
}
// A second NPC cannot overwrite an active conversation or lose its pending event.
{
 const t=makeScene();const first=enemyFor(t,definitions[1]);const second=enemyFor(t,definitions[2]);
 t.anomalies.updateEnemy(first,1000,90);
 assert.equal(t.anomalies.updateEnemy(second,1000,90),null);
 assert.equal(second.storyAnomaly.phase,'waiting');assert.equal(t.dialogue.active.target,first);
 complete(t);tick(t,t.scene.time.now+500);
 assert.equal(t.anomalies.updateEnemy(second,t.scene.time.now,90).kind,'hesitate');
 assert.equal(t.dialogue.active.target,second);
}
// Busy overlays/focus reject an NPC trigger without consuming it; the same NPC retries.
for(const blocker of ['pause','focus']){
 const t=makeScene();const e=enemyFor(t,definitions[0]);
 if(blocker==='pause')t.scene.setGameplayPaused('menu',true);else t.scene.acquireStoryFocus('other-scene');
 assert.equal(t.anomalies.updateEnemy(e,1000,90),null);assert.equal(e.storyAnomaly.phase,'waiting');
 if(blocker==='pause')t.scene.setGameplayPaused('menu',false);else t.scene.releaseStoryFocus('other-scene',{cooldownMs:0});
 assert.equal(t.anomalies.updateEnemy(e,1000,90).kind,'hesitate');
 assert.equal(t.dialogue.active.target,e);
}
// Mobile uses the existing right-half world-interaction gate for both starts and advances.
{
 const t=makeScene();t.scene.isTouchDevice=true;
 t.system.registerKnight(object(520,270),{id:'mobile-knight',index:0});tick(t,1000);
 t.scene.events.emit('mobile-world-interact',{x:100});assert.equal(t.dialogue.active,null);
 t.scene.events.emit('mobile-world-interact',{x:700});assert.equal(t.dialogue.dialogueLineIndex,0);
 tick(t,1400);t.scene.events.emit('mobile-world-interact',{x:100});assert.equal(t.dialogue.dialogueLineIndex,0);
 t.scene.input.emit('pointerdown');assert.equal(t.dialogue.dialogueLineIndex,0,'No duplicate raw touch advance');
 t.scene.events.emit('mobile-world-interact',{x:700});assert.equal(t.dialogue.dialogueLineIndex,1);
 complete(t);tick(t,t.scene.time.now+500);
 const e=enemyFor(t,definitions[0]);t.anomalies.updateEnemy(e,t.scene.time.now,90);
 tick(t,t.scene.time.now+400);t.scene.events.emit('mobile-world-interact',{x:700});assert.equal(t.dialogue.dialogueLineIndex,1);
}
// Target loss, external cancellation, game over, and scene shutdown release UI and locks.
for(const ending of ['target','director','gameover','shutdown']){
 const t=makeScene();const e=enemyFor(t,definitions[0]);t.anomalies.updateEnemy(e,1000,90);tick(t,1600);
 const v=t.dialogue.dialogueVignetteState.vignette;
 if(ending==='target')e.active=false;
 if(ending==='gameover')t.scene.gameOver=true;
 if(ending==='director')t.director.cancelActiveEvent();
 if(ending==='shutdown')t.dialogue.destroy();else tick(t,1800);
 assert.equal(t.dialogue.active,null);assert.equal(v.active,false);
 assert.equal(t.scene.time.paused,false);assert.equal(t.scene.storyFocusLockOwner,'');
 assert.equal(t.scene.storyAnomalyCueState,null);assert.equal(t.director.hasCompleted(definitions[0].id),false);
 if(ending==='shutdown'){
  t.system.destroy();assert.equal(t.scene.input.keyboard.listenerCount('keydown'),0);
  assert.equal(t.scene.events.listenerCount('story-dialogue-start'),0);
 }
}
// The generic NPC/champion entry point shares the same presentation, input, and cleanup.
{
 const t=makeScene();let completed=0;
 assert.equal(t.champions.begin([{speaker:'npc',text:'Стой.'},{speaker:'hero',text:'Слушаю.'}],{target:object(520,270),speakerName:'Страж',onComplete:()=>completed++}),true);
 assert.equal(t.champions.active,t.dialogue.active);assert.equal(t.dialogue.dialogueText.text,'Страж: «Стой.»');
 complete(t);assert.equal(completed,1);assert.equal(t.champions.active,null);
 assert.equal(t.champions.begin([{text:'Без адресата'}]),false);
}
// Restore only animations that this dialogue paused, preserve distant projectiles,
// and remove a bolt already overlapping the hero before combat resumes.
{
 const t=makeScene();let paused=0,resumed=0;
 const e=enemyFor(t,definitions[0]);e.visual.anims={isPlaying:true,isPaused:false,pause(){paused++;},resume(){resumed++;}};
 const near={...object(440,270),born:700};const far={...object(800,400),born:700};t.scene.projectiles=[near,far];
 t.anomalies.updateEnemy(e,1000,90);assert.equal(paused,1);
 tick(t,11000);complete(t);
 assert.equal(resumed,1);assert.equal(near.active,false);assert.equal(far.active,true);
 assert.equal(far.born,700+t.scene.time.now-1000);assert.equal(far.lastWorldX,800);
 assert.equal(e.lastAttack,t.scene.time.now);
}
console.log('World dialogue regression PASSED: hero E, all NPC triggers, indefinite lines, E-only desktop input, ignored WASD/mouse, held E, mobile taps, conflicts/retries, quest completion, fleeing, damage freeze, cleanup, NPC API.');

// Full Broken Saint reveal: camera settles, vignette fully fades in, only then
// smoke/materialization begins, followed by E-driven dialogue and combat.
function saintScene(){
 const t=makeScene();const s=t.scene;
 const champion={...object(520,270),hp:100,championKind:'brokenSaint',storyDormant:true,
  visual:object(520,270),shadowVisual:object(520,270),body:{enable:false,stop(){},setVelocity(){},reset(){}}};
 const counts={wave:0,music:0};
 s.wave=4;s.storyDirector.setFlag(altar.waveClearedFlag,true);
 s.getAshStoryLandmarkTarget=()=>object(520,270);s.clampWorldY=y=>y;
 s.spawnChampion=()=>{s.activeChampion=champion;s.enemies.push(champion);return champion;};
 s.stopBackgroundMusic=()=>{};s.setHeroFocusInteraction=()=>{};s.setupBackgroundMusic=()=>{};
 s.playBrokenSaintMaterializeSfx=()=>{};
 s.createAshChampionRevealFx=()=>[object()];
 s.startWave=wave=>{counts.wave++;s.wave=wave;};s.startBrokenSaintMusic=()=>counts.music++;
 s.championNameText=object();s.championHpBack=object();s.championHpFill=object();
 s.getChampionDefinition=()=>({name:'BROKEN SAINT'});s.updateChampionBar=()=>{};s.showWaveBanner=()=>{};
 for(const name of ['beginAshChampionReveal','beginBrokenSaintIntroDialogue','releaseAshChampionFight','isAshAltarStoryGateActive'])s[name]=method(name);
 assert.equal(s.beginAshChampionReveal(),true);
 return {...t,champion,counts};
}
{
 const t=saintScene();const s=t.scene;const state=s.ashChampionIntroState;
 assert.equal(s.releaseAshChampionFight(),false,'Cannot bypass the intro dialogue');
 assert.equal(state.ashFx.length,0,'Smoke is absent while the camera is moving');
 tick(t,state.cameraSettledAt-1);s.updateAshAltarChampionStory(s.time.now);
 assert.equal(state.vignette,null,'No vignette before the altar camera settles');
 assert.equal(state.ashFx.length,0,'No smoke before the altar camera settles');
 tick(t,state.cameraSettledAt);s.updateAshAltarChampionStory(s.time.now);
 assert.ok(state.vignette?.active,'Settled altar view begins the vignette');
 assert.equal(state.ashFx.length,0,'Vignette appears before smoke and materialization');
 assert.equal(t.champion.visual.alpha,0,'Broken Saint remains hidden through vignette fade');
 tick(t,state.materializeAt-1);s.updateAshAltarChampionStory(s.time.now);
 assert.equal(state.ashFx.length,0,'Smoke waits for the completed vignette fade');
 tick(t,state.materializeAt);s.updateAshAltarChampionStory(s.time.now);
 assert.equal(state.materializationStarted,true);
 assert.equal(state.ashFx.length,1,'Smoke begins only after the vignette is visible');
 tick(t,state.dialogueAt-1);s.updateAshAltarChampionStory(s.time.now);
 assert.equal(t.dialogue.active,null);assert.equal(t.counts.wave,0);
 const revealMask=state.vignette;
 tick(t,state.dialogueAt);s.updateAshAltarChampionStory(s.time.now);
 assert.equal(t.dialogue.active.target,t.champion);assert.equal(state.dialogueStarted,true);
 assert.equal(t.dialogue.active.initiator,'npc');assert.equal(t.dialogue.dialogueText.text,'Broken Saint: «Ты не должен был вернуться.»');
 assert.equal(revealMask.active,false,'Only the shared dialogue mask remains');
 assert.equal(t.dialogue.cameraRestore.zoom,state.restoreZoom);
 const endTime=s.time.now+30000;tick(t,endTime);s.updateAshAltarChampionStory(endTime);
 assert.equal(t.dialogue.dialogueLineIndex,0,'No timeout can skip the intro');
 assert.equal(t.counts.wave,0);assert.equal(t.counts.music,0);assert.equal(t.champion.body.enable,false);
 assert.equal(s.releaseAshChampionFight(),false,'Dialogue must finish before combat unlocks');
 for(let i=1;i<BROKEN_SAINT_INTRO.length;i++){
  key(t);assert.equal(t.dialogue.dialogueText.text,`${i%2===1?'Ты':'Broken Saint'}: «${BROKEN_SAINT_INTRO[i]}»`);
  tick(t,s.time.now+240);s.updateAshAltarChampionStory(s.time.now);
 }
 key(t);assert.equal(t.dialogue.active.closing,true);assert.equal(t.counts.wave,0);
 tick(t,t.dialogue.closeAt+1);s.updateAshAltarChampionStory(s.time.now);
 assert.equal(t.counts.wave,1);assert.equal(t.counts.music,1);assert.equal(s.wave,5);
 assert.equal(s.ashChampionIntroState,null);assert.equal(t.dialogue.active,null);
 assert.equal(t.champion.storyDormant,false);assert.equal(t.champion.body.enable,true);
 assert.equal(s.releaseAshChampionFight(),false,'Fight starts only once');
}
{
 const t=saintScene();const s=t.scene;const state=s.ashChampionIntroState;
 s.setGameplayPaused('menu',true);tick(t,state.dialogueAt);s.updateAshAltarChampionStory(s.time.now);
 assert.equal(state.dialogueStarted,false);assert.equal(t.counts.wave,0);
 s.setGameplayPaused('menu',false);s.updateAshAltarChampionStory(s.time.now);
 assert.ok(t.dialogue.active);t.director.cancelActiveEvent();
 assert.equal(state.dialogueStarted,false);assert.equal(t.counts.wave,0);
 tick(t,s.time.now+500);s.updateAshAltarChampionStory(s.time.now);
 assert.ok(t.dialogue.active,'Cancelled conversation retries instead of silently starting combat');
 t.champion.active=false;tick(t,s.time.now+30);s.updateAshAltarChampionStory(s.time.now);
 assert.equal(t.dialogue.active,null);assert.equal(s.ashChampionIntroState,null);
 assert.equal(t.counts.wave,0);assert.equal(t.counts.music,0);
}
console.log('Broken Saint intro regression PASSED: settled camera, vignette before smoke, approved nine lines, E-driven pacing, camera handoff, combat/music only after completion, retry and cancellation.');

// The reward screen must wait for the exact three-frame aftermath cinematic.
// This also guards the callback boundary: smoke may be gone, but rewards must
// not appear before the player follows the final lower-panel arrow.
{
 const t=makeScene();const s=t.scene;
 let launch=null;let rewards=0;let focus=null;
 s.brokenSaintDefeatSequenceActive=true;
 s.storyDirector={playCinematic(pages,options){launch={pages,options};return true;}};
 s.setHeroFocusInteraction=(id,active)=>{focus={id,active};};
 s.openChampionRewards=kind=>{rewards++;assert.equal(kind,'brokenSaint');};
 s.beginBrokenSaintAftermathCinematic=method('beginBrokenSaintAftermathCinematic');
 assert.equal(s.beginBrokenSaintAftermathCinematic(),true);
 assert.equal(launch.pages,BROKEN_SAINT_AFTERMATH_PAGES);
 assert.deepEqual(launch.options.releaseTextureKeys,BROKEN_SAINT_AFTERMATH_PAGE_KEYS);
 assert.equal(rewards,0,'Rewards wait for the cinematic completion callback');
 launch.options.onComplete();
 assert.equal(rewards,1);
 assert.deepEqual(focus,{id:'brokenSaintDefeat',active:false});
 assert.equal(s.brokenSaintDefeatSequenceActive,false);
}
console.log('Broken Saint aftermath regression PASSED: three framed pages gate rewards until cinematic completion.');

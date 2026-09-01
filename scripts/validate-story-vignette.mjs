import assert from 'node:assert/strict';
import {makeScene,object,tick} from './story-test-fixture.mjs';
import {ASH_WOUNDED_KNIGHT_STORY as story} from '../src/story/storyEvents.js';

for(let index=0;index<6;index++){
 const test=makeScene();const {scene,system,director,dialogue}=test;
 const entry=system.registerKnight(object(520,270),{id:index===3?story.characterId:`knight-${index}`,index,story:index===3});
 if(entry.story){director.activateObjective({id:story.objectiveId,targetId:story.characterId});system.activeStoryTargetId=story.characterId;}
 assert.equal(system.startInteraction(entry,1000),true);
 assert.equal(scene.time.paused,true);assert.equal(scene.tweens.paused,true);
 tick(test,1200);assert.equal(dialogue.dialogueVignetteState.vignette,null);
 tick(test,1340);tick(test,1450);
 const v=dialogue.dialogueVignetteState.vignette;
 assert.ok(v?.active && v.visible && v.alpha>0 && v.alpha<1,`Knight ${index}: fade-in while paused`);
 tick(test,1600);assert.equal(v.alpha,1);
 const pixels=test.canvas().pixels;
 assert.equal(pixels[3],133,'Same 52% edge opacity as skeletons');
 assert.ok(pixels.some((v,i)=>i%4===3 && v===0),'Transparent center');
 assert.equal(v.depth,219);
 // Reuse the skeleton renderer with the exact same view and target.
 const expected=Uint8ClampedArray.from(pixels);
 const reference=scene.createSettledStoryVignette({enemy:entry.sprite},scene.cameras.main,{fadeMs:0});
 assert.deepEqual(test.canvas().pixels,expected,'Knight and skeleton use identical gradient pixels');reference.destroy();
 scene.cameras.main.worldView={left:120,top:40,width:720,height:400};tick(test,1610);
 assert.deepEqual([v.x,v.y,v.displayWidth,v.displayHeight],[120,40,720,400]);
 dialogue.beginClose(1620);tick(test,1730);assert.ok(v.alpha>0 && v.alpha<1);
 tick(test,1850);assert.ok(v.alpha<0.001);
 tick(test,1950);assert.equal(v.active,false);assert.equal(system.active,null);
 assert.equal(scene.time.paused,false);assert.equal(scene.tweens.paused,false);
 assert.equal(director.hasCompleted(entry.eventId),true);
 if(entry.story)assert.equal(director.hasCompletedObjective(story.objectiveId),true);
}
{
 const t=makeScene();const entry=t.system.registerKnight(object(520,270),{id:'fast-close',index:0});
 t.system.startInteraction(entry,1000);t.dialogue.beginClose(1100);tick(t,1500);
 assert.equal(t.images.length,0,'Closing before camera settles must not create a late mask');
}
{
 const t=makeScene();const {scene}=t;const champion={...object(520,270),body:{setVelocity(){}}};
 scene.isAshAltarStoryGateActive=()=>true;
 scene.ashChampionIntroState={champion,target:champion,focusZoom:1.1,focusX:480,focusY:270,cameraSettledAt:1300,cameraLocked:false,smokeFadeAt:5000,vignetteFadeAt:6000,attackAt:6300};
 scene.updateAshAltarChampionStory(1200);assert.equal(t.images.length,0);
 scene.updateAshAltarChampionStory(1400);const v=scene.ashChampionIntroState.vignette;
 assert.ok(v.active && v.visible && v.alpha===1,'Broken Saint creates a visible mask');
 const expected=Uint8ClampedArray.from(t.canvas().pixels);
 scene.createSettledStoryVignette({enemy:champion},scene.cameras.main,{fadeMs:0}).destroy();
 assert.deepEqual(t.canvas().pixels,expected,'Broken Saint and skeleton use identical gradient pixels');
 scene.cameras.main.worldView={left:100,top:70,width:640,height:360};scene.updateAshAltarChampionStory(1500);
 assert.deepEqual([v.x,v.y,v.displayWidth,v.displayHeight],[100,70,640,360],'Broken Saint mask follows settled/resized camera');
 champion.active=false;scene.setHeroFocusInteraction=()=>{};scene.setupBackgroundMusic=()=>{};
 scene.updateAshAltarChampionStory(1600);assert.equal(v.active,false);assert.equal(scene.ashChampionIntroState,null);
}
console.log('Story vignette regression PASSED: six knights, paused-clock fades, skeleton pixel parity, resize, cleanup, early close, Broken Saint.');

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
 ASSET_MANIFEST,
 ASSET_CATEGORY,
 ASSET_REQUIREMENT,
 PROLOGUE_PAGE_KEYS
} from '../src/config/assetManifest.mjs';
import StoryDirector,{STORY_STATE} from '../src/story/StoryDirector.js';
import StoryEnemyAnomalySystem,{STORY_WAVE_ANOMALY_COUNTS} from '../src/story/StoryEnemyAnomalySystem.js';
import {PROLOGUE_STORY_PAGES,STORY_EVENTS,ASH_WOUNDED_KNIGHT_STORY} from '../src/story/storyEvents.js';

const root=process.cwd();
const errors=[];
const warnings=[];
const ok=[];
const assetKeys=new Map();

function fail(message){errors.push(message);}
function warn(message){warnings.push(message);}
function pass(message){ok.push(message);}
function publicFile(url){return path.join(root,'public',url.replace(/^\//,''));}
function requireFile(url,label=url,{required=true}={}){
 if(fs.existsSync(publicFile(url))) return true;
 if(required) fail(`Missing required asset: ${label} -> ${url}`);
 else warn(`Missing optional asset: ${label} -> ${url}`);
 return false;
}
function register(key,url,{required=true}={}){
 if(assetKeys.has(key)) fail(`Duplicate preload key: ${key} (${assetKeys.get(key)} and ${url})`);
 else assetKeys.set(key,url);
 requireFile(url,key,{required});
}
function pad2(n){return String(n).padStart(2,'0');}

// 1) JS syntax.
for(const file of ['src/main.js','src/combat/HeroMelee.js','src/config/gameplayConfig.mjs','src/config/worldConfig.mjs','src/world/NavigationSystem.js','src/audio/AudioManager.js','src/ui/cinematicTransitions.js','src/story/StoryDirector.js','src/story/StoryObjectiveMarker.js','src/story/WoundedKnightInteractionSystem.js','src/story/StoryEnemyAnomalySystem.js','src/story/storyEvents.js']){
 const result=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});
 if(result.status!==0) fail(`Syntax check failed: ${file}\n${result.stderr||result.stdout}`);
 else pass(`Syntax: ${file}`);
}

const mainPath=path.join(root,'src/main.js');
const main=fs.readFileSync(mainPath,'utf8');
const navigation=fs.readFileSync(path.join(root,'src/world/NavigationSystem.js'),'utf8');
const audio=fs.readFileSync(path.join(root,'src/audio/AudioManager.js'),'utf8');
const cinematicTransitions=fs.readFileSync(path.join(root,'src/ui/cinematicTransitions.js'),'utf8');
const gameplayConfig=fs.readFileSync(path.join(root,'src/config/gameplayConfig.mjs'),'utf8');
const worldConfig=fs.readFileSync(path.join(root,'src/config/worldConfig.mjs'),'utf8');
const storyDirectorSource=fs.readFileSync(path.join(root,'src/story/StoryDirector.js'),'utf8');
const objectiveMarkerSource=fs.readFileSync(path.join(root,'src/story/StoryObjectiveMarker.js'),'utf8');
const woundedInteractionSource=fs.readFileSync(path.join(root,'src/story/WoundedKnightInteractionSystem.js'),'utf8');
const storyEnemyAnomalySource=fs.readFileSync(path.join(root,'src/story/StoryEnemyAnomalySystem.js'),'utf8');
const storyEventsSource=fs.readFileSync(path.join(root,'src/story/storyEvents.js'),'utf8');

// 2) Removed legacy namespaces must not come back as runtime animation refs.
const forbidden=[
 {name:'legacy player animation',re:/\bplayer_(?:down|left|right|up)_(?:idle|walk|attack)(?:_\d{2})?\b/g},
 {name:'generic champion animation',re:/\bchampion_(?:down|left|right|up)_(?:idle|walk|attack)(?:_\d{2})?\b/g}
];
for(const {name,re} of forbidden){
 const matches=[...main.matchAll(re)].map(m=>m[0]);
 if(matches.length) fail(`Forbidden ${name} refs: ${[...new Set(matches)].join(', ')}`);
}
if(!errors.some(e=>e.startsWith('Forbidden '))) pass('No legacy player_* / generic champion_* animation refs');

// 3) Dead preload helpers should stay removed; AssetManifest + PreloadScene is the single source of truth.
for(const name of ['preloadAshFieldsEnvironmentArt','preloadGameplayArt','preloadAttackRing','preloadHitBurst']){
 if(main.includes(`${name}(`)) fail(`Dead preload helper still present: ${name}`);
}
if(!['preloadAshFieldsEnvironmentArt','preloadGameplayArt','preloadAttackRing','preloadHitBurst'].some(n=>main.includes(`${n}(`))) pass('Dead MainScene preload helpers removed');

// 4) AssetManifest is the preload source of truth. Validate categories,
// required/optional semantics, concrete files and duplicate keys.
register('lastknight_loading_art_desktop','/assets/ui/loading_key_art_4k.jpg',{required:true});
register('lastknight_loading_art_mobile','/assets/ui/loading_key_art_mobile.jpg',{required:true});

const categoryCounts=new Map();
let requiredCount=0;
let optionalCount=0;
for(const entry of ASSET_MANIFEST){
 const validCategories=new Set(Object.values(ASSET_CATEGORY));
 if(!validCategories.has(entry.category)) fail(`Unknown asset category: ${entry.category} (${entry.key})`);
 const validRequirements=new Set(Object.values(ASSET_REQUIREMENT));
 if(!validRequirements.has(entry.requirement)) fail(`Unknown asset requirement: ${entry.requirement} (${entry.key})`);
 if(!['image','audio','json'].includes(entry.type)) fail(`Unknown asset type: ${entry.type} (${entry.key})`);
 const required=entry.requirement===ASSET_REQUIREMENT.REQUIRED;
 register(entry.key,entry.url,{required});
 categoryCounts.set(entry.category,(categoryCounts.get(entry.category)||0)+1);
 if(required) requiredCount++; else optionalCount++;
}
for(const category of [ASSET_CATEGORY.CORE,ASSET_CATEGORY.PROLOGUE,ASSET_CATEGORY.REGION_ASH]){
 if(!(categoryCounts.get(category)>0)) fail(`Asset category is empty: ${category}`);
}
if(optionalCount===0) fail('AssetManifest has no optional assets; resilient preload contract is not exercised');
if(!errors.some(e=>e.startsWith('Missing required asset:')||e.startsWith('Duplicate preload key:'))) {
 pass(`AssetManifest: ${ASSET_MANIFEST.length} entries (${requiredCount} required, ${optionalCount} optional)`);
 pass(`Asset categories: ${[...categoryCounts.entries()].map(([k,v])=>`${k}=${v}`).join(', ')}`);
}

// One-shot texture lifecycle contracts.
if(PROLOGUE_PAGE_KEYS.length!==4) fail(`Expected 4 prologue page keys, got ${PROLOGUE_PAGE_KEYS.length}`);
for(const key of PROLOGUE_PAGE_KEYS){
 const spec=ASSET_MANIFEST.find(entry=>entry.key===key);
 if(!spec || spec.category!==ASSET_CATEGORY.PROLOGUE) fail(`Prologue page missing from PROLOGUE manifest: ${key}`);
}
if(!main.includes('releaseTextureKeys(this,[LOADING_ART_KEY]);')) fail('Loading key-art release contract missing');
if(!main.includes('releaseTextureKeys(this,PROLOGUE_PAGE_KEYS);')) fail('Prologue texture release contract missing');
if(!main.includes('spec?.requirement===ASSET_REQUIREMENT.OPTIONAL')) fail('Optional preload resilience contract missing');
else pass('Resilient preload + one-shot texture release contracts present');

// Shared animation dimensions used only for validator reconstruction.
const heroDirs=['n','ne','e','se','s','sw','w','nw'];
const dirs=['down','left','right','up'];
const brokenSaintSourceDirs={down:'down',down_left:'down_right',left:'right',up_left:'up_right',up:'up',up_right:'up_left',right:'left',down_right:'down_left'};

// 5) Animation frame keys must resolve to loaded texture keys.
const animationFrames=[];
function animKey(key){animationFrames.push(key);}
for(const dir of heroDirs){animKey(`hero_socket_walk_${dir}_01`);animKey(`hero_socket_walk_${dir}_02`);}
for(let i=1;i<=15;i++) animKey(`hero_socket_spin_${pad2(i)}`);
for(let i=1;i<=6;i++) animKey(`hero_death_${pad2(i)}`);
for(const dir of dirs){
 for(let i=0;i<4;i++) animKey(`skeleton_${dir}_idle_${pad2(i)}`);
 for(let i=0;i<6;i++){animKey(`skeleton_${dir}_walk_${pad2(i)}`);animKey(`skeleton_${dir}_attack_${pad2(i)}`);}
 for(let i=0;i<3;i++) animKey(`mage_${dir}_idle_${pad2(i)}`);
 for(let i=0;i<6;i++){animKey(`mage_${dir}_walk_${pad2(i)}`);animKey(`mage_${dir}_cast_${pad2(i)}`);}
 for(let i=0;i<4;i++) animKey(`shield_${dir}_idle_${pad2(i)}`);
 for(let i=0;i<6;i++){animKey(`shield_${dir}_walk_${pad2(i)}`);animKey(`shield_${dir}_attack_${pad2(i)}`);}
}
for(const dir of Object.keys(brokenSaintSourceDirs)){
 animKey(`broken_saint_${dir}_walk_00`); // idle uses walk_00
 for(let i=0;i<4;i++) animKey(`broken_saint_${dir}_walk_${pad2(i)}`);
 for(let i=0;i<3;i++) animKey(`broken_saint_${dir}_attack_${pad2(i)}`);
}
for(let i=0;i<8;i++) animKey(`ring_sweep_${pad2(i)}`);
for(let i=0;i<6;i++) animKey(`hit_burst_${pad2(i)}`);
for(let i=0;i<2;i++) animKey(`mage_projectile_${pad2(i)}`);
for(let knight=1;knight<=3;knight++){
 for(let frame=0;frame<3;frame++) animKey(`ash_wounded_knight_${pad2(knight)}_${pad2(frame)}`);
}
for(let i=0;i<4;i++){animKey(`broken_saint_holy_mark_${pad2(i)}`);animKey(`broken_saint_holy_impact_${pad2(i)}`);animKey(`broken_saint_reflect_shield_${pad2(i)}`);}
for(let i=0;i<3;i++) animKey(`broken_saint_holy_beam_${pad2(i)}`);
for(let i=0;i<2;i++) animKey(`broken_saint_reflect_spark_${pad2(i)}`);
const missingAnim=[...new Set(animationFrames.filter(k=>!assetKeys.has(k)))];
if(missingAnim.length) fail(`Animation frame keys without preload assets: ${missingAnim.join(', ')}`);
else pass(`Animation frame registry: ${new Set(animationFrames).size} keys OK`);

// 6) All project config JSON files must parse.
const configDir=path.join(root,'public/assets/config');
if(fs.existsSync(configDir)){
 for(const name of fs.readdirSync(configDir).filter(n=>n.endsWith('.json'))){
  try{JSON.parse(fs.readFileSync(path.join(configDir,name),'utf8'));}
  catch(e){fail(`Invalid JSON: public/assets/config/${name} (${e.message})`);}
 }
 pass('Config JSON parse check complete');
} else fail('Missing public/assets/config directory');

// 7) Champion definitions / visual coverage.
for(const kind of ['brokenSaint','necromancer','shieldWarden','hollowTree']){
 if(!main.includes(`${kind}:{name:`)) fail(`Champion definition missing: ${kind}`);
}
if(!main.includes("const initialTexture=isBrokenSaint ? 'broken_saint_down_walk_00' : 'skeleton_down_idle_00'")){
 fail('Champion visual fallback contract changed or missing');
} else pass('Champion visual definitions/fallbacks present');

// 8) World Physics v1 contracts.
for(const [label,needle] of [
 ['decorative/blocking classification',"getAshPropPhysicsClass(prop,kind='grass')"],
 ['enemy/world collider','this.enemyAshCollider=this.physics.add.collider(this.enemyGroup,this.ashLandmarkColliderGroup);'],
 ['obstacle steering','setEnemySteeredVelocity(enemy,vx,vy,time){'],
 ['safe enemy spawn','findSafeEnemySpawnPoint(x,y,{padding=26,minPlayerDistance=120,searchStep=30,maxRadius=360}={}){'],
 ['mage projectile obstacle collision','this.isAshPathBlocked(lastProjectileX,lastProjectileY,projectile.x,projectile.y,6)'],
 ['wounded knight blockers','this.createAshWoundedKnights(objects);']
]){
 if(!main.includes(needle)) fail(`Missing world-physics contract: ${label}`);
}
if(!errors.some(e=>e.startsWith('Missing world-physics contract:'))) pass('World Physics v1 contracts present');

// 9) World Navigation v2 contracts. Architecture Refactor v1 moves the
// global A*/grid implementation into src/world/NavigationSystem.js while the
// MainScene keeps thin compatibility delegates and local steering.
for(const [label,source,needle] of [
 ['56px NavigationGrid',main,'this.navigationCellSize=56;'],
 ['grid rebuild',navigation,'rebuildNavigationGrid(){'],
 ['A* pathfinding',navigation,'findNavigationPath(startX,startY,targetX,targetY,enemy=null,maxVisited=3200){'],
 ['waypoint routing',navigation,'getEnemyNavigationWaypoint(enemy,time,targetX,targetY,radius){'],
 ['local steering retained',main,'setEnemySteeredVelocity(enemy,vx,vy,time){'],
 ['soft enemy separation',navigation,'applyEnemySoftSeparation(time){'],
 ['stuck detector',navigation,'updateEnemyStuckState(enemy,time,intendedSpeed){'],
 ['navigation debug overlay',main,'this.overlayFlags.navigation'],
 ['nav-grid safe spawn',navigation,'findSafeNavSpawnPoint(x,y,{padding=26,minPlayerDistance=120,maxRadius=360}={}){']
]){
 if(!source.includes(needle)) fail(`Missing World Navigation v2 contract: ${label}`);
}
if(main.includes(`this.physics.add.collider(
   this.enemyGroup,
   this.enemyGroup,`)){
 fail('Hard enemy-enemy Arcade collider returned; World Navigation v2 requires soft separation');
}
if(!errors.some(e=>e.startsWith('Missing World Navigation v2 contract:')||e.startsWith('Hard enemy-enemy'))) pass('World Navigation v2 contracts present');

// 9b) Dialogue safety + runtime performance pass.
for(const [label,source,needle] of [
 ['dialogue actor avoidance',woundedInteractionSource,'dialogueOverlapArea(a,b){'],
 ['dialogue candidate layout',woundedInteractionSource,'const candidates=['],
 ['dialogue safe viewport',woundedInteractionSource,'const safe=scene.isTouchDevice'],
 ['dialogue zoom compensation',woundedInteractionSource,'const dialogueScale=1/Math.max(1,cam.zoom||1);'],
 ['dialogue camera context',woundedInteractionSource,'cam.zoom*1.18'],
 ['single A* route budget per frame',main,'this.navigationPathfindBudget=1;'],
 ['sleeping DEV overlays',main,'hasActiveOverlay(){'],
 ['DEV live-info throttle',main,'now-this.lastInfoAt<500'],
 ['lighter anomaly vignette canvas',main,'const width=192;'],
 ['balanced default render scale',main,'const LK_DEFAULT_RENDER_SCALE = 1.5;']
]){
 if(!source.includes(needle)) fail(`Missing dialogue/performance contract: ${label}`);
}
if(!errors.some(e=>e.startsWith('Missing dialogue/performance contract:'))) pass('Dialogue collision avoidance + performance contracts present');

// 10) Stability contracts added by Technical Stability v1.
for(const [label,source,needle] of [
 ['unified champion hazard cleanup',main,'clearChampionHazards(){'],
 ['Mage SFX limiter reset',main,'this.lastMageCastSfxAt=-9999;'],
 ['Broken Saint warning shutdown cleanup',main,'this.stopBrokenSaintHolyWarningSfx();'],
 ['BGM unlock handoff',audio,"this.sound.once('unlocked',startMusic);"]
]){
 if(!source.includes(needle)) fail(`Missing stability contract: ${label}`);
}

// 11) Architecture Refactor v1 contracts.
for(const [label,source,needle] of [
 ['gameplay config module',gameplayConfig,'export {'],
 ['world config module',worldConfig,'ASH_FIELDS_BAKED_LAYOUT'],
 ['navigation module',navigation,'class NavigationSystem'],
 ['audio module',audio,'class AudioManager'],
 ['cinematic transition module',cinematicTransitions,'cinematicSwapWithFade'],
 ['navigation delegate import',main,"import NavigationSystem from './world/NavigationSystem.js';"],
 ['audio delegate import',main,"import AudioManager from './audio/AudioManager.js';"]
]){
 if(!source.includes(needle)) fail(`Missing Architecture Refactor v1 contract: ${label}`);
}
if(main.includes('const STAGE0={')) fail('STAGE0 is still defined inline in main.js');
if(main.includes('const WORLD_DESIGN={')) fail('WORLD_DESIGN is still defined inline in main.js');
if(main.includes('const CINEMATIC_FADE={')) fail('Cinematic transition implementation is still inline in main.js');
if(!errors.some(e=>e.startsWith('Missing Architecture Refactor v1 contract:')||e.includes('still defined inline')||e.includes('still inline'))) pass('Architecture Refactor v1 module boundaries present');

// 12) StoryDirector v1 contracts and a tiny headless state-machine smoke test.
for(const [label,source,needle] of [
 ['StoryDirector module',storyDirectorSource,'class StoryDirector'],
 ['story state NORMAL',storyDirectorSource,"NORMAL:'NORMAL'"],
 ['story state DIALOGUE',storyDirectorSource,"DIALOGUE:'DIALOGUE'"],
 ['story state CINEMATIC',storyDirectorSource,"CINEMATIC:'CINEMATIC'"],
 ['declarative trigger evaluation',storyDirectorSource,'evaluateTrigger(trigger={},context=this.getContext())'],
 ['exact-wave trigger support',storyDirectorSource,'trigger.waveExact!==undefined'],
 ['wave-spawn pacing trigger support',storyDirectorSource,'trigger.spawnedMin!==undefined'],
 ['one-shot completion flags',storyDirectorSource,'completedEvents=new Set()'],
 ['generic cinematic launcher',storyDirectorSource,'playCinematic(pages,{eventId=null,once=true,releaseTextureKeys=[],onComplete=null}={})'],
 ['dialogue event bridge',storyDirectorSource,"this.scene?.events?.emit?.('story-dialogue-start'"],
 ['generic active objective state',storyDirectorSource,'activeObjective=null'],
 ['objective activation API',storyDirectorSource,'activateObjective(objective={})'],
 ['objective completion API',storyDirectorSource,'completeObjective(id=this.activeObjective?.id)'],
 ['declarative objective action',storyDirectorSource,"OBJECTIVE:'objective'"],
 ['MainScene StoryDirector import',main,"import StoryDirector from './story/StoryDirector.js';"],
 ['MainScene StoryDirector install',main,'this.storyDirector=new StoryDirector(this,{events:STORY_EVENTS}).install();'],
 ['MainScene StoryDirector update',main,'if(this.storyDirector?.update(time)){'],
 ['runtime cinematic mode',main,"this.cinematicMode=data?.mode==='story' ? 'story' : 'prologue';"],
 ['shared prologue story data',storyEventsSource,'const PROLOGUE_STORY_PAGES=Object.freeze([']
]){
 if(!source.includes(needle)) fail(`Missing StoryDirector v1 contract: ${label}`);
}
if(PROLOGUE_STORY_PAGES.length!==4) fail(`StoryDirector v1 expected 4 shared prologue pages, got ${PROLOGUE_STORY_PAGES.length}`);
if(!Array.isArray(STORY_EVENTS)) fail('STORY_EVENTS must be an array');
try{
 const emitted=[];
 let paused=false;
 const fakeScene={
  kills:3,wave:1,level:1,currentWorldZoneIndex:0,gameOver:false,levelChoiceOpen:false,championRewardOpen:false,
  player:{x:100,y:200},regionText:{text:'ASH FIELDS'},activeChampion:null,
  events:{emit:(...args)=>emitted.push(args)},
  setGameplayPaused:(reason,value)=>{if(reason==='story')paused=Boolean(value);},
  scene:{isActive:()=>false,stop:()=>{}},
  textures:{exists:()=>true}
 };
 const smoke=new StoryDirector(fakeScene,{events:[{
  id:'validator_story_event',once:true,trigger:{region:'ASH FIELDS',kills:2},
  action:{type:'callback',run:()=>{}}
 }]}).install();
 if(smoke.getState()!==STORY_STATE.NORMAL) throw new Error('initial state is not NORMAL');
 if(!smoke.update(1000)) throw new Error('eligible event did not trigger');
 if(!smoke.hasCompleted('validator_story_event')) throw new Error('one-shot event was not completed');
 if(smoke.getState()!==STORY_STATE.NORMAL) throw new Error('director did not return to NORMAL');
 if(paused) throw new Error('story pause remained active after callback event');
 if(smoke.update(1200)) throw new Error('one-shot event triggered twice');
 const objective={id:'validator_objective',targetId:'validator_target',kind:'talk'};
 if(!smoke.activateObjective(objective)) throw new Error('objective did not activate');
 if(!smoke.isObjectiveActive('validator_objective')) throw new Error('active objective was not reported');
 if(smoke.getActiveObjective()?.targetId!=='validator_target') throw new Error('objective target was not stored');
 if(!smoke.completeObjective('validator_objective')) throw new Error('objective did not complete');
 if(smoke.isObjectiveActive('validator_objective')) throw new Error('objective remained active after completion');
 if(!smoke.hasCompletedObjective('validator_objective')) throw new Error('objective completion was not recorded');
 smoke.destroy();
}catch(error){
 fail(`StoryDirector v1 state-machine smoke test failed: ${error.message}`);
}
if(!errors.some(e=>e.startsWith('Missing StoryDirector v1 contract:')||e.startsWith('StoryDirector v1'))) pass('StoryDirector v1 contracts + state-machine smoke test present');

// 13) Reusable story-objective marker + wounded-knight first story objective.
for(const [label,source,needle] of [
 ['objective marker module',objectiveMarkerSource,'class StoryObjectiveMarker'],
 ['strict 10 percent marker frame',objectiveMarkerSource,'const FRAME_INSET_RATIO=0.10;'],
 ['marker ray/rectangle intersection',objectiveMarkerSource,'rayRectIntersection(ox,oy,dx,dy,rect)'],
 ['marker direction from player to target',objectiveMarkerSource,'const dx=target.x-player.x;'],
 ['marker direction from player to target Y',objectiveMarkerSource,'const dy=target.y-player.y;'],
 ['interaction system module',woundedInteractionSource,'class WoundedKnightInteractionSystem'],
 ['interaction prompt',woundedInteractionSource,"Нажмите для взаимодействия"],
 ['dialogue wounded-knight speaker label',woundedInteractionSource,"'Раненый рыцарь'"],
 ['dialogue hero speaker label',woundedInteractionSource,"'Ты'"],
 ['story knight dialogue route hook',woundedInteractionSource,'Наш командир повёл уцелевших на север. К старой часовне у тракта.'],
 ['story knight dramatic final line',woundedInteractionSource,'Не спеши. Мне уже некуда идти.'],
 ['camera focus zoom',woundedInteractionSource,'cam.zoomTo(targetZoom,CAMERA_IN_MS'],
 ['generic marker client',woundedInteractionSource,"new StoryObjectiveMarker(scene,{insetRatio:0.10})"],
 ['story dialogue StoryDirector bridge',woundedInteractionSource,'this.storyDirector?.beginDialogue?.({'],
 ['story NPC locked until objective',woundedInteractionSource,'if(entry.story && !this.isStoryEntryUnlocked(entry))continue;'],
 ['story interaction hard lock',woundedInteractionSource,'if(entry.story && !this.isStoryEntryUnlocked(entry))return false;'],
 ['objective activation listener',woundedInteractionSource,"scene.events.on('story-objective-activated'"],
 ['objective completion from story dialogue',woundedInteractionSource,'this.storyDirector?.completeObjective?.(STORY_OBJECTIVE_ID);'],
 ['ambient wounded dialogue set',woundedInteractionSource,'const AMBIENT_DIALOGUES=Object.freeze(['],
 ['MainScene interaction install',main,'this.woundedKnightInteractions=new WoundedKnightInteractionSystem'],
 ['wounded knight registration',main,'this.woundedKnightInteractions?.registerKnight(knight,{'],
 ['interaction update before gameplay pause',main,'this.woundedKnightInteractions?.update(time);'],
 ['permanent mobile half-screen interaction gate',main,'isMobileInteractionPointerAllowed(pointer){'],
 ['mobile interaction emitted only through global gate',main,'this.mainScene?.emitMobileWorldInteraction?.(pointer);'],
 ['interaction client rejects left-half touch',woundedInteractionSource,'if(!this.scene?.isMobileInteractionPointerAllowed?.(pointer))return;'],
 ['existing-knight registration backfill',woundedInteractionSource,'this.registerExistingKnightsFromScene();'],
 ['first objective definition',storyEventsSource,'const ASH_WOUNDED_KNIGHT_STORY=Object.freeze({'],
 ['first objective exact wave 3 trigger',storyEventsSource,'waveExact:3'],
 ['first objective post-wave clear flag trigger',storyEventsSource,'flag:ASH_WOUNDED_KNIGHT_STORY.waveClearedFlag'],
 ['wave-3 clear flag definition',storyEventsSource,"waveClearedFlag:'ash_story_wave_3_cleared'"],
 ['wave-3 clear flag set after full clear',main,'this.storyDirector?.setFlag?.(ASH_WOUNDED_KNIGHT_STORY.waveClearedFlag,true);'],
 ['wave-4 story gate',main,'const woundedStoryGateActive=Boolean('],
 ['wave-4 gate waits for dialogue met flag',main,'!this.storyDirector?.getFlag?.(ASH_WOUNDED_KNIGHT_STORY.metFlag,false)'],
 ['first objective declarative action',storyEventsSource,"type:'objective'"]
]){
 if(!source.includes(needle)) fail(`Missing story-objective interaction contract: ${label}`);
}
const firstObjectiveEvent=STORY_EVENTS.find(event=>event?.action?.type==='objective');
if(!firstObjectiveEvent) fail('No declarative first story objective event found');
else{
 if(firstObjectiveEvent.trigger?.waveExact!==3) fail('First story objective must unlock during wave 3');
 if(firstObjectiveEvent.trigger?.flag!==ASH_WOUNDED_KNIGHT_STORY.waveClearedFlag) fail('First story objective must unlock from the wave-3-cleared story flag');
 if(firstObjectiveEvent.trigger?.spawnedMin!==undefined) fail('First story objective must not unlock mid-wave from spawnedMin');
 if(firstObjectiveEvent.trigger?.xMin!==undefined || firstObjectiveEvent.trigger?.kills!==undefined) fail('First story objective must not depend on old x/kills triggers');
 if(!firstObjectiveEvent.action?.objective?.targetId) fail('First story objective has no targetId');
}
if(main.includes('ash_campfire_01_')) fail('Rejected Ash Fields campfire is still referenced by runtime code');
if(ASSET_MANIFEST.some(entry=>String(entry.key).startsWith('ash_campfire_01_'))) fail('Rejected Ash Fields campfire is still present in AssetManifest');
if(!errors.some(e=>e.startsWith('Missing story-objective interaction contract:')||e.includes('First story objective')||e.includes('No declarative first story objective')||e.includes('Rejected Ash Fields campfire'))) pass('Reusable objective marker + post-wave-3 wounded-knight gate contracts present; rejected campfire removed');

// 14) Act-I wave pacing: subtle enemy hesitation from waves 2-5, then Broken Saint
// only after the ordinary fifth wave has been cleared.
for(const [label,source,needle] of [
 ['enemy anomaly module',storyEnemyAnomalySource,'class StoryEnemyAnomalySystem'],
 ['wave anomaly counts',storyEnemyAnomalySource,'const STORY_WAVE_ANOMALY_COUNTS=Object.freeze({2:1,3:2,4:1,5:2})'],
 ['distributed wave selection',storyEnemyAnomalySource,'this.selectedOrdinals.add(ordinal);'],
 ['hesitation phase',storyEnemyAnomalySource,"state.phase='hesitate';"],
 ['release beat before flee',storyEnemyAnomalySource,"state.phase='release';"],
 ['flee phase',storyEnemyAnomalySource,"state.phase='flee';"],
 ['five-second hesitation',storyEnemyAnomalySource,'const hesitateMs=5000;'],
 ['offscreen return scheduling',storyEnemyAnomalySource,'this.pendingReturns++;'],
 ['MainScene anomaly import',main,"import StoryEnemyAnomalySystem from './story/StoryEnemyAnomalySystem.js';"],
 ['MainScene anomaly install',main,'this.storyEnemyAnomalies=new StoryEnemyAnomalySystem(this).install();'],
 ['wave plan hook',main,'this.storyEnemyAnomalies?.beginWave(wave,this.waveTarget);'],
 ['spawn registration hook',main,'this.storyEnemyAnomalies?.registerEnemy(e,{'],
 ['AI anomaly override',main,'const storyAnomaly=!devFreezeAI'],
 ['five-second anomaly focus',main,'highlightStoryAnomaly(enemy,{durationMs=5000}={})'],
 ['anomaly cinematic gate',main,'isStoryAnomalyMomentActive(time=this.time?.now||0)'],
 ['soft anomaly vignette',main,"const STORY_ANOMALY_VIGNETTE_TEXTURE='story_anomaly_vignette_soft';"],
 ['edge-normalized anomaly vignette',main,'const maxEdgeAlpha=0.52;'],
 ['anomaly tighter clear center',main,'const clearCore=0.075;'],
 ['anomaly focus curve',main,'const vignetteFocusCurve=0.82;'],
 ['anomaly silhouette outline',main,'createStoryAnomalyOutline(enemy)'],
 ['anomaly outline frame sync',main,'syncStoryAnomalyOutline(state)'],
 ['anomaly ambiguous survival thought',main,"'Он выжил...'"],
 ['anomaly thought impossible',main,"'Этого не может быть...'"],
 ['anomaly thought still here',main,"'Он всё ещё здесь...'"],
 ['anomaly thought truth',main,"'Значит, это правда...'"],
 ['anomaly thought saw death',main,"'Я видел его смерть...'"],
 ['anomaly thought denial',main,"'Нет... не может быть.'"],
 ['anomaly thought should be dead',main,"'Он должен был погибнуть...'"],
 ['anomaly thought realization',main,"'Так вот что случилось...'"],
 ['anomaly thought too late',main,"'Слишком поздно...'"],
 ['expanded anomaly thought pool',main,"'Кто тогда погиб?..'"],
 ['anomaly recent-thought anti-repeat window',main,'const STORY_ANOMALY_RECENT_THOUGHT_LIMIT=4;'],
 ['anomaly thought random choice',main,'Math.floor(Math.random()*pool.length)'],
 ['hero skill lock during anomaly',main,'if(this.isStoryAnomalyMomentActive(this.time.now)) return;'],
 ['player anomaly hard freeze',main,'vx=0;'],
 ['enemy anomaly cinematic freeze',main,'const storyCinematicFrozen=Boolean(storyMomentActive && e!==focusedStoryEnemy);'],
 ['enemy anomaly separation override',main,'cinematic freeze is physically absolute for every non-focused enemy'],
 ['mage projectile anomaly freeze',main,'const storyProjectileFreeze=this.isStoryAnomalyMomentActive(time);'],
 ['mage projectile anomaly damage firewall',main,"if(source==='mageProjectile' && this.isStoryAnomalyMomentActive(now)) return false;"],
 ['mage projectile motion restore',main,'projectile.storyAnomalyFreezeVX||0'],
 ['universal hero focus stance API',main,'setHeroFocusInteraction(reason,active=true)'],
 ['hero focus stance active gate',main,'isHeroFocusInteractionActive()'],
 ['hero focus stance frame updater',main,'updateHeroFocusInteractionStance(frameTime=0)'],
 ['hero focus stance south frame one',main,"hero_socket_walk_s_${String(frameIndex).padStart(2,'0')}"],
 ['hero focus stance weapon sync',main,'this.updateHeroWeaponAttachment();'],
 ['post-wave Broken Saint state',main,'this.postWaveChampionKind=isPostWaveBrokenSaint?championKind:null;'],
 ['post-wave Broken Saint spawn',main,'if(this.postWaveChampionKind){']
]){
 if(!source.includes(needle)) fail(`Missing Act-I wave pacing contract: ${label}`);
}
if(!gameplayConfig.includes('MAGE_PROJECTILE_DAMAGE:8')) fail('Mage projectile base damage must match ordinary skeleton base damage (8)');
try{
 const fakeScene={time:{now:1000}};
 const anomaly=new StoryEnemyAnomalySystem(fakeScene).install();
 for(const wave of [2,3,4,5]){
  anomaly.beginWave(wave,20);
  const expected=STORY_WAVE_ANOMALY_COUNTS[wave];
  if(anomaly.selectedOrdinals.size!==expected) throw new Error(`wave ${wave} planned ${anomaly.selectedOrdinals.size}, expected ${expected}`);
 }
 anomaly.beginWave(1,20);
 if(anomaly.selectedOrdinals.size!==0) throw new Error('wave 1 must have no story anomalies');
 anomaly.destroy();
}catch(error){
 fail(`Act-I enemy anomaly smoke test failed: ${error.message}`);
}
if(!main.includes("const postWaveBrokenSaint=wave===5 && championKind==='brokenSaint';")) fail('Broken Saint wave 5 must use a full ordinary-wave population target');
if(!main.includes("const isPostWaveBrokenSaint=wave===5 && championKind==='brokenSaint';")) fail('Broken Saint must be deferred until after wave 5');
if(!errors.some(e=>e.startsWith('Missing Act-I wave pacing contract:')||e.startsWith('Act-I enemy anomaly')||e.includes('Broken Saint'))) pass('Act-I waves 2-5 anomaly pacing + post-wave Broken Saint contracts present');

console.log('\nLAST KNIGHT project validation');
console.log('==============================');
for(const line of ok) console.log(`✓ ${line}`);
for(const line of warnings) console.log(`! ${line}`);
if(errors.length){
 console.error('\nValidation FAILED');
 for(const line of errors) console.error(`✗ ${line}`);
 process.exit(1);
}
console.log(`\nValidation PASSED (${assetKeys.size} preload keys checked)`);

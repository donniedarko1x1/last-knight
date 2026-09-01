import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
 ASSET_MANIFEST,
 ASSET_CATEGORY,
 ASSET_REQUIREMENT,
 PROLOGUE_PAGE_KEYS,
 BROKEN_SAINT_AFTERMATH_PAGE_KEYS,
 ASH_SWORD_PULSE_FRAME_KEYS
} from '../src/config/assetManifest.mjs';
import StoryDirector,{STORY_STATE} from '../src/story/StoryDirector.js';
import StoryEnemyAnomalySystem from '../src/story/StoryEnemyAnomalySystem.js';
import {PROLOGUE_STORY_PAGES,STORY_ANOMALY_DEFINITIONS,STORY_EVENTS,ASH_WOUNDED_KNIGHT_STORY,ASH_ALTAR_CHAMPION_STORY} from '../src/story/storyEvents.js';

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
const syntaxFiles=['src/main.js','src/combat/HeroMelee.js','src/config/gameplayConfig.mjs','src/config/worldConfig.mjs','src/world/NavigationSystem.js','src/audio/AudioManager.js','src/ui/cinematicTransitions.js','src/story/StoryDirector.js','src/story/StoryObjectiveMarker.js','src/story/WoundedKnightInteractionSystem.js','src/story/WorldDialogueSystem.js','src/story/ChampionDialogueSystem.js','src/story/StoryEnemyAnomalySystem.js','src/story/BrokenSaintCinematics.js','src/story/storyEvents.js'];
for(const file of syntaxFiles){
 const source=fs.readFileSync(path.join(root,file),'utf8');
 if(/^(?:<<<<<<<|=======|>>>>>>>)/m.test(source)) fail(`Unresolved Git conflict marker: ${file}`);
 const result=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});
 if(result.status!==0) fail(`Syntax check failed: ${file}\n${result.stderr||result.stdout}`);
 else pass(`Syntax: ${file}`);
}
if(!errors.some(e=>e.startsWith('Unresolved Git conflict marker:'))) pass('No unresolved Git conflict markers in runtime source');

const mainPath=path.join(root,'src/main.js');
const main=fs.readFileSync(mainPath,'utf8');
const heroMeleeSource=fs.readFileSync(path.join(root,'src/combat/HeroMelee.js'),'utf8');
const navigation=fs.readFileSync(path.join(root,'src/world/NavigationSystem.js'),'utf8');
const audio=fs.readFileSync(path.join(root,'src/audio/AudioManager.js'),'utf8');
const cinematicTransitions=fs.readFileSync(path.join(root,'src/ui/cinematicTransitions.js'),'utf8');
const gameplayConfig=fs.readFileSync(path.join(root,'src/config/gameplayConfig.mjs'),'utf8');
const worldConfig=fs.readFileSync(path.join(root,'src/config/worldConfig.mjs'),'utf8');
const storyDirectorSource=fs.readFileSync(path.join(root,'src/story/StoryDirector.js'),'utf8');
const objectiveMarkerSource=fs.readFileSync(path.join(root,'src/story/StoryObjectiveMarker.js'),'utf8');
const woundedInteractionSource=fs.readFileSync(path.join(root,'src/story/WoundedKnightInteractionSystem.js'),'utf8');
const worldDialogueSource=fs.readFileSync(path.join(root,'src/story/WorldDialogueSystem.js'),'utf8');
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
if(PROLOGUE_PAGE_KEYS.length!==3) fail(`Expected 3 prologue page keys, got ${PROLOGUE_PAGE_KEYS.length}`);
for(const key of PROLOGUE_PAGE_KEYS){
 const spec=ASSET_MANIFEST.find(entry=>entry.key===key);
 if(!spec || spec.category!==ASSET_CATEGORY.PROLOGUE) fail(`Prologue page missing from PROLOGUE manifest: ${key}`);
}
if(BROKEN_SAINT_AFTERMATH_PAGE_KEYS.length!==3) fail(`Expected 3 Broken Saint aftermath page keys, got ${BROKEN_SAINT_AFTERMATH_PAGE_KEYS.length}`);
for(const key of BROKEN_SAINT_AFTERMATH_PAGE_KEYS){
 const spec=ASSET_MANIFEST.find(entry=>entry.key===key);
 if(!spec || spec.category!==ASSET_CATEGORY.REGION_ASH) fail(`Broken Saint aftermath page missing from REGION_ASH manifest: ${key}`);
}
if(ASH_SWORD_PULSE_FRAME_KEYS.length!==3) fail(`Expected 3 Ash sword pulse frame keys, got ${ASH_SWORD_PULSE_FRAME_KEYS.length}`);
for(const key of ASH_SWORD_PULSE_FRAME_KEYS){
 const spec=ASSET_MANIFEST.find(entry=>entry.key===key);
 if(!spec || spec.category!==ASSET_CATEGORY.REGION_ASH) fail(`Ash sword pulse frame missing from REGION_ASH manifest: ${key}`);
}
if(!main.includes('releaseTextureKeys(this,[LOADING_ART_KEY]);')) fail('Loading key-art release contract missing');
if(!main.includes('releaseTextureKeys(this,PROLOGUE_PAGE_KEYS);')) fail('Prologue texture release contract missing');
if(!main.includes('releaseTextureKeys:BROKEN_SAINT_AFTERMATH_PAGE_KEYS')) fail('Broken Saint aftermath texture release contract missing');
if(!main.includes('spec?.requirement===ASSET_REQUIREMENT.OPTIONAL')) fail('Optional preload resilience contract missing');
else pass('Resilient preload + one-shot texture release contracts present');

for(const [label,source,needle] of [
 ['Ash sword pulse plus 1.5-second rest',main,'const ASH_SWORD_PULSE_CYCLE_MS=ASH_SWORD_PULSE_ACTIVE_MS+1500;'],
 ['Ash sword pulse animation',main,"key:ASH_SWORD_PULSE_ANIM_KEY,"],
 ['Ash sword 1-2-3-2-1 frame order',main,"{key:'ash_sword_pulse_03_cutout'},\n     {key:'ash_sword_pulse_02_cutout'},\n     {key:'ash_sword_pulse_01_cutout'}"],
 ['Ash sword Wave 2 intermission delay',main,'this.ashSwordPreludeQueuedAt=time+1000;'],
 ['Ash sword three locked pulses',main,'const ASH_SWORD_PRELUDE_LOCKED_PULSES=3;'],
 ['Ash sword starts Wave 3 after return',main,'this.startWave(3);'],
 ['Ash sword pulse ends in Zone 2',main,'if(nextIndex>0) this.stopAshSwordAmbientAnimation();']
]){
 if(!source.includes(needle)) fail(`Missing Ash sword cinematic contract: ${label}`);
}
if(!errors.some(e=>e.startsWith('Missing Ash sword cinematic contract:'))) pass('Ash sword cinematic contracts present');

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
 ['enemy/world collider','this.enemyAshCollider=this.physics.add.collider(this.enemyGroup,this.ashLandmarkColliderGroup,null,this.shouldEnemyCollideWithAshLandmark,this);'],
 ['selective Broken Saint altar collision','shouldEnemyCollideWithAshLandmark(objectA,objectB){'],
 ['obstacle steering','setEnemySteeredVelocity(enemy,vx,vy,time){'],
 ['safe enemy spawn','findSafeEnemySpawnPoint(x,y,{padding=26,minPlayerDistance=120,searchStep=30,maxRadius=360}={}){'],
 ['mage projectile obstacle collision','this.isAshPathBlocked(lastProjectileX,lastProjectileY,projectile.x,projectile.y,6)'],
 ['wounded knight blockers','this.createAshWoundedKnights(objects);']
]){
 if(!main.includes(needle)) fail(`Missing world-physics contract: ${label}`);
}
if(!errors.some(e=>e.startsWith('Missing world-physics contract:'))) pass('World Physics v1 contracts present');

// 8b) Broken Saint altar encounter v2 contracts.
for(const [label,needle] of [
 ['figure-sized champion smoke','const outerW=Math.min(238,figureW*1.48);'],
 ['one-second post-materialize hold','const ASH_CHAMPION_POST_REVEAL_HOLD_MS=1000;'],
 ['vignette completes before smoke','const materializeAt=cameraSettledAt+ASH_CHAMPION_VIGNETTE_FADE_MS;'],
 ['smoke clears before combat','smokeFadeAt:materializeCompleteAt-220'],
 ['escort clear detector','isBrokenSaintEscortWaveCleared(){'],
 ['altar release phase','releaseBrokenSaintFromAltar(){'],
 ['Broken Saint altar-only filter',"startsWith('ash_landmark_altar_')"],
 ['released champion bypasses altar navigation',"const bypassAltarNavigation=Boolean(enemy?.type==='champion' && enemy.championKind==='brokenSaint' && enemy.ignoreAshAltarCollision);"]
]){
 if(!main.includes(needle)) fail(`Missing Broken Saint altar phase contract: ${label}`);
}
if(!errors.some(e=>e.startsWith('Missing Broken Saint altar phase contract:'))) pass('Broken Saint local smoke + 1s reveal hold + altar release phase contracts present');

// 8c) Broken Saint reward / build-strategy v1 contracts.
const assetManifestSource=fs.readFileSync(path.join(root,'src/config/assetManifest.mjs'),'utf8');
for(const [label,source,needle] of [
 ['Lift commitment slowdown',main,'const BROKEN_SAINT_LIFT_SLOW_FACTOR=0.55;'],
 ['Lift post-landing slow',main,'const BROKEN_SAINT_LIFT_POST_SLOW_MS=3000;'],
 ['Lift slowdown only after a real launch',main,'if(longestLiftMs>0){\n   const landingAt=castAt+longestLiftMs;'],
 ['Lift slow uses separate timer',main,'if(time<(this.liftSlowUntil||0)) s*=BROKEN_SAINT_LIFT_SLOW_FACTOR;'],
 ['Spin remains stationary',main,'if(time<(this.spinCommitUntil||0) && time>=(this.playerForcedUntil||0)){'],
 ['Pilgrim Path evolution',main,'BROKEN_SAINT_EVOLUTION_IDS.pilgrimPath'],
 ['Verdict evolution',main,'BROKEN_SAINT_EVOLUTION_IDS.verdict'],
 ['Saint Stance evolution',main,'BROKEN_SAINT_EVOLUTION_IDS.saintStance'],
 ['three-step Broken Saint reward flow',main,"stepTitle:'СИЛА ЧЕМПИОНА'"],
 ['Cracked Halo relic',main,"name:'ТРЕСНУВШИЙ НИМБ'"],
 ['Saints Nail post-Lift mark window',main,'BROKEN_SAINT_LIFT_POST_MARK_WINDOW_MS=3600'],
 ['Ash Rosary cross-skill mana discount',main,'return 0.75;'],
 ['reverse-smoke champion death',main,'beginBrokenSaintDefeatSequence(enemy){'],
 ['post-death cinematic starts after smoke',main,'this.beginBrokenSaintAftermathCinematic();'],
 ['post-death cinematic completion opens rewards',main,"eventId:'ash_broken_saint_aftermath_cinematic'"],
 ['cinematic image mask clips illustration',main,'this.cinematicImageMaskShape=this.make.graphics({x:0,y:0,add:false});'],
 ['cinematic image pan stays inside top frame',main,"const shouldPanLeft=page?.pan==='left';"],
 ['reward UI base-skill icons',main,'entry.icon.setTexture(c.iconKey);'],
 ['larger reward decision panel',main,'const panelW=Math.min(compact?720:900'],
 ['larger reward description type',main,'.setFontSize(veryCompact?10:(compact?11.5:13.5))'],
 ['Broken Saint essence icon map',main,'const BROKEN_SAINT_ESSENCE_ICON_KEYS=Object.freeze({'],
 ['Essence of Body icon key',main,"iconKey:BROKEN_SAINT_ESSENCE_ICON_KEYS[BROKEN_SAINT_ESSENCE_IDS.body]"],
 ['Essence of Will icon key',main,"iconKey:BROKEN_SAINT_ESSENCE_ICON_KEYS[BROKEN_SAINT_ESSENCE_IDS.will]"],
 ['Essence of Discipline icon key',main,"iconKey:BROKEN_SAINT_ESSENCE_ICON_KEYS[BROKEN_SAINT_ESSENCE_IDS.discipline]"],
 ['Cracked Halo asset manifest',assetManifestSource,'broken_saint_relic_cracked_halo'],
 ['Saints Nail asset manifest',assetManifestSource,'broken_saint_relic_saints_nail'],
 ['Ash Rosary asset manifest',assetManifestSource,'broken_saint_relic_ash_rosary'],
 ['Essence Body asset manifest',assetManifestSource,'broken_saint_essence_body'],
 ['Essence Will asset manifest',assetManifestSource,'broken_saint_essence_will'],
 ['Essence Discipline asset manifest',assetManifestSource,'broken_saint_essence_discipline']
]){
 if(!source.includes(needle)) fail(`Missing Broken Saint reward contract: ${label}`);
}
if(!errors.some(e=>e.startsWith('Missing Broken Saint reward contract:'))) pass('Broken Saint build rewards + reverse-smoke death + mobile reward UI contracts present');

// 8c) Broken Saint reward / build-strategy v1 contracts.
for(const [label,source,needle] of [
 ['Lift commitment slowdown',main,'const BROKEN_SAINT_LIFT_SLOW_FACTOR=0.55;'],
 ['Lift post-landing slow',main,'const BROKEN_SAINT_LIFT_POST_SLOW_MS=3000;'],
 ['Lift slowdown only after a real launch',main,'if(longestLiftMs>0){\n   const landingAt=castAt+longestLiftMs;'],
 ['Lift slow uses separate timer',main,'if(time<(this.liftSlowUntil||0)) s*=BROKEN_SAINT_LIFT_SLOW_FACTOR;'],
 ['Spin remains stationary',main,'if(time<(this.spinCommitUntil||0) && time>=(this.playerForcedUntil||0)){'],
 ['Pilgrim Path evolution',main,'BROKEN_SAINT_EVOLUTION_IDS.pilgrimPath'],
 ['Verdict evolution',main,'BROKEN_SAINT_EVOLUTION_IDS.verdict'],
 ['Saint Stance evolution',main,'BROKEN_SAINT_EVOLUTION_IDS.saintStance'],
 ['three-step Broken Saint reward flow',main,"stepTitle:'СИЛА ЧЕМПИОНА'"],
 ['Cracked Halo relic',main,"name:'ТРЕСНУВШИЙ НИМБ'"],
 ['Saints Nail post-Lift mark window',main,'BROKEN_SAINT_LIFT_POST_MARK_WINDOW_MS=3600'],
 ['Ash Rosary cross-skill mana discount',main,'return 0.75;'],
 ['reverse-smoke champion death',main,'beginBrokenSaintDefeatSequence(enemy){'],
 ['reward UI base-skill icons',main,'entry.icon.setTexture(c.iconKey);'],
 ['larger reward decision panel',main,'const panelW=Math.min(compact?720:900'],
 ['larger reward description type',main,'.setFontSize(veryCompact?10:(compact?11.5:13.5))'],
 ['Broken Saint essence icon map',main,'const BROKEN_SAINT_ESSENCE_ICON_KEYS=Object.freeze({'],
 ['Essence of Body icon key',main,"iconKey:BROKEN_SAINT_ESSENCE_ICON_KEYS[BROKEN_SAINT_ESSENCE_IDS.body]"],
 ['Essence of Will icon key',main,"iconKey:BROKEN_SAINT_ESSENCE_ICON_KEYS[BROKEN_SAINT_ESSENCE_IDS.will]"],
 ['Essence of Discipline icon key',main,"iconKey:BROKEN_SAINT_ESSENCE_ICON_KEYS[BROKEN_SAINT_ESSENCE_IDS.discipline]"],
 ['Cracked Halo asset manifest',assetManifestSource,'broken_saint_relic_cracked_halo'],
 ['Saints Nail asset manifest',assetManifestSource,'broken_saint_relic_saints_nail'],
 ['Ash Rosary asset manifest',assetManifestSource,'broken_saint_relic_ash_rosary'],
 ['Essence Body asset manifest',assetManifestSource,'broken_saint_essence_body'],
 ['Essence Will asset manifest',assetManifestSource,'broken_saint_essence_will'],
 ['Essence Discipline asset manifest',assetManifestSource,'broken_saint_essence_discipline']
]){
 if(!source.includes(needle)) fail(`Missing Broken Saint reward contract: ${label}`);
}
if(!errors.some(e=>e.startsWith('Missing Broken Saint reward contract:'))) pass('Broken Saint build rewards + reverse-smoke death + mobile reward UI contracts present');

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

// 9a2) Story marker + settled-camera vignette contracts.
for(const [label,source,needle] of [
 ['stable Ash altar marker proxy',main,'getAshStoryMarkerTarget(key=ASH_ALTAR_CHAMPION_STORY.landmarkKey){'],
 ['Ash altar marker uses stable target',main,'this.ashAltarObjectiveMarker?.setTarget(markerTarget,{worldOffsetY:118});'],
 ['Ash altar marker point comes from story data',main,'const point=ASH_ALTAR_CHAMPION_STORY.markerPoint;'],
 ['Ash altar objective carries marker point',main,'markerPoint:ASH_ALTAR_CHAMPION_STORY.markerPoint'],
 ['story marker ignores sprite visibility',objectiveMarkerSource,'Logical target point exists independently of sprite streaming/visibility.'],
 ['edge marker frame uses camera world view',objectiveMarkerSource,'const frame=this.getFrame(view);'],
 ['wounded dialogue gets settled vignette without paused tweens',worldDialogueSource,'this.scene.createSettledStoryVignette?.(state,cam,{fadeMs:0});'],
 ['settled-camera vignette factory',main,'createSettledStoryVignette(state,cam=this.cameras?.main,{fadeMs=280}={}){'],
 ['shared vignette waits for camera lock',worldDialogueSource,'if(state && !this.active.closing && time>=state.cameraSettledAt)'],
 ['champion vignette waits for camera lock',main,'this.createSettledStoryVignette(state,cam,{fadeMs:300});']
]){
 if(!source.includes(needle)) fail(`Missing story marker/vignette contract: ${label}`);
}
if(!errors.some(e=>e.startsWith('Missing story marker/vignette contract:'))) pass('Stable altar marker + settled-camera vignette contracts present');

// 9b) Dialogue safety + runtime performance pass.
for(const [label,source,needle] of [
 ['dialogue actor avoidance',worldDialogueSource,'dialogueOverlapArea(a,b){'],
 ['dialogue candidate layout',worldDialogueSource,'const candidates=['],
 ['dialogue safe viewport',worldDialogueSource,'const safe=scene.isTouchDevice'],
 ['dialogue HUD geometry',main,'getDialogueAvoidBounds(){'],
 ['dialogue follows current camera and HUD',worldDialogueSource,"scene.events.on('prerender',this._onPreRender);"],
 ['dialogue CSS/backing compensation',worldDialogueSource,'const dialogueScale=worldUiScale(scene);'],
 ['dialogue camera context',worldDialogueSource,'cam.zoom*1.18'],
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
 ['objective logical marker point normalization',storyDirectorSource,'normalized.markerPoint={x:markerX,y:markerY};'],
 ['objective completion API',storyDirectorSource,'completeObjective(id=this.activeObjective?.id)'],
 ['declarative objective action',storyDirectorSource,"OBJECTIVE:'objective'"],
 ['MainScene StoryDirector import',main,"import StoryDirector from './story/StoryDirector.js';"],
 ['MainScene StoryDirector install',main,'this.storyDirector=new StoryDirector(this,{events:STORY_EVENTS}).install();'],
 ['MainScene StoryDirector update',main,'const storyBusy=Boolean(this.storyDirector?.update(time));'],
 ['runtime cinematic mode',main,"this.cinematicMode=data?.mode==='story' ? 'story' : 'prologue';"],
 ['shared prologue story data',storyEventsSource,'const PROLOGUE_STORY_PAGES=Object.freeze([']
]){
 if(!source.includes(needle)) fail(`Missing StoryDirector v1 contract: ${label}`);
}
if(PROLOGUE_STORY_PAGES.length!==3) fail(`StoryDirector v1 expected 3 shared prologue pages, got ${PROLOGUE_STORY_PAGES.length}`);
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
 const objective={id:'validator_objective',targetId:'validator_target',kind:'talk',markerPoint:{x:123,y:456}};
 if(!smoke.activateObjective(objective)) throw new Error('objective did not activate');
 if(!smoke.isObjectiveActive('validator_objective')) throw new Error('active objective was not reported');
 if(smoke.getActiveObjective()?.targetId!=='validator_target') throw new Error('objective target was not stored');
 if(smoke.getActiveObjective()?.markerPoint?.x!==123 || smoke.getActiveObjective()?.markerPoint?.y!==456) throw new Error('objective markerPoint was not stored');
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
 ['marker direction from player to target',objectiveMarkerSource,'const dx=targetX-player.x;'],
 ['marker direction from player to target Y',objectiveMarkerSource,'const dy=targetY-player.y;'],
 ['marker logical target cache',objectiveMarkerSource,'this.lastTargetPoint={x,y};'],
 ['marker ignores render visibility',objectiveMarkerSource,'Logical target point exists independently of sprite streaming/visibility.'],
 ['marker edge ray is fully world-space',objectiveMarkerSource,'const ox=Phaser.Math.Clamp(player.x,frame.left+0.001,frame.right-0.001);'],
 ['wounded objective logical marker anchor',woundedInteractionSource,'resolveStoryMarkerAnchor(targetId=STORY_KNIGHT_ID,objective=null){'],
 ['wounded marker never requires streamed knight',woundedInteractionSource,'Never consult this.knights / sprite.active / sprite.visible here.'],
 ['wounded objective marker point in story data',storyEventsSource,'markerPoint:Object.freeze({x:2700,y:800})'],
 ['altar objective marker point in story data',storyEventsSource,'markerPoint:Object.freeze({x:3030,y:470})'],
 ['wounded knight dialogue vignette',woundedInteractionSource,"kind:'woundedKnight'"],
 ['interaction system module',woundedInteractionSource,'class WoundedKnightInteractionSystem'],
 ['desktop interaction prompt',woundedInteractionSource,"Нажмите E для взаимодействия"],
 ['dialogue wounded-knight speaker label',woundedInteractionSource,"'Раненый рыцарь'"],
 ['dialogue hero speaker label',worldDialogueSource,"'Ты'"],
 ['story knight dialogue route hook',woundedInteractionSource,'Наш командир повёл уцелевших на север. К старой часовне у тракта.'],
 ['story knight dramatic final line',woundedInteractionSource,'Не спеши. Мне уже некуда идти.'],
 ['camera focus zoom',worldDialogueSource,'cam.zoomTo(targetZoom,CAMERA_IN_MS'],
 ['generic marker client',woundedInteractionSource,"new StoryObjectiveMarker(scene,{insetRatio:0.10})"],
 ['shared dialogue StoryDirector bridge',worldDialogueSource,'this.storyDirector?.beginDialogue?.({'],
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
 const markerPoint=firstObjectiveEvent.action?.objective?.markerPoint;
 if(!Number.isFinite(Number(markerPoint?.x)) || !Number.isFinite(Number(markerPoint?.y))) fail('First story objective has no logical markerPoint');
}
if(main.includes('ash_campfire_01_')) fail('Rejected Ash Fields campfire is still referenced by runtime code');
if(ASSET_MANIFEST.some(entry=>String(entry.key).startsWith('ash_campfire_01_'))) fail('Rejected Ash Fields campfire is still present in AssetManifest');
if(!errors.some(e=>e.startsWith('Missing story-objective interaction contract:')||e.includes('First story objective')||e.includes('No declarative first story objective')||e.includes('Rejected Ash Fields campfire'))) pass('Reusable objective marker + post-wave-3 wounded-knight gate contracts present; rejected campfire removed');
if(woundedInteractionSource.includes('Любая клавиша — продолжить')) fail('Desktop dialogue continue plaque must be removed');
else pass('Desktop E interaction prompt present; continue plaque removed');

// 14) Act-I story anomalies are now data-driven. Ash Fields uses one scripted
// beat in wave 2 and two beats in wave 3; later waves stay clear so the wounded
// knight / altar / Broken Saint beats own the pacing.
for(const [label,source,needle] of [
 ['enemy anomaly module',storyEnemyAnomalySource,'class StoryEnemyAnomalySystem'],
 ['data definition lookup',storyEnemyAnomalySource,'getDefinitionsForWave(wave)'],
 ['data trigger ordinal map',storyEnemyAnomalySource,'this.selectedOrdinals.set(ordinal,definition);'],
 ['definition attached to enemy',storyEnemyAnomalySource,'definition,'],
 ['interactive dialogue phase',storyEnemyAnomalySource,"state.phase='dialogue';"],
 ['release beat before flee',storyEnemyAnomalySource,"state.phase='release';"],
 ['flee phase',storyEnemyAnomalySource,"state.phase='flee';"],
 ['escaped anomaly is permanently defeated',storyEnemyAnomalySource,'vanishAsDefeated(enemy,state){'],
 ['escaped anomaly schedules no replacement',storyEnemyAnomalySource,'hasPendingReturns(){return false;}'],
 ['MainScene anomaly import',main,"import StoryEnemyAnomalySystem from './story/StoryEnemyAnomalySystem.js';"],
 ['MainScene anomaly data import',main,'STORY_ANOMALY_DEFINITIONS'],
 ['MainScene anomaly install',main,'new StoryEnemyAnomalySystem(this,{definitions:STORY_ANOMALY_DEFINITIONS}).install();'],
 ['wave plan hook',main,'this.storyEnemyAnomalies?.beginWave(wave,this.waveTarget);'],
 ['spawn registration hook',main,'this.storyEnemyAnomalies?.registerEnemy(e,{'],
 ['AI anomaly override',main,'const storyAnomaly=!devFreezeAI'],
 ['data-aware anomaly focus',main,'highlightStoryAnomaly(enemy,{cue=null}={})'],
 ['enemy scripted line',main,'getStoryAnomalyEnemyLine(enemy)'],
 ['hero scripted response',main,'getStoryAnomalyHeroLine(enemy)'],
 ['anomaly cinematic gate',main,'isStoryAnomalyMomentActive(time=this.time?.now||0)'],
 ['soft anomaly vignette',main,"const STORY_ANOMALY_VIGNETTE_TEXTURE='story_anomaly_vignette_soft';"],
 ['edge-normalized anomaly vignette',main,'const maxEdgeAlpha=0.52;'],
 ['anomaly tighter clear center',main,'const clearCore=0.075;'],
 ['anomaly focus curve',main,'const vignetteFocusCurve=0.82;'],
 ['anomaly silhouette outline',main,'createStoryAnomalyOutline(enemy)'],
 ['anomaly outline frame sync',main,'syncStoryAnomalyOutline(state)'],
 ['hero skill lock during anomaly',main,'if(this.isStoryAnomalyMomentActive(this.time.now) || this.isAshChampionIntroActive()) return;'],
 ['player anomaly hard freeze',main,'vx=0;'],
 ['enemy anomaly cinematic freeze',main,'const storyCinematicFrozen=Boolean((storyMomentActive && e!==focusedStoryEnemy) || e.storyDormant);'],
 ['enemy anomaly separation override',main,'cinematic freeze is physically absolute for every non-focused enemy'],
 ['mage projectile anomaly freeze',main,'const storyProjectileFreeze=this.isStoryAnomalyMomentActive(time);'],
 ['mage projectile anomaly damage firewall',main,"if(source==='mageProjectile' && (this.isStoryAnomalyMomentActive(now) || this.isAshChampionIntroActive())) return false;"],
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
for(const [label,needle] of [
 ['wave-2 anomaly id',"id:'ash_wave2_master_question'"],
 ['wave-2 master line',"text:'Это он?..'"],
 ['wave-2 hero response',"text:'Ты меня знаешь?'"],
 ['wave-3 return line',"text:'Он здесь, надо срочно сообщить командиру.'"],
 ['wave-3 killing-us line',"text:'Почему он убивает нас?'"],
 ['wave-3 hero response',"text:'Да кто вы, чёрт возьми, такие?'"],
 ['anomaly post behavior',"behaviorAfter:'flee'"],
 ['anomaly one-shot contract','once:true']
]){
 if(!storyEventsSource.includes(needle)) fail(`Missing scripted Act-I anomaly data: ${label}`);
}
if(!gameplayConfig.includes('MAGE_PROJECTILE_DAMAGE:8')) fail('Mage projectile base damage must match ordinary skeleton base damage (8)');
try{
 const fakeScene={time:{now:1000},regionIndex:0};
 const anomaly=new StoryEnemyAnomalySystem(fakeScene,{definitions:STORY_ANOMALY_DEFINITIONS}).install();
 const expectedCounts=new Map([[1,0],[2,1],[3,2],[4,0],[5,0]]);
 for(const [wave,expected] of expectedCounts){
  anomaly.beginWave(wave,20);
  if(anomaly.selectedOrdinals.size!==expected) throw new Error(`wave ${wave} planned ${anomaly.selectedOrdinals.size}, expected ${expected}`);
 }
 anomaly.destroy();
}catch(error){
 fail(`Act-I enemy anomaly smoke test failed: ${error.message}`);
}
for(const [label,source,needle] of [
 ['wave-4 altar story definition',storyEventsSource,'const ASH_ALTAR_CHAMPION_STORY=Object.freeze({'],
 ['wave-4 clear story flag',storyEventsSource,"waveClearedFlag:'ash_story_wave_4_cleared'"],
 ['altar target key',storyEventsSource,"landmarkKey:'ash_landmark_altar'"],
 ['altar objective marker',main,'this.ashAltarObjectiveMarker=new StoryObjectiveMarker(this,{insetRatio:0.10}).install();'],
 ['altar wave gate',main,'isAshAltarStoryGateActive()'],
 ['champion reveal entry',main,'beginAshChampionReveal()'],
 ['champion reveal dormant spawn',main,'dormant:true'],
 ['champion reveal deferred music',main,'deferMusic:true'],
 ['champion reveal vignette target',main,'target:champion'],
 ['champion combat release',main,'releaseAshChampionFight()'],
 ['pre-spawned champion wave five',main,"this.startWave(5,false,{preSpawnedChampion:true,suppressBanner:true});"],
 ['champion music starts on combat release',main,'this.startBrokenSaintMusic();'],
 ['wave 5 concurrent champion population',main,'{concurrentChampion:preSpawnedChampion}'],
 ['mage aims at current hero position',main,'const shotX=this.clampWorldX(this.player.x,20);'],
 ['mage aims at current hero Y',main,'const shotY=this.clampWorldY(this.player.y,20);']
]){
 if(!source.includes(needle)) fail(`Missing altar/champion encounter contract: ${label}`);
}
if(main.includes('this.player.x+(this.player.body.velocity.x||0)*BALANCE.MAGE_LEAD_SECONDS')) fail('Mage predictive lead aiming must be removed');
if(!errors.some(e=>e.startsWith('Missing Act-I wave pacing contract:')||e.startsWith('Act-I enemy anomaly')||e.startsWith('Missing altar/champion encounter contract:')||e.includes('Mage predictive lead'))) pass('Act-I anomalies + wave-4 altar reveal + concurrent first champion contracts present');

// 16) Performance Diagnostics v5 + free CPU optimisation pass + smart adaptive render quality + rescue navigation.
for(const [label,source,needle] of [
 ['trace v3 schema',main,"schema:'last-knight-performance-trace-v3'"],
 ['pause trace transition guard',main,'const hadReason=this.gameplayPauseReasons.has(reason);'],
 ['pause trace only on transition',main,'if(hadReason!==wanted || nextPaused!==this.gameplayPaused){'],
 ['live render scale 1.25 preset',main,'data-action=\"renderScale\" data-value=\"1.25\"'],
 ['render scale capped at 1.75',main,'const LK_RENDER_SCALE_MAX = 1.75;'],
 ['automatic four-scale benchmark',main,'startRenderBenchmark(){'],
 ['benchmark 10 second measurement after 1.5s settle',main,'measureUntil:now+11500'],
 ['benchmark median FPS',main,'medianFps:percentile(b.fpsSamples,0.5)'],
 ['benchmark p95 frame gap',main,'p95FrameGapMs:percentile(b.frameGapSamples,0.95)'],
 ['adaptive quality auto control',main,'data-action="qualityAuto"'],
 ['adaptive quality mode storage',main,"const LK_QUALITY_MODE_STORAGE_KEY = 'lastKnight.quality.mode.v1';"],
 ['adaptive quality saved auto profile',main,"const LK_QUALITY_PROFILE_STORAGE_KEY = 'lastKnight.quality.autoScale.v1';"],
 ['adaptive startup probe',main,'quality_probe_started'],
 ['adaptive sustained pressure',main,"'sustained_frame_pressure'"],
 ['adaptive safe moment gate',main,'isAdaptiveQualitySafeMoment(){'],
 ['adaptive one-step scales',main,'const LK_QUALITY_SCALES = Object.freeze([1,1.25,1.5,1.75]);'],
 ['manual render scale locks auto mode',main,"this.setAdaptiveQualityMode('manual');"],
 ['adaptive learned scale-response map',main,"const LK_QUALITY_RESPONSE_STORAGE_KEY = 'lastKnight.quality.scaleResponse.v1';"],
 ['adaptive meaningful FPS threshold',main,'const LK_QUALITY_MIN_FPS_GAIN_PCT = 8;'],
 ['adaptive meaningful p95 threshold',main,'const LK_QUALITY_MIN_P95_GAIN_PCT = 12;'],
 ['adaptive benchmark learning',main,'learnAdaptiveQualityFromBenchmark(this.renderBenchmarkResults);'],
 ['adaptive downgrade evidence gate',main,"'quality_downgrade_rejected'"],
 ['adaptive runtime downgrade trial',main,"'quality_trial_rejected'"],
 ['adaptive bottleneck classification',main,"'quality_benchmark_classified'"],
 ['adaptive trace snapshot',main,'quality:this.getAdaptiveQualitySnapshot()'],
 ['subsystem timing accumulator',main,'recordSubsystemTime(name,ms){'],
 ['story subsystem timing',main,"endSubsystemTrace('story'"],
 ['world streaming subsystem timing',main,"endSubsystemTrace('worldStreaming'"],
 ['enemy AI subsystem timing',main,"endSubsystemTrace('enemyAI'"],
 ['navigation subsystem timing',main,"recordSubsystemTime?.('navigation'"],
 ['melee subsystem timing',main,"endSubsystemTrace('melee'"],
 ['projectile subsystem timing',main,"endSubsystemTrace('projectiles'"],
 ['vignette subsystem timing',main,"recordSubsystemTime?.('vignette'"],
 ['HUD subsystem timing',main,"recordSubsystemTime?.('HUD'"],

 ['rescue navigation per-frame budget',main,'this.navigationRescuePathfindBudget=1;'],
 ['rescue navigation stuck detector',navigation,"trace('enemy_stuck_detected'"],
 ['rescue navigation temporary activation',navigation,'enemy.navRescueUntil=time+4500;'],
 ['rescue navigation repath trace',navigation,"'enemy_rescue_repath'"],
 ['rescue navigation success trace',navigation,"'enemy_rescue_navigation_success'"],
 ['rescue navigation denser waypoints',navigation,'const maxLookAhead=rescueMode?Math.min(raw.length-1,i+4):raw.length-1;'],
 ['rescue navigation expanded A star budget',navigation,'rescueMode?4200:3200'],
 ['navigation probe cache',navigation,'enemy.navProbeAt=time+probeInterval+probeJitter;'],
 ['local steering cache',main,'enemy.localSteerProbeAt=time+probeInterval;'],
 ['20Hz crowd separation',navigation,'this.enemySeparationNextAt=time+50;'],
 ['10Hz skeleton attack slot cache',main,'this.nextSkeletonAttackSlotRefreshAt=time+100;'],
 ['mage projectile owner count cache',main,'const activeMageShotsByOwner=new Map();'],
 ['runtime environment culling',main,'updateRuntimeEnvironmentCulling(time=0){'],
 ['runtime culling keeps colliders untouched',main,'Pure visibility optimisation: no props are removed and no collision or'],
 ['melee squared-distance broad phase',heroMeleeSource,'const attackRadiusSq=attackRadius*attackRadius;'],
 ['melee candidate reuse',heroMeleeSource,'for(const enemy of this.attackCandidates||[])'],
 ['hero melee proximity state',heroMeleeSource,'updateTargetState(enemies){'],
 ['hero does not swing without target',heroMeleeSource,'if(!hasAttackTarget) return;'],
 ['hero melee nearby hysteresis',heroMeleeSource,'this.disengagePadding = 26;'],
 ['short browser resume panic cooldown',main,'fps:{panicMax:10,smoothStep:true,deltaHistory:10}'],
 ['browser resume recovery trace',main,"'browser_resume_recovery'"],
 ['fixed CSS-scale anomaly dialogue',worldDialogueSource,'const dialogueScale=worldUiScale(scene);'],
 ['fixed CSS-scale wounded prompt',woundedInteractionSource,'prompt.setScale(worldUiScale(scene));'],
 ['fixed CSS-scale wounded dialogue',worldDialogueSource,'const dialogueScale=worldUiScale(scene);']
]){
 if(!source.includes(needle)) fail(`Missing Performance Diagnostics v4 contract: ${label}`);
}
if(!errors.some(e=>e.startsWith('Missing Performance Diagnostics v4 contract:'))) pass('Performance Diagnostics v5 + CPU optimisation + smart adaptive quality + rescue navigation contracts present');

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

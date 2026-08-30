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
import {PROLOGUE_STORY_PAGES,STORY_EVENTS} from '../src/story/storyEvents.js';

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
for(const file of ['src/main.js','src/combat/HeroMelee.js','src/config/gameplayConfig.mjs','src/config/worldConfig.mjs','src/world/NavigationSystem.js','src/audio/AudioManager.js','src/ui/cinematicTransitions.js','src/story/StoryDirector.js','src/story/storyEvents.js']){
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
 ['mage projectile obstacle collision','this.isAshPathBlocked(lastProjectileX,lastProjectileY,projectile.x,projectile.y,6)']
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
 ['one-shot completion flags',storyDirectorSource,'completedEvents=new Set()'],
 ['generic cinematic launcher',storyDirectorSource,'playCinematic(pages,{eventId=null,once=true,releaseTextureKeys=[],onComplete=null}={})'],
 ['dialogue event bridge',storyDirectorSource,"this.scene?.events?.emit?.('story-dialogue-start'"],
 ['MainScene StoryDirector import',main,"import StoryDirector from './story/StoryDirector.js';"],
 ['MainScene StoryDirector install',main,'this.storyDirector=new StoryDirector(this,{events:STORY_EVENTS}).install();'],
 ['MainScene StoryDirector update',main,'if(this.storyDirector?.update(time)) return;'],
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
 smoke.destroy();
}catch(error){
 fail(`StoryDirector v1 state-machine smoke test failed: ${error.message}`);
}
if(!errors.some(e=>e.startsWith('Missing StoryDirector v1 contract:')||e.startsWith('StoryDirector v1'))) pass('StoryDirector v1 contracts + state-machine smoke test present');

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

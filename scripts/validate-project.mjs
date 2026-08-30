import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const errors=[];
const warnings=[];
const ok=[];
const assetKeys=new Map();

function fail(message){errors.push(message);}
function warn(message){warnings.push(message);}
function pass(message){ok.push(message);}
function publicFile(url){return path.join(root,'public',url.replace(/^\//,''));}
function requireFile(url,label=url){if(!fs.existsSync(publicFile(url))) fail(`Missing asset: ${label} -> ${url}`);}
function register(key,url){
 if(assetKeys.has(key)) fail(`Duplicate preload key: ${key} (${assetKeys.get(key)} and ${url})`);
 else assetKeys.set(key,url);
 requireFile(url,key);
}
function pad2(n){return String(n).padStart(2,'0');}

// 1) JS syntax.
for(const file of ['src/main.js','src/combat/HeroMelee.js']){
 const result=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});
 if(result.status!==0) fail(`Syntax check failed: ${file}\n${result.stderr||result.stdout}`);
 else pass(`Syntax: ${file}`);
}

const mainPath=path.join(root,'src/main.js');
const main=fs.readFileSync(mainPath,'utf8');

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

// 3) Dead preload helpers should stay removed; PreloadScene/queueMainGameAssets is the single source of truth.
for(const name of ['preloadAshFieldsEnvironmentArt','preloadGameplayArt','preloadAttackRing','preloadHitBurst']){
 if(main.includes(`${name}(`)) fail(`Dead preload helper still present: ${name}`);
}
if(!['preloadAshFieldsEnvironmentArt','preloadGameplayArt','preloadAttackRing','preloadHitBurst'].some(n=>main.includes(`${n}(`))) pass('Dead MainScene preload helpers removed');

// 4) Recreate the active preload registry and validate every concrete URL + duplicate key.
register('lastknight_loading_art_desktop','/assets/ui/loading_key_art_4k.jpg');
register('lastknight_loading_art_mobile','/assets/ui/loading_key_art_mobile.jpg');
register('cinematic_stone_bar','/assets/ui/cinematic_frame/cinematic_stone_bar.png');
register('cinematic_stone_joint','/assets/ui/cinematic_frame/cinematic_stone_joint.png');
for(let i=1;i<=4;i++) register(`prologue_scene_${pad2(i)}`,`/assets/ui/cinematic/prologue_scene_${pad2(i)}.png`);

const heroDirs=['n','ne','e','se','s','sw','w','nw'];
for(const dir of heroDirs){
 for(let i=1;i<=2;i++) register(`hero_socket_walk_${dir}_${pad2(i)}`,`/assets/redraw/player_socket/hero_walk_${dir}_${pad2(i)}.png`);
 register(`weapon_socket_sword_${dir}`,`/assets/weapons/sword1/sword_${dir}.png`);
}
for(let i=1;i<=15;i++) register(`hero_socket_spin_${pad2(i)}`,`/assets/redraw/player_socket/hero_spin_${pad2(i)}.png`);
for(let i=1;i<=6;i++) register(`hero_death_${pad2(i)}`,`/assets/redraw/player_socket/death/hero_death_${pad2(i)}.png`);
register('last_knight_weapon_socket_project','/assets/config/last-knight-weapon-socket-project.json');

for(let i=0;i<8;i++) register(`ring_sweep_${pad2(i)}`,`/assets/effects/ring_sweep_${pad2(i)}.png`);
for(let i=0;i<6;i++) register(`hit_burst_${pad2(i)}`,`/assets/effects/hit_burst_${pad2(i)}.png`);

const ashGround=['ash_ground_base_01','ash_edge_north_01','ash_edge_south_01','ash_edge_west_01','ash_edge_east_01'];
const ashProps=['ash_tree_01','ash_tree_02','ash_rock_01','ash_rock_02','ash_rock_03','ash_grass_01','ash_grass_02','ash_grass_03'];
const ashLandmarks=['ash_landmark_altar','ash_landmark_sword'];
for(const key of ashGround) register(key,`/assets/environment/ash_fields/ground_minimal/${key}.png`);
for(const key of ashProps) register(key,`/assets/environment/ash_fields/props_curated/${key}.png`);
for(const key of ashLandmarks) register(key,`/assets/environment/ash_fields/landmarks_curated/${key}.png`);

for(const [key,url] of Object.entries({
 xp_crystal:'/assets/gameplay/pickups/xp_crystal.png',
 health_heart:'/assets/gameplay/pickups/health_heart.png',
 critical_heartbeat:'/assets/audio/critical_heartbeat.wav',
 bgm_veil_of_the_past:'/assets/audio/bgm_veil_of_the_past.ogg',
 sfx_hero_sword_attack:'/assets/audio/hero_sword_attack.ogg',
 sfx_hero_sword_impact:'/assets/audio/hero_sword_impact.ogg',
 sfx_skeleton_sword_attack:'/assets/audio/skeleton_sword_attack.ogg',
 sfx_mage_cast:'/assets/audio/mage_cast.ogg',
 sfx_hero_death:'/assets/audio/hero_death.ogg',
 sfx_hero_hit:'/assets/audio/hero_hit.ogg',
 sfx_skill_quake:'/assets/audio/skill_quake.ogg',
 sfx_skill_lift:'/assets/audio/skill_lift.ogg',
 sfx_skill_spin:'/assets/audio/skill_spin.ogg',
 sfx_broken_saint_holy_warning:'/assets/audio/broken_saint_holy_warning.ogg',
 sfx_broken_saint_holy_beam:'/assets/audio/broken_saint_holy_beam.ogg',
 sfx_broken_saint_spawn:'/assets/audio/broken_saint_spawn.ogg',
 skill_icon_quake:'/assets/ui/newskills/skill_quake_icon.png',
 skill_icon_lift:'/assets/ui/newskills/skill_lift_icon.png',
 skill_icon_spin:'/assets/ui/newskills/skill_spin_icon.png',
 hero_hud_hp_bar_frame:'/assets/ui/hero_hud/hp_bar_frame.png',
 hero_hud_mana_bottle_blue:'/assets/ui/hero_hud/mana_bottle_blue.png',
 hero_hud_xp_bar_frame:'/assets/ui/hero_hud/xp_bar_frame.png'
})) register(key,url);

for(let i=0;i<2;i++) register(`mage_projectile_${pad2(i)}`,`/assets/gameplay/projectiles/mage_projectile_${pad2(i)}.png`);
for(const [name,count] of Object.entries({holy_mark:4,holy_impact:4,holy_beam:3,reflect_shield:4,reflect_spark:2})){
 for(let i=0;i<count;i++) register(`broken_saint_${name}_${pad2(i)}`,`/assets/effects/broken_saint/broken_saint_${name}_${pad2(i)}.png`);
}

const dirs=['down','left','right','up'];
for(const dir of dirs){
 for(let i=0;i<4;i++){
  const frame=pad2(i);
  register(`skeleton_${dir}_idle_${frame}`,`/assets/redraw/skeleton/${dir}_idle_${frame}.png`);
  if(i<3) register(`mage_${dir}_idle_${frame}`,`/assets/redraw/mage/${dir}_idle_${frame}.png`);
  const shieldSource=dir==='right'&&i<2?pad2(i+2):frame;
  register(`shield_${dir}_idle_${frame}`,`/assets/redraw/shield/${dir}_idle_${shieldSource}.png`);
 }
 for(let i=0;i<6;i++){
  const frame=pad2(i);
  register(`skeleton_${dir}_walk_${frame}`,`/assets/redraw/skeleton/${dir}_walk_${frame}.png`);
  register(`skeleton_${dir}_attack_${frame}`,`/assets/redraw/skeleton/${dir}_attack_${frame}.png`);
  const mageWalkSource=dir==='down'&&i===4?'05':dir==='down'&&i===5?'06':frame;
  register(`mage_${dir}_walk_${frame}`,`/assets/redraw/mage/${dir}_walk_${mageWalkSource}.png`);
  register(`mage_${dir}_cast_${frame}`,`/assets/redraw/mage/${dir}_cast_${frame}.png`);
  register(`shield_${dir}_walk_${frame}`,`/assets/redraw/shield/${dir}_walk_${frame}.png`);
  const shieldAttackSource=dir==='left'&&i===1?'06':frame;
  register(`shield_${dir}_attack_${frame}`,`/assets/redraw/shield/${dir}_attack_${shieldAttackSource}.png`);
 }
}
const brokenSaintSourceDirs={down:'down',down_left:'down_right',left:'right',up_left:'up_right',up:'up',up_right:'up_left',right:'left',down_right:'down_left'};
for(const [dir,sourceDir] of Object.entries(brokenSaintSourceDirs)){
 for(let i=0;i<4;i++) register(`broken_saint_${dir}_walk_${pad2(i)}`,`/assets/redraw/champion/broken_saint/${sourceDir}_walk_${pad2(i)}.png`);
 for(let i=0;i<3;i++) register(`broken_saint_${dir}_attack_${pad2(i)}`,`/assets/redraw/champion/broken_saint/${sourceDir}_attack_${pad2(i)}.png`);
}
if(!errors.some(e=>e.startsWith('Missing asset:')||e.startsWith('Duplicate preload key:'))) pass(`Preload asset registry: ${assetKeys.size} unique keys/files OK`);

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

// 8) Stability contracts added by Technical Stability v1.
for(const [label,needle] of [
 ['unified champion hazard cleanup','clearChampionHazards(){'],
 ['Mage SFX limiter reset','this.lastMageCastSfxAt=-9999;'],
 ['Broken Saint warning shutdown cleanup','this.stopBrokenSaintHolyWarningSfx();'],
 ['BGM unlock handoff','this.sound.once(\'unlocked\',startMusic);']
]){
 if(!main.includes(needle)) fail(`Missing stability contract: ${label}`);
}

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

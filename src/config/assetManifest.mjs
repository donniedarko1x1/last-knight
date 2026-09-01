// LAST KNIGHT asset manifest v1
// Central source of truth for the initial asset pipeline.
// Categories are deliberately coarse so REGION_* groups can later be streamed
// independently without changing gameplay code.

export const ASSET_CATEGORY={
 CORE:'CORE',
 PROLOGUE:'PROLOGUE',
 REGION_ASH:'REGION_ASH'
};

export const ASSET_REQUIREMENT={
 REQUIRED:'required',
 OPTIONAL:'optional'
};

export const SKILL_ICON_KEYS={
 quake:'skill_icon_quake',
 lift:'skill_icon_lift',
 spin:'skill_icon_spin'
};

export const PROLOGUE_PAGE_KEYS=Array.from({length:3},(_,i)=>`prologue_scene_${String(i+1).padStart(2,'0')}`);
export const BROKEN_SAINT_AFTERMATH_PAGE_KEYS=Array.from(
 {length:3},
 (_,i)=>`broken_saint_aftermath_${String(i+1).padStart(2,'0')}`
);
export const ASH_SWORD_PULSE_FRAME_KEYS=Array.from(
 {length:3},
 (_,i)=>`ash_sword_pulse_${String(i+1).padStart(2,'0')}`
);
export const BROKEN_SAINT_SWORD_CINEMATIC_PAGE_KEYS=Array.from(
 {length:3},(_,i)=>`broken_saint_sword_${String(i+1).padStart(2,'0')}`
);

const manifest=[];
const add=(category,requirement,type,key,url)=>{
 manifest.push(Object.freeze({category,requirement,type,key,url}));
};
const image=(category,requirement,key,url)=>add(category,requirement,'image',key,url);
const audio=(category,requirement,key,url)=>add(category,requirement,'audio',key,url);
const json=(category,requirement,key,url)=>add(category,requirement,'json',key,url);
const pad2=(n)=>String(n).padStart(2,'0');
const R=ASSET_REQUIREMENT.REQUIRED;
const O=ASSET_REQUIREMENT.OPTIONAL;
const {CORE,PROLOGUE,REGION_ASH}=ASSET_CATEGORY;

// ---------------------------------------------------------------------------
// PROLOGUE — cinematic frame is reusable; page images are released after use.
// ---------------------------------------------------------------------------
image(PROLOGUE,R,'cinematic_stone_bar','/assets/ui/cinematic_frame/cinematic_stone_bar.png');
image(PROLOGUE,R,'cinematic_stone_joint','/assets/ui/cinematic_frame/cinematic_stone_joint.png');
for(const key of PROLOGUE_PAGE_KEYS){
 image(PROLOGUE,R,key,`/assets/ui/cinematic/${key}.png`);
}

// ---------------------------------------------------------------------------
// CORE — hero, shared enemies, HUD, shared gameplay and combat effects.
// ---------------------------------------------------------------------------
const heroDirs=['n','ne','e','se','s','sw','w','nw'];
for(const dir of heroDirs){
 for(let i=1;i<=2;i++) image(CORE,R,`hero_socket_walk_${dir}_${pad2(i)}`,`/assets/redraw/player_socket/hero_walk_${dir}_${pad2(i)}.png`);
 image(CORE,R,`weapon_socket_sword_${dir}`,`/assets/weapons/sword1/sword_${dir}.png`);
}
for(let i=1;i<=15;i++) image(CORE,R,`hero_socket_spin_${pad2(i)}`,`/assets/redraw/player_socket/hero_spin_${pad2(i)}.png`);
for(let i=1;i<=6;i++) image(CORE,R,`hero_death_${pad2(i)}`,`/assets/redraw/player_socket/death/hero_death_${pad2(i)}.png`);
json(CORE,R,'last_knight_weapon_socket_project','/assets/config/last-knight-weapon-socket-project.json');

for(let i=0;i<8;i++) image(CORE,R,`ring_sweep_${pad2(i)}`,`/assets/effects/ring_sweep_${pad2(i)}.png`);
for(let i=0;i<6;i++) image(CORE,R,`hit_burst_${pad2(i)}`,`/assets/effects/hit_burst_${pad2(i)}.png`);

image(CORE,R,'xp_crystal','/assets/gameplay/pickups/xp_crystal.png');
image(CORE,R,'health_heart','/assets/gameplay/pickups/health_heart.png');
for(let i=0;i<2;i++) image(CORE,R,`mage_projectile_${pad2(i)}`,`/assets/gameplay/projectiles/mage_projectile_${pad2(i)}.png`);

const coreAudio={
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
 sfx_skill_spin:'/assets/audio/skill_spin.ogg'
};
for(const [key,url] of Object.entries(coreAudio)) audio(CORE,R,key,url);

const skillIcons={
 [SKILL_ICON_KEYS.quake]:'/assets/ui/newskills/skill_quake_icon.png',
 [SKILL_ICON_KEYS.lift]:'/assets/ui/newskills/skill_lift_icon.png',
 [SKILL_ICON_KEYS.spin]:'/assets/ui/newskills/skill_spin_icon.png'
};
for(const [key,url] of Object.entries(skillIcons)) image(CORE,R,key,url);
for(const [key,url] of Object.entries({
 hero_hud_hp_bar_frame:'/assets/ui/hero_hud/hp_bar_frame.png',
 hero_hud_mana_bottle_blue:'/assets/ui/hero_hud/mana_bottle_blue.png',
 hero_hud_xp_bar_frame:'/assets/ui/hero_hud/xp_bar_frame.png'
})) image(CORE,R,key,url);

const dirs=['down','left','right','up'];
for(const dir of dirs){
 for(let i=0;i<4;i++){
  const frame=pad2(i);
  image(CORE,R,`skeleton_${dir}_idle_${frame}`,`/assets/redraw/skeleton/${dir}_idle_${frame}.png`);
  if(i<3) image(CORE,R,`mage_${dir}_idle_${frame}`,`/assets/redraw/mage/${dir}_idle_${frame}.png`);
  const shieldSource=dir==='right'&&i<2?pad2(i+2):frame;
  image(CORE,R,`shield_${dir}_idle_${frame}`,`/assets/redraw/shield/${dir}_idle_${shieldSource}.png`);
 }
 for(let i=0;i<6;i++){
  const frame=pad2(i);
  image(CORE,R,`skeleton_${dir}_walk_${frame}`,`/assets/redraw/skeleton/${dir}_walk_${frame}.png`);
  image(CORE,R,`skeleton_${dir}_attack_${frame}`,`/assets/redraw/skeleton/${dir}_attack_${frame}.png`);
  const mageWalkSource=dir==='down'&&i===4?'05':dir==='down'&&i===5?'06':frame;
  image(CORE,R,`mage_${dir}_walk_${frame}`,`/assets/redraw/mage/${dir}_walk_${mageWalkSource}.png`);
  image(CORE,R,`mage_${dir}_cast_${frame}`,`/assets/redraw/mage/${dir}_cast_${frame}.png`);
  image(CORE,R,`shield_${dir}_walk_${frame}`,`/assets/redraw/shield/${dir}_walk_${frame}.png`);
  const shieldAttackSource=dir==='left'&&i===1?'06':frame;
  image(CORE,R,`shield_${dir}_attack_${frame}`,`/assets/redraw/shield/${dir}_attack_${shieldAttackSource}.png`);
 }
}

// ---------------------------------------------------------------------------
// REGION_ASH — Ash Fields environment + Broken Saint.
// Decorative scenery is optional: existing world builders already skip missing
// prop/landmark textures, so one decorative 404 cannot block the whole game.
// ---------------------------------------------------------------------------
for(const key of BROKEN_SAINT_AFTERMATH_PAGE_KEYS){
 image(REGION_ASH,R,key,`/assets/ui/cinematic/broken_saint_aftermath/${key}.png`);
}
for(const key of ASH_SWORD_PULSE_FRAME_KEYS){
 image(REGION_ASH,R,key,`/assets/effects/ash_sword_pulse/${key}.png`);
}
for(const key of BROKEN_SAINT_SWORD_CINEMATIC_PAGE_KEYS){
 image(REGION_ASH,R,key,`/assets/ui/cinematic/broken_saint_sword/${key}.png`);
}

const ashGround=['ash_ground_base_01','ash_edge_north_01','ash_edge_south_01','ash_edge_west_01','ash_edge_east_01'];
for(const key of ashGround) image(REGION_ASH,R,key,`/assets/environment/ash_fields/ground_minimal/${key}.png`);

// Only non-blocking grass is optional in v1. Trees, rocks and landmarks affect
// collision/route geometry, so they remain required until World Physics v1 has
// an explicit decorative/blocking manifest of its own.
const ashBlockingProps=['ash_tree_01','ash_tree_02','ash_rock_01','ash_rock_02','ash_rock_03'];
for(const key of ashBlockingProps) image(REGION_ASH,R,key,`/assets/environment/ash_fields/props_curated/${key}.png`);
const ashDecorativeProps=['ash_grass_01','ash_grass_02','ash_grass_03'];
for(const key of ashDecorativeProps) image(REGION_ASH,O,key,`/assets/environment/ash_fields/props_curated/${key}.png`);
const ashLandmarks=['ash_landmark_altar','ash_landmark_sword'];
for(const key of ashLandmarks) image(REGION_ASH,R,key,`/assets/environment/ash_fields/landmarks_curated/${key}.png`);

// Wounded human knights: three distinct characters, three breathing frames each.
for(let knight=1;knight<=3;knight++){
 for(let frame=0;frame<3;frame++){
  const key=`ash_wounded_knight_${pad2(knight)}_${pad2(frame)}`;
  image(REGION_ASH,R,key,`/assets/environment/ash_fields/wounded_knights/${key}.png`);
 }
}

// Additional battlefield casualties for Act 1 dressing. These are optional so
// one missing decorative asset never blocks boot or region streaming.
for(const key of ['ash_corpse_01','ash_corpse_02']){
 image(REGION_ASH,O,key,`/assets/environment/ash_fields/corpses/${key}.png`);
}

for(const [key,url] of Object.entries({
 sfx_ash_sword_pulse:'/assets/audio/ash_sword_pulse.mp3',
 sfx_broken_saint_materialize:'/assets/audio/broken_saint_materialize.ogg',
 sfx_broken_saint_disappear:'/assets/audio/broken_saint_disappear.ogg',
 sfx_broken_saint_holy_warning:'/assets/audio/broken_saint_holy_warning.ogg',
 sfx_broken_saint_holy_beam:'/assets/audio/broken_saint_holy_beam.ogg',
 sfx_broken_saint_spawn:'/assets/audio/broken_saint_spawn.ogg'
})) audio(REGION_ASH,R,key,url);

for(let i=0;i<5;i++) image(REGION_ASH,R,`ash_champion_smoke_${pad2(i)}`,`/assets/effects/ash_champion_smoke/ash_champion_smoke_${pad2(i)}.png`);

for(const [key,url] of Object.entries({
 broken_saint_relic_cracked_halo:'/assets/ui/relics/broken_saint/broken_saint_cracked_halo.png',
 broken_saint_relic_saints_nail:'/assets/ui/relics/broken_saint/broken_saint_saints_nail.png',
 broken_saint_relic_ash_rosary:'/assets/ui/relics/broken_saint/broken_saint_ash_rosary.png'
})) image(REGION_ASH,R,key,url);

for(const [key,url] of Object.entries({
 broken_saint_essence_body:'/assets/ui/essences/broken_saint/broken_saint_essence_body.png',
 broken_saint_essence_will:'/assets/ui/essences/broken_saint/broken_saint_essence_will.png',
 broken_saint_essence_discipline:'/assets/ui/essences/broken_saint/broken_saint_essence_discipline.png'
})) image(REGION_ASH,R,key,url);

for(const [name,count] of Object.entries({holy_mark:4,holy_impact:4,holy_beam:3,reflect_shield:4,reflect_spark:2})){
 for(let i=0;i<count;i++) image(REGION_ASH,R,`broken_saint_${name}_${pad2(i)}`,`/assets/effects/broken_saint/broken_saint_${name}_${pad2(i)}.png`);
}

const brokenSaintSourceDirs={down:'down',down_left:'down_right',left:'right',up_left:'up_right',up:'up',up_right:'up_left',right:'left',down_right:'down_left'};
for(const [dir,sourceDir] of Object.entries(brokenSaintSourceDirs)){
 for(let i=0;i<4;i++) image(REGION_ASH,R,`broken_saint_${dir}_walk_${pad2(i)}`,`/assets/redraw/champion/broken_saint/${sourceDir}_walk_${pad2(i)}.png`);
 for(let i=0;i<3;i++) image(REGION_ASH,R,`broken_saint_${dir}_attack_${pad2(i)}`,`/assets/redraw/champion/broken_saint/${sourceDir}_attack_${pad2(i)}.png`);
}

export const ASSET_MANIFEST=Object.freeze(manifest);
const manifestByKey=new Map(ASSET_MANIFEST.map(entry=>[entry.key,entry]));

export function getAssetSpec(key){
 return manifestByKey.get(key)||null;
}

export function getAssetsForCategories(categories){
 const wanted=new Set(categories);
 return ASSET_MANIFEST.filter(entry=>wanted.has(entry.category));
}

export function queueAssetCategories(scene,categories){
 const entries=getAssetsForCategories(categories);
 for(const entry of entries){
  if(entry.type==='image') scene.load.image(entry.key,entry.url);
  else if(entry.type==='audio') scene.load.audio(entry.key,entry.url);
  else if(entry.type==='json') scene.load.json(entry.key,entry.url);
  else throw new Error(`Unsupported asset type: ${entry.type} (${entry.key})`);
 }
 return entries;
}

export function releaseTextureKeys(scene,keys){
 if(!scene?.textures) return 0;
 let released=0;
 for(const key of keys){
  if(scene.textures.exists(key)){
   scene.textures.remove(key);
   released++;
  }
 }
 return released;
}

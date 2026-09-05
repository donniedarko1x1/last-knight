import Phaser from 'phaser';
import HeroMelee from './combat/HeroMelee.js';
import SkeletonCaptainSystem from './combat/SkeletonCaptainSystem.js';
import {captureZoneBuild,restoreZoneBuild,restartZoneIndex} from './world/ZoneRestartState.mjs';
import {CAPTAIN,globalWave,isCaptainEncounter,shieldHpForWave} from './config/captainConfig.mjs';
import {
 STAGE0,
 PURSUIT,
 BALANCE,
 LOW_HEALTH_CONFIG,
 HERO_SOCKET_DIRS,
 HERO_SOCKET_SPIN_FRAME_COUNT,
 HERO_SOCKET_VISUAL_SCALE,
 HERO_SOCKET_SPIN_FRAME_RATE,
 HERO_SOCKET_SPIN_DURATION_MS,
 HERO_DEATH_FRAME_COUNT,
 HERO_DEATH_ANIMATION_MS,
 HERO_DEATH_HOLD_MS,
 HERO_DEATH_VISUAL_SCALE
} from './config/gameplayConfig.mjs';
import {
 WORLD_DESIGN,
 REGION_BALANCE,
 ASH_FIELDS_CLUSTER_LIBRARY,
 ASH_FIELDS_SEGMENTS,
 ASH_FIELDS_BAKED_LAYOUT,
 ASH_READABILITY
} from './config/worldConfig.mjs';
import { cinematicFadeIn, cinematicSwapWithFade, cinematicFadeOutAndRun } from './ui/cinematicTransitions.js';
import NavigationSystem from './world/NavigationSystem.js';
import AudioManager from './audio/AudioManager.js';
import StoryDirector from './story/StoryDirector.js';
import WoundedKnightInteractionSystem from './story/WoundedKnightInteractionSystem.js';
import WorldDialogueSystem from './story/WorldDialogueSystem.js';
import ChampionDialogueSystem from './story/ChampionDialogueSystem.js';
import {BROKEN_SAINT_INTRO_DIALOGUE,BROKEN_SAINT_AFTERMATH_PAGES,BROKEN_SAINT_SWORD_PAGES} from './story/BrokenSaintCinematics.js';
import StoryEnemyAnomalySystem from './story/StoryEnemyAnomalySystem.js';
import StoryObjectiveMarker from './story/StoryObjectiveMarker.js';
import {PROLOGUE_STORY_PAGES,STORY_ANOMALY_DEFINITIONS,STORY_EVENTS,ASH_WOUNDED_KNIGHT_STORY,ASH_ALTAR_CHAMPION_STORY} from './story/storyEvents.js';
import {
 SAVE_SCHEMA_VERSION,
 clearAutosave,getManualSaves,writeManualSave,deleteManualSave,
 getGameSettings,setGameSettings,writeCharacterStats,clearCharacterStats,saveSummary
} from './GamePersistence.js';
import {
 ASSET_MANIFEST,
 ASSET_CATEGORY,
 ASSET_REQUIREMENT,
 SKILL_ICON_KEYS,
 PROLOGUE_PAGE_KEYS,
 BROKEN_SAINT_AFTERMATH_PAGE_KEYS,
 BROKEN_SAINT_SWORD_CINEMATIC_PAGE_KEYS,
 ASH_SWORD_PULSE_FRAME_KEYS,
 getAssetSpec,
 getAssetsForCategories,
 queueAssetCategories,
 releaseTextureKeys
} from './config/assetManifest.mjs';

// The scene tuner is intentionally hidden from the game UI and is opened only
// by the developer shortcut below.
const DEV_BUILD=true;

// DEV HiDPI experiment. Phaser 3.90 no longer honors the old GameConfig `resolution`
// option, so this build renders a larger backing canvas and lets ScaleManager FIT it
// into the CSS viewport. World cameras naturally compensate via their height-based
// zoom; HUD cameras explicitly zoom by the same factor to keep CSS-logical sizing.
const LK_DEFAULT_RENDER_SCALE = 1.5;
const LK_RENDER_SCALE_MAX = 1.75;
const LK_RENDER_SCALE_STORAGE_KEY = 'lastKnight.dev.renderScale.v2';
const LK_QUALITY_MODE_STORAGE_KEY = 'lastKnight.quality.mode.v1';
const LK_QUALITY_PROFILE_STORAGE_KEY = 'lastKnight.quality.autoScale.v1';
const LK_QUALITY_RESPONSE_STORAGE_KEY = 'lastKnight.quality.scaleResponse.v1';
const LK_QUALITY_SCALES = Object.freeze([1,1.25,1.5,1.75]);
const LK_QUALITY_PROFILES = Object.freeze({1:'Performance',1.25:'Balanced',1.5:'Quality',1.75:'Ultra'});
const LK_QUALITY_PROBE_ACTIVE_MS = 10000;
const LK_QUALITY_MONITOR_WINDOW_MS = 15000;
const LK_QUALITY_POST_CHANGE_SETTLE_MS = 2500;
const LK_QUALITY_DOWNGRADE_COOLDOWN_MS = 15000;
const LK_QUALITY_UPGRADE_RECOMMEND_MS = 45000;
const LK_QUALITY_MIN_FPS_GAIN_PCT = 8;
const LK_QUALITY_MIN_P95_GAIN_PCT = 12;
const LK_QUALITY_TRIAL_ACTIVE_MS = 8000;
const LK_QUALITY_RESPONSE_TTL_MS = 1000*60*60*24*30;
let LK_RENDER_SCALE = LK_DEFAULT_RENDER_SCALE;
const LK_TEXT_RESOLUTION = 2;

function lkReadQualityMode(){
 try{return localStorage.getItem(LK_QUALITY_MODE_STORAGE_KEY)==='manual'?'manual':'auto';}catch{return 'auto';}
}
function lkProfileName(scale){
 const exact=LK_QUALITY_SCALES.reduce((best,value)=>Math.abs(value-scale)<Math.abs(best-scale)?value:best,LK_QUALITY_SCALES[0]);
 return LK_QUALITY_PROFILES[exact]||`${exact.toFixed(2)}x`;
}
function lkReadQualityResponseMap(){
 try{
  const raw=JSON.parse(localStorage.getItem(LK_QUALITY_RESPONSE_STORAGE_KEY)||'{}');
  if(!raw || typeof raw!=='object')return {};
  const now=Date.now();
  const out={};
  for(const [key,value] of Object.entries(raw)){
   if(!value || typeof value!=='object')continue;
   const at=Number(value.at)||0;
   if(at && now-at>LK_QUALITY_RESPONSE_TTL_MS)continue;
   out[key]=value;
  }
  return out;
 }catch{return {};}
}
function lkWriteQualityResponseMap(map){
 try{localStorage.setItem(LK_QUALITY_RESPONSE_STORAGE_KEY,JSON.stringify(map||{}));}catch{}
}

const STORY_ANOMALY_VIGNETTE_TEXTURE='story_anomaly_vignette_soft';
const HERO_FOCUS_STANCE_FRAME_MS=330;
const HERO_FOCUS_STANCE_STATE='hero_socket_focus_stance';
const ASH_CHAMPION_REVEAL_MS=4600;
const ASH_CHAMPION_MATERIALIZE_DELAY_MS=260;
const ASH_CHAMPION_MATERIALIZE_MS=1450;
const ASH_CHAMPION_CAMERA_SETTLE_MS=450;
const ASH_CHAMPION_VIGNETTE_FADE_MS=300;
const ASH_CHAMPION_POST_REVEAL_HOLD_MS=1000;
const ASH_CHAMPION_SMOKE_FADE_MS=650;
const STORY_FOCUS_RELEASE_COOLDOWN_MS=220;
const ASH_CHAMPION_SMOKE_FRAME_COUNT=5;
const ASH_CHAMPION_SMOKE_TEXTURE_PREFIX='ash_champion_smoke_';
const ASH_CHAMPION_SMOKE_ANIM_KEY='ash_champion_smoke_spin';
const ASH_SWORD_PULSE_ANIM_KEY='ash_sword_pulse';
const ASH_SWORD_PULSE_ACTIVE_MS=400;
const ASH_SWORD_PULSE_CYCLE_MS=ASH_SWORD_PULSE_ACTIVE_MS+1500;
const ZONE2_SOFT_FIRE_GLOW_TEXTURE='zone2_soft_fire_glow';
const ZONE2_TERRAIN_LIT_SUFFIX='_lit';
const ZONE2_TERRAIN_BRIGHTNESS=1.20;
const ZONE2_TERRAIN_KEYS=Object.freeze([
 'zone2_ground_base_01','zone2_edge_north_01','zone2_edge_south_01',
 'zone2_edge_west_01','zone2_edge_east_01'
]);
const CROW_TEXTURE_SPECS=Object.freeze([
 ['crown_1_1','/assets/environment/ruined_kingdom/crows/crown-1/crown-1-1.png'],
 ['crown_1_2','/assets/environment/ruined_kingdom/crows/crown-1/crown-1-2.png'],
 ['crown_1_3','/assets/environment/ruined_kingdom/crows/crown-1/crown-1-3.png'],
 ['crown_2_1','/assets/environment/ruined_kingdom/crows/crown-2/crown-2-1.png'],
 ['crown_2_2','/assets/environment/ruined_kingdom/crows/crown-2/crown-2-2.png'],
 ['crown_2_3','/assets/environment/ruined_kingdom/crows/crown-2/crown-2-3.png'],
 ['crown_3_1','/assets/environment/ruined_kingdom/crows/crown-3/crown-3-1.png'],
 ['crown_3_2','/assets/environment/ruined_kingdom/crows/crown-3/crown-3-2.png'],
 ['crown_3_3','/assets/environment/ruined_kingdom/crows/crown-3/crown-3-3.png'],
 ['crown_takeoff_1','/assets/environment/ruined_kingdom/crows/crown-takeoff/crow_takeoff_01_01.png'],
 ['crown_takeoff_2','/assets/environment/ruined_kingdom/crows/crown-takeoff/crow_takeoff_01_02.png'],
 ['crown_takeoff_3','/assets/environment/ruined_kingdom/crows/crown-takeoff/crow_takeoff_01_03.png'],
 ['crown_fly_1','/assets/environment/ruined_kingdom/crows/crown-fly/fly-1.png'],
 ['crown_fly_2','/assets/environment/ruined_kingdom/crows/crown-fly/fly-2.png'],
 ['crown_fly_3','/assets/environment/ruined_kingdom/crows/crown-fly/fly-3.png'],
 ['crown_fly_4','/assets/environment/ruined_kingdom/crows/crown-fly/fly-4.png']
]);
const CROW_VISUAL_SCALE=0.18;
const CROW_TRIGGER_RADIUS=150;
const CROW_TAKEOFF_MS=470;
const CROW_FLIGHT_LIFETIME_MS=7600;
const CROW_FLOCK_BIRD_MIN=5;
const CROW_FLOCK_BIRD_MAX=20;
const HERO_HIT_IMPACT_PROFILE=Object.freeze({
 hitStop:48,
 shakeX:3,
 shakeY:3,
 zoom:1.06,
 flash:0,
 slow:0.25,
 knockback:210,
 pitch:-180,
 particles:'blood',
 slowDuration:170,
 knockbackDuration:170
});
const SWORD_ORBIT_CROW_COUNT=10;
const SWORD_ORBIT_CROW_SOUND_KEY='sfx_crow_wings';
const DEV_AUDIO_MIXER_META_OVERRIDES=Object.freeze({
 bgm_veil_of_the_past:Object.freeze({label:'Фоновая музыка · Veil of the Past',music:true,volume:0.50,loop:true}),
 sfx_skeleton_sword_attack:Object.freeze({label:'Скелет · удар мечом',volume:0.24}),
 sfx_hero_death:Object.freeze({label:'Герой · смерть',volume:0.78}),
 sfx_hero_hit:Object.freeze({label:'Герой · получил удар',volume:0.35}),
 sfx_hero_sword_attack:Object.freeze({label:'Герой · взмах мечом',volume:0.42}),
 sfx_hero_sword_impact:Object.freeze({label:'Герой · попадание мечом',volume:0.45}),
 sfx_mage_cast:Object.freeze({label:'Маг · заклинание',volume:0.65}),
 sfx_skill_quake:Object.freeze({label:'Навык · землетрясение',volume:0.55}),
 sfx_skill_lift:Object.freeze({label:'Навык · подъём',volume:0.55}),
 sfx_skill_spin:Object.freeze({label:'Навык · вращение',volume:0.55}),
 critical_heartbeat:Object.freeze({label:'Герой · критическое сердцебиение',volume:0.55,loop:true}),
 sfx_ash_sword_pulse:Object.freeze({label:'Меч в Ash Fields · импульс',volume:0.72}),
 sfx_broken_saint_materialize:Object.freeze({label:'Broken Saint · появление',volume:0.60}),
 sfx_broken_saint_disappear:Object.freeze({label:'Broken Saint · исчезновение',volume:0.70}),
 sfx_broken_saint_holy_warning:Object.freeze({label:'Broken Saint · предупреждение',volume:0.80}),
 sfx_broken_saint_holy_beam:Object.freeze({label:'Broken Saint · holy beam',volume:0.55}),
 sfx_broken_saint_spawn:Object.freeze({label:'Broken Saint · музыка/тема',music:true,volume:0.50,loop:true}),
 sfx_crow_wings:Object.freeze({label:'Вороны · крылья',volume:0.32,loop:true}),
 sfx_crow_bunch:Object.freeze({label:'Вороны · крики стаи',volume:0.52})
});
const DEV_AUDIO_CATEGORY_LABELS=Object.freeze({
 CORE:'ОБЩИЕ / CORE',
 PROLOGUE:'ПРОЛОГ',
 REGION_ASH:'ASH FIELDS',
 REGION_RUINS:'RUINED KINGDOM'
});
const DEV_AI_MODE_META=Object.freeze({
 normal:Object.freeze({name:'Обычное поведение',desc:'Штатный AI игры без экспериментального построения.'}),
 aggressive:Object.freeze({name:'Штурм',desc:'Все бойцы максимально быстро давят прямо на героя.'}),
 surround:Object.freeze({name:'Кольцо',desc:'Скелеты занимают окружность вокруг героя и вращаются, удерживая дистанцию.'}),
 wedge:Object.freeze({name:'Клин',desc:'Группа собирается клином: острие впереди, следующие бойцы расходятся назад по сторонам.'}),
 pincer:Object.freeze({name:'Клещи',desc:'Отряд делится пополам, широко обходит героя слева и справа и сходится с флангов.'}),
 protectMages:Object.freeze({name:'Защита магов',desc:'Ближние бойцы прикрывают магов телом, а маги стараются держать безопасную дистанцию.'}),
 protectBoss:Object.freeze({name:'Защита босса',desc:'Скелеты формируют живой заслон вокруг Капитана или чемпиона и перехватывают героя.'}),
 shieldWall:Object.freeze({name:'Щитовая стена',desc:'Щитовики становятся первой линией, обычные скелеты — второй, маги держатся позади.'}),
 phalanx:Object.freeze({name:'Фаланга',desc:'Плотный прямоугольный строй с несколькими шеренгами, который движется к герою единым блоком.'}),
 spearhead:Object.freeze({name:'Острие',desc:'Узкий агрессивный клин: несколько передних бойцов прорываются, остальные держат хвост построения.'}),
 column:Object.freeze({name:'Колонна',desc:'Скелеты выстраиваются цепью один за другим и наступают по одной оси.'}),
 echelonLeft:Object.freeze({name:'Левый эшелон',desc:'Диагональный строй со смещением влево относительно направления атаки.'}),
 echelonRight:Object.freeze({name:'Правый эшелон',desc:'Диагональный строй со смещением вправо относительно направления атаки.'}),
 doubleRing:Object.freeze({name:'Двойное кольцо',desc:'Два кольца вращаются в противоположные стороны: внутреннее давит, внешнее запирает отход.'}),
 spiral:Object.freeze({name:'Спираль',desc:'Бойцы двигаются по вращающейся спирали и постепенно меняют радиус вокруг героя.'}),
 crescent:Object.freeze({name:'Полумесяц',desc:'Широкая дуга охватывает фронт героя, а края построения заходят глубже во фланги.'}),
 swarm:Object.freeze({name:'Рой',desc:'Каждый скелет атакует самостоятельно с небольшими случайными боковыми рывками — строй выглядит хаотично.'}),
 wave:Object.freeze({name:'Волна',desc:'Отряд наступает фронтом, но отдельные бойцы смещаются влево-вправо синусоидальной волной.'}),
 flank:Object.freeze({name:'Глубокий обход',desc:'Часть бойцов сначала уходит далеко на фланги и только после этого разворачивается на героя.'}),
 skirmish:Object.freeze({name:'Налёт и отход',desc:'Бойцы чередуют короткое сближение, боковой манёвр и отход, не зависая постоянно в ближнем бою.'}),
 reserve:Object.freeze({name:'Резерв',desc:'Треть отряда атакует, вторая линия держит среднюю дистанцию, третья остаётся дальним резервом.'})
});
const DEV_AI_TACTICAL_MODES=Object.freeze(Object.keys(DEV_AI_MODE_META).filter(key=>key!=='normal'));
const ZONE2_FIRST_WAGON_OFFSET_X=1420;
const ZONE2_FIRST_WAGON_OFFSET_Y=115;
const ZONE2_WAGON_TRIGGER_RADIUS=185;
const ZONE2_GATE_CLOSE_HOLD_MS=1150;
const ZONE2_CROW_CINEMATIC_DELAY_MS=3000;
const ZONE2_WAGON_CINEMATIC_SPECS=Object.freeze([
 ['zone2_wagon_cinematic_01','/assets/story/ruined_kingdom/zone2_wagon_cinematic_01.png'],
 ['zone2_wagon_cinematic_02','/assets/story/ruined_kingdom/zone2_wagon_cinematic_02.png'],
 ['zone2_wagon_cinematic_03','/assets/story/ruined_kingdom/zone2_wagon_cinematic_03.png'],
 ['zone2_wagon_cinematic_04','/assets/story/ruined_kingdom/zone2_wagon_cinematic_04.png']
]);
const ZONE2_WAGON_CINEMATIC_PAGES=Object.freeze([
 Object.freeze({image:'zone2_wagon_cinematic_01',pan:'none',text:'Тишина здесь была подозрительной.'}),
 Object.freeze({image:'zone2_wagon_cinematic_02',pan:'none',text:'Кажется я здесь не один.'}),
 Object.freeze({image:'zone2_wagon_cinematic_03',pan:'none',text:'Это не просто нежить. Она организована.'}),
 Object.freeze({image:'zone2_wagon_cinematic_04',pan:'none',text:'…Это ещё кто?'})
]);
const ASH_SWORD_PRELUDE_HERO_FOCUS_MS=2000;
const ASH_SWORD_PRELUDE_SWORD_PAN_MS=2400;
const ASH_SWORD_PRELUDE_RETURN_MS=800;
const ASH_SWORD_PRELUDE_LOCKED_PULSES=3;
const BROKEN_SAINT_LIFT_SLOW_FACTOR=0.55;
const BROKEN_SAINT_LIFT_POST_SLOW_MS=3000;
const BROKEN_SAINT_LIFT_POST_MARK_WINDOW_MS=3600;
const BROKEN_SAINT_MARK_DURATION_MS=5000;
const BROKEN_SAINT_RELIC_IDS=Object.freeze({
 crackedHalo:'brokenSaintCrackedHalo',
 saintsNail:'brokenSaintSaintsNail',
 ashRosary:'brokenSaintAshRosary'
});
const BROKEN_SAINT_EVOLUTION_IDS=Object.freeze({
 pilgrimPath:'brokenSaintQuakePilgrimPath',
 verdict:'brokenSaintLiftVerdict',
 saintStance:'brokenSaintSpinSaintStance'
});
const BROKEN_SAINT_ESSENCE_IDS=Object.freeze({
 body:'brokenSaintEssenceBody',
 will:'brokenSaintEssenceWill',
 discipline:'brokenSaintEssenceDiscipline'
});
const BROKEN_SAINT_RELIC_ICON_KEYS=Object.freeze({
 [BROKEN_SAINT_RELIC_IDS.crackedHalo]:'broken_saint_relic_cracked_halo',
 [BROKEN_SAINT_RELIC_IDS.saintsNail]:'broken_saint_relic_saints_nail',
 [BROKEN_SAINT_RELIC_IDS.ashRosary]:'broken_saint_relic_ash_rosary'
});
const BROKEN_SAINT_ESSENCE_ICON_KEYS=Object.freeze({
 [BROKEN_SAINT_ESSENCE_IDS.body]:'broken_saint_essence_body',
 [BROKEN_SAINT_ESSENCE_IDS.will]:'broken_saint_essence_will',
 [BROKEN_SAINT_ESSENCE_IDS.discipline]:'broken_saint_essence_discipline'
});

const COMBAT_STYLE_ICON_KEYS=Object.freeze({
 crowdbreak:'combat_style_crowdbreak_icon',
 duelist:'combat_style_duelist_icon',
 echo:'combat_style_echo_icon'
});
const COMBAT_STYLE_ART_SPECS=Object.freeze({
 crowdbreak:{key:COMBAT_STYLE_ICON_KEYS.crowdbreak,url:'/assets/ui/combat_styles/path_crowdbreak.png'},
 duelist:{key:COMBAT_STYLE_ICON_KEYS.duelist,url:'/assets/ui/combat_styles/path_duelist.png'},
 echo:{key:COMBAT_STYLE_ICON_KEYS.echo,url:'/assets/ui/combat_styles/path_echo.png'}
});
const COMBAT_STYLE_DISPLAY=Object.freeze({
 crowdbreak:{shortName:'Расколотого строя',name:'ПУТЬ РАСКОЛОТОГО СТРОЯ',desc:'Обычные удары мечом сильнее отбрасывают обычных скелетов.',meta:'КОНТРОЛЬ ТОЛПЫ · МЕЧ',iconKey:COMBAT_STYLE_ICON_KEYS.crowdbreak},
 duelist:{shortName:'Последнего приговора',name:'ПУТЬ ПОСЛЕДНЕГО ПРИГОВОРА',desc:'Если в радиусе удара остаётся только один враг, меч наносит ему на 45% больше урона.',meta:'ДУЭЛЬ · УРОН ПО ОДИНОЧНОЙ ЦЕЛИ',iconKey:COMBAT_STYLE_ICON_KEYS.duelist},
 echo:{shortName:'Отклика',name:'ПУТЬ ОТКЛИКА',desc:'Использование любого навыка заряжает меч. Следующий обычный удар расходует заряд и наносит на 70% больше урона.',meta:'СИНЕРГИЯ НАВЫКОВ · ВСПЛЕСК УРОНА',iconKey:COMBAT_STYLE_ICON_KEYS.echo}
});
const SKILL_EVOLUTION_DISPLAY_NAMES=Object.freeze({
 [BROKEN_SAINT_EVOLUTION_IDS.pilgrimPath]:'Путь паломника',
 [BROKEN_SAINT_EVOLUTION_IDS.verdict]:'Приговор',
 [BROKEN_SAINT_EVOLUTION_IDS.saintStance]:'Стойкость святого'
});
const RELIC_DISPLAY_NAMES=Object.freeze({
 [BROKEN_SAINT_RELIC_IDS.crackedHalo]:'Треснувший нимб',
 [BROKEN_SAINT_RELIC_IDS.saintsNail]:'Гвоздь святого',
 [BROKEN_SAINT_RELIC_IDS.ashRosary]:'Пепельные чётки'
});
const ESSENCE_DISPLAY_NAMES=Object.freeze({
 [BROKEN_SAINT_ESSENCE_IDS.body]:'Эссенция тела',
 [BROKEN_SAINT_ESSENCE_IDS.will]:'Эссенция воли',
 [BROKEN_SAINT_ESSENCE_IDS.discipline]:'Эссенция дисциплины'
});

function lkAddText(scene,...args){
 const text=scene.add.text(...args);
 text?.setResolution?.(LK_TEXT_RESOLUTION);
 return text;
}

function lkReadableUnlockName(id,map){
 return map?.[id] || id || 'неизвестно';
}
function lkReadableUnlockList(ids,map){
 const values=(ids||[]).map(id=>lkReadableUnlockName(id,map)).filter(Boolean);
 return values.length ? values.join(', ') : 'нет';
}
function lkCombatStyleShortName(id){
 return COMBAT_STYLE_DISPLAY[id]?.shortName || 'не выбран';
}
function lkCombatStyleCards(){
 return ['crowdbreak','duelist','echo'].map(id=>({id,...COMBAT_STYLE_DISPLAY[id]}));
}

function lkCssViewport(){
 const gameHost=typeof document!=='undefined'?document.getElementById('game'):null;
 const hostRect=gameHost?.getBoundingClientRect?.();
 const vv=typeof window!=='undefined' ? window.visualViewport : null;
 const width=Math.max(1,Math.round((hostRect?.width>1?hostRect.width:0) || vv?.width || (typeof window!=='undefined'?window.innerWidth:1280) || 1280));
 const height=Math.max(1,Math.round((hostRect?.height>1?hostRect.height:0) || vv?.height || (typeof window!=='undefined'?window.innerHeight:720) || 720));
 return {width,height};
}
function lkLogicalSceneSize(scene){
 const scale=Math.max(0.01,LK_RENDER_SCALE||1);
 return {width:Math.max(1,scene.scale.width/scale),height:Math.max(1,scene.scale.height/scale)};
}
function lkUiPointer(scene,pointer){
 const cam=scene?.cameras?.main;
 if(cam?.getWorldPoint){
  try{return cam.getWorldPoint(pointer.x,pointer.y); }catch{}
 }
 return {x:pointer.x/Math.max(0.01,LK_RENDER_SCALE||1),y:pointer.y/Math.max(0.01,LK_RENDER_SCALE||1)};
}
function lkWorldUiScale(scene,cam=scene?.cameras?.main){
 const zoom=Math.max(0.01,cam?.zoom||1);
 const canvas=scene?.game?.canvas;
 let backingScale=LK_RENDER_SCALE||1;
 try{
  const rect=canvas?.getBoundingClientRect?.();
  if(rect?.width>0&&rect?.height>0){
   const sx=(canvas.width||scene?.scale?.width||rect.width)/rect.width;
   const sy=(canvas.height||scene?.scale?.height||rect.height)/rect.height;
   if(Number.isFinite(sx)&&Number.isFinite(sy)&&sx>0&&sy>0)backingScale=(sx+sy)*0.5;
  }
 }catch{}
 return Math.max(0.05,backingScale/zoom);
}
function lkApplyTextResolution(game){
 const res=LK_TEXT_RESOLUTION;
 for(const scene of game?.scene?.getScenes?.(true)||[]){
  for(const obj of scene?.children?.list||[]){
   if(obj?.type==='Text' && typeof obj.setResolution==='function'){
    try{obj.setResolution(res);}catch{}
   }
  }
 }
}
function lkApplyRenderScale(game,value,{remember=true}={}){
 let target=value==='dpr' ? (typeof window!=='undefined'?window.devicePixelRatio||1:1) : Number(value);
 target=Phaser.Math.Clamp(Number.isFinite(target)?target:1,1,LK_RENDER_SCALE_MAX);
 LK_RENDER_SCALE=target;
 if(remember){try{localStorage.setItem(LK_RENDER_SCALE_STORAGE_KEY,String(target));}catch{}}
 const css=lkCssViewport();
 const renderW=Math.max(1,Math.round(css.width*target));
 const renderH=Math.max(1,Math.round(css.height*target));
 const scale=game?.scale;
 if(scale){
  try{scale.setGameSize(renderW,renderH);}catch{}
  try{scale.refresh?.();}catch{}
 }
 const canvas=game?.canvas;
 if(canvas){
  // Render scale changes the backing-buffer resolution only. The visible game
  // must always stay exactly the size of the #game host. Using percentages
  // here (reinforced by index.html !important rules) prevents Phaser FIT from
  // briefly shrinking/growing the canvas when quality is changed.
  canvas.style.width='100%';
  canvas.style.height='100%';
  canvas.style.maxWidth='100%';
  canvas.style.maxHeight='100%';
 }
 for(const scene of game?.scene?.getScenes?.(true)||[]){
  const key=scene?.sys?.settings?.key;
  if(key==='GameMenuScene'){
   scene.syncLayoutCamera?.();
   scene.redrawCurrentView?.();
  }else if(key==='HUDScene'){
   scene.cameras?.main?.setOrigin?.(0,0);
   scene.cameras?.main?.setZoom?.(target);
   scene.layout?.();
  }else if(key==='main'){
   scene.handleViewportResize?.();
  }else if(key==='BootScene'){
   scene.cameras?.main?.setOrigin?.(0,0);
   scene.cameras?.main?.setZoom?.(target);
  }else if(key==='PreloadScene'){
   scene.cameras?.main?.setOrigin?.(0,0);
   scene.cameras?.main?.setZoom?.(target);
   scene.layoutLoadingScreen?.();
  }else if(key==='CinematicScene'){
   scene.cameras?.main?.setOrigin?.(0,0);
   scene.cameras?.main?.setZoom?.(target);
   scene.layout?.();
  }
 }
 lkApplyTextResolution(game);
 return target;
}






const LOADING_ART_KEY='lastknight_loading_art';
const LOADING_SCREEN_STATUS='Loading';



const INITIAL_ASSET_CATEGORIES=[
 ASSET_CATEGORY.CORE,
 ASSET_CATEGORY.PROLOGUE,
 ASSET_CATEGORY.REGION_ASH,
 ASSET_CATEGORY.REGION_RUINS
];

class LastKnightUiLayoutEditor {
 constructor(devTools){
  this.devTools=devTools;
  this.scene=devTools.scene;
  this.editMode=false;
  this.selectedId='hpBar';
  this.profileMode='auto';
  this.snap=1;
  this.showSafeArea=true;
  this.showGrid=false;
  this.showBounds=true;
  this.dragState=null;
  this.positionClipboard=null;
  this.history=[];
  this.redoStack=[];
  this.maxHistory=160;
  this.storageKey='lastKnightDevUiLayoutV1';
  this.data=this.readSaved();
  this.graphics=null;
  this.lastHud=null;
  this.appliedHud=null;
 }

 defaultTransform(){
  return {dx:0,dy:0,scale:1,width:1,height:1,alpha:1,depth:0,fontScale:1,locked:false};
 }
 defaultData(){return {version:1,profiles:{desktop:{},mobileLandscape:{}}};}
 readSaved(){
  try{
   const raw=localStorage.getItem(this.storageKey);
   const parsed=raw?JSON.parse(raw):null;
   if(parsed?.profiles) return parsed;
  }catch{}
  return this.defaultData();
 }
 saveLocal(){
  try{localStorage.setItem(this.storageKey,JSON.stringify(this.data));}catch{}
  this.outputExport();
 }
 loadLocal(){
  this.data=this.readSaved();
  this.history=[];this.redoStack=[];
  this.apply();this.refreshPanel();
 }
 clearLocal(){try{localStorage.removeItem(this.storageKey);}catch{};}

 currentAutoProfile(){
  const hud=this.getHud();
  const logical=hud?lkLogicalSceneSize(hud):lkLogicalSceneSize(this.scene);
  const w=logical.width||1280;
  const h=logical.height||720;
  return (this.scene.isTouchDevice || h<520 || w<900)?'mobileLandscape':'desktop';
 }
 currentProfile(){return this.profileMode==='auto'?this.currentAutoProfile():this.profileMode;}
 profileData(profile=this.currentProfile()){
  if(!this.data.profiles[profile])this.data.profiles[profile]={};
  return this.data.profiles[profile];
 }
 getTransform(id=this.selectedId,profile=this.currentProfile()){
  const profileData=this.profileData(profile);
  if(!profileData[id])profileData[id]=this.defaultTransform();
  return profileData[id];
 }
 cloneData(){return JSON.parse(JSON.stringify(this.data));}
 pushHistory(){
  this.history.push(this.cloneData());
  if(this.history.length>this.maxHistory)this.history.shift();
  this.redoStack=[];
 }
 undo(){
  if(!this.history.length)return;
  this.redoStack.push(this.cloneData());
  this.data=this.history.pop();this.apply();this.refreshPanel();
 }
 redo(){
  if(!this.redoStack.length)return;
  this.history.push(this.cloneData());
  this.data=this.redoStack.pop();this.apply();this.refreshPanel();
 }

 getHud(){
  const hud=this.scene.scene?.get?.('HUDScene');
  if(hud && hud.sys?.isActive?.()){
   this.lastHud=hud;
   return hud;
  }
  return this.lastHud;
 }
 getGroups(){return this.getHud()?.getDevUiGroups?.()||{};}
 getGroup(id=this.selectedId){return this.getGroups()[id]||null;}
 getGroupBounds(group){
  if(!group)return null;
  const rects=[];
  for(const o of group.objects||[]){
   if(!o?.active||o.visible===false||!o.getBounds)continue;
   try{
    const b=o.getBounds();
    if(Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.width>=0&&b.height>=0)rects.push(b);
   }catch{}
  }
  if(!rects.length)return null;
  const left=Math.min(...rects.map(r=>r.x)),top=Math.min(...rects.map(r=>r.y));
  const right=Math.max(...rects.map(r=>r.right??(r.x+r.width))),bottom=Math.max(...rects.map(r=>r.bottom??(r.y+r.height)));
  return {x:left,y:top,left,top,right,bottom,width:right-left,height:bottom-top,centerX:(left+right)/2,centerY:(top+bottom)/2};
 }
 listElementIds(){return Object.keys(this.getGroups());}
 select(id){
  if(!this.getGroups()[id])return;
  this.selectedId=id;
  const sel=document.getElementById('lkdev-ui-element');if(sel)sel.value=id;
  this.refreshPanel();
 }

 setEditMode(on){
  this.editMode=Boolean(on);
  if(this.editMode){
   this.devTools.setEditMode(false);
   this.scene.setGameplayPaused('devUiEdit',true);
   this.ensureGraphics();
  }else{
   this.scene.setGameplayPaused('devUiEdit',false);
   this.dragState=null;
  }
  this.refreshPanel();this.devTools.refreshStateButtons();
 }
 ensureGraphics(){
  const hud=this.getHud();
  if(!hud)return null;
  if(this.graphics && this.graphics.scene===hud)return this.graphics;
  try{this.graphics?.destroy();}catch{}
  this.graphics=hud.add.graphics().setDepth(10000).setScrollFactor(0);
  return this.graphics;
 }
 destroy(){
  this.setEditMode(false);
  try{this.graphics?.destroy();}catch{}
  this.graphics=null;
 }

 snapValue(v){const s=Math.max(1,Number(this.snap)||1);return Math.round(v/s)*s;}
 mutate(mutator,{history=true}={}){
  if(!this.selectedId)return;
  const t=this.getTransform();
  if(t.locked && history)return;
  if(history)this.pushHistory();
  mutator(t);
  t.scale=Phaser.Math.Clamp(Number(t.scale)||1,0.15,4);
  t.width=Phaser.Math.Clamp(Number(t.width)||1,0.20,4);
  t.height=Phaser.Math.Clamp(Number(t.height)||1,0.20,4);
  t.alpha=Phaser.Math.Clamp(Number(t.alpha)||1,0.05,1);
  t.fontScale=Phaser.Math.Clamp(Number(t.fontScale)||1,0.35,3);
  t.depth=Math.round(Number(t.depth)||0);
  this.apply();this.refreshPanel();
 }
 apply(){
  const hud=this.getHud();
  if(!hud)return;
  hud.layout?.();
 }
 resetSelected(){
  if(!this.selectedId)return;
  this.pushHistory();
  this.profileData()[this.selectedId]=this.defaultTransform();
  this.apply();this.refreshPanel();
 }
 resetProfile(){
  this.pushHistory();
  this.data.profiles[this.currentProfile()]={};
  this.apply();this.refreshPanel();
 }
 resetAll(){
  this.pushHistory();
  this.data=this.defaultData();
  this.apply();this.refreshPanel();
 }
 toggleLock(){
  const t=this.getTransform();
  this.pushHistory();t.locked=!t.locked;this.refreshPanel();
 }
 copyPosition(){const t=this.getTransform();this.positionClipboard={dx:t.dx,dy:t.dy};this.refreshPanel();}
 pastePosition(){if(!this.positionClipboard)return;this.mutate(t=>{t.dx=this.positionClipboard.dx;t.dy=this.positionClipboard.dy;});}

 align(axis,mode){
  const hud=this.getHud(),group=this.getGroup();if(!hud||!group)return;
  const b=this.getGroupBounds(group);if(!b)return;
  const safe=hud.safe||hud.getSafeArea?.()||{top:0,right:0,bottom:0,left:0};
  const logical=lkLogicalSceneSize(hud),w=logical.width,h=logical.height;
  let delta=0;
  if(axis==='x'){
   const target=mode==='left'?safe.left:(mode==='right'?w-safe.right:w/2);
   const current=mode==='left'?b.left:(mode==='right'?b.right:b.centerX);
   delta=target-current;
   this.mutate(t=>{t.dx=this.snapValue(t.dx+delta)});
  }else{
   const target=mode==='top'?safe.top:(mode==='bottom'?h-safe.bottom:h/2);
   const current=mode==='top'?b.top:(mode==='bottom'?b.bottom:b.centerY);
   delta=target-current;
   this.mutate(t=>{t.dy=this.snapValue(t.dy+delta)});
  }
 }

 applyExactFromPanel(){
  const num=(id,fallback)=>{const v=Number(document.getElementById(id)?.value);return Number.isFinite(v)?v:fallback};
  this.mutate(t=>{
   t.dx=num('lkdev-ui-x',t.dx);t.dy=num('lkdev-ui-y',t.dy);
   t.scale=num('lkdev-ui-scale',t.scale);t.width=num('lkdev-ui-width',t.width);t.height=num('lkdev-ui-height',t.height);
   t.alpha=num('lkdev-ui-alpha',t.alpha);t.depth=num('lkdev-ui-depth',t.depth);t.fontScale=num('lkdev-ui-font',t.fontScale);
  });
 }

 handlePointerDown(pointer){
  if(!this.editMode)return false;
  const hud=this.getHud(),pp=hud?lkUiPointer(hud,pointer):{x:pointer.x,y:pointer.y};
  const x=pp.x,y=pp.y;
  const groups=this.getGroups();
  const candidates=[];
  for(const [id,g] of Object.entries(groups)){
   const b=this.getGroupBounds(g);if(!b)continue;
   if(x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom)candidates.push({id,b,area:Math.max(1,b.width*b.height),priority:g.priority||0});
  }
  if(candidates.length){
   candidates.sort((a,b)=>(b.priority-a.priority)||(a.area-b.area));
   this.select(candidates[0].id);
  }
  const t=this.getTransform();
  if(!t.locked){
   this.pushHistory();
   this.dragState={pointerId:pointer.id,startX:x,startY:y,startDx:t.dx,startDy:t.dy};
  }
  return true;
 }
 handlePointerMove(pointer){
  if(!this.editMode||!this.dragState||pointer.id!==this.dragState.pointerId)return false;
  const t=this.getTransform();
  const hud=this.getHud(),pp=hud?lkUiPointer(hud,pointer):{x:pointer.x,y:pointer.y};
  t.dx=this.snapValue(this.dragState.startDx+(pp.x-this.dragState.startX));
  t.dy=this.snapValue(this.dragState.startDy+(pp.y-this.dragState.startY));
  this.apply();this.refreshPanel(false);
  return true;
 }
 handlePointerUp(pointer){
  if(!this.editMode)return false;
  if(this.dragState&&pointer.id===this.dragState.pointerId)this.dragState=null;
  return true;
 }

 refreshElementSelect(){
  const select=document.getElementById('lkdev-ui-element');if(!select)return;
  const ids=this.listElementIds();
  const current=[...select.options].map(o=>o.value).join('|');
  if(current!==ids.join('|')){
   select.innerHTML='';
   for(const id of ids){const o=document.createElement('option');o.value=id;o.textContent=this.getGroups()[id]?.label||id;select.appendChild(o);}
  }
  if(ids.includes(this.selectedId))select.value=this.selectedId;
  else if(ids.length){this.selectedId=ids[0];select.value=this.selectedId;}
 }
 refreshPanel(updateSelect=true){
  if(updateSelect)this.refreshElementSelect();
  const psel=document.getElementById('lkdev-ui-profile');if(psel)psel.value=this.profileMode;
  const snap=document.getElementById('lkdev-ui-snap');if(snap)snap.value=String(this.snap);
  const t=this.getTransform();
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v};
  set('lkdev-ui-x',Math.round(t.dx));set('lkdev-ui-y',Math.round(t.dy));set('lkdev-ui-scale',Number(t.scale).toFixed(2));
  set('lkdev-ui-width',Number(t.width).toFixed(2));set('lkdev-ui-height',Number(t.height).toFixed(2));set('lkdev-ui-alpha',Number(t.alpha).toFixed(2));
  set('lkdev-ui-depth',Math.round(t.depth));set('lkdev-ui-font',Number(t.fontScale).toFixed(2));
  const info=document.getElementById('lkdev-ui-selected');
  const g=this.getGroup();const b=this.getGroupBounds(g);
  if(info)info.textContent=`${g?.label||this.selectedId} · ${this.currentProfile()}${t.locked?' · ЗАФИКСИРОВАНО':''}\nСмещение ${Math.round(t.dx)},${Math.round(t.dy)} · Масштаб ${t.scale.toFixed(2)} · Ширина ${t.width.toFixed(2)} · Высота ${t.height.toFixed(2)}${b?`\nЭкран ${Math.round(b.centerX)},${Math.round(b.centerY)} · ${Math.round(b.width)}×${Math.round(b.height)}`:''}`;
  const root=this.devTools.root;
  root?.querySelector('[data-action="uiEdit"]')?.classList.toggle('on',this.editMode);
  root?.querySelector('[data-action="uiLock"]')?.classList.toggle('on',Boolean(t.locked));
  root?.querySelector('[data-action="uiSafeArea"]')?.classList.toggle('on',this.showSafeArea);
  root?.querySelector('[data-action="uiGrid"]')?.classList.toggle('on',this.showGrid);
  root?.querySelector('[data-action="uiBounds"]')?.classList.toggle('on',this.showBounds);
 }

 exportObject(){
  const out={version:1,generatedAt:new Date().toISOString(),profileMode:this.profileMode,profiles:{}};
  for(const profile of ['desktop','mobileLandscape']){
   out.profiles[profile]={};
   const pd=this.data.profiles[profile]||{};
   for(const id of Object.keys(this.getGroups())){
    const t={...this.defaultTransform(),...(pd[id]||{})};
    out.profiles[profile][id]=t;
   }
  }
  out.active={profile:this.currentProfile(),element:this.selectedId,screen:{}};
  for(const [id,g] of Object.entries(this.getGroups())){
   const b=this.getGroupBounds(g);if(!b)continue;
   out.active.screen[id]={x:Math.round(b.x),y:Math.round(b.y),width:Math.round(b.width),height:Math.round(b.height),centerX:Math.round(b.centerX),centerY:Math.round(b.centerY)};
  }
  return out;
 }
 outputExport(){
  const txt=JSON.stringify(this.exportObject(),null,2);
  const out=document.getElementById('lkdev-ui-output');if(out)out.value=txt;
  return txt;
 }
 copyExport(){const txt=this.outputExport();try{navigator.clipboard?.writeText(txt);}catch{};}
 downloadExport(){
  const txt=this.outputExport();
  try{
   const blob=new Blob([txt],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=`last-knight-ui-layout-${this.currentProfile()}-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{}
 }

 draw(){
  const g=this.ensureGraphics();if(!g)return;g.clear();if(!this.editMode)return;
  const hud=this.getHud();if(!hud)return;
  const logical=lkLogicalSceneSize(hud),w=logical.width,h=logical.height,safe=hud.safe||{top:0,right:0,bottom:0,left:0};
  if(this.showGrid&&this.snap>=5){
   const step=this.snap===10?50:25;g.lineStyle(1,0xffffff,0.07);for(let x=0;x<w;x+=step){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.strokePath();}for(let y=0;y<h;y+=step){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.strokePath();}
  }
  if(this.showSafeArea){g.lineStyle(2,0x65d9ff,0.58);g.strokeRect(safe.left,safe.top,w-safe.left-safe.right,h-safe.top-safe.bottom);}
  if(this.showBounds){
   for(const [id,group] of Object.entries(this.getGroups())){
    if(id===this.selectedId)continue;
    const q=this.getGroupBounds(group);if(!q)continue;
    const outside=q.left<safe.left||q.top<safe.top||q.right>w-safe.right||q.bottom>h-safe.bottom;
    if(outside){g.lineStyle(1,0xff5f5f,0.45);g.strokeRect(q.x,q.y,q.width,q.height);}
   }
  }
  const b=this.getGroupBounds(this.getGroup());
  if(b&&this.showBounds){
   const outside=b.left<safe.left||b.top<safe.top||b.right>w-safe.right||b.bottom>h-safe.bottom;
   g.lineStyle(3,outside?0xff5f5f:0xffdf69,0.95);g.strokeRect(b.x,b.y,b.width,b.height);
   g.fillStyle(outside?0xff5f5f:0xffdf69,0.9);g.fillCircle(b.centerX,b.centerY,4);
  }
 }
 update(){
  const hud=this.scene.scene?.get?.('HUDScene');
  if(hud?.sys?.isActive?.() && hud!==this.appliedHud){this.appliedHud=hud;this.lastHud=hud;hud.layout?.();this.refreshPanel();}
  this.draw();
 }
}

class LastKnightDevTools {
 constructor(scene){
  this.scene=scene;
  this.enabled=DEV_BUILD;
  this.open=false;
  this.editMode=false;
  this.selected=null;
  this.history=[];
  this.redoStack=[];
  this.maxHistory=120;
  this.hiddenSegments=new Set();
  this.envVisibility={props:true,trees:true,rocks:true,grass:true,landmarks:true,shadows:true};
  this.overlayFlags={hitboxes:false,enemyRange:false,meleeRadius:false,championRange:false,propColliders:false,navigation:false,safeLane:false,cameraBounds:false,mobileFrame:false,desktopFrame:false};
  this.freeCamera=false;
  this.cameraLocked=false;
  this.cameraPan=null;
  this.envDrag=null;
  this.placingProp=false;
  this.createdPropCounter=0;
  this.hideGameUi=false;
  this.lastInfoAt=0;
  this.lastUpdateReal=performance.now();
  this.devLab={
   cameraFxKind:'none',
   playerFxKind:'none',
   ambient:new Map(),
   fxSelected:'fog',
   fxSettings:new Map(),
   light:null,
   lightEnabled:false,
   lightRadius:260,
   lightIntensity:1.6,
   lightTargets:new Set(),
   lastLightRefreshAt:0,
   impact:{hitStop:42,shakeX:8,shakeY:5,zoom:1.08,flash:0.28,slow:0.36,knockback:150,pitch:0,particles:'sparks'},
   camera2:{deadzone:false,lookAhead:false,threatLook:false,damping:0.12,minimap:null,pip:null,baseFollowOffsetX:0,baseFollowOffsetY:0},
   worldFx:{screenOverlay:null,screenOverlayKind:'none',fogMask:null,fogMaskGraphics:null,foreground:[],parallax:[],dynamicShadows:false,shadowMap:new Map(),depthSort:false,renderTexture:null,renderTextureBounds:null,proceduralTextures:new Set(),debris:[],chain:[],trail:false,lastTrailAt:0},
   audioLab:{rate:1,detune:0,pan:0,spatial:false,source:null,lastSound:null},
   audioMixer:{slots:[],gameplayMusicPaused:false,gameplayMusicRefs:[],loading:new Map(),maxSlots:12},
   boids:{enabled:false,list:[],separation:1.15,cohesion:0.72,alignment:0.78,wander:0.42},
   shaderLab:{kind:'none',fx:null},
   lastStatus:'Готово. F10 — открыть / закрыть панель.'
  };
  this.devLab.audioMixer.slots=this.createDefaultAudioMixerSlots();
  this.devLabPresetKey='lastKnight.dev.phaserLab.v1';

  // Low-overhead performance trace. Samples are aggregated at 4 Hz while
  // browser/page lifecycle transitions are recorded immediately, including
  // periods where Phaser's own update loop is throttled or suspended.
  this.performanceTrace=null;
  this.traceSampleIntervalMs=250;
  this.traceMaxSamples=14400; // ~60 minutes at 4 Hz
  this.traceMaxEvents=8000;
  this.traceLastSampleAt=0;
  this.traceFrameBucket=this.createTraceFrameBucket();
  this.traceSubsystemBucket=this.createTraceSubsystemBucket();
  this.traceLastEventSignatures=new Map();
  this.renderBenchmark=null;
  this.renderBenchmarkResults=[];
  this.adaptiveQuality=this.createAdaptiveQualityState();
  this.traceBrowserHandlers=null;
  this.traceGameHandlers=null;
  this.traceScaleResizeHandler=null;
  this.traceContextLostHandler=null;
  this.traceContextRestoredHandler=null;
  this.savedLayout=this.readSavedLayout();
  this.uiEditor=new LastKnightUiLayoutEditor(this);
  this.root=null;
  this.button=null;
  this.panelInputCapture=false;
  this.panelInputStates=new Map();
  this.graphics=null;
  this.camKeys=null;
  this.pointerHandler=(pointer)=>this.handleWorldPointer(pointer);
  this.pointerMoveHandler=(pointer)=>this.handleDevPointerMove(pointer);
  this.pointerUpHandler=(pointer)=>this.handleDevPointerUp(pointer);
  this.wheelHandler=(pointer,gameObjects,deltaX,deltaY,deltaZ)=>this.handleCameraWheel(pointer,deltaY);
  this.contextMenuHandler=(event)=>{if(this.freeCamera||this.editMode)event.preventDefault();};
  this.keyHandler=(event)=>{
   if(event.key==='F10'){
    event.preventDefault();
    this.togglePanel();
   }
   if(event.key==='Escape' && this.editMode){this.setEditMode(false);}
  };
 }

 install(){
  if(!this.enabled || typeof document==='undefined') return;
  this.installStyle();
  this.buildDom();
  // The in-game HUD owns the DEV button; F10 remains the keyboard fallback.
  this.graphics=this.scene.add.graphics().setDepth(5000);
  this.camKeys=this.scene.input.keyboard.addKeys({up:'I',down:'K',left:'J',right:'L'});
  this.scene.input.on('pointerdown',this.pointerHandler);
  this.scene.input.on('pointermove',this.pointerMoveHandler);
  this.scene.input.on('pointerup',this.pointerUpHandler);
  this.scene.input.on('pointerupoutside',this.pointerUpHandler);
  this.scene.input.on('wheel',this.wheelHandler);
  this.scene.game?.canvas?.addEventListener?.('contextmenu',this.contextMenuHandler);
  document.addEventListener('keydown',this.keyHandler);
  this.installTraceListeners();
  for(const object of this.scene.devEnvironmentObjects||[]) this.applySavedOverrideToObject(object);
  this.restoreCreatedObjectsFromSaved();
  // Saved environment layout must never reopen the game with an editor selection.
  this.selected=null;
  this.applyAllEnvironmentVisibility();
  this.refreshSelectedPanel();
  this.refreshStateButtons();
  this.refreshTraceUi();
  this.refreshAdaptiveQualityUi(true);
  this.uiEditor.refreshPanel();
  window.__LK_DEV=this;
 }

 destroy(){
  try{this.scene.input.off('pointerdown',this.pointerHandler);}catch{}
  try{this.scene.input.off('pointermove',this.pointerMoveHandler);}catch{}
  try{this.scene.input.off('pointerup',this.pointerUpHandler);}catch{}
  try{this.scene.input.off('pointerupoutside',this.pointerUpHandler);}catch{}
  try{this.scene.input.off('wheel',this.wheelHandler);}catch{}
  try{this.scene.game?.canvas?.removeEventListener?.('contextmenu',this.contextMenuHandler);}catch{}
  document.removeEventListener('keydown',this.keyHandler);
  this.removeTraceListeners();
  this.clearDevLabEffects?.({silent:true});
  this.setPanelInputCapture(false,true);
  this.uiEditor?.destroy();
  this.graphics?.destroy();
  this.root?.remove();
  this.button?.remove();
  if(window.__LK_DEV===this) delete window.__LK_DEV;
 }


 installStyle(){
  if(document.getElementById('lk-dev-style')) return;
  const style=document.createElement('style');
  style.id='lk-dev-style';
  style.textContent=`
   :root{--lkdev-gold:#d6b56d;--lkdev-gold2:#ffe0a0;--lkdev-bg:#0b0c0deF;--lkdev-card:#141618;--lkdev-border:#35383b;--lkdev-muted:#969b9f;--lkdev-green:#78cf91;--lkdev-red:#ef8078;--lkdev-blue:#8fc9f4}
   #lk-dev-button{position:fixed;right:14px;top:14px;z-index:100001;border:1px solid #8f7644;background:linear-gradient(180deg,#211d16ee,#11110fee);color:#f4d895;border-radius:9px;padding:8px 11px;font:800 11px/1 system-ui;letter-spacing:.08em;box-shadow:0 6px 22px #0009;cursor:pointer;touch-action:manipulation;backdrop-filter:blur(7px)}
   #lk-dev-button:hover{border-color:#d6b56d;background:#282116}
   #lk-dev-panel{position:fixed;right:10px;top:10px;bottom:10px;width:min(446px,calc(100vw - 20px));z-index:100002;background:var(--lkdev-bg);color:#e8e8e5;border:1px solid #826d43;border-radius:14px;box-shadow:0 14px 54px #000d;display:none;overflow:hidden;font:12px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;touch-action:pan-y;backdrop-filter:blur(12px)}
   #lk-dev-panel.open{display:flex;flex-direction:column}
   #lk-dev-panel *{box-sizing:border-box}
   .lkdev-head{display:flex;align-items:center;gap:10px;padding:11px 12px;background:linear-gradient(180deg,#211d16,#141310);border-bottom:1px solid #584b31;flex:0 0 auto}.lkdev-head-text{min-width:0;flex:1}.lkdev-title{font-weight:900;color:var(--lkdev-gold2);letter-spacing:.055em;font-size:13px}.lkdev-subtitle{color:#a99d83;font-size:10px;margin-top:2px}.lkdev-close{font-size:21px!important;background:none!important;border:0!important;padding:2px 7px!important;color:#ddd!important;min-height:30px!important}
   .lkdev-status{margin:8px 9px 2px;padding:7px 9px;border:1px solid #3b3e3f;border-radius:8px;background:#0a0b0c;color:#bec9c0;font-size:10.5px;line-height:1.35}
   .lkdev-scroll{overflow:auto;padding:7px 8px 14px;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:#62533a #111}
   .lkdev-section{border:1px solid var(--lkdev-border);border-radius:9px;margin:0 0 7px;background:#121416e8;overflow:hidden}.lkdev-section>summary{cursor:pointer;padding:8px 10px;font-weight:850;color:#dac89f;background:linear-gradient(90deg,#1f1c16,#17191a);position:sticky;top:0;letter-spacing:.025em}.lkdev-section[open]>summary{border-bottom:1px solid #302d27}.lkdev-body{padding:8px}.lkdev-note{color:#8f979c;font-size:10px;line-height:1.35;margin:5px 1px 7px}.lkdev-label{color:#a6aaac;font-size:10px;margin:7px 1px 3px;font-weight:700}.lkdev-divider{height:1px;background:#2b2d2f;margin:8px 0}
   .lkdev-row{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0}.lkdev-row>*{flex:1 1 auto;min-width:0}.lkdev-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.lkdev-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.lkdev-grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.lkdev-ai-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.lkdev-ai-grid button{min-height:36px!important;text-align:left;padding-left:9px!important}.lkdev-ai-desc{margin-top:7px;border-color:#665633!important;color:#e1d4b7!important}
   #lk-dev-panel button,#lk-dev-panel select,#lk-dev-panel input,#lk-dev-panel textarea{background:#202326;color:#ecece8;border:1px solid #414548;border-radius:6px;padding:6px 7px;font:11px system-ui;min-height:31px}#lk-dev-panel button{cursor:pointer;touch-action:manipulation;font-weight:650}#lk-dev-panel button:hover{background:#2d302f;border-color:#666057}#lk-dev-panel button.on{background:#5b4828;border-color:#d6b56d;color:#fff0c6;box-shadow:inset 0 0 0 1px #d6b56d33}#lk-dev-panel button.danger{border-color:#79413e;color:#ffb1aa}#lk-dev-panel button.good{border-color:#3e6749;color:#baf0c8}#lk-dev-panel button.blue{border-color:#385c73;color:#b9e3ff}
   #lk-dev-panel input[type=range]{padding:0;min-height:28px;accent-color:#c9a75d}.lkdev-range{display:grid;grid-template-columns:105px 1fr 48px;align-items:center;gap:7px;margin:5px 0}.lkdev-range b{color:#e7d6ad;font-size:10px;text-align:right}
   .lkdev-info{white-space:pre-wrap;color:#bfc9bc;background:#090a0b;padding:8px;border:1px solid #25282a;border-radius:6px;font:10.5px/1.42 ui-monospace,"Cascadia Mono",monospace}.lkdev-selected{color:#ffdf8e;font:10.5px/1.35 ui-monospace,monospace;white-space:pre-wrap}.lkdev-output{width:100%;height:92px;resize:vertical;font:10px/1.2 ui-monospace,monospace!important}.lkdev-badge{display:inline-block;padding:2px 6px;border-radius:999px;border:1px solid #4b4f51;color:#b8bec2;font-size:9px;margin-left:4px}
   .lkdev-collapse-all{white-space:nowrap!important;flex:0 0 auto!important;min-height:28px!important;padding:4px 8px!important;font-size:10px!important;border-color:#665633!important;color:#e4d1a4!important;background:#1c1a16!important}.lkdev-mixer-card{border:1px solid #35383b;border-radius:8px;background:#0e1011;padding:7px;margin:7px 0}.lkdev-mixer-head{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#e7d5ad;font-weight:800;font-size:10.5px;margin-bottom:5px}.lkdev-mixer-state{color:#7fa98a;font:9.5px ui-monospace,monospace}.lkdev-mixer-card select{width:100%;margin-bottom:5px}.lkdev-mixer-card .lkdev-range{grid-template-columns:64px 1fr 48px}.lkdev-mixer-card .lkdev-range span{font-size:9.5px}.lkdev-mixer-card .lkdev-range b{font-size:9.5px}
   @media(max-width:520px){#lk-dev-panel{right:5px;top:5px;bottom:5px;width:calc(100vw - 10px)}.lkdev-grid4{grid-template-columns:repeat(2,minmax(0,1fr))}.lkdev-ai-grid{grid-template-columns:1fr}.lkdev-range{grid-template-columns:90px 1fr 42px}}
   @media(max-height:620px){.lkdev-section>summary{padding:6px 8px}.lkdev-body{padding:6px}#lk-dev-panel button,#lk-dev-panel select,#lk-dev-panel input{min-height:27px;padding:4px 5px}}
  `;
  document.head.appendChild(style);
 }

 buildDevLauncher(){
  if(this.button || typeof document==='undefined')return;
  const btn=document.createElement('button');
  btn.id='lk-dev-button';
  btn.type='button';
  btn.textContent='DEV · F10';
  btn.title='Открыть лабораторию Phaser';
  btn.addEventListener('click',()=>this.togglePanel(true));
  document.body.appendChild(btn);
  this.button=btn;
 }

 getAudioMixerLibrary(){
  const seen=new Set();
  return ASSET_MANIFEST
   .filter(entry=>entry?.type==='audio'&&entry?.key&&entry?.url&&!seen.has(entry.key)&&seen.add(entry.key))
   .map(entry=>{
    const override=DEV_AUDIO_MIXER_META_OVERRIDES[entry.key]||{};
    const fallback=String(entry.key).replace(/^bgm_/,'').replace(/^sfx_/,'').replaceAll('_',' ').replace(/\b\w/g,ch=>ch.toUpperCase());
    const music=override.music!==undefined?Boolean(override.music):/^bgm_/i.test(entry.key);
    return {key:entry.key,url:entry.url,category:entry.category||'CORE',requirement:entry.requirement,label:override.label||fallback,music,volume:override.volume??(music?0.50:0.50),loop:override.loop!==undefined?Boolean(override.loop):music};
   })
   .sort((a,b)=>{const ac=String(a.category),bc=String(b.category);if(ac!==bc)return ac.localeCompare(bc);if(a.music!==b.music)return a.music?-1:1;return a.label.localeCompare(b.label,'ru');});
 }
 getAudioMixerMeta(key){return this.getAudioMixerLibrary().find(item=>item.key===key)||null;}
 createAudioMixerSlot(key=''){
  const meta=this.getAudioMixerMeta(key);
  return {key:key||'',volume:meta?.volume??0.50,rate:1,detune:0,pan:0,loop:Boolean(meta?.loop),muted:false,sound:null,loading:false};
 }
 createDefaultAudioMixerSlots(){
  return [this.createAudioMixerSlot('bgm_veil_of_the_past'),this.createAudioMixerSlot('sfx_skeleton_sword_attack'),this.createAudioMixerSlot('sfx_hero_death'),this.createAudioMixerSlot('sfx_crow_wings')];
 }
 buildAudioMixerOptions(selectedKey=''){
  const esc=(value)=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const groups=new Map();
  for(const item of this.getAudioMixerLibrary()){if(!groups.has(item.category))groups.set(item.category,[]);groups.get(item.category).push(item);}
  const options=['<option value="">— пустой канал —</option>'];
  for(const [category,items] of groups){
   options.push(`<optgroup label="${esc(DEV_AUDIO_CATEGORY_LABELS[category]||category)}">`);
   for(const item of items){const ready=this.scene?.cache?.audio?.exists?.(item.key);options.push(`<option value="${esc(item.key)}"${item.key===selectedKey?' selected':''}>${ready?'●':'○'} ${esc(item.label)}</option>`);}
   options.push('</optgroup>');
  }
  return options.join('');
 }
 buildAudioMixerSlotHtml(index){
  const slot=this.devLab.audioMixer.slots[index]||this.createAudioMixerSlot('');
  return `<div class="lkdev-mixer-card" id="lkdev-mixer-slot-${index}">
   <div class="lkdev-mixer-head"><span>КАНАЛ ${index+1}</span><span class="lkdev-mixer-state" id="lkdev-mixer-state-${index}">СТОП</span></div>
   <select data-mixer-select="${index}">${this.buildAudioMixerOptions(slot.key)}</select>
   <div class="lkdev-grid4"><button data-action="mixerPlay" data-value="${index}" class="good">▶ Play</button><button data-action="mixerStop" data-value="${index}">■ Stop</button><button data-action="mixerLoop" data-value="${index}">Loop</button><button data-action="mixerMute" data-value="${index}">Mute</button></div>
   <label class="lkdev-range"><span>Volume</span><input data-mixer-range="${index}:volume" type="range" min="0" max="1.5" step="0.01" value="${slot.volume}"><b id="lkdev-mixer-volume-${index}">${slot.volume.toFixed(2)}</b></label>
   <label class="lkdev-range"><span>Rate</span><input data-mixer-range="${index}:rate" type="range" min="0.5" max="1.75" step="0.01" value="${slot.rate}"><b id="lkdev-mixer-rate-${index}">${slot.rate.toFixed(2)}×</b></label>
   <label class="lkdev-range"><span>Pitch</span><input data-mixer-range="${index}:detune" type="range" min="-1200" max="1200" step="25" value="${slot.detune}"><b id="lkdev-mixer-detune-${index}">${Math.round(slot.detune)}ct</b></label>
   <label class="lkdev-range"><span>Pan</span><input data-mixer-range="${index}:pan" type="range" min="-1" max="1" step="0.01" value="${slot.pan}"><b id="lkdev-mixer-pan-${index}">${slot.pan.toFixed(2)}</b></label>
  </div>`;
 }

 buildDom(){
  const root=document.createElement('div');
  root.id='lk-dev-panel';
  root.innerHTML=`
   <div class="lkdev-head">
    <div class="lkdev-head-text"><div class="lkdev-title">LAST KNIGHT · ЛАБОРАТОРИЯ PHASER</div><div class="lkdev-subtitle">F10 — открыть / закрыть · всё ниже предназначено только для разработки</div></div>
    <button class="lkdev-collapse-all" data-action="collapseAll" title="Свернуть все разделы">Свернуть все</button>
    <button class="lkdev-close" data-action="close" title="Закрыть">×</button>
   </div>
   <div id="lkdev-status" class="lkdev-status">Готово. Выбери механику и проверяй её прямо в текущей сцене.</div>
   <div class="lkdev-scroll">

    <details class="lkdev-section" open><summary>БЫСТРЫЙ СТАРТ · МИР И ВРЕМЯ</summary><div class="lkdev-body">
     <div class="lkdev-row"><button data-action="pause">Пауза мира</button><button data-action="resume" class="good">Продолжить</button><button data-action="autoSpawns">Автоспавн</button></div>
     <div class="lkdev-label">Скорость времени</div><div class="lkdev-grid4"><button data-action="time" data-value="0.25">0.25×</button><button data-action="time" data-value="0.5">0.5×</button><button data-action="time" data-value="1">1×</button><button data-action="time" data-value="2">2×</button></div>
     <div class="lkdev-label">Быстрый переход в наш основной тест</div><div class="lkdev-row"><button data-action="wave6Lab" class="blue">Акт 2 · Волна 6</button></div>
     <div class="lkdev-label">Готовые наборы для теста</div><div class="lkdev-grid3"><button data-action="labPreset" data-value="combat">Бой</button><button data-action="labPreset" data-value="atmosphere">Атмосфера</button><button data-action="labPreset" data-value="boss">Босс</button><button data-action="labPreset" data-value="critical">Мало HP</button><button data-action="labPresetSave" class="good">Сохранить мой</button><button data-action="labPresetLoad">Загрузить мой</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>КАМЕРА И КИНО</summary><div class="lkdev-body">
     <div class="lkdev-note">Встроенные Camera FX Phaser: shake, flash, fade, pan/zoom. Удобно подбирать силу ударов, боссов и сюжетных моментов.</div>
     <div class="lkdev-label">Тряска</div><div class="lkdev-grid3"><button data-action="cameraFx" data-value="shakeSoft">Лёгкая</button><button data-action="cameraFx" data-value="shakeHit">Сильный удар</button><button data-action="cameraFx" data-value="shakeQuake">Землетрясение</button></div>
     <div class="lkdev-label">Киноэффекты</div><div class="lkdev-grid3"><button data-action="cameraFx" data-value="zoomPulse">Зум-акцент</button><button data-action="cameraFx" data-value="bossFocus">Фокус на враге</button><button data-action="cameraFx" data-value="rotationHit">Наклон удара</button><button data-action="cameraFx" data-value="flashWhite">Белая вспышка</button><button data-action="cameraFx" data-value="flashRed">Красная вспышка</button><button data-action="cameraFx" data-value="fade">Затемнение</button></div>
     <div class="lkdev-divider"></div>
     <div class="lkdev-grid4"><button data-action="zoom" data-value="0.75">Масштаб .75</button><button data-action="zoom" data-value="1">Масштаб 1.0</button><button data-action="zoom" data-value="1.25">Масштаб 1.25</button><button data-action="zoom" data-value="1.5">Масштаб 1.5</button></div>
     <div class="lkdev-row"><button data-action="followCamera">За героем</button><button data-action="lockCamera">Зафиксировать</button><button data-action="freeCamera">Свободная · IJKL</button><button data-action="cameraFx" data-value="reset">Сброс камеры</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>POST FX · WEBGL <span class="lkdev-badge">Phaser 3.90</span></summary><div class="lkdev-body">
     <div class="lkdev-note">Эффекты применяются ко всей камере. Свечение (Bloom) и размытие заметно тяжелее обычной цветокоррекции — поэтому рядом есть замеры FPS.</div>
     <div class="lkdev-grid3"><button data-action="postFx" data-value="vignette">Виньетка</button><button data-action="postFx" data-value="bloom">Свечение (Bloom)</button><button data-action="postFx" data-value="blur">Размытие</button><button data-action="postFx" data-value="pixelate">Пикселизация</button><button data-action="postFx" data-value="barrel">Искажение</button><button data-action="postFx" data-value="bokeh">Боке</button><button data-action="postFx" data-value="grayscale">Ч/Б</button><button data-action="postFx" data-value="sepia">Сепия</button><button data-action="postFx" data-value="night">Ночной тон</button></div>
     <div class="lkdev-label">FX только на герое — дешевле, чем эффект на всю камеру</div><div class="lkdev-grid3"><button data-action="playerFx" data-value="glow">Свечение</button><button data-action="playerFx" data-value="bloom">Свечение героя</button><button data-action="playerFx" data-value="shine">Блик</button></div>
     <div class="lkdev-row"><button data-action="postFx" data-value="clear">Очистить FX камеры</button><button data-action="playerFx" data-value="clear">Очистить FX героя</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>FX LAB · ЧАСТИЦЫ И АТМОСФЕРА</summary><div class="lkdev-body">
     <div class="lkdev-note">Выбери эффект, включи постоянный тест или сделай одиночный выброс. Ползунки меняют эффект сразу. Всё создаётся Phaser на лету и не затрагивает основной билд.</div>
     <div class="lkdev-label">Выбери эффект</div>
     <div class="lkdev-grid3">
      <button data-action="fxSelect" data-value="fog">Туман</button><button data-action="fxSelect" data-value="smoke">Дым</button><button data-action="fxSelect" data-value="fire">Огонь</button>
      <button data-action="fxSelect" data-value="ash">Пепел</button><button data-action="fxSelect" data-value="embers">Угли</button><button data-action="fxSelect" data-value="sparks">Искры</button>
      <button data-action="fxSelect" data-value="blood">Кровь</button><button data-action="fxSelect" data-value="bones">Кости</button><button data-action="fxSelect" data-value="debris">Обломки</button>
      <button data-action="fxSelect" data-value="magic">Магия</button>
     </div>
     <div id="lkdev-fx-description" class="lkdev-status lkdev-ai-desc">Туман</div>
     <div class="lkdev-label">Тест</div>
     <div class="lkdev-grid3"><button data-action="fxToggle" class="good">Постоянно ВКЛ/ВЫКЛ</button><button data-action="fxBurst" class="blue">Один выброс</button><button data-action="clearParticles">Убрать всё</button></div>
     <div class="lkdev-label">Быстрые пресеты</div>
     <div class="lkdev-grid4"><button data-action="fxPreset" data-value="light">Слабый</button><button data-action="fxPreset" data-value="normal">Обычный</button><button data-action="fxPreset" data-value="heavy">Сильный</button><button data-action="fxPreset" data-value="cinema">Кино</button></div>
     <div class="lkdev-label">Где держать постоянный эффект</div>
     <div class="lkdev-grid3"><button data-action="fxFollow" data-value="camera">Камера</button><button data-action="fxFollow" data-value="player">Герой</button><button data-action="fxFollow" data-value="fixed">Точка на карте</button></div>
     <div class="lkdev-divider"></div>
     <label class="lkdev-range"><span>Плотность</span><input data-dev-range="fxDensity" type="range" min="0.25" max="3" step="0.05" value="1"><b id="lkdev-fx-density">1.00×</b></label>
     <label class="lkdev-range"><span>Размер</span><input data-dev-range="fxSize" type="range" min="0.25" max="3" step="0.05" value="1"><b id="lkdev-fx-size">1.00×</b></label>
     <label class="lkdev-range"><span>Скорость</span><input data-dev-range="fxSpeed" type="range" min="0.15" max="3" step="0.05" value="1"><b id="lkdev-fx-speed">1.00×</b></label>
     <label class="lkdev-range"><span>Прозрачн.</span><input data-dev-range="fxAlpha" type="range" min="0.15" max="2.5" step="0.05" value="1"><b id="lkdev-fx-alpha">1.00×</b></label>
     <label class="lkdev-range"><span>Время жизни</span><input data-dev-range="fxLife" type="range" min="0.25" max="3" step="0.05" value="1"><b id="lkdev-fx-life">1.00×</b></label>
     <label class="lkdev-range"><span>Разброс</span><input data-dev-range="fxSpread" type="range" min="0.25" max="3" step="0.05" value="1"><b id="lkdev-fx-spread">1.00×</b></label>
     <div class="lkdev-row"><button data-action="fxCopy" class="good">Скопировать параметры эффекта</button></div>
     <textarea id="lkdev-fx-output" class="lkdev-output" readonly placeholder="Здесь появятся параметры, которые можно прислать мне для переноса в основной билд."></textarea>
    </div></details>

    <details class="lkdev-section"><summary>СВЕТ 2D · LIGHT2D</summary><div class="lkdev-body">
     <div class="lkdev-note">Настоящий Phaser Light2D. В тесте свет следует за героем и временно переводит ближайшие спрайты в конвейер Light2D.</div>
     <div class="lkdev-row"><button data-action="lightToggle" class="good">Свет героя ВКЛ/ВЫКЛ</button><button data-action="lightPulse">Пульсация света</button></div>
     <label class="lkdev-range"><span>Радиус</span><input data-dev-range="lightRadius" type="range" min="100" max="600" step="10" value="260"><b id="lkdev-light-radius">260</b></label>
     <label class="lkdev-range"><span>Интенсивность</span><input data-dev-range="lightIntensity" type="range" min="0.2" max="3" step="0.1" value="1.6"><b id="lkdev-light-intensity">1.6</b></label>
    </div></details>

    <details class="lkdev-section" open><summary>IMPACT LAB · ОЩУЩЕНИЕ УДАРА</summary><div class="lkdev-body">
     <div class="lkdev-note">Собирает hit-stop, направленную тряску, zoom, flash, slow-motion, частицы, knockback и pitch звука в один профиль. Нажми пресет, затем «ТЕСТ УДАРА».</div>
     <div class="lkdev-grid3"><button data-action="impactPreset" data-value="light">Лёгкий</button><button data-action="impactPreset" data-value="heavy">Тяжёлый</button><button data-action="impactPreset" data-value="critical">Крит</button><button data-action="impactPreset" data-value="boss">Удар босса</button><button data-action="impactPreset" data-value="death">Смерть босса</button><button data-action="impactTest" class="good">ТЕСТ УДАРА</button></div>
     <label class="lkdev-range"><span>Hit-stop</span><input data-dev-range="impactHitStop" type="range" min="0" max="120" step="2" value="42"><b id="lkdev-impact-hitstop">42 ms</b></label>
     <label class="lkdev-range"><span>Shake X</span><input data-dev-range="impactShakeX" type="range" min="0" max="24" step="1" value="8"><b id="lkdev-impact-shakex">8</b></label>
     <label class="lkdev-range"><span>Shake Y</span><input data-dev-range="impactShakeY" type="range" min="0" max="24" step="1" value="5"><b id="lkdev-impact-shakey">5</b></label>
     <label class="lkdev-range"><span>Zoom</span><input data-dev-range="impactZoom" type="range" min="1" max="1.28" step="0.01" value="1.08"><b id="lkdev-impact-zoom">1.08×</b></label>
     <label class="lkdev-range"><span>Flash</span><input data-dev-range="impactFlash" type="range" min="0" max="1" step="0.05" value="0.28"><b id="lkdev-impact-flash">0.28</b></label>
     <label class="lkdev-range"><span>Slow-mo</span><input data-dev-range="impactSlow" type="range" min="0.1" max="1" step="0.02" value="0.36"><b id="lkdev-impact-slow">0.36×</b></label>
     <label class="lkdev-range"><span>Knockback</span><input data-dev-range="impactKnockback" type="range" min="0" max="320" step="10" value="150"><b id="lkdev-impact-knockback">150</b></label>
     <label class="lkdev-range"><span>Pitch</span><input data-dev-range="impactPitch" type="range" min="-1200" max="1200" step="50" value="0"><b id="lkdev-impact-pitch">0 ct</b></label>
     <div class="lkdev-label">Частицы удара</div><div class="lkdev-grid4"><button data-action="impactParticles" data-value="sparks">Искры</button><button data-action="impactParticles" data-value="blood">Кровь</button><button data-action="impactParticles" data-value="bones">Кости</button><button data-action="impactParticles" data-value="debris">Обломки</button></div>
     <div class="lkdev-row"><button data-action="impactCopy" class="good">Скопировать профиль удара</button></div><textarea id="lkdev-impact-output" class="lkdev-output" readonly></textarea>
    </div></details>

    <details class="lkdev-section" open><summary>CAMERA LAB 2.0 · ПОВЕДЕНИЕ КАМЕРЫ</summary><div class="lkdev-body">
     <div class="lkdev-note">Не одноразовые FX, а поведение камеры: deadzone, плавность, look-ahead, смещение к угрозе, несколько камер и направленные профили shake.</div>
     <div class="lkdev-grid3"><button data-action="camera2" data-value="deadzone">Deadzone</button><button data-action="camera2" data-value="lookAhead">Look-ahead</button><button data-action="camera2" data-value="threat">Смотреть к угрозе</button><button data-action="camera2" data-value="dampingSoft">Плавность</button><button data-action="camera2" data-value="dampingTight">Жёстче</button><button data-action="camera2" data-value="reset">Сброс 2.0</button></div>
     <div class="lkdev-label">Процедурная тряска</div><div class="lkdev-grid4"><button data-action="procShake" data-value="step">Шаг босса</button><button data-action="procShake" data-value="impact">Удар</button><button data-action="procShake" data-value="explosion">Взрыв</button><button data-action="procShake" data-value="quake">Землетрясение</button></div>
     <div class="lkdev-label">Несколько камер</div><div class="lkdev-grid3"><button data-action="extraCamera" data-value="minimap">Миникарта</button><button data-action="extraCamera" data-value="pip">PiP врага</button><button data-action="extraCamera" data-value="clear">Убрать доп. камеры</button></div>
    </div></details>

    <details class="lkdev-section"><summary>SHADER / COLOR LAB · WEBGL</summary><div class="lkdev-body">
     <div class="lkdev-note">Безопасные эксперименты поверх PostFX: тепловое искажение, displacement, цветокоррекция зон и blend-mode демонстрации. Если конкретный PostFX недоступен в renderer — панель просто сообщит об этом.</div>
     <div class="lkdev-grid3"><button data-action="shaderLab" data-value="heat">Heat haze</button><button data-action="shaderLab" data-value="displace">Displacement</button><button data-action="shaderLab" data-value="chromatic">Хроматич. сдвиг</button><button data-action="shaderLab" data-value="cold">Холодная зона</button><button data-action="shaderLab" data-value="warm">Тёплая зона</button><button data-action="shaderLab" data-value="contrast">Контраст</button></div>
     <div class="lkdev-row"><button data-action="blendDemo" data-value="add">Blend ADD</button><button data-action="blendDemo" data-value="multiply">Blend MULTIPLY</button><button data-action="shaderLab" data-value="clear">Очистить Shader Lab</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>WORLD FX LAB · СЛЕДЫ, МАСКИ, СЛОИ, РАЗРУШЕНИЕ</summary><div class="lkdev-body">
     <div class="lkdev-note">RenderTexture / DynamicTexture, маски, screen-space FX, foreground, parallax, depth-sort, динамические тени и разрушаемые тестовые объекты.</div>
     <div class="lkdev-label">Следы на земле · RenderTexture / procedural texture</div><div class="lkdev-grid3"><button data-action="decal" data-value="blood">Лужа крови</button><button data-action="decal" data-value="scorch">Ожог земли</button><button data-action="decal" data-value="rune">Руна</button><button data-action="decal" data-value="crack">Трещина</button><button data-action="decal" data-value="footprints">Следы ног</button><button data-action="trailToggle">След героя ВКЛ/ВЫКЛ</button><button data-action="decal" data-value="clear">Очистить следы</button></div>
     <div class="lkdev-label">Маски и экранные эффекты</div><div class="lkdev-grid3"><button data-action="fogMask">Туман вокруг героя</button><button data-action="screenFx" data-value="blood">Кровь на экране</button><button data-action="screenFx" data-value="dirt">Грязь</button><button data-action="screenFx" data-value="cracks">Трещины экрана</button><button data-action="screenFx" data-value="ash">Пепел на экране</button><button data-action="screenFx" data-value="clear">Очистить экран</button></div>
     <div class="lkdev-label">Глубина сцены</div><div class="lkdev-grid3"><button data-action="worldLayer" data-value="depth">Depth = Y</button><button data-action="worldLayer" data-value="foreground">Foreground</button><button data-action="worldLayer" data-value="parallax">Parallax</button><button data-action="worldLayer" data-value="shadows">Динамич. тени</button><button data-action="destruction" data-value="crate">Разбить объект</button><button data-action="worldLayer" data-value="clear">Очистить слои</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>AUDIO MIXER LAB · МУЛЬТИТРЕК</summary><div class="lkdev-body">
     <div class="lkdev-note">Каждый канал может выбрать любой звук из общего assetManifest. Незагруженные звуки автоматически подгружаются по требованию. У каждого канала свои Volume, Rate, Pitch, Pan, Loop и Mute.</div>
     <div class="lkdev-grid4"><button data-action="mixerPlayAll" class="good">▶ Запустить сет</button><button data-action="mixerRestartAll" class="blue">↻ С начала</button><button data-action="mixerStopAll">■ Стоп все</button><button data-action="mixerCopy">Копировать сет</button></div>
     <div class="lkdev-grid3"><button data-action="mixerAddSlot">＋ Канал</button><button data-action="mixerRemoveSlot">− Канал</button><button data-action="mixerReloadLibrary" class="blue">↻ Список звуков</button></div>
     <div class="lkdev-note">● — уже загружен · ○ — будет подгружен автоматически. Новые аудио-ассеты, добавленные в <b>assetManifest.mjs</b>, автоматически появляются в выпадающих списках.</div>
     <div id="lkdev-mixer-slots">${this.devLab.audioMixer.slots.map((_,index)=>this.buildAudioMixerSlotHtml(index)).join('')}</div>
     <textarea id="lkdev-mixer-output" class="lkdev-output" readonly placeholder="Параметры всего аудио-сета для переноса в основной билд."></textarea>
     <div class="lkdev-divider"></div>
     <div class="lkdev-label">Быстрый старый Audio Lab · один источник</div>
     <label class="lkdev-range"><span>Rate</span><input data-dev-range="audioRate" type="range" min="0.55" max="1.6" step="0.05" value="1"><b id="lkdev-audio-rate">1.00×</b></label>
     <label class="lkdev-range"><span>Detune</span><input data-dev-range="audioDetune" type="range" min="-1200" max="1200" step="50" value="0"><b id="lkdev-audio-detune">0 ct</b></label>
     <label class="lkdev-range"><span>Pan</span><input data-dev-range="audioPan" type="range" min="-1" max="1" step="0.05" value="0"><b id="lkdev-audio-pan">0.00</b></label>
     <div class="lkdev-grid3"><button data-action="audioTest" data-value="sword">Удар меча</button><button data-action="audioTest" data-value="skill">Магия</button><button data-action="audioTest" data-value="crow">Крылья ворон</button><button data-action="audioSpatial">Spatial возле героя</button><button data-action="audioSweep">Провести L → R</button><button data-action="audioStop">Стоп быстрого теста</button></div>
    </div></details>

    <details class="lkdev-section"><summary>BOIDS LAB · ЖИВЫЕ СТАИ</summary><div class="lkdev-body">
     <div class="lkdev-note">Separation + cohesion + alignment + wander. Эти вороны не используют сюжетную систему и живут только в Dev Lab.</div>
     <div class="lkdev-grid4"><button data-action="boids" data-value="12">12 ворон</button><button data-action="boids" data-value="24">24 вороны</button><button data-action="boidPreset" data-value="tight">Плотная стая</button><button data-action="boidPreset" data-value="wild">Хаотичная</button></div>
     <label class="lkdev-range"><span>Separation</span><input data-dev-range="boidSeparation" type="range" min="0" max="2.5" step="0.05" value="1.15"><b id="lkdev-boid-separation">1.15</b></label>
     <label class="lkdev-range"><span>Cohesion</span><input data-dev-range="boidCohesion" type="range" min="0" max="2.5" step="0.05" value="0.72"><b id="lkdev-boid-cohesion">0.72</b></label>
     <label class="lkdev-range"><span>Alignment</span><input data-dev-range="boidAlignment" type="range" min="0" max="2.5" step="0.05" value="0.78"><b id="lkdev-boid-alignment">0.78</b></label>
     <label class="lkdev-range"><span>Wander</span><input data-dev-range="boidWander" type="range" min="0" max="2.5" step="0.05" value="0.42"><b id="lkdev-boid-wander">0.42</b></label>
     <div class="lkdev-row"><button data-action="boidsClear">Убрать Boids</button></div>
    </div></details>

    <details class="lkdev-section"><summary>PHYSICS LAB · РАЗРУШЕНИЕ И MATTER-SAFE</summary><div class="lkdev-body">
     <div class="lkdev-note">Основная игра остаётся на Arcade Physics. Здесь можно тестировать обломки, вращение, отскоки и цепь; отдельно есть проверка, доступен ли Matter в текущей конфигурации.</div>
     <div class="lkdev-grid3"><button data-action="physicsLab" data-value="debris">Arcade-обломки</button><button data-action="physicsLab" data-value="bounce">Отскакивающие части</button><button data-action="physicsLab" data-value="chain">Цепь / constraint demo</button><button data-action="physicsLab" data-value="matter">Проверить Matter</button><button data-action="physicsLab" data-value="clear">Очистить физику</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>ВРАГИ И AI</summary><div class="lkdev-body">
     <div class="lkdev-grid3"><button data-action="spawn" data-value="skeleton">+ Скелет</button><button data-action="spawn" data-value="mage">+ Маг</button><button data-action="spawn" data-value="shield">+ Щитовик</button></div>
     <div class="lkdev-grid4"><button data-action="spawnMixed" data-value="5">+5</button><button data-action="spawnMixed" data-value="10">+10</button><button data-action="spawnMixed" data-value="20">+20</button><button data-action="spawnMixed" data-value="50">+50</button></div>
     <div class="lkdev-divider"></div>
     <div class="lkdev-label">AI LAB · 20 тактик скелетов</div>
     <div class="lkdev-note">Режим меняет движение обычных скелетов и щитовиков. Маги, Капитан и чемпионы сохраняют свой авторский AI, поэтому их можно использовать как реальные цели охраны.</div>
     <div class="lkdev-row"><button data-action="aiMode" data-value="normal" class="good">Обычный AI · сброс</button><button data-action="overlay" data-value="navigation">Пути AI</button></div>
     <div class="lkdev-label">Атака и охват</div><div class="lkdev-ai-grid">
      <button data-action="aiMode" data-value="aggressive">01 · Штурм</button><button data-action="aiMode" data-value="surround">02 · Кольцо</button>
      <button data-action="aiMode" data-value="wedge">03 · Клин</button><button data-action="aiMode" data-value="pincer">04 · Клещи</button>
      <button data-action="aiMode" data-value="crescent">05 · Полумесяц</button>
     </div>
     <div class="lkdev-label">Защита и дисциплина</div><div class="lkdev-ai-grid">
      <button data-action="aiMode" data-value="protectMages">06 · Защита магов</button><button data-action="aiMode" data-value="protectBoss">07 · Защита босса</button>
      <button data-action="aiMode" data-value="shieldWall">08 · Щитовая стена</button><button data-action="aiMode" data-value="phalanx">09 · Фаланга</button>
      <button data-action="aiMode" data-value="reserve">10 · Резерв</button>
     </div>
     <div class="lkdev-label">Строи и манёвры</div><div class="lkdev-ai-grid">
      <button data-action="aiMode" data-value="spearhead">11 · Острие</button><button data-action="aiMode" data-value="column">12 · Колонна</button>
      <button data-action="aiMode" data-value="echelonLeft">13 · Левый эшелон</button><button data-action="aiMode" data-value="echelonRight">14 · Правый эшелон</button>
      <button data-action="aiMode" data-value="doubleRing">15 · Двойное кольцо</button>
     </div>
     <div class="lkdev-label">Живые / нестабильные тактики</div><div class="lkdev-ai-grid">
      <button data-action="aiMode" data-value="spiral">16 · Спираль</button><button data-action="aiMode" data-value="swarm">17 · Рой</button>
      <button data-action="aiMode" data-value="wave">18 · Волна</button><button data-action="aiMode" data-value="flank">19 · Глубокий обход</button>
      <button data-action="aiMode" data-value="skirmish">20 · Налёт и отход</button>
     </div>
     <div id="lkdev-ai-description" class="lkdev-info lkdev-ai-desc">Обычное поведение — штатный AI игры без экспериментального построения.</div>
     <div class="lkdev-label">AI × ОКРУЖЕНИЕ · эксперимент поверх строя</div><div class="lkdev-grid3"><button data-action="envAi" data-value="normal">Обычный</button><button data-action="envAi" data-value="mageCover">Маги за укрытием</button><button data-action="envAi" data-value="shieldChoke">Щиты держат проход</button></div>
     <div class="lkdev-row"><button data-action="enemyFreezeAI">Заморозить AI</button><button data-action="enemyFreezeMove">Заморозить движение</button><button data-action="enemyAttacks">Отключить атаки</button></div>
     <div class="lkdev-row"><button data-action="clearProjectiles">Убрать снаряды</button><button data-action="killEnemies" class="danger">Убить всех</button><button data-action="deleteEnemies" class="danger">Удалить всех</button></div>
     <div class="lkdev-label">Плотность текущей волны</div><div class="lkdev-grid3"><button data-action="regionPopulation" data-value="auto">Авто</button><button data-action="regionPopulation" data-value="1">1.00×</button><button data-action="regionPopulation" data-value="1.30">1.30×</button><button data-action="regionPopulation" data-value="1.60">1.60×</button><button data-action="regionPopulation" data-value="2">2.00×</button></div>
    </div></details>

    <details class="lkdev-section"><summary>ЧЕМПИОНЫ</summary><div class="lkdev-body">
     <select id="lkdev-champion" style="width:100%"><option value="brokenSaint">Broken Saint · зона 1</option><option value="necromancer">Necromancer</option><option value="shieldWarden">Shield Warden</option><option value="hollowTree">Hollow Tree</option></select>
     <div class="lkdev-row"><button data-action="spawnChampion">Создать</button><button data-action="resetChampion">Сбросить</button><button data-action="clearHazards">Убрать зоны атак</button></div>
     <div class="lkdev-row"><button data-action="championFreeze">Заморозить AI</button><button data-action="championMove">Без движения</button><button data-action="championAttacks">Без атак</button><button data-action="championSkills">Без навыков</button></div>
     <div class="lkdev-grid3"><button data-action="championHp" data-value="10">HP 10%</button><button data-action="championHp" data-value="50">HP 50%</button><button data-action="championHp" data-value="100">HP 100%</button></div>
     <div class="lkdev-row"><button data-action="killChampion" class="danger">Убить</button><button data-action="deleteChampion" class="danger">Удалить</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>ГЕРОЙ И НАВЫКИ</summary><div class="lkdev-body">
     <div class="lkdev-grid4"><button data-action="god">Бессмертие</button><button data-action="oneHit">Убийство с 1 удара</button><button data-action="noCollision">Без коллизий</button><button data-action="infiniteMana">Мана ∞</button></div>
     <div class="lkdev-grid4"><button data-action="playerHp" data-value="100">HP 100%</button><button data-action="playerHp" data-value="30">HP 30%</button><button data-action="playerHp" data-value="20">HP 20%</button><button data-action="playerHp" data-value="10">HP 10%</button></div>
     <div class="lkdev-label">Мгновенный тест боевых навыков</div><div class="lkdev-grid3"><button data-action="skillTest" data-value="1">Разлом</button><button data-action="skillTest" data-value="2">Подъём</button><button data-action="skillTest" data-value="3">Вихрь</button></div>
     <div class="lkdev-row"><button data-action="levelUp">+1 уровень</button><button data-action="xp100">+100 XP</button><button data-action="resetUpgrades">Сброс меча</button><button data-action="clearRelics">Убрать реликвии</button></div>
     <div class="lkdev-grid4"><button data-action="damage" data-value="-3">Урон −</button><button data-action="damage" data-value="3">Урон +</button><button data-action="cooldown" data-value="50">Атака медленнее</button><button data-action="cooldown" data-value="-50">Атака быстрее</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>ВОРОНЫ И СОБЫТИЯ МИРА</summary><div class="lkdev-body">
     <div class="lkdev-label">Тестовая стая возле героя</div><div class="lkdev-grid4"><button data-action="crowSpawn" data-value="5">5 ворон</button><button data-action="crowSpawn" data-value="10">10</button><button data-action="crowSpawn" data-value="20">20</button><button data-action="crowScatter">Разогнать</button></div>
     <div class="lkdev-row"><button data-action="crowClear">Убрать тестовых ворон</button><button data-action="worldEvent" data-value="storyCrows">Разогнать сюжетных</button></div>
     <div class="lkdev-label">Сюжет / окружение</div><div class="lkdev-grid3"><button data-action="worldEvent" data-value="closeGate">Закрыть путь сзади</button><button data-action="worldEvent" data-value="openGate">Открыть ворота впереди</button><button data-action="worldEvent" data-value="wagonCinematic">3-кадровый синематик</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>ПЕРЕМЕЩЕНИЕ ПО МИРУ</summary><div class="lkdev-body">
     <div class="lkdev-label">Перейти в зону без прохождения ворот</div><div class="lkdev-grid3"><button data-action="jumpZone" data-value="0">Зона 1</button><button data-action="jumpZone" data-value="1">Зона 2</button><button data-action="jumpZone" data-value="2">Зона 3</button><button data-action="jumpZone" data-value="3">Зона 4</button><button data-action="jumpZone" data-value="4">Зона 5</button></div>
     <div class="lkdev-label">Запустить локальную волну зоны</div><div class="lkdev-grid4"><button data-action="jumpWave" data-value="1">Волна 1</button><button data-action="jumpWave" data-value="2">Волна 2</button><button data-action="jumpWave" data-value="3">Волна 3</button><button data-action="jumpWave" data-value="4">Волна 4</button><button data-action="jumpWave" data-value="5">Волна 5</button></div>
     <div class="lkdev-row"><input id="lkdev-goto-x" type="number" min="0" max="18400" step="10" value="4200" aria-label="Координата X"><button data-action="gotoX">Перейти к X</button></div>
    </div></details>

    <details class="lkdev-section"><summary>ОТЛАДКА СЦЕНЫ</summary><div class="lkdev-body">
     <div class="lkdev-grid3"><button data-action="envToggle" data-value="props">Декор</button><button data-action="envToggle" data-value="trees">Деревья</button><button data-action="envToggle" data-value="rocks">Камни</button><button data-action="envToggle" data-value="grass">Трава</button><button data-action="envToggle" data-value="landmarks">Ориентиры</button><button data-action="envToggle" data-value="shadows">Тени</button></div>
     <div class="lkdev-row"><button data-action="groundOnly">Только земля</button><button data-action="collisionTest">Тест коллизий</button></div>
     <div class="lkdev-grid3"><button data-action="overlay" data-value="hitboxes">Хитбоксы</button><button data-action="overlay" data-value="enemyRange">Радиусы врагов</button><button data-action="overlay" data-value="meleeRadius">Радиус меча</button><button data-action="overlay" data-value="championRange">Радиус босса</button><button data-action="overlay" data-value="propColliders">Коллайдеры декора</button><button data-action="overlay" data-value="navigation">Сетка навигации</button><button data-action="overlay" data-value="safeLane">Безопасный коридор</button><button data-action="overlay" data-value="cameraBounds">Границы камеры</button><button data-action="overlay" data-value="mobileFrame">Мобильная рамка</button></div>
    </div></details>

    <details class="lkdev-section"><summary>РЕДАКТОР ОКРУЖЕНИЯ</summary><div class="lkdev-body">
     <div class="lkdev-row"><button data-action="editEnv">Режим редактирования</button><button data-action="undo">Отменить</button><button data-action="redo">Повторить</button></div>
     <select id="lkdev-env-prop" style="width:100%"><option value="ash_tree_01">Дерево 01</option><option value="ash_tree_02">Дерево 02</option><option value="ash_rock_01">Камень 01</option><option value="ash_rock_02">Камень 02</option><option value="ash_rock_03">Камень 03</option><option value="ash_grass_01">Трава 01</option><option value="ash_grass_02">Трава 02</option><option value="ash_grass_03">Трава 03</option><option value="ash_landmark_sword">Ориентир · меч</option><option value="ash_landmark_altar">Ориентир · алтарь</option></select>
     <div class="lkdev-row"><button data-action="placeProp" class="good">Ставить кликом</button><button data-action="addPropCenter">Добавить в центр</button><button data-action="duplicateSelected">Дублировать</button><button data-action="deleteSelected" class="danger">Удалить</button></div>
     <div id="lkdev-selected" class="lkdev-selected">Объект не выбран</div>
     <div class="lkdev-grid4"><button data-action="moveX" data-value="-10">X −10</button><button data-action="moveX" data-value="10">X +10</button><button data-action="moveY" data-value="-10">Y −10</button><button data-action="moveY" data-value="10">Y +10</button><button data-action="scale" data-value="-0.05">Масштаб −</button><button data-action="scale" data-value="0.05">Масштаб +</button><button data-action="rotate" data-value="-0.087266">Поворот −5°</button><button data-action="rotate" data-value="0.087266">Поворот +5°</button></div>
     <div class="lkdev-row"><button data-action="alpha" data-value="-0.05">Прозрачность −</button><button data-action="alpha" data-value="0.05">Прозрачность +</button><button data-action="flip">Отзеркалить</button><button data-action="resetSelected">Сброс объекта</button></div>
     <div class="lkdev-grid3"><input id="lkdev-env-x" type="number" step="1" placeholder="X"><input id="lkdev-env-y" type="number" step="1" placeholder="Y"><input id="lkdev-env-scale" type="number" step="0.01" placeholder="Масштаб"><input id="lkdev-env-rotation" type="number" step="1" placeholder="Поворот °"><input id="lkdev-env-alpha" type="number" step="0.05" placeholder="Прозрачность"><button data-action="applyExact">Применить</button></div>
     <div class="lkdev-row"><button data-action="saveLocal" class="good">Сохранить локально</button><button data-action="loadLocal">Загрузить</button><button data-action="copyLayout">Скопировать JSON</button><button data-action="resetAll" class="danger">Сбросить окружение</button></div>
     <textarea id="lkdev-output" class="lkdev-output" readonly placeholder="JSON окружения"></textarea>
    </div></details>

    <details class="lkdev-section"><summary>РЕДАКТОР ИНТЕРФЕЙСА</summary><div class="lkdev-body">
     <div class="lkdev-row"><button data-action="uiEdit">Редактировать UI</button><button data-action="uiUndo">Отменить</button><button data-action="uiRedo">Повторить</button><button data-action="uiLock">Зафиксировать</button></div>
     <div class="lkdev-row"><select id="lkdev-ui-profile" data-ui-change="profile"><option value="auto">Авто · устройство</option><option value="desktop">ПК</option><option value="mobileLandscape">Мобильный · горизонтально</option></select><select id="lkdev-ui-element" data-ui-change="element"></select><select id="lkdev-ui-snap" data-ui-change="snap"><option value="1">Шаг 1 px</option><option value="5">Шаг 5 px</option><option value="10">Шаг 10 px</option></select></div>
     <div id="lkdev-ui-selected" class="lkdev-selected">Редактор UI загружается…</div>
     <div class="lkdev-grid4"><button data-action="uiMoveX" data-value="-10">X−10</button><button data-action="uiMoveX" data-value="10">X+10</button><button data-action="uiMoveY" data-value="-10">Y−10</button><button data-action="uiMoveY" data-value="10">Y+10</button><button data-action="uiScale" data-value="-0.05">Масштаб −</button><button data-action="uiScale" data-value="0.05">Масштаб +</button><button data-action="uiFont" data-value="-0.05">Шрифт −</button><button data-action="uiFont" data-value="0.05">Шрифт +</button></div>
     <div class="lkdev-grid4"><input id="lkdev-ui-x" type="number" step="1" placeholder="Смещение X"><input id="lkdev-ui-y" type="number" step="1" placeholder="Смещение Y"><input id="lkdev-ui-scale" type="number" step="0.01" placeholder="Масштаб"><input id="lkdev-ui-width" type="number" step="0.01" placeholder="Ширина"><input id="lkdev-ui-height" type="number" step="0.01" placeholder="Высота"><input id="lkdev-ui-alpha" type="number" step="0.05" placeholder="Прозрачность"><input id="lkdev-ui-depth" type="number" step="1" placeholder="Глубина"><input id="lkdev-ui-font" type="number" step="0.05" placeholder="Шрифт"></div>
     <div class="lkdev-row"><button data-action="uiApplyExact">Применить значения</button><button data-action="uiSafeArea">Safe Area</button><button data-action="uiGrid">Сетка</button><button data-action="uiBounds">Границы</button></div>
     <div class="lkdev-row"><button data-action="uiResetSelected">Сброс элемента</button><button data-action="uiResetProfile">Сброс профиля</button><button data-action="uiResetAll" class="danger">Сброс всего UI</button></div>
     <div class="lkdev-row"><button data-action="uiSaveLocal" class="good">Сохранить</button><button data-action="uiLoadLocal">Загрузить</button><button data-action="uiCopyLayout">Скопировать JSON</button><button data-action="uiDownload">Скачать JSON</button></div>
     <textarea id="lkdev-ui-output" class="lkdev-output" readonly placeholder="JSON раскладки UI"></textarea>
    </div></details>

    <details class="lkdev-section" open><summary>ПРОИЗВОДИТЕЛЬНОСТЬ И РЕНДЕР</summary><div class="lkdev-body">
     <div class="lkdev-row"><button data-action="qualityAuto" class="good">Автокачество</button><button data-action="renderBenchmark" class="good">Бенчмарк 4 масштабов</button></div>
     <div class="lkdev-grid4"><button data-action="renderScale" data-value="1">1.00×</button><button data-action="renderScale" data-value="1.25">1.25×</button><button data-action="renderScale" data-value="1.5">1.50×</button><button data-action="renderScale" data-value="1.75">1.75×</button></div>
     <div id="lkdev-quality-info" class="lkdev-info">Адаптивное качество…</div><div id="lkdev-render-info" class="lkdev-info">Диагностика рендера…</div><div id="lkdev-render-benchmark" class="lkdev-info">Бенчмарк не запущен</div>
     <div class="lkdev-divider"></div>
     <div class="lkdev-label">Трассировка: FPS, подвисания, браузер, сцены, WebGL, звук, эффекты камеры</div><div class="lkdev-row"><button data-action="traceStart" class="good">Старт трассировки</button><button data-action="traceStop">Стоп</button><button data-action="traceExport">Экспорт JSON</button><button data-action="traceClear" class="danger">Очистить</button></div><div id="lkdev-trace-info" class="lkdev-info">Трассировка не запущена</div>
    </div></details>

    <details class="lkdev-section"><summary>СТРЕСС-ТЕСТ И СКРИНШОТ</summary><div class="lkdev-body">
     <div class="lkdev-grid3"><button data-action="scenario" data-value="empty">Пустая сцена</button><button data-action="scenario" data-value="skeleton10">10 скелетов</button><button data-action="scenario" data-value="mixed">Смешанная толпа</button><button data-action="scenario" data-value="heavy">Тяжёлый бой</button><button data-action="scenario" data-value="critical">Критический HP</button><button data-action="scenario" data-value="champion">Только чемпион</button></div>
     <div class="lkdev-row"><button data-action="stress" data-value="50">50 врагов</button><button data-action="stress" data-value="100">100 врагов</button><button data-action="hideUi">Скрыть игровой UI</button><button data-action="screenshot">Снимок PNG</button></div>
    </div></details>

    <details class="lkdev-section" open><summary>ЖИВАЯ ИНФОРМАЦИЯ</summary><div class="lkdev-body"><div id="lkdev-info" class="lkdev-info"></div></div></details>
   </div>`;
  // DOM Dev controls must never leak pointer events into Phaser's canvas / HUD.
  const stopPanelPointer=(event)=>{
   this.setPanelInputCapture(true);
   event.stopPropagation();
  };
  for(const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','contextmenu']){
   root.addEventListener(type,stopPanelPointer,{passive:false});
  }
  root.addEventListener('wheel',(event)=>event.stopPropagation(),{passive:true});
  root.addEventListener('pointerenter',()=>this.setPanelInputCapture(true));
  root.addEventListener('pointerleave',()=>this.setPanelInputCapture(false));
  root.addEventListener('keydown',(event)=>event.stopPropagation());
  root.addEventListener('keyup',(event)=>event.stopPropagation());
  root.addEventListener('click',(event)=>{
   const btn=event.target.closest('[data-action]');
   if(!btn)return;
   event.preventDefault();event.stopPropagation();
   this.handleAction(btn.dataset.action,btn.dataset.value,btn);
  });
  root.addEventListener('change',(event)=>{
   const mixerSelect=event.target.closest('[data-mixer-select]');
   if(mixerSelect){
    this.setAudioMixerSlotSound(Number(mixerSelect.dataset.mixerSelect),mixerSelect.value);
    return;
   }
   const el=event.target.closest('[data-ui-change]');
   if(el){
    const kind=el.dataset.uiChange;
    if(kind==='profile'){this.uiEditor.profileMode=el.value;this.uiEditor.apply();this.uiEditor.refreshPanel();}
    else if(kind==='element')this.uiEditor.select(el.value);
    else if(kind==='snap'){this.uiEditor.snap=Number(el.value)||1;this.uiEditor.refreshPanel();}
   }
  });
  root.addEventListener('input',(event)=>{
   const mixerRange=event.target.closest('[data-mixer-range]');
   if(mixerRange){
    const [slotIndex,prop]=String(mixerRange.dataset.mixerRange||'').split(':');
    this.setAudioMixerSlotParam(Number(slotIndex),prop,Number(mixerRange.value));
    return;
   }
   const el=event.target.closest('[data-dev-range]');
   if(el)this.handleDevLabRange(el.dataset.devRange,Number(el.value));
  });
  document.body.appendChild(root);
  this.root=root;
  this.refreshFxLabUi(false);
  this.refreshAdvancedLabUi();
 }

 setPanelInputCapture(active,force=false){
  active=Boolean(active);
  if(!force && this.panelInputCapture===active)return;
  this.panelInputCapture=active;
  const scenes=[this.scene,this.scene.scene?.get?.('HUDScene')].filter(Boolean);
  if(active){
   for(const scene of scenes){
    if(!scene?.input || this.panelInputStates.has(scene))continue;
    this.panelInputStates.set(scene,scene.input.enabled);
    scene.input.enabled=false;
   }
  }else{
   for(const [scene,wasEnabled] of this.panelInputStates.entries()){
    if(scene?.input)scene.input.enabled=wasEnabled;
   }
   this.panelInputStates.clear();
  }
 }

 refreshAiModeDescription(){
  const mode=this.scene.devFlags?.enemyAiMode||'normal';
  const meta=DEV_AI_MODE_META[mode]||DEV_AI_MODE_META.normal;
  const el=document.getElementById('lkdev-ai-description');
  if(el)el.textContent=`${meta.name} — ${meta.desc}`;
 }

 togglePanel(force=null){
  this.open=force===null?!this.open:Boolean(force);
  this.root?.classList.toggle('open',this.open);
  if(this.button) this.button.style.display=this.open?'none':'';
  if(!this.open)this.setPanelInputCapture(false,true);
  const hud=this.scene.scene?.get?.('HUDScene');
  hud?.setDevMenuOpen?.(this.open);
  if(this.open){this.refreshAiModeDescription();this.refreshFxLabUi();this.refreshAdvancedLabUi();}
 }

 collapseAllSections(){
  if(!this.root)return;
  for(const section of this.root.querySelectorAll('details.lkdev-section'))section.open=false;
  const scroll=this.root.querySelector('.lkdev-scroll');
  try{scroll?.scrollTo?.({top:0,behavior:'smooth'});}catch{if(scroll)scroll.scrollTop=0;}
  this.notifyDev('Все разделы Dev-панели свёрнуты.','good');
 }

 handleAction(action,value,button){
  const s=this.scene,f=s.devFlags;
  switch(action){
   case 'close':this.togglePanel(false);break;
   case 'collapseAll':this.collapseAllSections();break;
   case 'pause':s.setGameplayPaused('devPanel',true);break;
   case 'resume':s.setGameplayPaused('devPanel',false);break;
   case 'time':this.setTimeScale(Number(value));this.notifyDev(`Скорость времени: ${Number(value).toFixed(2)}×`);break;
   case 'labPreset':this.runDevLabPreset(value);break;
   case 'labPresetSave':this.saveDevLabPreset();break;
   case 'labPresetLoad':this.loadDevLabPreset();break;
   case 'wave6Lab':this.jumpToZone(1);this.notifyDev('Открыт тест: Акт 2 · Волна 6.','good');break;
   case 'cameraFx':this.testCameraEffect(value);break;
   case 'postFx':this.applyCameraPostFx(value);break;
   case 'playerFx':this.applyPlayerDevFx(value);break;
   case 'ambientFx':this.toggleAmbientDevFx(value);break;
   case 'particleBurst':this.burstDevParticles(value);break;
   case 'fxSelect':this.selectDevFx(value);break;
   case 'fxToggle':this.toggleAmbientDevFx(this.devLab.fxSelected);break;
   case 'fxBurst':this.burstDevParticles(this.devLab.fxSelected);break;
   case 'fxPreset':this.applyDevFxPreset(value);break;
   case 'fxFollow':this.setDevFxFollow(value);break;
   case 'fxCopy':this.copyDevFxSettings();break;
   case 'clearParticles':this.clearDevParticles();break;
   case 'lightToggle':this.toggleDevLight();break;
   case 'lightPulse':this.pulseDevLight();break;
   case 'impactPreset':this.applyImpactPreset(value);break;
   case 'impactTest':this.runImpactTest();break;
   case 'impactParticles':this.devLab.impact.particles=value;this.notifyDev(`Impact: частицы — ${value}.`);break;
   case 'impactCopy':this.copyImpactProfile();break;
   case 'camera2':this.toggleCamera2(value);break;
   case 'procShake':this.runProceduralShake(value);break;
   case 'extraCamera':this.toggleExtraCamera(value);break;
   case 'shaderLab':this.applyShaderLab(value);break;
   case 'blendDemo':this.runBlendDemo(value);break;
   case 'decal':this.runDecalAction(value);break;
   case 'trailToggle':this.devLab.worldFx.trail=!this.devLab.worldFx.trail;this.notifyDev(`RenderTexture trail: ${this.devLab.worldFx.trail?'ВКЛ':'ВЫКЛ'}.`,'good');break;
   case 'fogMask':this.toggleFogRevealMask();break;
   case 'screenFx':this.applyScreenFx(value);break;
   case 'worldLayer':this.toggleWorldLayer(value);break;
   case 'destruction':this.runDestructionDemo(value);break;
   case 'audioTest':this.playAudioLab(value);break;
   case 'audioSpatial':this.toggleAudioSpatial();break;
   case 'audioSweep':this.runAudioSweep();break;
   case 'audioStop':this.stopAudioLab();break;
   case 'mixerPlay':this.startAudioMixerSlot(Number(value),{restart:false});break;
   case 'mixerStop':this.stopAudioMixerSlot(Number(value));break;
   case 'mixerLoop':this.toggleAudioMixerSlotLoop(Number(value));break;
   case 'mixerMute':this.toggleAudioMixerSlotMute(Number(value));break;
   case 'mixerPlayAll':this.playAudioMixerAll(false);break;
   case 'mixerRestartAll':this.playAudioMixerAll(true);break;
   case 'mixerStopAll':this.stopAudioMixerAll();break;
   case 'mixerCopy':this.copyAudioMixerSet();break;
   case 'mixerAddSlot':this.addAudioMixerSlot();break;
   case 'mixerRemoveSlot':this.removeAudioMixerSlot();break;
   case 'mixerReloadLibrary':this.rebuildAudioMixerSlotsUi();this.notifyDev(`Audio Mixer: найдено аудио-ассетов — ${this.getAudioMixerLibrary().length}.`,'good');break;
   case 'boids':this.spawnBoids(Number(value));break;
   case 'boidPreset':this.applyBoidPreset(value);break;
   case 'boidsClear':this.clearBoids();break;
   case 'physicsLab':this.runPhysicsLab(value);break;
   case 'autoSpawns':f.autoSpawnsDisabled=!f.autoSpawnsDisabled;if(!f.autoSpawnsDisabled&&s.championEventActive&&!s.activeChampion){const k=s.getChampionForWave(s.wave);if(k)s.spawnChampion(k,true);}break;
   case 'spawn':this.spawnEnemies(value,1);break;
   case 'spawnMixed':this.spawnMixed(Number(value));break;
   case 'regionPopulation':s.devRegionPopulationOverride=value==='auto'?null:Number(value);s.recalculateCurrentWaveRegionBalance();break;
   case 'clearProjectiles':this.clearProjectiles();break;
   case 'clearHazards':this.clearHazards();break;
   case 'enemyFreezeAI':f.enemyAiFrozen=!f.enemyAiFrozen;break;
   case 'enemyFreezeMove':f.enemyMovementFrozen=!f.enemyMovementFrozen;break;
   case 'enemyAttacks':f.enemyAttacksDisabled=!f.enemyAttacksDisabled;if(f.enemyAttacksDisabled){this.clearProjectiles();for(const e of s.enemies){if(e.type!=='champion'){e.pendingMeleeHitAt=0;e.pendingMeleeDamage=0;e.pendingMeleeRange=0;}}}break;
   case 'aiMode':this.setDevAiMode(value);break;
   case 'envAi':this.setEnvironmentAiMode(value);break;
   case 'killEnemies':this.killOrdinaryEnemies();break;
   case 'deleteEnemies':this.deleteOrdinaryEnemies();break;
   case 'spawnChampion':this.spawnSelectedChampion();break;
   case 'resetChampion':this.resetChampion();break;
   case 'killChampion':this.killChampion();break;
   case 'deleteChampion':this.deleteChampion();break;
   case 'championFreeze':f.championFrozen=!f.championFrozen;if(f.championFrozen)this.clearHazards();break;
   case 'championMove':f.championMovementFrozen=!f.championMovementFrozen;break;
   case 'championAttacks':f.championAttacksDisabled=!f.championAttacksDisabled;if(f.championAttacksDisabled)this.clearHazards();break;
   case 'championSkills':f.championSkillsDisabled=!f.championSkillsDisabled;if(f.championSkillsDisabled)this.clearHazards();break;
   case 'championHp':this.setChampionHp(Number(value));break;
   case 'god':f.godMode=!f.godMode;break;
   case 'oneHit':f.oneHitKill=!f.oneHitKill;break;
   case 'noCollision':f.noCollision=!f.noCollision;this.applyNoCollision();break;
   case 'infiniteMana':f.infiniteMana=!f.infiniteMana;if(f.infiniteMana)s.mana=s.maxMana;break;
   case 'playerHp':this.setPlayerHp(Number(value));break;
   case 'levelUp':s.level++;break;
   case 'xp100':s.grantXp(100);break;
   case 'resetUpgrades':this.resetUpgrades();break;
   case 'clearRelics':s.championRelics.clear();s.killStreakBonus=0;break;
   case 'damage':s.meleeAttack.damage=Math.max(1,s.meleeAttack.damage+Number(value));break;
   case 'cooldown':s.meleeAttack.cooldown=Math.max(100,s.meleeAttack.cooldown+Number(value));break;
   case 'radius':s.meleeAttack.radius=Math.max(20,s.meleeAttack.radius+Number(value));break;
   case 'skillTest':this.testDevSkill(Number(value));break;
   case 'crowSpawn':this.spawnDevCrowFlock(Number(value));break;
   case 'crowScatter':this.scatterDevCrowFlocks();break;
   case 'crowClear':this.clearDevCrowFlocks();break;
   case 'worldEvent':this.runDevWorldEvent(value);break;
   case 'travel':this.teleport(Number(value));break;
   case 'jumpZone':this.jumpToZone(Number(value));break;
   case 'jumpWave':this.jumpToWave(Number(value));break;
   case 'gotoX':this.teleport(Number(document.getElementById('lkdev-goto-x')?.value||0));break;
   case 'envToggle':this.envVisibility[value]=!this.envVisibility[value];this.applyAllEnvironmentVisibility();break;
   case 'groundOnly':this.toggleGroundOnly();break;
   case 'collisionTest':this.toggleCollisionTest();break;
   case 'overlay':this.overlayFlags[value]=!this.overlayFlags[value];break;
   case 'segment':this.toggleSegment(value);break;
   case 'editEnv':this.setEditMode(!this.editMode);break;
   case 'placeProp':this.togglePropPlacement();break;
   case 'addPropCenter':this.addSelectedPropAtViewCenter();break;
   case 'duplicateSelected':this.duplicateSelected();break;
   case 'undo':this.undo();break;
   case 'redo':this.redo();break;
   case 'moveX':this.mutateSelected(o=>{o.x+=Number(value)});break;
   case 'moveY':this.mutateSelected(o=>{o.y+=Number(value)});break;
   case 'scale':this.mutateSelected(o=>{const n=Math.max(0.05,Math.abs(o.scaleX)+Number(value));o.setScale(n)});break;
   case 'rotate':this.mutateSelected(o=>{o.rotation+=Number(value)});break;
   case 'alpha':this.mutateSelected(o=>{o.alpha=Phaser.Math.Clamp(o.alpha+Number(value),0.05,1)});break;
   case 'flip':this.mutateSelected(o=>o.setFlipX(!o.flipX));break;
   case 'deleteSelected':this.deleteSelected();break;
   case 'applyExact':this.applyExactSelectedValues();break;
   case 'resetSelected':this.resetSelected();break;
   case 'resetSegment':this.resetSelectedSegment();break;
   case 'resetAll':this.resetAllEnvironment();break;
   case 'saveLocal':this.saveLocal();break;
   case 'loadLocal':this.loadLocal();break;
   case 'copyLayout':this.copyLayout();break;
   case 'uiEdit':this.uiEditor.setEditMode(!this.uiEditor.editMode);break;
   case 'uiUndo':this.uiEditor.undo();break;
   case 'uiRedo':this.uiEditor.redo();break;
   case 'uiLock':this.uiEditor.toggleLock();break;
   case 'uiMoveX':this.uiEditor.mutate(t=>{t.dx=this.uiEditor.snapValue(t.dx+Number(value))});break;
   case 'uiMoveY':this.uiEditor.mutate(t=>{t.dy=this.uiEditor.snapValue(t.dy+Number(value))});break;
   case 'uiScale':this.uiEditor.mutate(t=>{t.scale+=Number(value)});break;
   case 'uiWidth':this.uiEditor.mutate(t=>{t.width+=Number(value)});break;
   case 'uiHeight':this.uiEditor.mutate(t=>{t.height+=Number(value)});break;
   case 'uiAlpha':this.uiEditor.mutate(t=>{t.alpha+=Number(value)});break;
   case 'uiFont':this.uiEditor.mutate(t=>{t.fontScale+=Number(value)});break;
   case 'uiDepth':this.uiEditor.mutate(t=>{t.depth+=Number(value)});break;
   case 'uiApplyExact':this.uiEditor.applyExactFromPanel();break;
   case 'uiAlignX':this.uiEditor.align('x',value);break;
   case 'uiAlignY':this.uiEditor.align('y',value);break;
   case 'uiCopyPos':this.uiEditor.copyPosition();break;
   case 'uiPastePos':this.uiEditor.pastePosition();break;
   case 'uiSafeArea':this.uiEditor.showSafeArea=!this.uiEditor.showSafeArea;this.uiEditor.refreshPanel();break;
   case 'uiGrid':this.uiEditor.showGrid=!this.uiEditor.showGrid;this.uiEditor.refreshPanel();break;
   case 'uiBounds':this.uiEditor.showBounds=!this.uiEditor.showBounds;this.uiEditor.refreshPanel();break;
   case 'uiResetSelected':this.uiEditor.resetSelected();break;
   case 'uiResetProfile':this.uiEditor.resetProfile();break;
   case 'uiResetAll':this.uiEditor.resetAll();break;
   case 'uiSaveLocal':this.uiEditor.saveLocal();break;
   case 'uiLoadLocal':this.uiEditor.loadLocal();break;
   case 'uiCopyLayout':this.uiEditor.copyExport();break;
   case 'uiDownload':this.uiEditor.downloadExport();break;
   case 'renderScale':this.setRenderScale(value);break;
   case 'qualityAuto':this.setAdaptiveQualityMode('auto',{restartProbe:true});break;
   case 'renderBenchmark':this.startRenderBenchmark();break;
   case 'zoom':this.setCameraZoom(Number(value));break;
   case 'fitAsh':this.fitAshFields();break;
   case 'followCamera':this.followCamera();break;
   case 'lockCamera':this.lockCamera();break;
   case 'freeCamera':this.toggleFreeCamera();break;
   case 'scenario':this.runScenario(value);break;
   case 'stress':this.runStress(Number(value));break;
   case 'hideUi':this.setGameUiHidden(!this.hideGameUi);break;
   case 'screenshot':this.captureScreenshot();break;
   case 'traceStart':this.startPerformanceTrace();break;
   case 'traceStop':this.stopPerformanceTrace();break;
   case 'traceExport':this.exportPerformanceTrace();break;
   case 'traceClear':this.clearPerformanceTrace();break;
  }
  this.refreshStateButtons();this.refreshSelectedPanel();this.refreshTraceUi();this.updateInfo(true);
 }

 notifyDev(message,tone='info'){
  const text=String(message||'Готово');
  this.devLab.lastStatus=text;
  const el=typeof document!=='undefined'?document.getElementById('lkdev-status'):null;
  if(el){
   el.textContent=text;
   el.style.borderColor=tone==='error'?'#824b47':tone==='good'?'#45684e':'#3b3e3f';
   el.style.color=tone==='error'?'#ffc0ba':tone==='good'?'#bff1cb':'#bec9c0';
  }
 }

 isWebGlDev(){return this.scene.game?.renderer?.type===Phaser.WEBGL;}

 handleDevLabRange(kind,value){
  if(kind==='lightRadius'){
   this.devLab.lightRadius=Phaser.Math.Clamp(value,100,600);
   const out=document.getElementById('lkdev-light-radius');if(out)out.textContent=String(Math.round(this.devLab.lightRadius));
   if(this.devLab.light)this.devLab.light.radius=this.devLab.lightRadius;
  }else if(kind==='lightIntensity'){
   this.devLab.lightIntensity=Phaser.Math.Clamp(value,0.2,3);
   const out=document.getElementById('lkdev-light-intensity');if(out)out.textContent=this.devLab.lightIntensity.toFixed(1);
   if(this.devLab.light)this.devLab.light.intensity=this.devLab.lightIntensity;
  }else if(kind?.startsWith?.('impact')){
   const map={impactHitStop:['hitStop',0,120,'lkdev-impact-hitstop',v=>`${Math.round(v)} ms`],impactShakeX:['shakeX',0,24,'lkdev-impact-shakex',v=>String(Math.round(v))],impactShakeY:['shakeY',0,24,'lkdev-impact-shakey',v=>String(Math.round(v))],impactZoom:['zoom',1,1.28,'lkdev-impact-zoom',v=>`${v.toFixed(2)}×`],impactFlash:['flash',0,1,'lkdev-impact-flash',v=>v.toFixed(2)],impactSlow:['slow',0.1,1,'lkdev-impact-slow',v=>`${v.toFixed(2)}×`],impactKnockback:['knockback',0,320,'lkdev-impact-knockback',v=>String(Math.round(v))],impactPitch:['pitch',-1200,1200,'lkdev-impact-pitch',v=>`${Math.round(v)} ct`]};
   const def=map[kind];if(!def)return;const [prop,min,max,outId,fmt]=def;this.devLab.impact[prop]=Phaser.Math.Clamp(value,min,max);const out=document.getElementById(outId);if(out)out.textContent=fmt(this.devLab.impact[prop]);
  }else if(kind?.startsWith?.('audio')){
   const map={audioRate:['rate',0.55,1.6,'lkdev-audio-rate',v=>`${v.toFixed(2)}×`],audioDetune:['detune',-1200,1200,'lkdev-audio-detune',v=>`${Math.round(v)} ct`],audioPan:['pan',-1,1,'lkdev-audio-pan',v=>v.toFixed(2)]};
   const def=map[kind];if(!def)return;const [prop,min,max,outId,fmt]=def;this.devLab.audioLab[prop]=Phaser.Math.Clamp(value,min,max);const out=document.getElementById(outId);if(out)out.textContent=fmt(this.devLab.audioLab[prop]);
  }else if(kind?.startsWith?.('boid')){
   const map={boidSeparation:['separation','lkdev-boid-separation'],boidCohesion:['cohesion','lkdev-boid-cohesion'],boidAlignment:['alignment','lkdev-boid-alignment'],boidWander:['wander','lkdev-boid-wander']};
   const def=map[kind];if(!def)return;const [prop,outId]=def;this.devLab.boids[prop]=Phaser.Math.Clamp(value,0,2.5);const out=document.getElementById(outId);if(out)out.textContent=this.devLab.boids[prop].toFixed(2);
  }else if(kind?.startsWith?.('fx')){
   const map={fxDensity:'density',fxSize:'size',fxSpeed:'speed',fxAlpha:'alpha',fxLife:'life',fxSpread:'spread'};
   const prop=map[kind];if(!prop)return;
   const settings=this.getDevFxSettings(this.devLab.fxSelected);
   const limits={density:[0.25,3],size:[0.25,3],speed:[0.15,3],alpha:[0.15,2.5],life:[0.25,3],spread:[0.25,3]};
   const [min,max]=limits[prop];settings[prop]=Phaser.Math.Clamp(value,min,max);
   if(this.devLab.ambient.has(this.devLab.fxSelected))this.rebuildDevFx(this.devLab.fxSelected);
   this.refreshFxLabUi(false);
  }
 }

 testCameraEffect(kind){
  const s=this.scene,cam=s.cameras.main;
  if(!cam)return;
  const reset=()=>{try{cam.resetFX();}catch{}cam.setRotation(0);};
  if(kind==='reset'){
   reset();this.followCamera();this.setCameraZoom(1);this.notifyDev('Камера сброшена.','good');return;
  }
  if(kind==='shakeSoft')cam.shake(140,0.0025,true);
  else if(kind==='shakeHit')cam.shake(210,0.0075,true);
  else if(kind==='shakeQuake')cam.shake(620,0.012,true);
  else if(kind==='flashWhite')cam.flash(220,255,245,220,true);
  else if(kind==='flashRed')cam.flash(260,180,28,24,true);
  else if(kind==='fade'){
   cam.fadeOut(330,0,0,0,true);
   s.time.delayedCall(390,()=>cam.fadeIn(420,0,0,0));
  }else if(kind==='zoomPulse'){
   const base=cam.zoom;
   s.tweens.add({targets:cam,zoom:base*1.16,duration:180,ease:'Quad.easeOut',yoyo:true,hold:80,onComplete:()=>cam.setZoom(base)});
  }else if(kind==='rotationHit'){
   cam.setRotation(0);
   s.tweens.add({targets:cam,rotation:Phaser.Math.DegToRad(1.5),duration:75,ease:'Sine.easeOut',yoyo:true,repeat:1,onComplete:()=>cam.setRotation(0)});
  }else if(kind==='bossFocus'){
   const target=s.activeChampion?.active?s.activeChampion:(s.enemies||[]).find(e=>e?.active&&e.hp>0);
   if(!target){this.notifyDev('Для фокуса нужен живой враг.','error');return;}
   const returnX=s.player.x,returnY=s.player.y,baseZoom=cam.zoom;
   cam.pan(target.x,target.y,360,'Sine.easeInOut',true);
   cam.zoomTo(Math.min(1.55,baseZoom*1.22),360,'Sine.easeInOut',true);
   s.time.delayedCall(850,()=>{cam.pan(returnX,returnY,430,'Sine.easeInOut',true);cam.zoomTo(baseZoom,430,'Sine.easeInOut',true);});
  }
  this.notifyDev('Камера: тест эффекта выполнен.');
 }

 applyCameraPostFx(kind){
  const cam=this.scene.cameras.main;
  if(!this.isWebGlDev() || !cam?.postFX){this.notifyDev('Post FX доступны только в WebGL.','error');return;}
  try{cam.postFX.clear();}catch{}
  if(kind==='clear'){
   this.devLab.cameraFxKind='none';this.notifyDev('Post FX камеры очищены.','good');this.refreshStateButtons();return;
  }
  try{
   if(kind==='vignette')cam.postFX.addVignette(0.5,0.5,0.82,0.62);
   else if(kind==='bloom')cam.postFX.addBloom(0xffdca0,1,1,1.1,0.85,3);
   else if(kind==='blur')cam.postFX.addBlur(1,2,2,1.2,0xffffff,2);
   else if(kind==='pixelate')cam.postFX.addPixelate(4);
   else if(kind==='barrel')cam.postFX.addBarrel(1.12);
   else if(kind==='bokeh')cam.postFX.addBokeh(0.45,0.75,0.16);
   else if(kind==='grayscale'){const fx=cam.postFX.addColorMatrix();fx.grayscale(1);}
   else if(kind==='sepia'){const fx=cam.postFX.addColorMatrix();fx.sepia();}
   else if(kind==='night'){const fx=cam.postFX.addColorMatrix();fx.night(0.28);}
   this.devLab.cameraFxKind=kind;
   this.notifyDev(`Post FX камеры: ${kind}.`,'good');
  }catch(error){this.devLab.cameraFxKind='none';this.notifyDev(`FX не запустился: ${error?.message||error}`,'error');}
  this.refreshStateButtons();
 }

 getDevFxHero(){return this.scene.playerVisual?.active?this.scene.playerVisual:this.scene.player;}

 applyPlayerDevFx(kind){
  const hero=this.getDevFxHero();
  if(!this.isWebGlDev() || !hero?.postFX){this.notifyDev('FX героя требуют WebGL и Sprite с PostFX.','error');return;}
  try{hero.postFX.clear();hero.preFX?.clear?.();}catch{}
  if(kind==='clear'){this.devLab.playerFxKind='none';this.notifyDev('FX героя очищены.','good');this.refreshStateButtons();return;}
  try{
   const fx=hero.preFX||hero.postFX;
   if(kind==='glow')fx.addGlow(0xffd978,4,0,false,0.12,10);
   else if(kind==='bloom')fx.addBloom(0xffdca0,1,1,1,1,3);
   else if(kind==='shine')fx.addShine(0.7,0.18,3);
   this.devLab.playerFxKind=kind;
   this.notifyDev(`FX героя: ${kind}.`,'good');
  }catch(error){this.devLab.playerFxKind='none';this.notifyDev(`FX героя не запустился: ${error?.message||error}`,'error');}
  this.refreshStateButtons();
 }

 ensureDevParticleTextures(){
  const s=this.scene;
  if(!s.textures.exists('lkdev_particle_dot')){
   const g=s.make.graphics({x:0,y:0,add:false});g.fillStyle(0xffffff,1);g.fillCircle(5,5,4);g.generateTexture('lkdev_particle_dot',10,10);g.destroy();
  }
  if(!s.textures.exists('lkdev_particle_square')){
   const g=s.make.graphics({x:0,y:0,add:false});g.fillStyle(0xffffff,1);g.fillRect(1,1,8,8);g.generateTexture('lkdev_particle_square',10,10);g.destroy();
  }
  if(!s.textures.exists('lkdev_particle_bone')){
   const g=s.make.graphics({x:0,y:0,add:false});g.fillStyle(0xe0d8c2,1);g.fillRoundedRect(1,3,10,4,2);g.fillCircle(2.5,3,2);g.fillCircle(9.5,7,2);g.generateTexture('lkdev_particle_bone',12,10);g.destroy();
  }
  if(!s.textures.exists('lkdev_particle_smoke')){
   const tex=s.textures.createCanvas('lkdev_particle_smoke',64,64);const ctx=tex.getContext();const grad=ctx.createRadialGradient(32,32,3,32,32,30);grad.addColorStop(0,'rgba(255,255,255,.66)');grad.addColorStop(.45,'rgba(255,255,255,.22)');grad.addColorStop(1,'rgba(255,255,255,0)');ctx.clearRect(0,0,64,64);ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);tex.refresh();
  }
 }

 getDevFxMeta(kind){
  const meta={
   fog:{name:'Туман',desc:'Большие полупрозрачные облака. Лучше всего тестировать с привязкой к камере.',follow:'camera',depth:5},
   smoke:{name:'Дым',desc:'Поднимающийся дым: костры, разрушения, появление персонажа, горящие объекты.',follow:'player',depth:188},
   fire:{name:'Огонь',desc:'Живое пламя из горячих частиц. Удобно подбирать костры, факелы и горящие телеги.',follow:'player',depth:192},
   ash:{name:'Пепел',desc:'Медленно падающие частицы для постоянной атмосферы зоны.',follow:'camera',depth:180},
   embers:{name:'Угли',desc:'Лёгкие светящиеся искры, которые поднимаются вверх возле источника огня.',follow:'player',depth:194},
   sparks:{name:'Искры',desc:'Короткие яркие искры для удара меча, парирования и столкновения с металлом.',follow:'player',depth:202},
   blood:{name:'Кровь',desc:'Брызги с гравитацией. Постоянный режим нужен только для настройки; в игре обычно используется выброс.',follow:'player',depth:201},
   bones:{name:'Кости',desc:'Фрагменты костей с вращением и гравитацией для смерти скелетов и тяжёлых ударов.',follow:'player',depth:201},
   debris:{name:'Обломки',desc:'Каменные и земляные фрагменты для разрушений, ударов о землю и объектов окружения.',follow:'player',depth:199},
   magic:{name:'Магия',desc:'Светящиеся магические частицы с ADD-смешиванием для заклинаний и реликвий.',follow:'player',depth:203}
  };
  return meta[kind]||meta.fog;
 }

 getDevFxSettings(kind=this.devLab.fxSelected){
  let settings=this.devLab.fxSettings.get(kind);
  if(settings)return settings;
  const meta=this.getDevFxMeta(kind);
  settings={density:1,size:1,speed:1,alpha:1,life:1,spread:1,follow:meta.follow,fixedX:null,fixedY:null};
  this.devLab.fxSettings.set(kind,settings);
  return settings;
 }

 selectDevFx(kind){
  const allowed=new Set(['fog','smoke','fire','ash','embers','sparks','blood','bones','debris','magic']);
  if(!allowed.has(kind))return;
  this.devLab.fxSelected=kind;this.getDevFxSettings(kind);this.refreshFxLabUi();
  this.notifyDev(`FX Lab: выбран «${this.getDevFxMeta(kind).name}».`);
 }

 applyDevFxPreset(name){
  const presets={
   light:{density:0.55,size:0.78,speed:0.72,alpha:0.62,life:0.78,spread:0.82},
   normal:{density:1,size:1,speed:1,alpha:1,life:1,spread:1},
   heavy:{density:1.75,size:1.22,speed:0.92,alpha:1.35,life:1.3,spread:1.18},
   cinema:{density:2.35,size:1.62,speed:0.68,alpha:1.55,life:1.62,spread:1.48}
  };
  const preset=presets[name]||presets.normal,kind=this.devLab.fxSelected,settings=this.getDevFxSettings(kind);
  Object.assign(settings,preset);
  if(this.devLab.ambient.has(kind))this.rebuildDevFx(kind);
  this.refreshFxLabUi();
  const label={light:'Слабый',normal:'Обычный',heavy:'Сильный',cinema:'Кино'}[name]||name;
  this.notifyDev(`${this.getDevFxMeta(kind).name}: пресет «${label}».`,'good');
 }

 setDevFxFollow(follow){
  if(!['camera','player','fixed'].includes(follow))return;
  const kind=this.devLab.fxSelected,settings=this.getDevFxSettings(kind);settings.follow=follow;
  if(follow==='fixed'){
   settings.fixedX=this.scene.player?.x??this.scene.cameras.main.worldView.centerX;
   settings.fixedY=this.scene.player?.y??this.scene.cameras.main.worldView.centerY;
  }
  if(this.devLab.ambient.has(kind))this.rebuildDevFx(kind);
  this.refreshFxLabUi();
  const label={camera:'камера',player:'герой',fixed:'точка на карте'}[follow];
  this.notifyDev(`${this.getDevFxMeta(kind).name}: привязка — ${label}.`,'good');
 }

 buildDevFxConfig(kind,{burst=false}={}){
  const s=this.scene,cam=s.cameras.main,st=this.getDevFxSettings(kind);
  const halfW=Math.max(400,cam.worldView.width*0.62),halfH=Math.max(280,cam.worldView.height*0.62);
  const den=Math.max(.25,st.density),size=st.size,speed=st.speed,alpha=st.alpha,life=st.life,spread=st.spread;
  const freq=(base)=>Math.max(18,Math.round(base/den));
  const A=(v)=>Phaser.Math.Clamp(v*alpha,0.005,1);
  const R=(min,max,mul=1)=>({min:min*mul,max:max*mul});
  const L=(min,max)=>({min:Math.round(min*life),max:Math.round(max*life)});
  let key='lkdev_particle_dot',count=Math.max(1,Math.round(24*den)),cfg={};

  if(kind==='fog'){
   key='lkdev_particle_smoke';count=Math.max(3,Math.round(12*den));
   cfg=burst?{lifespan:L(3500,7000),speedX:R(10,30,speed),speedY:R(-5,5,speed),scale:{start:1.9*size,end:4.8*size},alpha:{start:A(.08),end:0},tint:[0xaeb7b2,0x7e8782]}:
    {x:-halfW*1.08,y:{min:-halfH*.62*spread,max:halfH*.62*spread},speedX:R(12,27,speed),speedY:R(-3,3,speed),lifespan:L(9000,14000),frequency:freq(620),quantity:1,scale:{start:2.8*size,end:5.8*size},alpha:{start:A(.055),end:0},tint:[0x9ca5a0,0x737b78]};
  }else if(kind==='smoke'){
   key='lkdev_particle_smoke';count=Math.max(5,Math.round(18*den));
   cfg={x:R(-56,56,spread),y:R(-12,22,spread),speedX:R(-16,16,speed),speedY:R(-58,-14,speed),lifespan:L(1100,2600),scale:{start:.38*size,end:2.15*size},alpha:{start:A(.24),end:0},tint:[0xc2c2b9,0x777a76,0x4e504e],...(burst?{}:{frequency:freq(115),quantity:1})};
  }else if(kind==='fire'){
   count=Math.max(6,Math.round(30*den));
   cfg={x:R(-30,30,spread),y:R(-12,20,spread),speedX:R(-20,20,speed),speedY:R(-86,-30,speed),lifespan:L(420,980),scale:{start:1.05*size,end:0},alpha:{start:A(.95),end:0},tint:[0xfff0a3,0xffa135,0xe84b1d],blendMode:'ADD',...(burst?{}:{frequency:freq(68),quantity:1})};
  }else if(kind==='ash'){
   key='lkdev_particle_square';count=Math.max(8,Math.round(36*den));
   cfg=burst?{lifespan:L(2200,4600),speedX:R(-16,14,speed),speedY:R(18,48,speed),scale:{start:.34*size,end:.12*size},alpha:{start:A(.42),end:0},tint:[0xc6c3b7,0x837f74,0x57554f]}:
    {x:{min:-halfW*spread,max:halfW*spread},y:-halfH,speedX:R(-12,10,speed),speedY:R(20,48,speed),lifespan:L(6500,9500),frequency:freq(115),quantity:1,scale:{start:.35*size,end:.12*size},alpha:{start:A(.4),end:0},tint:[0xc6c3b7,0x837f74,0x57554f]};
  }else if(kind==='embers'){
   count=Math.max(5,Math.round(24*den));
   cfg={x:R(-75,75,spread),y:R(-28,34,spread),speedX:R(-10,10,speed),speedY:R(-48,-16,speed),lifespan:L(750,1900),scale:{start:.38*size,end:0},alpha:{start:A(.85),end:0},tint:[0xffd77b,0xff963e,0xff6124],blendMode:'ADD',...(burst?{}:{frequency:freq(145),quantity:1})};
  }else if(kind==='sparks'){
   count=Math.max(6,Math.round(28*den));
   cfg={x:R(-12,12,spread),y:R(-12,12,spread),lifespan:L(220,560),speed:R(110,285,speed),angle:{min:0,max:360},scale:{start:.62*size,end:0},alpha:{start:A(.98),end:0},tint:[0xfff1a8,0xffb94f,0xffffff],blendMode:'ADD',...(burst?{}:{frequency:freq(190),quantity:1})};
  }else if(kind==='blood'){
   count=Math.max(5,Math.round(24*den));
   cfg={x:R(-12,12,spread),y:R(-18,4,spread),lifespan:L(420,900),speed:R(55,175,speed),angle:{min:190-70*spread,max:350+10*spread},gravityY:220*speed,scale:{start:.65*size,end:.12*size},alpha:{start:A(.95),end:0},tint:[0x8d1717,0xc02b22,0x5f1010],...(burst?{}:{frequency:freq(220),quantity:1})};
  }else if(kind==='bones'){
   key='lkdev_particle_bone';count=Math.max(4,Math.round(18*den));
   cfg={x:R(-18,18,spread),y:R(-15,10,spread),lifespan:L(650,1450),speed:R(60,185,speed),angle:{min:190,max:350},gravityY:210*speed,rotate:{min:-240,max:240},scale:{start:.72*size,end:.42*size},alpha:{start:A(.98),end:0},tint:[0xeee5cf,0xc7bda5,0x948a74],...(burst?{}:{frequency:freq(260),quantity:1})};
  }else if(kind==='debris'){
   key='lkdev_particle_square';count=Math.max(5,Math.round(30*den));
   cfg={x:R(-18,18,spread),y:R(-12,12,spread),lifespan:L(520,1200),speed:R(45,160,speed),angle:{min:195,max:345},gravityY:180*speed,rotate:{min:-180,max:180},scale:{start:.65*size,end:.18*size},alpha:{start:A(.95),end:0},tint:[0x8a7556,0xc1ad87,0x4d4438],...(burst?{}:{frequency:freq(235),quantity:1})};
  }else{
   count=Math.max(6,Math.round(34*den));
   cfg={x:R(-34,34,spread),y:R(-34,34,spread),lifespan:L(450,1050),speed:R(38,155,speed),angle:{min:0,max:360},scale:{start:.9*size,end:0},alpha:{start:A(.95),end:0},tint:[0x7fe7ff,0x8bffcf,0xa7a0ff],blendMode:'ADD',...(burst?{}:{frequency:freq(120),quantity:1})};
  }
  return {key,count,cfg,depth:this.getDevFxMeta(kind).depth};
 }

 makeDevParticleEmitter(x,y,key,config,depth=200){
  this.ensureDevParticleTextures();
  return this.scene.add.particles(x,y,key,{...config,frequency:-1}).setDepth(depth);
 }

 burstDevParticles(kind=this.devLab.fxSelected){
  const s=this.scene,p=s.player;if(!p?.active)return;
  this.ensureDevParticleTextures();
  const built=this.buildDevFxConfig(kind,{burst:true});
  const emitter=this.makeDevParticleEmitter(p.x,p.y-8,built.key,built.cfg,built.depth);emitter.explode(built.count);
  const st=this.getDevFxSettings(kind);s.time.delayedCall(Math.max(2200,Math.round(5200*st.life)),()=>emitter?.destroy?.());
  this.notifyDev(`${this.getDevFxMeta(kind).name}: одиночный выброс · ${built.count} частиц.`,'good');
 }

 toggleAmbientDevFx(kind,force=null,{silent=false}={}){
  const current=this.devLab.ambient.get(kind),shouldEnable=force===null?!current:Boolean(force);
  if(!shouldEnable){
   if(current?.emitter?.active)current.emitter.destroy();this.devLab.ambient.delete(kind);
   if(!silent)this.notifyDev(`${this.getDevFxMeta(kind).name}: постоянный эффект выключен.`);
   this.refreshStateButtons();this.refreshFxLabUi(false);return;
  }
  if(current)return;
  const s=this.scene,st=this.getDevFxSettings(kind),built=this.buildDevFxConfig(kind,{burst:false});
  const emitter=s.add.particles(0,0,built.key,built.cfg).setDepth(built.depth);
  const entry={emitter,follow:st.follow,kind,fixedX:st.fixedX,fixedY:st.fixedY};
  if(st.follow==='fixed' && (!Number.isFinite(st.fixedX)||!Number.isFinite(st.fixedY))){
   st.fixedX=s.player?.x??s.cameras.main.worldView.centerX;st.fixedY=s.player?.y??s.cameras.main.worldView.centerY;entry.fixedX=st.fixedX;entry.fixedY=st.fixedY;
  }
  this.devLab.ambient.set(kind,entry);this.updateDevAmbientPositions();
  if(!silent)this.notifyDev(`${this.getDevFxMeta(kind).name}: постоянный эффект включён.`,'good');
  this.refreshStateButtons();this.refreshFxLabUi(false);
 }

 rebuildDevFx(kind){
  if(!this.devLab.ambient.has(kind))return;
  this.toggleAmbientDevFx(kind,false,{silent:true});this.toggleAmbientDevFx(kind,true,{silent:true});
 }

 updateDevAmbientPositions(){
  const s=this.scene,cam=s.cameras.main;
  for(const entry of this.devLab.ambient.values()){
   if(!entry?.emitter?.active)continue;
   if(entry.follow==='player'&&s.player?.active)entry.emitter.setPosition(s.player.x,s.player.y);
   else if(entry.follow==='fixed')entry.emitter.setPosition(entry.fixedX??s.player?.x??cam.worldView.centerX,entry.fixedY??s.player?.y??cam.worldView.centerY);
   else entry.emitter.setPosition(cam.worldView.centerX,cam.worldView.centerY);
  }
 }

 refreshFxLabUi(refreshButtons=true){
  if(typeof document==='undefined')return;
  const kind=this.devLab.fxSelected||'fog',meta=this.getDevFxMeta(kind),st=this.getDevFxSettings(kind);
  const desc=document.getElementById('lkdev-fx-description');if(desc)desc.textContent=`${meta.name} — ${meta.desc}`;
  const defs=[['fxDensity','density','lkdev-fx-density'],['fxSize','size','lkdev-fx-size'],['fxSpeed','speed','lkdev-fx-speed'],['fxAlpha','alpha','lkdev-fx-alpha'],['fxLife','life','lkdev-fx-life'],['fxSpread','spread','lkdev-fx-spread']];
  for(const [range,prop,outId] of defs){const input=document.querySelector(`[data-dev-range="${range}"]`);if(input)input.value=String(st[prop]);const out=document.getElementById(outId);if(out)out.textContent=`${Number(st[prop]).toFixed(2)}×`;}
  const toggle=this.root?.querySelector?.('[data-action="fxToggle"]');if(toggle)toggle.textContent=this.devLab.ambient.has(kind)?'Постоянно · ВЫКЛ':'Постоянно · ВКЛ';
  if(refreshButtons)this.refreshStateButtons();
 }

 formatDevFxSettings(){
  const kind=this.devLab.fxSelected,meta=this.getDevFxMeta(kind),st=this.getDevFxSettings(kind);
  const follow={camera:'камера',player:'герой',fixed:'точка на карте'}[st.follow]||st.follow;
  return `Эффект: ${meta.name}\nРежим: ${this.devLab.ambient.has(kind)?'постоянный ВКЛ':'постоянный ВЫКЛ / можно использовать выброс'}\nПривязка: ${follow}\nПлотность: ${st.density.toFixed(2)}x\nРазмер: ${st.size.toFixed(2)}x\nСкорость: ${st.speed.toFixed(2)}x\nПрозрачность: ${st.alpha.toFixed(2)}x\nВремя жизни: ${st.life.toFixed(2)}x\nРазброс: ${st.spread.toFixed(2)}x`;
 }

 copyDevFxSettings(){
  const text=this.formatDevFxSettings();const out=document.getElementById('lkdev-fx-output');if(out)out.value=text;
  try{navigator.clipboard?.writeText(text);}catch{}
  this.notifyDev(`${this.getDevFxMeta(this.devLab.fxSelected).name}: параметры подготовлены для копирования.`,'good');
 }

 clearDevParticles({silent=false}={}){
  for(const entry of this.devLab.ambient.values())if(entry?.emitter?.active)entry.emitter.destroy();
  this.devLab.ambient.clear();
  if(!silent)this.notifyDev('Все тестовые FX-частицы выключены.','good');
  this.refreshStateButtons();this.refreshFxLabUi(false);
 }

 devLightCandidates(){
  const s=this.scene,out=[];
  if(s.playerVisual?.active)out.push(s.playerVisual);
  for(const e of s.enemies||[])if(e?.visual?.active)out.push(e.visual);
  for(const o of s.devEnvironmentObjects||[])if(o?.active && Math.abs(o.x-s.player.x)<700 && Math.abs(o.y-s.player.y)<500)out.push(o);
  return out.slice(0,140);
 }

 refreshDevLightTargets(force=false){
  if(!this.devLab.lightEnabled)return;
  const now=performance.now();if(!force&&now-this.devLab.lastLightRefreshAt<900)return;this.devLab.lastLightRefreshAt=now;
  for(const obj of this.devLightCandidates()){
   if(this.devLab.lightTargets.has(obj) || typeof obj.setPipeline!=='function')continue;
   try{obj.setPipeline('Light2D');this.devLab.lightTargets.add(obj);}catch{}
  }
 }

 toggleDevLight(force=null){
  if(!this.isWebGlDev()){this.notifyDev('Light2D требует WebGL.','error');return;}
  const enable=force===null?!this.devLab.lightEnabled:Boolean(force);
  if(!enable){this.disableDevLight();return;}
  try{
   const s=this.scene;s.lights.enable();s.lights.setAmbientColor(0x383a3e);
   this.devLab.light=s.lights.addLight(s.player.x,s.player.y,this.devLab.lightRadius,0xffbd70,this.devLab.lightIntensity);
   this.devLab.lightEnabled=true;this.refreshDevLightTargets(true);this.notifyDev('Light2D включён. Свет следует за героем.','good');
  }catch(error){this.devLab.lightEnabled=false;this.notifyDev(`Light2D не запустился: ${error?.message||error}`,'error');}
  this.refreshStateButtons();
 }

 disableDevLight({silent=false}={}){
  const s=this.scene;
  if(this.devLab.light){try{s.lights.removeLight(this.devLab.light);}catch{}this.devLab.light=null;}
  for(const obj of this.devLab.lightTargets){if(obj?.active)try{obj.resetPipeline?.();}catch{}}
  this.devLab.lightTargets.clear();this.devLab.lightEnabled=false;
  try{s.lights.disable();}catch{}
  if(!silent)this.notifyDev('Light2D выключен.','good');
  this.refreshStateButtons();
 }

 pulseDevLight(){
  if(!this.devLab.lightEnabled)this.toggleDevLight(true);
  const light=this.devLab.light;if(!light)return;
  const base=this.devLab.lightIntensity;
  this.scene.tweens.add({targets:light,intensity:Math.min(3,base*1.7),duration:130,ease:'Quad.easeOut',yoyo:true,repeat:2,onComplete:()=>{if(light)light.intensity=base;}});
  this.notifyDev('Пульсация Light2D запущена.');
 }


 applyImpactPreset(name){
  const presets={
   light:{hitStop:18,shakeX:3,shakeY:2,zoom:1.025,flash:.08,slow:.72,knockback:70,pitch:80,particles:'sparks'},
   heavy:{hitStop:42,shakeX:8,shakeY:5,zoom:1.08,flash:.28,slow:.36,knockback:150,pitch:-80,particles:'sparks'},
   critical:{hitStop:58,shakeX:11,shakeY:7,zoom:1.12,flash:.52,slow:.25,knockback:210,pitch:-180,particles:'blood'},
   boss:{hitStop:72,shakeX:10,shakeY:14,zoom:1.15,flash:.38,slow:.22,knockback:260,pitch:-320,particles:'debris'},
   death:{hitStop:96,shakeX:16,shakeY:12,zoom:1.20,flash:.72,slow:.16,knockback:320,pitch:-450,particles:'bones'}
  };
  Object.assign(this.devLab.impact,presets[name]||presets.heavy);
  this.refreshAdvancedLabUi();
  this.notifyDev(`Impact Lab: пресет «${name}». Нажми «ТЕСТ УДАРА».`,'good');
 }

 runImpactTest(){
  const s=this.scene,cam=s.cameras.main,p=s.player,st=this.devLab.impact;
  if(!cam||!p?.active)return;
  const previousScale=s.devTimeScale||1;
  const intensity=new Phaser.Math.Vector2(Math.max(0,st.shakeX)/(Math.max(1,cam.width)*1.7),Math.max(0,st.shakeY)/(Math.max(1,cam.height)*1.7));
  try{cam.shake(Math.max(80,120+st.hitStop*2.2),intensity,true);}catch{cam.shake(Math.max(80,120+st.hitStop*2.2),Math.max(intensity.x,intensity.y),true);}
  if(st.flash>0.01)cam.flash(Math.round(70+180*st.flash),255,246,225,true);
  const baseZoom=cam.zoom;
  if(st.zoom>1.001){s.tweens.add({targets:cam,zoom:baseZoom*st.zoom,duration:55,ease:'Quad.easeOut',yoyo:true,hold:Math.max(0,st.hitStop*.3),onComplete:()=>cam.setZoom(baseZoom)});}
  if(st.particles)this.burstDevParticles(st.particles);
  const enemies=(s.enemies||[]).filter(e=>e?.active&&e.hp>0).sort((a,b)=>Phaser.Math.Distance.Between(p.x,p.y,a.x,a.y)-Phaser.Math.Distance.Between(p.x,p.y,b.x,b.y));
  const enemy=enemies[0];
  if(enemy?.body&&st.knockback>0){const a=Phaser.Math.Angle.Between(p.x,p.y,enemy.x,enemy.y);enemy.body.setVelocity(Math.cos(a)*st.knockback,Math.sin(a)*st.knockback);}
  this.playImpactLabSound(st.pitch);
  if(st.hitStop>0){
   this.setTimeScale(Math.max(.02,Math.min(.12,st.slow*.18)));
   window.setTimeout(()=>{if(!this.scene?.sys?.isActive?.())return;this.setTimeScale(st.slow);window.setTimeout(()=>{if(this.scene?.sys?.isActive?.())this.setTimeScale(previousScale);},170);},st.hitStop);
  }else if(st.slow<.999){this.setTimeScale(st.slow);window.setTimeout(()=>{if(this.scene?.sys?.isActive?.())this.setTimeScale(previousScale);},180);}
  this.notifyDev('Impact Lab: профиль удара воспроизведён.','good');
 }

 playImpactLabSound(detune=0){
  const s=this.scene,key=s.cache.audio.exists('sfx_hero_sword_impact')?'sfx_hero_sword_impact':(s.cache.audio.exists('sfx_hero_sword_attack')?'sfx_hero_sword_attack':null);
  if(!key||!s.sound||s.sound.locked)return;
  try{const snd=s.sound.add(key,{volume:.42*getGameSettings().sfxVolume,detune:Number(detune)||0});snd.once('complete',()=>snd.destroy());snd.play();}catch{}
 }

 formatImpactProfile(){const x=this.devLab.impact;return `Impact Profile\nHit-stop: ${Math.round(x.hitStop)} ms\nShake X/Y: ${Math.round(x.shakeX)} / ${Math.round(x.shakeY)}\nZoom: ${x.zoom.toFixed(2)}x\nFlash: ${x.flash.toFixed(2)}\nSlow-mo: ${x.slow.toFixed(2)}x\nKnockback: ${Math.round(x.knockback)}\nPitch: ${Math.round(x.pitch)} ct\nParticles: ${x.particles}`;}
 copyImpactProfile(){const text=this.formatImpactProfile(),out=document.getElementById('lkdev-impact-output');if(out)out.value=text;try{navigator.clipboard?.writeText(text);}catch{}this.notifyDev('Impact Profile подготовлен для копирования.','good');}

 refreshAdvancedLabUi(){
  if(typeof document==='undefined')return;
  const impact=this.devLab.impact,audio=this.devLab.audioLab,b=this.devLab.boids;
  const vals={impactHitStop:impact.hitStop,impactShakeX:impact.shakeX,impactShakeY:impact.shakeY,impactZoom:impact.zoom,impactFlash:impact.flash,impactSlow:impact.slow,impactKnockback:impact.knockback,impactPitch:impact.pitch,audioRate:audio.rate,audioDetune:audio.detune,audioPan:audio.pan,boidSeparation:b.separation,boidCohesion:b.cohesion,boidAlignment:b.alignment,boidWander:b.wander};
  for(const [k,v] of Object.entries(vals)){const el=document.querySelector(`[data-dev-range="${k}"]`);if(el)el.value=String(v);}
  const texts={'lkdev-impact-hitstop':`${Math.round(impact.hitStop)} ms`,'lkdev-impact-shakex':String(Math.round(impact.shakeX)),'lkdev-impact-shakey':String(Math.round(impact.shakeY)),'lkdev-impact-zoom':`${impact.zoom.toFixed(2)}×`,'lkdev-impact-flash':impact.flash.toFixed(2),'lkdev-impact-slow':`${impact.slow.toFixed(2)}×`,'lkdev-impact-knockback':String(Math.round(impact.knockback)),'lkdev-impact-pitch':`${Math.round(impact.pitch)} ct`,'lkdev-audio-rate':`${audio.rate.toFixed(2)}×`,'lkdev-audio-detune':`${Math.round(audio.detune)} ct`,'lkdev-audio-pan':audio.pan.toFixed(2),'lkdev-boid-separation':b.separation.toFixed(2),'lkdev-boid-cohesion':b.cohesion.toFixed(2),'lkdev-boid-alignment':b.alignment.toFixed(2),'lkdev-boid-wander':b.wander.toFixed(2)};
  for(const [id,value] of Object.entries(texts)){const el=document.getElementById(id);if(el)el.textContent=value;}
  this.refreshAudioMixerUi();
 }

 toggleCamera2(kind){
  const s=this.scene,cam=s.cameras.main,c=this.devLab.camera2;
  if(!cam)return;
  if(kind==='deadzone'){c.deadzone=!c.deadzone;cam.setDeadzone(c.deadzone?Math.round(cam.width*.22):0,c.deadzone?Math.round(cam.height*.18):0);}
  else if(kind==='lookAhead')c.lookAhead=!c.lookAhead;
  else if(kind==='threat')c.threatLook=!c.threatLook;
  else if(kind==='dampingSoft'){c.damping=.075;cam.setLerp(c.damping,c.damping);}
  else if(kind==='dampingTight'){c.damping=.24;cam.setLerp(c.damping,c.damping);}
  else if(kind==='reset'){c.deadzone=false;c.lookAhead=false;c.threatLook=false;c.damping=.12;cam.setDeadzone(0,0);cam.setLerp(.12,.12);cam.setFollowOffset(0,0);}
  this.notifyDev(`Camera 2.0: ${kind}.`,'good');this.refreshStateButtons();
 }

 updateCamera2(delta=16){
  const s=this.scene,cam=s.cameras.main,p=s.player,c=this.devLab.camera2;if(!cam||!p?.active)return;
  let targetX=0,targetY=0;
  if(c.lookAhead&&p.body){targetX+=Phaser.Math.Clamp(p.body.velocity.x*.22,-150,150);targetY+=Phaser.Math.Clamp(p.body.velocity.y*.14,-90,90);}
  if(c.threatLook){const enemies=(s.enemies||[]).filter(e=>e?.active&&e.hp>0&&Phaser.Math.Distance.Between(p.x,p.y,e.x,e.y)<620);if(enemies.length){const cx=enemies.reduce((n,e)=>n+e.x,0)/enemies.length,cy=enemies.reduce((n,e)=>n+e.y,0)/enemies.length;targetX+=Phaser.Math.Clamp((cx-p.x)*.18,-120,120);targetY+=Phaser.Math.Clamp((cy-p.y)*.10,-70,70);}}
  c.baseFollowOffsetX=Phaser.Math.Linear(c.baseFollowOffsetX||0,targetX,Math.min(1,(delta/1000)*4.5));c.baseFollowOffsetY=Phaser.Math.Linear(c.baseFollowOffsetY||0,targetY,Math.min(1,(delta/1000)*4.5));
  if(c.lookAhead||c.threatLook)cam.setFollowOffset(-c.baseFollowOffsetX,-c.baseFollowOffsetY);else if(Math.abs(c.baseFollowOffsetX)+Math.abs(c.baseFollowOffsetY)>.5){c.baseFollowOffsetX*=.85;c.baseFollowOffsetY*=.85;cam.setFollowOffset(-c.baseFollowOffsetX,-c.baseFollowOffsetY);}
 }

 runProceduralShake(kind){
  const cam=this.scene.cameras.main;if(!cam)return;
  const presets={step:[180,2,7],impact:[120,10,3],explosion:[330,9,9],quake:[900,5,11]},p=presets[kind]||presets.impact;
  const intensity=new Phaser.Math.Vector2(p[1]/Math.max(1,cam.width),p[2]/Math.max(1,cam.height));
  try{cam.shake(p[0],intensity,true);}catch{cam.shake(p[0],Math.max(intensity.x,intensity.y),true);}
  this.notifyDev(`Процедурная тряска: ${kind}.`);
 }

 toggleExtraCamera(kind){
  const s=this.scene,c=this.devLab.camera2;
  if(kind==='clear'){if(c.minimap){s.cameras.remove(c.minimap);c.minimap=null;}if(c.pip){s.cameras.remove(c.pip);c.pip=null;}this.notifyDev('Дополнительные камеры убраны.','good');return;}
  if(kind==='minimap'){
   if(c.minimap){s.cameras.remove(c.minimap);c.minimap=null;this.notifyDev('Миникарта выключена.');return;}
   const viewW=Number(s.scale?.gameSize?.width||s.cameras.main.width||1280),viewH=Number(s.scale?.gameSize?.height||s.cameras.main.height||720),w=Math.min(230,Math.max(150,Math.round(viewW*.22))),h=Math.min(145,Math.max(96,Math.round(viewH*.22)));const cam=s.cameras.add(12,12,w,h,false,'lkdevMinimap');cam.setZoom(.28);cam.setBackgroundColor(0x080808);cam.setBounds(0,0,STAGE0.WORLD_WIDTH,STAGE0.WORLD_HEIGHT);if(s.player)cam.startFollow(s.player,true,.18,.18);c.minimap=cam;this.notifyDev('Миникарта включена.','good');return;
  }
  if(kind==='pip'){
   if(c.pip){s.cameras.remove(c.pip);c.pip=null;this.notifyDev('PiP выключен.');return;}
   const target=s.activeChampion?.active?s.activeChampion:(s.enemies||[]).find(e=>e?.active&&e.hp>0);if(!target){this.notifyDev('Для PiP нужен живой враг.','error');return;}
   const w=230,h=145,viewW=Number(s.scale?.gameSize?.width||s.cameras.main.width||1280),x=Math.max(10,viewW-w-12),y=12;const cam=s.cameras.add(x,y,w,h,false,'lkdevPip');cam.setZoom(1.1);cam.setBackgroundColor(0x000000);cam.startFollow(target,true,.12,.12);c.pip=cam;this.notifyDev('PiP врага включён.','good');
  }
 }

 ensureDevDisplacementTexture(){
  const s=this.scene,key='lkdev_displace_noise';if(s.textures.exists(key))return key;
  const tex=s.textures.createCanvas(key,128,128),ctx=tex.getContext(),img=ctx.createImageData(128,128);for(let i=0;i<img.data.length;i+=4){const v=Phaser.Math.Between(80,176);img.data[i]=v;img.data[i+1]=255-v;img.data[i+2]=128;img.data[i+3]=255;}ctx.putImageData(img,0,0);tex.refresh();return key;
 }

 applyShaderLab(kind){
  const cam=this.scene.cameras.main;if(!this.isWebGlDev()||!cam?.postFX){this.notifyDev('Shader/PostFX Lab требует WebGL.','error');return;}
  try{cam.postFX.clear();}catch{}
  this.devLab.shaderLab.kind=kind;this.devLab.shaderLab.fx=null;
  if(kind==='clear'){this.notifyDev('Shader Lab очищен.','good');return;}
  try{
   if(kind==='heat'){
    const fx=cam.postFX.addBarrel?.(1.015);if(!fx)throw new Error('Barrel FX недоступен');this.devLab.shaderLab.fx=fx;this.scene.tweens.add({targets:fx,amount:1.045,duration:520,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
   }else if(kind==='displace'){
    const key=this.ensureDevDisplacementTexture();const fx=cam.postFX.addDisplacement?.(key,.004,.004);if(!fx)throw new Error('Displacement FX недоступен');this.devLab.shaderLab.fx=fx;
   }else{
    const fx=cam.postFX.addColorMatrix();if(kind==='chromatic'){fx.hue?.(7);fx.contrast?.(1.08);}
    else if(kind==='cold'){fx.hue?.(-10);fx.saturate?.(-.12);fx.contrast?.(1.06);}
    else if(kind==='warm'){fx.hue?.(9);fx.saturate?.(.10);fx.brightness?.(1.04);}
    else if(kind==='contrast'){fx.contrast?.(1.32);fx.saturate?.(-.08);}this.devLab.shaderLab.fx=fx;
   }
   this.notifyDev(`Shader/Color Lab: ${kind}.`,'good');
  }catch(error){this.devLab.shaderLab.kind='none';this.notifyDev(`Shader Lab: ${error?.message||error}`,'error');}
 }

 runBlendDemo(kind){
  const s=this.scene,p=s.player;if(!p?.active)return;this.ensureDevParticleTextures();const emitter=s.add.particles(p.x,p.y-20,'lkdev_particle_dot',{speed:{min:30,max:150},angle:{min:0,max:360},lifespan:900,scale:{start:1.4,end:0},alpha:{start:.8,end:0},tint:kind==='multiply'?[0x5c3928,0x2c241f]:[0xffd46a,0xff693a,0xffffff],frequency:-1}).setDepth(240);try{emitter.setBlendMode(kind==='multiply'?Phaser.BlendModes.MULTIPLY:Phaser.BlendModes.ADD);}catch{}emitter.explode(42);s.time.delayedCall(1300,()=>emitter.destroy());this.notifyDev(`Blend Mode: ${kind}.`);
 }

 ensureProceduralDecalTexture(kind){
  const s=this.scene,key=`lkdev_decal_${kind}`;if(s.textures.exists(key))return key;const g=s.make.graphics({x:0,y:0,add:false});g.clear();
  if(kind==='blood'){g.fillStyle(0x7f1212,.92);g.fillEllipse(48,48,72,38);g.fillCircle(22,54,10);g.fillCircle(76,39,8);g.fillCircle(84,60,5);}
  else if(kind==='scorch'){g.fillStyle(0x1a1512,.72);g.fillCircle(48,48,35);g.lineStyle(5,0x322217,.55);for(let a=0;a<6;a++){const ang=a*Math.PI/3;g.lineBetween(48,48,48+Math.cos(ang)*43,48+Math.sin(ang)*43);}}
  else if(kind==='rune'){g.lineStyle(4,0x78e7ff,.86);g.strokeCircle(48,48,34);g.lineBetween(22,61,48,18);g.lineBetween(48,18,76,61);g.lineBetween(22,61,76,61);}
  else if(kind==='crack'){g.lineStyle(4,0x17120f,.8);g.lineBetween(48,12,42,42);g.lineBetween(42,42,20,68);g.lineBetween(42,42,64,57);g.lineBetween(64,57,82,84);g.lineBetween(64,57,88,42);}
  else {g.fillStyle(0x312821,.65);g.fillEllipse(30,38,15,28);g.fillEllipse(66,60,15,28);}
  g.generateTexture(key,96,96);g.destroy();this.devLab.worldFx.proceduralTextures.add(key);return key;
 }

 ensureDevRenderTexture(){
  const s=this.scene,w=this.devLab.worldFx;if(w.renderTexture?.active)return w.renderTexture;const p=s.player||{x:s.cameras.main.worldView.centerX,y:s.cameras.main.worldView.centerY};const width=1024,height=768,left=Phaser.Math.Clamp(p.x-width/2,0,Math.max(0,STAGE0.WORLD_WIDTH-width)),top=Phaser.Math.Clamp(p.y-height/2,0,Math.max(0,STAGE0.WORLD_HEIGHT-height));try{const rt=s.add.renderTexture(left,top,width,height).setOrigin(0,0).setDepth(4.6);w.renderTexture=rt;w.renderTextureBounds={left,top,width,height};return rt;}catch{return null;}
 }

 runDecalAction(kind,{silent=false}={}){
  const w=this.devLab.worldFx;if(kind==='clear'){try{w.renderTexture?.clear();}catch{}for(const o of w.decals||[])o?.destroy?.();w.decals=[];if(!silent)this.notifyDev('Следы RenderTexture очищены.','good');return;}
  const s=this.scene,p=s.player;if(!p?.active)return;const key=this.ensureProceduralDecalTexture(kind);let rt=this.ensureDevRenderTexture(),done=false;
  if(rt&&w.renderTextureBounds){const b=w.renderTextureBounds,lx=p.x-b.left,ly=p.y-b.top;if(lx>20&&ly>20&&lx<b.width-20&&ly<b.height-20){try{const img=s.make.image({x:0,y:0,key,add:false}).setScale(kind==='footprints'?.65:Phaser.Math.FloatBetween(.7,1.25)).setRotation(Phaser.Math.FloatBetween(-.5,.5)).setAlpha(kind==='rune'?.8:.9);rt.draw(img,lx,ly);img.destroy();done=true;}catch{}}}
  if(!done){w.decals=w.decals||[];const img=s.add.image(p.x,p.y+10,key).setScale(kind==='footprints'?.65:Phaser.Math.FloatBetween(.7,1.25)).setRotation(Phaser.Math.FloatBetween(-.5,.5)).setAlpha(.85).setDepth(4.6);w.decals.push(img);}
  if(!silent)this.notifyDev(`${kind}: след оставлен на земле${done?' через RenderTexture':' через fallback sprite'}.`,'good');
 }

 updateDevTrail(time=this.scene.time.now){
  const w=this.devLab.worldFx,s=this.scene;if(!w.trail||!s.player?.active)return;if(time-(w.lastTrailAt||0)<150)return;const body=s.player.body;if(body&&Math.hypot(body.velocity.x,body.velocity.y)<18)return;w.lastTrailAt=time;this.runDecalAction('footprints',{silent:true});
 }

 toggleFogRevealMask(){
  const s=this.scene,w=this.devLab.worldFx;if(w.fogMask){try{w.fogMask.destroy();}catch{}try{w.fogMaskGraphics.destroy();}catch{}try{w.fogOverlay.destroy();}catch{}w.fogMask=null;w.fogMaskGraphics=null;w.fogOverlay=null;this.notifyDev('Маска тумана выключена.');return;}
  const overlay=s.add.rectangle(STAGE0.WORLD_WIDTH/2,STAGE0.WORLD_HEIGHT/2,STAGE0.WORLD_WIDTH,STAGE0.WORLD_HEIGHT,0x11171a,.72).setDepth(4800);const g=s.make.graphics({x:0,y:0,add:false});g.fillStyle(0xffffff,1);g.fillCircle(s.player?.x||0,s.player?.y||0,180);const mask=g.createGeometryMask();mask.invertAlpha=true;overlay.setMask(mask);w.fogOverlay=overlay;w.fogMaskGraphics=g;w.fogMask=mask;this.notifyDev('GeometryMask: герой прорезает туман.','good');
 }

 applyScreenFx(kind){
  const s=this.scene,w=this.devLab.worldFx;if(w.screenOverlay){w.screenOverlay.destroy(true);w.screenOverlay=null;}w.screenOverlayKind=kind;if(kind==='clear'){this.notifyDev('Screen-space FX очищены.','good');return;}
  const cam=s.cameras.main,container=s.add.container(0,0).setScrollFactor(0).setDepth(4998);const width=cam.width/Math.max(.1,cam.zoom),height=cam.height/Math.max(.1,cam.zoom);
  if(kind==='blood'){for(let i=0;i<18;i++)container.add(s.add.circle(Phaser.Math.Between(0,width),Phaser.Math.Between(0,height),Phaser.Math.Between(5,28),0x7d0c0c,Phaser.Math.FloatBetween(.12,.35)).setScrollFactor(0));}
  else if(kind==='dirt'){for(let i=0;i<35;i++)container.add(s.add.ellipse(Phaser.Math.Between(0,width),Phaser.Math.Between(0,height),Phaser.Math.Between(8,45),Phaser.Math.Between(4,18),0x332a21,Phaser.Math.FloatBetween(.05,.18)).setScrollFactor(0));}
  else if(kind==='cracks'){const g=s.add.graphics().setScrollFactor(0);g.lineStyle(2,0xd9e0df,.18);for(let i=0;i<8;i++){let x=Phaser.Math.Between(0,width),y=Phaser.Math.Between(0,height);for(let j=0;j<4;j++){const nx=x+Phaser.Math.Between(-45,45),ny=y+Phaser.Math.Between(-45,45);g.lineBetween(x,y,nx,ny);x=nx;y=ny;}}container.add(g);}
  else if(kind==='ash'){for(let i=0;i<42;i++)container.add(s.add.rectangle(Phaser.Math.Between(0,width),Phaser.Math.Between(0,height),Phaser.Math.Between(1,4),Phaser.Math.Between(1,4),0xb7b2a6,Phaser.Math.FloatBetween(.08,.28)).setRotation(Phaser.Math.FloatBetween(0,Math.PI)).setScrollFactor(0));}
  w.screenOverlay=container;this.notifyDev(`Screen-space FX: ${kind}.`,'good');
 }

 toggleWorldLayer(kind){
  const s=this.scene,w=this.devLab.worldFx;
  if(kind==='depth'){w.depthSort=!w.depthSort;if(!w.depthSort)this.restoreDevDepths();this.notifyDev(`Depth-sort по Y: ${w.depthSort?'ВКЛ':'ВЫКЛ'}.`);return;}
  if(kind==='foreground'){if(w.foreground.length){for(const o of w.foreground)o.destroy();w.foreground=[];this.notifyDev('Foreground выключен.');return;}const cam=s.cameras.main;for(let i=0;i<7;i++){const e=s.add.ellipse(Phaser.Math.Between(0,cam.width),Phaser.Math.Between(-80,cam.height+80),Phaser.Math.Between(130,330),Phaser.Math.Between(25,70),0x090b0b,Phaser.Math.FloatBetween(.12,.28)).setScrollFactor(0).setDepth(4995).setRotation(Phaser.Math.FloatBetween(-.5,.5));w.foreground.push(e);}this.notifyDev('Foreground layer включён.','good');return;}
  if(kind==='parallax'){if(w.parallax.length){for(const o of w.parallax)o.destroy();w.parallax=[];this.notifyDev('Parallax выключен.');return;}const p=s.player||{x:0,y:0};for(let i=0;i<10;i++){const e=s.add.ellipse(p.x+Phaser.Math.Between(-700,700),p.y+Phaser.Math.Between(-420,420),Phaser.Math.Between(120,360),Phaser.Math.Between(35,110),0x777c78,Phaser.Math.FloatBetween(.025,.08)).setDepth(1.5).setScrollFactor(Phaser.Math.FloatBetween(.35,.72));w.parallax.push(e);}this.notifyDev('Parallax слой включён.','good');return;}
  if(kind==='shadows'){w.dynamicShadows=!w.dynamicShadows;if(!w.dynamicShadows)this.clearDynamicShadows();this.notifyDev(`Динамические тени: ${w.dynamicShadows?'ВКЛ':'ВЫКЛ'}.`);return;}
  if(kind==='clear'){for(const o of w.foreground)o.destroy();for(const o of w.parallax)o.destroy();w.foreground=[];w.parallax=[];w.depthSort=false;this.restoreDevDepths();w.dynamicShadows=false;this.clearDynamicShadows();this.notifyDev('Тестовые мировые слои очищены.','good');}
 }

 updateDepthSort(){
  const s=this.scene,w=this.devLab.worldFx;if(!w.depthSort)return;w.depthRestore=w.depthRestore||new Map();const actors=[s.playerVisual,...(s.enemies||[]).map(e=>e?.visual)].filter(o=>o?.active);for(const o of actors){if(!w.depthRestore.has(o))w.depthRestore.set(o,o.depth);o.setDepth(10+o.y*.02);}
 }
 restoreDevDepths(){const w=this.devLab.worldFx;for(const [o,d] of w.depthRestore||[])if(o?.active)o.setDepth(d);w.depthRestore?.clear?.();}

 updateDynamicShadows(){
  const s=this.scene,w=this.devLab.worldFx;if(!w.dynamicShadows)return;const lightX=(s.player?.x||0)-180,lightY=(s.player?.y||0)-160;const actors=[s.player,...(s.enemies||[]).filter(e=>e?.active&&e.hp>0).slice(0,35)];const alive=new Set();for(const a of actors){if(!a?.active)continue;alive.add(a);let sh=w.shadowMap.get(a);if(!sh){sh=s.add.ellipse(a.x,a.y,34,12,0x000000,.26).setDepth(5.2);w.shadowMap.set(a,sh);}const dx=a.x-lightX,dy=a.y-lightY,len=Math.max(1,Math.hypot(dx,dy));sh.setPosition(a.x+dx/len*18,a.y+dy/len*12).setRotation(Math.atan2(dy,dx)).setScale(1.2,.75).setVisible(true);}for(const [a,sh] of [...w.shadowMap])if(!alive.has(a)||!a?.active){sh.destroy();w.shadowMap.delete(a);}}
 clearDynamicShadows(){const w=this.devLab.worldFx;for(const sh of w.shadowMap.values())sh?.destroy?.();w.shadowMap.clear();}

 runDestructionDemo(){
  const s=this.scene,p=s.player;if(!p?.active)return;const x=p.x+110,y=p.y;const crate=s.add.rectangle(x,y,70,54,0x5c4330,1).setStrokeStyle(3,0x2b1d13,.9).setDepth(16);s.tweens.add({targets:crate,scaleX:1.08,scaleY:.92,duration:90,yoyo:true,repeat:1,onComplete:()=>{crate.destroy();this.spawnPhysicsDebris(x,y,{bounce:false,count:10});}});this.notifyDev('Разрушаемый объект: тест запущен.','good');
 }

 stopAudioLab(){const a=this.devLab.audioLab;if(a.lastSound){try{a.lastSound.stop();a.lastSound.destroy();}catch{}a.lastSound=null;}if(a.source){a.source.destroy();a.source=null;}a.spatial=false;this.notifyDev('Тестовые SFX остановлены.');}
 getAudioLabKey(kind){const s=this.scene,sets={sword:['sfx_hero_sword_impact','sfx_hero_sword_attack'],skill:['sfx_mage_cast','sfx_broken_saint_holy_beam'],crow:['sfx_crow_wings']};return (sets[kind]||sets.sword).find(k=>s.cache.audio.exists(k))||null;}
 playAudioLab(kind='sword'){const s=this.scene,a=this.devLab.audioLab,key=this.getAudioLabKey(kind);if(!key||!s.sound||s.sound.locked){this.notifyDev(`Audio Lab: звук ${kind} не загружен.`,'error');return null;}this.stopAudioLab();try{const sound=s.sound.add(key,{volume:.48*getGameSettings().sfxVolume,rate:a.rate,detune:a.detune});sound.setRate?.(a.rate);sound.setDetune?.(a.detune);sound.setPan?.(a.pan);a.lastSound=sound;sound.once('complete',()=>{if(a.lastSound===sound)a.lastSound=null;sound.destroy();});sound.play();this.notifyDev(`Audio Lab: ${kind}.`,'good');return sound;}catch(error){this.notifyDev(`Audio Lab: ${error?.message||error}`,'error');return null;}}
 toggleAudioSpatial(){const a=this.devLab.audioLab,s=this.scene;if(a.spatial){this.stopAudioLab();return;}const sound=this.playAudioLab('crow');if(!sound)return;a.spatial=true;a.source=s.add.circle((s.player?.x||0)+230,s.player?.y||0,8,0x6ed8ff,.8).setDepth(4990);try{sound.setLoop?.(true);}catch{}this.notifyDev('Spatial audio: голубая точка — источник, pan зависит от камеры.','good');}
 runAudioSweep(){const a=this.devLab.audioLab,s=this.scene;const sound=this.playAudioLab('crow');if(!sound)return;try{sound.setLoop?.(true);}catch{}const holder={pan:-1};sound.setPan?.(-1);s.tweens.add({targets:holder,pan:1,duration:2200,ease:'Sine.easeInOut',onUpdate:()=>sound.setPan?.(holder.pan),onComplete:()=>{try{sound.stop();sound.destroy();}catch{}if(a.lastSound===sound)a.lastSound=null;}});this.notifyDev('Audio pan sweep: L → R.','good');}
 updateAudioSpatial(){const a=this.devLab.audioLab,s=this.scene;if(!a.spatial||!a.lastSound?.isPlaying||!a.source?.active)return;const cam=s.cameras.main,p=s.player;if(p?.active){const t=s.time.now*.00065;a.source.setPosition(p.x+Math.cos(t)*260,p.y+Math.sin(t)*120);}const center=cam.worldView.centerX,half=Math.max(1,cam.worldView.width*.5),pan=Phaser.Math.Clamp((a.source.x-center)/half,-1,1);a.lastSound.setPan?.(pan);}

 getAudioMixerSlot(index){return this.devLab.audioMixer.slots[Number(index)]||null;}
 rebuildAudioMixerSlotsUi(){const host=this.root?.querySelector?.('#lkdev-mixer-slots');if(host)host.innerHTML=this.devLab.audioMixer.slots.map((_,index)=>this.buildAudioMixerSlotHtml(index)).join('');this.refreshAudioMixerUi();}
 addAudioMixerSlot(){const m=this.devLab.audioMixer;if(m.slots.length>=m.maxSlots){this.notifyDev(`Audio Mixer: максимум ${m.maxSlots} каналов.`,'error');return;}m.slots.push(this.createAudioMixerSlot(''));this.rebuildAudioMixerSlotsUi();this.notifyDev(`Audio Mixer: добавлен канал ${m.slots.length}.`,'good');}
 removeAudioMixerSlot(){const m=this.devLab.audioMixer;if(m.slots.length<=1){this.notifyDev('Audio Mixer: должен остаться хотя бы один канал.','error');return;}const index=m.slots.length-1;this.stopAudioMixerSlot(index,{resumeMusic:false,silent:true});m.slots.pop();this.resumeGameplayMusicAfterMixer();this.rebuildAudioMixerSlotsUi();this.notifyDev(`Audio Mixer: удалён канал ${index+1}.`,'good');}
 ensureAudioMixerAssetLoaded(key,{silent=false}={}){
  const s=this.scene,m=this.devLab.audioMixer;if(!key)return Promise.resolve(false);if(s.cache?.audio?.exists?.(key))return Promise.resolve(true);
  const meta=this.getAudioMixerMeta(key);if(!meta?.url){if(!silent)this.notifyDev(`Audio Mixer: ${key} отсутствует в аудио-манифесте.`,'error');return Promise.resolve(false);}if(m.loading.has(key))return m.loading.get(key);
  const promise=new Promise(resolve=>{const loader=s.load;let settled=false;const cleanup=()=>{loader.off(`filecomplete-audio-${key}`,onComplete);loader.off('loaderror',onError);m.loading.delete(key);};const finish=(ok)=>{if(settled)return;settled=true;cleanup();resolve(Boolean(ok));this.rebuildAudioMixerSlotsUi();};const onComplete=()=>finish(true);const onError=(file)=>{if(String(file?.key||'')===key)finish(false);};loader.once(`filecomplete-audio-${key}`,onComplete);loader.on('loaderror',onError);try{loader.audio(key,meta.url);if(!(typeof loader.isLoading==='function'&&loader.isLoading()))loader.start();if(!silent)this.notifyDev(`Audio Mixer: подгружаю «${meta.label}»…`);}catch(error){cleanup();if(!silent)this.notifyDev(`Audio Mixer: не удалось поставить ${meta.label} в загрузку: ${error?.message||error}`,'error');resolve(false);}});
  m.loading.set(key,promise);return promise;
 }
 setAudioMixerSlotSound(index,key){
  index=Number(index);const slots=this.devLab.audioMixer.slots;if(!Number.isInteger(index)||index<0||index>=slots.length)return;this.stopAudioMixerSlot(index,{resumeMusic:false,silent:true});const meta=this.getAudioMixerMeta(key);slots[index]=this.createAudioMixerSlot(meta?.key||'');this.resumeGameplayMusicAfterMixer();this.refreshAudioMixerUi();
  if(meta){const slot=slots[index];slot.loading=!this.scene.cache.audio.exists(meta.key);this.refreshAudioMixerSlotUi(index);this.ensureAudioMixerAssetLoaded(meta.key,{silent:false}).then(ok=>{if(this.getAudioMixerSlot(index)!==slot)return;slot.loading=false;this.refreshAudioMixerSlotUi(index);if(ok)this.notifyDev(`Audio Mixer: канал ${index+1} готов — ${meta.label}.`,'good');else this.notifyDev(`Audio Mixer: не удалось загрузить «${meta.label}».`,'error');});}else this.notifyDev(`Audio Mixer: канал ${index+1} очищен.`,'good');
 }
 setAudioMixerSlotParam(index,prop,value){
  const slot=this.getAudioMixerSlot(index);if(!slot)return;
  if(prop==='volume')slot.volume=Phaser.Math.Clamp(Number(value)||0,0,1.5);
  else if(prop==='rate')slot.rate=Phaser.Math.Clamp(Number(value)||1,0.5,1.75);
  else if(prop==='detune')slot.detune=Phaser.Math.Clamp(Number(value)||0,-1200,1200);
  else if(prop==='pan')slot.pan=Phaser.Math.Clamp(Number(value)||0,-1,1);
  else return;
  const sound=slot.sound;
  if(sound){
   try{if(prop==='volume')sound.setVolume?.(slot.muted?0:slot.volume);}catch{}
   try{if(prop==='rate')sound.setRate?.(slot.rate);}catch{}
   try{if(prop==='detune')sound.setDetune?.(slot.detune);}catch{}
   try{if(prop==='pan')sound.setPan?.(slot.pan);}catch{}
  }
  this.refreshAudioMixerSlotUi(Number(index));
 }
 suspendGameplayMusicForMixer(){
  const m=this.devLab.audioMixer;if(m.gameplayMusicPaused)return;
  const refs=[this.scene.backgroundMusic,this.scene.brokenSaintMusic].filter(sound=>sound?.isPlaying);
  if(!refs.length)return;
  m.gameplayMusicRefs=[];
  for(const sound of refs){try{sound.pause();if(sound.isPaused)m.gameplayMusicRefs.push(sound);}catch{}}
  m.gameplayMusicPaused=m.gameplayMusicRefs.length>0;
 }
 hasActiveAudioMixerMusic(){
  return this.devLab.audioMixer.slots.some(slot=>{
   const meta=this.getAudioMixerMeta(slot?.key);const sound=slot?.sound;
   return Boolean(meta?.music&&sound&&(sound.isPlaying||sound.isPaused));
  });
 }
 resumeGameplayMusicAfterMixer(){
  const m=this.devLab.audioMixer;if(!m.gameplayMusicPaused||this.hasActiveAudioMixerMusic())return;
  const refs=[...(m.gameplayMusicRefs||[])];m.gameplayMusicRefs=[];m.gameplayMusicPaused=false;
  for(const sound of refs){try{if(sound?.isPaused)sound.resume();}catch{}}
 }
 async startAudioMixerSlot(index,{restart=false,silent=false,skipEnsure=false}={}){
  index=Number(index);const slot=this.getAudioMixerSlot(index),s=this.scene;if(!slot?.key)return null;const meta=this.getAudioMixerMeta(slot.key);
  if(!skipEnsure&&!s.cache.audio.exists(slot.key)){slot.loading=true;this.refreshAudioMixerSlotUi(index);const loaded=await this.ensureAudioMixerAssetLoaded(slot.key,{silent});slot.loading=false;this.refreshAudioMixerSlotUi(index);if(!loaded)return null;}
  if(!s.sound||s.sound.locked||!s.cache.audio.exists(slot.key)){if(!silent)this.notifyDev(`Audio Mixer: «${meta?.label||slot.key}» не удалось подготовить.`,'error');return null;}
  if(slot.sound){if(slot.sound.isPaused&&!restart){try{slot.sound.resume();this.refreshAudioMixerSlotUi(index);return slot.sound;}catch{}}if(slot.sound.isPlaying&&!restart){this.refreshAudioMixerSlotUi(index);return slot.sound;}this.stopAudioMixerSlot(index,{resumeMusic:false,silent:true});}
  if(meta?.music)this.suspendGameplayMusicForMixer();
  try{const sound=s.sound.add(slot.key,{volume:slot.muted?0:slot.volume,rate:slot.rate,detune:slot.detune,loop:slot.loop});sound.lkDevMixerMusic=Boolean(meta?.music);slot.sound=sound;try{sound.setRate?.(slot.rate);}catch{}try{sound.setDetune?.(slot.detune);}catch{}try{sound.setPan?.(slot.pan);}catch{}try{sound.setLoop?.(slot.loop);}catch{}try{sound.setMute?.(slot.muted);}catch{}sound.once('complete',()=>{if(slot.sound===sound)slot.sound=null;try{sound.destroy();}catch{}this.resumeGameplayMusicAfterMixer();this.refreshAudioMixerSlotUi(index);});sound.play();this.refreshAudioMixerSlotUi(index);if(!silent)this.notifyDev(`Audio Mixer: канал ${index+1} запущен — ${meta?.label||slot.key}.`,'good');return sound;}catch(error){slot.sound=null;this.resumeGameplayMusicAfterMixer();if(!silent)this.notifyDev(`Audio Mixer: ${error?.message||error}`,'error');return null;}
 }
 stopAudioMixerSlot(index,{resumeMusic=true,silent=false}={}){
  index=Number(index);const slot=this.getAudioMixerSlot(index);if(!slot)return;
  const sound=slot.sound;slot.sound=null;
  if(sound){try{if(sound.isPlaying||sound.isPaused)sound.stop();}catch{}try{sound.destroy();}catch{}}
  if(resumeMusic)this.resumeGameplayMusicAfterMixer();
  this.refreshAudioMixerSlotUi(index);
  if(!silent)this.notifyDev(`Audio Mixer: канал ${index+1} остановлен.`);
 }
 toggleAudioMixerSlotLoop(index){
  const slot=this.getAudioMixerSlot(index);if(!slot)return;slot.loop=!slot.loop;try{slot.sound?.setLoop?.(slot.loop);}catch{}this.refreshAudioMixerSlotUi(Number(index));
 }
 toggleAudioMixerSlotMute(index){
  const slot=this.getAudioMixerSlot(index);if(!slot)return;slot.muted=!slot.muted;
  try{slot.sound?.setMute?.(slot.muted);}catch{}
  try{slot.sound?.setVolume?.(slot.muted?0:slot.volume);}catch{}
  this.refreshAudioMixerSlotUi(Number(index));
 }
 async playAudioMixerAll(restart=false){
  if(restart)this.stopAudioMixerAll({resumeMusic:false,silent:true});const slots=this.devLab.audioMixer.slots;const selected=slots.map((slot,index)=>({slot,index})).filter(x=>x.slot?.key);if(!selected.length){this.notifyDev('Audio Mixer: в сете нет выбранных звуков.','error');return;}
  this.notifyDev(`Audio Mixer: подготавливаю сет из ${selected.length} каналов…`);const readiness=await Promise.all(selected.map(({slot})=>this.ensureAudioMixerAssetLoaded(slot.key,{silent:true})));const ready=selected.filter((_,i)=>readiness[i]);const startPromises=ready.map(({index})=>this.startAudioMixerSlot(index,{restart:Boolean(restart),silent:true,skipEnsure:true}));const startResults=await Promise.all(startPromises);const started=startResults.filter(Boolean).length;this.resumeGameplayMusicAfterMixer();this.refreshAudioMixerUi();this.notifyDev(started?`Audio Mixer: одновременно запущено каналов — ${started}.`:'Audio Mixer: выбранные звуки не удалось загрузить.',started?'good':'error');
 }
 stopAudioMixerAll({resumeMusic=true,silent=false}={}){
  for(let i=0;i<this.devLab.audioMixer.slots.length;i++)this.stopAudioMixerSlot(i,{resumeMusic:false,silent:true});
  if(resumeMusic)this.resumeGameplayMusicAfterMixer();
  this.refreshAudioMixerUi();
  if(!silent)this.notifyDev('Audio Mixer: весь сет остановлен.','good');
 }
 refreshAudioMixerSlotUi(index){
  if(typeof document==='undefined')return;const slot=this.getAudioMixerSlot(index);if(!slot)return;
  const select=this.root?.querySelector?.(`[data-mixer-select="${index}"]`);if(select&&select.value!==slot.key)select.value=slot.key;
  const defs={volume:[slot.volume,`lkdev-mixer-volume-${index}`,v=>v.toFixed(2)],rate:[slot.rate,`lkdev-mixer-rate-${index}`,v=>`${v.toFixed(2)}×`],detune:[slot.detune,`lkdev-mixer-detune-${index}`,v=>`${Math.round(v)}ct`],pan:[slot.pan,`lkdev-mixer-pan-${index}`,v=>v.toFixed(2)]};
  for(const [prop,[value,outId,format]] of Object.entries(defs)){const range=this.root?.querySelector?.(`[data-mixer-range="${index}:${prop}"]`);if(range)range.value=String(value);const out=document.getElementById(outId);if(out)out.textContent=format(value);}
  const state=document.getElementById(`lkdev-mixer-state-${index}`);if(state){const sound=slot.sound;state.textContent=slot.loading?'LOAD…':slot.muted?'MUTE':sound?.isPaused?'PAUSE':sound?.isPlaying?'PLAY':slot.key?'READY':'STOP';state.style.color=slot.loading?'#d6b36a':slot.muted?'#df9e7b':sound?.isPlaying?'#78cf91':'#8f979c';}
  const loopBtn=this.root?.querySelector?.(`[data-action="mixerLoop"][data-value="${index}"]`);loopBtn?.classList.toggle('on',Boolean(slot.loop));
  const muteBtn=this.root?.querySelector?.(`[data-action="mixerMute"][data-value="${index}"]`);muteBtn?.classList.toggle('on',Boolean(slot.muted));
 }
 refreshAudioMixerUi(){for(let i=0;i<this.devLab.audioMixer.slots.length;i++)this.refreshAudioMixerSlotUi(i);}
 formatAudioMixerSet(){
  const lines=['Audio Mixer Set'];
  this.devLab.audioMixer.slots.forEach((slot,index)=>{const meta=this.getAudioMixerMeta(slot.key);if(!slot.key)return;lines.push(`Channel ${index+1}: ${meta?.label||slot.key}`);lines.push(`  Key: ${slot.key}`);lines.push(`  Volume: ${slot.volume.toFixed(2)}`);lines.push(`  Rate: ${slot.rate.toFixed(2)}x`);lines.push(`  Pitch: ${Math.round(slot.detune)} ct`);lines.push(`  Pan: ${slot.pan.toFixed(2)}`);lines.push(`  Loop: ${slot.loop?'ON':'OFF'}`);lines.push(`  Mute: ${slot.muted?'ON':'OFF'}`);});
  return lines.join('\n');
 }
 copyAudioMixerSet(){const text=this.formatAudioMixerSet(),out=document.getElementById('lkdev-mixer-output');if(out)out.value=text;try{navigator.clipboard?.writeText(text);}catch{}this.notifyDev('Audio Mixer Set подготовлен для копирования.','good');}

 spawnBoids(count=12){
  const s=this.scene,b=this.devLab.boids;if(!s.textures.exists('crown_fly_1')){this.notifyDev('Boids: текстуры ворон не загружены.','error');return;}this.clearBoids();count=Phaser.Math.Clamp(Math.round(count)||12,4,40);const p=s.player||{x:s.cameras.main.worldView.centerX,y:s.cameras.main.worldView.centerY};for(let i=0;i<count;i++){const x=p.x+Phaser.Math.Between(-180,180),y=p.y-110+Phaser.Math.Between(-120,120),sprite=s.add.sprite(x,y,'crown_fly_1').setScale(CROW_VISUAL_SCALE).setDepth(235).play({key:'crown_fly',startFrame:i%4});b.list.push({sprite,x,y,vx:Phaser.Math.Between(-90,90),vy:Phaser.Math.Between(-60,60),wander:Phaser.Math.FloatBetween(0,Math.PI*2)});}b.enabled=true;this.notifyDev(`Boids: ${count} живых ворон. Быстро двигай героя и смотри, как стая перестраивается.`,'good');}
 clearBoids(){const b=this.devLab.boids;for(const x of b.list)x.sprite?.destroy?.();b.list=[];b.enabled=false;}
 applyBoidPreset(name){const b=this.devLab.boids;if(name==='tight')Object.assign(b,{separation:1.55,cohesion:1.35,alignment:1.05,wander:.18});else Object.assign(b,{separation:.85,cohesion:.42,alignment:.48,wander:1.35});this.refreshAdvancedLabUi();this.notifyDev(`Boids preset: ${name}.`,'good');}
 updateBoids(delta=16){
  const b=this.devLab.boids,s=this.scene;if(!b.enabled||!b.list.length)return;const dt=Math.min(.05,delta/1000),center=s.player?.active?s.player:{x:s.cameras.main.worldView.centerX,y:s.cameras.main.worldView.centerY};for(const boid of b.list){if(!boid.sprite?.active)continue;let sx=0,sy=0,cx=0,cy=0,ax=0,ay=0,n=0;for(const other of b.list){if(other===boid||!other.sprite?.active)continue;const dx=boid.x-other.x,dy=boid.y-other.y,d2=dx*dx+dy*dy;if(d2>140*140)continue;n++;cx+=other.x;cy+=other.y;ax+=other.vx;ay+=other.vy;if(d2<58*58){const d=Math.max(1,Math.sqrt(d2));sx+=dx/d*(58-d)/58;sy+=dy/d*(58-d)/58;}}if(n){cx=cx/n-boid.x;cy=cy/n-boid.y;ax=ax/n-boid.vx;ay=ay/n-boid.vy;}boid.wander+=Phaser.Math.FloatBetween(-1,1)*dt*2.8;let fx=sx*150*b.separation+cx*.018*b.cohesion+ax*.018*b.alignment+Math.cos(boid.wander)*42*b.wander+(center.x-boid.x)*.006,fy=sy*150*b.separation+cy*.018*b.cohesion+ay*.018*b.alignment+Math.sin(boid.wander)*42*b.wander+((center.y-105)-boid.y)*.006;boid.vx+=fx*dt;boid.vy+=fy*dt;const speed=Math.hypot(boid.vx,boid.vy),max=145;if(speed>max){boid.vx=boid.vx/speed*max;boid.vy=boid.vy/speed*max;}boid.x+=boid.vx*dt;boid.y+=boid.vy*dt;boid.sprite.setPosition(boid.x,boid.y).setFlipX(boid.vx<0);}}

 spawnPhysicsDebris(x,y,{bounce=false,count=8}={}){const s=this.scene,w=this.devLab.worldFx;for(let i=0;i<count;i++){const r=s.add.rectangle(x+Phaser.Math.Between(-15,15),y+Phaser.Math.Between(-10,10),Phaser.Math.Between(7,18),Phaser.Math.Between(5,13),0x7d684e,1).setDepth(210);s.physics.add.existing(r);r.body.setVelocity(Phaser.Math.Between(-170,170),Phaser.Math.Between(-210,-70));r.body.setGravityY(360);r.body.setBounce(bounce?.65:.15);s.tweens.add({targets:r,rotation:Phaser.Math.FloatBetween(-5,5),alpha:0,duration:Phaser.Math.Between(1100,1800),onComplete:()=>{r.destroy();}});w.debris.push(r);}}
 runPhysicsLab(kind){const s=this.scene,p=s.player||{x:0,y:0},w=this.devLab.worldFx;if(kind==='clear'){for(const o of w.debris)o?.destroy?.();w.debris=[];for(const c of w.chain){c.graphics?.destroy?.();for(const n of c.nodes||[])n.destroy?.();}w.chain=[];this.notifyDev('Physics Lab очищен.');return;}if(kind==='matter'){this.notifyDev(s.matter?'Matter plugin доступен в этой Scene. Основную игру всё равно не переключаем.':'Matter сейчас не инжектирован в Scene — это ожидаемо: билд остаётся Arcade Physics.','good');return;}if(kind==='debris'||kind==='bounce'){this.spawnPhysicsDebris(p.x+100,p.y,{bounce:kind==='bounce',count:12});this.notifyDev(`Physics Lab: ${kind}.`,'good');return;}if(kind==='chain'){const g=s.add.graphics().setDepth(220),nodes=[];for(let i=0;i<9;i++)nodes.push(s.add.circle(p.x+50+i*18,p.y-80,5,0xc8b077,1).setDepth(221));w.chain.push({graphics:g,nodes,originX:p.x+50,originY:p.y-80,phase:0});this.notifyDev('Arcade-safe constraint demo: цепь симулируется математически.','good');}}
 updatePhysicsLab(delta=16){const w=this.devLab.worldFx;if(!w.chain.length)return;const t=this.scene.time.now*.003;for(const c of w.chain){if(!c.graphics?.active)continue;c.graphics.clear().lineStyle(3,0x8f774a,.9);let px=c.originX,py=c.originY;for(let i=0;i<c.nodes.length;i++){const n=c.nodes[i];const x=c.originX+i*18+Math.sin(t+i*.55)*i*2.4,y=c.originY+i*4+Math.sin(t*1.3+i*.38)*10;n.setPosition(x,y);c.graphics.lineBetween(px,py,x,y);px=x;py=y;}}}

 updateFogMask(){const w=this.devLab.worldFx,s=this.scene;if(!w.fogMaskGraphics||!s.player?.active)return;w.fogMaskGraphics.clear();w.fogMaskGraphics.fillStyle(0xffffff,1);w.fogMaskGraphics.fillCircle(s.player.x,s.player.y,185);}

 clearAdvancedLabs(){
  this.toggleExtraCamera('clear');this.clearBoids();this.stopAudioLab();this.stopAudioMixerAll({silent:true});const w=this.devLab.worldFx;try{w.fogMask?.destroy();}catch{}try{w.fogMaskGraphics?.destroy();}catch{}try{w.fogOverlay?.destroy();}catch{}w.fogMask=null;w.fogMaskGraphics=null;w.fogOverlay=null;if(w.screenOverlay){w.screenOverlay.destroy(true);w.screenOverlay=null;}for(const o of w.foreground)o.destroy();for(const o of w.parallax)o.destroy();w.foreground=[];w.parallax=[];this.restoreDevDepths();w.depthSort=false;this.clearDynamicShadows();w.dynamicShadows=false;this.runPhysicsLab('clear');try{w.renderTexture?.destroy();}catch{}w.renderTexture=null;w.renderTextureBounds=null;for(const o of w.decals||[])o?.destroy?.();w.decals=[];w.trail=false;w.lastTrailAt=0;try{this.scene.cameras.main.setDeadzone(0,0).setFollowOffset(0,0).setLerp(.12,.12);}catch{}
 }

 setEnvironmentAiMode(mode){
  const allowed=new Set(['normal','mageCover','shieldChoke']);this.scene.devFlags.environmentAiMode=allowed.has(mode)?mode:'normal';this.notifyDev(`AI × окружение: ${this.scene.devFlags.environmentAiMode}.`,'good');this.refreshStateButtons();
 }

 setDevAiMode(mode){
  const legacy={distance:'skirmish',retreat:'reserve'};
  mode=legacy[mode]||mode;
  this.scene.devFlags.enemyAiMode=Object.prototype.hasOwnProperty.call(DEV_AI_MODE_META,mode)?mode:'normal';
  const meta=DEV_AI_MODE_META[this.scene.devFlags.enemyAiMode]||DEV_AI_MODE_META.normal;
  for(const e of this.scene.enemies||[]){
   delete e.devFlankCommitted;delete e.devOrbitSign;delete e.devAiSeed;
  }
  this.scene._devAiContext=null;
  this.notifyDev(`AI: ${meta.name}. ${meta.desc}`,'good');
  this.refreshStateButtons();
  this.refreshAiModeDescription();
 }

 testDevSkill(index){
  const s=this.scene;if(![1,2,3].includes(index))return;
  const previous=s.devFlags.infiniteMana;s.devFlags.infiniteMana=true;s.mana=s.maxMana;s.skillLockUntil=0;
  try{s.handleSkillInput(index);}finally{s.devFlags.infiniteMana=previous;if(previous)s.mana=s.maxMana;}
  this.notifyDev(`Навык ${index} запущен.`);
 }

 spawnDevCrowFlock(count=10){
  const s=this.scene;if(!s.player?.active||!s.textures.exists('crown_1_1')){this.notifyDev('Спрайты ворон недоступны в этой сборке.','error');return;}
  count=Phaser.Math.Clamp(Math.round(count)||10,1,30);
  const id=`dev_crows_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const centerX=s.clampWorldX(s.player.x+Phaser.Math.Between(120,190),80),centerY=s.clampWorldY(s.player.y+Phaser.Math.Between(-70,70),80);
  const flock={id,centerX,centerY,triggered:false,crows:[],devFlock:true};s.crowFlocks.set(id,flock);
  const used=[];
  for(let i=0;i<count;i++){
   let x=centerX,y=centerY;
   for(let tries=0;tries<90;tries++){
    const a=Phaser.Math.FloatBetween(0,Math.PI*2),r=Phaser.Math.FloatBetween(45,Math.max(90,48+count*7));
    const cx=centerX+Math.cos(a)*r,cy=centerY+Math.sin(a)*r*0.68;
    if(used.every(p=>Phaser.Math.Distance.Between(cx,cy,p.x,p.y)>=34)){x=cx;y=cy;break;}
   }
   used.push({x,y});const variant=Phaser.Math.Between(1,3);
   const shadow=s.add.ellipse(x,y+4,23,8,0x000000,0.24).setDepth(5.4);
   const sprite=s.add.sprite(x,y,`crown_${variant}_1`).setOrigin(0.5,0.82).setScale(CROW_VISUAL_SCALE*Phaser.Math.FloatBetween(0.94,1.08)).setFlipX(Math.random()<0.5).setDepth(7.2);
   sprite.play({key:`crown_idle_${variant}`,startFrame:i%3});
   const crow={flockId:id,index:i,variant,sprite,shadow,state:'idle',groundX:x,groundY:y,homeX:x,homeY:y,altitude:0,launchAt:0,takeoffAt:0,flyAt:0,flightEndsAt:0,speed:0,angle:0,exitAngle:0,turnSign:i%2===0?1:-1,turnUntil:0,retiring:false,scatterAngle:null,maneuverQueue:[],nextManeuverAt:0,devCrow:true};
   flock.crows.push(crow);s.crows.push(crow);
  }
  this.notifyDev(`Создана тестовая стая: ${count} ворон. Подойди или нажми «Разогнать».`,'good');
 }

 scatterDevCrowFlocks(){
  let n=0;for(const flock of this.scene.crowFlocks?.values?.()||[])if(flock.devFlock&&!flock.triggered){this.scene.scatterCrowFlock(flock,this.scene.time.now);n++;}
  this.notifyDev(n?`Разогнано тестовых стай: ${n}.`:'Нет сидящих тестовых стай.',n?'good':'error');
 }

 clearDevCrowFlocks({silent=false}={}){
  const s=this.scene;let removed=0;
  for(const [id,flock] of [...(s.crowFlocks?.entries?.()||[])]){
   if(!flock.devFlock)continue;
   for(const crow of flock.crows||[]){if(crow.sprite?.active)crow.sprite.destroy();if(crow.shadow?.active)crow.shadow.destroy();crow.state='gone';removed++;}
   s.crowFlocks.delete(id);
  }
  s.crows=(s.crows||[]).filter(c=>!c.devCrow&&c?.sprite?.active);
  if(!silent)this.notifyDev(`Тестовые вороны убраны: ${removed}.`,'good');
 }

 runDevWorldEvent(kind){
  const s=this.scene;
  if(kind==='storyCrows'){
   const flock=s.crowFlocks?.get?.('ruined_wagon_crows_01');if(flock)s.scatterCrowFlock(flock,s.time.now);else{this.notifyDev('Сюжетная стая сейчас не загружена.','error');return;}
  }else if(kind==='closeGate'){
   const gate=WORLD_DESIGN.GATES[Math.max(0,(s.currentWorldZoneIndex||0)-1)];if(!gate){this.notifyDev('Позади героя нет ворот для закрытия.','error');return;}s.createBacktrackSeal(gate,{animate:true,silent:true});
  }else if(kind==='openGate'){
   const gate=WORLD_DESIGN.GATES[s.currentWorldZoneIndex||0];if(!gate){this.notifyDev('В этой зоне нет следующих ворот.','error');return;}s.unlockWorldGateForChampion(gate.champion);
  }else if(kind==='wagonCinematic'){
   const complete=()=>this.notifyDev('Тест 3-кадрового синематика завершён.','good');
   const started=s.storyDirector?.playCinematic(ZONE2_WAGON_CINEMATIC_PAGES,{eventId:`dev_wagon_cinematic_${Date.now()}`,once:false,releaseTextureKeys:[],onComplete:complete});if(!started){this.notifyDev('Синематик сейчас нельзя запустить.','error');return;}
  }
  this.notifyDev('Событие мира запущено.','good');
 }

 runDevLabPreset(name){
  const s=this.scene;
  if(name==='combat'){
   this.clearDevParticles({silent:true});this.applyCameraPostFx('clear');this.setDevAiMode('surround');this.spawnMixed(20);s.devFlags.godMode=true;
  }else if(name==='atmosphere'){
   this.toggleAmbientDevFx('ash',true);this.toggleAmbientDevFx('fog',true);this.devLab.fxSelected='fog';this.applyCameraPostFx('vignette');this.refreshFxLabUi();
  }else if(name==='boss'){
   if(!s.activeChampion?.active)this.spawnSelectedChampion();s.devFlags.godMode=true;this.testCameraEffect('bossFocus');
  }else if(name==='critical'){
   this.setPlayerHp(10);this.applyCameraPostFx('vignette');this.testCameraEffect('shakeSoft');
  }
  this.notifyDev(`Пресет «${name}» применён.`,'good');this.refreshStateButtons();
 }

 saveDevLabPreset(){
  try{
   const data={time:this.scene.devTimeScale||1,aiMode:this.scene.devFlags.enemyAiMode||'normal',environmentAiMode:this.scene.devFlags.environmentAiMode||'normal',cameraFxKind:this.devLab.cameraFxKind,playerFxKind:this.devLab.playerFxKind,ambient:[...this.devLab.ambient.keys()],fxSelected:this.devLab.fxSelected,fxSettings:Object.fromEntries([...this.devLab.fxSettings.entries()].map(([k,v])=>[k,{...v}])),lightEnabled:this.devLab.lightEnabled,lightRadius:this.devLab.lightRadius,lightIntensity:this.devLab.lightIntensity,impact:{...this.devLab.impact},audioLab:{rate:this.devLab.audioLab.rate,detune:this.devLab.audioLab.detune,pan:this.devLab.audioLab.pan},audioMixer:{slots:this.devLab.audioMixer.slots.map(slot=>({key:slot.key,volume:slot.volume,rate:slot.rate,detune:slot.detune,pan:slot.pan,loop:slot.loop,muted:slot.muted}))},boids:{separation:this.devLab.boids.separation,cohesion:this.devLab.boids.cohesion,alignment:this.devLab.boids.alignment,wander:this.devLab.boids.wander},camera2:{deadzone:this.devLab.camera2.deadzone,lookAhead:this.devLab.camera2.lookAhead,threatLook:this.devLab.camera2.threatLook,damping:this.devLab.camera2.damping}};
   localStorage.setItem(this.devLabPresetKey,JSON.stringify(data));this.notifyDev('Текущий набор лаборатории сохранён локально.','good');
  }catch(error){this.notifyDev(`Не удалось сохранить: ${error?.message||error}`,'error');}
 }

 loadDevLabPreset(){
  try{
   const data=JSON.parse(localStorage.getItem(this.devLabPresetKey)||'null');if(!data){this.notifyDev('Сохранённого набора пока нет.','error');return;}
   this.setTimeScale(Number(data.time)||1);this.setDevAiMode(data.aiMode||'normal');this.setEnvironmentAiMode(data.environmentAiMode||'normal');this.clearDevParticles({silent:true});
   this.devLab.fxSettings.clear();for(const [k,v] of Object.entries(data.fxSettings||{}))this.devLab.fxSettings.set(k,{...this.getDevFxSettings(k),...v});this.devLab.fxSelected=data.fxSelected||'fog';
   for(const k of data.ambient||[])this.toggleAmbientDevFx(k,true,{silent:true});
   this.applyCameraPostFx(data.cameraFxKind||'clear');this.applyPlayerDevFx(data.playerFxKind||'clear');this.devLab.lightRadius=Number(data.lightRadius)||260;this.devLab.lightIntensity=Number(data.lightIntensity)||1.6;if(data.lightEnabled)this.toggleDevLight(true);else this.disableDevLight({silent:true});
   if(data.impact)Object.assign(this.devLab.impact,data.impact);if(data.audioLab)Object.assign(this.devLab.audioLab,data.audioLab);
   if(Array.isArray(data.audioMixer?.slots)){
    this.stopAudioMixerAll({silent:true});
    const savedSlots=data.audioMixer.slots.slice(0,this.devLab.audioMixer.maxSlots);
    this.devLab.audioMixer.slots=(savedSlots.length?savedSlots:[{}]).map(saved=>{
     const slot=this.createAudioMixerSlot(saved?.key||'');
     slot.volume=Phaser.Math.Clamp(Number(saved?.volume??slot.volume),0,1.5);slot.rate=Phaser.Math.Clamp(Number(saved?.rate??1),0.5,1.75);slot.detune=Phaser.Math.Clamp(Number(saved?.detune??0),-1200,1200);slot.pan=Phaser.Math.Clamp(Number(saved?.pan??0),-1,1);slot.loop=Boolean(saved?.loop);slot.muted=Boolean(saved?.muted);return slot;
    });
    this.rebuildAudioMixerSlotsUi();
   }
   if(data.boids)Object.assign(this.devLab.boids,data.boids);
   if(data.camera2){Object.assign(this.devLab.camera2,data.camera2);const cam=this.scene.cameras.main;cam.setDeadzone(this.devLab.camera2.deadzone?Math.round(cam.width*.22):0,this.devLab.camera2.deadzone?Math.round(cam.height*.18):0);cam.setLerp(this.devLab.camera2.damping||.12,this.devLab.camera2.damping||.12);}
   this.refreshFxLabUi();this.refreshAdvancedLabUi();
   this.notifyDev('Сохранённый набор лаборатории загружен.','good');
  }catch(error){this.notifyDev(`Не удалось загрузить набор: ${error?.message||error}`,'error');}
 }

 clearDevLabEffects({silent=false}={}){
  try{this.scene.cameras.main?.postFX?.clear?.();}catch{}
  try{const hero=this.getDevFxHero();hero?.postFX?.clear?.();hero?.preFX?.clear?.();}catch{}
  this.clearDevParticles({silent:true});this.disableDevLight({silent:true});this.clearDevCrowFlocks({silent:true});this.clearAdvancedLabs();
  this.devLab.cameraFxKind='none';this.devLab.playerFxKind='none';
  if(!silent)this.notifyDev('Тестовые FX очищены.','good');
 }

 setTimeScale(scale){
  scale=Phaser.Math.Clamp(scale,0.1,4);
  this.scene.devTimeScale=scale;
  this.scene.time.timeScale=scale;
  this.scene.tweens.timeScale=scale;
  // Arcade Physics timeScale is inverse: 2 = half speed.
  this.scene.physics.world.timeScale=1/scale;
 }

 spawnPosition(index,total){
  const s=this.scene,r=190+(index%3)*45,a=(index/Math.max(1,total))*Math.PI*2;
  return {x:s.clampWorldX(s.player.x+Math.cos(a)*r,35),y:s.clampWorldY(s.player.y+Math.sin(a)*r,35)};
 }
 spawnEnemies(type,count){for(let i=0;i<count;i++)this.scene.spawnEnemy(type,this.spawnPosition(i,count));}
 spawnMixed(count){const types=['skeleton','skeleton','mage','shield'];for(let i=0;i<count;i++)this.scene.spawnEnemy(types[i%types.length],this.spawnPosition(i,count));}
 clearProjectiles(){for(const p of this.scene.projectiles||[])if(p?.active)p.destroy();this.scene.projectiles=[];}
 clearHazards(){this.scene.clearChampionHazards?.();}

 destroyEnemyEntity(enemy){
  if(!enemy) return;
  this.scene.captainSystem?.remove(enemy);
  if(enemy.visual?.active)enemy.visual.destroy();
  if(enemy.auraVisual?.active)enemy.auraVisual.destroy();
  if(enemy.reflectVisual?.active)enemy.reflectVisual.destroy();
  this.scene.destroyEnemyReadabilityShadow(enemy);
  if(enemy.active)enemy.destroy();
  this.scene.enemies=this.scene.enemies.filter(e=>e&&e!==enemy&&e.active);
  if(this.scene.activeChampion===enemy){this.scene.activeChampion=null;this.scene.championEventActive=false;this.scene.championNameText?.setVisible(false);this.scene.championHpBack?.setVisible(false);this.scene.championHpFill?.setVisible(false);this.clearHazards();}
 }
 killOrdinaryEnemies(){for(const e of [...this.scene.enemies])if(e.active&&e.type!=='champion'){e.hp=0;this.scene.finalizeEnemyDeath(e,this.scene.time.now);}this.scene.enemies=this.scene.enemies.filter(e=>e?.active);}
 deleteOrdinaryEnemies(){this.scene.captainSystem?.clear();for(const e of [...this.scene.enemies])if(e.type!=='champion')this.destroyEnemyEntity(e);this.clearProjectiles();}

 championKind(){return document.getElementById('lkdev-champion')?.value||'brokenSaint';}
 spawnSelectedChampion(){if(this.scene.activeChampion?.active)this.deleteChampion();this.scene.spawnChampion(this.championKind(),true);}
 resetChampion(){const e=this.scene.activeChampion;if(!e?.active)return;e.hp=e.maxHp;e.staggerUntil=0;e.skillLiftUntil=0;e.skillTremorUntil=0;e.nextSkillAt=this.scene.time.now+1200;e.nextSecondaryAt=this.scene.time.now+2600;e.reflectUntil=0;e.guardUntil=0;this.clearHazards();this.scene.updateChampionBar();}
 killChampion(){const e=this.scene.activeChampion;if(!e?.active)return;e.hp=0;this.scene.finalizeEnemyDeath(e,this.scene.time.now);this.scene.enemies=this.scene.enemies.filter(x=>x?.active);}
 deleteChampion(){const e=this.scene.activeChampion;if(e)this.destroyEnemyEntity(e);}
 setChampionHp(percent){const e=this.scene.activeChampion;if(!e?.active)return;e.hp=Math.max(1,Math.round(e.maxHp*percent/100));this.scene.updateChampionBar();}

 setPlayerHp(percent){const s=this.scene;s.player.hp=Math.max(1,Math.round((s.player.maxHp||100)*percent/100));s.gameOver=false;s.updateLowHealthState(true);}
 resetUpgrades(){const s=this.scene;s.meleeAttack.level=1;s.meleeAttack.damage=15;s.meleeAttack.cooldown=1000;s.meleeAttack.radius=99;s.weaponLevels={sword:1};}
 applyNoCollision(){const enabled=!this.scene.devFlags.noCollision;if(this.scene.playerEnemyCollider)this.scene.playerEnemyCollider.active=enabled;if(this.scene.playerAshCollider)this.scene.playerAshCollider.active=enabled;if(this.scene.enemyAshCollider)this.scene.enemyAshCollider.active=enabled;this.applyAllEnvironmentVisibility();}
 teleport(x){const s=this.scene;x=Phaser.Math.Clamp(x,25,STAGE0.WORLD_WIDTH-25);const pos=s.findNearestFreeGroundPoint(x,WORLD_DESIGN.ROUTE_Y,24,320,18);s.player.setPosition(pos.x,pos.y);s.player.body?.setVelocity(0,0);s.playerVisual?.setPosition(pos.x,pos.y);if(this.freeCamera||this.cameraLocked)s.cameras.main.centerOn(pos.x,pos.y);s.updateWorldRegion();s.progressionBalanceZoneIndex=s.currentWorldZoneIndex;s.applyRegionalHeroBalance(s.progressionBalanceZoneIndex,false);s.recalculateCurrentWaveRegionBalance();s.updateWorldStreaming();}
 jumpToZone(index){const s=this.scene,zone=WORLD_DESIGN.ZONES[index];if(!zone)return;this.deleteOrdinaryEnemies();this.deleteChampion();this.clearProjectiles();this.clearHazards();s.pendingWorldAdvance=null;s.awaitingWorldAdvance=false;s.worldAdvanceTargetZone=null;const x=Math.min(zone.end-300,zone.start+(index===0?400:360));this.teleport(x);s.startZoneWaveSequence(index,{suppressBanner:true});s.showWaveBanner(`DEV · ${zone.name}`,'Зона загружена · последовательность волн перезапущена','#bfe8ff');}
 jumpToWave(wave){const s=this.scene;const safeWave=Phaser.Math.Clamp(Math.round(wave)||1,1,5);this.deleteOrdinaryEnemies();this.deleteChampion();this.clearProjectiles();this.clearHazards();s.waveIntermission=false;s.nextWaveAt=Number.POSITIVE_INFINITY;s.startWave(safeWave,false,{suppressBanner:false});}

 toggleGroundOnly(){const on=!(this.groundOnly||false);this.groundOnly=on;if(on){this.envVisibility.props=false;this.envVisibility.landmarks=false;}else{this.envVisibility.props=true;this.envVisibility.trees=true;this.envVisibility.rocks=true;this.envVisibility.grass=true;this.envVisibility.landmarks=true;}this.applyAllEnvironmentVisibility();}
 toggleCollisionTest(){this.collisionTest=!this.collisionTest;const f=this.scene.devFlags;if(this.collisionTest){this.collisionTestPrevious={godMode:f.godMode,autoSpawnsDisabled:f.autoSpawnsDisabled,propColliders:this.overlayFlags.propColliders,hitboxes:this.overlayFlags.hitboxes,safeLane:this.overlayFlags.safeLane};f.godMode=true;f.autoSpawnsDisabled=true;this.deleteOrdinaryEnemies();this.deleteChampion();this.overlayFlags.propColliders=true;this.overlayFlags.hitboxes=true;this.overlayFlags.safeLane=true;}else if(this.collisionTestPrevious){f.godMode=this.collisionTestPrevious.godMode;f.autoSpawnsDisabled=this.collisionTestPrevious.autoSpawnsDisabled;this.overlayFlags.propColliders=this.collisionTestPrevious.propColliders;this.overlayFlags.hitboxes=this.collisionTestPrevious.hitboxes;this.overlayFlags.safeLane=this.collisionTestPrevious.safeLane;this.collisionTestPrevious=null;}this.refreshStateButtons();}
 toggleSegment(id){if(this.hiddenSegments.has(id))this.hiddenSegments.delete(id);else this.hiddenSegments.add(id);this.applyAllEnvironmentVisibility();}

 isObjectVisibleByFilters(object){
  const m=object.devEnvMeta||{};
  if(object.devDeleted)return false;
  if(this.hiddenSegments.has(m.segment))return false;
  if(m.landmark)return this.envVisibility.landmarks;
  if(!this.envVisibility.props)return false;
  if(m.kind==='tree'&&!this.envVisibility.trees)return false;
  if(m.kind==='rock'&&!this.envVisibility.rocks)return false;
  if(m.kind==='grass'&&!this.envVisibility.grass)return false;
  return true;
 }
 applyObjectVisibility(object){
  if(!object)return;
  const visible=this.isObjectVisibleByFilters(object);
  object.setVisible(visible);
  for(const shadow of object.devLinkedShadows||[])shadow.setVisible(visible&&this.envVisibility.shadows);
  for(const collider of object.devLinkedColliders||[]){if(collider.body)collider.body.enable=visible&&!this.scene.devFlags.noCollision;}
  this.scene.markNavigationDirty?.();
 }
 applyAllEnvironmentVisibility(){for(const o of this.scene.devEnvironmentObjects||[])this.applyObjectVisibility(o);}

 snapshot(object){return {id:object.devEnvMeta.id,x:object.x,y:object.y,scaleX:object.scaleX,scaleY:object.scaleY,rotation:object.rotation,alpha:object.alpha,flipX:Boolean(object.flipX),deleted:Boolean(object.devDeleted)};}
 findEnv(id){return (this.scene.devEnvironmentObjects||[]).find(o=>o?.devEnvMeta?.id===id);}
 applySnapshot(state){const o=this.findEnv(state.id);if(!o)return;o.setPosition(state.x,state.y);o.setScale(Math.abs(state.scaleX),Math.abs(state.scaleY));o.rotation=state.rotation;o.alpha=state.alpha;o.setFlipX(Boolean(state.flipX));o.devDeleted=Boolean(state.deleted);this.scene.updateDevEnvironmentLinks(o);this.applyObjectVisibility(o);if(this.selected===o)this.refreshSelectedPanel();}
 pushHistory(states){this.history.push(states);if(this.history.length>this.maxHistory)this.history.shift();this.redoStack=[];}
 mutateSelected(mutator){if(!this.selected)return;this.pushHistory([this.snapshot(this.selected)]);mutator(this.selected);this.scene.updateDevEnvironmentLinks(this.selected);this.applyObjectVisibility(this.selected);this.refreshSelectedPanel();}
 deleteSelected(){if(!this.selected)return;this.pushHistory([this.snapshot(this.selected)]);this.selected.devDeleted=true;this.applyObjectVisibility(this.selected);this.refreshSelectedPanel();}
 undo(){const states=this.history.pop();if(!states)return;const current=states.map(st=>{const o=this.findEnv(st.id);return o?this.snapshot(o):null}).filter(Boolean);this.redoStack.push(current);states.forEach(st=>this.applySnapshot(st));}
 redo(){const states=this.redoStack.pop();if(!states)return;const current=states.map(st=>{const o=this.findEnv(st.id);return o?this.snapshot(o):null}).filter(Boolean);this.history.push(current);states.forEach(st=>this.applySnapshot(st));}
 resetSelected(){if(!this.selected)return;this.pushHistory([this.snapshot(this.selected)]);this.restoreInitial(this.selected);}
 restoreInitial(o){const st=o?.devInitialState;if(!st)return;o.setPosition(st.x,st.y);o.setScale(Math.abs(st.scaleX),Math.abs(st.scaleY));o.rotation=st.rotation;o.alpha=st.alpha;o.setFlipX(st.flipX);o.devDeleted=false;this.scene.updateDevEnvironmentLinks(o);this.applyObjectVisibility(o);}
 resetSelectedSegment(){if(!this.selected)return;const seg=this.selected.devEnvMeta.segment;const list=(this.scene.devEnvironmentObjects||[]).filter(o=>o.devEnvMeta?.segment===seg);this.pushHistory(list.map(o=>this.snapshot(o)));list.forEach(o=>{if(o.devEnvMeta?.created){o.devDeleted=true;this.applyObjectVisibility(o);}else this.restoreInitial(o);});}
 resetAllEnvironment(){const list=(this.scene.devEnvironmentObjects||[]);this.pushHistory(list.map(o=>this.snapshot(o)));list.forEach(o=>{if(o.devEnvMeta?.created){o.devDeleted=true;this.applyObjectVisibility(o);}else this.restoreInitial(o);});}
 applyExactSelectedValues(){if(!this.selected)return;const x=Number(document.getElementById('lkdev-env-x')?.value),y=Number(document.getElementById('lkdev-env-y')?.value),scale=Number(document.getElementById('lkdev-env-scale')?.value),rotation=Number(document.getElementById('lkdev-env-rotation')?.value),alpha=Number(document.getElementById('lkdev-env-alpha')?.value);this.mutateSelected(o=>{if(Number.isFinite(x))o.x=x;if(Number.isFinite(y))o.y=y;if(Number.isFinite(scale)&&scale>0)o.setScale(scale);if(Number.isFinite(rotation))o.rotation=rotation;if(Number.isFinite(alpha))o.alpha=Phaser.Math.Clamp(alpha,0.05,1);});}

 serializeLayout(){
  const out={version:2,generatedAt:new Date().toISOString(),objects:{}};
  for(const o of this.scene.devEnvironmentObjects||[]){
   const st=this.snapshot(o),m=o.devEnvMeta||{};
   // A user-created object that was later deleted is equivalent to never adding it.
   if(m.created&&st.deleted)continue;
   out.objects[st.id]={x:Math.round(st.x*100)/100,y:Math.round(st.y*100)/100,scale:Math.round(Math.abs(st.scaleX)*1000)/1000,rotation:Math.round(st.rotation*10000)/10000,alpha:Math.round(st.alpha*1000)/1000,flipX:st.flipX,deleted:st.deleted,key:m.key,kind:m.kind,segment:m.segment,landmark:Boolean(m.landmark),created:Boolean(m.created)};
  }
  return out;
 }
 readSavedLayout(){try{return JSON.parse(localStorage.getItem('lastKnight.dev.ashLayout.v2')||'null');}catch{return null;}}
 saveLocal(){const data=this.serializeLayout();localStorage.setItem('lastKnight.dev.ashLayout.v2',JSON.stringify(data));this.savedLayout=data;this.output(JSON.stringify(data,null,2));}
 loadLocal(){this.savedLayout=this.readSavedLayout();this.restoreCreatedObjectsFromSaved();for(const o of this.scene.devEnvironmentObjects||[])this.applySavedOverrideToObject(o);this.selected=null;this.envDrag=null;this.applyAllEnvironmentVisibility();this.refreshSelectedPanel();}
 applySavedOverrideToObject(object){const state=this.savedLayout?.objects?.[object?.devEnvMeta?.id];if(!state)return;object.setPosition(state.x,state.y);object.setScale(Math.max(0.05,state.scale||Math.abs(object.scaleX)));object.rotation=state.rotation??object.rotation;object.alpha=state.alpha??object.alpha;object.setFlipX(Boolean(state.flipX));object.devDeleted=Boolean(state.deleted);this.scene.updateDevEnvironmentLinks(object);this.applyObjectVisibility(object);}
 async copyLayout(){const txt=JSON.stringify(this.serializeLayout(),null,2);this.output(txt);try{await navigator.clipboard.writeText(txt);}catch{}}
 output(txt){const el=document.getElementById('lkdev-output');if(el)el.value=txt;}

 inferPropKind(key){if(key.includes('landmark_'))return 'landmark';if(key.includes('tree_'))return 'tree';if(key.includes('rock_'))return 'rock';return 'grass';}
 propDefaultScale(key){const kind=this.inferPropKind(key);if(kind==='tree')return 0.36;if(kind==='rock')return 0.24;if(kind==='grass')return 0.24;return key.includes('sword')?0.58:0.50;}
 selectedPropKey(){return document.getElementById('lkdev-env-prop')?.value||'ash_tree_01';}
 segmentAtX(x){return ASH_FIELDS_SEGMENTS.find(seg=>x>=seg.start&&x<seg.end)?.id||'ash';}
 nextCreatedId(){this.createdPropCounter++;return `devCreated:${Date.now().toString(36)}:${this.createdPropCounter}`;}
 createEnvironmentPropAt(x,y,key=this.selectedPropKey(),options={}){
  const s=this.scene;if(!s.textures.exists(key))return null;
  x=Phaser.Math.Clamp(Number(x)||0,0,4000);y=Phaser.Math.Clamp(Number(y)||WORLD_DESIGN.ROUTE_Y,0,STAGE0.WORLD_HEIGHT);
  const kind=options.kind||this.inferPropKind(key),landmark=kind==='landmark';
  const objects=s.loadedWorldZones.get(0)||[];
  const prop=s.add.image(x,y,key).setDepth(landmark?-28:(kind==='grass'?-46:-44)).setScale(options.scale||this.propDefaultScale(key)).setAlpha(options.alpha??(kind==='grass'?0.40:0.96)).setRotation(options.rotation||0);
  if(options.flipX)prop.setFlipX(true);
  objects.push(prop);if(!s.loadedWorldZones.has(0))s.loadedWorldZones.set(0,objects);
  if(landmark){s.createAshLandmarkShadow(objects,prop,key);s.addAshLandmarkCollision(objects,prop,key);s.worldLandmarkObjects.push(prop);}
  else{s.createAshPropShadow(objects,prop,kind);s.addAshPropCollision(objects,prop,kind,key);}
  const id=options.id||this.nextCreatedId();
  s.registerDevEnvironmentObject(prop,{id,segment:options.segment||this.segmentAtX(x),cluster:null,kind,key,landmark,created:true});
  prop.devDeleted=Boolean(options.deleted);
  s.updateDevEnvironmentLinks(prop);this.applyObjectVisibility(prop);
  if(options.history!==false){const before=this.snapshot(prop);before.deleted=true;this.pushHistory([before]);}
  if(options.select!==false)this.selected=prop;
  this.refreshSelectedPanel();return prop;
 }
 restoreCreatedObjectsFromSaved(){
  const entries=Object.entries(this.savedLayout?.objects||{});
  for(const [id,state] of entries){
   if(!state?.created||this.findEnv(id))continue;
   this.createEnvironmentPropAt(state.x,state.y,state.key,{id,kind:state.kind,segment:state.segment,scale:state.scale,alpha:state.alpha,rotation:state.rotation,flipX:state.flipX,deleted:state.deleted,history:false,select:false});
  }
 }
 togglePropPlacement(){this.placingProp=!this.placingProp;if(this.placingProp)this.setEditMode(true);this.refreshStateButtons();this.refreshSelectedPanel();}
 addSelectedPropAtViewCenter(){const c=this.scene.cameras.main;if(!this.editMode)this.setEditMode(true);this.createEnvironmentPropAt(c.worldView.centerX,c.worldView.centerY,this.selectedPropKey());}
 duplicateSelected(){if(!this.selected)return;const o=this.selected,m=o.devEnvMeta||{};this.createEnvironmentPropAt(o.x+32,o.y+24,m.key,{kind:m.kind,segment:this.segmentAtX(o.x+32),scale:Math.abs(o.scaleX),alpha:o.alpha,rotation:o.rotation,flipX:o.flipX});}

 setEditMode(on){this.editMode=Boolean(on);if(this.editMode){this.uiEditor?.setEditMode(false);this.overlayFlags.propColliders=true;this.scene.setGameplayPaused('devEdit',true);}else{this.scene.setGameplayPaused('devEdit',false);this.placingProp=false;this.envDrag=null;this.selected=null;}this.refreshStateButtons();this.refreshSelectedPanel();}
 pointerWorld(pointer){const c=this.scene.cameras.main;try{return c.getWorldPoint(pointer.x,pointer.y);}catch{return {x:pointer.worldX,y:pointer.worldY};}}
 pointerButton(pointer){return Number(pointer?.event?.button??0);}
 findEnvironmentAt(x,y){const candidates=(this.scene.devEnvironmentObjects||[]).filter(o=>o?.active&&!o.devDeleted&&o.visible!==false&&o.getBounds?.().contains(x,y));if(!candidates.length)return null;candidates.sort((a,b)=>{const aa=a.displayWidth*a.displayHeight,bb=b.displayWidth*b.displayHeight;return aa-bb;});return candidates[0];}
 handleWorldPointer(pointer){
  if(!pointer)return;
  const button=this.pointerButton(pointer),world=this.pointerWorld(pointer);
  const panButton=button===1||button===2;
  if((this.freeCamera&&!this.editMode)||panButton){
   this.cameraPan={pointerId:pointer.id,startX:pointer.x,startY:pointer.y,startScrollX:this.scene.cameras.main.scrollX,startScrollY:this.scene.cameras.main.scrollY};
   return;
  }
  if(!this.editMode)return;
  if(this.placingProp&&button===0){this.createEnvironmentPropAt(world.x,world.y,this.selectedPropKey());this.placingProp=false;this.refreshStateButtons();return;}
  const picked=this.findEnvironmentAt(world.x,world.y);
  if(!picked){this.selected=null;this.envDrag=null;this.refreshSelectedPanel();return;}
  this.selected=picked;this.refreshSelectedPanel();
  if(button===0){this.pushHistory([this.snapshot(picked)]);this.envDrag={pointerId:pointer.id,object:picked,startWorldX:world.x,startWorldY:world.y,startX:picked.x,startY:picked.y};}
 }
 handleDevPointerMove(pointer){
  if(this.cameraPan&&pointer.id===this.cameraPan.pointerId){const c=this.scene.cameras.main,zoom=Math.max(0.05,c.zoom||1);c.scrollX=this.cameraPan.startScrollX-(pointer.x-this.cameraPan.startX)/zoom;c.scrollY=this.cameraPan.startScrollY-(pointer.y-this.cameraPan.startY)/zoom;return;}
  if(this.editMode&&this.envDrag&&pointer.id===this.envDrag.pointerId){const world=this.pointerWorld(pointer),o=this.envDrag.object;if(!o?.active)return;o.x=Phaser.Math.Clamp(this.envDrag.startX+(world.x-this.envDrag.startWorldX),0,4000);o.y=Phaser.Math.Clamp(this.envDrag.startY+(world.y-this.envDrag.startWorldY),0,STAGE0.WORLD_HEIGHT);o.devEnvMeta.segment=this.segmentAtX(o.x);this.scene.updateDevEnvironmentLinks(o);this.applyObjectVisibility(o);this.refreshSelectedPanel();}
 }
 handleDevPointerUp(pointer){if(this.cameraPan&&pointer.id===this.cameraPan.pointerId)this.cameraPan=null;if(this.envDrag&&pointer.id===this.envDrag.pointerId)this.envDrag=null;}
 handleCameraWheel(pointer,deltaY){if(!this.freeCamera&&!this.cameraLocked&&!this.editMode)return;const c=this.scene.cameras.main,before=this.pointerWorld(pointer),factor=deltaY>0?0.90:1.10;const next=Phaser.Math.Clamp((c.zoom||1)*factor,0.18,2.5);c.setZoom(next);const after=this.pointerWorld(pointer);c.scrollX+=before.x-after.x;c.scrollY+=before.y-after.y;this.updateInfo(true);}
 refreshSelectedPanel(){const el=document.getElementById('lkdev-selected');if(!el)return;if(!this.selected){el.textContent=this.placingProp?'РАЗМЕЩЕНИЕ · щёлкни по карте':(this.editMode?'РЕДАКТОР ВКЛ · выбери или перетащи объект':'Объект не выбран');return;}const o=this.selected,m=o.devEnvMeta;el.textContent=`${m.id}${m.created?' · НОВЫЙ':''}\n${m.key} · ${m.kind} · ${m.segment}\nX ${o.x.toFixed(0)}  Y ${o.y.toFixed(0)}  Масштаб ${Math.abs(o.scaleX).toFixed(2)}  Прозрачность ${o.alpha.toFixed(2)}${o.devDeleted?' · УДАЛЁН':''}`;const set=(id,v)=>{const i=document.getElementById(id);if(i)i.value=v};set('lkdev-env-x',Math.round(o.x));set('lkdev-env-y',Math.round(o.y));set('lkdev-env-scale',Math.abs(o.scaleX).toFixed(2));set('lkdev-env-rotation',o.rotation.toFixed(3));set('lkdev-env-alpha',o.alpha.toFixed(2));}


 followCamera(){const c=this.scene.cameras.main;this.freeCamera=false;this.cameraLocked=false;this.cameraPan=null;c.startFollow(this.scene.player,true,0.10,0.10);this.scene.setupResponsiveWorldCamera?.();}
 lockCamera(){const c=this.scene.cameras.main;this.freeCamera=false;this.cameraLocked=true;this.cameraPan=null;c.stopFollow();}
 toggleFreeCamera(){this.freeCamera=!this.freeCamera;this.cameraLocked=false;this.cameraPan=null;const c=this.scene.cameras.main;if(this.freeCamera)c.stopFollow();else this.followCamera();}
 createAdaptiveQualityState(){
  const now=performance.now();
  const mode=lkReadQualityMode();
  return {
   mode,
   phase:mode==='auto'?'warmup':'manual',
   startedAt:now,
   suspendedUntil:now+LK_QUALITY_POST_CHANGE_SETTLE_MS,
   probeValidMs:0,
   probeSamples:[],
   monitorSamples:[],
   pendingScale:null,
   pendingReason:null,
   recommendedUpgrade:null,
   lastResult:null,
   lastDecisionAt:0,
   lastScaleChangeAt:0,
   lastUiAt:0,
   lastViewportKey:'',
   cpuBoundLikely:false,
   cpuBoundBlockUntil:0,
   bottleneckClass:'unknown',
   scaleResponse:lkReadQualityResponseMap(),
   pendingTrial:null,
   activeTrial:null,
   history:[]
  };
 }

 qualityPercentile(values,p){
  if(!values?.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  const pos=(sorted.length-1)*Phaser.Math.Clamp(p,0,1);
  const lo=Math.floor(pos),hi=Math.ceil(pos);
  return lo===hi?sorted[lo]:sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);
 }

 buildAdaptiveQualityMetrics(samples){
  if(!samples?.length)return null;
  const gaps=samples.map(sample=>sample.gap).filter(value=>Number.isFinite(value)&&value>0);
  if(!gaps.length)return null;
  const fps=gaps.map(gap=>1000/gap);
  const slow33=gaps.filter(gap=>gap>=33.34).length;
  const slow50=gaps.filter(gap=>gap>=50).length;
  return {
   samples:gaps.length,
   medianFps:Math.round(this.qualityPercentile(fps,0.5)*10)/10,
   p05Fps:Math.round(this.qualityPercentile(fps,0.05)*10)/10,
   medianGapMs:Math.round(this.qualityPercentile(gaps,0.5)*100)/100,
   p95GapMs:Math.round(this.qualityPercentile(gaps,0.95)*100)/100,
   slow33Ratio:Math.round((slow33/gaps.length)*1000)/1000,
   slow50Ratio:Math.round((slow50/gaps.length)*1000)/1000
  };
 }

 logAdaptiveQualityEvent(type,data={}){
  const q=this.adaptiveQuality;if(!q)return;
  const event={at:new Date().toISOString(),type,data};
  q.history.push(event);
  if(q.history.length>240)q.history.splice(0,q.history.length-240);
  this.recordTraceEvent(type,data,{sample:true});
 }

 resetAdaptiveQualitySampling({restartProbe=false,settleMs=LK_QUALITY_POST_CHANGE_SETTLE_MS}={}){
  const q=this.adaptiveQuality;if(!q)return;
  const now=performance.now();
  q.probeSamples=[];q.probeValidMs=0;q.monitorSamples=[];
  q.suspendedUntil=now+Math.max(0,settleMs||0);
  if(restartProbe&&q.mode==='auto')q.phase='warmup';
 }

 setAdaptiveQualityMode(mode,{restartProbe=false}={}){
  const q=this.adaptiveQuality;if(!q)return false;
  const next=mode==='manual'?'manual':'auto';
  const before=q.mode;
  q.mode=next;q.pendingScale=null;q.pendingReason=null;q.recommendedUpgrade=null;
  q.cpuBoundLikely=false;q.cpuBoundBlockUntil=0;q.pendingTrial=null;q.activeTrial=null;
  if(next==='auto'){
   q.phase='warmup';
   q.startedAt=performance.now();
   this.resetAdaptiveQualitySampling({restartProbe:true,settleMs:LK_QUALITY_POST_CHANGE_SETTLE_MS});
  }else{
   q.phase='manual';q.probeSamples=[];q.monitorSamples=[];
  }
  try{localStorage.setItem(LK_QUALITY_MODE_STORAGE_KEY,next);}catch{}
  this.logAdaptiveQualityEvent('quality_mode_changed',{before,after:next,renderScale:LK_RENDER_SCALE,restartProbe:Boolean(restartProbe)});
  this.refreshStateButtons();this.refreshAdaptiveQualityUi(true);
  return true;
 }

 getAdaptiveQualitySnapshot(){
  const q=this.adaptiveQuality;
  if(!q)return null;
  return {
   mode:q.mode,phase:q.phase,profile:lkProfileName(LK_RENDER_SCALE),renderScale:Math.round(LK_RENDER_SCALE*100)/100,
   pendingScale:q.pendingScale,recommendedUpgrade:q.recommendedUpgrade,
   probeValidMs:Math.round(q.probeValidMs||0),monitorSamples:q.monitorSamples?.length||0,
   cpuBoundLikely:Boolean(q.cpuBoundLikely),bottleneckClass:q.bottleneckClass||'unknown',
   activeTrial:q.activeTrial?{from:q.activeTrial.from,to:q.activeTrial.to,validMs:Math.round(q.activeTrial.validMs||0)}:null,
   lastResult:q.lastResult||null
  };
 }

 isAdaptiveQualityFrameValid(now,wallGap){
  const q=this.adaptiveQuality,s=this.scene,cam=s.cameras?.main;
  if(!q || q.mode!=='auto' || this.renderBenchmark?.active)return false;
  if(now<q.suspendedUntil)return false;
  if(typeof document!=='undefined' && (document.hidden || document.visibilityState!=='visible' || !document.hasFocus?.()))return false;
  if(!Number.isFinite(wallGap) || wallGap<8 || wallGap>250)return false;
  if(s.gameOver || s.gameplayPaused || s.levelChoiceOpen || s.championRewardOpen)return false;
  if(s.storyFocusLockOwner || s.storyDirector?.isBusy?.() || s.storyAnomalyCueState || s.ashChampionIntroState || s.woundedKnightInteractions?.active)return false;
  if(cam?.panEffect?.isRunning || cam?.zoomEffect?.isRunning || cam?.fadeEffect?.isRunning)return false;
  return true;
 }

 isAdaptiveQualitySafeMoment(){
  const s=this.scene,cam=s.cameras?.main;
  if(!s || s.gameOver || this.renderBenchmark?.active)return false;
  if(s.storyFocusLockOwner || s.storyDirector?.isBusy?.() || s.storyAnomalyCueState || s.ashChampionIntroState || s.woundedKnightInteractions?.active)return false;
  if(cam?.panEffect?.isRunning || cam?.zoomEffect?.isRunning || cam?.fadeEffect?.isRunning)return false;
  if(s.activeChampion?.active)return false;
  if((s.meleeAttack?.combatActive)||((s.playerAttackUntil||0)>(s.time?.now||0)))return false;
  const ordinary=(s.enemies||[]).some(enemy=>enemy?.active&&enemy.hp>0&&enemy.type!=='champion'&&!enemy.storyDormant);
  return !ordinary && (Boolean(s.waveIntermission) || Number(s.wave||0)<=1 || Boolean(s.levelChoiceOpen));
 }

 qualityResponseKey(from,to){return `${Number(from).toFixed(2)}>${Number(to).toFixed(2)}`;}

 getAdaptiveScaleResponse(from,to){
  const q=this.adaptiveQuality;if(!q)return null;
  return q.scaleResponse?.[this.qualityResponseKey(from,to)]||null;
 }

 rememberAdaptiveScaleResponse(from,to,baseline,result,source='runtime_trial'){
  const q=this.adaptiveQuality;if(!q||!baseline||!result)return null;
  const baseFps=Math.max(1,Number(baseline.medianFps)||1);
  const baseP95=Math.max(1,Number(baseline.p95GapMs)||1);
  const fpsGainPct=((Number(result.medianFps)||0)-baseFps)/baseFps*100;
  const p95GainPct=(baseP95-(Number(result.p95GapMs)||baseP95))/baseP95*100;
  const helpful=fpsGainPct>=LK_QUALITY_MIN_FPS_GAIN_PCT || p95GainPct>=LK_QUALITY_MIN_P95_GAIN_PCT;
  const evidence={
   from:Number(from),to:Number(to),helpful,source,at:Date.now(),
   fpsGainPct:Math.round(fpsGainPct*10)/10,p95GainPct:Math.round(p95GainPct*10)/10,
   baseline:{medianFps:baseline.medianFps,p95GapMs:baseline.p95GapMs},
   result:{medianFps:result.medianFps,p95GapMs:result.p95GapMs}
  };
  q.scaleResponse[this.qualityResponseKey(from,to)]=evidence;
  lkWriteQualityResponseMap(q.scaleResponse);
  this.refreshAdaptiveBottleneckClass();
  this.logAdaptiveQualityEvent('quality_scale_response_learned',evidence);
  return evidence;
 }

 refreshAdaptiveBottleneckClass(){
  const q=this.adaptiveQuality;if(!q)return 'unknown';
  const evidence=Object.values(q.scaleResponse||{}).filter(item=>item&&Number.isFinite(item.from)&&Number.isFinite(item.to));
  if(!evidence.length){q.bottleneckClass=q.cpuBoundLikely?'cpu_limited':'unknown';return q.bottleneckClass;}
  const helpful=evidence.filter(item=>item.helpful).length;
  q.bottleneckClass=helpful===0?'cpu_limited':(helpful>=2?'gpu_limited':'mixed');
  return q.bottleneckClass;
 }

 learnAdaptiveQualityFromBenchmark(results){
  const q=this.adaptiveQuality;if(!q||!Array.isArray(results)||results.length<2)return;
  const sorted=[...results].filter(r=>Number.isFinite(r?.scale)).sort((a,b)=>a.scale-b.scale);
  for(let i=1;i<sorted.length;i++){
   const lower=sorted[i-1],higher=sorted[i];
   if(!Number.isFinite(lower.medianFps)||!Number.isFinite(higher.medianFps)||!Number.isFinite(lower.p95FrameGapMs)||!Number.isFinite(higher.p95FrameGapMs))continue;
   this.rememberAdaptiveScaleResponse(
    higher.scale,lower.scale,
    {medianFps:higher.medianFps,p95GapMs:higher.p95FrameGapMs},
    {medianFps:lower.medianFps,p95GapMs:lower.p95FrameGapMs},
    'four_scale_benchmark'
   );
  }
  const bottleneck=this.refreshAdaptiveBottleneckClass();
  this.logAdaptiveQualityEvent('quality_benchmark_classified',{bottleneck,responseMap:q.scaleResponse});
 }

 requestAdaptiveDowngrade(target,reason,metrics){
  const q=this.adaptiveQuality;if(!q)return false;
  const evidence=this.getAdaptiveScaleResponse(LK_RENDER_SCALE,target);
  if(evidence && !evidence.helpful){
   q.cpuBoundLikely=true;q.cpuBoundBlockUntil=performance.now()+120000;
   this.refreshAdaptiveBottleneckClass();
   this.logAdaptiveQualityEvent('quality_downgrade_rejected',{
    from:LK_RENDER_SCALE,to:target,reason:'resolution_not_bottleneck',trigger:reason,evidence,metrics
   });
   return false;
  }
  if(!evidence){
   q.pendingTrial={from:LK_RENDER_SCALE,to:target,baseline:metrics,trigger:reason};
  }
  return this.queueAdaptiveQualityScale(target,evidence?reason:`${reason}_trial`,metrics);
 }

 evaluateAdaptiveQualityTrial(now){
  const q=this.adaptiveQuality,trial=q?.activeTrial;if(!q||!trial)return false;
  if((trial.validMs||0)<LK_QUALITY_TRIAL_ACTIVE_MS)return false;
  const result=this.buildAdaptiveQualityMetrics(trial.samples||[]);
  if(!result)return false;
  const evidence=this.rememberAdaptiveScaleResponse(trial.from,trial.to,trial.baseline,result,'runtime_trial');
  q.activeTrial=null;
  if(evidence?.helpful){
   this.logAdaptiveQualityEvent('quality_trial_accepted',{from:trial.from,to:trial.to,evidence});
   return true;
  }
  q.cpuBoundLikely=true;q.cpuBoundBlockUntil=now+120000;
  this.logAdaptiveQualityEvent('quality_trial_rejected',{from:trial.from,to:trial.to,evidence,action:'rollback_when_safe'});
  this.queueAdaptiveQualityScale(trial.from,'resolution_not_bottleneck_rollback',result);
  return true;
 }

 chooseAdaptiveInitialScale(metrics){
  const index=Math.max(0,LK_QUALITY_SCALES.findIndex(scale=>Math.abs(scale-LK_RENDER_SCALE)<0.01));
  const pressure=metrics && (metrics.medianFps<42 || metrics.p95GapMs>38 || metrics.slow50Ratio>0.08);
  const headroom=metrics && metrics.medianFps>=56 && metrics.p95GapMs<=22 && metrics.slow33Ratio<0.03;
  if(pressure&&index>0){
   const lower=LK_QUALITY_SCALES[index-1];
   const evidence=this.getAdaptiveScaleResponse(LK_RENDER_SCALE,lower);
   if(evidence && !evidence.helpful)return LK_RENDER_SCALE;
   return lower;
  }
  if(headroom&&index<LK_QUALITY_SCALES.length-1)return LK_QUALITY_SCALES[index+1];
  return LK_QUALITY_SCALES[Math.max(0,index)];
 }

 queueAdaptiveQualityScale(scale,reason,metrics=null){
  const q=this.adaptiveQuality;
  const target=LK_QUALITY_SCALES.find(value=>Math.abs(value-Number(scale))<0.01);
  if(!q || q.mode!=='auto' || !target || Math.abs(target-LK_RENDER_SCALE)<0.01)return false;
  q.pendingScale=target;q.pendingReason=reason||'adaptive';q.lastResult=metrics||q.lastResult;
  this.logAdaptiveQualityEvent('quality_change_pending',{from:LK_RENDER_SCALE,to:target,reason:q.pendingReason,metrics});
  return true;
 }

 applyPendingAdaptiveQuality(now=performance.now()){
  const q=this.adaptiveQuality;if(!q || q.mode!=='auto' || q.pendingScale===null)return false;
  if(!this.isAdaptiveQualitySafeMoment())return false;
  const before=LK_RENDER_SCALE,target=q.pendingScale,reason=q.pendingReason;
  const trial=q.pendingTrial && Math.abs(q.pendingTrial.to-target)<0.01 ? q.pendingTrial : null;
  const applied=lkApplyRenderScale(this.scene.game,target,{remember:false});
  try{localStorage.setItem(LK_QUALITY_PROFILE_STORAGE_KEY,String(applied));}catch{}
  q.pendingScale=null;q.pendingReason=null;q.pendingTrial=null;q.phase='monitoring';q.lastScaleChangeAt=now;q.lastDecisionAt=now;q.recommendedUpgrade=null;
  q.activeTrial=trial?{...trial,startedAt:now,validMs:0,samples:[]}:null;
  q.suspendedUntil=now+LK_QUALITY_POST_CHANGE_SETTLE_MS;q.probeSamples=[];q.probeValidMs=0;q.monitorSamples=[];
  this.logAdaptiveQualityEvent('quality_changed',{from:before,to:applied,profile:lkProfileName(applied),reason});
  this.refreshStateButtons();this.updateRenderInfo(true);this.refreshAdaptiveQualityUi(true);
  return true;
 }

 finishAdaptiveQualityProbe(now){
  const q=this.adaptiveQuality;if(!q || !q.probeSamples.length)return;
  const metrics=this.buildAdaptiveQualityMetrics(q.probeSamples);
  const selected=this.chooseAdaptiveInitialScale(metrics);
  q.lastResult=metrics;q.phase='monitoring';q.lastDecisionAt=now;q.probeSamples=[];q.probeValidMs=0;
  this.logAdaptiveQualityEvent('quality_probe_result',{currentScale:LK_RENDER_SCALE,selectedScale:selected,profile:lkProfileName(selected),metrics});
  if(Math.abs(selected-LK_RENDER_SCALE)>=0.01){
   if(selected<LK_RENDER_SCALE)this.requestAdaptiveDowngrade(selected,'initial_probe',metrics);
   else this.queueAdaptiveQualityScale(selected,'initial_probe',metrics);
  }else{
   try{localStorage.setItem(LK_QUALITY_PROFILE_STORAGE_KEY,String(LK_RENDER_SCALE));}catch{}
  }
 }

 evaluateAdaptiveQualityPressure(now){
  const q=this.adaptiveQuality;if(!q || q.mode!=='auto' || q.pendingScale!==null)return;
  const cutoff=now-LK_QUALITY_MONITOR_WINDOW_MS;
  q.monitorSamples=q.monitorSamples.filter(sample=>sample.at>=cutoff);
  if(q.monitorSamples.length<120 || now-q.lastDecisionAt<LK_QUALITY_DOWNGRADE_COOLDOWN_MS)return;
  const metrics=this.buildAdaptiveQualityMetrics(q.monitorSamples);
  if(!metrics)return;
  q.lastResult=metrics;q.lastDecisionAt=now;

  if(q.cpuBoundLikely && now>=q.cpuBoundBlockUntil){q.cpuBoundLikely=false;this.refreshAdaptiveBottleneckClass();}

  const index=LK_QUALITY_SCALES.findIndex(scale=>Math.abs(scale-LK_RENDER_SCALE)<0.01);
  const pressure=metrics.medianFps<38 || metrics.p95GapMs>45 || metrics.slow50Ratio>0.12;
  if(pressure && index>0 && !(q.cpuBoundLikely&&now<q.cpuBoundBlockUntil)){
   this.requestAdaptiveDowngrade(LK_QUALITY_SCALES[index-1],'sustained_frame_pressure',metrics);
   return;
  }
  if(index<LK_QUALITY_SCALES.length-1 && now-Math.max(q.lastScaleChangeAt,q.startedAt)>=LK_QUALITY_UPGRADE_RECOMMEND_MS){
   const headroom=metrics.medianFps>=57 && metrics.p95GapMs<=22 && metrics.slow33Ratio<0.03;
   if(headroom && q.recommendedUpgrade===null){
    q.recommendedUpgrade=LK_QUALITY_SCALES[index+1];
    this.logAdaptiveQualityEvent('quality_upgrade_available',{from:LK_RENDER_SCALE,to:q.recommendedUpgrade,metrics});
   }
  }
 }

 updateAdaptiveQuality(now=performance.now(),wallGap=0){
  const q=this.adaptiveQuality;if(!q || q.mode!=='auto')return;
  const css=lkCssViewport();
  const viewportKey=`${css.width}x${css.height}@${Number(window.devicePixelRatio||1).toFixed(2)}`;
  if(q.lastViewportKey && q.lastViewportKey!==viewportKey){
   q.lastViewportKey=viewportKey;
   this.resetAdaptiveQualitySampling({restartProbe:q.phase!=='monitoring',settleMs:3000});
   this.logAdaptiveQualityEvent('quality_sampling_reset',{reason:'viewport_changed',viewportKey});
   return;
  }
  q.lastViewportKey=viewportKey;
  if(wallGap>500){
   this.resetAdaptiveQualitySampling({restartProbe:q.phase!=='monitoring',settleMs:3000});
   this.logAdaptiveQualityEvent('quality_sampling_reset',{reason:'large_frame_gap',wallGap:Math.round(wallGap)});
   return;
  }
  this.applyPendingAdaptiveQuality(now);
  if(!this.isAdaptiveQualityFrameValid(now,wallGap)){this.refreshAdaptiveQualityUi(false);return;}
  const sample={at:now,gap:Math.max(8,wallGap)};
  if(q.phase==='warmup'){
   q.phase='probing';q.probeSamples=[];q.probeValidMs=0;
   this.logAdaptiveQualityEvent('quality_probe_started',{renderScale:LK_RENDER_SCALE,profile:lkProfileName(LK_RENDER_SCALE),targetActiveMs:LK_QUALITY_PROBE_ACTIVE_MS});
  }
  if(q.phase==='probing'){
   q.probeSamples.push(sample);q.probeValidMs+=Math.min(sample.gap,100);
   if(q.probeValidMs>=LK_QUALITY_PROBE_ACTIVE_MS)this.finishAdaptiveQualityProbe(now);
  }else if(q.phase==='monitoring'){
   q.monitorSamples.push(sample);
   if(q.monitorSamples.length>1800)q.monitorSamples.splice(0,q.monitorSamples.length-1800);
   if(q.activeTrial){
    q.activeTrial.samples.push(sample);
    q.activeTrial.validMs+=Math.min(sample.gap,100);
    this.evaluateAdaptiveQualityTrial(now);
   }
   if(!q.activeTrial)this.evaluateAdaptiveQualityPressure(now);
  }
  this.applyPendingAdaptiveQuality(now);
  this.refreshAdaptiveQualityUi(false);
 }

 refreshAdaptiveQualityUi(force=false){
  const el=typeof document!=='undefined'?document.getElementById('lkdev-quality-info'):null;
  const q=this.adaptiveQuality;if(!el||!q)return;
  const now=performance.now();if(!force&&now-q.lastUiAt<400)return;q.lastUiAt=now;
  const profile=lkProfileName(LK_RENDER_SCALE);
  const modeName=q.mode==='auto'?'АВТО':'РУЧНОЙ';
  const phaseNames={idle:'ожидание',probing:'анализ',stable:'стабильно',trial:'проверка',cooldown:'пауза'};
  const phaseName=phaseNames[q.phase]||q.phase;
  const pending=q.pendingScale!==null?` · ожидает ${lkProfileName(q.pendingScale)} ${q.pendingScale.toFixed(2)}×`:'';
  const upgrade=q.recommendedUpgrade!==null?`
Есть запас: доступно ${lkProfileName(q.recommendedUpgrade)} ${q.recommendedUpgrade.toFixed(2)}×`:'';
  const metrics=q.lastResult?`
медиана ${q.lastResult.medianFps} FPS · p95 ${q.lastResult.p95GapMs} мс`:'';
  const bottleneck=q.bottleneckClass&&q.bottleneckClass!=='unknown'?` · узкое место: ${q.bottleneckClass.replace('_',' ')}`:'';
  const cpu=q.cpuBoundLikely?' · защита от лишнего снижения':'';
  const trial=q.activeTrial?` · проверка ${q.activeTrial.from.toFixed(2)}→${q.activeTrial.to.toFixed(2)}`:'';
  const progress=q.phase==='probing'?` ${(Math.min(1,q.probeValidMs/LK_QUALITY_PROBE_ACTIVE_MS)*100).toFixed(0)}%`:'';
  el.textContent=`${modeName} · ${phaseName}${progress} · ${profile} ${LK_RENDER_SCALE.toFixed(2)}×${bottleneck}${cpu}${trial}${pending}${metrics}${upgrade}`;
 }

 setRenderScale(value){
  const before=LK_RENDER_SCALE;
  this.setAdaptiveQualityMode('manual');
  const applied=lkApplyRenderScale(this.scene.game,value);
  this.logAdaptiveQualityEvent('quality_manual_scale',{requested:String(value),before,after:applied,profile:lkProfileName(applied)});
  this.recordTraceEvent('render_scale_changed',{requested:String(value),before,after:applied},{sample:true});
  this.refreshStateButtons();this.updateRenderInfo(true);this.updateInfo(true);
  return applied;
 }

 startRenderBenchmark(){
  if(this.renderBenchmark?.active)return false;
  if(!this.isPerformanceTraceActive())this.startPerformanceTrace();
  const now=performance.now();
  this.renderBenchmarkResults=[];
  this.renderBenchmark={
   active:true,
   scales:[1,1.25,1.5,1.75],
   index:0,
   originalScale:LK_RENDER_SCALE,
   stageStartedAt:now,
   settleUntil:now+1500,
   measureUntil:now+11500,
   fpsSum:0,fpsCount:0,fpsMin:Infinity,fpsMax:0,fpsSamples:[],
   frameGapSum:0,frameGapCount:0,frameGapMax:0,frameGapSamples:[],slow33:0,slow50:0,slow100:0
  };
  lkApplyRenderScale(this.scene.game,1,{remember:false});
  this.recordTraceEvent('render_benchmark_started',{scales:this.renderBenchmark.scales,secondsPerScale:10,settleSeconds:1.5,originalScale:this.renderBenchmark.originalScale},{sample:true});
  this.recordTraceEvent('render_benchmark_stage',{scale:1,index:0},{sample:true});
  this.refreshRenderBenchmarkUi();
  return true;
 }

 resetRenderBenchmarkStage(now){
  const b=this.renderBenchmark;if(!b)return;
  b.stageStartedAt=now;b.settleUntil=now+1500;b.measureUntil=now+11500;
  b.fpsSum=0;b.fpsCount=0;b.fpsMin=Infinity;b.fpsMax=0;b.fpsSamples=[];
  b.frameGapSum=0;b.frameGapCount=0;b.frameGapMax=0;b.frameGapSamples=[];b.slow33=0;b.slow50=0;b.slow100=0;
 }

 finishRenderBenchmarkStage(now){
  const b=this.renderBenchmark;if(!b?.active)return;
  const scale=b.scales[b.index];
  const percentile=(values,p)=>{
   if(!values?.length)return null;
   const sorted=[...values].sort((a,b)=>a-b);
   const pos=(sorted.length-1)*Phaser.Math.Clamp(p,0,1);
   const lo=Math.floor(pos),hi=Math.ceil(pos);
   const value=lo===hi?sorted[lo]:sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);
   return Math.round(value*100)/100;
  };
  const result={
   scale,
   avgFps:b.fpsCount?Math.round((b.fpsSum/b.fpsCount)*10)/10:null,
   medianFps:percentile(b.fpsSamples,0.5),
   p05Fps:percentile(b.fpsSamples,0.05),
   minFps:Number.isFinite(b.fpsMin)?Math.round(b.fpsMin*10)/10:null,
   maxFps:b.fpsCount?Math.round(b.fpsMax*10)/10:null,
   avgFrameGapMs:b.frameGapCount?Math.round((b.frameGapSum/b.frameGapCount)*100)/100:null,
   medianFrameGapMs:percentile(b.frameGapSamples,0.5),
   p95FrameGapMs:percentile(b.frameGapSamples,0.95),
   p99FrameGapMs:percentile(b.frameGapSamples,0.99),
   maxFrameGapMs:Math.round(b.frameGapMax*100)/100,
   slow33:b.slow33,slow50:b.slow50,slow100:b.slow100,
   sampleCount:b.fpsCount,
   render:this.getTraceRenderState()
  };
  this.renderBenchmarkResults.push(result);
  if(this.performanceTrace){
   if(!Array.isArray(this.performanceTrace.benchmarks))this.performanceTrace.benchmarks=[];
   this.performanceTrace.benchmarks.push(result);
  }
  this.recordTraceEvent('render_benchmark_result',result,{sample:true});
  b.index++;
  if(b.index>=b.scales.length){
   b.active=false;
   this.learnAdaptiveQualityFromBenchmark(this.renderBenchmarkResults);
   lkApplyRenderScale(this.scene.game,b.originalScale,{remember:false});
   this.recordTraceEvent('render_benchmark_finished',{results:this.renderBenchmarkResults,restoredScale:b.originalScale},{sample:true});
   this.refreshStateButtons();this.updateRenderInfo(true);this.refreshRenderBenchmarkUi();
   return;
  }
  const nextScale=b.scales[b.index];
  lkApplyRenderScale(this.scene.game,nextScale,{remember:false});
  this.resetRenderBenchmarkStage(now);
  this.recordTraceEvent('render_benchmark_stage',{scale:nextScale,index:b.index},{sample:true});
  this.refreshStateButtons();this.updateRenderInfo(true);this.refreshRenderBenchmarkUi();
 }

 updateRenderBenchmark(now=performance.now(),wallGap=0){
  const b=this.renderBenchmark;if(!b?.active)return;
  if(now>=b.measureUntil){this.finishRenderBenchmarkStage(now);return;}
  if(now<b.settleUntil)return;
  const fps=Math.max(0,Number(this.scene?.game?.loop?.actualFps)||0);
  if(fps>0){b.fpsSum+=fps;b.fpsCount++;b.fpsMin=Math.min(b.fpsMin,fps);b.fpsMax=Math.max(b.fpsMax,fps);b.fpsSamples.push(fps);}
  const gap=Math.max(0,Number(wallGap)||0);
  if(gap>0){b.frameGapSum+=gap;b.frameGapCount++;b.frameGapMax=Math.max(b.frameGapMax,gap);b.frameGapSamples.push(gap);if(gap>=33.34)b.slow33++;if(gap>=50)b.slow50++;if(gap>=100)b.slow100++;}
 }

 refreshRenderBenchmarkUi(){
  const el=document.getElementById('lkdev-render-benchmark');if(!el)return;
  const b=this.renderBenchmark;
  const lines=this.renderBenchmarkResults.map(r=>`${r.scale.toFixed(2)}×: ${r.avgFps??'-'} FPS · медиана ${r.medianFps??'-'} · p95 ${r.p95FrameGapMs??'-'} мс · максимум ${r.maxFrameGapMs??'-'} мс`);
  if(b?.active){
   const scale=b.scales[b.index];
   const now=performance.now();
   const phase=now<b.settleUntil?'стабилизация':'измерение';
   const left=Math.max(0,(b.measureUntil-now)/1000).toFixed(1);
   el.textContent=`ИДЁТ ТЕСТ ${scale.toFixed(2)}× · ${phase} · осталось ${left} с
${lines.join('\n')}`;
  }else el.textContent=lines.length?`ГОТОВО
${lines.join('\n')}`:'Тест не запущен · 10 секунд на масштаб';
 }
 updateRenderInfo(force=false){
  const el=document.getElementById('lkdev-render-info');if(!el)return;
  const game=this.scene.game,canvas=game.canvas,css=lkCssViewport(),rect=canvas?.getBoundingClientRect?.();
  const cw=canvas?.width||0,ch=canvas?.height||0,rw=rect?.width||canvas?.clientWidth||0,rh=rect?.height||canvas?.clientHeight||0;
  const bx=rw?cw/rw:0,by=rh?ch/rh:0;
  const renderer=game.renderer?.type===Phaser.WEBGL?'WEBGL':(game.renderer?.type===Phaser.CANVAS?'CANVAS':String(game.renderer?.type||'?'));
  const hud=this.scene.scene?.get?.('HUDScene');
  const textRes=hud?.hpText?.resolution||'-';
  el.textContent=`DPR устройства ${Number(window.devicePixelRatio||1).toFixed(2)}   Активный масштаб ${LK_RENDER_SCALE.toFixed(2)}×
Область CSS ${css.width}×${css.height}
Буфер Canvas ${cw}×${ch}
Canvas в CSS ${Math.round(rw)}×${Math.round(rh)}
Буфер/CSS ${bx.toFixed(2)}× / ${by.toFixed(2)}×
Рендерер ${renderer}   Разрешение текста HUD ${textRes}`;
 }
 setCameraZoom(value){const c=this.scene.cameras.main;c.setZoom(Phaser.Math.Clamp(Number(value)||1,0.18,2.5));}
 fitAshFields(){const c=this.scene.cameras.main;c.stopFollow();this.freeCamera=true;this.cameraLocked=false;const z=Math.min(c.width/4000,c.height/STAGE0.WORLD_HEIGHT)*0.94;c.setZoom(Phaser.Math.Clamp(z,0.18,1));c.centerOn(2000,STAGE0.WORLD_HEIGHT/2);this.refreshStateButtons();this.updateInfo(true);}

 runScenario(name){const s=this.scene;s.devFlags.autoSpawnsDisabled=true;this.deleteOrdinaryEnemies();this.deleteChampion();this.clearProjectiles();this.clearHazards();switch(name){case'empty':break;case'skeleton10':this.spawnEnemies('skeleton',10);break;case'mage5':this.spawnEnemies('mage',5);break;case'mixed':this.spawnMixed(14);break;case'champion':this.spawnSelectedChampion();break;case'heavy':this.spawnMixed(26);break;case'critical':this.setPlayerHp(18);break;case'lowHorde':this.setPlayerHp(18);this.spawnMixed(18);break;}this.refreshStateButtons();}
 runStress(count){this.scene.devFlags.autoSpawnsDisabled=true;this.deleteOrdinaryEnemies();this.clearProjectiles();this.spawnMixed(count);}

 setGameUiHidden(hidden){this.hideGameUi=Boolean(hidden);const hud=this.scene.scene.get('HUDScene');if(this.scene.scene?.setVisible)this.scene.scene.setVisible(!hidden,'HUDScene');else if(hud?.sys?.setVisible)hud.sys.setVisible(!hidden);this.scene.hud?.setVisible(!hidden);this.scene.waveText?.setVisible(!hidden);this.scene.waveSubText?.setVisible(!hidden);this.scene.regionText?.setVisible(!hidden);}
 captureScreenshot(){const previous=this.hideGameUi,wasOpen=this.open,wasDevPaused=this.scene.gameplayPauseReasons?.has('devPanel'),overlayVisible=this.graphics?.visible!==false;this.scene.setGameplayPaused('devPanel',true);this.setGameUiHidden(true);if(this.graphics)this.graphics.setVisible(false);this.togglePanel(false);if(this.button)this.button.style.display='none';const restore=()=>{this.setGameUiHidden(previous);if(this.graphics)this.graphics.setVisible(overlayVisible);if(!wasDevPaused)this.scene.setGameplayPaused('devPanel',false);if(wasOpen)this.togglePanel(true);else if(this.button)this.button.style.display='';};setTimeout(()=>{try{this.scene.game.renderer.snapshot(image=>{const link=document.createElement('a');link.download=`last-knight-x${Math.round(this.scene.player.x)}-${Date.now()}.png`;link.href=image.src;link.click();restore();});}catch{restore();}},80);}

 createTraceFrameBucket(){
  return {frames:0,deltaSum:0,deltaMax:0,wallGapMax:0,rawDeltaMax:0,slow33:0,slow50:0,slow100:0};
 }

 createTraceSubsystemBucket(){
  return Object.create(null);
 }

 recordSubsystemTime(name,ms){
  if(!this.isPerformanceTraceActive())return;
  const value=Math.max(0,Number(ms)||0);
  const key=String(name||'other');
  const slot=this.traceSubsystemBucket[key]||(this.traceSubsystemBucket[key]={calls:0,totalMs:0,maxMs:0});
  slot.calls++;slot.totalMs+=value;slot.maxMs=Math.max(slot.maxMs,value);
 }

 consumeTraceSubsystemBucket(){
  const out={};
  for(const [name,slot] of Object.entries(this.traceSubsystemBucket||{})){
   out[name]={
    calls:slot.calls,
    totalMs:Math.round(slot.totalMs*1000)/1000,
    avgMs:slot.calls?Math.round((slot.totalMs/slot.calls)*1000)/1000:0,
    maxMs:Math.round(slot.maxMs*1000)/1000
   };
  }
  this.traceSubsystemBucket=this.createTraceSubsystemBucket();
  return out;
 }

 isPerformanceTraceActive(){return Boolean(this.performanceTrace?.active);}

 traceElapsedMs(nowPerf=performance.now()){
  return this.performanceTrace ? Math.max(0,Math.round((nowPerf-this.performanceTrace.startedPerf)*10)/10) : 0;
 }

 boundedTracePush(list,value,max,key){
  if(!Array.isArray(list))return;
  list.push(value);
  if(list.length>max){
   const drop=Math.max(1,list.length-max);
   list.splice(0,drop);
   if(this.performanceTrace)this.performanceTrace[key]=(this.performanceTrace[key]||0)+drop;
  }
 }

 recordTraceFrame(delta,wallGapMs){
  if(!this.isPerformanceTraceActive())return;
  const b=this.traceFrameBucket;
  const d=Math.max(0,Number(delta)||0);
  const gap=Math.max(0,Number(wallGapMs)||0);
  const raw=Math.max(0,Number(this.scene?.game?.loop?.rawDelta)||0);
  b.frames++;
  b.deltaSum+=d;
  b.deltaMax=Math.max(b.deltaMax,d);
  b.wallGapMax=Math.max(b.wallGapMax,gap);
  b.rawDeltaMax=Math.max(b.rawDeltaMax,raw);
  if(gap>=33.34)b.slow33++;
  if(gap>=50)b.slow50++;
  if(gap>=100)b.slow100++;
 }

 getTraceRenderState(){
  const game=this.scene?.game;
  const canvas=game?.canvas;
  const rect=canvas?.getBoundingClientRect?.();
  const css=lkCssViewport();
  const gl=game?.renderer?.gl||null;
  const rendererType=game?.renderer?.type===Phaser.WEBGL?'WEBGL':(game?.renderer?.type===Phaser.CANVAS?'CANVAS':String(game?.renderer?.type||'?'));
  return {
   activeRenderScale:Math.round(LK_RENDER_SCALE*100)/100,
   devicePixelRatio:Math.round(Number(window.devicePixelRatio||1)*100)/100,
   cssViewport:{w:css.width,h:css.height},
   windowInner:{w:window.innerWidth||0,h:window.innerHeight||0},
   visualViewport:window.visualViewport?{
    w:Math.round(window.visualViewport.width||0),h:Math.round(window.visualViewport.height||0),
    scale:Math.round((window.visualViewport.scale||1)*100)/100,
    offsetLeft:Math.round(window.visualViewport.offsetLeft||0),offsetTop:Math.round(window.visualViewport.offsetTop||0)
   }:null,
   canvasBacking:{w:canvas?.width||0,h:canvas?.height||0},
   canvasCss:{w:Math.round(rect?.width||canvas?.clientWidth||0),h:Math.round(rect?.height||canvas?.clientHeight||0)},
   backingRatio:{
    x:rect?.width?Math.round((canvas.width/rect.width)*100)/100:null,
    y:rect?.height?Math.round((canvas.height/rect.height)*100)/100:null
   },
   scaleGameSize:{w:game?.scale?.gameSize?.width||0,h:game?.scale?.gameSize?.height||0},
   renderer:rendererType,
   drawCount:Number(game?.renderer?.drawCount)||0,
   drawingBuffer:gl?{w:gl.drawingBufferWidth||0,h:gl.drawingBufferHeight||0}:null,
   contextLost:Boolean(gl?.isContextLost?.()),
   textureCount:Object.keys(this.scene?.textures?.list||{}).length
  };
 }

 getTraceCameraState(){
  const cam=this.scene?.cameras?.main;
  const view=cam?.worldView;
  return {
   zoom:cam?Math.round(cam.zoom*1000)/1000:null,
   scrollX:cam?Math.round(cam.scrollX*10)/10:null,
   scrollY:cam?Math.round(cam.scrollY*10)/10:null,
   centerX:view?Math.round(view.centerX*10)/10:null,
   centerY:view?Math.round(view.centerY*10)/10:null,
   viewW:view?Math.round(view.width*10)/10:null,
   viewH:view?Math.round(view.height*10)/10:null,
   following:Boolean(cam?._follow),
   panRunning:Boolean(cam?.panEffect?.isRunning),
   zoomRunning:Boolean(cam?.zoomEffect?.isRunning),
   shakeRunning:Boolean(cam?.shakeEffect?.isRunning),
   fadeRunning:Boolean(cam?.fadeEffect?.isRunning)
  };
 }

 getTraceLoadState(){
  const s=this.scene;
  const enemies=(s.enemies||[]).filter(e=>e?.active&&e.hp>0);
  const countType=(type)=>enemies.filter(e=>e.type===type).length;
  const ordinary=enemies.filter(e=>e.type!=='champion');
  const navPaths=enemies.filter(e=>Array.isArray(e.navPath)&&e.navPath.length>0).length;
  const windups=enemies.filter(e=>(e.pendingMeleeHitAt||0)>0).length;
  let activeTweens=null,timers=null;
  try{activeTweens=s.tweens?.getTweens?.().length??s.tweens?._active?.length??null;}catch{}
  try{timers=s.time?.getAllEvents?.().length??null;}catch{}
  const sounds=s.sound?.sounds||s.game?.sound?.sounds||[];
  const children=s.children?.list||[];
  const memory=performance?.memory?{
   usedJSHeapSize:performance.memory.usedJSHeapSize||0,
   totalJSHeapSize:performance.memory.totalJSHeapSize||0,
   jsHeapSizeLimit:performance.memory.jsHeapSizeLimit||0
  }:null;
  return {
   displayObjects:children.length,
   activeVisibleObjects:children.filter(o=>o?.active&&o.visible!==false).length,
   runtimeCulledObjects:(s.devEnvironmentObjects||[]).filter(o=>o?.active&&o.runtimeCulled).length,
   activeTweens,
   timers,
   physicsBodies:s.physics?.world?.bodies?.entries?.length??null,
   staticBodies:s.physics?.world?.staticBodies?.entries?.length??null,
   enemies:{total:enemies.length,ordinary:ordinary.length,skeleton:countType('skeleton'),mage:countType('mage'),shield:countType('shield'),champion:countType('champion'),windups,navPaths},
   projectiles:(s.projectiles||[]).filter(p=>p?.active).length,
   championHazards:(s.championHazards||[]).filter(h=>h && (h.visual?.active||h.beamVisual?.active||h.active!==false)).length,
   hearts:(s.hearts||[]).filter(h=>h?.active).length,
   activeAttackFx:Boolean(s.activeAttackFx?.active),
   sounds:{total:sounds.length,playing:sounds.filter(sound=>sound?.isPlaying).length,paused:sounds.filter(sound=>sound?.isPaused).length},
   memory
  };
 }

 buildTraceSnapshot(nowPerf=performance.now()){
  const s=this.scene;
  const loop=s.game?.loop;
  const player=s.player;
  const melee=s.meleeAttack;
  const champ=s.activeChampion?.active?s.activeChampion:null;
  const frame=this.traceFrameBucket;
  const frameSummary={
   count:frame.frames,
   avgDelta:frame.frames?Math.round((frame.deltaSum/frame.frames)*100)/100:null,
   maxDelta:Math.round(frame.deltaMax*100)/100,
   maxWallGap:Math.round(frame.wallGapMax*100)/100,
   maxRawDelta:Math.round(frame.rawDeltaMax*100)/100,
   slow33:frame.slow33,slow50:frame.slow50,slow100:frame.slow100
  };
  this.traceFrameBucket=this.createTraceFrameBucket();

  const orientation=screen?.orientation?{type:screen.orientation.type||null,angle:screen.orientation.angle||0}:{type:null,angle:window.orientation||0};
  return {
   t:this.traceElapsedMs(nowPerf),
   wall:new Date().toISOString(),
   fps:Math.round((Number(loop?.actualFps)||0)*10)/10,
   loop:{delta:Math.round((Number(loop?.delta)||0)*100)/100,rawDelta:Math.round((Number(loop?.rawDelta)||0)*100)/100,targetFps:Number(loop?.targetFps)||null},
   frame:frameSummary,
   subsystems:this.consumeTraceSubsystemBucket(),
   browser:{
    visibility:document.visibilityState||null,hidden:Boolean(document.hidden),hasFocus:Boolean(document.hasFocus?.()),
    online:navigator.onLine!==false,orientation
   },
   pause:{
    gameplayPaused:Boolean(s.gameplayPaused),reasons:Array.from(s.gameplayPauseReasons||[]),
    sceneTimePaused:Boolean(s.time?.paused),physicsPaused:Boolean(s.physics?.world?.isPaused)
   },
   render:this.getTraceRenderState(),
   quality:this.getAdaptiveQualitySnapshot(),
   camera:this.getTraceCameraState(),
   player:{
    x:player?Math.round(player.x*10)/10:null,y:player?Math.round(player.y*10)/10:null,
    vx:player?.body?Math.round(player.body.velocity.x*10)/10:null,vy:player?.body?Math.round(player.body.velocity.y*10)/10:null,
    hp:player?.hp??null,mana:s.mana??null,
    visualState:s.playerVisualState||null,
    combatActive:Boolean(melee?.combatActive),attackTargets:melee?.attackTargetCount??0,nearbyTargets:melee?.nearbyTargetCount??0,
    nearestTargetDistance:melee?.nearestTargetDistance??null,attackCounter:melee?.attackCounter??0,
    attackAnimationActive:Boolean((s.playerAttackUntil||0)>(s.time?.now||0))
   },
   wave:{wave:s.wave,spawned:s.spawned,target:s.waveTarget,intermission:Boolean(s.waveIntermission),autoSpawnsDisabled:Boolean(s.devFlags?.autoSpawnsDisabled)},
   champion:champ?{
    kind:champ.championKind||null,hp:Math.round(champ.hp*10)/10,maxHp:champ.maxHp,x:Math.round(champ.x),y:Math.round(champ.y),
    dormant:Boolean(champ.storyDormant),ignoreAltar:Boolean(champ.ignoreAshAltarCollision),phase2:Boolean(s.brokenSaintAltarReleased)
   }:null,
   story:{
    director:s.storyDirector?.getState?.()||null,objective:s.storyDirector?.getActiveObjective?.()?.id||null,
    focusOwner:s.storyFocusLockOwner||null,
    anomaly:Boolean(s.storyAnomalyCueState),anomalyVignette:Boolean(s.storyAnomalyCueState?.vignette?.active),anomalyCameraLocked:Boolean(s.storyAnomalyCueState?.cameraLocked),
    championReveal:Boolean(s.ashChampionIntroState),championVignette:Boolean(s.ashChampionIntroState?.vignette?.active),championCameraLocked:Boolean(s.ashChampionIntroState?.cameraLocked),
    woundedDialogue:Boolean(s.woundedKnightInteractions?.active)
   },
   load:this.getTraceLoadState()
  };
 }

 samplePerformanceTrace(force=false){
  if(!this.isPerformanceTraceActive())return null;
  const now=performance.now();
  if(!force && now-this.traceLastSampleAt<this.traceSampleIntervalMs)return null;
  this.traceLastSampleAt=now;
  const sample=this.buildTraceSnapshot(now);
  this.boundedTracePush(this.performanceTrace.samples,sample,this.traceMaxSamples,'droppedSamples');
  this.refreshTraceUi();
  return sample;
 }

 recordTraceEvent(type,data={},options={}){
  if(!this.isPerformanceTraceActive())return false;
  const eventType=String(type||'event');
  const eventData=data&&typeof data==='object'?data:{value:data};
  if(options?.dedupe){
   let signature='';
   try{signature=JSON.stringify(eventData);}catch{signature=String(eventData);}
   const dedupeKey=String(options?.dedupeKey||eventType);
   if(this.traceLastEventSignatures.get(dedupeKey)===signature)return false;
   this.traceLastEventSignatures.set(dedupeKey,signature);
  }
  const now=performance.now();
  const event={t:this.traceElapsedMs(now),wall:new Date().toISOString(),type:eventType,data:eventData};
  this.boundedTracePush(this.performanceTrace.events,event,this.traceMaxEvents,'droppedEvents');
  if(options?.sample)this.samplePerformanceTrace(true);
  this.refreshTraceUi();
  return true;
 }

 getTraceMetadata(){
  const game=this.scene?.game;
  return {
   schema:'last-knight-performance-trace-v3',
   build:'v10.8-adaptive-quality',
   createdAt:new Date().toISOString(),
   userAgent:navigator.userAgent||null,
   platform:navigator.platform||null,
   language:navigator.language||null,
   hardwareConcurrency:navigator.hardwareConcurrency||null,
   deviceMemory:navigator.deviceMemory||null,
   maxTouchPoints:navigator.maxTouchPoints||0,
   renderer:game?.renderer?.type===Phaser.WEBGL?'WEBGL':(game?.renderer?.type===Phaser.CANVAS?'CANVAS':String(game?.renderer?.type||'?')),
   renderAtStart:this.getTraceRenderState()
  };
 }

 startPerformanceTrace(){
  const now=performance.now();
  this.performanceTrace={
   active:true,startedPerf:now,startedWall:Date.now(),stoppedWall:null,
   meta:this.getTraceMetadata(),samples:[],events:[],droppedSamples:0,droppedEvents:0
  };
  this.traceLastSampleAt=0;
  this.traceFrameBucket=this.createTraceFrameBucket();
  this.traceSubsystemBucket=this.createTraceSubsystemBucket();
  this.traceLastEventSignatures.clear();
  this.recordTraceEvent('trace_started',{visibility:document.visibilityState,hasFocus:Boolean(document.hasFocus?.())});
  this.samplePerformanceTrace(true);
  this.refreshTraceUi();
 }

 stopPerformanceTrace(){
  if(!this.performanceTrace)return;
  if(this.performanceTrace.active){
   this.samplePerformanceTrace(true);
   this.recordTraceEvent('trace_stopped',{});
   this.performanceTrace.active=false;
   this.performanceTrace.stoppedWall=Date.now();
  }
  this.refreshTraceUi();
 }

 clearPerformanceTrace(){
  this.performanceTrace=null;
  this.traceLastSampleAt=0;
  this.traceFrameBucket=this.createTraceFrameBucket();
  this.traceSubsystemBucket=this.createTraceSubsystemBucket();
  this.traceLastEventSignatures.clear();
  this.renderBenchmarkResults=[];
  this.renderBenchmark=null;
  this.refreshTraceUi();
  this.refreshRenderBenchmarkUi();
 }

 exportPerformanceTrace(){
  if(!this.performanceTrace)return false;
  this.samplePerformanceTrace(true);
  const trace=this.performanceTrace;
  const payload={
   ...trace.meta,
   exportedAt:new Date().toISOString(),
   trace:{
    startedAt:new Date(trace.startedWall).toISOString(),
    stoppedAt:trace.stoppedWall?new Date(trace.stoppedWall).toISOString():null,
    active:Boolean(trace.active),durationMs:Math.round((trace.active?performance.now()-trace.startedPerf:(trace.stoppedWall-trace.startedWall))*10)/10,
    sampleIntervalMs:this.traceSampleIntervalMs,droppedSamples:trace.droppedSamples||0,droppedEvents:trace.droppedEvents||0,
    benchmarks:trace.benchmarks||[],qualityHistory:[...(this.adaptiveQuality?.history||[])]
   },
   finalState:this.buildTraceSnapshot(performance.now()),
   events:trace.events,
   samples:trace.samples
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  link.download=`last-knight-performance-trace-${stamp}.json`;
  link.href=url;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  return true;
 }

 refreshTraceUi(){
  const el=document.getElementById('lkdev-trace-info');
  if(!el)return;
  const t=this.performanceTrace;
  if(!t){el.textContent='Трассировка не запущена';return;}
  const duration=t.active?performance.now()-t.startedPerf:(t.stoppedWall-t.startedWall);
  const status=t.active?'ЗАПИСЬ':'остановлено';
  const latest=t.samples[t.samples.length-1];
  el.textContent=`${status} · ${(Math.max(0,duration)/1000).toFixed(1)} с
Сэмплы ${t.samples.length} · События ${t.events.length} · пропущено ${t.droppedSamples||0}/${t.droppedEvents||0}
FPS ${latest?.fps??'-'} · макс. кадр ${latest?.frame?.maxWallGap??'-'} мс · DPR ${latest?.render?.devicePixelRatio??'-'} · рендер ${latest?.render?.activeRenderScale??LK_RENDER_SCALE}×
Видимость ${document.visibilityState} · фокус ${document.hasFocus?.()?'да':'нет'}`;
 }

 installTraceListeners(){
  if(typeof window==='undefined' || typeof document==='undefined' || this.traceBrowserHandlers)return;
  const browserEvent=(type,extra={})=>()=>this.recordTraceEvent(type,{
   visibility:document.visibilityState,hidden:Boolean(document.hidden),hasFocus:Boolean(document.hasFocus?.()),
   dpr:Number(window.devicePixelRatio||1),innerWidth:window.innerWidth,innerHeight:window.innerHeight,...extra
  },{sample:true});
  this.traceBrowserHandlers={
   visibility:browserEvent('browser_visibilitychange'),
   blur:browserEvent('window_blur'),
   focus:browserEvent('window_focus'),
   pagehide:(event)=>this.recordTraceEvent('pagehide',{persisted:Boolean(event?.persisted),visibility:document.visibilityState},{sample:true}),
   pageshow:(event)=>this.recordTraceEvent('pageshow',{persisted:Boolean(event?.persisted),visibility:document.visibilityState},{sample:true}),
   freeze:browserEvent('page_freeze'),
   resume:browserEvent('page_resume'),
   resize:browserEvent('window_resize'),
   vvresize:browserEvent('visual_viewport_resize'),
   orientation:browserEvent('orientationchange'),
   online:browserEvent('online'),
   offline:browserEvent('offline')
  };
  document.addEventListener('visibilitychange',this.traceBrowserHandlers.visibility);
  window.addEventListener('blur',this.traceBrowserHandlers.blur);
  window.addEventListener('focus',this.traceBrowserHandlers.focus);
  window.addEventListener('pagehide',this.traceBrowserHandlers.pagehide);
  window.addEventListener('pageshow',this.traceBrowserHandlers.pageshow);
  document.addEventListener('freeze',this.traceBrowserHandlers.freeze);
  document.addEventListener('resume',this.traceBrowserHandlers.resume);
  window.addEventListener('resize',this.traceBrowserHandlers.resize,{passive:true});
  window.visualViewport?.addEventListener?.('resize',this.traceBrowserHandlers.vvresize,{passive:true});
  window.addEventListener('orientationchange',this.traceBrowserHandlers.orientation,{passive:true});
  window.addEventListener('online',this.traceBrowserHandlers.online);
  window.addEventListener('offline',this.traceBrowserHandlers.offline);

  this.traceScaleResizeHandler=()=>this.recordTraceEvent('phaser_scale_resize',{renderScale:LK_RENDER_SCALE},{sample:true});
  this.scene.scale?.on?.('resize',this.traceScaleResizeHandler);

  const canvas=this.scene.game?.canvas;
  this.traceContextLostHandler=(event)=>this.recordTraceEvent('webgl_context_lost',{statusMessage:event?.statusMessage||null},{sample:true});
  this.traceContextRestoredHandler=()=>this.recordTraceEvent('webgl_context_restored',{}, {sample:true});
  canvas?.addEventListener?.('webglcontextlost',this.traceContextLostHandler);
  canvas?.addEventListener?.('webglcontextrestored',this.traceContextRestoredHandler);

  const gameEvents=this.scene.game?.events;
  this.traceGameHandlers={};
  for(const name of ['blur','focus','hidden','visible','pause','resume']){
   const handler=()=>this.recordTraceEvent(`phaser_${name}`,{visibility:document.visibilityState},{sample:true});
   this.traceGameHandlers[name]=handler;
   gameEvents?.on?.(name,handler);
  }
 }

 removeTraceListeners(){
  if(typeof window==='undefined' || typeof document==='undefined')return;
  const h=this.traceBrowserHandlers;
  if(h){
   document.removeEventListener('visibilitychange',h.visibility);
   window.removeEventListener('blur',h.blur);window.removeEventListener('focus',h.focus);
   window.removeEventListener('pagehide',h.pagehide);window.removeEventListener('pageshow',h.pageshow);
   document.removeEventListener('freeze',h.freeze);document.removeEventListener('resume',h.resume);
   window.removeEventListener('resize',h.resize);window.visualViewport?.removeEventListener?.('resize',h.vvresize);
   window.removeEventListener('orientationchange',h.orientation);window.removeEventListener('online',h.online);window.removeEventListener('offline',h.offline);
  }
  if(this.traceScaleResizeHandler)this.scene.scale?.off?.('resize',this.traceScaleResizeHandler);
  const canvas=this.scene.game?.canvas;
  if(this.traceContextLostHandler)canvas?.removeEventListener?.('webglcontextlost',this.traceContextLostHandler);
  if(this.traceContextRestoredHandler)canvas?.removeEventListener?.('webglcontextrestored',this.traceContextRestoredHandler);
  const gameEvents=this.scene.game?.events;
  for(const [name,handler] of Object.entries(this.traceGameHandlers||{}))gameEvents?.off?.(name,handler);
  this.traceBrowserHandlers=null;this.traceGameHandlers=null;
 }

 refreshStateButtons(){
  if(!this.root)return;
  const f=this.scene.devFlags;
  const state={autoSpawns:!f.autoSpawnsDisabled,enemyFreezeAI:f.enemyAiFrozen,enemyFreezeMove:f.enemyMovementFrozen,enemyAttacks:f.enemyAttacksDisabled,championFreeze:f.championFrozen,championMove:f.championMovementFrozen,championAttacks:f.championAttacksDisabled,championSkills:f.championSkillsDisabled,god:f.godMode,oneHit:f.oneHitKill,noCollision:f.noCollision,infiniteMana:f.infiniteMana,editEnv:this.editMode,collisionTest:this.collisionTest,groundOnly:this.groundOnly,hideUi:this.hideGameUi,freeCamera:this.freeCamera,lockCamera:this.cameraLocked,placeProp:this.placingProp,lightToggle:this.devLab.lightEnabled};
  this.root.querySelectorAll('[data-action]').forEach(btn=>{
   const a=btn.dataset.action,v=btn.dataset.value;let on=Boolean(state[a]);
   if(a==='envToggle')on=this.envVisibility[v];
   if(a==='overlay')on=this.overlayFlags[v];
   if(a==='segment')on=!this.hiddenSegments.has(v);
   if(a==='qualityAuto')on=this.adaptiveQuality?.mode==='auto';
   if(a==='renderScale'){const target=Number(v);on=Number.isFinite(target)&&Math.abs(target-LK_RENDER_SCALE)<0.01;}
   if(a==='regionPopulation'){const override=this.scene.devRegionPopulationOverride;on=v==='auto'?override===null:override!==null&&Math.abs(Number(v)-override)<0.001;}
   if(a==='aiMode')on=(f.enemyAiMode||'normal')===v;
   if(a==='envAi')on=(f.environmentAiMode||'normal')===v;
   if(a==='ambientFx')on=this.devLab.ambient.has(v);
   if(a==='fxSelect')on=(this.devLab.fxSelected||'fog')===v;
   if(a==='fxToggle')on=this.devLab.ambient.has(this.devLab.fxSelected||'fog');
   if(a==='fxFollow')on=this.getDevFxSettings(this.devLab.fxSelected||'fog').follow===v;
   if(a==='postFx')on=v!=='clear'&&this.devLab.cameraFxKind===v;
   if(a==='playerFx')on=v!=='clear'&&this.devLab.playerFxKind===v;
   if(a==='impactParticles')on=this.devLab.impact.particles===v;
   if(a==='camera2'){const c=this.devLab.camera2;on=(v==='deadzone'&&c.deadzone)||(v==='lookAhead'&&c.lookAhead)||(v==='threat'&&c.threatLook);}
   if(a==='extraCamera')on=(v==='minimap'&&Boolean(this.devLab.camera2.minimap))||(v==='pip'&&Boolean(this.devLab.camera2.pip));
   if(a==='shaderLab')on=v!=='clear'&&this.devLab.shaderLab.kind===v;
   if(a==='fogMask')on=Boolean(this.devLab.worldFx.fogMask);
   if(a==='trailToggle')on=Boolean(this.devLab.worldFx.trail);
   if(a==='screenFx')on=v!=='clear'&&this.devLab.worldFx.screenOverlayKind===v;
   if(a==='worldLayer'){const w=this.devLab.worldFx;on=(v==='depth'&&w.depthSort)||(v==='foreground'&&w.foreground.length>0)||(v==='parallax'&&w.parallax.length>0)||(v==='shadows'&&w.dynamicShadows);}
   if(a==='audioSpatial')on=this.devLab.audioLab.spatial;
   btn.classList.toggle('on',on);
   if(a==='autoSpawns')btn.textContent=f.autoSpawnsDisabled?'Автоспавн ВЫКЛ':'Автоспавн ВКЛ';
  });
  this.refreshAiModeDescription();
 }

 getCurrentSegment(){const x=this.scene.player?.x||0;return ASH_FIELDS_SEGMENTS.find(seg=>x>=seg.start&&x<seg.end)?.id||'-';}
 updateInfo(force=false){
  const now=performance.now();if(!force&&now-this.lastInfoAt<500)return;this.updateRenderInfo(force);this.lastInfoAt=now;
  const s=this.scene,e=s.enemies||[],fps=s.game.loop.actualFps||0,champ=s.activeChampion,rb=s.getRegionBalance(),effectiveSword=s.getEffectiveMeleeDamage(),population=s.getWavePopulationMultiplier();
  const particles=[...this.devLab.ambient.keys()].map(k=>this.getDevFxMeta(k).name).join(', ')||'нет';
  const aiName=(DEV_AI_MODE_META[s.devFlags.enemyAiMode||'normal']||DEV_AI_MODE_META.normal).name;
  const txt=`FPS ${fps.toFixed(0)}   Время ${(s.devTimeScale||1).toFixed(2)}×   WebGL ${this.isWebGlDev()?'ДА':'НЕТ'}
Герой ${Math.round(s.player.x)},${Math.round(s.player.y)}   HP ${Math.round(s.player.hp)}/${s.player.maxHp||100}   Мана ${s.mana}/${s.maxMana}
Зона ${(s.currentWorldZoneIndex||0)+1} · Волна ${s.wave}   Уровень ${s.level}   XP ${s.xp}/${s.getXpRequiredForLevel()}
Враги ${e.filter(x=>x.active&&x.type!=='champion').length}   Снаряды ${s.projectiles.length}   AI ${aiName}
Цель волны ${s.spawned}/${s.waveTarget}   Плотность ${population.toFixed(2)}×   Spawn ${rb.spawnRateMultiplier.toFixed(2)}×
Баланс ${WORLD_DESIGN.ZONES[s.progressionBalanceZoneIndex]?.name||'-'}   HP ×${rb.playerMaxHpMultiplier.toFixed(2)}   Меч +${rb.meleeDamageBonus}
Чемпион ${champ?.active?champ.championName+' '+Math.ceil(champ.hp)+'/'+champ.maxHp:'нет'}
Камера zoom ${s.cameras.main.zoom.toFixed(2)}   PostFX ${this.devLab.cameraFxKind}   Light2D ${this.devLab.lightEnabled?'ВКЛ':'выкл'}
Атмосфера ${particles}   Вороны ${(s.crows||[]).filter(c=>c?.sprite?.active).length}   Boids ${this.devLab.boids.list.length}
Camera2 ${[this.devLab.camera2.deadzone?'deadzone':null,this.devLab.camera2.lookAhead?'look-ahead':null,this.devLab.camera2.threatLook?'threat':null].filter(Boolean).join('+')||'off'}   Shader ${this.devLab.shaderLab.kind}   Spatial ${this.devLab.audioLab.spatial?'ON':'off'}
Меч ${s.meleeAttack.damage}+${rb.meleeDamageBonus}=${effectiveSword} урона / ${s.meleeAttack.cooldown} мс / R${s.meleeAttack.radius}
Пауза ${Array.from(s.gameplayPauseReasons||[]).join(', ')||'нет'}
Редактор ${this.editMode?'ВКЛ':'выкл'}${this.placingProp?' / РАЗМЕЩЕНИЕ':''}   Объект ${this.selected?.devEnvMeta?.id||'—'}`;
  const el=document.getElementById('lkdev-info');if(el)el.textContent=txt;
 }

 drawOverlays(){if(!this.graphics)return;const g=this.graphics,s=this.scene,c=s.cameras.main;g.clear();
  if(this.overlayFlags.safeLane){g.fillStyle(0x4ea7ff,0.055);g.fillRect(0,WORLD_DESIGN.ROUTE_Y-270,4000,540);g.lineStyle(2,0x62b4ff,0.35);g.strokeRect(0,WORLD_DESIGN.ROUTE_Y-270,4000,540);}
  if(this.overlayFlags.meleeRadius){g.lineStyle(2,0xffdf6a,0.8);g.strokeCircle(s.player.x,s.player.y,s.meleeAttack.radius);}
  if(this.overlayFlags.hitboxes){g.lineStyle(2,0x62e8ff,0.85);g.strokeCircle(s.player.x,s.player.y,s.player.hitRadius||16);for(const e of s.enemies){if(e.active){g.lineStyle(1,0xff6677,0.7);g.strokeCircle(e.x,e.y,e.hitRadius||14);}}}
  if(this.overlayFlags.enemyRange){for(const e of s.enemies){if(!e.active||e.type==='champion')continue;const r=e.type==='mage'?210:(e.type==='shield'?75:62);g.lineStyle(1,e.type==='mage'?0x66ff88:0xffa65c,0.32);g.strokeCircle(e.x,e.y,r);}}
  if(this.overlayFlags.championRange&&s.activeChampion?.active){const e=s.activeChampion;let r=e.championKind==='hollowTree'?175:(e.championKind==='shieldWarden'?128:110);g.lineStyle(2,0xd879ff,0.55);g.strokeCircle(e.x,e.y,r);}
  if(this.overlayFlags.propColliders){for(const b of s.devEnvironmentColliders||[]){if(!b?.active||!b.body?.enable)continue;const q=s.getAshBlockerBounds(b);if(q){g.lineStyle(1,0x72ff8b,0.7);g.strokeRect(q.left,q.top,q.right-q.left,q.bottom-q.top);}}}
  if(this.overlayFlags.navigation){
   const nav=s.ensureNavigationGrid?.();
   if(nav){
    const view=c.worldView;
    const minCol=Phaser.Math.Clamp(Math.floor(view.left/nav.cellSize)-1,0,nav.cols-1),maxCol=Phaser.Math.Clamp(Math.floor(view.right/nav.cellSize)+1,0,nav.cols-1);
    const minRow=Phaser.Math.Clamp(Math.floor(view.top/nav.cellSize)-1,0,nav.rows-1),maxRow=Phaser.Math.Clamp(Math.floor(view.bottom/nav.cellSize)+1,0,nav.rows-1);
    g.lineStyle(1,0x6aa8ff,0.13);
    for(let col=minCol;col<=maxCol+1;col++)g.lineBetween(col*nav.cellSize,view.top,col*nav.cellSize,view.bottom);
    for(let row=minRow;row<=maxRow+1;row++)g.lineBetween(view.left,row*nav.cellSize,view.right,row*nav.cellSize);
    for(let row=minRow;row<=maxRow;row++)for(let col=minCol;col<=maxCol;col++)if(nav.blocked[row*nav.cols+col]){g.fillStyle(0xff4d5f,0.18);g.fillRect(col*nav.cellSize,row*nav.cellSize,nav.cellSize,nav.cellSize);}
    for(const e of s.enemies||[]){
     if(!e?.active||!e.navPath?.length)continue;
     const start=Math.min(e.navPathIndex||0,e.navPath.length-1);
     g.lineStyle(2,e.type==='champion'?0xff9dff:0xffd45a,0.72);
     let px=e.x,py=e.y;
     for(let i=start;i<e.navPath.length;i++){const wp=e.navPath[i];g.lineBetween(px,py,wp.x,wp.y);px=wp.x;py=wp.y;}
     const wp=e.navPath[start];if(wp){g.fillStyle(0xffef7a,0.9);g.fillCircle(wp.x,wp.y,4);}
    }
   }
  }
  if(this.overlayFlags.cameraBounds){const v=c.worldView;g.lineStyle(2,0xffffff,0.55);g.strokeRect(v.x,v.y,v.width,v.height);}
  const centerX=s.player.x,centerY=s.player.y;if(this.overlayFlags.mobileFrame){g.lineStyle(2,0x56d8ff,0.48);g.strokeRect(centerX-800,centerY-360,1600,720);}if(this.overlayFlags.desktopFrame){g.lineStyle(2,0xffcc55,0.48);g.strokeRect(centerX-640,centerY-360,1280,720);}
  if(this.editMode&&this.selected?.active&&!this.selected.devDeleted){const b=this.selected.getBounds();g.lineStyle(3,0xffe169,0.95);g.strokeRect(b.x,b.y,b.width,b.height);g.fillStyle(0xffe169,0.8);g.fillCircle(this.selected.x,this.selected.y,5);}
 }

 hasActiveOverlay(){
  return this.editMode || Object.values(this.overlayFlags||{}).some(Boolean);
 }

 update(_time=0,delta=0){
  const now=performance.now(),wallGap=Math.max(0,now-this.lastUpdateReal),dt=Math.min(50,wallGap);this.lastUpdateReal=now;
  this.recordTraceFrame(delta,wallGap);
  this.updateRenderBenchmark(now,wallGap);
  this.updateAdaptiveQuality(now,wallGap);
  this.samplePerformanceTrace(false);
  if(this.open){this.refreshRenderBenchmarkUi();this.refreshAdaptiveQualityUi(false);}
  if(this.freeCamera&&this.camKeys){const c=this.scene.cameras.main,spd=0.72*dt/Math.max(0.1,c.zoom);if(this.camKeys.left.isDown)c.scrollX-=spd;if(this.camKeys.right.isDown)c.scrollX+=spd;if(this.camKeys.up.isDown)c.scrollY-=spd;if(this.camKeys.down.isDown)c.scrollY+=spd;}
  if(this.scene.devFlags.infiniteMana)this.scene.mana=this.scene.maxMana;
  if(this.devLab.ambient.size)this.updateDevAmbientPositions();
  if(this.devLab.lightEnabled){
   const light=this.devLab.light;if(light&&this.scene.player?.active){light.x=this.scene.player.x;light.y=this.scene.player.y;light.radius=this.devLab.lightRadius;light.intensity=this.devLab.lightIntensity;}
   this.refreshDevLightTargets(false);
  }
  this.updateCamera2(delta||dt);
  this.updateAudioSpatial();
  this.updateBoids(delta||dt);
  this.updateDepthSort();
  this.updateDynamicShadows();
  this.updateDevTrail(_time);
  this.updateFogMask();
  this.updatePhysicsLab(delta||dt);

  // DEV rendering is opt-in. Previously both graphics layers were cleared and
  // redrawn every game frame even when the panel and every overlay were off.
  const overlayActive=this.hasActiveOverlay();
  if(overlayActive){
   this.graphics?.setVisible(true);
   this.drawOverlays();
  }else if(this.graphics?.visible){
   this.graphics.clear();
   this.graphics.setVisible(false);
  }

  const uiEditorActive=Boolean(this.uiEditor?.editMode);
  if(uiEditorActive){
   this.uiEditor?.graphics?.setVisible?.(true);
   this.uiEditor?.update();
  }else this.uiEditor?.graphics?.setVisible?.(false);

  // DOM/layout reads are useful only while the DEV panel is actually visible.
  if(this.open) this.updateInfo(false);
 }
}


class BootScene extends Phaser.Scene {
 constructor(){
  super('BootScene');
 }
 preload(){
  this.cameras.main.setBackgroundColor('#060505');
  this.cameras.main.setOrigin(0,0).setZoom(LK_RENDER_SCALE);
  const logical=lkLogicalSceneSize(this),w=logical.width,h=logical.height;
  const cx=w/2,cy=h/2;
  const title=lkAddText(this,cx,cy-62,'LAST KNIGHT',{fontFamily:'Georgia, serif',fontSize:'30px',fontStyle:'bold',color:'#f0dfaf',stroke:'#130e09',strokeThickness:4}).setOrigin(0.5);
  const subtitle=lkAddText(this,cx,cy-30,'ПЕПЕЛ КОРОЛЕВСТВА',{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#c8b48a',letterSpacing:1}).setOrigin(0.5);
  const frameW=Math.min(360,w-48),frameH=18;
  const barBg=this.add.rectangle(cx,cy+8,frameW,frameH,0x130f0d,0.96).setStrokeStyle(2,0x8c7447,0.9);
  const fill=this.add.rectangle(cx-frameW/2+4,cy+8,Math.max(1,frameW-8),frameH-8,0xc69e4f,1).setOrigin(0,0.5);
  fill.displayWidth=0;
  const pct=lkAddText(this,cx,cy+38,'0%',{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#f5e4b3'}).setOrigin(0.5);
  const loading=lkAddText(this,cx,cy+65,'Loading',{fontFamily:'Arial, sans-serif',fontSize:'15px',fontStyle:'bold',color:'#dfd6c5'}).setOrigin(0.5);
  this.load.on('progress',(value)=>{
   fill.displayWidth=Math.max(2,(frameW-8)*value);
   pct.setText(`${Math.round(value*100)}%`);
  });
  this.load.once('complete',()=>{
   fill.displayWidth=frameW-8;
   pct.setText('100%');
   this.time.delayedCall(80,()=>this.scene.start('PreloadScene'));
  });
  [title,subtitle,loading,pct].forEach(t=>t.setResolution?.(LK_TEXT_RESOLUTION));
  const useMobileLoadingArt=typeof window!=='undefined' && (window.matchMedia?.('(pointer: coarse)').matches || (navigator.maxTouchPoints||0)>0);
  this.load.image(LOADING_ART_KEY,useMobileLoadingArt?'/assets/ui/loading_key_art_mobile.jpg':'/assets/ui/loading_key_art_4k.jpg');
  Object.values(COMBAT_STYLE_ART_SPECS).forEach(spec=>this.load.image(spec.key,spec.url));
 }
}

class PreloadScene extends Phaser.Scene {
 constructor(){
  super('PreloadScene');
  this.loadingFailed=false;
  this.requiredLoadErrors=[];
  this.optionalLoadErrors=[];
  this.queuedAssetCount=0;
 }
 create(){
  this.loadingFailed=false;
  this.requiredLoadErrors=[];
  this.optionalLoadErrors=[];
  this.cameras.main.setOrigin(0,0).setZoom(LK_RENDER_SCALE);
  this.buildLoadingScreen();
  const queued=queueAssetCategories(this,INITIAL_ASSET_CATEGORIES);
  for(const [key,url] of CROW_TEXTURE_SPECS){
   if(!this.textures.exists(key)) this.load.image(key,url);
  }
  for(const [key,url] of ZONE2_WAGON_CINEMATIC_SPECS){
   if(!this.textures.exists(key)) this.load.image(key,url);
  }
  this.queuedAssetCount=queued.length+CROW_TEXTURE_SPECS.length+ZONE2_WAGON_CINEMATIC_SPECS.length;
  this.registerLoadingEvents();
  this.load.start();
 }
 buildLoadingScreen(){
  this.bg=this.add.image(0,0,LOADING_ART_KEY).setDepth(0);
  this.vignette=this.add.rectangle(0,0,100,100,0x050403,0.16).setOrigin(0).setDepth(1);
  this.overlayShadow=this.add.rectangle(0,0,100,100,0x000000,0.22).setDepth(2);
  this.overlay=this.add.rectangle(0,0,100,100,0x080706,0.62).setStrokeStyle(2,0x8e7547,0.92).setDepth(3);
  this.overlayInner=this.add.rectangle(0,0,100,100,0x12100d,0.38).setStrokeStyle(1,0xd9c180,0.18).setDepth(4);
  this.loadingTitle=lkAddText(this,0,0,'LAST KNIGHT',{fontFamily:'Georgia, serif',fontSize:'30px',fontStyle:'bold',color:'#f1e0b1',stroke:'#130e09',strokeThickness:4}).setOrigin(0.5).setDepth(5);
  this.loadingSubtitle=lkAddText(this,0,0,'ПЕПЕЛ КОРОЛЕВСТВА',{fontFamily:'Arial, sans-serif',fontSize:'15px',fontStyle:'bold',color:'#ccb68a',letterSpacing:1}).setOrigin(0.5).setDepth(5);
  this.loadingStatus=lkAddText(this,0,0,LOADING_SCREEN_STATUS,{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#dfd6c5'}).setOrigin(0.5).setDepth(5);
  this.progressBack=this.add.rectangle(0,0,100,18,0x100d0b,0.96).setStrokeStyle(2,0x8d7445,0.95).setDepth(5);
  this.progressFill=this.add.rectangle(0,0,100,10,0xc39a4a,1).setOrigin(0,0.5).setDepth(6);
  this.progressGlow=this.add.rectangle(0,0,100,3,0xf6d691,0.34).setOrigin(0,0.5).setDepth(6);
  this.progressPct=lkAddText(this,0,0,'0%',{fontFamily:'Arial, sans-serif',fontSize:'15px',fontStyle:'bold',color:'#f7e5b5'}).setOrigin(0.5).setDepth(6);
  this.retryHint=lkAddText(this,0,0,'Loading failed — tap to retry',{fontFamily:'Arial, sans-serif',fontSize:'13px',fontStyle:'bold',color:'#ffcfbf'}).setOrigin(0.5).setDepth(6).setVisible(false).setInteractive({useHandCursor:true});
  [this.loadingTitle,this.loadingSubtitle,this.loadingStatus,this.progressPct,this.retryHint].forEach(t=>t?.setResolution?.(LK_TEXT_RESOLUTION));
  this.retryHint.on('pointerdown',()=>{
   if(!this.loadingFailed) return;
   this.scene.restart();
  });
  this.scale.on('resize',this.layoutLoadingScreen,this);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
   this.scale.off('resize',this.layoutLoadingScreen,this);
   this.load.off('progress');
   this.load.off('fileprogress');
   this.load.off('complete');
   this.load.off('loaderror');
  });
  this.layoutLoadingScreen();
 }
 layoutLoadingScreen(){
  this.cameras.main.setOrigin(0,0).setZoom(LK_RENDER_SCALE);
  const logical=lkLogicalSceneSize(this),w=logical.width,h=logical.height;
  const mobile=h<760 || w<1100;
  const cx=w/2,cy=h/2;
  const bgScale=Math.max(w/this.bg.width,h/this.bg.height);
  this.bg.setPosition(cx,cy).setScale(bgScale);
  this.vignette.setPosition(0,0).setSize(w,h).setDisplaySize(w,h);
  const overlayW=Math.min(mobile?Math.max(300,w*0.70):560,w-36);
  const overlayH=mobile?176:198;
  this.overlayShadow.setPosition(cx,cy+4).setSize(overlayW,overlayH).setDisplaySize(overlayW,overlayH);
  this.overlay.setPosition(cx,cy).setSize(overlayW,overlayH).setDisplaySize(overlayW,overlayH);
  this.overlayInner.setPosition(cx,cy).setSize(overlayW-10,overlayH-10).setDisplaySize(overlayW-10,overlayH-10);
  this.loadingTitle.setPosition(cx,cy-(mobile?61:70)).setFontSize(mobile?25:30);
  this.loadingSubtitle.setPosition(cx,cy-(mobile?34:39)).setFontSize(mobile?12:14);
  const barW=overlayW-(mobile?42:64);
  const barY=cy+(mobile?0:1);
  this.progressBack.setPosition(cx,barY).setSize(barW,20).setDisplaySize(barW,20);
  this.progressFill.setPosition(cx-barW/2+5,barY).setSize(barW-10,10).setDisplaySize(Math.max(0,Math.min(barW-10,this.progressFill.displayWidth||0)),10);
  this.progressGlow.setPosition(cx-barW/2+5,barY-4).setSize(barW-10,3).setDisplaySize(Math.max(0,Math.min(barW-10,this.progressGlow.displayWidth||0)),3);
  this.progressPct.setPosition(cx,cy+(mobile?29:31)).setFontSize(mobile?14:15);
  // Keep Loading as the last normal line in the frame. Its baseline sits
  // roughly one text-line above the inner bottom edge, as requested.
  this.loadingStatus.setPosition(cx,cy+(mobile?57:62)).setFontSize(mobile?13:14);
  this.retryHint.setPosition(cx,cy+(mobile?78:84)).setFontSize(mobile?11:12);
 }

 registerLoadingEvents(){
  this.load.on('progress',(value)=>this.setProgress(value));
  this.load.on('loaderror',(file)=>{
   const key=String(file?.key||'unknown');
   const spec=getAssetSpec(key);
   const optional=spec?.requirement===ASSET_REQUIREMENT.OPTIONAL;
   if(optional){
    this.optionalLoadErrors.push(key);
    console.warn(`[AssetPipeline] Optional asset skipped: ${key}`,spec?.url||file?.url||'');
    return;
   }

   this.loadingFailed=true;
   this.requiredLoadErrors.push(key);
   console.error(`[AssetPipeline] Required asset failed: ${key}`,spec?.url||file?.url||'');
   this.loadingStatus.setText('Loading failed');
   this.retryHint.setVisible(true);
  });
  this.load.once('complete',()=>{
   if(this.loadingFailed){
    this.loadingStatus.setText('Loading failed');
    this.retryHint.setVisible(true);
    return;
   }
   this.setProgress(1);
   this.loadingStatus.setText('Loading');
   this.time.delayedCall(220,()=>{
    this.cameras.main.fadeOut(220,0,0,0);
    this.time.delayedCall(230,()=>{
     if(this.loadingFailed) return;
     if(this.bg?.active) this.bg.destroy();
     this.scene.start('GameMenuScene',{mode:'root'});
     // releaseTextureKeys(this,[LOADING_ART_KEY]);
    });
   });
  });
  this.loadingStatus.setText('Loading');
 }

 setProgress(value){
  const progress=Phaser.Math.Clamp(value,0,1);
  const maxW=(this.progressBack.displayWidth||this.progressBack.width)-10;
  this.progressFill.displayWidth=Math.max(0,maxW*progress);
  this.progressGlow.displayWidth=Math.max(0,maxW*progress);
  this.progressPct.setText(`${Math.round(progress*100)}%`);
 }
}



class CinematicScene extends Phaser.Scene {
 constructor(){
  super('CinematicScene');
  this.transitioning=false;
  this.stoneFramePieces=[];
  this.pageIndex=0;
  this.prologueMusic=null;
  this.musicHandedOff=false;
  this.fullscreenButton=null;
  this.fullscreenIcon=null;
  this.isCompactMobile=false;
  this.cinematicImageAspect=2.75;
  this.prologuePages=PROLOGUE_STORY_PAGES;
  this.cinematicMode='prologue';
  this.cinematicPages=this.prologuePages;
  this.runtimeReleaseTextureKeys=[];
  this.runtimeOnComplete=null;
  this.runtimeOnCancel=null;
  this.runtimeCompletionDispatched=false;
  this.cinematicImageMaskShape=null;
  this.cinematicImageMask=null;
  this.cinematicPanTween=null;
 }

 init(data={}){
  const runtimePages=Array.isArray(data?.pages)
   ? data.pages.filter(page=>page && page.image && page.text!==undefined)
   : [];
  this.cinematicMode=data?.mode==='story' ? 'story' : 'prologue';
  this.cinematicPages=this.cinematicMode==='story' && runtimePages.length
   ? runtimePages
   : this.prologuePages;
  this.runtimeReleaseTextureKeys=Array.isArray(data?.releaseTextureKeys)
   ? [...new Set(data.releaseTextureKeys.filter(Boolean))]
   : [];
  this.runtimeOnComplete=typeof data?.onComplete==='function' ? data.onComplete : null;
  this.runtimeOnCancel=typeof data?.onCancel==='function' ? data.onCancel : null;
  this.runtimeCompletionDispatched=false;
  this.transitioning=false;
  this.pageIndex=0;
  this.musicHandedOff=false;
 }

 create(){
  this.cameras.main.setBackgroundColor('#050505');
  this.cameras.main.setOrigin(0,0).setZoom(LK_RENDER_SCALE);

  this.buildCinematicUi();
  this.setProloguePage(0);
  this.layout();
  if(this.cinematicMode==='prologue') this.startPrologueMusic();
  cinematicFadeIn(this);

  this._cinematicResizeHandler=()=>this.layout();
  this.scale.on('resize',this._cinematicResizeHandler);

  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
   if(this._cinematicResizeHandler){
    this.scale.off('resize',this._cinematicResizeHandler);
   }
   if(this._fullscreenChangeHandler && typeof document!=='undefined'){
    document.removeEventListener('fullscreenchange',this._fullscreenChangeHandler);
   }
   if(!this.musicHandedOff) this.stopPrologueMusic();
   if(this.cinematicMode==='story' && !this.runtimeCompletionDispatched){
    this.dispatchRuntimeCinematicCancel();
   }
   this.stopCinematicImagePan();
   this.cinematicImageMaskShape?.destroy();
   this.cinematicImageMaskShape=null;
   this.cinematicImageMask=null;
  });

  this.input.keyboard?.on('keydown-RIGHT',()=>this.advancePrologue());
  this.input.keyboard?.on('keydown-ENTER',()=>this.advancePrologue());
  this.input.keyboard?.on('keydown-SPACE',()=>this.advancePrologue());
 }

 buildCinematicUi(){
  this.upperPanel=this.add.rectangle(0,0,100,100,0x050505,1)
   .setOrigin(0)
   .setDepth(0);
  this.lowerPanel=this.add.rectangle(0,0,100,100,0x050505,1)
   .setOrigin(0)
   .setDepth(0)
   .setInteractive({useHandCursor:true});
  this.lowerPanel.on('pointerup',()=>this.advancePrologue());

  const firstImageKey=this.cinematicPages?.[0]?.image || this.prologuePages?.[0]?.image || 'prologue_scene_01';
  this.cinematicImageMaskShape=this.make.graphics({x:0,y:0,add:false});
  this.cinematicImageMask=this.cinematicImageMaskShape.createGeometryMask();
  this.cinematicImage=this.add.image(0,0,firstImageKey)
   .setOrigin(0)
   .setDepth(2)
   .setMask(this.cinematicImageMask);

  this.dialogueText=lkAddText(this,0,0,'',{
   fontFamily:'Georgia, serif',
   fontSize:'24px',
   color:'#ece2d1',
   align:'center',
   wordWrap:{width:760,useAdvancedWrap:true},
   lineSpacing:8
  }).setOrigin(0.5).setDepth(5);

  this.nextArrowHit=this.add.rectangle(0,0,96,84,0xffffff,0.001)
   .setDepth(20)
   .setInteractive({useHandCursor:true});

  this.nextArrowText=lkAddText(this,0,0,'→',{
   fontFamily:'Georgia, serif',
   fontSize:'48px',
   color:'#dcc59d',
   stroke:'#080706',
   strokeThickness:2
  }).setOrigin(0.5).setDepth(21);

  this.nextArrowHit.on('pointerover',()=>{
   if(!this.transitioning) this.nextArrowText.setColor('#fff0cc');
  });
  this.nextArrowHit.on('pointerout',()=>{
   this.nextArrowText.setColor('#dcc59d');
  });
  this.nextArrowHit.on('pointerup',()=>this.advancePrologue());

  this.buildFullscreenButton();
 }

 buildDevMenuButton(){
  this.devMenuButton=this.add.circle(0,0,22,0x11100e,0.88).setStrokeStyle(2,0x6f7d65,0.88).setDepth(95).setInteractive({useHandCursor:true});
  this.devMenuLabel=lkAddText(this,0,0,'DEV',{fontFamily:'Arial, sans-serif',fontSize:'9px',fontStyle:'bold',color:'#bfe8c2',stroke:'#0b120c',strokeThickness:2}).setOrigin(0.5).setDepth(96).setInteractive({useHandCursor:true});
  const open=(pointer,localX,localY,event)=>{
   event?.stopPropagation?.();
   pointer?.event?.stopPropagation?.();
   if(this.mainScene?.devTools?.uiEditor?.editMode)return;
   this.mainScene?.devTools?.togglePanel?.(true);
  };
  this.devMenuButton.on('pointerdown',open);
  this.devMenuLabel.on('pointerdown',open);
  this.setDevMenuOpen(Boolean(this.mainScene?.devTools?.open));
 }

 setDevMenuOpen(open){
  if(!this.devMenuButton||!this.devMenuLabel)return;
  this.devMenuButton.setFillStyle(open?0x33452f:0x11100e,open?0.98:0.88).setStrokeStyle(2,open?0xbadf91:0x6f7d65,0.9);
  this.devMenuLabel.setColor(open?'#e4ffc8':'#bfe8c2');
 }

 buildFullscreenButton(){
  this.fullscreenButton=this.add.circle(0,0,24,0x11100e,0.92)
   .setStrokeStyle(2,0xc4a662,0.92)
   .setDepth(40)
   .setScrollFactor(0)
   .setInteractive({useHandCursor:true});
  this.fullscreenIconLabel=lkAddText(this,0,0,'⛶',{
   fontFamily:'Arial, sans-serif',
   fontSize:'24px',
   color:'#f1dfaa'
  }).setOrigin(0.5).setDepth(41).setScrollFactor(0);

  this.fullscreenButton.on('pointerdown',()=>this.toggleFullscreen());
  this.fullscreenIconLabel.setInteractive({useHandCursor:true});
  this.fullscreenIconLabel.on('pointerdown',()=>this.toggleFullscreen());

  if(typeof document!=='undefined'){
   this._fullscreenChangeHandler=()=>{
    this.updateFullscreenLabel();
    this.time.delayedCall(80,()=>this.layout());
   };
   document.addEventListener('fullscreenchange',this._fullscreenChangeHandler);
  }
  this.updateFullscreenLabel();
 }

 updateFullscreenLabel(){
  if(!this.fullscreenIconLabel)return;
  const active=typeof document!=='undefined' && Boolean(document.fullscreenElement);
  this.fullscreenIconLabel.setText(active?'🗗':'⛶');
 }

 async toggleFullscreen(){
  if(typeof document==='undefined') return;
  try{
   if(document.fullscreenElement){
    if(document.exitFullscreen) await document.exitFullscreen();
   } else {
    const target=document.documentElement;
    const request=target.requestFullscreen || target.webkitRequestFullscreen;
    if(request) await request.call(target);
    if(screen.orientation?.lock){
     try{ await screen.orientation.lock('landscape'); }catch(e){}
    }
   }
  }catch(e){
   console.warn('Fullscreen request was blocked by the browser',e);
  }
  this.time.delayedCall(80,()=>this.layout());
 }

 startPrologueMusic(){
  if(!this.sound || !this.cache.audio.exists('bgm_veil_of_the_past')) return;

  this.prologueMusic=this.sound.add(
   'bgm_veil_of_the_past',
   {loop:true,volume:0.50*getGameSettings().musicVolume}
  );

  const startMusic=()=>{
   if(!this.prologueMusic || this.prologueMusic.isPlaying) return;
   this.prologueMusic.play();
  };

  if(this.sound.locked) this.sound.once('unlocked',startMusic);
  else startMusic();
 }

 stopPrologueMusic(){
  if(!this.prologueMusic)return;
  try{this.prologueMusic.stop();}catch{}
  try{this.prologueMusic.destroy();}catch{}
  this.prologueMusic=null;
 }

 setProloguePage(index){
  const page=this.cinematicPages[index];
  if(!page)return;

  this.pageIndex=index;
  this.dialogueText.setText(page.text);
  this.cinematicImage.setTexture(page.image);
  this.nextArrowText.setText('→');

  if(this._lastImageBounds){
   this.fitCinematicImage(...this._lastImageBounds);
  }
  if(this._lastTextLayout){
   this.layoutDialogueText(...this._lastTextLayout);
  }
 }

 advancePrologue(){
  if(this.transitioning)return;

  if(this.pageIndex<this.cinematicPages.length-1){
   const nextIndex=this.pageIndex+1;
   cinematicSwapWithFade(this,()=>this.setProloguePage(nextIndex));
   return;
  }

  this.continueToGame();
 }

 clearStoneFrame(){
  for(const piece of this.stoneFramePieces){
   if(piece?.active) piece.destroy();
  }
  this.stoneFramePieces.length=0;
 }

 addStoneBar(x1,y1,x2,y2,thickness,depth=10){
  const dx=x2-x1;
  const dy=y2-y1;
  const length=Math.hypot(dx,dy);
  if(length<=0)return;

  const source=this.textures.get('cinematic_stone_bar').getSourceImage();
  const aspect=(source?.width&&source?.height)
   ? source.width/source.height
   : 3.2;

  const segmentLength=thickness*aspect;
  const count=Math.max(1,Math.ceil(length/segmentLength));
  const angle=Math.atan2(dy,dx);
  const ux=dx/length;
  const uy=dy/length;

  for(let i=0;i<count;i++){
   const along=Math.min(length-segmentLength/2, segmentLength*(i+0.5));
   const safeAlong=Math.max(segmentLength/2,along);
   const x=x1+ux*safeAlong;
   const y=y1+uy*safeAlong;

   const piece=this.add.image(x,y,'cinematic_stone_bar')
    .setOrigin(0.5)
    .setDepth(depth)
    .setDisplaySize(segmentLength+1,thickness)
    .setRotation(angle)
    .setFlipX(i%2===1);

   this.stoneFramePieces.push(piece);
  }
 }

 addStoneJoint(x,y,size,depth=12){
  const joint=this.add.image(x,y,'cinematic_stone_joint')
   .setOrigin(0.5)
   .setDepth(depth)
   .setDisplaySize(size,size);

  this.stoneFramePieces.push(joint);
  return joint;
 }

 fitCinematicImage(x,y,w,h){
  if(!this.cinematicImage?.texture)return;

  this.stopCinematicImagePan();
  const source=this.cinematicImage.texture.getSourceImage();
  const sw=source?.width||1536;
  const sh=source?.height||864;
  const page=this.cinematicPages?.[this.pageIndex];
  const shouldPanLeft=page?.pan==='left';
  const scale=shouldPanLeft ? Math.max(w/sw,h/sh) : Math.min(w/sw,h/sh);
  const displayW=sw*scale;
  const displayH=sh*scale;
  const drawX=shouldPanLeft ? x : x+(w-displayW)*0.5;
  const drawY=y+(h-displayH)*0.5;

  this.cinematicImage
   .setCrop()
   .setPosition(drawX,drawY)
   .setDisplaySize(displayW,displayH);

  if(shouldPanLeft && displayW>w+1){
   this.cinematicPanTween=this.tweens.add({
    targets:this.cinematicImage,
    x:x+w-displayW,
    duration:14000,
    ease:'Sine.easeInOut'
   });
  }

  this._lastImageBounds=[x,y,w,h];
 }

 stopCinematicImagePan(){
  if(!this.cinematicPanTween)return;
  this.cinematicPanTween.stop();
  this.cinematicPanTween=null;
 }

 updateCinematicImageMask(x,y,w,h){
  if(!this.cinematicImageMaskShape)return;
  this.cinematicImageMaskShape
   .clear()
   .fillStyle(0xffffff,1)
   .fillRect(x,y,w,h);
 }

 layoutDialogueText(textX,textY,textW,textH){
  if(!this.dialogueText)return;

  this._lastTextLayout=[textX,textY,textW,textH];

  const centerX=textX+textW*0.5;
  const centerY=textY+textH*0.5;
  const targetLines=Math.max(1,this.dialogueText.text.split('\n').length);
  const {width:sceneW,height:sceneH}=lkLogicalSceneSize(this);

  // 1280x720 is the reference cinematic viewport. The font now scales with
  // the real screen/frame size instead of staying at 28px until it overflows.
  const responsiveScale=Math.min(sceneW/1280,sceneH/720);
  const responsiveBase=Phaser.Math.Clamp(28*responsiveScale,10,28);
  const contentLimit=Math.min(textH/(targetLines+0.65),textW/18);
  let fontSize=Math.floor(Phaser.Math.Clamp(Math.min(responsiveBase,contentLimit),9,28));
  const minFontSize=9;

  this.dialogueText
   .setAlign('center')
   .setOrigin(0.5)
   .setPosition(centerX,centerY);

  while(fontSize>=minFontSize){
   this.dialogueText
    .setFontSize(fontSize)
    .setLineSpacing(Math.max(2,Math.round(fontSize*0.18)))
    .setWordWrapWidth(textW,true)
    .setPosition(centerX,centerY);

   const bounds=this.dialogueText.getBounds();
   if(bounds.width<=textW+2 && bounds.height<=textH+2){
    break;
   }
   fontSize-=1;
  }
 }


 layout(){
  if(!this.upperPanel)return;
  this.clearStoneFrame();

  const {width:w,height:h}=lkLogicalSceneSize(this);
  this.isCompactMobile=(w<=760 || h<=460);

  // Variant 1: 10% are safe margins, not mandatory frame size.
  // The cinematic frame may become narrower than 80% width so the
  // lower text block always remains visible on ultra-wide mobile screens.
  const marginX=Math.round(w*0.10);
  const marginY=Math.round(h*0.10);
  const maxFrameW=Math.max(260,w-marginX*2);
  const maxFrameH=Math.max(220,h-marginY*2);

  const preferredTextShare=this.isCompactMobile?0.37:0.35;
  const minTextBlockH=Phaser.Math.Clamp(maxFrameH*(this.isCompactMobile?0.24:0.22),88,170);

  // Width limited by both available width and the need to preserve room
  // for the fixed-ratio image plus the lower dialogue block.
  let frameW=Math.min(maxFrameW,maxFrameH*this.cinematicImageAspect*(1-preferredTextShare));
  frameW=Math.max(260,frameW);

  let imageH=frameW/this.cinematicImageAspect;
  let frameH=imageH/(1-preferredTextShare);
  let lowerPanelH=frameH-imageH;

  if(lowerPanelH<minTextBlockH){
   lowerPanelH=minTextBlockH;
   imageH=Math.min(frameW/this.cinematicImageAspect,maxFrameH-lowerPanelH);
   frameH=imageH+lowerPanelH;
   if(frameH>maxFrameH){
    frameH=maxFrameH;
    lowerPanelH=Math.max(minTextBlockH,frameH*(this.isCompactMobile?0.26:0.24));
    imageH=frameH-lowerPanelH;
    frameW=Math.min(frameW,imageH*this.cinematicImageAspect);
   }
  }

  // Final safety clamp: if the frame is still too wide for the chosen height,
  // shrink it and recompute the image height.
  const maxFrameWFromHeight=Math.max(260,(maxFrameH-minTextBlockH)*this.cinematicImageAspect);
  if(frameW>maxFrameWFromHeight){
   frameW=maxFrameWFromHeight;
   imageH=frameW/this.cinematicImageAspect;
   lowerPanelH=Math.max(minTextBlockH,Math.min(maxFrameH-imageH, imageH*(preferredTextShare/(1-preferredTextShare))));
   frameH=imageH+lowerPanelH;
  }

  frameW=Math.min(frameW,maxFrameW);
  frameH=Math.min(frameH,maxFrameH);
  imageH=Math.min(imageH,frameH-minTextBlockH);
  lowerPanelH=frameH-imageH;

  const left=Math.round((w-frameW)*0.5);
  const top=Math.round((h-frameH)*0.5);
  const right=left+frameW;
  const bottom=top+frameH;

  const borderThickness=Phaser.Math.Clamp(Math.min(frameW,frameH)*0.030,16,28);
  const jointSize=borderThickness*1.85;
  const halfBorder=borderThickness*0.58;

  const innerLeft=left+halfBorder;
  const innerRight=right-halfBorder;
  const innerTop=top+halfBorder;
  const innerBottom=bottom-halfBorder;
  const innerWidth=Math.max(180,innerRight-innerLeft);

  const dividerY=top+imageH;

  this.upperPanel
   .setPosition(left,top)
   .setSize(frameW,imageH)
   .setDisplaySize(frameW,imageH);
  this.lowerPanel
   .setPosition(left,dividerY)
   .setSize(frameW,lowerPanelH)
   .setDisplaySize(frameW,lowerPanelH);

  this.updateCinematicImageMask(left,top,frameW,imageH);
  this.fitCinematicImage(left,top,frameW,imageH);

  this.addStoneBar(left,top,right,top,borderThickness);
  this.addStoneBar(left,bottom,right,bottom,borderThickness);
  this.addStoneBar(left,dividerY,right,dividerY,borderThickness);
  this.addStoneBar(left,top,left,bottom,borderThickness);
  this.addStoneBar(right,top,right,bottom,borderThickness);

  this.addStoneJoint(left,top,jointSize);
  this.addStoneJoint(right,top,jointSize);
  this.addStoneJoint(left,bottom,jointSize);
  this.addStoneJoint(right,bottom,jointSize);
  this.addStoneJoint(left,dividerY,jointSize);
  this.addStoneJoint(right,dividerY,jointSize);

  const lowerTop=dividerY+halfBorder;
  const lowerHeight=Math.max(1,innerBottom-lowerTop);

  const showArrow=!this.isCompactMobile;
  this.nextArrowHit.setVisible(showArrow);
  this.nextArrowText.setVisible(showArrow);
  if(showArrow){
   const arrowPadX=Phaser.Math.Clamp(frameW*0.040,16,30);
   const arrowHitW=Phaser.Math.Clamp(frameW*0.10,64,104);
   const arrowHitH=Phaser.Math.Clamp(lowerHeight*0.46,52,84);
   const arrowX=innerRight-arrowPadX-arrowHitW*0.5;
   const arrowY=lowerTop+lowerHeight*0.5;
   this.nextArrowHit.setPosition(arrowX,arrowY).setSize(arrowHitW,arrowHitH).setDisplaySize(arrowHitW,arrowHitH);
   this.nextArrowText.setPosition(arrowX,arrowY).setFontSize(Phaser.Math.Clamp(lowerHeight*0.30,30,52));
  }

  const textPadX=Phaser.Math.Clamp(frameW*0.06,20,52);
  const textPadY=Phaser.Math.Clamp(lowerHeight*0.12,4,20);
  const reservedArrowW=showArrow ? Phaser.Math.Clamp(frameW*0.12,72,120) : 0;
  const textX=innerLeft+textPadX;
  const textY=lowerTop+textPadY;
  const textW=Math.max(140,innerWidth-textPadX*2-reservedArrowW);
  const textH=Math.max(1,lowerHeight-textPadY*2);
  this.layoutDialogueText(textX,textY,textW,textH);

  if(this.fullscreenButton && this.fullscreenIconLabel){
   const fsRadius=Phaser.Math.Clamp(borderThickness*1.02,22,28);
   const fsMargin=Phaser.Math.Clamp(borderThickness*0.85,16,24);
   const fsX=w-fsMargin-fsRadius;
   const fsY=fsMargin+fsRadius;
   this.fullscreenButton.setRadius(fsRadius).setPosition(fsX,fsY);
   this.fullscreenIconLabel.setPosition(fsX,fsY).setFontSize(Math.round(fsRadius*1.02));
   this.updateFullscreenLabel();
  }
 }

 continueToGame(){
  if(this.transitioning)return;

  this.nextArrowHit.disableInteractive();
  this.lowerPanel.disableInteractive();
  this.fullscreenButton?.disableInteractive();
  this.fullscreenIconLabel?.disableInteractive();

  if(this.cinematicMode==='story'){
   cinematicFadeOutAndRun(this,()=>{
    if(this.runtimeReleaseTextureKeys.length){
     if(this.cinematicImage?.active) this.cinematicImage.destroy();
     releaseTextureKeys(this,this.runtimeReleaseTextureKeys);
    }
    this.dispatchRuntimeCinematicComplete();
    this.scene.stop();
   });
   return;
  }

  if(this.prologueMusic){
   this.registry.set('lastKnightBgmHandoff',this.prologueMusic);
   this.musicHandedOff=true;
   this.prologueMusic=null;
  }

  cinematicFadeOutAndRun(this,()=>{
   // Prologue illustrations are one-shot textures. The root menu reloads
   // these three pages on demand before a later "New Game" session.
   if(this.cinematicImage?.active) this.cinematicImage.destroy();
   releaseTextureKeys(this,PROLOGUE_PAGE_KEYS);
   this.scene.start('main');
  });
 }

 dispatchRuntimeCinematicComplete(){
  if(this.runtimeCompletionDispatched)return;
  this.runtimeCompletionDispatched=true;
  const callback=this.runtimeOnComplete;
  this.runtimeOnComplete=null;
  this.runtimeOnCancel=null;
  if(callback){
   try{callback();}catch(error){console.error('[CinematicScene] story completion callback failed',error);}
  }
 }

 dispatchRuntimeCinematicCancel(){
  if(this.runtimeCompletionDispatched)return;
  this.runtimeCompletionDispatched=true;
  const callback=this.runtimeOnCancel;
  this.runtimeOnComplete=null;
  this.runtimeOnCancel=null;
  if(callback){
   try{callback();}catch(error){console.error('[CinematicScene] story cancel callback failed',error);}
  }
 }
}


class GameMenuScene extends Phaser.Scene {
 constructor(){
  super({key:'GameMenuScene'});
  this.mode='root';
  this.mainScene=null;
  this.content=[];
  this.statusText=null;
 }

 init(data={}){
  this.mode=data?.mode==='session'?'session':'root';
  this.mainScene=data?.mainScene||null;
  this.currentView={type:'menu'};
 }

 create(){
  this.cameras.main.setBackgroundColor('#090806');
  this.syncLayoutCamera();
  if(!this.mainScene && this.mode==='session')this.mainScene=this.scene.get('main');
  // Save model v2: the root menu never owns a resumable live session.
  // Persistent gameplay progress lives only in the three manual save slots.
  if(this.mode==='root'){
   clearAutosave();
   clearCharacterStats();
  }
  this.menuBackgroundArt=this.textures.exists(LOADING_ART_KEY)
   ?this.add.image(0,0,LOADING_ART_KEY).setOrigin(0.5).setDepth(0).setVisible(this.mode==='root')
   :null;
  this.menuBackgroundVignette=this.add.rectangle(0,0,100,100,0x000000,this.mode==='root'?0.18:0).setOrigin(0).setDepth(0.5);
  this.background=this.add.rectangle(0,0,100,100,0x080706,this.mode==='session'?0.82:0.62).setOrigin(0).setDepth(1);
  // Soft layered haze around the menu frame. This gives the background a
  // frosted/blurred feel without an expensive full-screen blur pass.
  this.panelHaze=this.add.graphics().setDepth(1.5);
  this.panel=this.add.graphics().setDepth(2);
  this.title=lkAddText(this,0,0,'LAST KNIGHT',{fontFamily:'Georgia, serif',fontSize:'34px',fontStyle:'bold',color:'#f0dfaf',stroke:'#120d09',strokeThickness:5}).setOrigin(0.5).setDepth(3);
  this.subtitle=lkAddText(this,0,0,'ПЕПЕЛ КОРОЛЕВСТВА',{fontFamily:'Arial, sans-serif',fontSize:'13px',fontStyle:'bold',color:'#bfae84',letterSpacing:2}).setOrigin(0.5).setDepth(3);
  this.statusText=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'12px',color:'#d9cfb0',align:'center',wordWrap:{width:520,useAdvancedWrap:true}}).setOrigin(0.5).setDepth(20);
  this.buildFullscreenControl();
  this._menuResizeHandler=()=>this.redrawCurrentView();
  this.scale.on('resize',this._menuResizeHandler);
  this._menuEscHandler=()=>{if(this.mode==='session')this.resumeGame();};
  this.input.keyboard?.on('keydown-ESC',this._menuEscHandler);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
   if(this._menuResizeHandler)this.scale.off('resize',this._menuResizeHandler);
   if(this._menuEscHandler)this.input.keyboard?.off('keydown-ESC',this._menuEscHandler);
   if(this._menuFullscreenChangeHandler && typeof document!=='undefined')document.removeEventListener('fullscreenchange',this._menuFullscreenChangeHandler);
   this._menuResizeHandler=null;
   this._menuEscHandler=null;
   this._menuFullscreenChangeHandler=null;
  });
  this.renderMenu();
  // Root menu arrives from the loading-screen blackout, so reveal it as one
  // continuous cinematic transition instead of a hard scene cut.
  if(this.mode==='root')this.cameras.main.fadeIn(460,0,0,0);
  // A FIT canvas can receive one final browser/ScaleManager size pass just
  // after a scene transition. Re-sync on the next frames so the first menu
  // paint is correct even before the user resizes the browser or opens DevTools.
  this.time.delayedCall(0,()=>this.redrawCurrentView());
  this.time.delayedCall(120,()=>this.redrawCurrentView());
 }

 syncLayoutCamera(){
  const cam=this.cameras?.main;
  if(!cam)return;
  cam.setViewport(0,0,Math.max(1,this.scale.width),Math.max(1,this.scale.height));
  cam.setScroll(0,0).setOrigin(0,0).setZoom(Math.max(0.01,LK_RENDER_SCALE||1));
 }

 buildFullscreenControl(){
  this.fullscreenButton=this.add.circle(0,0,20,0x11100e,0.88).setStrokeStyle(2,0xc4a662,0.82).setDepth(40).setInteractive({useHandCursor:true});
  this.fullscreenIcon=this.add.graphics().setDepth(41);
  this.fullscreenButton.on('pointerdown',()=>this.toggleFullscreen());
  this._menuFullscreenChangeHandler=()=>{this.drawFullscreenControl();this.redrawCurrentView();};
  if(typeof document!=='undefined')document.addEventListener('fullscreenchange',this._menuFullscreenChangeHandler);
  this.drawFullscreenControl();
 }

 drawFullscreenControl(metrics=this.getMetrics()){
  if(!this.fullscreenButton || !this.fullscreenIcon)return;
  const radius=metrics.mobile?18:20;
  const x=metrics.w-(metrics.mobile?14:22)-radius;
  const y=(metrics.mobile?14:20)+radius;
  this.fullscreenButton.setPosition(x,y).setRadius(radius).setStrokeStyle(metrics.mobile?1.6:2,0xc4a662,0.82);
  const active=typeof document!=='undefined' && Boolean(document.fullscreenElement);
  const g=this.fullscreenIcon;
  g.clear();
  g.lineStyle(2.2,0xf1dfaa,0.95);
  const r=active?8:10, arm=active?7:6;
  if(!active){
   g.beginPath();
   g.moveTo(x-r,y-r+arm); g.lineTo(x-r,y-r); g.lineTo(x-r+arm,y-r);
   g.moveTo(x+r-arm,y-r); g.lineTo(x+r,y-r); g.lineTo(x+r,y-r+arm);
   g.moveTo(x-r,y+r-arm); g.lineTo(x-r,y+r); g.lineTo(x-r+arm,y+r);
   g.moveTo(x+r-arm,y+r); g.lineTo(x+r,y+r); g.lineTo(x+r,y+r-arm);
   g.strokePath();
  } else {
   g.beginPath();
   g.moveTo(x-r-arm,y-r); g.lineTo(x-r,y-r); g.lineTo(x-r,y-r-arm);
   g.moveTo(x+r+arm,y-r); g.lineTo(x+r,y-r); g.lineTo(x+r,y-r-arm);
   g.moveTo(x-r-arm,y+r); g.lineTo(x-r,y+r); g.lineTo(x-r,y+r+arm);
   g.moveTo(x+r+arm,y+r); g.lineTo(x+r,y+r); g.lineTo(x+r,y+r+arm);
   g.strokePath();
  }
 }

 async toggleFullscreen(){
  if(typeof document==='undefined') return;
  try{
   if(document.fullscreenElement){
    if(document.exitFullscreen) await document.exitFullscreen();
   } else {
    const target=document.documentElement;
    const request=target.requestFullscreen || target.webkitRequestFullscreen;
    if(request) await request.call(target);
   }
  }catch(error){
   console.warn('[GameMenuScene] Fullscreen toggle failed',error);
  }
  this.time.delayedCall(60,()=>this.redrawCurrentView());
 }

 redrawCurrentView(){
  if(!this.sys?.isActive?.())return;
  const view=this.currentView||{type:'menu'};
  if(view.type==='settings')return this.showSettings();
  if(view.type==='stats')return this.showStats();
  if(view.type==='slots')return this.showSlots(view.mode||'load');
  if(view.type==='confirm')return this.showConfirm(view.title,view.message,view.onConfirm);
  if(view.type==='exitConfirm')return this.confirmExit();
  return this.renderMenu();
 }

 clearContent(){
  for(const obj of this.content){try{obj?.destroy?.();}catch{}}
  this.content=[];
  this.statusText?.setText('');
 }

 remember(...objects){this.content.push(...objects.filter(Boolean));return objects[0];}

 getMetrics(){
  const {width:w,height:h}=lkLogicalSceneSize(this);
  const mobile=h<650||w<880;
  const compact=h<590;
  const short=h<470;
  const tiny=h<340;
  const sideMargin=mobile?Math.max(12,Math.min(28,w*0.04)):40;
  const verticalMargin=short?8:(mobile?12:27);
  const panelW=Math.max(260,Math.min(mobile?520:610,w-sideMargin*2));
  const panelH=Math.max(1,Math.min(h-verticalMargin*2,mobile?620:660));
  return {w,h,mobile,compact,short,tiny,cx:w/2,cy:h/2,panelW,panelH,x:w/2-panelW/2,y:h/2-panelH/2};
 }

 drawShell(metrics=this.getMetrics()){
  const {w,h,cx,cy,panelW,panelH,x,y,mobile,compact,short,tiny}=metrics;
  if(this.menuBackgroundArt){
   const bgScale=Math.max(w/Math.max(1,this.menuBackgroundArt.width),h/Math.max(1,this.menuBackgroundArt.height));
   this.menuBackgroundArt.setVisible(this.mode==='root').setPosition(cx,cy).setScale(bgScale);
  }
  if(this.menuBackgroundVignette){
   this.menuBackgroundVignette
    .setVisible(this.mode==='root')
    .setFillStyle(0x000000,this.mode==='root'?(tiny?0.22:0.18):0)
    .setPosition(0,0)
    .setSize(w,h)
    .setDisplaySize(w,h);
  }
  this.background
   .setPosition(0,0)
   .setFillStyle(0x080706,this.mode==='session'?0.82:(tiny?0.72:short?0.68:0.62))
   .setSize(w,h)
   .setDisplaySize(w,h);
  this.panelHaze?.clear();
  if(this.panelHaze && this.mode==='root'){
   const hazePad=tiny?6:short?9:14;
   const hazeRadius=tiny?12:16;
   // Wide, low-alpha layers soften the key art immediately behind the frame.
   this.panelHaze.fillStyle(0x050403,tiny?0.10:0.08);
   this.panelHaze.fillRoundedRect(x-hazePad*1.8,y-hazePad*1.8,panelW+hazePad*3.6,panelH+hazePad*3.6,hazeRadius+8);
   this.panelHaze.fillStyle(0x080604,tiny?0.16:0.13);
   this.panelHaze.fillRoundedRect(x-hazePad,y-hazePad,panelW+hazePad*2,panelH+hazePad*2,hazeRadius+5);
   this.panelHaze.fillStyle(0x0b0906,tiny?0.22:0.18);
   this.panelHaze.fillRoundedRect(x-3,y-3,panelW+6,panelH+6,hazeRadius+2);
  }
  this.drawFullscreenControl(metrics);
  this.panel.clear();
  this.panel.fillStyle(0x000000,0.28);this.panel.fillRoundedRect(x+7,y+8,panelW,panelH,14);
  this.panel.fillStyle(0x13110e,this.mode==='root'?0.94:0.97);this.panel.fillRoundedRect(x,y,panelW,panelH,14);
  this.panel.lineStyle(2,0x8e7547,0.96);this.panel.strokeRoundedRect(x,y,panelW,panelH,14);
  this.panel.lineStyle(1,0xd9c180,0.18);this.panel.strokeRoundedRect(x+5,y+5,panelW-10,panelH-10,10);
  this.title.setPosition(cx,y+(tiny?20:short?25:compact?30:mobile?42:48)).setFontSize(tiny?18:short?21:compact?24:mobile?28:34);
  this.subtitle.setPosition(cx,y+(tiny?38:short?45:compact?53:mobile?72:82)).setFontSize(tiny?7:short?8:compact?9:mobile?11:13);
  this.statusText
   .setPosition(cx,y+panelH-(tiny?8:short?11:compact?16:24))
   .setFontSize(tiny?7:short?8:compact?10:12)
   .setWordWrapWidth(Math.max(120,panelW-32),true);
 }

 addButton(label,y,action,{enabled=true,width=null,fontSize=null,danger=false,height=null,x=null,minimal=false}={}){
  const m=this.getMetrics();
  const cx=Number.isFinite(x)?x:m.cx;
  const w=width||Math.min(m.panelW-(m.short?34:70),m.mobile?400:440);
  const h=height||(m.tiny?25:m.short?30:m.compact?38:m.mobile?43:48);
  const fill=danger?0x38201d:0x22241d;
  const hover=danger?0x50302a:0x30362a;
  const stroke=danger?0xa76f5f:0x8d7b4c;
  const cardAlpha=minimal?0.001:(enabled?0.96:0.42);
  const card=this.add.rectangle(cx,y,w,h,fill,cardAlpha).setDepth(5);
  if(minimal) card.setStrokeStyle(0,stroke,0);
  else card.setStrokeStyle(1.7,stroke,enabled?0.9:0.35);
  const text=lkAddText(this,cx,y,label,{fontFamily:'Arial, sans-serif',fontSize:`${fontSize|| (m.tiny?9:m.short?10:m.compact?12:m.mobile?14:16)}px`,fontStyle:'bold',color:enabled?'#f2e7c8':'#756f61',align:'center'}).setOrigin(0.5).setDepth(6);
  if(enabled){
   card.setInteractive({useHandCursor:true});
   const over=()=>{
    if(minimal) text.setColor(danger?'#ffb7a6':'#f3dfa0');
    else card.setFillStyle(hover,1);
   };
   const out=()=>{
    if(minimal) text.setColor('#f2e7c8');
    else card.setFillStyle(fill,0.96);
   };
   const down=()=>action?.();
   card.on('pointerover',over);card.on('pointerout',out);card.on('pointerdown',down);
   text.setInteractive({useHandCursor:true});
   text.on('pointerover',over);text.on('pointerout',out);text.on('pointerdown',down);
  }
  this.remember(card,text);
  return {card,text};
 }

 renderMenu(){
  if(!this.sys?.isActive?.())return;
  this.currentView={type:'menu'};
  this.syncLayoutCamera();
  this.clearContent();
  const m=this.getMetrics();
  this.drawShell(m);
  const hasLive=Boolean(this.mode==='session'&&this.mainScene?.player);
  const newGameLocked=Boolean(this.registry.get('lastKnightNewGameLocked'));
  const labels=this.mode==='session'
   ?[
    ['ПРОДОЛЖИТЬ',()=>this.resumeGame(),true],
    ['НОВАЯ ИГРА',()=>{},false],
    ['СОХРАНИТЬ',()=>this.showSlots('save'),hasLive],
    ['ЗАГРУЗИТЬ',()=>this.showSlots('load'),true],
    ['СТАТИСТИКА ПЕРСОНАЖА',()=>this.showStats(),hasLive],
    ['НАСТРОЙКИ',()=>this.showSettings(),true],
    ['ВЫХОД В ГЛАВНОЕ МЕНЮ',()=>this.confirmExit(),true,true]
   ]
   :[
    ['НОВАЯ ИГРА',()=>this.startNewGame(),!newGameLocked],
    ['ПРОДОЛЖИТЬ',()=>{},false],
    ['СОХРАНИТЬ',()=>{},false],
    ['ЗАГРУЗИТЬ',()=>this.showSlots('load'),true],
    ['СТАТИСТИКА ПЕРСОНАЖА',()=>{},false],
    ['НАСТРОЙКИ',()=>this.showSettings(),true],
    ['ВЫХОД',()=>this.exitApplication(),true,true]
   ];
  // Fit all seven menu actions inside the current viewport instead of using
  // a fixed vertical step. This remains readable even with DevTools docked or
  // a very short browser window.
  const top=m.y+(m.tiny?48:m.short?58:m.compact?76:m.mobile?104:116);
  const footerReserve=this.mode==='root'?(m.tiny?18:m.short?24:m.compact?34:42):(m.tiny?10:m.short?16:m.compact?24:30);
  const bottom=m.y+m.panelH-footerReserve;
  const count=Math.max(1,labels.length);
  const gap=m.tiny?2:m.short?4:m.compact?6:10;
  const rawH=(bottom-top-gap*(count-1))/count;
  const buttonH=Math.max(m.tiny?20:24,Math.min(m.short?32:m.compact?40:m.mobile?45:48,rawH));
  const used=buttonH*count+gap*(count-1);
  const startY=top+Math.max(0,(bottom-top-used)/2)+buttonH/2;
  labels.forEach((entry,i)=>this.addButton(entry[0],startY+i*(buttonH+gap),entry[1],{
   enabled:entry[2],
   danger:Boolean(entry[3]),
   height:buttonH,
   fontSize:this.mode==='root'?(m.tiny?11:m.short?13:m.compact?15:m.mobile?18:20):(m.tiny?8:m.short?10:null),
   minimal:this.mode==='root'
  }));
  if(this.mode==='root'){
   this.statusText.setText(newGameLocked
    ?'«Новая игра» заблокирована текущей сессией. Чтобы начать заново, загрузите её и выберите «Выйти без сохранения».'
    :'«Продолжить» работает только во время активной игры. Для сохранений используйте «Загрузить».');
  }
 }

 stopGameplayScenes(){
  // HUD is paused while the session menu is open. Phaser's isActive() is false
  // for a paused scene, so checking only isActive left the old HUD alive when
  // returning to the root menu. Stop both scenes unconditionally.
  for(const key of ['HUDScene','main']){
   try{this.scene.stop(key);}catch{}
  }
 }

 startNewGame(){
  if(this.registry.get('lastKnightNewGameLocked')){
   this.statusText?.setText('Новая игра недоступна, пока текущая сессия не завершена через «Выйти без сохранения».');
   return false;
  }
  clearAutosave();
  clearCharacterStats();
  this.registry.set('lastKnightNewGameLocked',true);
  this.stopGameplayScenes();
  this.ensurePrologueAssetsThenStart();
  return true;
 }

 ensurePrologueAssetsThenStart(){
  const missing=PROLOGUE_PAGE_KEYS.filter(key=>!this.textures.exists(key));
  if(!missing.length){this.scene.start('CinematicScene');return;}
  let failed=false;
  this.statusText?.setText('Loading...');
  for(const key of missing){
   const spec=getAssetSpec(key);
   if(!spec?.url){failed=true;continue;}
   this.load.image(key,spec.url);
  }
  if(failed){
   this.registry.set('lastKnightNewGameLocked',false);
   this.statusText?.setText('Не удалось подготовить вступительный синематик.');
   this.renderMenu();
   return;
  }
  const onError=(file)=>{
   if(missing.includes(String(file?.key||'')))failed=true;
  };
  this.load.on('loaderror',onError);
  this.load.once('complete',()=>{
   this.load.off('loaderror',onError);
   if(failed || missing.some(key=>!this.textures.exists(key))){
    this.registry.set('lastKnightNewGameLocked',false);
    this.statusText?.setText('Не удалось загрузить вступительный синематик.');
    this.renderMenu();
    return;
   }
   this.scene.start('CinematicScene');
  });
  this.load.start();
 }

 confirmNewGame(){
  this.statusText?.setText('Новая игра недоступна во время действующей сессии. Используйте «Выйти без сохранения», чтобы полностью сбросить её.');
  return false;
 }

 loadSave(save,slot=null){
  if(!save)return;
  this.registry.set('lastKnightNewGameLocked',true);
  if(this.mainScene?.player)this.mainScene.setGameplayPaused?.('menu',false);
  this.stopGameplayScenes();
  const requestedSlot=Number(slot);
  const safeSlot=Number.isInteger(requestedSlot)&&requestedSlot>=1&&requestedSlot<=3?requestedSlot:null;
  this.scene.start('main',{saveState:save,saveSlot:safeSlot});
 }

 resumeGame(){
  if(this.mode!=='session')return;
  const main=this.mainScene||this.scene.get('main');
  main?.setGameplayPaused?.('menu',false);
  if(this.scene.isPaused('HUDScene'))this.scene.resume('HUDScene');
  this.scene.stop();
 }

 showSlots(mode='load'){
  this.currentView={type:'slots',mode};
  this.syncLayoutCamera();
  this.clearContent();
  const m=this.getMetrics();this.drawShell(m);
  const saving=mode==='save'||mode==='exit-save';
  const exitAfterSave=mode==='exit-save';
  const short=m.short||m.panelH<470;
  const tiny=m.tiny||m.panelH<320;
  const titleY=m.y+(tiny?48:short?58:m.compact?84:116);
  const title=lkAddText(this,m.cx,titleY,exitAfterSave?'СОХРАНИТЬ И ВЫЙТИ':saving?'СОХРАНЕНИЯ':'ЗАГРУЗКА',{fontFamily:'Arial, sans-serif',fontSize:`${tiny?13:short?16:m.compact?17:m.mobile?20:24}px`,fontStyle:'bold',color:'#f1df97'}).setOrigin(0.5).setDepth(6);
  this.remember(title);
  const slots=getManualSaves();
  const cardW=m.panelW-(tiny?24:short?34:70);
  const backY=m.y+m.panelH-(tiny?16:short?22:m.compact?42:62);
  const top=titleY+(tiny?22:short?30:48);
  const bottom=backY-(tiny?18:short?24:34);
  const gap=tiny?3:short?5:m.compact?8:14;
  const fitH=(bottom-top-gap*2)/3;
  const cardH=Math.max(tiny?38:44,Math.min(short?64:m.compact?76:m.mobile?100:112,fitH));
  const firstY=top+cardH/2;
  slots.forEach(({slot,save},i)=>{
   const y=firstY+i*(cardH+gap);
   const summary=saveSummary(save);
   let primary;
   if(summary){
    if(tiny) primary=`СЛОТ ${slot} · УР. ${summary.level} · ВОЛНА ${summary.globalWave}\n${summary.zoneName}`;
    else if(short) primary=`СЛОТ ${slot}   ·   УР. ${summary.level}   ·   ВОЛНА ${summary.globalWave}\n${summary.zoneName}   ·   HP ${Math.ceil(summary.hp)}/${Math.ceil(summary.maxHp)}`;
    else primary=`СЛОТ ${slot}   ·   УР. ${summary.level}   ·   ВОЛНА ${summary.globalWave}\n${summary.zoneName}   ·   HP ${Math.ceil(summary.hp)}/${Math.ceil(summary.maxHp)}\n${new Date(summary.savedAt).toLocaleString('ru-RU')}`;
   }else primary=`СЛОТ ${slot}\nПУСТО`;
   if(this.mode==='session'&&Number(this.mainScene?.currentSaveSlot)===slot)primary+=tiny?' · ТЕКУЩИЙ':`\nТЕКУЩИЙ СЛОТ`;
   const card=this.add.rectangle(m.cx,y,cardW,cardH,0x1b1a16,0.98).setStrokeStyle(1.5,0x75633e,0.9).setDepth(5).setInteractive({useHandCursor:true});
   const txt=lkAddText(this,m.cx-cardW/2+(tiny?8:short?11:18),y,primary,{fontFamily:'Arial, sans-serif',fontSize:`${tiny?7:short?9:m.compact?10:m.mobile?12:14}px`,fontStyle:'bold',color:'#eee3c6',lineSpacing:tiny?0:short?1:m.compact?2:5,align:'left'}).setOrigin(0,0.5).setDepth(6).setInteractive({useHandCursor:true});
   const action=()=>{
    if(saving){
     if(!this.mainScene?.player)return;
     const saved=this.mainScene.saveManualSlot?.(slot);
     if(!saved){this.statusText.setText(`Не удалось сохранить слот ${slot}.`);return;}
     if(exitAfterSave){this.finishExitToRoot({discardSession:false});return;}
     this.statusText.setText(`Слот ${slot} сохранён и стал текущим.`);
     this.time.delayedCall(120,()=>this.showSlots('save'));
    }else if(save)this.loadSave(save,slot);
   };
   card.on('pointerdown',action);txt.on('pointerdown',action);
   card.on('pointerover',()=>card.setFillStyle(0x29281f,1));card.on('pointerout',()=>card.setFillStyle(0x1b1a16,0.98));
   this.remember(card,txt);
   if(save){
    const dw=tiny?38:short?45:58,dh=tiny?20:short?24:34;
    const del=this.add.rectangle(m.cx+cardW/2-(tiny?24:short?29:42),y,dw,dh,0x3b201d,0.96).setStrokeStyle(1.2,0x9d6659,0.9).setDepth(7).setInteractive({useHandCursor:true});
    const delTxt=lkAddText(this,del.x,del.y,tiny?'×':'УДАЛ.',{fontFamily:'Arial, sans-serif',fontSize:`${tiny?10:short?7:10}px`,fontStyle:'bold',color:'#f0c4b8'}).setOrigin(0.5).setDepth(8).setInteractive({useHandCursor:true});
    const remove=()=>{
     deleteManualSave(slot);
     if(Number(this.mainScene?.currentSaveSlot)===slot)this.mainScene.currentSaveSlot=null;
     this.showSlots(mode);
     this.statusText.setText(`Слот ${slot} удалён${this.mode==='session'?' и отвязан от текущей сессии':''}.`);
    };
    del.on('pointerdown',remove);delTxt.on('pointerdown',remove);
    this.remember(del,delTxt);
   }
  });
  this.addButton('НАЗАД',backY,()=>exitAfterSave?this.confirmExit():this.renderMenu(),{width:tiny?130:short?160:190,height:tiny?24:short?30:null,fontSize:tiny?9:short?10:null});
 }

 showStats(){
  this.currentView={type:'stats'};
  this.syncLayoutCamera();
  this.clearContent();const m=this.getMetrics();this.drawShell(m);
  const stats=this.mainScene?.player?this.mainScene.buildCharacterStats?.():null;
  const short=m.short||m.panelH<470;
  const tiny=m.tiny||m.panelH<320;
  const headingY=m.y+(tiny?47:short?58:m.compact?84:116);
  const heading=lkAddText(this,m.cx,headingY,'СТАТИСТИКА ПЕРСОНАЖА',{fontFamily:'Arial, sans-serif',fontSize:`${tiny?12:short?15:m.compact?16:m.mobile?19:23}px`,fontStyle:'bold',color:'#f1df97'}).setOrigin(0.5).setDepth(6);
  this.remember(heading);
  const backY=m.y+m.panelH-(tiny?16:short?22:m.compact?42:62);
  if(!stats){
   const empty=lkAddText(this,m.cx,m.cy,'Нет активной или сохранённой сессии.',{fontFamily:'Arial, sans-serif',fontSize:`${tiny?9:short?11:15}px`,color:'#d8ccb0'}).setOrigin(0.5).setDepth(6);this.remember(empty);
  }else{
      if(short){
    const left=[
     `Уровень: ${stats.level}  XP: ${stats.xp}/${stats.xpRequired}`,
     `HP: ${Math.ceil(stats.hp)}/${Math.ceil(stats.maxHp)}`,
     `Мана: ${Number(stats.mana).toFixed(2)}/${stats.maxMana}`,
     `Регион: ${stats.regionName}`,
     `Волна: ${stats.globalWave}  Убийства: ${stats.kills}`,
     `Меч: ур. ${stats.sword?.level||1}`,
     `Урон: ${stats.sword?.effectiveDamage||0}`,
     `База урона: ${stats.sword?.baseDamage||0}`
    ];
    const right=[
     `Удар: ${stats.sword?.cooldown||0} мс`,
     `Радиус: ${stats.sword?.radius||0}`,
     `Путь: ${lkCombatStyleShortName(stats.combatStyle)}`,
     `Навыки: ${lkReadableUnlockList(stats.skillEvolutions,SKILL_EVOLUTION_DISPLAY_NAMES)}`,
     `Реликвии: ${lkReadableUnlockList(stats.relics,RELIC_DISPLAY_NAMES)}`,
     `Эссенции: ${lkReadableUnlockList(stats.essences,ESSENCE_DISPLAY_NAMES)}`,
     `HP ×${Number(stats.multipliers?.hp||1).toFixed(2)}`,
     `Откат ×${Number(stats.multipliers?.skillRecovery||1).toFixed(2)}`
    ];
    const bodyY=headingY+(tiny?19:26);
    const colGap=tiny?8:14;
    const colW=(m.panelW-(tiny?34:48)-colGap)/2;
    const font=tiny?6.8:8.5;
    const line=tiny?0:2;
    const leftText=lkAddText(this,m.cx-colGap/2-colW,bodyY,left.join('\n'),{fontFamily:'Arial, sans-serif',fontSize:`${font}px`,color:'#e8deca',lineSpacing:line,wordWrap:{width:colW,useAdvancedWrap:true},align:'left'}).setOrigin(0,0).setDepth(6);
    const rightText=lkAddText(this,m.cx+colGap/2,bodyY,right.join('\n'),{fontFamily:'Arial, sans-serif',fontSize:`${font}px`,color:'#e8deca',lineSpacing:line,wordWrap:{width:colW,useAdvancedWrap:true},align:'left'}).setOrigin(0,0).setDepth(6);
    this.remember(leftText,rightText);
   }else{
    const lines=[
     `Уровень: ${stats.level}    XP: ${stats.xp}/${stats.xpRequired}`,
     `HP: ${Math.ceil(stats.hp)} / ${Math.ceil(stats.maxHp)}    Мана: ${Number(stats.mana).toFixed(2)} / ${stats.maxMana}`,
     `Регион: ${stats.regionName}    Волна: ${stats.globalWave}`,
     `Убийства: ${stats.kills}`,
     '',
     `Меч: уровень ${stats.sword?.level||1}`,
     `Урон: ${stats.sword?.effectiveDamage||0}  (база ${stats.sword?.baseDamage||0})`,
     `Скорость удара: ${stats.sword?.cooldown||0} мс    Радиус: ${stats.sword?.radius||0}`,
     `Путь: ${stats.combatStyle?`Путь ${lkCombatStyleShortName(stats.combatStyle)}`:'не выбран'}`,
     '',
     `Эволюции навыков: ${lkReadableUnlockList(stats.skillEvolutions,SKILL_EVOLUTION_DISPLAY_NAMES)}`,
     `Реликвии: ${lkReadableUnlockList(stats.relics,RELIC_DISPLAY_NAMES)}`,
     `Эссенции: ${lkReadableUnlockList(stats.essences,ESSENCE_DISPLAY_NAMES)}`,
     '',
     `Множитель HP: ×${Number(stats.multipliers?.hp||1).toFixed(2)}`,
     `Реген маны: ${stats.manaRegenMs||0} мс    Восстановление навыков: ×${Number(stats.multipliers?.skillRecovery||1).toFixed(2)}`
    ];
    const body=lkAddText(this,m.cx,m.y+(m.compact?112:160),lines.join('\n'),{fontFamily:'Arial, sans-serif',fontSize:`${m.compact?10.5:m.mobile?12:14}px`,color:'#e8deca',lineSpacing:m.compact?2:m.mobile?5:7,wordWrap:{width:m.panelW-84,useAdvancedWrap:true},align:'left'}).setOrigin(0.5,0).setDepth(6);
    this.remember(body);
   }
  }
  this.addButton('НАЗАД',backY,()=>this.renderMenu(),{width:tiny?130:short?160:190,height:tiny?24:short?30:null,fontSize:tiny?9:short?10:null});
 }

 showSettings(){
  this.currentView={type:'settings'};
  this.syncLayoutCamera();
  this.clearContent();const m=this.getMetrics();this.drawShell(m);
  const settings=getGameSettings();
  const short=m.short||m.panelH<470;
  const tiny=m.tiny||m.panelH<320;
  const headingY=m.y+(tiny?50:short?62:m.compact?84:116);
  const heading=lkAddText(this,m.cx,headingY,'НАСТРОЙКИ',{fontFamily:'Arial, sans-serif',fontSize:`${tiny?14:short?16:m.compact?17:m.mobile?20:24}px`,fontStyle:'bold',color:'#f1df97'}).setOrigin(0.5).setDepth(6);this.remember(heading);
  const addVolume=(label,key,y)=>{
   const val=Math.round(settings[key]*100);
   const labelX=m.cx-(short?78:110);
   const minusX=m.cx-(short?34:55);
   const valueX=m.cx+(short?15:10);
   const plusX=m.cx+(short?64:75);
   const cap=lkAddText(this,labelX,y,label,{fontFamily:'Arial, sans-serif',fontSize:`${tiny?8:short?10:m.compact?11:m.mobile?13:15}px`,fontStyle:'bold',color:'#e6dbc2'}).setOrigin(1,0.5).setDepth(6);this.remember(cap);
   this.addButton('−',y,()=>this.changeVolume(key,-0.1),{x:minusX,width:short?38:46,height:tiny?24:short?30:null,fontSize:tiny?16:20});
   const value=lkAddText(this,valueX,y,`${val}%`,{fontFamily:'Arial, sans-serif',fontSize:`${tiny?10:short?12:15}px`,fontStyle:'bold',color:'#f3e5bd'}).setOrigin(0.5).setDepth(7);this.remember(value);
   this.addButton('+',y,()=>this.changeVolume(key,0.1),{x:plusX,width:short?38:46,height:tiny?24:short?30:null,fontSize:tiny?15:19});
  };

  if(short){
   const v1=m.y+(tiny?82:100);
   const v2=m.y+(tiny?113:138);
   addVolume('Музыка','musicVolume',v1);
   addVolume('Звуки','sfxVolume',v2);
   const graphY=m.y+(tiny?143:176);
   const graph=lkAddText(this,m.cx,graphY,'КАЧЕСТВО ГРАФИКИ',{fontFamily:'Arial, sans-serif',fontSize:`${tiny?8:10}px`,fontStyle:'bold',color:'#e6dbc2'}).setOrigin(0.5).setDepth(6);this.remember(graph);
   const options=[['МИНИМАЛЬНЫЕ','minimum'],['СРЕДНИЕ','medium'],['УЛЬТРА','ultra']];
   const gap=tiny?4:7;
   const usable=Math.max(180,m.panelW-(tiny?24:34));
   const bw=(usable-gap*2)/3;
   const rowY=m.y+(tiny?171:207);
   options.forEach((entry,i)=>{
    const x=m.cx+(i-1)*(bw+gap);
    this.addButton(`${settings.graphics===entry[1]?'◆ ':'◇ '}${entry[0]}`,rowY,()=>this.changeGraphics(entry[1]),{
     x,width:bw,height:tiny?25:31,fontSize:tiny?7:Math.max(8,Math.min(10,bw/12))
    });
   });
   const backY=m.y+m.panelH-(tiny?17:24);
   this.addButton('НАЗАД',backY,()=>this.renderMenu(),{width:tiny?130:160,height:tiny?24:30,fontSize:tiny?9:10});
   return;
  }

  addVolume('Музыка','musicVolume',m.y+(m.compact?136:190));
  addVolume('Звуки','sfxVolume',m.y+(m.compact?184:252));
  const graph=lkAddText(this,m.cx,m.y+(m.compact?228:323),'КАЧЕСТВО ГРАФИКИ',{fontFamily:'Arial, sans-serif',fontSize:`${m.compact?11:m.mobile?13:15}px`,fontStyle:'bold',color:'#e6dbc2'}).setOrigin(0.5).setDepth(6);this.remember(graph);
  const options=[['МИНИМАЛЬНЫЕ','minimum'],['СРЕДНИЕ','medium'],['УЛЬТРА','ultra']];
  const backY=m.y+m.panelH-(m.compact?36:52);
  const firstY=m.y+(m.compact?266:368);
  const available=Math.max(120,backY-firstY-(m.compact?34:44));
  const step=Math.min(m.compact?42:55,available/2);
  options.forEach((entry,i)=>{
   const y=firstY+i*step;
   this.addButton(`${settings.graphics===entry[1]?'◆ ':'◇ '}${entry[0]}`,y,()=>this.changeGraphics(entry[1]),{width:Math.min(340,m.panelW-100),height:m.compact?34:43});
  });
  this.addButton('НАЗАД',backY,()=>this.renderMenu(),{width:190,height:m.compact?34:43});
 }

 changeVolume(key,delta){
  const current=getGameSettings();
  setGameSettings({[key]:Phaser.Math.Clamp((current[key]||0)+delta,0,1)});
  this.mainScene?.applyAudioSettings?.();
  if(key==='sfxVolume'&&this.mainScene?.heartbeatSound){
   try{this.mainScene.heartbeatSound.setVolume(LOW_HEALTH_CONFIG.HEARTBEAT_VOLUME*getGameSettings().sfxVolume);}catch{}
  }
  this.showSettings();
 }

 changeGraphics(level){
  const scales={minimum:1,medium:1.5,ultra:1.75};
  setGameSettings({graphics:level});
  try{localStorage.setItem(LK_QUALITY_MODE_STORAGE_KEY,'manual');}catch{}
  this.mainScene?.devTools?.setAdaptiveQualityMode?.('manual');
  lkApplyRenderScale(game,scales[level]||1.5,{remember:true});
  this.syncLayoutCamera();
  this.showSettings();
  this.time.delayedCall(80,()=>{this.syncLayoutCamera();this.redrawCurrentView();});
 }

 showConfirm(title,message,onConfirm){
  this.currentView={type:'confirm',title,message,onConfirm};
  this.syncLayoutCamera();
  this.clearContent();const m=this.getMetrics();this.drawShell(m);
  const short=m.short||m.panelH<470,tiny=m.tiny||m.panelH<320;
  const titleY=m.y+(tiny?58:short?76:m.compact?118:155);
  const bodyY=m.y+(tiny?96:short?122:m.compact?176:220);
  const t=lkAddText(this,m.cx,titleY,title,{fontFamily:'Arial, sans-serif',fontSize:`${tiny?13:short?16:m.compact?17:m.mobile?20:25}px`,fontStyle:'bold',color:'#f1df97',align:'center',wordWrap:{width:m.panelW-(tiny?30:70),useAdvancedWrap:true}}).setOrigin(0.5).setDepth(6);
  const body=lkAddText(this,m.cx,bodyY,message,{fontFamily:'Arial, sans-serif',fontSize:`${tiny?8:short?10:m.compact?11:m.mobile?13:15}px`,color:'#ded2b8',align:'center',wordWrap:{width:m.panelW-(tiny?34:90),useAdvancedWrap:true}}).setOrigin(0.5).setDepth(6);this.remember(t,body);
  if(short){
   const bottom=m.y+m.panelH-(tiny?18:26);
   const gap=tiny?5:8, bh=tiny?25:31;
   const cancelY=bottom-bh/2;
   const confirmY=cancelY-bh-gap;
   this.addButton('ПОДТВЕРДИТЬ',confirmY,onConfirm,{width:tiny?180:240,height:bh,fontSize:tiny?8:10,danger:true});
   this.addButton('ОТМЕНА',cancelY,()=>this.renderMenu(),{width:tiny?130:180,height:bh,fontSize:tiny?8:10});
   return;
  }
  this.addButton('ПОДТВЕРДИТЬ',m.y+(m.compact?270:330),onConfirm,{width:300,danger:true});
  this.addButton('ОТМЕНА',m.y+(m.compact?320:392),()=>this.renderMenu(),{width:220});
 }

 confirmExit(){
  this.currentView={type:'exitConfirm'};
  this.syncLayoutCamera();
  this.clearContent();const m=this.getMetrics();this.drawShell(m);
  const short=m.short||m.panelH<470,tiny=m.tiny||m.panelH<320;
  const titleY=m.y+(tiny?55:short?72:m.compact?112:150);
  const bodyY=m.y+(tiny?91:short?116:m.compact?168:210);
  const t=lkAddText(this,m.cx,titleY,'ВЫЙТИ В ГЛАВНОЕ МЕНЮ?',{fontFamily:'Arial, sans-serif',fontSize:`${tiny?12:short?15:m.compact?17:m.mobile?20:25}px`,fontStyle:'bold',color:'#f1df97',align:'center'}).setOrigin(0.5).setDepth(6);
  const currentSlot=Number(this.mainScene?.currentSaveSlot);
  const hasCurrentSlot=Number.isInteger(currentSlot)&&currentSlot>=1&&currentSlot<=3;
  const exitMessage=hasCurrentSlot
   ?`Сохранить текущее состояние в слот ${currentSlot} перед выходом?`
   :'У этой сессии ещё нет слота. «Сохранить и выйти» откроет меню выбора сохранения.';
  const body=lkAddText(this,m.cx,bodyY,exitMessage,{fontFamily:'Arial, sans-serif',fontSize:`${tiny?8:short?10:m.compact?11:m.mobile?13:15}px`,color:'#ded2b8',align:'center',wordWrap:{width:m.panelW-(tiny?34:90),useAdvancedWrap:true}}).setOrigin(0.5).setDepth(6);this.remember(t,body);
  if(short){
   const bottom=m.y+m.panelH-(tiny?16:22);
   const bh=tiny?23:29,gap=tiny?4:6;
   const cancelY=bottom-bh/2;
   const noY=cancelY-bh-gap;
   const yesY=noY-bh-gap;
   this.addButton('СОХРАНИТЬ И ВЫЙТИ',yesY,()=>this.exitWithSave(),{width:tiny?210:280,height:bh,fontSize:tiny?7:9});
   this.addButton('ВЫЙТИ БЕЗ СОХРАНЕНИЯ',noY,()=>this.exitWithoutSave(),{width:tiny?210:280,height:bh,fontSize:tiny?7:9,danger:true});
   this.addButton('ОТМЕНА',cancelY,()=>this.renderMenu(),{width:tiny?130:180,height:bh,fontSize:tiny?8:9});
   return;
  }
  this.addButton('СОХРАНИТЬ И ВЫЙТИ',m.y+(m.compact?250:300),()=>this.exitWithSave(),{width:330});
  this.addButton('ВЫЙТИ БЕЗ СОХРАНЕНИЯ',m.y+(m.compact?300:360),()=>this.exitWithoutSave(),{width:330,danger:true});
  this.addButton('ОТМЕНА',m.y+(m.compact?350:420),()=>this.renderMenu(),{width:220});
 }

 exitWithSave(){
  const main=this.mainScene||this.scene.get('main');
  if(!main?.player){this.statusText.setText('Нет активной сессии для сохранения.');return;}
  const slot=Number(main.currentSaveSlot);
  if(Number.isInteger(slot)&&slot>=1&&slot<=3){
   if(!main.saveManualSlot?.(slot)){
    this.statusText.setText(`Не удалось сохранить текущую сессию в слот ${slot}.`);
    return;
   }
   this.finishExitToRoot({discardSession:false});
   return;
  }
  this.showSlots('exit-save');
  this.statusText.setText('У этой сессии ещё нет текущего слота. Выберите слот для сохранения.');
 }

 isAssetEntryLoaded(entry){
  if(!entry)return false;
  if(entry.type==='image')return Boolean(this.textures?.exists?.(entry.key));
  if(entry.type==='audio')return Boolean(this.cache?.audio?.exists?.(entry.key));
  if(entry.type==='json')return Boolean(this.cache?.json?.exists?.(entry.key));
  return false;
 }

 queueAssetEntry(entry){
  if(!entry?.key || !entry?.url)return false;
  if(entry.type==='image')this.load.image(entry.key,entry.url);
  else if(entry.type==='audio')this.load.audio(entry.key,entry.url);
  else if(entry.type==='json')this.load.json(entry.key,entry.url);
  else return false;
  return true;
 }

 ensureFirstZoneAssetsLoaded(onComplete){
  const entries=getAssetsForCategories([ASSET_CATEGORY.REGION_ASH]);
  const missing=entries.filter(entry=>!this.isAssetEntryLoaded(entry));
  if(!missing.length){onComplete?.(true);return true;}
  if(typeof this.load.isLoading==='function' && this.load.isLoading())return false;

  const requiredKeys=new Set(missing.filter(entry=>entry.requirement===ASSET_REQUIREMENT.REQUIRED).map(entry=>entry.key));
  const failedRequired=new Set();
  const missingKeys=new Set(missing.map(entry=>entry.key));
  this.statusText?.setText(`Loading · восстановление первой зоны 0%`);
  for(const entry of missing)this.queueAssetEntry(entry);

  const onProgress=(value)=>this.statusText?.setText(`Loading · восстановление первой зоны ${Math.round(value*100)}%`);
  const onError=(file)=>{
   const key=String(file?.key||'');
   if(requiredKeys.has(key))failedRequired.add(key);
  };
  this.load.on('progress',onProgress);
  this.load.on('loaderror',onError);
  this.load.once('complete',()=>{
   this.load.off('progress',onProgress);
   this.load.off('loaderror',onError);
   for(const key of requiredKeys){
    const entry=missing.find(item=>item.key===key);
    if(entry && !this.isAssetEntryLoaded(entry))failedRequired.add(key);
   }
   onComplete?.(failedRequired.size===0,{failedRequired:[...failedRequired],requested:[...missingKeys]});
  });
  this.load.start();
  return true;
 }

 exitWithoutSave(){
  if(this.discardResetInProgress)return;
  const main=this.mainScene||this.scene.get('main');
  if(!main?.player){
   clearAutosave();
   clearCharacterStats();
   this.registry.set('lastKnightNewGameLocked',false);
   this.finishExitToRoot({discardSession:true});
   return;
  }

  // Explicit discard: the live session stays paused while the Ash Fields asset
  // package is restored. Only after the required files are back in Phaser caches
  // do we destroy the old scene and unlock New Game.
  this.discardResetInProgress=true;
  for(const obj of this.content||[]){try{obj?.disableInteractive?.();}catch{}}
  this.statusText?.setText('Loading · восстановление первой зоны 0%');
  const started=this.ensureFirstZoneAssetsLoaded((ok,details={})=>{
   this.discardResetInProgress=false;
   if(!ok){
    this.confirmExit();
    this.statusText?.setText(`Не удалось восстановить ресурсы первой зоны${details.failedRequired?.length?`: ${details.failedRequired.join(', ')}`:''}. Сессия не сброшена.`);
    return;
   }
   clearAutosave();
   clearCharacterStats();
   this.registry.set('lastKnightNewGameLocked',false);
   this.finishExitToRoot({discardSession:true});
  });
  if(!started){
   this.discardResetInProgress=false;
   this.confirmExit();
   this.statusText?.setText('Загрузчик сейчас занят. Попробуйте «Выйти без сохранения» ещё раз через секунду.');
  }
 }

 finishExitToRoot({discardSession=false}={}){
  // Legacy autosaves are deliberately not part of the current save model.
  clearAutosave();
  clearCharacterStats();
  if(discardSession)this.registry.set('lastKnightNewGameLocked',false);
  else this.registry.set('lastKnightNewGameLocked',true);
  // We are destroying the session, not resuming it: keep SFX paused until SHUTDOWN
  // stops them so no one-frame audio burst leaks into the root menu.
  this.stopGameplayScenes();
  this.mode='root';this.mainScene=null;this.currentView={type:'menu'};
  this.syncLayoutCamera();
  this.renderMenu();
  this.time.delayedCall(80,()=>{this.syncLayoutCamera();this.redrawCurrentView();});
 }

 exitApplication(){
  try{window.close();}catch{}
  this.statusText.setText('Браузер не разрешает игре закрывать эту вкладку. Её можно закрыть обычной кнопкой браузера.');
 }
}

class MainScene extends Phaser.Scene {
 init(data={}){
  this.registry.set('lastKnightNewGameLocked',true);
  this.pendingSaveState=data?.saveState||null;
  const requestedSlot=Number(data?.saveSlot);
  this.currentSaveSlot=Number.isInteger(requestedSlot)&&requestedSlot>=1&&requestedSlot<=3?requestedSlot:null;
  const saveZone=Number(this.pendingSaveState?.world?.zoneIndex);
  this.restartZoneIndex=Number.isInteger(saveZone)&&saveZone>=0&&saveZone<WORLD_DESIGN.ZONES.length?saveZone:restartZoneIndex(data,WORLD_DESIGN.ZONES.length);
  this.zoneEntryCheckpoint=this.pendingSaveState?null:(this.restartZoneIndex>0?data.zoneRestart:null);
 }

 preload(){}

 createSpriteAnimations(){
  for(const dir of HERO_SOCKET_DIRS){
   const walkKey=`hero_socket_walk_${dir}`;
   const idleKey=`hero_socket_idle_${dir}`;
   if(!this.anims.exists(walkKey)){
    this.anims.create({
     key:walkKey,
     frames:[
      {key:`hero_socket_walk_${dir}_01`},
      {key:`hero_socket_walk_${dir}_02`}
     ],
     frameRate:7,
     repeat:-1
    });
   }
   if(!this.anims.exists(idleKey)){
    this.anims.create({
     key:idleKey,
     frames:[{key:`hero_socket_walk_${dir}_01`}],
     frameRate:1,
     repeat:-1
    });
   }
  }
  if(!this.anims.exists('hero_socket_spin')){
   this.anims.create({
    key:'hero_socket_spin',
    frames:Array.from(
     {length:HERO_SOCKET_SPIN_FRAME_COUNT},
     (_,i)=>({key:`hero_socket_spin_${String(i+1).padStart(2,'0')}`})
    ),
    frameRate:HERO_SOCKET_SPIN_FRAME_RATE,
    repeat:0
   });
  }
  if(!this.anims.exists('hero_death')){
   this.anims.create({
    key:'hero_death',
    frames:Array.from(
     {length:HERO_DEATH_FRAME_COUNT},
     (_,i)=>({key:`hero_death_${String(i+1).padStart(2,'0')}`})
    ),
    duration:HERO_DEATH_ANIMATION_MS,
    repeat:0
   });
  }

  const dirs=['down','left','right','up'];

  for(const dir of dirs){
   const defs=[
    [`skeleton_${dir}_idle`,4,6,-1],
    [`skeleton_${dir}_walk`,6,10,-1],
    [`skeleton_${dir}_attack`,6,12,0],
    [`mage_${dir}_idle`,3,6,-1],
    [`mage_${dir}_walk`,6,10,-1],
    [`mage_${dir}_cast`,6,12,0],
    [`shield_${dir}_idle`,4,6,-1],
    [`shield_${dir}_walk`,6,10,-1],
    [`shield_${dir}_attack`,6,12,0]
   ];

   for(const [key,count,frameRate,repeat] of defs){
    if(this.anims.exists(key)) continue;

    this.anims.create({
     key,
     frames:Array.from(
      {length:count},
      (_,i)=>({key:`${key}_${String(i).padStart(2,'0')}`})
     ),
     frameRate,
     repeat
    });
   }
  }

  const brokenSaintDirs=[
   'down','down_left','left','up_left',
   'up','up_right','right','down_right'
  ];
  for(const dir of brokenSaintDirs){
   const defs=[
    [`broken_saint_${dir}_idle`,1,1,-1,'walk'],
    [`broken_saint_${dir}_walk`,4,8,-1,'walk'],
    [`broken_saint_${dir}_attack`,3,11,0,'attack']
   ];
   for(const [key,count,frameRate,repeat,sourceAction] of defs){
    if(this.anims.exists(key)) continue;
    this.anims.create({
     key,
     frames:Array.from(
      {length:count},
      (_,i)=>({key:`broken_saint_${dir}_${sourceAction}_${String(i).padStart(2,'0')}`})
     ),
     frameRate,
     repeat
    });
   }
  }

  // Ash Fields wounded knights: 3-frame heavy breathing. The middle frame is
  // played twice so the chest expansion/contraction reads clearly at gameplay scale.
  for(let knight=1;knight<=3;knight++){
   const index=String(knight).padStart(2,'0');
   const key=`ash_wounded_knight_${index}_breathe`;
   if(this.anims.exists(key)) continue;
   this.anims.create({
    key,
    frames:[
     {key:`ash_wounded_knight_${index}_00`,duration:300},
     {key:`ash_wounded_knight_${index}_01`,duration:180},
     {key:`ash_wounded_knight_${index}_02`,duration:300},
     {key:`ash_wounded_knight_${index}_01`,duration:180}
    ],
    frameRate:4,
    repeat:-1
   });
  }

  if(!this.anims.exists('ring_sweep')){
   this.anims.create({
    key:'ring_sweep',
    frames:Array.from(
     {length:8},
     (_,i)=>({key:`ring_sweep_${String(i).padStart(2,'0')}`})
    ),
    // Slightly longer visual sword-ring trail: ~0.47 s instead of 0.40 s.
    // Gameplay hit timing, damage and melee cooldown are unchanged.
    frameRate:17,
    repeat:0
   });
  }

  if(!this.anims.exists('hit_burst')){
   this.anims.create({
    key:'hit_burst',
    frames:Array.from(
     {length:6},
     (_,i)=>({key:`hit_burst_${String(i).padStart(2,'0')}`})
    ),
    frameRate:26,
    repeat:0
   });
  }

  if(!this.anims.exists('mage_projectile_fly')){
   this.anims.create({
    key:'mage_projectile_fly',
    frames:[
     {key:'mage_projectile_00'},
     {key:'mage_projectile_01'}
    ],
    frameRate:10,
    repeat:-1
   });
  }

  const brokenSaintAnims=[
   ['broken_saint_holy_mark',4,8,-1],
   ['broken_saint_holy_impact',4,16,0],
   ['broken_saint_holy_beam_idle',4,6,-1],
   ['broken_saint_reflect_shield',4,9,-1],
   ['broken_saint_reflect_spark',2,18,0]
  ];
  for(const [key,count,frameRate,repeat] of brokenSaintAnims){
   if(this.anims.exists(key)) continue;
   const frames = key==='broken_saint_holy_beam_idle'
    ? [
      {key:'broken_saint_holy_beam_02'},
      {key:'broken_saint_holy_beam_01'},
      {key:'broken_saint_holy_beam_02'},
      {key:'broken_saint_holy_beam_01'}
     ]
    : Array.from(
      {length:count},
      (_,i)=>({key:`${key}_${String(i).padStart(2,'0')}`})
     );
   this.anims.create({
    key,
    frames,
    frameRate,
    repeat
   });
  }

  if(!this.anims.exists(ASH_SWORD_PULSE_ANIM_KEY)){
   this.prepareAshSwordTextures();
   this.anims.create({
    key:ASH_SWORD_PULSE_ANIM_KEY,
    frames:[
     {key:'ash_sword_pulse_01_cutout'},
     {key:'ash_sword_pulse_02_cutout'},
     {key:'ash_sword_pulse_03_cutout'},
     {key:'ash_sword_pulse_02_cutout'},
     {key:'ash_sword_pulse_01_cutout'}
    ],
    duration:ASH_SWORD_PULSE_ACTIVE_MS,
   repeat:0
   });
  }

  // Road of the Black Banners: slow ambient fire cycles. The four image frames
  // are deliberately restrained; they add readable warmth without competing
  // with enemy, projectile or interaction effects.
  for(const prop of ['campfire','torch','lantern','embers','wagon']){
   const key=`zone2_${prop}_burn`;
   if(this.anims.exists(key)) continue;
   this.anims.create({
    key,
    frames:Array.from({length:4},(_,i)=>({key:`zone2_${prop}_${String(i).padStart(2,'0')}`})),
    frameRate:3,
    repeat:-1
   });
  }

  // Crows: calm sitting motion, brisk takeoff, then steady methodical wingbeats.
  for(let variant=1;variant<=3;variant++){
   const key=`crown_idle_${variant}`;
   if(this.anims.exists(key)) continue;
   this.anims.create({key,frames:[1,2,3].map(i=>({key:`crown_${variant}_${i}`})),frameRate:2.15,repeat:-1});
  }
  if(!this.anims.exists('crown_takeoff')){
   this.anims.create({key:'crown_takeoff',frames:[1,2,3].map(i=>({key:`crown_takeoff_${i}`})),duration:CROW_TAKEOFF_MS,repeat:0});
  }
  if(!this.anims.exists('crown_fly')){
   this.anims.create({key:'crown_fly',frames:[1,2,3,4].map(i=>({key:`crown_fly_${i}`})),frameRate:5.4,repeat:-1});
  }

 }

 constructor(){
  super('main');
  this.enemies=[];
  this.orbs=[];
  this.kills=0;
  this.xp=0;
  this.level=1;
  this.wave=1;
  this.spawned=0;
  this.waveTarget=10;
  this.lastSpawn=0;
  this.mageSpawned=0;
  this.skeletonSpawned=0;
  this.shieldSpawned=0;
  this.championSpawned=0;
  this.projectiles=[];
  this.hearts=[];
  this.gameOver=false;
  this.gameOverUiReady=false;
  this.deathSequenceActive=false;
  this.deathSword=null;
  this.deathFlipX=false;
  this.gameplayPauseReasons=new Set();
  this.gameplayPaused=false;
  this.gameplayAudioPaused=false;
  this.levelChoiceOpen=false;
  this.levelChoiceObjects=[];
  this.currentLevelChoices=[];
  this.levelChoiceKind='normal';
  this.pendingCombatStyleWave=0;
  this.combatStyle=null;
  this.combatStyleChargeReady=false;
  this.combatStyleChoiceShown=false;
  this.weaponLevels={sword:1};
  this.waveProfile=null;
  this.waveSpawnInterval=1050;
  this.waveIntermission=false;
  this.nextWaveAt=0;
  this.waveBannerObjects=[];
  this.lastPlayerHitAt=-9999;
  this.playerInvulnerableUntil=0;
  this.heartPityKills=0;
  this.lowHealthState='normal';
  this.lowHealthRatio=1;
  this.heartbeatTimer=null;
  this.heartbeatSound=null;
  this.backgroundMusic=null;
  this.brokenSaintMusic=null;
  this.brokenSaintHolyWarningSound=null;
  this.lastSkeletonAttackSfxAt=-9999;
  this.lastMageCastSfxAt=-9999;
  this.heartbeatState=null;

  this.activeChampion=null;
  this.championEventActive=false;
  this.championRewardOpen=false;
  this.championRewardObjects=[];
  this.championHazards=[];
  this.relicZones=[];
  this.championRelics=new Set();
  this.championSkillEvolutions=new Set();
  this.championEssences=new Set();
  this.currentChampionRewardChoices=[];
  this.currentChampionRewardFlow=null;
  this.currentChampionRewardStepIndex=0;
  // Every champion fight receives the same two-attempt checkpoint. It is
  // created only when combat is actually released (after any story dialogue).
  this.championRetryCheckpoint=null;
  this.brokenSaintDefeatSequenceActive=false;
  this.brokenSaintDefeatFx=[];
  this.bsPenitenceCharges=0;
  this.liftCommitUntil=0;
  this.liftSlowUntil=0;
  this.liftPostMarkWindowStartsAt=0;
  this.liftPostMarkWindowUntil=0;
  this.liftPostMarkConsumed=false;
  this.spinCommitUntil=0;
  this.spinSaintsNailConsumed=false;
  this.playerSpeedBoostUntil=0;
  this.playerSpeedBoostFactor=1;
  this.ashRosaryDiscount=null;
  this.championHpMultiplier=1;
  this.championManaRegenMultiplier=1;
  this.skillRecoveryMultiplier=1;
  this.nextSoulSkullAt=0;
  this.nextCursedGroundAt=0;
  this.killStreakBonus=0;
  this.lastShieldRelicBlockAt=-999999;
  this.fallenBlessingUsed=false;

  this.playerSlowUntil=0;
  this.playerSlowFactor=1;
  this.playerForcedUntil=0;
  this.playerForcedVX=0;
  this.playerForcedVY=0;
  this.heroHitImpactTimer=null;
  this.heroHitImpactSlowTimer=null;
  this.heroHitImpactZoomTimer=null;

  this.mobileMoveX=0;
  this.mobileMoveY=0;
  this.mobileMovePointerId=null;
  this.mobileControls=[];
  this.isTouchDevice=false;

  this.currentWorldZoneIndex=0;
  this.progressionBalanceZoneIndex=0;
  this.devRegionPopulationOverride=null;
  this.unlockedWorldGates=new Set();
  this.worldGateObjects=new Map();
  this.pendingWorldAdvance=null;
  this.awaitingWorldAdvance=false;
  this.worldAdvanceTargetZone=null;
  this.zoneBannerCooldownUntil=0;

  // Stage 1.1 forward-only streaming world.
  this.loadedWorldZones=new Map();
  this.loadedWorldPreviews=new Map();
  this.closedWorldGates=new Set();
  this.backtrackBlockers=[];
  this.lastStreamingZoneIndex=0;
  this.releasedWorldTextureZones=new Set();

  this.emptyScreenRushActive=false;
  this.crows=[];
  this.crowFlocks=new Map();
  this.swordOrbitCrowFlockId=null;
  this.swordOrbitCrowWingsSound=null;
  this.crowFlightLoopSound=null;
  this.crowFlightLoopCount=0;
  this.zone2FirstWagonTarget=null;
  this.zone2ArrivalSequence=null;

  // DEV Scene Tuner state. These collections are populated only by environment art.
  this.devEnvironmentObjects=[];
  this.devEnvironmentShadows=[];
  this.devEnvironmentColliders=[];
  this.devTools=null;
  this.storyDirector=null;
  this.storyEnemyAnomalies=null;
  this.storyWaveGateWasActive=false;
  this.postWaveChampionKind=null;
  this.ashAltarObjectiveMarker=null;
  this.ashAltarStoryTarget=null;
  this.ashChampionIntroState=null;
  this.ashSwordLandmark=null;
  this.ashSwordPulseOverlay=null;
  this.ashSwordPreludeState=null;
  this.ashSwordPulseCompleted=false;
  this.ashSwordNextPulseAt=0;
  this.ashSwordPreludeQueuedAt=0;
  this.brokenSaintSwordEpilogue=null;
  this.devFlags={
   autoSpawnsDisabled:false,
   enemyAiFrozen:false,
   enemyMovementFrozen:false,
   enemyAttacksDisabled:false,
   enemyAiMode:'normal',
   environmentAiMode:'normal',
   championFrozen:false,
   championMovementFrozen:false,
   championAttacksDisabled:false,
   championSkillsDisabled:false,
   godMode:false,
   oneHitKill:false,
   infiniteMana:false,
   noCollision:false
  };

  // Build 1.2: functional mana + three combat skills.
  this.maxMana=3;
  this.mana=3;
  this.manaRegenMs=BALANCE.MANA_REGEN_MS;
  this.nextManaRegenAt=0;
  this.skillLockUntil=0;
 }

 create(){
  this.enemies=[];
  this.orbs=[];
  this.projectiles=[];
  this.hearts=[];
  this.kills=0;
  this.xp=0;
  this.level=1;
  this.wave=1;
  this.spawned=0;
  this.waveTarget=10;
  this.lastSpawn=0;
  this.mageSpawned=0;
  this.skeletonSpawned=0;
  this.shieldSpawned=0;
  this.championSpawned=0;
  this.gameOver=false;
  this.gameOverUiReady=false;
  this.deathSequenceActive=false;
  this.deathSword=null;
  this.deathFlipX=false;
  this.gameplayPauseReasons=new Set();
  this.gameplayPaused=false;
  this.gameplayAudioPaused=false;
  this.levelChoiceOpen=false;
  this.levelChoiceObjects=[];
  this.currentLevelChoices=[];
  this.weaponLevels={sword:1};
  this.waveProfile=null;
  this.waveSpawnInterval=1050;
  this.waveIntermission=false;
  this.nextWaveAt=0;
  this.waveBannerObjects=[];
  this.lastPlayerHitAt=-9999;
  this.playerInvulnerableUntil=0;
  this.heartPityKills=0;
  this.lowHealthState='normal';
  this.lowHealthRatio=1;
  this.heartbeatTimer=null;
  this.heartbeatSound=null;
  this.lastSkeletonAttackSfxAt=-9999;
  this.lastMageCastSfxAt=-9999;
  this.heartbeatState=null;

  this.activeChampion=null;
  this.championEventActive=false;
  this.championRewardOpen=false;
  this.championRewardObjects=[];
  this.championHazards=[];
  this.relicZones=[];
  this.championRelics=new Set();
  this.championSkillEvolutions=new Set();
  this.championEssences=new Set();
  this.currentChampionRewardChoices=[];
  this.currentChampionRewardFlow=null;
  this.currentChampionRewardStepIndex=0;
  this.championRetryCheckpoint=null;
  this.brokenSaintDefeatSequenceActive=false;
  this.brokenSaintDefeatFx=[];
  this.bsPenitenceCharges=0;
  this.liftCommitUntil=0;
  this.liftSlowUntil=0;
  this.liftPostMarkWindowStartsAt=0;
  this.liftPostMarkWindowUntil=0;
  this.liftPostMarkConsumed=false;
  this.spinCommitUntil=0;
  this.spinSaintsNailConsumed=false;
  this.playerSpeedBoostUntil=0;
  this.playerSpeedBoostFactor=1;
  this.ashRosaryDiscount=null;
  this.championHpMultiplier=1;
  this.championManaRegenMultiplier=1;
  this.skillRecoveryMultiplier=1;
  this.nextSoulSkullAt=0;
  this.nextCursedGroundAt=0;
  this.killStreakBonus=0;
  this.lastShieldRelicBlockAt=-999999;
  this.fallenBlessingUsed=false;

  this.playerSlowUntil=0;
  this.playerSlowFactor=1;
  this.playerForcedUntil=0;
  this.playerForcedVX=0;
  this.playerForcedVY=0;
  this.heroHitImpactTimer=null;
  this.heroHitImpactSlowTimer=null;
  this.heroHitImpactZoomTimer=null;

  this.mobileMoveX=0;
  this.mobileMoveY=0;
  this.mobileMovePointerId=null;
  this.mobileControls=[];
  this.isTouchDevice=Boolean(
   this.sys.game.device.input.touch ||
   (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
  );

  this.currentWorldZoneIndex=this.restartZoneIndex||0;
  this.progressionBalanceZoneIndex=this.currentWorldZoneIndex;
  // A restarted region never reveals the retired biome, even on its first frame.
  this.worldCameraMinX=this.getZoneCameraMinX(this.currentWorldZoneIndex);
  this.devRegionPopulationOverride=null;
  this.unlockedWorldGates=new Set();
  this.worldGateObjects=new Map();
  this.pendingWorldAdvance=null;
  this.awaitingWorldAdvance=false;
  this.worldAdvanceTargetZone=null;
  this.zoneBannerCooldownUntil=0;

  this.loadedWorldZones=new Map();
  this.loadedWorldPreviews=new Map();
  this.closedWorldGates=new Set();
  this.backtrackBlockers=[];
  this.lastStreamingZoneIndex=this.currentWorldZoneIndex;

  this.emptyScreenRushActive=false;
  this.crows=[];
  this.crowFlocks=new Map();
  this.swordOrbitCrowFlockId=null;
  this.swordOrbitCrowWingsSound=null;
  this.crowFlightLoopSound=null;
  this.crowFlightLoopCount=0;
  this.zone2FirstWagonTarget=null;
  this.zone2ArrivalSequence=null;

  this.devEnvironmentObjects=[];
  this.devEnvironmentShadows=[];
  this.devEnvironmentColliders=[];
  this.storyEnemyAnomalies=null;
  this.storyWaveGateWasActive=false;
  this.postWaveChampionKind=null;
  this.ashAltarObjectiveMarker=null;
  this.ashAltarStoryTarget=null;
  this.ashChampionIntroState=null;
  this.ashSwordLandmark=null;
  this.ashSwordPulseOverlay=null;
  this.ashSwordPreludeState=null;
  this.ashSwordPulseCompleted=false;
  this.ashSwordNextPulseAt=0;
  this.ashSwordPreludeQueuedAt=0;
  this.brokenSaintSwordEpilogue=null;
  this.devFlags={
   autoSpawnsDisabled:false,
   enemyAiFrozen:false,
   enemyMovementFrozen:false,
   enemyAttacksDisabled:false,
   enemyAiMode:'normal',
   environmentAiMode:'normal',
   championFrozen:false,
   championMovementFrozen:false,
   championAttacksDisabled:false,
   championSkillsDisabled:false,
   godMode:false,
   oneHitKill:false,
   infiniteMana:false,
   noCollision:false
  };

  this.maxMana=3;
  this.mana=3;
  this.manaRegenMs=BALANCE.MANA_REGEN_MS;
  this.nextManaRegenAt=0;
  this.skillLockUntil=0;

  this.cameras.main.setBackgroundColor('#16120f');
  this.createSpriteAnimations();

  this.physics.world.setBounds(0,0,STAGE0.WORLD_WIDTH,STAGE0.WORLD_HEIGHT);

  // World Navigation v2: a coarse navigation grid sits above static world
  // colliders. It is rebuilt only when blockers change, never every frame.
  this.navigationCellSize=56;
  this.navigationClearance=20;
  this.navigationGrid=null;
  this.navigationGridDirty=true;
  this.navigationGridVersion=0;
  this.navigationPathfindBudget=0;

  // Stage 1 World Design prototype. These shapes are diagnostic placeholders,
  // not final environment art.
  this.worldGround=this.add.rectangle(
   STAGE0.WORLD_WIDTH/2,STAGE0.WORLD_HEIGHT/2,
   STAGE0.WORLD_WIDTH,STAGE0.WORLD_HEIGHT,0x151916,1
  ).setDepth(-110);

  this.createWorldDesignPrototype();

  this.enemyGroup=this.physics.add.group();

  const startX=this.currentWorldZoneIndex===0?WORLD_DESIGN.START_X:
   Math.max(WORLD_DESIGN.ZONES[this.currentWorldZoneIndex].start,
    WORLD_DESIGN.GATES[this.currentWorldZoneIndex-1].x)+360;
  const startPoint=this.findNearestFreeGroundPoint(startX,WORLD_DESIGN.ROUTE_Y,24,180,18);
  this.player=this.add.circle(startPoint.x,startPoint.y,16,0x33aaff,0);
  this.physics.add.existing(this.player);
  this.player.body.setCollideWorldBounds(true);
  this.player.hitRadius=16;
  this.player.maxHp=BALANCE.PLAYER_BASE_MAX_HP;
  this.player.hp=this.player.maxHp;
  this.updateLowHealthState(true);

  this.playerVisual=this.add.sprite(
   this.player.x,
   this.player.y,
   'hero_socket_walk_s_01'
  ).setOrigin(0.5,0.78).setScale(HERO_SOCKET_VISUAL_SCALE).setDepth(20);

  this.playerDir='down';
  this.playerVisualDir8='s';
  this.playerAttackDir='down';
  this.playerVisualState='hero_socket_idle_s';
  this.playerVisual.play(this.playerVisualState);
  this.playerAttackUntil=0;
  this.activeAttackFx=null;
  this.createHeroWeaponAttachment();
  this.updateHeroWeaponAttachment();

  this.createReadabilityLayers();

  this.meleeAttack=new HeroMelee(this,this.player);
  restoreZoneBuild(this,this.zoneEntryCheckpoint?.hero);
  if(this.currentWorldZoneIndex>0)this.applyRegionalHeroBalance(this.currentWorldZoneIndex,false);
  this.updateLowHealthState(true);

  this.keys=this.input.keyboard.addKeys('W,A,S,D');
  this.cursors=this.input.keyboard.createCursorKeys();
  this.restartKey=this.input.keyboard.addKey(
   Phaser.Input.Keyboard.KeyCodes.R
  );
  this.skillKeys=this.input.keyboard.addKeys({
   skill1:Phaser.Input.Keyboard.KeyCodes.ONE,
   skill2:Phaser.Input.Keyboard.KeyCodes.TWO,
   skill3:Phaser.Input.Keyboard.KeyCodes.THREE
  });
  this.events.on('mobile-skill',this.handleSkillInput,this);

  this.hud=lkAddText(this,14,12,'',{fontSize:'18px',color:'#fff'})
   .setScrollFactor(0).setDepth(140).setAlpha(0);

  this.waveText=lkAddText(this,0,20,'WAVE 1',{fontSize:'24px',color:'#fff'})
   .setOrigin(0.5,0).setScrollFactor(0).setDepth(140).setAlpha(0);
  this.waveSubText=lkAddText(this,0,50,'',{fontSize:'13px',color:'#d9e6d6'})
   .setOrigin(0.5).setScrollFactor(0).setDepth(140).setAlpha(0);

  this.regionText=lkAddText(this,
   0,69,'ASH FIELDS',
   {fontSize:'12px',color:'#b9c2b6',stroke:'#101510',strokeThickness:2}
  ).setOrigin(0.5).setScrollFactor(0).setDepth(139).setAlpha(0);

  this.championNameText=lkAddText(this,
   400,72,'',
   {fontSize:'17px',color:'#ffe8a8',stroke:'#15100a',strokeThickness:3}
  ).setOrigin(0.5).setDepth(145).setScrollFactor(0).setVisible(false).setAlpha(0);

  this.championHpBack=this.add.rectangle(
   400,96,430,16,0x0b0b0b,0.82
  ).setDepth(144).setScrollFactor(0).setVisible(false).setAlpha(0);

  this.championHpFill=this.add.rectangle(
   187,96,426,10,0xd6aa52,1
  ).setOrigin(0,0.5).setDepth(145).setScrollFactor(0).setVisible(false).setAlpha(0);

  this.gameOverPanel=this.add.rectangle(
   400,300,430,170,0x000000,0.78
  ).setDepth(100).setScrollFactor(0).setVisible(false).setAlpha(0);

  this.gameOverText=lkAddText(this,
   400,300,
   '',
   {
    fontSize:'28px',
    color:'#ffffff',
    align:'center'
   }
  ).setOrigin(0.5).setDepth(101).setScrollFactor(0).setVisible(false).setAlpha(0);

  this.playerEnemyCollider=this.physics.add.collider(this.player,this.enemyGroup);
  this.playerAshCollider=this.physics.add.collider(this.player,this.ashLandmarkColliderGroup);
  this.enemyAshCollider=this.physics.add.collider(this.enemyGroup,this.ashLandmarkColliderGroup,null,this.shouldEnemyCollideWithAshLandmark,this);

  // Enemy/enemy hard Arcade collision was intentionally removed in World Navigation v2.
  // A soft-separation pass keeps the crowd readable without creating rigid traffic jams.

  this.setupResponsiveWorldCamera();
  this.bindProgressionGateCollision();
  if(this.scene.isActive('HUDScene')) this.scene.stop('HUDScene');
  this.scene.launch('HUDScene',{mainScene:this});

  this.regionText.setText(WORLD_DESIGN.ZONES[this.currentWorldZoneIndex].name);

  // One dialogue presentation/input owner serves both E interactions and NPC triggers.
  // Install its input listeners before interaction clients so the initiating press
  // cannot also advance the first line.
  this.storyDirector=new StoryDirector(this,{events:STORY_EVENTS}).install();
  this.dialogueSystem=new WorldDialogueSystem(this,{storyDirector:this.storyDirector}).install();
  this.woundedKnightInteractions=new WoundedKnightInteractionSystem(this,{storyDirector:this.storyDirector}).install();
  // The story-knight crow flock is intentionally event-driven: it does not
  // exist in Ash Fields until the wounded-knight objective marker appears.
  this.events.on('story-objective-activated',this.handleStoryKnightCrowObjective,this);
  this.championDialogueSystem=new ChampionDialogueSystem(this,{storyDirector:this.storyDirector});
  this.storyEnemyAnomalies=new StoryEnemyAnomalySystem(this,{definitions:STORY_ANOMALY_DEFINITIONS}).install();
  this.ashAltarObjectiveMarker=new StoryObjectiveMarker(this,{insetRatio:0.10}).install();

  this.updateWorldStreaming();
  if(this.currentWorldZoneIndex>0){
   // A fresh Zone 2 restart owns a visible gate-closing arrival beat below.
   // Manual saves keep their exact persisted world state and therefore still
   // receive the normal already-closed backtrack seal immediately.
   const freshZone2Restart=this.currentWorldZoneIndex===1 && !this.pendingSaveState;
   if(!freshZone2Restart)this.createBacktrackSeal(WORLD_DESIGN.GATES[this.currentWorldZoneIndex-1]);
   this.releaseRetiredWorldZoneTextures(0);
  }

  // Developer Phaser laboratory: F10 or the small DEV launcher toggles the panel.
  this.devTools=new LastKnightDevTools(this);
  this.devTools.install();

  this.scale.on('resize',this.handleViewportResize,this);
  this.scale.on('resize',this.syncOrientationPause,this);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
   this.scale.off('resize',this.handleViewportResize,this);
   this.scale.off('resize',this.syncOrientationPause,this);
   this.events.off('mobile-skill',this.handleSkillInput,this);
   this.events.off('story-objective-activated',this.handleStoryKnightCrowObjective,this);
   this.gameplayPauseReasons?.clear();
   this.stopCriticalHeartbeat(true);
   try{this.physics.world.resume();}catch{}
   this.stopBrokenSaintHolyWarningSfx();
   this.stopAshSwordPulseSfx();
   this.stopBrokenSaintMaterializeSfx();
   this.stopBrokenSaintDisappearSfx();
   this.stopSwordOrbitCrowFlock(0);
   this.clearHeroHitImpactTimers(true);
   this.stopGameplaySfx();
   this.clearChampionHazards();
   this.stopBrokenSaintMusic();
   this.stopBackgroundMusic();
   this.dialogueSystem?.destroy();
   this.dialogueSystem=null;
   this.championDialogueSystem?.destroy();
   this.championDialogueSystem=null;
   this.finishStoryAnomalyHighlight();
   this.woundedKnightInteractions?.destroy();
   this.woundedKnightInteractions=null;
   this.storyEnemyAnomalies?.destroy();
   this.storyEnemyAnomalies=null;
   this.ashAltarObjectiveMarker?.destroy();
   this.ashAltarObjectiveMarker=null;
   this.ashAltarStoryTarget=null;
   this.ashAltarMarkerTarget=null;
   this.ashChampionIntroState=null;
   this.storyDirector?.destroy();
   this.storyDirector=null;
   this.devTools?.destroy();
   this.devTools=null;
  });

  this.captainSystem=new SkeletonCaptainSystem(this);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{this.captainSystem?.clear();this.captainSystem=null;});
  this.setupBackgroundMusic();
  this.applyAudioSettings();
  this.time.paused=false;
  this.physics.resume();
  const restored=this.pendingSaveState?this.restorePersistedGameState(this.pendingSaveState):false;
  this.pendingSaveState=null;
  if(!restored){
   this.captureZoneEntryCheckpoint();
   if(this.currentWorldZoneIndex===1 && this.restartZoneIndex===1){
    // Restarting Zone 2 begins at the sealed Ash Fields gate, not at the old
    // Broken Saint sword epilogue. The player then follows the wagon marker.
    this.beginZone2ArrivalSequence({restart:true});
   }else{
    this.startWave(1,true);
   }
   this.syncCharacterStats();
  }
  this.syncOrientationPause();
 }

 buildCharacterStats(){
  if(!this.player)return null;
  const region=WORLD_DESIGN.ZONES[this.currentWorldZoneIndex]||WORLD_DESIGN.ZONES[0];
  return {
   schemaVersion:1,
   updatedAt:Date.now(),
   level:this.level||1,
   xp:this.xp||0,
   xpRequired:this.getXpRequiredForLevel?.()||BALANCE.XP_BASE,
   kills:this.kills||0,
   hp:this.player.hp||0,
   maxHp:this.player.maxHp||0,
   mana:this.mana||0,
   maxMana:this.maxMana||0,
   manaRegenMs:this.manaRegenMs||BALANCE.MANA_REGEN_MS,
   regionIndex:this.currentWorldZoneIndex||0,
   regionName:region?.name||'UNKNOWN',
   localWave:this.wave||1,
   globalWave:this.getGlobalWave?.()||this.wave||1,
   combatStyle:this.combatStyle||null,
   sword:{
    level:this.meleeAttack?.level||this.weaponLevels?.sword||1,
    baseDamage:this.meleeAttack?.damage||0,
    effectiveDamage:this.getEffectiveMeleeDamage?.()||this.meleeAttack?.damage||0,
    cooldown:this.meleeAttack?.cooldown||0,
    radius:this.meleeAttack?.radius||0
   },
   skillEvolutions:[...(this.championSkillEvolutions||[])],
   relics:[...(this.championRelics||[])],
   essences:[...(this.championEssences||[])],
   multipliers:{
    hp:this.championHpMultiplier||1,
    manaRegen:this.championManaRegenMultiplier||1,
    skillRecovery:this.skillRecoveryMultiplier||1
   },
   penitenceCharges:this.bsPenitenceCharges||0,
   killStreakBonus:this.killStreakBonus||0
  };
 }

 syncCharacterStats(){
  const stats=this.buildCharacterStats();
  if(stats)writeCharacterStats(stats);
  return stats;
 }

 serializeEnemy(enemy,now=this.time.now){
  if(!enemy?.active||enemy.hp<=0)return null;
  const offset=(value)=>Number.isFinite(value)?value-now:0;
  const base={
   type:enemy.type,x:enemy.x,y:enemy.y,hp:enemy.hp,maxHp:enemy.maxHp,
   dir:enemy.dir||'down',attackDir:enemy.attackDir||enemy.dir||'down',
   staggerOffset:offset(enemy.staggerUntil||0),blockNext:Boolean(enemy.blockNext),
   blockReadyOffset:offset(enemy.blockReadyAt||0),emptyScreenRush:Boolean(enemy.emptyScreenRush)
  };
  if(enemy.type==='champion')Object.assign(base,{
   championKind:enemy.championKind,
   storyDormant:Boolean(enemy.storyDormant),
   ignoreAshAltarCollision:Boolean(enemy.ignoreAshAltarCollision),
   storyAltarLocked:Boolean(enemy.storyAltarLocked),
   nextSkillOffset:offset(enemy.nextSkillAt||0),
   nextSecondaryOffset:offset(enemy.nextSecondaryAt||0),
   reflectOffset:offset(enemy.reflectUntil||0),
   guardOffset:offset(enemy.guardUntil||0)
  });
  return base;
 }

 captureGameState(reason='manual'){
  if(!this.player)return null;
  const now=this.time.now;
  const build=captureZoneBuild(this);
  const stats=this.syncCharacterStats();
  const story=this.storyDirector;
  const state={
   schemaVersion:SAVE_SCHEMA_VERSION,
   savedAt:Date.now(),
   reason,
   characterStats:stats,
   hero:{...build,x:this.player.x,y:this.player.y,dir:this.playerDir||'down',visualDir:this.playerVisualDir8||'s'},
   wave:{
    number:this.wave,globalWave:this.getGlobalWave(),spawned:this.spawned,target:this.waveTarget,profile:this.waveProfile,
    spawnInterval:this.waveSpawnInterval,intermission:Boolean(this.waveIntermission),
    nextWaveInMs:Number.isFinite(this.nextWaveAt)?Math.max(0,this.nextWaveAt-now):null,
    lastSpawnOffset:(Number(this.lastSpawn)||0)-now,
    postWaveChampionKind:this.postWaveChampionKind||null
   },
   world:{
    zoneIndex:this.currentWorldZoneIndex,zoneName:WORLD_DESIGN.ZONES[this.currentWorldZoneIndex]?.name||'UNKNOWN',
    progressionBalanceZoneIndex:this.progressionBalanceZoneIndex,
    unlockedWorldGates:[...(this.unlockedWorldGates||[])],
    closedWorldGates:[...(this.closedWorldGates||[])],
    pendingWorldAdvance:this.pendingWorldAdvance?{...this.pendingWorldAdvance}:null,
    awaitingWorldAdvance:Boolean(this.awaitingWorldAdvance),
    worldAdvanceTargetZone:this.worldAdvanceTargetZone??null
   },
   story:{
    flags:story?[...story.flags.entries()]:[],
    completedEvents:story?[...story.completedEvents]:[],
    completedObjectives:story?[...story.completedObjectives]:[],
    activeObjective:story?.activeObjective?{...story.activeObjective}:null
   },
   session:{
    combatStyleChoiceShown:Boolean(this.combatStyleChoiceShown),
    pendingCombatStyleWave:this.pendingCombatStyleWave||0,
    ashSwordPulseCompleted:Boolean(this.ashSwordPulseCompleted),
    fallenBlessingUsed:Boolean(this.fallenBlessingUsed),
    levelChoiceOpen:Boolean(this.levelChoiceOpen),
    levelChoiceKind:this.levelChoiceKind||'normal',
    championRewardOpen:Boolean(this.championRewardOpen),
    championRewardKind:this.currentChampionRewardKind||null,
    championRewardStepIndex:this.currentChampionRewardStepIndex||0,
    brokenSaintSwordEpilogue:this.brokenSaintSwordEpilogue?{
     phase:this.brokenSaintSwordEpilogue.phase,
     untilInMs:Number.isFinite(this.brokenSaintSwordEpilogue.until)?Math.max(0,this.brokenSaintSwordEpilogue.until-now):null
    }:null
   },
   counters:{
    mageSpawned:this.mageSpawned||0,skeletonSpawned:this.skeletonSpawned||0,
    shieldSpawned:this.shieldSpawned||0,championSpawned:this.championSpawned||0
   },
   enemies:(this.enemies||[]).map(enemy=>this.serializeEnemy(enemy,now)).filter(Boolean)
  };
  return state;
 }

 saveManualSlot(slot){
  const safeSlot=Phaser.Math.Clamp(Math.round(Number(slot)||1),1,3);
  const state=this.captureGameState(`slot-${safeSlot}`);
  if(!state)return false;
  state.session={...(state.session||{}),saveSlot:safeSlot};
  const written=writeManualSave(safeSlot,state);
  if(written)this.currentSaveSlot=safeSlot;
  return written;
 }

 restorePersistedGameState(save){
  if(!save?.hero||!save?.wave)return false;
  const now=this.time.now;
  const hero=save.hero,wave=save.wave,world=save.world||{},session=save.session||{};
  restoreZoneBuild(this,hero);
  this.player.setPosition(Number(hero.x)||this.player.x,Number(hero.y)||this.player.y);
  this.player.body?.reset?.(this.player.x,this.player.y);
  this.playerDir=hero.dir||'down';
  this.playerVisualDir8=hero.visualDir||'s';
  this.playerVisual?.setPosition(this.player.x,this.player.y);
  this.playerVisualState=`hero_socket_idle_${this.playerVisualDir8}`;
  this.playerVisual?.play?.(this.playerVisualState,true);
  this.updateHeroWeaponAttachment();

  this.currentWorldZoneIndex=Phaser.Math.Clamp(Number(world.zoneIndex)||0,0,WORLD_DESIGN.ZONES.length-1);
  this.progressionBalanceZoneIndex=Phaser.Math.Clamp(Number(world.progressionBalanceZoneIndex??this.currentWorldZoneIndex)||0,0,WORLD_DESIGN.ZONES.length-1);
  this.regionText?.setText(WORLD_DESIGN.ZONES[this.currentWorldZoneIndex]?.name||'');
  this.unlockedWorldGates=new Set();
  for(const id of world.unlockedWorldGates||[]){
   const gate=WORLD_DESIGN.GATES.find(entry=>entry.id===id);
   if(gate)this.unlockWorldGateForChampion(gate.champion);
  }
  for(const id of world.closedWorldGates||[]){
   const gate=WORLD_DESIGN.GATES.find(entry=>entry.id===id);
   if(gate)this.createBacktrackSeal(gate);
  }
  this.pendingWorldAdvance=world.pendingWorldAdvance?{...world.pendingWorldAdvance}:null;
  this.awaitingWorldAdvance=Boolean(world.awaitingWorldAdvance);
  this.worldAdvanceTargetZone=world.worldAdvanceTargetZone??null;

  this.wave=Math.max(1,Number(wave.number)||1);
  this.spawned=Math.max(0,Number(wave.spawned)||0);
  this.waveTarget=Math.max(this.spawned,Number(wave.target)||this.calculateWaveTarget(this.wave));
  this.waveProfile=wave.profile||this.getWaveProfile(this.wave);
  this.waveSpawnInterval=Number(wave.spawnInterval)||this.calculateWaveSpawnInterval(this.waveProfile);
  this.waveIntermission=Boolean(wave.intermission);
  this.nextWaveAt=wave.nextWaveInMs===null||wave.nextWaveInMs===undefined?Number.POSITIVE_INFINITY:now+Math.max(0,Number(wave.nextWaveInMs)||0);
  this.lastSpawn=now+(Number(wave.lastSpawnOffset)||0);
  this.postWaveChampionKind=wave.postWaveChampionKind||null;
  this.waveText?.setText(`WAVE ${this.getGlobalWave()}`);
  this.waveSubText?.setText(this.waveIntermission?'BREATHER':(this.waveProfile?.name||''));

  const story=save.story||{};
  if(this.storyDirector){
   this.storyDirector.flags=new Map(Array.isArray(story.flags)?story.flags:[]);
   this.storyDirector.completedEvents=new Set(story.completedEvents||[]);
   this.storyDirector.completedObjectives=new Set(story.completedObjectives||[]);
   this.storyDirector.activeObjective=story.activeObjective?{...story.activeObjective}:null;
   if(this.storyDirector.activeObjective)this.events?.emit?.('story-objective-activated',this.storyDirector.activeObjective);
  }
  this.combatStyleChoiceShown=Boolean(session.combatStyleChoiceShown||this.combatStyle);
  this.pendingCombatStyleWave=Number(session.pendingCombatStyleWave)||0;
  this.ashSwordPulseCompleted=Boolean(session.ashSwordPulseCompleted||this.combatStyleChoiceShown);
  if(this.currentWorldZoneIndex===0&&this.wave===2&&this.waveIntermission&&!this.ashSwordPulseCompleted)this.ashSwordPreludeQueuedAt=now+700;
  this.fallenBlessingUsed=Boolean(session.fallenBlessingUsed||this.fallenBlessingUsed);
  if(session.brokenSaintSwordEpilogue){
   const savedPhase=session.brokenSaintSwordEpilogue.phase||'waitingClear';
   const safePhase=savedPhase==='call'?'approach':savedPhase;
   this.brokenSaintSwordEpilogue={phase:safePhase};
   if(session.brokenSaintSwordEpilogue.untilInMs!==null&&session.brokenSaintSwordEpilogue.untilInMs!==undefined){
    this.brokenSaintSwordEpilogue.until=now+Math.max(0,Number(session.brokenSaintSwordEpilogue.untilInMs)||0);
   }
   if(safePhase==='approach'&&this.ashSwordLandmark?.active)this.ashAltarObjectiveMarker?.setTarget(this.ashSwordLandmark,{worldOffsetY:118});
  }

  const counters=save.counters||{};
  this.mageSpawned=Number(counters.mageSpawned)||0;
  this.skeletonSpawned=Number(counters.skeletonSpawned)||0;
  this.shieldSpawned=Number(counters.shieldSpawned)||0;
  this.championSpawned=Number(counters.championSpawned)||0;

  for(const item of save.enemies||[]){
   if(!item||item.hp<=0)continue;
   let enemy=null;
   if(item.type==='champion'&&item.championKind){
    enemy=this.spawnChampion(item.championKind,false,{
     position:{x:item.x,y:item.y},exactStorySpawn:true,minPlayerDistance:0,maxRadius:0,
     deferMusic:true,suppressBanner:true,suppressFlash:true,skipRetryCheckpoint:true,
     dormant:Boolean(item.storyDormant)
    });
   }else{
    enemy=this.spawnEnemy(item.type,{x:item.x,y:item.y},{skipStoryAnomaly:true});
   }
   if(!enemy)continue;
   enemy.setPosition(item.x,item.y);enemy.body?.reset?.(item.x,item.y);
   enemy.maxHp=Number(item.maxHp)||enemy.maxHp;enemy.hp=Phaser.Math.Clamp(Number(item.hp)||enemy.maxHp,1,enemy.maxHp);
   enemy.dir=item.dir||enemy.dir;enemy.attackDir=item.attackDir||enemy.attackDir;
   enemy.staggerUntil=now+Math.max(0,Number(item.staggerOffset)||0);
   enemy.emptyScreenRush=Boolean(item.emptyScreenRush);
   if(item.type==='shield'){enemy.blockNext=Boolean(item.blockNext);enemy.blockReadyAt=now+Math.max(0,Number(item.blockReadyOffset)||0);}
   if(item.type==='champion'){
    enemy.storyDormant=Boolean(item.storyDormant);
    enemy.ignoreAshAltarCollision=Boolean(item.ignoreAshAltarCollision);
    enemy.storyAltarLocked=Boolean(item.storyAltarLocked);
    enemy.nextSkillAt=now+Math.max(250,Number(item.nextSkillOffset)||0);
    enemy.nextSecondaryAt=now+Math.max(500,Number(item.nextSecondaryOffset)||0);
    enemy.reflectUntil=now+Math.max(0,Number(item.reflectOffset)||0);
    enemy.guardUntil=now+Math.max(0,Number(item.guardOffset)||0);
    this.updateChampionBar();
   }
  }
  if(this.activeChampion?.championKind==='brokenSaint')this.startBrokenSaintMusic();
  this.updateLowHealthState(true);
  this.updateCombatStyleChargeVisual();
  this.updateWorldStreaming();
  this.captureZoneEntryCheckpoint();
  this.syncCharacterStats();

  const reopenChoice=Boolean(session.levelChoiceOpen);
  const reopenRewards=Boolean(session.championRewardOpen&&session.championRewardKind);
  if(reopenChoice||reopenRewards){
   this.time.delayedCall(60,()=>{
    if(reopenChoice){
     this.levelChoiceOpen=false;
     if(session.levelChoiceKind==='combatStyle')this.openCombatStyleChoice();else this.openLevelChoices();
    }else if(reopenRewards){
     this.championRewardOpen=false;
     this.openChampionRewards(session.championRewardKind);
     this.currentChampionRewardStepIndex=Phaser.Math.Clamp(Number(session.championRewardStepIndex)||0,0,Math.max(0,(this.currentChampionRewardFlow?.length||1)-1));
     this.showCurrentChampionRewardStep();
    }
   });
  }
  return true;
 }

 openSessionMenu(){
  if(this.gameOver||this.scene.isActive('GameMenuScene'))return false;
  this.setGameplayPaused('menu',true);
  if(this.scene.isActive('HUDScene'))this.scene.pause('HUDScene');
  this.scene.launch('GameMenuScene',{mode:'session',mainScene:this});
  this.scene.bringToTop('GameMenuScene');
  return true;
 }

 applyAudioSettings(){
  const settings=AudioManager.prototype.applyAudioSettings.call(this);
  try{this.heartbeatSound?.setVolume?.(LOW_HEALTH_CONFIG.HEARTBEAT_VOLUME*settings.sfxVolume);}catch{}
  return settings;
 }

 setupBackgroundMusic(){ return AudioManager.prototype.setupBackgroundMusic.call(this); }
 stopBackgroundMusic(){ return AudioManager.prototype.stopBackgroundMusic.call(this); }
 startBrokenSaintMusic(){ return AudioManager.prototype.startBrokenSaintMusic.call(this); }
 stopBrokenSaintMusic(){ return AudioManager.prototype.stopBrokenSaintMusic.call(this); }
 playAshSwordPulseSfx(){ return AudioManager.prototype.playAshSwordPulseSfx.call(this); }
 stopAshSwordPulseSfx(){ return AudioManager.prototype.stopAshSwordPulseSfx.call(this); }
 playBrokenSaintMaterializeSfx(maxDurationMs=0){ return AudioManager.prototype.playBrokenSaintMaterializeSfx.call(this,maxDurationMs); }
 stopBrokenSaintMaterializeSfx(){ return AudioManager.prototype.stopBrokenSaintMaterializeSfx.call(this); }
 playBrokenSaintDisappearSfx(maxDurationMs=0){ return AudioManager.prototype.playBrokenSaintDisappearSfx.call(this,maxDurationMs); }
 stopBrokenSaintDisappearSfx(){ return AudioManager.prototype.stopBrokenSaintDisappearSfx.call(this); }
 playCrowScatterSfx(){ return AudioManager.prototype.playCrowScatterSfx.call(this); }
 startCrowFlightLoopSfx(activeCount=1){ return AudioManager.prototype.startCrowFlightLoopSfx.call(this,activeCount); }
 stopCrowFlightLoopSfx(){ return AudioManager.prototype.stopCrowFlightLoopSfx.call(this); }
 syncCrowFlightLoopSfx(activeCount=0){ return AudioManager.prototype.syncCrowFlightLoopSfx.call(this,activeCount); }
 countAudibleFlyingCrows(){
  let count=0;
  for(const crow of this.crows||[]){
   if(!crow?.sprite?.active || !['takeoff','fly','orbit'].includes(crow.state))continue;
   const flock=this.crowFlocks?.get?.(crow.flockId);
   if(flock?.audioEnabled===false)continue;
   count++;
  }
  return count;
 }
 startSwordOrbitCrowWingsSfx(){
  const flock=this.crowFlocks?.get?.(this.swordOrbitCrowFlockId);
  if(flock)flock.audioEnabled=true;
  return this.syncCrowFlightLoopSfx(this.countAudibleFlyingCrows());
 }
 stopSwordOrbitCrowWingsSfx(){
  const flock=this.crowFlocks?.get?.(this.swordOrbitCrowFlockId);
  if(flock)flock.audioEnabled=false;
  return this.syncCrowFlightLoopSfx(this.countAudibleFlyingCrows());
 }

 pauseGameplaySfx(){ return AudioManager.prototype.pauseGameplaySfx.call(this); }
 resumeGameplaySfx(){ return AudioManager.prototype.resumeGameplaySfx.call(this); }
 stopGameplaySfx(){ return AudioManager.prototype.stopGameplaySfx.call(this); }

 isPortraitInputBlocked(){
  if(typeof window==='undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse) and (orientation: portrait)').matches;
 }

 syncOrientationPause(){
  this.setGameplayPaused('orientation',this.isPortraitInputBlocked());
 }

 setGameplayPaused(reason,shouldPause){
  if(!reason) return;
  if(!this.gameplayPauseReasons) this.gameplayPauseReasons=new Set();

  const wanted=Boolean(shouldPause);
  const hadReason=this.gameplayPauseReasons.has(reason);
  if(wanted) this.gameplayPauseReasons.add(reason);
  else this.gameplayPauseReasons.delete(reason);

  const nextPaused=this.gameplayPauseReasons.size>0;
  // Trace only real state transitions. syncOrientationPause() runs every frame,
  // so logging the unchanged reason here used to create thousands of JSON events
  // and distorted the very performance trace we were trying to measure.
  if(hadReason!==wanted || nextPaused!==this.gameplayPaused){
   this.devTools?.recordTraceEvent?.('gameplay_pause_reason',{reason:String(reason),shouldPause:wanted,paused:nextPaused,reasons:Array.from(this.gameplayPauseReasons)},{sample:true,dedupe:true,dedupeKey:`gameplay_pause:${reason}`});
  }
  // Story cinematics freeze simulation through the same pause-reason system,
  // but their authored SFX must be allowed to keep playing. Every other pause
  // reason is a real gameplay/UI pause and therefore suspends non-music audio.
  const audioShouldPause=[...this.gameplayPauseReasons].some(activeReason=>activeReason!=='story');
  if(audioShouldPause!==Boolean(this.gameplayAudioPaused)){
   this.gameplayAudioPaused=audioShouldPause;
   if(audioShouldPause)this.pauseGameplaySfx?.();
   else this.resumeGameplaySfx?.();
  }

  if(nextPaused===this.gameplayPaused) return;
  this.gameplayPaused=nextPaused;

  if(nextPaused){
   this.physics.pause();
   this.time.paused=true;
   this.tweens.pauseAll();
  } else {
   this.time.paused=false;
   this.physics.resume();
   this.tweens.resumeAll();
  }
  this.syncCriticalHeartbeat();
 }

 getLowHealthState(){
  if(!this.player) return 'normal';
  const maxHp=Math.max(1,this.player.maxHp||100);
  const ratio=Phaser.Math.Clamp((this.player.hp||0)/maxHp,0,1);
  if(ratio<=LOW_HEALTH_CONFIG.DEATH_DOOR_THRESHOLD && ratio>0) return 'deathDoor';
  if(ratio<=LOW_HEALTH_CONFIG.CRITICAL_THRESHOLD && ratio>0) return 'critical';
  if(ratio<=LOW_HEALTH_CONFIG.LOW_THRESHOLD && ratio>0) return 'low';
  return 'normal';
 }

 updateLowHealthState(force=false){
  if(!this.player) return 'normal';
  const maxHp=Math.max(1,this.player.maxHp||100);
  const ratio=Phaser.Math.Clamp((this.player.hp||0)/maxHp,0,1);
  const nextState=this.getLowHealthState();
  const previous=this.lowHealthState||'normal';
  this.lowHealthRatio=ratio;
  if(force || nextState!==previous){
   this.lowHealthState=nextState;
   this.events.emit('healthStateChanged',nextState,previous,ratio);
  }
  this.syncCriticalHeartbeat();
  return nextState;
 }

 getHeartbeatIntervalMs(state=this.lowHealthState){
  if(state==='deathDoor') return LOW_HEALTH_CONFIG.HEARTBEAT_DEATH_DOOR_INTERVAL_MS;
  if(state==='critical') return LOW_HEALTH_CONFIG.HEARTBEAT_CRITICAL_INTERVAL_MS;
  return LOW_HEALTH_CONFIG.HEARTBEAT_LOW_INTERVAL_MS;
 }

 isHeartbeatHealthState(state=this.lowHealthState){
  return state==='low' || state==='critical' || state==='deathDoor';
 }

 playCriticalHeartbeatOnce(){
  if(this.gameOver || this.gameplayPaused || !this.isHeartbeatHealthState()) return;
  if(!this.sound || this.sound.locked || !this.cache.audio.exists('critical_heartbeat')) return;
  if(!this.heartbeatSound){
   this.heartbeatSound=this.sound.add('critical_heartbeat',{volume:LOW_HEALTH_CONFIG.HEARTBEAT_VOLUME*getGameSettings().sfxVolume});
  } else {
   this.heartbeatSound.setVolume(LOW_HEALTH_CONFIG.HEARTBEAT_VOLUME*getGameSettings().sfxVolume);
  }
  if(!this.heartbeatSound.isPlaying) this.heartbeatSound.play();
 }

 startCriticalHeartbeat(){
  if(this.gameOver || this.gameplayPaused || !this.isHeartbeatHealthState()) return;
  const state=this.lowHealthState;
  const delay=this.getHeartbeatIntervalMs(state);
  if(this.heartbeatTimer && this.heartbeatState===state) return;
  if(this.heartbeatTimer){
   this.heartbeatTimer.remove(false);
   this.heartbeatTimer=null;
  }
  this.heartbeatState=state;
  this.playCriticalHeartbeatOnce();
  this.heartbeatTimer=this.time.addEvent({
   delay,
   loop:true,
   callback:()=>this.playCriticalHeartbeatOnce()
  });
 }

 stopCriticalHeartbeat(destroySound=false){
  if(this.heartbeatTimer){
   this.heartbeatTimer.remove(false);
   this.heartbeatTimer=null;
  }
  this.heartbeatState=null;
  if(this.heartbeatSound){
   this.heartbeatSound.stop();
   if(destroySound){
    this.heartbeatSound.destroy();
    this.heartbeatSound=null;
  this.lastSkeletonAttackSfxAt=-9999;
   }
  }
 }

 syncCriticalHeartbeat(){
  if(this.gameOver || !this.isHeartbeatHealthState()){
   this.stopCriticalHeartbeat(false);
   return;
  }
  // Scene time and the actual heartbeat sound are paused by setGameplayPaused().
  // Do not stop/restart the loop when a menu opens; resume it from the same point.
  if(this.gameplayPaused)return;
  this.startCriticalHeartbeat();
 }

 spawnEnemy(forcedType=null,forcedPosition=null,{skipStoryAnomaly=false}={}){
  const encounter=isCaptainEncounter(this.currentWorldZoneIndex,this.wave);
  if(!forcedType && encounter)forcedType=this.spawned===CAPTAIN.captainOrdinal-1?'captain':'skeleton';
  const combatWave=this.getGlobalWave();
  const rawSpawn=forcedPosition || this.getSpawnPointAroundCamera(52);
  const spawn=this.findSafeEnemySpawnPoint(rawSpawn.x,rawSpawn.y,{padding:28,minPlayerDistance:120,maxRadius:420});

  let e=this.add.circle(
    spawn.x,
    spawn.y,
    14,
    0xcc3333
  );

  this.physics.add.existing(e);

  const livingMages=this.enemies.filter(
   enemy=>enemy.active && enemy.type==='mage'
  ).length;
  const livingShields=this.enemies.filter(
   enemy=>enemy.active && enemy.type==='shield'
  ).length;
  const mageEvery=(this.waveProfile && this.waveProfile.mageEvery) || 5;
  const shieldEvery=(this.waveProfile && this.waveProfile.shieldEvery) || 6;

  const isMage = forcedType
   ? forcedType==='mage'
   : (this.wave >= 3 &&
      (this.spawned % mageEvery === mageEvery-1) &&
      livingMages < 2);

  const isShield = forcedType
   ? forcedType==='shield'
   : (!isMage &&
      this.wave >= 4 &&
      (this.spawned % shieldEvery === shieldEvery-1) &&
      livingShields < 3);

  e.type = forcedType || (isMage ? 'mage' : (isShield ? 'shield' : 'skeleton'));

  if(isMage){
   e.setFillStyle(0x44ff66,0);
   e.hp=20 + combatWave*3;
   e.maxHp=e.hp;
   e.speed=72 + combatWave*3.3;
   e.hitRadius=14;

   e.visual=this.add.sprite(
    e.x,
    e.y,
    'mage_down_idle_00'
   ).setOrigin(0.5,0.80).setScale(0.5).setDepth(15);

   e.dir='down';
   e.attackDir='down';
   e.visualState='mage_down_idle';
   e.visual.play(e.visualState);

   this.mageSpawned++;
  } else if(isShield){
   e.setFillStyle(0x8799aa,0);
   e.hp=shieldHpForWave(combatWave);
   e.maxHp=e.hp;
   e.speed=72 + combatWave*2.8;
   e.blockNext=true;
   e.blockReadyAt=0;
   e.attackDamage=3.2;
   e.hitRadius=18;

   e.visual=this.add.sprite(
    e.x,
    e.y,
    'shield_down_idle_00'
   ).setOrigin(0.5,0.80).setScale(0.5).setDepth(15);

   e.dir='down';
   e.attackDir='down';
   e.visualState='shield_down_idle';
   e.visual.play(e.visualState);

   this.shieldSpawned++;
  } else {
   e.setFillStyle(0xcc3333,0);
   e.hp=30 + combatWave*5;
   e.maxHp=e.hp;
   e.speed=80 + combatWave*5;
   e.attackDamage=8;
   e.hitRadius=14;

   e.visual=this.add.sprite(
    e.x,
    e.y,
    'skeleton_down_walk_00'
   ).setOrigin(0.5,0.78).setScale(0.5).setDepth(15);

   e.dir='down';
   e.attackDir='down';
   e.visualState='skeleton_down_walk';
   e.visual.play(e.visualState);

   if(e.type!=='captain')this.skeletonSpawned++;
  }

  // A fully-upgraded Ash Fields build should meet a real difficulty step on
  // entering later regions instead of deleting their opening mobs instantly.
  // Captains own authored stats below, so this applies to ordinary enemies only.
  if(this.currentWorldZoneIndex>0 && e.type!=='captain'){
   const regionalHpFactor=1.35+Math.max(0,this.currentWorldZoneIndex-1)*0.12;
   const regionalSpeedFactor=1.08+Math.max(0,this.currentWorldZoneIndex-1)*0.025;
   e.hp=Math.ceil(e.hp*regionalHpFactor);
   e.maxHp=e.hp;
   e.speed=Math.round(e.speed*regionalSpeedFactor);
  }

  e.lastAttack=0;
  e.lastShot=0;
  e.attackAnimUntil=0;
  e.staggerUntil=0;
  e.pendingMeleeHitAt=0;
  e.pendingMeleeDamage=0;
  e.pendingMeleeRange=0;
  e.knockbackVX=0;
  e.knockbackVY=0;
  if(e.type==='captain')this.captainSystem.attach(e,combatWave);
  e.visualBaseScale=e.visual ? e.visual.scaleX : 0.5;
  this.createEnemyReadabilityShadow(e);
  this.configureEnemyCollision(e,4);
  this.enemyGroup.add(e);
  this.enemies.push(e);
  if(!skipStoryAnomaly && this.currentWorldZoneIndex===0 && e.type==='skeleton'){
   this.storyEnemyAnomalies?.registerEnemy(e,{
    wave:this.wave,
    spawnOrdinal:this.spawned+1
   });
  }
  return e;
 }

 getChampionForWave(wave){
  const championsByZone=[
   {5:'brokenSaint'},
   {5:'necromancer'},
   {5:'shieldWarden'},
   {5:'hollowTree'},
   {}
  ];
  return championsByZone[this.currentWorldZoneIndex]?.[wave] || null;
 }

 getChampionDefinition(kind){
  return ({
   brokenSaint:{name:'BROKEN SAINT',hp:520,speed:48,damage:12,hitRadius:34,crowdRadius:44,crowdKeepoutRadius:96,collisionPadding:10,scale:0.96,tint:0xffffff,rewardColor:'#ffe59a'},
   necromancer:{name:'THE SOUL HERALD',hp:640,speed:42,damage:10,hitRadius:24,scale:0.58,tint:0x78ff7c,rewardColor:'#7cff95'},
   shieldWarden:{name:'SHIELD WARDEN',hp:820,speed:38,damage:16,hitRadius:27,scale:0.62,tint:0xc9d0da,rewardColor:'#d9e1ea'},
   hollowTree:{name:'HOLLOW TREE',hp:1120,speed:0,damage:10,hitRadius:36,scale:0.72,tint:0x91b967,rewardColor:'#b8df85'}
  })[kind];
 }


 createReadabilityLayers(){
  this.playerGroundLight=this.add.ellipse(
   this.player.x,
   this.player.y+6,
   ASH_READABILITY.PLAYER_AURA_WIDTH,
   ASH_READABILITY.PLAYER_AURA_HEIGHT,
   0xf0d886,
   ASH_READABILITY.PLAYER_ROUTE_LIGHT_ALPHA
  ).setDepth(12);
  this.playerGroundLight.setBlendMode(Phaser.BlendModes.SCREEN);

  this.combatStyleChargeGlow=this.add.ellipse(
   this.player.x,this.player.y+7,138,88,0xf2c767,0
  ).setDepth(13).setVisible(false);
  this.combatStyleChargeGlow.setBlendMode(Phaser.BlendModes.SCREEN);

  this.playerShadow=this.add.ellipse(
   this.player.x,
   this.player.y+12,
   ASH_READABILITY.PLAYER_SHADOW_WIDTH,
   ASH_READABILITY.PLAYER_SHADOW_HEIGHT,
   0x000000,
   0.34
  ).setDepth(19);
 }

 createEnemyReadabilityShadow(enemy){
  if(!enemy || enemy.shadowVisual) return;

  const r=enemy.hitRadius||14;
  const isMage=enemy.type==='mage';
  const width=isMage
   ? ASH_READABILITY.MAGE_SHADOW_WIDTH
   : Math.max(26,r*2.25);
  const height=isMage
   ? ASH_READABILITY.MAGE_SHADOW_HEIGHT
   : Math.max(12,r*1.02);
  const alpha=enemy.type==='champion'
   ? ASH_READABILITY.CHAMPION_SHADOW_ALPHA
   : (isMage ? ASH_READABILITY.MAGE_SHADOW_ALPHA : ASH_READABILITY.ENEMY_SHADOW_ALPHA);
  const yOffset=isMage
   ? ASH_READABILITY.MAGE_SHADOW_Y_OFFSET
   : (enemy.type==='shield' ? ASH_READABILITY.SHIELD_SHADOW_Y_OFFSET : r*0.82);

  enemy.shadowVisual=this.add.ellipse(
   enemy.x,
   enemy.y+yOffset,
   width,
   height,
   0x000000,
   alpha
  ).setDepth(enemy.type==='champion' ? 15 : 14);
 }

 destroyEnemyReadabilityShadow(enemy){
  if(enemy && enemy.shadowVisual && enemy.shadowVisual.active){
   enemy.shadowVisual.destroy();
  }
 }

 updateReadabilityLayers(){
  if(this.playerGroundLight && this.playerGroundLight.active){
   this.playerGroundLight.setPosition(this.player.x,this.player.y+8);
   const targetW=Math.max(250,(this.meleeAttack ? this.meleeAttack.radius*2.05 : 250));
   const targetH=Math.max(190,(this.meleeAttack ? this.meleeAttack.radius*1.55 : 190));
   this.playerGroundLight.width=targetW;
   this.playerGroundLight.height=targetH;
  }

  if(this.playerShadow && this.playerShadow.active){
   const playerShadowYOffset=this.playerVisualState==='hero_death'
    ? ASH_READABILITY.PLAYER_DEATH_SHADOW_Y_OFFSET
    : ASH_READABILITY.PLAYER_SHADOW_Y_OFFSET;
   this.playerShadow.setPosition(this.player.x,this.player.y+playerShadowYOffset);
  }
  this.updateCombatStyleChargeVisual();
 }

 createWorldDesignPrototype(){
  this.worldZoneVisuals=[];
  this.worldLandmarkObjects=[];
  this.worldGateObjects=new Map();

  this.worldGateGroup=this.physics.add.staticGroup();
  this.ashLandmarkColliderGroup=this.physics.add.staticGroup();

  // Restart directly inside the active zone. Retired Ash textures must never
  // be referenced while reconstructing zone 2.
  this.loadWorldZone(this.currentWorldZoneIndex);
 }

 getZoneStart(index){
  const zone=WORLD_DESIGN.ZONES[index];
  return zone ? zone.start : 0;
 }

 getZoneEnd(index){
  const zone=WORLD_DESIGN.ZONES[index];
  return zone ? zone.end : STAGE0.WORLD_WIDTH;
 }

 getZoneTravelProgress(index=this.currentWorldZoneIndex){
  const zone=WORLD_DESIGN.ZONES[index];
  if(!zone) return 0;

  const entryX=index===0 ? WORLD_DESIGN.START_X : zone.start;
  const exitX=zone.end;
  return Phaser.Math.Clamp(
   (this.player.x-entryX)/Math.max(1,exitX-entryX),
   0,
   1
  );
 }


 artNoise(seed){
  const raw=Math.sin(seed*12.9898+78.233)*43758.5453123;
  return raw-Math.floor(raw);
 }




 markNavigationDirty(){ return NavigationSystem.prototype.markNavigationDirty.call(this); }
 ensureNavigationGrid(){ return NavigationSystem.prototype.ensureNavigationGrid.call(this); }
 rebuildNavigationGrid(){ return NavigationSystem.prototype.rebuildNavigationGrid.call(this); }
 worldToNavCell(x,y){ return NavigationSystem.prototype.worldToNavCell.call(this,x,y); }
 navCellToWorld(col,row){ return NavigationSystem.prototype.navCellToWorld.call(this,col,row); }
 isNavCellWalkable(col,row){ return NavigationSystem.prototype.isNavCellWalkable.call(this,col,row); }
 findNearestWalkableNavCell(col,row,maxRadius=10){ return NavigationSystem.prototype.findNearestWalkableNavCell.call(this,col,row,maxRadius); }
 isNavigationLineBlocked(x1,y1,x2,y2){ return NavigationSystem.prototype.isNavigationLineBlocked.call(this,x1,y1,x2,y2); }
 findNavigationPath(startX,startY,targetX,targetY,enemy=null,maxVisited=3200){ return NavigationSystem.prototype.findNavigationPath.call(this,startX,startY,targetX,targetY,enemy,maxVisited); }
 updateEnemyStuckState(enemy,time,intendedSpeed){ return NavigationSystem.prototype.updateEnemyStuckState.call(this,enemy,time,intendedSpeed); }
 getEnemyNavigationWaypoint(enemy,time,targetX,targetY,radius){ return NavigationSystem.prototype.getEnemyNavigationWaypoint.call(this,enemy,time,targetX,targetY,radius); }
 applyEnemySoftSeparation(time){ const t=this.devTools?.isPerformanceTraceActive?.()?performance.now():0; try{return NavigationSystem.prototype.applyEnemySoftSeparation.call(this,time);} finally{if(t)this.devTools?.recordSubsystemTime?.('navigation',performance.now()-t);} }
 findSafeNavSpawnPoint(x,y,options={}){ return NavigationSystem.prototype.findSafeNavSpawnPoint.call(this,x,y,options); }

 getAshPropPhysicsClass(prop,kind='grass'){
  if(kind==='landmark') return 'blocking';
  if(kind==='grass') return 'decorative';

  const displayW=Math.max(1,prop?.displayWidth||0);
  const displayH=Math.max(1,prop?.displayHeight||0);

  // Trees are meaningful silhouettes and always block movement. Tiny rock chips
  // remain decorative so combat lanes do not become cluttered with invisible walls.
  if(kind==='tree') return 'blocking';
  if(kind==='rock') return (displayW<70 && displayH<40) ? 'decorative' : 'blocking';
  return 'decorative';
 }

 isAshCircleBlocked(x,y,radius=0,enemy=null){
  if(!this.ashLandmarkColliderGroup) return false;
  for(const blocker of this.ashLandmarkColliderGroup.getChildren()){
   if(!blocker?.active || !blocker.body || blocker.body.enable===false) continue;
   if(this.isAshBlockerIgnoredForEnemy(blocker,enemy)) continue;
   const b=this.getAshBlockerBounds(blocker,0);
   if(!b) continue;
   const nearestX=Phaser.Math.Clamp(x,b.left,b.right);
   const nearestY=Phaser.Math.Clamp(y,b.top,b.bottom);
   const dx=x-nearestX;
   const dy=y-nearestY;
   if(dx*dx+dy*dy<=radius*radius) return true;
  }
  return false;
 }

 isAshPathBlocked(x1,y1,x2,y2,radius=0,enemy=null){
  if(!this.ashLandmarkColliderGroup) return false;
  const dx=x2-x1;
  const dy=y2-y1;
  const distance=Math.hypot(dx,dy);
  const step=Math.max(8,Math.min(20,radius||12));
  const samples=Math.max(1,Math.ceil(distance/step));
  for(let i=1;i<=samples;i++){
   const t=i/samples;
   if(this.isAshCircleBlocked(x1+dx*t,y1+dy*t,radius,enemy)) return true;
  }
  return false;
 }

 isSafeEnemySpawnPoint(x,y,padding=26,minPlayerDistance=120){
  const px=this.clampWorldX(x,padding+6);
  const py=this.clampWorldY(y,padding+6);
  if(this.isAshCircleBlocked(px,py,padding)) return false;

  if(this.player?.active){
   const d=Phaser.Math.Distance.Between(px,py,this.player.x,this.player.y);
   if(d<minPlayerDistance) return false;
  }

  for(const other of (this.enemies||[])){
   if(!other?.active || other.hp<=0) continue;
   const minDist=padding+(other.hitRadius||14)+10;
   if(Phaser.Math.Distance.Between(px,py,other.x,other.y)<minDist) return false;
  }
  return true;
 }

 getForwardEnemySpawnFloor(padding=26){
  // Once the player has crossed a progression gate, combat must read as
  // something waiting ahead of him — never as enemies leaking in from the
  // biome he has already left. Keep a modest distance in front of the hero
  // as well, so top/bottom edge spawns cannot visually appear behind him.
  if(!this.currentWorldZoneIndex) return this.clampWorldX(padding+6,padding+6);
  const zone=WORLD_DESIGN.ZONES[this.currentWorldZoneIndex];
  const entryGate=WORLD_DESIGN.GATES[this.currentWorldZoneIndex-1];
  const gateFloor=(entryGate?.x||zone?.start||0)+170;
  const heroFloor=(this.player?.x||0)+96;
  return this.clampWorldX(Math.max(gateFloor,heroFloor),padding+6);
 }


 getCurrentZoneEnemySpawnCeiling(padding=26){
  const zoneIndex=Phaser.Math.Clamp(this.currentWorldZoneIndex||0,0,WORLD_DESIGN.ZONES.length-1);
  const zone=WORLD_DESIGN.ZONES[zoneIndex];
  const exitGate=WORLD_DESIGN.GATES[zoneIndex];
  const boundaryX=exitGate?.x ?? zone?.end ?? STAGE0.WORLD_WIDTH;
  // Keep ordinary enemies visibly inside their own biome rather than letting
  // off-camera edge spawns appear on the far side of the progression gate.
  return this.clampWorldX(boundaryX-96,padding+6);
 }

 findSafeEnemySpawnPoint(x,y,{padding=26,minPlayerDistance=120,searchStep=30,maxRadius=360,minX=null,maxX=null}={}){
  const spawnFloor=minX??this.getForwardEnemySpawnFloor(padding);
  const spawnCeiling=maxX??this.getCurrentZoneEnemySpawnCeiling(padding);
  const safeFloor=Math.min(spawnFloor,spawnCeiling);
  const startX=Phaser.Math.Clamp(this.clampWorldX(x,padding+6),safeFloor,spawnCeiling);
  const startY=this.clampWorldY(y,padding+6);
  const startCell=this.worldToNavCell(startX,startY);
  if(this.isNavCellWalkable(startCell.col,startCell.row) && this.isSafeEnemySpawnPoint(startX,startY,padding,minPlayerDistance)){
   return {x:startX,y:startY};
  }

  const navPoint=this.findSafeNavSpawnPoint(startX,startY,{padding,minPlayerDistance,maxRadius});
  if(navPoint && navPoint.x>=safeFloor && navPoint.x<=spawnCeiling && this.isSafeEnemySpawnPoint(navPoint.x,navPoint.y,padding,minPlayerDistance)) return navPoint;

  // Navigation's generic fallback is allowed to search in every direction.
  // Zone travel is stricter: keep its last-resort search on the forward side
  // of the hero and the sealed gate as well.
  for(let radius=searchStep;radius<=maxRadius;radius+=searchStep){
   for(let step=0;step<16;step++){
    const angle=(Math.PI*2*step)/16;
    const candidateX=Phaser.Math.Clamp(this.clampWorldX(startX+Math.cos(angle)*radius,padding+6),safeFloor,spawnCeiling);
    const candidateY=this.clampWorldY(startY+Math.sin(angle)*radius,padding+6);
    if(this.isSafeEnemySpawnPoint(candidateX,candidateY,padding,minPlayerDistance)) return {x:candidateX,y:candidateY};
   }
  }

  // A crowded scene is preferable to a skeleton visibly entering from the
  // previous zone. The next spawn tick will find a clearer forward point.
  return {x:startX,y:startY};
 }

 getDevAiContext(time=this.time.now){
  const stamp=Math.floor((Number(time)||0)/80);
  if(this._devAiContext?.stamp===stamp)return this._devAiContext;
  const ordinary=(this.enemies||[]).filter(e=>e?.active&&e.hp>0&&e.type!=='champion'&&e.type!=='captain');
  const fighters=ordinary.filter(e=>e.type==='skeleton'||e.type==='shield');
  const mages=ordinary.filter(e=>e.type==='mage');
  const shields=fighters.filter(e=>e.type==='shield');
  const bosses=(this.enemies||[]).filter(e=>e?.active&&e.hp>0&&(e.type==='captain'||e.type==='champion'));
  let cx=this.player?.x||0,cy=this.player?.y||0;
  const centerActors=fighters.length?fighters:ordinary;
  if(centerActors.length){cx=centerActors.reduce((a,e)=>a+e.x,0)/centerActors.length;cy=centerActors.reduce((a,e)=>a+e.y,0)/centerActors.length;}
  let fx=(this.player?.x||cx)-cx,fy=(this.player?.y||cy)-cy,fl=Math.hypot(fx,fy);
  if(fl<1){fx=1;fy=0;fl=1;}
  fx/=fl;fy/=fl;
  const slotMap=new Map();fighters.forEach((e,i)=>slotMap.set(e,i));
  this._devAiContext={stamp,ordinary,fighters,mages,shields,bosses,slotMap,cx,cy,fx,fy,rx:-fy,ry:fx,phase:(Number(time)||0)*0.001};
  return this._devAiContext;
 }

 devAiTargetVelocity(enemy,targetX,targetY,base,multiplier=1){
  const dx=targetX-enemy.x,dy=targetY-enemy.y,d=Math.hypot(dx,dy);
  if(d<3)return {vx:0,vy:0};
  const speed=Math.max(20,base*multiplier);
  return {vx:dx/d*speed,vy:dy/d*speed};
 }

 setEnemySteeredVelocity(enemy,vx,vy,time,formationTarget=null){
  const traceNavigationAt=this.devTools?.isPerformanceTraceActive?.()?performance.now():0;
  try{
  if(!enemy?.body){return;}
  if(this.devFlags?.noCollision){enemy.body.setVelocity(vx,vy);return;}

  // DEV AI laboratory: 20 tactical steering experiments for ordinary enemies.
  // Captains and champions keep their authored behaviour so we can test escorts around them.
  const devAiMode=this.devFlags?.enemyAiMode||'normal';
  if(devAiMode!=='normal' && (enemy.type==='skeleton'||enemy.type==='shield') && this.player?.active){
   const ctx=this.getDevAiContext(time);
   const slot=ctx.slotMap.get(enemy)??0;
   const count=Math.max(1,ctx.fighters.length);
   const dx=this.player.x-enemy.x,dy=this.player.y-enemy.y,dist=Math.max(1,Math.hypot(dx,dy));
   const nx=dx/dist,ny=dy/dist;
   const base=Math.max(55,Math.hypot(vx,vy)||enemy.speed||80);
   const phase=ctx.phase;
   const to=(x,y,m=1)=>this.devAiTargetVelocity(enemy,x,y,base,m);
   const apply=(v)=>{vx=v.vx;vy=v.vy;};
   const orbit=(cx,cy,radius,sign=1,tangent=0.9,radialScale=110)=>{
    const ox=cx-enemy.x,oy=cy-enemy.y,od=Math.max(1,Math.hypot(ox,oy));
    const onx=ox/od,ony=oy/od;
    const radial=Phaser.Math.Clamp((od-radius)/radialScale,-0.9,0.9);
    return {vx:(onx*radial+(-ony)*sign*tangent)*base,vy:(ony*radial+onx*sign*tangent)*base};
   };
   const triangularSlot=()=>{let row=0,start=0;while(slot>=start+row+1&&row<12){start+=row+1;row++;}return {row,pos:slot-start};};

   if(devAiMode==='aggressive'){
    vx=nx*base*1.34;vy=ny*base*1.34;
   }else if(devAiMode==='surround'){
    const sign=enemy.devOrbitSign||(enemy.devOrbitSign=Math.random()<0.5?-1:1);
    const desired=160+((slot%5)-2)*13;
    apply(orbit(this.player.x,this.player.y,desired,sign,0.92));
   }else if(devAiMode==='wedge'){
    const q=triangularSlot(),lateral=(q.pos-q.row/2)*52,depth=92+q.row*48;
    apply(to(this.player.x-ctx.fx*depth+ctx.rx*lateral,this.player.y-ctx.fy*depth+ctx.ry*lateral,1.03));
   }else if(devAiMode==='pincer'){
    const side=slot%2===0?-1:1,lane=Math.floor(slot/2)%5;
    const lateral=(dist<185?68:175)+lane*12,depth=dist<185?34:80;
    apply(to(this.player.x-ctx.fx*depth+ctx.rx*side*lateral,this.player.y-ctx.fy*depth+ctx.ry*side*lateral,1.08));
   }else if(devAiMode==='protectMages'){
    if(enemy.type==='mage'){
     apply(orbit(this.player.x,this.player.y,285,enemy.devOrbitSign||(enemy.devOrbitSign=Math.random()<0.5?-1:1),0.60));
    }else if(ctx.mages.length){
     const mage=ctx.mages[slot%ctx.mages.length];
     let mx=this.player.x-mage.x,my=this.player.y-mage.y,ml=Math.max(1,Math.hypot(mx,my));mx/=ml;my/=ml;
     const lane=((Math.floor(slot/Math.max(1,ctx.mages.length))%5)-2)*34;
     apply(to(mage.x+mx*74-my*lane,mage.y+my*74+mx*lane,1.02));
    }else apply(orbit(this.player.x,this.player.y,180,slot%2?1:-1,0.78));
   }else if(devAiMode==='protectBoss'){
    const boss=ctx.bosses[0];
    if(boss){
     let bx=this.player.x-boss.x,by=this.player.y-boss.y,bl=Math.max(1,Math.hypot(bx,by));bx/=bl;by/=bl;
     const lane=((slot%7)-3)*30,depth=enemy.type==='mage'?145:82;
     apply(to(boss.x+bx*depth-by*lane,boss.y+by*depth+bx*lane,1.05));
    }else apply(orbit(this.player.x,this.player.y,175,slot%2?1:-1,0.82));
   }else if(devAiMode==='shieldWall'){
    const lane=((slot%7)-3)*48;
    const depth=enemy.type==='shield'?108:enemy.type==='mage'?245:166;
    apply(to(this.player.x-ctx.fx*depth+ctx.rx*lane,this.player.y-ctx.fy*depth+ctx.ry*lane,enemy.type==='shield'?0.92:1));
   }else if(devAiMode==='phalanx'){
    const cols=5,row=Math.floor(slot/cols),col=(slot%cols)-(cols-1)/2;
    const depth=112+row*48,lateral=col*50;
    apply(to(this.player.x-ctx.fx*depth+ctx.rx*lateral,this.player.y-ctx.fy*depth+ctx.ry*lateral,0.98));
   }else if(devAiMode==='spearhead'){
    const q=triangularSlot(),lateral=(q.pos-q.row/2)*34,depth=78+q.row*39;
    apply(to(this.player.x-ctx.fx*depth+ctx.rx*lateral,this.player.y-ctx.fy*depth+ctx.ry*lateral,1.18));
   }else if(devAiMode==='column'){
    const depth=82+slot*37,lateral=(slot%2===0?-1:1)*Math.min(12,slot*1.5);
    apply(to(this.player.x-ctx.fx*depth+ctx.rx*lateral,this.player.y-ctx.fy*depth+ctx.ry*lateral,1.02));
   }else if(devAiMode==='echelonLeft' || devAiMode==='echelonRight'){
    const side=devAiMode==='echelonLeft'?-1:1;
    const depth=94+slot*31,lateral=side*slot*31;
    apply(to(this.player.x-ctx.fx*depth+ctx.rx*lateral,this.player.y-ctx.fy*depth+ctx.ry*lateral,1.01));
   }else if(devAiMode==='doubleRing'){
    const outer=slot%2===1,radius=outer?245:145,sign=outer?-1:1;
    apply(orbit(this.player.x,this.player.y,radius,sign,outer?0.72:0.96));
   }else if(devAiMode==='spiral'){
    const radius=105+(slot*23)%205;
    const angle=phase*0.58+slot*0.92;
    apply(to(this.player.x+Math.cos(angle)*radius,this.player.y+Math.sin(angle)*radius,1.02));
   }else if(devAiMode==='crescent'){
    const baseAngle=Math.atan2(ctx.cy-this.player.y,ctx.cx-this.player.x);
    const t=count<=1?0:(slot/(count-1)-0.5)*2;
    const angle=baseAngle+t*1.20,radius=150+Math.abs(t)*55;
    apply(to(this.player.x+Math.cos(angle)*radius,this.player.y+Math.sin(angle)*radius,1.04));
   }else if(devAiMode==='swarm'){
    const seed=enemy.devAiSeed??(enemy.devAiSeed=Math.random()*10);
    const jitter=Math.sin(phase*3.2+seed)*0.58;
    const ca=Math.cos(jitter),sa=Math.sin(jitter);
    vx=(nx*ca-ny*sa)*base*1.12;vy=(nx*sa+ny*ca)*base*1.12;
   }else if(devAiMode==='wave'){
    const lateral=((slot%9)-4)*34+Math.sin(phase*2.3+slot*0.72)*62;
    const depth=105+Math.floor(slot/9)*52;
    apply(to(this.player.x-ctx.fx*depth+ctx.rx*lateral,this.player.y-ctx.fy*depth+ctx.ry*lateral,1.07));
   }else if(devAiMode==='flank'){
    const side=slot%2===0?-1:1;
    const wide=245+(slot%4)*28;
    const flankX=this.player.x-ctx.fx*40+ctx.rx*side*wide,flankY=this.player.y-ctx.fy*40+ctx.ry*side*wide;
    const fd=Math.hypot(flankX-enemy.x,flankY-enemy.y);
    if(fd<75)enemy.devFlankCommitted=true;
    if(enemy.devFlankCommitted){vx=nx*base*1.15;vy=ny*base*1.15;}
    else apply(to(flankX,flankY,1.12));
   }else if(devAiMode==='skirmish'){
    const sign=slot%2===0?-1:1,pulse=Math.sin(phase*1.8+slot*0.83);
    const desired=220+pulse*55;
    const radial=Phaser.Math.Clamp((dist-desired)/85,-1,1);
    vx=(nx*radial+(-ny)*sign*0.78)*base;vy=(ny*radial+nx*sign*0.78)*base;
   }else if(devAiMode==='reserve'){
    const role=slot%3;
    if(role===0){vx=nx*base*1.18;vy=ny*base*1.18;}
    else apply(orbit(this.player.x,this.player.y,role===1?225:330,slot%2?1:-1,role===1?0.64:0.48));
   }
  }

  const environmentAiMode=this.devFlags?.environmentAiMode||'normal';
  if(environmentAiMode!=='normal'&&this.player?.active){
   if(environmentAiMode==='mageCover'&&enemy.type==='mage'){
    const blockers=(this.devEnvironmentColliders||[]).filter(b=>b?.active&&b.body?.enable&&Phaser.Math.Distance.Between(enemy.x,enemy.y,b.x,b.y)<520);
    if(blockers.length){
     blockers.sort((a,b)=>Phaser.Math.Distance.Between(enemy.x,enemy.y,a.x,a.y)-Phaser.Math.Distance.Between(enemy.x,enemy.y,b.x,b.y));
     const cover=blockers[0],awayX=cover.x-this.player.x,awayY=cover.y-this.player.y,awayLen=Math.max(1,Math.hypot(awayX,awayY));
     const targetX=cover.x+awayX/awayLen*62,targetY=cover.y+awayY/awayLen*62;
     const v=this.devAiTargetVelocity(enemy,targetX,targetY,Math.max(55,enemy.speed||75),.92);vx=v.vx;vy=v.vy;
    }
   }else if(environmentAiMode==='shieldChoke'&&enemy.type==='shield'){
    const gates=WORLD_DESIGN.GATES||[];let gate=null,best=Infinity;for(const g of gates){const d=Math.abs((g.x||0)-enemy.x);if(d<best&&d<760){best=d;gate=g;}}
    if(gate){const shields=(this.enemies||[]).filter(e=>e?.active&&e.type==='shield'),slot=Math.max(0,shields.indexOf(enemy)),lane=((slot%5)-2)*42;const v=this.devAiTargetVelocity(enemy,gate.x-55,WORLD_DESIGN.ROUTE_Y+lane,Math.max(55,enemy.speed||75),.9);vx=v.vx;vy=v.vy;}
   }
  }

  const speed=Math.hypot(vx,vy);
  if(speed<1){enemy.body.setVelocity(0,0);return;}
  this.updateEnemyStuckState(enemy,time,speed);

  const radius=(enemy.hitRadius||14)+5;
  const inputAngle=Math.atan2(vy,vx);
  let desiredAngle=inputAngle;
  const toPlayerX=(this.player?.x??enemy.x)-enemy.x;
  const toPlayerY=(this.player?.y??enemy.y)-enemy.y;
  const towardPlayer=(vx*toPlayerX+vy*toPlayerY)>0;

  // Local obstacle/A* probing is substantially more expensive than assigning a
  // velocity. Reuse a proven steering decision for a very short window before
  // even entering navigation. Physics keeps movement smooth between decisions.
  const previousAngle=Number.isFinite(enemy.cachedSteerAngle)?enemy.cachedSteerAngle:null;
  const inputAngleDelta=previousAngle===null?Math.PI:Math.abs(Phaser.Math.Angle.Wrap(inputAngle-(enemy.cachedInputAngle??inputAngle)));
  const closeToPlayer=(toPlayerX*toPlayerX+toPlayerY*toPlayerY)<360*360;
  const rescueNavigation=Boolean(enemy.navRescueActive && time<(enemy.navRescueUntil||0));
  const probeInterval=rescueNavigation?24:(closeToPlayer?50:90);
  const canReuse=previousAngle!==null && !enemy.navForceRepath && time<(enemy.localSteerProbeAt||0) && inputAngleDelta<(rescueNavigation?0.14:0.26);
  if(canReuse){
   enemy.body.setVelocity(Math.cos(previousAngle)*speed,Math.sin(previousAngle)*speed);
   return;
  }
  enemy.cachedInputAngle=inputAngle;

  // Global A* routing is used only while pursuing the player. Retreating mages
  // keep their direct/local-steering behaviour and do not try to path back toward him.
  const bypassAltarNavigation=Boolean(enemy?.type==='champion' && enemy.championKind==='brokenSaint' && enemy.ignoreAshAltarCollision);
  if(towardPlayer && this.player?.active && !bypassAltarNavigation){
   const goal=formationTarget||this.player;
   const waypoint=this.getEnemyNavigationWaypoint(enemy,time,goal.x,goal.y,radius);
   if(waypoint){
    desiredAngle=Phaser.Math.Angle.Between(enemy.x,enemy.y,waypoint.x,waypoint.y);
   }
  }

  const probeDistance=Math.max(34,radius*1.55+speed*0.16);
  const probeX=enemy.x+Math.cos(desiredAngle)*probeDistance;
  const probeY=enemy.y+Math.sin(desiredAngle)*probeDistance;

  if(!this.isAshPathBlocked(enemy.x,enemy.y,probeX,probeY,radius,enemy)){
   enemy.obstacleSteerUntil=0;
   enemy.cachedSteerAngle=desiredAngle;
   enemy.localSteerProbeAt=time+probeInterval;
   enemy.body.setVelocity(Math.cos(desiredAngle)*speed,Math.sin(desiredAngle)*speed);
   return;
  }

  if(!enemy.obstacleTurnSign || time>=(enemy.obstacleSteerUntil||0)){
   const leftAngle=desiredAngle-Math.PI*0.38;
   const rightAngle=desiredAngle+Math.PI*0.38;
   const leftBlocked=this.isAshPathBlocked(enemy.x,enemy.y,enemy.x+Math.cos(leftAngle)*probeDistance,enemy.y+Math.sin(leftAngle)*probeDistance,radius,enemy);
   const rightBlocked=this.isAshPathBlocked(enemy.x,enemy.y,enemy.x+Math.cos(rightAngle)*probeDistance,enemy.y+Math.sin(rightAngle)*probeDistance,radius,enemy);
   if(leftBlocked!==rightBlocked) enemy.obstacleTurnSign=leftBlocked?1:-1;
   else {
    const target=enemy.navPath?.[enemy.navPathIndex||0]||this.player;
    const leftD=Phaser.Math.Distance.Squared(enemy.x+Math.cos(leftAngle)*probeDistance,enemy.y+Math.sin(leftAngle)*probeDistance,target.x,target.y);
    const rightD=Phaser.Math.Distance.Squared(enemy.x+Math.cos(rightAngle)*probeDistance,enemy.y+Math.sin(rightAngle)*probeDistance,target.x,target.y);
    enemy.obstacleTurnSign=leftD<=rightD?-1:1;
   }
   enemy.obstacleSteerUntil=time+300;
  }

  const sign=enemy.obstacleTurnSign||1;
  const turns=[0.28,0.42,0.58,0.74,0.92,1.0];
  for(const fraction of turns){
   for(const direction of [sign,-sign]){
    const angle=desiredAngle+direction*Math.PI*fraction;
    const tx=enemy.x+Math.cos(angle)*probeDistance;
    const ty=enemy.y+Math.sin(angle)*probeDistance;
    if(this.isAshPathBlocked(enemy.x,enemy.y,tx,ty,radius,enemy)) continue;
    enemy.obstacleTurnSign=direction;
    enemy.cachedSteerAngle=angle;
    enemy.localSteerProbeAt=time+probeInterval;
    enemy.body.setVelocity(Math.cos(angle)*speed,Math.sin(angle)*speed);
    return;
   }
  }

  // Hard stop only as a last resort; the stuck detector will force a fresh A* path.
  enemy.navForceRepath=true;
  enemy.navNextRepathAt=0;
  enemy.cachedSteerAngle=null;
  enemy.localSteerProbeAt=time+35;
  enemy.body.setVelocity(0,0);
  }finally{
   if(traceNavigationAt)this.devTools?.recordSubsystemTime?.('navigation',performance.now()-traceNavigationAt);
  }
 }

 createAshLandmarkBlocker(objects,x,y,width,height,name){
  const blocker=this.add.zone(x,y,width,height);
  blocker.ashLandmarkName=name;
  this.ashLandmarkColliderGroup.add(blocker);
  if(blocker.body){
   blocker.body.setSize(width,height);
   blocker.body.updateFromGameObject();
  }
  objects.push(blocker);
  this.devEnvironmentColliders.push(blocker);
  this.markNavigationDirty();
  return blocker;
 }

 getAshBlockerBounds(blocker,padding=0){
  if(!blocker || !blocker.body) return null;
  const body=blocker.body;
  const left=('left' in body) ? body.left : blocker.x-body.width*0.5;
  const right=('right' in body) ? body.right : blocker.x+body.width*0.5;
  const top=('top' in body) ? body.top : blocker.y-body.height*0.5;
  const bottom=('bottom' in body) ? body.bottom : blocker.y+body.height*0.5;
  return {left:left-padding,right:right+padding,top:top-padding,bottom:bottom+padding};
 }

 isPointInsideAshBlocker(x,y,padding=0){
  if(!this.ashLandmarkColliderGroup) return false;
  for(const blocker of this.ashLandmarkColliderGroup.getChildren()){
   if(!blocker?.active || !blocker.body) continue;
   const b=this.getAshBlockerBounds(blocker,padding);
   if(!b) continue;
   if(x>=b.left && x<=b.right && y>=b.top && y<=b.bottom) return true;
  }
  return false;
 }

 findNearestFreeGroundPoint(x,y,searchStep=26,maxRadius=220,padding=14){
  const startX=this.clampWorldX(x,28);
  const startY=this.clampWorldY(y,28);
  if(!this.isPointInsideAshBlocker(startX,startY,padding)) return {x:startX,y:startY};
  for(let radius=searchStep;radius<=maxRadius;radius+=searchStep){
   for(let i=0;i<24;i++){
    const angle=(Math.PI*2*i)/24;
    const px=this.clampWorldX(startX+Math.cos(angle)*radius,28);
    const py=this.clampWorldY(startY+Math.sin(angle)*radius,28);
    if(!this.isPointInsideAshBlocker(px,py,padding)) return {x:px,y:py};
   }
  }
  return {x:startX,y:startY};
 }

 
addAshLandmarkCollision(objects,landmark,key){
 landmark.worldPhysicsClass='blocking';
 landmark.devLinkedColliders=[];
 const displayW=Math.max(1,landmark.displayWidth);
 const displayH=Math.max(1,landmark.displayHeight);
 const x=landmark.x;
 const y=landmark.y;

 const shapes={
  ash_landmark_sword:[
   {dx:0,dy:displayH*0.24,w:displayW*0.78,h:Math.max(44,displayH*0.30),name:'base'},
   {dx:displayW*0.02,dy:-displayH*0.07,w:displayW*0.18,h:Math.max(90,displayH*0.56),name:'blade'},
   {dx:displayW*0.18,dy:-displayH*0.30,w:displayW*0.20,h:Math.max(34,displayH*0.12),name:'hilt'}
  ],
  ash_landmark_altar:[
   {dx:0,dy:displayH*0.15,w:displayW*0.74,h:Math.max(40,displayH*0.30),name:'base'},
   {dx:-displayW*0.22,dy:-displayH*0.10,w:displayW*0.20,h:Math.max(36,displayH*0.32),name:'left_mass'},
   {dx:displayW*0.22,dy:-displayH*0.08,w:displayW*0.20,h:Math.max(34,displayH*0.28),name:'right_mass'},
   {dx:0,dy:-displayH*0.24,w:displayW*0.48,h:Math.max(28,displayH*0.20),name:'crown'}
  ]
 };

 for(const shape of (shapes[key]||[])){
  landmark.devLinkedColliders.push(
   this.createAshLandmarkBlocker(objects,x+shape.dx,y+shape.dy,shape.w,shape.h,key+'_'+shape.name)
  );
 }
}

createAshPropShadow(objects,prop,kind){
  if(kind==='grass') return;
  const displayW=Math.max(1,prop.displayWidth);
  const displayH=Math.max(1,prop.displayHeight);
  const isLarge=(kind==='tree' ? displayH>=150 : displayW>=95);

  // Build 1.3.14.2: readable contact shadow. Still restrained, but large props
  // now visibly sit on the ground instead of looking pasted onto the tile.
  const shadowW=displayW*(kind==='tree' ? (isLarge?0.98:0.80) : (isLarge?1.02:0.84));
  const shadowH=Math.max(10,displayH*(kind==='tree' ? (isLarge?0.16:0.11) : (isLarge?0.22:0.15)));
  const shadowX=prop.x+displayW*(isLarge?0.035:0.02);
  const shadowY=prop.y+displayH*(kind==='tree' ? 0.43 : 0.35);
  const outerAlpha=kind==='tree' ? (isLarge?0.31:0.23) : (isLarge?0.29:0.21);

  const shadow=this.add.ellipse(shadowX,shadowY,shadowW,shadowH,0x0a0807,outerAlpha)
   .setDepth(-45);
  const core=this.add.ellipse(
   shadowX-displayW*0.02,
   shadowY+Math.max(1,displayH*0.008),
   shadowW*(kind==='tree'?0.72:0.78),
   Math.max(7,shadowH*0.54),
   0x000000,
   outerAlpha*0.62
  ).setDepth(-45);
  objects.push(shadow,core);
  prop.devLinkedShadows=[shadow,core];
  this.devEnvironmentShadows.push(shadow,core);
  return prop.devLinkedShadows;
 }

 addAshPropCollision(objects,prop,kind,key){
  prop.devLinkedColliders=[];
  prop.worldPhysicsClass=this.getAshPropPhysicsClass(prop,kind);
  if(prop.worldPhysicsClass!=='blocking') return;
  const displayW=Math.max(1,prop.displayWidth);
  const displayH=Math.max(1,prop.displayHeight);
  const isLarge=(kind==='tree' ? displayH>=150 : displayW>=95);

  if(isLarge){
   // Large scenery is a real obstacle now. One broad base collider plus a tall
   // vertical body collider prevents the hero from walking through the visual.
   // The vertical collider deliberately reaches through almost the full visible
   // height while staying narrower than the transparent sprite bounds.
   if(kind==='tree'){
    const baseW=displayW*0.68;
    const baseH=Math.max(30,displayH*0.24);
    const baseY=prop.y+displayH*0.36;
    prop.devLinkedColliders.push(this.createAshLandmarkBlocker(objects,prop.x,baseY,baseW,baseH,key+'_base'));

    const verticalW=displayW*0.54;
    const verticalH=Math.max(80,displayH*0.82);
    const verticalY=prop.y-displayH*0.015;
    prop.devLinkedColliders.push(this.createAshLandmarkBlocker(objects,prop.x,verticalY,verticalW,verticalH,key+'_vertical'));
   }else{
    const baseW=displayW*0.94;
    const baseH=Math.max(28,displayH*0.38);
    const baseY=prop.y+displayH*0.27;
    prop.devLinkedColliders.push(this.createAshLandmarkBlocker(objects,prop.x,baseY,baseW,baseH,key+'_base'));

    const verticalW=displayW*0.82;
    const verticalH=Math.max(54,displayH*0.78);
    const verticalY=prop.y-displayH*0.015;
    prop.devLinkedColliders.push(this.createAshLandmarkBlocker(objects,prop.x,verticalY,verticalW,verticalH,key+'_vertical'));
   }
   return;
  }

  // Smaller rocks / trees keep a forgiving footprint so the route does not feel cramped.
  const width=displayW*(kind==='tree'?0.42:0.72);
  const height=Math.max(20,displayH*(kind==='tree'?0.16:0.28));
  const y=prop.y+displayH*(kind==='tree'?0.39:0.31);
  prop.devLinkedColliders.push(this.createAshLandmarkBlocker(objects,prop.x,y,width,height,key));
 }

 
createAshLandmarkShadow(objects,landmark,key){
 const displayW=Math.max(1,landmark.displayWidth);
 const displayH=Math.max(1,landmark.displayHeight);
 const isSword=key==='ash_landmark_sword';
 const shadowX=landmark.x+displayW*(isSword?0.02:0.01);
 const shadowY=landmark.y+displayH*(isSword?0.28:0.24);
 const shadowW=displayW*(isSword?0.76:0.84);
 const shadowH=Math.max(24,displayH*(isSword?0.14:0.18));
 const outerAlpha=isSword?0.33:0.28;

 const outer=this.add.ellipse(shadowX,shadowY,shadowW,shadowH,0x090706,outerAlpha)
  .setDepth(-29);
 const core=this.add.ellipse(
  shadowX-displayW*0.018,
  shadowY+displayH*0.01,
  shadowW*0.72,
  shadowH*0.50,
  0x000000,
  outerAlpha*0.62
 ).setDepth(-29);
 objects.push(outer,core);
 landmark.devLinkedShadows=[outer,core];
 this.devEnvironmentShadows.push(outer,core);
 return landmark.devLinkedShadows;
}

createAshCluster(objects,anchorX,anchorY,clusterKey,segmentId='ash',instanceIndex=0){
 const items=ASH_FIELDS_CLUSTER_LIBRARY[clusterKey]||[];
 items.forEach((item,itemIndex)=>{
  if(!this.textures.exists(item.key)) return;
  const sprite=this.add.image(anchorX+item.ox,anchorY+item.oy,item.key)
   .setDepth(item.kind==='grass'?-46:-44)
   .setScale(item.scale)
   .setAlpha(item.alpha ?? 1)
   .setRotation(item.rotation ?? 0);
  if(item.flipX) sprite.setFlipX(true);
  objects.push(sprite);
  this.createAshPropShadow(objects,sprite,item.kind);
  this.addAshPropCollision(objects,sprite,item.kind,item.key);
  this.registerDevEnvironmentObject(sprite,{
   id:`${segmentId}:cluster${instanceIndex}:item${itemIndex}`,
   segment:segmentId,cluster:clusterKey,kind:item.kind,key:item.key,landmark:false
  });
 });
}


createAshFieldsBakedLayout(objects){
 const entries=Object.entries(ASH_FIELDS_BAKED_LAYOUT.objects||{});
 for(const [id,state] of entries){
  if(!state || state.deleted || !this.textures.exists(state.key)) continue;
  const kind=state.kind || (state.key?.includes('tree_')?'tree':state.key?.includes('rock_')?'rock':state.key?.includes('landmark_')?'landmark':'grass');
  const landmark=Boolean(state.landmark)||kind==='landmark';
  const prop=(state.key==='ash_landmark_sword'?this.add.sprite(state.x,state.y,state.key):this.add.image(state.x,state.y,state.key))
   .setDepth(landmark?-28:(kind==='grass'?-46:-44))
   .setScale(Math.max(0.01,Number(state.scale)||1))
   .setAlpha(state.alpha??(kind==='grass'?0.40:0.96))
   .setRotation(state.rotation??0);
  if(state.flipX) prop.setFlipX(true);
  objects.push(prop);
  if(landmark){
   this.createAshLandmarkShadow(objects,prop,state.key);
   this.worldLandmarkObjects.push(prop);
   this.addAshLandmarkCollision(objects,prop,state.key);
  }else{
   this.createAshPropShadow(objects,prop,kind);
   this.addAshPropCollision(objects,prop,kind,state.key);
  }
  this.registerDevEnvironmentObject(prop,{
   id,segment:state.segment||'ash',cluster:null,kind,key:state.key,landmark,created:false
  });
  if(state.key==='ash_landmark_sword') this.registerAshSwordPulseLandmark(prop,objects);
 }
}


createAshFieldsSegment(objects,segment){
 (segment.clusters||[]).forEach((instance,instanceIndex)=>{
  this.createAshCluster(objects,instance.x,instance.y,instance.cluster,segment.id,instanceIndex);
 });

 (segment.landmarks||[]).forEach(({key,x,y,scale,rotation},landmarkIndex)=>{
  if(!this.textures.exists(key)) return;
  const landmark=(key==='ash_landmark_sword'?this.add.sprite(x,y,key):this.add.image(x,y,key))
   .setDepth(-28)
   .setScale(scale)
   .setRotation(rotation)
   .setAlpha(0.98);

  this.createAshLandmarkShadow(objects,landmark,key);
  objects.push(landmark);
  this.worldLandmarkObjects.push(landmark);
  this.addAshLandmarkCollision(objects,landmark,key);
  this.registerDevEnvironmentObject(landmark,{
   id:`${segment.id}:landmark${landmarkIndex}`,segment:segment.id,cluster:null,kind:'landmark',key,landmark:true
  });
  if(key==='ash_landmark_sword') this.registerAshSwordPulseLandmark(landmark,objects);
 });
}

registerAshSwordPulseLandmark(landmark,objects=[]){
 if(!landmark?.active || landmark.texture?.key!=='ash_landmark_sword') return null;
 this.ashSwordLandmark=landmark;
 if(this.ashSwordPulseOverlay?.active) return this.ashSwordPulseOverlay;
 if(!this.textures.exists('ash_sword_pulse_01')) return null;

 // Replace the texture of the ONE landmark sprite; never draw a second sword.
 const width=landmark.displayWidth;
 const bottom=landmark.y+landmark.displayHeight*(1-landmark.originY);
 landmark.setTexture('ash_sword_pulse_01_cutout').setDisplaySize(width,width*1086/1448)
  .setAlpha(1).setBlendMode(Phaser.BlendModes.NORMAL);
 landmark.y=bottom-landmark.displayHeight*(1-landmark.originY);
 this.ashSwordPulseOverlay=landmark;
 return landmark;
}

registerDevEnvironmentObject(object,meta){
 if(!object) return;
 object.devEnvMeta={...meta};
 object.devInitialState={
  x:object.x,y:object.y,scaleX:object.scaleX,scaleY:object.scaleY,rotation:object.rotation,
  alpha:object.alpha,flipX:Boolean(object.flipX),visible:object.visible,deleted:false
 };
 const baseScale=Math.max(0.0001,Math.abs(object.scaleX||1));
 const capture=(link,type)=>{
  if(!link) return;
  link.devOwnerId=meta.id;
  link.devLinkBase={
   type,dx:link.x-object.x,dy:link.y-object.y,
   displayWidth:Math.max(1,link.displayWidth||link.width||1),
   displayHeight:Math.max(1,link.displayHeight||link.height||1),
   ownerScale:baseScale
  };
 };
 (object.devLinkedShadows||[]).forEach(link=>capture(link,'shadow'));
 (object.devLinkedColliders||[]).forEach(link=>capture(link,'collider'));
 this.devEnvironmentObjects.push(object);
 if(this.devTools?.applySavedOverrideToObject) this.devTools.applySavedOverrideToObject(object);
}

updateDevEnvironmentLinks(object){
 if(!object?.devInitialState) return;
 const factor=Math.max(0.02,Math.abs(object.scaleX||1)/Math.max(0.0001,Math.abs(object.devInitialState.scaleX||1)));
 const update=(link)=>{
  if(!link?.devLinkBase) return;
  const b=link.devLinkBase;
  link.setPosition(object.x+b.dx*factor,object.y+b.dy*factor);
  const w=Math.max(1,b.displayWidth*factor),h=Math.max(1,b.displayHeight*factor);
  if(b.type==='collider'){
   if(link.setSize) link.setSize(w,h);
   if(link.body){link.body.setSize(w,h);link.body.updateFromGameObject();}
  }else if(link.setDisplaySize){
   link.setDisplaySize(w,h);
  }else{
   link.width=w;link.height=h;
  }
 };
 (object.devLinkedShadows||[]).forEach(update);
 (object.devLinkedColliders||[]).forEach(update);
 this.markNavigationDirty?.();
}

createAshWoundedKnights(objects){
 const placements=[
  {type:1,x:620,y:1080,flipX:false,delay:0},
  {type:2,x:1120,y:850,flipX:true,delay:210},
  {type:3,x:1480,y:1180,flipX:false,delay:430},
  {type:1,x:2700,y:800,flipX:true,delay:650},
  {type:2,x:2860,y:1320,flipX:false,delay:880},
  {type:3,x:3750,y:760,flipX:true,delay:1120}
 ];

 const heroSource=this.textures.get('hero_socket_walk_s_01').getSourceImage();
 const heroDisplayHeight=(heroSource?.height||224)*HERO_SOCKET_VISUAL_SCALE;
 const targetWoundedHeight=heroDisplayHeight*1.25;
 // Breathing frames are aligned on a larger transparent canvas so the body
 // stays anchored while only the chest visibly expands/contracts.
 const woundedArtReferenceSize=440;
 const woundedScale=targetWoundedHeight/woundedArtReferenceSize;
 const woundedVisualSize=woundedArtReferenceSize*woundedScale;

 placements.forEach((placement,index)=>{
  const type=String(placement.type).padStart(2,'0');
  const texture=`ash_wounded_knight_${type}_00`;
  if(!this.textures.exists(texture)) return;

  const knight=this.add.sprite(placement.x,placement.y,texture)
   .setOrigin(280/540,403.2/540)
   .setScale(woundedScale)
   .setDepth(12)
   .setFlipX(Boolean(placement.flipX));

  objects.push(knight);
  knight.play({
   key:`ash_wounded_knight_${type}_breathe`,
   startFrame:index%3,
   delay:placement.delay||0,
   repeat:-1
  });

  // The collider covers the body, not the nearby weapon/blood. It is static and
  // joins the same blocker group used by player collision, enemy A* and projectiles.
  const colliderW=Math.max(46,woundedVisualSize*(placement.type===1?0.62:0.70));
  const colliderH=Math.max(24,woundedVisualSize*(placement.type===1?0.34:0.30));
  const collider=this.createAshLandmarkBlocker(
   objects,
   knight.x,
   knight.y+woundedVisualSize*0.08,
   colliderW,
   colliderH,
   `ash_wounded_knight_${type}_${index}`
  );
  knight.devLinkedColliders=[collider];

  this.registerDevEnvironmentObject(knight,{
   id:`ash:wounded_knight:${index}`,
   segment:'ash',
   cluster:null,
   kind:'wounded_knight',
   key:texture,
   landmark:false,
   created:false
  });
  this.woundedKnightInteractions?.registerKnight(knight,{
   id:`ash:wounded_knight:${index}`,
   index,
   story:index===3
  });
 });
}


createAshBattlefieldCasualties(objects){
 const heroSource=this.textures.get('hero_socket_walk_s_01').getSourceImage();
 const heroDisplayHeight=(heroSource?.height||224)*HERO_SOCKET_VISUAL_SCALE;

 const corpses=[
  {key:'ash_corpse_01',x:900,y:1235,flipX:false,targetWidth:heroDisplayHeight*1.78,colliderW:0.64,colliderH:0.34},
  {key:'ash_corpse_02',x:2380,y:1045,flipX:true,targetWidth:heroDisplayHeight*1.62,colliderW:0.60,colliderH:0.36}
 ];

 corpses.forEach((placement,index)=>{
  if(!this.textures.exists(placement.key)) return;
  const source=this.textures.get(placement.key).getSourceImage();
  const sourceW=Math.max(1,source?.width||placement.targetWidth);
  const sourceH=Math.max(1,source?.height||heroDisplayHeight);
  const scale=placement.targetWidth/sourceW;
  const sprite=this.add.image(placement.x,placement.y,placement.key)
   .setOrigin(0.5,0.86)
   .setScale(scale)
   .setDepth(11)
   .setFlipX(Boolean(placement.flipX));

  objects.push(sprite);
  const displayW=sourceW*scale;
  const displayH=sourceH*scale;
  const collider=this.createAshLandmarkBlocker(
   objects,
   sprite.x,
   sprite.y+displayH*0.01,
   Math.max(36,displayW*placement.colliderW),
   Math.max(16,displayH*placement.colliderH),
   `${placement.key}_${index}`
  );
  sprite.devLinkedColliders=[collider];

  this.registerDevEnvironmentObject(sprite,{
   id:`ash:corpse:${index}`,
   segment:'ash',
   cluster:null,
   kind:'corpse',
   key:placement.key,
   landmark:false,
   created:false
  });
 });


}

createAshFieldsEnvironment(objects,zone){
  const width=zone.end-zone.start;

  // Minimal Ash Fields ground: one plain base plus four directional edges.
  // The approved art repeats cleanly in its native orientation.
  // Do not mirror or flip tiles here: cropped + flipped edge tiles produced
  // the black lower-right gap and the horizontal seam in the lower-left area.
  const baseTexture=this.textures.get('ash_ground_base_01').getSourceImage();
  const tileW=baseTexture.width;
  const tileH=baseTexture.height;

  const cols=Math.ceil(width/tileW);
  const rows=Math.ceil(STAGE0.WORLD_HEIGHT/tileH);

  for(let row=0;row<rows;row++){
   for(let col=0;col<cols;col++){
    const x=zone.start+col*tileW;
    const y=row*tileH;
    const cropW=Math.min(tileW,zone.end-x);
    const cropH=Math.min(tileH,STAGE0.WORLD_HEIGHT-y);
    if(cropW<=0||cropH<=0) continue;

    const tile=this.add.image(x,y,'ash_ground_base_01')
     .setOrigin(0,0)
     .setDepth(-110);

    if(cropW<tileW||cropH<tileH){
     tile.setCrop(0,0,cropW,cropH);
    }
    objects.push(tile);
   }
  }

  const northTexture=this.textures.get('ash_edge_north_01').getSourceImage();
  const southTexture=this.textures.get('ash_edge_south_01').getSourceImage();
  const westTexture=this.textures.get('ash_edge_west_01').getSourceImage();
  const eastTexture=this.textures.get('ash_edge_east_01').getSourceImage();

  // North/south repeat horizontally without mirroring.
  const edgeCols=Math.ceil(width/northTexture.width);
  for(let col=0;col<edgeCols;col++){
   const x=zone.start+col*northTexture.width;
   const cropW=Math.min(northTexture.width,zone.end-x);
   if(cropW<=0) continue;

   const north=this.add.image(x,0,'ash_edge_north_01')
    .setOrigin(0,0).setDepth(-104);
   const south=this.add.image(x,STAGE0.WORLD_HEIGHT,'ash_edge_south_01')
    .setOrigin(0,1).setDepth(-104);
   if(cropW<northTexture.width){
    north.setCrop(0,0,cropW,northTexture.height);
    south.setCrop(0,0,cropW,southTexture.height);
   }
   objects.push(north,south);
  }

  // West/east repeat vertically without mirroring.
  const edgeRows=Math.ceil(STAGE0.WORLD_HEIGHT/westTexture.height);
  for(let row=0;row<edgeRows;row++){
   const y=row*westTexture.height;
   const cropH=Math.min(westTexture.height,STAGE0.WORLD_HEIGHT-y);
   if(cropH<=0) continue;

   const west=this.add.image(zone.start,y,'ash_edge_west_01')
    .setOrigin(0,0).setDepth(-103);
   const east=this.add.image(zone.end,y,'ash_edge_east_01')
    .setOrigin(1,0).setDepth(-103);
   if(cropH<westTexture.height){
    west.setCrop(0,0,westTexture.width,cropH);
    east.setCrop(0,0,eastTexture.width,cropH);
   }
   objects.push(west,east);
  }



 // Approved editor composition: exact baked positions/scales/alpha/flip for all Ash Fields props.
 // Segment definitions remain above for travel/editor grouping, but scenery itself comes from
 // ASH_FIELDS_BAKED_LAYOUT so manually adjusted individual props are preserved exactly.
 this.createAshFieldsBakedLayout(objects);
 this.createAshWoundedKnights(objects);
 this.createAshBattlefieldCasualties(objects);
}

handleStoryKnightCrowObjective(objective){
 if(!objective || objective.id!==ASH_WOUNDED_KNIGHT_STORY.objectiveId)return false;
 if(objective.targetId!==ASH_WOUNDED_KNIGHT_STORY.characterId)return false;
 return this.createAshStoryKnightCrowFlock();
}

createAshStoryKnightCrowFlock(){
 if(this.currentWorldZoneIndex!==0 || !this.textures.exists('crown_1_1'))return false;
 const flockId='ash_story_knight_crows_01';
 if(this.crowFlocks?.has(flockId))return true;

 const storyId=ASH_WOUNDED_KNIGHT_STORY.characterId;
 const knight=(this.devEnvironmentObjects||[]).find(obj=>obj?.active && obj?.devEnvMeta?.id===storyId);
 const marker=ASH_WOUNDED_KNIGHT_STORY.markerPoint||{};
 const centerX=Number(knight?.x) || Number(marker.x) || 2700;
 const centerY=Number(knight?.y) || Number(marker.y) || 800;

 // Ten deliberately spaced perches around the story knight. The empty centre
 // keeps the NPC readable and prevents birds from visually merging together.
 const placements=[
  {dx:-205,dy:-92},{dx:-118,dy:-146},{dx:-18,dy:-174},{dx:92,dy:-150},{dx:190,dy:-92},
  {dx:-220,dy:34},{dx:-148,dy:128},{dx:-28,dy:158},{dx:104,dy:132},{dx:214,dy:38}
 ];
 const flock={id:flockId,centerX,centerY,triggered:false,crows:[],storyObjective:true};
 this.crowFlocks.set(flockId,flock);
 const zoneObjects=this.loadedWorldZones.get(0)||[];
 if(!this.loadedWorldZones.has(0))this.loadedWorldZones.set(0,zoneObjects);

 placements.forEach((placement,index)=>{
  const desiredX=centerX+placement.dx+Phaser.Math.Between(-7,7);
  const desiredY=centerY+placement.dy+Phaser.Math.Between(-5,5);
  const point=this.findNearestFreeGroundPoint(desiredX,desiredY,22,110,18);
  const x=point.x,y=point.y;
  const variant=Phaser.Math.Between(1,3);
  const shadow=this.add.ellipse(x,y+4,23,8,0x000000,0.24).setDepth(5.4);
  const sprite=this.add.sprite(x,y,`crown_${variant}_1`)
   .setOrigin(0.5,0.82)
   .setScale(CROW_VISUAL_SCALE*Phaser.Math.FloatBetween(0.94,1.07))
   .setFlipX(Math.random()<0.5)
   .setDepth(7.2);
  sprite.play({key:`crown_idle_${variant}`,startFrame:index%3});
  const crow={
   flockId,index,variant,sprite,shadow,state:'idle',groundX:x,groundY:y,homeX:x,homeY:y,
   idleSide:(index%2===0?1:-1)*Phaser.Math.FloatBetween(0.75,1.2),idlePhase:index%3,
   altitude:0,launchAt:0,takeoffAt:0,flyAt:0,flightEndsAt:0,speed:0,angle:0,exitAngle:0,
   turnSign:index%2===0?1:-1,turnUntil:0,retiring:false,scatterAngle:null,maneuverQueue:[],nextManeuverAt:0
  };
  flock.crows.push(crow);
  this.crows.push(crow);
  zoneObjects.push(shadow,sprite);
 });
 return true;
}


createSwordOrbitCrowFlock(centerTarget=this.ashSwordLandmark,time=this.time.now,{playSound=true}={}){
 if(!centerTarget?.active || !this.textures.exists('crown_fly_1')) return false;
 const flockId='ash_sword_orbit_crows';
 if(this.crowFlocks?.has(flockId)) return true;
 const centerX=(Number(centerTarget.x)||0)+48;
 const centerY=(Number(centerTarget.y)||0)-112;
 const flock={id:flockId,centerX,centerY,triggered:true,orbit:true,centerTarget,audioEnabled:Boolean(playSound),crows:[]};
 this.crowFlocks.set(flockId,flock);
 this.swordOrbitCrowFlockId=flockId;
 const zoneObjects=this.loadedWorldZones.get(this.currentWorldZoneIndex)||[];
 if(!this.loadedWorldZones.has(this.currentWorldZoneIndex))this.loadedWorldZones.set(this.currentWorldZoneIndex,zoneObjects);
 const startAngle=Phaser.Math.FloatBetween(0,Math.PI*2);
 for(let index=0; index<SWORD_ORBIT_CROW_COUNT; index++){
  const orbitAngle=startAngle + (index/SWORD_ORBIT_CROW_COUNT)*Math.PI*2 + Phaser.Math.FloatBetween(-0.1,0.1);
  const orbitDirection=Math.random()<0.5?-1:1;
  const orbitRadiusX=Phaser.Math.Between(112,198);
  const orbitRadiusY=Phaser.Math.Between(58,102);
  const groundX=centerX+Math.cos(orbitAngle)*orbitRadiusX;
  const groundY=centerY+Math.sin(orbitAngle)*orbitRadiusY;
  const altitude=Phaser.Math.Between(92,138);
  const shadow=this.add.ellipse(groundX,groundY+6,18,6,0x000000,0.12).setDepth(21.2);
  const sprite=this.add.sprite(groundX,groundY-altitude,'crown_fly_1')
   .setOrigin(0.5,0.62)
   .setScale(CROW_VISUAL_SCALE*Phaser.Math.FloatBetween(0.92,1.05))
   .setDepth(24.6)
   .setFlipX(Math.random()<0.5);
  sprite.play({key:'crown_fly',startFrame:index%4,repeat:-1});
  const crow={
   flockId,index,sprite,shadow,state:'orbit',groundX,groundY,homeX:groundX,homeY:groundY,
   altitude,flyAt:time,speed:Phaser.Math.Between(82,120),angle:orbitAngle,retiring:false,
   orbitAngle,orbitDirection,orbitRadiusX,orbitRadiusY,
   orbitAngularSpeed:Phaser.Math.FloatBetween(0.78,1.22),
   orbitAltitudeBase:altitude,
   orbitAltitudePhase:Phaser.Math.FloatBetween(0,Math.PI*2),
   orbitRadialPhase:Phaser.Math.FloatBetween(0,Math.PI*2),
   orbitVerticalBias:Phaser.Math.FloatBetween(-10,10),
   orbitTargetX:groundX,
   orbitTargetY:groundY,
   orbitTargetAt:time,
   orbitTargetSpeed:Phaser.Math.Between(86,154),
   orbitTurnBias:Math.random()<0.5?-1:1,
   orbitVx:Math.cos(orbitAngle+(orbitDirection>0?Math.PI/2:-Math.PI/2))*Phaser.Math.FloatBetween(45,72),
   orbitVy:Math.sin(orbitAngle+(orbitDirection>0?Math.PI/2:-Math.PI/2))*Phaser.Math.FloatBetween(45,72)
  };
  this.pickSwordOrbitCrowWaypoint(crow,centerX,centerY,time);
  flock.crows.push(crow);
  this.crows.push(crow);
  zoneObjects.push(shadow,sprite);
 }
 if(playSound)this.startSwordOrbitCrowWingsSfx();
 return true;
}

stopSwordOrbitCrowFlock(fadeMs=180){
 const flockId=this.swordOrbitCrowFlockId;
 this.stopSwordOrbitCrowWingsSfx();
 if(!flockId || !this.crowFlocks?.has(flockId)){
  this.swordOrbitCrowFlockId=null;
  return false;
 }
 const flock=this.crowFlocks.get(flockId);
 this.swordOrbitCrowFlockId=null;
 this.crowFlocks.delete(flockId);
 if(!flock?.crows?.length) return true;
 const destroyCrow=(crow)=>this.retireCrow(crow);
 flock.crows.forEach(crow=>{
  if(!crow?.sprite?.active && !crow?.shadow?.active){
   crow.state='gone';
   return;
  }
  crow.state='orbit_retiring';
  const targets=[crow.sprite,crow.shadow].filter(o=>o?.active);
  if(!targets.length){ destroyCrow(crow); return; }
  if(fadeMs>0){
   this.tweens.add({targets,alpha:0,duration:fadeMs,onComplete:()=>destroyCrow(crow)});
  }else{
   destroyCrow(crow);
  }
 });
 return true;
}

pickSwordOrbitCrowWaypoint(crow,centerX,centerY,time=this.time.now){
 const angle=Phaser.Math.FloatBetween(0,Math.PI*2);
 const radius=Phaser.Math.Between(48,190);
 crow.orbitTargetX=centerX+Math.cos(angle)*radius*1.28;
 crow.orbitTargetY=centerY+Math.sin(angle)*radius*Phaser.Math.FloatBetween(0.50,0.72)+Phaser.Math.FloatBetween(-14,14);
 crow.orbitTargetAt=time+Phaser.Math.Between(260,760);
 crow.orbitTargetSpeed=Phaser.Math.Between(86,154);
 crow.orbitTurnBias=Math.random()<0.5?-1:1;
}

createRuinedKingdomCrowFlock(objects,zone){
 if(!zone || !this.textures.exists('crown_1_1'))return;
 const flockId='ruined_wagon_crows_01';
 if(this.crowFlocks?.has(flockId))return;

 // Keep the ambient flock only around the first burning wagon in Ruined Kingdom.
 // Birds are distributed on two loose elliptical rings so even a 20-crow flock
 // never collapses into one pile in the wagon centre.
 const centerX=zone.start+ZONE2_FIRST_WAGON_OFFSET_X;
 const centerY=WORLD_DESIGN.ROUTE_Y+ZONE2_FIRST_WAGON_OFFSET_Y;
 const birdCount=Phaser.Math.Between(CROW_FLOCK_BIRD_MIN,CROW_FLOCK_BIRD_MAX);
 const flock={id:flockId,centerX,centerY,triggered:false,crows:[]};
 this.crowFlocks.set(flockId,flock);

 const startAngle=Phaser.Math.FloatBetween(0,Math.PI*2);
 for(let index=0;index<birdCount;index++){
  const ring=index%2;
  const angle=startAngle+(index/birdCount)*Math.PI*2+Phaser.Math.FloatBetween(-0.12,0.12);
  const radiusX=(ring===0?142:224)*Phaser.Math.FloatBetween(0.88,1.12);
  const radiusY=(ring===0?82:132)*Phaser.Math.FloatBetween(0.88,1.12);
  const x=centerX+Math.cos(angle)*radiusX+Phaser.Math.Between(-8,8);
  const y=centerY+Math.sin(angle)*radiusY+Phaser.Math.Between(-6,6);
  const variant=Phaser.Math.Between(1,3);
  const flip=Math.random()<0.5;
  const shadow=this.add.ellipse(x,y+4,23,8,0x000000,0.24).setDepth(5.4);
  const sprite=this.add.sprite(x,y,`crown_${variant}_1`)
   .setOrigin(0.5,0.82)
   .setScale(CROW_VISUAL_SCALE*Phaser.Math.FloatBetween(0.94,1.08))
   .setFlipX(flip)
   .setDepth(7.2);
  sprite.play({key:`crown_idle_${variant}`,startFrame:index%3});
  const crow={
   flockId,index,variant,sprite,shadow,state:'idle',groundX:x,groundY:y,homeX:x,homeY:y,
   idleSide:(index%2===0?1:-1)*Phaser.Math.FloatBetween(0.75,1.2),
   idlePhase:Phaser.Math.Between(0,2),
   altitude:0,launchAt:0,takeoffAt:0,flyAt:0,flightEndsAt:0,speed:0,angle:0,exitAngle:0,
   turnSign:index%2===0?1:-1,turnUntil:0,retiring:false,scatterAngle:null,maneuverQueue:[],nextManeuverAt:0
  };
  flock.crows.push(crow);
  this.crows.push(crow);
  objects.push(shadow,sprite);
 }
}

scatterCrowFlock(flock,time=this.time.now){
 if(!flock || flock.triggered || !this.player?.active)return false;
 flock.triggered=true;
 this.playCrowScatterSfx();
 const shuffled=[...flock.crows].filter(crow=>crow?.sprite?.active);
 Phaser.Utils.Array.Shuffle(shuffled);
 const baseAngle=Math.atan2(flock.centerY-this.player.y,flock.centerX-this.player.x);
 const count=Math.max(1,shuffled.length);
 shuffled.forEach((crow,order)=>{
  const spread=((order/count)*Math.PI*2)+Phaser.Math.FloatBetween(-0.22,0.22);
  crow.scatterAngle=baseAngle+spread;
  crow.launchAt=time+order*Phaser.Math.Between(18,42)+Phaser.Math.Between(0,45);
  crow.state='alert';
 });
 return true;
}

beginCrowTakeoff(crow,time=this.time.now){
 if(!crow?.sprite?.active || !this.player?.active)return;
 let dx=crow.groundX-this.player.x,dy=crow.groundY-this.player.y;
 let len=Math.hypot(dx,dy);
 if(len<8){dx=crow.index%2===0?1:-1;dy=Phaser.Math.FloatBetween(-0.45,0.45);len=Math.hypot(dx,dy);}
 dx/=len;dy/=len;
 const awayAngle=Math.atan2(dy,dx);
 const preferredAngle=Number.isFinite(crow.scatterAngle)?crow.scatterAngle:awayAngle;
 crow.angle=preferredAngle+Phaser.Math.FloatBetween(-0.28,0.28);
 crow.exitAngle=preferredAngle+Phaser.Math.FloatBetween(-0.45,0.45);
 const maneuverCount=Math.random()<0.65?2:1;
 crow.maneuverQueue=[];
 for(let i=0;i<maneuverCount;i++){
  const sign=Math.random()<0.5?-1:1;
  crow.maneuverQueue.push(preferredAngle + sign*Phaser.Math.FloatBetween(0.45,1.3) + Phaser.Math.FloatBetween(-0.2,0.2));
 }
 crow.nextManeuverAt=time+CROW_TAKEOFF_MS+Phaser.Math.Between(550,1050);
 crow.speed=Phaser.Math.Between(64,84);
 crow.state='takeoff';crow.takeoffAt=time;crow.turnUntil=time+Phaser.Math.Between(620,1120);
 crow.turnSign=Math.random()<0.5?-1:1;
 crow.sprite.setOrigin(0.5,0.72).setDepth(23).setFlipX(Math.cos(crow.angle)<0).play('crown_takeoff',true);
}

beginCrowFlight(crow,time=this.time.now){
 if(!crow?.sprite?.active)return;
 crow.state='fly';crow.flyAt=time;crow.flightEndsAt=time+CROW_FLIGHT_LIFETIME_MS+Phaser.Math.Between(-900,1200);
 crow.speed=Math.max(105,crow.speed+Phaser.Math.Between(38,58));
 crow.sprite.setOrigin(0.5,0.62).setDepth(24).play('crown_fly',true);
}

retireCrow(crow){
 if(!crow)return;
 if(crow.sprite?.active)crow.sprite.destroy();
 if(crow.shadow?.active)crow.shadow.destroy();
 crow.state='gone';crow.retiring=false;
}

updateCrows(time,delta,{orbitOnly=false}={}){
 if(!this.crows?.length){this.syncCrowFlightLoopSfx(0);return;}
 const dt=Math.min(0.05,Math.max(0,delta||0)/1000);
 if(!orbitOnly)for(const flock of this.crowFlocks?.values?.()||[]){
  if(flock.triggered || !this.player?.active)continue;
  let nearest=Infinity;
  for(const crow of flock.crows){
   if(!crow?.sprite?.active)continue;
   nearest=Math.min(nearest,Phaser.Math.Distance.Between(crow.groundX,crow.groundY,this.player.x,this.player.y));
  }
  if(nearest<=CROW_TRIGGER_RADIUS)this.scatterCrowFlock(flock,time);
 }
 for(const crow of this.crows){
  const sprite=crow?.sprite;
  if(!sprite?.active)continue;
  if(orbitOnly && crow.state!=='orbit')continue;
  const frameIndex=Math.max(0,(sprite.anims?.currentFrame?.index||1)-1);
  if(crow.state==='orbit'){
   const flock=this.crowFlocks.get(crow.flockId);
   const target=flock?.centerTarget;
   if(target?.active){
    flock.centerX=target.x+48;
    flock.centerY=target.y-112;
   }
   const centerX=flock?.centerX ?? crow.homeX;
   const centerY=flock?.centerY ?? crow.homeY;
   const toWaypointX=(crow.orbitTargetX ?? crow.groundX)-crow.groundX;
   const toWaypointY=(crow.orbitTargetY ?? crow.groundY)-crow.groundY;
   const waypointDist=Math.hypot(toWaypointX,toWaypointY);
   if(time>= (crow.orbitTargetAt||0) || waypointDist<24){
    this.pickSwordOrbitCrowWaypoint(crow,centerX,centerY,time);
   }
   const desiredX=(crow.orbitTargetX ?? centerX)-crow.groundX;
   const desiredY=(crow.orbitTargetY ?? centerY)-crow.groundY;
   const desiredDist=Math.max(0.001,Math.hypot(desiredX,desiredY));
   const dirX=desiredX/desiredDist;
   const dirY=desiredY/desiredDist;
   const radialX=crow.groundX-centerX;
   const radialY=crow.groundY-centerY;
   const radialDist=Math.max(1,Math.hypot(radialX,radialY));
   const ellipseDist=Math.hypot(radialX/238,radialY/158);
   const pullStrength=ellipseDist>1 ? Phaser.Math.Clamp((ellipseDist-1)/0.42,0,1) : 0;
   const pullX=-radialX/radialDist*pullStrength;
   const pullY=-radialY/radialDist*pullStrength;
   const swirlX=(-radialY/radialDist)*0.46*crow.orbitTurnBias;
   const swirlY=(radialX/radialDist)*0.46*crow.orbitTurnBias;
   const accel=170;
   const desiredSpeed=crow.orbitTargetSpeed ?? 120;
   crow.orbitVx=(crow.orbitVx||0) + (dirX*desiredSpeed + swirlX*desiredSpeed*0.55 + pullX*desiredSpeed - (crow.orbitVx||0))*Math.min(1,dt*2.8);
   crow.orbitVy=(crow.orbitVy||0) + (dirY*desiredSpeed + swirlY*desiredSpeed*0.55 + pullY*desiredSpeed - (crow.orbitVy||0))*Math.min(1,dt*2.8);
   const currentSpeed=Math.hypot(crow.orbitVx,crow.orbitVy);
   const speedCap=186;
   if(currentSpeed>speedCap){
    crow.orbitVx=crow.orbitVx/currentSpeed*speedCap;
    crow.orbitVy=crow.orbitVy/currentSpeed*speedCap;
   }
   crow.groundX+=crow.orbitVx*dt;
   crow.groundY+=crow.orbitVy*dt;
   crow.angle=Math.atan2(crow.orbitVy||0,crow.orbitVx||1);
   crow.altitude=crow.orbitAltitudeBase+Math.sin(time*0.0042+crow.orbitAltitudePhase)*7+Math.sin(time*0.0023+crow.index*1.7)*5;
   const flapBob=frameIndex%2===0?-1:1;
   sprite.setFlipX(Math.cos(crow.angle)<0).setPosition(crow.groundX,crow.groundY-crow.altitude+flapBob);
   if(crow.shadow?.active){
    const shadowScale=Phaser.Math.Clamp(0.5-crow.altitude*0.0008,0.36,0.48);
    crow.shadow.setPosition(crow.groundX,crow.groundY+6).setScale(shadowScale,shadowScale*0.88).setAlpha(0.075);
   }
   continue;
  }
  if(crow.state==='idle' || crow.state==='alert'){
   const idleFrame=(frameIndex+(crow.idlePhase||0))%3;
   const side=[0,1.35,-0.75][idleFrame]*(crow.idleSide||1);
   const bob=[0,-1.75,0.8][idleFrame];
   sprite.setPosition(crow.groundX+side,crow.groundY+bob);
   if(crow.shadow?.active)crow.shadow.setPosition(crow.groundX+side*0.34,crow.groundY+4+bob*0.08).setAlpha(0.24);
   if(crow.state==='alert' && time>=crow.launchAt)this.beginCrowTakeoff(crow,time);
   continue;
  }
  if(crow.state==='takeoff'){
   const t=Phaser.Math.Clamp((time-crow.takeoffAt)/CROW_TAKEOFF_MS,0,1);
   const speed=crow.speed+(114-crow.speed)*t;
   crow.groundX+=Math.cos(crow.angle)*speed*dt;
   crow.groundY+=Math.sin(crow.angle)*speed*dt;
   crow.altitude=36*(1-Math.pow(1-t,2));
   const wingBob=frameIndex%2===0?-0.8:0.8;
   sprite.setFlipX(Math.cos(crow.angle)<0).setPosition(crow.groundX,crow.groundY-crow.altitude+wingBob);
   if(crow.shadow?.active){
    const ss=Math.max(0.55,1-crow.altitude/90);
    crow.shadow.setPosition(crow.groundX,crow.groundY+4).setScale(ss,ss).setAlpha(Math.max(0.08,0.24-crow.altitude*0.004));
   }
   if(t>=1)this.beginCrowFlight(crow,time);
   continue;
  }
  if(crow.state==='fly'){
   const flightAge=time-crow.flyAt;
   if(crow.maneuverQueue?.length && time>=crow.nextManeuverAt){
    crow.exitAngle=crow.maneuverQueue.shift();
    crow.turnUntil=time+Phaser.Math.Between(260,620);
    crow.turnSign=Math.random()<0.5?-1:1;
    crow.nextManeuverAt=time+Phaser.Math.Between(850,1550);
   }
   if(time<crow.turnUntil){
    crow.angle+=crow.turnSign*0.42*dt;
   } else {
    const diff=Math.atan2(Math.sin(crow.exitAngle-crow.angle),Math.cos(crow.exitAngle-crow.angle));
    crow.angle+=Phaser.Math.Clamp(diff,-0.72*dt,0.72*dt);
   }
   const accel=Math.min(1,flightAge/1200);
   const targetSpeed=Phaser.Math.Linear(118,166,accel);
   crow.speed=Phaser.Math.Linear(crow.speed,targetSpeed,Math.min(1,dt*1.8));
   crow.groundX+=Math.cos(crow.angle)*crow.speed*dt;
   crow.groundY+=Math.sin(crow.angle)*crow.speed*dt;
   crow.altitude=40+Math.sin(flightAge*0.0048+crow.index)*5.4;
   const flapBob=frameIndex%2===0?-1:1;
   sprite.setFlipX(Math.cos(crow.angle)<0).setPosition(crow.groundX,crow.groundY-crow.altitude+flapBob);
   if(crow.shadow?.active)crow.shadow.setPosition(crow.groundX,crow.groundY+4).setScale(0.52,0.44).setAlpha(0.075);
   const flock=this.crowFlocks.get(crow.flockId);
   const far=flock?Phaser.Math.Distance.Between(crow.groundX,crow.groundY,flock.centerX,flock.centerY)>1450:false;
   const outside=crow.groundX<-120||crow.groundX>STAGE0.WORLD_WIDTH+120||crow.groundY<-180||crow.groundY>STAGE0.WORLD_HEIGHT+180;
   if(!crow.retiring && (time>=crow.flightEndsAt||far||outside)){
    crow.retiring=true;
    this.tweens.add({targets:[sprite,crow.shadow].filter(o=>o?.active),alpha:0,duration:260,onComplete:()=>this.retireCrow(crow)});
   }
  }
 }
 this.crows=this.crows.filter(crow=>Boolean(crow?.sprite?.active) && crow?.state!=='gone');
 this.syncCrowFlightLoopSfx(this.countAudibleFlyingCrows());
}


createRuinedKingdomTerrainEnvironment(objects,zone){
 // Preserve the supplied artwork exactly on disk, but create matching
 // in-memory copies for Zone 2. A modest uniform lift makes the hero and
 // enemy silhouettes readable without changing the seamless tile geometry.
 const prepareLitTerrainTexture=(sourceKey)=>{
  const litKey=`${sourceKey}${ZONE2_TERRAIN_LIT_SUFFIX}`;
  if(this.textures.exists(litKey)) return litKey;
  const source=this.textures.get(sourceKey)?.getSourceImage();
  if(!source?.width || !source?.height) return sourceKey;
  const texture=this.textures.createCanvas(litKey,source.width,source.height);
  const ctx=texture?.context;
  if(!ctx) return sourceKey;
  ctx.drawImage(source,0,0);
  const frame=ctx.getImageData(0,0,source.width,source.height);
  for(let i=0;i<frame.data.length;i+=4){
   if(frame.data[i+3]===0) continue;
   frame.data[i]=Math.min(255,Math.round(frame.data[i]*ZONE2_TERRAIN_BRIGHTNESS));
   frame.data[i+1]=Math.min(255,Math.round(frame.data[i+1]*ZONE2_TERRAIN_BRIGHTNESS));
   frame.data[i+2]=Math.min(255,Math.round(frame.data[i+2]*ZONE2_TERRAIN_BRIGHTNESS));
  }
  ctx.putImageData(frame,0,0);
  texture.refresh();
  return litKey;
 };
 const terrainKeys=Object.fromEntries(ZONE2_TERRAIN_KEYS.map((key)=>[key,prepareLitTerrainTexture(key)]));
 const baseKey=terrainKeys.zone2_ground_base_01;
 if(!this.textures.exists(baseKey)) return;
 const baseTexture=this.textures.get(baseKey).getSourceImage();
 const tileW=baseTexture.width;
 const tileH=baseTexture.height;
 const width=zone.end-zone.start;

 // Same approved minimal composition as Ash Fields: native fill and four
 // cardinal borders. There are no road, corner, rotation or mirror tiles.
 for(let y=0;y<STAGE0.WORLD_HEIGHT;y+=tileH){
  for(let x=zone.start;x<zone.end;x+=tileW){
   const cropW=Math.min(tileW,zone.end-x);
   const cropH=Math.min(tileH,STAGE0.WORLD_HEIGHT-y);
   if(cropW<=0||cropH<=0) continue;
   const tile=this.add.image(x,y,baseKey).setOrigin(0,0).setDepth(-110);
   if(cropW<tileW||cropH<tileH) tile.setCrop(0,0,cropW,cropH);
   objects.push(tile);
  }
 }

 const northKey=terrainKeys.zone2_edge_north_01;
 const southKey=terrainKeys.zone2_edge_south_01;
 const westKey=terrainKeys.zone2_edge_west_01;
 const eastKey=terrainKeys.zone2_edge_east_01;
 const northTexture=this.textures.get(northKey).getSourceImage();
 const southTexture=this.textures.get(southKey).getSourceImage();
 const westTexture=this.textures.get(westKey).getSourceImage();
 const eastTexture=this.textures.get(eastKey).getSourceImage();
 for(let x=zone.start;x<zone.end;x+=northTexture.width){
  const cropW=Math.min(northTexture.width,zone.end-x);
  if(cropW<=0) continue;
  const north=this.add.image(x,0,northKey).setOrigin(0,0).setDepth(-104);
  const south=this.add.image(x,STAGE0.WORLD_HEIGHT,southKey).setOrigin(0,1).setDepth(-104);
  if(cropW<northTexture.width){
   north.setCrop(0,0,cropW,northTexture.height);
   south.setCrop(0,0,cropW,southTexture.height);
  }
  objects.push(north,south);
 }
 for(let y=0;y<STAGE0.WORLD_HEIGHT;y+=westTexture.height){
  const cropH=Math.min(westTexture.height,STAGE0.WORLD_HEIGHT-y);
  if(cropH<=0) continue;
  const west=this.add.image(zone.start,y,westKey).setOrigin(0,0).setDepth(-103);
  const east=this.add.image(zone.end,y,eastKey).setOrigin(1,0).setDepth(-103);
  if(cropH<westTexture.height){
   west.setCrop(0,0,westTexture.width,cropH);
   east.setCrop(0,0,eastTexture.width,cropH);
  }
  objects.push(west,east);
 }

 // Sparse warm points tell the player where people once tried to hold the
 // road. Orange means a human trace; the later necromantic palette stays free
 // to use its own sickly green warning language.
 const ensureSoftFireGlow=()=>{
  if(this.textures.exists(ZONE2_SOFT_FIRE_GLOW_TEXTURE)) return ZONE2_SOFT_FIRE_GLOW_TEXTURE;
  const size=192;
  const texture=this.textures.createCanvas(ZONE2_SOFT_FIRE_GLOW_TEXTURE,size,size);
  const ctx=texture?.context;
  if(!ctx) return null;
  const mid=size*0.5;
  const gradient=ctx.createRadialGradient(mid,mid,2,mid,mid,mid);
  gradient.addColorStop(0,'rgba(255,241,186,0.95)');
  gradient.addColorStop(0.14,'rgba(255,171,61,0.74)');
  gradient.addColorStop(0.42,'rgba(255,94,28,0.28)');
  gradient.addColorStop(0.72,'rgba(204,51,14,0.08)');
  gradient.addColorStop(1,'rgba(112,24,8,0)');
  ctx.clearRect(0,0,size,size);
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,size,size);
  texture.refresh();
  return ZONE2_SOFT_FIRE_GLOW_TEXTURE;
 };
 const softGlowKey=ensureSoftFireGlow();
 const roadY=WORLD_DESIGN.ROUTE_Y;
 const lightProps=[
  // These first three are deliberately on the very first Zone 2 screen.
  {prop:'campfire',x:zone.start+410,y:roadY+100,scale:0.25,glow:118},
  {prop:'torch',x:zone.start+660,y:roadY-120,scale:0.19,glow:88},
  {prop:'lantern',x:zone.start+880,y:roadY+70,scale:0.13,glow:66},
  {prop:'embers',x:zone.start+1120,y:roadY-145,scale:0.12,glow:60},
  {prop:'wagon',x:zone.start+1420,y:roadY+115,scale:0.44,glow:160},
  {prop:'torch',x:zone.start+1740,y:roadY-150,scale:0.19,glow:88},
  {prop:'campfire',x:zone.start+2080,y:roadY+145,scale:0.24,glow:116},
  {prop:'lantern',x:zone.start+2420,y:roadY-115,scale:0.12,glow:64},
  {prop:'embers',x:zone.start+2770,y:roadY+125,scale:0.11,glow:58},
  {prop:'wagon',x:zone.start+3070,y:roadY-115,scale:0.43,glow:156},
  {prop:'torch',x:zone.start+3370,y:roadY+150,scale:0.18,glow:84}
 ];
 for(const placement of lightProps){
  const firstFrame=`zone2_${placement.prop}_00`;
  if(!this.textures.exists(firstFrame)) continue;
  const glow=softGlowKey?this.add.image(placement.x,placement.y+14,softGlowKey)
   .setDisplaySize(placement.glow*2.8,placement.glow*1.62)
   .setDepth(3).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.48):null;
  const sprite=this.add.sprite(placement.x,placement.y,firstFrame)
   .setOrigin(0.5,0.82).setScale(placement.scale).setDepth(5).setVisible(true)
   .play(`zone2_${placement.prop}_burn`);
  if(
   placement.prop==='wagon' &&
   Math.abs(placement.x-(zone.start+ZONE2_FIRST_WAGON_OFFSET_X))<2
  ){
   this.zone2FirstWagonTarget=sprite;
  }
  if(glow){
   this.tweens.add({
    targets:glow,
    alpha:{from:0.36,to:0.60},
    duration:900+Math.round(placement.glow*3),
    yoyo:true,
    repeat:-1,
    ease:'Sine.easeInOut'
   });
  }
  if(placement.prop==='campfire' || placement.prop==='wagon'){
   const isWagon=placement.prop==='wagon';
   const blocker=this.createAshLandmarkBlocker(
    objects,
    placement.x,
    placement.y+sprite.displayHeight*(isWagon?0.08:0.10),
    Math.max(isWagon?88:34,sprite.displayWidth*(isWagon?0.70:0.42)),
    Math.max(isWagon?34:22,sprite.displayHeight*(isWagon?0.25:0.18)),
    `zone2_${placement.prop}_blocker`
   );
   sprite.devLinkedColliders=[blocker];
  }
  if(glow) objects.push(glow);
  objects.push(sprite);
 }

 // One ambient flock around the first burning wagon in Ruined Kingdom.
 this.createRuinedKingdomCrowFlock(objects,zone);
}



 loadWorldZone(index){
  if(index<0 || index>=WORLD_DESIGN.ZONES.length) return;
  if(this.loadedWorldZones.has(index)) return;

  const zone=WORLD_DESIGN.ZONES[index];
  const objects=[];

  if(index===0){
   this.createAshFieldsEnvironment(objects,zone);
  }
  if(index===1){
   this.createRuinedKingdomTerrainEnvironment(objects,zone);
  }

  // Until a biome receives approved art, keep its streamed chunk visually empty.
  // This prevents deleted/rejected prototype tiles and diagnostic markers from
  // appearing on the game field while preserving progression/gameplay systems.
  this.loadedWorldZones.set(index,objects);
  this.markNavigationDirty();

  if(index<WORLD_DESIGN.GATES.length){
   this.ensureProgressionGate(index);
   this.createBiomePreview(index);
  }
 }
 unloadWorldZone(index){
  if(index<0 || index>=WORLD_DESIGN.ZONES.length) return;
  if(index>=this.currentWorldZoneIndex) return;

  const objects=this.loadedWorldZones.get(index);
  if(objects){
   for(const obj of objects){
    if(obj && obj.active) obj.destroy();
   }
   this.loadedWorldZones.delete(index);
   this.markNavigationDirty();
  }

  this.releaseRetiredWorldZoneTextures(index);

  const preview=this.loadedWorldPreviews.get(index);
  if(preview){
   for(const obj of preview){
    if(obj && obj.active) obj.destroy();
   }
   this.loadedWorldPreviews.delete(index);
  }
 }

 releaseRetiredWorldZoneTextures(index){
  // Region art is one-way streamed. Once the player is sealed into the next
  // biome, none of the previous biome's images can be shown again, so release
  // their GPU textures instead of merely hiding their game objects.
  if(index!==0 || this.releasedWorldTextureZones?.has(index)) return;
  const textureKeys=getAssetsForCategories([ASSET_CATEGORY.REGION_ASH])
   .filter(entry=>entry.type==='image')
   .map(entry=>entry.key);
  releaseTextureKeys(this,textureKeys);
  if(!this.releasedWorldTextureZones) this.releasedWorldTextureZones=new Set();
  this.releasedWorldTextureZones.add(index);
 }

 createBiomePreview(fromIndex){
  if(fromIndex<0 || fromIndex>=WORLD_DESIGN.ZONES.length-1) return;
  if(this.loadedWorldPreviews.has(fromIndex)) return;

  // No preview art is drawn until approved transition assets exist on disk.
  this.loadedWorldPreviews.set(fromIndex,[]);
 }


 addWorldGateStoneBar(pieces,x1,y1,x2,y2,thickness=28,depth=-19){
  const dx=x2-x1;
  const dy=y2-y1;
  const length=Math.hypot(dx,dy);
  if(length<=0 || !this.textures.exists('cinematic_stone_bar')) return;

  const source=this.textures.get('cinematic_stone_bar').getSourceImage();
  const aspect=(source?.width && source?.height) ? source.width/source.height : 3.2;
  const segmentLength=Math.max(thickness*0.92,thickness*aspect);
  const count=Math.max(1,Math.ceil(length/segmentLength));
  const angle=Math.atan2(dy,dx);
  const ux=dx/length;
  const uy=dy/length;

  for(let i=0;i<count;i++){
   const along=Math.min(length-segmentLength/2,segmentLength*(i+0.5));
   const safeAlong=Math.max(segmentLength/2,along);
   const x=x1+ux*safeAlong;
   const y=y1+uy*safeAlong;
   const piece=this.add.image(x,y,'cinematic_stone_bar')
    .setOrigin(0.5)
    .setDepth(depth)
    .setDisplaySize(segmentLength+1,thickness)
    .setRotation(angle)
    .setFlipX(i%2===1);
   pieces.push(piece);
  }
 }

 addWorldGateStoneJoint(pieces,x,y,size=42,depth=-18){
  if(!this.textures.exists('cinematic_stone_joint')) return null;
  const joint=this.add.image(x,y,'cinematic_stone_joint')
   .setOrigin(0.5)
   .setDepth(depth)
   .setDisplaySize(size,size);
  pieces.push(joint);
  return joint;
 }

 createWorldGateBoundary(gate){
  if(!gate) return {pieces:[], openingHalfHeight:150};
  const pieces=[];
  const openingHalfHeight=154;
  const openingTop=WORLD_DESIGN.ROUTE_Y-openingHalfHeight;
  const openingBottom=WORLD_DESIGN.ROUTE_Y+openingHalfHeight;
  const topMargin=52;
  const bottomMargin=STAGE0.WORLD_HEIGHT-52;
  const thickness=30;
  const lintelHalfSpan=82;

  const shadowBand=this.add.rectangle(gate.x,STAGE0.WORLD_HEIGHT/2,68,STAGE0.WORLD_HEIGHT,0x090907,0.22).setDepth(-22);
  pieces.push(shadowBand);

  this.addWorldGateStoneBar(pieces,gate.x,topMargin,gate.x,openingTop-thickness*0.45,thickness,-19);
  this.addWorldGateStoneBar(pieces,gate.x,openingBottom+thickness*0.45,gate.x,bottomMargin,thickness,-19);
  this.addWorldGateStoneBar(pieces,gate.x-lintelHalfSpan,openingTop,gate.x+lintelHalfSpan,openingTop,thickness,-19);
  this.addWorldGateStoneBar(pieces,gate.x-lintelHalfSpan,openingBottom,gate.x+lintelHalfSpan,openingBottom,thickness,-19);

  this.addWorldGateStoneJoint(pieces,gate.x,openingTop,44,-18);
  this.addWorldGateStoneJoint(pieces,gate.x,openingBottom,44,-18);
  this.addWorldGateStoneJoint(pieces,gate.x-lintelHalfSpan,openingTop,34,-18);
  this.addWorldGateStoneJoint(pieces,gate.x+lintelHalfSpan,openingTop,34,-18);
  this.addWorldGateStoneJoint(pieces,gate.x-lintelHalfSpan,openingBottom,34,-18);
  this.addWorldGateStoneJoint(pieces,gate.x+lintelHalfSpan,openingBottom,34,-18);

  // The stone boundary is real level geometry, not decoration. Keep only the
  // central opening passable after the progression seal is removed.
  const wallWidth=58;
  const topWallHeight=Math.max(1,openingTop);
  const bottomWallHeight=Math.max(1,STAGE0.WORLD_HEIGHT-openingBottom);
  const topWall=this.add.rectangle(gate.x,topWallHeight/2,wallWidth,topWallHeight,0x000000,0).setDepth(-21);
  const bottomWall=this.add.rectangle(gate.x,openingBottom+bottomWallHeight/2,wallWidth,bottomWallHeight,0x000000,0).setDepth(-21);
  this.physics.add.existing(topWall,true);
  this.physics.add.existing(bottomWall,true);
  this.worldGateGroup.add(topWall);
  this.worldGateGroup.add(bottomWall);
  pieces.push(topWall,bottomWall);

  return {pieces,wallBlockers:[topWall,bottomWall],openingHalfHeight,openingTop,openingBottom};
 }
 ensureProgressionGate(index){
  if(index<0 || index>=WORLD_DESIGN.GATES.length) return;

  const gate=WORLD_DESIGN.GATES[index];
  if(this.worldGateObjects.has(gate.id)) return;

  const boundary=this.createWorldGateBoundary(gate);

  const blocker=this.add.rectangle(
   gate.x,
   STAGE0.WORLD_HEIGHT/2,
   34,
   STAGE0.WORLD_HEIGHT,
   0x000000,
   0
  ).setDepth(-20);

  this.physics.add.existing(blocker,true);
  this.worldGateGroup.add(blocker);

  // Keep the progression collision, but do not draw the old yellow debug-like
  // gate frame over the authored world art.
  const visible=this.add.rectangle(
   gate.x,
   WORLD_DESIGN.ROUTE_Y,
   42,
   Math.max(220,(boundary.openingHalfHeight||150)*2-24),
   0x000000,
   0
  ).setDepth(-18.6);

  const label=lkAddText(this,
   gate.x-36,
   (boundary.openingTop||WORLD_DESIGN.ROUTE_Y-150)-48,
   `LOCKED
${gate.name}`,
   {
    fontSize:'15px',
    align:'right',
    color:'#f3ead4',
    stroke:'#121612',
    strokeThickness:3
   }
  ).setOrigin(1,0.5).setDepth(-18);

  this.worldGateObjects.set(gate.id,{
   gate,
   blocker,
   visible,
   label,
   boundary,
   unlocked:false
  });
 }

 createBacktrackSeal(gate,{animate=false,silent=false}={}){
  if(!gate || this.closedWorldGates.has(gate.id)) return null;

  this.closedWorldGates.add(gate.id);

  const x=gate.x+120;
  const blocker=this.add.rectangle(
   x,
   STAGE0.WORLD_HEIGHT/2,
   42,
   STAGE0.WORLD_HEIGHT,
   0x000000,
   0
  ).setDepth(-16);

  this.physics.add.existing(blocker,true);
  this.worldGateGroup.add(blocker);

  const curtain=this.add.rectangle(
   x-170,
   STAGE0.WORLD_HEIGHT/2,
   360,
   STAGE0.WORLD_HEIGHT,
   0x101411,
   0.58
  ).setDepth(-17);

  // Physical seal remains, but the tall yellow rectangle is intentionally hidden.
  const visible=this.add.rectangle(
   x,
   WORLD_DESIGN.ROUTE_Y,
   46,
   860,
   0x000000,
   0
  ).setDepth(-15);

  const label=lkAddText(this,
   x+38,
   WORLD_DESIGN.ROUTE_Y-350,
   `PATH SEALED\n${gate.closeName}`,
   {
    fontSize:'14px',
    color:'#d9ded4',
    stroke:'#101510',
    strokeThickness:3
   }
  ).setOrigin(0,0.5).setDepth(-14);

  this.backtrackBlockers.push(blocker,curtain,visible,label);

  if(animate){
   curtain.setAlpha(0);
   visible.setAlpha(0).setScale(1,1);
   label.setAlpha(0);
   this.tweens.add({targets:curtain,alpha:1,duration:620,ease:'Sine.easeOut'});
   this.tweens.add({targets:label,alpha:1,duration:420,delay:520,ease:'Sine.easeOut'});
   this.cameras.main.shake(180,0.0035);
  }

  if(!silent){
   this.showWaveBanner(
    'THE WAY BACK IS CLOSED',
    'The journey continues forward',
    '#c8d0c2'
   );
  }
  return {blocker,curtain,visible,label};
 }

 updateRuntimeEnvironmentCulling(time=0){
  // Pure visibility optimisation: no props are removed and no collision or
  // navigation geometry changes. A generous off-camera margin makes the switch
  // impossible to see during normal movement, while far Ash Fields art is not
  // submitted to the renderer.
  if(time<(this.nextEnvironmentCullAt||0)) return;
  this.nextEnvironmentCullAt=time+180;

  const objects=this.devEnvironmentObjects||[];
  if(!objects.length) return;
  const tools=this.devTools;
  if(tools?.editMode){
   if(this.runtimeEnvironmentCullingActive){
    for(const object of objects){
     if(!object) continue;
     const baseVisible=tools?.isObjectVisibleByFilters?.(object)??(!object.devDeleted);
     object.runtimeCulled=false;
     object.setVisible(baseVisible);
     for(const shadow of object.devLinkedShadows||[]) shadow?.setVisible?.(baseVisible && (tools?.envVisibility?.shadows!==false));
    }
    this.runtimeEnvironmentCullingActive=false;
   }
   return;
  }

  const view=this.cameras?.main?.worldView;
  if(!view) return;
  const marginX=Math.max(420,view.width*0.32);
  const marginY=Math.max(300,view.height*0.45);
  const left=view.left-marginX,right=view.right+marginX,top=view.top-marginY,bottom=view.bottom+marginY;
  const shadowsAllowed=tools?.envVisibility?.shadows!==false;
  for(const object of objects){
   if(!object?.active || object.devDeleted) continue;
   const baseVisible=tools?.isObjectVisibleByFilters?.(object)??true;
   const halfW=Math.max(8,(object.displayWidth||object.width||16)*0.5);
   const halfH=Math.max(8,(object.displayHeight||object.height||16)*0.5);
   const inRange=(object.x+halfW>=left && object.x-halfW<=right && object.y+halfH>=top && object.y-halfH<=bottom);
   const visible=Boolean(baseVisible && inRange);
   const culled=Boolean(baseVisible && !inRange);
   if(object.visible!==visible) object.setVisible(visible);
   object.runtimeCulled=culled;
   for(const shadow of object.devLinkedShadows||[]){
    const shadowVisible=visible && shadowsAllowed;
    if(shadow?.visible!==shadowVisible) shadow?.setVisible?.(shadowVisible);
   }
  }
  this.runtimeEnvironmentCullingActive=true;
 }

 updateWorldStreaming(){
  const zoneIndex=this.currentWorldZoneIndex;
  const zone=WORLD_DESIGN.ZONES[zoneIndex];
  if(!zone) return;

  // Current biome must always be present.
  this.loadWorldZone(zoneIndex);
  this.updateWorldCameraBoundary();

  // Stream the next biome near the transition so it can be glimpsed beyond
  // the gate and is ready the instant the champion opens the path.
  if(zoneIndex<WORLD_DESIGN.ZONES.length-1){
   const gate=WORLD_DESIGN.GATES[zoneIndex];
   const preloadAt=gate.x-WORLD_DESIGN.PREVIEW_WIDTH-500;

   if(
    this.player.x>=preloadAt ||
    (this.pendingWorldAdvance &&
     this.pendingWorldAdvance.targetZoneIndex===zoneIndex+1)
   ){
    this.loadWorldZone(zoneIndex+1);
   }
  }

  // After walking about three quarters of a wide mobile screen into the new
  // biome, permanently seal the route behind.
  if(zoneIndex>0){
   const previousGate=WORLD_DESIGN.GATES[zoneIndex-1];
   if(
    previousGate &&
    this.player.x>=previousGate.x+WORLD_DESIGN.BACK_LOCK_DEPTH
   ){
    this.createBacktrackSeal(previousGate);
   }

   // Once the old biome is >1.5 wide mobile screens behind us, discard its
   // diagnostic environment objects. Final tiles will use the same policy.
   if(
    previousGate &&
    this.player.x>=previousGate.x+WORLD_DESIGN.UNLOAD_DEPTH &&
    this.worldCameraMinX>=this.getZoneCameraMinX(zoneIndex) &&
    this.cameras.main.worldView.left>=previousGate.x+72
   ){
    this.unloadWorldZone(zoneIndex-1);
   }
  }

  this.lastStreamingZoneIndex=zoneIndex;
 }

 bindProgressionGateCollision(){
  if(this.worldGateCollider) this.worldGateCollider.destroy();
  this.worldGateCollider=this.physics.add.collider(
   this.player,
   this.worldGateGroup
  );
 }

 getWorldZoneIndexAtX(x){
  // Gates are the progression truth. Overlap regions are assigned according
  // to the nearest progression checkpoint rather than a hard art boundary.
  if(x<WORLD_DESIGN.GATES[0].x) return 0;
  if(x<WORLD_DESIGN.GATES[1].x) return 1;
  if(x<WORLD_DESIGN.GATES[2].x) return 2;
  if(x<WORLD_DESIGN.GATES[3].x) return 3;
  return 4;
 }

 updateWorldRegion(){
  const nextIndex=this.getWorldZoneIndexAtX(this.player.x);
  if(nextIndex===this.currentWorldZoneIndex) return;

  this.currentWorldZoneIndex=nextIndex;
  // The right-hand camera wall follows the active biome. Crossing the gate is
  // the exact moment the next region becomes visible.
  this.applyWorldCameraBounds();
  this.captureZoneEntryCheckpoint();
  // The landmark keeps its silent pulse only inside the Ash Fields. It is
  // explicitly retired as soon as the hero crosses into the next zone.
  if(nextIndex>0) this.stopAshSwordAmbientAnimation();
  const zone=WORLD_DESIGN.ZONES[nextIndex];
  if(this.regionText) this.regionText.setText(zone.name);

  if(this.time.now>=this.zoneBannerCooldownUntil){
   this.zoneBannerCooldownUntil=this.time.now+900;
   this.showWaveBanner(zone.name,zone.subtitle,'#dfe7d8');
  }
 }

 unlockWorldGateForChampion(championKind){
  const entry=WORLD_DESIGN.GATES.find(g=>g.champion===championKind);
  if(!entry) return null;

  // Ensure the destination biome exists before the gate disappears.
  this.loadWorldZone(entry.toZone);
  this.ensureProgressionGate(entry.fromZone);

  const obj=this.worldGateObjects.get(entry.id);
  if(obj && !obj.unlocked){
   obj.unlocked=true;
   this.unlockedWorldGates.add(entry.id);

   if(obj.blocker && obj.blocker.active){
    this.worldGateGroup.remove(obj.blocker,false,false);
    obj.blocker.destroy();
   }

   if(obj.visible && obj.visible.active){
    this.tweens.add({
     targets:obj.visible,
     alpha:0,
     scaleX:3.4,
     duration:520,
     ease:'Quad.easeOut',
     onComplete:()=>obj.visible.destroy()
    });
   }

   if(obj.label && obj.label.active){
    obj.label.setText(`OPEN\n${entry.name}`);
    this.tweens.add({
     targets:obj.label,
     alpha:0,
     x:obj.label.x-40,
     duration:700,
     onComplete:()=>obj.label.destroy()
    });
   }
  }

  return entry;
 }

 requestWorldAdvance(championKind){
  const gate=this.unlockWorldGateForChampion(championKind);
  if(!gate) return;

  this.pendingWorldAdvance={
   gateId:gate.id,
   gateX:gate.x,
   targetZoneIndex:gate.toZone
  };
 }

 beginWorldTravel(){
  if(!this.pendingWorldAdvance) return;

  this.waveIntermission=true;
  this.awaitingWorldAdvance=true;
  this.worldAdvanceTargetZone=this.pendingWorldAdvance.targetZoneIndex;
  this.nextWaveAt=Number.POSITIVE_INFINITY;

  const zone=WORLD_DESIGN.ZONES[this.worldAdvanceTargetZone];
  this.waveSubText.setText('TRAVEL ONWARD');
  this.showWaveBanner(
   'PATH OPEN',
   `Enter ${zone.name} to continue`,
   '#cde8b4'
  );
 }

 updateWorldTravel(time){
  if(!this.awaitingWorldAdvance || !this.pendingWorldAdvance) return;

  const threshold=this.pendingWorldAdvance.gateX+360;
  if(this.player.x<threshold) return;

  const arrivedZoneIndex=this.worldAdvanceTargetZone;
  const zone=WORLD_DESIGN.ZONES[arrivedZoneIndex];
  this.awaitingWorldAdvance=false;
  this.pendingWorldAdvance=null;
  this.worldAdvanceTargetZone=null;

  this.progressionBalanceZoneIndex=arrivedZoneIndex;
  this.applyRegionalHeroBalance(arrivedZoneIndex,false);
  this.currentWorldZoneIndex=this.getWorldZoneIndexAtX(this.player.x);
  if(this.regionText) this.regionText.setText(zone.name);

  this.waveSubText.setText('NEW REGION');
  const regionBalance=this.getRegionBalance(arrivedZoneIndex);
  this.showWaveBanner(
   zone.name,
   `${zone.subtitle} · Max HP ${this.player.maxHp} · melee +${regionBalance.meleeDamageBonus}`,
   '#e2eadb'
  );

  if(this.ashAltarObjectiveMarker){
   this.ashAltarObjectiveMarker.clearTarget?.();
   this.ashAltarObjectiveMarker.hide?.();
  }
  if(this.brokenSaintSwordEpilogue){
   this.brokenSaintSwordEpilogue=null;
  }

  // Zone 2 has an authored arrival beat before Wave 6: the old gate closes,
  // then the player follows the marker to the first burning wagon and startles
  // the crows. Later zones retain the direct travel -> combat flow.
  if(arrivedZoneIndex===1){
   this.beginZone2ArrivalSequence({restart:false});
  }else{
   this.startZoneWaveSequence(arrivedZoneIndex,{delay:1250,suppressBanner:false});
  }
 }

 getZone2FirstWagonPoint(){
  const zone=WORLD_DESIGN.ZONES[1];
  const sprite=this.zone2FirstWagonTarget;
  if(sprite?.active)return {x:sprite.x,y:sprite.y};
  return {
   x:zone.start+ZONE2_FIRST_WAGON_OFFSET_X,
   y:WORLD_DESIGN.ROUTE_Y+ZONE2_FIRST_WAGON_OFFSET_Y
  };
 }

 beginZone2ArrivalSequence({restart=false}={}){
  if(this.currentWorldZoneIndex!==1)return false;
  const existing=this.zone2ArrivalSequence;
  if(existing && existing.phase!=='complete')return true;

  // Zone 2 owns its own arrival state. Never carry the Ash Fields sword beat
  // across the gate, including on a zone restart.
  this.stopAshSwordPulseSfx();
  this.brokenSaintSwordEpilogue=null;
  this.awaitingWorldAdvance=false;
  this.pendingWorldAdvance=null;
  this.worldAdvanceTargetZone=null;
  this.waveIntermission=true;
  this.nextWaveAt=Number.POSITIVE_INFINITY;
  this.wave=0;
  this.spawned=0;
  this.waveTarget=0;
  this.waveProfile=null;
  this.postWaveChampionKind=null;
  this.championEventActive=false;

  this.progressionBalanceZoneIndex=1;
  this.applyRegionalHeroBalance(1,false);
  this.regionText?.setText(WORLD_DESIGN.ZONES[1].name);
  this.waveText?.setText('WAVE 6');
  this.waveSubText?.setText('ARRIVAL');

  this.ashAltarObjectiveMarker?.clearTarget?.();
  this.ashAltarObjectiveMarker?.hide?.();

  const gate=WORLD_DESIGN.GATES[0];
  const seal=this.createBacktrackSeal(gate,{animate:true,silent:true});
  this.zone2ArrivalSequence={
   phase:'gateClosing',
   restart:Boolean(restart),
   until:this.time.now+ZONE2_GATE_CLOSE_HOLD_MS,
   seal
  };

  this.acquireStoryFocus('zone2Arrival');
  this.setHeroFocusInteraction('zone2Arrival',true);
  this.player?.body?.setVelocity?.(0,0);
  this.mobileMoveX=0;
  this.mobileMoveY=0;
  return true;
 }

 beginZone2WagonCinematic(time=this.time.now){
  const state=this.zone2ArrivalSequence;
  if(!state || state.phase==='cinematic' || state.phase==='complete')return false;

  state.phase='cinematic';
  this.ashAltarObjectiveMarker?.clearTarget?.();
  this.ashAltarObjectiveMarker?.hide?.();
  this.player?.body?.setVelocity?.(0,0);
  this.mobileMoveX=0;
  this.mobileMoveY=0;
  this.setHeroFocusInteraction('zone2Arrival',true);

  const complete=()=>{
   const active=this.zone2ArrivalSequence;
   if(active)active.phase='complete';
   const flock=this.crowFlocks?.get?.('ruined_wagon_crows_01');
   for(const crow of flock?.crows||[]){
    if(crow?.sprite?.active)this.retireCrow(crow);
   }
   this.setHeroFocusInteraction('zone2Arrival',false);
   this.releaseStoryFocus('zone2Arrival',{cooldownMs:0});
   this.zone2ArrivalSequence=null;
   this.startZoneWaveSequence(1,{delay:850,suppressBanner:false});
  };

  const started=this.storyDirector?.playCinematic(ZONE2_WAGON_CINEMATIC_PAGES,{
   eventId:'ruined_kingdom_wagon_arrival_cinematic',
   once:false,
   releaseTextureKeys:[],
   onComplete:complete
  });
  if(!started)complete();
  return true;
 }

 updateZone2ArrivalSequence(time){
  const state=this.zone2ArrivalSequence;
  if(!state || this.currentWorldZoneIndex!==1)return false;

  if(state.phase==='gateClosing'){
   this.player?.body?.setVelocity?.(0,0);
   this.mobileMoveX=0;
   this.mobileMoveY=0;
   if(time<state.until)return true;

   this.setHeroFocusInteraction('zone2Arrival',false);
   this.releaseStoryFocus('zone2Arrival',{cooldownMs:0});
   const point=this.getZone2FirstWagonPoint();
   this.ashAltarObjectiveMarker?.setTarget(()=>this.zone2FirstWagonTarget?.active?this.zone2FirstWagonTarget:point,{worldOffsetY:96});
   this.waveSubText?.setText('FOLLOW THE MARKER');
   state.phase='approachWagon';
   return false;
  }

  if(state.phase==='approachWagon'){
   this.ashAltarObjectiveMarker?.update?.(time);
   const point=this.getZone2FirstWagonPoint();
   if(Phaser.Math.Distance.Between(this.player.x,this.player.y,point.x,point.y)>ZONE2_WAGON_TRIGGER_RADIUS)return false;

   const flock=this.crowFlocks?.get?.('ruined_wagon_crows_01');
   if(flock)this.scatterCrowFlock(flock,time);
   state.phase='crowsScattering';
   state.until=time+ZONE2_CROW_CINEMATIC_DELAY_MS;
   this.acquireStoryFocus('zone2Arrival');
   this.setHeroFocusInteraction('zone2Arrival',true);
   this.player?.body?.setVelocity?.(0,0);
   this.mobileMoveX=0;
   this.mobileMoveY=0;
   return true;
  }

  if(state.phase==='crowsScattering'){
   this.player?.body?.setVelocity?.(0,0);
   this.mobileMoveX=0;
   this.mobileMoveY=0;
   if(time<state.until)return true;
   return this.beginZone2WagonCinematic(time);
  }

  if(state.phase==='cinematic')return true;
  return false;
 }

 getRegionBalance(index=this.progressionBalanceZoneIndex){
  const maxIndex=REGION_BALANCE.ZONES.length-1;
  const safeIndex=Phaser.Math.Clamp(Number.isFinite(index)?index:0,0,maxIndex);
  return REGION_BALANCE.ZONES[safeIndex] || REGION_BALANCE.ZONES[0];
 }

 getWavePopulationMultiplier(index=this.progressionBalanceZoneIndex){
  if(Number.isFinite(this.devRegionPopulationOverride)) return this.devRegionPopulationOverride;
  return this.getRegionBalance(index).populationMultiplier;
 }

 getEffectiveMeleeDamage(baseDamage=this.meleeAttack?.damage||15,index=this.progressionBalanceZoneIndex){
  return Math.max(1,baseDamage+this.getRegionBalance(index).meleeDamageBonus);
 }

 getCombatStyleKnockbackMultiplier(enemy){
  // This path helps basic crowd control only; authored elite positioning stays intact.
  return this.combatStyle==='crowdbreak' && enemy?.type==='skeleton' ? 1.5 : 1;
 }

 showCombatNotification(text,{x=this.player?.x||0,y=(this.player?.y||0)-48,color='#ffe29a',key=text,cooldown=260}={}){
  const now=this.time?.now||0;
  if(!this.combatNotificationAt)this.combatNotificationAt=new Map();
  const previous=this.combatNotificationAt.get(key)||-Infinity;
  if(now-previous<cooldown)return false;
  this.combatNotificationAt.set(key,now);
  const txt=lkAddText(this,x,y,text,{fontSize:'14px',fontStyle:'bold',color,stroke:'#1b1208',strokeThickness:3})
   .setOrigin(0.5).setDepth(82);
  this.tweens.add({targets:txt,y:y-22,alpha:0,duration:1050,ease:'Quad.easeOut',onComplete:()=>txt.destroy()});
  return true;
 }

 getCombatStyleMeleeEffect(targetCount){
  if(this.combatStyle==='duelist' && targetCount===1){
   return {multiplier:1.45,id:'duelist',label:'Последний приговор',color:'#ffd47a'};
  }
  if(this.combatStyle==='echo' && this.combatStyleChargeReady){
   this.combatStyleChargeReady=false;
   this.updateCombatStyleChargeVisual();
   return {multiplier:1.70,id:'echo',label:'Отголосок клинка',color:'#ffe18c'};
  }
  return {multiplier:1,id:null,label:'',color:'#ffffff'};
 }

 notifyCombatStyleProc(effect,target){
  if(!effect)return false;
  const labels={
   duelist:{label:'Последний приговор',color:'#ffd47a'},
   echo:{label:'Отголосок клинка',color:'#ffe18c'},
   crowdbreak:{label:'Расколотый строй',color:'#ffc774'}
  };
  const data=labels[effect];
  if(!data)return false;
  return this.showCombatNotification(data.label,{
   x:target?.x??this.player.x,
   y:(target?.y??this.player.y)-38,
   color:data.color,key:`path:${effect}`,cooldown:380
  });
 }

 armCombatStyleCharge(){
  if(this.combatStyle!=='echo' || this.combatStyleChargeReady)return false;
  this.combatStyleChargeReady=true;
  this.updateCombatStyleChargeVisual();
  this.showCombatNotification('ОТКЛИК',{y:this.player.y-72,color:'#ffd977',key:'path:echo-armed',cooldown:180});
  return true;
 }

 consumeCombatStyleMeleeMultiplier(targetCount){
  return this.getCombatStyleMeleeEffect(targetCount).multiplier;
 }

 updateCombatStyleChargeVisual(){
  const glow=this.combatStyleChargeGlow;
  if(!glow?.active)return;
  const active=this.combatStyle==='echo' && this.combatStyleChargeReady;
  glow.setVisible(active);
  if(active)glow.setPosition(this.player.x,this.player.y+7).setAlpha(0.26);
 }

 getRegionalPlayerMaxHp(index=this.progressionBalanceZoneIndex){
  const balance=this.getRegionBalance(index);
  return Math.max(1,Math.round(BALANCE.PLAYER_BASE_MAX_HP*balance.playerMaxHpMultiplier*(this.championHpMultiplier||1)));
 }

 applyRegionalHeroBalance(index=this.progressionBalanceZoneIndex,showFeedback=true){
  if(!this.player) return;
  const balance=this.getRegionBalance(index);
  const previousMax=Math.max(1,this.player.maxHp||BALANCE.PLAYER_BASE_MAX_HP);
  const nextMax=this.getRegionalPlayerMaxHp(index);
  if(nextMax!==previousMax){
   const delta=nextMax-previousMax;
   this.player.maxHp=nextMax;
   const currentHp=Math.max(0,Number.isFinite(this.player.hp)?this.player.hp:nextMax);
   this.player.hp=delta>0
    ? Math.min(nextMax,currentHp+delta)
    : Math.min(nextMax,currentHp);
   this.updateLowHealthState(true);
  }
  if(showFeedback && index>0){
   this.showWaveBanner(
    'REGIONAL POWER',
    `Max HP ${nextMax} · melee +${balance.meleeDamageBonus}`,
    '#d8e5c9'
   );
  }
 }

 calculateWaveTarget(wave=this.wave,profile=this.waveProfile,championKind=this.getChampionForWave(wave),{concurrentChampion=false}={}){
  if(isCaptainEncounter(this.currentWorldZoneIndex,wave))return CAPTAIN.skeletonCount+1;
  const globalPressure=Math.max(1,this.getGlobalWave?.()||wave||1);
  const pressureWave=this.currentWorldZoneIndex>0
   ? Math.max(wave,Math.round(globalPressure*0.72 + wave*0.28))
   : wave;
  const baseTarget=pressureWave===1 ? 10 : 8+pressureWave*3;
  const targetBonus=profile?.targetBonus||0;
  const postWaveBrokenSaint=this.currentWorldZoneIndex===0 && wave===5 && championKind==='brokenSaint' && !concurrentChampion;
  const championScale=(championKind && (concurrentChampion || !postWaveBrokenSaint)) ? 0.70 : 1;
  const regionPressure=this.currentWorldZoneIndex>0 ? 1 + this.currentWorldZoneIndex*0.05 : 1;
  return Math.max(1,Math.ceil((baseTarget+targetBonus)*championScale*this.getWavePopulationMultiplier()*regionPressure));
 }

 calculateWaveSpawnInterval(profile=this.waveProfile){
  if(profile?.captainEncounter)return CAPTAIN.spawnInterval;
  const baseInterval=profile?.spawnInterval||1050;
  const spawnRate=this.getRegionBalance().spawnRateMultiplier;
  const globalPressure=Math.max(1,this.getGlobalWave?.()||this.wave||1);
  const onwardPressure=this.currentWorldZoneIndex>0 ? Math.max(1,1+Math.max(0,globalPressure-5)*0.035) : 1;
  return Math.max(460,Math.round(baseInterval/Math.max(0.1,spawnRate*onwardPressure)));
 }

 recalculateCurrentWaveRegionBalance(){
  if(!this.waveProfile) return;
  const championKind=this.getChampionForWave(this.wave);
  this.waveTarget=Math.max(this.spawned,this.calculateWaveTarget(this.wave,this.waveProfile,championKind));
  this.waveSpawnInterval=this.calculateWaveSpawnInterval(this.waveProfile);
  this.devTools?.refreshStateButtons?.();
  this.devTools?.updateInfo?.(true);
 }

 getWorldProgressName(){
  const zone=WORLD_DESIGN.ZONES[this.currentWorldZoneIndex];
  return zone ? zone.name : 'UNKNOWN';
 }

 clampWorldX(x,margin=20){
  return Phaser.Math.Clamp(x,margin,STAGE0.WORLD_WIDTH-margin);
 }

 clampWorldY(y,margin=20){
  return Phaser.Math.Clamp(y,margin,STAGE0.WORLD_HEIGHT-margin);
 }

 getUiMetrics(){
  const cam=this.cameras.main;
  const zoom=cam.zoom || 1;
  const width=cam.width/zoom;
  const height=cam.height/zoom;
  return {width,height,cx:width/2,cy:height/2,zoom};
 }

 getSpawnPointAroundCamera(margin=52){
  const view=this.cameras.main.worldView;
  const pad=42;
  const zoneCeiling=this.getCurrentZoneEnemySpawnCeiling(pad);
  const sides=[];
  if(view.top-margin>0) sides.push('top');
  if(view.right+margin<zoneCeiling) sides.push('right');
  if(view.bottom+margin<STAGE0.WORLD_HEIGHT) sides.push('bottom');
  const forwardOnly=this.currentWorldZoneIndex>0;
  if(!forwardOnly && view.left-margin>0) sides.push('left');
  const fallbackSides=forwardOnly ? ['top','right','bottom'] : ['top','right','bottom','left'];
  const side=Phaser.Utils.Array.GetRandom(sides.length ? sides : fallbackSides);
  const spawnFloor=forwardOnly ? this.getForwardEnemySpawnFloor(pad) : this.clampWorldX(view.left+pad,pad);
  const minX=Math.min(zoneCeiling,Math.max(spawnFloor,this.clampWorldX(view.left+pad,pad)));
  const maxX=Math.max(minX,Math.min(zoneCeiling,this.clampWorldX(view.right-pad,pad)));
  const forwardMinX=Math.min(minX,maxX);
  const minY=this.clampWorldY(view.top+pad,pad);
  const maxY=this.clampWorldY(view.bottom-pad,pad);
  if(side==='top') return {x:Phaser.Math.Between(Math.round(forwardMinX),Math.round(maxX)),y:this.clampWorldY(view.top-margin,pad)};
  if(side==='right') return {x:Math.min(zoneCeiling,this.clampWorldX(view.right+margin,pad)),y:Phaser.Math.Between(Math.round(minY),Math.round(maxY))};
  if(side==='bottom') return {x:Phaser.Math.Between(Math.round(forwardMinX),Math.round(maxX)),y:this.clampWorldY(view.bottom+margin,pad)};
  return {x:Math.min(zoneCeiling,this.clampWorldX(view.left-margin,pad)),y:Phaser.Math.Between(Math.round(minY),Math.round(maxY))};
 }

 getEdgeSpawnPoint(margin=64){
  return this.getSpawnPointAroundCamera(margin);
 }

 getZoneCameraMinX(zoneIndex=this.currentWorldZoneIndex){
  const gate=WORLD_DESIGN.GATES[zoneIndex-1];
  // Same world-space plane as the permanent backtrack gate, inside the new zone.
  return gate?gate.x+120:0;
 }

 getZoneCameraMaxX(zoneIndex=this.currentWorldZoneIndex){
  const exitGate=WORLD_DESIGN.GATES[zoneIndex];
  // Do not reveal the next biome until the hero has actually crossed the gate.
  // Once updateWorldRegion() advances the zone index, this limit moves forward.
  return exitGate?.x ?? STAGE0.WORLD_WIDTH;
 }

 applyWorldCameraBounds(){
  const minX=Math.max(0,this.worldCameraMinX||0);
  const maxX=Math.max(minX+1,this.getZoneCameraMaxX());
  this.cameras.main.setBounds(minX,0,maxX-minX,STAGE0.WORLD_HEIGHT);
 }

 updateWorldCameraBoundary(){
  const nextMinX=this.getZoneCameraMinX();
  if(nextMinX<=(this.worldCameraMinX||0))return;
  // Latch only after the natural follow camera has passed the entry gate.
  // No pan, tween, zoom or offset: applying bounds cannot move this view.
  if(this.cameras.main.worldView.left<nextMinX)return;
  this.worldCameraMinX=nextMinX;
  this.applyWorldCameraBounds();
  // On narrow viewports the gate may leave view before BACK_LOCK_DEPTH.
  // Seal now as well, so the hero cannot walk behind the latched camera edge.
  this.createBacktrackSeal(WORLD_DESIGN.GATES[this.currentWorldZoneIndex-1]);
 }

 setupResponsiveWorldCamera(){
  const cam=this.cameras.main;
  this.applyWorldCameraBounds();
  cam.setRoundPixels(true);
  cam.startFollow(this.player,true,1,1);
  this.handleViewportResize();
  cam.centerOn(this.player.x,this.player.y);
 }

 handleViewportResize(){
  if(!this.cameras || !this.cameras.main) return;
  const gameW=Math.max(1,this.scale.width);
  const gameH=Math.max(1,this.scale.height);
  // Mobile Display Fix: always use the full browser viewport.
  // The old 20:9 cap created side bars on ultra-wide phones.
  const cameraW=gameW;
  const cameraX=0;
  const cam=this.cameras.main;
  cam.setViewport(cameraX,0,cameraW,gameH);
  const baseZoom=gameH/STAGE0.REFERENCE_HEIGHT;
  // Mobile camera pass: bring the action closer so character/enemy art reads on phones
  // without sacrificing too much crowd awareness. Desktop keeps the wider 720px reference view.
  const mobileCamera=Boolean(this.isTouchDevice || gameH<560 || gameW<900);
  const cameraZoomMultiplier=mobileCamera ? 1.35 : 1;
  cam.setZoom(Math.max(0.01,baseZoom*cameraZoomMultiplier));
  this.applyWorldCameraBounds();
  const metrics=this.getUiMetrics();
  // Mobile UX safe gameplay area: the player may still travel anywhere in the
  // world, but the camera starts following sooner so the hero cannot drift under
  // the top HUD, joystick or skill cluster. Desktop keeps the original deadzone.
  if(mobileCamera){
   cam.setDeadzone(metrics.width*0.36,metrics.height*0.30);
  }else{
   cam.setDeadzone(metrics.width*STAGE0.CAMERA_DEADZONE_WIDTH,metrics.height*STAGE0.CAMERA_DEADZONE_HEIGHT);
  }
  this.layoutScreenUI();
  this.layoutMobileControls();
 }

 layoutScreenUI(){
  if(!this.cameras || !this.cameras.main) return;
  const {cx,cy}=this.getUiMetrics();
  if(this.hud) this.hud.setPosition(14,12);
  if(this.waveText) this.waveText.setPosition(cx,18);
  if(this.waveSubText) this.waveSubText.setPosition(cx,50);
  if(this.regionText) this.regionText.setPosition(cx,69);
  if(this.championNameText) this.championNameText.setPosition(cx,88);
  if(this.championHpBack) this.championHpBack.setPosition(cx,113);
  if(this.championHpFill) this.championHpFill.setPosition(cx-213,113);
  if(this.gameOverPanel) this.gameOverPanel.setPosition(cx,cy);
  if(this.gameOverText) this.gameOverText.setPosition(cx,cy);
 }

 isMobileInteractionPointerAllowed(pointer){
  if(!this.isTouchDevice) return true;

  // Permanent mobile input contract: the LEFT visual half of the physical
  // canvas belongs exclusively to movement. Use DOM client coordinates here
  // instead of Phaser world/UI coordinates so HiDPI render scale, camera zoom
  // and HUD camera transforms can never move the split line.
  const nativeEvent=pointer?.event;
  const touch=nativeEvent?.changedTouches?.[0] || nativeEvent?.touches?.[0] || null;
  const clientX=Number(touch?.clientX ?? nativeEvent?.clientX);
  const canvas=this.game?.canvas;
  if(canvas?.getBoundingClientRect && Number.isFinite(clientX)){
   const rect=canvas.getBoundingClientRect();
   if(rect?.width>0){
    return clientX >= rect.left + rect.width*0.5;
   }
  }

  // Fallback for synthetic Phaser pointers/tests without a native DOM event.
  const px=Number(pointer?.x);
  const width=Math.max(1,Number(this.scale?.width)||1);
  return Number.isFinite(px) && px >= width*0.5;
 }

 emitMobileWorldInteraction(pointer){
  if(!this.isTouchDevice || !this.isMobileInteractionPointerAllowed(pointer))return false;
  this.events?.emit?.('mobile-world-interact',pointer);
  return true;
 }

 createMobileControls(){
  if(!this.isTouchDevice) return;
  const base=this.add.circle(0,0,74,0x0a0f0b,0.20).setStrokeStyle(3,0xffffff,0.24).setScrollFactor(0).setDepth(500);
  const knob=this.add.circle(0,0,31,0xffffff,0.22).setStrokeStyle(2,0xffffff,0.30).setScrollFactor(0).setDepth(501);
  const skillButtons=[];
  for(let i=0;i<3;i++){
   const button=this.add.circle(0,0,44,0x111811,0.28).setStrokeStyle(2,0xffffff,0.24).setScrollFactor(0).setDepth(500).setInteractive({useHandCursor:true});
   const label=lkAddText(this,0,0,`S${i+1}`,{fontSize:'18px',color:'#ffffff'}).setOrigin(0.5).setScrollFactor(0).setDepth(501);
   button.on('pointerdown',()=>this.events.emit('mobile-skill',i+1));
   skillButtons.push({button,label});
  }
  this.mobileControls=[base,knob];
  this.mobileJoystickBase=base; this.mobileJoystickKnob=knob; this.mobileSkillButtons=skillButtons;
  for(const pair of skillButtons) this.mobileControls.push(pair.button,pair.label);
  this.input.on('pointerdown',this.handleMobilePointerDown,this);
  this.input.on('pointermove',this.handleMobilePointerMove,this);
  this.input.on('pointerup',this.handleMobilePointerUp,this);
  this.input.on('pointerupoutside',this.handleMobilePointerUp,this);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
   this.input.off('pointerdown',this.handleMobilePointerDown,this);
   this.input.off('pointermove',this.handleMobilePointerMove,this);
   this.input.off('pointerup',this.handleMobilePointerUp,this);
   this.input.off('pointerupoutside',this.handleMobilePointerUp,this);
  });
  this.layoutMobileControls();
 }

 getPointerUiPosition(pointer){
  const cam=this.cameras.main;
  return {x:(pointer.x-cam.x)/(cam.zoom||1),y:(pointer.y-cam.y)/(cam.zoom||1)};
 }

 handleMobilePointerDown(pointer){
  if(this.devTools?.freeCamera||this.devTools?.editMode) return;
  if(!this.mobileJoystickBase || this.mobileMovePointerId!==null) return;
  const p=this.getPointerUiPosition(pointer);
  const dx=p.x-this.mobileJoystickBase.x,dy=p.y-this.mobileJoystickBase.y;
  if(Math.hypot(dx,dy)<=105){this.mobileMovePointerId=pointer.id;this.updateMobileJoystick(pointer);}
 }

 handleMobilePointerMove(pointer){
  if(this.devTools?.freeCamera||this.devTools?.editMode) return;
  if(pointer.id===this.mobileMovePointerId) this.updateMobileJoystick(pointer);
 }

 handleMobilePointerUp(pointer){
  if(pointer.id!==this.mobileMovePointerId) return;
  this.mobileMovePointerId=null; this.mobileMoveX=0; this.mobileMoveY=0;
  if(this.mobileJoystickKnob && this.mobileJoystickBase) this.mobileJoystickKnob.setPosition(this.mobileJoystickBase.x,this.mobileJoystickBase.y);
 }

 updateMobileJoystick(pointer){
  if(!this.mobileJoystickBase || !this.mobileJoystickKnob) return;
  const p=this.getPointerUiPosition(pointer);
  const dx=p.x-this.mobileJoystickBase.x,dy=p.y-this.mobileJoystickBase.y;
  const len=Math.hypot(dx,dy),max=58,scale=len>max ? max/len : 1;
  this.mobileJoystickKnob.setPosition(this.mobileJoystickBase.x+dx*scale,this.mobileJoystickBase.y+dy*scale);
  if(len<8){this.mobileMoveX=0;this.mobileMoveY=0;} else {this.mobileMoveX=dx/len;this.mobileMoveY=dy/len;}
 }

 layoutMobileControls(){
  if(!this.isTouchDevice || !this.mobileJoystickBase) return;
  const {width,height}=this.getUiMetrics();
  const joyX=118,joyY=height-112;
  this.mobileJoystickBase.setPosition(joyX,joyY);
  if(this.mobileMovePointerId===null) this.mobileJoystickKnob.setPosition(joyX,joyY);
  const positions=[{x:width-112,y:height-104},{x:width-210,y:height-92},{x:width-158,y:height-190}];
  this.mobileSkillButtons.forEach((pair,i)=>{pair.button.setPosition(positions[i].x,positions[i].y);pair.label.setPosition(positions[i].x,positions[i].y);});
 }

 spawnChampion(kind,forcedByDev=false,options={}){
  if(this.devFlags?.autoSpawnsDisabled && !forcedByDev) return null;
  if(this.activeChampion && this.activeChampion.active) return this.activeChampion;
  const def=this.getChampionDefinition(kind);
  if(!def) return null;

  let pos=options?.position ? {x:Number(options.position.x),y:Number(options.position.y)} : this.getEdgeSpawnPoint(50);
  pos={x:this.clampWorldX(pos.x,60),y:this.clampWorldY(pos.y,60)};
  if(kind==='hollowTree' && !options?.position){
   const view=this.cameras.main.worldView;
   const dx=Math.min(300,view.width*0.32);
   const dy=Math.min(230,view.height*0.30);
   const candidates=[
    {x:this.clampWorldX(this.player.x+dx,70),y:this.player.y},
    {x:this.clampWorldX(this.player.x-dx,70),y:this.player.y},
    {x:this.player.x,y:this.clampWorldY(this.player.y+dy,70)},
    {x:this.player.x,y:this.clampWorldY(this.player.y-dy,70)}
   ];
   candidates.sort((a,b)=>Phaser.Math.Distance.Between(b.x,b.y,this.player.x,this.player.y)-Phaser.Math.Distance.Between(a.x,a.y,this.player.x,this.player.y));
   pos=candidates[0];
  }
  if(!options?.exactStorySpawn){
   pos=this.findSafeEnemySpawnPoint(pos.x,pos.y,{padding:(def.hitRadius||24)+8,minPlayerDistance:options?.minPlayerDistance??150,maxRadius:options?.maxRadius??460});
  }

  const e=this.add.circle(pos.x,pos.y,def.hitRadius,0xb34cff,0);
  this.physics.add.existing(e);

  e.type='champion';
  e.championKind=kind;
  e.championName=def.name;
  e.hp=def.hp+Math.max(0,this.wave-5)*12;
  e.maxHp=e.hp;
  e.speed=def.speed;
  e.attackDamage=def.damage;
  e.hitRadius=def.hitRadius;
  e.crowdRadius=def.crowdRadius || def.hitRadius;
  e.crowdKeepoutRadius=def.crowdKeepoutRadius || 0;
  e.lastAttack=0;
  e.lastShot=0;
  e.attackAnimUntil=0;
  e.staggerUntil=0;
  e.pendingMeleeHitAt=0;
  e.pendingMeleeDamage=0;
  e.pendingMeleeRange=0;
  e.knockbackVX=0;
  e.knockbackVY=0;
  e.nextSkillAt=this.time.now+1600;
  e.nextSecondaryAt=this.time.now+3900;
  e.reflectUntil=0;
  e.guardUntil=0;
  e.lastCounterAt=-99999;
  e.lastAuraTick=0;
  e.storyDormant=Boolean(options?.dormant);
  e.ignoreAshAltarCollision=false;
  e.storyAltarLocked=Boolean(options?.exactStorySpawn && kind==='brokenSaint');

  const isBrokenSaint=kind==='brokenSaint';
  // Recovery hearts are keyed to HERO health crossings, never to the boss HP.
  // A fresh Broken Saint attempt can produce at most one heart at 75% and one at 25%.
  if(isBrokenSaint)e.brokenSaintHeartDrops=new Set();
  // Later champions do not have final art yet. Use the existing skeleton set as a
  // deliberate temporary fallback instead of referencing removed champion_* frames.
  const initialTexture=isBrokenSaint ? 'broken_saint_down_walk_00' : 'skeleton_down_idle_00';
  e.visual=this.add.sprite(e.x,e.y,initialTexture)
   .setOrigin(0.5,0.80).setScale(def.scale).setDepth(16).setTint(def.tint);
  e.dir='down';
  e.attackDir='down';
  e.visualState=isBrokenSaint ? 'broken_saint_down_idle' : 'skeleton_down_idle';
  e.visual.play(e.visualState);
  e.visualBaseScale=def.scale;
  this.createEnemyReadabilityShadow(e);
  if(options?.initialAlpha!==undefined){
   const introAlpha=Phaser.Math.Clamp(Number(options.initialAlpha)||0,0,1);
   e.visual?.setAlpha?.(introAlpha);
   e.shadowVisual?.setAlpha?.(introAlpha*(kind==='brokenSaint'?0.34:1));
  }

  if(kind==='hollowTree'){
   e.auraVisual=this.add.circle(e.x,e.y,175,0x89b85d,0.055)
    .setStrokeStyle(2,0xa8d975,0.38)
    .setDepth(8);
  }

  this.configureEnemyCollision(e,def.collisionPadding ?? 4);
  this.enemyGroup.add(e);
  this.enemies.push(e);
  this.activeChampion=e;
  this.championEventActive=true;
  this.championSpawned++;

  // Ordinary champions are combat-ready as soon as they spawn. Broken Saint is
  // deliberately excluded here: his checkpoint begins after the altar dialogue.
  if(!options?.skipRetryCheckpoint && !e.storyDormant && kind!=='brokenSaint'){
   this.createChampionRetryCheckpoint(e);
  }

  if(isBrokenSaint && !options?.deferMusic) this.startBrokenSaintMusic();

  if(!options?.deferUi){
   this.championNameText.setText(def.name).setVisible(true);
   this.championHpBack.setVisible(true);
   this.championHpFill.setVisible(true);
   this.updateChampionBar();
  }

  if(!options?.suppressBanner){
   this.showWaveBanner(def.name,'CHAMPION EVENT — ordinary pressure reduced by 30%',def.rewardColor);
  }
  if(!options?.suppressFlash)this.cameras.main.flash(240,70,48,25,false);
  return e;
 }

 createChampionRetryCheckpoint(champion){
  if(!champion?.active || !champion.championKind || !this.player)return null;
  const numeric=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
  const melee=this.meleeAttack||{};
  const now=this.time.now;
  this.championRetryCheckpoint={
   retriesRemaining:2,
   kind:champion.championKind,
   champion:{
    x:champion.x,y:champion.y,maxHp:champion.maxHp,
    ignoreAshAltarCollision:Boolean(champion.ignoreAshAltarCollision)
   },
   hero:{
    x:this.player.x,y:this.player.y,hp:this.player.hp,maxHp:this.player.maxHp,
    level:this.level,xp:this.xp,kills:this.kills,mana:this.mana,maxMana:this.maxMana,
    melee:{level:melee.level,damage:melee.damage,cooldown:melee.cooldown,radius:melee.radius},
    weaponLevels:{...this.weaponLevels},
    championRelics:[...this.championRelics],
    championSkillEvolutions:[...this.championSkillEvolutions],
    championEssences:[...this.championEssences],
    championHpMultiplier:this.championHpMultiplier,
    championManaRegenMultiplier:this.championManaRegenMultiplier,
    skillRecoveryMultiplier:this.skillRecoveryMultiplier,
    bsPenitenceCharges:this.bsPenitenceCharges,
    killStreakBonus:this.killStreakBonus,
    fallenBlessingUsed:this.fallenBlessingUsed,
    combatStyle:this.combatStyle,
    combatStyleChargeReady:Boolean(this.combatStyleChargeReady)
   },
   wave:{
    number:this.wave,spawned:this.spawned,target:this.waveTarget,profile:this.waveProfile,
    intermission:this.waveIntermission,postWaveChampionKind:this.postWaveChampionKind,
    lastSpawnOffset:numeric(this.lastSpawn,now)-now
   }
  };
  return this.championRetryCheckpoint;
 }

 hasChampionRetryAvailable(){
  return Boolean(this.championRetryCheckpoint?.retriesRemaining>0);
 }

 discardEnemyForChampionRetry(enemy){
  if(!enemy)return;
  for(const key of ['visual','auraVisual','reflectVisual','saintsNailMarkVisual']){
   if(enemy[key]?.active)enemy[key].destroy();
  }
  this.destroyEnemyReadabilityShadow(enemy);
  if(enemy.active)enemy.destroy();
 }

 clearCombatForChampionRetry(){
  this.captainSystem?.clear();
  // This must work in the player scene without the optional DEV tools.
  for(const projectile of this.projectiles||[])if(projectile?.active)projectile.destroy();
  this.projectiles=[];
  this.clearChampionHazards();
  for(const orb of this.orbs||[])if(orb?.active)orb.destroy();
  for(const heart of this.hearts||[])if(heart?.active)heart.destroy();
  this.orbs=[];
  this.hearts=[];
  for(const enemy of [...(this.enemies||[])])this.discardEnemyForChampionRetry(enemy);
  this.enemies=[];
  this.activeChampion=null;
  this.championEventActive=false;
  this.championNameText?.setVisible(false);
  this.championHpBack?.setVisible(false);
  this.championHpFill?.setVisible(false);
 }

 retryChampionFight(){
  const checkpoint=this.championRetryCheckpoint;
  if(!this.gameOver || !this.gameOverUiReady || !checkpoint || checkpoint.retriesRemaining<=0)return false;

  const now=this.time.now;
  const hero=checkpoint.hero;
  const wave=checkpoint.wave;
  this.clearCombatForChampionRetry();
  this.stopBrokenSaintHolyWarningSfx();
  this.stopBrokenSaintMusic();
  this.brokenSaintDefeatSequenceActive=false;
  this.brokenSaintDefeatFx=[];

  this.level=hero.level;
  this.xp=hero.xp;
  this.kills=hero.kills;
  this.mana=hero.mana;
  this.maxMana=hero.maxMana;
  this.weaponLevels={...hero.weaponLevels};
  this.championRelics=new Set(hero.championRelics);
  this.championSkillEvolutions=new Set(hero.championSkillEvolutions);
  this.championEssences=new Set(hero.championEssences);
  this.championHpMultiplier=hero.championHpMultiplier;
  this.championManaRegenMultiplier=hero.championManaRegenMultiplier;
  this.skillRecoveryMultiplier=hero.skillRecoveryMultiplier;
  this.bsPenitenceCharges=hero.bsPenitenceCharges;
  this.killStreakBonus=hero.killStreakBonus;
  this.fallenBlessingUsed=hero.fallenBlessingUsed;
  this.combatStyle=hero.combatStyle||null;
  this.combatStyleChargeReady=Boolean(hero.combatStyleChargeReady && this.combatStyle==='echo');
  Object.assign(this.meleeAttack,hero.melee,{lastAttack:now,combatActive:false,attackTargetCount:0,nearbyTargetCount:0});

  this.wave=wave.number;
  this.spawned=wave.spawned;
  this.waveTarget=wave.target;
  this.waveProfile=wave.profile;
  this.waveIntermission=wave.intermission;
  this.postWaveChampionKind=wave.postWaveChampionKind;
  this.lastSpawn=now+wave.lastSpawnOffset;
  this.nextWaveAt=Number.POSITIVE_INFINITY;

  this.player.setPosition(hero.x,hero.y);
  this.player.body?.reset?.(hero.x,hero.y);
  this.player.body.enable=true;
  this.player.maxHp=hero.maxHp;
  this.player.hp=hero.hp;
  this.playerInvulnerableUntil=now+700;
  this.playerSlowUntil=0;
  this.playerSlowFactor=1;
  this.playerForcedUntil=0;
  this.playerForcedVX=0;
  this.playerForcedVY=0;
  this.skillLockUntil=now;
  this.playerAttackUntil=now;
  this.mobileMoveX=0;
  this.mobileMoveY=0;
  this.playerVisual?.clearTint?.();
  this.playerVisual?.setPosition(hero.x,hero.y).setOrigin(0.5,0.78).setScale(HERO_SOCKET_VISUAL_SCALE).setFlipX(false).setFlipY(false);
  this.playerVisualState='hero_socket_idle_s';
  this.playerVisual?.play(this.playerVisualState,true);
  this.playerShadow?.setVisible(true);
  if(this.deathSword?.active)this.deathSword.destroy();
  this.deathSword=null;
  this.updateHeroWeaponAttachment();
  this.updateLowHealthState(true);
  this.updateCombatStyleChargeVisual();

  const champion=this.spawnChampion(checkpoint.kind,false,{
   position:checkpoint.champion,
   exactStorySpawn:true,
   minPlayerDistance:0,maxRadius:0,
   deferMusic:true,
   suppressBanner:true,
   suppressFlash:true,
   skipRetryCheckpoint:true
  });
  if(!champion)return false;
  champion.maxHp=checkpoint.champion.maxHp;
  champion.hp=champion.maxHp;
  champion.ignoreAshAltarCollision=checkpoint.champion.ignoreAshAltarCollision || checkpoint.kind==='brokenSaint';
  champion.storyAltarLocked=false;
  champion.storyDormant=false;
  champion.nextSkillAt=now+1450;
  champion.nextSecondaryAt=now+3600;

  // Consume a retry only after the fresh champion has been created successfully.
  checkpoint.retriesRemaining--;
  this.gameOver=false;
  this.gameOverUiReady=false;
  this.deathSequenceActive=false;
  this.gameOverPanel?.setVisible(false);
  this.gameOverText?.setVisible(false);
  try{this.physics.world.resume();}catch{}
  if(checkpoint.kind==='brokenSaint')this.startBrokenSaintMusic();
  this.showWaveBanner(champion.championName,'CHAMPION RETRY',this.getChampionDefinition(checkpoint.kind)?.rewardColor||'#f5d78f');
  return true;
 }

 destroyChampionHazard(hazard){
  if(!hazard) return;
  for(const key of ['visual','beamVisual']){
   const obj=hazard[key];
   if(!obj) continue;
   try{this.tweens?.killTweensOf?.(obj);}catch{}
   try{obj.stop?.();}catch{}
   try{obj.destroy?.();}catch{}
   hazard[key]=null;
  }
  for(const key of ['timer','event','delayedCall']){
   const event=hazard[key];
   if(!event) continue;
   try{event.remove?.(false);}catch{}
   try{event.destroy?.();}catch{}
   hazard[key]=null;
  }
 }

 clearChampionHazards(){
  for(const hazard of this.championHazards||[]){
   this.destroyChampionHazard(hazard);
  }
  this.championHazards=[];
 }

 spawnHealthHeart(x,y,{healAmount=BALANCE.HEART_HEAL,expiresIn=30000,source='world',pickupDelay=0}={}){
  const heart=this.add.image(x,y,'health_heart').setDepth(12);
  this.physics.add.existing(heart);
  heart.healAmount=Math.max(1,Math.round(healAmount));
  heart.expiresAt=this.time.now+expiresIn;
  heart.pickupAt=this.time.now+pickupDelay;
  heart.source=source;
  this.hearts.push(heart);
  return heart;
 }

 throwHealthHeart(fromX,fromY,targetX,targetY,options={}){
  const heart=this.spawnHealthHeart(fromX,fromY,{...options,pickupDelay:420});
  heart.setScale(0.74);
  this.tweens.add({
   targets:heart,x:targetX,y:targetY,scale:1,
   duration:420,ease:'Quad.easeOut'
  });
  return heart;
 }

 spawnStoryKnightHeart(knight){
  if(!knight?.active || !this.player)return null;
  // This is a gift, not an aimed projectile: never throw it directly through
  // the hero. A random nearby landing point also reads much more naturally.
  const angle=Phaser.Math.FloatBetween(0,Math.PI*2);
  const distance=Phaser.Math.Between(82,148);
  const target=this.findNearestFreeGroundPoint(
   knight.x+Math.cos(angle)*distance,
   knight.y+Math.sin(angle)*distance,
   20,180,16
  );
  return this.throwHealthHeart(knight.x,knight.y-18,target.x,target.y,{
   healAmount:BALANCE.HEART_HEAL,expiresIn:30000,source:'woundedKnight'
  });
 }

 spawnChampionHazard(x,y,radius,delay,duration,damage,color=0xffd76a,kind='mark'){
  let visual;
  let beamVisual=null;
  if(kind==='holyMark'){
   visual=this.add.sprite(x,y,'broken_saint_holy_mark_00')
    .setOrigin(0.5)
    .setDisplaySize(radius*2.35,radius*2.35)
    .setDepth(10);
   visual.play('broken_saint_holy_mark');
   beamVisual=this.add.sprite(x,y+4,'broken_saint_holy_beam_02')
    .setOrigin(0.5,0.86)
    .setDisplaySize(radius*3.15,radius*3.15)
    .setDepth(16)
    .setAlpha(0.72);
   beamVisual.play('broken_saint_holy_beam_idle');
  } else {
   visual=this.add.circle(x,y,radius,color,0.08)
    .setStrokeStyle(3,color,0.72).setDepth(10);
  }

  this.championHazards.push({
   x,y,radius,damage,color,kind,visual,beamVisual,
   activateAt:this.time.now+delay,
   expiresAt:this.time.now+delay+duration,
   lastTick:-99999,
   tickEvery:kind==='deathZone' ? 450 : 99999,
   activeVisual:false,
   hitPlayer:false
  });
 }

 spawnHolyMarkPlayerHitFeedback(){
  const x=this.player.x;
  const y=this.player.y-8;

  // A clear sacred-impact burst on the player, separate from the ground mark.
  const burst=this.add.sprite(x,y,'hit_burst_00')
   .setOrigin(0.5)
   .setDepth(72)
   .setScale(0.78)
   .setTint(0xffe58a);
  burst.play('hit_burst');
  burst.once(Phaser.Animations.Events.ANIMATION_COMPLETE,()=>{
   if(burst.active) burst.destroy();
  });

  const ring=this.add.circle(x,this.player.y,20,0xffe8a0,0.10)
   .setStrokeStyle(4,0xffe8a0,0.92)
   .setDepth(71);
  this.tweens.add({
   targets:ring,
   scale:2.05,
   alpha:0,
   duration:220,
   ease:'Quad.easeOut',
   onComplete:()=>{ if(ring.active) ring.destroy(); }
  });

  this.cameras.main.shake(70,0.0038);
 }

 updateChampionHazards(time){
  for(const h of this.championHazards){
   if(!h.visual || !h.visual.active) continue;

   if(time>=h.activateAt && !h.activeVisual){
    h.activeVisual=true;
    if(h.kind==='holyMark'){
     h.visual
      .setTexture('broken_saint_holy_impact_00')
      .setOrigin(0.5,0.93)
      .setDisplaySize(h.radius*3.20,h.radius*3.20)
      .setDepth(18);
     h.visual.play('broken_saint_holy_impact',true);
     if(h.beamVisual && h.beamVisual.active){
      h.beamVisual.stop();
      h.beamVisual
       .setTexture('broken_saint_holy_beam_00')
       .setOrigin(0.5,0.86)
       .setDisplaySize(h.radius*3.35,h.radius*3.35)
       .setDepth(19)
       .setAlpha(0.95);
     }
    } else {
     h.visual.setFillStyle(h.color,h.kind==='deathZone' ? 0.20 : 0.30);
     h.visual.setStrokeStyle(3,h.color,0.95);
    }
   }

   if(h.activeVisual && time<h.expiresAt){
    const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,h.x,h.y);

    if(h.kind==='deathZone'){
     if(d<=h.radius && time-h.lastTick>=h.tickEvery){
      h.lastTick=time;
      this.damagePlayer(h.damage,'champion:deathZone');
     }
    } else if(!h.hitPlayer && d<=h.radius){
     h.hitPlayer=true;

     if(h.kind==='roots'){
      this.damagePlayer(h.damage,'champion:roots');
      this.applyPlayerRootSlow(1450,0.45);
     } else if(h.kind==='holyMark'){
      this.damagePlayer(h.damage,'champion:holyMark');
      this.spawnHolyMarkPlayerHitFeedback();
     } else {
      this.damagePlayer(h.damage,`champion:${h.kind}`);
     }
    }
   }

   if(time>=h.expiresAt){
    if(h.visual && h.visual.active) h.visual.destroy();
    if(h.beamVisual && h.beamVisual.active) h.beamVisual.destroy();
   }
  }
  this.championHazards=this.championHazards.filter(h=>
   (h.visual && h.visual.active) || (h.beamVisual && h.beamVisual.active)
  );
 }

 spawnChampionMinion(x,y){
  const safeSpawn=this.findSafeEnemySpawnPoint(x,y,{padding:22,minPlayerDistance:90,maxRadius:280});
  const e=this.add.circle(safeSpawn.x,safeSpawn.y,14,0xcc3333,0);
  this.physics.add.existing(e);
  e.type='skeleton';
  e.hp=24+this.wave*4;
  e.maxHp=e.hp;
  e.speed=86+this.wave*4;
  e.attackDamage=8;
  e.hitRadius=14;
  e.lastAttack=0;
  e.lastShot=0;
  e.attackAnimUntil=0;
  e.staggerUntil=0;
  e.pendingMeleeHitAt=0;
  e.pendingMeleeDamage=0;
  e.pendingMeleeRange=0;
  e.knockbackVX=0;
  e.knockbackVY=0;
  e.visual=this.add.sprite(e.x,e.y,'skeleton_down_walk_00')
   .setOrigin(0.5,0.78).setScale(0.5).setDepth(15);
  e.dir='down';
  e.attackDir='down';
  e.visualState='skeleton_down_walk';
  e.visual.play(e.visualState);
  e.visualBaseScale=0.5;
  this.configureEnemyCollision(e,4);
  this.enemyGroup.add(e);
  this.enemies.push(e);
 }

 maybeDropBrokenSaintHeartForHeroHealth(previousHp,currentHp){
  const saint=this.activeChampion;
  if(!saint?.active || saint.hp<=0 || saint.championKind!=='brokenSaint' || saint.storyDormant || !this.championEventActive)return 0;
  const maxHp=Math.max(1,Number(this.player?.maxHp)||100);
  const previousRatio=Phaser.Math.Clamp((Number(previousHp)||0)/maxHp,0,1);
  const currentRatio=Phaser.Math.Clamp((Number(currentHp)||0)/maxHp,0,1);
  if(currentRatio>=previousRatio)return 0;
  const dropped=saint.brokenSaintHeartDrops||(saint.brokenSaintHeartDrops=new Set());
  if(dropped.size>=2)return 0;
  let spawned=0;
  for(const threshold of [0.75,0.25]){
   if(dropped.size>=2)break;
   if(dropped.has(threshold))continue;
   if(previousRatio>threshold && currentRatio<=threshold){
    dropped.add(threshold);
    const angle=Phaser.Math.FloatBetween(0,Math.PI*2);
    const distance=Phaser.Math.Between(96,158);
    const target=this.findNearestFreeGroundPoint(
     saint.x+Math.cos(angle)*distance,saint.y+Math.sin(angle)*distance,22,180,16
    );
    this.throwHealthHeart(saint.x,saint.y,target.x,target.y,{
     healAmount:Math.round(maxHp*0.30),
     expiresIn:8000,source:'brokenSaint'
    });
    spawned++;
   }
  }
  return spawned;
 }

 updateChampion(e,time,a,distance){
  const kind=e.championKind;
  if(this.devFlags?.championFrozen){
   if(e.body)e.body.setVelocity(0,0);
   e.pendingMeleeHitAt=0;
   return;
  }
  const devNoChampionSkills=Boolean(this.devFlags?.championSkillsDisabled);
  const devNoChampionAttacks=Boolean(this.devFlags?.championAttacksDisabled);

  if(kind==='brokenSaint'){
   this.setEnemySteeredVelocity(e,Math.cos(a)*e.speed,Math.sin(a)*e.speed,time);

   if(!devNoChampionSkills && time>=e.nextSkillAt){
    e.nextSkillAt=time+3000;
    e.attackAnimUntil=time+650;
    e.attackDir=e.dir;
    const predictX=this.clampWorldX(
     this.player.x+(this.player.body.velocity.x||0)*0.22,
     34
    );
    const predictY=this.clampWorldY(
     this.player.y+(this.player.body.velocity.y||0)*0.22,
     34
    );

    this.startBrokenSaintHolyWarningSfx();
    const holyMarkPoints=[[predictX,predictY]];

    this.spawnChampionHazard(
     predictX,predictY,34,850,300,12,0xffdc72,'holyMark'
    );

    const baseAngle=Phaser.Math.FloatBetween(0,Math.PI*2);
    for(let i=0;i<2;i++){
     const angle=baseAngle+i*Math.PI;
     const r=58;
     const x=this.clampWorldX(predictX+Math.cos(angle)*r,34);
     const y=this.clampWorldY(predictY+Math.sin(angle)*r,34);
     holyMarkPoints.push([x,y]);
     this.spawnChampionHazard(
      x,y,30,850,300,12,0xffdc72,'holyMark'
     );
    }

    let extraMarks=0;
    let attempts=0;
    while(extraMarks<5 && attempts<40){
     attempts++;
     const angle=Phaser.Math.FloatBetween(0,Math.PI*2);
     const dist=Phaser.Math.Between(120,300);
     const x=this.clampWorldX(this.player.x+Math.cos(angle)*dist,34);
     const y=this.clampWorldY(this.player.y+Math.sin(angle)*dist,34);

     let tooClose=false;
     for(const [px,py] of holyMarkPoints){
      if(Phaser.Math.Distance.Between(x,y,px,py)<92){
       tooClose=true;
       break;
      }
     }
     if(tooClose) continue;

     holyMarkPoints.push([x,y]);
     extraMarks++;
     this.spawnChampionHazard(
      x,y,30,950+Phaser.Math.Between(0,250),300,12,0xffdc72,'holyMark'
     );
    }

    this.time.delayedCall(850,()=>{
     this.stopBrokenSaintHolyWarningSfx();
     if(e.active && e.hp>0) this.playBrokenSaintHolyBeamSfx();
    });
   }

   if(!devNoChampionSkills && time>=e.nextSecondaryAt){
    // 5s shield uptime, then a full 10s vulnerability window.
    e.nextSecondaryAt=time+15000;
    e.reflectUntil=time+5000;
    if(e.reflectVisual && e.reflectVisual.active) e.reflectVisual.destroy();
    const shieldSize=(e.hitRadius||24)*4.9;
    e.reflectVisual=this.add.sprite(e.x,e.y-8,'broken_saint_reflect_shield_00')
     .setOrigin(0.5)
     .setDisplaySize(shieldSize,shieldSize)
     .setDepth(17);
    e.reflectVisual.play('broken_saint_reflect_shield');
    this.time.delayedCall(5000,()=>{
     if(e.reflectVisual && e.reflectVisual.active) e.reflectVisual.destroy();
     e.reflectVisual=null;
    });
   }
   return;
  }

  if(kind==='necromancer'){
   if(distance>220){
    this.setEnemySteeredVelocity(e,Math.cos(a)*e.speed,Math.sin(a)*e.speed,time);
   } else if(distance<165){
    this.setEnemySteeredVelocity(e,-Math.cos(a)*e.speed,-Math.sin(a)*e.speed,time);
   } else {
    e.body.setVelocity(0,0);
   }

   if(!devNoChampionSkills && time>=e.nextSkillAt){
    e.nextSkillAt=time+3500;
    e.attackAnimUntil=time+650;
    e.attackDir=e.dir;
    this.spawnChampionHazard(this.player.x,this.player.y,58,700,2300,7,0x48ff6e,'deathZone');
   }

   if(!devNoChampionSkills && time>=e.nextSecondaryAt){
    e.nextSecondaryAt=time+6200;
    for(let i=0;i<2;i++){
     const angle=Phaser.Math.FloatBetween(0,Math.PI*2);
     const r=Phaser.Math.Between(65,100);
     this.spawnChampionMinion(
      this.clampWorldX(e.x+Math.cos(angle)*r,25),
      this.clampWorldY(e.y+Math.sin(angle)*r,25)
     );
    }
    const pulse=this.add.circle(e.x,e.y,22,0x55ff77,0.18)
     .setStrokeStyle(3,0x55ff77,0.9).setDepth(17);
    this.tweens.add({targets:pulse,scale:3.1,alpha:0,duration:480,onComplete:()=>pulse.destroy()});
   }
   return;
  }

  if(kind==='shieldWarden'){
   this.setEnemySteeredVelocity(e,Math.cos(a)*e.speed,Math.sin(a)*e.speed,time);

   if(!devNoChampionSkills && time>=e.nextSecondaryAt){
    e.nextSecondaryAt=time+6200;
    e.guardUntil=time+1700;
    const guard=this.add.circle(e.x,e.y,46,0xd7e1ee,0.05)
     .setStrokeStyle(5,0xd7e1ee,0.95).setDepth(17);
    this.tweens.add({
     targets:guard,alpha:0.30,duration:180,yoyo:true,repeat:3,
     onUpdate:()=>{ if(guard.active) guard.setPosition(e.x,e.y); },
     onComplete:()=>{ if(guard.active) guard.destroy(); }
    });
   }

   if(!devNoChampionAttacks && !devNoChampionSkills && distance<115 && time>=e.nextSkillAt){
    e.nextSkillAt=time+3200;
    const windup=480;
    e.attackAnimUntil=time+760;
    e.attackDir=e.dir;
    e.body.setVelocity(0,0);

    const warning=this.add.circle(e.x,e.y,46,0xe4edf7,0.05)
     .setStrokeStyle(4,0xffffff,0.88).setDepth(20);
    this.tweens.add({
     targets:warning,scale:1.35,alpha:0.26,duration:windup,yoyo:false,
     onUpdate:()=>{ if(warning.active && e.active) warning.setPosition(e.x,e.y); },
     onComplete:()=>{ if(warning.active) warning.destroy(); }
    });

    this.time.delayedCall(windup,()=>{
     if(!e || !e.active || e.hp<=0 || this.gameOver || this.devFlags?.championAttacksDisabled || this.devFlags?.championFrozen) return;
     if(this.time.now<(e.staggerUntil||0) || this.time.now<(e.skillLiftUntil||0)) return;
     const currentDistance=Phaser.Math.Distance.Between(e.x,e.y,this.player.x,this.player.y);
     if(currentDistance>128) return;

     this.damagePlayer(17,'champion:shieldBash');
     const pushAngle=Phaser.Math.Angle.Between(e.x,e.y,this.player.x,this.player.y);
     const bashVX=Math.cos(pushAngle)*310;
     const bashVY=Math.sin(pushAngle)*310;
     this.applyPlayerForcedMotion(bashVX,bashVY,190);
     this.player.body.setVelocity(bashVX,bashVY);

     const bash=this.add.circle(this.player.x,this.player.y,20,0xe4edf7,0.30)
      .setStrokeStyle(4,0xffffff,0.9).setDepth(21);
     this.tweens.add({targets:bash,scale:2.0,alpha:0,duration:220,onComplete:()=>bash.destroy()});
    });
   }
   return;
  }

  if(kind==='hollowTree'){
   e.body.setVelocity(0,0);

   if(!devNoChampionSkills && time>=e.nextSkillAt){
    e.nextSkillAt=time+3200;
    e.attackAnimUntil=time+600;
    const rootX=this.clampWorldX(
     this.player.x+(this.player.body.velocity.x||0)*0.28,
     38
    );
    const rootY=this.clampWorldY(
     this.player.y+(this.player.body.velocity.y||0)*0.28,
     38
    );

    // A center root forces movement; three side roots punish a bad escape.
    this.spawnChampionHazard(
     rootX,rootY,36,850,720,8,0xb0d66d,'roots'
    );

    for(let i=0;i<3;i++){
     const angle=i*(Math.PI*2/3)+Phaser.Math.FloatBetween(-0.18,0.18);
     const r=58;
     this.spawnChampionHazard(
      this.clampWorldX(rootX+Math.cos(angle)*r,36),
      this.clampWorldY(rootY+Math.sin(angle)*r,36),
      32,850,720,8,0xb0d66d,'roots'
     );
    }
   }

   if(!devNoChampionSkills && time>=e.nextSecondaryAt){
    e.nextSecondaryAt=time+5700;
    for(let i=0;i<2;i++){
     const angle=Phaser.Math.FloatBetween(0,Math.PI*2);
     this.spawnChampionMinion(
      this.clampWorldX(e.x+Math.cos(angle)*85,25),
      this.clampWorldY(e.y+Math.sin(angle)*85,25)
     );
    }
   }

   if(!devNoChampionAttacks && distance<175 && time-e.lastAuraTick>700){
    e.lastAuraTick=time;
    this.damagePlayer(6,'champion:corruption');
   }
  }
 }

 updateChampionBar(){
  const e=this.activeChampion;
  if(!e || !e.active){
   this.championNameText.setVisible(false);
   this.championHpBack.setVisible(false);
   this.championHpFill.setVisible(false);
   return;
  }
  const ratio=Phaser.Math.Clamp(e.hp/e.maxHp,0,1);
  this.championHpFill.displayWidth=426*ratio;
  this.championNameText.setText(`${e.championName}  ${Math.ceil(Math.max(0,e.hp))}/${e.maxHp}`);
 }

 getChampionRewardChoices(kind){
  return ({
   necromancer:[
    ['SOUL SKULL','A spectral skull attacks a nearby enemy periodically','soulSkull'],
    ['GREEN CURSE','Dead enemies can leave damaging cursed ground','greenCurse'],
    ['NECROMANCER SOUL','Kills stack sword damage until you are hit','necromancerSoul']
   ],
   shieldWarden:[
    ['SHIELD FRAGMENT','Automatically block one hit every 25 seconds','shieldFragment'],
    ['HEAVY STRIKE','Sword hits can heavily stagger enemies','heavyStrike'],
    ['IRON WILL','Take 30% less damage while below 35 HP','ironWill']
   ],
   hollowTree:[
    ['ROOT HEART','Kills can lash a nearby enemy with a root','rootHeart'],
    ['CURSED GROUND','Periodically create a damaging aura around you','cursedGround'],
    ['ANCIENT BLOOD','Healing received is increased by 50%','ancientBlood']
   ]
  })[kind] || [];
 }

 getBrokenSaintRewardFlow(){
  return [
   {
    stepTitle:'СИЛА ЧЕМПИОНА',
    subtitle:'ВЫБЕРИТЕ ЭВОЛЮЦИЮ ОДНОГО БАЗОВОГО НАВЫКА',
    choices:[
     {
      type:'evolution',id:BROKEN_SAINT_EVOLUTION_IDS.pilgrimPath,
      iconKey:SKILL_ICON_KEYS.quake,
      name:'ПУТЬ ПАЛОМНИКА',
      desc:'Удар по земле: отбросьте 2+ врагов → +35% скорости движения на 2 сек.',
      meta:'ТЕМП · базовая роль: ESCAPE'
     },
     {
      type:'evolution',id:BROKEN_SAINT_EVOLUTION_IDS.verdict,
      iconKey:SKILL_ICON_KEYS.lift,
      name:'ПРИГОВОР',
      desc:'Подброс: пока поднятые враги в воздухе, входящий урон снижен на 25%.',
      meta:'СТОЙКОСТЬ · база: −30% скорости до приземления'
     },
     {
      type:'evolution',id:BROKEN_SAINT_EVOLUTION_IDS.saintStance,
      iconKey:SKILL_ICON_KEYS.spin,
      name:'СТОЙКОСТЬ СВЯТОГО',
      desc:'Вертушка: пока герой стоит и вращает меч, входящий урон снижен на 18%.',
      meta:'СТОЙКОСТЬ / МЕЧНИК · риск сохраняется'
     }
    ]
   },
   {
    stepTitle:'РЕЛИКВИЯ BROKEN SAINT',
    subtitle:'ВЫБЕРИТЕ ОДНУ РЕЛИКВИЮ',
    choices:[
     {
      type:'relic',id:BROKEN_SAINT_RELIC_IDS.crackedHalo,
      iconKey:BROKEN_SAINT_RELIC_ICON_KEYS[BROKEN_SAINT_RELIC_IDS.crackedHalo],
      name:'ТРЕСНУВШИЙ НИМБ',
      desc:'Урон во время Подброса или Вертушки даёт заряд Покаяния (до 3). Следующая Земля расходует заряды: сильнее урон и отбрасывание.',
      meta:'СТОЙКОСТЬ + ТЕМП'
     },
     {
      type:'relic',id:BROKEN_SAINT_RELIC_IDS.saintsNail,
      iconKey:BROKEN_SAINT_RELIC_ICON_KEYS[BROKEN_SAINT_RELIC_IDS.saintsNail],
      name:'ГВОЗДЬ СВЯТОГО',
      desc:'После Подброса первый ударивший вас враг получает Клеймо на 5 сек. Во время Вертушки — первый ударивший враг. Следующий навык по Клейму наносит +30%.',
      meta:'СТОЙКОСТЬ + ОХОТНИК'
     },
     {
      type:'relic',id:BROKEN_SAINT_RELIC_IDS.ashRosary,
      iconKey:BROKEN_SAINT_RELIC_ICON_KEYS[BROKEN_SAINT_RELIC_IDS.ashRosary],
      name:'ПЕПЕЛЬНЫЕ ЧЁТКИ',
      desc:'Земля или Подброс задели 3+ врагов → следующий ДРУГОЙ навык в течение 6 сек. стоит на 25% меньше маны.',
      meta:'ЦИКЛ / SKILL'
     }
    ]
   },
   {
    stepTitle:'ЭССЕНЦИЯ BROKEN SAINT',
    subtitle:'ВЫБЕРИТЕ ПОСТОЯННОЕ УСИЛЕНИЕ',
    choices:[
     {
      type:'essence',id:BROKEN_SAINT_ESSENCE_IDS.body,
      iconKey:BROKEN_SAINT_ESSENCE_ICON_KEYS[BROKEN_SAINT_ESSENCE_IDS.body],
      name:'ЭССЕНЦИЯ ТЕЛА',
      desc:'+10% к максимальному запасу HP.',
      meta:'СТОЙКОСТЬ / МЕЧНИК'
     },
     {
      type:'essence',id:BROKEN_SAINT_ESSENCE_IDS.will,
      iconKey:BROKEN_SAINT_ESSENCE_ICON_KEYS[BROKEN_SAINT_ESSENCE_IDS.will],
      name:'ЭССЕНЦИЯ ВОЛИ',
      desc:'+8% к скорости восстановления маны.',
      meta:'ЦИКЛ / SKILL'
     },
     {
      type:'essence',id:BROKEN_SAINT_ESSENCE_IDS.discipline,
      iconKey:BROKEN_SAINT_ESSENCE_ICON_KEYS[BROKEN_SAINT_ESSENCE_IDS.discipline],
      name:'ЭССЕНЦИЯ ДИСЦИПЛИНЫ',
      desc:'+6% к восстановлению между применениями базовых навыков.',
      meta:'ТЕМП / ЦИКЛ'
     }
    ]
   }
  ];
 }

 openChampionRewards(kind){
  if(this.championRewardOpen) return;
  const def=this.getChampionDefinition(kind);
  if(!def) return;

  let flow=[];
  if(kind==='brokenSaint'){
   flow=this.getBrokenSaintRewardFlow();
  } else {
   const legacy=this.getChampionRewardChoices(kind);
   if(!legacy.length) return;
   flow=[{
    stepTitle:`${def.name} DEFEATED`,
    subtitle:'CHOOSE ONE CHAMPION RELIC',
    choices:legacy.map(([name,desc,id])=>({type:'relic',id,name,desc,meta:'CHAMPION RELIC'}))
   }];
  }

  this.championRewardOpen=true;
  this.setGameplayPaused('championReward',true);
  this.currentChampionRewardKind=kind;
  this.currentChampionRewardFlow=flow;
  this.currentChampionRewardStepIndex=0;
  this.showCurrentChampionRewardStep();
 }

 showCurrentChampionRewardStep(){
  const flow=this.currentChampionRewardFlow||[];
  const step=flow[this.currentChampionRewardStepIndex];
  if(!step) return;
  this.currentChampionRewardChoices=step.choices||[];
  const def=this.getChampionDefinition(this.currentChampionRewardKind);
  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.showChampionRewards==='function'){
   hudScene.showChampionRewards(def?.name||'CHAMPION',def?.rewardColor||'#f5d78f',this.currentChampionRewardChoices,{
    stepTitle:step.stepTitle,
    subtitle:step.subtitle,
    stepIndex:this.currentChampionRewardStepIndex,
    totalSteps:flow.length
   });
  }
 }

 selectChampionReward(index){
  if(!this.championRewardOpen) return;
  const choice=this.currentChampionRewardChoices?.[index];
  if(!choice) return;

  if(choice.type==='evolution') this.grantChampionSkillEvolution(choice.id);
  else if(choice.type==='essence') this.grantChampionEssence(choice.id);
  else this.grantChampionRelic(choice.id);

  const nextIndex=this.currentChampionRewardStepIndex+1;
  if(nextIndex<(this.currentChampionRewardFlow?.length||0)){
   this.currentChampionRewardStepIndex=nextIndex;
   this.showCurrentChampionRewardStep();
   return;
  }
  this.closeChampionRewards();
 }

 closeChampionRewards(){
  const finishedKind=this.currentChampionRewardKind;
  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.hideChampionRewards==='function') hudScene.hideChampionRewards();
  for(const obj of this.championRewardObjects){
   if(obj && obj.destroy) obj.destroy();
  }
  this.championRewardObjects=[];
  this.currentChampionRewardChoices=[];
  this.currentChampionRewardFlow=null;
  this.currentChampionRewardStepIndex=0;
  this.currentChampionRewardKind=null;
  this.championRewardOpen=false;
  this.setGameplayPaused('championReward',false);
  if(finishedKind==='brokenSaint'){
   this.setupBackgroundMusic();
   this.beginBrokenSaintSwordEpilogue();
  }

  this.grantXp(40);
  this.syncCharacterStats();

  const txt=lkAddText(this,
   this.player.x,this.player.y-62,
   'СИЛА ЧЕМПИОНА\nПРИНЯТА',
   {fontSize:'17px',color:'#ffe49b',align:'center',stroke:'#17120a',strokeThickness:3}
  ).setOrigin(0.5).setDepth(100);

  this.tweens.add({
   targets:txt,y:txt.y-35,alpha:0,duration:1300,
   onComplete:()=>txt.destroy()
  });
 }

 grantChampionSkillEvolution(id){
  if(!id) return;
  this.championSkillEvolutions.add(id);
  this.syncCharacterStats();
 }

 grantChampionRelic(id){
  if(!id) return;
  this.championRelics.add(id);
  if(id==='fallenBlessing') this.fallenBlessingUsed=false;
  if(id==='soulSkull') this.nextSoulSkullAt=this.time.now+1400;
  if(id==='cursedGround') this.nextCursedGroundAt=this.time.now+4000;
  this.syncCharacterStats();
 }

 grantChampionEssence(id){
  if(!id || this.championEssences.has(id)) return;
  this.championEssences.add(id);
  if(id===BROKEN_SAINT_ESSENCE_IDS.body){
   const previousMax=Math.max(1,this.player?.maxHp||BALANCE.PLAYER_BASE_MAX_HP);
   this.championHpMultiplier*=1.10;
   const nextMax=this.getRegionalPlayerMaxHp(this.progressionBalanceZoneIndex);
   if(this.player){
    this.player.maxHp=nextMax;
    this.player.hp=Math.min(nextMax,(this.player.hp||0)+Math.max(0,nextMax-previousMax));
    this.updateLowHealthState(true);
   }
  } else if(id===BROKEN_SAINT_ESSENCE_IDS.will){
   this.championManaRegenMultiplier*=0.92;
   this.manaRegenMs=Math.max(250,Math.round(BALANCE.MANA_REGEN_MS*this.championManaRegenMultiplier));
   if(this.mana<this.maxMana) this.nextManaRegenAt=this.time.now+this.manaRegenMs;
  } else if(id===BROKEN_SAINT_ESSENCE_IDS.discipline){
   this.skillRecoveryMultiplier*=0.94;
  }
  this.syncCharacterStats();
 }

 updateMana(time){
  if(this.devFlags?.infiniteMana){this.mana=this.maxMana;this.nextManaRegenAt=0;return;}
  if(this.mana>=this.maxMana){
   this.mana=this.maxMana;
   this.nextManaRegenAt=0;
   return;
  }
  if(!this.nextManaRegenAt) this.nextManaRegenAt=time+this.manaRegenMs;
  while(this.mana<this.maxMana && time>=this.nextManaRegenAt){
   this.mana=Math.min(this.maxMana,this.mana+1);
   if(this.mana<this.maxMana) this.nextManaRegenAt+=this.manaRegenMs;
   else this.nextManaRegenAt=0;
  }
 }

 getSkillManaCost(index){
  const discount=this.ashRosaryDiscount;
  if(
   this.championRelics.has(BROKEN_SAINT_RELIC_IDS.ashRosary) &&
   discount &&
   this.time.now<=(discount.expiresAt||0) &&
   index!==discount.sourceIndex
  ) return 0.75;
  return 1;
 }

 spendMana(index){
  if(this.devFlags?.infiniteMana){this.mana=this.maxMana;return true;}
  const cost=this.getSkillManaCost(index);
  if(this.mana+1e-6<cost) return false;
  const wasFull=this.mana>=this.maxMana;
  this.mana=Math.max(0,this.mana-cost);
  if(cost<1 && this.ashRosaryDiscount && index!==this.ashRosaryDiscount.sourceIndex){
   this.ashRosaryDiscount=null;
  }
  if(wasFull || !this.nextManaRegenAt) this.nextManaRegenAt=this.time.now+this.manaRegenMs;
  return true;
 }

 handleSkillInput(index){
  if(this.captainSystem?.isStunned())return;
  if(this.ashSwordPreludeState) return;
  if(this.gameOver || this.levelChoiceOpen || this.championRewardOpen || this.brokenSaintDefeatSequenceActive) return;
  // The five-second anomaly focus is a deliberate non-combat story beat.
  if(this.isStoryAnomalyMomentActive(this.time.now) || this.isAshChampionIntroActive()) return;
  if(this.time.now<(this.skillLockUntil||0)) return;
  const cost=this.getSkillManaCost(index);
  if(this.mana+1e-6<cost){
   this.showNoManaFeedback();
   return;
  }
  if(!this.spendMana(index)) return;
  this.armCombatStyleCharge();
  if(index===1){
   this.showCombatNotification('РАЗЛОМ',{color:'#d9c38e',key:'skill:quake',cooldown:180});
   this.playSkillSfx('sfx_skill_quake',0.294);
   this.castGroundTremor();
  } else if(index===2){
   this.showCombatNotification('ПОДЪЁМ',{color:'#b6e6ff',key:'skill:lift',cooldown:180});
   this.playSkillSfx('sfx_skill_lift');
   this.castLift();
  } else if(index===3){
   this.showCombatNotification('ВИХРЬ',{color:'#f3d699',key:'skill:spin',cooldown:180});
   this.playSkillSfx('sfx_skill_spin');
   this.castSpin();
  } else this.mana=Math.min(this.maxMana,this.mana+cost);
 }

 showNoManaFeedback(){
  if(this.time.now-(this.lastNoManaFxAt||-9999)<600) return;
  this.lastNoManaFxAt=this.time.now;
  const txt=lkAddText(this,this.player.x,this.player.y-48,'NO MANA',{fontSize:'14px',fontStyle:'bold',color:'#8fd8ff',stroke:'#10202d',strokeThickness:3})
   .setOrigin(0.5).setDepth(75);
  this.tweens.add({targets:txt,y:txt.y-20,alpha:0,duration:620,ease:'Quad.easeOut',onComplete:()=>txt.destroy()});
 }

 getHeroSocketDirectionFromVector(dx,dy,fallback='s'){
  if(Math.abs(dx)<1 && Math.abs(dy)<1) return fallback;
  const dir=this.getEightDirectionFromVector(dx,dy,'down');
  return ({
   up:'n',up_right:'ne',right:'e',down_right:'se',
   down:'s',down_left:'sw',left:'w',up_left:'nw'
  })[dir] || fallback;
 }

 isStoryFocusLocked(owner=''){
  const key=String(owner||'').trim();
  const now=this.time?.now||0;
  const activeOwner=String(this.storyFocusLockOwner||'').trim();
  if(activeOwner){
   return !key || key!==activeOwner;
  }
  return Number(this.storyFocusLockUntil||0)>now;
 }

 acquireStoryFocus(owner){
  const key=String(owner||'').trim();
  if(!key || this.isStoryFocusLocked(key)) return false;
  this.storyFocusLockOwner=key;
  this.storyFocusLockUntil=0;
  return true;
 }

 releaseStoryFocus(owner,{cooldownMs=STORY_FOCUS_RELEASE_COOLDOWN_MS}={}){
  const key=String(owner||'').trim();
  if(!key || String(this.storyFocusLockOwner||'').trim()!==key) return false;
  this.storyFocusLockOwner='';
  this.storyFocusLockUntil=(this.time?.now||0)+Math.max(0,Number(cooldownMs)||0);
  return true;
 }

 setHeroFocusInteraction(reason,active=true){
  const key=String(reason||'').trim();
  if(!key)return false;
  if(!this.heroFocusStanceReasons)this.heroFocusStanceReasons=new Set();
  if(active)this.heroFocusStanceReasons.add(key);
  else this.heroFocusStanceReasons.delete(key);
  return this.heroFocusStanceReasons.size>0;
 }

 isHeroFocusInteractionActive(){
  if(this.gameOver || !this.playerVisual?.active)return false;
  return Boolean(
   this.heroFocusStanceReasons?.size ||
   this.storyAnomalyCueState?.enemy?.active ||
   this.woundedKnightInteractions?.active ||
   this.storyDirector?.isBusy?.()
  );
 }

 isAshSwordPreludeActive(){
  return Boolean(this.ashSwordPreludeState);
 }

 prepareAshSwordTextures(){
  // Cut out only border-connected black background, using one shared mask.
  // Dark metal/rocks inside the silhouette stay fully opaque in every frame.
  const source=this.textures.get(ASH_SWORD_PULSE_FRAME_KEYS[0]).getSourceImage();
  const width=source.width,height=source.height,count=width*height;
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(source,0,0);
  const pixels=ctx.getImageData(0,0,width,height).data;
  const background=new Uint8Array(count),queue=new Int32Array(count);
  let read=0,write=0;
  const visit=(index)=>{
   if(background[index])return;
   const p=index*4;
   if(Math.max(pixels[p],pixels[p+1],pixels[p+2])>8)return;
   background[index]=1;queue[write++]=index;
  };
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}
  for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1);}
  while(read<write){
   const i=queue[read++],x=i%width;
   if(x>0)visit(i-1);if(x<width-1)visit(i+1);
   if(i>=width)visit(i-width);if(i<count-width)visit(i+width);
  }
  for(const key of ASH_SWORD_PULSE_FRAME_KEYS){
   if(this.textures.exists(`${key}_cutout`))continue;
   const texture=this.textures.createCanvas(`${key}_cutout`,width,height);
   texture.context.drawImage(this.textures.get(key).getSourceImage(),0,0);
   const frame=texture.context.getImageData(0,0,width,height);
   for(let i=0;i<count;i++)frame.data[i*4+3]=background[i]?0:255;
   texture.context.putImageData(frame,0,0);texture.refresh();
  }
 }

 beginAshSwordPulseAnimation(){
  const overlay=this.ashSwordPulseOverlay;
  if(!overlay?.active) return false;
  overlay.setVisible(true);
  overlay.play(ASH_SWORD_PULSE_ANIM_KEY,false);
  this.ashSwordNextPulseAt=this.time.now+ASH_SWORD_PULSE_CYCLE_MS;
  return true;
 }

 updateAshSwordPulse(time){
  if(!this.ashSwordNextPulseAt || time<this.ashSwordNextPulseAt)return;
  this.beginAshSwordPulseAnimation();
  const state=this.ashSwordPreludeState;
  if(!state || state.phase==='returning')return;
  if(state.phase==='locked'){
   if(state.lockedPulses>=ASH_SWORD_PRELUDE_LOCKED_PULSES)return;
   state.lockedPulses++;
   state.nextLockedPulseAt=time+ASH_SWORD_PULSE_CYCLE_MS;
  }
  this.playAshSwordPulseSfx();
 }

 stopAshSwordPulseAnimation({hide=false}={}){
  const overlay=this.ashSwordPulseOverlay;
  this.ashSwordNextPulseAt=0;
  if(!overlay) return false;
  overlay.anims?.stop?.();
  overlay.setTexture?.('ash_sword_pulse_01_cutout');
  return true;
 }

 stopAshSwordAmbientAnimation(){
  this.stopAshSwordPulseSfx();
  return this.stopAshSwordPulseAnimation({hide:true});
 }

 cancelAshSwordPrelude(){
  if(!this.ashSwordPreludeState) return false;
  const restoreZoom=this.ashSwordPreludeState.restoreZoom;
  this.stopAshSwordPulseSfx();
  this.stopSwordOrbitCrowFlock(120);
  this.stopAshSwordPulseAnimation({hide:true});
  this.ashSwordPreludeState=null;
  this.setHeroFocusInteraction('ashSwordPrelude',false);
  this.releaseStoryFocus('ashSwordPrelude',{cooldownMs:0});
  this.cameras.main.setZoom(restoreZoom);
  this.cameras.main.startFollow(this.player,true,1,1);
  return true;
 }

 beginAshSwordPrelude(time=this.time.now){
  if(this.ashSwordPulseCompleted || this.ashSwordPreludeState || this.wave!==2 || !this.ashSwordLandmark?.active) return false;
  if(!this.acquireStoryFocus('ashSwordPrelude')) return false;
  if(!this.ashSwordPulseOverlay?.active){
   this.releaseStoryFocus('ashSwordPrelude',{cooldownMs:0});
   return false;
  }

  const cam=this.cameras.main;
  const restoreZoom=cam.zoom;
  const focusZoom=Math.min(restoreZoom*1.14,restoreZoom+0.18);
  this.ashSwordPreludeState={
   phase:'hero',
   restoreZoom,
   focusZoom,
   heroArriveAt:time+ASH_SWORD_PRELUDE_HERO_FOCUS_MS,
   swordLockedAt:time+ASH_SWORD_PRELUDE_HERO_FOCUS_MS+ASH_SWORD_PRELUDE_SWORD_PAN_MS,
   lockedPulses:0,
   nextLockedPulseAt:0,
   returnAt:0
  };
  this.setHeroFocusInteraction('ashSwordPrelude',true);
  this.player?.body?.setVelocity?.(0,0);
  // No leftover bolt may hit a hero whose controls are locked for the scene.
  for(const projectile of this.projectiles||[])if(projectile?.active)projectile.destroy();
  this.projectiles=[];
  this.mobileMoveX=0;
  this.mobileMoveY=0;
  this.mobileMovePointerId=null;
  cam.stopFollow();
  // The birds are already circling the sword off-camera. When the camera pans
  // over, the flock is visibly in motion instead of spawning in front of the player.
  this.createSwordOrbitCrowFlock(this.ashSwordLandmark,time,{playSound:false});
  cam.pan(this.player.x,this.player.y,ASH_SWORD_PRELUDE_HERO_FOCUS_MS,'Sine.easeOut',true);
  cam.zoomTo(focusZoom,ASH_SWORD_PRELUDE_HERO_FOCUS_MS,'Sine.easeOut',true);
  this.beginAshSwordPulseAnimation();
  this.playAshSwordPulseSfx();
  return true;
 }

 updateAshSwordPrelude(time=this.time.now){
  const state=this.ashSwordPreludeState;
  if(!state) return false;
  const sword=this.ashSwordLandmark;
  const cam=this.cameras.main;
  if(!sword?.active || this.gameOver){
   this.cancelAshSwordPrelude();
   return false;
  }

  this.player?.body?.setVelocity?.(0,0);
  if(state.phase==='hero' && time>=state.heroArriveAt){
   state.phase='sword';
   state.swordLockedAt=time+ASH_SWORD_PRELUDE_SWORD_PAN_MS;
   // Sword-cinematic crows are visual-only: no wing loop or scatter call here.
   const focusY=sword.y-Math.min(46,Math.max(18,(sword.displayHeight||0)*0.14));
   cam.pan(sword.x,focusY,ASH_SWORD_PRELUDE_SWORD_PAN_MS,'Sine.easeInOut',true);
   cam.zoomTo(state.focusZoom,ASH_SWORD_PRELUDE_SWORD_PAN_MS,'Sine.easeInOut',true);
  }
  if(state.phase==='sword' && time>=state.swordLockedAt){
   state.phase='locked';
   state.lockedPulses=0;
  }
  if(state.phase==='locked' && state.lockedPulses===ASH_SWORD_PRELUDE_LOCKED_PULSES && time>=state.nextLockedPulseAt){
    state.phase='returning';
    state.returnAt=time+ASH_SWORD_PRELUDE_RETURN_MS;
    this.stopAshSwordPulseSfx();
    this.stopSwordOrbitCrowFlock(220);
    cam.pan(this.player.x,this.player.y,ASH_SWORD_PRELUDE_RETURN_MS,'Quad.easeOut',true);
    cam.zoomTo(state.restoreZoom,ASH_SWORD_PRELUDE_RETURN_MS,'Quad.easeOut',true);
  }
  if(state.phase==='returning' && time>=state.returnAt){
   cam.setZoom(state.restoreZoom);
   cam.centerOn(this.player.x,this.player.y);
   cam.startFollow(this.player,true,1,1);
   this.ashSwordPreludeState=null;
   this.ashSwordPulseCompleted=true;
   this.setHeroFocusInteraction('ashSwordPrelude',false);
   this.releaseStoryFocus('ashSwordPrelude',{cooldownMs:0});
   if(!this.combatStyleChoiceShown){
    this.pendingCombatStyleWave=3;
    this.openCombatStyleChoice();
   }else this.startWave(3);
  }
  return true;
 }

 updateHeroFocusInteractionStance(frameTime=0){
  const active=this.isHeroFocusInteractionActive();
  if(!active){
   if(this.heroFocusStanceWasActive){
    this.heroFocusStanceWasActive=false;
    if(this.playerVisualState===HERO_FOCUS_STANCE_STATE)this.playerVisualState='';
    if(this.meleeAttack)this.meleeAttack.lastAttack=this.time?.now||0;
   }
   return false;
  }

  const hero=this.playerVisual;
  if(!hero?.active || this.playerVisualState==='hero_death')return false;

  if(!this.heroFocusStanceWasActive){
   this.heroFocusStanceWasActive=true;
   this.playerAttackUntil=0;
   if(this.activeAttackFx?.active){
    try{this.activeAttackFx.destroy();}catch{}
    this.activeAttackFx=null;
   }
   if(this.meleeAttack)this.meleeAttack.lastAttack=this.time?.now||0;
  }

  this.player?.body?.setVelocity?.(0,0);
  hero.stop();
  const frameIndex=(Math.floor(Math.max(0,Number(frameTime)||0)/HERO_FOCUS_STANCE_FRAME_MS)%2)+1;
  const textureKey=`hero_socket_walk_s_${String(frameIndex).padStart(2,'0')}`;
  if(hero.texture?.key!==textureKey)hero.setTexture(textureKey);
  hero.setPosition(this.player.x,this.player.y);
  this.playerVisualDir8='s';
  this.playerDir='down';
  this.playerVisualState=HERO_FOCUS_STANCE_STATE;
  this.updateHeroWeaponAttachment();
  return true;
 }

 startHeroSpinAttack(duration=HERO_SOCKET_SPIN_DURATION_MS){
  this.playerAttackUntil=Math.max(this.playerAttackUntil||0,this.time.now+duration);
  if(this.playerVisual && this.playerVisual.active){
   this.playerVisualState='hero_socket_spin';
   this.playerVisual.play('hero_socket_spin',true);
  }
  this.updateHeroWeaponAttachment();
 }

 createHeroWeaponAttachment(){
  this.heroWeaponSocketProject=this.cache.json.get('last_knight_weapon_socket_project')||null;
  const defaultTexture='weapon_socket_sword_n';
  this.playerWeaponBack=this.add.sprite(this.player.x,this.player.y,defaultTexture)
   .setDepth((this.playerVisual?.depth||20)-0.05)
   .setVisible(false);
  this.playerWeaponFront=this.add.sprite(this.player.x,this.player.y,defaultTexture)
   .setDepth((this.playerVisual?.depth||20)+0.05)
   .setVisible(false);
  this.playerWeaponMaskShape=this.make.graphics({x:0,y:0,add:false});
  this.playerWeaponFrontMask=this.playerWeaponMaskShape.createGeometryMask();
 }

 getHeroWeaponPlacementForCurrentFrame(){
  if(!this.playerVisual || !this.playerVisual.active) return null;
  const textureKey=this.playerVisual.texture?.key||'';
  if(!textureKey.startsWith('hero_socket_')) return null;
  const sourceName=textureKey.replace(/^hero_socket_/,'hero_')+'.png';
  return this.heroWeaponSocketProject?.sockets?.frames?.[sourceName]||null;
 }

 updateHeroWeaponAttachment(){
  const back=this.playerWeaponBack;
  const front=this.playerWeaponFront;
  const hero=this.playerVisual;
  if(!back || !front || !hero || !hero.active){
   if(back) back.setVisible(false);
   if(front) front.setVisible(false);
   return;
  }

  const placement=this.getHeroWeaponPlacementForCurrentFrame();
  if(!placement){
   back.setVisible(false);
   front.setVisible(false);
   return;
  }

  const variant=placement.variant||'sword_n';
  const weaponMeta=this.heroWeaponSocketProject?.weapon?.variants?.[variant];
  if(!weaponMeta){
   back.setVisible(false);
   front.setVisible(false);
   return;
  }

  const textureKey=`weapon_socket_${variant}`;
  const heroScaleX=hero.scaleX||1;
  const heroScaleY=hero.scaleY||1;
  const sourceW=placement.width||hero.frame?.realWidth||hero.frame?.width||1;
  const sourceH=placement.height||hero.frame?.realHeight||hero.frame?.height||1;
  const heroLeft=hero.x-sourceW*heroScaleX*hero.originX;
  const heroTop=hero.y-sourceH*heroScaleY*hero.originY;
  const socketX=heroLeft+(placement.socketX||0)*heroScaleX;
  const socketY=heroTop+(placement.socketY||0)*heroScaleY;
  const weaponScale=Math.abs(heroScaleX)*(placement.scale??1);
  const originX=(weaponMeta.gripX||0)/Math.max(1,weaponMeta.width||1);
  const originY=(weaponMeta.gripY||0)/Math.max(1,weaponMeta.height||1);
  const rotation=Phaser.Math.DegToRad(placement.rotationDeg||0);

  for(const sprite of [back,front]){
   if(sprite.texture?.key!==textureKey) sprite.setTexture(textureKey);
   sprite.setOrigin(originX,originY);
   sprite.setPosition(socketX,socketY);
   sprite.setScale(weaponScale);
   sprite.setRotation(rotation);
   sprite.setFlipX(!!placement.flipX);
   sprite.setFlipY(!!placement.flipY);
  }

  back.setDepth((hero.depth||20)-0.05);
  front.setDepth((hero.depth||20)+0.05);
  front.clearMask();
  const layer=placement.layer||'front';
  back.setVisible(layer==='back'||layer==='split'||layer==='splitInvert');
  front.setVisible(layer==='front'||layer==='split'||layer==='splitInvert');

  if(layer==='split'||layer==='splitInvert'){
   const radius=Math.max(0,placement.frontRevealRadius||0)*weaponScale;
   this.playerWeaponMaskShape.clear();
   this.playerWeaponMaskShape.fillStyle(0xffffff,1);
   this.playerWeaponMaskShape.fillCircle(socketX,socketY,Math.max(0.01,radius));
   this.playerWeaponFrontMask.setInvertAlpha(layer==='splitInvert');
   front.setMask(this.playerWeaponFrontMask);
  }
 }

 hasChampionEvolution(id){
  return Boolean(id && this.championSkillEvolutions?.has(id));
 }

 triggerAshRosary(sourceIndex,hitCount){
  if(!this.championRelics.has(BROKEN_SAINT_RELIC_IDS.ashRosary) || hitCount<3) return;
  this.ashRosaryDiscount={sourceIndex,expiresAt:this.time.now+6000};
  const txt=lkAddText(this,this.player.x,this.player.y-52,'ЧЁТКИ: СЛЕДУЮЩИЙ ДРУГОЙ НАВЫК −25% МАНЫ',{
   fontSize:'11px',color:'#ffb36d',stroke:'#251108',strokeThickness:3,align:'center'
  }).setOrigin(0.5).setDepth(78);
  this.tweens.add({targets:txt,y:txt.y-18,alpha:0,duration:900,onComplete:()=>txt.destroy()});
 }

 markSaintsNailTarget(enemy){
  if(!enemy?.active || enemy.hp<=0) return false;
  const now=this.time.now;
  enemy.saintsNailMarkedUntil=now+BROKEN_SAINT_MARK_DURATION_MS;
  if(enemy.saintsNailMarkVisual?.active) enemy.saintsNailMarkVisual.destroy();
  enemy.saintsNailMarkVisual=this.add.circle(enemy.x,enemy.y,Math.max(24,(enemy.hitRadius||14)+10),0x6aa8ff,0.05)
   .setStrokeStyle(2,0xaed6ff,0.92).setDepth(14.6);
  const txt=lkAddText(this,enemy.x,enemy.y-42,'КЛЕЙМО',{
   fontSize:'11px',fontStyle:'bold',color:'#b9dcff',stroke:'#102038',strokeThickness:3
  }).setOrigin(0.5).setDepth(33);
  this.tweens.add({targets:txt,y:txt.y-12,alpha:0,duration:650,onComplete:()=>txt.destroy()});
  return true;
 }

 maybeMarkSaintsNailAttacker(attacker,now=this.time.now){
  if(!this.championRelics.has(BROKEN_SAINT_RELIC_IDS.saintsNail) || !attacker?.active || attacker.hp<=0) return false;
  const liftWindow=now>=(this.liftPostMarkWindowStartsAt||0) && now<=(this.liftPostMarkWindowUntil||0) && !this.liftPostMarkConsumed;
  const spinWindow=now<(this.spinCommitUntil||0) && !this.spinSaintsNailConsumed;
  if(!liftWindow && !spinWindow) return false;
  if(liftWindow) this.liftPostMarkConsumed=true;
  if(spinWindow) this.spinSaintsNailConsumed=true;
  return this.markSaintsNailTarget(attacker);
 }

 consumeSaintsNailSkillBonus(enemy){
  if(!enemy?.active || this.time.now>(enemy.saintsNailMarkedUntil||0)) return 1;
  enemy.saintsNailMarkedUntil=0;
  if(enemy.saintsNailMarkVisual?.active) enemy.saintsNailMarkVisual.destroy();
  enemy.saintsNailMarkVisual=null;
  return 1.30;
 }

 getBrokenSaintCommitmentDamageReduction(now=this.time.now){
  let reduction=0;
  if(this.hasChampionEvolution(BROKEN_SAINT_EVOLUTION_IDS.verdict) && now<(this.liftCommitUntil||0)) reduction+=0.25;
  if(this.hasChampionEvolution(BROKEN_SAINT_EVOLUTION_IDS.saintStance) && now<(this.spinCommitUntil||0)) reduction+=0.18;
  return Math.min(0.30,reduction);
 }

 registerCrackedHaloDamage(now=this.time.now){
  if(!this.championRelics.has(BROKEN_SAINT_RELIC_IDS.crackedHalo)) return;
  if(now>=(this.liftCommitUntil||0) && now>=(this.spinCommitUntil||0)) return;
  const before=this.bsPenitenceCharges||0;
  this.bsPenitenceCharges=Math.min(3,before+1);
  if(this.bsPenitenceCharges!==before){
   const txt=lkAddText(this,this.player.x,this.player.y-46,`ПОКАЯНИЕ ${this.bsPenitenceCharges}/3`,{
    fontSize:'11px',fontStyle:'bold',color:'#ffd878',stroke:'#2b1808',strokeThickness:3
   }).setOrigin(0.5).setDepth(78);
   this.tweens.add({targets:txt,y:txt.y-14,alpha:0,duration:620,onComplete:()=>txt.destroy()});
  }
 }

 setSkillAttackPose(duration){
  const recoveryDuration=Math.max(120,Math.round(duration*(this.skillRecoveryMultiplier||1)));
  this.skillLockUntil=Math.max(this.skillLockUntil||0,this.time.now+recoveryDuration);
  this.playerAttackDir=this.playerDir||'down';
  this.startHeroSpinAttack(recoveryDuration);
 }

 consumeShieldBlock(enemy){
  if(!enemy || enemy.type!=='shield' || !enemy.active || enemy.hp<=0) return false;
  const now=this.time.now;
  if(!enemy.blockNext && now>=(enemy.blockReadyAt||0)) enemy.blockNext=true;
  if(!enemy.blockNext) return false;

  enemy.blockNext=false;
  enemy.blockReadyAt=now+BALANCE.SHIELD_BLOCK_RESET_MS;
  if(enemy.visual && enemy.visual.active){
   enemy.visual.setTint(0xffffff);
   this.time.delayedCall(120,()=>{ if(enemy.visual && enemy.visual.active) enemy.visual.clearTint(); });
  }
  return true;
 }

 applySkillDamage(enemy,baseDamage,source,tint=0xffd77a,knockback=105){
  if(!enemy || !enemy.active || enemy.hp<=0) return false;
  if(this.consumeShieldBlock(enemy)) return false;
  const nailMultiplier=this.consumeSaintsNailSkillBonus(enemy);
  const adjustedBase=baseDamage*nailMultiplier;
  const resolved=this.getSwordDamageAgainst ? this.getSwordDamageAgainst(enemy,adjustedBase) : adjustedBase;
  const killed=this.damageEnemy(enemy,resolved,source,tint);
  if(!killed && enemy.body && enemy.body.enable && enemy.active){
   const angle=Phaser.Math.Angle.Between(this.player.x,this.player.y,enemy.x,enemy.y);
   this.applyEnemyHitReaction(enemy,angle,knockback);
  }
  return killed;
 }

 castGroundTremor(){
  const radius=190;
  const penitenceCharges=this.championRelics.has(BROKEN_SAINT_RELIC_IDS.crackedHalo)
   ? Math.min(3,this.bsPenitenceCharges||0)
   : 0;
  if(penitenceCharges>0) this.bsPenitenceCharges=0;
  // Ground Tremor remains an escape / space-making tool. Broken Saint may add
  // payoff to a successful escape, but never changes the skill into a nuke.
  const damage=this.getEffectiveMeleeDamage()*0.4*(1+penitenceCharges*0.12);
  const maxPushDistance=220*(1+penitenceCharges*0.15);
  const pushMs=430;
  this.setSkillAttackPose(520);
  const x=this.player.x,y=this.player.y;
  const core=this.add.circle(x,y,34,0xe0b85d,0.18).setStrokeStyle(4,0xf5d98c,0.92).setDepth(18);
  const wave=this.add.circle(x,y,64,0x6b4d2b,0.06).setStrokeStyle(6,0xd5a84f,0.86).setDepth(17);
  this.tweens.add({targets:core,scale:1.8,alpha:0,duration:300,onComplete:()=>core.destroy()});
  this.tweens.add({targets:wave,scale:radius/64,alpha:0,duration:380,ease:'Quad.easeOut',onComplete:()=>wave.destroy()});
  this.cameras.main.shake(220,0.008);
  let hitCount=0;
  for(const enemy of this.enemies){
   if(!enemy.active || enemy.hp<=0) continue;
   const d=Phaser.Math.Distance.Between(x,y,enemy.x,enemy.y);
   if(d>radius+(enemy.hitRadius||0)) continue;
   hitCount++;

   this.applySkillDamage(enemy,damage,'skill:tremor',0xffd77a,0);
   if(!enemy.active || enemy.hp<=0 || !enemy.body) continue;
   if(this.isCaptainCastUninterruptible(enemy)) continue;

   // Strong in the centre, progressively softer near the edge. Enemy class then
   // modifies the displacement so heavy targets keep their identity.
   let resistance={skeleton:1.0,mage:0.70,shield:0.55,champion:0.18}[enemy.type] ?? 0.75;
   if(enemy.type==='champion' && enemy.championKind==='shieldWarden') resistance=0.12;
   if(enemy.type==='champion' && enemy.championKind==='hollowTree') resistance=0;
   if(resistance<=0) continue;

   const angle=d>1
    ? Phaser.Math.Angle.Between(x,y,enemy.x,enemy.y)
    : Phaser.Math.FloatBetween(-Math.PI,Math.PI);
   const normalized=Phaser.Math.Clamp(d/Math.max(1,radius),0,1);
   const falloff=Phaser.Math.Linear(1.0,0.28,normalized);
   const pushDistance=maxPushDistance*falloff*resistance;
   const pushSpeed=(pushDistance/(pushMs/1000));
   enemy.skillTremorVX=Math.cos(angle)*pushSpeed;
   enemy.skillTremorVY=Math.sin(angle)*pushSpeed;
   enemy.skillTremorUntil=this.time.now+pushMs;
   enemy.staggerUntil=Math.max(enemy.staggerUntil||0,enemy.skillTremorUntil+500);
   enemy.body.setVelocity(enemy.skillTremorVX,enemy.skillTremorVY);
  }

  if(this.hasChampionEvolution(BROKEN_SAINT_EVOLUTION_IDS.pilgrimPath) && hitCount>=2){
   this.playerSpeedBoostUntil=Math.max(this.playerSpeedBoostUntil||0,this.time.now+2000);
   this.playerSpeedBoostFactor=Math.max(this.playerSpeedBoostFactor||1,1.35);
   const txt=lkAddText(this,this.player.x,this.player.y-52,'ПУТЬ ПАЛОМНИКА · +35% СКОРОСТИ',{
    fontSize:'11px',fontStyle:'bold',color:'#ffe09a',stroke:'#2a1b08',strokeThickness:3
   }).setOrigin(0.5).setDepth(78);
   this.tweens.add({targets:txt,y:txt.y-16,alpha:0,duration:700,onComplete:()=>txt.destroy()});
  }
  this.triggerAshRosary(1,hitCount);
 }

 castLift(){
  const radius=175;
  const initialDamage=this.getEffectiveMeleeDamage()*0.75;
  const landingDamage=this.getEffectiveMeleeDamage()*0.75;
  this.setSkillAttackPose(650);
  const x=this.player.x,y=this.player.y;
  const castAt=this.time.now;
  const field=this.add.circle(x,y,58,0x75b7ff,0.09).setStrokeStyle(4,0x9dd7ff,0.82).setDepth(16);
  this.tweens.add({targets:field,scale:radius/58,alpha:0,duration:560,ease:'Sine.easeOut',onComplete:()=>field.destroy()});
  this.cameras.main.shake(200,0.007);

  let longestLiftMs=0;
  let hitCount=0;
  for(const enemy of this.enemies){
   if(!enemy.active || enemy.hp<=0) continue;
   const d=Phaser.Math.Distance.Between(x,y,enemy.x,enemy.y);
   if(d>radius+(enemy.hitRadius||0)) continue;
   hitCount++;

   // Hollow Tree is rooted into the arena: Lift can hurt it, but cannot launch,
   // stagger or otherwise disable its AI. It therefore does not create the
   // player's commitment slowdown.
   if(enemy.type==='champion' && enemy.championKind==='hollowTree'){
    const resolved=this.getSwordDamageAgainst(enemy,initialDamage);
    this.damageEnemy(enemy,resolved,'skill:lift',0x9dd7ff);
    continue;
   }

   this.applySkillDamage(enemy,initialDamage,'skill:lift',0x9dd7ff,16);
   if(!enemy.active || enemy.hp<=0) continue;
   if(this.isCaptainCastUninterruptible(enemy)) continue;

   let liftMs=1200;
   let heightMin=118,heightMax=146;
   let drift=24;
   let landingKnockback=100;
   if(enemy.type==='shield'){
    liftMs=650;
    heightMin=72;heightMax=92;drift=15;landingKnockback=70;
   } else if(enemy.type==='champion'){
    liftMs=300;
    heightMin=28;heightMax=40;drift=7;landingKnockback=18;
   }
   longestLiftMs=Math.max(longestLiftMs,liftMs);

   enemy.skillLiftStartAt=castAt;
   enemy.skillLiftUntil=castAt+liftMs;
   enemy.skillLiftHeight=Phaser.Math.Between(heightMin,heightMax);
   enemy.skillLiftDriftX=Phaser.Math.Between(-drift,drift);
   enemy.skillLiftDriftY=Phaser.Math.Between(-Math.max(4,Math.round(drift*0.6)),Math.max(4,Math.round(drift*0.6)));
   enemy.skillLiftMotion=enemy.type==='champion' ? 0 : Phaser.Math.Between(0,2);
   enemy.skillLiftTilt=Phaser.Math.FloatBetween(-0.32,0.32);
   enemy.staggerUntil=Math.max(enemy.staggerUntil||0,enemy.skillLiftUntil+(enemy.type==='champion'?40:160));
   if(enemy.body) enemy.body.setVelocity(enemy.skillLiftDriftX,enemy.skillLiftDriftY);

   this.time.delayedCall(liftMs,()=>{
    if(!enemy || !enemy.active || enemy.hp<=0) return;
    enemy.skillLiftUntil=0;
    if(enemy.visual && enemy.visual.active){
     enemy.visual.setRotation(0);
     enemy.visual.setScale(enemy.visualBaseScale||enemy.visual.scaleX||0.5);
    }
    this.applySkillDamage(enemy,landingDamage,'skill:lift-landing',0xb9e5ff,landingKnockback);
    const impact=this.add.circle(enemy.x,enemy.y,18,0x9dd7ff,0.12).setStrokeStyle(3,0xd9f1ff,0.8).setDepth(17);
    this.tweens.add({targets:impact,scale:2.15,alpha:0,duration:260,onComplete:()=>impact.destroy()});
   });
  }

  if(longestLiftMs>0){
   const landingAt=castAt+longestLiftMs;
   // Defensive commitment ends on landing; the movement debuff is deliberately
   // harsher and lingers for another three seconds as the price of strong CC.
   this.liftCommitUntil=Math.max(this.liftCommitUntil||0,landingAt);
   this.liftSlowUntil=Math.max(this.liftSlowUntil||0,landingAt+BROKEN_SAINT_LIFT_POST_SLOW_MS);
   this.liftPostMarkWindowStartsAt=landingAt;
   this.liftPostMarkWindowUntil=this.liftPostMarkWindowStartsAt+BROKEN_SAINT_LIFT_POST_MARK_WINDOW_MS;
   this.liftPostMarkConsumed=false;
   this.time.delayedCall(longestLiftMs,()=>{
    if(!this.gameOver) this.cameras.main.shake(210,0.007);
   });
  }
  this.triggerAshRosary(2,hitCount);
 }

 castSpin(){
  const radius=132;
  const perHit=this.getEffectiveMeleeDamage()*0.55;
  const castAt=this.time.now;
  this.spinCommitUntil=castAt+760;
  this.spinSaintsNailConsumed=false;
  this.setSkillAttackPose(760);
  for(let hit=0;hit<4;hit++){
   this.time.delayedCall(hit*165,()=>{
    if(this.gameOver) return;
    const x=this.player.x,y=this.player.y;
    const ring=this.add.circle(x,y,46,0xe1c575,0.04).setStrokeStyle(5,0xf0cf78,0.78).setDepth(18);
    this.tweens.add({targets:ring,scale:radius/46,alpha:0,duration:180,ease:'Quad.easeOut',onComplete:()=>ring.destroy()});
    for(const enemy of this.enemies){
     if(!enemy.active || enemy.hp<=0) continue;
     const d=Phaser.Math.Distance.Between(x,y,enemy.x,enemy.y);
     if(d<=radius+(enemy.hitRadius||0)) this.applySkillDamage(enemy,perHit,`skill:spin-${hit+1}`,0xffe197,70);
    }
   });
  }
 }

 markEnemyDefeated(enemy){
  if(!enemy || !enemy.active) return false;
  enemy.hp=0;
  enemy.attackAnimUntil=0;
  enemy.staggerUntil=0;
  if(enemy.body){
   enemy.body.setVelocity(0,0);
   enemy.body.enable=false;
  }
  return true;
 }

 damageEnemy(enemy,amount,source='effect',tint=0x8cff77){
  if(!enemy || !enemy.active || enemy.hp<=0 || amount<=0) return false;

  const applied=Math.max(1,Math.round(amount));
  // Keep game state and the boss UI in lockstep even on the killing hit.
  // The death sequence is allowed to start only after the authoritative value
  // has reached literal zero; this prevents a stale-looking HP bar on death.
  enemy.hp=Math.max(0,enemy.hp-applied);
  if(enemy===this.activeChampion) this.updateChampionBar();
  if(enemy.hp===0) this.markEnemyDefeated(enemy);

  // Special/relic damage was previously almost invisible, so working DOTs
  // looked broken. A small throttled tick makes every proc testable in-game.
  const now=this.time.now;
  if(now-(enemy.lastSpecialDamageFxAt||-99999)>=240){
   enemy.lastSpecialDamageFxAt=now;

   if(enemy.visual && enemy.visual.active){
    enemy.visual.setTint(tint);
    this.time.delayedCall(85,()=>{
     if(enemy.visual && enemy.visual.active) enemy.visual.clearTint();
    });
   }

   const tick=lkAddText(this,
    enemy.x,enemy.y-24,`-${applied}`,
    {
     fontSize:'11px',
     color:source.includes('poison') || source.includes('curse') ? '#76ff83' : '#ffe6a6',
     stroke:'#101510',
     strokeThickness:2
    }
   ).setOrigin(0.5).setDepth(35);

   this.tweens.add({
    targets:tick,
    y:tick.y-13,
    alpha:0,
    duration:330,
    onComplete:()=>tick.destroy()
   });
  }

  return enemy.hp<=0;
 }

 finalizeEnemyDeath(enemy,time=this.time.now){
  if(!enemy || !enemy.active || enemy.hp>0 || enemy.deathFinalized) return false;
  enemy.deathFinalized=true;
  this.captainSystem?.onDeath(enemy,time);
  this.markEnemyDefeated(enemy);

  const deathX=enemy.x;
  const deathY=enemy.y;
  const enemyType=enemy.type;
  const orbCount=enemyType==='champion' ? 0 : 1;

  for(let i=0;i<orbCount;i++){
   const offsetX=Phaser.Math.Between(-18,18);
   const offsetY=Phaser.Math.Between(-18,18);
   const dropPos=this.findNearestFreeGroundPoint(deathX+offsetX,deathY+offsetY,20,520,16);
   const orb=this.add.image(dropPos.x,dropPos.y,'xp_crystal').setDepth(12);
   this.physics.add.existing(orb);
   this.orbs.push(orb);
  }

  if(enemyType!=='champion'){
   const lowHp=this.player && this.player.hp<BALANCE.HEART_PITY_HP_THRESHOLD;
   if(lowHp) this.heartPityKills=(this.heartPityKills||0)+1;
   else this.heartPityKills=0;

   const pityBonus=lowHp
    ? Math.max(0,(this.heartPityKills-BALANCE.HEART_PITY_START_KILLS))*BALANCE.HEART_PITY_STEP
    : 0;
   const heartChance=Math.min(BALANCE.HEART_PITY_MAX_CHANCE,BALANCE.HEART_BASE_CHANCE+pityBonus);

   if(Math.random()<heartChance){
    const heartPos=this.findNearestFreeGroundPoint(deathX,deathY,20,520,16);
    this.spawnHealthHeart(heartPos.x,heartPos.y,{expiresIn:30000,source:'enemy'});
    this.heartPityKills=0;
   }
  }

  this.onEnemyKilled(enemy,deathX,deathY);
  const reverseSmokeDeath=Boolean(enemyType==='champion' && enemy.championKind==='brokenSaint');
  if(enemyType==='champion') this.onChampionDefeated(enemy);
  if(!reverseSmokeDeath) this.createDeathBurst(enemy,deathX,deathY);

  // Broken Saint's sprite and readability shadow are intentionally left alive
  // for ~1.3s so the death can mirror his reveal: smoke in, figure out.
  if(!reverseSmokeDeath && enemy.visual && enemy.visual.active) enemy.visual.destroy();
  if(enemy.auraVisual && enemy.auraVisual.active) enemy.auraVisual.destroy();
  if(enemy.reflectVisual && enemy.reflectVisual.active) enemy.reflectVisual.destroy();
  if(enemy.saintsNailMarkVisual?.active) enemy.saintsNailMarkVisual.destroy();
  if(!reverseSmokeDeath) this.destroyEnemyReadabilityShadow(enemy);

  enemy.destroy();
  this.kills++;
  return true;
 }

 cleanupDefeatedEnemies(time=this.time.now){
  let finalized=false;
  for(const enemy of [...this.enemies]){
   if(enemy && enemy.active && enemy.hp<=0){
    finalized=this.finalizeEnemyDeath(enemy,time) || finalized;
   }
  }
  this.enemies=this.enemies.filter(enemy=>enemy && enemy.active);
  return finalized;
 }

 applyPlayerRootSlow(duration=1450,factor=0.45){
  this.playerSlowUntil=Math.max(this.playerSlowUntil||0,this.time.now+duration);
  this.playerSlowFactor=Math.min(this.playerSlowFactor||1,factor);

  if(this.playerVisual && this.playerVisual.active){
   this.playerVisual.setTint(0xb4d97d);
   this.time.delayedCall(duration,()=>{
    if(
     this.playerVisual &&
     this.playerVisual.active &&
     this.time.now>=this.playerSlowUntil
    ){
     this.playerVisual.clearTint();
     this.playerSlowFactor=1;
    }
   });
  }

  const txt=lkAddText(this,
   this.player.x,this.player.y-48,'ROOTED',
   {fontSize:'14px',color:'#c9ee8e',stroke:'#13200d',strokeThickness:3}
  ).setOrigin(0.5).setDepth(40);

  this.tweens.add({
   targets:txt,y:txt.y-18,alpha:0,duration:650,
   onComplete:()=>txt.destroy()
  });
 }

 applyPlayerForcedMotion(vx,vy,duration=190){
  this.playerForcedVX=vx;
  this.playerForcedVY=vy;
  this.playerForcedUntil=Math.max(
   this.playerForcedUntil||0,
   this.time.now+duration
  );
 }


 clearHeroHitImpactTimers(restoreTimeScale=false){
  for(const prop of ['heroHitImpactTimer','heroHitImpactSlowTimer','heroHitImpactZoomTimer']){
   const timer=this[prop];
   if(timer!==null&&timer!==undefined){try{window.clearTimeout(timer);}catch{}this[prop]=null;}
  }
  if(restoreTimeScale){
   const base=Math.max(0.1,Number(this.devTimeScale)||1);
   try{this.time.timeScale=base;}catch{}
   try{this.tweens.timeScale=base;}catch{}
   try{this.physics.world.timeScale=1/base;}catch{}
  }
 }

 setHeroHitImpactTimeScale(scale){
  const safe=Phaser.Math.Clamp(Number(scale)||1,0.1,4);
  try{this.time.timeScale=safe;}catch{}
  try{this.tweens.timeScale=safe;}catch{}
  try{this.physics.world.timeScale=1/safe;}catch{}
 }

 getHeroHitKnockbackVector(attacker,force=HERO_HIT_IMPACT_PROFILE.knockback){
  let dx=0,dy=0;
  if(attacker && Number.isFinite(attacker.x) && Number.isFinite(attacker.y)){
   dx=this.player.x-attacker.x;
   dy=this.player.y-attacker.y;
  }else{
   const vectors={up:{x:0,y:1},down:{x:0,y:-1},left:{x:1,y:0},right:{x:-1,y:0}};
   const fallback=vectors[this.playerDir]||vectors.down;
   dx=fallback.x;dy=fallback.y;
  }
  const len=Math.hypot(dx,dy)||1;
  return {vx:dx/len*force,vy:dy/len*force};
 }

 spawnHeroHitBloodImpact(attacker=null){
  if(!this.player?.active)return;
  let awayX=0,awayY=-1;
  if(attacker && Number.isFinite(attacker.x) && Number.isFinite(attacker.y)){
   awayX=this.player.x-attacker.x;awayY=this.player.y-attacker.y;
   const len=Math.hypot(awayX,awayY)||1;awayX/=len;awayY/=len;
  }
  const baseAngle=Math.atan2(awayY,awayX);
  for(let i=0;i<18;i++){
   const radius=Phaser.Math.FloatBetween(1.6,4.0);
   const color=Phaser.Utils.Array.GetRandom([0x8d1717,0xc02b22,0x5f1010]);
   const drop=this.add.circle(
    this.player.x+Phaser.Math.Between(-9,9),
    this.player.y-10+Phaser.Math.Between(-11,7),
    radius,color,Phaser.Math.FloatBetween(0.72,0.96)
   ).setDepth(72);
   const angle=baseAngle+Phaser.Math.FloatBetween(-1.18,1.18);
   const speed=Phaser.Math.Between(65,190);
   const dx=Math.cos(angle)*speed*Phaser.Math.FloatBetween(0.38,0.58);
   const dy=Math.sin(angle)*speed*Phaser.Math.FloatBetween(0.30,0.50)+Phaser.Math.Between(-14,10);
   const duration=Phaser.Math.Between(460,820);
   this.tweens.add({
    targets:drop,
    x:drop.x+dx,
    y:drop.y+dy+Phaser.Math.Between(22,62),
    scale:Phaser.Math.FloatBetween(0.28,0.58),
    alpha:0,
    duration,
    ease:'Quad.easeOut',
    onComplete:()=>drop.destroy()
   });
  }
 }

 applyHeroDamageImpact(attacker=null){
  if(!this.player?.active || !this.cameras?.main)return;
  const st=HERO_HIT_IMPACT_PROFILE;
  const cam=this.cameras.main;
  const baseScale=Math.max(0.1,Number(this.devTimeScale)||1);
  const baseZoom=cam.zoom;

  // Prevent an old temporary profile from restoring stale timing/zoom after a new hit.
  this.clearHeroHitImpactTimers(false);

  const intensity=new Phaser.Math.Vector2(
   Math.max(0,st.shakeX)/(Math.max(1,cam.width)*1.7),
   Math.max(0,st.shakeY)/(Math.max(1,cam.height)*1.7)
  );
  try{cam.shake(Math.max(80,120+st.hitStop*2.2),intensity,true);}catch{cam.shake(Math.max(80,120+st.hitStop*2.2),Math.max(intensity.x,intensity.y),true);}
  if(st.flash>0.01)cam.flash(Math.round(70+180*st.flash),255,246,225,true);

  if(st.zoom>1.001){
   try{cam.setZoom(baseZoom*st.zoom);}catch{}
   this.heroHitImpactZoomTimer=window.setTimeout(()=>{
    if(!this.sys?.isActive?.())return;
    this.heroHitImpactZoomTimer=null;
    try{this.tweens.add({targets:cam,zoom:baseZoom,duration:80,ease:'Quad.easeOut',onComplete:()=>cam.setZoom(baseZoom)});}catch{try{cam.setZoom(baseZoom);}catch{}}
   },st.hitStop+Math.round(st.slowDuration*0.72));
  }

  if(st.particles==='blood')this.spawnHeroHitBloodImpact(attacker);

  if(st.knockback>0){
   const push=this.getHeroHitKnockbackVector(attacker,st.knockback);
   this.applyPlayerForcedMotion(push.vx,push.vy,st.knockbackDuration);
  }

  this.playHeroHitSfx(st.pitch);

  // Match the Dev Impact Lab profile: near-freeze for 48 ms, then 0.25× slow motion.
  if(st.hitStop>0){
   this.setHeroHitImpactTimeScale(Math.max(0.1,Math.min(0.12,st.slow*0.18)));
   this.heroHitImpactTimer=window.setTimeout(()=>{
    if(!this.sys?.isActive?.())return;
    this.heroHitImpactTimer=null;
    this.setHeroHitImpactTimeScale(st.slow);
    this.heroHitImpactSlowTimer=window.setTimeout(()=>{
     if(!this.sys?.isActive?.())return;
     this.heroHitImpactSlowTimer=null;
     this.setHeroHitImpactTimeScale(baseScale);
    },st.slowDuration);
   },st.hitStop);
  }else if(st.slow<0.999){
   this.setHeroHitImpactTimeScale(st.slow);
   this.heroHitImpactSlowTimer=window.setTimeout(()=>{
    if(!this.sys?.isActive?.())return;
    this.heroHitImpactSlowTimer=null;
    this.setHeroHitImpactTimeScale(baseScale);
   },st.slowDuration);
  }
 }

 damagePlayer(amount,source='enemy',attacker=null){
  if(this.devFlags?.godMode) return false;
  if(this.gameOver || this.dialogueSystem?.active || amount<=0) return false;
  // Broken Saint is a ranged-area champion. He must never gain a delayed
  // contact/melee hit from generic enemy state, even if such state is stale.
  if(source==='melee:champion' && attacker?.championKind==='brokenSaint') return false;
  const now=this.time.now;
  // A mage bolt that was already in flight must never punish the player while
  // the five-second story anomaly has deliberately frozen the whole combat beat.
  // The projectile loop also freezes the bolt in place; this guard is the hard
  // damage firewall in case a projectile is already overlapping the hero.
  if(source==='mageProjectile' && (this.isStoryAnomalyMomentActive(now) || this.isAshChampionIntroActive())) return false;
  if(now<(this.playerInvulnerableUntil||0)) return false;

  if(
   this.championRelics.has('shieldFragment') &&
   now-this.lastShieldRelicBlockAt>=BALANCE.SHIELD_RELIC_COOLDOWN_MS
  ){
   this.lastShieldRelicBlockAt=now;
   const block=this.add.circle(this.player.x,this.player.y,22,0xe6f1ff,0.18)
    .setStrokeStyle(4,0xe6f1ff,0.95).setDepth(30);
   this.tweens.add({targets:block,scale:1.9,alpha:0,duration:260,onComplete:()=>block.destroy()});
   return false;
  }

  const previousHp=this.player.hp;
  let finalDamage=amount;
  if(this.championRelics.has('ironWill') && this.player.hp<=35){
   finalDamage=Math.max(1,Math.round(finalDamage*0.70));
  }
  const commitmentReduction=this.getBrokenSaintCommitmentDamageReduction(now);
  if(commitmentReduction>0){
   finalDamage=Math.max(1,Math.round(finalDamage*(1-commitmentReduction)));
  }

  // Broken Saint rewards react only to damage that genuinely gets through
  // invulnerability/block checks. The Lift mark window starts after landing;
  // Spin keeps its risk window during the stationary channel.
  this.maybeMarkSaintsNailAttacker(attacker,now);
  this.registerCrackedHaloDamage(now);

  // Only accepted damage reaches this point (not an iframe, god mode or relic block).
  this.captainSystem?.onPlayerDamaged(attacker,source,now);

  if(this.championRelics.has('necromancerSoul')){
   this.killStreakBonus=0;
  }

  if(
   this.championRelics.has('fallenBlessing') &&
   !this.fallenBlessingUsed &&
   this.player.hp-finalDamage<=0
  ){
   this.fallenBlessingUsed=true;
   this.playerInvulnerableUntil=now+BALANCE.PLAYER_IFRAME_MS;
   this.player.hp=30;
   this.updateLowHealthState();
   this.applyPlayerHitFeedback(finalDamage);
   this.applyHeroDamageImpact(attacker);
   this.cameras.main.flash(320,255,230,160,false);
   this.showWaveBanner('FALLEN BLESSING','Death refused — 30 HP restored','#fff0b0');
   return false;
  }

  this.playerInvulnerableUntil=now+BALANCE.PLAYER_IFRAME_MS;
  this.player.hp=Math.max(0,this.player.hp-finalDamage);
  this.maybeDropBrokenSaintHeartForHeroHealth(previousHp,this.player.hp);
  this.updateLowHealthState();
  this.applyPlayerHitFeedback(finalDamage);
  this.applyHeroDamageImpact(attacker);

  if(this.player.hp<=0){
   this.endRun();
   return true;
  }
  return false;
 }

 spawnBrokenSaintReflectSpark(x,y){
  const spark=this.add.sprite(
   x+Phaser.Math.Between(-10,10),
   y+Phaser.Math.Between(-8,8),
   'broken_saint_reflect_spark_00'
  ).setOrigin(0.5).setDisplaySize(38,38).setDepth(24);
  spark.play('broken_saint_reflect_spark');
  spark.once(Phaser.Animations.Events.ANIMATION_COMPLETE,()=>{
   if(spark.active) spark.destroy();
  });
 }

 getSwordDamageAgainst(enemy,baseDamage){
  if(this.devFlags?.oneHitKill && enemy?.maxHp) return Math.max(enemy.hp||0,enemy.maxHp*2);
  let damage=baseDamage;

  if(this.championRelics.has('mercySeal') && enemy.maxHp && enemy.hp/enemy.maxHp<=0.30){
   damage*=1.25;
  }

  if(this.championRelics.has('necromancerSoul')){
   damage*=1+Math.min(25,this.killStreakBonus)*0.01;
  }

  if(
   enemy.type==='champion' &&
   enemy.championKind==='brokenSaint' &&
   this.time.now<(enemy.reflectUntil||0)
  ){
   damage*=0.10;
   this.spawnBrokenSaintReflectSpark(enemy.x,enemy.y-8);
   const reflectedHpBefore=this.player?.hp??0;
   this.damagePlayer(4,'reflection',enemy);
   if((this.player?.hp??0)<reflectedHpBefore){
    this.showCombatNotification('ОТРАЖЕНИЕ УРОНА',{
     x:enemy.x,y:enemy.y-62,color:'#bfe5ff',key:'brokenSaint:reflection',cooldown:260
    });
   }
  }

  if(
   enemy.type==='champion' &&
   enemy.championKind==='shieldWarden' &&
   this.time.now<(enemy.guardUntil||0)
  ){
   damage*=0.20;
   if(this.time.now-(enemy.lastCounterAt||0)>500){
    enemy.lastCounterAt=this.time.now;
    this.damagePlayer(6,'counter');
   }
  }

  return Math.max(1,Math.round(damage));
 }

 playHeroSwordAttackSfx(){ return AudioManager.prototype.playHeroSwordAttackSfx.call(this); }
 playHeroDeathSfx(){ return AudioManager.prototype.playHeroDeathSfx.call(this); }
 playHeroHitSfx(detune=0){ return AudioManager.prototype.playHeroHitSfx.call(this,detune); }
 playSkillSfx(key,volume=0.42){ return AudioManager.prototype.playSkillSfx.call(this,key,volume); }
 startBrokenSaintHolyWarningSfx(){ return AudioManager.prototype.startBrokenSaintHolyWarningSfx.call(this); }
 stopBrokenSaintHolyWarningSfx(){ return AudioManager.prototype.stopBrokenSaintHolyWarningSfx.call(this); }
 playBrokenSaintHolyBeamSfx(){ return AudioManager.prototype.playBrokenSaintHolyBeamSfx.call(this); }
 playHeroSwordImpactSfx(){ return AudioManager.prototype.playHeroSwordImpactSfx.call(this); }
 playSkeletonAttackSfx(time=this.time.now){ return AudioManager.prototype.playSkeletonAttackSfx.call(this,time); }
 playMageCastSfx(time=this.time.now){ return AudioManager.prototype.playMageCastSfx.call(this,time); }

 onSwordAttack(attackCounter){
  if(!this.championRelics.has('holyFragment') || attackCounter%5!==0) return;

  const vectors={
   down:{x:0,y:1,angle:Math.PI/2},
   up:{x:0,y:-1,angle:-Math.PI/2},
   left:{x:-1,y:0,angle:Math.PI},
   right:{x:1,y:0,angle:0}
  };
  const v=vectors[this.playerDir] || vectors.down;
  const length=260;
  const cx=this.player.x+v.x*length/2;
  const cy=this.player.y+v.y*length/2;
  const slash=this.add.rectangle(cx,cy,length,10,0xffefaa,0.62)
   .setRotation(v.angle).setDepth(19);

  this.tweens.add({targets:slash,alpha:0,scaleY:2.2,duration:190,onComplete:()=>slash.destroy()});

  for(const enemy of this.enemies){
   if(!enemy.active) continue;
   const dx=enemy.x-this.player.x;
   const dy=enemy.y-this.player.y;
   const projection=dx*v.x+dy*v.y;
   const lateral=Math.abs(dx*v.y-dy*v.x);
   if(projection>=0 && projection<=length && lateral<=34){
    const killed=this.damageEnemy(enemy,this.getEffectiveMeleeDamage()*0.70,'holyFragment',0xffed9a);
    if(!killed){
     const angle=Phaser.Math.Angle.Between(this.player.x,this.player.y,enemy.x,enemy.y);
     this.applyEnemyHitReaction(enemy,angle,75);
    }
   }
  }
 }

 onSwordHit(enemy){
  if(this.championRelics.has('heavyStrike') && Math.random()<0.20){
   enemy.staggerUntil=Math.max(
    enemy.staggerUntil||0,
    this.time.now+(enemy.type==='champion' ? 180 : 420)
   );

   const shock=this.add.circle(enemy.x,enemy.y,18,0xffffff,0.10)
    .setStrokeStyle(3,0xe8f1ff,0.9).setDepth(23);
   this.tweens.add({
    targets:shock,scale:1.9,alpha:0,duration:190,
    onComplete:()=>shock.destroy()
   });
  }
 }

 createRelicZone(x,y,radius,duration,damage,color,kind){
  const visual=this.add.circle(
   x,y,radius,color,
   kind==='poison' ? 0.18 : 0.11
  ).setStrokeStyle(
   kind==='poison' ? 3 : 2,
   color,
   kind==='poison' ? 0.78 : 0.58
  ).setDepth(9);

  this.relicZones.push({
   x,y,radius,damage,kind,visual,
   expiresAt:this.time.now+duration,
   lastTick:-99999,
   tickEvery:kind==='poison' ? 420 : 500
  });
 }

 updateRelics(time){
  if(this.championRelics.has('soulSkull') && time>=this.nextSoulSkullAt){
   this.nextSoulSkullAt=time+2400;
   let target=null;
   let best=340;
   for(const e of this.enemies){
    if(!e.active || e.hp<=0) continue;
    const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,e.x,e.y);
    if(d<best){ best=d; target=e; }
   }
   if(target && target.hp>0){
    this.damageEnemy(target,this.getEffectiveMeleeDamage()*0.48,'soulSkull',0x69ff87);
    const orb=this.add.circle(this.player.x,this.player.y-24,7,0x69ff87,0.90).setDepth(24);
    this.tweens.add({
     targets:orb,x:target.x,y:target.y-8,duration:220,ease:'Quad.easeIn',
     onComplete:()=>{ if(orb.active) orb.destroy(); }
    });
   }
  }

  if(this.championRelics.has('cursedGround') && time>=this.nextCursedGroundAt){
   this.nextCursedGroundAt=time+30000;
   this.createRelicZone(this.player.x,this.player.y,82,6000,Math.max(4,this.getEffectiveMeleeDamage()*0.18),0x8fd45a,'cursedGround');
  }

  for(const zone of this.relicZones){
   if(!zone.visual || !zone.visual.active) continue;
   if(zone.kind==='cursedGround'){
    zone.x=this.player.x;
    zone.y=this.player.y;
    zone.visual.setPosition(zone.x,zone.y);
   }

   if(time-zone.lastTick>=zone.tickEvery){
    zone.lastTick=time;

    let hitCount=0;
    for(const e of this.enemies){
     if(!e.active || e.hp<=0) continue;

     if(
      Phaser.Math.Distance.Between(e.x,e.y,zone.x,zone.y) <=
      zone.radius+(e.hitRadius||14)*0.35
     ){
      hitCount++;
      this.damageEnemy(
       e,
       zone.damage,
       zone.kind==='poison' ? 'poison' : 'curseAura',
       zone.kind==='poison' ? 0x62ff78 : 0xb4de76
      );
     }
    }

    if(hitCount>0 && zone.visual && zone.visual.active){
     this.tweens.add({
      targets:zone.visual,
      alpha:0.28,
      duration:70,
      yoyo:true
     });
    }
   }

   if(time>=zone.expiresAt){
    zone.visual.destroy();
   }
  }
  this.relicZones=this.relicZones.filter(z=>z.visual && z.visual.active);
 }

 onEnemyKilled(enemy,x,y){
  if(this.championRelics.has('necromancerSoul')){
   this.killStreakBonus=Math.min(25,this.killStreakBonus+1);
  }

  if(this.championRelics.has('greenCurse') && Math.random()<0.22){
   this.createRelicZone(x,y,56,4600,Math.max(3,this.getEffectiveMeleeDamage()*0.16),0x4cff6a,'poison');
  }

  if(this.championRelics.has('rootHeart') && Math.random()<0.22){
   let target=null;
   let best=180;
   for(const e of this.enemies){
    if(!e.active || e.hp<=0 || e===enemy) continue;
    const d=Phaser.Math.Distance.Between(x,y,e.x,e.y);
    if(d<best){ best=d; target=e; }
   }
   if(target && target.hp>0){
    this.damageEnemy(target,this.getEffectiveMeleeDamage()*0.55,'rootHeart',0xb9e27f);
    target.staggerUntil=Math.max(target.staggerUntil||0,this.time.now+220);
    const root=this.add.rectangle(target.x,target.y+8,5,34,0xa8ce6b,0.9).setDepth(17);
    this.tweens.add({targets:root,y:root.y-18,alpha:0,duration:260,onComplete:()=>root.destroy()});
   }
  }
 }

 createBrokenSaintDefeatSmokeFx(x,y,visual=null){
  const fx=[];
  const animKey=this.ensureAshChampionRevealAnimation();
  if(!animKey) return fx;
  const figureW=Math.max(120,visual?.displayWidth||150);
  const figureH=Math.max(130,visual?.displayHeight||155);
  const layers=[
   {frame:0,depth:217.7,w:Math.min(238,figureW*1.48),h:Math.min(246,figureH*1.48),alpha:0.42,delay:0},
   {frame:1,depth:218.35,w:Math.min(196,figureW*1.22),h:Math.min(206,figureH*1.26),alpha:0.30,delay:70},
   {frame:2,depth:219.04,w:Math.min(214,figureW*1.34),h:Math.min(224,figureH*1.36),alpha:0.78,delay:120},
   {frame:3,depth:219.08,w:Math.min(176,figureW*1.08),h:Math.min(190,figureH*1.14),alpha:0.34,delay:190}
  ];
  for(const layer of layers){
   const key=`${ASH_CHAMPION_SMOKE_TEXTURE_PREFIX}${String(layer.frame).padStart(2,'0')}`;
   const sprite=this.add.sprite(x,y-18,key).setOrigin(0.5,0.54).setDepth(layer.depth).setDisplaySize(layer.w,layer.h).setAlpha(0);
   sprite.play(animKey);
   sprite.anims?.setProgress?.(layer.frame/Math.max(1,ASH_CHAMPION_SMOKE_FRAME_COUNT-1));
   fx.push(sprite);
   this.tweens.add({
    targets:sprite,alpha:{from:0,to:layer.alpha},displayWidth:{from:layer.w*0.84,to:layer.w},displayHeight:{from:layer.h*0.84,to:layer.h},
    duration:520,delay:layer.delay,ease:'Sine.easeOut'
   });
  }
  return fx;
 }

 beginBrokenSaintDefeatSequence(enemy){
  if(this.brokenSaintDefeatSequenceActive) return;
  const x=enemy?.x??this.player.x;
  const y=enemy?.y??this.player.y;
  const visual=enemy?.visual?.active?enemy.visual:null;
  const shadow=enemy?.shadowVisual?.active?enemy.shadowVisual:null;
  this.brokenSaintDefeatSequenceActive=true;
  // Defeat smoke is destroyed at 1320 ms; do not let the disappearance sound
  // continue past the visual effect.
  this.playBrokenSaintDisappearSfx(1320);
  this.setHeroFocusInteraction('brokenSaintDefeat',true);
  this.player?.body?.setVelocity?.(0,0);
  this.mobileMoveX=0; this.mobileMoveY=0; this.mobileMovePointerId=null;
  this.playerAttackUntil=this.time.now;
  this.skillLockUntil=Math.max(this.skillLockUntil||0,this.time.now+1800);
  if(this.activeAttackFx?.active){this.activeAttackFx.destroy();this.activeAttackFx=null;}
  for(const projectile of this.projectiles||[]){if(projectile?.active)projectile.destroy();}
  this.projectiles=(this.projectiles||[]).filter(p=>p?.active);
  try{this.physics.pause();}catch{}

  this.brokenSaintDefeatFx=this.createBrokenSaintDefeatSmokeFx(x,y,visual);
  if(visual){
   this.tweens.add({targets:visual,alpha:0,duration:650,delay:160,ease:'Sine.easeIn'});
  }
  if(shadow){
   this.tweens.add({targets:shadow,alpha:0,duration:520,delay:120,ease:'Sine.easeIn'});
  }
  this.cameras.main.shake(240,0.006);

  this.time.delayedCall(860,()=>{
   for(const smoke of this.brokenSaintDefeatFx||[]){
    if(smoke?.active) this.tweens.add({targets:smoke,alpha:0,scaleX:1.06,scaleY:1.06,duration:420,ease:'Sine.easeIn'});
   }
  });
  this.time.delayedCall(1320,()=>{
   if(visual?.active) visual.destroy();
   if(shadow?.active) shadow.destroy();
   for(const smoke of this.brokenSaintDefeatFx||[]){if(smoke?.active)smoke.destroy();}
   this.brokenSaintDefeatFx=[];
   // Hold on the cleared battlefield for two full seconds before the first
   // aftermath frame. Background music has already resumed in onChampionDefeated().
   this.time.delayedCall(2000,()=>{
    if(!this.brokenSaintDefeatSequenceActive)return;
    this.beginBrokenSaintAftermathCinematic();
   });
  });
 }

 beginBrokenSaintAftermathCinematic(){
  const complete=()=>{
   this.brokenSaintDefeatSequenceActive=false;
   this.setHeroFocusInteraction('brokenSaintDefeat',false);
   this.openChampionRewards('brokenSaint');
  };
  const started=this.storyDirector?.playCinematic(BROKEN_SAINT_AFTERMATH_PAGES,{
   eventId:'ash_broken_saint_aftermath_cinematic',
   once:true,
   releaseTextureKeys:BROKEN_SAINT_AFTERMATH_PAGE_KEYS,
   onComplete:complete
  });
  if(!started) complete();
  return Boolean(started);
 }

 beginBrokenSaintSwordEpilogue(){
  if(this.brokenSaintSwordEpilogue)return;
  this.waveIntermission=true;
  this.nextWaveAt=Number.POSITIVE_INFINITY;
  this.brokenSaintSwordEpilogue={phase:'waitingClear'};
 }

 updateBrokenSaintSwordEpilogue(time){
  const state=this.brokenSaintSwordEpilogue;
  if(!state)return false;
  // The sword epilogue belongs exclusively to Ash Fields. A Zone 2 restart or
  // restored region must never replay it; Zone 2 owns its gate/wagon arrival beat.
  if(this.currentWorldZoneIndex>0){
   this.stopAshSwordPulseSfx();
   this.stopSwordOrbitCrowFlock(0);
   this.brokenSaintSwordEpilogue=null;
   return false;
  }
  if(state.phase==='waitingClear'){
   if((this.enemies||[]).some(enemy=>enemy?.active&&enemy.hp>0))return false;
   state.phase='freePlay';state.until=time+3000;return false;
  }
  if(state.phase==='freePlay'&&time>=state.until){
   if(!this.acquireStoryFocus('brokenSaintSwordEpilogue'))return true;
   state.phase='call';state.target=this.player;state.kind='swordEpilogue';
   this.setHeroFocusInteraction('brokenSaintSwordEpilogue',true);
   this.player?.body?.setVelocity?.(0,0);this.mobileMoveX=0;this.mobileMoveY=0;
   this.createSettledStoryVignette(state,this.cameras.main,{fadeMs:300});
   this.playAshSwordPulseSfx();state.until=time+3000;return true;
  }
  if(state.phase==='call'&&time>=state.until){
   this.stopAshSwordPulseSfx();
   if(state.vignette?.active)this.tweens.add({targets:state.vignette,alpha:0,duration:260,onComplete:()=>state.vignette?.destroy()});
   this.setHeroFocusInteraction('brokenSaintSwordEpilogue',false);
   this.releaseStoryFocus('brokenSaintSwordEpilogue',{cooldownMs:0});
   this.ashAltarObjectiveMarker?.setTarget(this.ashSwordLandmark,{worldOffsetY:118});
   state.phase='approach';return false;
  }
 if(state.phase==='approach'){
   this.ashAltarObjectiveMarker?.update(time);
   if(!this.ashSwordLandmark?.active||Phaser.Math.Distance.Between(this.player.x,this.player.y,this.ashSwordLandmark.x,this.ashSwordLandmark.y)>260)return false;
   state.phase='cinematic';this.playAshSwordPulseSfx();
   const complete=()=>{
   this.stopAshSwordPulseSfx();
    // The sword cinematic is the final gate beat: open the passage now, then
    // point the player through it. Keeping the old physical blocker here made
    // the Zone 2 route impossible to enter.
    const gate=WORLD_DESIGN.GATES.find(entry=>entry.champion==='brokenSaint');
    if(gate){
     this.requestWorldAdvance('brokenSaint');
     this.beginWorldTravel();
     this.ashAltarObjectiveMarker?.setTarget({
      x:gate.x+180,
      y:WORLD_DESIGN.ROUTE_Y,
      active:true
     },{worldOffsetY:0});
    }
    state.phase='gateMarker';
   };
   if(!this.storyDirector?.playCinematic(BROKEN_SAINT_SWORD_PAGES,{eventId:'ash_broken_saint_sword_cinematic',once:true,releaseTextureKeys:BROKEN_SAINT_SWORD_CINEMATIC_PAGE_KEYS,onComplete:complete}))complete();
   return true;
  }
  if(state.phase==='gateMarker'){
   this.ashAltarObjectiveMarker?.update(time);
  }
  return false;
 }

 onChampionDefeated(enemy){
  const kind=enemy.championKind;
  if(kind==='brokenSaint'){
   this.stopBrokenSaintHolyWarningSfx();
   this.stopBrokenSaintMusic();
   // The normal world score returns immediately after the boss track ends and
   // remains audible through the death pause and the aftermath cinematic.
   this.setupBackgroundMusic();
  }
  this.activeChampion=null;
  this.championEventActive=false;
  this.championRetryCheckpoint=null;
  this.championNameText.setVisible(false);
  this.championHpBack.setVisible(false);
  this.championHpFill.setVisible(false);
  this.clearChampionHazards();

  // Broken Saint's passage opens only after the sword epilogue cinematic.
  if(kind!=='brokenSaint')this.requestWorldAdvance(kind);

  if(kind==='brokenSaint'){
   // Reverse the reveal language: smoke fades IN over the corpse while the
   // champion fades OUT, then the three-part reward flow takes over.
   this.beginBrokenSaintDefeatSequence(enemy);
   return;
  }

  this.cameras.main.flash(300,230,200,110,false);
  this.openChampionRewards(kind);
 }

 isEnemyVisibleOnScreen(enemy){
  if(!enemy || !enemy.active || enemy.hp<=0) return false;

  const view=this.cameras.main.worldView;
  const radius=enemy.hitRadius||14;

  return (
   enemy.x+radius>=view.left &&
   enemy.x-radius<=view.right &&
   enemy.y+radius>=view.top &&
   enemy.y-radius<=view.bottom
  );
 }

 isEnemyAtNormalSpawnBand(enemy){
  if(!enemy || !enemy.active) return false;

  const view=this.cameras.main.worldView;
  const margin=PURSUIT.NORMAL_SPAWN_BAND;

  // This expanded rectangle corresponds to the same area where normal
  // camera-relative spawns enter the fight.
  return (
   enemy.x>=view.left-margin &&
   enemy.x<=view.right+margin &&
   enemy.y>=view.top-margin &&
   enemy.y<=view.bottom+margin
  );
 }

 updateEmptyScreenRush(){
  // No special acceleration during deliberate calm states.
  if(
   this.gameOver ||
   this.waveIntermission ||
   this.awaitingWorldAdvance ||
   this.levelChoiceOpen ||
   this.championRewardOpen ||
   (this.activeChampion && this.activeChampion.active)
  ){
   this.emptyScreenRushActive=false;
   for(const enemy of this.enemies){
    if(enemy) enemy.emptyScreenRush=false;
   }
   return;
  }

  const livingOrdinary=this.enemies.filter(
   enemy=>
    enemy &&
    enemy.active &&
    enemy.hp>0 &&
    enemy.type!=='champion'
  );

  const visible=livingOrdinary.some(
   enemy=>this.isEnemyVisibleOnScreen(enemy)
  );

  this.emptyScreenRushActive=(
   livingOrdinary.length>0 &&
   !visible
  );

  // Once the screen becomes empty, every currently unseen enemy gets the
  // simple 4x run flag. It keeps that flag until reaching the normal spawn band,
  // even if another enemy reaches the screen first.
  if(this.emptyScreenRushActive){
   for(const enemy of livingOrdinary){
    if(!this.isEnemyAtNormalSpawnBand(enemy)){
     enemy.emptyScreenRush=true;
    }
   }
  }

  // Each enemy independently returns to normal speed at the usual spawn area.
  for(const enemy of livingOrdinary){
   if(
    enemy.emptyScreenRush &&
    this.isEnemyAtNormalSpawnBand(enemy)
   ){
    enemy.emptyScreenRush=false;
   }
  }
 }

 getEnemyMovementSpeed(enemy){
  if(!enemy || enemy.type==='champion' || enemy.type==='captain') return enemy?.speed||0;

  if(enemy.emptyScreenRush){
   return (enemy.speed||0)*PURSUIT.EMPTY_SCREEN_SPEED_MULTIPLIER;
  }

  return enemy.speed||0;
 }

 configureEnemyCollision(enemy,padding=4){
  if(!enemy || !enemy.body) return;
  const radius=(enemy.hitRadius || 14)+padding;
  const sourceWidth=Number(enemy.width)||radius*2;
  const sourceHeight=Number(enemy.height)||radius*2;
  const offsetX=(sourceWidth-radius*2)/2;
  const offsetY=(sourceHeight-radius*2)/2;
  enemy.body.setCircle(radius,offsetX,offsetY);
 }

 shouldEnemyCollideWithAshLandmark(objectA,objectB){
  const enemy=objectA?.type ? objectA : (objectB?.type ? objectB : null);
  const blocker=objectA?.ashLandmarkName ? objectA : (objectB?.ashLandmarkName ? objectB : null);
  if(
   enemy?.type==='champion' &&
   enemy.championKind==='brokenSaint' &&
   enemy.ignoreAshAltarCollision &&
   String(blocker?.ashLandmarkName||'').startsWith('ash_landmark_altar_')
  ) return false;
  return true;
 }

 isAshBlockerIgnoredForEnemy(blocker,enemy){
  return Boolean(
   blocker && enemy?.type==='champion' && enemy.championKind==='brokenSaint' &&
   enemy.ignoreAshAltarCollision && String(blocker.ashLandmarkName||'').startsWith('ash_landmark_altar_')
  );
 }

 applyBrokenSaintCrowdKeepout(enemy){
  const champ=this.activeChampion;
  if(
   !enemy || !enemy.active || !enemy.body ||
   enemy.type==='champion' ||
   !champ || !champ.active || champ.championKind!=='brokenSaint'
  ) return;

  const minDist=champ.crowdKeepoutRadius || 96;
  const dx=enemy.x-champ.x;
  const dy=enemy.y-champ.y;
  const dist=Math.max(0.001,Math.hypot(dx,dy));
  if(dist>=minDist) return;

  const nx=dx/dist;
  const ny=dy/dist;
  const penetration=minDist-dist;
  // Strong radial separation: even x4-rush enemies cannot sit on the champion.
  const push=240+penetration*12;
  enemy.body.velocity.x+=nx*push;
  enemy.body.velocity.y+=ny*push;
 }

 getDirectionFromVector(dx,dy,fallback='down'){
  if(Math.abs(dx)<1 && Math.abs(dy)<1){
   return fallback;
  }

  if(Math.abs(dx)>Math.abs(dy)){
   return dx<0 ? 'left' : 'right';
  }

  return dy<0 ? 'up' : 'down';
 }

 getEightDirectionFromVector(dx,dy,fallback='down'){
  if(Math.abs(dx)<1 && Math.abs(dy)<1) return fallback;
  const angle=Math.atan2(dy,dx);
  const octant=Math.round(angle/(Math.PI/4));
  const dirs=['right','down_right','down','down_left','left','up_left','up','up_right'];
  return dirs[(octant+8)%8];
 }

 getEnemyVisualPrefix(enemyType){
  if(enemyType==='mage') return 'mage';
  if(enemyType==='shield') return 'shield';
  // Unfinished non-Broken-Saint champions intentionally reuse skeleton animation
  // keys until their dedicated art packs are added.
  if(enemyType==='champion') return 'skeleton';
  return 'skeleton';
 }

 getEnemyAttackAction(enemyType){
  return enemyType==='mage' ? 'cast' : 'attack';
 }

 getWaveProfile(wave){
  if(this.currentWorldZoneIndex===1){
   // Road of the Black Banners deliberately has its own cadence. These are
   // encounter identities, not copies of the Ash Fields wave script.
   const ruinedKingdomProfiles={
    1:{name:'THE CAPTAIN',subtitle:'Break their formation · defeat their commander',spawnInterval:CAPTAIN.spawnInterval,mageEvery:99,shieldEvery:99,targetBonus:-1,captainEncounter:true},
    2:{name:'FOG CALLERS',subtitle:'Break the casters before they box you in',spawnInterval:980,mageEvery:3,shieldEvery:99,targetBonus:0},
    3:{name:'BANNER WALL',subtitle:'Shield-bearers hold the road',spawnInterval:1060,mageEvery:5,shieldEvery:3,targetBonus:1},
    4:{name:'THE LOST CAMP',subtitle:'A mixed assault closes from the ruins',spawnInterval:900,mageEvery:4,shieldEvery:4,targetBonus:2},
    5:{name:'CHAPEL APPROACH',subtitle:'Something guards the way forward',spawnInterval:940,mageEvery:4,shieldEvery:5,targetBonus:2}
   };
   return ruinedKingdomProfiles[wave] || ruinedKingdomProfiles[5];
  }
  const baseInterval=Math.max(760,1050-(wave-1)*18);

  if(wave>1 && wave%5===0){
   return {name:'SURGE',subtitle:'Dense assault',spawnInterval:Math.max(690,baseInterval-110),mageEvery:4,shieldEvery:5,targetBonus:2};
  }
  if(wave>=4 && wave%4===0){
   return {name:'BULWARK',subtitle:'More armored enemies',spawnInterval:baseInterval+50,mageEvery:6,shieldEvery:4,targetBonus:0};
  }
  if(wave>=3 && wave%3===0){
   return {name:'ARCANE PRESSURE',subtitle:'More ranged threats',spawnInterval:baseInterval,mageEvery:4,shieldEvery:7,targetBonus:0};
  }
  return {name:wave===1?'THE OUTSKIRTS':'MIXED ASSAULT',subtitle:wave===1?'The dead are approaching':'Balanced enemy pressure',spawnInterval:baseInterval,mageEvery:5,shieldEvery:6,targetBonus:0};
 }

 getGlobalWave(){return globalWave(this.currentWorldZoneIndex||0,this.wave||1);}

 captureZoneEntryCheckpoint(){
  const zoneIndex=this.currentWorldZoneIndex;
  if(zoneIndex===0){this.zoneEntryCheckpoint=null;return;}
  if(this.zoneEntryCheckpoint?.zoneIndex===zoneIndex && this.zoneEntryCheckpoint.hero)return;
  this.zoneEntryCheckpoint={zoneIndex,hero:captureZoneBuild(this)};
 }

 restartCurrentZone(){
  if(!this.gameOver || !this.gameOverUiReady)return false;
  const zoneIndex=this.currentWorldZoneIndex||0;
  const checkpoint=this.zoneEntryCheckpoint?.zoneIndex===zoneIndex?
   this.zoneEntryCheckpoint:{zoneIndex,hero:zoneIndex>0?captureZoneBuild(this):null};
  this.scene.restart({zoneRestart:checkpoint,saveSlot:this.currentSaveSlot});
  return true;
 }

 getCaptainZoneBounds(){
  const zone=WORLD_DESIGN.ZONES[this.currentWorldZoneIndex];
  return {start:zone.start,end:zone.end,height:STAGE0.WORLD_HEIGHT};
 }

 startZoneWaveSequence(zoneIndex=this.currentWorldZoneIndex,{delay=0,suppressBanner=false}={}){
  this.captainSystem?.clear();
  this.currentWorldZoneIndex=zoneIndex;
  this.captureZoneEntryCheckpoint();
  this.wave=0;
  this.spawned=0;
  this.waveTarget=0;
  this.waveProfile=null;
  this.waveIntermission=true;
  this.postWaveChampionKind=null;
  this.championEventActive=false;
  this.lastSpawn=this.time.now;
  this.storyWaveGateWasActive=false;
  this.ashSwordPreludeQueuedAt=0;
  this.nextWaveAt=this.time.now+Math.max(0,delay);
  if(delay<=0) this.startWave(1,false,{suppressBanner});
 }


 getAshStoryLandmarkTarget(key=ASH_ALTAR_CHAMPION_STORY.landmarkKey){
  const actual=(this.devEnvironmentObjects||[]).find(object=>
   object?.active && !object.devDeleted && object.devEnvMeta?.key===key
  );
  if(actual)return actual;

  let fallback=null;
  for(const segment of ASH_FIELDS_SEGMENTS||[]){
   const landmark=(segment?.landmarks||[]).find(item=>item?.key===key);
   if(landmark){fallback=landmark;break;}
  }
  if(!fallback)return null;

  if(!this.ashAltarStoryTarget || this.ashAltarStoryTarget.key!==key){
   this.ashAltarStoryTarget={
    key,
    x:Number(fallback.x)||0,
    y:Number(fallback.y)||0,
    active:true,
    visible:true
   };
  }else{
   this.ashAltarStoryTarget.x=Number(fallback.x)||this.ashAltarStoryTarget.x;
   this.ashAltarStoryTarget.y=Number(fallback.y)||this.ashAltarStoryTarget.y;
   this.ashAltarStoryTarget.active=true;
   this.ashAltarStoryTarget.visible=true;
  }
  return this.ashAltarStoryTarget;
 }

 getAshStoryMarkerTarget(key=ASH_ALTAR_CHAMPION_STORY.landmarkKey){
  // Objective navigation is intentionally independent from environment
  // streaming/culling. The altar sprite can be absent or invisible; the story
  // world anchor exists from boot and remains valid until the objective ends.
  const point=ASH_ALTAR_CHAMPION_STORY.markerPoint;
  const x=Number(point?.x),y=Number(point?.y);
  if(!Number.isFinite(x) || !Number.isFinite(y))return null;
  if(!this.ashAltarMarkerTarget || this.ashAltarMarkerTarget.key!==key){
   this.ashAltarMarkerTarget={key,x,y,active:true};
  }else{
   this.ashAltarMarkerTarget.x=x;
   this.ashAltarMarkerTarget.y=y;
   this.ashAltarMarkerTarget.active=true;
  }
  return this.ashAltarMarkerTarget;
 }

 isAshAltarStoryGateActive(){
  return this.currentWorldZoneIndex===0 && Boolean(
   this.wave===4 &&
   this.storyDirector?.getFlag?.(ASH_ALTAR_CHAMPION_STORY.waveClearedFlag,false) &&
   !this.storyDirector?.getFlag?.(ASH_ALTAR_CHAMPION_STORY.fightStartedFlag,false)
  );
 }

 activateAshAltarChampionObjective(){
  if(!this.storyDirector || this.storyDirector.getFlag?.(ASH_ALTAR_CHAMPION_STORY.fightStartedFlag,false))return false;
  const target=this.getAshStoryLandmarkTarget();
  const markerTarget=this.getAshStoryMarkerTarget();
  if(!target || !markerTarget)return false;
  if(!this.storyDirector.isObjectiveActive?.(ASH_ALTAR_CHAMPION_STORY.objectiveId)){
   this.storyDirector.activateObjective?.({
    id:ASH_ALTAR_CHAMPION_STORY.objectiveId,
    kind:'reach',
    targetId:ASH_ALTAR_CHAMPION_STORY.targetId,
    label:ASH_ALTAR_CHAMPION_STORY.label,
    markerPoint:ASH_ALTAR_CHAMPION_STORY.markerPoint
   });
  }
  this.ashAltarObjectiveMarker?.setTarget(markerTarget,{worldOffsetY:118});
  return true;
 }

 isAshChampionIntroActive(){
  return Boolean(this.ashChampionIntroState?.champion?.active && !this.ashChampionIntroState.released);
 }

 ensureAshChampionRevealAnimation(){
  if(this.anims?.exists?.(ASH_CHAMPION_SMOKE_ANIM_KEY)) return ASH_CHAMPION_SMOKE_ANIM_KEY;
  const frames=[];
  for(let frame=0;frame<ASH_CHAMPION_SMOKE_FRAME_COUNT;frame++){
   const key=`${ASH_CHAMPION_SMOKE_TEXTURE_PREFIX}${String(frame).padStart(2,'0')}`;
   if(this.textures?.exists?.(key)) frames.push({key});
  }
  if(!frames.length) return null;
  this.anims.create({key:ASH_CHAMPION_SMOKE_ANIM_KEY,frames,frameRate:10,repeat:-1});
  return ASH_CHAMPION_SMOKE_ANIM_KEY;
 }

 createAshChampionRevealFx(champion,anchor=null){
  if(!champion?.active)return [];
  const fx=[];
  const animKey=this.ensureAshChampionRevealAnimation();
  const baseX=anchor?.x??champion.x;
  const baseY=(anchor?.y??champion.y)-18;

  if(animKey){
   const figureW=Math.max(120,champion.visual?.displayWidth||150);
   const figureH=Math.max(130,champion.visual?.displayHeight||155);
   const makeSmokeLayer=({frame=0,depth=218,width=210,height=210,alpha=0.7,delay=0,duration=680,offsetX=0,offsetY=0,progress=0}={})=>{
    const key=`${ASH_CHAMPION_SMOKE_TEXTURE_PREFIX}${String(frame).padStart(2,'0')}`;
    const sprite=this.add.sprite(baseX+offsetX,baseY+offsetY,key)
     .setOrigin(0.5,0.54)
     .setDepth(depth)
     .setDisplaySize(width,height)
     .setAlpha(0);
    sprite.play(animKey);
    sprite.anims?.setProgress?.(progress);
    sprite.storySmokeTargetWidth=width;
    sprite.storySmokeTargetHeight=height;
    fx.push(sprite);
    this.tweens.add({
     targets:sprite,
     alpha:{from:0,to:alpha},
     displayWidth:{from:width*0.88,to:width},
     displayHeight:{from:height*0.88,to:height},
     duration,
     delay,
     ease:'Sine.easeOut'
    });
    return sprite;
   };

   // The smoke is intentionally figure-sized: it hides Broken Saint instead of
   // becoming a full-screen weather effect. The strongest layer is in front.
   const outerW=Math.min(238,figureW*1.48);
   const outerH=Math.min(246,figureH*1.48);
   const frontW=Math.min(214,figureW*1.34);
   const frontH=Math.min(224,figureH*1.36);
   makeSmokeLayer({frame:0,depth:217.7,width:outerW,height:outerH,alpha:0.40,duration:720,offsetY:-2,progress:0.00});
   makeSmokeLayer({frame:1,depth:218.35,width:frontW*0.92,height:frontH*0.94,alpha:0.28,delay:100,duration:760,offsetX:-2,offsetY:-8,progress:0.24});
   makeSmokeLayer({frame:2,depth:219.04,width:frontW,height:frontH,alpha:0.72,delay:170,duration:700,offsetY:-6,progress:0.44});
   makeSmokeLayer({frame:3,depth:219.08,width:frontW*0.82,height:frontH*0.86,alpha:0.32,delay:300,duration:660,offsetX:4,offsetY:-15,progress:0.68});
  }

  const ground=this.add.ellipse(baseX,baseY+46,118,36,0x171210,0)
   .setDepth(217.2);
  fx.push(ground);
  this.tweens.add({
   targets:ground,
   alpha:{from:0,to:0.28},
   scaleX:{from:0.72,to:1.16},
   scaleY:{from:0.72,to:1.10},
   duration:600,
   ease:'Sine.easeOut',
   yoyo:true,
   hold:320,
   onComplete:()=>{if(ground.active)ground.destroy();}
  });

 return fx;
}

 beginAshChampionMaterialization(state){
  if(!state || state.materializationStarted || !state.champion?.active)return false;
  state.materializationStarted=true;
  const champion=state.champion;
  const anchor=champion.storyRevealAnchor||{x:champion.x,y:champion.y};
  state.ashFx=this.createAshChampionRevealFx(champion,anchor);
  const smokeSoundMs=Math.max(0,(state.smokeFadeAt+ASH_CHAMPION_SMOKE_FADE_MS)-this.time.now);
  this.playBrokenSaintMaterializeSfx(smokeSoundMs);
  if(champion.visual?.active){
   this.tweens.add({
    targets:champion.visual,
    alpha:0.96,
    duration:ASH_CHAMPION_MATERIALIZE_MS+180,
    delay:ASH_CHAMPION_MATERIALIZE_DELAY_MS+180,
    ease:'Sine.easeInOut'
   });
  }
  if(champion.shadowVisual?.active){
   this.tweens.add({
    targets:champion.shadowVisual,
    alpha:ASH_READABILITY.CHAMPION_SHADOW_ALPHA,
    duration:ASH_CHAMPION_MATERIALIZE_MS+160,
    delay:ASH_CHAMPION_MATERIALIZE_DELAY_MS+260,
    ease:'Sine.easeInOut'
   });
  }
  return true;
 }

 beginAshChampionReveal(){
  if(this.ashChampionIntroState || this.storyDirector?.getFlag?.(ASH_ALTAR_CHAMPION_STORY.fightStartedFlag,false))return false;
  if(this.activeChampion?.active)return false;
  if(!this.acquireStoryFocus('ashChampionReveal'))return false;
  const altar=this.getAshStoryLandmarkTarget();
  if(!altar){
   this.releaseStoryFocus('ashChampionReveal',{cooldownMs:0});
   return false;
  }

  const preferred={
   x:Number(altar.x)||0,
   y:this.clampWorldY((Number(altar.y)||0)+Math.min(14,Math.max(-10,(altar.displayHeight||0)*0.04)),80)
  };
  const champion=this.spawnChampion(ASH_ALTAR_CHAMPION_STORY.championKind,false,{
   position:preferred,
   exactStorySpawn:true,
   minPlayerDistance:0,
   maxRadius:0,
   dormant:true,
   deferMusic:true,
   deferUi:true,
   suppressBanner:true,
   suppressFlash:true,
   initialAlpha:0
  });
  if(!champion){
   this.releaseStoryFocus('ashChampionReveal',{cooldownMs:0});
   return false;
  }
  champion.storyRevealAnchor={x:preferred.x,y:preferred.y};
  if(champion.body){
   champion.body.stop?.();
   champion.body.enable=false;
  }

  const now=this.time.now;
  // The camera gets to rest first. Only after the vignette has finished fading
  // in does the smoke begin and Broken Saint materialize inside that frame.
  const cameraSettledAt=now+ASH_CHAMPION_CAMERA_SETTLE_MS;
  const materializeAt=cameraSettledAt+ASH_CHAMPION_VIGNETTE_FADE_MS;
  const materializeCompleteAt=materializeAt+ASH_CHAMPION_MATERIALIZE_DELAY_MS+180+ASH_CHAMPION_MATERIALIZE_MS+180;
  const dialogueAt=materializeCompleteAt+ASH_CHAMPION_POST_REVEAL_HOLD_MS;
  this.storyDirector?.setFlag?.(ASH_ALTAR_CHAMPION_STORY.encounterStartedFlag,true);
  this.storyDirector?.completeObjective?.(ASH_ALTAR_CHAMPION_STORY.objectiveId);
  this.ashAltarObjectiveMarker?.clearTarget();
  this.ashAltarObjectiveMarker?.hide();

  // Keep the background track through reveal and dialogue. The battle track
  // replaces it only in releaseAshChampionFight(), after the final line.
  this.setHeroFocusInteraction('ashChampionReveal',true);
  this.skillLockUntil=Math.max(this.skillLockUntil||0,dialogueAt+120);
  this.playerAttackUntil=now;
  this.player?.body?.setVelocity?.(0,0);
  this.mobileMoveX=0;
  this.mobileMoveY=0;
  this.mobileMovePointerId=null;
  if(this.activeAttackFx?.active){
   try{this.activeAttackFx.destroy();}catch{}
   this.activeAttackFx=null;
  }
  if(this.meleeAttack)this.meleeAttack.lastAttack=now;

  // A previous wave can technically leave a bolt alive after its caster dies.
  // The reveal is non-combat, so clear those leftovers instead of letting them
  // punish a hero whose controls are intentionally frozen.
  for(const projectile of this.projectiles||[]){
   if(projectile?.active)projectile.destroy();
  }
  this.projectiles=(this.projectiles||[]).filter(projectile=>projectile?.active);

  const cam=this.cameras.main;
  const restoreZoom=cam.zoom;
  const focusZoom=Math.min(restoreZoom*1.10,restoreZoom+0.16);
  const focusX=this.player.x*0.38+champion.x*0.62;
  const focusY=this.player.y*0.38+champion.y*0.62-18;

  const state={
   champion,altar,
   target:champion,
   vignette:null,
   ashFx:[],
   startAt:now,
   cameraSettledAt,
   materializeAt,
   materializeCompleteAt,
   dialogueAt,
   smokeFadeAt:materializeCompleteAt-220,
   smokeFading:false,
   vignetteFadeAt:dialogueAt-ASH_CHAMPION_VIGNETTE_FADE_MS,
   vignetteFading:false,
   restoreZoom,
   focusZoom,
   focusX,focusY,
   cameraLocked:false,
   materializationStarted:false,
   released:false,
   dialogueStarted:false,
   dialogueComplete:false,
   vignetteKeyX:null,vignetteKeyY:null,vignetteKeyW:null,vignetteKeyH:null
  };
  this.ashChampionIntroState=state;

  champion.visual?.setAlpha?.(0);
  champion.shadowVisual?.setAlpha?.(0);

  cam.stopFollow();
  cam.pan(state.focusX,state.focusY,430,'Sine.easeOut',true);
  cam.zoomTo(focusZoom,430,'Sine.easeOut',true);
  return true;
 }

 beginBrokenSaintIntroDialogue(){
  const state=this.ashChampionIntroState;
  if(!state || state.dialogueStarted || state.released || this.gameOver)return false;
  const champion=state.champion;
  if(!champion?.active || champion.hp<=0 || this.gameplayPaused || this.storyDirector?.isBusy?.())return false;

  // Transfer the reveal's camera lock to the shared dialogue owner. Do not let
  // the reveal updater recenter the camera while the player advances the lines.
  const releasedFocus=this.releaseStoryFocus('ashChampionReveal',{cooldownMs:0});
  const started=this.championDialogueSystem?.begin(BROKEN_SAINT_INTRO_DIALOGUE,{
   target:champion,speakerName:'Broken Saint',initiator:'npc',
   eventId:'ash_broken_saint_intro_dialogue',once:true,
   onComplete:()=>{
    if(this.ashChampionIntroState!==state || this.gameOver || !champion.active || champion.hp<=0)return;
    state.dialogueComplete=true;
    this.releaseAshChampionFight();
   },
   onCancel:()=>{
    if(this.ashChampionIntroState!==state)return;
    state.dialogueStarted=false;
    state.cameraLocked=false;
   }
  });
  if(!started){
   if(releasedFocus)this.acquireStoryFocus('ashChampionReveal');
   return false;
  }

  state.dialogueStarted=true;
  // The common dialogue returns all the way to gameplay zoom, not to the
  // reveal's intermediate close-up. It also owns the only remaining vignette.
  if(this.dialogueSystem?.cameraRestore)this.dialogueSystem.cameraRestore.zoom=state.restoreZoom;
  if(state.vignette?.active){
   this.tweens.killTweensOf?.(state.vignette);
   state.vignette.destroy();
  }
  state.vignette=null;
  for(const object of state.ashFx||[]){
   if(!object?.active)continue;
   this.tweens.killTweensOf?.(object);
   object.destroy();
  }
  state.ashFx=[];
  return true;
 }

 releaseAshChampionFight(){
  const state=this.ashChampionIntroState;
  if(!state || state.released || !state.dialogueComplete)return false;
  state.released=true;
  const champion=state.champion;
  const now=this.time.now;

  if(state.vignette?.active){
   this.tweens.killTweensOf?.(state.vignette);
   this.tweens.add({
    targets:state.vignette,
    alpha:0,
    duration:180,
    ease:'Sine.easeIn',
    onComplete:()=>{if(state.vignette?.active)state.vignette.destroy();}
   });
  }
  for(const object of state.ashFx||[]){
   if(object?.active)this.tweens.add({targets:object,alpha:0,duration:160,onComplete:()=>{if(object.active)object.destroy();}});
  }

  if(champion?.active){
   champion.storyDormant=false;
   if(champion.body){
    champion.body.enable=true;
    champion.body.reset?.(champion.x,champion.y);
   }
   champion.visual?.setAlpha?.(1);
   if(champion.shadowVisual?.active)champion.shadowVisual.setAlpha(ASH_READABILITY.CHAMPION_SHADOW_ALPHA);
   champion.lastAttack=now;
   champion.lastShot=now;
   champion.nextSkillAt=now+1450;
   champion.nextSecondaryAt=now+3600;
   champion.pendingMeleeHitAt=0;
   champion.pendingMeleeDamage=0;
   champion.body?.setVelocity?.(0,0);
  }

  this.storyDirector?.setFlag?.(ASH_ALTAR_CHAMPION_STORY.fightStartedFlag,true);
  this.setHeroFocusInteraction('ashChampionReveal',false);
  this.ashChampionIntroState=null;

  // Wave 5 begins WITH the already-visible Broken Saint. This suppresses the old
  // post-wave champion spawn and starts ordinary pressure on the same combat beat.
  this.startWave(5,false,{preSpawnedChampion:true,suppressBanner:true});
  this.lastSpawn=this.time.now-this.waveSpawnInterval;
  this.createChampionRetryCheckpoint?.(champion);

  if(champion?.active){
   const def=this.getChampionDefinition(champion.championKind);
   this.championNameText.setText(def?.name||champion.championName).setVisible(true);
   this.championHpBack.setVisible(true);
   this.championHpFill.setVisible(true);
   this.updateChampionBar();
   this.startBrokenSaintMusic();
   this.showWaveBanner(def?.name||'BROKEN SAINT','CHAMPION ENGAGED',def?.rewardColor||'#ffe59a');
  }

  // WorldDialogueSystem has already restored the camera and released its lock
  // before invoking onComplete. Combat/music may now start without another pan.
  return true;
 }

 updateAshAltarChampionStory(time=0){
  if(!this.isAshAltarStoryGateActive()){
   if(!this.ashChampionIntroState)this.ashAltarObjectiveMarker?.hide();
   return false;
  }

  const state=this.ashChampionIntroState;
  if(!state){
   this.activateAshAltarChampionObjective();
   const target=this.getAshStoryLandmarkTarget();
   const markerTarget=this.getAshStoryMarkerTarget();
   if(markerTarget && this.ashAltarObjectiveMarker?.target!==markerTarget){
    this.ashAltarObjectiveMarker?.setTarget(markerTarget,{worldOffsetY:118});
   }
   this.ashAltarObjectiveMarker?.update(time);
   if(
    target && this.player?.active &&
    Phaser.Math.Distance.Between(this.player.x,this.player.y,target.x,target.y)<=ASH_ALTAR_CHAMPION_STORY.approachRadius
   ){
    return this.beginAshChampionReveal();
   }
   return true;
  }

  const champion=state.champion;
  if(!champion?.active || champion.hp<=0 || this.gameOver){
   this.setHeroFocusInteraction('ashChampionReveal',false);
   if(this.dialogueSystem?.active?.target===champion)this.dialogueSystem.cancel();
   for(const object of state.ashFx||[])object?.destroy?.();
   this.releaseStoryFocus('ashChampionReveal');
   if(state.vignette?.active)state.vignette.destroy();
   this.ashChampionIntroState=null;
   if(!this.gameOver)this.setupBackgroundMusic();
   return false;
  }

  // The common dialogue owns camera/UI until its last line is acknowledged.
  if(state.dialogueStarted)return true;

  champion.storyDormant=true;
  champion.body?.setVelocity?.(0,0);
  this.player?.body?.setVelocity?.(0,0);

  if(time>=state.cameraSettledAt){
   const cam=this.cameras.main;
   if(!state.cameraLocked){
    // Never build a vignette against a moving camera. Snap to the exact final
    // cinematic composition first, then create the mask from that stable view.
    cam.setZoom(state.focusZoom);
    cam.centerOn(state.focusX,state.focusY);
    state.cameraLocked=true;
    this.createSettledStoryVignette(state,cam,{fadeMs:300});
   }else{
    cam.centerOn(state.focusX,state.focusY);
   }
   // The camera worldView is refreshed at render time. Keep the Broken Saint
   // mask aligned after the final pan/zoom and on viewport changes, just as
   // the dialogue mask is; an existing texture alone is not a visible overlay.
   this.updateStoryAnomalyVignette(state,cam);
  }

  if(!state.materializationStarted && time>=state.materializeAt){
   this.beginAshChampionMaterialization(state);
  }

  if(!state.smokeFading && time>=state.smokeFadeAt){
   state.smokeFading=true;
   for(const object of state.ashFx||[]){
    if(!object?.active)continue;
    this.tweens.killTweensOf?.(object);
    this.tweens.add({targets:object,alpha:0,duration:ASH_CHAMPION_SMOKE_FADE_MS,ease:'Sine.easeInOut'});
   }
  }

  if(!state.vignetteFading && time>=state.vignetteFadeAt){
   state.vignetteFading=true;
   if(state.vignette?.active){
    this.tweens.add({targets:state.vignette,alpha:0,duration:ASH_CHAMPION_VIGNETTE_FADE_MS,ease:'Sine.easeIn'});
   }
  }
  if(time>=state.dialogueAt)this.beginBrokenSaintIntroDialogue();
  return true;
 }


 createSettledStoryVignette(state,cam=this.cameras?.main,{fadeMs=280}={}){
  if(!state || state.vignette?.active || !cam?.worldView)return state?.vignette||null;
  const target=state.enemy||state.target;
  if(!target?.active)return null;
  const textureKey=this.ensureStoryAnomalyVignetteTexture();
  if(!textureKey)return null;
  const view=cam.worldView;
  const vignette=this.add.image(view.left,view.top,textureKey)
   .setOrigin(0)
   .setDepth(219)
   .setDisplaySize(view.width,view.height)
   .setAlpha(0);
  state.vignette=vignette;
  const vignetteKind=state.kind||(state.enemy?'anomaly':'champion');
  this.devTools?.recordTraceEvent?.('story_vignette_created',{kind:vignetteKind,cameraZoom:cam.zoom,centerX:Math.round(cam.worldView.centerX),centerY:Math.round(cam.worldView.centerY),cameraLocked:Boolean(state.cameraLocked)},{sample:true});
  state.vignetteKeyX=null;
  state.vignetteKeyY=null;
  state.vignetteKeyW=null;
  state.vignetteKeyH=null;
  this.updateStoryAnomalyVignette(state,cam);
  // Dialogue clients animate alpha in their unpaused update loop. A zero
  // duration must be immediate, without relying on a paused TweenManager.
  if(fadeMs>0)this.tweens.add({targets:vignette,alpha:1,duration:fadeMs,ease:'Sine.easeOut'});
  else vignette.setAlpha(1);
  return vignette;
 }

 ensureStoryAnomalyVignetteTexture(){
  if(this.textures?.exists?.(STORY_ANOMALY_VIGNETTE_TEXTURE)) return STORY_ANOMALY_VIGNETTE_TEXTURE;
  // A deliberately modest canvas is enough because the texture is scaled over
  // the camera view. It is only redrawn while the camera is settling, then it
  // remains static for the rest of the five-second beat.
  const width=192;
  const height=108;
  const texture=this.textures?.createCanvas?.(STORY_ANOMALY_VIGNETTE_TEXTURE,width,height);
  if(!texture?.context) return null;
  texture.context.clearRect(0,0,width,height);
  texture.refresh?.();
  return STORY_ANOMALY_VIGNETTE_TEXTURE;
 }

 updateStoryAnomalyVignette(state,cam=this.cameras?.main){
  const vignette=state?.vignette;
  const enemy=state?.enemy||state?.target;
  const texture=this.textures?.get?.(STORY_ANOMALY_VIGNETTE_TEXTURE)?.getSourceImage?.();
  const canvas=texture?.getContext ? texture : null;
  if(!vignette?.active || !enemy?.active || !cam?.worldView || !canvas) return;

  const view=cam.worldView;
  const width=canvas.width||192;
  const height=canvas.height||108;
  const nx=Phaser.Math.Clamp((enemy.x-view.left)/Math.max(1,view.width),0.02,0.98);
  const ny=Phaser.Math.Clamp((enemy.y-view.top)/Math.max(1,view.height),0.02,0.98);

  // Keep the texture aligned exactly with the visible camera world. Since the
  // HUD lives in its own scene, this darkens only the world and never the HUD.
  vignette
   .setPosition(view.left,view.top)
   .setDisplaySize(view.width,view.height);

  // During the settled portion neither the hero nor the skeleton moves, so do
  // not waste mobile CPU rebuilding an identical texture every frame.
  const keyX=Math.round(nx*1000);
  const keyY=Math.round(ny*1000);
  const keyW=Math.round(view.width);
  const keyH=Math.round(view.height);
  if(state.vignetteKeyX===keyX && state.vignetteKeyY===keyY && state.vignetteKeyW===keyW && state.vignetteKeyH===keyH) return;
  const traceVignetteAt=this.devTools?.isPerformanceTraceActive?.()?performance.now():0;
  state.vignetteKeyX=keyX;
  state.vignetteKeyY=keyY;
  state.vignetteKeyW=keyW;
  state.vignetteKeyH=keyH;

  const ctx=canvas.getContext('2d');
  const image=ctx.createImageData(width,height);
  const data=image.data;
  const cx=nx*(width-1);
  const cy=ny*(height-1);
  // Keep the anomalous skeleton itself at normal world brightness, but let the
  // vignette bite in a little closer than before so the eye is pulled toward it.
  // There is still no ring or spotlight edge: the fade remains continuous.
  const clearCore=0.075;
  const maxEdgeAlpha=0.52;
  const vignetteFocusCurve=0.82;
  const invFade=1/Math.max(0.001,1-clearCore);

  let offset=0;
  for(let y=0;y<height;y++){
   const dy=y-cy;
   const ry=dy<0 ? Math.max(1,cy) : Math.max(1,(height-1)-cy);
   const uy=Math.abs(dy)/ry;
   for(let x=0;x<width;x++){
    const dx=x-cx;
    const rx=dx<0 ? Math.max(1,cx) : Math.max(1,(width-1)-cx);
    const ux=Math.abs(dx)/rx;

    // Side-normalized Euclidean distance: every edge reaches full vignette
    // strength, while contours stay soft/rounded instead of looking boxy.
    const distance=Math.min(1,Math.hypot(ux,uy));
    let t=Phaser.Math.Clamp((distance-clearCore)*invFade,0,1);
    // Smoothstep removes any visible circular boundary around the clear center.
    // A sub-linear focus curve makes the darkening become noticeable closer to
    // the skeleton without changing the maximum edge darkness.
    t=t*t*(3-2*t);
    t=Math.pow(t,vignetteFocusCurve);
    const alpha=Math.round(255*maxEdgeAlpha*t);

    data[offset++]=0;
    data[offset++]=0;
    data[offset++]=0;
    data[offset++]=alpha;
   }
  }
  ctx.putImageData(image,0,0);
  this.textures?.get?.(STORY_ANOMALY_VIGNETTE_TEXTURE)?.refresh?.();
  if(traceVignetteAt)this.devTools?.recordSubsystemTime?.('vignette',performance.now()-traceVignetteAt);
 }

 createStoryAnomalyOutline(enemy){
  const source=enemy?.visual;
  if(!source?.active || !source.texture?.key) return null;

  // Renderer-independent silhouette outline: a slightly enlarged, flat-tinted
  // copy sits directly behind the real sprite. The original sprite covers the
  // middle, leaving only a thin contour that follows the current animation frame.
  const outline=this.add.sprite(
   source.x,source.y,source.texture.key,source.frame?.name
  )
   .setOrigin(source.originX,source.originY)
   .setDepth((source.depth||15)-0.05)
   .setAlpha(0);

  if(typeof outline.setTintFill==='function') outline.setTintFill(0xf4d47a);
  else outline.setTint(0xf4d47a);

  outline.storyOutlineGrow=1.085;
  this.syncStoryAnomalyOutline({enemy,outline});
  return outline;
 }

 syncStoryAnomalyOutline(state){
  const source=state?.enemy?.visual;
  const outline=state?.outline;
  if(!source?.active || !outline?.active) return;

  const frameName=source.frame?.name;
  if(source.texture?.key && (outline.texture?.key!==source.texture.key || outline.frame?.name!==frameName)){
   outline.setTexture(source.texture.key,frameName);
  }

  const grow=outline.storyOutlineGrow||1.085;
  outline
   .setPosition(source.x,source.y)
   .setOrigin(source.originX,source.originY)
   .setScale(source.scaleX*grow,source.scaleY*grow)
   .setRotation(source.rotation||0)
   .setFlip(Boolean(source.flipX),Boolean(source.flipY))
   .setDepth((source.depth||15)-0.05)
   .setVisible(source.visible!==false);
 }

 getStoryAnomalyCue(enemy){
  return enemy?.storyAnomaly?.definition||null;
 }

 getStoryAnomalyEnemyLine(enemy){
  const cue=this.getStoryAnomalyCue(enemy);
  return cue?.dialogue?.find(line=>line.speaker!=='hero')?.text||cue?.mobLine||'...';
 }

 getStoryAnomalyHeroLine(enemy){
  const cue=this.getStoryAnomalyCue(enemy);
  return cue?.dialogue?.find(line=>line.speaker==='hero')?.text||cue?.heroLine||'';
 }

 highlightStoryAnomaly(enemy,{cue=null}={}){
  if(!enemy?.active || enemy.hp<=0 || this.storyAnomalyCueState || this.gameOver)return false;
  const anomalyCue=cue||this.getStoryAnomalyCue(enemy);
  const lines=anomalyCue?.dialogue||[
   {speaker:'npc',text:this.getStoryAnomalyEnemyLine(enemy)},
   {speaker:'hero',text:this.getStoryAnomalyHeroLine(enemy)}
  ];
  const dialogue=this.dialogueSystem;
  const started=dialogue?.begin({
   target:enemy,owner:'storyAnomaly',kind:'anomaly',initiator:'npc',
   speakerName:anomalyCue?.speakerName||'Скелет',lines,
   eventId:anomalyCue?.id||null,once:anomalyCue?.once!==false,
   onComplete:()=>{
    this.finishStoryAnomalyHighlight();
    this.storyEnemyAnomalies?.finishDialogue(enemy);
   },
   onCancel:()=>{
    this.finishStoryAnomalyHighlight();
    this.storyEnemyAnomalies?.cancelDialogue(enemy);
   }
  });
  if(!started)return false;
  const outline=this.createStoryAnomalyOutline(enemy);
  outline?.setAlpha(0.88);
  this.storyAnomalyCueState={
   enemy,cue:anomalyCue,outline,
   // Diagnostics refer to the shared mask; there is only one camera/UI owner.
   get vignette(){return dialogue.dialogueVignetteState?.vignette||null;},
   get cameraLocked(){return Boolean(dialogue.dialogueVignetteState?.cameraLocked);}
  };
  return true;
 }

 isStoryAnomalyMomentActive(time=this.time?.now||0){
  const state=this.storyAnomalyCueState;
  return Boolean(state?.enemy?.active && this.dialogueSystem?.active?.owner==='storyAnomaly');
 }

 updateStoryAnomalyCue(time=0){
  const state=this.storyAnomalyCueState;
  if(!state)return;
  if(!state.enemy?.active || state.enemy.hp<=0){
   if(this.dialogueSystem?.active?.owner==='storyAnomaly')this.dialogueSystem.cancel();
   this.finishStoryAnomalyHighlight();
   return;
  }
  this.syncStoryAnomalyOutline(state);
 }

 finishStoryAnomalyHighlight(){
  const state=this.storyAnomalyCueState;
  this.storyAnomalyCueState=null;
  state?.outline?.destroy?.();
 }

 isBrokenSaintEscortWaveCleared(){
  const champion=this.activeChampion;
  if(
   this.currentWorldZoneIndex!==0 || this.wave!==5 || !champion?.active || champion.hp<=0 ||
   champion.championKind!=='brokenSaint' || champion.ignoreAshAltarCollision ||
   this.spawned<this.waveTarget || this.storyEnemyAnomalies?.hasPendingReturns?.()
  ) return false;
  return !(this.enemies||[]).some(enemy=>
   enemy?.active && enemy.hp>0 && enemy!==champion && enemy.type!=='champion'
  );
 }

 releaseBrokenSaintFromAltar(){
  const champion=this.activeChampion;
  if(!champion?.active || champion.championKind!=='brokenSaint' || champion.ignoreAshAltarCollision)return false;
  champion.ignoreAshAltarCollision=true;
  champion.storyAltarLocked=false;
  champion.navPath=null;
  champion.navPathIndex=0;
  champion.navNextRepathAt=0;
  champion.navForceRepath=false;
  champion.obstacleSteerUntil=0;
  champion.body?.setVelocity?.(0,0);
  return true;
 }

 showWaveBanner(title,subtitle,color='#fff06a'){
  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.showEventBanner==='function'){
   hudScene.showEventBanner(title,subtitle,color);
   return;
  }
  for(const obj of this.waveBannerObjects){ if(obj && obj.destroy) obj.destroy(); }
  this.waveBannerObjects=[];
  const {cx,cy}=this.getUiMetrics();
  const titleText=lkAddText(this,cx,cy-65,title,{fontSize:'34px',color,stroke:'#101610',strokeThickness:5}).setOrigin(0.5).setDepth(190).setScrollFactor(0).setAlpha(0);
  const subText=lkAddText(this,cx,cy-25,subtitle,{fontSize:'16px',color:'#ffffff',stroke:'#101610',strokeThickness:3}).setOrigin(0.5).setDepth(190).setScrollFactor(0).setAlpha(0);
  this.waveBannerObjects=[titleText,subText];
  this.tweens.add({targets:[titleText,subText],alpha:1,duration:180,hold:850,yoyo:true,onComplete:()=>{
   for(const obj of this.waveBannerObjects){ if(obj && obj.active) obj.destroy(); }
   this.waveBannerObjects=[];
  }});
 }

 startWave(wave,initial=false,{preSpawnedChampion=false,suppressBanner=false}={}){
  this.captainSystem?.clear();
  this.wave=wave;
  this.spawned=0;
  this.waveIntermission=false;
  this.waveProfile=this.getWaveProfile(wave);
  const championKind=this.getChampionForWave(wave);
  const isPostWaveBrokenSaint=this.currentWorldZoneIndex===0 && wave===5 && championKind==='brokenSaint' && !preSpawnedChampion;
  this.postWaveChampionKind=isPostWaveBrokenSaint?championKind:null;
  this.championEventActive=Boolean(championKind && !isPostWaveBrokenSaint);
  this.waveSpawnInterval=this.calculateWaveSpawnInterval(this.waveProfile);
  this.waveTarget=this.calculateWaveTarget(wave,this.waveProfile,championKind,{concurrentChampion:preSpawnedChampion});
  if(this.currentWorldZoneIndex===0) this.storyEnemyAnomalies?.beginWave(wave,this.waveTarget);

  this.waveText.setText(`WAVE ${this.getGlobalWave()}`);
  this.waveSubText.setText(
   isPostWaveBrokenSaint ? 'FINAL ASSAULT' : (championKind ? 'CHAMPION EVENT' : this.waveProfile.name)
  );
  if(!initial) this.lastSpawn=this.time.now-250;

  if(championKind && !isPostWaveBrokenSaint && !preSpawnedChampion){
   const def=this.getChampionDefinition(championKind);
   const region=this.getWorldProgressName();
   if(!suppressBanner){
    this.showWaveBanner(
     'CHAMPION APPROACHES',
     `${def.name} · ${region} · ordinary enemies -30%`,
     def.rewardColor
    );
   }
   this.time.delayedCall(1100,()=>{
    if(!this.gameOver && this.wave===wave){
     this.spawnChampion(championKind);
    }
   });
  } else if(!suppressBanner) {
   this.showWaveBanner(`WAVE ${this.getGlobalWave()}`,`${this.waveProfile.name} · ${this.waveProfile.subtitle}`);
  }
 }

 beginWaveIntermission(time){
  if(this.waveIntermission) return;
  this.waveIntermission=true;
  if(this.currentWorldZoneIndex===0 && this.wave===2 && !this.ashSwordPulseCompleted){
   this.ashSwordPreludeQueuedAt=time+1000;
   this.nextWaveAt=Number.POSITIVE_INFINITY;
   this.waveSubText.setText('');
   return;
  }
  const woundedStoryGate=Boolean(
   this.currentWorldZoneIndex===0 &&
   this.wave===3 &&
   this.storyDirector?.getFlag?.(ASH_WOUNDED_KNIGHT_STORY.waveClearedFlag,false) &&
   !this.storyDirector?.getFlag?.(ASH_WOUNDED_KNIGHT_STORY.metFlag,false)
  );
  const altarStoryGate=Boolean(
   this.currentWorldZoneIndex===0 &&
   this.wave===4 &&
   this.storyDirector?.getFlag?.(ASH_ALTAR_CHAMPION_STORY.waveClearedFlag,false) &&
   !this.storyDirector?.getFlag?.(ASH_ALTAR_CHAMPION_STORY.fightStartedFlag,false)
  );
  this.nextWaveAt=(woundedStoryGate||altarStoryGate)?Number.POSITIVE_INFINITY:time+2200;
  this.storyWaveGateWasActive=woundedStoryGate;
  if(woundedStoryGate){
   this.waveSubText.setText('STORY');
   this.showWaveBanner('WAVE CLEARED','Find the wounded knight','#e7c96b');
  }else if(altarStoryGate){
   this.waveSubText.setText('STORY');
   this.activateAshAltarChampionObjective();
   this.showWaveBanner('WAVE CLEARED','Follow the marker to the altar','#e7c96b');
  }else{
   this.waveSubText.setText('BREATHER');
   this.showWaveBanner('WAVE CLEARED','Next assault in 2 seconds','#bfe8ff');
  }
 }

 isCaptainCastUninterruptible(enemy,time=this.time.now){
  return Boolean(enemy?.type==='captain' && (enemy.captainPhase==='windup' || enemy.captainPhase==='command'));
 }

 applyEnemyHitReaction(enemy,angle,baseForce=120){
  if(!enemy || !enemy.active || !enemy.body) return;
  // Once the Captain commits to a strike/command, damage still lands but player
  // hit reactions cannot cancel, shove or stagger the cast.
  if(this.isCaptainCastUninterruptible(enemy)) return;
  let resistance={skeleton:1.0,mage:0.88,shield:0.48,champion:0.30}[enemy.type] || 0.75;
  let staggerMs={skeleton:135,mage:120,shield:85,champion:60}[enemy.type] || 100;

  if(enemy.type==='champion'){
   if(enemy.championKind==='shieldWarden'){
    resistance=0.16;
    staggerMs=45;
   } else if(enemy.championKind==='hollowTree'){
    resistance=0;
    staggerMs=30;
   }
  }
  const force=baseForce*resistance;
  enemy.knockbackVX=Math.cos(angle)*force;
  enemy.knockbackVY=Math.sin(angle)*force;
  enemy.staggerUntil=Math.max(enemy.staggerUntil||0,this.time.now+staggerMs);
  enemy.body.setVelocity(enemy.knockbackVX,enemy.knockbackVY);

  if(enemy.visual && enemy.visual.active){
   const base=enemy.visualBaseScale || 0.5;
   this.tweens.add({targets:enemy.visual,scaleX:base*1.08,scaleY:base*0.92,duration:45,yoyo:true,ease:'Sine.easeOut',onComplete:()=>{
    if(enemy.visual && enemy.visual.active) enemy.visual.setScale(base);
   }});
  }
 }

 applyPlayerHitFeedback(damage){
  if(!this.playerVisual || !this.playerVisual.active) return;
  this.playerVisual.setTint(0xff8d8d);
  this.time.delayedCall(90,()=>{ if(this.playerVisual && this.playerVisual.active) this.playerVisual.clearTint(); });
  this.lastPlayerHitAt=this.time.now;
  const dmg=lkAddText(this,this.player.x+Phaser.Math.Between(-8,8),this.player.y-34,`-${damage}`,{fontSize:'15px',color:'#ffb0a6',stroke:'#351010',strokeThickness:3})
   .setOrigin(0.5).setDepth(70);
  this.tweens.add({targets:dmg,y:dmg.y-22,alpha:0,duration:520,ease:'Quad.easeOut',onComplete:()=>dmg.destroy()});
 }

 createDeathBurst(enemy,x,y){
  const color={skeleton:0xc7b8a0,mage:0x68ff87,shield:0xb8aa91,champion:0xd58cff}[enemy.type] || 0xffffff;
  for(let i=0;i<5;i++){
   const p=this.add.circle(x,y-8,Phaser.Math.Between(2,4),color,0.80).setDepth(18);
   const angle=(Math.PI*2*i/5)+Phaser.Math.FloatBetween(-0.25,0.25);
   const distance=Phaser.Math.Between(18,34);
   this.tweens.add({targets:p,x:x+Math.cos(angle)*distance,y:y-8+Math.sin(angle)*distance,alpha:0,scale:0.35,duration:Phaser.Math.Between(220,340),ease:'Quad.easeOut',onComplete:()=>p.destroy()});
  }
 }

 getXpRequiredForLevel(level=this.level){
  return BALANCE.XP_BASE+Math.max(0,level-1)*BALANCE.XP_PER_LEVEL;
 }

 grantXp(amount){
  if(amount<=0) return false;
  this.xp+=amount;
  const required=this.getXpRequiredForLevel();
  if(this.xp>=required){
   this.xp-=required;
   this.applyLevelUp();
   return true;
  }
  return false;
 }

 applyLevelUp(){
  this.level++;
  this.syncCharacterStats();
  this.openLevelChoices();
 }

 openLevelChoices(){
  if(this.levelChoiceOpen) return;

  this.levelChoiceKind='normal';
  this.levelChoiceOpen=true;
  this.setGameplayPaused('levelChoice',true);

  const choices=[];
  if(this.meleeAttack.damage<BALANCE.SWORD_DAMAGE_CAP){
   choices.push(['⚔ Sword Damage +3',()=>{
    this.weaponLevels.sword++;
    this.meleeAttack.level=this.weaponLevels.sword;
    this.meleeAttack.damage=Math.min(BALANCE.SWORD_DAMAGE_CAP,this.meleeAttack.damage+BALANCE.SWORD_DAMAGE_STEP);
   }]);
  }
  if(this.meleeAttack.cooldown>BALANCE.SWORD_COOLDOWN_CAP){
   choices.push(['⚡ Sword Speed +12%',()=>{
    this.weaponLevels.sword++;
    this.meleeAttack.level=this.weaponLevels.sword;
    this.meleeAttack.cooldown=Math.max(BALANCE.SWORD_COOLDOWN_CAP,Math.round(this.meleeAttack.cooldown*BALANCE.SWORD_SPEED_FACTOR));
   }]);
  }
  if(this.meleeAttack.radius<BALANCE.SWORD_RADIUS_CAP){
   choices.push(['🌀 Sword Radius +18',()=>{
    this.weaponLevels.sword++;
    this.meleeAttack.level=this.weaponLevels.sword;
    this.meleeAttack.radius=Math.min(BALANCE.SWORD_RADIUS_CAP,this.meleeAttack.radius+BALANCE.SWORD_RADIUS_STEP);
   }]);
  }

  if(choices.length===0){
   this.levelChoiceOpen=false;
   this.setGameplayPaused('levelChoice',false);
   this.showWaveBanner('WEAPON MAXED','All sword upgrades reached their cap','#ffe49b');
   return;
  }

  this.currentLevelChoices=choices;

  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.showLevelChoices==='function'){
   hudScene.showLevelChoices(this.level,choices.map(([label])=>label));
   this.levelChoiceObjects=[];
   return;
  }

  const {cx,cy}=this.getUiMetrics();
  const panel=this.add.rectangle(cx,cy,520,260,0x000000,0.85).setDepth(200).setScrollFactor(0);
  const title=lkAddText(this,cx,cy-95,`LEVEL ${this.level} - CHOOSE UPGRADE`,{fontSize:'26px',color:'#fff06a'})
   .setOrigin(0.5).setDepth(201).setScrollFactor(0);

  this.levelChoiceObjects=[panel,title];

  choices.forEach((c,i)=>{
   const b=lkAddText(this,
    cx,cy-45+i*55,c[0],
    {
     fontSize:'22px',
     color:'#ffffff',
     backgroundColor:'#263b22',
     padding:{x:16,y:8}
    }
   )
   .setOrigin(0.5)
   .setDepth(202)
   .setInteractive({useHandCursor:true});

   b.setScrollFactor(0);
   b.on('pointerdown',()=>this.selectLevelChoice(i));

   this.levelChoiceObjects.push(b);
  });
 }

 openCombatStyleChoice(){
  if(this.levelChoiceOpen || this.combatStyleChoiceShown)return false;
  this.levelChoiceOpen=true;
  this.levelChoiceKind='combatStyle';
  this.setGameplayPaused('levelChoice',true);
  const combatStyleCards=lkCombatStyleCards();
  this.currentLevelChoices=[
   [`${combatStyleCards[0].name}
${combatStyleCards[0].desc}`,()=>{
    this.combatStyle='crowdbreak';
   }],
   [`${combatStyleCards[1].name}
${combatStyleCards[1].desc}`,()=>{
    this.combatStyle='duelist';
   }],
   [`${combatStyleCards[2].name}
${combatStyleCards[2].desc}`,()=>{
    this.combatStyle='echo';
   }]
  ];

  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.showLevelChoices==='function'){
   hudScene.showLevelChoices(this.level,this.currentLevelChoices.map(([label])=>label),{
    variant:'combatStyle',
    title:'ПАМЯТЬ КЛИНКА',
    intro:'Меч отозвался на твою руку.\nТы не помнишь, кем был. Но клинок помнит, как ты сражался.',
    choiceCards:combatStyleCards
   });
   this.levelChoiceObjects=[];
   return true;
  }
  return false;
 }

 selectLevelChoice(index){
  if(!this.levelChoiceOpen) return;
  const choice=this.currentLevelChoices[index];
  if(!choice) return;
  const choiceKind=this.levelChoiceKind;
  choice[1]();
  if(choiceKind==='combatStyle')this.combatStyleChoiceShown=true;
  this.syncCharacterStats();
  this.closeLevelChoices();
  if(choiceKind==='combatStyle'){
   const wave=this.pendingCombatStyleWave;
   this.pendingCombatStyleWave=0;
   if(wave>0)this.startWave(wave);
  }
 }

 closeLevelChoices(){
  const choiceKind=this.levelChoiceKind;
  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.hideLevelChoices==='function') hudScene.hideLevelChoices();

  for(const o of this.levelChoiceObjects){
   if(o && o.destroy) o.destroy();
  }

  this.levelChoiceObjects=[];
  this.currentLevelChoices=[];
  this.levelChoiceOpen=false;
  this.levelChoiceKind='normal';
  this.setGameplayPaused('levelChoice',false);

  if(choiceKind==='combatStyle')return;

  const txt=lkAddText(this,
   this.player.x,this.player.y-55,
   `LEVEL ${this.level}!`,
   {fontSize:'18px',color:'#fff06a'}
  ).setOrigin(0.5).setDepth(80);

  this.tweens.add({
   targets:txt,
   y:txt.y-35,
   alpha:0,
   duration:900,
   onComplete:()=>txt.destroy()
  });
 }

 freezeCombatForDeath(){
  try{this.physics.world.pause();}catch{}
  if(this.player?.body) this.player.body.setVelocity(0,0);

  for(const enemy of this.enemies){
   if(!enemy?.active) continue;
   if(enemy.body) enemy.body.setVelocity(0,0);
   enemy.pendingMeleeHitAt=0;
   enemy.pendingMeleeDamage=0;
   enemy.pendingMeleeRange=0;
   if(enemy.visual?.anims?.isPlaying) enemy.visual.anims.pause();
   if(enemy.auraVisual?.anims?.isPlaying) enemy.auraVisual.anims.pause();
   if(enemy.reflectVisual?.anims?.isPlaying) enemy.reflectVisual.anims.pause();
  }

  for(const projectile of this.projectiles){
   if(!projectile?.active) continue;
   if(projectile.body) projectile.body.setVelocity(0,0);
   if(projectile.anims?.isPlaying) projectile.anims.pause();
  }

  for(const hazard of this.championHazards){
   if(hazard?.visual?.anims?.isPlaying) hazard.visual.anims.pause();
   if(hazard?.beamVisual?.anims?.isPlaying) hazard.beamVisual.anims.pause();
  }

  if(this.activeAttackFx?.active){
   this.activeAttackFx.destroy();
   this.activeAttackFx=null;
  }
 }

 launchDeathSword(){
  const front=this.playerWeaponFront;
  const back=this.playerWeaponBack;
  const source=front?.visible ? front : (back?.visible ? back : (front||back));
  if(!source?.texture?.key) return;

  const sword=this.add.sprite(source.x,source.y,source.texture.key)
   .setOrigin(source.originX,source.originY)
   .setScale(source.scaleX,source.scaleY)
   .setRotation(source.rotation)
   .setFlipX(source.flipX)
   .setFlipY(source.flipY)
   .setDepth((this.playerVisual?.depth||20)+0.4);
  sword.clearMask();
  this.deathSword=sword;

  if(back) back.setVisible(false).clearMask();
  if(front) front.setVisible(false).clearMask();

  // Default death art ends with the head to screen-right. Mirror flips that side,
  // so throw the sword in the opposite direction for a clearer silhouette.
  const dir=this.deathFlipX ? 1 : -1;
  const startX=sword.x;
  const startY=sword.y;
  const groundY=this.player.y+10;
  const spin=dir*Phaser.Math.DegToRad(520);

  this.tweens.add({
   targets:sword,
   x:startX+dir*62,
   y:startY-58,
   rotation:sword.rotation+spin*0.42,
   duration:330,
   ease:'Quad.easeOut',
   onComplete:()=>{
    if(!sword.active) return;
    this.tweens.add({
     targets:sword,
     x:startX+dir*128,
     y:groundY,
     rotation:sword.rotation+spin*0.58,
     duration:570,
     ease:'Quad.easeIn',
     onComplete:()=>{
      if(!sword.active) return;
      this.tweens.add({
       targets:sword,
       y:groundY-2,
       duration:70,
       yoyo:true,
       ease:'Sine.easeOut'
      });
     }
    });
   }
  });
 }

 finishDeathSequence(){
  if(!this.gameOver || this.gameOverUiReady) return;
  this.deathSequenceActive=false;
  this.gameOverUiReady=true;
  this.gameOverPanel.setVisible(true);
  this.gameOverText.setText(
   `GAME OVER\nWave ${this.wave}  •  Kills ${this.kills}\nPress R to restart`
  ).setVisible(true);
 }

 endRun(){
  if(this.gameOver) return;
  this.captainSystem?.clear();

  // Set gameOver immediately: every existing attack/cast callback that checks it
  // is silenced now. The visible death UI is deliberately delayed below.
  this.gameOver=true;
  this.gameOverUiReady=false;
  this.deathSequenceActive=true;
  this.stopCriticalHeartbeat(false);
  this.stopBrokenSaintHolyWarningSfx();
  this.playHeroDeathSfx();
  this.freezeCombatForDeath();

  // One random orientation for the complete six-frame sequence.
  this.deathFlipX=Math.random()<0.5;
  this.launchDeathSword();

  if(this.playerVisual?.active){
   this.playerVisual.clearTint();
   this.playerVisual.stop();
   this.playerVisual
    .setPosition(this.player.x,this.player.y)
    .setOrigin(0.5,0.78)
    .setScale(HERO_DEATH_VISUAL_SCALE)
    .setFlipX(this.deathFlipX)
    .setFlipY(false)
    .setTexture('hero_death_01')
    .play('hero_death',true);
   this.playerVisualState='hero_death';
  }

  if(this.playerShadow?.active){
   this.playerShadow.setVisible(true);
   const hideShadowAt=HERO_DEATH_ANIMATION_MS*(2/HERO_DEATH_FRAME_COUNT);
   this.time.delayedCall(hideShadowAt,()=>{
    if(this.gameOver && this.playerShadow?.active) this.playerShadow.setVisible(false);
   });
  }

  // 3 seconds falling, then 1 second motionless on the final frame.
  this.time.delayedCall(HERO_DEATH_ANIMATION_MS,()=>{
   if(!this.gameOver || !this.playerVisual?.active) return;
   this.playerVisual.stop();
   this.playerVisual.setTexture('hero_death_06');
  });
  this.time.delayedCall(HERO_DEATH_ANIMATION_MS+HERO_DEATH_HOLD_MS,()=>{
   this.finishDeathSequence();
  });
 }

 beginSubsystemTrace(){
  return this.devTools?.isPerformanceTraceActive?.()?performance.now():0;
 }

 endSubsystemTrace(name,startedAt){
  if(!startedAt)return 0;
  const now=performance.now();
  this.devTools?.recordSubsystemTime?.(name,now-startedAt);
  return now;
 }

 update(time,delta){
  this.captainSystem?.barks.update();
  this.syncOrientationPause();
  this.updateLowHealthState();
  this.devTools?.update(time,delta);
  let traceSectionAt=this.beginSubsystemTrace();
  this.dialogueSystem?.update(time);
  this.woundedKnightInteractions?.update(time);
  this.updateStoryAnomalyCue(time);
  this.updateAshAltarChampionStory(this.time.now);
  this.updateHeroFocusInteractionStance(time);
  const storyBusy=Boolean(this.storyDirector?.update(time));
  traceSectionAt=this.endSubsystemTrace('story',traceSectionAt);
  if(storyBusy){
   // A story event may enter dialogue/cinematic focus on this exact frame.
   this.updateHeroFocusInteractionStance(time);
   return;
  }
  if(this.gameplayPaused || this.levelChoiceOpen || this.championRewardOpen) return;

  // Scene Clock pauses with gameplay overlays, unlike the global update timestamp.
  // Using it here prevents cooldowns/waves/mana from jumping forward after a menu.
  time=this.time.now;

  if(this.gameOver){
   if(this.gameOverUiReady && Phaser.Input.Keyboard.JustDown(this.restartKey)){
    this.restartCurrentZone();
   }
   return;
  }

  if(this.brokenSaintDefeatSequenceActive){
   this.player?.body?.setVelocity?.(0,0);
   this.mobileMoveX=0;
   this.mobileMoveY=0;
   this.updateHeroFocusInteractionStance(time);
   return;
  }

  if(this.isAshSwordPreludeActive()){
   this.updateAshSwordPrelude(this.time.now);
   // The sword intermission short-circuits the normal gameplay update below,
   // so the cinematic flock needs its own update here or it freezes in the
   // spawn formation while the camera is focused on the sword.
   this.updateCrows(this.time.now,delta,{orbitOnly:true});
   this.updateAshSwordPulse(this.time.now);
   this.updateHeroFocusInteractionStance(this.time.now);
   return;
  }
  if(this.updateBrokenSaintSwordEpilogue(this.time.now))return;

  this.captainSystem?.update(time);
  this.updateCrows(time,delta);
  if(this.updateZone2ArrivalSequence(time)){
   this.updateHeroFocusInteractionStance(time);
   return;
  }

  this.updateMana(time);
  this.updateAshSwordPulse(time);

  if(Phaser.Input.Keyboard.JustDown(this.skillKeys.skill1)) this.handleSkillInput(1);
  if(Phaser.Input.Keyboard.JustDown(this.skillKeys.skill2)) this.handleSkillInput(2);
  if(Phaser.Input.Keyboard.JustDown(this.skillKeys.skill3)) this.handleSkillInput(3);

  // Keep world lists accurate before progression checks.
  this.enemies=this.enemies.filter(e=>e && e.active);

  let vx=0,vy=0;
  let s=BALANCE.PLAYER_SPEED;

  if(time<this.playerSlowUntil){
   s*=this.playerSlowFactor||0.45;
  } else {
   this.playerSlowFactor=1;
  }
  // Successful Lift slows the hero by 45% while targets are airborne and for
  // three more seconds after the last launched target lands. Missed Lift = no debuff.
  if(time<(this.liftSlowUntil||0)) s*=BROKEN_SAINT_LIFT_SLOW_FACTOR;
  if(time<(this.playerSpeedBoostUntil||0)){
   s*=this.playerSpeedBoostFactor||1.35;
  } else {
   this.playerSpeedBoostFactor=1;
  }

  if(time<this.playerForcedUntil){
   vx=this.playerForcedVX||0;
   vy=this.playerForcedVY||0;
  } else {
   if(this.keys.A.isDown||this.cursors.left.isDown)vx=-s;
   if(this.keys.D.isDown||this.cursors.right.isDown)vx=s;
   if(this.keys.W.isDown||this.cursors.up.isDown)vy=-s;
   if(this.keys.S.isDown||this.cursors.down.isDown)vy=s;
   if(vx===0 && vy===0 && Math.abs(this.mobileMoveX)+Math.abs(this.mobileMoveY)>0.01){
    vx=this.mobileMoveX*s;
    vy=this.mobileMoveY*s;
   }
   const moveMagnitude=Math.hypot(vx,vy);
   if(moveMagnitude>s && moveMagnitude>0){
    vx=vx/moveMagnitude*s;
    vy=vy/moveMagnitude*s;
   }
  }

  if(this.isStoryAnomalyMomentActive(time) || this.isAshChampionIntroActive()){
   // Story focus beats are a hard cinematic freeze: the hero can observe, but not move.
   vx=0;
   vy=0;
  }
  // Spin is committed DPS: player input cannot move the hero during the channel,
  // while enemy knockback/forced motion can still displace him.
  if(time<(this.spinCommitUntil||0) && time>=(this.playerForcedUntil||0)){
   vx=0;
   vy=0;
  }

  if(this.captainSystem?.isStunned(time)){vx=0;vy=0;}

  this.player.body.setVelocity(vx,vy);

  this.playerVisual.setPosition(
   this.player.x,
   this.player.y
  );

  if(this.activeAttackFx && this.activeAttackFx.active){
   this.activeAttackFx.setPosition(
    this.player.x,
    this.player.y
   );
  }

  this.updateReadabilityLayers();

  const heroFocusInteractionActive=this.isHeroFocusInteractionActive();
  const playerMoving=Math.abs(vx)+Math.abs(vy)>0;
  if(heroFocusInteractionActive){
   // Story focus / dialogue always uses the same calm south-facing two-frame
   // sword stance instead of freezing whatever attack/walk frame happened to be active.
   this.updateHeroFocusInteractionStance(time);
  }else{
   this.playerDir=this.getDirectionFromVector(
    vx,
    vy,
    this.playerDir
   );
   this.playerVisualDir8=this.getHeroSocketDirectionFromVector(
    vx,
    vy,
    this.playerVisualDir8||'s'
   );

   if(time>=this.playerAttackUntil){
    const nextPlayerKey=`hero_socket_${
     playerMoving ? 'walk' : 'idle'
    }_${this.playerVisualDir8}`;

    if(this.playerVisualState!==nextPlayerKey){
     this.playerVisualState=nextPlayerKey;
     this.playerVisual.play(nextPlayerKey,true);
    }
   }
   this.updateHeroWeaponAttachment();
  }

  traceSectionAt=this.beginSubsystemTrace();
  this.updateWorldRegion();
  this.updateWorldStreaming();
  this.updateRuntimeEnvironmentCulling(time);
  traceSectionAt=this.endSubsystemTrace('worldStreaming',traceSectionAt);

  if(this.waveIntermission){
   if(this.currentWorldZoneIndex===0&&this.wave===2&&!this.ashSwordPulseCompleted&&this.ashSwordPreludeQueuedAt&&time>=this.ashSwordPreludeQueuedAt){
    this.ashSwordPreludeQueuedAt=0;this.beginAshSwordPrelude(time);return;
   }
   if(this.awaitingWorldAdvance){
    this.updateWorldTravel(time);
   } else {
    const woundedStoryGateActive=Boolean(
     this.currentWorldZoneIndex===0 &&
     this.wave===3 &&
     this.storyDirector?.getFlag?.(ASH_WOUNDED_KNIGHT_STORY.waveClearedFlag,false) &&
     !this.storyDirector?.getFlag?.(ASH_WOUNDED_KNIGHT_STORY.metFlag,false)
    );
    const altarStoryGateActive=this.isAshAltarStoryGateActive();
    if(woundedStoryGateActive){
     this.storyWaveGateWasActive=true;
     this.nextWaveAt=Number.POSITIVE_INFINITY;
    } else if(altarStoryGateActive){
     // Wave 5 is deliberately withheld. updateAshAltarChampionStory() owns the
     // altar marker, reveal, and exact frame where champion combat + wave 5 begin.
     this.nextWaveAt=Number.POSITIVE_INFINITY;
    } else {
     if(this.storyWaveGateWasActive){
      this.storyWaveGateWasActive=false;
      this.nextWaveAt=time+800;
      this.waveSubText.setText('STORY COMPLETE');
      this.showWaveBanner('PATH FORWARD','The next assault is coming','#d9e6c5');
     }
     if(time>=this.nextWaveAt)this.startWave(this.wave+1);
    }
   }
  } else {
   const captainPopulationReady=!isCaptainEncounter(this.currentWorldZoneIndex,this.wave) ||
    this.enemies.filter(e=>e.active && e.hp>0 && e.type==='skeleton').length<CAPTAIN.maxLivingSoldiers;
   if(captainPopulationReady && !this.devFlags?.autoSpawnsDisabled && this.spawned<this.waveTarget && time-this.lastSpawn>this.waveSpawnInterval){
    this.lastSpawn=time;
    this.spawnEnemy();
    this.spawned++;
   }
   if(this.isBrokenSaintEscortWaveCleared()){
    this.releaseBrokenSaintFromAltar();
   }
   if(
    this.spawned>=this.waveTarget &&
    this.enemies.length===0 &&
    !this.storyEnemyAnomalies?.hasPendingReturns?.() &&
    !this.activeChampion
   ){
    if(this.postWaveChampionKind){
     const kind=this.postWaveChampionKind;
     this.postWaveChampionKind=null;
     this.championEventActive=true;
     this.spawnChampion(kind);
    } else if(this.pendingWorldAdvance){
     this.beginWorldTravel();
    } else {
     if(this.currentWorldZoneIndex===0 && this.wave===3){
      this.storyDirector?.setFlag?.(ASH_WOUNDED_KNIGHT_STORY.waveClearedFlag,true);
     }else if(this.currentWorldZoneIndex===0 && this.wave===4){
      this.storyDirector?.setFlag?.(ASH_ALTAR_CHAMPION_STORY.waveClearedFlag,true);
      this.activateAshAltarChampionObjective();
     }
     this.beginWaveIntermission(time);
    }
   }
  }

  this.updateChampionHazards(time);
  this.updateRelics(time);
  traceSectionAt=this.beginSubsystemTrace();
  if(!this.isAshChampionIntroActive() && !this.captainSystem?.isStunned(time))this.meleeAttack.update(time,this.enemies);
  traceSectionAt=this.endSubsystemTrace('melee',traceSectionAt);
  this.updateHeroWeaponAttachment();
  this.cleanupDefeatedEnemies(time);
  if(this.gameplayPaused || this.levelChoiceOpen || this.championRewardOpen) return;

  this.updateEmptyScreenRush();

  // Spread A* work across frames. Direct line-of-sight chasers spend no budget;
  // only enemies whose route is actually blocked request a path.
  this.navigationPathfindBudget=1;
  this.navigationRescuePathfindBudget=1;

  traceSectionAt=this.beginSubsystemTrace();
  // Crowd melee rule: at most the four closest ordinary skeletons are allowed
  // to deal contact damage at once. Rebuilding/sorting this list every render
  // frame is unnecessary; 10Hz is responsive enough for slot hand-offs while
  // keeping the exact same four-attacker gameplay rule.
  if(!this.skeletonAttackSlots || time>=(this.nextSkeletonAttackSlotRefreshAt||0)){
   this.nextSkeletonAttackSlotRefreshAt=time+100;
   this.skeletonAttackSlots=new Set(
    this.enemies
     .filter(e=>e.active && e.hp>0 && e.type==='skeleton' && !e.captainFlee)
     .sort((a,b)=>
      Phaser.Math.Distance.Squared(a.x,a.y,this.player.x,this.player.y)-
      Phaser.Math.Distance.Squared(b.x,b.y,this.player.x,this.player.y)
     )
     .slice(0,4)
   );
  }
  const skeletonAttackSlots=this.skeletonAttackSlots;

  // Count owned mage projectiles once per frame instead of filtering the entire
  // projectile list separately for every mage.
  const activeMageShotsByOwner=new Map();
  for(const projectile of this.projectiles){
   if(!projectile?.active || !projectile.owner) continue;
   activeMageShotsByOwner.set(projectile.owner,(activeMageShotsByOwner.get(projectile.owner)||0)+1);
  }

  const storyMomentActive=this.isStoryAnomalyMomentActive(time);
  const focusedStoryEnemy=this.storyAnomalyCueState?.enemy||null;

  for(const e of this.enemies){
   if(!e.active) continue;
   if(e.hp<=0){
    this.finalizeEnemyDeath(e,time);
    if(this.gameplayPaused || this.levelChoiceOpen || this.championRewardOpen) return;
    continue;
   }

   let a=Phaser.Math.Angle.Between(
    e.x,e.y,this.player.x,this.player.y
   );

   const distance=Phaser.Math.Distance.Between(
    e.x,e.y,this.player.x,this.player.y
   );

   let pursuitSpeed=this.getEnemyMovementSpeed(e);
   const storyCinematicFrozen=Boolean((storyMomentActive && e!==focusedStoryEnemy) || e.storyDormant);
   const devFreezeAI=e.type==='champion' ? this.devFlags?.championFrozen : this.devFlags?.enemyAiFrozen;
   const devFreezeMove=e.type==='champion' ? this.devFlags?.championMovementFrozen : this.devFlags?.enemyMovementFrozen;
   const storyAnomaly=!devFreezeAI
    ? this.storyEnemyAnomalies?.updateEnemy(e,time,distance)
    : null;

   // An NPC can begin a dialogue inside this AI iteration. Stop this frame
   // immediately; the shared dialogue has already paused physics and timers.
   if(this.dialogueSystem?.active || this.gameplayPaused)return;

   if(storyAnomaly){
    if(storyAnomaly.kind==='vanished') continue;
    e.pendingMeleeHitAt=0;
    e.pendingMeleeDamage=0;
    e.pendingMeleeRange=0;
    e.attackAnimUntil=0;
    if(storyAnomaly.kind==='flee'){
     const fleeSpeed=Math.max(190,pursuitSpeed*(storyAnomaly.speedFactor||3.15));
     e.body.setVelocity(Math.cos(storyAnomaly.angle||0)*fleeSpeed,Math.sin(storyAnomaly.angle||0)*fleeSpeed);
    } else {
     e.body.setVelocity(0,0);
    }
   }

   if(storyCinematicFrozen){
    e.pendingMeleeHitAt=0;
    e.pendingMeleeDamage=0;
    e.pendingMeleeRange=0;
    e.attackAnimUntil=0;
    if(e.body)e.body.setVelocity(0,0);
   }

   if(devFreezeAI){
    if(e.body)e.body.setVelocity(0,0);
    e.pendingMeleeHitAt=0;e.pendingMeleeDamage=0;e.pendingMeleeRange=0;
   }

   if(!devFreezeAI && !storyAnomaly && !storyMomentActive && !e.storyDormant && e.pendingMeleeHitAt && time>=e.pendingMeleeHitAt){
    const pendingDamage=e.pendingMeleeDamage||e.attackDamage||8;
    const pendingRange=e.pendingMeleeRange||70;
    e.pendingMeleeHitAt=0;
    e.pendingMeleeDamage=0;
    e.pendingMeleeRange=0;
    if(distance<=pendingRange && !(e.type==='champion'?this.devFlags?.championAttacksDisabled:this.devFlags?.enemyAttacksDisabled)){
     if(this.damagePlayer(pendingDamage,`melee:${e.type}`,e)) return;
    }
   }

   if(!devFreezeAI && !storyAnomaly && !storyCinematicFrozen){
    if(time<(e.skillTremorUntil||0)){
     e.body.setVelocity(e.skillTremorVX||0,e.skillTremorVY||0);
    } else if(time<(e.skillLiftUntil||0)){
     e.body.setVelocity(e.skillLiftDriftX||0,e.skillLiftDriftY||0);
    } else if(time<(e.staggerUntil||0)){
     e.body.setVelocity(e.knockbackVX||0,e.knockbackVY||0);
     e.knockbackVX*=0.82;
     e.knockbackVY*=0.82;
    } else if(e.captainFlee){
     this.captainSystem.updateFlee(e,time);
     if(!e.active)continue;
    } else if(e.type==='captain'){
     this.captainSystem.updateCaptain(e,time);
     if(this.gameOver)return;
    } else if(e.type==='champion'){
     this.updateChampion(e,time,a,distance);
    } else if(e.type==='mage'){
     const captainSupportMoving=Boolean(this.captainSystem?.moveSupport?.(e,time));
     if(!captainSupportMoving){
      if(distance>210){
       this.setEnemySteeredVelocity(e,Math.cos(a)*pursuitSpeed,Math.sin(a)*pursuitSpeed,time);
      } else if(distance<160){
       this.setEnemySteeredVelocity(e,-Math.cos(a)*pursuitSpeed,-Math.sin(a)*pursuitSpeed,time);
      } else {
       e.body.setVelocity(0,0);
      }
     }

     const activeMageShots=activeMageShotsByOwner.get(e)||0;

     if(!storyMomentActive && !this.devFlags?.enemyAttacksDisabled && time-e.lastShot>1700 && activeMageShots<2){
      e.lastShot=time;
      const castWindup=320;
      e.attackAnimUntil=time+620;
      e.attackDir=e.dir;
      this.playMageCastSfx(time);

      if(e.visual && e.visual.active){
       const castKey=`mage_${e.attackDir}_cast`;
       if(e.visualState!==castKey){
        e.visualState=castKey;
        e.visual.play(castKey,true);
       }
      }

      // The projectile is released after a visible cast window and aims only at
      // the hero's CURRENT position at the release frame. No velocity prediction,
      // homing, or post-release correction: moving after the shot can dodge it.
      this.time.delayedCall(castWindup,()=>{
       if(!e || !e.active || e.hp<=0 || this.gameOver || this.devFlags?.enemyAttacksDisabled || this.devFlags?.enemyAiFrozen || this.isStoryAnomalyMomentActive(this.time.now) || this.isAshChampionIntroActive()) return;
       if(this.storyEnemyAnomalies?.isEnemyAnomalyActive(e,this.time.now)) return;
       if(this.time.now<(e.staggerUntil||0) || this.time.now<(e.skillLiftUntil||0)) return;

       const shotX=this.clampWorldX(this.player.x,20);
       const shotY=this.clampWorldY(this.player.y,20);
       const shotAngle=Phaser.Math.Angle.Between(e.x,e.y,shotX,shotY);

       const projectile=this.add.sprite(
        e.x,e.y,'mage_projectile_00'
       ).setOrigin(0.5).setDepth(18).setRotation(shotAngle);
       projectile.play('mage_projectile_fly');
       this.physics.add.existing(projectile);
       projectile.body.setVelocity(
        Math.cos(shotAngle)*BALANCE.MAGE_PROJECTILE_SPEED,
        Math.sin(shotAngle)*BALANCE.MAGE_PROJECTILE_SPEED
       );
       projectile.damage=BALANCE.MAGE_PROJECTILE_DAMAGE;
       projectile.born=this.time.now;
       projectile.owner=e;
       projectile.lastWorldX=projectile.x;
       projectile.lastWorldY=projectile.y;
       this.projectiles.push(projectile);
      });
     }
    } else {
     const hasMeleeSlot=e.type!=='skeleton' || skeletonAttackSlots.has(e);

     if((e.type==='skeleton'||e.type==='shield') && this.captainSystem?.moveSoldier(e,time)){
      // Captain formations (including summoned heavy guards) do not bypass
      // ordinary attack slots/cooldowns below.
     } else if(e.type==='skeleton'){
      // Front-line skeletons stop at a readable melee distance instead of
      // walking into the player's center. Skeletons without one of the four
      // melee slots form a second ring slightly farther out.
      const desiredRange=hasMeleeSlot ? 56 : 76;
      const deadZone=4;

      if(time<e.attackAnimUntil){
       e.body.setVelocity(0,0);
      } else if(distance>desiredRange+deadZone){
       this.setEnemySteeredVelocity(e,Math.cos(a)*pursuitSpeed,Math.sin(a)*pursuitSpeed,time);
      } else if(distance<desiredRange-deadZone){
       // If crowd pressure pushes a skeleton inside its ring, gently push it
       // back out rather than letting bodies stack on the hero.
       const retreatSpeed=Math.max(34,pursuitSpeed*0.55);
       this.setEnemySteeredVelocity(e,-Math.cos(a)*retreatSpeed,-Math.sin(a)*retreatSpeed,time);
      } else {
       e.body.setVelocity(0,0);
      }
     } else if(e.type==='shield' && time<e.attackAnimUntil){
      e.body.setVelocity(0,0);
     } else {
      this.setEnemySteeredVelocity(e,Math.cos(a)*pursuitSpeed,Math.sin(a)*pursuitSpeed,time);
     }

     const attackRange=e.type==='skeleton'
      ? 62
      : (e.type==='shield'
       ? 58
       : (this.player.hitRadius||16)+(e.hitRadius||14)+8);
     const attackDamage=e.attackDamage || 5;

     const attackCooldown=e.type==='shield' ? 1300 : 1100;
     const gatheringRing=Boolean(e.captainFormationTarget?.gather);
     if(!gatheringRing && !storyMomentActive && !this.devFlags?.enemyAttacksDisabled && hasMeleeSlot && !e.pendingMeleeHitAt && distance<=attackRange && time-e.lastAttack>attackCooldown){
      e.lastAttack=time;
      if(e.type==='skeleton') this.playSkeletonAttackSfx(time);
      const windup=e.type==='shield' ? 480 : 350;
      e.pendingMeleeHitAt=time+windup;
      e.pendingMeleeDamage=attackDamage;
      e.pendingMeleeRange=attackRange+10;
      e.attackAnimUntil=time+windup+260;
      e.attackDir=e.captainFormationTarget?.ring
       ? this.getDirectionFromVector(this.player.x-e.x,this.player.y-e.y,e.dir)
       : e.dir;
      e.body.setVelocity(0,0);

      if(e.visual && e.visual.active){
       const prefix=this.getEnemyVisualPrefix(e.type);
       const attackKey=`${prefix}_${e.attackDir}_attack`;
       if(e.visualState!==attackKey){
        e.visualState=attackKey;
        e.visual.play(attackKey,true);
       }
      }
     }
    }
   }
   if(devFreezeMove && e.body)e.body.setVelocity(0,0);
   this.applyBrokenSaintCrowdKeepout(e);
   if((devFreezeMove||devFreezeAI) && e.body)e.body.setVelocity(0,0);

   if(e.auraVisual && e.auraVisual.active){
    e.auraVisual.setPosition(e.x,e.y);
   }
   if(e.reflectVisual && e.reflectVisual.active){
    e.reflectVisual.setPosition(e.x,e.y-8);
   }
   if(e.shadowVisual && e.shadowVisual.active){
    const shadowYOffset=e.type==='mage'
     ? ASH_READABILITY.MAGE_SHADOW_Y_OFFSET
     : (e.type==='shield' ? ASH_READABILITY.SHIELD_SHADOW_Y_OFFSET : (e.hitRadius||14)*0.82);
    e.shadowVisual.setPosition(e.x,e.y+shadowYOffset);
   }

   if(e.type==='captain'){
    this.captainSystem.render(e,time);
   } else if(e.visual && e.visual.active){
    let liftOffset=0;
    let liftRotation=0;
    let liftScaleX=e.visualBaseScale||e.visual.scaleX||0.5;
    const liftScaleY=e.visualBaseScale||e.visual.scaleY||0.5;
    if(time<(e.skillLiftUntil||0) && e.skillLiftStartAt!==undefined){
     const duration=Math.max(1,e.skillLiftUntil-e.skillLiftStartAt);
     const progress=Phaser.Math.Clamp((time-e.skillLiftStartAt)/duration,0,1);
     // Higher arc with a tiny hang near the apex.
     const arc=Math.pow(Math.sin(progress*Math.PI),0.78);
     liftOffset=-arc*(e.skillLiftHeight||112);
     if(e.skillLiftMotion===1){
      liftRotation=(e.skillLiftTilt||0)+progress*Math.PI;
     } else if(e.skillLiftMotion===2){
      liftRotation=(e.skillLiftTilt||0)+progress*Math.PI*2*(e.skillLiftTilt<0?-1:1);
     } else {
      liftRotation=(e.skillLiftTilt||0)*Math.sin(progress*Math.PI);
     }
     // A small mid-air squash/stretch sells the vertical momentum.
     const squash=Math.sin(progress*Math.PI)*0.08;
     liftScaleX*=1+squash;
     e.visual.setScale(liftScaleX,liftScaleY*(1-squash*0.55));
    } else if(Math.abs(e.visual.rotation)>0.001){
     e.visual.setRotation(0);
     e.visual.setScale(e.visualBaseScale||0.5);
    }
    e.visual.setRotation(liftRotation);
    e.visual.setPosition(e.x,e.y+liftOffset);
    if(e.saintsNailMarkVisual?.active){
     if(time>(e.saintsNailMarkedUntil||0)){
      e.saintsNailMarkVisual.destroy();
      e.saintsNailMarkVisual=null;
     } else {
      e.saintsNailMarkVisual.setPosition(e.x,e.y+liftOffset+4);
     }
    }
    const isBrokenSaint=e.type==='champion' && e.championKind==='brokenSaint';
    const anomalyFlee=e.storyAnomaly?.phase==='flee';
    e.dir=isBrokenSaint
     ? this.getEightDirectionFromVector(
       this.player.x-e.x,
       this.player.y-e.y,
       e.dir||'down'
      )
     : (e.captainFlee || e.captainFormationTarget?.ring)
      ? this.getDirectionFromVector(e.body.velocity.x,e.body.velocity.y,e.dir||'down')
     : anomalyFlee
      ? this.getDirectionFromVector(
        Math.cos(e.storyAnomaly.fleeAngle||0),
        Math.sin(e.storyAnomaly.fleeAngle||0),
        e.dir||'down'
       )
      : this.getDirectionFromVector(
        this.player.x-e.x,
        this.player.y-e.y,
        e.dir||'down'
       );

    const prefix=isBrokenSaint ? 'broken_saint' : this.getEnemyVisualPrefix(e.type);
    let action='idle';

    if(time<(e.staggerUntil||0)){
     action='idle';
    } else if(time<e.attackAnimUntil){
     action=this.getEnemyAttackAction(e.type);
    } else if(e.body && e.body.velocity.lengthSq()>4){
     action='walk';
    }

    const visualDir=time<e.attackAnimUntil ? (e.attackDir||e.dir) : e.dir;
    const enemyAnimKey=`${prefix}_${visualDir}_${action}`;

    if(e.type==='skeleton'){
     const movingInRing=action==='walk' && e.captainFormationTarget?.ring;
     const rate=movingInRing?Math.min(3,Math.max(1,e.body.velocity.length()/Math.max(1,e.speed))):1;
     // Phaser 3.90 exposes the speed as a property on AnimationState; older
     // builds do not provide the setTimeScale() convenience method.
     if(e.visual?.anims){ e.visual.anims.timeScale=rate; }
    }

    if(e.visualState!==enemyAnimKey){
     e.visualState=enemyAnimKey;
     e.visual.play(enemyAnimKey,true);
    }
   }

   if(e.type==='champion' && e===this.activeChampion){
    this.updateChampionBar();
   }

  }

  this.applyEnemySoftSeparation(time);
  // Soft separation adds velocity after the AI loop; override it as well so the
  // cinematic freeze is physically absolute for every non-focused enemy.
  if(storyMomentActive || this.isAshChampionIntroActive()){
   for(const enemy of this.enemies||[]){
    if(enemy?.active && enemy.body && ((storyMomentActive && enemy!==focusedStoryEnemy) || enemy.storyDormant)){
     enemy.body.setVelocity(0,0);
    }
   }
  }
  traceSectionAt=this.endSubsystemTrace('enemyAI',traceSectionAt);

  for(const o of this.orbs){
   if(o.active && Phaser.Math.Distance.Between(o.x,o.y,this.player.x,this.player.y)<40){
    o.destroy();
    if(this.grantXp(10)) return;
   }
  }

  for(const heart of this.hearts){
   if(!heart.active) continue;

   if(time>=heart.expiresAt){
    heart.destroy();
    continue;
   }

   const heartDistance=Phaser.Math.Distance.Between(
    heart.x,heart.y,this.player.x,this.player.y
   );

   if(time>=(heart.pickupAt||0) && heartDistance<38){
    const baseHeal=heart.healAmount||BALANCE.HEART_HEAL;
    const healAmount=this.championRelics.has('ancientBlood') ? Math.round(baseHeal*1.5) : baseHeal;
    const hpBefore=this.player.hp;
    this.player.hp=Math.min(
     this.player.maxHp||100,
     this.player.hp+healAmount
    );
    this.updateLowHealthState();

    const healed=this.player.hp-hpBefore;
    if(healed>0){
     const healText=lkAddText(this,
      this.player.x,this.player.y-30,`+${healed}`,
      {fontSize:'13px',color:'#8dff9d',stroke:'#102010',strokeThickness:2}
     ).setOrigin(0.5).setDepth(35);
     this.tweens.add({
      targets:healText,y:healText.y-16,alpha:0,duration:420,
      onComplete:()=>healText.destroy()
     });
    }

    heart.destroy();
   }
  }

  traceSectionAt=this.beginSubsystemTrace();
  const storyProjectileFreeze=this.isStoryAnomalyMomentActive(time);
  for(const projectile of this.projectiles){
   if(!projectile.active) continue;

   if(storyProjectileFreeze){
    if(!projectile.storyAnomalyFrozenAt){
     projectile.storyAnomalyFrozenAt=time;
     projectile.storyAnomalyFreezeVX=projectile.body?.velocity?.x||0;
     projectile.storyAnomalyFreezeVY=projectile.body?.velocity?.y||0;
     projectile.storyAnomalyFreezeAnim=Boolean(projectile.anims?.isPlaying);
    }
    projectile.body?.setVelocity?.(0,0);
    if(projectile.anims?.isPlaying)projectile.anims.pause();
    continue;
   }

   if(projectile.storyAnomalyFrozenAt){
    const frozenFor=Math.max(0,time-projectile.storyAnomalyFrozenAt);
    projectile.born=(projectile.born||time)+frozenFor;
    projectile.body?.setVelocity?.(projectile.storyAnomalyFreezeVX||0,projectile.storyAnomalyFreezeVY||0);
    if(projectile.storyAnomalyFreezeAnim)projectile.anims?.resume?.();
    projectile.storyAnomalyFrozenAt=0;
    projectile.storyAnomalyFreezeVX=0;
    projectile.storyAnomalyFreezeVY=0;
    projectile.storyAnomalyFreezeAnim=false;
    projectile.lastWorldX=projectile.x;
    projectile.lastWorldY=projectile.y;
   }

   const lastProjectileX=Number.isFinite(projectile.lastWorldX)?projectile.lastWorldX:projectile.x;
   const lastProjectileY=Number.isFinite(projectile.lastWorldY)?projectile.lastWorldY:projectile.y;
   if(!this.devFlags?.noCollision && this.isAshPathBlocked(lastProjectileX,lastProjectileY,projectile.x,projectile.y,6)){
    projectile.destroy();
    continue;
   }
   projectile.lastWorldX=projectile.x;
   projectile.lastWorldY=projectile.y;

   const projectileDistance=Phaser.Math.Distance.Between(
    projectile.x,projectile.y,
    this.player.x,this.player.y
   );

   if(projectileDistance<(this.player.hitRadius+10)){
    const lethal=this.damagePlayer(projectile.damage,'mageProjectile',projectile.owner||null);
    projectile.destroy();

    if(lethal){
     traceSectionAt=this.endSubsystemTrace('projectiles',traceSectionAt);
     return;
    }

    continue;
   }

   const expired=time-projectile.born>4000;
   const outside=
    projectile.x < -80 ||
    projectile.x > STAGE0.WORLD_WIDTH+80 ||
    projectile.y < -80 ||
    projectile.y > STAGE0.WORLD_HEIGHT+80;

   if(expired || outside){
    projectile.destroy();
   }
  }

  this.enemies=this.enemies.filter(e=>e.active);
  this.orbs=this.orbs.filter(o=>o.active);
  this.hearts=this.hearts.filter(heart=>heart.active);
  this.projectiles=this.projectiles.filter(p=>p.active);
  traceSectionAt=this.endSubsystemTrace('projectiles',traceSectionAt);

  const aliveMages=this.enemies.filter(e=>e.active && e.type==='mage').length;
  const aliveShields=this.enemies.filter(e=>e.active && e.type==='shield').length;
  const aliveChampions=this.enemies.filter(e=>e.active && e.type==='champion').length;
  const aliveSkeletons=this.enemies.filter(e=>e.active && e.type==='skeleton').length;

  this.hud.setText(
   `Wave: ${this.wave} (${this.waveProfile ? this.waveProfile.name : '---'})\nHP: ${this.player.hp}\nLevel: ${this.level}\nXP: ${this.xp}/${this.getXpRequiredForLevel()}\nKills: ${this.kills}\nSword Lv${this.meleeAttack.level}: ${this.getEffectiveMeleeDamage()} dmg (${this.meleeAttack.damage}+${this.getRegionBalance().meleeDamageBonus}) / ${this.meleeAttack.cooldown}ms / R${this.meleeAttack.radius}\nMage alive: ${aliveMages} / spawned: ${this.mageSpawned}\nShield alive: ${aliveShields} / spawned: ${this.shieldSpawned}\nChampion alive: ${aliveChampions} / spawned: ${this.championSpawned}\nSkeleton alive: ${aliveSkeletons} / spawned: ${this.skeletonSpawned}\nRelics: ${Array.from(this.championRelics).join(', ') || 'none'}\nSoul stacks: ${this.championRelics.has('necromancerSoul') ? this.killStreakBonus : '-'}  Iron Will: ${this.championRelics.has('ironWill') && this.player.hp<=35 ? 'ACTIVE' : '-'}\nRegion: ${this.getWorldProgressName()}  Progress: ${Math.round(this.getZoneTravelProgress()*100)}%\nGates open: ${this.unlockedWorldGates.size}/4  Back seals: ${this.closedWorldGates.size}\nEmpty-screen x4 rush: ${this.emptyScreenRushActive ? 'ACTIVE' : '-'}\nWorld: ${Math.round(this.player.x)},${Math.round(this.player.y)}  View: ${Math.round(this.cameras.main.worldView.width)}x${Math.round(this.cameras.main.worldView.height)}\nProjectiles: ${this.projectiles.length}\nHearts: ${this.hearts.length}\nBuild 1.0.6 SOCKET TEST: separate sword + 8-dir hero + regional progression\nR: restart after death`
  );
 }
}


class HUDScene extends Phaser.Scene {
 constructor(){
  super({key:'HUDScene'});
 }

 init(data){
  this.mainScene=data?.mainScene || null;
  this.movePointerId=null;
  this.moveVector={x:0,y:0};
  this.safe={top:0,right:0,bottom:0,left:0};
  this.lowHealthState='normal';
  this.lowHealthRatio=1;
  this.lowHealthVisualPaused=false;
  this.hpPulseTween=null;
  this.vignettePulseTween=null;
  this.vignetteFadeTween=null;
  this.criticalFlashTween=null;
  this.hpPulseDriver={value:0};

  // Phaser reuses the HUDScene instance after scene.stop()/scene.launch().
  // GameObjects from the previous run are destroyed, but plain JS properties
  // still point at those dead objects. MainScene can request the first wave
  // banner before this HUD's create() has rebuilt the UI, so stale references
  // must never be mistaken for live banner objects.
  this.eventBannerPanel=null;
  this.eventBannerTitle=null;
  this.eventBannerSub=null;
  this.eventBannerTween=null;
  // Do not erase an early request that may have been queued immediately after
  // scene.launch() but before this init() callback runs. SHUTDOWN clears stale
  // requests from the previous session.
  if(this.pendingEventBanner===undefined)this.pendingEventBanner=null;
 }

 create(){
  this.mainScene=this.mainScene || this.scene.get('main');
  this.cameras.main.setScroll(0,0).setOrigin(0,0).setZoom(LK_RENDER_SCALE).setRoundPixels(true);
  this.buildLowHealthOverlay();
  this.buildHeroPanel();
  this.buildWavePanel();
  this.buildChampionPanel();
  this.buildEventBanner();
  this.buildSkillCluster();
  this.buildJoystick();
  this.buildGameOver();
  this.ensureCombatStyleIconTextures();
  this.buildLevelChoiceOverlay();
  this.buildChampionRewardOverlay();
  this.buildMenuButton();
  if(DEV_BUILD)this.buildDevMenuButton();
  this.buildFullscreenButton();
  for(const obj of this.children.list){if(obj?.type==='Text')obj.setResolution?.(LK_TEXT_RESOLUTION);}

  this.scale.on('resize',this.layout,this);
  this.input.on('pointerdown',this.onPointerDown,this);
  this.input.on('pointermove',this.onPointerMove,this);
  this.input.on('pointerup',this.onPointerUp,this);
  this.input.on('pointerupoutside',this.onPointerUp,this);

  this.onMainSceneShutdown=()=>{
   if(this.scene && this.scene.isActive()) this.scene.stop();
  };
  this.onHealthStateChanged=(state,previous,ratio)=>this.setHealthState(state,previous,ratio);
  if(this.mainScene){
   this.mainScene.events.once(Phaser.Scenes.Events.SHUTDOWN,this.onMainSceneShutdown,this);
   this.mainScene.events.on('healthStateChanged',this.onHealthStateChanged,this);
  }
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
   this.scale.off('resize',this.layout,this);
   this.input.off('pointerdown',this.onPointerDown,this);
   this.input.off('pointermove',this.onPointerMove,this);
   this.input.off('pointerup',this.onPointerUp,this);
   this.input.off('pointerupoutside',this.onPointerUp,this);
   if(this.mainScene && this.onMainSceneShutdown){
    this.mainScene.events.off(Phaser.Scenes.Events.SHUTDOWN,this.onMainSceneShutdown,this);
   }
   if(this.mainScene && this.onHealthStateChanged){
    this.mainScene.events.off('healthStateChanged',this.onHealthStateChanged,this);
   }
   this.stopHpPulse(true);
   this.stopVignetteTweens();
   if(this.eventBannerTween){
    try{this.eventBannerTween.stop();}catch{}
   }
   this.eventBannerTween=null;
   this.eventBannerPanel=null;
   this.eventBannerTitle=null;
   this.eventBannerSub=null;
   this.pendingEventBanner=null;
  });
  this.layout();
  if(this.mainScene){
   const state=this.mainScene.getLowHealthState?.() || 'normal';
   const maxHp=Math.max(1,this.mainScene.player?.maxHp||100);
   const ratio=Phaser.Math.Clamp((this.mainScene.player?.hp||0)/maxHp,0,1);
   this.setHealthState(state,'normal',ratio,true);
  }
  if(this.pendingEventBanner){
   const pending=this.pendingEventBanner;
   this.pendingEventBanner=null;
   this.showEventBanner(pending.title,pending.subtitle,pending.color);
  }
 }

 getSafeArea(){
  if(typeof window==='undefined' || typeof getComputedStyle==='undefined') return {top:0,right:0,bottom:0,left:0};
  const s=getComputedStyle(document.documentElement);
  const read=(name)=>Math.max(0,parseFloat(s.getPropertyValue(name))||0);
  return {top:read('--safe-top'),right:read('--safe-right'),bottom:read('--safe-bottom'),left:read('--safe-left')};
 }

 ensureCombatStyleIconTextures(){
  const missing=Object.values(COMBAT_STYLE_ART_SPECS).filter(spec=>!this.textures.exists(spec.key));
  if(!missing.length) return;
  let hadQueue=false;
  for(const spec of missing){
   this.load.image(spec.key,spec.url);
   hadQueue=true;
  }
  if(hadQueue){
   this.load.once('complete',()=>{
    if(this.levelChoiceVisible) this.layoutLevelChoiceOverlay();
   });
   this.load.start();
  }
 }


 addPanelGraphics(depth=10){
  const g=this.add.graphics().setDepth(depth);
  return g;
 }

 buildLowHealthOverlay(){
  this.lowHealthVignette=this.add.graphics().setDepth(8).setScrollFactor(0).setVisible(false).setAlpha(0);
  this.lowHealthFlash=this.add.graphics().setDepth(9).setScrollFactor(0).setVisible(false).setAlpha(0);
 }

 drawVignette(graphics,maxAlpha){
  if(!graphics) return;
  const logical=lkLogicalSceneSize(this),w=logical.width,h=logical.height;
  const depth=Math.max(
   LOW_HEALTH_CONFIG.VIGNETTE_DEPTH_MIN,
   Math.min(LOW_HEALTH_CONFIG.VIGNETTE_DEPTH_MAX,Math.round(Math.min(w,h)*LOW_HEALTH_CONFIG.VIGNETTE_DEPTH_RATIO))
  );
  const bands=LOW_HEALTH_CONFIG.VIGNETTE_BANDS;
  const step=depth/bands;
  graphics.clear();
  for(let i=0;i<bands;i++){
   const t=i/bands;
   const alpha=maxAlpha*Math.pow(1-t,1.55);
   const inset=i*step;
   const thick=Math.ceil(step+1);
   graphics.fillStyle(0x790b0b,alpha);
   graphics.fillRect(inset,inset,Math.max(0,w-inset*2),thick);
   graphics.fillRect(inset,Math.max(inset,h-inset-thick),Math.max(0,w-inset*2),thick);
   graphics.fillRect(inset,inset,thick,Math.max(0,h-inset*2));
   graphics.fillRect(Math.max(inset,w-inset-thick),inset,thick,Math.max(0,h-inset*2));
  }
 }

 stopVignetteTweens(){
  for(const key of ['vignettePulseTween','vignetteFadeTween','criticalFlashTween']){
   if(this[key]){ this[key].stop(); this[key]=null; }
  }
 }

 playCriticalFlash(){
  if(!this.lowHealthFlash) return;
  if(this.criticalFlashTween){ this.criticalFlashTween.stop(); this.criticalFlashTween=null; }
  this.drawVignette(this.lowHealthFlash,LOW_HEALTH_CONFIG.CRITICAL_FLASH_ALPHA);
  this.lowHealthFlash.setVisible(true).setAlpha(0);
  this.criticalFlashTween=this.tweens.add({
   targets:this.lowHealthFlash,
   alpha:{from:0,to:1},
   duration:Math.max(60,Math.round(LOW_HEALTH_CONFIG.CRITICAL_FLASH_MS*0.45)),
   yoyo:true,
   hold:20,
   ease:'Sine.easeOut',
   onComplete:()=>{
    this.lowHealthFlash.setVisible(false).setAlpha(0);
    this.criticalFlashTween=null;
   }
  });
 }

 startVignette(state){
  if(!this.lowHealthVignette) return;
  if(this.vignetteFadeTween){ this.vignetteFadeTween.stop(); this.vignetteFadeTween=null; }
  if(this.vignettePulseTween){ this.vignettePulseTween.stop(); this.vignettePulseTween=null; }
  const deathDoor=state==='deathDoor';
  const maxAlpha=deathDoor ? LOW_HEALTH_CONFIG.DEATH_DOOR_VIGNETTE_ALPHA : LOW_HEALTH_CONFIG.CRITICAL_VIGNETTE_ALPHA;
  const pulseMs=deathDoor ? LOW_HEALTH_CONFIG.DEATH_DOOR_PULSE_MS : LOW_HEALTH_CONFIG.CRITICAL_PULSE_MS;
  this.drawVignette(this.lowHealthVignette,maxAlpha);
  this.lowHealthVignette.setVisible(true).setAlpha(0.78);
  this.vignettePulseTween=this.tweens.add({
   targets:this.lowHealthVignette,
   alpha:{from:0.72,to:1},
   duration:Math.round(pulseMs/2),
   yoyo:true,
   repeat:-1,
   ease:'Sine.easeInOut'
  });
  if(this.lowHealthVisualPaused) this.vignettePulseTween.pause();
 }

 hideVignette(immediate=false){
  if(!this.lowHealthVignette) return;
  if(this.vignettePulseTween){ this.vignettePulseTween.stop(); this.vignettePulseTween=null; }
  if(this.vignetteFadeTween){ this.vignetteFadeTween.stop(); this.vignetteFadeTween=null; }
  if(immediate){
   this.lowHealthVignette.setAlpha(0).setVisible(false);
   return;
  }
  if(!this.lowHealthVignette.visible) return;
  this.vignetteFadeTween=this.tweens.add({
   targets:this.lowHealthVignette,
   alpha:0,
   duration:LOW_HEALTH_CONFIG.RECOVERY_FADE_MS,
   ease:'Sine.easeOut',
   onComplete:()=>{
    this.lowHealthVignette.setVisible(false);
    this.vignetteFadeTween=null;
   }
  });
  if(this.lowHealthVisualPaused) this.vignetteFadeTween.pause();
 }

 getHpPulseSettings(state){
  if(state==='deathDoor') return {duration:LOW_HEALTH_CONFIG.DEATH_DOOR_PULSE_MS,amount:1.045,minAlpha:0.72};
  if(state==='critical') return {duration:LOW_HEALTH_CONFIG.CRITICAL_PULSE_MS,amount:1.035,minAlpha:0.78};
  return {duration:LOW_HEALTH_CONFIG.LOW_PULSE_MS,amount:1.022,minAlpha:0.84};
 }

 startHpPulse(state){
  const settings=this.getHpPulseSettings(state);
  if(this.hpPulseTween){ this.hpPulseTween.stop(); this.hpPulseTween=null; }
  this.hpPulseSettings=settings;
  this.hpPulseDriver.value=0;
  this.hpPulseTween=this.tweens.add({
   targets:this.hpPulseDriver,
   value:1,
   duration:Math.round(settings.duration/2),
   yoyo:true,
   repeat:-1,
   ease:'Sine.easeInOut'
  });
  if(this.lowHealthVisualPaused) this.hpPulseTween.pause();
 }

 stopHpPulse(immediate=false){
  if(this.hpPulseTween){ this.hpPulseTween.stop(); this.hpPulseTween=null; }
  this.hpPulseDriver.value=0;
  this.hpPulseSettings=null;
  if(immediate) this.applyHpPulseFrame();
 }

 applyHpPulseFrame(){
  if(!this.hpFrame || !this.hpFill || !this.hpText) return;
  const p=Phaser.Math.Clamp(this.hpPulseDriver?.value||0,0,1);
  const settings=this.hpPulseSettings;
  const amount=settings ? settings.amount : 1;
  const factor=1+(amount-1)*p;
  const uiHp=this.mainScene?.devTools?.uiEditor?.getTransform?.('hpBar');
  const uiHpSx=uiHp?(uiHp.scale||1)*(uiHp.width||1):1;
  const uiHpSy=uiHp?(uiHp.scale||1)*(uiHp.height||1):1;
  if(this.hpFrameBaseScaleX && this.hpFrameBaseScaleY){
   this.hpFrame.setScale(this.hpFrameBaseScaleX*factor*uiHpSx,this.hpFrameBaseScaleY*factor*uiHpSy);
  }
  this.hpText.setScale(factor*uiHpSx,factor*uiHpSy);
  // IMPORTANT: never reconstruct HP scaleX from 1. displayWidth in update()
  // encodes the current HP ratio; UI editor width scaling is applied there.
  this.hpFill.scaleY=(1+0.10*p)*uiHpSy;
  this.hpShine.scaleY=(1+0.08*p)*uiHpSy;
  const minAlpha=settings ? settings.minAlpha : 1;
  this.hpFill.setAlpha(Phaser.Math.Linear(1,minAlpha,p));
  this.hpFrame.setAlpha(Phaser.Math.Linear(1,Math.max(0.82,minAlpha),p));
  this.hpText.setAlpha(Phaser.Math.Linear(1,Math.max(0.88,minAlpha),p));
 }

 setLowHealthVisualPaused(paused){
  if(this.lowHealthVisualPaused===paused) return;
  this.lowHealthVisualPaused=paused;
  for(const tween of [this.hpPulseTween,this.vignettePulseTween,this.vignetteFadeTween,this.criticalFlashTween]){
   if(!tween) continue;
   if(paused) tween.pause();
   else tween.resume();
  }
 }

 setHealthState(state,previous='normal',ratio=1,force=false){
  const next=['normal','low','critical','deathDoor'].includes(state) ? state : 'normal';
  const prev=this.lowHealthState||'normal';
  if(!force && next===prev){
   this.lowHealthRatio=ratio;
   return;
  }
  this.lowHealthState=next;
  this.lowHealthRatio=ratio;

  if(next==='normal'){
   this.stopHpPulse();
   this.hideVignette(false);
   this.hpFill?.setFillStyle(0xb51f24,1);
  } else {
   this.startHpPulse(next);
   if(next==='low'){
    this.hideVignette(false);
    this.hpFill?.setFillStyle(0xc92b30,1);
   } else {
    this.hpFill?.setFillStyle(next==='deathDoor'?0xf01c24:0xdc242b,1);
    this.startVignette(next);
    const wasCritical=prev==='critical' || prev==='deathDoor' || previous==='critical' || previous==='deathDoor';
    if(!wasCritical) this.playCriticalFlash();
   }
  }
 }

 buildHeroPanel(){
  // Art-driven responsive HUD. The decorative pieces are independent sprites so
  // the panel can grow horizontally without stretching the corners.
  this.heroPanel=this.add.container(0,0).setDepth(20);
  const addHud=(key,depth=20)=>this.add.image(0,0,`hero_hud_${key}`).setDepth(depth);
  // Hybrid HUD shell: simple vector geometry stays razor-clean at any mobile DPR.
  // The ornate raster art is reserved for the medallion and the resource frames,
  // where it can be scaled uniformly instead of being stretched in two axes.
  this.heroPanelShell=this.add.graphics().setDepth(20);
  this.heroPanelFill=null;
  this.heroFrameParts=null;
  this.levelBadge=null;
  this.levelBadgeSimple=this.add.graphics().setDepth(25);
  this.levelCaption=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'9px',fontStyle:'bold',color:'#ad9c78'}).setOrigin(0.5).setDepth(27);
  this.levelText=lkAddText(this,0,0,'1',{fontFamily:'Georgia, serif',fontSize:'28px',fontStyle:'bold',color:'#fff0cf',stroke:'#140d08',strokeThickness:4}).setOrigin(0.5).setDepth(27);

  this.hpFill=this.add.rectangle(0,0,200,18,0xb51f24,1).setOrigin(0,0.5).setDepth(21);
  this.hpShine=this.add.rectangle(0,0,200,4,0xff8a78,0.25).setOrigin(0,0.5).setDepth(22);
  this.hpFrame=addHud('hp_bar_frame',24);
  this.hpText=lkAddText(this,0,0,'100 / 100',{fontFamily:'Arial, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#fff4e8',stroke:'#24100e',strokeThickness:3}).setOrigin(0.5).setDepth(26);
  this.hpLabel=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'1px'}).setVisible(false);

  // Clean mana slots are drawn as simple vector rings.
  this.manaHousing=null;
  this.manaRingsSimple=this.add.graphics().setDepth(23);
  this.manaLabel=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'1px'}).setVisible(false);
  this.manaGems=[];
  for(let i=0;i<3;i++) this.manaGems.push(this.add.image(0,0,'hero_hud_mana_bottle_blue').setDepth(25));

  this.xpFill=this.add.rectangle(0,0,190,5,0xf0bd28,1).setOrigin(0,0.5).setDepth(21);
  this.xpFrame=addHud('xp_bar_frame',24);
  this.xpLabel=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'1px'}).setVisible(false);
 }
 buildWavePanel(){
  this.wavePanel=this.addPanelGraphics(20);
  this.waveTitle=lkAddText(this,0,0,'WAVE 1',{fontFamily:'Arial, sans-serif',fontSize:'22px',fontStyle:'bold',color:'#f7e8c1',stroke:'#17120d',strokeThickness:4}).setOrigin(0.5).setDepth(23);
  this.waveSub=lkAddText(this,0,0,'ASH FIELDS',{fontFamily:'Arial, sans-serif',fontSize:'11px',fontStyle:'bold',color:'#b9b6aa',letterSpacing:1}).setOrigin(0.5).setDepth(23);
 }

 buildChampionPanel(){
  this.championPanel=this.addPanelGraphics(30).setVisible(false);
  this.bossName=lkAddText(this,0,0,'BROKEN SAINT',{fontFamily:'Arial, sans-serif',fontSize:'20px',fontStyle:'bold',color:'#f5d78f',stroke:'#17100a',strokeThickness:4}).setOrigin(0.5).setDepth(33).setVisible(false);
  this.bossHpBack=this.add.rectangle(0,0,500,22,0x130f0d,0.96).setStrokeStyle(2,0x8d7445,1).setDepth(32).setVisible(false);
  this.bossHpFill=this.add.rectangle(0,0,494,14,0xc59b46,1).setOrigin(0,0.5).setDepth(33).setVisible(false);
  this.bossHpText=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#fff2cf',stroke:'#16100a',strokeThickness:3}).setOrigin(0.5).setDepth(34).setVisible(false);
 }

 buildEventBanner(){
  this.eventBannerPanel=this.addPanelGraphics(88).setVisible(false);
  this.eventBannerTitle=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'30px',fontStyle:'bold',color:'#fff06a',stroke:'#101610',strokeThickness:5,align:'center'}).setOrigin(0.5).setDepth(90).setVisible(false);
  this.eventBannerSub=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'15px',color:'#ffffff',stroke:'#101610',strokeThickness:3,align:'center'}).setOrigin(0.5).setDepth(90).setVisible(false);
  this.eventBannerTween=null;
 }

 showEventBanner(title,subtitle,color='#fff06a'){
  // MainScene can request the first wave banner immediately after launching HUDScene.
  // Phaser exposes the HUD scene object before HUDScene.create() has finished, so queue
  // the request until the banner objects actually exist instead of touching undefined UI.
  const bannerReady=Boolean(
   this.eventBannerTitle?.scene && this.eventBannerTitle?.active &&
   this.eventBannerSub?.scene && this.eventBannerSub?.active &&
   this.eventBannerPanel?.scene && this.eventBannerPanel?.active
  );
  if(!bannerReady){
   this.pendingEventBanner={title,subtitle,color};
   return;
  }
  if(this.eventBannerTween){ this.eventBannerTween.stop(); this.eventBannerTween=null; }
  this.eventBannerTitle.setText(title||'').setColor(color).setAlpha(0).setVisible(true);
  this.eventBannerSub.setText(subtitle||'').setAlpha(0).setVisible(Boolean(subtitle));
  this.eventBannerPanel.setAlpha(0).setVisible(true);
  this.layoutEventBanner();
  const targets=[this.eventBannerPanel,this.eventBannerTitle];
  if(subtitle) targets.push(this.eventBannerSub);
  this.eventBannerTween=this.tweens.add({targets,alpha:1,duration:180,hold:850,yoyo:true,onComplete:()=>{
   this.eventBannerPanel.setVisible(false);
   this.eventBannerTitle.setVisible(false);
   this.eventBannerSub.setVisible(false);
   this.eventBannerTween=null;
  }});
 }

 layoutEventBanner(){
  if(!this.eventBannerPanel) return;
  const logical=lkLogicalSceneSize(this);
  // Resize can briefly report a zero-sized logical viewport while Phaser is
  // rebuilding its canvas. Text.setWordWrapWidth rejects values below one
  // character, so keep the banner layout valid through that transient frame.
  const w=Math.max(240,Number(logical.width)||0);
  const h=Math.max(180,Number(logical.height)||0);
  const mobile=Boolean(this.mainScene?.isTouchDevice || h<560 || w<900);
  const cx=w/2,cy=h/2;
  const panelW=Math.max(180,Math.min(mobile?420:620,w-(mobile?28:64)));
  const panelH=mobile?104:126;
  const x=cx-panelW/2,y=cy-panelH/2;
  const radius=mobile?9:12;
  this.eventBannerPanel.clear();
  this.eventBannerPanel.dialogueLocalBounds={left:x,top:y,right:x+panelW+4,bottom:y+panelH+4};
  this.eventBannerPanel.fillStyle(0x070605,0.34); this.eventBannerPanel.fillRoundedRect(x+4,y+4,panelW,panelH,radius);
  this.eventBannerPanel.fillStyle(0x15130f,0.78); this.eventBannerPanel.fillRoundedRect(x,y,panelW,panelH,radius);
  this.eventBannerPanel.lineStyle(mobile?1.5:2,0x8c7447,0.82); this.eventBannerPanel.strokeRoundedRect(x,y,panelW,panelH,radius);
  this.eventBannerTitle.setPosition(cx,cy-(mobile?15:19)).setFontSize(mobile?24:32).setWordWrapWidth(Math.max(80,panelW-28),true);
  this.eventBannerSub.setPosition(cx,cy+(mobile?23:28)).setFontSize(mobile?12:16).setWordWrapWidth(Math.max(80,panelW-34),true);
 }

 makeSkillButton(index,title,kind){
  // Simple Phaser-built button: no decorative frame asset. This keeps the icon
  // readable on small mobile displays and lets the whole button scale cleanly.
  const back=this.add.circle(0,0,42,0x0d0f0d,0.86).setStrokeStyle(2,0xb79a58,0.96).setDepth(25).setInteractive({useHandCursor:true});
  const inner=this.add.circle(0,0,34,0x000000,0.18).setStrokeStyle(1,0xe0c678,0.28).setDepth(26);
  const iconImage=this.add.image(0,0,SKILL_ICON_KEYS[kind]).setDepth(27);
  const iconMaskShape=this.add.graphics().setDepth(27).setVisible(false);
  const iconMask=iconMaskShape.createGeometryMask();
  iconImage.setMask(iconMask);
  const key=lkAddText(this,0,0,String(index),{fontFamily:'Arial, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#ead9ad',backgroundColor:'#18140f',padding:{x:5,y:2}}).setOrigin(0.5).setDepth(29);
  const label=lkAddText(this,0,0,title,{fontFamily:'Arial, sans-serif',fontSize:'11px',fontStyle:'bold',color:'#eee4cf',stroke:'#17120d',strokeThickness:3}).setOrigin(0.5,0).setDepth(29).setVisible(false);
  back.on('pointerdown',()=>{
   if(this.mainScene?.devTools?.uiEditor?.editMode)return;
   this.mainScene?.events.emit('mobile-skill',index);
   this.tweens.add({targets:[back,inner,iconImage],scale:0.94,duration:70,yoyo:true});
  });
  return {back,inner,icon:iconImage,iconMaskShape,key,label,index,kind};
 }

 drawSkillIcon(skill,x,y,buttonRadius){
  const innerRadius=buttonRadius*0.78;
  const iconDiameter=innerRadius*2;
  skill.icon.setPosition(x,y).setDisplaySize(iconDiameter,iconDiameter);
  skill.iconMaskShape.clear();
  skill.iconMaskShape.fillStyle(0xffffff,1);
  skill.iconMaskShape.fillCircle(x,y,innerRadius);
 }
 buildSkillCluster(){
  this.skill1=this.makeSkillButton(1,'QUAKE','quake');
  this.skill2=this.makeSkillButton(2,'LIFT','lift');
  this.skill3=this.makeSkillButton(3,'SPIN','spin');
  this.skills=[this.skill1,this.skill2,this.skill3];
  this.skillCaption=lkAddText(this,0,0,'SKILLS',{fontFamily:'Arial, sans-serif',fontSize:'11px',fontStyle:'bold',color:'#b6aa8e',letterSpacing:2}).setOrigin(0.5).setDepth(24).setVisible(false);
 }

 buildJoystick(){
  this.joyBack=this.add.circle(0,0,66,0x080b09,0.32).setStrokeStyle(3,0xbeb49c,0.35).setDepth(24);
  this.joyRing=this.add.circle(0,0,47,0x171b17,0.20).setStrokeStyle(2,0xd9cfbb,0.22).setDepth(25);
  this.joyKnob=this.add.circle(0,0,29,0xbeb7a6,0.28).setStrokeStyle(2,0xf3ead8,0.35).setDepth(26);
  this.joyHint=lkAddText(this,0,0,'MOVE',{fontFamily:'Arial, sans-serif',fontSize:'10px',fontStyle:'bold',color:'#c8c0ad'}).setOrigin(0.5).setDepth(27).setVisible(false);
 }


 buildLevelChoiceOverlay(){
  this.levelChoiceVisible=false;
  this.levelChoiceLabels=[];
  this.levelChoiceCardData=[];
  this.levelChoiceOptions={};
  this.levelChoiceButtons=[];
  this.levelChoiceShade=this.add.rectangle(0,0,100,100,0x050403,0.58).setOrigin(0).setDepth(108).setVisible(false);
  this.levelChoicePanel=this.addPanelGraphics(109).setVisible(false);
  this.levelChoiceTitle=lkAddText(this,0,0,'LEVEL 2 - CHOOSE UPGRADE',{fontFamily:'Arial, sans-serif',fontSize:'24px',fontStyle:'bold',color:'#f1df97',stroke:'#17110c',strokeThickness:4}).setOrigin(0.5).setDepth(110).setVisible(false);
  this.levelChoiceIntro=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'14px',color:'#d9cfb0',stroke:'#17110c',strokeThickness:3,align:'center',wordWrap:{width:480,useAdvancedWrap:true}}).setOrigin(0.5).setDepth(110).setVisible(false);

  for(let i=0;i<3;i++){
   const card=this.add.rectangle(0,0,100,44,0x243323,0.96).setStrokeStyle(2,0x789561,0.88).setDepth(110).setVisible(false).setInteractive({useHandCursor:true});
   const iconBack=this.add.circle(0,0,32,0x1b1710,0.98).setStrokeStyle(2,0x8f7445,0.92).setDepth(111).setVisible(false);
   const icon=this.add.image(0,0,COMBAT_STYLE_ICON_KEYS.crowdbreak).setDepth(112).setVisible(false);
   const glyph=lkAddText(this,0,0,'✦',{fontFamily:'Georgia, serif',fontSize:'28px',fontStyle:'bold',color:'#f0dfa5',stroke:'#18120d',strokeThickness:4}).setOrigin(0.5).setDepth(112).setVisible(false);
   const name=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'18px',fontStyle:'bold',color:'#f5e9c8',stroke:'#17110c',strokeThickness:3,wordWrap:{width:360,useAdvancedWrap:true},align:'left'}).setOrigin(0,0.5).setDepth(112).setVisible(false);
   const desc=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'13px',color:'#ded2b8',stroke:'#17110c',strokeThickness:2,wordWrap:{width:360,useAdvancedWrap:true},align:'left'}).setOrigin(0,0.5).setDepth(112).setVisible(false);
   const meta=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'10px',fontStyle:'bold',color:'#d7c186',stroke:'#17110c',strokeThickness:2,wordWrap:{width:360,useAdvancedWrap:true},align:'left'}).setOrigin(0,0.5).setDepth(112).setVisible(false);
   const label=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'18px',fontStyle:'bold',color:'#ffffff',stroke:'#14210f',strokeThickness:3,wordWrap:{width:360,useAdvancedWrap:true},align:'center'}).setOrigin(0.5).setDepth(111).setVisible(false).setInteractive({useHandCursor:true});
   card.on('pointerover',()=>{ if(this.levelChoiceVisible) card.setFillStyle(this.levelChoiceOptions?.variant==='combatStyle'?0x26211a:0x30482c,1); });
   card.on('pointerout',()=>card.setFillStyle(this.levelChoiceOptions?.variant==='combatStyle'?0x171612:0x243323,0.96));
   card.on('pointerdown',()=>this.mainScene?.selectLevelChoice?.(i));
   label.on('pointerdown',()=>this.mainScene?.selectLevelChoice?.(i));
   this.levelChoiceButtons.push({card,label,iconBack,icon,glyph,name,desc,meta});
  }
 }

 showLevelChoices(level,labels=[],options={}){
  this.levelChoiceVisible=true;
  this.levelChoiceLabels=labels.slice(0,3);
  this.levelChoiceOptions=options||{};
  this.levelChoiceCardData=Array.isArray(this.levelChoiceOptions.choiceCards) && this.levelChoiceOptions.choiceCards.length
   ?this.levelChoiceOptions.choiceCards.slice(0,3)
   :this.levelChoiceLabels.map(label=>({label}));
  const combatStyle=this.levelChoiceOptions?.variant==='combatStyle';
  this.levelChoiceTitle.setText(this.levelChoiceOptions.title || `LEVEL ${level} - CHOOSE UPGRADE`);
  this.levelChoiceIntro.setText(this.levelChoiceOptions.intro || '').setVisible(Boolean(this.levelChoiceOptions.intro));
  this.levelChoiceShade.setVisible(true);
  this.levelChoicePanel.setVisible(true);
  this.levelChoiceTitle.setVisible(true);
  this.levelChoiceButtons.forEach((entry,i)=>{
   const cardData=this.levelChoiceCardData[i];
   const visible=Boolean(cardData || this.levelChoiceLabels[i]);
   entry.card.setVisible(visible).setFillStyle(combatStyle?0x171612:0x243323,0.96);
   entry.label.setVisible(visible && !combatStyle).setText(this.levelChoiceLabels[i] || cardData?.label || '');
   entry.iconBack.setVisible(visible && combatStyle);
   entry.name.setVisible(visible && combatStyle).setText(cardData?.name || '');
   entry.desc.setVisible(visible && combatStyle).setText(cardData?.desc || '');
   entry.meta.setVisible(visible && combatStyle && Boolean(cardData?.meta)).setText(cardData?.meta || '');
   const hasIcon=visible && combatStyle && Boolean(cardData?.iconKey) && this.textures.exists(cardData.iconKey);
   entry.icon.setVisible(hasIcon);
   if(hasIcon) entry.icon.setTexture(cardData.iconKey);
   entry.glyph.setVisible(visible && combatStyle && !hasIcon).setText(cardData?.glyph || '✦');
  });
  this.layoutLevelChoiceOverlay();
  this.layoutEventBanner();
 }

 hideLevelChoices(){
  this.levelChoiceVisible=false;
  this.levelChoiceLabels=[];
  this.levelChoiceCardData=[];
  this.levelChoiceOptions={};
  this.levelChoiceShade.setVisible(false);
  this.levelChoicePanel.setVisible(false);
  this.levelChoiceTitle.setVisible(false);
  this.levelChoiceIntro.setVisible(false).setText('');
  this.levelChoiceButtons.forEach(({card,label,iconBack,icon,glyph,name,desc,meta})=>{
   card.setVisible(false).setFillStyle(0x243323,0.96);
   label.setVisible(false).setText('');
   iconBack.setVisible(false); icon.setVisible(false); glyph.setVisible(false);
   name.setVisible(false).setText(''); desc.setVisible(false).setText(''); meta.setVisible(false).setText('');
  });
 }

 layoutLevelChoiceOverlay(){
  if(!this.levelChoiceVisible) return;
  const logical=lkLogicalSceneSize(this),w=logical.width,h=logical.height;
  const mobile=Boolean(this.mainScene?.isTouchDevice || h<560 || w<900);
  const combatStyle=this.levelChoiceOptions?.variant==='combatStyle';
  const screenCx=w/2,screenCy=h/2;

  if(combatStyle){
   const compact=Boolean(this.mainScene?.isTouchDevice || h<520 || w<820);
   const veryCompact=h<390;
   const sideMargin=compact?10:34;
   const panelW=Math.min(compact?720:900,w-sideMargin*2);
   const cardH=veryCompact?84:(compact?94:118);
   const gap=veryCompact?6:(compact?8:12);
   const introVisible=Boolean(this.levelChoiceOptions?.intro);
   const headerH=veryCompact?(introVisible?92:62):(compact?(introVisible?110:76):(introVisible?134:92));
   const bottomPad=veryCompact?10:(compact?14:22);
   const panelH=Math.min(h-8,headerH+cardH*3+gap*2+bottomPad);
   const x=screenCx-panelW/2,y=screenCy-panelH/2,r=compact?10:13;
   this.levelChoiceShade.setPosition(0,0).setSize(w,h).setDisplaySize(w,h);
   this.levelChoicePanel.clear();
   this.levelChoicePanel.fillStyle(0x060504,0.55); this.levelChoicePanel.fillRoundedRect(x+5,y+5,panelW,panelH,r);
   this.levelChoicePanel.fillStyle(0x100f0c,0.985); this.levelChoicePanel.fillRoundedRect(x,y,panelW,panelH,r);
   this.levelChoicePanel.lineStyle(compact?2:2.5,0x9b7d47,0.96); this.levelChoicePanel.strokeRoundedRect(x,y,panelW,panelH,r);
   this.levelChoiceTitle.setPosition(screenCx,y+(veryCompact?18:(compact?22:28))).setFontSize(veryCompact?17:(compact?20:26)).setWordWrapWidth(panelW-54,true);
   this.levelChoiceIntro.setPosition(screenCx,y+(veryCompact?56:(compact?58:71))).setFontSize(veryCompact?9.5:(compact?11:14)).setWordWrapWidth(Math.max(140,panelW-54),true);
   const availableCardsH=Math.max(1,panelH-headerH-bottomPad-gap*2);
   const actualCardH=Math.min(cardH,availableCardsH/3);
   const cardW=panelW-(compact?18:30);
   const startY=y+headerH+actualCardH/2;
   this.levelChoiceButtons.forEach((entry,i)=>{
    const visible=Boolean(this.levelChoiceCardData[i] || this.levelChoiceLabels[i]);
    entry.card.setVisible(visible); entry.iconBack.setVisible(visible); entry.name.setVisible(visible); entry.desc.setVisible(visible);
    if(!visible){
     entry.icon.setVisible(false); entry.glyph.setVisible(false); entry.meta.setVisible(false); entry.label.setVisible(false);
     return;
    }
    const yy=startY+i*(actualCardH+gap);
    entry.card.setPosition(screenCx,yy).setSize(cardW,actualCardH).setDisplaySize(cardW,actualCardH).setStrokeStyle(2,0x8f7445,0.86);
    const left=screenCx-cardW/2;
    const iconRadius=veryCompact?28:(compact?34:42);
    const iconX=left+(veryCompact?40:(compact?50:64));
    entry.iconBack.setPosition(iconX,yy).setRadius(iconRadius).setStrokeStyle(2,0x8f7445,0.92);
    const iconSize=iconRadius*2.0;
    entry.icon.setPosition(iconX,yy).setDisplaySize(iconSize,iconSize);
    entry.glyph.setPosition(iconX,yy).setFontSize(veryCompact?25:(compact?30:38));
    const textX=left+(veryCompact?82:(compact?100:126));
    const textRight=screenCx+cardW/2-(compact?10:16);
    const textW=Math.max(120,textRight-textX);
    entry.name.setPosition(textX,yy-actualCardH*0.29).setFontSize(veryCompact?14:(compact?16:19)).setWordWrapWidth(textW,true).setAlign('left');
    entry.desc.setPosition(textX,yy).setFontSize(veryCompact?10:(compact?11.5:13.5)).setWordWrapWidth(textW,true).setAlign('left');
    entry.meta.setPosition(textX,yy+actualCardH*0.32).setFontSize(veryCompact?8.5:(compact?9.5:10.5)).setWordWrapWidth(textW,true).setAlign('left').setVisible(Boolean(this.levelChoiceCardData[i]?.meta));
    entry.label.setVisible(false);
   });
   return;
  }

  const panelW=Math.min(mobile?420:560,w-(mobile?28:64));
  const rowH=mobile?50:56;
  const gap=mobile?12:14;
  const count=Math.max(1,this.levelChoiceLabels.length || 3);
  const headerH=mobile?106:126;
  const panelH=headerH + (count*rowH) + ((count-1)*gap);
  const panelX=screenCx-panelW/2,panelY=screenCy-panelH/2;
  const radius=mobile?10:12;

  this.levelChoiceShade.setPosition(0,0).setSize(w,h).setDisplaySize(w,h);
  this.levelChoicePanel.clear();
  this.levelChoicePanel.fillStyle(0x070605,0.44); this.levelChoicePanel.fillRoundedRect(panelX+5,panelY+5,panelW,panelH,radius);
  this.levelChoicePanel.fillStyle(0x15130f,0.94); this.levelChoicePanel.fillRoundedRect(panelX,panelY,panelW,panelH,radius);
  this.levelChoicePanel.lineStyle(mobile?2:2.5,0x8e7547,0.94); this.levelChoicePanel.strokeRoundedRect(panelX,panelY,panelW,panelH,radius);
  this.levelChoicePanel.lineStyle(1,0xd6bd7b,0.16); this.levelChoicePanel.strokeRoundedRect(panelX+4,panelY+4,panelW-8,panelH-8,Math.max(5,radius-4));

  this.levelChoiceTitle.setPosition(screenCx,panelY+(mobile?24:29)).setFontSize(mobile?18:24);
  this.levelChoiceIntro.setPosition(screenCx,panelY+(mobile?62:70)).setFontSize(mobile?11:14).setWordWrapWidth(Math.max(120,panelW-44),true);

  const cardW=panelW-(mobile?34:48);
  const startY=panelY+(mobile?76:94);
  this.levelChoiceButtons.forEach((entry,i)=>{
   const visible=Boolean(this.levelChoiceLabels[i]);
   entry.card.setVisible(visible);
   entry.label.setVisible(visible);
   entry.iconBack.setVisible(false); entry.icon.setVisible(false); entry.glyph.setVisible(false); entry.name.setVisible(false); entry.desc.setVisible(false); entry.meta.setVisible(false);
   if(!visible) return;
   const yy=startY+i*(rowH+gap);
   entry.card.setPosition(screenCx,yy).setSize(cardW,rowH).setDisplaySize(cardW,rowH).setStrokeStyle(2,0x789561,0.88);
   entry.label.setPosition(screenCx,yy).setFontSize(mobile?15:18).setWordWrapWidth(cardW-28,true).setAlign('center');
  });
 }

 buildDevMenuButton(){
  this.devMenuButton=this.add.circle(0,0,22,0x11100e,0.88)
   .setStrokeStyle(2,0x6f7d65,0.88)
   .setDepth(95)
   .setInteractive({useHandCursor:true});
  this.devMenuLabel=lkAddText(this,0,0,'DEV',{
   fontFamily:'Arial, sans-serif',fontSize:'9px',fontStyle:'bold',
   color:'#bfe8c2',stroke:'#0b120c',strokeThickness:2
  }).setOrigin(0.5).setDepth(96).setInteractive({useHandCursor:true});

  const toggle=(pointer,localX,localY,event)=>{
   event?.stopPropagation?.();
   pointer?.event?.preventDefault?.();
   pointer?.event?.stopPropagation?.();
   if(this.mainScene?.devTools?.uiEditor?.editMode)return;
   this.mainScene?.devTools?.togglePanel?.();
  };
  this.devMenuButton.on('pointerdown',toggle);
  this.devMenuLabel.on('pointerdown',toggle);
  this.setDevMenuOpen(Boolean(this.mainScene?.devTools?.open));
 }

 setDevMenuOpen(open){
  if(!this.devMenuButton||!this.devMenuLabel)return;
  this.devMenuButton
   .setFillStyle(open?0x33452f:0x11100e,open?0.98:0.88)
   .setStrokeStyle(2,open?0xbadf91:0x6f7d65,0.9);
  this.devMenuLabel.setColor(open?'#e4ffc8':'#bfe8c2');
 }

 buildMenuButton(){
  this.menuButton=this.add.circle(0,0,22,0x11100e,0.88).setStrokeStyle(2,0xc4a662,0.82).setDepth(95).setInteractive({useHandCursor:true});
  this.menuIcon=this.add.graphics().setDepth(96);
  const open=()=>{if(this.mainScene?.devTools?.uiEditor?.editMode)return;this.mainScene?.openSessionMenu?.();};
  this.menuButton.on('pointerdown',open);
  this.menuIcon.setInteractive(new Phaser.Geom.Rectangle(-24,-24,48,48),Phaser.Geom.Rectangle.Contains);
  this.menuIcon.on('pointerdown',open);
  this.drawMenuIcon();
 }

 drawMenuIcon(){
  if(!this.menuIcon||!this.menuButton)return;
  const x=this.menuButton.x,y=this.menuButton.y,g=this.menuIcon;
  g.clear();g.lineStyle(2.4,0xf1dfaa,0.95);
  for(const dy of [-7,0,7]){g.beginPath();g.moveTo(x-9,y+dy);g.lineTo(x+9,y+dy);g.strokePath();}
 }

 buildFullscreenButton(){
  this.fullscreenButton=this.add.circle(0,0,22,0x11100e,0.88).setStrokeStyle(2,0xc4a662,0.82).setDepth(95).setInteractive({useHandCursor:true});
  this.fullscreenIcon=this.add.graphics().setDepth(96);
  this.fullscreenButton.on('pointerdown',()=>{if(this.mainScene?.devTools?.uiEditor?.editMode)return;this.toggleFullscreen();});
  this.fullscreenIcon.setInteractive(new Phaser.Geom.Rectangle(-24,-24,48,48),Phaser.Geom.Rectangle.Contains);
  this.fullscreenIcon.on('pointerdown',()=>{if(this.mainScene?.devTools?.uiEditor?.editMode)return;this.toggleFullscreen();});
  if(typeof document!=='undefined'){
   this._fullscreenChangeHandler=()=>{ this.drawFullscreenIcon(); this.time.delayedCall(80,()=>this.layout()); };
   document.addEventListener('fullscreenchange',this._fullscreenChangeHandler);
   this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
    if(this._fullscreenChangeHandler) document.removeEventListener('fullscreenchange',this._fullscreenChangeHandler);
   });
  }
  this.drawFullscreenIcon();
 }

 drawFullscreenIcon(){
  if(!this.fullscreenIcon || !this.fullscreenButton) return;
  const x=this.fullscreenButton.x,y=this.fullscreenButton.y;
  const active=typeof document!=='undefined' && Boolean(document.fullscreenElement);
  const g=this.fullscreenIcon;
  g.clear();
  g.lineStyle(2.2,0xf1dfaa,0.95);
  const r=active?8:10, arm=active?7:6;
  // Four-corner fullscreen / exit-fullscreen glyph.
  if(!active){
   g.beginPath();
   g.moveTo(x-r,y-r+arm); g.lineTo(x-r,y-r); g.lineTo(x-r+arm,y-r);
   g.moveTo(x+r-arm,y-r); g.lineTo(x+r,y-r); g.lineTo(x+r,y-r+arm);
   g.moveTo(x-r,y+r-arm); g.lineTo(x-r,y+r); g.lineTo(x-r+arm,y+r);
   g.moveTo(x+r-arm,y+r); g.lineTo(x+r,y+r); g.lineTo(x+r,y+r-arm);
   g.strokePath();
  } else {
   g.beginPath();
   g.moveTo(x-r-arm,y-r); g.lineTo(x-r,y-r); g.lineTo(x-r,y-r-arm);
   g.moveTo(x+r+arm,y-r); g.lineTo(x+r,y-r); g.lineTo(x+r,y-r-arm);
   g.moveTo(x-r-arm,y+r); g.lineTo(x-r,y+r); g.lineTo(x-r,y+r+arm);
   g.moveTo(x+r+arm,y+r); g.lineTo(x+r,y+r); g.lineTo(x+r,y+r+arm);
   g.strokePath();
  }
 }

 async toggleFullscreen(){
  if(typeof document==='undefined') return;
  try{
   if(document.fullscreenElement){
    if(document.exitFullscreen) await document.exitFullscreen();
   } else {
    const target=document.documentElement;
    const request=target.requestFullscreen || target.webkitRequestFullscreen;
    if(request) await request.call(target);
    if(screen.orientation?.lock){
     try{ await screen.orientation.lock('landscape'); }catch(e){}
    }
   }
  }catch(e){
   console.warn('Fullscreen request was blocked by the browser',e);
  }
  this.time.delayedCall(80,()=>this.layout());
 }

 buildChampionRewardOverlay(){
  this.championRewardVisible=false;
  this.championRewardData=[];
  this.championRewardOptions={};
  this.championRewardShade=this.add.rectangle(0,0,100,100,0x050403,0.72).setOrigin(0).setDepth(118).setVisible(false);
  this.championRewardPanel=this.addPanelGraphics(119).setVisible(false);
  this.championRewardTitle=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'25px',fontStyle:'bold',color:'#f5d78f',stroke:'#111111',strokeThickness:4,align:'center'}).setOrigin(0.5).setDepth(120).setVisible(false);
  this.championRewardSubtitle=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#ddd3bd',align:'center'}).setOrigin(0.5).setDepth(120).setVisible(false);
  this.championRewardStep=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'11px',fontStyle:'bold',color:'#9f8d69'}).setOrigin(0.5).setDepth(120).setVisible(false);
  this.championRewardCards=[];
  for(let i=0;i<3;i++){
   const card=this.add.rectangle(0,0,100,70,0x171612,0.98).setStrokeStyle(2,0x8f7445,0.86).setDepth(120).setVisible(false).setInteractive({useHandCursor:true});
   const iconBack=this.add.circle(0,0,28,0x090908,0.92).setStrokeStyle(1.5,0xb79452,0.74).setDepth(121).setVisible(false);
   const icon=this.add.image(0,0,SKILL_ICON_KEYS.quake).setDepth(122).setVisible(false);
   const glyph=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'30px',fontStyle:'bold',color:'#f0cf79',stroke:'#1b140b',strokeThickness:3}).setOrigin(0.5).setDepth(122).setVisible(false);
   const name=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'16px',fontStyle:'bold',color:'#ffe7a1',stroke:'#16110a',strokeThickness:2}).setOrigin(0,0.5).setDepth(121).setVisible(false);
   const desc=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'11px',color:'#ece5d8',wordWrap:{width:460,useAdvancedWrap:true}}).setOrigin(0,0.5).setDepth(121).setVisible(false);
   const meta=lkAddText(this,0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'9px',fontStyle:'bold',color:'#b8a67e'}).setOrigin(0,0.5).setDepth(121).setVisible(false);
   card.on('pointerover',()=>{ if(this.championRewardVisible) card.setFillStyle(0x25231b,1).setStrokeStyle(2,0xd2ae61,0.98); });
   card.on('pointerout',()=>card.setFillStyle(0x171612,0.98).setStrokeStyle(2,0x8f7445,0.86));
   card.on('pointerdown',()=>this.mainScene?.selectChampionReward?.(i));
   this.championRewardCards.push({card,iconBack,icon,glyph,name,desc,meta});
  }
 }

 showChampionRewards(championName,rewardColor,choices=[],options={}){
  this.championRewardVisible=true;
  this.championRewardData=choices.slice(0,3);
  this.championRewardOptions=options||{};
  const stepTitle=String(options?.stepTitle||'CHAMPION REWARD');
  this.championRewardTitle.setText(`${championName} · ${stepTitle}`).setColor(rewardColor||'#f5d78f');
  this.championRewardSubtitle.setText(String(options?.subtitle||'CHOOSE ONE'));
  const total=Math.max(1,Number(options?.totalSteps)||1);
  const current=Math.min(total,(Number(options?.stepIndex)||0)+1);
  this.championRewardStep.setText(total>1?`${current} / ${total}`:'');
  this.championRewardShade.setVisible(true);
  this.championRewardPanel.setVisible(true);
  this.championRewardTitle.setVisible(true);
  this.championRewardSubtitle.setVisible(true);
  this.championRewardStep.setVisible(total>1);
  this.championRewardCards.forEach((entry,i)=>{
   const c=this.championRewardData[i];
   const visible=Boolean(c);
   entry.card.setVisible(visible).setFillStyle(0x171612,0.98).setStrokeStyle(2,0x8f7445,0.86);
   entry.iconBack.setVisible(visible);
   entry.name.setVisible(visible).setText(c?.name||c?.[0]||'');
   entry.desc.setVisible(visible).setText(c?.desc||c?.[1]||'');
   entry.meta.setVisible(visible && Boolean(c?.meta)).setText(c?.meta||'');
   const hasIcon=visible && Boolean(c?.iconKey) && this.textures.exists(c.iconKey);
   entry.icon.setVisible(hasIcon);
   if(hasIcon) entry.icon.setTexture(c.iconKey);
   entry.glyph.setVisible(visible && !hasIcon).setText(c?.glyph||'✦');
  });
  this.layoutChampionRewardOverlay();
 }

 hideChampionRewards(){
  this.championRewardVisible=false;
  this.championRewardData=[];
  this.championRewardOptions={};
  this.championRewardShade.setVisible(false);
  this.championRewardPanel.setVisible(false);
  this.championRewardTitle.setVisible(false);
  this.championRewardSubtitle.setVisible(false);
  this.championRewardStep.setVisible(false);
  this.championRewardCards.forEach(({card,iconBack,icon,glyph,name,desc,meta})=>{
   card.setVisible(false);iconBack.setVisible(false);icon.setVisible(false);glyph.setVisible(false);name.setVisible(false);desc.setVisible(false);meta.setVisible(false);
  });
 }

 layoutChampionRewardOverlay(){
  if(!this.championRewardVisible) return;
  const logical=lkLogicalSceneSize(this),w=logical.width,h=logical.height;
  const compact=Boolean(this.mainScene?.isTouchDevice || h<520 || w<820);
  const veryCompact=h<390;
  const cx=w/2,cy=h/2;
  const sideMargin=compact?10:34;
  // Reward choices are a major progression decision, so readability wins over
  // leaving unused battlefield space around the modal.
  const panelW=Math.min(compact?720:900,w-sideMargin*2);
  const cardH=veryCompact?82:(compact?90:116);
  const gap=veryCompact?6:(compact?8:12);
  const headerH=veryCompact?62:(compact?72:94);
  const bottomPad=veryCompact?10:(compact?14:24);
  const panelH=Math.min(h-8,headerH+cardH*3+gap*2+bottomPad);
  const x=cx-panelW/2,y=cy-panelH/2,r=compact?10:13;
  this.championRewardShade.setPosition(0,0).setSize(w,h).setDisplaySize(w,h);
  this.championRewardPanel.clear();
  this.championRewardPanel.fillStyle(0x060504,0.55); this.championRewardPanel.fillRoundedRect(x+5,y+5,panelW,panelH,r);
  this.championRewardPanel.fillStyle(0x100f0c,0.985); this.championRewardPanel.fillRoundedRect(x,y,panelW,panelH,r);
  this.championRewardPanel.lineStyle(compact?2:2.5,0x9b7d47,0.96); this.championRewardPanel.strokeRoundedRect(x,y,panelW,panelH,r);
  this.championRewardTitle.setPosition(cx,y+(veryCompact?18:(compact?22:27))).setFontSize(veryCompact?17:(compact?20:27)).setWordWrapWidth(panelW-54,true);
  this.championRewardSubtitle.setPosition(cx,y+(veryCompact?39:(compact?45:56))).setFontSize(veryCompact?9.5:(compact?11:13)).setWordWrapWidth(panelW-64,true);
  this.championRewardStep.setPosition(cx,y+headerH-8).setFontSize(veryCompact?8.5:(compact?9.5:11));

  const availableCardsH=Math.max(1,panelH-headerH-bottomPad-gap*2);
  const actualCardH=Math.min(cardH,availableCardsH/3);
  const cardW=panelW-(compact?18:30);
  const startY=y+headerH+actualCardH/2;
  this.championRewardCards.forEach((entry,i)=>{
   const c=this.championRewardData[i];
   const visible=Boolean(c);
   entry.card.setVisible(visible); entry.iconBack.setVisible(visible); entry.name.setVisible(visible); entry.desc.setVisible(visible);
   if(!visible){entry.icon.setVisible(false);entry.glyph.setVisible(false);entry.meta.setVisible(false);return;}
   const yy=startY+i*(actualCardH+gap);
   entry.card.setPosition(cx,yy).setSize(cardW,actualCardH).setDisplaySize(cardW,actualCardH);
   const left=cx-cardW/2;
   const iconRadius=veryCompact?25:(compact?30:38);
   const iconX=left+(veryCompact?36:(compact?44:56));
   entry.iconBack.setPosition(iconX,yy).setRadius(iconRadius);
   const iconSize=iconRadius*1.66;
   entry.icon.setPosition(iconX,yy).setDisplaySize(iconSize,iconSize);
   entry.glyph.setPosition(iconX,yy).setFontSize(veryCompact?25:(compact?30:38));
   const textX=left+(veryCompact?73:(compact?88:110));
   const textRight=cx+cardW/2-(compact?10:16);
   const textW=Math.max(120,textRight-textX);
   entry.name.setPosition(textX,yy-actualCardH*0.29).setFontSize(veryCompact?14:(compact?16:19));
   entry.desc.setPosition(textX,yy).setFontSize(veryCompact?10:(compact?11.5:13.5)).setWordWrapWidth(textW,true);
   entry.meta.setPosition(textX,yy+actualCardH*0.32).setFontSize(veryCompact?8.5:(compact?9.5:10.5)).setVisible(Boolean(c?.meta));
  });
 }

 buildGameOver(){
  this.gameOverShade=this.add.rectangle(0,0,100,100,0x050403,0.72).setOrigin(0).setDepth(100).setVisible(false);
  this.gameOverFrame=this.add.rectangle(0,0,410,226,0x16120f,0.98).setStrokeStyle(3,0xa98649,1).setDepth(101).setVisible(false);
  this.gameOverTitle=lkAddText(this,0,0,'YOU HAVE FALLEN',{fontFamily:'Arial, sans-serif',fontSize:'28px',fontStyle:'bold',color:'#e6cf9a',stroke:'#1a1009',strokeThickness:4}).setOrigin(0.5).setDepth(102).setVisible(false);
  this.gameOverHint=lkAddText(this,0,0,'Press R to restart',{fontFamily:'Arial, sans-serif',fontSize:'15px',color:'#d1c7b5'}).setOrigin(0.5).setDepth(102).setVisible(false);
  this.restartButton=this.add.rectangle(0,0,180,44,0x2b2418,1).setStrokeStyle(2,0xc3a35d,1).setDepth(102).setVisible(false).setInteractive({useHandCursor:true});
  this.restartLabel=lkAddText(this,0,0,'RESTART',{fontFamily:'Arial, sans-serif',fontSize:'15px',fontStyle:'bold',color:'#f5dfad'}).setOrigin(0.5).setDepth(103).setVisible(false);
  this.retryBossButton=this.add.rectangle(0,0,220,44,0x1b2922,1).setStrokeStyle(2,0x8fc178,1).setDepth(102).setVisible(false).setInteractive({useHandCursor:true});
  this.retryBossLabel=lkAddText(this,0,0,'RETRY BOSS · 2 LEFT',{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#d9f0c8'}).setOrigin(0.5).setDepth(103).setVisible(false);
  this.restartButton.on('pointerdown',()=>this.mainScene?.restartCurrentZone());
  this.retryBossButton.on('pointerdown',()=>{this.mainScene?.retryChampionFight?.();});
 }

 // Canvas-space rectangles for shared world dialogue. Graphics have no useful
 // getBounds(): their drawn geometry is recorded in layout(), before editor
 // transforms. Apply those transforms here just like the renderer does.
 getDialogueAvoidBounds(){
  if(this.sys?.isVisible?.()===false)return [];
  const cam=this.cameras.main;
  const objects=[this.heroPanelShell,this.levelBadgeSimple,this.levelText,
   this.hpFrame,this.hpText,this.xpFrame,this.manaRingsSimple,...(this.manaGems||[]),
   this.wavePanel,this.waveTitle,this.waveSub,this.championPanel,this.bossName,
   this.bossHpBack,this.bossHpText,this.eventBannerPanel,this.eventBannerTitle,this.eventBannerSub,
   ...(this.skills||[]).flatMap(s=>[s.back,s.key,s.label]),
   this.joyBack,this.joyKnob,this.devMenuButton,this.menuButton,this.fullscreenButton];
  const result=[];
  for(const object of objects){
   if(!object?.active)continue;
   let visible=true;
   for(let p=object;p;p=p.parentContainer){
    if(p.visible===false || p.alpha===0){visible=false;break;}
   }
   if(!visible)continue;
   let bounds=object.dialogueLocalBounds;
   if(bounds){
    const matrix=object.getWorldTransformMatrix();
    const points=[[bounds.left,bounds.top],[bounds.right,bounds.top],
     [bounds.left,bounds.bottom],[bounds.right,bounds.bottom]].map(([x,y])=>matrix.transformPoint(x,y));
    bounds={left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),
     top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
   }else bounds=object.getBounds?.();
   if(!bounds || ![bounds.left,bounds.right,bounds.top,bounds.bottom].every(Number.isFinite))continue;
   const zx=cam.zoomX||cam.zoom||1,zy=cam.zoomY||cam.zoom||1;
   const ox=cam.width*(cam.originX??0),oy=cam.height*(cam.originY??0);
   const dx=(cam.x||0)+ox*(1-zx)-(cam.scrollX||0)*(object.scrollFactorX??1)*zx;
   const dy=(cam.y||0)+oy*(1-zy)-(cam.scrollY||0)*(object.scrollFactorY??1)*zy;
   result.push({left:bounds.left*zx+dx,right:bounds.right*zx+dx,
    top:bounds.top*zy+dy,bottom:bounds.bottom*zy+dy});
  }
  return result;
 }

 getDevUiGroups(){
  return {
   heroShell:{label:'Hero panel background',priority:0,objects:[this.heroPanelShell],boundsObjects:[this.levelText,this.hpFrame,this.xpFrame]},
   levelBadge:{label:'Level badge',priority:5,objects:[this.levelBadgeSimple,this.levelText,this.levelCaption],boundsObjects:[this.levelText]},
   hpBar:{label:'HP bar',priority:6,objects:[this.hpFill,this.hpShine,this.hpFrame,this.hpText],boundsObjects:[this.hpFrame]},
   xpBar:{label:'XP bar',priority:6,objects:[this.xpFill,this.xpFrame],boundsObjects:[this.xpFrame]},
   mana:{label:'Mana cluster',priority:6,objects:[this.manaRingsSimple,...this.manaGems],boundsObjects:this.manaGems},
   wavePanel:{label:'Wave panel background',priority:1,objects:[this.wavePanel],boundsObjects:[this.waveTitle,this.waveSub]},
   waveTitle:{label:'Wave title',priority:8,objects:[this.waveTitle],boundsObjects:[this.waveTitle]},
   waveRegion:{label:'Region subtitle',priority:9,objects:[this.waveSub],boundsObjects:[this.waveSub]},
   bossPanel:{label:'Champion panel background',priority:1,objects:[this.championPanel],boundsObjects:[this.bossName,this.bossHpBack]},
   bossName:{label:'Champion name',priority:8,objects:[this.bossName],boundsObjects:[this.bossName]},
   bossHp:{label:'Champion HP bar',priority:8,objects:[this.bossHpBack,this.bossHpFill,this.bossHpText],boundsObjects:[this.bossHpBack]},
   skillQuake:{label:'Skill 1 · Quake',priority:10,objects:[this.skill1.back,this.skill1.inner,this.skill1.icon,this.skill1.iconMaskShape,this.skill1.key,this.skill1.label],boundsObjects:[this.skill1.back]},
   skillLift:{label:'Skill 2 · Lift',priority:10,objects:[this.skill2.back,this.skill2.inner,this.skill2.icon,this.skill2.iconMaskShape,this.skill2.key,this.skill2.label],boundsObjects:[this.skill2.back]},
   skillSpin:{label:'Skill 3 · Spin',priority:10,objects:[this.skill3.back,this.skill3.inner,this.skill3.icon,this.skill3.iconMaskShape,this.skill3.key,this.skill3.label],boundsObjects:[this.skill3.back]},
   joystick:{label:'Movement joystick',priority:7,objects:[this.joyBack,this.joyRing,this.joyKnob,this.joyHint],boundsObjects:[this.joyBack]},
   devMenu:{label:'DEV button',priority:9,objects:[this.devMenuButton,this.devMenuLabel],boundsObjects:[this.devMenuButton]},
   menu:{label:'Menu button',priority:9,objects:[this.menuButton,this.menuIcon],boundsObjects:[this.menuButton]},
   fullscreen:{label:'Fullscreen button',priority:10,objects:[this.fullscreenButton,this.fullscreenIcon],boundsObjects:[this.fullscreenButton]}
  };
 }

 resetDevUiObjectsForLayout(){
  if(!DEV_BUILD)return;
  const seen=new Set();
  for(const group of Object.values(this.getDevUiGroups())){
   for(const o of group.objects||[]){
    if(!o||seen.has(o))continue;seen.add(o);
    const af=Number(o.__devUiAlphaFactor)||1;
    if(af!==1)o.setAlpha(Phaser.Math.Clamp(o.alpha/af,0,1));
    o.__devUiAlphaFactor=1;
    const depthOffset=Number(o.__devUiDepthOffset)||0;
    if(depthOffset)o.setDepth(o.depth-depthOffset);
    o.__devUiDepthOffset=0;
    o.setScale?.(1);
    if(o.type==='Graphics' || o.constructor?.name==='Graphics')o.setPosition?.(0,0);
   }
  }
 }

 getDevUiBoundsForObjects(objects=[]){
  const rects=[];
  for(const o of objects){
   if(!o?.active||!o.getBounds)continue;
   try{const b=o.getBounds();if(Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.width>=0&&b.height>=0)rects.push(b);}catch{}
  }
  if(!rects.length)return null;
  const left=Math.min(...rects.map(r=>r.x)),top=Math.min(...rects.map(r=>r.y));
  const right=Math.max(...rects.map(r=>r.right??r.x+r.width)),bottom=Math.max(...rects.map(r=>r.bottom??r.y+r.height));
  return {left,top,right,bottom,centerX:(left+right)/2,centerY:(top+bottom)/2};
 }

 applyDevUiLayoutOverrides(){
  const editor=this.mainScene?.devTools?.uiEditor;if(!editor)return;
  const groups=this.getDevUiGroups(),bounds={};
  for(const [id,group] of Object.entries(groups))bounds[id]=this.getDevUiBoundsForObjects(group.boundsObjects||group.objects);
  for(const [id,group] of Object.entries(groups)){
   const b=bounds[id];if(!b)continue;
   const t=editor.getTransform(id);
   const sx=(t.scale||1)*(t.width||1),sy=(t.scale||1)*(t.height||1),dx=t.dx||0,dy=t.dy||0;
   for(const o of group.objects||[]){
    if(!o?.active)continue;
    const bx=o.x||0,by=o.y||0,bsx=o.scaleX??1,bsy=o.scaleY??1;
    o.setPosition?.(b.centerX+dx+(bx-b.centerX)*sx,b.centerY+dy+(by-b.centerY)*sy);
    const isText=Boolean(o.setFontSize&&o.style);
    // Width / Height reshape the panel artwork, not the typography. Text follows
    // the group's position, but keeps its aspect ratio and has its own Font Scale.
    if(isText)o.setScale?.(bsx*(t.scale||1),bsy*(t.scale||1));
    else o.setScale?.(bsx*sx,bsy*sy);
    if(isText){
     const fs=parseFloat(o.style?.fontSize)||0;if(fs>0)o.setFontSize(Math.max(1,fs*(t.fontScale||1)));
    }
    const alphaFactor=Phaser.Math.Clamp(t.alpha??1,0.05,1);
    o.setAlpha?.(Phaser.Math.Clamp(o.alpha*alphaFactor,0,1));o.__devUiAlphaFactor=alphaFactor;
    const d=Math.round(t.depth||0);if(d){o.setDepth?.(o.depth+d);o.__devUiDepthOffset=d;}
   }
  }
  if(this.joyBack){this.joyCenter={x:this.joyBack.x,y:this.joyBack.y,r:Math.max(1,this.joyBack.displayWidth*0.5)};}
 }


 resetDevUiRuntimeAlpha(){
  if(!DEV_BUILD)return;
  const seen=new Set();
  for(const group of Object.values(this.getDevUiGroups()))for(const o of group.objects||[]){
   if(!o||seen.has(o))continue;seen.add(o);
   const af=Number(o.__devUiAlphaFactor)||1;if(af!==1)o.setAlpha?.(Phaser.Math.Clamp(o.alpha/af,0,1));o.__devUiAlphaFactor=1;
  }
 }
 applyDevUiRuntimeAlpha(){
  const editor=this.mainScene?.devTools?.uiEditor;if(!editor)return;
  for(const [id,group] of Object.entries(this.getDevUiGroups())){
   const af=Phaser.Math.Clamp(editor.getTransform(id).alpha??1,0.05,1);
   for(const o of group.objects||[]){if(!o?.active)continue;o.setAlpha?.(Phaser.Math.Clamp(o.alpha*af,0,1));o.__devUiAlphaFactor=af;}
  }
 }

 layout(){
  this.resetDevUiObjectsForLayout();
  this.cameras.main.setOrigin(0,0).setZoom(LK_RENDER_SCALE);
  const logical=lkLogicalSceneSize(this),w=logical.width,h=logical.height;
  this.safe=this.getSafeArea();
  if(this.lowHealthState==='critical' || this.lowHealthState==='deathDoor'){
   const maxAlpha=this.lowHealthState==='deathDoor' ? LOW_HEALTH_CONFIG.DEATH_DOOR_VIGNETTE_ALPHA : LOW_HEALTH_CONFIG.CRITICAL_VIGNETTE_ALPHA;
   this.drawVignette(this.lowHealthVignette,maxAlpha);
  }
  if(this.lowHealthFlash?.visible) this.drawVignette(this.lowHealthFlash,LOW_HEALTH_CONFIG.CRITICAL_FLASH_ALPHA);
  const mobile=Boolean(this.mainScene?.isTouchDevice || h<520 || w<900);
  const left=this.safe.left+(mobile?10:22);
  const top=this.safe.top+(mobile?8:20);
  const right=w-this.safe.right-(mobile?10:24);
  const bottom=h-this.safe.bottom-(mobile?8:22);
  const screenCx=w/2;

  // Keep fullscreen in the unobstructed upper-right utility corner.
  if(this.fullscreenButton){
   const fsR=mobile?19:22;
   const fsX=right-fsR;
   const fsY=top+fsR;
   this.fullscreenButton.setPosition(fsX,fsY).setRadius(fsR).setStrokeStyle(mobile?1.5:2,0xc4a662,0.82);
   this.drawFullscreenIcon();
   if(this.menuButton){
    const gap=mobile?9:11;
    const menuX=fsX-fsR*2-gap;
    this.menuButton.setPosition(menuX,fsY).setRadius(fsR).setStrokeStyle(mobile?1.5:2,0xc4a662,0.82);
    this.drawMenuIcon();
    if(this.devMenuButton){
     const devX=menuX-fsR*2-gap;
     this.devMenuButton.setPosition(devX,fsY).setRadius(fsR);
     this.devMenuLabel.setPosition(devX,fsY).setFontSize(mobile?8:9);
     this.setDevMenuOpen(Boolean(this.mainScene?.devTools?.open));
    }
   }
  }

  // Build 1.3.6: clean stacked hero HUD. The information hierarchy is fixed:
  // Level + HP -> vertical gap -> XP -> vertical gap -> Mana.
  // Only HP/XP use decorative raster frames; level/mana geometry is vector-clean.
  const basePanelW=430,basePanelH=194;
  const desiredW=mobile ? Phaser.Math.Clamp(w*0.34,218,292) : Math.min(430,Math.max(300,w*0.42));
  const rawScale=desiredW/basePanelW;
  const uiScale=Phaser.Math.Clamp(Math.round(rawScale*8)/8,mobile?0.50:0.625,1);
  const panelW=Math.round(basePanelW*uiScale),panelH=Math.round(basePanelH*uiScale);
  const px=Math.round(left),py=Math.round(top);

  const levelD=Math.round(104*uiScale);
  const levelR=levelD*0.5;
  const topRowY=Math.round(py+levelR+Math.max(3,5*uiScale));
  const badgeX=Math.round(px+levelR),badgeY=topRowY;
  const contentLeft=Math.round(px+levelD*0.92);
  const contentRight=Math.round(px+panelW-Math.max(8,14*uiScale));
  const contentW=Math.max(Math.round(120*uiScale),contentRight-contentLeft);

  // Compute the restrained backplate geometry first, but draw it after HP/XP
  // are positioned so the shell height can tightly fit that compact stack.
  this.heroPanelShell.clear();
  const bodyX=Math.round(px+levelD*0.40),bodyY=Math.round(py+3*uiScale);
  const bodyW=Math.round(panelW-levelD*0.36);
  const shellRadius=Math.max(5,Math.round(8*uiScale));

  // Simple level badge: same dark centre, one clean gold ring, no ornamental spikes.
  this.levelBadgeSimple.clear();
  this.levelBadgeSimple.dialogueLocalBounds={left:badgeX-levelR,top:badgeY-levelR,right:badgeX+levelR,bottom:badgeY+levelR};
  this.levelBadgeSimple.fillStyle(0x171512,0.98);
  this.levelBadgeSimple.fillCircle(badgeX,badgeY,levelR-2);
  this.levelBadgeSimple.lineStyle(Math.max(2,Math.round(4*uiScale)),0xd39a35,1);
  this.levelBadgeSimple.strokeCircle(badgeX,badgeY,levelR-2);
  this.levelBadgeSimple.lineStyle(Math.max(1,Math.round(1*uiScale)),0xffd47a,0.62);
  this.levelBadgeSimple.strokeCircle(badgeX,badgeY,Math.max(4,levelR-Math.max(5,Math.round(7*uiScale))));
  this.levelCaption.setVisible(false);
  this.levelText.setPosition(badgeX,badgeY).setFontSize(Math.max(15,Math.round(31*uiScale)));

  // HP stays the primary visual element on the top row.
  const hpSrc=this.hpFrame.frame;
  const hpAspect=(hpSrc?.realWidth||351)/(hpSrc?.realHeight||119);
  const hpW=Math.round(contentW);
  // Build 1.3.13 baseline: approved slimmer HP frame.
  const hpHeightScale=0.68;
  const hpH=Math.max(16,Math.round((hpW/hpAspect)*hpHeightScale));
  const hpY=topRowY;
  this.hpFrame.setPosition(Math.round(contentLeft+hpW/2),hpY).setDisplaySize(hpW,hpH);
  this.hpFrameBaseScaleX=this.hpFrame.scaleX;
  this.hpFrameBaseScaleY=this.hpFrame.scaleY;
  const hpInnerX=Math.round(contentLeft+hpW*0.115),hpInnerW=Math.round(hpW*0.77),hpInnerH=Math.max(3,Math.round(hpH*0.29));
  this.hpFill.setPosition(hpInnerX,hpY).setSize(hpInnerW,hpInnerH).setDisplaySize(hpInnerW,hpInnerH);
  this.hpShine.setPosition(hpInnerX,Math.round(hpY-hpInnerH*0.23)).setSize(hpInnerW,Math.max(1,Math.round(hpInnerH*0.22))).setDisplaySize(hpInnerW,Math.max(1,Math.round(hpInnerH*0.22)));
  this.hpText.setPosition(Math.round(contentLeft+hpW/2),hpY).setFontSize(Math.max(7,Math.round(12*uiScale)));

  // XP is deliberately thinner and kept close to HP with only a small gap.
  const xpSrc=this.xpFrame.frame;
  const xpAspect=(xpSrc?.realWidth||313)/(xpSrc?.realHeight||100);
  const xpW=Math.round(contentW*0.95);
  const naturalXpH=Math.round(xpW/xpAspect);
  const xpH=Math.max(9,Math.round(naturalXpH*0.62));
  const hpBottom=hpY+hpH*0.5;
  const hpXpGap=Math.max(2,Math.round(3*uiScale));
  // Visual correction: the decorative XP frame reads lower than its sprite bounds.
  // Lift the whole XP element (frame + fill) toward HP, matching the approved mockup.
  const xpVisualLift=Math.max(12,Math.round(20*uiScale));
  const xpY=Math.round(hpBottom+hpXpGap+xpH*0.5-xpVisualLift);
  const xpX=Math.round(contentLeft+xpW/2);
  this.xpFrame.setPosition(xpX,xpY).setDisplaySize(xpW,xpH);
  const xpInnerX=Math.round(contentLeft+xpW*0.105),xpInnerW=Math.round(xpW*0.79),xpInnerH=Math.max(2,Math.round(xpH*0.13));
  // Build 1.3.13 baseline: optical centering inside the ornate XP opening.
  const xpFillY=Math.round(xpY+Math.max(1,Math.round(3*uiScale)));
  this.xpFill.setPosition(xpInnerX,xpFillY).setSize(xpInnerW,xpInnerH).setDisplaySize(xpInnerW,xpInnerH);

  // One restrained dark backplate; 50% opacity and fitted tightly around HP + XP.
  const xpBottom=Math.round(xpY+xpH*0.5);
  const shellBottomPad=Math.max(4,Math.round(7*uiScale));
  const bodyH=Math.round((xpBottom+shellBottomPad)-bodyY);
  this.heroPanelShell.dialogueLocalBounds={left:bodyX,top:bodyY,right:bodyX+bodyW,bottom:bodyY+bodyH};
  this.heroPanelShell.fillStyle(0x080706,0.50);
  this.heroPanelShell.fillRoundedRect(bodyX,bodyY,bodyW,bodyH,shellRadius);
  this.heroPanelShell.lineStyle(Math.max(1,Math.round(1.5*uiScale)),0x8f743b,0.58);
  this.heroPanelShell.strokeRoundedRect(bodyX,bodyY,bodyW,bodyH,shellRadius);

  // Mana: three independent simple gold rings, centered beneath the backplate.
  this.manaRingsSimple.clear();
  const manaPanelGap=Math.max(6,Math.round(8*uiScale));
  const manaR=Math.max(13,Math.round(25*uiScale));
  const manaY=Math.round(bodyY+bodyH+manaPanelGap+manaR);
  const ringGap=Math.max(8,Math.round(12*uiScale));
  const clusterW=manaR*6+ringGap*2;
  const clusterCx=Math.round(bodyX+bodyW*0.5);
  const manaCenters=[clusterCx-(manaR*2+ringGap),clusterCx,clusterCx+(manaR*2+ringGap)];
  this.manaRingsSimple.dialogueLocalBounds={left:manaCenters[0]-manaR,top:manaY-manaR,right:manaCenters[2]+manaR,bottom:manaY+manaR};
  manaCenters.forEach(cx=>{
   this.manaRingsSimple.fillStyle(0x171512,0.96);
   this.manaRingsSimple.fillCircle(cx,manaY,manaR-1);
   this.manaRingsSimple.lineStyle(Math.max(2,Math.round(3*uiScale)),0xd39a35,1);
   this.manaRingsSimple.strokeCircle(cx,manaY,manaR-1);
   this.manaRingsSimple.lineStyle(1,0xffd47a,0.50);
   this.manaRingsSimple.strokeCircle(cx,manaY,Math.max(5,manaR-Math.max(4,Math.round(5*uiScale))));
  });
  const bottleSize=Math.max(12,Math.round(manaR*1.05));
  const opticalLift=Math.max(0,Math.round(manaR*0.04));
  this.manaGems.forEach((gem,i)=>gem.setPosition(manaCenters[i],manaY-opticalLift).setDisplaySize(bottleSize,bottleSize));

  this.heroHpMaxWidth=hpInnerW;
  this.heroXpMaxWidth=xpInnerW;

  // Top-center status slot: WAVE normally, CHAMPION replaces it during boss events.
  const waveW=mobile?150:220,waveH=mobile?48:64;
  const cx=screenCx;
  const waveX=cx-waveW/2,waveY=top;
  this.wavePanel.clear();
  this.wavePanel.dialogueLocalBounds={left:waveX,top:waveY,right:waveX+waveW,bottom:waveY+waveH};
  this.wavePanel.fillStyle(0x15130f,0.90); this.wavePanel.fillRoundedRect(waveX,waveY,waveW,waveH,mobile?7:9);
  this.wavePanel.lineStyle(mobile?1.5:2,0x7c6842,0.9); this.wavePanel.strokeRoundedRect(waveX,waveY,waveW,waveH,mobile?7:9);
  this.waveTitle.setPosition(cx,waveY+(mobile?15:20)).setFontSize(mobile?14:21);
  this.waveSub.setPosition(cx,waveY+(mobile?34:44)).setFontSize(mobile?8:10);

  const bossW=Math.min(mobile?260:360,w-this.safe.left-this.safe.right-(mobile?24:40));
  const bossH=waveH;
  const bossX=screenCx-bossW/2,bossY=waveY;
  this.championPanel.clear();
  this.championPanel.dialogueLocalBounds={left:bossX,top:bossY,right:bossX+bossW,bottom:bossY+bossH};
  this.championPanel.fillStyle(0x15110d,0.94); this.championPanel.fillRoundedRect(bossX,bossY,bossW,bossH,mobile?7:9);
  this.championPanel.lineStyle(mobile?1.5:2,0xa28346,0.95); this.championPanel.strokeRoundedRect(bossX,bossY,bossW,bossH,mobile?7:9);
  this.bossName.setPosition(screenCx,bossY+(mobile?13:17)).setFontSize(mobile?12:17);
  const bossHpY=bossY+(mobile?34:44);
  this.bossHpBack.setPosition(screenCx,bossHpY).setSize(bossW-(mobile?24:30),mobile?14:17).setDisplaySize(bossW-(mobile?24:30),mobile?14:17);
  this.bossHpFill.setPosition(screenCx-(bossW-(mobile?24:30))/2+(mobile?3:4),bossHpY).setSize(bossW-(mobile?30:38),mobile?8:10).setDisplaySize(bossW-(mobile?30:38),mobile?8:10);
  this.bossHpText.setPosition(screenCx,bossHpY).setFontSize(mobile?8:10);

  // Compact skill cluster. Labels/caption are intentionally hidden in 1.1.1.
  const skillR=mobile?31:39;
  const gap=mobile?8:14;
  const sx3=right-skillR,sy3=bottom-skillR;
  const sx1=sx3-(skillR*2+gap),sy1=sy3;
  const sx2=(sx1+sx3)/2,sy2=sy3-(skillR*1.48+gap);
  const pos=[[sx1,sy1],[sx2,sy2],[sx3,sy3]];
  this.skills.forEach((skill,i)=>{
   const [x,y]=pos[i];
   skill.back.setPosition(x,y).setRadius(skillR).setStrokeStyle(mobile?2:2.5,0xb79a58,0.96);
   skill.inner.setPosition(x,y).setRadius(skillR-(mobile?5:6)).setStrokeStyle(1,0xe0c678,0.28);
   skill.key.setPosition(x-skillR*0.70,y-skillR*0.70).setFontSize(mobile?9:11);
   skill.label.setVisible(false);
   this.drawSkillIcon(skill,x,y,skillR);
  });
  this.skillCaption.setVisible(false);

  // Slightly larger fixed joystick; the whole left half of the screen acts as its touch zone.
  const joyR=mobile?54:62;
  const jx=left+joyR+(mobile?2:6),jy=bottom-joyR-(mobile?2:4);
  this.joyBack.setPosition(jx,jy).setRadius(joyR).setStrokeStyle(mobile?2:3,0xbeb49c,0.35);
  this.joyRing.setPosition(jx,jy).setRadius(joyR*0.72).setStrokeStyle(mobile?1.5:2,0xd9cfbb,0.22);
  if(this.movePointerId===null) this.joyKnob.setPosition(jx,jy);
  this.joyKnob.setRadius(joyR*0.40);
  this.joyHint.setPosition(jx,jy).setVisible(false);
  this.joyCenter={x:jx,y:jy,r:joyR};

  const showTouch=Boolean(this.mainScene?.isTouchDevice);
  [this.joyBack,this.joyRing,this.joyKnob].forEach(o=>o.setVisible(showTouch));
  this.joyHint.setVisible(false);

  this.gameOverShade.setPosition(0,0).setSize(w,h).setDisplaySize(w,h);
  const goW=Math.min(mobile?330:430,w-24);
  const goH=mobile?190:226;
  this.gameOverFrame.setPosition(screenCx,h/2).setSize(goW,goH).setDisplaySize(goW,goH);
  this.gameOverTitle.setPosition(screenCx,h/2-(mobile?58:70)).setFontSize(mobile?20:26);
  this.gameOverHint.setPosition(screenCx,h/2-(mobile?28:34)).setFontSize(mobile?11:13);
  this.restartButton.setPosition(screenCx,h/2+(mobile?16:22)).setSize(mobile?150:180,mobile?38:44).setDisplaySize(mobile?150:180,mobile?38:44).setStrokeStyle(2,0xc3a35d,1);
  this.restartLabel.setPosition(screenCx,h/2+(mobile?16:22)).setFontSize(mobile?12:14);
  this.retryBossButton.setPosition(screenCx,h/2+(mobile?64:76)).setSize(mobile?184:220,mobile?38:44).setDisplaySize(mobile?184:220,mobile?38:44).setStrokeStyle(2,0x8fc178,1);
  this.retryBossLabel.setPosition(screenCx,h/2+(mobile?64:76)).setFontSize(mobile?11:14);

  this.layoutLevelChoiceOverlay();
  this.layoutEventBanner();
  this.layoutChampionRewardOverlay();
  this.applyDevUiLayoutOverrides();
 }

 onPointerDown(pointer,gameObjects=[]){
  if(this.mainScene?.devTools?.uiEditor?.editMode){this.mainScene.devTools.uiEditor.handlePointerDown(pointer);return;}
  if(!this.mainScene?.isTouchDevice || !this.joyCenter || this.levelChoiceVisible || this.championRewardVisible || this.mainScene?.gameOver) return;
  const logical=lkLogicalSceneSize(this),w=logical.width;
  const pp=lkUiPointer(this,pointer);

  // Permanent mobile input contract:
  //   LEFT VISUAL HALF  = movement only, forever.
  //   RIGHT VISUAL HALF = world interaction / dialogue advance, unless the
  //                       finger hit an actual HUD control.
  // Classification is delegated to MainScene and uses DOM/canvas coordinates,
  // deliberately bypassing HiDPI/HUD camera transforms.
  if(this.mainScene?.isMobileInteractionPointerAllowed?.(pointer)){
   const hitHudControl=Array.isArray(gameObjects) && gameObjects.some(obj=>Boolean(obj?.input && obj.input.enabled!==false));
   if(!hitHudControl){
    this.mainScene?.emitMobileWorldInteraction?.(pointer);
   }
   return;
  }

  if(this.movePointerId!==null) return;
  this.movePointerId=pointer.id;
  this.joyTouchOrigin={x:pp.x,y:pp.y};
  this.mainScene.mobileMoveX=0;
  this.mainScene.mobileMoveY=0;
  this.joyKnob.setPosition(this.joyCenter.x,this.joyCenter.y);
 }

 onPointerMove(pointer){
  if(this.mainScene?.devTools?.uiEditor?.editMode){this.mainScene.devTools.uiEditor.handlePointerMove(pointer);return;}
  if(pointer.id===this.movePointerId) this.updateJoystick(pointer);
 }

 onPointerUp(pointer){
  if(this.mainScene?.devTools?.uiEditor?.editMode){this.mainScene.devTools.uiEditor.handlePointerUp(pointer);return;}
  if(pointer.id!==this.movePointerId) return;
  this.movePointerId=null;
  this.joyTouchOrigin=null;
  if(this.mainScene){this.mainScene.mobileMoveX=0;this.mainScene.mobileMoveY=0;}
  if(this.joyCenter) this.joyKnob.setPosition(this.joyCenter.x,this.joyCenter.y);
 }

 updateJoystick(pointer){
  if(!this.joyCenter || !this.mainScene || !this.joyTouchOrigin) return;
  // Movement is relative to where the finger first touched the left half.
  // The visible joystick stays fixed in the corner and mirrors that gesture.
  const pp=lkUiPointer(this,pointer);
  const dx=pp.x-this.joyTouchOrigin.x,dy=pp.y-this.joyTouchOrigin.y;
  const len=Math.max(0.001,Math.hypot(dx,dy));
  const max=this.joyCenter.r*0.62;
  const k=Math.min(1,max/len);
  this.joyKnob.setPosition(this.joyCenter.x+dx*k,this.joyCenter.y+dy*k);
  const deadzone=Math.max(8,this.joyCenter.r*0.13);
  if(len<deadzone){this.mainScene.mobileMoveX=0;this.mainScene.mobileMoveY=0;}
  else {this.mainScene.mobileMoveX=dx/len;this.mainScene.mobileMoveY=dy/len;}
 }

 update(){
  this.resetDevUiRuntimeAlpha();
  const m=this.mainScene;
  if(!m || !m.player) return;
  const traceHudAt=m.devTools?.isPerformanceTraceActive?.()?performance.now():0;
  this.setLowHealthVisualPaused(Boolean(m.gameplayPaused || m.gameOver));
  const maxHp=Math.max(1,m.player.maxHp||100);
  const hp=Math.max(0,Math.min(maxHp,m.player.hp||0));
  const hpRatio=hp/maxHp;
  const fullHpWidth=this.heroHpMaxWidth || this.hpFill.width || 1;
  const hpUi=this.mainScene?.devTools?.uiEditor?.getTransform?.('hpBar');
  const hpUiSx=hpUi?(hpUi.scale||1)*(hpUi.width||1):1;
  this.hpFill.displayWidth=Math.max(0.1,fullHpWidth*hpRatio*hpUiSx);
  this.hpShine.displayWidth=Math.max(0.1,fullHpWidth*hpRatio*hpUiSx);
  this.hpText.setText(`${Math.ceil(hp)} / ${Math.ceil(maxHp)}`);
  this.applyHpPulseFrame();
  this.levelText.setText(String(m.level||1));
  const xpRequired=typeof m.getXpRequiredForLevel==='function' ? m.getXpRequiredForLevel() : BALANCE.XP_BASE;
  const xpRatio=Phaser.Math.Clamp((m.xp||0)/Math.max(1,xpRequired),0,1);
  const xpUi=this.mainScene?.devTools?.uiEditor?.getTransform?.('xpBar');
  const xpUiSx=xpUi?(xpUi.scale||1)*(xpUi.width||1):1;
  this.xpFill.displayWidth=Math.max(0.1,(this.heroXpMaxWidth||this.xpFill.width||1)*xpRatio*xpUiSx);

  this.waveTitle.setText(`WAVE ${m.getGlobalWave?.()||m.wave||1}`);
  this.waveSub.setText(m.getWorldProgressName ? m.getWorldProgressName() : 'ASH FIELDS');

  const mana=Phaser.Math.Clamp(m.mana??0,0,m.maxMana??3);
  this.manaGems.forEach((gem,i)=>{
   const fill=Phaser.Math.Clamp(mana-i,0,1);
   gem.setAlpha(0.22+fill*0.78);
   if(fill>0.01) gem.clearTint();
   else gem.setTint(0x4a5560);
  });
  this.skills.forEach(skill=>{
   const cost=typeof m.getSkillManaCost==='function'?m.getSkillManaCost(skill.index):1;
   const canCast=mana+1e-6>=cost && !m.gameOver && !m.championRewardOpen && !m.brokenSaintDefeatSequenceActive;
   skill.back.setAlpha(canCast?1:0.62);
   skill.inner.setAlpha(canCast?1:0.50);
   skill.icon.setAlpha(canCast?1:0.46);
  });

  const champ=m.activeChampion && m.activeChampion.active ? m.activeChampion : null;
  const bossVisible=Boolean(champ && !champ.storyDormant);
  // Champion takes over the exact top-center status slot; never stack WAVE + boss UI.
  [this.wavePanel,this.waveTitle,this.waveSub].forEach(o=>o.setVisible(!bossVisible));
  [this.championPanel,this.bossName,this.bossHpBack,this.bossHpFill,this.bossHpText].forEach(o=>o.setVisible(bossVisible));
  if(champ){
   const ratio=Phaser.Math.Clamp(champ.hp/champ.maxHp,0,1);
   const maxW=this.bossHpBack.displayWidth-8;
   this.bossHpFill.displayWidth=Math.max(0.1,maxW*ratio);
   this.bossName.setText(champ.championName || 'CHAMPION');
   this.bossHpText.setText(`${Math.ceil(Math.max(0,champ.hp))} / ${champ.maxHp}`);
  }

  const over=Boolean(m.gameOver && m.gameOverUiReady);
  const retryAvailable=over&&Boolean(m.hasChampionRetryAvailable?.());
  [this.gameOverShade,this.gameOverFrame,this.gameOverTitle,this.gameOverHint,this.restartButton,this.restartLabel].forEach(o=>o.setVisible(over));
  [this.retryBossButton,this.retryBossLabel].forEach(o=>o.setVisible(retryAvailable));
  if(retryAvailable)this.retryBossLabel.setText(`RETRY BOSS · ${m.championRetryCheckpoint.retriesRemaining} LEFT`);
  if(over && m.isTouchDevice) this.gameOverHint.setText('Tap restart to continue');
  else this.gameOverHint.setText('Press R or click restart');
  this.applyDevUiRuntimeAlpha();
  if(traceHudAt)m.devTools?.recordSubsystemTime?.('HUD',performance.now()-traceHudAt);
 }
}

const LK_INITIAL_CSS=lkCssViewport();
try{
 const mode=lkReadQualityMode();
 const savedManual=Number(localStorage.getItem(LK_RENDER_SCALE_STORAGE_KEY));
 const savedAuto=Number(localStorage.getItem(LK_QUALITY_PROFILE_STORAGE_KEY));
 const candidate=mode==='auto'&&Number.isFinite(savedAuto)?savedAuto:savedManual;
 if(Number.isFinite(candidate)&&candidate>=1)LK_RENDER_SCALE=Phaser.Math.Clamp(candidate,1,LK_RENDER_SCALE_MAX);
}catch{}

const game=new Phaser.Game({
 type:Phaser.AUTO,
 parent:'game',
 backgroundColor:'#0b160d',
 antialias:true,
 roundPixels:true,
 scale:{
  mode:Phaser.Scale.FIT,
  autoCenter:Phaser.Scale.CENTER_BOTH,
  width:Math.max(1,Math.round(LK_INITIAL_CSS.width*LK_RENDER_SCALE)),
  height:Math.max(1,Math.round(LK_INITIAL_CSS.height*LK_RENDER_SCALE))
 },
 physics:{default:'arcade',arcade:{debug:false}},
 // Phaser normally spends 120 frames in a post-panic timing cooldown after a
 // tab switch / browser resume. On ~30 FPS hardware that can feel like several
 // seconds of degraded responsiveness. Keep smoothing, but recover quickly.
 fps:{panicMax:10,smoothStep:true,deltaHistory:10},
 scene:[BootScene,PreloadScene,GameMenuScene,CinematicScene,MainScene,HUDScene]
});

let lkResizeRaf=0;
function lkSyncViewport(){
 if(lkResizeRaf)return;
 lkResizeRaf=requestAnimationFrame(()=>{lkResizeRaf=0;lkApplyRenderScale(game,LK_RENDER_SCALE,{remember:false});});
}
if(typeof window!=='undefined'){
 window.addEventListener('resize',lkSyncViewport,{passive:true});
 window.visualViewport?.addEventListener?.('resize',lkSyncViewport,{passive:true});
 const lkRecordResumeRecovery=(reason)=>{
  if(typeof document!=='undefined'&&document.hidden)return;
  requestAnimationFrame(()=>{
   const scene=game.scene?.getScene?.('main');
   scene?.devTools?.recordTraceEvent?.('browser_resume_recovery',{
    reason,
    panicMax:game.loop?.panicMax??null,
    coolDown:game.loop?._coolDown??null,
    pauseDuration:Math.round(game.loop?.pauseDuration||0)
   },{sample:true,dedupe:true,dedupeKey:`resume_recovery:${reason}`});
  });
 };
 window.addEventListener('focus',()=>lkRecordResumeRecovery('focus'),{passive:true});
 document?.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='visible')lkRecordResumeRecovery('visible');},{passive:true});
 window.setTimeout(()=>lkApplyRenderScale(game,LK_RENDER_SCALE,{remember:false}),120);
}

import Phaser from 'phaser';
import Sword from './weapons/Sword.js';

const STAGE0={
 WORLD_WIDTH:18400,
 WORLD_HEIGHT:1728,
 REFERENCE_HEIGHT:720,
 MAX_GAMEPLAY_ASPECT:Number.POSITIVE_INFINITY,
 CAMERA_DEADZONE_WIDTH:0.52,
 CAMERA_DEADZONE_HEIGHT:0.46
};

const PURSUIT={
 // Simple rule requested for long biomes:
 // when the player's screen is empty, unseen normal enemies run 4x faster.
 EMPTY_SCREEN_SPEED_MULTIPLIER:4,

 // Normal spawn points sit roughly 52 world units outside the camera.
 // Once a rushing enemy reaches this band, its speed immediately returns to normal.
 NORMAL_SPAWN_BAND:65
};

const WORLD_DESIGN={
 ROUTE_Y:864,
 START_X:400,

 // 20:9 mobile view = 1600 world units wide.
 // 7200 / 1600 = 4.5 wide-screen phone views per biome.
 MOBILE_REFERENCE_VIEW_WIDTH:1600,
 ZONE_LENGTH:3600,

 // The final ~1 phone screen of a biome starts showing traces of the next one.
 PREVIEW_WIDTH:800,

 // Once the player is this deep into the new biome, the old route seals.
 BACK_LOCK_DEPTH:600,

 // Old prototype visuals are discarded once safely outside camera range.
 UNLOAD_DEPTH:1200,

 ZONES:[
  {
   id:'ashFields',
   name:'ASH FIELDS',
   subtitle:'The kingdom burned here first',
   start:0,
   end:4000,
   color:0x37372f,
   accent:0x706a58,
   previewKind:'ash',
   landmark:'BROKEN SWORD',
   landmarkX:2275,
   landmarkY:725
  },
  {
   id:'ruinedKingdom',
   name:'RUINED KINGDOM',
   subtitle:'Stone remembers the dead',
   start:4000,
   end:7600,
   color:0x474640,
   accent:0x8b806e,
   previewKind:'ruins',
   landmark:'FALLEN KING',
   landmarkX:5800,
   landmarkY:950
  },
  {
   id:'cursedGraveyard',
   name:'CURSED GRAVEYARD',
   subtitle:'The soil refuses to rest',
   start:7600,
   end:11200,
   color:0x303c35,
   accent:0x668267,
   previewKind:'graveyard',
   landmark:'OLD MAUSOLEUM',
   landmarkX:9400,
   landmarkY:715
  },
  {
   id:'hollowForest',
   name:'HOLLOW FOREST',
   subtitle:'Roots feed on what remains',
   start:11200,
   end:14800,
   color:0x263329,
   accent:0x637c55,
   previewKind:'forest',
   landmark:'DEAD HEART TREE',
   landmarkX:13000,
   landmarkY:960
  },
  {
   id:'spiderTerritory',
   name:'SPIDER TERRITORY',
   subtitle:'Nothing leaves the web',
   start:14800,
   end:18400,
   color:0x29272d,
   accent:0x766d7e,
   previewKind:'spider',
   landmark:'THE GREAT COCOON',
   landmarkX:16600,
   landmarkY:755
  }
 ],

 GATES:[
  {
   id:'saintGate',
   x:4000,
   champion:'brokenSaint',
   fromZone:0,
   toZone:1,
   name:"SAINT'S SEAL",
   closeName:'ASHFALL',
   color:0xd8c878
  },
  {
   id:'soulGate',
   x:7600,
   champion:'necromancer',
   fromZone:1,
   toZone:2,
   name:'SOUL MIST',
   closeName:'SOUL VEIL',
   color:0x67d979
  },
  {
   id:'wardenGate',
   x:11200,
   champion:'shieldWarden',
   fromZone:2,
   toZone:3,
   name:'WARDEN BARRIER',
   closeName:'FALLEN STONE',
   color:0xb8c8d8
  },
  {
   id:'rootGate',
   x:14800,
   champion:'hollowTree',
   fromZone:3,
   toZone:4,
   name:'ROOT WALL',
   closeName:'SEALED ROOTS',
   color:0x91b967
  }
 ]
};



const ASH_ENVIRONMENT_ART={
 ground:[
  'ash_ground_base_01',
  'ash_edge_north_01',
  'ash_edge_south_01',
  'ash_edge_west_01',
  'ash_edge_east_01'
 ],
 props:[
  'ash_prop_burnt_grass_01',
  'ash_prop_rock_pile_01',
  'ash_prop_ember_shrub_01',
  'ash_prop_charred_branches_01',
  'ash_prop_ash_rubble_01'
 ],
 landmarks:[
  'ash_landmark_burnt_tree_shrine_01',
  'ash_landmark_ruined_altar_01'
 ]
};


const ASH_READABILITY={
 PLAYER_AURA_WIDTH:260,
 PLAYER_AURA_HEIGHT:200,
 PLAYER_SHADOW_WIDTH:48,
 PLAYER_SHADOW_HEIGHT:22,
 PLAYER_ROUTE_LIGHT_ALPHA:0.045,
 ENEMY_SHADOW_ALPHA:0.26,
 CHAMPION_SHADOW_ALPHA:0.34
};



const LOADING_ART_KEY='lastknight_loading_art';
const LOADING_SCREEN_STATUS='Loading Ash Fields...';
const SKILL_ICON_ASSETS={quake:'/assets/ui/newskills/skill_quake_icon.png',lift:'/assets/ui/newskills/skill_lift_icon.png',spin:'/assets/ui/newskills/skill_spin_icon.png'};
const SKILL_ICON_KEYS={quake:'skill_icon_quake',lift:'skill_icon_lift',spin:'skill_icon_spin'};
const SKILL_BUTTON_FRAME_KEY='skill_button_frame_art';
const MANA_SLOT_ANCHORS=[
 {x:87.63/374,y:65.06/129},
 {x:185.70/374,y:64.93/129},
 {x:283.75/374,y:64.89/129}
];

const HERO_HUD_ASSETS={
 corner_top_left:'/assets/ui/hero_hud/corner_top_left.png',corner_top_right:'/assets/ui/hero_hud/corner_top_right.png',
 corner_bottom_left:'/assets/ui/hero_hud/corner_bottom_left.png',corner_bottom_right:'/assets/ui/hero_hud/corner_bottom_right.png',
 edge_left:'/assets/ui/hero_hud/edge_left.png',edge_right:'/assets/ui/hero_hud/edge_right.png',edge_top:'/assets/ui/hero_hud/edge_top.png',edge_bottom:'/assets/ui/hero_hud/edge_bottom.png',
 panel_fill_center:'/assets/ui/hero_hud/panel_fill_center.png',level_badge_large:'/assets/ui/hero_hud/level_badge_large.png',
 hp_bar_frame:'/assets/ui/hero_hud/hp_bar_frame.png',mana_housing_3slot:'/assets/ui/hero_hud/mana_housing_3slot.png',mana_bottle_blue:'/assets/ui/hero_hud/mana_bottle_blue.png',xp_bar_frame:'/assets/ui/hero_hud/xp_bar_frame.png'
};

function queueAshFieldsEnvironmentArt(scene){
 for(const key of ASH_ENVIRONMENT_ART.ground){
  scene.load.image(key,`/assets/environment/ash_fields/ground_minimal/${key}.png`);
 }
 for(const key of ASH_ENVIRONMENT_ART.props){
  scene.load.image(key,`/assets/environment/ash_fields/props_minimal/${key}.png`);
 }
 for(const key of ASH_ENVIRONMENT_ART.landmarks){
  scene.load.image(key,`/assets/environment/ash_fields/landmarks_minimal/${key}.png`);
 }
}

function queueSkillIconArt(scene){
 for(const [kind,path] of Object.entries(SKILL_ICON_ASSETS)) scene.load.image(SKILL_ICON_KEYS[kind],path);
 scene.load.image(SKILL_BUTTON_FRAME_KEY,'/assets/ui/newskills/skill_button_frame.png');
 for(const [key,path] of Object.entries(HERO_HUD_ASSETS)) scene.load.image(`hero_hud_${key}`,path);
}

function queueGameplayArt(scene){
 scene.load.image('xp_crystal','/assets/gameplay/pickups/xp_crystal.png');
 scene.load.image('health_heart','/assets/gameplay/pickups/health_heart.png');
 for(let i=0;i<2;i++){
  const frame=String(i).padStart(2,'0');
  scene.load.image(`mage_projectile_${frame}`,`/assets/gameplay/projectiles/mage_projectile_${frame}.png`);
 }
 const brokenSaintVfx={holy_mark:4,holy_impact:4,holy_beam:3,reflect_shield:4,reflect_spark:2};
 for(const [name,count] of Object.entries(brokenSaintVfx)){
  for(let i=0;i<count;i++){
   const frame=String(i).padStart(2,'0');
   scene.load.image(`broken_saint_${name}_${frame}`,`/assets/effects/broken_saint/broken_saint_${name}_${frame}.png`);
  }
 }
}

function queueAttackRingArt(scene){
 for(let i=0;i<8;i++){
  const frame=String(i).padStart(2,'0');
  scene.load.image(`ring_sweep_${frame}`,`/assets/effects/ring_sweep_${frame}.png`);
 }
}

function queueHitBurstArt(scene){
 for(let i=0;i<6;i++){
  const frame=String(i).padStart(2,'0');
  scene.load.image(`hit_burst_${frame}`,`/assets/effects/hit_burst_${frame}.png`);
 }
}

function queueMainGameAssets(scene){
 queueAttackRingArt(scene);
 queueHitBurstArt(scene);
 queueAshFieldsEnvironmentArt(scene);
 queueGameplayArt(scene);
 queueSkillIconArt(scene);
 const dirs=['down','left','right','up'];
 for(const dir of dirs){
  for(let i=0;i<4;i++){
   const frame=String(i).padStart(2,'0');
   scene.load.image(`player_${dir}_idle_${frame}`,`/assets/redraw/player/${dir}_idle_${frame}.png`);
   scene.load.image(`skeleton_${dir}_idle_${frame}`,`/assets/redraw/skeleton/${dir}_idle_${frame}.png`);
   if(i<3) scene.load.image(`mage_${dir}_idle_${frame}`,`/assets/redraw/mage/${dir}_idle_${frame}.png`);
   scene.load.image(`shield_${dir}_idle_${frame}`,`/assets/redraw/shield/${dir}_idle_${dir==='right' && i<2 ? String(i+2).padStart(2,'0') : frame}.png`);
   scene.load.image(`champion_${dir}_idle_${frame}`,`/assets/redraw/champion/${dir}_idle_${frame}.png`);
  }
  for(let i=0;i<6;i++){
   const frame=String(i).padStart(2,'0');
   scene.load.image(`player_${dir}_walk_${frame}`,`/assets/redraw/player/${dir}_walk_${frame}.png`);
   scene.load.image(`player_${dir}_attack_${frame}`,`/assets/redraw/player/${dir}_attack_${frame}.png`);
   scene.load.image(`skeleton_${dir}_walk_${frame}`,`/assets/redraw/skeleton/${dir}_walk_${frame}.png`);
   scene.load.image(`skeleton_${dir}_attack_${frame}`,`/assets/redraw/skeleton/${dir}_attack_${frame}.png`);
   scene.load.image(`mage_${dir}_walk_${frame}`,`/assets/redraw/mage/${dir}_walk_${dir==='down' && i===4 ? '05' : dir==='down' && i===5 ? '06' : frame}.png`);
   scene.load.image(`mage_${dir}_cast_${frame}`,`/assets/redraw/mage/${dir}_cast_${frame}.png`);
   scene.load.image(`shield_${dir}_walk_${frame}`,`/assets/redraw/shield/${dir}_walk_${frame}.png`);
   scene.load.image(`shield_${dir}_attack_${frame}`,`/assets/redraw/shield/${dir}_attack_${dir==='left' && i===1 ? '06' : frame}.png`);
   scene.load.image(`champion_${dir}_walk_${frame}`,`/assets/redraw/champion/${dir}_walk_${frame}.png`);
   scene.load.image(`champion_${dir}_attack_${frame}`,`/assets/redraw/champion/${dir}_attack_${frame}.png`);
  }
 }
 const brokenSaintSourceDirs={down:'down',down_left:'down_right',left:'right',up_left:'up_right',up:'up',up_right:'up_left',right:'left',down_right:'down_left'};
 for(const [dir,sourceDir] of Object.entries(brokenSaintSourceDirs)){
  for(let i=0;i<4;i++){
   const frame=String(i).padStart(2,'0');
   scene.load.image(`broken_saint_${dir}_walk_${frame}`,`/assets/redraw/champion/broken_saint/${sourceDir}_walk_${frame}.png`);
  }
  for(let i=0;i<3;i++){
   const frame=String(i).padStart(2,'0');
   scene.load.image(`broken_saint_${dir}_attack_${frame}`,`/assets/redraw/champion/broken_saint/${sourceDir}_attack_${frame}.png`);
  }
 }
}

class BootScene extends Phaser.Scene {
 constructor(){
  super('BootScene');
 }
 preload(){
  this.cameras.main.setBackgroundColor('#060505');
  const w=Math.max(1,this.scale.width),h=Math.max(1,this.scale.height);
  const cx=w/2,cy=h/2;
  const title=this.add.text(cx,cy-48,'LAST KNIGHT',{fontFamily:'Arial, sans-serif',fontSize:'30px',fontStyle:'bold',color:'#f0dfaf',stroke:'#130e09',strokeThickness:4}).setOrigin(0.5);
  const subtitle=this.add.text(cx,cy-14,'ПЕПЕЛ КОРОЛЕВСТВА',{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#c8b48a',letterSpacing:1}).setOrigin(0.5);
  const frameW=Math.min(320,w-48),frameH=18;
  const barBg=this.add.rectangle(cx,cy+32,frameW,frameH,0x130f0d,0.96).setStrokeStyle(2,0x8c7447,0.9);
  const fill=this.add.rectangle(cx-frameW/2+4,cy+32,Math.max(1,frameW-8),frameH-8,0xc69e4f,1).setOrigin(0,0.5);
  fill.displayWidth=0;
  const pct=this.add.text(cx,cy+66,'0%',{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#f5e4b3'}).setOrigin(0.5);
  this.load.on('progress',(value)=>{
   fill.displayWidth=Math.max(2,(frameW-8)*value);
   pct.setText(`${Math.round(value*100)}%`);
  });
  this.load.once('complete',()=>{
   fill.displayWidth=frameW-8;
   pct.setText('100%');
   this.time.delayedCall(80,()=>this.scene.start('PreloadScene'));
  });
  const useMobileLoadingArt=typeof window!=='undefined' && (window.matchMedia?.('(pointer: coarse)').matches || (navigator.maxTouchPoints||0)>0);
  this.load.image(LOADING_ART_KEY,useMobileLoadingArt?'/assets/ui/loading_key_art_mobile.jpg':'/assets/ui/loading_key_art_4k.jpg');
 }
}

class PreloadScene extends Phaser.Scene {
 constructor(){
  super('PreloadScene');
  this.loadingFailed=false;
 }
 create(){
  this.buildLoadingScreen();
  queueMainGameAssets(this);
  this.registerLoadingEvents();
  this.load.start();
 }
 buildLoadingScreen(){
  this.bg=this.add.image(0,0,LOADING_ART_KEY).setDepth(0);
  this.vignette=this.add.rectangle(0,0,100,100,0x050403,0.16).setOrigin(0).setDepth(1);
  this.overlayShadow=this.add.rectangle(0,0,100,100,0x000000,0.22).setDepth(2);
  this.overlay=this.add.rectangle(0,0,100,100,0x080706,0.62).setStrokeStyle(2,0x8e7547,0.92).setDepth(3);
  this.overlayInner=this.add.rectangle(0,0,100,100,0x12100d,0.38).setStrokeStyle(1,0xd9c180,0.18).setDepth(4);
  this.loadingTitle=this.add.text(0,0,'LAST KNIGHT',{fontFamily:'Arial, sans-serif',fontSize:'30px',fontStyle:'bold',color:'#f1e0b1',stroke:'#130e09',strokeThickness:4}).setOrigin(0.5).setDepth(5);
  this.loadingSubtitle=this.add.text(0,0,'ПЕПЕЛ КОРОЛЕВСТВА',{fontFamily:'Arial, sans-serif',fontSize:'15px',fontStyle:'bold',color:'#ccb68a',letterSpacing:1}).setOrigin(0.5).setDepth(5);
  this.loadingStatus=this.add.text(0,0,LOADING_SCREEN_STATUS,{fontFamily:'Arial, sans-serif',fontSize:'14px',color:'#dfd6c5'}).setOrigin(0.5).setDepth(5);
  this.progressBack=this.add.rectangle(0,0,100,18,0x100d0b,0.96).setStrokeStyle(2,0x8d7445,0.95).setDepth(5);
  this.progressFill=this.add.rectangle(0,0,100,10,0xc39a4a,1).setOrigin(0,0.5).setDepth(6);
  this.progressGlow=this.add.rectangle(0,0,100,3,0xf6d691,0.34).setOrigin(0,0.5).setDepth(6);
  this.progressPct=this.add.text(0,0,'0%',{fontFamily:'Arial, sans-serif',fontSize:'15px',fontStyle:'bold',color:'#f7e5b5'}).setOrigin(0.5).setDepth(6);
  this.retryHint=this.add.text(0,0,'Loading failed — tap to retry',{fontFamily:'Arial, sans-serif',fontSize:'13px',fontStyle:'bold',color:'#ffcfbf'}).setOrigin(0.5).setDepth(6).setVisible(false).setInteractive({useHandCursor:true});
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
  const w=Math.max(1,this.scale.width),h=Math.max(1,this.scale.height);
  const mobile=h<760 || w<1100;
  const cx=w/2,cy=h/2;
  const bgScale=Math.max(w/this.bg.width,h/this.bg.height);
  this.bg.setPosition(cx,cy).setScale(bgScale);
  this.vignette.setPosition(0,0).setSize(w,h).setDisplaySize(w,h);
  const overlayW=Math.min(mobile?Math.max(300,w*0.56):560,w-36);
  const overlayH=mobile?162:186;
  this.overlayShadow.setPosition(cx,cy+4).setSize(overlayW,overlayH).setDisplaySize(overlayW,overlayH);
  this.overlay.setPosition(cx,cy).setSize(overlayW,overlayH).setDisplaySize(overlayW,overlayH);
  this.overlayInner.setPosition(cx,cy).setSize(overlayW-10,overlayH-10).setDisplaySize(overlayW-10,overlayH-10);
  this.loadingTitle.setPosition(cx,cy-(mobile?42:50)).setFontSize(mobile?24:30);
  this.loadingSubtitle.setPosition(cx,cy-(mobile?16:20)).setFontSize(mobile?13:15);
  const barW=overlayW-(mobile?42:64);
  this.progressBack.setPosition(cx,cy+(mobile?18:22)).setSize(barW,20).setDisplaySize(barW,20);
  this.progressFill.setPosition(cx-barW/2+5,cy+(mobile?18:22)).setSize(barW-10,10).setDisplaySize(Math.max(0,Math.min(barW-10,this.progressFill.displayWidth||0)),10);
  this.progressGlow.setPosition(cx-barW/2+5,cy+(mobile?14:18)).setSize(barW-10,3).setDisplaySize(Math.max(0,Math.min(barW-10,this.progressGlow.displayWidth||0)),3);
  this.progressPct.setPosition(cx,cy+(mobile?47:54)).setFontSize(mobile?14:15);
  this.loadingStatus.setPosition(cx,cy+(mobile?73:82)).setFontSize(mobile?12:14);
  this.retryHint.setPosition(cx,cy+(mobile?97:108)).setFontSize(mobile?11:13);
 }
 registerLoadingEvents(){
  const totalFiles=Math.max(1,this.load.list.size + this.load.inflight.size);
  this.load.on('progress',(value)=>this.setProgress(value));
  this.load.on('fileprogress',(file)=>{
   const raw=file?.key || LOADING_SCREEN_STATUS;
   const friendly=String(raw).replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
   this.loadingStatus.setText(`Loading: ${friendly}`);
  });
  this.load.on('loaderror',()=>{
   this.loadingFailed=true;
   this.loadingStatus.setText('Loading error');
   this.retryHint.setVisible(true);
  });
  this.load.once('complete',()=>{
   this.setProgress(1);
   if(!this.loadingFailed) this.loadingStatus.setText('Entering Ash Fields...');
   this.time.delayedCall(220,()=>{
    this.cameras.main.fadeOut(220,0,0,0);
    this.time.delayedCall(230,()=>this.scene.start('main'));
   });
  });
  this.loadingStatus.setText(`${LOADING_SCREEN_STATUS} (${totalFiles} assets)`);
 }
 setProgress(value){
  const progress=Phaser.Math.Clamp(value,0,1);
  const maxW=(this.progressBack.displayWidth||this.progressBack.width)-10;
  this.progressFill.displayWidth=Math.max(0,maxW*progress);
  this.progressGlow.displayWidth=Math.max(0,maxW*progress);
  this.progressPct.setText(`${Math.round(progress*100)}%`);
 }
}

class MainScene extends Phaser.Scene {
 preload(){}

 preloadAshFieldsEnvironmentArt(){
  for(const key of ASH_ENVIRONMENT_ART.ground){
   this.load.image(
    key,
    `/assets/environment/ash_fields/ground_minimal/${key}.png`
   );
  }

  for(const key of ASH_ENVIRONMENT_ART.props){
   this.load.image(
    key,
    `/assets/environment/ash_fields/props_minimal/${key}.png`
   );
  }
  for(const key of ASH_ENVIRONMENT_ART.landmarks){
   this.load.image(
    key,
    `/assets/environment/ash_fields/landmarks_minimal/${key}.png`
   );
  }
 }

 preloadGameplayArt(){
  this.load.image(
   'xp_crystal',
   '/assets/gameplay/pickups/xp_crystal.png'
  );
  this.load.image(
   'health_heart',
   '/assets/gameplay/pickups/health_heart.png'
  );
  for(let i=0;i<2;i++){
   const frame=String(i).padStart(2,'0');
   this.load.image(
    `mage_projectile_${frame}`,
    `/assets/gameplay/projectiles/mage_projectile_${frame}.png`
   );
  }

  const brokenSaintVfx={
   holy_mark:4,
   holy_impact:4,
   holy_beam:3,
   reflect_shield:4,
   reflect_spark:2
  };
  for(const [name,count] of Object.entries(brokenSaintVfx)){
   for(let i=0;i<count;i++){
    const frame=String(i).padStart(2,'0');
    this.load.image(
     `broken_saint_${name}_${frame}`,
     `/assets/effects/broken_saint/broken_saint_${name}_${frame}.png`
    );
   }
  }
 }

 preloadAttackRing(){
  for(let i=0;i<8;i++){
   const frame=String(i).padStart(2,'0');
   this.load.image(
    `ring_sweep_${frame}`,
    `/assets/effects/ring_sweep_${frame}.png`
   );
  }
 }

 preloadHitBurst(){
  for(let i=0;i<6;i++){
   const frame=String(i).padStart(2,'0');
   this.load.image(
    `hit_burst_${frame}`,
    `/assets/effects/hit_burst_${frame}.png`
   );
  }
 }

 createSpriteAnimations(){
  const dirs=['down','left','right','up'];

  for(const dir of dirs){
   const defs=[
    [`player_${dir}_idle`,4,6,-1],
    [`player_${dir}_walk`,6,10,-1],
    [`player_${dir}_attack`,6,12,0],
    [`skeleton_${dir}_idle`,4,6,-1],
    [`skeleton_${dir}_walk`,6,10,-1],
    [`skeleton_${dir}_attack`,6,12,0],
    [`mage_${dir}_idle`,3,6,-1],
    [`mage_${dir}_walk`,6,10,-1],
    [`mage_${dir}_cast`,6,12,0],
    [`shield_${dir}_idle`,4,6,-1],
    [`shield_${dir}_walk`,6,10,-1],
    [`shield_${dir}_attack`,6,12,0],
    [`champion_${dir}_idle`,4,6,-1],
    [`champion_${dir}_walk`,6,10,-1],
    [`champion_${dir}_attack`,6,12,0]
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

  if(!this.anims.exists('ring_sweep')){
   this.anims.create({
    key:'ring_sweep',
    frames:Array.from(
     {length:8},
     (_,i)=>({key:`ring_sweep_${String(i).padStart(2,'0')}`})
    ),
    frameRate:20,
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

  this.activeChampion=null;
  this.championEventActive=false;
  this.championRewardOpen=false;
  this.championRewardObjects=[];
  this.championHazards=[];
  this.relicZones=[];
  this.championRelics=new Set();
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

  this.mobileMoveX=0;
  this.mobileMoveY=0;
  this.mobileMovePointerId=null;
  this.mobileControls=[];
  this.isTouchDevice=false;

  this.currentWorldZoneIndex=0;
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

  this.emptyScreenRushActive=false;

  // Build 1.2: functional mana + three combat skills.
  this.maxMana=3;
  this.mana=3;
  this.manaRegenMs=15000;
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

  this.activeChampion=null;
  this.championEventActive=false;
  this.championRewardOpen=false;
  this.championRewardObjects=[];
  this.championHazards=[];
  this.relicZones=[];
  this.championRelics=new Set();
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

  this.mobileMoveX=0;
  this.mobileMoveY=0;
  this.mobileMovePointerId=null;
  this.mobileControls=[];
  this.isTouchDevice=Boolean(
   this.sys.game.device.input.touch ||
   (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
  );

  this.currentWorldZoneIndex=0;
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
  this.lastStreamingZoneIndex=0;

  this.emptyScreenRushActive=false;

  this.maxMana=3;
  this.mana=3;
  this.manaRegenMs=15000;
  this.nextManaRegenAt=0;
  this.skillLockUntil=0;

  this.cameras.main.setBackgroundColor('#16120f');
  this.createSpriteAnimations();

  this.physics.world.setBounds(0,0,STAGE0.WORLD_WIDTH,STAGE0.WORLD_HEIGHT);

  // Stage 1 World Design prototype. These shapes are diagnostic placeholders,
  // not final environment art.
  this.worldGround=this.add.rectangle(
   STAGE0.WORLD_WIDTH/2,STAGE0.WORLD_HEIGHT/2,
   STAGE0.WORLD_WIDTH,STAGE0.WORLD_HEIGHT,0x151916,1
  ).setDepth(-110);

  this.createWorldDesignPrototype();

  this.enemyGroup=this.physics.add.group();

  this.player=this.add.circle(
   WORLD_DESIGN.START_X,WORLD_DESIGN.ROUTE_Y,16,0x33aaff,0
  );
  this.physics.add.existing(this.player);
  this.player.body.setCollideWorldBounds(true);
  this.player.hitRadius=16;
  this.player.hp=100;

  this.playerVisual=this.add.sprite(
   this.player.x,
   this.player.y,
   'player_down_idle_00'
  ).setOrigin(0.5,0.78).setScale(0.575).setDepth(20);

  this.playerDir='down';
  this.playerAttackDir='down';
  this.playerVisualState='player_down_idle';
  this.playerVisual.play(this.playerVisualState);
  this.playerAttackUntil=0;
  this.activeAttackFx=null;

  this.createReadabilityLayers();

  this.sword=new Sword(this,this.player);

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

  this.hud=this.add.text(14,12,'',{fontSize:'18px',color:'#fff'})
   .setScrollFactor(0).setDepth(140).setAlpha(0);

  this.waveText=this.add.text(0,20,'WAVE 1',{fontSize:'24px',color:'#fff'})
   .setOrigin(0.5,0).setScrollFactor(0).setDepth(140).setAlpha(0);
  this.waveSubText=this.add.text(0,50,'',{fontSize:'13px',color:'#d9e6d6'})
   .setOrigin(0.5).setScrollFactor(0).setDepth(140).setAlpha(0);

  this.regionText=this.add.text(
   0,69,'ASH FIELDS',
   {fontSize:'12px',color:'#b9c2b6',stroke:'#101510',strokeThickness:2}
  ).setOrigin(0.5).setScrollFactor(0).setDepth(139).setAlpha(0);

  this.championNameText=this.add.text(
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

  this.gameOverText=this.add.text(
   400,300,
   '',
   {
    fontSize:'28px',
    color:'#ffffff',
    align:'center'
   }
  ).setOrigin(0.5).setDepth(101).setScrollFactor(0).setVisible(false).setAlpha(0);

  this.physics.add.collider(this.player,this.enemyGroup);
  this.physics.add.collider(this.player,this.ashLandmarkColliderGroup);

  // Slightly wider physical spacing so mobs form a crowd instead of visually merging.
  this.physics.add.collider(
   this.enemyGroup,
   this.enemyGroup,
   (a,b)=>{
    if(!a.active || !b.active || !a.body || !b.body) return;

    const dx=a.x-b.x;
    const dy=a.y-b.y;
    const dist=Math.max(0.001,Math.hypot(dx,dy));
    const minDist=(a.crowdRadius||a.hitRadius||14)+(b.crowdRadius||b.hitRadius||14)+8;

    if(dist<minDist){
     const push=(minDist-dist)*0.11;
     const nx=dx/dist;
     const ny=dy/dist;

     a.body.velocity.x+=nx*push*18;
     a.body.velocity.y+=ny*push*18;
     b.body.velocity.x-=nx*push*18;
     b.body.velocity.y-=ny*push*18;
    }
   }
  );

  this.setupResponsiveWorldCamera();
  this.bindProgressionGateCollision();
  if(this.scene.isActive('HUDScene')) this.scene.stop('HUDScene');
  this.scene.launch('HUDScene',{mainScene:this});

  this.currentWorldZoneIndex=0;
  this.regionText.setText(WORLD_DESIGN.ZONES[0].name);
  this.updateWorldStreaming();
  this.scale.on('resize',this.handleViewportResize,this);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
   this.scale.off('resize',this.handleViewportResize,this);
   this.events.off('mobile-skill',this.handleSkillInput,this);
  });

  this.startWave(1,true);
 }

 spawnEnemy(){
  const spawn=this.getSpawnPointAroundCamera(52);

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

  const isMage =
   this.wave >= 3 &&
   (this.spawned % mageEvery === mageEvery-1) &&
   livingMages < 2;

  const isShield = !isMage &&
   this.wave >= 4 &&
   (this.spawned % shieldEvery === shieldEvery-1) &&
   livingShields < 3;

  e.type = isMage ? 'mage' : (isShield ? 'shield' : 'skeleton');

  if(isMage){
   e.setFillStyle(0x44ff66,0);
   e.hp=40 + this.wave*5;
   e.maxHp=e.hp;
   e.speed=45 + this.wave*2;
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
   e.hp=95 + this.wave*10;
   e.maxHp=e.hp;
   e.speed=38 + this.wave*2;
   e.blockNext=true;
   e.attackDamage=8;
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
   e.hp=30 + this.wave*5;
   e.maxHp=e.hp;
   e.speed=60 + this.wave*3;
   e.attackDamage=5;
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

   this.skeletonSpawned++;
  }

  e.lastAttack=0;
  e.lastShot=0;
  e.attackAnimUntil=0;
  e.staggerUntil=0;
  e.knockbackVX=0;
  e.knockbackVY=0;
  e.visualBaseScale=e.visual ? e.visual.scaleX : 0.5;
  this.createEnemyReadabilityShadow(e);
  this.configureEnemyCollision(e,4);
  this.enemyGroup.add(e);
  this.enemies.push(e);
 }

 getChampionForWave(wave){
  return ({
   5:'brokenSaint',
   7:'necromancer',
   9:'shieldWarden',
   10:'hollowTree'
  })[wave] || null;
 }

 getChampionDefinition(kind){
  return ({
   brokenSaint:{name:'BROKEN SAINT',hp:520,speed:48,damage:12,hitRadius:34,crowdRadius:44,crowdKeepoutRadius:96,collisionPadding:10,scale:0.96,tint:0xffffff,rewardColor:'#ffe59a'},
   necromancer:{name:'THE SOUL HERALD',hp:640,speed:42,damage:10,hitRadius:24,scale:0.58,tint:0x78ff7c,rewardColor:'#7cff95'},
   shieldWarden:{name:'SHIELD WARDEN',hp:820,speed:38,damage:16,hitRadius:27,scale:0.62,tint:0xc9d0da,rewardColor:'#d9e1ea'},
   hollowTree:{name:'HOLLOW TREE',hp:980,speed:0,damage:10,hitRadius:36,scale:0.72,tint:0x91b967,rewardColor:'#b8df85'}
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
  const width=Math.max(26,r*2.25);
  const height=Math.max(12,r*1.02);
  const alpha=enemy.type==='champion'
   ? ASH_READABILITY.CHAMPION_SHADOW_ALPHA
   : ASH_READABILITY.ENEMY_SHADOW_ALPHA;

  enemy.shadowVisual=this.add.ellipse(
   enemy.x,
   enemy.y+r*0.82,
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
   const targetW=Math.max(250,(this.sword ? this.sword.radius*2.05 : 250));
   const targetH=Math.max(190,(this.sword ? this.sword.radius*1.55 : 190));
   this.playerGroundLight.width=targetW;
   this.playerGroundLight.height=targetH;
  }

  if(this.playerShadow && this.playerShadow.active){
   this.playerShadow.setPosition(this.player.x,this.player.y+12);
  }
 }

 createWorldDesignPrototype(){
  this.worldZoneVisuals=[];
  this.worldLandmarkObjects=[];
  this.worldGateObjects=new Map();

  this.worldGateGroup=this.physics.add.staticGroup();
  this.ashLandmarkColliderGroup=this.physics.add.staticGroup();

  // Load only the starting biome. The next biome is streamed when the player
  // approaches its transition or when its champion is defeated.
  this.loadWorldZone(0);
  this.ensureProgressionGate(0);
  this.createBiomePreview(0);
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



 createAshLandmarkBlocker(objects,x,y,width,height,name){
  const blocker=this.add.zone(x,y,width,height);
  blocker.ashLandmarkName=name;
  this.ashLandmarkColliderGroup.add(blocker);
  if(blocker.body){
   blocker.body.setSize(width,height);
   blocker.body.updateFromGameObject();
  }
  objects.push(blocker);
 }

 addAshLandmarkCollision(objects,key,x,y){
  // Manual footprint colliders: no transparent padding and no tall visual-only parts.
  const shapes={
   ash_landmark_burnt_tree_shrine_01:[{dx:0,dy:96,w:390,h:250}],
   ash_landmark_ruined_altar_01:[{dx:0,dy:112,w:420,h:270}]
  };
  for(const s of (shapes[key]||[])){
   this.createAshLandmarkBlocker(objects,x+s.dx,y+s.dy,s.w,s.h,key);
  }
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

  // Minimal Ash Fields decoration set: five lightweight props, no collision.
  // Scatter them throughout the whole biome while keeping the central route readable.
  const propSlots=78;
  const routeY=WORLD_DESIGN.ROUTE_Y;
  for(let i=0;i<propSlots;i++){
   const seed=4100+i*53;
   const key=ASH_ENVIRONMENT_ART.props[i%ASH_ENVIRONMENT_ART.props.length];
   const x=zone.start+280+this.artNoise(seed+1)*(width-560);

   let y=180+this.artNoise(seed+2)*(STAGE0.WORLD_HEIGHT-360);
   // Most props sit outside the core combat corridor; some sparse pieces may enter it.
   if(Math.abs(y-routeY)<360 && this.artNoise(seed+3)<0.78){
    y=(y<routeY)
     ? 220+this.artNoise(seed+4)*760
     : STAGE0.WORLD_HEIGHT-220-this.artNoise(seed+4)*760;
   }

   const prop=this.add.image(x,y,key)
    .setDepth(-44)
    .setScale(0.13+this.artNoise(seed+5)*0.10)
    .setAlpha(0.78+this.artNoise(seed+6)*0.18)
    .setRotation((this.artNoise(seed+7)-0.5)*0.22);

   if(this.artNoise(seed+8)>0.5) prop.setFlipX(true);
   objects.push(prop);
  }

  // Exactly two large Ash Fields landmarks. These are the only new colliding scenery pieces.
  const landmarkLayout=[
   ['ash_landmark_burnt_tree_shrine_01',1390,1210,0.46,-0.015],
   ['ash_landmark_ruined_altar_01',3020,465,0.43,0.012]
  ];

  for(const [key,x,y,scale,rotation] of landmarkLayout){
   if(!this.textures.exists(key)) continue;

   const landmark=this.add.image(x,y,key)
    .setDepth(-28)
    .setScale(scale)
    .setRotation(rotation)
    .setAlpha(0.98);

   objects.push(landmark);
   this.worldLandmarkObjects.push(landmark);
   this.addAshLandmarkCollision(objects,key,x,y);
  }

 }


 loadWorldZone(index){
  if(index<0 || index>=WORLD_DESIGN.ZONES.length) return;
  if(this.loadedWorldZones.has(index)) return;

  const zone=WORLD_DESIGN.ZONES[index];
  const objects=[];

  if(index===0){
   this.createAshFieldsEnvironment(objects,zone);
  }

  // Until a biome receives approved art, keep its streamed chunk visually empty.
  // This prevents deleted/rejected prototype tiles and diagnostic markers from
  // appearing on the game field while preserving progression/gameplay systems.
  this.loadedWorldZones.set(index,objects);

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
  }

  const preview=this.loadedWorldPreviews.get(index);
  if(preview){
   for(const obj of preview){
    if(obj && obj.active) obj.destroy();
   }
   this.loadedWorldPreviews.delete(index);
  }
 }

 createBiomePreview(fromIndex){
  if(fromIndex<0 || fromIndex>=WORLD_DESIGN.ZONES.length-1) return;
  if(this.loadedWorldPreviews.has(fromIndex)) return;

  // No preview art is drawn until approved transition assets exist on disk.
  this.loadedWorldPreviews.set(fromIndex,[]);
 }
 ensureProgressionGate(index){
  if(index<0 || index>=WORLD_DESIGN.GATES.length) return;

  const gate=WORLD_DESIGN.GATES[index];
  if(this.worldGateObjects.has(gate.id)) return;

  const blocker=this.add.rectangle(
   gate.x,
   STAGE0.WORLD_HEIGHT/2,
   34,
   STAGE0.WORLD_HEIGHT,
   gate.color,
   0.04
  ).setDepth(-20);

  this.physics.add.existing(blocker,true);
  this.worldGateGroup.add(blocker);

  const visible=this.add.rectangle(
   gate.x,
   WORLD_DESIGN.ROUTE_Y,
   38,
   820,
   gate.color,
   0.16
  ).setStrokeStyle(3,gate.color,0.62).setDepth(-19);

  const label=this.add.text(
   gate.x-28,
   WORLD_DESIGN.ROUTE_Y-350,
   `LOCKED\n${gate.name}`,
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
   unlocked:false
  });
 }

 createBacktrackSeal(gate){
  if(!gate || this.closedWorldGates.has(gate.id)) return;

  this.closedWorldGates.add(gate.id);

  const x=gate.x+120;
  const blocker=this.add.rectangle(
   x,
   STAGE0.WORLD_HEIGHT/2,
   42,
   STAGE0.WORLD_HEIGHT,
   gate.color,
   0.08
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

  const visible=this.add.rectangle(
   x,
   WORLD_DESIGN.ROUTE_Y,
   46,
   860,
   gate.color,
   0.20
  ).setStrokeStyle(4,gate.color,0.68).setDepth(-15);

  const label=this.add.text(
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

  this.showWaveBanner(
   'THE WAY BACK IS CLOSED',
   'The journey continues forward',
   '#c8d0c2'
  );
 }

 updateWorldStreaming(){
  const zoneIndex=this.currentWorldZoneIndex;
  const zone=WORLD_DESIGN.ZONES[zoneIndex];
  if(!zone) return;

  // Current biome must always be present.
  this.loadWorldZone(zoneIndex);

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
    this.player.x>=previousGate.x+WORLD_DESIGN.UNLOAD_DEPTH
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

  const zone=WORLD_DESIGN.ZONES[this.worldAdvanceTargetZone];
  this.awaitingWorldAdvance=false;
  this.pendingWorldAdvance=null;
  this.worldAdvanceTargetZone=null;

  this.currentWorldZoneIndex=this.getWorldZoneIndexAtX(this.player.x);
  if(this.regionText) this.regionText.setText(zone.name);

  this.waveSubText.setText('NEW REGION');
  this.showWaveBanner(zone.name,zone.subtitle,'#e2eadb');

  // Small arrival beat before combat resumes.
  this.nextWaveAt=time+1250;
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
  const sides=[];
  if(view.top-margin>0) sides.push('top');
  if(view.right+margin<STAGE0.WORLD_WIDTH) sides.push('right');
  if(view.bottom+margin<STAGE0.WORLD_HEIGHT) sides.push('bottom');
  if(view.left-margin>0) sides.push('left');
  const side=Phaser.Utils.Array.GetRandom(sides.length ? sides : ['top','right','bottom','left']);
  const minX=this.clampWorldX(view.left+pad,pad);
  const maxX=this.clampWorldX(view.right-pad,pad);
  const minY=this.clampWorldY(view.top+pad,pad);
  const maxY=this.clampWorldY(view.bottom-pad,pad);
  if(side==='top') return {x:Phaser.Math.Between(Math.round(minX),Math.round(maxX)),y:this.clampWorldY(view.top-margin,pad)};
  if(side==='right') return {x:this.clampWorldX(view.right+margin,pad),y:Phaser.Math.Between(Math.round(minY),Math.round(maxY))};
  if(side==='bottom') return {x:Phaser.Math.Between(Math.round(minX),Math.round(maxX)),y:this.clampWorldY(view.bottom+margin,pad)};
  return {x:this.clampWorldX(view.left-margin,pad),y:Phaser.Math.Between(Math.round(minY),Math.round(maxY))};
 }

 getEdgeSpawnPoint(margin=64){
  return this.getSpawnPointAroundCamera(margin);
 }

 setupResponsiveWorldCamera(){
  const cam=this.cameras.main;
  cam.setBounds(0,0,STAGE0.WORLD_WIDTH,STAGE0.WORLD_HEIGHT);
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
  const metrics=this.getUiMetrics();
  cam.setDeadzone(metrics.width*STAGE0.CAMERA_DEADZONE_WIDTH,metrics.height*STAGE0.CAMERA_DEADZONE_HEIGHT);
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

 createMobileControls(){
  if(!this.isTouchDevice) return;
  const base=this.add.circle(0,0,74,0x0a0f0b,0.20).setStrokeStyle(3,0xffffff,0.24).setScrollFactor(0).setDepth(500);
  const knob=this.add.circle(0,0,31,0xffffff,0.22).setStrokeStyle(2,0xffffff,0.30).setScrollFactor(0).setDepth(501);
  const skillButtons=[];
  for(let i=0;i<3;i++){
   const button=this.add.circle(0,0,44,0x111811,0.28).setStrokeStyle(2,0xffffff,0.24).setScrollFactor(0).setDepth(500).setInteractive({useHandCursor:true});
   const label=this.add.text(0,0,`S${i+1}`,{fontSize:'18px',color:'#ffffff'}).setOrigin(0.5).setScrollFactor(0).setDepth(501);
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
  if(!this.mobileJoystickBase || this.mobileMovePointerId!==null) return;
  const p=this.getPointerUiPosition(pointer);
  const dx=p.x-this.mobileJoystickBase.x,dy=p.y-this.mobileJoystickBase.y;
  if(Math.hypot(dx,dy)<=105){this.mobileMovePointerId=pointer.id;this.updateMobileJoystick(pointer);}
 }

 handleMobilePointerMove(pointer){
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

 spawnChampion(kind){
  if(this.activeChampion && this.activeChampion.active) return;
  const def=this.getChampionDefinition(kind);
  if(!def) return;

  let pos=this.getEdgeSpawnPoint(50);
  if(kind==='hollowTree'){
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
  e.knockbackVX=0;
  e.knockbackVY=0;
  e.nextSkillAt=this.time.now+1600;
  e.nextSecondaryAt=this.time.now+3900;
  e.reflectUntil=0;
  e.guardUntil=0;
  e.lastCounterAt=-99999;
  e.lastAuraTick=0;

  const isBrokenSaint=kind==='brokenSaint';
  const initialTexture=isBrokenSaint ? 'broken_saint_down_walk_00' : 'champion_down_idle_00';
  e.visual=this.add.sprite(e.x,e.y,initialTexture)
   .setOrigin(0.5,0.80).setScale(def.scale).setDepth(16).setTint(def.tint);
  e.dir='down';
  e.attackDir='down';
  e.visualState=isBrokenSaint ? 'broken_saint_down_idle' : 'champion_down_idle';
  e.visual.play(e.visualState);
  e.visualBaseScale=def.scale;
  this.createEnemyReadabilityShadow(e);

  if(kind==='hollowTree'){
   e.auraVisual=this.add.circle(e.x,e.y,115,0x89b85d,0.055)
    .setStrokeStyle(2,0xa8d975,0.38)
    .setDepth(8);
  }

  this.configureEnemyCollision(e,def.collisionPadding ?? 4);
  this.enemyGroup.add(e);
  this.enemies.push(e);
  this.activeChampion=e;
  this.championEventActive=true;
  this.championSpawned++;

  this.championNameText.setText(def.name).setVisible(true);
  this.championHpBack.setVisible(true);
  this.championHpFill.setVisible(true);
  this.updateChampionBar();

  this.showWaveBanner(def.name,'CHAMPION EVENT — ordinary pressure reduced by 30%',def.rewardColor);
  this.cameras.main.flash(240,70,48,25,false);
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
  const e=this.add.circle(x,y,14,0xcc3333,0);
  this.physics.add.existing(e);
  e.type='skeleton';
  e.hp=24+this.wave*4;
  e.maxHp=e.hp;
  e.speed=66+this.wave*2;
  e.attackDamage=5;
  e.hitRadius=14;
  e.lastAttack=0;
  e.lastShot=0;
  e.attackAnimUntil=0;
  e.staggerUntil=0;
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

 updateChampion(e,time,a,distance){
  const kind=e.championKind;

  if(kind==='brokenSaint'){
   e.body.setVelocity(Math.cos(a)*e.speed,Math.sin(a)*e.speed);

   if(time>=e.nextSkillAt){
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
   }

   if(time>=e.nextSecondaryAt){
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
    e.body.setVelocity(Math.cos(a)*e.speed,Math.sin(a)*e.speed);
   } else if(distance<165){
    e.body.setVelocity(-Math.cos(a)*e.speed,-Math.sin(a)*e.speed);
   } else {
    e.body.setVelocity(0,0);
   }

   if(time>=e.nextSkillAt){
    e.nextSkillAt=time+3500;
    e.attackAnimUntil=time+650;
    e.attackDir=e.dir;
    this.spawnChampionHazard(this.player.x,this.player.y,58,700,2300,7,0x48ff6e,'deathZone');
   }

   if(time>=e.nextSecondaryAt){
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
   e.body.setVelocity(Math.cos(a)*e.speed,Math.sin(a)*e.speed);

   if(time>=e.nextSecondaryAt){
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

   if(distance<105 && time>=e.nextSkillAt){
    e.nextSkillAt=time+3000;
    e.attackAnimUntil=time+560;
    e.attackDir=e.dir;
    e.body.setVelocity(0,0);
    this.damagePlayer(15,'champion:shieldBash');

    const pushAngle=Phaser.Math.Angle.Between(e.x,e.y,this.player.x,this.player.y);
    const bashVX=Math.cos(pushAngle)*310;
    const bashVY=Math.sin(pushAngle)*310;
    this.applyPlayerForcedMotion(bashVX,bashVY,190);
    this.player.body.setVelocity(bashVX,bashVY);

    const bash=this.add.circle(this.player.x,this.player.y,20,0xe4edf7,0.30)
     .setStrokeStyle(4,0xffffff,0.9).setDepth(21);
    this.tweens.add({targets:bash,scale:2.0,alpha:0,duration:220,onComplete:()=>bash.destroy()});
   }
   return;
  }

  if(kind==='hollowTree'){
   e.body.setVelocity(0,0);

   if(time>=e.nextSkillAt){
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

   if(time>=e.nextSecondaryAt){
    e.nextSecondaryAt=time+5700;
    for(let i=0;i<2;i++){
     const angle=Phaser.Math.FloatBetween(0,Math.PI*2);
     this.spawnChampionMinion(
      this.clampWorldX(e.x+Math.cos(angle)*85,25),
      this.clampWorldY(e.y+Math.sin(angle)*85,25)
     );
    }
   }

   if(distance<115 && time-e.lastAuraTick>700){
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
   brokenSaint:[
    ['HOLY FRAGMENT','Every 5th sword swing releases a light slash','holyFragment'],
    ['MERCY SEAL','Sword deals +25% damage to enemies below 30% HP','mercySeal'],
    ['FALLEN BLESSING','Survive one lethal hit and restore 30 HP','fallenBlessing']
   ],
   necromancer:[
    ['SOUL SKULL','A spectral skull attacks a nearby enemy periodically','soulSkull'],
    ['GREEN CURSE','Dead enemies can leave damaging cursed ground','greenCurse'],
    ['NECROMANCER SOUL','Kills stack sword damage until you are hit','necromancerSoul']
   ],
   shieldWarden:[
    ['SHIELD FRAGMENT','Automatically block one hit every 20 seconds','shieldFragment'],
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

 openChampionRewards(kind){
  if(this.championRewardOpen) return;
  const choices=this.getChampionRewardChoices(kind);
  if(!choices.length) return;

  this.championRewardOpen=true;
  this.physics.pause();
  const def=this.getChampionDefinition(kind);
  this.currentChampionRewardChoices=choices;
  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.showChampionRewards==='function'){
   hudScene.showChampionRewards(def.name,def.rewardColor,choices);
   this.championRewardObjects=[];
   return;
  }

  const {cx,cy}=this.getUiMetrics();
  const panel=this.add.rectangle(cx,cy,650,360,0x080b08,0.94)
   .setStrokeStyle(3,0xd8b65c,0.85).setDepth(230).setScrollFactor(0);
  const title=this.add.text(cx,cy-145,`${def.name} DEFEATED`,{fontSize:'27px',color:def.rewardColor,stroke:'#111111',strokeThickness:4})
   .setOrigin(0.5).setDepth(231).setScrollFactor(0);
  const subtitle=this.add.text(cx,cy-110,'CHOOSE ONE CHAMPION RELIC',{fontSize:'15px',color:'#ffffff'})
   .setOrigin(0.5).setDepth(231).setScrollFactor(0);

  this.championRewardObjects=[panel,title,subtitle];

  choices.forEach((choice,i)=>{
   const [name,desc,id]=choice;
   const y=cy-55+i*82;
   const card=this.add.rectangle(cx,y,570,66,0x243323,0.96)
    .setStrokeStyle(2,0x7f9b68,0.8).setDepth(231).setScrollFactor(0).setInteractive({useHandCursor:true});
   const nameText=this.add.text(cx-265,y-17,name,{fontSize:'18px',color:'#ffe8a8'}).setDepth(232).setScrollFactor(0);
   const descText=this.add.text(cx-265,y+7,desc,{fontSize:'13px',color:'#dbe8d7',wordWrap:{width:500}}).setDepth(232).setScrollFactor(0);

   card.on('pointerover',()=>card.setFillStyle(0x354b32,1));
   card.on('pointerout',()=>card.setFillStyle(0x243323,0.96));
   card.on('pointerdown',()=>{
    this.grantChampionRelic(id);
    this.closeChampionRewards(name);
   });

   this.championRewardObjects.push(card,nameText,descText);
  });
 }

 selectChampionReward(index){
  if(!this.championRewardOpen) return;
  const choice=this.currentChampionRewardChoices?.[index];
  if(!choice) return;
  const [name,,id]=choice;
  this.grantChampionRelic(id);
  this.closeChampionRewards(name);
 }

 closeChampionRewards(rewardName){
  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.hideChampionRewards==='function') hudScene.hideChampionRewards();
  for(const obj of this.championRewardObjects){
   if(obj && obj.destroy) obj.destroy();
  }
  this.championRewardObjects=[];
  this.currentChampionRewardChoices=[];
  this.championRewardOpen=false;
  this.physics.resume();

  this.xp+=40;
  if(this.xp>=100){
   this.xp-=100;
   this.applyLevelUp();
  }

  const txt=this.add.text(
   this.player.x,this.player.y-62,
   `${rewardName}\nRELIC ACQUIRED`,
   {fontSize:'17px',color:'#ffe49b',align:'center',stroke:'#17120a',strokeThickness:3}
  ).setOrigin(0.5).setDepth(100);

  this.tweens.add({
   targets:txt,y:txt.y-35,alpha:0,duration:1300,
   onComplete:()=>txt.destroy()
  });
 }

 grantChampionRelic(id){
  this.championRelics.add(id);
  if(id==='fallenBlessing') this.fallenBlessingUsed=false;
  if(id==='soulSkull') this.nextSoulSkullAt=this.time.now+1400;
  if(id==='cursedGround') this.nextCursedGroundAt=this.time.now+4000;
 }

 updateMana(time){
  if(this.mana>=this.maxMana){
   this.mana=this.maxMana;
   this.nextManaRegenAt=0;
   return;
  }
  if(!this.nextManaRegenAt) this.nextManaRegenAt=time+this.manaRegenMs;
  while(this.mana<this.maxMana && time>=this.nextManaRegenAt){
   this.mana++;
   if(this.mana<this.maxMana) this.nextManaRegenAt+=this.manaRegenMs;
   else this.nextManaRegenAt=0;
  }
 }

 spendMana(){
  if(this.mana<=0) return false;
  const wasFull=this.mana>=this.maxMana;
  this.mana--;
  if(wasFull || !this.nextManaRegenAt) this.nextManaRegenAt=this.time.now+this.manaRegenMs;
  return true;
 }

 handleSkillInput(index){
  if(this.gameOver || this.levelChoiceOpen || this.championRewardOpen) return;
  if(this.time.now<(this.skillLockUntil||0)) return;
  if(this.mana<=0){
   this.showNoManaFeedback();
   return;
  }
  if(!this.spendMana()) return;
  if(index===1) this.castGroundTremor();
  else if(index===2) this.castLift();
  else if(index===3) this.castSpin();
  else this.mana=Math.min(this.maxMana,this.mana+1);
 }

 showNoManaFeedback(){
  if(this.time.now-(this.lastNoManaFxAt||-9999)<600) return;
  this.lastNoManaFxAt=this.time.now;
  const txt=this.add.text(this.player.x,this.player.y-48,'NO MANA',{fontSize:'14px',fontStyle:'bold',color:'#8fd8ff',stroke:'#10202d',strokeThickness:3})
   .setOrigin(0.5).setDepth(75);
  this.tweens.add({targets:txt,y:txt.y-20,alpha:0,duration:620,ease:'Quad.easeOut',onComplete:()=>txt.destroy()});
 }

 setSkillAttackPose(duration){
  this.skillLockUntil=Math.max(this.skillLockUntil||0,this.time.now+duration);
  this.playerAttackDir=this.playerDir||'down';
  this.playerAttackUntil=Math.max(this.playerAttackUntil||0,this.time.now+duration);
  const key=`player_${this.playerAttackDir}_attack`;
  if(this.playerVisual && this.playerVisual.active){
   this.playerVisualState=key;
   this.playerVisual.play(key,true);
  }
 }

 applySkillDamage(enemy,baseDamage,source,tint=0xffd77a,knockback=105){
  if(!enemy || !enemy.active || enemy.hp<=0) return false;
  if(enemy.type==='shield' && enemy.blockNext){
   enemy.blockNext=false;
   if(enemy.visual && enemy.visual.active){
    enemy.visual.setTint(0xffffff);
    this.time.delayedCall(100,()=>{ if(enemy.visual && enemy.visual.active) enemy.visual.clearTint(); });
   }
   return false;
  }
  const resolved=this.getSwordDamageAgainst ? this.getSwordDamageAgainst(enemy,baseDamage) : baseDamage;
  const killed=this.damageEnemy(enemy,resolved,source,tint);
  if(enemy.body && enemy.active){
   const angle=Phaser.Math.Angle.Between(this.player.x,this.player.y,enemy.x,enemy.y);
   this.applyEnemyHitReaction(enemy,angle,knockback);
  }
  if(enemy.type==='shield') enemy.blockNext=true;
  return killed;
 }

 castGroundTremor(){
  const radius=190;
  // Ground Tremor is primarily an escape / space-making tool, not a damage nuke.
  const damage=this.sword.damage*0.4;
  const maxPushDistance=220;
  const pushMs=430;
  this.setSkillAttackPose(520);
  const x=this.player.x,y=this.player.y;
  const core=this.add.circle(x,y,34,0xe0b85d,0.18).setStrokeStyle(4,0xf5d98c,0.92).setDepth(18);
  const wave=this.add.circle(x,y,64,0x6b4d2b,0.06).setStrokeStyle(6,0xd5a84f,0.86).setDepth(17);
  this.tweens.add({targets:core,scale:1.8,alpha:0,duration:300,onComplete:()=>core.destroy()});
  this.tweens.add({targets:wave,scale:radius/64,alpha:0,duration:380,ease:'Quad.easeOut',onComplete:()=>wave.destroy()});
  this.cameras.main.shake(220,0.008);
  for(const enemy of this.enemies){
   if(!enemy.active || enemy.hp<=0) continue;
   const d=Phaser.Math.Distance.Between(x,y,enemy.x,enemy.y);
   if(d>radius+(enemy.hitRadius||0)) continue;

   this.applySkillDamage(enemy,damage,'skill:tremor',0xffd77a,0);
   if(!enemy.active || enemy.hp<=0 || !enemy.body) continue;

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
 }

 castLift(){
  const radius=175;
  const liftMs=1450;
  const initialDamage=this.sword.damage*1.0;
  const landingDamage=this.sword.damage*1.0;
  this.setSkillAttackPose(650);
  const x=this.player.x,y=this.player.y;
  const field=this.add.circle(x,y,58,0x75b7ff,0.09).setStrokeStyle(4,0x9dd7ff,0.82).setDepth(16);
  this.tweens.add({targets:field,scale:radius/58,alpha:0,duration:560,ease:'Sine.easeOut',onComplete:()=>field.destroy()});

  // The ground impact is meant to feel heavy, separate from the landing hit.
  this.cameras.main.shake(220,0.008);
  let liftedAny=false;

  for(const enemy of this.enemies){
   if(!enemy.active || enemy.hp<=0) continue;
   const d=Phaser.Math.Distance.Between(x,y,enemy.x,enemy.y);
   if(d>radius+(enemy.hitRadius||0)) continue;
   this.applySkillDamage(enemy,initialDamage,'skill:lift',0x9dd7ff,20);
   if(!enemy.active || enemy.hp<=0) continue;
   liftedAny=true;

   enemy.skillLiftStartAt=this.time.now;
   enemy.skillLiftUntil=this.time.now+liftMs;
   enemy.skillLiftHeight=Phaser.Math.Between(132,160);
   enemy.skillLiftDriftX=Phaser.Math.Between(-28,28);
   enemy.skillLiftDriftY=Phaser.Math.Between(-16,16);
   // 0 = tilted float, 1 = half flip, 2 = full tumble. Different enemies
   // therefore read as loose bodies rather than identical vertical puppets.
   enemy.skillLiftMotion=Phaser.Math.Between(0,2);
   enemy.skillLiftTilt=Phaser.Math.FloatBetween(-0.42,0.42);
   enemy.staggerUntil=Math.max(enemy.staggerUntil||0,enemy.skillLiftUntil+220);
   if(enemy.body) enemy.body.setVelocity(enemy.skillLiftDriftX,enemy.skillLiftDriftY);

   this.time.delayedCall(liftMs,()=>{
    if(!enemy || !enemy.active || enemy.hp<=0) return;
    enemy.skillLiftUntil=0;
    if(enemy.visual && enemy.visual.active){
     enemy.visual.setRotation(0);
     enemy.visual.setScale(enemy.visualBaseScale||enemy.visual.scaleX||0.5);
    }
    this.applySkillDamage(enemy,landingDamage,'skill:lift-landing',0xb9e5ff,115);
    const impact=this.add.circle(enemy.x,enemy.y,18,0x9dd7ff,0.12).setStrokeStyle(3,0xd9f1ff,0.8).setDepth(17);
    this.tweens.add({targets:impact,scale:2.35,alpha:0,duration:290,onComplete:()=>impact.destroy()});
   });
  }

  // All lifted enemies land together, so one strong shake reads better than
  // stacking a separate camera shake for every mob.
  if(liftedAny){
   this.time.delayedCall(liftMs,()=>{
    if(!this.gameOver) this.cameras.main.shake(260,0.009);
   });
  }
 }

 castSpin(){
  const radius=132;
  const perHit=this.sword.damage*0.70;
  const x0=this.player.x,y0=this.player.y;
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

 damageEnemy(enemy,amount,source='effect',tint=0x8cff77){
  if(!enemy || !enemy.active || enemy.hp<=0 || amount<=0) return false;

  const applied=Math.max(1,Math.round(amount));
  enemy.hp-=applied;

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

   const tick=this.add.text(
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

  const txt=this.add.text(
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

 damagePlayer(amount,source='enemy'){
  if(this.gameOver || amount<=0) return false;

  if(
   this.championRelics.has('shieldFragment') &&
   this.time.now-this.lastShieldRelicBlockAt>=20000
  ){
   this.lastShieldRelicBlockAt=this.time.now;
   const block=this.add.circle(this.player.x,this.player.y,22,0xe6f1ff,0.18)
    .setStrokeStyle(4,0xe6f1ff,0.95).setDepth(30);
   this.tweens.add({targets:block,scale:1.9,alpha:0,duration:260,onComplete:()=>block.destroy()});
   return false;
  }

  let finalDamage=amount;
  if(this.championRelics.has('ironWill') && this.player.hp<=35){
   finalDamage=Math.max(1,Math.round(finalDamage*0.70));
  }

  if(this.championRelics.has('necromancerSoul')){
   this.killStreakBonus=0;
  }

  if(
   this.championRelics.has('fallenBlessing') &&
   !this.fallenBlessingUsed &&
   this.player.hp-finalDamage<=0
  ){
   this.fallenBlessingUsed=true;
   this.player.hp=30;
   this.applyPlayerHitFeedback(finalDamage);
   this.cameras.main.flash(320,255,230,160,false);
   this.showWaveBanner('FALLEN BLESSING','Death refused — 30 HP restored','#fff0b0');
   return false;
  }

  this.player.hp=Math.max(0,this.player.hp-finalDamage);
  this.applyPlayerHitFeedback(finalDamage);

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
   this.damagePlayer(4,'reflection');
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
    this.damageEnemy(enemy,18,'holyFragment',0xffed9a);
    const angle=Phaser.Math.Angle.Between(this.player.x,this.player.y,enemy.x,enemy.y);
    this.applyEnemyHitReaction(enemy,angle,75);
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
    this.damageEnemy(target,13,'soulSkull',0x69ff87);
    const orb=this.add.circle(this.player.x,this.player.y-24,7,0x69ff87,0.90).setDepth(24);
    this.tweens.add({
     targets:orb,x:target.x,y:target.y-8,duration:220,ease:'Quad.easeIn',
     onComplete:()=>{ if(orb.active) orb.destroy(); }
    });
   }
  }

  if(this.championRelics.has('cursedGround') && time>=this.nextCursedGroundAt){
   this.nextCursedGroundAt=time+30000;
   this.createRelicZone(this.player.x,this.player.y,82,6000,8,0x8fd45a,'cursedGround');
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

  if(this.championRelics.has('greenCurse') && Math.random()<0.30){
   this.createRelicZone(x,y,56,4600,6,0x4cff6a,'poison');
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
    this.damageEnemy(target,16,'rootHeart',0xb9e27f);
    target.staggerUntil=Math.max(target.staggerUntil||0,this.time.now+220);
    const root=this.add.rectangle(target.x,target.y+8,5,34,0xa8ce6b,0.9).setDepth(17);
    this.tweens.add({targets:root,y:root.y-18,alpha:0,duration:260,onComplete:()=>root.destroy()});
   }
  }
 }

 onChampionDefeated(enemy){
  const kind=enemy.championKind;
  this.activeChampion=null;
  this.championEventActive=false;
  this.championNameText.setVisible(false);
  this.championHpBack.setVisible(false);
  this.championHpFill.setVisible(false);

  for(const h of this.championHazards){
   if(h.visual && h.visual.active) h.visual.destroy();
  }
  this.championHazards=[];

  this.cameras.main.flash(300,230,200,110,false);

  // Defeating a champion opens the thematic passage to the next region.
  this.requestWorldAdvance(kind);
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
  if(!enemy || enemy.type==='champion') return enemy?.speed||0;

  if(enemy.emptyScreenRush){
   return (enemy.speed||0)*PURSUIT.EMPTY_SCREEN_SPEED_MULTIPLIER;
  }

  return enemy.speed||0;
 }

 configureEnemyCollision(enemy,padding=4){
  if(!enemy || !enemy.body) return;
  const radius=(enemy.hitRadius || 14)+padding;
  enemy.body.setCircle(radius);
  enemy.body.setOffset(-radius,-radius);
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
  if(enemyType==='champion') return 'champion';
  return 'skeleton';
 }

 getEnemyAttackAction(enemyType){
  return enemyType==='mage' ? 'cast' : 'attack';
 }

 getWaveProfile(wave){
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

 showWaveBanner(title,subtitle,color='#fff06a'){
  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.showEventBanner==='function'){
   hudScene.showEventBanner(title,subtitle,color);
   return;
  }
  for(const obj of this.waveBannerObjects){ if(obj && obj.destroy) obj.destroy(); }
  this.waveBannerObjects=[];
  const {cx,cy}=this.getUiMetrics();
  const titleText=this.add.text(cx,cy-65,title,{fontSize:'34px',color,stroke:'#101610',strokeThickness:5}).setOrigin(0.5).setDepth(190).setScrollFactor(0).setAlpha(0);
  const subText=this.add.text(cx,cy-25,subtitle,{fontSize:'16px',color:'#ffffff',stroke:'#101610',strokeThickness:3}).setOrigin(0.5).setDepth(190).setScrollFactor(0).setAlpha(0);
  this.waveBannerObjects=[titleText,subText];
  this.tweens.add({targets:[titleText,subText],alpha:1,duration:180,hold:850,yoyo:true,onComplete:()=>{
   for(const obj of this.waveBannerObjects){ if(obj && obj.active) obj.destroy(); }
   this.waveBannerObjects=[];
  }});
 }

 startWave(wave,initial=false){
  this.wave=wave;
  this.spawned=0;
  this.waveIntermission=false;
  this.waveProfile=this.getWaveProfile(wave);
  this.waveSpawnInterval=this.waveProfile.spawnInterval;
  const baseTarget=wave===1 ? 10 : 8+wave*3;
  const championKind=this.getChampionForWave(wave);
  this.championEventActive=Boolean(championKind);

  const populationScale=championKind ? 0.70 : 1;
  this.waveTarget=Math.max(
   1,
   Math.ceil((baseTarget+this.waveProfile.targetBonus)*populationScale)
  );

  this.waveText.setText(`WAVE ${wave}`);
  this.waveSubText.setText(championKind ? 'CHAMPION EVENT' : this.waveProfile.name);
  if(!initial) this.lastSpawn=this.time.now-250;

  if(championKind){
   const def=this.getChampionDefinition(championKind);
   const region=this.getWorldProgressName();
   this.showWaveBanner(
    'CHAMPION APPROACHES',
    `${def.name} · ${region} · ordinary enemies -30%`,
    def.rewardColor
   );
   this.time.delayedCall(1100,()=>{
    if(!this.gameOver && this.wave===wave){
     this.spawnChampion(championKind);
    }
   });
  } else {
   this.showWaveBanner(`WAVE ${wave}`,`${this.waveProfile.name} · ${this.waveProfile.subtitle}`);
  }
 }

 beginWaveIntermission(time){
  if(this.waveIntermission) return;
  this.waveIntermission=true;
  this.nextWaveAt=time+2200;
  this.waveSubText.setText('BREATHER');
  this.showWaveBanner('WAVE CLEARED','Next assault in 2 seconds','#bfe8ff');
 }

 applyEnemyHitReaction(enemy,angle,baseForce=120){
  if(!enemy || !enemy.active || !enemy.body) return;
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
  if(this.time.now-this.lastPlayerHitAt>90){
   this.cameras.main.shake(45,0.0024);
   this.lastPlayerHitAt=this.time.now;
  }
  const dmg=this.add.text(this.player.x+Phaser.Math.Between(-8,8),this.player.y-34,`-${damage}`,{fontSize:'15px',color:'#ffb0a6',stroke:'#351010',strokeThickness:3})
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

 applyLevelUp(){
  this.level++;
  this.openLevelChoices();
 }

 openLevelChoices(){
  if(this.levelChoiceOpen) return;

  this.levelChoiceOpen=true;
  this.physics.pause();

  const choices=[
   ['⚔ Sword Damage +20%',()=>{
    this.weaponLevels.sword++;
    this.sword.level=this.weaponLevels.sword;
    this.sword.damage=Math.round(this.sword.damage*1.2);
   }],
   ['⚡ Sword Speed +15%',()=>{
    this.weaponLevels.sword++;
    this.sword.level=this.weaponLevels.sword;
    this.sword.cooldown=Math.max(250,Math.round(this.sword.cooldown*0.85));
   }],
   ['🌀 Sword Radius +25',()=>{
    this.weaponLevels.sword++;
    this.sword.level=this.weaponLevels.sword;
    this.sword.radius=Math.min(180,this.sword.radius+25);
   }]
  ];

  this.currentLevelChoices=choices;

  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.showLevelChoices==='function'){
   hudScene.showLevelChoices(this.level,choices.map(([label])=>label));
   this.levelChoiceObjects=[];
   return;
  }

  const {cx,cy}=this.getUiMetrics();
  const panel=this.add.rectangle(cx,cy,520,260,0x000000,0.85).setDepth(200).setScrollFactor(0);
  const title=this.add.text(cx,cy-95,`LEVEL ${this.level} - CHOOSE UPGRADE`,{fontSize:'26px',color:'#fff06a'})
   .setOrigin(0.5).setDepth(201).setScrollFactor(0);

  this.levelChoiceObjects=[panel,title];

  choices.forEach((c,i)=>{
   const b=this.add.text(
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

 selectLevelChoice(index){
  if(!this.levelChoiceOpen) return;
  const choice=this.currentLevelChoices[index];
  if(!choice) return;
  choice[1]();
  this.closeLevelChoices();
 }

 closeLevelChoices(){
  const hudScene=this.scene.get('HUDScene');
  if(hudScene && typeof hudScene.hideLevelChoices==='function') hudScene.hideLevelChoices();

  for(const o of this.levelChoiceObjects){
   if(o && o.destroy) o.destroy();
  }

  this.levelChoiceObjects=[];
  this.currentLevelChoices=[];
  this.levelChoiceOpen=false;
  this.physics.resume();

  const txt=this.add.text(
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

 endRun(){
  if(this.gameOver) return;

  this.gameOver=true;
  this.player.body.setVelocity(0,0);
  this.playerVisualState=`player_${this.playerDir}_idle`;
  this.playerVisual.play(this.playerVisualState,true);

  for(const enemy of this.enemies){
   if(enemy.active && enemy.body){
    enemy.body.setVelocity(0,0);
   }
  }

  for(const projectile of this.projectiles){
   if(projectile.active && projectile.body){
    projectile.body.setVelocity(0,0);
   }
  }

  if(this.activeAttackFx && this.activeAttackFx.active){
   this.activeAttackFx.destroy();
   this.activeAttackFx=null;
  }

  this.gameOverPanel.setVisible(true);
  this.gameOverText.setText(
   `GAME OVER\nWave ${this.wave}  •  Kills ${this.kills}\nPress R to restart`
  ).setVisible(true);
 }

 update(time){
  if(this.levelChoiceOpen || this.championRewardOpen){
   return;
  }


  if(this.gameOver){
   if(Phaser.Input.Keyboard.JustDown(this.restartKey)){
    this.scene.restart();
   }
   return;
  }

  this.updateMana(time);

  if(Phaser.Input.Keyboard.JustDown(this.skillKeys.skill1)) this.handleSkillInput(1);
  if(Phaser.Input.Keyboard.JustDown(this.skillKeys.skill2)) this.handleSkillInput(2);
  if(Phaser.Input.Keyboard.JustDown(this.skillKeys.skill3)) this.handleSkillInput(3);

  // Keep world lists accurate before progression checks.
  this.enemies=this.enemies.filter(e=>e && e.active);

  let vx=0,vy=0;
  let s=220;

  if(time<this.playerSlowUntil){
   s*=this.playerSlowFactor||0.45;
  } else {
   this.playerSlowFactor=1;
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
  }

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

  const playerMoving=Math.abs(vx)+Math.abs(vy)>0;
  this.playerDir=this.getDirectionFromVector(
   vx,
   vy,
   this.playerDir
  );

  if(time>=this.playerAttackUntil){
   const nextPlayerKey=`player_${this.playerDir}_${
    playerMoving ? 'walk' : 'idle'
   }`;

   if(this.playerVisualState!==nextPlayerKey){
    this.playerVisualState=nextPlayerKey;
    this.playerVisual.play(nextPlayerKey,true);
   }
  }

  this.updateWorldRegion();
  this.updateWorldStreaming();

  if(this.waveIntermission){
   if(this.awaitingWorldAdvance){
    this.updateWorldTravel(time);
   } else if(time>=this.nextWaveAt){
    this.startWave(this.wave+1);
   }
  } else {
   if(this.spawned<this.waveTarget && time-this.lastSpawn>this.waveSpawnInterval){
    this.lastSpawn=time;
    this.spawnEnemy();
    this.spawned++;
   }
   if(
    this.spawned>=this.waveTarget &&
    this.enemies.length===0 &&
    !this.activeChampion
   ){
    if(this.pendingWorldAdvance){
     this.beginWorldTravel();
    } else {
     this.beginWaveIntermission(time);
    }
   }
  }

  this.updateChampionHazards(time);
  this.updateRelics(time);
  this.sword.update(time,this.enemies);

  this.updateEmptyScreenRush();

  // Crowd melee rule: at most the four closest ordinary skeletons are allowed
  // to deal contact damage at once. The rest still chase and surround the player.
  // This keeps a mob dangerous without turning a full surround into instant death.
  const skeletonAttackSlots=new Set(
   this.enemies
    .filter(e=>e.active && e.type==='skeleton')
    .sort((a,b)=>
     Phaser.Math.Distance.Squared(a.x,a.y,this.player.x,this.player.y)-
     Phaser.Math.Distance.Squared(b.x,b.y,this.player.x,this.player.y)
    )
    .slice(0,4)
  );

  for(const e of this.enemies){
   if(!e.active) continue;

   let a=Phaser.Math.Angle.Between(
    e.x,e.y,this.player.x,this.player.y
   );

   const distance=Phaser.Math.Distance.Between(
    e.x,e.y,this.player.x,this.player.y
   );

   const pursuitSpeed=this.getEnemyMovementSpeed(e);

   if(time<(e.skillTremorUntil||0)){
    e.body.setVelocity(e.skillTremorVX||0,e.skillTremorVY||0);
   } else if(time<(e.skillLiftUntil||0)){
    e.body.setVelocity(e.skillLiftDriftX||0,e.skillLiftDriftY||0);
   } else if(time<(e.staggerUntil||0)){
    e.body.setVelocity(e.knockbackVX||0,e.knockbackVY||0);
    e.knockbackVX*=0.82;
    e.knockbackVY*=0.82;
   } else if(e.type==='champion'){
    this.updateChampion(e,time,a,distance);
   } else if(e.type==='mage'){
    if(distance>210){
     e.body.setVelocity(Math.cos(a)*pursuitSpeed,Math.sin(a)*pursuitSpeed);
    } else if(distance<160){
     e.body.setVelocity(-Math.cos(a)*pursuitSpeed,-Math.sin(a)*pursuitSpeed);
    } else {
     e.body.setVelocity(0,0);
    }

    const activeMageShots=this.projectiles.filter(
     projectile=>projectile.active && projectile.owner===e
    ).length;

    if(time-e.lastShot>1600 && activeMageShots<2){
     e.lastShot=time;
     e.attackAnimUntil=time+520;
     e.attackDir=e.dir;

     if(e.visual && e.visual.active){
      const castKey=`mage_${e.attackDir}_cast`;
      if(e.visualState!==castKey){
       e.visualState=castKey;
       e.visual.play(castKey,true);
      }
     }

     const shotAngle=Phaser.Math.Angle.Between(
      e.x,e.y,this.player.x,this.player.y
     );

     const projectile=this.add.sprite(
      e.x,e.y,'mage_projectile_00'
     ).setOrigin(0.5).setDepth(18).setRotation(shotAngle);
     projectile.play('mage_projectile_fly');
     this.physics.add.existing(projectile);
     projectile.body.setVelocity(
      Math.cos(shotAngle)*150,
      Math.sin(shotAngle)*150
     );
     projectile.damage=8;
     projectile.born=time;
     projectile.owner=e;

     this.projectiles.push(projectile);
    }
   } else {
    const hasMeleeSlot=e.type!=='skeleton' || skeletonAttackSlots.has(e);

    if(e.type==='skeleton'){
     // Front-line skeletons stop at a readable melee distance instead of
     // walking into the player's center. Skeletons without one of the four
     // melee slots form a second ring slightly farther out.
     const desiredRange=hasMeleeSlot ? 56 : 76;
     const deadZone=4;

     if(time<e.attackAnimUntil){
      e.body.setVelocity(0,0);
     } else if(distance>desiredRange+deadZone){
      e.body.setVelocity(Math.cos(a)*pursuitSpeed,Math.sin(a)*pursuitSpeed);
     } else if(distance<desiredRange-deadZone){
      // If crowd pressure pushes a skeleton inside its ring, gently push it
      // back out rather than letting bodies stack on the hero.
      const retreatSpeed=Math.max(34,pursuitSpeed*0.55);
      e.body.setVelocity(-Math.cos(a)*retreatSpeed,-Math.sin(a)*retreatSpeed);
     } else {
      e.body.setVelocity(0,0);
     }
    } else if(e.type==='shield' && time<e.attackAnimUntil){
     e.body.setVelocity(0,0);
    } else {
     e.body.setVelocity(Math.cos(a)*pursuitSpeed,Math.sin(a)*pursuitSpeed);
    }

    const attackRange=e.type==='skeleton'
     ? 62
     : (this.player.hitRadius||16)+(e.hitRadius||14)+8;
    const attackDamage=e.attackDamage || 5;

    if(hasMeleeSlot && distance<=attackRange && time-e.lastAttack>1000){
     e.lastAttack=time;

     if(e.type==='skeleton' || e.type==='shield'){
      e.attackAnimUntil=time+500;
      e.attackDir=e.dir;
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

     if(this.damagePlayer(attackDamage,`melee:${e.type}`)){
      return;
     }
    }
   }

   this.applyBrokenSaintCrowdKeepout(e);

   if(e.auraVisual && e.auraVisual.active){
    e.auraVisual.setPosition(e.x,e.y);
   }
   if(e.reflectVisual && e.reflectVisual.active){
    e.reflectVisual.setPosition(e.x,e.y-8);
   }

   if(e.shadowVisual && e.shadowVisual.active){
    e.shadowVisual.setPosition(e.x,e.y+(e.hitRadius||14)*0.82);
   }

   if(e.visual && e.visual.active){
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
    const isBrokenSaint=e.type==='champion' && e.championKind==='brokenSaint';
    e.dir=isBrokenSaint
     ? this.getEightDirectionFromVector(
       this.player.x-e.x,
       this.player.y-e.y,
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

    if(e.visualState!==enemyAnimKey){
     e.visualState=enemyAnimKey;
     e.visual.play(enemyAnimKey,true);
    }
   }

   if(e.type==='champion' && e===this.activeChampion){
    this.updateChampionBar();
   }

   if(e.hp<=0){
    const deathX=e.x;
    const deathY=e.y;
    const enemyType=e.type;
    const orbCount=enemyType==='champion' ? 0 : 1;

    for(let i=0;i<orbCount;i++){
     const offsetX=Phaser.Math.Between(-18,18);
     const offsetY=Phaser.Math.Between(-18,18);
     const orb=this.add.image(
      deathX+offsetX,
      deathY+offsetY,
      'xp_crystal'
     ).setDepth(12);
     this.physics.add.existing(orb);
     this.orbs.push(orb);
    }

    if(Math.random()<0.10){
     const heart=this.add.image(
      deathX,deathY,'health_heart'
     ).setDepth(12);
     this.physics.add.existing(heart);
     heart.expiresAt=time+30000;
     this.hearts.push(heart);
    }

    this.onEnemyKilled(e,deathX,deathY);

    if(enemyType==='champion'){
     this.onChampionDefeated(e);
    }

    this.createDeathBurst(e,deathX,deathY);

    if(e.visual && e.visual.active){
     e.visual.destroy();
    }
    if(e.auraVisual && e.auraVisual.active){
     e.auraVisual.destroy();
    }
    if(e.reflectVisual && e.reflectVisual.active){
     e.reflectVisual.destroy();
    }
    this.destroyEnemyReadabilityShadow(e);

    e.destroy();
    this.kills++;
   }
  }

  for(const o of this.orbs){
   if(o.active && Phaser.Math.Distance.Between(o.x,o.y,this.player.x,this.player.y)<40){
    this.xp+=10;
    o.destroy();
    if(this.xp>=100){
     this.xp-=100;
     this.applyLevelUp();
    }
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

   if(heartDistance<38){
    const healAmount=this.championRelics.has('ancientBlood') ? 45 : 30;
    const hpBefore=this.player.hp;
    this.player.hp=Math.min(
     100,
     this.player.hp+healAmount
    );

    const healed=this.player.hp-hpBefore;
    if(healed>0){
     const healText=this.add.text(
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

  for(const projectile of this.projectiles){
   if(!projectile.active) continue;

   const projectileDistance=Phaser.Math.Distance.Between(
    projectile.x,projectile.y,
    this.player.x,this.player.y
   );

   if(projectileDistance<(this.player.hitRadius+10)){
    const lethal=this.damagePlayer(projectile.damage,'mageProjectile');
    projectile.destroy();

    if(lethal){
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

  const aliveMages=this.enemies.filter(e=>e.active && e.type==='mage').length;
  const aliveShields=this.enemies.filter(e=>e.active && e.type==='shield').length;
  const aliveChampions=this.enemies.filter(e=>e.active && e.type==='champion').length;
  const aliveSkeletons=this.enemies.filter(e=>e.active && e.type==='skeleton').length;

  this.hud.setText(
   `Wave: ${this.wave} (${this.waveProfile ? this.waveProfile.name : '---'})\nHP: ${this.player.hp}\nLevel: ${this.level}\nXP: ${this.xp}\nKills: ${this.kills}\nSword Lv${this.sword.level}: ${this.sword.damage} dmg / ${this.sword.cooldown}ms / R${this.sword.radius}\nMage alive: ${aliveMages} / spawned: ${this.mageSpawned}\nShield alive: ${aliveShields} / spawned: ${this.shieldSpawned}\nChampion alive: ${aliveChampions} / spawned: ${this.championSpawned}\nSkeleton alive: ${aliveSkeletons} / spawned: ${this.skeletonSpawned}\nRelics: ${Array.from(this.championRelics).join(', ') || 'none'}\nSoul stacks: ${this.championRelics.has('necromancerSoul') ? this.killStreakBonus : '-'}  Iron Will: ${this.championRelics.has('ironWill') && this.player.hp<=35 ? 'ACTIVE' : '-'}\nRegion: ${this.getWorldProgressName()}  Progress: ${Math.round(this.getZoneTravelProgress()*100)}%\nGates open: ${this.unlockedWorldGates.size}/4  Back seals: ${this.closedWorldGates.size}\nEmpty-screen x4 rush: ${this.emptyScreenRushActive ? 'ACTIVE' : '-'}\nWorld: ${Math.round(this.player.x)},${Math.round(this.player.y)}  View: ${Math.round(this.cameras.main.worldView.width)}x${Math.round(this.cameras.main.worldView.height)}\nProjectiles: ${this.projectiles.length}\nHearts: ${this.hearts.length}\nBuild 1.0.4: melee rings + 4-skeleton pressure + Holy Mark + corner fix + x4 Rush\nR: restart after death`
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
 }

 create(){
  this.mainScene=this.mainScene || this.scene.get('main');
  this.cameras.main.setScroll(0,0).setZoom(1).setRoundPixels(true);
  this.buildHeroPanel();
  this.buildWavePanel();
  this.buildChampionPanel();
  this.buildEventBanner();
  this.buildSkillCluster();
  this.buildJoystick();
  this.buildGameOver();
  this.buildLevelChoiceOverlay();
  this.buildChampionRewardOverlay();
  this.buildFullscreenButton();

  this.scale.on('resize',this.layout,this);
  this.input.on('pointerdown',this.onPointerDown,this);
  this.input.on('pointermove',this.onPointerMove,this);
  this.input.on('pointerup',this.onPointerUp,this);
  this.input.on('pointerupoutside',this.onPointerUp,this);

  if(this.mainScene){
   this.mainScene.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
    if(this.scene && this.scene.isActive()) this.scene.stop();
   });
  }
  this.layout();
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

 addPanelGraphics(depth=10){
  const g=this.add.graphics().setDepth(depth);
  return g;
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
  // The old ornate medallion is kept loaded for compatibility but not rendered.
  this.levelBadge=addHud('level_badge_large',25).setVisible(false);
  this.levelBadgeSimple=this.add.graphics().setDepth(25);
  this.levelCaption=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'9px',fontStyle:'bold',color:'#ad9c78'}).setOrigin(0.5).setDepth(27);
  this.levelText=this.add.text(0,0,'1',{fontFamily:'Georgia, serif',fontSize:'28px',fontStyle:'bold',color:'#fff0cf',stroke:'#140d08',strokeThickness:4}).setOrigin(0.5).setDepth(27);

  this.hpFill=this.add.rectangle(0,0,200,18,0xb51f24,1).setOrigin(0,0.5).setDepth(21);
  this.hpShine=this.add.rectangle(0,0,200,4,0xff8a78,0.25).setOrigin(0,0.5).setDepth(22);
  this.hpFrame=addHud('hp_bar_frame',24);
  this.hpText=this.add.text(0,0,'100 / 100',{fontFamily:'Arial, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#fff4e8',stroke:'#24100e',strokeThickness:3}).setOrigin(0.5).setDepth(26);
  this.hpLabel=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'1px'}).setVisible(false);

  // Clean mana slots are drawn as simple vector rings; ornate housing is hidden.
  this.manaHousing=addHud('mana_housing_3slot',24).setVisible(false);
  this.manaRingsSimple=this.add.graphics().setDepth(23);
  this.manaLabel=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'1px'}).setVisible(false);
  this.manaGems=[];
  for(let i=0;i<3;i++) this.manaGems.push(this.add.image(0,0,'hero_hud_mana_bottle_blue').setDepth(25));

  this.xpFill=this.add.rectangle(0,0,190,5,0xf0bd28,1).setOrigin(0,0.5).setDepth(21);
  this.xpFrame=addHud('xp_bar_frame',24);
  this.xpLabel=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'1px'}).setVisible(false);
 }
 buildWavePanel(){
  this.wavePanel=this.addPanelGraphics(20);
  this.waveTitle=this.add.text(0,0,'WAVE 1',{fontFamily:'Arial, sans-serif',fontSize:'22px',fontStyle:'bold',color:'#f7e8c1',stroke:'#17120d',strokeThickness:4}).setOrigin(0.5).setDepth(23);
  this.waveSub=this.add.text(0,0,'ASH FIELDS',{fontFamily:'Arial, sans-serif',fontSize:'11px',fontStyle:'bold',color:'#b9b6aa',letterSpacing:1}).setOrigin(0.5).setDepth(23);
 }

 buildChampionPanel(){
  this.championPanel=this.addPanelGraphics(30).setVisible(false);
  this.bossName=this.add.text(0,0,'BROKEN SAINT',{fontFamily:'Arial, sans-serif',fontSize:'20px',fontStyle:'bold',color:'#f5d78f',stroke:'#17100a',strokeThickness:4}).setOrigin(0.5).setDepth(33).setVisible(false);
  this.bossHpBack=this.add.rectangle(0,0,500,22,0x130f0d,0.96).setStrokeStyle(2,0x8d7445,1).setDepth(32).setVisible(false);
  this.bossHpFill=this.add.rectangle(0,0,494,14,0xc59b46,1).setOrigin(0,0.5).setDepth(33).setVisible(false);
  this.bossHpText=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#fff2cf',stroke:'#16100a',strokeThickness:3}).setOrigin(0.5).setDepth(34).setVisible(false);
 }

 buildEventBanner(){
  this.eventBannerPanel=this.addPanelGraphics(88).setVisible(false);
  this.eventBannerTitle=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'30px',fontStyle:'bold',color:'#fff06a',stroke:'#101610',strokeThickness:5,align:'center'}).setOrigin(0.5).setDepth(90).setVisible(false);
  this.eventBannerSub=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'15px',color:'#ffffff',stroke:'#101610',strokeThickness:3,align:'center'}).setOrigin(0.5).setDepth(90).setVisible(false);
  this.eventBannerTween=null;
 }

 showEventBanner(title,subtitle,color='#fff06a'){
  // MainScene can request the first wave banner immediately after launching HUDScene.
  // Phaser exposes the HUD scene object before HUDScene.create() has finished, so queue
  // the request until the banner objects actually exist instead of touching undefined UI.
  if(!this.eventBannerTitle || !this.eventBannerSub || !this.eventBannerPanel){
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
  const w=Math.max(1,this.scale.width),h=Math.max(1,this.scale.height);
  const mobile=Boolean(this.mainScene?.isTouchDevice || h<560 || w<900);
  const cx=w/2,cy=h/2;
  const panelW=Math.min(mobile?420:620,w-(mobile?28:64));
  const panelH=mobile?104:126;
  const x=cx-panelW/2,y=cy-panelH/2;
  const radius=mobile?9:12;
  this.eventBannerPanel.clear();
  this.eventBannerPanel.fillStyle(0x070605,0.34); this.eventBannerPanel.fillRoundedRect(x+4,y+4,panelW,panelH,radius);
  this.eventBannerPanel.fillStyle(0x15130f,0.78); this.eventBannerPanel.fillRoundedRect(x,y,panelW,panelH,radius);
  this.eventBannerPanel.lineStyle(mobile?1.5:2,0x8c7447,0.82); this.eventBannerPanel.strokeRoundedRect(x,y,panelW,panelH,radius);
  this.eventBannerTitle.setPosition(cx,cy-(mobile?15:19)).setFontSize(mobile?24:32).setWordWrapWidth(panelW-28,true);
  this.eventBannerSub.setPosition(cx,cy+(mobile?23:28)).setFontSize(mobile?12:16).setWordWrapWidth(panelW-34,true);
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
  const key=this.add.text(0,0,String(index),{fontFamily:'Arial, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#ead9ad',backgroundColor:'#18140f',padding:{x:5,y:2}}).setOrigin(0.5).setDepth(29);
  const label=this.add.text(0,0,title,{fontFamily:'Arial, sans-serif',fontSize:'11px',fontStyle:'bold',color:'#eee4cf',stroke:'#17120d',strokeThickness:3}).setOrigin(0.5,0).setDepth(29).setVisible(false);
  back.on('pointerdown',()=>{
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
  this.skillCaption=this.add.text(0,0,'SKILLS',{fontFamily:'Arial, sans-serif',fontSize:'11px',fontStyle:'bold',color:'#b6aa8e',letterSpacing:2}).setOrigin(0.5).setDepth(24).setVisible(false);
 }

 buildJoystick(){
  this.joyBack=this.add.circle(0,0,66,0x080b09,0.32).setStrokeStyle(3,0xbeb49c,0.35).setDepth(24);
  this.joyRing=this.add.circle(0,0,47,0x171b17,0.20).setStrokeStyle(2,0xd9cfbb,0.22).setDepth(25);
  this.joyKnob=this.add.circle(0,0,29,0xbeb7a6,0.28).setStrokeStyle(2,0xf3ead8,0.35).setDepth(26);
  this.joyHint=this.add.text(0,0,'MOVE',{fontFamily:'Arial, sans-serif',fontSize:'10px',fontStyle:'bold',color:'#c8c0ad'}).setOrigin(0.5).setDepth(27).setVisible(false);
 }


 buildLevelChoiceOverlay(){
  this.levelChoiceVisible=false;
  this.levelChoiceLabels=[];
  this.levelChoiceButtons=[];
  this.levelChoiceShade=this.add.rectangle(0,0,100,100,0x050403,0.58).setOrigin(0).setDepth(108).setVisible(false);
  this.levelChoicePanel=this.addPanelGraphics(109).setVisible(false);
  this.levelChoiceTitle=this.add.text(0,0,'LEVEL 2 - CHOOSE UPGRADE',{fontFamily:'Arial, sans-serif',fontSize:'24px',fontStyle:'bold',color:'#f1df97',stroke:'#17110c',strokeThickness:4}).setOrigin(0.5).setDepth(110).setVisible(false);

  for(let i=0;i<3;i++){
   const card=this.add.rectangle(0,0,100,44,0x243323,0.96).setStrokeStyle(2,0x789561,0.88).setDepth(110).setVisible(false).setInteractive({useHandCursor:true});
   const label=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'18px',fontStyle:'bold',color:'#ffffff',stroke:'#14210f',strokeThickness:3,wordWrap:{width:360,useAdvancedWrap:true},align:'center'}).setOrigin(0.5).setDepth(111).setVisible(false).setInteractive({useHandCursor:true});
   card.on('pointerover',()=>{ if(this.levelChoiceVisible) card.setFillStyle(0x30482c,1); });
   card.on('pointerout',()=>card.setFillStyle(0x243323,0.96));
   card.on('pointerdown',()=>this.mainScene?.selectLevelChoice?.(i));
   label.on('pointerdown',()=>this.mainScene?.selectLevelChoice?.(i));
   this.levelChoiceButtons.push({card,label});
  }
 }

 showLevelChoices(level,labels=[]){
  this.levelChoiceVisible=true;
  this.levelChoiceLabels=labels.slice(0,3);
  this.levelChoiceTitle.setText(`LEVEL ${level} - CHOOSE UPGRADE`);
  this.levelChoiceShade.setVisible(true);
  this.levelChoicePanel.setVisible(true);
  this.levelChoiceTitle.setVisible(true);
  this.levelChoiceButtons.forEach((entry,i)=>{
   const visible=Boolean(this.levelChoiceLabels[i]);
   entry.card.setVisible(visible).setFillStyle(0x243323,0.96);
   entry.label.setVisible(visible).setText(this.levelChoiceLabels[i] || '');
  });
  this.layoutLevelChoiceOverlay();
  this.layoutEventBanner();
 }

 hideLevelChoices(){
  this.levelChoiceVisible=false;
  this.levelChoiceLabels=[];
  this.levelChoiceShade.setVisible(false);
  this.levelChoicePanel.setVisible(false);
  this.levelChoiceTitle.setVisible(false);
  this.levelChoiceButtons.forEach(({card,label})=>{
   card.setVisible(false).setFillStyle(0x243323,0.96);
   label.setVisible(false).setText('');
  });
 }

 layoutLevelChoiceOverlay(){
  if(!this.levelChoiceVisible) return;
  const w=Math.max(1,this.scale.width),h=Math.max(1,this.scale.height);
  const mobile=Boolean(this.mainScene?.isTouchDevice || h<560 || w<900);
  const screenCx=w/2,screenCy=h/2;
  const panelW=Math.min(mobile?420:560,w-(mobile?28:64));
  const rowH=mobile?50:56;
  const gap=mobile?12:14;
  const count=Math.max(1,this.levelChoiceLabels.length || 3);
  const panelH=(mobile?106:126) + (count*rowH) + ((count-1)*gap);
  const panelX=screenCx-panelW/2,panelY=screenCy-panelH/2;
  const radius=mobile?10:12;

  this.levelChoiceShade.setPosition(0,0).setSize(w,h).setDisplaySize(w,h);
  this.levelChoicePanel.clear();
  this.levelChoicePanel.fillStyle(0x070605,0.44); this.levelChoicePanel.fillRoundedRect(panelX+5,panelY+5,panelW,panelH,radius);
  this.levelChoicePanel.fillStyle(0x15130f,0.94); this.levelChoicePanel.fillRoundedRect(panelX,panelY,panelW,panelH,radius);
  this.levelChoicePanel.lineStyle(mobile?2:2.5,0x8e7547,0.94); this.levelChoicePanel.strokeRoundedRect(panelX,panelY,panelW,panelH,radius);
  this.levelChoicePanel.lineStyle(1,0xd6bd7b,0.16); this.levelChoicePanel.strokeRoundedRect(panelX+4,panelY+4,panelW-8,panelH-8,Math.max(5,radius-4));

  this.levelChoiceTitle.setPosition(screenCx,panelY+(mobile?26:31)).setFontSize(mobile?18:24);

  const cardW=panelW-(mobile?34:48);
  const startY=panelY+(mobile?76:94);
  this.levelChoiceButtons.forEach((entry,i)=>{
   const visible=Boolean(this.levelChoiceLabels[i]);
   entry.card.setVisible(visible);
   entry.label.setVisible(visible);
   if(!visible) return;
   const y=startY+i*(rowH+gap);
   entry.card.setPosition(screenCx,y).setSize(cardW,rowH).setDisplaySize(cardW,rowH).setStrokeStyle(2,0x789561,0.88);
   entry.label.setPosition(screenCx,y).setFontSize(mobile?15:18).setWordWrapWidth(cardW-28,true);
  });
 }

 buildFullscreenButton(){
  this.fullscreenButton=this.add.circle(0,0,22,0x11100e,0.88).setStrokeStyle(2,0xc4a662,0.82).setDepth(95).setInteractive({useHandCursor:true});
  this.fullscreenIcon=this.add.graphics().setDepth(96);
  this.fullscreenButton.on('pointerdown',()=>this.toggleFullscreen());
  this.fullscreenIcon.setInteractive(new Phaser.Geom.Rectangle(-24,-24,48,48),Phaser.Geom.Rectangle.Contains);
  this.fullscreenIcon.on('pointerdown',()=>this.toggleFullscreen());
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
  this.championRewardShade=this.add.rectangle(0,0,100,100,0x050403,0.62).setOrigin(0).setDepth(118).setVisible(false);
  this.championRewardPanel=this.addPanelGraphics(119).setVisible(false);
  this.championRewardTitle=this.add.text(0,0,'CHAMPION DEFEATED',{fontFamily:'Arial, sans-serif',fontSize:'26px',fontStyle:'bold',color:'#f5d78f',stroke:'#111111',strokeThickness:4,align:'center'}).setOrigin(0.5).setDepth(120).setVisible(false);
  this.championRewardSubtitle=this.add.text(0,0,'CHOOSE ONE CHAMPION RELIC',{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#ffffff'}).setOrigin(0.5).setDepth(120).setVisible(false);
  this.championRewardCards=[];
  for(let i=0;i<3;i++){
   const card=this.add.rectangle(0,0,100,60,0x243323,0.96).setStrokeStyle(2,0x7f9b68,0.82).setDepth(120).setVisible(false).setInteractive({useHandCursor:true});
   const name=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'17px',fontStyle:'bold',color:'#ffe8a8'}).setOrigin(0,0.5).setDepth(121).setVisible(false);
   const desc=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'12px',color:'#dbe8d7',wordWrap:{width:460,useAdvancedWrap:true}}).setOrigin(0,0.5).setDepth(121).setVisible(false);
   card.on('pointerover',()=>{ if(this.championRewardVisible) card.setFillStyle(0x354b32,1); });
   card.on('pointerout',()=>card.setFillStyle(0x243323,0.96));
   card.on('pointerdown',()=>this.mainScene?.selectChampionReward?.(i));
   this.championRewardCards.push({card,name,desc});
  }
 }

 showChampionRewards(championName,rewardColor,choices=[]){
  this.championRewardVisible=true;
  this.championRewardData=choices.slice(0,3);
  this.championRewardTitle.setText(`${championName} DEFEATED`).setColor(rewardColor||'#f5d78f');
  this.championRewardShade.setVisible(true);
  this.championRewardPanel.setVisible(true);
  this.championRewardTitle.setVisible(true);
  this.championRewardSubtitle.setVisible(true);
  this.championRewardCards.forEach((entry,i)=>{
   const c=this.championRewardData[i];
   const visible=Boolean(c);
   entry.card.setVisible(visible).setFillStyle(0x243323,0.96);
   entry.name.setVisible(visible).setText(c?.[0]||'');
   entry.desc.setVisible(visible).setText(c?.[1]||'');
  });
  this.layoutChampionRewardOverlay();
 }

 hideChampionRewards(){
  this.championRewardVisible=false;
  this.championRewardData=[];
  this.championRewardShade.setVisible(false);
  this.championRewardPanel.setVisible(false);
  this.championRewardTitle.setVisible(false);
  this.championRewardSubtitle.setVisible(false);
  this.championRewardCards.forEach(({card,name,desc})=>{card.setVisible(false);name.setVisible(false);desc.setVisible(false);});
 }

 layoutChampionRewardOverlay(){
  if(!this.championRewardVisible) return;
  const w=Math.max(1,this.scale.width),h=Math.max(1,this.scale.height);
  const mobile=Boolean(this.mainScene?.isTouchDevice || h<560 || w<900);
  const cx=w/2,cy=h/2;
  const panelW=Math.min(mobile?560:650,w-(mobile?28:64));
  const cardH=mobile?58:66,gap=mobile?10:14;
  const panelH=(mobile?116:132)+3*cardH+2*gap;
  const x=cx-panelW/2,y=cy-panelH/2,r=mobile?10:12;
  this.championRewardShade.setPosition(0,0).setSize(w,h).setDisplaySize(w,h);
  this.championRewardPanel.clear();
  this.championRewardPanel.fillStyle(0x070605,0.46); this.championRewardPanel.fillRoundedRect(x+5,y+5,panelW,panelH,r);
  this.championRewardPanel.fillStyle(0x11100d,0.96); this.championRewardPanel.fillRoundedRect(x,y,panelW,panelH,r);
  this.championRewardPanel.lineStyle(mobile?2:2.5,0x9b7d47,0.94); this.championRewardPanel.strokeRoundedRect(x,y,panelW,panelH,r);
  this.championRewardTitle.setPosition(cx,y+(mobile?27:32)).setFontSize(mobile?20:27);
  this.championRewardSubtitle.setPosition(cx,y+(mobile?55:67)).setFontSize(mobile?11:14);
  const cardW=panelW-(mobile?30:48),startY=y+(mobile?98:112);
  this.championRewardCards.forEach((entry,i)=>{
   const c=this.championRewardData[i];
   const visible=Boolean(c);
   entry.card.setVisible(visible); entry.name.setVisible(visible); entry.desc.setVisible(visible);
   if(!visible) return;
   const yy=startY+i*(cardH+gap);
   entry.card.setPosition(cx,yy).setSize(cardW,cardH).setDisplaySize(cardW,cardH);
   const leftX=cx-cardW/2+(mobile?14:18);
   entry.name.setPosition(leftX,yy-(mobile?13:16)).setFontSize(mobile?14:17);
   entry.desc.setPosition(leftX,yy+(mobile?10:12)).setFontSize(mobile?10:12).setWordWrapWidth(cardW-(mobile?28:36),true);
  });
 }

 buildGameOver(){
  this.gameOverShade=this.add.rectangle(0,0,100,100,0x050403,0.72).setOrigin(0).setDepth(100).setVisible(false);
  this.gameOverFrame=this.add.rectangle(0,0,410,180,0x16120f,0.98).setStrokeStyle(3,0xa98649,1).setDepth(101).setVisible(false);
  this.gameOverTitle=this.add.text(0,0,'YOU HAVE FALLEN',{fontFamily:'Arial, sans-serif',fontSize:'28px',fontStyle:'bold',color:'#e6cf9a',stroke:'#1a1009',strokeThickness:4}).setOrigin(0.5).setDepth(102).setVisible(false);
  this.gameOverHint=this.add.text(0,0,'Press R to restart',{fontFamily:'Arial, sans-serif',fontSize:'15px',color:'#d1c7b5'}).setOrigin(0.5).setDepth(102).setVisible(false);
  this.restartButton=this.add.rectangle(0,0,180,44,0x2b2418,1).setStrokeStyle(2,0xc3a35d,1).setDepth(102).setVisible(false).setInteractive({useHandCursor:true});
  this.restartLabel=this.add.text(0,0,'RESTART',{fontFamily:'Arial, sans-serif',fontSize:'15px',fontStyle:'bold',color:'#f5dfad'}).setOrigin(0.5).setDepth(103).setVisible(false);
  this.restartButton.on('pointerdown',()=>{ if(this.mainScene?.gameOver) this.mainScene.scene.restart(); });
 }

 layout(){
  const w=Math.max(1,this.scale.width),h=Math.max(1,this.scale.height);
  this.safe=this.getSafeArea();
  const mobile=Boolean(this.mainScene?.isTouchDevice || h<520 || w<900);
  const left=this.safe.left+(mobile?10:22);
  const top=this.safe.top+(mobile?8:20);
  const right=w-this.safe.right-(mobile?10:24);
  const bottom=h-this.safe.bottom-(mobile?8:22);
  const screenCx=w/2;

  // Fullscreen stays in the safe upper-right corner on every viewport.
  if(this.fullscreenButton){
   const fsR=mobile?19:22;
   const fsX=right-fsR,fsY=top+fsR;
   this.fullscreenButton.setPosition(fsX,fsY).setRadius(fsR).setStrokeStyle(mobile?1.5:2,0xc4a662,0.82);
   this.drawFullscreenIcon();
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
  this.levelBadgeSimple.fillStyle(0x171512,0.98);
  this.levelBadgeSimple.fillCircle(badgeX,badgeY,levelR-2);
  this.levelBadgeSimple.lineStyle(Math.max(2,Math.round(4*uiScale)),0xd39a35,1);
  this.levelBadgeSimple.strokeCircle(badgeX,badgeY,levelR-2);
  this.levelBadgeSimple.lineStyle(Math.max(1,Math.round(1*uiScale)),0xffd47a,0.62);
  this.levelBadgeSimple.strokeCircle(badgeX,badgeY,Math.max(4,levelR-Math.max(5,Math.round(7*uiScale))));
  this.levelBadge.setVisible(false);
  this.levelCaption.setVisible(false);
  this.levelText.setPosition(badgeX,badgeY).setFontSize(Math.max(15,Math.round(31*uiScale)));

  // HP stays the primary visual element on the top row.
  const hpSrc=this.hpFrame.frame;
  const hpAspect=(hpSrc?.realWidth||351)/(hpSrc?.realHeight||119);
  const hpW=Math.round(contentW);
  const hpH=Math.max(20,Math.round(hpW/hpAspect));
  const hpY=topRowY;
  this.hpFrame.setPosition(Math.round(contentLeft+hpW/2),hpY).setDisplaySize(hpW,hpH);
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
  this.xpFill.setPosition(xpInnerX,xpY).setSize(xpInnerW,xpInnerH).setDisplaySize(xpInnerW,xpInnerH);

  // One restrained dark backplate; 50% opacity and fitted tightly around HP + XP.
  const xpBottom=Math.round(xpY+xpH*0.5);
  const shellBottomPad=Math.max(4,Math.round(7*uiScale));
  const bodyH=Math.round((xpBottom+shellBottomPad)-bodyY);
  this.heroPanelShell.fillStyle(0x080706,0.50);
  this.heroPanelShell.fillRoundedRect(bodyX,bodyY,bodyW,bodyH,shellRadius);
  this.heroPanelShell.lineStyle(Math.max(1,Math.round(1.5*uiScale)),0x8f743b,0.58);
  this.heroPanelShell.strokeRoundedRect(bodyX,bodyY,bodyW,bodyH,shellRadius);

  // Mana: three independent simple gold rings, centered beneath the backplate.
  this.manaHousing.setVisible(false);
  this.manaRingsSimple.clear();
  const manaPanelGap=Math.max(6,Math.round(8*uiScale));
  const manaR=Math.max(13,Math.round(25*uiScale));
  const manaY=Math.round(bodyY+bodyH+manaPanelGap+manaR);
  const ringGap=Math.max(8,Math.round(12*uiScale));
  const clusterW=manaR*6+ringGap*2;
  const clusterCx=Math.round(bodyX+bodyW*0.5);
  const manaCenters=[clusterCx-(manaR*2+ringGap),clusterCx,clusterCx+(manaR*2+ringGap)];
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
  this.wavePanel.fillStyle(0x15130f,0.90); this.wavePanel.fillRoundedRect(waveX,waveY,waveW,waveH,mobile?7:9);
  this.wavePanel.lineStyle(mobile?1.5:2,0x7c6842,0.9); this.wavePanel.strokeRoundedRect(waveX,waveY,waveW,waveH,mobile?7:9);
  this.waveTitle.setPosition(cx,waveY+(mobile?15:20)).setFontSize(mobile?14:21);
  this.waveSub.setPosition(cx,waveY+(mobile?34:44)).setFontSize(mobile?8:10);

  const bossW=Math.min(mobile?260:360,w-this.safe.left-this.safe.right-(mobile?24:40));
  const bossH=waveH;
  const bossX=screenCx-bossW/2,bossY=waveY;
  this.championPanel.clear();
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
  const goH=mobile?142:180;
  this.gameOverFrame.setPosition(screenCx,h/2).setSize(goW,goH).setDisplaySize(goW,goH);
  this.gameOverTitle.setPosition(screenCx,h/2-(mobile?20:25)).setFontSize(mobile?20:26);
  this.gameOverHint.setPosition(screenCx,h/2+(mobile?14:20)).setFontSize(mobile?11:13);
  this.restartButton.setPosition(screenCx,h/2+(mobile?49:66)).setSize(mobile?150:180,mobile?38:44).setDisplaySize(mobile?150:180,mobile?38:44).setStrokeStyle(2,0xc3a35d,1);
  this.restartLabel.setPosition(screenCx,h/2+(mobile?49:66)).setFontSize(mobile?12:14);

  this.layoutLevelChoiceOverlay();
  this.layoutEventBanner();
  this.layoutChampionRewardOverlay();
 }

 onPointerDown(pointer){
  if(!this.mainScene?.isTouchDevice || !this.joyCenter || this.movePointerId!==null || this.levelChoiceVisible || this.championRewardVisible || this.mainScene?.gameOver) return;
  const w=Math.max(1,this.scale.width);
  // Any press that STARTS on the left half becomes the movement pointer.
  if(pointer.x>w*0.5) return;
  this.movePointerId=pointer.id;
  this.joyTouchOrigin={x:pointer.x,y:pointer.y};
  this.mainScene.mobileMoveX=0;
  this.mainScene.mobileMoveY=0;
  this.joyKnob.setPosition(this.joyCenter.x,this.joyCenter.y);
 }

 onPointerMove(pointer){
  if(pointer.id===this.movePointerId) this.updateJoystick(pointer);
 }

 onPointerUp(pointer){
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
  const dx=pointer.x-this.joyTouchOrigin.x,dy=pointer.y-this.joyTouchOrigin.y;
  const len=Math.max(0.001,Math.hypot(dx,dy));
  const max=this.joyCenter.r*0.62;
  const k=Math.min(1,max/len);
  this.joyKnob.setPosition(this.joyCenter.x+dx*k,this.joyCenter.y+dy*k);
  const deadzone=Math.max(8,this.joyCenter.r*0.13);
  if(len<deadzone){this.mainScene.mobileMoveX=0;this.mainScene.mobileMoveY=0;}
  else {this.mainScene.mobileMoveX=dx/len;this.mainScene.mobileMoveY=dy/len;}
 }

 update(){
  const m=this.mainScene;
  if(!m || !m.player) return;
  const hp=Math.max(0,Math.min(100,m.player.hp||0));
  const hpRatio=hp/100;
  const fullHpWidth=this.heroHpMaxWidth || this.hpFill.width || 1;
  this.hpFill.displayWidth=Math.max(0.1,fullHpWidth*hpRatio);
  this.hpShine.displayWidth=Math.max(0.1,fullHpWidth*hpRatio);
  this.hpText.setText(`${Math.ceil(hp)} / 100`);
  this.levelText.setText(String(m.level||1));
  const xpRatio=Phaser.Math.Clamp((m.xp||0)/100,0,1);
  this.xpFill.displayWidth=Math.max(0.1,(this.heroXpMaxWidth||this.xpFill.width||1)*xpRatio);

  this.waveTitle.setText(`WAVE ${m.wave||1}`);
  this.waveSub.setText(m.getWorldProgressName ? m.getWorldProgressName() : 'ASH FIELDS');

  const mana=Phaser.Math.Clamp(m.mana??0,0,m.maxMana??3);
  this.manaGems.forEach((gem,i)=>{
   const active=i<mana;
   gem.setAlpha(active?1:0.22);
   if(active) gem.clearTint();
   else gem.setTint(0x4a5560);
  });
  const canCast=mana>0 && !m.gameOver;
  this.skills.forEach(skill=>{
   skill.back.setAlpha(canCast?1:0.62);
   skill.inner.setAlpha(canCast?1:0.50);
   skill.icon.setAlpha(canCast?1:0.46);
  });

  const champ=m.activeChampion && m.activeChampion.active ? m.activeChampion : null;
  const bossVisible=Boolean(champ);
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

  const over=Boolean(m.gameOver);
  [this.gameOverShade,this.gameOverFrame,this.gameOverTitle,this.gameOverHint,this.restartButton,this.restartLabel].forEach(o=>o.setVisible(over));
  if(over && m.isTouchDevice) this.gameOverHint.setText('Tap restart to continue');
  else this.gameOverHint.setText('Press R or click restart');
 }
}

const DISPLAY_DPR=typeof window!=='undefined' ? Math.min(Math.max(window.devicePixelRatio||1,1),2) : 1;

new Phaser.Game({
 type:Phaser.AUTO,
 parent:'game',
 backgroundColor:'#0b160d',
 resolution:DISPLAY_DPR,
 antialias:true,
 roundPixels:true,
 scale:{mode:Phaser.Scale.RESIZE,width:1280,height:720},
 physics:{default:'arcade',arcade:{debug:false}},
 scene:[BootScene,PreloadScene,MainScene,HUDScene]
});

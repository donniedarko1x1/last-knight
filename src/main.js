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
  'ash_prop_burnt_grass_02',
  'ash_prop_burnt_grass_03',
  'ash_prop_burnt_grass_04',
  'ash_prop_burnt_grass_05',
  'ash_prop_burnt_grass_06',
  'ash_prop_burnt_grass_07',
  'ash_prop_burnt_tree_01',
  'ash_prop_burnt_tree_02',
  'ash_prop_burnt_tree_03',
  'ash_prop_burnt_tree_04',
  'ash_prop_rock_01',
  'ash_prop_rock_02',
  'ash_prop_rock_03',
  'ash_prop_rock_04'
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
  this.bg.setDisplaySize(this.scale.width,this.scale.height);
  this.bgOverlay=this.add.rectangle(0,0,this.scale.width,this.scale.height,0x060505,0.32).setOrigin(0).setDepth(1);
  this.title=this.add.text(this.scale.width/2,this.scale.height*0.18,'LAST KNIGHT',{fontFamily:'Arial, sans-serif',fontSize:'36px',fontStyle:'bold',color:'#f4e0a8',stroke:'#130d09',strokeThickness:5,letterSpacing:2}).setOrigin(0.5).setDepth(2);
  this.subtitle=this.add.text(this.scale.width/2,this.scale.height*0.18+36,'ПЕПЕЛ КОРОЛЕВСТВА',{fontFamily:'Arial, sans-serif',fontSize:'16px',fontStyle:'bold',color:'#cdb982',stroke:'#130d09',strokeThickness:3,letterSpacing:1}).setOrigin(0.5).setDepth(2);
  const frameW=Math.min(360,this.scale.width-54),frameH=20;
  const cx=this.scale.width/2,cy=this.scale.height*0.80;
  this.barBg=this.add.rectangle(cx,cy,frameW,frameH,0x100d0b,0.94).setStrokeStyle(2,0x8f7448,0.9).setDepth(2);
  this.barFill=this.add.rectangle(cx-frameW/2+4,cy,Math.max(1,frameW-8),frameH-8,0xcfa85a,1).setOrigin(0,0.5).setDepth(2);
  this.barFill.displayWidth=0;
  this.statusText=this.add.text(cx,cy+34,LOADING_SCREEN_STATUS,{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#f3e3b4',stroke:'#0b0705',strokeThickness:3}).setOrigin(0.5).setDepth(2);
  this.retryText=this.add.text(cx,cy+64,'',{fontFamily:'Arial, sans-serif',fontSize:'13px',fontStyle:'bold',color:'#ffb0a0',stroke:'#0b0705',strokeThickness:3,align:'center'}).setOrigin(0.5).setDepth(2).setInteractive({useHandCursor:true});
  this.retryText.on('pointerdown',()=>{ if(this.loadingFailed) this.scene.restart(); });
  this.scale.on('resize',this.resizeLoadingScreen,this);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.scale.off('resize',this.resizeLoadingScreen,this));
 }
 resizeLoadingScreen(){
  if(!this.bg) return;
  const w=this.scale.width,h=this.scale.height,cx=w/2,cy=h*0.80;
  this.bg.setPosition(0,0).setDisplaySize(w,h);
  this.bgOverlay.setPosition(0,0).setSize(w,h).setDisplaySize(w,h);
  this.title.setPosition(cx,h*0.18);
  this.subtitle.setPosition(cx,h*0.18+36);
  const frameW=Math.min(360,w-54),frameH=20;
  this.barBg.setPosition(cx,cy).setSize(frameW,frameH).setDisplaySize(frameW,frameH);
  this.barFill.setPosition(cx-frameW/2+4,cy).setSize(Math.max(1,frameW-8),frameH-8);
  this.statusText.setPosition(cx,cy+34);
  this.retryText.setPosition(cx,cy+64);
 }
 registerLoadingEvents(){
  this.load.on('progress',(value)=>{
   const frameW=this.barBg.width||Math.min(360,this.scale.width-54);
   this.barFill.displayWidth=Math.max(2,(frameW-8)*value);
   this.statusText.setText(`${LOADING_SCREEN_STATUS} ${Math.round(value*100)}%`);
  });
  this.load.on('filecomplete',(key)=>{
   this.statusText.setText(`Loaded ${key}`);
  });
  this.load.on('loaderror',(file)=>{
   this.loadingFailed=true;
   const key=file?.key || file?.src || 'asset';
   this.statusText.setText('Loading failed');
   this.retryText.setText(`Could not load: ${key}\nTap to retry`);
  });
  this.load.once('complete',()=>{
   if(this.loadingFailed) return;
   this.statusText.setText('Entering Ash Fields...');
   this.time.delayedCall(120,()=>this.scene.start('MainScene'));
  });
 }
}

class MainScene extends Phaser.Scene {
 constructor(){
  super('MainScene');
 }
 init(){
  this.resetRuntimeState();
 }
 resetRuntimeState(){
  this.player=null;
  this.sword=null;
  this.enemies=[];
  this.projectiles=[];
  this.orbs=[];
  this.hearts=[];
  this.wave=1;
  this.waveProfile=null;
  this.spawned=0;
  this.toSpawn=0;
  this.skeletonSpawned=0;
  this.mageSpawned=0;
  this.shieldSpawned=0;
  this.championSpawned=0;
  this.lastSpawn=0;
  this.spawnInterval=850;
  this.kills=0;
  this.xp=0;
  this.level=1;
  this.gameOver=false;
  this.pausedByGameOver=false;
  this.gameOverBanner=null;
  this.gameOverText=null;
  this.restartText=null;
  this.levelChoiceOpen=false;
  this.levelChoices=[];
  this.choiceObjects=[];
  this.lastDamageTime=0;
  this.invulnMs=500;
  this.playerDir='down';
  this.playerVisualState='player_down_idle';
  this.lastPlayerDirX=0;
  this.lastPlayerDirY=1;
  this.cursors=null;
  this.keys=null;
  this.mobAnimLastUpdate=0;
  this.activeChampion=null;
  this.championEventActive=false;
  this.championRewardOpen=false;
  this.championRewardObjects=[];
  this.championHazards=[];
  this.holyMarkCounter=0;
  this.championRelics=new Set();
  this.killStreakBonus=0;
  this.nextSoulSkullAt=0;
  this.nextCursedGroundAt=0;
  this.lastIronWillTriggerAt=-99999;
  this.groundEffects=[];
  this.currentWorldZoneIndex=0;
  this.loadedWorldZones=new Map();
  this.worldZoneVisuals=[];
  this.worldLandmarkObjects=[];
  this.worldGateObjects=new Map();
  this.unlockedWorldGates=new Set();
  this.closedWorldGates=new Set();
  this.activeTransitionGate=null;
  this.activeBackSeal=null;
  this.regionText=null;
  this.regionSubtitleText=null;
  this.regionBannerTimer=null;
  this.biomePreviewObjects=[];
  this.emptyScreenRushActive=false;
  this.fullscreenButton=null;
  this.isTouchDevice=false;
 }
 preload(){
  if(!this.textures.exists('player_down_idle_00')) queueMainGameAssets(this);
 }
 create(){
  this.resetRuntimeState();
  this.cameras.main.setBackgroundColor('#10140f');
  this.physics.world.setBounds(0,0,STAGE0.WORLD_WIDTH,STAGE0.WORLD_HEIGHT);
  this.createWorldBackdrop();
  this.createGroundTexture();
  this.createRegionLabel();
  this.createPlayer();
  this.createPlayerReadabilityLayer();
  this.sword=new Sword(this,{owner:this.player});
  this.enemyGroup=this.physics.add.group();
  this.createWorldDesignPrototype();
  this.createHUD();
  this.createFullscreenButton();

  this.cursors=this.input.keyboard?.createCursorKeys();
  this.keys=this.input.keyboard?.addKeys('W,A,S,D,R,SPACE,ONE,TWO,THREE');
  this.events.on('mobile-skill',this.handleSkillInput,this);
  this.input.keyboard?.on('keydown-SPACE',()=>this.handleSkillInput(1));
  this.input.keyboard?.on('keydown-ONE',()=>this.handleSkillInput(1));
  this.input.keyboard?.on('keydown-TWO',()=>this.handleSkillInput(2));
  this.input.keyboard?.on('keydown-THREE',()=>this.handleSkillInput(3));
  this.input.keyboard?.on('keydown-R',()=>{
   if(this.gameOver) this.scene.restart();
  });

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
   e.hitRadius=17;
   e.attackRange=68;

   e.visual=this.add.sprite(
    e.x,
    e.y,
    'shield_down_idle_00'
   ).setOrigin(0.5,0.82).setScale(0.52).setDepth(15);

   e.dir='down';
   e.attackDir='down';
   e.visualState='shield_down_idle';
   e.visual.play(e.visualState);

   this.shieldSpawned++;
  } else {
   e.setFillStyle(0xcc3333,0);
   e.hp=35 + this.wave*5;
   e.maxHp=e.hp;
   e.speed=60 + this.wave*3;
   e.hitRadius=13;
   e.attackRange=62;

   e.visual=this.add.sprite(
    e.x,
    e.y,
    'skeleton_down_idle_00'
   ).setOrigin(0.5,0.82).setScale(0.48).setDepth(15);

   e.dir='down';
   e.attackDir='down';
   e.visualState='skeleton_down_idle';
   e.visual.play(e.visualState);

   this.skeletonSpawned++;
  }

  e.staggerUntil=0;
  e.nextAttack=0;
  e.attackWindupUntil=0;
  e.attackAnimStarted=false;
  e.isAttacking=false;
  e.lastHitFlash=0;
  e.crowdRadius=Math.max(e.hitRadius||14,18);
  e.crowdKeepoutRadius=e.attackRange||62;

  this.configureEnemyCollision(e,4);
  this.createEnemyReadabilityShadow(e);
  this.enemies.push(e);
  this.enemyGroup.add(e);
  this.applyProgressiveTuningToEnemy(e);
  this.spawned++;
 }
 configureEnemyCollision(enemy,padding=4){
  const radius=(enemy.hitRadius||14)+padding;
  if(enemy.body){
   enemy.body.setCircle(radius, -radius, -radius);
   enemy.body.setBounce(0.08,0.08);
   enemy.body.setDrag(70,70);
   enemy.body.setMaxVelocity(Math.max(120,enemy.speed*1.65));
  }
 }

 createEnemyReadabilityShadow(enemy){
  if(!enemy || enemy.shadowVisual) return;
  const radius=enemy.hitRadius||14;
  const width=radius*2.35;
  const height=Math.max(7,radius*0.72);
  const alpha=enemy.type==='champion'
   ? ASH_READABILITY.CHAMPION_SHADOW_ALPHA
   : ASH_READABILITY.ENEMY_SHADOW_ALPHA;
  enemy.shadowVisual=this.add.ellipse(
   enemy.x,
   enemy.y+radius*0.82,
   width,
   height,
   0x050504,
   alpha
  ).setDepth(enemy.type==='champion' ? 15 : 14);
 }
 destroyEnemyReadabilityShadow(enemy){
  if(enemy && enemy.shadowVisual && enemy.shadowVisual.active){
   enemy.shadowVisual.destroy();
  }
  if(enemy) enemy.shadowVisual=null;
 }

 createWorldBackdrop(){
  const g=this.add.graphics().setDepth(-150);
  g.fillStyle(0x21241f,1);
  g.fillRect(0,0,STAGE0.WORLD_WIDTH,STAGE0.WORLD_HEIGHT);
 }

 createGroundTexture(){
  // Gameplay ground is painted by streamed biome art. Keep this layer transparent
  // so deleted/rejected prototype rectangles never appear under Ash Fields.
 }

 createRegionLabel(){
  this.regionText=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'28px',fontStyle:'bold',color:'#f0e2b8',stroke:'#0c0a08',strokeThickness:5,align:'center'}).setOrigin(0.5).setDepth(50).setVisible(false);
  this.regionSubtitleText=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#c8bda0',stroke:'#0c0a08',strokeThickness:4,align:'center'}).setOrigin(0.5).setDepth(50).setVisible(false);
 }

 createPlayer(){
  this.player=this.add.circle(WORLD_DESIGN.START_X,WORLD_DESIGN.ROUTE_Y,14,0x3aa0ff);
  this.player.setFillStyle(0x3aa0ff,0);
  this.physics.add.existing(this.player);
  this.player.body.setCollideWorldBounds(true);
  this.player.hp=100;
  this.player.speed=165;
  this.player.maxMana=3;
  this.player.mana=3;
  this.player.manaRegenInterval=15000;
  this.player.nextManaAt=0;

  this.playerSprite=this.add.sprite(this.player.x,this.player.y,'player_down_idle_00')
   .setOrigin(0.5,0.82)
   .setScale(0.56)
   .setDepth(20);
  this.playerSprite.play('player_down_idle');
 }

 createPlayerReadabilityLayer(){
  this.playerGroundLight=this.add.ellipse(
   this.player.x,
   this.player.y+10,
   ASH_READABILITY.PLAYER_AURA_WIDTH,
   ASH_READABILITY.PLAYER_AURA_HEIGHT,
   0xe8d0a0,
   ASH_READABILITY.PLAYER_ROUTE_LIGHT_ALPHA
  ).setDepth(-42);

  this.playerShadow=this.add.ellipse(
   this.player.x,
   this.player.y+12,
   ASH_READABILITY.PLAYER_SHADOW_WIDTH,
   ASH_READABILITY.PLAYER_SHADOW_HEIGHT,
   0x050504,
   0.24
  ).setDepth(19);
 }
 updatePlayerReadabilityLayer(){
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
  this.ashNoDropZones=[];

  this.worldGateGroup=this.physics.add.staticGroup();
  this.ashLandmarkColliderGroup=this.physics.add.staticGroup();

  // Load only the starting biome. The next biome is streamed when the player
  // approaches its transition or when its champion is defeated.
  this.loadWorldZone(0);
  this.ensureProgressionGate(0);
  this.createBiomePreview(0);
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

 registerAshNoDropZone(objects,x,y,width,height,name){
  const zone={x,y,width,height,name,active:true};
  if(!this.ashNoDropZones) this.ashNoDropZones=[];
  this.ashNoDropZones.push(zone);
  objects.push({
   active:true,
   destroy:()=>{
    zone.active=false;
   }
  });
 }

 getAshRectBounds(rect,padding=0){
  if(!rect) return null;
  if(rect.body){
   const body=rect.body;
   const left=('left' in body) ? body.left : rect.x-body.width*0.5;
   const right=('right' in body) ? body.right : rect.x+body.width*0.5;
   const top=('top' in body) ? body.top : rect.y-body.height*0.5;
   const bottom=('bottom' in body) ? body.bottom : rect.y+body.height*0.5;
   return {left:left-padding,right:right+padding,top:top-padding,bottom:bottom+padding};
  }
  if(typeof rect.x==='number' && typeof rect.width==='number'){
   return {
    left:rect.x-rect.width*0.5-padding,
    right:rect.x+rect.width*0.5+padding,
    top:rect.y-rect.height*0.5-padding,
    bottom:rect.y+rect.height*0.5+padding
   };
  }
  return null;
 }

 isPointInsideAshBlocker(x,y,padding=0){
  if(this.ashLandmarkColliderGroup){
   for(const blocker of this.ashLandmarkColliderGroup.getChildren()){
    if(!blocker?.active || !blocker.body) continue;
    const b=this.getAshRectBounds(blocker,padding);
    if(!b) continue;
    if(x>=b.left && x<=b.right && y>=b.top && y<=b.bottom) return true;
   }
  }

  if(this.ashNoDropZones){
   for(const zone of this.ashNoDropZones){
    if(!zone?.active) continue;
    const b=this.getAshRectBounds(zone,padding);
    if(!b) continue;
    if(x>=b.left && x<=b.right && y>=b.top && y<=b.bottom) return true;
   }
  }

  return false;
 }

 findNearestFreeGroundPoint(x,y,searchStep=26,maxRadius=260,padding=26){
  const startX=this.clampWorldX(x,28);
  const startY=this.clampWorldY(y,28);
  if(!this.isPointInsideAshBlocker(startX,startY,padding)) return {x:startX,y:startY};

  for(let radius=searchStep;radius<=maxRadius;radius+=searchStep){
   const samples=Math.max(18,Math.ceil(radius/10));
   let best=null;
   let bestDist=Number.POSITIVE_INFINITY;
   for(let i=0;i<samples;i++){
    const angle=(Math.PI*2*i)/samples;
    const px=this.clampWorldX(startX+Math.cos(angle)*radius,28);
    const py=this.clampWorldY(startY+Math.sin(angle)*radius,28);
    if(this.isPointInsideAshBlocker(px,py,padding)) continue;
    const dist=Phaser.Math.Distance.Between(startX,startY,px,py);
    if(dist<bestDist){ best={x:px,y:py}; bestDist=dist; }
   }
   if(best) return best;
  }

  return {x:startX,y:startY};
 }

 addAshLandmarkCollision(objects,key,x,y){
  // Build 1.3.14.2: large landmarks are blocked vertically as well as at ground level.
  // Multiple rectangles follow the dense parts of the art more closely than one giant
  // bounding box, so the object is fully solid without blocking huge empty corners.
  const shapes={
   ash_landmark_burnt_tree_shrine_01:[
    {dx:0,dy:105,w:500,h:255,name:'base'},
    {dx:-38,dy:-82,w:245,h:390,name:'trunk'},
    {dx:150,dy:72,w:170,h:210,name:'roots_r'},
    {dx:-170,dy:85,w:155,h:185,name:'roots_l'}
   ],
   ash_landmark_ruined_altar_01:[
    {dx:0,dy:125,w:505,h:245,name:'base'},
    {dx:-105,dy:-76,w:145,h:390,name:'pillar_l'},
    {dx:105,dy:-42,w:145,h:325,name:'pillar_r'},
    {dx:0,dy:-190,w:335,h:160,name:'arch'}
   ]
  };
  for(const s of (shapes[key]||[])){
   this.createAshLandmarkBlocker(objects,x+s.dx,y+s.dy,s.w,s.h,key+'_'+s.name);
  }
 }

 createAshPropShadow(objects,prop,kind){
  if(kind==='grass') return;
  const displayW=Math.max(1,prop.displayWidth);
  const displayH=Math.max(1,prop.displayHeight);
  const isLarge=(kind==='tree' ? displayH>=150 : displayW>=95);

  // Build 1.3.14.5: sunrise-style cast shadow. The visible shadow is offset
  // down-left from the object rather than sitting directly under its centre.
  const castX=prop.x-displayW*(kind==='tree' ? (isLarge?0.30:0.20) : (isLarge?0.24:0.16));
  const castY=prop.y+displayH*(kind==='tree' ? (isLarge?0.51:0.45) : (isLarge?0.44:0.38));
  const castW=displayW*(kind==='tree' ? (isLarge?1.18:0.90) : (isLarge?1.10:0.86));
  const castH=Math.max(9,displayH*(kind==='tree' ? (isLarge?0.14:0.095) : (isLarge?0.17:0.13)));
  const castAlpha=kind==='tree' ? (isLarge?0.30:0.21) : (isLarge?0.27:0.19);
  const cast=this.add.ellipse(castX,castY,castW,castH,0x070605,castAlpha)
   .setDepth(-46)
   .setRotation(-0.18);

  // Small contact shadow near the feet keeps the object grounded without
  // replacing the directional sunrise shadow.
  const contact=this.add.ellipse(
   prop.x,
   prop.y+displayH*(kind==='tree'?0.43:0.35),
   displayW*(kind==='tree'?0.58:0.66),
   Math.max(6,displayH*(kind==='tree'?0.055:0.08)),
   0x000000,
   castAlpha*0.45
  ).setDepth(-45);
  objects.push(cast,contact);
 }

 addAshPropCollision(objects,prop,kind,key){
  if(kind==='grass') return;
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
    this.createAshLandmarkBlocker(objects,prop.x,baseY,baseW,baseH,key+'_base');

    const verticalW=displayW*0.54;
    const verticalH=Math.max(80,displayH*0.82);
    const verticalY=prop.y-displayH*0.015;
    this.createAshLandmarkBlocker(objects,prop.x,verticalY,verticalW,verticalH,key+'_vertical');
   }else{
    const baseW=displayW*0.94;
    const baseH=Math.max(28,displayH*0.38);
    const baseY=prop.y+displayH*0.27;
    this.createAshLandmarkBlocker(objects,prop.x,baseY,baseW,baseH,key+'_base');

    const verticalW=displayW*0.82;
    const verticalH=Math.max(54,displayH*0.78);
    const verticalY=prop.y-displayH*0.015;
    this.createAshLandmarkBlocker(objects,prop.x,verticalY,verticalW,verticalH,key+'_vertical');
   }
   return;
  }

  // Smaller rocks / trees keep a forgiving footprint so the route does not feel cramped.
  const width=displayW*(kind==='tree'?0.42:0.72);
  const height=Math.max(20,displayH*(kind==='tree'?0.16:0.28));
  const y=prop.y+displayH*(kind==='tree'?0.39:0.31);
  this.createAshLandmarkBlocker(objects,prop.x,y,width,height,key);
 }

 registerAshPropNoDropZone(objects,prop,kind,key){
  if(kind==='grass') return;
  const displayW=Math.max(1,prop.displayWidth);
  const displayH=Math.max(1,prop.displayHeight);
  const isLarge=(kind==='tree' ? displayH>=150 : displayW>=95);
  const width=displayW*(kind==='tree' ? (isLarge?0.82:0.58) : (isLarge?1.08:0.86));
  const height=displayH*(kind==='tree' ? (isLarge?0.88:0.45) : (isLarge?0.92:0.52));
  const y=prop.y+displayH*(kind==='tree' ? (isLarge?0.04:0.26) : (isLarge?0.02:0.18));
  this.registerAshNoDropZone(objects,prop.x,y,width,height,key+'_visual_no_drop');
 }

 createAshLandmarkShadow(objects,landmark,key){
  const displayW=Math.max(1,landmark.displayWidth);
  const displayH=Math.max(1,landmark.displayHeight);
  const isTree=key==='ash_landmark_burnt_tree_shrine_01';

  const castX=landmark.x-displayW*(isTree?0.24:0.22);
  const castY=landmark.y+displayH*(isTree?0.44:0.46);
  const castW=displayW*(isTree?1.16:1.08);
  const castH=Math.max(24,displayH*(isTree?0.14:0.13));

  const cast=this.add.ellipse(castX,castY,castW,castH,0x070605,isTree?0.31:0.29)
   .setDepth(-30)
   .setRotation(-0.18);
  const contact=this.add.ellipse(
   landmark.x+displayW*(isTree?0.015:0.025),
   landmark.y+displayH*(isTree?0.33:0.34),
   displayW*(isTree?0.66:0.64),
   Math.max(18,displayH*0.07),
   0x000000,
   0.14
  ).setDepth(-29);
  objects.push(cast,contact);
 }

 registerAshLandmarkNoDropZone(objects,landmark,key){
  const displayW=Math.max(1,landmark.displayWidth);
  const displayH=Math.max(1,landmark.displayHeight);
  const isTree=key==='ash_landmark_burnt_tree_shrine_01';
  const width=displayW*(isTree?0.94:0.92);
  const height=displayH*(isTree?0.92:0.90);
  const y=landmark.y+displayH*(isTree?0.04:0.03);
  this.registerAshNoDropZone(objects,landmark.x,y,width,height,key+'_visual_no_drop');
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

  // Build 1.3.14: reuse the exact existing seeded prop positions, but swap in
  // the approved darker grass / tree / rock set. Grass stays passable; trees and
  // rocks get compact base collisions plus one restrained contact shadow for depth.
  const propSlots=66;
  const routeY=WORLD_DESIGN.ROUTE_Y;
  const grassKeys=ASH_ENVIRONMENT_ART.props.filter(key=>key.includes('burnt_grass_'));
  const treeKeys=ASH_ENVIRONMENT_ART.props.filter(key=>key.includes('burnt_tree_'));
  const rockKeys=ASH_ENVIRONMENT_ART.props.filter(key=>key.includes('ash_prop_rock_'));
  const placedObstacleAnchors=[];
  let nonGrassOrdinal=0;
  let largeGrassOrdinal=0;

  for(let i=0;i<propSlots;i++){
   const seed=4100+i*53;
   const legacySlot=i%5;
   const x=zone.start+280+this.artNoise(seed+1)*(width-560);

   let y=180+this.artNoise(seed+2)*(STAGE0.WORLD_HEIGHT-360);
   // Preserve the old route-clearing rule exactly so the composition stays familiar.
   if(Math.abs(y-routeY)<360 && this.artNoise(seed+3)<0.78){
    y=(y<routeY)
     ? 220+this.artNoise(seed+4)*760
     : STAGE0.WORLD_HEIGHT-220-this.artNoise(seed+4)*760;
   }

   // Old slots: grass -> grass, rock/rubble -> rock, shrub -> grass, branches -> tree.
   // This keeps every object's old coordinate while giving the biome the new palette.
   let kind='grass';
   let pool=grassKeys;
   if(legacySlot===1 || legacySlot===4){ kind='rock'; pool=rockKeys; }
   else if(legacySlot===3){ kind='tree'; pool=treeKeys; }

   if(kind!=='grass'){
    const keepThisObstacle=(nonGrassOrdinal%2)===0;
    nonGrassOrdinal++;
    if(!keepThisObstacle) continue;
    const minObstacleSpacing=kind==='tree' ? 242 : 184;
    const tooClose=placedObstacleAnchors.some(p=>Phaser.Math.Distance.Between(p.x,p.y,x,y)<minObstacleSpacing);
    if(tooClose) continue;
   }

   const variant=Math.floor(this.artNoise(seed+9)*pool.length)%pool.length;
   const key=pool[variant];
   if(kind==='grass' && ['ash_prop_burnt_grass_01','ash_prop_burnt_grass_02'].includes(key)){
    const keepLargeGrass=(largeGrassOrdinal%2)===0;
    largeGrassOrdinal++;
    if(!keepLargeGrass) continue;
   }
   const scaleBase=kind==='tree'?0.54:(kind==='rock'?0.56:0.88);
   const scaleRange=kind==='tree'?0.16:(kind==='rock'?0.15:0.22);
   const scale=scaleBase+this.artNoise(seed+5)*scaleRange;

   const prop=this.add.image(x,y,key)
    .setDepth(-44)
    .setScale(scale)
    .setAlpha(kind==='grass' ? 0.86+this.artNoise(seed+6)*0.10 : 0.94+this.artNoise(seed+6)*0.05)
    .setRotation((this.artNoise(seed+7)-0.5)*(kind==='tree'?0.055:0.10));

   if(this.artNoise(seed+8)>0.5) prop.setFlipX(true);
   objects.push(prop);
   this.createAshPropShadow(objects,prop,kind);
   this.addAshPropCollision(objects,prop,kind,key);
   this.registerAshPropNoDropZone(objects,prop,kind,key);
   if(kind!=='grass') placedObstacleAnchors.push({x,y,kind});
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

   this.createAshLandmarkShadow(objects,landmark,key);
   objects.push(landmark);
   this.worldLandmarkObjects.push(landmark);
   this.addAshLandmarkCollision(objects,key,x,y);
   this.registerAshLandmarkNoDropZone(objects,landmark,key);
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
  }
  this.loadedWorldZones.delete(index);
 }
 updateWorldStreaming(){
  const index=this.getWorldZoneIndexForX(this.player.x);
  if(index!==this.currentWorldZoneIndex){
   this.currentWorldZoneIndex=index;
   this.showRegionAnnouncement(index);
  }

  this.loadWorldZone(index);
  if(index+1<WORLD_DESIGN.ZONES.length){
   const nextZone=WORLD_DESIGN.ZONES[index+1];
   if(this.player.x>nextZone.start-WORLD_DESIGN.PREVIEW_WIDTH){
    this.loadWorldZone(index+1);
   }
  }

  for(const loadedIndex of Array.from(this.loadedWorldZones.keys())){
   if(loadedIndex<index-1){
    this.unloadWorldZone(loadedIndex);
   }
  }

  this.updateProgressionGateState();
 }
 getWorldZoneIndexForX(x){
  for(let i=WORLD_DESIGN.ZONES.length-1;i>=0;i--){
   if(x>=WORLD_DESIGN.ZONES[i].start) return i;
  }
  return 0;
 }
 getWorldProgressName(){
  return WORLD_DESIGN.ZONES[this.currentWorldZoneIndex]?.name || 'UNKNOWN';
 }
 getZoneTravelProgress(){
  const zone=WORLD_DESIGN.ZONES[this.currentWorldZoneIndex];
  if(!zone) return 0;
  return Phaser.Math.Clamp((this.player.x-zone.start)/(zone.end-zone.start),0,1);
 }
 showRegionAnnouncement(index){
  const zone=WORLD_DESIGN.ZONES[index];
  if(!zone) return;
  this.regionText.setText(zone.name).setVisible(true);
  this.regionSubtitleText.setText(zone.subtitle).setVisible(true);
  this.positionRegionAnnouncement();
  this.regionText.setAlpha(0);
  this.regionSubtitleText.setAlpha(0);
  this.tweens.add({targets:[this.regionText,this.regionSubtitleText],alpha:1,duration:280,ease:'Sine.easeOut',yoyo:true,hold:1550,onComplete:()=>{
   this.regionText.setVisible(false);
   this.regionSubtitleText.setVisible(false);
  }});
 }
 positionRegionAnnouncement(){
  const cam=this.cameras.main;
  const view=cam.worldView;
  const cx=view.centerX;
  const y=view.top+Math.min(126,view.height*0.17);
  this.regionText.setPosition(cx,y);
  this.regionSubtitleText.setPosition(cx,y+33);
 }
 ensureProgressionGate(index){
  const gate=WORLD_DESIGN.GATES[index];
  if(!gate || this.worldGateObjects.has(gate.id)) return;

  const gateVisual=this.add.graphics().setDepth(-18);
  const closeName=this.add.text(gate.x,STAGE0.WORLD_HEIGHT*0.5-165,gate.closeName,{fontFamily:'Arial, sans-serif',fontSize:'22px',fontStyle:'bold',color:'#f0e2b8',stroke:'#0c0a08',strokeThickness:5,align:'center'}).setOrigin(0.5).setDepth(-16).setVisible(false);
  const openName=this.add.text(gate.x+52,STAGE0.WORLD_HEIGHT*0.5+110,gate.name,{fontFamily:'Arial, sans-serif',fontSize:'18px',fontStyle:'bold',color:'#d9c692',stroke:'#0c0a08',strokeThickness:4,align:'center'}).setOrigin(0.5).setDepth(-16).setVisible(false);
  const sealText=this.add.text(gate.x,STAGE0.WORLD_HEIGHT*0.5-132,'DEFEAT CHAMPION TO OPEN',{fontFamily:'Arial, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#c7b8a0',stroke:'#0c0a08',strokeThickness:3,align:'center'}).setOrigin(0.5).setDepth(-16).setVisible(false);

  const closedZone=this.add.zone(gate.x,STAGE0.WORLD_HEIGHT*0.5,96,STAGE0.WORLD_HEIGHT);
  this.worldGateGroup.add(closedZone);
  if(closedZone.body){
   closedZone.body.setSize(96,STAGE0.WORLD_HEIGHT);
   closedZone.body.updateFromGameObject();
  }

  this.worldGateObjects.set(gate.id,{gate,visual:gateVisual,closedZone,closeName,openName,sealText,created:true});
  this.updateProgressionGateVisual(gate.id);
 }
 bindProgressionGateCollision(){
  this.worldGateCollider=this.physics.add.collider(
   this.player,
   this.worldGateGroup,
   (player,zone)=>{
    const entry=Array.from(this.worldGateObjects.values()).find(v=>v.closedZone===zone);
    if(entry && !this.unlockedWorldGates.has(entry.gate.id)){
     this.activeTransitionGate=entry.gate.id;
    }
   }
  );
 }
 unlockWorldGateForChampion(championKind){
  const entry=WORLD_DESIGN.GATES.find(g=>g.champion===championKind);
  if(!entry) return null;
  this.unlockedWorldGates.add(entry.id);
  this.updateProgressionGateVisual(entry.id);
  return entry;
 }
 closeBackSeal(index){
  if(index<=0) return;
  const prevGate=WORLD_DESIGN.GATES[index-1];
  if(!prevGate || this.closedWorldGates.has(prevGate.id)) return;
  this.closedWorldGates.add(prevGate.id);
  this.updateProgressionGateVisual(prevGate.id);
 }
 updateProgressionGateState(){
  const index=this.currentWorldZoneIndex;
  const zone=WORLD_DESIGN.ZONES[index];
  if(index>0 && zone && this.player.x>zone.start+WORLD_DESIGN.BACK_LOCK_DEPTH){
   this.closeBackSeal(index);
  }

  for(const gate of WORLD_DESIGN.GATES){
   this.updateProgressionGateVisual(gate.id);
  }
 }
 updateProgressionGateVisual(gateId){
  const data=this.worldGateObjects.get(gateId);
  if(!data) return;
  const {gate,visual,closedZone,closeName,openName,sealText}=data;
  const unlocked=this.unlockedWorldGates.has(gate.id);
  const sealedBack=this.closedWorldGates.has(gate.id);
  const closed=!unlocked || sealedBack;

  if(closedZone?.body){
   if(closed){
    closedZone.body.enable=true;
   }else{
    closedZone.body.enable=false;
   }
  }

  visual.clear();
  const alpha=closed ? 0.20 : 0.10;
  const lineAlpha=closed ? 0.60 : 0.28;
  const color=gate.color;
  visual.fillStyle(color,alpha);
  visual.fillRect(gate.x-24,0,48,STAGE0.WORLD_HEIGHT);
  visual.lineStyle(closed ? 3 : 2,color,lineAlpha);
  visual.beginPath();
  visual.moveTo(gate.x-34,0);
  visual.lineTo(gate.x-8,STAGE0.WORLD_HEIGHT*0.5-65);
  visual.lineTo(gate.x-30,STAGE0.WORLD_HEIGHT);
  visual.strokePath();
  visual.beginPath();
  visual.moveTo(gate.x+34,0);
  visual.lineTo(gate.x+8,STAGE0.WORLD_HEIGHT*0.5+65);
  visual.lineTo(gate.x+30,STAGE0.WORLD_HEIGHT);
  visual.strokePath();

  const visibleX=Math.abs(this.player.x-gate.x)<1100;
  closeName.setVisible(visibleX && closed);
  sealText.setVisible(visibleX && closed && !sealedBack);
  openName.setVisible(visibleX && !closed);
  closeName.setText(sealedBack ? gate.closeName : gate.closeName);
  sealText.setText(sealedBack ? 'THE WAY BACK IS SEALED' : 'DEFEAT CHAMPION TO OPEN');
 }
 requestWorldAdvance(championKind){
  const gate=this.unlockWorldGateForChampion(championKind);
  if(!gate) return;
  const nextIndex=gate.toZone;
  this.loadWorldZone(nextIndex);
  this.showRegionAnnouncement(nextIndex);
 }
 createBiomePreview(index){
  if(index<0 || index>=WORLD_DESIGN.ZONES.length-1) return;
  const zone=WORLD_DESIGN.ZONES[index];
  const next=WORLD_DESIGN.ZONES[index+1];
  const start=zone.end-WORLD_DESIGN.PREVIEW_WIDTH;
  const g=this.add.graphics().setDepth(-95);
  g.fillStyle(next.color,0.12);
  g.fillRect(start,0,WORLD_DESIGN.PREVIEW_WIDTH,STAGE0.WORLD_HEIGHT);
  g.lineStyle(2,next.accent,0.22);
  for(let i=0;i<8;i++){
   const x=start+i*(WORLD_DESIGN.PREVIEW_WIDTH/7);
   const sway=(i%2===0)?-34:38;
   g.beginPath();
   g.moveTo(x+sway,0);
   g.lineTo(x-sway,STAGE0.WORLD_HEIGHT);
   g.strokePath();
  }
  this.biomePreviewObjects.push(g);
 }

 createHUD(){
  this.hpText=this.add.text(12,12,'HP: 100',{fontFamily:'Arial, sans-serif',fontSize:'18px',color:'#fff'}).setScrollFactor(0).setDepth(100).setVisible(false);
  this.infoText=this.add.text(12,36,'',{fontFamily:'Arial, sans-serif',fontSize:'14px',color:'#ffff99'}).setScrollFactor(0).setDepth(100).setVisible(false);
  this.waveTitleText=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'26px',fontStyle:'bold',color:'#ffe8a8',stroke:'#180c05',strokeThickness:5,align:'center'}).setOrigin(0.5).setScrollFactor(0).setDepth(102).setVisible(false);
  this.waveSubText=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'13px',fontStyle:'bold',color:'#ffffff',stroke:'#130b07',strokeThickness:4,align:'center'}).setOrigin(0.5).setScrollFactor(0).setDepth(102).setVisible(false);
  this.championNameText=this.add.text(
   this.scale.width/2,
   86,
   '',
   {fontFamily:'Arial, sans-serif',fontSize:'24px',fontStyle:'bold',color:'#f5d78f',stroke:'#130b07',strokeThickness:5,align:'center'}
  ).setOrigin(0.5).setScrollFactor(0).setDepth(103).setVisible(false);
  this.championHpBack=this.add.rectangle(
   this.scale.width/2,
   113,
   430,
   14,
   0x2a130d,
   0.92
  ).setStrokeStyle(2,0x7d5b33,0.9).setScrollFactor(0).setDepth(102).setVisible(false);
  this.championHpFill=this.add.rectangle(
   this.scale.width/2-213,
   113,
   426,
   10,
   0xb72a2a,
   1
  ).setOrigin(0,0.5).setScrollFactor(0).setDepth(103).setVisible(false);

  this.positionTopStatusUI();
 }

 positionTopStatusUI(){
  if(!this.waveTitleText) return;
  const mobile=this.isTouchDevice;
  const cx=this.scale.width/2;
  const safeTop=Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top'))||0;
  const titleY=Math.max(24+safeTop,mobile?34+safeTop:30+safeTop);
  this.waveTitleText.setPosition(cx,titleY).setFontSize(mobile?20:26);
  this.waveSubText.setPosition(cx,titleY+(mobile?24:30)).setFontSize(mobile?11:13);
  if(this.championNameText) this.championNameText.setPosition(cx,88);
  if(this.championHpBack) this.championHpBack.setPosition(cx,113);
  if(this.championHpFill) this.championHpFill.setPosition(cx-213,113);
 }

 createFullscreenButton(){
  const supported=this.scale.game.device.fullscreen.available;
  if(!supported || this.fullscreenButton) return;
  const button=this.add.container(0,0).setScrollFactor(0).setDepth(120);
  const bg=this.add.rectangle(0,0,44,44,0x090807,0.72).setStrokeStyle(2,0xc49b56,0.86);
  const icon=this.add.graphics();
  icon.lineStyle(3,0xf4dfaa,0.95);
  const s=12;
  icon.beginPath(); icon.moveTo(-s,-5); icon.lineTo(-s,-s); icon.lineTo(-5,-s); icon.strokePath();
  icon.beginPath(); icon.moveTo( s,-5); icon.lineTo( s,-s); icon.lineTo( 5,-s); icon.strokePath();
  icon.beginPath(); icon.moveTo(-s, 5); icon.lineTo(-s, s); icon.lineTo(-5, s); icon.strokePath();
  icon.beginPath(); icon.moveTo( s, 5); icon.lineTo( s, s); icon.lineTo( 5, s); icon.strokePath();
  button.add([bg,icon]);
  button.setSize(44,44).setInteractive({useHandCursor:true});
  button.on('pointerdown',()=>{
   if(this.scale.isFullscreen) this.scale.stopFullscreen();
   else this.scale.startFullscreen();
  });
  this.fullscreenButton=button;
  this.positionFullscreenButton();
 }
 positionFullscreenButton(){
  if(!this.fullscreenButton) return;
  const safeTop=Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top'))||0;
  const safeRight=Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-right'))||0;
  const x=this.scale.width-30-safeRight;
  const y=30+safeTop;
  this.fullscreenButton.setPosition(x,y);
 }

 getChampionDefinition(kind){
  const defs={
   brokenSaint:{name:'BROKEN SAINT',hp:520,speed:48,damage:12,hitRadius:34,crowdRadius:44,crowdKeepoutRadius:96,collisionPadding:10,scale:0.96,tint:0xffffff,rewardColor:'#ffe59a'},
   necromancer:{name:'NECROMANCER',hp:620,speed:42,damage:10,hitRadius:32,crowdRadius:42,crowdKeepoutRadius:92,collisionPadding:10,scale:0.92,tint:0xb8ffd0,rewardColor:'#83ff9b'},
   shieldWarden:{name:'SHIELD WARDEN',hp:760,speed:36,damage:14,hitRadius:38,crowdRadius:50,crowdKeepoutRadius:105,collisionPadding:12,scale:1.03,tint:0xd0d8e6,rewardColor:'#b8c8d8'},
   hollowTree:{name:'HOLLOW TREE',hp:900,speed:24,damage:16,hitRadius:46,crowdRadius:58,crowdKeepoutRadius:120,collisionPadding:14,scale:1.12,tint:0xc6f0a3,rewardColor:'#91b967'}
  };
  return defs[kind] || defs.brokenSaint;
 }

 spawnChampion(kind='brokenSaint'){
  const def=this.getChampionDefinition(kind);
  const spawn=this.getEdgeSpawnPoint(130);

  const e=this.add.circle(
   spawn.x,
   spawn.y,
   def.hitRadius,
   0x8b5cf6,
   0
  );
  this.physics.add.existing(e);
  e.type='champion';
  e.championKind=kind;
  e.championName=def.name;
  e.hp=def.hp;
  e.maxHp=def.hp;
  e.speed=def.speed;
  e.damage=def.damage;
  e.hitRadius=def.hitRadius;
  e.crowdRadius=def.crowdRadius;
  e.crowdKeepoutRadius=def.crowdKeepoutRadius;
  e.attackRange=def.crowdKeepoutRadius;
  e.nextAttack=0;
  e.nextSpecialAt=this.time.now+2200;
  e.nextCastAt=this.time.now+1600;
  e.specialIndex=0;
  e.staggerUntil=0;
  e.attackWindupUntil=0;
  e.attackAnimStarted=false;
  e.isAttacking=false;
  e.lastHitFlash=0;
  e.reflectShielded=false;
  e.reflectShieldUntil=0;
  e.reflectVulnerableUntil=0;
  e.reflectVisual=null;
  e.dir='down';
  e.attackDir='down';

  const isBrokenSaint=kind==='brokenSaint';
  const initialTexture=isBrokenSaint ? 'broken_saint_down_walk_00' : 'champion_down_idle_00';
  e.visual=this.add.sprite(e.x,e.y,initialTexture)
   .setOrigin(0.5,0.82)
   .setScale(def.scale)
   .setDepth(24)
   .setTint(def.tint);
  e.visualState=isBrokenSaint ? 'broken_saint_down_idle' : 'champion_down_idle';
  if(!isBrokenSaint) e.visual.play(e.visualState);
  else e.visual.setTexture('broken_saint_down_walk_00');

  this.configureEnemyCollision(e,def.collisionPadding ?? 4);
  this.createEnemyReadabilityShadow(e);
  this.enemies.push(e);
  this.enemyGroup.add(e);
  this.activeChampion=e;
  this.championEventActive=true;
  this.championSpawned++;
  this.waveTitleText.setVisible(false);
  this.waveSubText.setVisible(false);
  this.championNameText.setText(def.name).setVisible(true);
  this.championHpBack.setVisible(true);
  this.championHpFill.setVisible(true);
  this.updateChampionBar();
 }

 updateChampionAI(e,time,dist){
  if(!e.active || e.type!=='champion') return;
  const kind=e.championKind;
  if(time<e.nextSpecialAt) return;

  if(kind==='brokenSaint'){
   this.brokenSaintSpecial(e,time,dist);
  }else if(kind==='necromancer'){
   this.necromancerSpecial(e,time);
  }else if(kind==='shieldWarden'){
   this.shieldWardenSpecial(e,time);
  }else if(kind==='hollowTree'){
   this.hollowTreeSpecial(e,time);
  }
 }

 addChampionHazardCircle(x,y,radius,duration,damage,kind,color=0xffd06a,delay=0){
  const tele=this.add.circle(x,y,radius,color,0.10).setDepth(8).setStrokeStyle(2,color,0.55);
  const start=this.time.now;
  const activeAt=start+delay;
  const expiresAt=activeAt+duration;
  this.tweens.add({targets:tele,alpha:0.28,duration:Math.max(120,delay),yoyo:true,repeat:delay>0?1:0});
  this.championHazards.push({kind,x,y,radius,damage,activeAt,expiresAt,visual:tele});
 }

 updateChampionHazards(time){
  for(const h of this.championHazards){
   if(!h.visual?.active) continue;
   if(time<h.activeAt){
    const t=Phaser.Math.Clamp((h.activeAt-time)/900,0,1);
    h.visual.setAlpha(0.10+0.12*(1-t));
    continue;
   }

   h.visual.setAlpha(0.20+0.08*Math.sin(time*0.018));
   const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,h.x,h.y);
   if(d<h.radius){
    if(time>this.lastDamageTime+this.invulnMs){
     this.damagePlayer(h.damage,`champion:${h.kind}`);
    }
   }
  }

  this.championHazards=this.championHazards.filter(h=>
   time<h.expiresAt || (h.visual?.active && h.visual.destroy())
  );
 }

 brokenSaintSpecial(e,time,dist){
  if(!e.reflectShielded && time>=e.reflectVulnerableUntil && e.specialIndex%2===0){
   this.activateReflectionShield(e,time);
   e.nextSpecialAt=time+5200;
  }else{
   this.castHolyMarkPattern(e,time);
   e.nextSpecialAt=time+4200;
  }
  e.specialIndex++;
 }
 activateReflectionShield(e,time){
  e.reflectShielded=true;
  e.reflectShieldUntil=time+5000;
  e.reflectVulnerableUntil=time+15000;
  if(e.reflectVisual?.active) e.reflectVisual.destroy();
  e.reflectVisual=this.add.sprite(e.x,e.y,'broken_saint_reflect_shield_00')
   .setOrigin(0.5,0.55)
   .setScale(1.12)
   .setDepth(27)
   .setAlpha(0.82)
   .play('broken_saint_reflect_shield');
 }
 updateReflectionShield(e,time){
  if(!e || e.championKind!=='brokenSaint') return;
  if(e.reflectShielded && time>=e.reflectShieldUntil){
   e.reflectShielded=false;
   if(e.reflectVisual?.active){
    e.reflectVisual.destroy();
    e.reflectVisual=null;
   }
  }
  if(e.reflectVisual?.active){
   e.reflectVisual.setPosition(e.x,e.y-16);
  }
 }
 castHolyMarkPattern(e,time){
  const px=this.player.x,py=this.player.y;
  const targets=[];
  for(let i=0;i<3;i++){
   const angle=(Math.PI*2*i/3)+time*0.001;
   targets.push({x:px+Math.cos(angle)*115,y:py+Math.sin(angle)*82});
  }
  for(let i=0;i<5;i++){
   const angle=(Math.PI*2*i/5)-time*0.0013;
   targets.push({x:px+Math.cos(angle)*72,y:py+Math.sin(angle)*50});
  }
  for(const [i,t] of targets.entries()){
   const x=this.clampWorldX(t.x,40),y=this.clampWorldY(t.y,40);
   const mark=this.add.sprite(x,y,'broken_saint_holy_mark_00').setOrigin(0.5).setScale(0.88).setDepth(10).play('broken_saint_holy_mark');
   const line=this.add.graphics().setDepth(9);
   line.lineStyle(2,0xf6de86,0.23);
   line.beginPath(); line.moveTo(e.x,e.y-35); line.lineTo(x,y); line.strokePath();
   this.championHazards.push({kind:'holyMark',x,y,radius:34,damage:10,activeAt:time+850+i*70,expiresAt:time+1450+i*70,visual:mark,beam:line});
   this.time.delayedCall(850+i*70,()=>{
    if(mark.active){
     mark.setTint(0xfff0a0);
     this.add.sprite(x,y,'broken_saint_holy_impact_00').setOrigin(0.5).setScale(0.9).setDepth(12).play('broken_saint_holy_impact').once('animationcomplete',function(){this.destroy();});
    }
    if(line.active){
     line.clear();
     line.lineStyle(5,0xffefaa,0.30);
     line.beginPath(); line.moveTo(e.x,e.y-35); line.lineTo(x,y); line.strokePath();
    }
   });
   this.time.delayedCall(1450+i*70,()=>{ if(line.active) line.destroy(); if(mark.active) mark.destroy(); });
  }
 }
 necromancerSpecial(e,time){
  const count=4;
  for(let i=0;i<count;i++){
   const angle=(Math.PI*2*i/count)+time*0.001;
   const x=this.clampWorldX(e.x+Math.cos(angle)*155,50);
   const y=this.clampWorldY(e.y+Math.sin(angle)*105,50);
   this.addChampionHazardCircle(x,y,42,1200,8,'corruption',0x67d979,450+i*90);
  }
  e.nextSpecialAt=time+3600;
 }
 shieldWardenSpecial(e,time){
  const dx=this.player.x-e.x,dy=this.player.y-e.y;
  const len=Math.max(1,Math.hypot(dx,dy));
  e.chargeVx=dx/len*360;
  e.chargeVy=dy/len*360;
  e.chargeUntil=time+520;
  e.nextSpecialAt=time+4400;
  const g=this.add.graphics().setDepth(12);
  g.lineStyle(6,0xb8c8d8,0.32);
  g.beginPath(); g.moveTo(e.x,e.y); g.lineTo(e.x+dx/len*240,e.y+dy/len*240); g.strokePath();
  this.tweens.add({targets:g,alpha:0,duration:550,onComplete:()=>g.destroy()});
 }
 hollowTreeSpecial(e,time){
  for(let i=0;i<5;i++){
   const angle=Math.PI*2*i/5+time*0.0007;
   const x=this.clampWorldX(this.player.x+Math.cos(angle)*95,45);
   const y=this.clampWorldY(this.player.y+Math.sin(angle)*72,45);
   this.addChampionHazardCircle(x,y,32,1500,9,'roots',0x91b967,300+i*120);
  }
  e.nextSpecialAt=time+3900;
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

 getChampionForWave(wave){
  if(wave===3) return 'brokenSaint';
  if(wave===6) return 'necromancer';
  if(wave===9) return 'shieldWarden';
  if(wave===12) return 'hollowTree';
  return null;
 }

 getChampionRewardPool(kind){
  const pools={
   brokenSaint:[
    {id:'holyFragment',name:'HOLY FRAGMENT',desc:'Every 5th sword hit burns nearby enemies.'},
    {id:'reflectionShard',name:'REFLECTION SHARD',desc:'Taking damage briefly harms nearby attackers.'},
    {id:'mercySeal',name:'MERCY SEAL',desc:'Low-health enemies take stronger sword hits.'}
   ],
   necromancer:[
    {id:'necromancerSoul',name:'NECROMANCER SOUL',desc:'Kill streaks briefly increase sword damage.'},
    {id:'soulSkull',name:'SOUL SKULL',desc:'A cursed skull periodically damages a target.'},
    {id:'greenCurse',name:'GREEN CURSE',desc:'XP crystals sometimes poison nearby enemies.'}
   ],
   shieldWarden:[
    {id:'shieldFragment',name:'SHIELD FRAGMENT',desc:'When mana is full, reduce incoming damage.'},
    {id:'heavyStrike',name:'HEAVY STRIKE',desc:'Sword hits sometimes knock enemies back.'},
    {id:'ironWill',name:'IRON WILL',desc:'At low HP, gain a short emergency armor burst.'}
   ],
   hollowTree:[
    {id:'rootHeart',name:'ROOT HEART',desc:'Enemies can leave damaging root patches.'},
    {id:'ancientBlood',name:'ANCIENT BLOOD',desc:'Hearts heal more and last longer.'},
    {id:'cursedGround',name:'CURSED GROUND',desc:'A dark patch follows your path and hurts enemies.'}
   ]
  };
  return pools[kind] || pools.brokenSaint;
 }
 openChampionRewardChoice(e){
  if(this.championRewardOpen) return;
  const pool=this.getChampionRewardPool(e.championKind).filter(r=>!this.championRelics.has(r.id));
  const shuffled=Phaser.Utils.Array.Shuffle(pool.slice());
  const choices=shuffled.slice(0,3);
  this.championRewardOpen=true;
  if(this.scene.isActive('HUDScene')){
   this.scene.get('HUDScene').showChampionRewards(e.championName,e.rewardColor || this.getChampionDefinition(e.championKind).rewardColor,choices);
  }else{
   this.showChampionRewardFallback(e,choices);
  }
 }
 showChampionRewardFallback(e,choices){
  this.choiceObjects=[];
  this.championRewardObjects=[];
  const cam=this.cameras.main;
  const view=cam.worldView;
  const cx=view.centerX,cy=view.centerY;
  const panel=this.add.rectangle(cx,cy,560,260,0x11100d,0.96).setDepth(120).setStrokeStyle(3,0x9b7d47,0.95);
  const title=this.add.text(cx,cy-105,`${e.championName} DEFEATED`,{fontFamily:'Arial, sans-serif',fontSize:'26px',fontStyle:'bold',color:'#f5d78f',stroke:'#111111',strokeThickness:4,align:'center'}).setOrigin(0.5).setDepth(121);
  const subtitle=this.add.text(cx,cy-72,'CHOOSE ONE CHAMPION RELIC',{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#ffffff'}).setOrigin(0.5).setDepth(121);
  this.championRewardObjects=[panel,title,subtitle];
  for(const [i,c] of choices.entries()){
   const x=cx-180+i*180;
   const card=this.add.rectangle(x,cy+25,160,150,0x1e261c,0.98).setDepth(121).setStrokeStyle(2,0x91b967,0.9).setInteractive();
   const nameText=this.add.text(x,cy-25,c.name,{fontFamily:'Arial, sans-serif',fontSize:'13px',fontStyle:'bold',color:'#f5d78f',align:'center',wordWrap:{width:140}}).setOrigin(0.5).setDepth(122);
   const descText=this.add.text(x,cy+38,c.desc,{fontFamily:'Arial, sans-serif',fontSize:'12px',color:'#ffffff',align:'center',wordWrap:{width:135}}).setOrigin(0.5).setDepth(122);
   card.on('pointerdown',()=>this.selectChampionReward(c.id));
   this.choiceObjects.push({card,choice:c});
   this.championRewardObjects.push(card,nameText,descText);
  }
 }
 selectChampionReward(id){
  if(!this.championRewardOpen) return;
  this.championRelics.add(id);
  if(id==='ancientBlood'){
   for(const heart of this.hearts){ if(heart.active) heart.expiresAt+=15000; }
  }
  for(const obj of this.championRewardObjects){
   if(obj?.active) obj.destroy();
  }
  this.championRewardObjects=[];
  this.choiceObjects=[];
  this.championRewardOpen=false;
  if(this.scene.isActive('HUDScene')) this.scene.get('HUDScene').hideChampionRewards();
 }
 applyRelicPassiveDamage(enemy,baseDamage,attackCounter=0){
  let bonus=0;
  if(this.championRelics.has('necromancerSoul')){
   bonus+=Math.min(18,this.killStreakBonus*1.5);
  }
  if(this.championRelics.has('mercySeal') && enemy.maxHp && enemy.hp/enemy.maxHp<=0.30){
   bonus+=baseDamage*0.35;
  }
  if(this.championRelics.has('holyFragment') && attackCounter%5===0){
   bonus+=5;
  }
  return bonus;
 }

 handleSkillInput(index){
  if(this.gameOver || this.levelChoiceOpen || this.championRewardOpen) return;
  if(!this.player || !this.player.active) return;
  if(!this.player.skills) return;
  if(index===1) this.castGroundTremor();
  else if(index===2) this.castLift();
  else if(index===3) this.castSwordSpin();
 }
 canCastSkill(skill){
  const time=this.time.now;
  if(this.player.mana<=0) return false;
  if(time<(skill.nextReadyAt||0)) return false;
  return true;
 }
 paySkill(skill){
  this.player.mana=Math.max(0,this.player.mana-1);
  skill.nextReadyAt=this.time.now+skill.cooldown;
  this.updateManaRegenSchedule(this.time.now);
 }
 castGroundTremor(){
  const skill=this.player.skills?.groundTremor;
  if(!skill || !this.canCastSkill(skill)) return false;
  this.paySkill(skill);
  const x=this.player.x,y=this.player.y;
  const radius=150+this.level*4;
  const damage=Math.max(6,Math.round(this.sword.damage*0.40));
  const ring=this.add.circle(x,y,radius,0xc88b55,0.10).setDepth(28).setStrokeStyle(4,0xffc275,0.45);
  this.tweens.add({targets:ring,scale:1.18,alpha:0,duration:360,ease:'Sine.easeOut',onComplete:()=>ring.destroy()});
  this.cameras.main.shake(135,0.006);
  for(const e of this.enemies){
   if(!e.active) continue;
   const d=Phaser.Math.Distance.Between(x,y,e.x,e.y);
   if(d>radius) continue;
   e.hp-=damage;
   this.flashEnemyHit(e);
   const dx=e.x-x,dy=e.y-y;
   const len=Math.max(1,Math.hypot(dx,dy));
   const resistance=e.type==='champion'?0.34:(e.type==='shield'?0.55:0.82);
   const knock=(1-d/radius)*240*resistance+90*resistance;
   if(e.body){
    e.body.velocity.x+=(dx/len)*knock;
    e.body.velocity.y+=(dy/len)*knock;
   }
   e.staggerUntil=this.time.now+260*resistance;
  }
  this.spawnShockwaveDust(x,y,radius);
  return true;
 }
 castLift(){
  const skill=this.player.skills?.lift;
  if(!skill || !this.canCastSkill(skill)) return false;
  this.paySkill(skill);
  const x=this.player.x,y=this.player.y;
  const radius=145+this.level*3;
  const damage=Math.max(8,Math.round(this.sword.damage*0.62));
  const column=this.add.ellipse(x,y,radius*1.45,radius*0.95,0x8fb7ff,0.13).setDepth(29).setStrokeStyle(3,0xcfe6ff,0.55);
  this.tweens.add({targets:column,scaleY:1.25,alpha:0,duration:540,ease:'Sine.easeOut',onComplete:()=>column.destroy()});
  for(const e of this.enemies){
   if(!e.active) continue;
   const d=Phaser.Math.Distance.Between(x,y,e.x,e.y);
   if(d>radius) continue;
   const resistance={skeleton:1.0,mage:0.70,shield:0.55,champion:0.18}[e.type] ?? 0.75;
   const liftHeight=(e.type==='champion'?42:130)*resistance;
   const driftX=(e.x-x)*0.18*resistance;
   const originalY=e.visual?.y??e.y;
   e.hp-=damage;
   this.flashEnemyHit(e);
   e.staggerUntil=this.time.now+720*resistance;
   if(e.body){
    e.body.velocity.x+=driftX*6;
    e.body.velocity.y-=70*resistance;
   }
   if(e.visual){
    this.tweens.add({targets:e.visual,y:originalY-liftHeight,angle:(e.x<x?-16:16)*resistance,duration:260,ease:'Sine.easeOut',yoyo:true,hold:150,onComplete:()=>{
     if(e.visual?.active){ e.visual.angle=0; }
     if(e.active){
      e.hp-=Math.max(4,Math.round(damage*0.35));
      this.flashEnemyHit(e);
      this.createLandingImpact(e.x,e.y);
     }
    }});
   }
  }
  return true;
 }
 castSwordSpin(){
  const skill=this.player.skills?.swordSpin;
  if(!skill || !this.canCastSkill(skill)) return false;
  this.paySkill(skill);
  const hits=4;
  const radius=Math.max(135,this.sword.radius+38);
  const damage=Math.max(4,Math.round(this.sword.damage*0.70));
  for(let i=0;i<hits;i++){
   this.time.delayedCall(i*115,()=>{
    const ring=this.add.sprite(this.player.x,this.player.y,`ring_sweep_00`).setOrigin(0.5).setScale(radius/96).setDepth(30).play('ring_sweep');
    ring.setRotation(i*Math.PI/2);
    ring.once('animationcomplete',()=>ring.destroy());
    for(const e of this.enemies){
     if(!e.active) continue;
     const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,e.x,e.y);
     if(d>radius) continue;
     e.hp-=damage;
     this.flashEnemyHit(e);
     const dx=e.x-this.player.x,dy=e.y-this.player.y,len=Math.max(1,Math.hypot(dx,dy));
     if(e.body){
      e.body.velocity.x+=(dx/len)*40;
      e.body.velocity.y+=(dy/len)*40;
     }
    }
   });
  }
  return true;
 }
 spawnShockwaveDust(x,y,radius){
  for(let i=0;i<14;i++){
   const a=(Math.PI*2*i/14)+Math.random()*0.18;
   const r=radius*(0.45+Math.random()*0.50);
   const dust=this.add.circle(x+Math.cos(a)*r,y+Math.sin(a)*r,Phaser.Math.Between(3,8),0xd0b07a,0.20).setDepth(9);
   this.tweens.add({targets:dust,alpha:0,scale:1.8,duration:380,onComplete:()=>dust.destroy()});
  }
 }
 createLandingImpact(x,y){
  this.cameras.main.shake(80,0.003);
  const impact=this.add.ellipse(x,y+8,46,18,0xd7c08a,0.18).setDepth(9);
  this.tweens.add({targets:impact,alpha:0,scaleX:1.7,scaleY:1.25,duration:240,onComplete:()=>impact.destroy()});
 }
 updateManaRegenSchedule(time){
  if(this.player.mana>=this.player.maxMana){
   this.player.nextManaAt=0;
   return;
  }
  if(!this.player.nextManaAt || this.player.nextManaAt<time){
   this.player.nextManaAt=time+this.player.manaRegenInterval;
  }
 }
 updateMana(time){
  if(this.player.mana>=this.player.maxMana){
   this.player.nextManaAt=0;
   return;
  }
  this.updateManaRegenSchedule(time);
  if(this.player.nextManaAt && time>=this.player.nextManaAt){
   this.player.mana=Math.min(this.player.maxMana,this.player.mana+1);
   this.player.nextManaAt=this.player.mana<this.player.maxMana ? time+this.player.manaRegenInterval : 0;
  }
 }
 getSkillHudData(){
  return this.player?.skills || {};
 }
 update(time,delta){
  if(this.gameOver){
   this.updateGameOverUI();
   return;
  }

  if(this.levelChoiceOpen || this.championRewardOpen){
   this.player.body.setVelocity(0,0);
   return;
  }

  this.handleMovement();
  this.updatePlayerSprite();
  this.updatePlayerReadabilityLayer();
  this.updateWorldStreaming();
  this.updateMana(time);
  this.updateSkillsState(time);
  this.sword.update(time);
  this.updateEnemies(time,delta);
  this.updateProjectiles(time);
  this.updateChampionHazards(time);
  this.updateRelicEffects(time);

  if(this.toSpawn>0 && time-this.lastSpawn>this.spawnInterval){
   this.spawnEnemy();
   this.toSpawn--;
   this.lastSpawn=time;
  }

  this.cleanupDeadAndCollect(time);
  this.updateHUD();
 }

 handleMovement(){
  let vx=0,vy=0;
  if(this.cursors?.left?.isDown || this.keys?.A?.isDown) vx-=1;
  if(this.cursors?.right?.isDown || this.keys?.D?.isDown) vx+=1;
  if(this.cursors?.up?.isDown || this.keys?.W?.isDown) vy-=1;
  if(this.cursors?.down?.isDown || this.keys?.S?.isDown) vy+=1;
  if(this.virtualInput){
   vx+=this.virtualInput.x||0;
   vy+=this.virtualInput.y||0;
  }
  const len=Math.hypot(vx,vy);
  if(len>0){
   vx/=len; vy/=len;
   this.player.body.setVelocity(vx*this.player.speed,vy*this.player.speed);
   this.lastPlayerDirX=vx;
   this.lastPlayerDirY=vy;
   this.playerDir=this.directionFromVector(vx,vy);
  }else{
   this.player.body.setVelocity(0,0);
  }
  this.playerSprite.setPosition(this.player.x,this.player.y);
 }
 directionFromVector(vx,vy){
  if(Math.abs(vx)>Math.abs(vy)*1.35) return vx<0?'left':'right';
  if(Math.abs(vy)>Math.abs(vx)*1.35) return vy<0?'up':'down';
  if(vx<0 && vy<0) return 'up';
  if(vx>0 && vy<0) return 'up';
  if(vx<0 && vy>0) return 'down';
  if(vx>0 && vy>0) return 'down';
  return this.playerDir || 'down';
 }
 updatePlayerSprite(){
  const moving=this.player.body.velocity.length()>5;
  const state=`player_${this.playerDir}_${moving?'walk':'idle'}`;
  if(state!==this.playerVisualState){
   this.playerVisualState=state;
   this.playerSprite.play(state,true);
  }
  this.playerSprite.setPosition(this.player.x,this.player.y);
 }
 updateSkillsState(time){
  const skills=this.player.skills;
  if(!skills) return;
  for(const skill of Object.values(skills)){
   skill.ready=time>=(skill.nextReadyAt||0);
  }
 }
 getCurrentViewMetrics(){
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
  const sidePool=sides.length ? sides : ['top','right','bottom','left'];
  const minX=this.clampWorldX(view.left+pad,pad);
  const maxX=this.clampWorldX(view.right-pad,pad);
  const minY=this.clampWorldY(view.top+pad,pad);
  const maxY=this.clampWorldY(view.bottom-pad,pad);
  for(let attempt=0;attempt<18;attempt++){
   const side=Phaser.Utils.Array.GetRandom(sidePool);
   let point;
   if(side==='top') point={x:Phaser.Math.Between(Math.round(minX),Math.round(maxX)),y:this.clampWorldY(view.top-margin,pad)};
   else if(side==='right') point={x:this.clampWorldX(view.right+margin,pad),y:Phaser.Math.Between(Math.round(minY),Math.round(maxY))};
   else if(side==='bottom') point={x:Phaser.Math.Between(Math.round(minX),Math.round(maxX)),y:this.clampWorldY(view.bottom+margin,pad)};
   else point={x:this.clampWorldX(view.left-margin,pad),y:Phaser.Math.Between(Math.round(minY),Math.round(maxY))};
   const safe=this.findNearestFreeGroundPoint(point.x,point.y,24,160,18);
   if(!this.isPointInsideAshBlocker(safe.x,safe.y,16)) return safe;
  }
  return this.findNearestFreeGroundPoint((minX+maxX)*0.5,(minY+maxY)*0.5,24,220,18);
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
  const metrics=this.computeCameraMetrics();
  const cam=this.cameras.main;
  cam.setZoom(metrics.zoom);
  cam.setDeadzone(metrics.deadzoneW,metrics.deadzoneH);
  this.positionTopStatusUI();
  this.positionFullscreenButton();
  if(this.gameOver) this.updateGameOverUI();
 }
 computeCameraMetrics(){
  const w=Math.max(1,this.scale.width);
  const h=Math.max(1,this.scale.height);
  const aspect=w/h;
  const mobile=this.isTouchDevice || (typeof window!=='undefined' && (window.matchMedia?.('(pointer: coarse)').matches || (navigator.maxTouchPoints||0)>0));
  const targetViewH=mobile
   ? 720
   : aspect>=1.9
    ? 820
    : 760;
  const zoom=Phaser.Math.Clamp(h/targetViewH,mobile?0.78:0.72,mobile?1.16:1.05);
  const viewW=w/zoom;
  const viewH=h/zoom;
  const deadzoneW=viewW*STAGE0.CAMERA_DEADZONE_WIDTH;
  const deadzoneH=viewH*STAGE0.CAMERA_DEADZONE_HEIGHT;
  return {zoom,viewW,viewH,deadzoneW,deadzoneH};
 }

 clampWorldX(x,pad=0){
  return Phaser.Math.Clamp(x,pad,STAGE0.WORLD_WIDTH-pad);
 }
 clampWorldY(y,pad=0){
  return Phaser.Math.Clamp(y,pad,STAGE0.WORLD_HEIGHT-pad);
 }
 getGateIndexForChampion(kind){
  return WORLD_DESIGN.GATES.findIndex(g=>g.champion===kind);
 }

 startWave(wave,first=false){
  this.wave=wave;
  const championKind=this.getChampionForWave(wave);
  this.championEventActive=Boolean(championKind);
  this.waveProfile=this.getWaveProfile(wave);
  const populationScale=championKind ? 0.70 : 1;
  this.toSpawn=Math.max(4,Math.round((8+wave*2)*populationScale));
  this.spawned=0;
  this.lastSpawn=this.time.now-999;
  this.spawnInterval=Math.max(260,900-wave*28);
  this.waveTitleText.setVisible(!championKind);
  this.waveSubText.setVisible(!championKind);
  this.waveTitleText.setText(`WAVE ${wave}`);
  this.waveSubText.setText(championKind ? 'CHAMPION EVENT' : this.waveProfile.name);
  this.positionTopStatusUI();
  if(championKind){
   const def=this.getChampionDefinition(championKind);
   this.championNameText.setText(def.name).setVisible(true);
   this.championHpBack.setVisible(true);
   this.championHpFill.setVisible(true);
   this.time.delayedCall(1200,()=>{
    if(!this.gameOver && !this.activeChampion) this.spawnChampion(championKind);
   });
  }else{
   this.championNameText.setVisible(false);
   this.championHpBack.setVisible(false);
   this.championHpFill.setVisible(false);
   this.tweens.add({targets:[this.waveTitleText,this.waveSubText],alpha:1,duration:220,yoyo:true,hold:1000,onComplete:()=>{this.waveTitleText.setVisible(false);this.waveSubText.setVisible(false);}});
  }
 }
 getWaveProfile(wave){
  const profiles=[
   {name:'ASH DRIFTERS',mageEvery:999,shieldEvery:999},
   {name:'BONE PATROL',mageEvery:999,shieldEvery:999},
   {name:'CINDER MAGES',mageEvery:5,shieldEvery:999},
   {name:'BROKEN SHIELDS',mageEvery:6,shieldEvery:5},
   {name:'PRESSURE LINE',mageEvery:5,shieldEvery:4},
   {name:'GRAVE CHANT',mageEvery:4,shieldEvery:5},
   {name:'IRON PHALANX',mageEvery:5,shieldEvery:3},
   {name:'HOLLOW PUSH',mageEvery:4,shieldEvery:4},
   {name:'ROOTED WALL',mageEvery:5,shieldEvery:3},
   {name:'WEBBED ASH',mageEvery:4,shieldEvery:4},
   {name:'LAST GUARD',mageEvery:4,shieldEvery:3},
   {name:'THE KINGDOM ANSWERS',mageEvery:3,shieldEvery:3}
  ];
  return profiles[Math.min(profiles.length-1,wave-1)];
 }
 handleEnemyHitBySword(enemy,damage,attackCounter=0){
  if(!enemy?.active) return;
  let finalDamage=damage;
  if(enemy.reflectShielded){
   finalDamage=Math.max(1,Math.round(damage*0.10));
   this.damagePlayer(4,'reflection');
   this.spawnReflectSpark(enemy.x,enemy.y);
  }
  finalDamage+=this.applyRelicPassiveDamage(enemy,damage,attackCounter);
  enemy.hp-=finalDamage;
  this.flashEnemyHit(enemy);
  let resistance={skeleton:1.0,mage:0.88,shield:0.48,champion:0.30}[enemy.type] || 0.75;
  let staggerMs={skeleton:135,mage:120,shield:85,champion:60}[enemy.type] || 100;
  if(enemy.type==='champion'){
   if(enemy.championKind==='shieldWarden'){
    resistance=0.18;
   } else if(enemy.championKind==='hollowTree'){
    resistance=0.08;
   }
  }
  const dx=enemy.x-this.player.x;
  const dy=enemy.y-this.player.y;
  const len=Math.max(1,Math.hypot(dx,dy));
  if(enemy.body){
   enemy.body.velocity.x+=(dx/len)*70*resistance;
   enemy.body.velocity.y+=(dy/len)*70*resistance;
  }
  enemy.staggerUntil=this.time.now+staggerMs;
  if(this.championRelics.has('heavyStrike') && Math.random()<0.20){
   enemy.staggerUntil=Math.max(
    enemy.staggerUntil,
    this.time.now+(enemy.type==='champion' ? 180 : 420)
   );
   if(enemy.body){
    enemy.body.velocity.x+=(dx/len)*180*resistance;
    enemy.body.velocity.y+=(dy/len)*180*resistance;
   }
  }
  this.triggerHolyFragment(enemy,attackCounter);
 }
 triggerHolyFragment(enemy,attackCounter){
  if(!this.championRelics.has('holyFragment') || attackCounter%5!==0) return;
  const radius=88;
  const burst=this.add.circle(enemy.x,enemy.y,radius,0xffe08a,0.11).setDepth(16).setStrokeStyle(2,0xffefb0,0.4);
  this.tweens.add({targets:burst,alpha:0,scale:1.2,duration:260,onComplete:()=>burst.destroy()});
  for(const e of this.enemies){
   if(!e.active || e===enemy) continue;
   if(Phaser.Math.Distance.Between(enemy.x,enemy.y,e.x,e.y)<radius){
    e.hp-=7;
    this.flashEnemyHit(e);
   }
  }
 }
 spawnReflectSpark(x,y){
  const spark=this.add.sprite(x,y,'broken_saint_reflect_spark_00').setDepth(28).setScale(0.8).play('broken_saint_reflect_spark');
  spark.once('animationcomplete',()=>spark.destroy());
 }
 updateRelicEffects(time){
  if(this.championRelics.has('soulSkull') && time>=this.nextSoulSkullAt){
   const target=this.enemies.find(e=>e.active);
   if(target){
    target.hp-=12;
    this.flashEnemyHit(target);
    const skull=this.add.text(target.x,target.y-28,'☠',{fontFamily:'Arial',fontSize:'22px',color:'#a0ffb4',stroke:'#071007',strokeThickness:3}).setOrigin(0.5).setDepth(30);
    this.tweens.add({targets:skull,y:skull.y-28,alpha:0,duration:700,onComplete:()=>skull.destroy()});
   }
   this.nextSoulSkullAt=time+4500;
  }

  if(this.championRelics.has('cursedGround') && time>=this.nextCursedGroundAt){
   const patch=this.add.circle(this.player.x,this.player.y,46,0x31412c,0.15).setDepth(7).setStrokeStyle(2,0x91b967,0.25);
   const expires=time+1800;
   this.groundEffects.push({kind:'cursedGround',x:this.player.x,y:this.player.y,radius:46,damage:3,nextTick:time+250,expires,visual:patch});
   this.nextCursedGroundAt=time+1800;
  }

  for(const effect of this.groundEffects){
   if(time>=effect.expires){
    if(effect.visual?.active) effect.visual.destroy();
    continue;
   }
   if(time>=effect.nextTick){
    for(const e of this.enemies){
     if(e.active && Phaser.Math.Distance.Between(effect.x,effect.y,e.x,e.y)<effect.radius){
      e.hp-=effect.damage;
      this.flashEnemyHit(e);
     }
    }
    effect.nextTick=time+350;
   }
  }
  this.groundEffects=this.groundEffects.filter(e=>time<e.expires);
 }
 onEnemyKilled(enemy,x,y){
  if(this.championRelics.has('necromancerSoul')){
   this.killStreakBonus=Math.min(12,this.killStreakBonus+1);
   this.time.delayedCall(2500,()=>{this.killStreakBonus=Math.max(0,this.killStreakBonus-1);});
  }
  if(this.championRelics.has('greenCurse') && Math.random()<0.30){
   this.addChampionHazardCircle(x,y,38,900,5,'greenCurse',0x67d979,120);
  }
  if(this.championRelics.has('rootHeart') && Math.random()<0.22){
   this.addChampionHazardCircle(x,y,36,1100,6,'rootPatch',0x91b967,80);
  }
 }
 onChampionDefeated(e){
  const kind=e.championKind;
  this.championEventActive=false;
  this.championNameText.setVisible(false);
  this.championHpBack.setVisible(false);
  this.championHpFill.setVisible(false);
  this.activeChampion=null;
  for(const h of this.championHazards){
   if(h.visual?.active) h.visual.destroy();
   if(h.beam?.active) h.beam.destroy();
  }
  this.championHazards=[];
  if(e.reflectVisual?.active) e.reflectVisual.destroy();

  // Defeating a champion opens the thematic passage to the next region.
  this.requestWorldAdvance(kind);
  this.openChampionRewardChoice(e);
 }

 flashEnemyHit(e){
  if(e.visual?.active){
   e.visual.setTint(0xffffff);
   this.time.delayedCall(55,()=>{
    if(e.visual?.active){
     const def=e.type==='champion' ? this.getChampionDefinition(e.championKind) : null;
     e.visual.setTint(def?.tint || 0xffffff);
    }
   });
  }
 }

 updateProjectiles(time){
  for(const p of this.projectiles){
   if(!p.active) continue;
   const distance=Phaser.Math.Distance.Between(p.x,p.y,this.player.x,this.player.y);
   if(distance<22){
    this.damagePlayer(8,'projectile');
    this.add.sprite(p.x,p.y,'hit_burst_00').setDepth(26).play('hit_burst').once('animationcomplete',function(){this.destroy();});
    p.destroy();
   }else if(time>p.expiresAt){
    p.destroy();
   }
  }
  this.projectiles=this.projectiles.filter(p=>p.active);
 }

 updateEnemies(time,delta){
  const dt=delta/1000;
  this.emptyScreenRushActive=this.isPlayerScreenEmptyOfNormalEnemies();
  this.mobAnimLastUpdate+=delta;
  for(const e of this.enemies){
   if(!e.active) continue;
   if(e.hp<=0) continue;
   this.updateReflectionShield(e,time);
   this.updateChampionAI(e,time,Phaser.Math.Distance.Between(e.x,e.y,this.player.x,this.player.y));

   if(e.chargeUntil && time<e.chargeUntil && e.body){
    e.body.setVelocity(e.chargeVx,e.chargeVy);
    this.syncEnemyVisual(e);
    continue;
   }

   const dx=this.player.x-e.x;
   const dy=this.player.y-e.y;
   const dist=Math.max(0.001,Math.hypot(dx,dy));
   const enemyIndex=this.enemies.indexOf(e);
   const keep=e.crowdKeepoutRadius||e.attackRange||62;
   const isNormal=e.type==='skeleton';
   const meleeSlot=isNormal ? this.getNormalMeleeSlot(e) : -1;
   const canMelee=isNormal ? meleeSlot>=0 && meleeSlot<4 : true;
   const desiredDist=canMelee
    ? keep
    : keep+(isNormal ? 44+Math.min(2,Math.max(0,meleeSlot-4))*24 : 28);

   if(time<e.staggerUntil){
    if(e.body){
     e.body.velocity.x*=0.92;
     e.body.velocity.y*=0.92;
    }
    this.syncEnemyVisual(e);
    continue;
   }

   let moveX=0,moveY=0;
   if(dist>desiredDist+3){
    moveX=dx/dist;
    moveY=dy/dist;
   }else if(dist<desiredDist-8){
    moveX=-dx/dist*0.55;
    moveY=-dy/dist*0.55;
   }

   if(isNormal){
    const tangential=(meleeSlot%2===0?1:-1)*0.16;
    moveX+=(-dy/dist)*tangential;
    moveY+=(dx/dist)*tangential;
   }

   const separation=this.getEnemySeparationVector(e);
   moveX+=separation.x;
   moveY+=separation.y;
   const mlen=Math.hypot(moveX,moveY);
   const currentSpeed=this.getEffectiveEnemySpeed(e);
   if(mlen>0.001 && e.body){
    e.body.setVelocity((moveX/mlen)*currentSpeed,(moveY/mlen)*currentSpeed);
   }else if(e.body){
    e.body.setVelocity(0,0);
   }

   this.updateEnemyDirection(e,dx,dy);
   this.updateEnemyVisualState(e,mlen>0.001);
   this.syncEnemyVisual(e);

   if(canMelee && dist<(e.attackRange||62) && time>e.nextAttack){
    e.nextAttack=time+(e.type==='mage'?1500:e.type==='shield'?1400:e.type==='champion'?1250:950);
    e.attackWindupUntil=time+260;
    e.attackAnimStarted=false;
    e.isAttacking=true;
    this.updateEnemyVisualState(e,false,true);
    if(e.type==='mage'){
     this.castMageBolt(e);
    }else if(e.type==='champion'){
     this.damagePlayer(e.damage||12,'champion:melee');
    }else{
     this.damagePlayer(e.type==='shield'?10:6,e.type);
    }
   }

   if(e.isAttacking && time>e.attackWindupUntil+360){
    e.isAttacking=false;
   }
  }
 }
 getNormalMeleeSlot(enemy){
  const normals=this.enemies
   .filter(e=>e.active && e.type==='skeleton')
   .map(e=>({e,d:Phaser.Math.Distance.Between(e.x,e.y,this.player.x,this.player.y)}))
   .sort((a,b)=>a.d-b.d);
  return normals.findIndex(entry=>entry.e===enemy);
 }
 getEffectiveEnemySpeed(enemy){
  if(
   this.emptyScreenRushActive &&
   enemy.type==='skeleton' &&
   this.isEnemyOutsideCurrentView(enemy)
  ){
   if(this.isEnemyNearCameraSpawnBand(enemy)) return enemy.speed;
   return enemy.speed*PURSUIT.EMPTY_SCREEN_SPEED_MULTIPLIER;
  }
  return enemy.speed;
 }
 isEnemyOutsideCurrentView(enemy){
  const view=this.cameras.main.worldView;
  const pad=18;
  return enemy.x<view.left-pad || enemy.x>view.right+pad || enemy.y<view.top-pad || enemy.y>view.bottom+pad;
 }
 isEnemyNearCameraSpawnBand(enemy){
  const view=this.cameras.main.worldView;
  const band=PURSUIT.NORMAL_SPAWN_BAND;
  return enemy.x>=view.left-band && enemy.x<=view.right+band && enemy.y>=view.top-band && enemy.y<=view.bottom+band;
 }
 isPlayerScreenEmptyOfNormalEnemies(){
  const view=this.cameras.main.worldView;
  const pad=40;
  return !this.enemies.some(e=>
   e.active &&
   e.type==='skeleton' &&
   e.x>=view.left-pad && e.x<=view.right+pad &&
   e.y>=view.top-pad && e.y<=view.bottom+pad
  );
 }
 getEnemySeparationVector(enemy){
  let sx=0,sy=0;
  for(const other of this.enemies){
   if(other===enemy || !other.active) continue;
   const dx=enemy.x-other.x;
   const dy=enemy.y-other.y;
   const d2=dx*dx+dy*dy;
   const min=(enemy.crowdRadius||16)+(other.crowdRadius||16)+10;
   if(d2>0.01 && d2<min*min){
    const d=Math.sqrt(d2);
    const strength=(min-d)/min;
    sx+=(dx/d)*strength*1.15;
    sy+=(dy/d)*strength*1.15;
   }
  }
  return {x:sx,y:sy};
 }
 updateEnemyDirection(e,dx,dy){
  if(Math.abs(dx)>Math.abs(dy)*1.25) e.dir=dx>0?'right':'left';
  else if(Math.abs(dy)>Math.abs(dx)*1.25) e.dir=dy>0?'down':'up';
  else e.dir=dy>0?'down':'up';
  e.attackDir=e.dir;
 }
 updateEnemyVisualState(e,moving,forceAttack=false){
  if(!e.visual) return;
  let prefix=e.type==='champion'
   ? (e.championKind==='brokenSaint' ? `broken_saint_${e.dir}` : `champion_${e.dir}`)
   : `${e.type}_${e.dir}`;
  const anim=forceAttack ? `${prefix}_attack` : `${prefix}_${moving?'walk':'idle'}`;
  if(e.visualState!==anim){
   e.visualState=anim;
   if(this.anims.exists(anim)) e.visual.play(anim,true);
  }
 }
 syncEnemyVisual(e){
  if(e.visual?.active){
   e.visual.setPosition(e.x,e.y);
   e.visual.setDepth(e.type==='champion'?24:15);
  }
  if(e.shadowVisual && e.shadowVisual.active){
   e.shadowVisual.setPosition(e.x,e.y+(e.hitRadius||14)*0.82);
  }
 }
 castMageBolt(e){
  const dx=this.player.x-e.x,dy=this.player.y-e.y;
  const len=Math.max(1,Math.hypot(dx,dy));
  const p=this.add.sprite(e.x,e.y-12,'mage_projectile_00').setDepth(22).setScale(0.65).play('mage_projectile');
  this.physics.add.existing(p);
  p.body.setVelocity((dx/len)*210,(dy/len)*210);
  p.expiresAt=this.time.now+3500;
  this.projectiles.push(p);
 }
 damagePlayer(amount,source='unknown'){
  const time=this.time.now;
  if(time-this.lastDamageTime<this.invulnMs) return;
  this.lastDamageTime=time;
  let finalAmount=amount;
  if(this.championRelics.has('shieldFragment') && this.player.mana>=this.player.maxMana){
   finalAmount=Math.ceil(finalAmount*0.72);
  }
  if(this.championRelics.has('ironWill') && this.player.hp<=35){
   finalAmount=Math.ceil(finalAmount*0.50);
   if(time-this.lastIronWillTriggerAt>8000){
    this.lastIronWillTriggerAt=time;
    const aura=this.add.circle(this.player.x,this.player.y,70,0xb8c8d8,0.13).setDepth(27).setStrokeStyle(3,0xdbe7ff,0.5);
    this.tweens.add({targets:aura,alpha:0,scale:1.3,duration:600,onComplete:()=>aura.destroy()});
   }
  }
  this.player.hp-=finalAmount;
  this.cameras.main.shake(80,0.003);
  this.playerSprite.setTint(0xff6666);
  this.time.delayedCall(90,()=>this.playerSprite.clearTint());
  if(this.championRelics.has('reflectionShard')){
   const radius=58;
   for(const e of this.enemies){
    if(e.active && Phaser.Math.Distance.Between(this.player.x,this.player.y,e.x,e.y)<radius){
     e.hp-=4;
     this.flashEnemyHit(e);
    }
   }
  }
  if(this.player.hp<=0){
   this.player.hp=0;
   this.showGameOver();
  }
 }

 cleanupDeadAndCollect(time){
  for(const e of this.enemies){
   if(!e.active) continue;

   if(e.hp<=0){
    const deathX=e.x;
    const deathY=e.y;
    const enemyType=e.type;
    const orbCount=enemyType==='champion' ? 0 : 1;

    for(let i=0;i<orbCount;i++){
     const offsetX=Phaser.Math.Between(-18,18);
     const offsetY=Phaser.Math.Between(-18,18);
     const dropPos=this.findNearestFreeGroundPoint(deathX+offsetX,deathY+offsetY,20,260,34);
     const orb=this.add.image(
      dropPos.x,
      dropPos.y,
      'xp_crystal'
     ).setDepth(12);
     this.physics.add.existing(orb);
     this.orbs.push(orb);
    }

    if(Math.random()<0.10){
     const heartPos=this.findNearestFreeGroundPoint(deathX,deathY,20,260,34);
     const heart=this.add.image(
      heartPos.x,heartPos.y,'health_heart'
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
      this.player.x,
      this.player.y-42,
      `+${healed}`,
      {fontFamily:'Arial, sans-serif',fontSize:'18px',fontStyle:'bold',color:'#ff6f6f',stroke:'#2a0000',strokeThickness:3}
     ).setOrigin(0.5).setDepth(31);

     this.tweens.add({
      targets:healText,
      y:healText.y-28,
      alpha:0,
      duration:650,
      ease:'Sine.easeOut',
      onComplete:()=>healText.destroy()
     });
    }

    heart.destroy();
   }
  }

  this.enemies=this.enemies.filter(e=>e.active);
  this.orbs=this.orbs.filter(o=>o.active);
  this.hearts=this.hearts.filter(heart=>heart.active);

  if(this.toSpawn<=0 && this.enemies.length===0 && !this.levelChoiceOpen && !this.championRewardOpen){
   this.startWave(this.wave+1);
  }
 }

 updateHUD(){
  const aliveMages=this.enemies.filter(e=>e.active && e.type==='mage').length;
  const aliveShields=this.enemies.filter(e=>e.active && e.type==='shield').length;
  const aliveChampions=this.enemies.filter(e=>e.active && e.type==='champion').length;
  const aliveSkeletons=this.enemies.filter(e=>e.active && e.type==='skeleton').length;
  this.hpText.setText(`HP: ${Math.ceil(this.player.hp)}`);
  this.infoText.setText(
   `Wave: ${this.wave} (${this.waveProfile ? this.waveProfile.name : '---'})\nHP: ${this.player.hp}\nLevel: ${this.level}\nXP: ${this.xp}\nKills: ${this.kills}\nSword Lv${this.sword.level}: ${this.sword.damage} dmg / ${this.sword.cooldown}ms / R${this.sword.radius}\nMage alive: ${aliveMages} / spawned: ${this.mageSpawned}\nShield alive: ${aliveShields} / spawned: ${this.shieldSpawned}\nChampion alive: ${aliveChampions} / spawned: ${this.championSpawned}\nSkeleton alive: ${aliveSkeletons} / spawned: ${this.skeletonSpawned}\nRelics: ${Array.from(this.championRelics).join(', ') || 'none'}\nSoul stacks: ${this.championRelics.has('necromancerSoul') ? this.killStreakBonus : '-'}  Iron Will: ${this.championRelics.has('ironWill') && this.player.hp<=35 ? 'ACTIVE' : '-'}\nRegion: ${this.getWorldProgressName()}  Progress: ${Math.round(this.getZoneTravelProgress()*100)}%\nGates open: ${this.unlockedWorldGates.size}/4  Back seals: ${this.closedWorldGates.size}\nEmpty-screen x4 rush: ${this.emptyScreenRushActive ? 'ACTIVE' : '-'}\nWorld: ${Math.round(this.player.x)},${Math.round(this.player.y)}  View: ${Math.round(this.cameras.main.worldView.width)}x${Math.round(this.cameras.main.worldView.height)}\nProjectiles: ${this.projectiles.length}\nHearts: ${this.hearts.length}\nBuild 1.0.4: melee rings + 4-skeleton pressure + Holy Mark + corner fix + x4 Rush\nR: restart after death`
  );
 }

 applyLevelUp(){
  this.level++;
  this.openLevelChoice();
 }
 openLevelChoice(){
  this.levelChoiceOpen=true;
  const choices=[
   {label:'Sword Damage +5',apply:()=>{this.sword.damage+=5;}},
   {label:'Attack Faster',apply:()=>{this.sword.cooldown=Math.max(250,this.sword.cooldown-70);}},
   {label:'Attack Radius +10%',apply:()=>{this.sword.radius=Math.round(this.sword.radius*1.10);}}
  ];
  this.levelChoices=Phaser.Utils.Array.Shuffle(choices).slice(0,3);
  if(this.scene.isActive('HUDScene')){
   this.scene.get('HUDScene').showLevelChoices(this.levelChoices);
   return;
  }
 }
 chooseUpgrade(index){
  const choice=this.levelChoices[index];
  if(!choice) return;
  choice.apply();
  this.levelChoiceOpen=false;
  this.levelChoices=[];
  if(this.scene.isActive('HUDScene')) this.scene.get('HUDScene').hideLevelChoices();
 }
 showGameOver(){
  this.gameOver=true;
  this.player.body.setVelocity(0,0);
  this.physics.pause();
  this.playerSprite.setTint(0x555555);
  if(this.scene.isActive('HUDScene')) this.scene.stop('HUDScene');

  const cam=this.cameras.main;
  const view=cam.worldView;
  const cx=view.centerX,cy=view.centerY;
  this.gameOverBanner=this.add.rectangle(cx,cy,560,190,0x120d0d,0.92).setDepth(200).setStrokeStyle(3,0x8a5a3c,1);
  this.gameOverText=this.add.text(cx,cy-38,'YOU DIED',{fontFamily:'Arial, sans-serif',fontSize:'38px',fontStyle:'bold',color:'#ffdddd',stroke:'#240000',strokeThickness:5}).setOrigin(0.5).setDepth(201);
  this.restartText=this.add.text(cx,cy+38,'Press R to Restart',{fontFamily:'Arial, sans-serif',fontSize:'18px',fontStyle:'bold',color:'#f0d0a0',stroke:'#1a0e05',strokeThickness:3}).setOrigin(0.5).setDepth(201);
 }
 updateGameOverUI(){
  if(!this.gameOverBanner) return;
  const view=this.cameras.main.worldView;
  const cx=view.centerX,cy=view.centerY;
  this.gameOverBanner.setPosition(cx,cy);
  this.gameOverText.setPosition(cx,cy-38);
  this.restartText.setPosition(cx,cy+38);
 }

 createDeathBurst(e,x,y){
  const burst=this.add.sprite(x,y-8,'hit_burst_00').setDepth(26).setScale(e.type==='champion'?1.35:0.85).play('hit_burst');
  burst.once('animationcomplete',()=>burst.destroy());
 }
}

class HUDScene extends Phaser.Scene{
 constructor(){super('HUDScene');}
 init(data){this.mainScene=data.mainScene;}
 create(){
  this.choiceVisible=false;
  this.choiceRects=[];
  this.choiceTexts=[];
  this.choiceTitle=this.add.text(0,0,'LEVEL UP',{fontFamily:'Arial, sans-serif',fontSize:'28px',fontStyle:'bold',color:'#ffe7a5',stroke:'#210e05',strokeThickness:5,align:'center'}).setOrigin(0.5).setDepth(120).setVisible(false);
  this.choicePanel=this.add.graphics().setDepth(118).setVisible(false);
  for(let i=0;i<3;i++){
   const rect=this.add.rectangle(0,0,220,86,0x15100d,0.96).setStrokeStyle(2,0xb28a52,0.95).setDepth(119).setInteractive({useHandCursor:true}).setVisible(false);
   const text=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'16px',fontStyle:'bold',color:'#ffffff',align:'center',wordWrap:{width:185}}).setOrigin(0.5).setDepth(120).setVisible(false);
   rect.on('pointerdown',()=>this.mainScene.chooseUpgrade(i));
   this.choiceRects.push(rect);
   this.choiceTexts.push(text);
  }

  this.championRewardVisible=false;
  this.championRewardData=[];
  this.championRewardShade=this.add.rectangle(0,0,100,100,0x050403,0.62).setOrigin(0).setDepth(118).setVisible(false);
  this.championRewardPanel=this.addPanelGraphics(119).setVisible(false);
  this.championRewardTitle=this.add.text(0,0,'CHAMPION DEFEATED',{fontFamily:'Arial, sans-serif',fontSize:'26px',fontStyle:'bold',color:'#f5d78f',stroke:'#111111',strokeThickness:4,align:'center'}).setOrigin(0.5).setDepth(120).setVisible(false);
  this.championRewardSubtitle=this.add.text(0,0,'CHOOSE ONE CHAMPION RELIC',{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#ffffff'}).setOrigin(0.5).setDepth(120).setVisible(false);
  this.championRewardCards=[];
  for(let i=0;i<3;i++){
   const card=this.add.rectangle(0,0,160,150,0x1e261c,0.98).setDepth(120).setStrokeStyle(2,0x91b967,0.9).setInteractive({useHandCursor:true}).setVisible(false);
   const name=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'13px',fontStyle:'bold',color:'#f5d78f',align:'center',wordWrap:{width:140}}).setOrigin(0.5).setDepth(121).setVisible(false);
   const desc=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'12px',color:'#ffffff',align:'center',wordWrap:{width:135}}).setOrigin(0.5).setDepth(121).setVisible(false);
   card.on('pointerdown',()=>{ const choice=this.championRewardData[i]; if(choice) this.mainScene.selectChampionReward(choice.id); });
   card.on('pointerover',()=>{ if(this.championRewardVisible) card.setFillStyle(0x354b32,1); });
   card.on('pointerout',()=>{ if(this.championRewardVisible) card.setFillStyle(0x1e261c,0.98); });
   this.championRewardCards.push({card,name,desc});
  }

  this.mainScene.isTouchDevice=this.isTouchEnvironment();
  this.virtualInput={x:0,y:0,active:false};
  this.mainScene.virtualInput=this.virtualInput;
  this.skillButtons=[];
  this.hudBuilt=false;
  this.buildControls();
  this.buildHeroHud();
  this.scale.on('resize',this.layoutAll,this);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
   this.scale.off('resize',this.layoutAll,this);
   this.mainScene.virtualInput=null;
  });
  this.layoutAll();
 }
 isTouchEnvironment(){
  return typeof window!=='undefined' && (window.matchMedia?.('(pointer: coarse)').matches || (navigator.maxTouchPoints||0)>0);
 }
 addPanelGraphics(depth=10){
  return this.add.graphics().setDepth(depth);
 }
 showLevelChoices(choices){
  this.choiceVisible=true;
  this.choiceData=choices;
  this.choiceTitle.setVisible(true);
  this.choicePanel.setVisible(true);
  this.choiceRects.forEach((rect,i)=>{
   rect.setVisible(true);
   this.choiceTexts[i].setText(choices[i]?.label||'').setVisible(true);
  });
  this.layoutLevelChoices();
 }
 hideLevelChoices(){
  this.choiceVisible=false;
  this.choiceTitle.setVisible(false);
  this.choicePanel.setVisible(false);
  this.choiceRects.forEach((rect,i)=>{rect.setVisible(false);this.choiceTexts[i].setVisible(false);});
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
   entry.card.setVisible(Boolean(c)).setFillStyle(0x1e261c,0.98);
   entry.name.setText(c?.name||'').setVisible(Boolean(c));
   entry.desc.setText(c?.desc||'').setVisible(Boolean(c));
  });
  this.layoutChampionRewards();
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
 layoutChampionRewards(){
  if(!this.championRewardVisible) return;
  const w=this.scale.width,h=this.scale.height;
  const mobile=this.isTouchEnvironment();
  this.championRewardShade.setPosition(0,0).setSize(w,h).setDisplaySize(w,h);
  this.championRewardPanel.clear();
  const panelW=Math.min(w-28,mobile?560:620),panelH=mobile?230:270,cx=w/2,cy=h/2;
  const x=cx-panelW/2,y=cy-panelH/2,r=mobile?10:13;
  this.championRewardPanel.fillStyle(0x070605,0.46); this.championRewardPanel.fillRoundedRect(x+5,y+5,panelW,panelH,r);
  this.championRewardPanel.fillStyle(0x11100d,0.96); this.championRewardPanel.fillRoundedRect(x,y,panelW,panelH,r);
  this.championRewardPanel.lineStyle(mobile?2:2.5,0x9b7d47,0.94); this.championRewardPanel.strokeRoundedRect(x,y,panelW,panelH,r);
  this.championRewardTitle.setPosition(cx,y+(mobile?27:32)).setFontSize(mobile?20:27);
  this.championRewardSubtitle.setPosition(cx,y+(mobile?55:67)).setFontSize(mobile?11:14);
  const cardW=mobile?150:170,cardH=mobile?132:150,gap=mobile?8:14;
  this.championRewardCards.forEach((entry,i)=>{
   const c=this.championRewardData[i];
   if(!c) return;
   const total=cardW*3+gap*2;
   const cardX=cx-total/2+cardW/2+i*(cardW+gap);
   const cardY=y+(mobile?143:170);
   entry.card.setPosition(cardX,cardY).setSize(cardW,cardH).setDisplaySize(cardW,cardH);
   entry.name.setPosition(cardX,cardY-cardH*0.30).setFontSize(mobile?11:13).setWordWrapWidth(cardW-20);
   entry.desc.setPosition(cardX,cardY+cardH*0.12).setFontSize(mobile?10:12).setWordWrapWidth(cardW-24);
  });
 }
 layoutLevelChoices(){
  if(!this.choiceVisible) return;
  const w=this.scale.width,h=this.scale.height;
  const mobile=this.isTouchEnvironment();
  const panelW=Math.min(w-28,mobile?500:620),panelH=mobile?170:210,cx=w/2,cy=h/2;
  this.choicePanel.clear();
  this.choicePanel.fillStyle(0x070605,0.42);
  this.choicePanel.fillRoundedRect(cx-panelW/2+5,cy-panelH/2+5,panelW,panelH,12);
  this.choicePanel.fillStyle(0x11100d,0.96);
  this.choicePanel.fillRoundedRect(cx-panelW/2,cy-panelH/2,panelW,panelH,12);
  this.choicePanel.lineStyle(2,0x9b7d47,0.94);
  this.choicePanel.strokeRoundedRect(cx-panelW/2,cy-panelH/2,panelW,panelH,12);
  this.choiceTitle.setPosition(cx,cy-panelH/2+(mobile?28:36)).setFontSize(mobile?20:28);
  const cardW=mobile?145:180,cardH=mobile?68:86,gap=mobile?8:16;
  const total=cardW*3+gap*2;
  for(let i=0;i<3;i++){
   const x=cx-total/2+cardW/2+i*(cardW+gap);
   const y=cy+(mobile?30:38);
   this.choiceRects[i].setPosition(x,y).setSize(cardW,cardH).setDisplaySize(cardW,cardH);
   this.choiceTexts[i].setPosition(x,y).setFontSize(mobile?12:16).setWordWrapWidth(cardW-20);
  }
 }
 buildControls(){
  this.joystickBase=this.add.circle(0,0,48,0x000000,0.28).setStrokeStyle(2,0xffffff,0.20).setDepth(80).setVisible(false);
  this.joystickKnob=this.add.circle(0,0,22,0xffffff,0.42).setDepth(81).setVisible(false);
  this.joyCenter={x:0,y:0};
  this.joyRadius=70;
  this.movePointerId=null;
  this.input.on('pointerdown',p=>this.handlePointerDown(p));
  this.input.on('pointermove',p=>this.handlePointerMove(p));
  this.input.on('pointerup',p=>this.handlePointerUp(p));
  this.input.on('pointerupoutside',p=>this.handlePointerUp(p));
  this.skillButtons=[
   this.makeSkillButton(1,'quake'),
   this.makeSkillButton(2,'lift'),
   this.makeSkillButton(3,'spin')
  ];
 }
 makeSkillButton(index,kind){
  const c=this.add.container(0,0).setDepth(90);
  const bg=this.add.circle(0,0,40,0x0d0f0d,0.86).setStrokeStyle(2,0xb79a58,0.95);
  const inner=this.add.circle(0,0,32,0x16120e,0.34).setStrokeStyle(1,0xffd47a,0.24);
  const icon=this.add.image(0,0,SKILL_ICON_KEYS[kind]).setDisplaySize(56,56).setDepth(91);
  const maskShape=this.add.circle(0,0,32,0xffffff,1).setVisible(false);
  const mask=maskShape.createGeometryMask();
  icon.setMask(mask);
  const cd=this.add.circle(0,0,32,0x000000,0.55).setVisible(false);
  const text=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'14px',fontStyle:'bold',color:'#ffffff',stroke:'#000000',strokeThickness:3}).setOrigin(0.5).setVisible(false);
  const keyText=this.add.text(-30,-30,String(index),{fontFamily:'Arial, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#f3d18a',stroke:'#000000',strokeThickness:3}).setOrigin(0.5);
  c.add([bg,inner,icon,cd,text,keyText]);
  c.setSize(86,86).setInteractive(new Phaser.Geom.Circle(0,0,43),Phaser.Geom.Circle.Contains);
  c.on('pointerdown',()=>this.mainScene.handleSkillInput(index));
  return {container:c,bg,inner,icon,maskShape,cd,text,keyText,index,kind};
 }
 buildHeroHud(){
  const addHud=(name,depth=20)=>this.add.image(0,0,`hero_hud_${name}`).setScrollFactor(0).setDepth(depth).setVisible(true);
  this.heroPanelShell=this.add.graphics().setScrollFactor(0).setDepth(20);
  this.levelBadge=addHud('level_badge_large',25).setVisible(false);
  this.levelBadgeSimple=this.add.graphics().setScrollFactor(0).setDepth(25);
  this.levelCaption=this.add.text(0,0,'LVL',{fontFamily:'Arial, sans-serif',fontSize:'10px',fontStyle:'bold',color:'#d9bd7a',stroke:'#100b07',strokeThickness:3}).setOrigin(0.5).setScrollFactor(0).setDepth(26).setVisible(false);
  this.levelText=this.add.text(0,0,'1',{fontFamily:'Arial, sans-serif',fontSize:'26px',fontStyle:'bold',color:'#ffffff',stroke:'#130b07',strokeThickness:5}).setOrigin(0.5).setScrollFactor(0).setDepth(27);
  this.hpFill=this.add.rectangle(0,0,100,10,0xb5262c,1).setOrigin(0,0.5).setScrollFactor(0).setDepth(21);
  this.hpShine=this.add.rectangle(0,0,100,2,0xff8d7f,0.38).setOrigin(0,0.5).setScrollFactor(0).setDepth(22);
  this.hpFrame=addHud('hp_bar_frame',24);
  this.hpText=this.add.text(0,0,'100 / 100',{fontFamily:'Arial, sans-serif',fontSize:'11px',fontStyle:'bold',color:'#ffffff',stroke:'#290607',strokeThickness:4}).setOrigin(0.5).setScrollFactor(0).setDepth(28);
  this.manaHousing=addHud('mana_housing_3slot',24).setVisible(false);
  this.manaRingsSimple=this.add.graphics().setScrollFactor(0).setDepth(23);
  this.manaGems=[];
  for(let i=0;i<3;i++) this.manaGems.push(this.add.image(0,0,'hero_hud_mana_bottle_blue').setScrollFactor(0).setDepth(25));
  this.xpFill=this.add.rectangle(0,0,100,3,0xf2d34a,1).setOrigin(0,0.5).setScrollFactor(0).setDepth(21);
  this.xpFrame=addHud('xp_bar_frame',24);
  this.hudBuilt=true;
 }
 layoutHeroHud(){
  if(!this.hudBuilt) return;
  const w=this.scale.width,h=this.scale.height;
  const mobile=this.isTouchEnvironment();
  const safeTop=Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top'))||0;
  const safeLeft=Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-left'))||0;
  const left=Math.round((mobile?10:14)+safeLeft),top=Math.round((mobile?8:10)+safeTop);
  const basePanelW=mobile?348:450,basePanelH=mobile?118:148;
  const rawScale=Math.min(w/basePanelW*0.95,h/360);
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
  // Build 1.3.12: keep the approved width, but make the HP frame 18% slimmer vertically.
  const hpHeightScale=0.68;
  const hpH=Math.max(16,Math.round((hpW/hpAspect)*hpHeightScale));
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
  // Optical centering: the visible opening of the ornate XP frame sits slightly below the sprite midpoint.
  const xpFillY=Math.round(xpY+Math.max(1,Math.round(3*uiScale)));
  this.xpFill.setPosition(xpInnerX,xpFillY).setSize(xpInnerW,xpInnerH).setDisplaySize(xpInnerW,xpInnerH);

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
  const clusterCx=Math.round(bodyX+bodyW*0.5);
  const manaCenters=[clusterCx-(manaR*2+ringGap),clusterCx,clusterCx+(manaR*2+ringGap)];
  for(const cx of manaCenters){
   this.manaRingsSimple.fillStyle(0x171512,0.96);
   this.manaRingsSimple.fillCircle(cx,manaY,manaR-1);
   this.manaRingsSimple.lineStyle(Math.max(2,Math.round(3*uiScale)),0xd39a35,1);
   this.manaRingsSimple.strokeCircle(cx,manaY,manaR-1);
   this.manaRingsSimple.lineStyle(1,0xffd47a,0.50);
   this.manaRingsSimple.strokeCircle(cx,manaY,Math.max(5,manaR-Math.max(4,Math.round(5*uiScale))));
  }
  const bottleSize=Math.max(12,Math.round(manaR*1.05));
  const opticalLift=Math.max(0,Math.round(manaR*0.04));
  this.manaGems.forEach((gem,i)=>gem.setPosition(manaCenters[i],manaY-opticalLift).setDisplaySize(bottleSize,bottleSize));
 }
 updateHeroHud(){
  if(!this.hudBuilt || !this.mainScene?.player) return;
  const p=this.mainScene.player;
  const hp=Phaser.Math.Clamp(p.hp,0,100);
  const hpRatio=hp/100;
  this.hpFill.displayWidth=(this.hpFill.width||100)*hpRatio;
  this.hpShine.displayWidth=(this.hpShine.width||100)*hpRatio;
  this.hpText.setText(`${Math.ceil(hp)} / 100`);
  this.levelText.setText(String(this.mainScene.level||1));
  const xpRatio=Phaser.Math.Clamp((this.mainScene.xp||0)/100,0,1);
  this.xpFill.displayWidth=(this.xpFill.width||100)*xpRatio;
  const m=this.mainScene.player;
  const mana=Phaser.Math.Clamp(m.mana??0,0,m.maxMana??3);
  this.manaGems.forEach((gem,i)=>{
   const active=i<mana;
   gem.setAlpha(active?1:0.22);
   if(active) gem.clearTint();
   else gem.setTint(0x4a5560);
  });
 }
 layoutAll(){
  this.layoutControls();
  this.layoutHeroHud();
  this.layoutLevelChoices();
  this.layoutChampionRewards();
 }
 layoutControls(){
  const w=this.scale.width,h=this.scale.height;
  const mobile=this.isTouchEnvironment();
  const safeLeft=Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-left'))||0;
  const safeRight=Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-right'))||0;
  const safeBottom=Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom'))||0;
  this.joyRadius=mobile?76:58;
  this.joyCenter={x:safeLeft+(mobile?105:90),y:h-safeBottom-(mobile?102:86)};
  this.joystickBase.setPosition(this.joyCenter.x,this.joyCenter.y).setRadius(this.joyRadius*0.64);
  this.joystickKnob.setPosition(this.joyCenter.x,this.joyCenter.y).setRadius(this.joyRadius*0.30);
  this.joystickBase.setVisible(mobile);
  this.joystickKnob.setVisible(mobile);
  const skillR=mobile?39:34;
  const baseX=w-safeRight-(mobile?76:64);
  const baseY=h-safeBottom-(mobile?86:74);
  const gap=mobile?74:64;
  const positions=[
   {x:baseX-gap,y:baseY+8},
   {x:baseX,y:baseY-42},
   {x:baseX+gap*0.15,y:baseY+34}
  ];
  this.skillButtons.forEach((b,i)=>{
   b.container.setPosition(positions[i].x,positions[i].y);
   b.bg.setRadius(skillR);
   b.inner.setRadius(skillR*0.80);
   b.icon.setDisplaySize(skillR*1.42,skillR*1.42);
   b.maskShape.setPosition(positions[i].x,positions[i].y).setRadius(skillR*0.80);
   b.cd.setRadius(skillR*0.80);
   b.keyText.setPosition(-skillR*0.74,-skillR*0.74);
   b.container.setSize(skillR*2.2,skillR*2.2);
   b.container.input.hitArea=new Phaser.Geom.Circle(0,0,skillR*1.10);
  });
 }
 handlePointerDown(p){
  if(!this.mainScene?.isTouchDevice || this.levelChoiceVisible || this.championRewardVisible || this.mainScene?.gameOver) return;
  if(p.x<this.scale.width*0.55 && this.movePointerId===null){
   this.movePointerId=p.id;
   this.joystickBase.setVisible(true);
   this.joystickKnob.setVisible(true);
   this.updateJoystickFromPointer(p);
  }
 }
 handlePointerMove(p){
  if(p.id===this.movePointerId) this.updateJoystickFromPointer(p);
 }
 handlePointerUp(p){
  if(p.id!==this.movePointerId) return;
  this.movePointerId=null;
  this.virtualInput.x=0;
  this.virtualInput.y=0;
  this.joystickKnob.setPosition(this.joyCenter.x,this.joyCenter.y);
 }
 updateJoystickFromPointer(p){
  const dx=p.x-this.joyCenter.x,dy=p.y-this.joyCenter.y;
  const len=Math.hypot(dx,dy);
  const max=this.joyRadius;
  const clamped=Math.min(max,len);
  const nx=len>0?dx/len:0,ny=len>0?dy/len:0;
  this.virtualInput.x=nx*(clamped/max);
  this.virtualInput.y=ny*(clamped/max);
  this.joystickKnob.setPosition(this.joyCenter.x+nx*clamped*0.55,this.joyCenter.y+ny*clamped*0.55);
 }
 update(time){
  if(!this.mainScene || this.mainScene.scene.settings.status<Phaser.Scenes.RUNNING) return;
  this.updateHeroHud();
  this.updateSkillButtons(time);
 }
 updateSkillButtons(time){
  const skills=this.mainScene.getSkillHudData?.()||{};
  const map=[skills.groundTremor,skills.lift,skills.swordSpin];
  const mana=this.mainScene.player?.mana??0;
  this.skillButtons.forEach((b,i)=>{
   const skill=map[i];
   if(!skill) return;
   const remaining=Math.max(0,(skill.nextReadyAt||0)-time);
   const ready=remaining<=0 && mana>0;
   b.bg.setFillStyle(ready?0x101410:0x171515,ready?0.90:0.72);
   b.bg.setStrokeStyle(2,ready?0xd9b76a:0x786542,ready?0.96:0.62);
   b.inner.setStrokeStyle(1,ready?0xffd47a:0x8f7a50,ready?0.32:0.16);
   b.cd.setVisible(!ready);
   b.text.setVisible(remaining>0);
   if(remaining>0) b.text.setText(String(Math.ceil(remaining/1000)));
   b.icon.setAlpha(ready?1:0.52);
  });
 }
}

const config={
 type:Phaser.AUTO,
 parent:'game',
 width:window.innerWidth,
 height:window.innerHeight,
 backgroundColor:'#10140f',
 pixelArt:false,
 roundPixels:true,
 antialias:true,
 resolution:Math.min(Math.max(window.devicePixelRatio||1,1),2),
 physics:{
  default:'arcade',
  arcade:{debug:false}
 },
 scene:[BootScene,PreloadScene,MainScene,HUDScene],
 scale:{
  mode:Phaser.Scale.RESIZE,
  autoCenter:Phaser.Scale.CENTER_BOTH
 }
};

new Phaser.Game(config);

// Centralized gameplay audio lifecycle and combat SFX.
// Methods operate on the MainScene instance (`this`) to preserve the exact
// runtime state while moving audio ownership out of main.js.
class AudioManager {
 setupBackgroundMusic(){
  if(!this.sound || !this.cache.audio.exists('bgm_veil_of_the_past')) return;

  const handedOff=this.registry.get('lastKnightBgmHandoff');
  if(handedOff){
   this.registry.remove('lastKnightBgmHandoff');
   this.backgroundMusic=handedOff;
  } else if(!this.backgroundMusic){
   this.backgroundMusic=this.sound.add('bgm_veil_of_the_past',{loop:true,volume:0.50});
  }

  const startMusic=()=>{
   const music=this.backgroundMusic;
   if(!music || music.isPlaying) return;
   // Do not resurrect normal BGM while the Broken Saint boss track owns the mix.
   if(this.brokenSaintMusic?.isPlaying) return;
   try{music.play();}catch(e){console.warn('Background music start failed',e);}
  };

  if(this.backgroundMusic?.isPlaying) return;
  if(this.sound.locked){
   this.sound.once('unlocked',startMusic);
  } else {
   startMusic();
  }
 }

 stopBackgroundMusic(){
  if(!this.backgroundMusic) return;
  try{this.backgroundMusic.stop();}catch{}
  try{this.backgroundMusic.destroy();}catch{}
  this.backgroundMusic=null;
 }

 startBrokenSaintMusic(){
  this.stopBrokenSaintMusic();
  this.stopBackgroundMusic();
  if(!this.sound || !this.cache.audio.exists('sfx_broken_saint_spawn')) return;
  const startMusic=()=>{
   if(this.brokenSaintMusic || !this.activeChampion || !this.activeChampion.active || this.activeChampion.championKind!=='brokenSaint') return;
   const music=this.sound.add('sfx_broken_saint_spawn',{loop:true,volume:0.50});
   this.brokenSaintMusic=music;
   music.play();
  };
  if(this.sound.locked) this.sound.once('unlocked',startMusic);
  else startMusic();
 }

 stopBrokenSaintMusic(){
  if(!this.brokenSaintMusic) return;
  try{this.brokenSaintMusic.stop();}catch{}
  try{this.brokenSaintMusic.destroy();}catch{}
  this.brokenSaintMusic=null;
 }

 playAshSwordPulseSfx(){
  this.stopAshSwordPulseSfx();
  if(!this.sound || this.sound.locked || !this.cache.audio.exists('sfx_ash_sword_pulse')) return;
  const sound=this.sound.add('sfx_ash_sword_pulse',{volume:0.936});
  this.ashSwordPulseSound=sound;
  sound.once('complete',()=>{
   if(this.ashSwordPulseSound===sound)this.ashSwordPulseSound=null;
   sound.destroy();
  });
  sound.play();
 }

 stopAshSwordPulseSfx(){
  const sound=this.ashSwordPulseSound;
  if(!sound)return;
  this.ashSwordPulseSound=null;
  try{if(sound.isPlaying)sound.stop();}catch{}
  try{sound.destroy();}catch{}
 }

 playBrokenSaintMaterializeSfx(){
  if(!this.sound || this.sound.locked || !this.cache.audio.exists('sfx_broken_saint_materialize')) return;
  this.sound.play('sfx_broken_saint_materialize',{volume:0.60});
 }

 playBrokenSaintDisappearSfx(){
  if(!this.sound || this.sound.locked || !this.cache.audio.exists('sfx_broken_saint_disappear')) return;
  this.sound.play('sfx_broken_saint_disappear',{volume:0.70});
 }

 playHeroSwordAttackSfx(){
  if(!this.sound || this.sound.locked || !this.cache.audio.exists('sfx_hero_sword_attack')) return;
  this.sound.play('sfx_hero_sword_attack',{volume:0.42});
 }

 playHeroDeathSfx(){
  if(!this.sound || this.sound.locked || !this.cache.audio.exists('sfx_hero_death')) return;
  this.sound.play('sfx_hero_death',{volume:0.78});
 }

 playHeroHitSfx(){
  if(!this.sound || this.sound.locked || !this.cache.audio.exists('sfx_hero_hit')) return;
  this.sound.play('sfx_hero_hit',{volume:0.3528});
 }

 playSkillSfx(key,volume=0.42){
  if(!this.sound || this.sound.locked || !this.cache.audio.exists(key)) return;
  this.sound.play(key,{volume});
 }

 startBrokenSaintHolyWarningSfx(){
  this.stopBrokenSaintHolyWarningSfx();
  if(!this.sound || this.sound.locked || !this.cache.audio.exists('sfx_broken_saint_holy_warning')) return;
  const sound=this.sound.add('sfx_broken_saint_holy_warning',{volume:1.0});
  this.brokenSaintHolyWarningSound=sound;
  sound.once('complete',()=>{
   if(this.brokenSaintHolyWarningSound===sound) this.brokenSaintHolyWarningSound=null;
   sound.destroy();
  });
  sound.play();
 }

 stopBrokenSaintHolyWarningSfx(){
  const sound=this.brokenSaintHolyWarningSound;
  if(!sound) return;
  this.brokenSaintHolyWarningSound=null;
  if(sound.isPlaying) sound.stop();
  sound.destroy();
 }

 playBrokenSaintHolyBeamSfx(){
  if(!this.sound || this.sound.locked || !this.cache.audio.exists('sfx_broken_saint_holy_beam')) return;
  this.sound.play('sfx_broken_saint_holy_beam',{volume:0.55});
 }

 playHeroSwordImpactSfx(){
  if(!this.sound || this.sound.locked || !this.cache.audio.exists('sfx_hero_sword_impact')) return;
  this.sound.play('sfx_hero_sword_impact',{volume:0.45});
 }

 playSkeletonAttackSfx(time=this.time.now){
  if(!this.sound || this.sound.locked || !this.cache.audio.exists('sfx_skeleton_sword_attack')) return;
  // One shared limiter for ordinary skeleton swings: simultaneous attackers do not
  // produce a pile of identical transients, but slightly staggered attacks can still read.
  if(time-(this.lastSkeletonAttackSfxAt||-9999)<110) return;
  this.lastSkeletonAttackSfxAt=time;
  this.sound.play('sfx_skeleton_sword_attack',{volume:0.24});
 }

 playMageCastSfx(time=this.time.now){
  if(!this.sound || this.sound.locked || !this.cache.audio.exists('sfx_mage_cast')) return;
  // Keep multiple mages readable without stacking the same transient at full volume.
  if(time-(this.lastMageCastSfxAt||-9999)<90) return;
  this.lastMageCastSfxAt=time;
  this.sound.play('sfx_mage_cast',{volume:0.65});
 }
}

export default AudioManager;

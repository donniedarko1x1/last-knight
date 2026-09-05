import {getGameSettings} from '../GamePersistence.js';
// Centralized gameplay audio lifecycle and combat SFX.
// Methods operate on the MainScene instance (`this`) to preserve the exact
// runtime state while moving audio ownership out of main.js.
function musicVolume(base){return base*getGameSettings().musicVolume;}
function sfxVolume(base){return base*getGameSettings().sfxVolume;}
function canPlaySfx(scene,key){
 return Boolean(scene?.sound && !scene.sound.locked && !scene.gameplayAudioPaused && scene.cache?.audio?.exists?.(key));
}
function destroySound(sound){
 if(!sound)return;
 try{if(sound.isPlaying||sound.isPaused)sound.stop();}catch{}
 try{sound.destroy();}catch{}
}

class AudioManager {
 setupBackgroundMusic(){
  if(!this.sound || !this.cache.audio.exists('bgm_veil_of_the_past')) return;

  const handedOff=this.registry.get('lastKnightBgmHandoff');
  if(handedOff){
   this.registry.remove('lastKnightBgmHandoff');
   this.backgroundMusic=handedOff;
  } else if(!this.backgroundMusic){
   this.backgroundMusic=this.sound.add('bgm_veil_of_the_past',{loop:true,volume:musicVolume(0.50)});
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

 applyAudioSettings(){
  const settings=getGameSettings();
  try{this.backgroundMusic?.setVolume?.(0.50*settings.musicVolume);}catch{}
  try{this.brokenSaintMusic?.setVolume?.(0.50*settings.musicVolume);}catch{}
  try{
   const count=Math.max(1,Number(this.crowFlightLoopCount)||1);
   const base=Math.min(0.34,0.18+Math.min(12,count)*0.013);
   this.crowFlightLoopSound?.setVolume?.(base*settings.sfxVolume);
  }catch{}
  return settings;
 }

 stopBackgroundMusic(){
  if(!this.backgroundMusic) return;
  destroySound(this.backgroundMusic);
  this.backgroundMusic=null;
 }

 startBrokenSaintMusic(){
  this.stopBrokenSaintMusic();
  this.stopBackgroundMusic();
  if(!this.sound || !this.cache.audio.exists('sfx_broken_saint_spawn')) return;
  const startMusic=()=>{
   if(this.brokenSaintMusic || !this.activeChampion || !this.activeChampion.active || this.activeChampion.championKind!=='brokenSaint') return;
   const music=this.sound.add('sfx_broken_saint_spawn',{loop:true,volume:musicVolume(0.50)});
   this.brokenSaintMusic=music;
   music.play();
  };
  if(this.sound.locked) this.sound.once('unlocked',startMusic);
  else startMusic();
 }

 stopBrokenSaintMusic(){
  if(!this.brokenSaintMusic) return;
  destroySound(this.brokenSaintMusic);
  this.brokenSaintMusic=null;
 }

 // Pause every gameplay sound except the current music owner. Phaser's Sound
 // Manager is global, so this catches transient one-shot sounds created through
 // sound.play() as well as the explicitly stored combat sounds below.
 pauseGameplaySfx(){
  if(!this.sound)return 0;
  if(!this.pausedGameplaySfx)this.pausedGameplaySfx=new Set();
  let paused=0;
  for(const sound of [...(this.sound.sounds||[])]){
   if(!sound || sound===this.backgroundMusic || sound===this.brokenSaintMusic || sound.lkDevMixerMusic)continue;
   if(!sound.isPlaying)continue;
   try{
    sound.pause();
    if(sound.isPaused){this.pausedGameplaySfx.add(sound);paused++;}
   }catch{}
  }
  return paused;
 }

 resumeGameplaySfx(){
  const pending=[...(this.pausedGameplaySfx||[])];
  this.pausedGameplaySfx=new Set();
  let resumed=0;
  for(const sound of pending){
   if(!sound || sound===this.backgroundMusic || sound===this.brokenSaintMusic)continue;
   try{
    if(sound.isPaused){sound.resume();resumed++;}
   }catch{}
  }
  return resumed;
 }

 stopGameplaySfx(){
  if(!this.sound)return 0;
  let stopped=0;
  for(const sound of [...(this.sound.sounds||[])]){
   if(!sound || sound===this.backgroundMusic || sound===this.brokenSaintMusic)continue;
   destroySound(sound);stopped++;
  }
  this.pausedGameplaySfx?.clear?.();
  this.pausedGameplaySfx=new Set();
  this.ashSwordPulseSound=null;
  this.brokenSaintHolyWarningSound=null;
  this.brokenSaintMaterializeSound=null;
  this.brokenSaintDisappearSound=null;
  this.crowFlightLoopSound=null;
  this.crowFlightLoopCount=0;
  return stopped;
 }

 playAshSwordPulseSfx(){
  this.stopAshSwordPulseSfx();
  if(!canPlaySfx(this,'sfx_ash_sword_pulse')) return;
  const sound=this.sound.add('sfx_ash_sword_pulse',{volume:sfxVolume(0.936)});
  this.ashSwordPulseSound=sound;
  sound.once('complete',()=>{
   if(this.ashSwordPulseSound===sound)this.ashSwordPulseSound=null;
   try{sound.destroy();}catch{}
  });
  sound.play();
 }

 stopAshSwordPulseSfx(){
  const sound=this.ashSwordPulseSound;
  if(!sound)return;
  this.ashSwordPulseSound=null;
  destroySound(sound);
 }

 playBrokenSaintTailEcho(key,baseVolume=0.6,sourceEndMs=0){
  if(!canPlaySfx(this,key))return null;
  const echo=this.sound.add(key,{
   volume:sfxVolume(Math.max(0.04,baseVolume*0.20)),
   rate:0.90,
   detune:-120
  });
  echo.once('complete',()=>{try{echo.destroy();}catch{}});
  try{echo.play();}catch{try{echo.destroy();}catch{}return null;}
  // Keep the echo a short tail even if the browser backend ignores `seek`.
  if(this.time?.delayedCall){
   this.time.delayedCall(260,()=>destroySound(echo));
  }
  return echo;
 }

 playTimedBrokenSaintSfx(kind,key,volume,maxDurationMs){
  const soundProp=kind==='materialize'?'brokenSaintMaterializeSound':'brokenSaintDisappearSound';
  const timerProp=kind==='materialize'?'brokenSaintMaterializeStopTimer':'brokenSaintDisappearStopTimer';
  const stopMethod=kind==='materialize'?'stopBrokenSaintMaterializeSfx':'stopBrokenSaintDisappearSfx';
  this[stopMethod]?.();
  if(!canPlaySfx(this,key))return null;
  const sound=this.sound.add(key,{volume:sfxVolume(volume)});
  this[soundProp]=sound;
  const duration=Math.max(0,Number(maxDurationMs)||0);
  let echoPlayed=false;
  const playEcho=()=>{
   if(echoPlayed)return;
   echoPlayed=true;
   AudioManager.prototype.playBrokenSaintTailEcho.call(this,key,volume,duration||Math.round((Number(sound.duration)||0)*1000));
  };
  sound.once('complete',()=>{
   if(this[soundProp]===sound)this[soundProp]=null;
   const timer=this[timerProp];
   if(timer){try{timer.remove(false);}catch{}this[timerProp]=null;}
   playEcho();
   try{sound.destroy();}catch{}
  });
  sound.play();
  if(duration>0 && this.time?.delayedCall){
   this[timerProp]=this.time.delayedCall(duration,()=>{
    this[timerProp]=null;
    this[stopMethod]?.();
    playEcho();
   });
  }
  return sound;
 }

 playBrokenSaintMaterializeSfx(maxDurationMs=0){
  return AudioManager.prototype.playTimedBrokenSaintSfx.call(this,'materialize','sfx_broken_saint_materialize',0.60,maxDurationMs);
 }

 stopBrokenSaintMaterializeSfx(){
  if(this.brokenSaintMaterializeStopTimer){
   try{this.brokenSaintMaterializeStopTimer.remove(false);}catch{}
   this.brokenSaintMaterializeStopTimer=null;
  }
  const sound=this.brokenSaintMaterializeSound;
  this.brokenSaintMaterializeSound=null;
  destroySound(sound);
 }

 playBrokenSaintDisappearSfx(maxDurationMs=0){
  return AudioManager.prototype.playTimedBrokenSaintSfx.call(this,'disappear','sfx_broken_saint_disappear',0.70,maxDurationMs);
 }

 stopBrokenSaintDisappearSfx(){
  if(this.brokenSaintDisappearStopTimer){
   try{this.brokenSaintDisappearStopTimer.remove(false);}catch{}
   this.brokenSaintDisappearStopTimer=null;
  }
  const sound=this.brokenSaintDisappearSound;
  this.brokenSaintDisappearSound=null;
  destroySound(sound);
 }

 playCrowScatterSfx(){
  if(this.gameplayAudioPaused || !this.sound || this.sound.locked)return false;
  const specs=[
   ['sfx_crow_wings',0.72],
   ['sfx_crow_bunch',0.52]
  ];
  let played=false;
  for(const [key,volume] of specs){
   if(!this.cache.audio.exists(key))continue;
   const sound=this.sound.add(key,{volume:sfxVolume(volume)});
   sound.once('complete',()=>{try{sound.destroy();}catch{}});
   try{sound.play();played=true;}catch{try{sound.destroy();}catch{}}
  }
  return played;
 }

 startCrowFlightLoopSfx(){
  // Crow wings are intentionally a one-shot takeoff cue now. Keeping these
  // compatibility methods as no-ops prevents older call sites from creating
  // a looping flight sound while the flock is already airborne.
  if(this.crowFlightLoopSound)this.stopCrowFlightLoopSfx();
  return null;
 }

 stopCrowFlightLoopSfx(){
  const sound=this.crowFlightLoopSound;
  this.crowFlightLoopSound=null;
  this.crowFlightLoopCount=0;
  destroySound(sound);
 }

 syncCrowFlightLoopSfx(){
  if(this.crowFlightLoopSound)this.stopCrowFlightLoopSfx();
  return null;
 }

 playHeroSwordAttackSfx(){
  if(!canPlaySfx(this,'sfx_hero_sword_attack')) return;
  this.sound.play('sfx_hero_sword_attack',{volume:sfxVolume(0.42)});
 }

 playHeroDeathSfx(){
  if(!canPlaySfx(this,'sfx_hero_death')) return;
  this.sound.play('sfx_hero_death',{volume:sfxVolume(0.78)});
 }

 playHeroHitSfx(detune=0){
  if(!canPlaySfx(this,'sfx_hero_hit')) return;
  const sound=this.sound.add('sfx_hero_hit',{volume:sfxVolume(0.3528),detune:Number(detune)||0});
  sound.once('complete',()=>{try{sound.destroy();}catch{}});
  try{sound.play();}catch{try{sound.destroy();}catch{}}
 }

 playSkillSfx(key,volume=0.42){
  if(!canPlaySfx(this,key)) return;
  this.sound.play(key,{volume:sfxVolume(volume)});
 }

 startBrokenSaintHolyWarningSfx(){
  this.stopBrokenSaintHolyWarningSfx();
  if(!canPlaySfx(this,'sfx_broken_saint_holy_warning')) return;
  const sound=this.sound.add('sfx_broken_saint_holy_warning',{volume:sfxVolume(1.0)});
  this.brokenSaintHolyWarningSound=sound;
  sound.once('complete',()=>{
   if(this.brokenSaintHolyWarningSound===sound) this.brokenSaintHolyWarningSound=null;
   try{sound.destroy();}catch{}
  });
  sound.play();
 }

 stopBrokenSaintHolyWarningSfx(){
  const sound=this.brokenSaintHolyWarningSound;
  if(!sound) return;
  this.brokenSaintHolyWarningSound=null;
  destroySound(sound);
 }

 playBrokenSaintHolyBeamSfx(){
  if(!canPlaySfx(this,'sfx_broken_saint_holy_beam')) return;
  this.sound.play('sfx_broken_saint_holy_beam',{volume:sfxVolume(0.55)});
 }

 playHeroSwordImpactSfx(){
  if(!canPlaySfx(this,'sfx_hero_sword_impact')) return;
  this.sound.play('sfx_hero_sword_impact',{volume:sfxVolume(0.45)});
 }

 playSkeletonAttackSfx(time=this.time.now){
  if(!canPlaySfx(this,'sfx_skeleton_sword_attack')) return;
  // One shared limiter for ordinary skeleton swings: simultaneous attackers do not
  // produce a pile of identical transients, but slightly staggered attacks can still read.
  if(time-(this.lastSkeletonAttackSfxAt||-9999)<110) return;
  this.lastSkeletonAttackSfxAt=time;
  this.sound.play('sfx_skeleton_sword_attack',{volume:sfxVolume(0.24)});
 }

 playMageCastSfx(time=this.time.now){
  if(!canPlaySfx(this,'sfx_mage_cast')) return;
  // Keep multiple mages readable without stacking the same transient at full volume.
  if(time-(this.lastMageCastSfxAt||-9999)<90) return;
  this.lastMageCastSfxAt=time;
  this.sound.play('sfx_mage_cast',{volume:sfxVolume(0.65)});
 }
}

export default AudioManager;

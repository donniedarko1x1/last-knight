const SAVE_SCHEMA_VERSION=1;
const AUTOSAVE_KEY='lastKnight.save.autosave.v1';
const SLOT_PREFIX='lastKnight.save.slot.';
const SETTINGS_KEY='lastKnight.settings.v1';
const CHARACTER_STATS_KEY='lastKnight.characterStats.current.v1';

const DEFAULT_SETTINGS=Object.freeze({
 musicVolume:1,
 sfxVolume:1,
 graphics:'medium'
});

function storageAvailable(){
 try{return typeof localStorage!=='undefined';}catch{return false;}
}

function readJson(key,fallback=null){
 if(!storageAvailable())return fallback;
 try{
  const raw=localStorage.getItem(key);
  if(!raw)return fallback;
  const value=JSON.parse(raw);
  return value===undefined?fallback:value;
 }catch(error){
  console.warn(`[LastKnightStorage] Could not read ${key}`,error);
  return fallback;
 }
}

function writeJson(key,value){
 if(!storageAvailable())return false;
 try{
  localStorage.setItem(key,JSON.stringify(value));
  return true;
 }catch(error){
  console.warn(`[LastKnightStorage] Could not write ${key}`,error);
  return false;
 }
}

function removeKey(key){
 if(!storageAvailable())return false;
 try{localStorage.removeItem(key);return true;}catch{return false;}
}

function normalizeVolume(value,fallback=1){
 const n=Number(value);
 return Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback;
}

function normalizeSave(value){
 if(!value || typeof value!=='object')return null;
 const version=Number(value.schemaVersion)||0;
 if(version<1 || version>SAVE_SCHEMA_VERSION)return null;
 return value;
}

export function getGameSettings(){
 const saved=readJson(SETTINGS_KEY,{});
 const graphics=['ultra','medium','minimum'].includes(saved?.graphics)?saved.graphics:DEFAULT_SETTINGS.graphics;
 return {
  musicVolume:normalizeVolume(saved?.musicVolume,DEFAULT_SETTINGS.musicVolume),
  sfxVolume:normalizeVolume(saved?.sfxVolume,DEFAULT_SETTINGS.sfxVolume),
  graphics
 };
}

export function setGameSettings(patch={}){
 const current=getGameSettings();
 const next={...current,...patch};
 next.musicVolume=normalizeVolume(next.musicVolume,current.musicVolume);
 next.sfxVolume=normalizeVolume(next.sfxVolume,current.sfxVolume);
 if(!['ultra','medium','minimum'].includes(next.graphics))next.graphics=current.graphics;
 writeJson(SETTINGS_KEY,next);
 return next;
}

export function getAutosave(){return normalizeSave(readJson(AUTOSAVE_KEY,null));}
export function writeAutosave(save){return writeJson(AUTOSAVE_KEY,save);}
export function clearAutosave(){return removeKey(AUTOSAVE_KEY);}

export function getManualSave(slot){
 const safe=Math.max(1,Math.min(3,Math.round(Number(slot)||1)));
 return normalizeSave(readJson(`${SLOT_PREFIX}${safe}.v1`,null));
}

export function writeManualSave(slot,save){
 const safe=Math.max(1,Math.min(3,Math.round(Number(slot)||1)));
 return writeJson(`${SLOT_PREFIX}${safe}.v1`,save);
}

export function deleteManualSave(slot){
 const safe=Math.max(1,Math.min(3,Math.round(Number(slot)||1)));
 return removeKey(`${SLOT_PREFIX}${safe}.v1`);
}

export function getManualSaves(){
 return [1,2,3].map(slot=>({slot,save:getManualSave(slot)}));
}

export function writeCharacterStats(stats){return writeJson(CHARACTER_STATS_KEY,stats||{});}
export function getCharacterStats(){return readJson(CHARACTER_STATS_KEY,null);}
export function clearCharacterStats(){return removeKey(CHARACTER_STATS_KEY);}

export function saveSummary(save){
 if(!save)return null;
 const stats=save.characterStats||{};
 const world=save.world||{};
 const wave=save.wave||{};
 return {
  savedAt:Number(save.savedAt)||0,
  level:Number(stats.level??save.hero?.level)||1,
  hp:Number(stats.hp??save.hero?.hp)||0,
  maxHp:Number(stats.maxHp??save.hero?.maxHp)||0,
  zoneName:String(stats.regionName||world.zoneName||'UNKNOWN'),
  globalWave:Number(stats.globalWave||wave.globalWave||wave.number)||1
 };
}

export {SAVE_SCHEMA_VERSION};

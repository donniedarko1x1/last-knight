// A zone restart rolls back the failed attempt, not the completed previous zone.
// Store values only: never retain sprites, timers, textures or physics bodies.
const BUILD_FIELDS=[
 'level','xp','kills','mana','maxMana','manaRegenMs','championHpMultiplier',
 'championManaRegenMultiplier','skillRecoveryMultiplier','bsPenitenceCharges',
 'killStreakBonus','fallenBlessingUsed','combatStyle','combatStyleChargeReady'
];
const SET_FIELDS=['championRelics','championSkillEvolutions','championEssences'];
const MELEE_FIELDS=['level','damage','cooldown','radius'];

export function captureZoneBuild(scene){
 const build={hp:scene.player.hp,maxHp:scene.player.maxHp,
  weaponLevels:{...scene.weaponLevels},melee:{}};
 for(const key of BUILD_FIELDS)build[key]=scene[key];
 for(const key of SET_FIELDS)build[key]=[...(scene[key]||[])];
 for(const key of MELEE_FIELDS)build.melee[key]=scene.meleeAttack[key];
 return build;
}

export function restoreZoneBuild(scene,build){
 if(!build)return;
 for(const key of BUILD_FIELDS)if(build[key]!==undefined)scene[key]=build[key];
 for(const key of SET_FIELDS)scene[key]=new Set(build[key]||[]);
 scene.weaponLevels={...build.weaponLevels};
 Object.assign(scene.meleeAttack,build.melee,{lastAttack:scene.time.now});
 scene.player.maxHp=build.maxHp;
 scene.player.hp=Math.max(1,Math.min(build.maxHp,build.hp));
 scene.nextManaRegenAt=scene.mana<scene.maxMana?scene.time.now+scene.manaRegenMs:0;
 scene.nextSoulSkullAt=scene.time.now+1400;
 scene.nextCursedGroundAt=scene.time.now+4000;
}

export function restartZoneIndex(data,zoneCount){
 const index=data?.zoneRestart?.zoneIndex;
 return Number.isInteger(index)&&index>=0&&index<zoneCount?index:0;
}

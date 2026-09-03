// First encounter tuning. All durations use the scene clock (milliseconds).
export const CAPTAIN=Object.freeze({
 zone:1, localWave:1, skeletonCount:16, maxLivingSoldiers:10, spawnInterval:1400,
 captainOrdinal:5, bodyScale:1.15, speedFactor:.55, damage:10,
 commandMs:1000, maxCommandsPerWave:2, firstCommandMinMs:5000, firstCommandMaxMs:10000,
 commandCooldownMinMs:14000, commandCooldownMaxMs:24000,
 ringRadius:145, ringMinRadius:52, ringGatherMs:4000, ringContractMs:5000,
 ringEscapeTolerance:18, ringSpeed:240, minSoldiers:3,
 ringCatchupSpeed:440, ringCatchupBonus:220, ringSlotTolerance:24, ringMinGatherMs:450,
 guardIntervalMs:6000, guardDurationMs:2200, guardCount:3,
 // Keep the same attack sector, but trim its reach so the captain still has a
 // threatening ground slam without covering an excessive share of the arena.
 // Telegraph, dust and hit detection all derive from this same distance.
 strikeRange:240, strikeStartRange:270, strikeHalfAngle:Math.PI*.30,
 windupMs:950, recoveryMs:650, attackCooldownMs:4800, stunMs:1500,
 fleeMs:4500
});
export const CAPTAIN_DIRS=['north','northeast','east','southeast','south','southwest','west','northwest'];
export const CAPTAIN_CARDINALS=['north','east','south','west'];
export const CAPTAIN_FRAME_KEYS=[
 ...CAPTAIN_DIRS.flatMap(d=>[1,2].map(n=>`skeleton_captain_walk_${d}_0${n}`)),
 ...CAPTAIN_CARDINALS.flatMap(d=>['01','ground'].map(f=>`skeleton_captain_attack_${d}_${f}`)),
 'skeleton_captain_skill_front','skeleton_captain_skill_back',
 'skeleton_captain_scarlet_cast_01','skeleton_captain_scarlet_cast_02'
];
export function globalWave(zone,localWave){return Math.max(0,zone)*5+Math.max(1,localWave);}
export function isCaptainEncounter(zone,localWave){return zone===CAPTAIN.zone && localWave===CAPTAIN.localWave;}
export function shieldHpForWave(wave){return 95+wave*10;}
export function captainStats(wave){return {hp:shieldHpForWave(wave)*2,speed:(80+wave*5)*CAPTAIN.speedFactor,damage:CAPTAIN.damage};}
export function commandDelay(first=false,random=Math.random){
 const min=first?CAPTAIN.firstCommandMinMs:CAPTAIN.commandCooldownMinMs;
 const max=first?CAPTAIN.firstCommandMaxMs:CAPTAIN.commandCooldownMaxMs;
 return Math.round(min+random()*(max-min));
}
export function direction8(dx,dy,fallback='south'){
 if(Math.hypot(dx,dy)<.01)return fallback;
 return ['east','southeast','south','southwest','west','northwest','north','northeast'][
  (Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8];
}
export function direction4(dx,dy){return Math.abs(dx)>Math.abs(dy)?(dx>0?'east':'west'):(dy>0?'south':'north');}
export function skillFrame(direction){
 // Author's filenames are reversed: visually front = skill_back, back = skill_front.
 return `skeleton_captain_skill_${direction.includes('north')?'front':'back'}`;
}
export function strikeHits(origin,player,angle){
 const dx=player.x-origin.x,dy=player.y-origin.y;
 const delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-angle),Math.cos(Math.atan2(dy,dx)-angle));
 return Math.hypot(dx,dy)<=CAPTAIN.strikeRange+(player.hitRadius||16) && Math.abs(delta)<=CAPTAIN.strikeHalfAngle;
}
export function ringRadiusAt(ring,now){
 if(ring.phase==='gather')return CAPTAIN.ringRadius;
 const start=ring.contractStartedAt??(ring.startedAt+CAPTAIN.ringGatherMs);
 const t=Math.max(0,Math.min(1,(now-start)/CAPTAIN.ringContractMs));
 return CAPTAIN.ringRadius+(CAPTAIN.ringMinRadius-CAPTAIN.ringRadius)*t;
}
export function ringIsBroken(ring,player,now,count){
 if(count<(ring.minimumMembers??CAPTAIN.minSoldiers))return true;
 // Running alone is not an escape until the moving formation has settled.
 if(ring.phase==='gather')return false;
 const start=ring.contractStartedAt??(ring.startedAt+CAPTAIN.ringGatherMs);
 return now-start>=CAPTAIN.ringContractMs ||
  Math.hypot(player.x-ring.x,player.y-ring.y)>ringRadiusAt(ring,now)+CAPTAIN.ringEscapeTolerance;
}
export function chooseFleeing(soldiers,random=Math.random){
 const copy=[...soldiers];
 for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
 return copy.slice(0,Math.floor(copy.length/2));
}

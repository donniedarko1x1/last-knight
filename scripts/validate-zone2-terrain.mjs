import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const keys=[
 'zone2_ground_base_01','zone2_edge_north_01','zone2_edge_south_01',
 'zone2_edge_west_01','zone2_edge_east_01'
];

for(const key of keys){
 const png=readFileSync(new URL(`../public/assets/environment/ruined_kingdom/ground_minimal/${key}.png`,import.meta.url));
 assert.equal(png.toString('ascii',1,4),'PNG',`${key} is not a PNG`);
 assert.equal(png.readUInt32BE(16),1254,`${key} width must be 1254px`);
 assert.equal(png.readUInt32BE(20),1254,`${key} height must be 1254px`);
}

for(const prop of ['campfire','torch','lantern','embers','wagon']){
 for(let frame=0;frame<4;frame++){
  const key=`zone2_${prop}_${String(frame).padStart(2,'0')}`;
  const png=readFileSync(new URL(`../public/assets/environment/ruined_kingdom/light_props/${key}.png`,import.meta.url));
  assert.equal(png.toString('ascii',1,4),'PNG',`${key} is not a PNG`);
  assert.equal(png.readUInt32BE(16),512,`${key} width must be 512px`);
  assert.equal(png.readUInt32BE(20),512,`${key} height must be 512px`);
 }
}

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const manifest=readFileSync(new URL('../src/config/assetManifest.mjs',import.meta.url),'utf8');
assert.match(main,/createRuinedKingdomTerrainEnvironment/);
for(const key of keys) assert.match(main,new RegExp(key));
assert.doesNotMatch(main,/zone2_road_main_straight_seamless/);
assert.match(main,/const lightProps=/);
assert.match(main,/x:zone\.start\+410/);
assert.match(main,/glow:118/);
assert.match(main,/placement\.glow\*2\.8/);
assert.match(main,/placement\.prop==='campfire' \|\| placement\.prop==='wagon'/);
assert.match(main,/createAshLandmarkBlocker/);
assert.match(main,/const roadY=WORLD_DESIGN\.ROUTE_Y/);
assert.match(main,/ZONE2_SOFT_FIRE_GLOW_TEXTURE/);
assert.match(main,/ZONE2_TERRAIN_BRIGHTNESS=1\.20/);
assert.match(main,/ZONE2_TERRAIN_LIT_SUFFIX='_lit'/);
assert.match(main,/prepareLitTerrainTexture/);
assert.match(main,/ctx\.drawImage\(source,0,0\)/);
assert.match(main,/frame\.data\[i\]\*ZONE2_TERRAIN_BRIGHTNESS/);
assert.match(main,/createRadialGradient/);
assert.match(main,/gradient\.addColorStop\(1,'rgba\(112,24,8,0\)'\)/);
assert.match(main,/const key=`zone2_\$\{prop\}_burn`/);
assert.match(main,/\.play\(`zone2_\$\{placement\.prop\}_burn`\)/);
assert.match(main,/ASSET_CATEGORY\.REGION_RUINS/);
assert.match(main,/jumpToZone\(index\)/);
assert.match(main,/jumpToWave\(wave\)/);
assert.match(manifest,/REGION_RUINS:'REGION_RUINS'/);
assert.match(manifest,/const zone2Ground=/);
console.log(`Zone 2 terrain regression PASSED: ${keys.length} ground tiles + 20 animated light-prop frames are wired into streaming terrain and DEV jumps.`);

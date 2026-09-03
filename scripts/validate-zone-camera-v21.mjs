import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {WORLD_DESIGN} from '../src/config/worldConfig.mjs';
import {STAGE0} from '../src/config/gameplayConfig.mjs';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const main=source.slice(source.indexOf('class MainScene'));
const names=['getZoneCameraMinX','applyWorldCameraBounds','updateWorldCameraBoundary',
 'setupResponsiveWorldCamera','handleViewportResize','getUiMetrics','updateWorldStreaming'];
const methods=names.map(name=>{
 const start=main.indexOf(`\n ${name}(`);assert.ok(start>=0,name);
 return main.slice(start,main.indexOf('\n }',start)+3);
});
const runtime=vm.runInNewContext(`({${methods.join(',')}})`,{WORLD_DESIGN,STAGE0});
const gate=WORLD_DESIGN.GATES[0],boundary=gate.x+120;

// Rendering adapter: records production bounds and models the clamp that the
// Phaser camera applies at render time. No Phaser/browser dependency required.
function fixture(){
 const cam={width:1280,height:720,zoom:1,worldView:{left:gate.x-300},calls:[],
  setBounds(x,y,width,height){this.bounds={x,y,width,height};this.calls.push(['bounds',x]);},
  setViewport(x,y,w,h){this.width=w;this.height=h;},setZoom(z){this.zoom=z;},
  setRoundPixels(){},setDeadzone(w,h){this.deadzone=[w,h];},
  startFollow(target,...args){this.target=target;this.followArgs=args;},
  centerOn(x){this.renderAtLeft(x-this.width/this.zoom/2);},
  renderAtLeft(wanted){const b=this.bounds;this.worldView.left=b?
   Math.max(b.x,Math.min(b.x+b.width-this.width/this.zoom,wanted)):wanted;}};
 const s={...runtime,cameras:{main:cam},scale:{width:1280,height:720},
  currentWorldZoneIndex:0,worldCameraMinX:0,time:{now:1000},
  player:{x:gate.x-10,y:WORLD_DESIGN.ROUTE_Y},loaded:[],retired:[],seals:[],
  loadWorldZone(index){this.loaded.push(index);},unloadWorldZone(index){this.retired.push(index);},
  createBacktrackSeal(g){this.seals.push(g.id);},layoutScreenUI(){},layoutMobileControls(){}};
 return {s,cam};
}

const {s,cam}=fixture();s.setupResponsiveWorldCamera();
assert.equal(cam.bounds.x,0);assert.equal(cam.bounds.width,STAGE0.WORLD_WIDTH);
assert.equal(s.getZoneCameraMinX(0),0);assert.equal(s.getZoneCameraMinX(1),boundary);
const originalZoom=cam.zoom;
s.currentWorldZoneIndex=1;s.player.x=gate.x+WORLD_DESIGN.UNLOAD_DEPTH+1;
for(const left of [gate.x-1,gate.x+80,boundary-.01]){
 cam.worldView.left=left;s.updateWorldStreaming();
 assert.equal(s.worldCameraMinX,0,'do not constrain the transition before the gate exits');
 assert.deepEqual(s.retired,[],'do not unload until the camera boundary is latched');
}
cam.worldView.left=boundary;
const before=cam.worldView.left;s.updateWorldStreaming();
assert.equal(s.worldCameraMinX,boundary);assert.equal(cam.bounds.x,boundary);
assert.equal(cam.bounds.x+cam.bounds.width,STAGE0.WORLD_WIDTH,'right world edge is unchanged');
assert.equal(cam.worldView.left,before,'latching does not move the view');
assert.equal(cam.zoom,originalZoom,'no transition zoom');
assert.deepEqual(s.retired,[0]);

// Walk back to the physical seal: camera stops; player remains visible near left edge.
s.player.x=gate.x+120+21+16;
cam.centerOn(s.player.x);s.updateWorldStreaming();
assert.equal(cam.worldView.left,boundary);
assert.ok(s.player.x>cam.worldView.left);
assert.ok(s.player.x<cam.worldView.left+cam.width/cam.zoom);
const calls=cam.calls.length;s.updateWorldCameraBoundary();
assert.equal(cam.calls.length,calls,'no per-frame bounds allocation after latching');

// Resizes / mobile orientation / Follow Player may not restore full-world bounds.
for(const [width,height] of [[1920,1080],[2560,1080],[844,390],[390,844]]){
 s.scale={width,height};s.handleViewportResize();cam.centerOn(s.player.x);
 assert.equal(cam.bounds.x,boundary);assert.equal(cam.worldView.left,boundary);
 assert.ok(s.player.x<cam.worldView.left+cam.width/cam.zoom);
}
s.setupResponsiveWorldCamera();
assert.equal(cam.target,s.player);assert.deepEqual(cam.followArgs,[true,1,1]);
assert.equal(cam.worldView.left,boundary);

// Restarts set the boundary before setup / first draw, not after the first update.
assert.match(main,/this\.worldCameraMinX=this\.getZoneCameraMinX\(this\.currentWorldZoneIndex\)/);
const start=main.indexOf('\n create(){'),end=main.indexOf('\n }',start);
const create=main.slice(start,end);
assert.ok(create.indexOf('this.worldCameraMinX=')<create.indexOf('this.setupResponsiveWorldCamera()'));
const restarted=fixture();restarted.s.currentWorldZoneIndex=1;
restarted.s.worldCameraMinX=restarted.s.getZoneCameraMinX();
restarted.s.player.x=gate.x+360;restarted.s.setupResponsiveWorldCamera();
assert.equal(restarted.cam.worldView.left,boundary);

// Narrow view: visual retirement may precede the old distance-based gate seal.
const narrow=fixture();narrow.s.currentWorldZoneIndex=1;
narrow.s.player.x=gate.x+300;narrow.cam.worldView.left=boundary+1;
assert.ok(narrow.s.player.x<gate.x+WORLD_DESIGN.BACK_LOCK_DEPTH);
narrow.s.updateWorldCameraBoundary();
assert.ok(narrow.s.seals.includes(gate.id),'seal when latching so the hero cannot leave the frame');

// Boundary can only advance during a run, and has no camera animation calls.
s.currentWorldZoneIndex=0;s.updateWorldCameraBoundary();assert.equal(s.worldCameraMinX,boundary);
s.currentWorldZoneIndex=2;cam.worldView.left=s.getZoneCameraMinX();s.updateWorldCameraBoundary();
assert.equal(s.worldCameraMinX,WORLD_DESIGN.GATES[1].x+120);
assert.doesNotMatch(methods[2],/pan\(|zoomTo\(|tweens|setFollowOffset|centerOn\(/);
assert.doesNotMatch(main,/cam\.setBounds\(0,0,STAGE0\.WORLD_WIDTH/);
assert.match(main,/const x=gate\.x\+120/,'camera and physical backtrack seal use the same plane');
assert.match(main,/const fallbackSides=forwardOnly \? \['top','right','bottom'\]/);
console.log('v21 PASSED: natural entry, no snap, one-way camera bounds, safe unload, return to gate, restart, resize/mobile, Follow Player and unchanged forward-only spawns.');

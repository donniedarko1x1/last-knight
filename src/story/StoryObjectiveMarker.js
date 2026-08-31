import Phaser from 'phaser';

const FRAME_INSET_RATIO=0.10;
const WORLD_MARKER_OFFSET_Y=58;

function addUiText(scene,x,y,text,style){
 const object=scene.add.text(x,y,text,style);
 object.setResolution?.(2);
 return object;
}

function rayRectIntersection(ox,oy,dx,dy,rect){
 const candidates=[];
 const epsilon=0.000001;
 const push=(t,x,y)=>{
  if(!Number.isFinite(t) || t<0)return;
  if(x<rect.left-epsilon || x>rect.right+epsilon || y<rect.top-epsilon || y>rect.bottom+epsilon)return;
  candidates.push({t,x,y});
 };

 if(Math.abs(dx)>epsilon){
  let t=(rect.left-ox)/dx;
  push(t,rect.left,oy+dy*t);
  t=(rect.right-ox)/dx;
  push(t,rect.right,oy+dy*t);
 }
 if(Math.abs(dy)>epsilon){
  let t=(rect.top-oy)/dy;
  push(t,ox+dx*t,rect.top);
  t=(rect.bottom-oy)/dy;
  push(t,ox+dx*t,rect.bottom);
 }
 if(!candidates.length)return null;
 candidates.sort((a,b)=>a.t-b.t);
 return candidates[0];
}

class StoryObjectiveMarker {
 constructor(scene,{insetRatio=FRAME_INSET_RATIO}={}){
  this.scene=scene;
  this.insetRatio=Phaser.Math.Clamp(Number(insetRatio)||FRAME_INSET_RATIO,0.02,0.45);
  this.target=null;
  this.targetOffsetY=WORLD_MARKER_OFFSET_Y;
  this.installed=false;
 }

 install(){
  if(this.installed)return this;
  this.installed=true;
  const scene=this.scene;

  this.worldMarker=addUiText(scene,0,0,'◆',{
   fontFamily:'Georgia, serif',fontSize:'27px',color:'#ffd66b',
   stroke:'#211607',strokeThickness:4
  }).setOrigin(0.5).setDepth(625).setVisible(false);

  const markerGraphics=scene.add.graphics();
  markerGraphics.fillStyle(0x4b3514,0.78);
  markerGraphics.fillCircle(0,0,18);
  markerGraphics.lineStyle(2,0xffd66b,0.95);
  markerGraphics.strokeCircle(0,0,17);
  markerGraphics.fillStyle(0xffd66b,1);
  markerGraphics.fillPoints([
   new Phaser.Geom.Point(0,-11),new Phaser.Geom.Point(9,0),
   new Phaser.Geom.Point(0,11),new Phaser.Geom.Point(-9,0)
  ],true);
  // The small point above the diamond makes its travel direction readable.
  markerGraphics.fillTriangle(-5,-19,5,-19,0,-28);
  this.edgeMarker=scene.add.container(0,0,[markerGraphics])
   .setScrollFactor(0).setDepth(626).setVisible(false);
  return this;
 }

 destroy(){
  try{this.worldMarker?.destroy();}catch{}
  try{this.edgeMarker?.destroy();}catch{}
  this.worldMarker=null;
  this.edgeMarker=null;
  this.target=null;
  this.scene=null;
  this.installed=false;
 }

 setTarget(target,{worldOffsetY=WORLD_MARKER_OFFSET_Y}={}){
  this.target=target||null;
  this.targetOffsetY=Number(worldOffsetY)||WORLD_MARKER_OFFSET_Y;
  if(!this.target)this.hide();
  return this.target;
 }

 clearTarget(target=null){
  if(target && this.target!==target)return false;
  this.target=null;
  this.hide();
  return true;
 }

 hide(){
  this.edgeMarker?.setVisible(false);
  this.worldMarker?.setVisible(false);
 }

 getFrame(metrics){
  const left=metrics.width*this.insetRatio;
  const right=metrics.width*(1-this.insetRatio);
  const top=metrics.height*this.insetRatio;
  const bottom=metrics.height*(1-this.insetRatio);
  return {left,right,top,bottom};
 }

 update(time=0,{forceHide=false}={}){
  const scene=this.scene;
  const target=this.target;
  const player=scene?.player;
  if(forceHide || !scene || !target?.active || !target.visible || !player?.active){
   this.hide();
   return false;
  }

  const cam=scene.cameras.main;
  const view=cam.worldView;
  const metrics=scene.getUiMetrics?.()||{
   width:view.width,height:view.height,cx:view.width*0.5,cy:view.height*0.5
  };

  // scrollFactor(0) UI in this project is laid out in camera-local world units,
  // so subtracting worldView gives the exact screen-space position at any zoom.
  const targetScreenX=target.x-view.left;
  const targetScreenY=target.y-view.top;
  const targetOnScreen=(
   targetScreenX>=0 && targetScreenX<=metrics.width &&
   targetScreenY>=0 && targetScreenY<=metrics.height
  );

  if(targetOnScreen){
   this.edgeMarker?.setVisible(false);
   const floatY=Math.sin(time*0.006)*4;
   this.worldMarker
    ?.setPosition(target.x,target.y-this.targetOffsetY+floatY)
    .setVisible(true);
   return true;
  }

  this.worldMarker?.setVisible(false);

  // IMPORTANT: direction is always target WORLD position minus PLAYER WORLD
  // position. The camera centre is intentionally not involved. Following the
  // marker therefore converges on the actual story target.
  const dx=target.x-player.x;
  const dy=target.y-player.y;
  if(Math.hypot(dx,dy)<0.001){
   this.edgeMarker?.setVisible(false);
   return true;
  }

  const frame=this.getFrame(metrics);
  const playerScreenX=player.x-view.left;
  const playerScreenY=player.y-view.top;

  // Usually the player is inside the 10% frame. Near world bounds the camera can
  // leave the player outside it, so clamp only the ray origin; keep the true
  // world-space direction unchanged.
  const ox=Phaser.Math.Clamp(playerScreenX,frame.left+0.001,frame.right-0.001);
  const oy=Phaser.Math.Clamp(playerScreenY,frame.top+0.001,frame.bottom-0.001);
  let hit=rayRectIntersection(ox,oy,dx,dy,frame);

  // Defensive fallback for pathological viewport/bounds combinations.
  if(!hit){
   const cx=(frame.left+frame.right)*0.5;
   const cy=(frame.top+frame.bottom)*0.5;
   hit=rayRectIntersection(cx,cy,dx,dy,frame);
  }
  if(!hit){
   this.edgeMarker?.setVisible(false);
   return false;
  }

  this.edgeMarker
   ?.setPosition(hit.x,hit.y)
   .setRotation(Math.atan2(dy,dx)+Math.PI/2)
   .setVisible(true);
  return true;
 }
}

export {FRAME_INSET_RATIO,rayRectIntersection};
export default StoryObjectiveMarker;

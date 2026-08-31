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
  this.lastTargetPoint=null;
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
  markerGraphics.fillTriangle(-5,-19,5,-19,0,-28);
  // Edge marker lives in world space. This keeps its math in the same coordinate
  // system as the camera worldView, player and logical story target.
  this.edgeMarker=scene.add.container(0,0,[markerGraphics])
   .setDepth(626).setVisible(false);
  return this;
 }

 destroy(){
  try{this.worldMarker?.destroy();}catch{}
  try{this.edgeMarker?.destroy();}catch{}
  this.worldMarker=null;
  this.edgeMarker=null;
  this.target=null;
  this.lastTargetPoint=null;
  this.scene=null;
  this.installed=false;
 }

 // Story navigation deliberately owns a logical world position rather than a
 // render object's visibility. Environment culling is allowed to set a distant
 // NPC/landmark sprite visible=false; that must NEVER switch off its objective
 // compass. The objective owner clears the marker when the story state ends.
 resolveTargetPoint(){
  let source=this.target;
  try{
   if(typeof source==='function')source=source();
   else if(source?.getStoryMarkerPoint)source=source.getStoryMarkerPoint();
  }catch{}
  const x=Number(source?.x);
  const y=Number(source?.y);
  if(Number.isFinite(x) && Number.isFinite(y)){
   this.lastTargetPoint={x,y};
  }
  return this.lastTargetPoint;
 }

 setTarget(target,{worldOffsetY=WORLD_MARKER_OFFSET_Y}={}){
  this.target=target||null;
  this.targetOffsetY=Number(worldOffsetY)||WORLD_MARKER_OFFSET_Y;
  if(!this.target){
   this.lastTargetPoint=null;
   this.hide();
  }else{
   this.resolveTargetPoint();
  }
  return this.target;
 }

 clearTarget(target=null){
  if(target && this.target!==target)return false;
  this.target=null;
  this.lastTargetPoint=null;
  this.hide();
  return true;
 }

 hide(){
  this.edgeMarker?.setVisible(false);
  this.worldMarker?.setVisible(false);
 }

 getFrame(view){
  const insetX=view.width*this.insetRatio;
  const insetY=view.height*this.insetRatio;
  return {
   left:view.left+insetX,
   right:view.right-insetX,
   top:view.top+insetY,
   bottom:view.bottom-insetY
  };
 }

 update(time=0,{forceHide=false}={}){
  const scene=this.scene;
  const player=scene?.player;
  const point=this.resolveTargetPoint();
  if(forceHide || !scene || !point || !player?.active){
   this.hide();
   return false;
  }

  const cam=scene.cameras.main;
  const view=cam.worldView;
  const targetX=point.x;
  const targetY=point.y;

  // Use only world coordinates here. The previous implementation mixed a
  // scrollFactor(0) UI object with world-space directions, so the overhead ◆
  // worked while the off-screen compass could disappear under zoom/render scale.
  const targetOnScreen=(
   targetX>=view.left && targetX<=view.right &&
   targetY>=view.top && targetY<=view.bottom
  );

  if(targetOnScreen){
   this.edgeMarker?.setVisible(false);
   const floatY=Math.sin(time*0.006)*4;
   this.worldMarker
    ?.setPosition(targetX,targetY-this.targetOffsetY+floatY)
    .setVisible(true);
   return true;
  }

  this.worldMarker?.setVisible(false);

  // Logical target point exists independently of sprite streaming/visibility.
  const dx=targetX-player.x;
  const dy=targetY-player.y;
  if(Math.hypot(dx,dy)<0.001){
   this.edgeMarker?.setVisible(false);
   return true;
  }

  const frame=this.getFrame(view);
  const ox=Phaser.Math.Clamp(player.x,frame.left+0.001,frame.right-0.001);
  const oy=Phaser.Math.Clamp(player.y,frame.top+0.001,frame.bottom-0.001);
  let hit=rayRectIntersection(ox,oy,dx,dy,frame);

  if(!hit){
   hit=rayRectIntersection(view.centerX,view.centerY,dx,dy,frame);
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

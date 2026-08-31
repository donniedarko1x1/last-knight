import Phaser from 'phaser';

// Mobile input contract shared by every world interaction:
// left visual half of the physical canvas = movement only;
// right visual half = world interaction / dialogue advance.
function getClientX(pointer){
 const nativeEvent=pointer?.event;
 const touch=nativeEvent?.changedTouches?.[0] || nativeEvent?.touches?.[0];
 const clientX=Number(touch?.clientX ?? nativeEvent?.clientX);
 return Number.isFinite(clientX)?clientX:null;
}

function isRightCanvasHalf(game,pointer){
 const canvas=game?.canvas;
 const clientX=getClientX(pointer);
 if(canvas?.getBoundingClientRect && clientX!==null){
  const rect=canvas.getBoundingClientRect();
  if(rect.width>0)return clientX>=rect.left+rect.width*0.5;
 }
 // Fallback only when the native DOM coordinate is unavailable.
 const width=Math.max(1,game?.scale?.displaySize?.width || game?.scale?.width || 1);
 return Number(pointer?.x||0)>=width*0.5;
}

function pointerToHudSpace(hud,pointer){
 const cam=hud?.cameras?.main;
 if(cam?.getWorldPoint){
  try{return cam.getWorldPoint(pointer.x,pointer.y);}catch{}
 }
 const zoom=Math.max(0.01,cam?.zoom||1);
 return {x:(pointer.x-(cam?.x||0))/zoom,y:(pointer.y-(cam?.y||0))/zoom};
}

function installGate(game){
 const main=game?.scene?.getScene?.('main');
 const hud=game?.scene?.getScene?.('HUDScene');
 if(!main || !hud || !main.sys?.isActive?.() || !hud.sys?.isActive?.())return false;
 if(hud.__lkPermanentMobileInputGateInstalled)return true;

 main.isMobileInteractionPointerAllowed=(pointer)=>{
  if(!main.isTouchDevice)return true;
  return isRightCanvasHalf(game,pointer);
 };
 main.emitMobileWorldInteraction=(pointer)=>{
  if(!main.isMobileInteractionPointerAllowed(pointer))return false;
  main.events?.emit?.('mobile-world-interact',pointer);
  return true;
 };

 // Replace only HUD pointerdown routing. pointermove/up remain the original game code.
 try{hud.input?.off?.('pointerdown',hud.onPointerDown,hud);}catch{}
 hud.__lkOriginalMobilePointerDown=hud.onPointerDown;
 hud.onPointerDown=function(pointer,gameObjects=[]){
  if(this.mainScene?.devTools?.uiEditor?.editMode){
   this.mainScene.devTools.uiEditor.handlePointerDown(pointer);
   return;
  }
  if(!this.mainScene?.isTouchDevice || !this.joyCenter || this.levelChoiceVisible || this.championRewardVisible || this.mainScene?.gameOver)return;

  const rightHalf=this.mainScene.isMobileInteractionPointerAllowed(pointer);
  if(rightHalf){
   const hitHudControl=Array.isArray(gameObjects) && gameObjects.some(obj=>Boolean(obj?.input && obj.input.enabled!==false));
   if(!hitHudControl)this.mainScene.emitMobileWorldInteraction(pointer);
   return;
  }

  // Any touch that physically starts in the LEFT visual half is movement only.
  if(this.movePointerId!==null)return;
  const pp=pointerToHudSpace(this,pointer);
  this.movePointerId=pointer.id;
  this.joyTouchOrigin={x:pp.x,y:pp.y};
  this.mainScene.mobileMoveX=0;
  this.mainScene.mobileMoveY=0;
  this.joyKnob?.setPosition?.(this.joyCenter.x,this.joyCenter.y);
 };
 hud.input?.on?.('pointerdown',hud.onPointerDown,hud);
 hud.__lkPermanentMobileInputGateInstalled=true;
 return true;
}

function boot(){
 const games=Phaser.GAMES||[];
 for(const game of games){
  if(installGate(game))return;
 }
 setTimeout(boot,100);
}

boot();
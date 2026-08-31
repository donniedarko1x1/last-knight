import Phaser from 'phaser';
import {MOBILE_POINTER_REGION,classifyMobilePointer,isRightInteractionPointer} from './input/MobileInputPolicy.js';

// Permanent mobile input contract:
//   left half  = movement only
//   right half = world interaction / dialogue advance
// This module patches the shared interaction bus itself, so even an old or
// future HUD handler cannot accidentally emit a left-side interaction.

const GATE_VERSION='v8-pointer-start-firewall';

function ensureMultitouch(game){
 const manager=game?.input;
 if(!manager?.addPointer)return;
 // Phaser starts with mouse + one touch pointer. We want three touch pointers:
 // movement + interaction/skill + one spare, i.e. 4 pointers total with mouse.
 const total=Math.max(0,Number(manager.pointersTotal)||0);
 const missing=Math.max(0,4-total);
 if(missing>0)manager.addPointer(missing);
}

function pointerToHudSpace(hud,pointer){
 const cam=hud?.cameras?.main;
 if(cam?.getWorldPoint){
  try{return cam.getWorldPoint(pointer.x,pointer.y);}catch{}
 }
 const zoom=Math.max(0.01,Number(cam?.zoom)||1);
 return {x:((Number(pointer?.x)||0)-(Number(cam?.x)||0))/zoom,y:((Number(pointer?.y)||0)-(Number(cam?.y)||0))/zoom};
}

function installMainInteractionFirewall(game,main){
 if(!main?.events)return false;
 const previous=main.__lkMobileInteractionFirewall;
 if(previous?.version===GATE_VERSION && previous?.emitter===main.events)return true;

 const emitter=main.events;
 const originalEmit=emitter.emit;
 if(typeof originalEmit!=='function')return false;

 emitter.emit=function(eventName,...args){
  if(eventName==='mobile-world-interact' && main.isTouchDevice){
   const pointer=args[0];
   if(!isRightInteractionPointer(pointer,game?.scale?.width))return false;
  }
  return originalEmit.call(this,eventName,...args);
 };

 main.isMobileInteractionPointerAllowed=(pointer)=>{
  if(!main.isTouchDevice)return true;
  return isRightInteractionPointer(pointer,game?.scale?.width);
 };
 main.emitMobileWorldInteraction=(pointer)=>{
  if(!main.isTouchDevice || !main.isMobileInteractionPointerAllowed(pointer))return false;
  return emitter.emit('mobile-world-interact',pointer);
 };
 main.__lkMobileInteractionFirewall={version:GATE_VERSION,emitter,originalEmit};
 return true;
}

function installHudRouting(game,hud,main){
 if(!hud || !main)return false;
 if(hud.__lkMobileInputRoutingVersion===GATE_VERSION)return true;

 const oldHandler=hud.onPointerDown;
 const replacement=function(pointer,gameObjects=[]){
  if(this.mainScene?.devTools?.uiEditor?.editMode){
   this.mainScene.devTools.uiEditor.handlePointerDown(pointer);
   return;
  }
  if(!this.mainScene?.isTouchDevice || !this.joyCenter || this.levelChoiceVisible || this.championRewardVisible || this.mainScene?.gameOver)return;

  const region=classifyMobilePointer(pointer,game?.scale?.width);
  if(region===MOBILE_POINTER_REGION.INTERACTION){
   const hitHudControl=Array.isArray(gameObjects) && gameObjects.some(obj=>Boolean(obj?.input && obj.input.enabled!==false));
   if(!hitHudControl)this.mainScene?.emitMobileWorldInteraction?.(pointer);
   return;
  }
  if(region!==MOBILE_POINTER_REGION.MOVEMENT)return;

  if(this.movePointerId!==null)return;
  const pp=pointerToHudSpace(this,pointer);
  this.movePointerId=pointer.id;
  this.joyTouchOrigin={x:pp.x,y:pp.y};
  this.mainScene.mobileMoveX=0;
  this.mainScene.mobileMoveY=0;
  this.joyKnob?.setPosition?.(this.joyCenter.x,this.joyCenter.y);
 };

 // If HUD is already running, remove the exact old callback and bind the new
 // one now. If it hasn't created yet, replacing the method is enough: create()
 // will bind this replacement when HUDScene starts.
 if(hud.input && typeof oldHandler==='function'){
  try{hud.input.off('pointerdown',oldHandler,hud);}catch{}
 }
 hud.onPointerDown=replacement;
 if(hud.sys?.isActive?.() && hud.input){
  hud.input.on('pointerdown',hud.onPointerDown,hud);
 }
 hud.__lkMobileInputRoutingVersion=GATE_VERSION;
 return true;
}

function install(game){
 if(!game)return false;
 ensureMultitouch(game);
 const main=game.scene?.getScene?.('main');
 const hud=game.scene?.getScene?.('HUDScene');
 if(!main || !hud)return false;
 installMainInteractionFirewall(game,main);
 installHudRouting(game,hud,main);
 return true;
}

function boot(){
 for(const game of Phaser.GAMES||[]){
  if(install(game))return;
 }
 setTimeout(boot,50);
}

boot();

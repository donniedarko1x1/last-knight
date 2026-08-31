const MOBILE_POINTER_REGION=Object.freeze({
 MOVEMENT:'movement',
 INTERACTION:'interaction',
 BLOCKED:'blocked'
});

function finiteNumber(value){
 const n=Number(value);
 return Number.isFinite(n)?n:NaN;
}

function getPointerStartX(pointer){
 // Phaser stores the screen-space coordinate where this specific touch began.
 // downX must win over current x: a movement finger that starts on the left
 // never becomes an interaction finger just because it is dragged right.
 const downX=finiteNumber(pointer?.downX);
 if(Number.isFinite(downX))return downX;
 return finiteNumber(pointer?.x);
}

function classifyMobilePointer(pointer,gameWidth){
 const width=finiteNumber(gameWidth);
 const startX=getPointerStartX(pointer);
 if(!Number.isFinite(width) || width<=0 || !Number.isFinite(startX))return MOBILE_POINTER_REGION.BLOCKED;
 return startX>=width*0.5 ? MOBILE_POINTER_REGION.INTERACTION : MOBILE_POINTER_REGION.MOVEMENT;
}

function isRightInteractionPointer(pointer,gameWidth){
 return classifyMobilePointer(pointer,gameWidth)===MOBILE_POINTER_REGION.INTERACTION;
}

export {MOBILE_POINTER_REGION,getPointerStartX,classifyMobilePointer,isRightInteractionPointer};

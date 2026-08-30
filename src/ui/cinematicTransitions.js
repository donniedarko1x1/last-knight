const CINEMATIC_FADE={
 IN_MS:520,
 OUT_MS:440
};

// Shared transition helpers for every story screen that uses the cinematic frame.
function cinematicFadeIn(scene,onComplete=null){
 if(!scene?.cameras?.main) return;
 scene.transitioning=true;
 scene.cameras.main.fadeIn(CINEMATIC_FADE.IN_MS,0,0,0);
 scene.time.delayedCall(CINEMATIC_FADE.IN_MS,()=>{
  scene.transitioning=false;
  if(onComplete) onComplete();
 });
}

function cinematicSwapWithFade(scene,swapContent,onComplete=null){
 if(!scene?.cameras?.main || scene.transitioning) return false;
 scene.transitioning=true;
 scene.cameras.main.fadeOut(CINEMATIC_FADE.OUT_MS,0,0,0);
 scene.time.delayedCall(CINEMATIC_FADE.OUT_MS,()=>{
  if(swapContent) swapContent();
  scene.cameras.main.fadeIn(CINEMATIC_FADE.IN_MS,0,0,0);
  scene.time.delayedCall(CINEMATIC_FADE.IN_MS,()=>{
   scene.transitioning=false;
   if(onComplete) onComplete();
  });
 });
 return true;
}

function cinematicFadeOutAndRun(scene,onBlack){
 if(!scene?.cameras?.main || scene.transitioning) return false;
 scene.transitioning=true;
 scene.cameras.main.fadeOut(CINEMATIC_FADE.OUT_MS,0,0,0);
 scene.time.delayedCall(CINEMATIC_FADE.OUT_MS,()=>{
  if(onBlack) onBlack();
 });
 return true;
}

export { CINEMATIC_FADE, cinematicFadeIn, cinematicSwapWithFade, cinematicFadeOutAndRun };

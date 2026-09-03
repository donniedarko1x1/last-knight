// This is only a visual mask. strikeHits remains the authority for hit detection.
const TEXTURE_KEY='captain_strike_soft_v20';
const SIZE=256;
const smooth=(a,b,x)=>{
 const t=Math.max(0,Math.min(1,(x-a)/(b-a)));
 return t*t*(3-2*t);
};

export function strikeTelegraphAlpha(radiusRatio,angle,halfAngle){
 if(radiusRatio>=1 || Math.abs(angle)>=halfAngle)return 0;
 const radial=1-smooth(.48,1,Math.max(0,radiusRatio));
 const angular=1-smooth(halfAngle*.76,halfAngle,Math.abs(angle));
 return .30*radial*angular;
}

export function createCaptainAttackTelegraph(scene,x,y,angle,range,halfAngle){
 // One reusable canvas texture for all captains and retries; no bitmap per hit.
 const key=`${TEXTURE_KEY}_${halfAngle.toFixed(5)}`;
 if(!scene.textures.exists(key)){
  const texture=scene.textures.createCanvas(key,SIZE,SIZE);
  const ctx=texture.context,pixels=ctx.createImageData(SIZE,SIZE);
  const center=SIZE/2,radius=center-2;
  for(let py=0;py<SIZE;py++)for(let px=0;px<SIZE;px++){
   const dx=px+.5-center,dy=py+.5-center,index=(py*SIZE+px)*4;
   pixels.data[index]=224;pixels.data[index+1]=102;pixels.data[index+2]=70;
   pixels.data[index+3]=Math.round(255*strikeTelegraphAlpha(
    Math.hypot(dx,dy)/radius,Math.atan2(dy,dx),halfAngle));
  }
  ctx.putImageData(pixels,0,0);
  texture.refresh();
 }
 const size=range*SIZE/(SIZE/2-2);
 return scene.add.image(x,y,key).setDisplaySize(size,size).setRotation(angle).setDepth(2);
}

// Combat notifications share dialogue styling, but never pause, focus the camera,
// consume E, or enter the story dialogue state machine.
export default class CombatBarkSystem {
 constructor(scene){this.scene=scene;this.items=new Map();}
 show(owner,text,duration,offset=70){
  this.remove(owner);
  const label=this.scene.add.text(0,0,text,{
   fontFamily:'Georgia, serif',fontSize:'16px',color:'#f3e8d5',
   stroke:'#090807',strokeThickness:2,backgroundColor:'#211611ed',
   padding:{x:10,y:7},align:'center'
  }).setOrigin(.5,1).setDepth(650).setResolution(2);
  this.items.set(owner,{owner,label,until:this.scene.time.now+duration,offset});
  this.update();
 }
 remove(owner){this.items.get(owner)?.label.destroy();this.items.delete(owner);}
 update(){
  const s=this.scene,cam=s.cameras.main,view=cam.worldView;
  const cssWidth=s.game.canvas.getBoundingClientRect().width||cam.width;
  const unit=(s.game.canvas.width/cssWidth)/Math.max(.01,cam.zoom);
  for(const [key,item] of this.items){
   if(!item.owner?.active || s.time.now>=item.until || s.gameOver){this.remove(key);continue;}
   const {label,owner,offset}=item;
   label.setScale(unit);
   const half=label.width*unit/2;
   const x=Math.max(view.left+half+8*unit,Math.min(view.right-half-8*unit,owner.x));
   // Leave room below the permanent top HUD without detaching offscreen barks.
   const y=Math.max(view.top+145*unit,Math.min(view.bottom-24*unit,owner.y-offset));
   label.setPosition(x,y).setVisible(owner.x>=view.left-30 && owner.x<=view.right+30 && owner.y>=view.top && owner.y<=view.bottom);
  }
 }
 clear(){for(const key of [...this.items.keys()])this.remove(key);}
}

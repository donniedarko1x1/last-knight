import Phaser from 'phaser';
import { STAGE0 } from '../config/gameplayConfig.mjs';

// World Navigation v2 core algorithms. Methods deliberately operate on the
// MainScene instance (`this`) so Architecture Refactor v1 can move the system
// without changing runtime state or gameplay behavior.
class NavigationSystem {
 markNavigationDirty(){
  this.navigationGridDirty=true;
 }

 ensureNavigationGrid(){
  if(!this.navigationGrid || this.navigationGridDirty) this.rebuildNavigationGrid();
  return this.navigationGrid;
 }

 rebuildNavigationGrid(){
  const cellSize=this.navigationCellSize||56;
  const cols=Math.ceil(STAGE0.WORLD_WIDTH/cellSize);
  const rows=Math.ceil(STAGE0.WORLD_HEIGHT/cellSize);
  const blocked=new Uint8Array(cols*rows);
  const clearance=this.navigationClearance||20;

  const blockers=this.ashLandmarkColliderGroup?.getChildren?.()||[];
  for(const blocker of blockers){
   if(!blocker?.active || !blocker.body || blocker.body.enable===false) continue;
   const b=this.getAshBlockerBounds(blocker,clearance);
   if(!b) continue;
   const minCol=Phaser.Math.Clamp(Math.floor(b.left/cellSize),0,cols-1);
   const maxCol=Phaser.Math.Clamp(Math.floor(b.right/cellSize),0,cols-1);
   const minRow=Phaser.Math.Clamp(Math.floor(b.top/cellSize),0,rows-1);
   const maxRow=Phaser.Math.Clamp(Math.floor(b.bottom/cellSize),0,rows-1);
   for(let row=minRow;row<=maxRow;row++){
    const cy=row*cellSize+cellSize*0.5;
    for(let col=minCol;col<=maxCol;col++){
     const cx=col*cellSize+cellSize*0.5;
     if(cx>=b.left && cx<=b.right && cy>=b.top && cy<=b.bottom){
      blocked[row*cols+col]=1;
     }
    }
   }
  }

  this.navigationGrid={cellSize,cols,rows,blocked};
  this.navigationGridDirty=false;
  this.navigationGridVersion=(this.navigationGridVersion||0)+1;
  for(const enemy of this.enemies||[]){
   if(!enemy) continue;
   enemy.navPath=null;
   enemy.navPathIndex=0;
   enemy.navGridVersion=0;
   enemy.navNextRepathAt=0;
  }
 }

 worldToNavCell(x,y){
  const grid=this.ensureNavigationGrid();
  return {
   col:Phaser.Math.Clamp(Math.floor(x/grid.cellSize),0,grid.cols-1),
   row:Phaser.Math.Clamp(Math.floor(y/grid.cellSize),0,grid.rows-1)
  };
 }

 navCellToWorld(col,row){
  const grid=this.ensureNavigationGrid();
  return {
   x:this.clampWorldX(col*grid.cellSize+grid.cellSize*0.5,20),
   y:this.clampWorldY(row*grid.cellSize+grid.cellSize*0.5,20)
  };
 }

 isNavCellWalkable(col,row){
  const grid=this.ensureNavigationGrid();
  if(col<0||row<0||col>=grid.cols||row>=grid.rows) return false;
  return grid.blocked[row*grid.cols+col]===0;
 }

 findNearestWalkableNavCell(col,row,maxRadius=10){
  const grid=this.ensureNavigationGrid();
  col=Phaser.Math.Clamp(col,0,grid.cols-1);
  row=Phaser.Math.Clamp(row,0,grid.rows-1);
  if(this.isNavCellWalkable(col,row)) return {col,row};

  for(let r=1;r<=maxRadius;r++){
   for(let dx=-r;dx<=r;dx++){
    for(const dy of [-r,r]){
     const c=col+dx,rr=row+dy;
     if(this.isNavCellWalkable(c,rr)) return {col:c,row:rr};
    }
   }
   for(let dy=-r+1;dy<=r-1;dy++){
    for(const dx of [-r,r]){
     const c=col+dx,rr=row+dy;
     if(this.isNavCellWalkable(c,rr)) return {col:c,row:rr};
    }
   }
  }
  return null;
 }

 isNavigationLineBlocked(x1,y1,x2,y2){
  const grid=this.ensureNavigationGrid();
  const dx=x2-x1,dy=y2-y1;
  const distance=Math.hypot(dx,dy);
  const steps=Math.max(1,Math.ceil(distance/(grid.cellSize*0.45)));
  for(let i=1;i<=steps;i++){
   const t=i/steps;
   const col=Phaser.Math.Clamp(Math.floor((x1+dx*t)/grid.cellSize),0,grid.cols-1);
   const row=Phaser.Math.Clamp(Math.floor((y1+dy*t)/grid.cellSize),0,grid.rows-1);
   if(grid.blocked[row*grid.cols+col]) return true;
  }
  return false;
 }

 findNavigationPath(startX,startY,targetX,targetY,enemy=null,maxVisited=3200){
  const grid=this.ensureNavigationGrid();
  let start=this.worldToNavCell(startX,startY);
  let goal=this.worldToNavCell(targetX,targetY);
  start=this.findNearestWalkableNavCell(start.col,start.row,8);
  goal=this.findNearestWalkableNavCell(goal.col,goal.row,10);
  if(!start||!goal) return [];
  if(start.col===goal.col && start.row===goal.row) return [];

  const total=grid.cols*grid.rows;
  const gScore=new Float32Array(total);
  gScore.fill(Number.POSITIVE_INFINITY);
  const parent=new Int32Array(total);
  parent.fill(-1);
  const closed=new Uint8Array(total);
  const heap=[];
  const startIndex=start.row*grid.cols+start.col;
  const goalIndex=goal.row*grid.cols+goal.col;
  const heuristic=(c,r)=>{
   const dx=Math.abs(c-goal.col),dy=Math.abs(r-goal.row);
   return Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy);
  };
  const heapPush=(node)=>{
   heap.push(node);
   let i=heap.length-1;
   while(i>0){
    const p=(i-1)>>1;
    if(heap[p].f<=node.f) break;
    heap[i]=heap[p];i=p;
   }
   heap[i]=node;
  };
  const heapPop=()=>{
   if(!heap.length) return null;
   const root=heap[0];
   const tail=heap.pop();
   if(heap.length){
    let i=0;
    while(true){
     let child=i*2+1;
     if(child>=heap.length) break;
     if(child+1<heap.length && heap[child+1].f<heap[child].f) child++;
     if(heap[child].f>=tail.f) break;
     heap[i]=heap[child];i=child;
    }
    heap[i]=tail;
   }
   return root;
  };

  gScore[startIndex]=0;
  heapPush({index:startIndex,col:start.col,row:start.row,f:heuristic(start.col,start.row)});
  let visited=0;
  const preferUp=((enemy?.navSeed||0)&1)===0;
  const dirs=preferUp
   ? [[1,0],[0,-1],[0,1],[-1,0],[1,-1],[1,1],[-1,-1],[-1,1]]
   : [[1,0],[0,1],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];

  while(heap.length && visited<maxVisited){
   const node=heapPop();
   if(!node||closed[node.index]) continue;
   closed[node.index]=1;
   visited++;
   if(node.index===goalIndex) break;

   for(const [dx,dy] of dirs){
    const nc=node.col+dx,nr=node.row+dy;
    if(!this.isNavCellWalkable(nc,nr)) continue;
    if(dx!==0 && dy!==0){
     if(!this.isNavCellWalkable(node.col+dx,node.row) || !this.isNavCellWalkable(node.col,node.row+dy)) continue;
    }
    const ni=nr*grid.cols+nc;
    if(closed[ni]) continue;
    const ng=gScore[node.index]+(dx!==0&&dy!==0?Math.SQRT2:1);
    if(ng>=gScore[ni]) continue;
    gScore[ni]=ng;
    parent[ni]=node.index;
    heapPush({index:ni,col:nc,row:nr,f:ng+heuristic(nc,nr)});
   }
  }

  if(parent[goalIndex]===-1) return [];
  const cells=[];
  let cursor=goalIndex;
  while(cursor!==startIndex && cursor!==-1){
   const row=Math.floor(cursor/grid.cols);
   const col=cursor-row*grid.cols;
   cells.push({col,row});
   cursor=parent[cursor];
  }
  cells.reverse();
  if(!cells.length) return [];

  // Collapse the grid path into long clear segments. A* provides global route
  // choice; the existing local steering still handles the final few pixels.
  const raw=cells.map(c=>this.navCellToWorld(c.col,c.row));
  const simplified=[];
  let from={x:startX,y:startY};
  let i=0;
  const radius=(enemy?.hitRadius||14)+5;
  const rescueMode=Boolean(enemy?.navRescueActive);
  while(i<raw.length){
   let best=i;
   // Rescue paths intentionally keep more intermediate waypoints. Normal A*
   // aggressively collapses long clear segments for CPU efficiency; a stuck
   // skeleton temporarily gets denser guidance so it can work around awkward
   // landmark corners instead of repeatedly choosing the same local tangent.
   const maxLookAhead=rescueMode?Math.min(raw.length-1,i+4):raw.length-1;
   for(let j=maxLookAhead;j>i;j--){
    if(!this.isAshPathBlocked(from.x,from.y,raw[j].x,raw[j].y,radius,enemy)){
     best=j;
     break;
    }
   }
   simplified.push(raw[best]);
   from=raw[best];
   i=best+1;
  }
  return simplified;
 }

 updateEnemyStuckState(enemy,time,intendedSpeed){
  if(!enemy || enemy.type!=='skeleton' || enemy.storyDormant || !enemy.active || enemy.hp<=0) return;
  enemy.navSeed=enemy.navSeed??Phaser.Math.Between(0,65535);
  const trace=(type,data={})=>this.devTools?.recordTraceEvent?.(type,{
   enemyType:enemy.type,navSeed:enemy.navSeed,wave:this.wave||0,
   x:Math.round(enemy.x),y:Math.round(enemy.y),...data
  },{sample:true});
  const playerDistance=this.player?.active
   ? Phaser.Math.Distance.Between(enemy.x,enemy.y,this.player.x,this.player.y)
   : 0;
  const locked=time<(enemy.attackAnimUntil||0) || time<(enemy.staggerUntil||0) ||
   time<(enemy.skillLiftUntil||0) || time<(enemy.skillTremorUntil||0) ||
   time<(enemy.storyAnomalyFreezeUntil||0) || Boolean(this.gameplayPaused);

  // Rescue mode lasts only a few seconds and exits as soon as it demonstrably
  // made progress. This preserves the cheap v10.7 navigation for normal mobs.
  if(enemy.navRescueActive){
   const movedFromStart=Phaser.Math.Distance.Between(enemy.x,enemy.y,enemy.navRescueStartX??enemy.x,enemy.navRescueStartY??enemy.y);
   const distanceGain=(enemy.navRescueStartDistance??playerDistance)-playerDistance;
   const success=movedFromStart>=90 || distanceGain>=72;
   const expired=time>=(enemy.navRescueUntil||0);
   if(success || expired){
    enemy.navRescueActive=false;
    enemy.navRescueCooldownUntil=time+(success?3500:1800);
    enemy.navStuckAnchorX=enemy.x;enemy.navStuckAnchorY=enemy.y;enemy.navStuckSince=time;
    enemy.navProbeAt=0;enemy.localSteerProbeAt=0;
    trace(success?'enemy_rescue_navigation_success':'enemy_rescue_navigation_expired',{
     durationMs:Math.round(time-(enemy.navRescueStartedAt||time)),
     moved:Math.round(movedFromStart),distanceGain:Math.round(distanceGain)
    });
   }
   return;
  }

  if(locked || intendedSpeed<=20 || playerDistance<=96){
   enemy.navStuckAnchorX=enemy.x;enemy.navStuckAnchorY=enemy.y;enemy.navStuckSince=time;
   return;
  }
  if(time<(enemy.navRescueCooldownUntil||0)) return;

  if(!Number.isFinite(enemy.navStuckAnchorX) || !Number.isFinite(enemy.navStuckAnchorY)){
   enemy.navStuckAnchorX=enemy.x;enemy.navStuckAnchorY=enemy.y;enemy.navStuckSince=time;
   return;
  }
  const anchorDx=enemy.x-enemy.navStuckAnchorX;
  const anchorDy=enemy.y-enemy.navStuckAnchorY;
  const anchorMoveSq=anchorDx*anchorDx+anchorDy*anchorDy;
  if(anchorMoveSq>28*28){
   enemy.navStuckAnchorX=enemy.x;enemy.navStuckAnchorY=enemy.y;enemy.navStuckSince=time;
   return;
  }
  if(time-(enemy.navStuckSince||time)<4000) return;

  enemy.navRescueActive=true;
  enemy.navRescueStartedAt=time;
  enemy.navRescueUntil=time+4500;
  enemy.navRescueStartX=enemy.x;enemy.navRescueStartY=enemy.y;
  enemy.navRescueStartDistance=playerDistance;
  enemy.navPath=null;enemy.navPathIndex=0;
  enemy.navForceRepath=true;enemy.navNextRepathAt=0;enemy.navProbeAt=0;
  enemy.obstacleSteerUntil=0;enemy.cachedSteerAngle=null;enemy.localSteerProbeAt=0;
  trace('enemy_stuck_detected',{stuckMs:Math.round(time-(enemy.navStuckSince||time)),playerDistance:Math.round(playerDistance)});
  trace('enemy_rescue_navigation_started',{durationMs:4500,playerDistance:Math.round(playerDistance)});
 }

 getEnemyNavigationWaypoint(enemy,time,targetX,targetY,radius){
  if(!enemy || !this.player?.active) return null;
  this.ensureNavigationGrid();

  // Navigation probe caching: line-of-sight through the coarse grid used to be
  // sampled for every enemy every frame. The result is stable for a short
  // window, while physics keeps the already chosen velocity smooth between AI
  // ticks. Close enemies refresh more often; distant enemies refresh less often.
  enemy.navSeed=enemy.navSeed??Phaser.Math.Between(0,65535);
  const cellSize=this.navigationCellSize||56;
  const tx0=enemy.navProbeTargetX??targetX;
  const ty0=enemy.navProbeTargetY??targetY;
  const probeTargetDx=targetX-tx0;
  const probeTargetDy=targetY-ty0;
  const probeTargetMovedSq=probeTargetDx*probeTargetDx+probeTargetDy*probeTargetDy;
  const targetDx=targetX-enemy.x;
  const targetDy=targetY-enemy.y;
  const targetDistanceSq=targetDx*targetDx+targetDy*targetDy;
<<<<<<< HEAD
  const probeInterval=targetDistanceSq>700*700?260:(targetDistanceSq>340*340?160:90);
  const probeJitter=enemy.navSeed%31;
=======
  const rescueMode=Boolean(enemy.navRescueActive && time<(enemy.navRescueUntil||0));
  const probeInterval=rescueMode?35:(targetDistanceSq>700*700?260:(targetDistanceSq>340*340?160:90));
  const probeJitter=rescueMode?(enemy.navSeed%9):(enemy.navSeed%31);
>>>>>>> c550486 (new changes)
  const mustProbe=enemy.navForceRepath || enemy.navGridVersion!==this.navigationGridVersion || !Number.isFinite(enemy.navProbeAt) || time>=enemy.navProbeAt || probeTargetMovedSq>(cellSize*0.7)*(cellSize*0.7);
  let directBlocked=Boolean(enemy.navProbeBlocked);
  if(mustProbe){
   directBlocked=this.isNavigationLineBlocked(enemy.x,enemy.y,targetX,targetY);
   enemy.navProbeBlocked=directBlocked;
   enemy.navProbeAt=time+probeInterval+probeJitter;
   enemy.navProbeTargetX=targetX;
   enemy.navProbeTargetY=targetY;
  }

  if(!directBlocked){
   enemy.navPath=null;
   enemy.navPathIndex=0;
   enemy.navForceRepath=false;
   return null;
  }

  const targetMoveDx=targetX-(enemy.navTargetX??targetX);
  const targetMoveDy=targetY-(enemy.navTargetY??targetY);
<<<<<<< HEAD
  const targetMoved=(targetMoveDx*targetMoveDx+targetMoveDy*targetMoveDy)>(cellSize*1.5)*(cellSize*1.5);
=======
  const targetMoveThreshold=rescueMode?cellSize*0.45:cellSize*1.5;
  const targetMoved=(targetMoveDx*targetMoveDx+targetMoveDy*targetMoveDy)>targetMoveThreshold*targetMoveThreshold;
>>>>>>> c550486 (new changes)
  const pathFinished=Boolean(enemy.navPath?.length) && (enemy.navPathIndex||0)>=enemy.navPath.length-1;
  const periodicRefresh=rescueMode
   ? time>=(enemy.navNextRepathAt||0)
   : (pathFinished && time>=(enemy.navNextRepathAt||0));
  const needsPath=!enemy.navPath?.length || enemy.navGridVersion!==this.navigationGridVersion || targetMoved || periodicRefresh || enemy.navForceRepath;
<<<<<<< HEAD
  if(needsPath && this.navigationPathfindBudget>0){
   this.navigationPathfindBudget--;
   enemy.navPath=this.findNavigationPath(enemy.x,enemy.y,targetX,targetY,enemy);
=======
  const normalBudget=(this.navigationPathfindBudget||0)>0;
  const rescueBudget=rescueMode && (this.navigationRescuePathfindBudget||0)>0;
  if(needsPath && (normalBudget || rescueBudget)){
   if(rescueBudget)this.navigationRescuePathfindBudget--;else this.navigationPathfindBudget--;
   enemy.navPath=this.findNavigationPath(enemy.x,enemy.y,targetX,targetY,enemy,rescueMode?4200:3200);
>>>>>>> c550486 (new changes)
   enemy.navPathIndex=0;
   enemy.navTargetX=targetX;
   enemy.navTargetY=targetY;
   enemy.navGridVersion=this.navigationGridVersion;
   enemy.navForceRepath=false;
<<<<<<< HEAD
   enemy.navNextRepathAt=time+1050+(enemy.navSeed%520);
=======
   enemy.navNextRepathAt=time+(rescueMode?320+(enemy.navSeed%120):1050+(enemy.navSeed%520));
   if(rescueMode)this.devTools?.recordTraceEvent?.('enemy_rescue_repath',{
    enemyType:enemy.type,navSeed:enemy.navSeed,wave:this.wave||0,pathLength:enemy.navPath?.length||0,
    x:Math.round(enemy.x),y:Math.round(enemy.y)
   },{sample:true});
>>>>>>> c550486 (new changes)
  }

  const path=enemy.navPath;
  if(!path?.length) return null;
  let index=Phaser.Math.Clamp(enemy.navPathIndex||0,0,path.length-1);
  const waypointAdvanceSq=(cellSize*0.48)*(cellSize*0.48);
  while(index<path.length-1){
   const dx=enemy.x-path[index].x;
   const dy=enemy.y-path[index].y;
   if(dx*dx+dy*dy>=waypointAdvanceSq) break;
   index++;
  }
  enemy.navPathIndex=index;
  return path[index]||null;
 }

 applyEnemySoftSeparation(time){
  if(this.devFlags?.noCollision) return;
  // Separation is a correction force, not core locomotion. Running it at 20Hz
  // keeps the same visible crowd behaviour while avoiding O(n²) pair checks on
  // every render frame.
  if(time<(this.enemySeparationNextAt||0)) return;
  this.enemySeparationNextAt=time+50;
  const list=(this.enemies||[]).filter(e=>e?.active && e.hp>0 && e.body && e.body.enable!==false);
  for(let i=0;i<list.length;i++){
   const a=list[i];
   for(let j=i+1;j<list.length;j++){
    const b=list[j];
    const dx=a.x-b.x,dy=a.y-b.y;
    const minDist=(a.crowdRadius||a.hitRadius||14)+(b.crowdRadius||b.hitRadius||14)+5;
    const d2=dx*dx+dy*dy;
    if(d2>=minDist*minDist) continue;
    const dist=Math.max(0.001,Math.sqrt(d2));
    const overlap=minDist-dist;
    const fallbackAngle=((i*31+j*17)%360)*Math.PI/180;
    const nx=d2<0.0001?Math.cos(fallbackAngle):dx/dist;
    const ny=d2<0.0001?Math.sin(fallbackAngle):dy/dist;
    const frozenA=(time<(a.storyAnomalyFreezeUntil||0)) || (a.type==='champion'
     ? (this.devFlags?.championFrozen||this.devFlags?.championMovementFrozen)
     : (this.devFlags?.enemyAiFrozen||this.devFlags?.enemyMovementFrozen));
    const frozenB=(time<(b.storyAnomalyFreezeUntil||0)) || (b.type==='champion'
     ? (this.devFlags?.championFrozen||this.devFlags?.championMovementFrozen)
     : (this.devFlags?.enemyAiFrozen||this.devFlags?.enemyMovementFrozen));
    const attackA=frozenA?0:(time<(a.attackAnimUntil||0)?0.28:1);
    const attackB=frozenB?0:(time<(b.attackAnimUntil||0)?0.28:1);
    const championA=a.type==='champion'?0.45:1;
    const championB=b.type==='champion'?0.45:1;
    const force=Math.min(46,overlap*3.4+5);
    a.body.velocity.x+=nx*force*attackA*championA;
    a.body.velocity.y+=ny*force*attackA*championA;
    b.body.velocity.x-=nx*force*attackB*championB;
    b.body.velocity.y-=ny*force*attackB*championB;
   }
  }

  for(const e of list){
   if(!e.body?.velocity) continue;
   const base=Math.max(40,this.getEnemyMovementSpeed(e)||e.speed||80);
   const maxSpeed=base*1.32+24;
   const len=e.body.velocity.length();
   if(len>maxSpeed && len>0) e.body.velocity.scale(maxSpeed/len);
  }
 }

 findSafeNavSpawnPoint(x,y,{padding=26,minPlayerDistance=120,maxRadius=360}={}){
  const grid=this.ensureNavigationGrid();
  const start=this.worldToNavCell(x,y);
  const maxCells=Math.max(1,Math.ceil(maxRadius/grid.cellSize));
  const candidates=[];
  for(let r=0;r<=maxCells;r++){
   if(r===0){candidates.push(start);}
   else{
    for(let dx=-r;dx<=r;dx++){
     candidates.push({col:start.col+dx,row:start.row-r},{col:start.col+dx,row:start.row+r});
    }
    for(let dy=-r+1;dy<=r-1;dy++){
     candidates.push({col:start.col-r,row:start.row+dy},{col:start.col+r,row:start.row+dy});
    }
   }
   for(const c of candidates.splice(0,candidates.length)){
    if(!this.isNavCellWalkable(c.col,c.row)) continue;
    const point=this.navCellToWorld(c.col,c.row);
    if(Phaser.Math.Distance.Between(point.x,point.y,x,y)>maxRadius+grid.cellSize) continue;
    if(this.isSafeEnemySpawnPoint(point.x,point.y,padding,minPlayerDistance)) return point;
   }
  }
  return null;
 }
}

export default NavigationSystem;

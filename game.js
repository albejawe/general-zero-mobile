/* ZERO FRONTIER — original mobile RTS. No external dependencies. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const canvas=$('gameCanvas'), ctx=canvas.getContext('2d',{alpha:false});
const mini=$('minimap'), mc=mini.getContext('2d');
const TAU=Math.PI*2, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y), hypot=(x,y)=>Math.hypot(x,y);
const rand=(a,b)=>a+Math.random()*(b-a);
const fmt=n=>Math.floor(n).toLocaleString('en-US');
const COLORS={friendly:'#56d5b3',enemy:'#f18a76',neutral:'#e4c47e'};
const TYPES={
 infantry:{name:'مشاة',glyph:'♟',cost:95,needs:'barracks',time:2.5,hp:96,dmg:12,range:155,speed:92,fire:.84,r:11,kind:'infantry'},
 rocket:{name:'قاذف',glyph:'↟',cost:165,needs:'barracks',time:4,hp:78,dmg:28,range:235,speed:76,fire:1.9,r:11,splash:30,kind:'infantry'},
 scout:{name:'استطلاع',glyph:'◇',cost:195,needs:'factory',time:4,hp:160,dmg:10,range:150,speed:151,fire:.60,r:16,kind:'vehicle'},
 tank:{name:'دبابة',glyph:'▣',cost:365,needs:'factory',time:7,hp:420,dmg:43,range:210,speed:70,fire:1.55,r:22,kind:'vehicle'},
 artillery:{name:'مدفعية',glyph:'✹',cost:470,needs:'factory',time:9,hp:220,dmg:67,range:340,speed:51,fire:3.3,r:21,splash:57,kind:'vehicle'},
 special:{name:'نخبة',glyph:'✦',cost:565,needs:'factory',time:10,hp:500,dmg:49,range:245,speed:90,fire:1.45,r:23,kind:'vehicle'}
};
const BUILDINGS={
 barracks:{name:'ثكنة',glyph:'⌂',cost:290,hp:710,r:39,buildTime:2.3},
 factory:{name:'مصنع',glyph:'▤',cost:510,hp:1040,r:48,buildTime:4.0},
 mine:{name:'مصفاة',glyph:'◈',cost:250,hp:550,r:35,buildTime:2.4,income:20},
 turret:{name:'برج دفاع',glyph:'⌖',cost:335,hp:610,r:27,buildTime:3.5,dmg:29,range:270,fire:1.15}
};
const FACTIONS={
 alliance:{name:'التحالف',color:'#64c2e5',speed:1.08,hp:1,dmg:1,special:'مدرعة الشبح'},
 legion:{name:'الفيلق',color:'#e3bc66',speed:.94,hp:1.15,dmg:1.06,special:'الدبابة العملاقة'},
 rebels:{name:'المقاومة',color:'#c2a2d6',speed:1.12,hp:.94,dmg:1.1,special:'راجمة الصقور'}
};
const MAPS={
 duel:{name:'وادي الرماد',size:[1860,1130],n:1,ground:'#847259',shade:'#a28b65',theme:'desert'},
 squads:{name:'حدود الحديد',size:[2420,1380],n:2,ground:'#62766b',shade:'#84907c',theme:'hills'},
 war:{name:'العاصفة الكبرى',size:[3320,1690],n:4,ground:'#737b72',shade:'#9c9c84',theme:'plateau'}
};
let choice={map:'duel',faction:'alliance',diff:'normal'};
let g=null,lastFrame=performance.now(),raf=0, uiTimer=0, notificationUntil=0,mouse={x:0,y:0,worldX:0,worldY:0}, drag=null,pointers=new Map(),pinch=null, uid=1;
const kill=(list)=>{for(let i=list.length-1;i>=0;i--)if(!list[i].alive)list.splice(i,1)};
function seeded(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};}
function notify(msg){$('notification').textContent=msg;$('notification').classList.add('show');notificationUntil=performance.now()+2300;}
function tileMap(map){
 const r=seeded(map.n*33771), W=map.size[0],H=map.size[1];
 const deco=[];for(let i=0;i<360;i++){let x=r()*W,y=r()*H;deco.push({x,y,r:2+r()*12,a:.03+r()*.1,t:r()});}
 const rocks=[], nodes=[];
 // Symmetrical obstacles; central lanes remain traversable.
 const shapes=map.n===1?[[.50,.19,67],[.5,.81,70],[.49,.51,35]]:map.n===2?[[.47,.20,75],[.54,.80,80],[.48,.55,60],[.67,.36,47],[.33,.64,47]]:[[.49,.12,90],[.51,.88,90],[.47,.31,67],[.53,.69,67],[.50,.5,95],[.34,.51,43],[.66,.49,43]];
 for(const [nx,ny,rad] of shapes){rocks.push({x:W*nx,y:H*ny,r:rad});}
 const ys=map.n===1?[.5,.25,.74]:map.n===2?[.22,.47,.78]:[.12,.36,.62,.87];
 for(const y of ys){for(const x of [.235,.765])nodes.push({x:W*x,y:H*y,r:37,mine:null});}
 if(map.n>1){for(const y of [.32,.70])nodes.push({x:W*.5,y:H*y,r:37,mine:null});}
 if(map.n===1){nodes.push({x:W*.50,y:H*.30,r:37,mine:null},{x:W*.50,y:H*.7,r:37,mine:null});}
 return {W,H,deco,rocks,nodes,theme:map.theme,ground:map.ground,shade:map.shade,name:map.name};
}
function getStartPositions(map){
 let ys=map.n===1?[.5]:map.n===2?[.34,.71]:[.13,.375,.635,.875];
 return {left:ys.map(y=>({x:map.size[0]*.105,y:map.size[1]*y})),right:ys.map(y=>({x:map.size[0]*.895,y:map.size[1]*y}))};
}
function newGame(){
 uid=1; const m=MAPS[choice.map], world=tileMap(m), pos=getStartPositions(m);
 const players=[];
 for(let i=0;i<m.n*2;i++){
  let team=i<m.n?0:1,loc=team?pos.right[i-m.n]:pos.left[i];
  let faction=i===0?choice.faction:Object.keys(FACTIONS)[(i+(team?1:0))%3];
  players.push({id:i,team,faction,ai:i!==0,money:i===0?1940:1400,hq:null,start:{...loc},think:rand(.8,2),wave:0,losses:0});
 }
 g={world,players,units:[],buildings:[],projectiles:[],particles:[],selected:[],selectedBuilding:null,mode:null,tab:'build',attackMove:false,cam:{x:0,y:0,zoom:1},time:0,paused:false,over:false,uiDirty:true,spawned:0,destroyed:0,diff:choice.diff};
 for(const p of players){
  let b=createBuilding('hq',p,p.start.x,p.start.y,true);p.hq=b;
  const sign=p.team? -1:1;
  createUnit('infantry',p,p.start.x+sign*83,p.start.y-29,true);
  createUnit('infantry',p,p.start.x+sign*83,p.start.y+29,true);
  if(p.id===0)createUnit('scout',p,p.start.x+sign*128,p.start.y+6,true);
  else {
    createBuilding('barracks',p,p.start.x+sign*138,p.start.y-68,true);
    p.money-=180;
  }
 }
 resizeCanvas(); centerCamera(players[0].start.x+250,players[0].start.y);updateUI(true);
 $('startScreen').classList.add('hidden');$('endScreen').classList.add('hidden');$('hud').classList.remove('hidden');$('pauseOverlay').classList.add('hidden');
 notify('ابنِ مصفاة قرب بلورات الموارد، ثم جهّز جيشك!');
 try{screen.orientation?.lock?.('landscape').catch(()=>{});}catch(e){}
}
function createBuilding(type,p,x,y,instant=false){
 const def=type==='hq'?{hp:1700,r:58,name:'المقر الرئيسي'}:BUILDINGS[type];
 let b={id:uid++,type,p,x,y,hp:def.hp,max:def.hp,r:def.r,alive:true,complete:instant?1:0,buildTime:def.buildTime||1,queue:[],cool:0,linkedNode:null};
 g.buildings.push(b);
 if(type==='mine'){
  let n=g.world.nodes.find(v=>hypot(x-v.x,y-v.y)<85 && (!v.mine||!v.mine.alive));
  if(n){n.mine=b;b.linkedNode=n;}
 }
 g.uiDirty=true;return b;
}
function createUnit(type,p,x,y,instant=false){
 const d=TYPES[type],f=FACTIONS[p.faction],scale=type==='special'?(p.faction==='legion'?1.15:1):1;
 const u={id:uid++,type,p,x,y,hp:Math.round(d.hp*f.hp*scale),max:Math.round(d.hp*f.hp*scale),dmg:d.dmg*f.dmg*(type==='special'&&p.faction==='rebels'?1.24:1),range:d.range,speed:d.speed*f.speed*(type==='special'&&p.faction==='alliance'?1.20:1),fire:d.fire,r:d.r*(type==='special'&&p.faction==='legion'?1.2:1),alive:true,theta:p.team?Math.PI:0,gun:0,cool:rand(.05,.4),target:null,goal:null,path:[],order:'guard',spawnTime:g.time,stuck:0};
 g.units.push(u);g.spawned++;g.uiDirty=true;return u;
}
function incomeOf(p){let n=0;for(const b of g.buildings){if(b.alive && b.p===p&&b.complete>=1){if(b.type==='hq')n+=7;if(b.type==='mine'&&b.linkedNode)n+=20;}}return n;}
function buildingsOf(p,type){return g.buildings.filter(b=>b.alive&&b.complete>=1&&b.p===p&&b.type===type);}
function canPlace(p,type,x,y){
 const {world}=g,r=BUILDINGS[type]?.r||34;
 if(x<r+25||x>world.W-r-25||y<r+25||y>world.H-r-25)return false;
 if(world.rocks.some(o=>hypot(x-o.x,y-o.y)<o.r+r+16))return false;
 if(g.buildings.some(b=>b.alive&&hypot(x-b.x,y-b.y)<b.r+r+24))return false;
 if(type==='mine'&&!world.nodes.some(n=>hypot(x-n.x,y-n.y)<78&&(!n.mine||!n.mine.alive)))return false;
 if(type!=='mine'&&!g.buildings.some(b=>b.alive&&b.p===p&&b.complete>=1&&hypot(x-b.x,y-b.y)<500))return false;
 if(type==='mine'&&!g.buildings.some(b=>b.alive&&b.p===p&&b.complete>=1&&hypot(x-b.x,y-b.y)<510))return false;
 return true;
}
function buyBuilding(type,p,x,y){let def=BUILDINGS[type];if(!def||p.money<def.cost||!canPlace(p,type,x,y))return false;
 p.money-=def.cost;createBuilding(type,p,x,y);g.uiDirty=true;return true;
}
function buyUnit(type,p,quiet=false){const def=TYPES[type];if(!def)return false;
 if(p.money<def.cost){if(!quiet)notify('الرصيد غير كافٍ');return false;}
 if(g.units.filter(u=>u.alive&&u.p===p).length+g.buildings.reduce((sum,b)=>sum+(b.alive&&b.p===p?b.queue.length:0),0)>=28){if(!quiet)notify('بلغت الحد الأقصى لقوات هذا الجيش');return false;}
 let options=buildingsOf(p,def.needs).filter(b=>b.queue.length<4).sort((a,b)=>a.queue.length-b.queue.length);
 if(!options.length){if(!quiet)notify(def.needs==='barracks'?'ابنِ ثكنة لتدريب المشاة':'ابنِ مصنعاً لإنتاج الآليات');return false;}
 p.money-=def.cost;options[0].queue.push({type,remain:def.time,total:def.time});g.uiDirty=true;return true;
}
function isBlocked(x,y,r=12){return g.world.rocks.some(o=>hypot(x-o.x,y-o.y)<o.r+r+6);}
const CELL=66;
function pathfind(sx,sy,tx,ty){
 const {W,H,rocks}=g.world;
 const cols=Math.ceil(W/CELL),rows=Math.ceil(H/CELL);
 const x0=clamp(Math.floor(sx/CELL),0,cols-1),y0=clamp(Math.floor(sy/CELL),0,rows-1),x1=clamp(Math.floor(tx/CELL),0,cols-1),y1=clamp(Math.floor(ty/CELL),0,rows-1);
 const start=y0*cols+x0,end=y1*cols+x1;
 if(start===end)return [{x:tx,y:ty}];
 const blocked=(x,y)=>rocks.some(r=>hypot((x+.5)*CELL-r.x,(y+.5)*CELL-r.y)<r.r+29);
 const scores=new Float64Array(cols*rows).fill(Infinity),parents=new Int32Array(cols*rows).fill(-1),visited=new Uint8Array(cols*rows);
 const heap=[];scores[start]=0;heap.push({id:start,f:0});
 let checks=0,found=false;
 while(heap.length&&checks++<cols*rows*2){
  let best=0;for(let i=1;i<heap.length;i++)if(heap[i].f<heap[best].f)best=i;
  let here=heap.splice(best,1)[0].id;if(visited[here])continue;visited[here]=1;
  if(here===end){found=true;break;}
  let cx=here%cols,cy=Math.floor(here/cols);
  for(const [dx,dy,c] of [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[-1,1,1.414],[1,-1,1.414],[-1,-1,1.414]]){
   let nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=cols||ny>=rows||blocked(nx,ny))continue;
   if(dx&&dy&&(blocked(cx+dx,cy)||blocked(cx,cy+dy)))continue;
   let id=ny*cols+nx,ng=scores[here]+c;if(ng<scores[id]){scores[id]=ng;parents[id]=here;heap.push({id,f:ng+Math.hypot(nx-x1,ny-y1)});}
  }
 }
 if(!found)return [{x:tx,y:ty}];
 let pts=[],cur=end,lim=0;while(cur!==start&&cur!==-1&&lim++<300){pts.push({x:(cur%cols+.5)*CELL,y:(Math.floor(cur/cols)+.5)*CELL});cur=parents[cur];}
 pts.reverse();pts.push({x:tx,y:ty});
 // Remove unnecessary waypoints, preserving obstacle clearance.
 let out=[],anchor={x:sx,y:sy};for(let i=0;i<pts.length;){let last=i;for(let j=i+1;j<pts.length;j++)if(clearLine(anchor,pts[j]))last=j;else break;out.push(pts[last]);anchor=pts[last];i=last+1;}
 return out;
}
function clearLine(a,b){let d=distance(a,b),n=Math.ceil(d/34);if(n>120)n=120;for(let i=1;i<n;i++){let t=i/n;if(isBlocked(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,18))return false;}return true;}
function assignOrder(units,x,y,attack=false,focus=null){
 units=units.filter(u=>u.alive&&u.p.id===0);if(!units.length)return;
 const cols=Math.ceil(Math.sqrt(units.length));
 for(let i=0;i<units.length;i++){
  let u=units[i],ix=i%cols,iy=Math.floor(i/cols),step=36;
  let gx=clamp(x+(ix-(cols-1)/2)*step,25,g.world.W-25),gy=clamp(y+(iy-Math.floor(units.length/cols)/2)*step,25,g.world.H-25);
  if(isBlocked(gx,gy,12)){gx=x;gy=y;}
  u.goal={x:gx,y:gy};u.order=attack?'attack':'move';u.target=focus;u.path=pathfind(u.x,u.y,gx,gy);
 }
 spawnPing(x,y,attack?'#ffa77e':'#6ef1be');g.uiDirty=true;
}
function spawnPing(x,y,color){for(let i=0;i<9;i++)g.particles.push({x,y,vx:Math.cos(i*TAU/9)*80,vy:Math.sin(i*TAU/9)*80,life:.45,max:.45,color,size:3});}
function damage(ent,amount,source){if(!ent.alive)return;ent.hp-=amount;
 if(ent.hp<=0){ent.alive=false;let r=ent.r;for(let k=0;k<(ent.type==='hq'?38:ent.queue?16:8);k++){
  let angle=rand(0,TAU),spd=rand(20,190);g.particles.push({x:ent.x,y:ent.y,vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd,life:rand(.35,.95),max:1,color:Math.random()<.55?'#f8b76b':'#535456',size:rand(3,r*.30)});
 }if(ent.type==='hq'&&ent.p.hq===ent){ent.p.hq=null;notify(ent.p.team===0?'خسر حليف لنا مقره الرئيسي!':'دُمّر مقر أحد الأعداء!');}
 if(ent.p.team===1)g.destroyed++;
 g.uiDirty=true;
 }}
function closestEnemy(ent,radius,unitsFirst=true){
 let best=null,dist=radius;for(const u of g.units){if(!u.alive||u.p.team===ent.p.team)continue;let d=distance(u,ent)-u.r;if(d<dist){dist=d;best=u;}}
 for(const b of g.buildings){if(!b.alive||b.p.team===ent.p.team)continue;let d=distance(b,ent)-b.r;if(d<dist){dist=d;best=b;}}
 return best;
}
function fireProjectile(from,target,dmg,splash=0){
 if(!target.alive)return;g.projectiles.push({x:from.x,y:from.y,vx:0,vy:0,target,team:from.p.team,source:from,damage:dmg,splash,speed:from.type==='artillery'?410:from.type==='rocket'?510:750,alive:true,life:2.3,color:from.p.team?'#ffaa74':'#9dffe0'});
}
function tickUnits(dt){
 for(const u of g.units){if(!u.alive)continue;
  u.cool-=dt;
  if(u.target&&!u.target.alive)u.target=null;
  let enemy=closestEnemy(u,u.range+185);
  let target=u.target && u.target.alive?u.target:enemy;
  if(target){let d=distance(u,target);if(d<=u.range+target.r){
    if(u.cool<=0){fireProjectile(u,target,u.dmg,TYPES[u.type].splash||0);u.cool=u.fire;u.gun=.16;}
    u.theta=Math.atan2(target.y-u.y,target.x-u.x);
  }else if(u.order==='guard'||u.order==='attack'){
    // Chase enemies only a short distance; do not abandon long-distance orders.
    if(u.order==='guard'&&d<u.range+105)moveTowards(u,target.x,target.y,dt);
  }}
  if(u.gun>0)u.gun-=dt;
  const inRange=target&&distance(u,target)<=u.range+target.r;
  if(u.goal&&!(inRange&&u.order==='guard')){
    let point=u.path[0]||u.goal;let d=distance(u,point);
    if(d<Math.max(14,u.speed*dt*2.3)){u.path.shift();point=u.path[0]||u.goal;}
    let destinationDistance=distance(u,u.goal);
    if(destinationDistance<13){u.goal=null;u.path=[];if(u.order!=='attack')u.order='guard';}
    else if(!inRange||u.order==='move'){moveTowards(u,point.x,point.y,dt);}
  }
 }
 // Local separation, combat collision avoidance.
 for(let i=0;i<g.units.length;i++){
  const a=g.units[i];if(!a.alive)continue;
  for(let j=i+1;j<g.units.length;j++){
   const b=g.units[j];if(!b.alive||Math.abs(a.x-b.x)>48||Math.abs(a.y-b.y)>48)continue;
   const d=distance(a,b)||.1,min=(a.r+b.r)*.82;if(d<min){let push=(min-d)*.20,dx=(a.x-b.x)/d,dy=(a.y-b.y)/d;a.x+=dx*push;a.y+=dy*push;b.x-=dx*push;b.y-=dy*push;}
  }
 }
}
function moveTowards(u,x,y,dt){
 let dx=x-u.x,dy=y-u.y,d=hypot(dx,dy);if(d<1)return;
 let step=Math.min(u.speed*dt,d),nx=u.x+dx/d*step,ny=u.y+dy/d*step;
 if(isBlocked(nx,ny,u.r*.6)){
  let left={x:u.x-dy/d*step,y:u.y+dx/d*step};let right={x:u.x+dy/d*step,y:u.y-dx/d*step};
  if(!isBlocked(left.x,left.y,u.r*.6)){nx=left.x;ny=left.y;}
  else if(!isBlocked(right.x,right.y,u.r*.6)){nx=right.x;ny=right.y;}
  else {u.stuck+=dt;if(u.stuck>.7&&u.goal){u.path=pathfind(u.x,u.y,u.goal.x,u.goal.y);u.stuck=0;}return;}
 }
 u.x=clamp(nx,u.r,g.world.W-u.r);u.y=clamp(ny,u.r,g.world.H-u.r);u.theta=Math.atan2(ny-u.y+dy/d*2,nx-u.x+dx/d*2);u.stuck=0;
}
function tickProjectiles(dt){
 for(const q of g.projectiles){if(!q.alive)continue;q.life-=dt;if(q.life<=0){q.alive=false;continue;}
  const t=q.target;if(!t.alive){q.alive=false;continue;}
  let dx=t.x-q.x,dy=t.y-q.y,dd=hypot(dx,dy),step=q.speed*dt;
  if(dd<=step+t.r*.5){q.x=t.x;q.y=t.y;
   if(q.splash){for(const u of g.units)if(u.alive&&u.p.team!==q.team&&distance(u,q)<q.splash+u.r)damage(u,q.damage*(1-distance(u,q)/(q.splash+u.r)*.55),q.source);
    for(const b of g.buildings)if(b.alive&&b.p.team!==q.team&&distance(b,q)<q.splash+b.r)damage(b,q.damage*(1-distance(b,q)/(q.splash+b.r)*.55),q.source);
   }else damage(t,q.damage,q.source);
   for(let i=0;i<(q.splash?12:3);i++){let angle=rand(0,TAU),speed=rand(15,q.splash?95:55);g.particles.push({x:q.x,y:q.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:rand(.15,.5),max:.5,color:Math.random()>.5?'#fff1b3':q.color,size:rand(2,7)});}
   q.alive=false;
  }else {q.x+=dx/dd*step;q.y+=dy/dd*step;q.vx=dx/dd;q.vy=dy/dd;}
 }
 kill(g.projectiles);
}
function tickBuildings(dt){
 for(const b of g.buildings){if(!b.alive)continue;
  if(b.complete<1){b.complete=Math.min(1,b.complete+dt/b.buildTime);if(b.complete>=1)g.uiDirty=true;continue;}
  if(b.type==='turret'){
   b.cool-=dt;if(b.cool<=0){let e=closestEnemy(b,BUILDINGS.turret.range);if(e){fireProjectile(b,e,BUILDINGS.turret.dmg,0);b.cool=BUILDINGS.turret.fire;}}
  }
  if(b.queue.length){let q=b.queue[0];q.remain-=dt;if(q.remain<=0){
    const side=b.p.team?-1:1;let x=b.x+side*(b.r+40),y=b.y+rand(-25,25);
    for(let t=0;t<8&&(isBlocked(x,y,18)||g.buildings.some(a=>a.alive&&distance(a,{x,y})<a.r+20));t++){x=b.x+Math.cos(t*TAU/8)*(b.r+45);y=b.y+Math.sin(t*TAU/8)*(b.r+45);}
    let u=createUnit(q.type,b.p,clamp(x,20,g.world.W-20),clamp(y,20,g.world.H-20));
    if(b.p.ai){let enemies=g.players.filter(p=>p.team!==b.p.team&&p.hq&&p.hq.alive);if(enemies.length){const dest=enemies.reduce((a,c)=>distance(a.hq,b)<distance(c.hq,b)?a:c).hq;u.goal={x:dest.x,y:dest.y};u.path=pathfind(u.x,u.y,dest.x,dest.y);u.order='attack';}}
    b.queue.shift();g.uiDirty=true;
   }}
 }
}
function aiBuildNear(p,type,nearX,nearY){
 for(let i=0;i<36;i++){
  let a=i*2.399+ p.id,dist=type==='turret'?rand(115,225):rand(130,275);
  let x=clamp(nearX+Math.cos(a)*dist,45,g.world.W-45),y=clamp(nearY+Math.sin(a)*dist,45,g.world.H-45);
  if(buyBuilding(type,p,x,y))return true;
 }return false;
}
function tickAI(dt){
 const settings={easy:{speed:1.65,attack:5,ratio:.65},normal:{speed:1.0,attack:4,ratio:1},hard:{speed:.72,attack:3,ratio:1.18}}[g.diff];
 for(const p of g.players){if(!p.ai||!p.hq||!p.hq.alive)continue;
  p.think-=dt;if(p.think>0)continue;p.think=rand(1.1,2.1)*settings.speed;
  const owned=g.units.filter(u=>u.alive&&u.p===p), barracks=buildingsOf(p,'barracks'), factories=buildingsOf(p,'factory'),mines=buildingsOf(p,'mine');
  const myNodes=g.world.nodes.filter(n=>(!n.mine||!n.mine.alive)&&distance(n,p.hq)<570).sort((a,b)=>distance(a,p.hq)-distance(b,p.hq));
  if(mines.length<2&&myNodes.length&&p.money>BUILDINGS.mine.cost+100){const n=myNodes[0];if(buyBuilding('mine',p,n.x,n.y))continue;}
  if(!barracks.length&&p.money>390){aiBuildNear(p,'barracks',p.hq.x,p.hq.y);continue;}
  if(!factories.length&&p.money>950&&g.time>(g.diff==='hard'?10:20)){aiBuildNear(p,'factory',p.hq.x,p.hq.y);continue;}
  if(g.diff==='hard'&&g.time>18&&buildingsOf(p,'turret').length<1&&p.money>750){aiBuildNear(p,'turret',p.hq.x,p.hq.y);continue;}
  if(owned.length<24){
   const type=factories.length&&p.money>650?(Math.random()<.45?'tank':Math.random()<.25?'special':'scout'):(Math.random()<.27?'rocket':'infantry');
   buyUnit(type,p,true);
   if(settings.ratio>1&&Math.random()<.35)buyUnit('infantry',p,true);
  }
  let ready=owned.filter(u=>u.order==='guard'||u.order==='move'||!u.goal);const targets=g.players.filter(v=>v.team!==p.team&&v.hq&&v.hq.alive);
  if(ready.length>=settings.attack&&targets.length){
   let dest=targets.reduce((a,b)=>distance(a.hq,p.hq)<distance(b.hq,p.hq)?a:b).hq;
   // Orders share the same tactical framework as human players.
   for(let k=0;k<ready.length;k++){
    let u=ready[k],gy=dest.y+(k%5-2)*32,gx=dest.x+(Math.floor(k/5)-1)*27;
    u.goal={x:clamp(gx,25,g.world.W-25),y:clamp(gy,25,g.world.H-25)};
    u.path=pathfind(u.x,u.y,u.goal.x,u.goal.y);u.order='attack';
   }
  }
 }
}
function checkVictory(){if(g.over)return;
 const alive0=g.players.some(p=>p.team===0&&p.hq?.alive),alive1=g.players.some(p=>p.team===1&&p.hq?.alive);
 if(alive0&&alive1)return;
 g.over=true;g.paused=true;
 const win=alive0&&!alive1;$('endIcon').textContent=win?'✦':'✕';$('endIcon').style.color=win?'#e3b66c':'#eb7d6a';
 $('endTitle').textContent=win?'انتصار ساحق!':'انتهت المعركة';
 $('endDetails').textContent=`${win?'دُمّرت جميع قواعد الخصم.':'تم تدمير جميع قواعد فريقك.'} الوقت ${formatClock(g.time)} • أهداف مدمّرة ${g.destroyed}`;
 $('endScreen').classList.remove('hidden');$('hud').classList.add('hidden');
}
function tick(dt){
 g.time+=dt;
 for(const p of g.players)if(p.hq?.alive){p.money+=incomeOf(p)*dt;}
 tickAI(dt);tickBuildings(dt);tickUnits(dt);tickProjectiles(dt);
 for(const part of g.particles){part.x+=part.vx*dt;part.y+=part.vy*dt;part.vx*=1-dt*2;part.vy*=1-dt*2;part.life-=dt;}
 kill(g.particles);kill(g.units);
 // Buildings can be destroyed; preserve their wrecks for a brief visual trace.
 kill(g.buildings);
 g.selected=g.selected.filter(u=>u.alive);if(g.selectedBuilding&&!g.selectedBuilding.alive)g.selectedBuilding=null;
 checkVictory();
}
function formatClock(s){s=Math.floor(s);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function resizeCanvas(){const dpr=Math.min(window.devicePixelRatio||1,1.75),w=canvas.clientWidth,h=canvas.clientHeight;
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=true;
 if(g)limitCam();}
function size(){return {w:canvas.clientWidth,h:canvas.clientHeight};}
function limitCam(){if(!g)return;let v=size(),c=g.cam;c.x=clamp(c.x,0,Math.max(0,g.world.W-v.w/c.zoom));c.y=clamp(c.y,0,Math.max(0,g.world.H-v.h/c.zoom));}
function centerCamera(x,y){let v=size();g.cam.x=x-v.w/(2*g.cam.zoom);g.cam.y=y-v.h/(2*g.cam.zoom);limitCam();}
function worldAt(sx,sy){let c=g.cam;return {x:c.x+sx/c.zoom,y:c.y+sy/c.zoom};}
function screenAt(x,y){return {x:(x-g.cam.x)*g.cam.zoom,y:(y-g.cam.y)*g.cam.zoom};}
function setZoom(z,sx,sy){let c=g.cam,v=size();sx=sx??v.w/2;sy=sy??v.h/2;
 const before=worldAt(sx,sy);c.zoom=clamp(z,.52,1.7);c.x=before.x-sx/c.zoom;c.y=before.y-sy/c.zoom;limitCam();}
function isVisible(x,y,r=0){let s=screenAt(x,y),v=size();return s.x>-r-30&&s.y>-r-30&&s.x<v.w+r+30&&s.y<v.h+r+30;}
function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function drawTerrain(){let w=g.world.W,h=g.world.H,world=g.world,c=g.cam,v=size();
 ctx.fillStyle=world.ground;ctx.fillRect(0,0,w,h);
 const left=c.x,top=c.y,right=left+v.w/c.zoom,bottom=top+v.h/c.zoom;
 // Tactical subtle terrain grid and diagonals.
 ctx.lineWidth=.7/c.zoom;ctx.strokeStyle='#ffffff0b';ctx.beginPath();let grid=125;
 for(let x=Math.floor(left/grid)*grid;x<right+grid;x+=grid){ctx.moveTo(x,top);ctx.lineTo(x,bottom);}
 for(let y=Math.floor(top/grid)*grid;y<bottom+grid;y+=grid){ctx.moveTo(left,y);ctx.lineTo(right,y);}ctx.stroke();
 ctx.strokeStyle=world.theme==='desert'?'#d7b88219':'#e5e6d619';ctx.lineWidth=18;
 ctx.beginPath();ctx.moveTo(0,h*.5);ctx.bezierCurveTo(w*.36,h*.42,w*.65,h*.64,w,h*.52);ctx.stroke();
 ctx.lineWidth=4;ctx.strokeStyle='#212b2b35';ctx.stroke();
 for(const d of world.deco){if(d.x<left-30||d.x>right+30||d.y<top-30||d.y>bottom+30)continue;
  ctx.fillStyle=d.t>.55?'#e7d8ae1b':'#1b2c231a';ctx.beginPath();ctx.ellipse(d.x,d.y,d.r,d.r*.38,d.t*TAU,0,TAU);ctx.fill();
 }
 for(const o of world.rocks){if(!isVisible(o.x,o.y,o.r*c.zoom))continue;
  ctx.save();ctx.translate(o.x,o.y);
  ctx.fillStyle='#202c2c4a';ctx.beginPath();ctx.ellipse(8,13,o.r*1.13,o.r*.7,0,0,TAU);ctx.fill();
  let gr=ctx.createLinearGradient(-o.r,-o.r,o.r,o.r);gr.addColorStop(0,world.theme==='desert'?'#b8a184':'#a0a79b');gr.addColorStop(.55,world.theme==='desert'?'#69645a':'#656e67');gr.addColorStop(1,'#3a4948');
  ctx.fillStyle=gr;ctx.beginPath();ctx.moveTo(-o.r*.92,-o.r*.20);ctx.lineTo(-o.r*.55,-o.r*.75);ctx.lineTo(o.r*.25,-o.r*.86);ctx.lineTo(o.r*.92,-o.r*.20);ctx.lineTo(o.r*.77,o.r*.64);ctx.lineTo(-o.r*.48,o.r*.82);ctx.closePath();ctx.fill();ctx.strokeStyle='#ffffff22';ctx.lineWidth=3;ctx.stroke();
  ctx.restore();
 }
 for(const n of world.nodes){if(!isVisible(n.x,n.y,65))continue;
  ctx.save();ctx.translate(n.x,n.y);const mined=n.mine&&n.mine.alive;ctx.strokeStyle=mined?'#9dffd954':'#fbdc84b8';ctx.lineWidth=2;ctx.setLineDash([7,7]);ctx.beginPath();ctx.arc(0,0,44,0,TAU);ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<5;i++){let a=i*TAU/5+.12,xx=Math.cos(a)*19,yy=Math.sin(a)*17;
   ctx.fillStyle=mined?'#3a9b81':'#e5c57b';ctx.beginPath();ctx.moveTo(xx,yy-19);ctx.lineTo(xx+10,yy);ctx.lineTo(xx,yy+14);ctx.lineTo(xx-9,yy);ctx.fill();ctx.strokeStyle='#fff4d28c';ctx.lineWidth=1;ctx.stroke();}
  ctx.restore();
 }
}
function drawHealth(e){if(e.hp>=e.max||!e.alive)return;let w=e.r*2.0,x=e.x-w/2,y=e.y-e.r-23;ctx.fillStyle='#0b161be5';ctx.fillRect(x,y,w,6);ctx.fillStyle=e.p.team?'#ec6a67':'#72e6a9';ctx.fillRect(x+1,y+1,(w-2)*clamp(e.hp/e.max,0,1),4);}
function drawBuilding(b){if(!isVisible(b.x,b.y,b.r*g.cam.zoom))return;
 let p=b.p,teamColor=p.team?COLORS.enemy:COLORS.friendly, factionColor=FACTIONS[p.faction].color;
 ctx.save();ctx.translate(b.x,b.y);
 ctx.fillStyle='#071a1b65';ctx.beginPath();ctx.ellipse(7,13,b.r*1.15,b.r*.70,0,0,TAU);ctx.fill();
 ctx.fillStyle='#34433c';ctx.strokeStyle='#172828';ctx.lineWidth=4;
 if(b.type==='hq'){
  roundRect(-51,-40,102,80,9,'#344b4a','#172b2a');
  roundRect(-41,-33,82,47,5,'#5b7066','#9eb5a1');
  ctx.fillStyle=factionColor;ctx.fillRect(-31,-31,62,6);
  roundRect(-23,-22,46,37,5,'#223a3d','#829797');
  roundRect(-34,20,68,14,4,'#263a3e','#6a9991');
  ctx.fillStyle=teamColor;ctx.fillRect(-27,25,54,5);
  ctx.fillStyle='#aed5c2';ctx.fillRect(-6,-19,12,12);
 }else if(b.type==='barracks'){
  roundRect(-37,-31,74,62,6,'#3e5555','#1b3338');
  roundRect(-31,-24,62,18,3,'#748678','#a5b3a4');
  for(let i=-1;i<=1;i++){ctx.fillStyle=teamColor;ctx.fillRect(i*17-6,7,12,15);}
  ctx.fillStyle=factionColor;ctx.fillRect(-34,-28,68,5);
 }else if(b.type==='factory'){
  roundRect(-46,-37,92,74,6,'#404b4b','#15272b');
  for(let i=-2;i<=2;i++){ctx.fillStyle='#7b8986';ctx.fillRect(-40+(i+2)*18,-36,11,28);}
  roundRect(-33,-2,66,31,3,'#1c3539','#95a7a0');ctx.fillStyle='#3d5655';ctx.fillRect(-25,5,50,19);
  ctx.fillStyle=factionColor;ctx.fillRect(-40,-37,80,5);
 }else if(b.type==='mine'){
  roundRect(-31,-25,62,50,6,'#4b574c','#283d3c');
  ctx.save();ctx.rotate(g.time*.45);ctx.strokeStyle='#e6bf77';ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,17,0,TAU);ctx.stroke();ctx.restore();
  ctx.fillStyle='#f9db9a';ctx.fillRect(-9,-8,18,16);
 }else if(b.type==='turret'){
  ctx.fillStyle='#364f4a';ctx.beginPath();for(let i=0;i<8;i++){let a=i*TAU/8;ctx.lineTo(Math.cos(a)*28,Math.sin(a)*28);}ctx.closePath();ctx.fill();
  ctx.save();ctx.rotate(g.time*.20);roundRect(-10,-28,20,55,5,'#2c3e3f','#a4ad9a');ctx.restore();
  ctx.fillStyle=teamColor;ctx.beginPath();ctx.arc(0,0,8,0,TAU);ctx.fill();
 }
 ctx.fillStyle=teamColor;ctx.beginPath();ctx.arc(-b.r+5,-b.r+3,7,0,TAU);ctx.fill();
 if(b.complete<1){ctx.fillStyle='#061619c0';ctx.fillRect(-b.r,-b.r,2*b.r,2*b.r*(1-b.complete));ctx.strokeStyle='#f5d090';ctx.lineWidth=3;ctx.strokeRect(-b.r-3,-b.r-3,2*b.r+6,2*b.r+6);}
 ctx.restore();drawHealth(b);
 if(b.queue.length){let q=b.queue[0];ctx.strokeStyle='#ffda90';ctx.lineWidth=4;ctx.beginPath();ctx.arc(b.x,b.y,b.r+8,-Math.PI/2,-Math.PI/2+TAU*(1-q.remain/q.total));ctx.stroke();}
 if(g.selectedBuilding===b){ctx.lineWidth=3/g.cam.zoom;ctx.strokeStyle='#f9cc76';ctx.setLineDash([10,6]);ctx.beginPath();ctx.arc(b.x,b.y,b.r+15,0,TAU);ctx.stroke();ctx.setLineDash([]);}
}
function drawUnit(u){if(!isVisible(u.x,u.y,u.r*g.cam.zoom))return;
 let team=u.p.team?COLORS.enemy:COLORS.friendly,fac=FACTIONS[u.p.faction].color;
 ctx.save();ctx.translate(u.x,u.y);ctx.rotate(u.theta);
 ctx.fillStyle='#08181b6f';ctx.beginPath();ctx.ellipse(4,6,u.r*1.15,u.r*.75,0,0,TAU);ctx.fill();
 if(TYPES[u.type].kind==='infantry'){
  ctx.fillStyle=fac;roundRect(-7,-6,13,13,3,fac,'#142c2a');
  ctx.fillStyle='#253333';ctx.beginPath();ctx.arc(0,-1,5.5,0,TAU);ctx.fill();
  ctx.strokeStyle='#101c1c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(u.type==='rocket'?19:13,0);ctx.stroke();
  ctx.fillStyle=team;ctx.fillRect(-5,-9,5,4);
 }else{
  let r=u.r;const t=u.type;
  roundRect(-r,-r*.69,r*2,r*1.38,5,'#243536','#131b1d');
  if(t==='tank'||t==='special'||t==='artillery'){
   for(const side of [-1,1]){roundRect(-r,-r*(side>0?-.53:.79),r*2,r*.26,3,'#1e2729','#75827a');}
   roundRect(-r*.76,-r*.51,r*1.53,r*1.03,5,fac,'#324446');
   roundRect(-r*.33,-r*.39,r*.85,r*.80,5,'#364b4a','#9fae98');
   ctx.fillStyle='#142b2b';ctx.fillRect(-r*.04,-r*.17,r*(t==='artillery'?2.0:1.38),r*.29);
   if(t==='artillery'){ctx.fillStyle='#879b86';ctx.fillRect(r*.72,-r*.12,r*.71,r*.18);}
  }else{
   roundRect(-r*.7,-r*.52,r*1.4,r*1.04,4,fac,'#1d3638');
   ctx.fillStyle='#173038';ctx.fillRect(-r*.05,-r*.37,r*.58,r*.73);
   for(const sy of [-1,1]){ctx.fillStyle='#152322';ctx.beginPath();ctx.arc(-r*.55,sy*r*.65,4,0,TAU);ctx.arc(r*.55,sy*r*.65,4,0,TAU);ctx.fill();}
  }
  ctx.fillStyle=team;ctx.fillRect(-r*.55,-r*.58,r*.60,3.5);
 }
 if(u.gun>0){ctx.fillStyle='#fff0a9';ctx.beginPath();ctx.arc(u.r*1.23,0,4+u.gun*17,0,TAU);ctx.fill();}
 ctx.restore();drawHealth(u);
 if(g.selected.includes(u)){
  ctx.strokeStyle='#fbd583';ctx.lineWidth=2/g.cam.zoom;ctx.beginPath();ctx.ellipse(u.x,u.y,u.r+7,(u.r+6)*.66,0,0,TAU);ctx.stroke();
 }
}
function drawCombat(){
 for(const p of g.projectiles){if(!isVisible(p.x,p.y,10))continue;
  ctx.strokeStyle=p.color;ctx.lineWidth=p.splash?4:2.5;ctx.beginPath();ctx.moveTo(p.x-p.vx*10,p.y-p.vy*10);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.fillStyle='#fff5cb';ctx.beginPath();ctx.arc(p.x,p.y,p.splash?3.5:2.5,0,TAU);ctx.fill();
 }
 for(const p of g.particles){if(!isVisible(p.x,p.y,10))continue;ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill();}ctx.globalAlpha=1;
}
function drawTactical(){
 const v=size();let c=g.cam;
 if(g.mode?.type==='build'){
  const type=g.mode.key,def=BUILDINGS[type],x=mouse.worldX,y=mouse.worldY;
  let ok=canPlace(g.players[0],type,x,y);ctx.save();ctx.globalAlpha=.65;ctx.fillStyle=ok?'#57e5b54c':'#fa69604c';ctx.strokeStyle=ok?'#7dffbf':'#ff8a71';ctx.lineWidth=3/c.zoom;
  ctx.beginPath();ctx.arc(x,y,def.r,0,TAU);ctx.fill();ctx.stroke();ctx.restore();
 }
 if(drag&&drag.selecting&&drag.moved){const a=drag.start,b={x:drag.currentX,y:drag.currentY};ctx.setTransform(1,0,0,1,0,0);const dpr=canvas.width/v.w;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#82f2be24';ctx.strokeStyle='#d2ffcf';ctx.lineWidth=1.5;ctx.fillRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));ctx.strokeRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));}
 }
function drawMinimap(){const w=mini.width,h=mini.height,m=g.world,c=g.cam;
 mc.fillStyle=m.ground;mc.fillRect(0,0,w,h);let sx=w/m.W,sy=h/m.H;
 mc.fillStyle='#253b3b';for(const r of m.rocks){mc.beginPath();mc.arc(r.x*sx,r.y*sy,Math.max(1,r.r*sx),0,TAU);mc.fill();}
 mc.fillStyle='#e5d093';for(const n of m.nodes){mc.beginPath();mc.arc(n.x*sx,n.y*sy,2,0,TAU);mc.fill();}
 for(const b of g.buildings){if(!b.alive)continue;mc.fillStyle=b.p.team?'#f38a76':'#5ff3c7';mc.fillRect(b.x*sx-2,b.y*sy-2,b.type==='hq'?6:4,b.type==='hq'?6:4);}
 for(const u of g.units){if(!u.alive)continue;mc.fillStyle=u.p.team?'#f4aa78':'#b7ffe0';mc.fillRect(u.x*sx,u.y*sy,1.8,1.8);}
 mc.strokeStyle='#ffebac';mc.lineWidth=1.5;mc.strokeRect(c.x*sx,c.y*sy,canvas.clientWidth/c.zoom*sx,canvas.clientHeight/c.zoom*sy);
}
function render(){const v=size(),c=g.cam,dpr=canvas.width/v.w;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#182a2b';ctx.fillRect(0,0,v.w,v.h);
 ctx.save();ctx.scale(c.zoom,c.zoom);ctx.translate(-c.x,-c.y);
 drawTerrain();for(const b of g.buildings)drawBuilding(b);for(const u of g.units)drawUnit(u);drawCombat();drawTactical();ctx.restore();
 drawMinimap();}
function frame(now){raf=requestAnimationFrame(frame);let dt=Math.min(.04,(now-lastFrame)/1000||.016);lastFrame=now;
 if(!g)return;
 if(!g.paused&&dt>0)tick(dt);
 render();uiTimer+=dt;if(uiTimer>.22){updateUI(false);uiTimer=0;}
 if(notificationUntil&&now>notificationUntil){$('notification').classList.remove('show');notificationUntil=0;}
}
function actionButton(label,glyph,cost,kind,key,active,disabled=false){
 let b=document.createElement('button');b.className='action'+(active?' active':'');b.disabled=disabled;b.dataset.kind=kind;b.dataset.key=key;
 let a=document.createElement('span');a.className='glyph';a.textContent=glyph;let n=document.createElement('span');n.className='label';n.textContent=label;b.append(a,n);
 if(cost!==null){let t=document.createElement('span');t.className='cost';t.textContent='◈ '+cost;b.append(t);}return b;
}
function updateUI(force){if(!g)return;let p=g.players[0];$('money').textContent=fmt(p.money);$('income').textContent='+'+incomeOf(p)+'/ث';$('unitCount').textContent=g.units.filter(u=>u.alive&&u.p===p).length;
 let alive0=g.players.filter(p=>p.team===0&&p.hq?.alive).length,alive1=g.players.filter(p=>p.team===1&&p.hq?.alive).length;$('baseCount').textContent=alive0+':'+alive1;
 $('matchClock').textContent=formatClock(g.time);$('attackMove').classList.toggle('active',g.attackMove);
 if(!force&&!g.uiDirty)return;
 g.uiDirty=false;
 let info='ابنِ مصفاة للموارد وثكنة ومصنعاً لإنتاج القوات.',title='القيادة العسكرية';
 if(g.selected.length){let counts={};for(const u of g.selected)counts[u.type]=(counts[u.type]||0)+1;title=`القوات المحددة (${g.selected.length})`;info=Object.entries(counts).map(([k,n])=>TYPES[k].name+' ×'+n).join(' • ')+' | المس الأرض للتحريك';}
 if(g.selectedBuilding){let b=g.selectedBuilding;title=b.type==='hq'?'المقر الرئيسي':BUILDINGS[b.type].name;info=`سلامة ${Math.ceil(b.hp)}/${b.max}`+(b.queue.length?` • إنتاج ${TYPES[b.queue[0].type].name} (${Math.max(0,Math.ceil(b.queue[0].remain))}ث)`:'');}
 if(g.mode?.type==='build'){title='وضع البناء';info='المس موقعاً مناسباً داخل نطاق قاعدتك. الأصفر للمصفاة قرب البلورات.';}
 $('selectedTitle').textContent=title;$('selectedDetails').textContent=info;
 $('cancelMode').classList.toggle('hidden',!g.mode);
 let bar=$('actionBar');bar.replaceChildren();let group=document.createDocumentFragment();
 for(const b of document.querySelectorAll('#panelTabs .panelTab'))b.classList.toggle('active',b.dataset.tab===g.tab);
 if(g.tab==='build')for(const key of ['barracks','factory','mine','turret']){let d=BUILDINGS[key];group.append(actionButton(d.name,d.glyph,d.cost,'build',key,g.mode?.key===key,p.money<d.cost));}
 if(g.tab==='units')for(const key of ['infantry','rocket','scout','tank','artillery','special']){let d=TYPES[key],has=buildingsOf(p,d.needs).length>0;
  group.append(actionButton(key==='special'?FACTIONS[p.faction].special:d.name,d.glyph,d.cost,'unit',key,false,p.money<d.cost||!has));}
 bar.append(group);
}
function pointerWorld(ev){const rect=canvas.getBoundingClientRect();return {x:ev.clientX-rect.left,y:ev.clientY-rect.top};}
function pick(x,y){
 // Prioritize visible units over structures for touch-friendly selection.
 let u=null,du=28/g.cam.zoom;for(const e of g.units){if(!e.alive)continue;let d=hypot(e.x-x,e.y-y);if(d<du&&d<e.r+15){du=d;u=e;}}
 if(u)return u;
 let b=null,db=62/g.cam.zoom;for(const e of g.buildings){if(!e.alive)continue;let d=hypot(e.x-x,e.y-y);if(d<db&&d<e.r+15){db=d;b=e;}}
 return b;
}
function onTap(x,y){if(!g||g.paused||g.over)return;
 let w=worldAt(x,y),o=pick(w.x,w.y),me=g.players[0];
 if(g.mode?.type==='build'){
  let key=g.mode.key;if(buyBuilding(key,me,w.x,w.y)){notify(BUILDINGS[key].name+' — جارٍ البناء');g.mode=null;g.uiDirty=true;}
  else notify(me.money<BUILDINGS[key].cost?'الرصيد غير كافٍ':'موقع غير متاح — ابحث عن مساحة أو بلورات للمصفاة');return;
 }
 if(o){
  if(o.p===me){
   if(o.queue){g.selectedBuilding=o;g.selected=[];if(o.type==='barracks'||o.type==='factory')g.tab='units';}else{g.selected=[o];g.selectedBuilding=null;}
   g.uiDirty=true;return;
  }
  if(o.p.team!==me.team&&g.selected.length){assignOrder(g.selected,o.x,o.y,true,o);return;}
  if(o.p.team===me.team&&g.selected.length){return;}
  // Enemy and allied entities can be inspected, but not commanded.
  g.selected=[];g.selectedBuilding=null;g.uiDirty=true;return;
 }
 if(g.selected.length){assignOrder(g.selected,w.x,w.y,g.attackMove);return;}
 g.selectedBuilding=null;g.uiDirty=true;
}
canvas.addEventListener('pointerdown',ev=>{
 if(!g||g.paused||g.over)return;ev.preventDefault();canvas.setPointerCapture(ev.pointerId);
 let pt=pointerWorld(ev),w=worldAt(pt.x,pt.y);pointers.set(ev.pointerId,{...pt});
 if(pointers.size>=2){const pp=[...pointers.values()];pinch={distance:distance(pp[0],pp[1]),zoom:g.cam.zoom};drag=null;return;}
 let obj=pick(w.x,w.y);drag={start:pt,currentX:pt.x,currentY:pt.y,last:pt,selecting:!!(obj&&obj.p.id===0&&!obj.queue&&!g.mode),moved:false,worldStart:w};
 mouse.x=pt.x;mouse.y=pt.y;mouse.worldX=w.x;mouse.worldY=w.y;
},{passive:false});
canvas.addEventListener('pointermove',ev=>{
 if(!g)return;let pt=pointerWorld(ev),w=worldAt(pt.x,pt.y);mouse={...pt,worldX:w.x,worldY:w.y};
 if(!pointers.has(ev.pointerId))return;pointers.set(ev.pointerId,{...pt});
 if(pointers.size===2&&pinch){let pp=[...pointers.values()],d=distance(pp[0],pp[1]);setZoom(pinch.zoom*d/Math.max(1,pinch.distance),(pp[0].x+pp[1].x)/2,(pp[0].y+pp[1].y)/2);return;}
 if(!drag)return;let dx=pt.x-drag.start.x,dy=pt.y-drag.start.y;
 if(hypot(dx,dy)>8)drag.moved=true;
 if(drag.moved&&!drag.selecting&&!g.mode){g.cam.x-=(pt.x-drag.last.x)/g.cam.zoom;g.cam.y-=(pt.y-drag.last.y)/g.cam.zoom;limitCam();}
 drag.last=pt;drag.currentX=pt.x;drag.currentY=pt.y;
},{passive:false});
function upPointer(ev){
 if(!g)return;let pt=pointerWorld(ev),wasPinch=!!pinch;pointers.delete(ev.pointerId);
 if(pointers.size<2)pinch=null;
 if(wasPinch){drag=null;return;}
 if(!drag)return;
 if(drag.moved&&drag.selecting){const start=worldAt(drag.start.x,drag.start.y),end=worldAt(pt.x,pt.y);const x0=Math.min(start.x,end.x),x1=Math.max(start.x,end.x),y0=Math.min(start.y,end.y),y1=Math.max(start.y,end.y);
  g.selected=g.units.filter(u=>u.alive&&u.p.id===0&&u.x>=x0&&u.x<=x1&&u.y>=y0&&u.y<=y1);g.selectedBuilding=null;g.uiDirty=true;
 }else if(!drag.moved)onTap(pt.x,pt.y);drag=null;
}
canvas.addEventListener('pointerup',upPointer);canvas.addEventListener('pointercancel',ev=>{pointers.delete(ev.pointerId);drag=null;pinch=null;});
canvas.addEventListener('contextmenu',ev=>ev.preventDefault());
canvas.addEventListener('wheel',ev=>{if(!g)return;ev.preventDefault();let pt=pointerWorld(ev);setZoom(g.cam.zoom*(ev.deltaY>0?.89:1.11),pt.x,pt.y);},{passive:false});
mini.addEventListener('pointerdown',ev=>{if(!g)return;let rect=mini.getBoundingClientRect();let x=(ev.clientX-rect.left)/rect.width*g.world.W,y=(ev.clientY-rect.top)/rect.height*g.world.H;centerCamera(x,y);});
$('panelTabs').addEventListener('click',ev=>{const b=ev.target.closest('button[data-tab]');if(!g||!b)return;g.tab=b.dataset.tab;g.mode=null;g.uiDirty=true;updateUI(true);});
$('actionBar').addEventListener('click',ev=>{
 if(!g||g.paused)return;const button=ev.target.closest('button[data-kind]');if(!button||button.disabled)return;
 const key=button.dataset.key;
 if(button.dataset.kind==='build'){g.tab='build';g.mode=g.mode?.key===key?null:{type:'build',key};g.selected=[];g.selectedBuilding=null;g.uiDirty=true;
  if(g.mode)notify(key==='mine'?'المصفاة: المس البلورات الصفراء قرب قاعدتك':'المس موقعاً فارغاً قرب قاعدتك');
 }else if(buyUnit(key,g.players[0])){notify('أُضيفت '+(key==='special'?FACTIONS[g.players[0].faction].special:TYPES[key].name)+' إلى قائمة الإنتاج');}
 updateUI(true);
});
function togglePause(v){if(!g||g.over)return;g.paused=v;$('pauseOverlay').classList.toggle('hidden',!v);$('pauseBtn').textContent=v?'▶':'Ⅱ';}
$('pauseBtn').onclick=()=>g&&togglePause(!g.paused);$('resumeBtn').onclick=()=>togglePause(false);
$('exitBtn').onclick=()=>{if(g)g.paused=true;g=null;$('pauseOverlay').classList.add('hidden');$('hud').classList.add('hidden');$('startScreen').classList.remove('hidden');};
$('selectArmy').onclick=()=>{if(!g||g.paused)return;g.selected=g.units.filter(u=>u.alive&&u.p.id===0);g.selectedBuilding=null;g.mode=null;g.uiDirty=true;updateUI(true);notify(g.selected.length?'تم تحديد '+g.selected.length+' وحدة':'أنتج وحدات أولاً');};
$('attackMove').onclick=()=>{if(!g||g.paused)return;g.attackMove=!g.attackMove;g.uiDirty=true;notify(g.attackMove?'الأوامر الآن هجوم أثناء الحركة':'الأوامر الآن تحرك عادي');};
$('zoomIn').onclick=()=>g&&setZoom(g.cam.zoom*1.22);
$('zoomOut').onclick=()=>g&&setZoom(g.cam.zoom/1.22);
$('centerBase').onclick=()=>g&&g.players[0].hq&&centerCamera(g.players[0].hq.x,g.players[0].hq.y);
$('cancelMode').onclick=()=>{if(!g)return;g.mode=null;g.uiDirty=true;updateUI(true);};
$('restartBtn').onclick=()=>{g=null;$('endScreen').classList.add('hidden');$('startScreen').classList.remove('hidden');};
for(const [container,key,attr] of [['mapChoices','map','map'],['factionChoices','faction','faction'],['difficultyChoices','diff','diff']]){
 $(container).addEventListener('click',ev=>{const b=ev.target.closest('button[data-'+attr+']');if(!b)return;choice[key]=b.dataset[attr];for(const c of $(container).children)c.classList.toggle('active',c===b);});
}
$('startBtn').onclick=()=>newGame();
window.addEventListener('resize',resizeCanvas);
window.addEventListener('keydown',ev=>{
 if(!g)return;
 if(ev.key==='Escape'){if(g.mode){g.mode=null;g.uiDirty=true;}else togglePause(!g.paused);}
 if(ev.key==='a'||ev.key==='A')$('selectArmy').click();
 if(ev.key==='q'||ev.key==='Q')$('attackMove').click();
});
document.addEventListener('visibilitychange',()=>{if(g&&!document.hidden)lastFrame=performance.now();if(g&&document.hidden&&!g.over){g.paused=true;$('pauseOverlay').classList.remove('hidden');}});
resizeCanvas();raf=requestAnimationFrame(frame);
window.__zeroFrontier={get game(){return g;},start:(map='duel',diff='normal',faction='alliance')=>{choice={map,diff,faction};newGame();},buyBuilding:(t,x,y)=>g&&buyBuilding(t,g.players[0],x,y),buyUnit:(t)=>g&&buyUnit(t,g.players[0]),tick:(dt)=>g&&tick(dt),mapNames:Object.keys(MAPS),stats:()=>g&&({units:g.units.length,buildings:g.buildings.length,players:g.players.length,time:g.time,canvas:[canvas.width,canvas.height]})};
})();

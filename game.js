/* GENERAL ZERO MOBILE v3 — original responsive RTS. No external dependencies. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const canvas=$('gameCanvas');let ctx=canvas.getContext('2d',{alpha:false});
const mini=$('minimap'), mc=mini.getContext('2d');
const TAU=Math.PI*2, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y), hypot=(x,y)=>Math.hypot(x,y);
const rand=(a,b)=>a+Math.random()*(b-a);
const fmt=n=>Math.floor(n).toLocaleString('en-US');
const COLORS={friendly:'#56d5b3',enemy:'#f18a76',neutral:'#e4c47e'};
const GAME_VERSION='3.0.0';
// Every role has a purpose: scouts reveal, infantry counters infantry, rockets counter armour,
// tanks survive direct fire, and artillery breaks entrenched buildings.
const DAMAGE_TABLE={
 infantry:{infantry:1.65,vehicle:.42,air:.25,building:.54},
 rocket:{infantry:.70,vehicle:1.85,air:1.60,building:1.4},
 scout:{infantry:1.14,vehicle:.50,air:.28,building:.45},
 tank:{infantry:.75,vehicle:1.3,air:.12,building:.94},
 artillery:{infantry:1.08,vehicle:.90,air:.08,building:1.8},
 special:{infantry:1.05,vehicle:1.28,air:.45,building:1.25},
 gunship:{infantry:1.55,vehicle:1.23,air:.85,building:.72},
 turret:{infantry:1.05,vehicle:1.0,air:1.28,building:.5}
};
const VISION={infantry:285,rocket:300,scout:465,tank:340,artillery:330,special:410,gunship:570,hq:480,barracks:300,factory:330,mine:240,turret:420,airfield:360};
const COMBAT_CAP=28;let audioEnabled=true,audioContext=null,lastAudio=0;
function sound(effect,x,y){
 if(!audioEnabled || !window.AudioContext && !window.webkitAudioContext)return;
 if(g&&x!==undefined && !isVisible(x,y,260))return;
 const now=performance.now();if(now-lastAudio<(effect==='shoot'?95:70))return;lastAudio=now;
 try{
  audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();
  if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
  const ac=audioContext,t=ac.currentTime,osc=ac.createOscillator(),gain=ac.createGain();
  const settings={shoot:[145,75,.035,.016,'triangle'],cannon:[85,33,.095,.044,'sawtooth'],blast:[68,28,.24,.065,'sawtooth'],click:[660,440,.07,.014,'sine'],capture:[480,780,.24,.033,'sine']};
  const [a,b,d,v,w]=settings[effect]||settings.click;
  osc.type=w;osc.frequency.setValueAtTime(a,t);osc.frequency.exponentialRampToValueAtTime(b,t+d);
  gain.gain.setValueAtTime(v,t);gain.gain.exponentialRampToValueAtTime(.0001,t+d);
  osc.connect(gain);gain.connect(ac.destination);osc.start(t);osc.stop(t+d+.01);
 }catch(e){audioEnabled=false;}
}

const TYPES={
 infantry:{name:'مشاة',glyph:'♟',cost:95,needs:'barracks',time:2.5,hp:96,dmg:12,range:155,speed:92,fire:.84,r:11,kind:'infantry'},
 rocket:{name:'قاذف',glyph:'↟',cost:165,needs:'barracks',time:4,hp:78,dmg:28,range:235,speed:76,fire:1.9,r:11,splash:30,kind:'infantry'},
 scout:{name:'استطلاع',glyph:'◇',cost:195,needs:'factory',time:4,hp:160,dmg:10,range:150,speed:151,fire:.60,r:16,kind:'vehicle'},
 tank:{name:'دبابة',glyph:'▣',cost:365,needs:'factory',time:7,hp:420,dmg:43,range:210,speed:70,fire:1.55,r:22,kind:'vehicle'},
 artillery:{name:'مدفعية',glyph:'✹',cost:470,needs:'factory',time:9,hp:220,dmg:67,range:340,speed:51,fire:3.3,r:21,splash:57,kind:'vehicle'},
 special:{name:'نخبة',glyph:'✦',cost:565,needs:'factory',time:10,hp:500,dmg:49,range:245,speed:90,fire:1.45,r:23,kind:'vehicle'},
 gunship:{name:'مروحية هجومية',glyph:'✈',cost:640,needs:'airfield',time:11,hp:255,dmg:33,range:260,speed:168,fire:1.15,r:24,splash:24,kind:'air'}
};
const BUILDINGS={
 barracks:{name:'ثكنة',glyph:'⌂',cost:290,hp:710,r:39,buildTime:2.3},
 factory:{name:'مصنع',glyph:'▤',cost:510,hp:1040,r:48,buildTime:4.0},
 mine:{name:'مصفاة',glyph:'◈',cost:250,hp:550,r:35,buildTime:2.4,income:20},
 turret:{name:'برج دفاع',glyph:'⌖',cost:335,hp:610,r:27,buildTime:3.5,dmg:29,range:270,fire:1.15},
 airfield:{name:'مهبط المروحيات',glyph:'✈',cost:675,hp:880,r:55,buildTime:5.7}
};
const UPGRADES={
 weapons:{name:'ذخيرة محسّنة',glyph:'⌁',cost:720,desc:'قوة الهجوم +20%',requires:'factory'},
 armor:{name:'دروع مركبة',glyph:'⬡',cost:680,desc:'التحمل +25%',requires:'factory'},
 engines:{name:'محركات مطوّرة',glyph:'⇢',cost:520,desc:'السرعة +17%',requires:'factory'}
};
const ABILITIES={
 bombard:{name:'قصف تكتيكي',glyph:'✹',cost:450,cooldown:60,desc:'حدّد موقع القصف على الخريطة'},
 reinforce:{name:'إمداد سريع',glyph:'✚',cost:410,cooldown:70,desc:'استدعاء تعزيزات للمقر'}
};
const FACTIONS={
 alliance:{name:'التحالف',color:'#64c2e5',speed:1.08,hp:1,dmg:1,special:'مدرعة الشبح',description:'تفوق في الاستطلاع والمروحيات، وعمليات سريعة دقيقة.'},
 legion:{name:'الفيلق',color:'#e3bc66',speed:.94,hp:1.15,dmg:1.06,special:'الدبابة العملاقة',description:'مدرعات ثقيلة وتحمل مرتفع، مثالي للحصار والدفاع.'},
 rebels:{name:'المقاومة',color:'#c2a2d6',speed:1.12,hp:.94,dmg:1.1,special:'راجمة الصقور',description:'وحدات خفيفة رخيصة وصواريخ مؤثرة والهجوم المباغت.'}
};
function costOf(p,type,isBuilding=false){
 const base=isBuilding?BUILDINGS[type]?.cost:TYPES[type]?.cost;if(base==null)return Infinity;
 if(p.faction==='alliance'&&!isBuilding&&['scout','gunship'].includes(type))return Math.round(base*.83);
 if(p.faction==='legion'&&!isBuilding&&['tank','special'].includes(type))return Math.round(base*.86);
 if(p.faction==='rebels'&&!isBuilding&&['infantry','rocket'].includes(type))return Math.round(base*.80);
 if(p.faction==='rebels'&&isBuilding&&type==='barracks')return Math.round(base*.87);
 return base;
}

const MAPS={
 duel:{name:'وادي الرماد',size:[1860,1130],n:1,ground:'#847259',shade:'#a28b65',theme:'desert'},
 squads:{name:'حدود الحديد',size:[2420,1380],n:2,ground:'#62766b',shade:'#84907c',theme:'hills'},
 war:{name:'العاصفة الكبرى',size:[3320,1690],n:4,ground:'#737b72',shade:'#9c9c84',theme:'plateau'}
};
let choice={map:'duel',faction:'alliance',diff:'normal'};
let g=null,lastFrame=performance.now(),raf=0,simAccumulator=0,uiTimer=0, notificationUntil=0,mouse={x:0,y:0,worldX:0,worldY:0}, drag=null,pointers=new Map(),pinch=null, uid=1;
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
 const loci=map.n===1?[[.50,.38],[.50,.62]]:map.n===2?[[.49,.35],[.51,.67],[.50,.50]]:[[.38,.5],[.62,.5],[.5,.23],[.5,.77]];
 const outposts=loci.map(([x,y],index)=>({id:index,x:x*W,y:y*H,r:75,pressure:0,owner:-1,contested:false,glow:r()*TAU}));
 const props=[],centers=getStartPositions(map),home=[...centers.left,...centers.right];
 const maxProps=map.n===1?38:map.n===2?55:80;
 for(let tries=0;props.length<maxProps&&tries<maxProps*19;tries++){
  const x=(.08+.84*r())*W,y=(.08+.84*r())*H;
  if(home.some(h=>hypot(x-h.x,y-h.y)<225)||nodes.some(o=>hypot(x-o.x,y-o.y)<95)||outposts.some(o=>hypot(x-o.x,y-o.y)<120)||rocks.some(o=>hypot(x-o.x,y-o.y)<o.r+55))continue;
  if(props.some(o=>hypot(x-o.x,y-o.y)<50))continue;
  const v=r(),kind=v<.20?'ruin':v<.43?'container':v<.61?'barricade':v<.8?'tower':'wreck';
  const prop={x,y,kind,angle:(r()-.5)*.3,r:kind==='ruin'?29:kind==='container'?24:13};props.push(prop);
  if(kind==='ruin')rocks.push({x,y,r:28,prop:true});
 }
 return {W,H,deco,rocks,nodes,outposts,props,theme:map.theme,ground:map.ground,shade:map.shade,name:map.name};
}
function getStartPositions(map){
 let ys=map.n===1?[.5]:map.n===2?[.34,.71]:[.13,.375,.635,.875];
 return {left:ys.map(y=>({x:map.size[0]*.105,y:map.size[1]*y})),right:ys.map(y=>({x:map.size[0]*.895,y:map.size[1]*y}))};
}
function newGame(){
 uid=1;simAccumulator=0; const m=MAPS[choice.map], world=tileMap(m), pos=getStartPositions(m);
 const players=[];
 for(let i=0;i<m.n*2;i++){
  let team=i<m.n?0:1,loc=team?pos.right[i-m.n]:pos.left[i];
  let faction=i===0?choice.faction:Object.keys(FACTIONS)[(i+(team?1:0))%3];
  players.push({id:i,team,faction,ai:i!==0,money:i===0?1940:1400,hq:null,start:{...loc},think:rand(.8,2),wave:0,losses:0,upgrades:{},rally:null});
 }
 g={world,players,units:[],buildings:[],projectiles:[],particles:[],decals:[],selected:[],selectedBuilding:null,mode:null,tab:'build',attackMove:false,selectionMode:false,cam:{x:0,y:0,zoom:1},time:0,paused:false,over:false,uiDirty:true,spawned:0,destroyed:0,diff:choice.diff,command:{bombard:0,reinforce:0},strikes:[],lastUiSecond:-1,outpostTimer:0,fogTimer:0,fog:null,kills:0,terrainCached:false,missionStage:0};
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
 resizeCanvas();
 initFog();cacheStaticTerrain();
 const viewport=size();g.cam.zoom=viewport.h>viewport.w?.90:1;
 $('versionSmall').textContent='3.0';
 if($('mapName'))$('mapName').textContent=m.name;
 if($('soundBtn'))$('soundBtn').textContent=audioEnabled?'♫':'♪';
 centerCamera(players[0].start.x+Math.min(155,viewport.w*.18),players[0].start.y);updateUI(true);
 $('startScreen').classList.add('hidden');$('endScreen').classList.add('hidden');$('hud').classList.remove('hidden');$('pauseOverlay').classList.add('hidden');
 notify('ابنِ مصفاة قرب بلورات الموارد، ثم جهّز جيشك!');
 /* Landscape and portrait are both first-class play modes. */
}
function createBuilding(type,p,x,y,instant=false){
 const def=type==='hq'?{hp:1700,r:58,name:'المقر الرئيسي'}:BUILDINGS[type];
 let b={id:uid++,type,p,x,y,hp:def.hp,max:def.hp,r:def.r,alive:true,complete:instant?1:0,buildTime:def.buildTime||1,queue:[],cool:0,linkedNode:null,rally:null,repairing:false};
 g.buildings.push(b);
 if(type==='mine'){
  let n=g.world.nodes.find(v=>hypot(x-v.x,y-v.y)<85 && (!v.mine||!v.mine.alive));
  if(n){n.mine=b;b.linkedNode=n;}
 }
 g.uiDirty=true;return b;
}
function createUnit(type,p,x,y,instant=false){
 const d=TYPES[type],f=FACTIONS[p.faction],scale=type==='special'?(p.faction==='legion'?1.15:1):1;
 let hp=Math.round(d.hp*f.hp*scale*(p.upgrades.armor?1.25:1));
 if(type==='special'&&p.faction==='legion')hp=Math.round(hp*1.5);
 if(type==='special'&&p.faction==='rebels')hp=Math.round(hp*.72);
 const u={id:uid++,type,p,x,y,hp,max:hp,dmg:d.dmg*f.dmg*(p.upgrades.weapons?1.2:1)*(type==='special'&&p.faction==='rebels'?1.24:1),range:d.range,speed:d.speed*f.speed*(p.upgrades.engines?1.17:1)*(type==='special'&&p.faction==='alliance'?1.20:1),fire:d.fire,r:d.r*(type==='special'&&p.faction==='legion'?1.2:1),alive:true,theta:p.team?Math.PI:0,gun:0,cool:rand(.05,.4),target:null,goal:null,path:[],order:'guard',spawnTime:g.time,stuck:0,tracks:0,kills:0,rank:0,fireAngle:0};
 if(type==='special'){
  if(p.faction==='alliance'){u.speed*=1.38;u.range+=55;u.hp=Math.round(u.hp*.85);u.max=u.hp;}
  if(p.faction==='legion'){u.speed*=.78;u.dmg*=1.35;u.r*=1.22;u.range+=35;}
  if(p.faction==='rebels'){u.speed*=1.3;u.fire*=.86;u.dmg*=1.15;u.splash=60;}
 }
 g.units.push(u);g.spawned++;g.uiDirty=true;return u;
}
function incomeOf(p){let n=0;for(const b of g.buildings){if(b.alive && b.p===p&&b.complete>=1){if(b.type==='hq')n+=8;if(b.type==='mine'&&b.linkedNode)n+=16;}}
 n+=g.world.outposts.filter(o=>o.owner===p.team).length*7/Math.max(1,g.players.filter(v=>v.team===p.team&&v.hq?.alive).length);
 return n;
}
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
function buyBuilding(type,p,x,y){let def=BUILDINGS[type];const cost=costOf(p,type,true);if(!def||p.money<cost||!canPlace(p,type,x,y))return false;
 p.money-=cost;createBuilding(type,p,x,y);g.uiDirty=true;return true;
}
function manageBuilding(p,action){
 const b=g?.selectedBuilding;if(!b||!b.alive||b.p!==p||b.type==='hq')return false;
 if(action==='repair'){
  if(b.hp>=b.max){notify('المبنى سليم بالكامل');return false;}
  if(p.money<20){notify('تحتاج موارد للإصلاح');return false;}
  b.repairing=!b.repairing;notify(b.repairing?'بدأت فرق الصيانة إصلاح المبنى':'توقفت أعمال الصيانة');
 }else if(action==='sell'){
  const value=Math.floor((BUILDINGS[b.type]?.cost||0)*.50*(b.hp/b.max));
  p.money+=value;b.alive=false;b.hp=0;b.repairing=false;
  if(b.linkedNode)b.linkedNode.mine=null;
  g.selectedBuilding=null;notify('تم بيع المنشأة واسترجاع '+value+' رصيد');
 }else return false;
 g.uiDirty=true;return true;
}
function buyUnit(type,p,quiet=false){const def=TYPES[type];if(!def)return false;
 if(p.money<costOf(p,type)){if(!quiet)notify('الرصيد غير كافٍ');return false;}
 if(g.units.filter(u=>u.alive&&u.p===p).length+g.buildings.reduce((sum,b)=>sum+(b.alive&&b.p===p?b.queue.length:0),0)>=COMBAT_CAP){if(!quiet)notify('بلغت الحد الأقصى لقوات هذا الجيش');return false;}
 let options=buildingsOf(p,def.needs).filter(b=>b.queue.length<4).sort((a,b)=>a.queue.length-b.queue.length);
 if(!options.length){if(!quiet)notify(def.needs==='barracks'?'ابنِ ثكنة لتدريب المشاة':def.needs==='airfield'?'ابنِ مهبطاً للمروحيات':'ابنِ مصنعاً لإنتاج الآليات');return false;}
 p.money-=costOf(p,type);options[0].queue.push({type,remain:def.time,total:def.time});g.uiDirty=true;return true;
}
function buyUpgrade(key,p,quiet=false){
 const d=UPGRADES[key];if(!d||p.upgrades[key]||p.money<d.cost||!buildingsOf(p,d.requires).length)return false;
 p.money-=d.cost;p.upgrades[key]=true;
 for(const u of g.units){if(!u.alive||u.p!==p)continue;
  if(key==='weapons')u.dmg*=1.2;
  if(key==='engines')u.speed*=1.17;
  if(key==='armor'){const old=u.max;u.max=Math.round(u.max*1.25);u.hp+=u.max-old;}
 }
 if(!quiet)notify('اكتمل تطوير: '+d.name);
 g.uiDirty=true;return true;
}
function buyAbility(key,p){
 const def=ABILITIES[key];if(!def||p.money<def.cost||g.command[key]>0)return false;
 if(key==='bombard'){g.mode={type:'ability',key};notify('المس نقطة القصف على الخريطة');g.uiDirty=true;return true;}
 if(key==='reinforce'){
  if(!p.hq?.alive)return false;
  const present=g.units.filter(u=>u.alive&&u.p===p).length;
  if(present+5>28){notify('لا توجد مساحة كافية في جيشك');return false;}
  p.money-=def.cost;g.command[key]=def.cooldown;
  for(let i=0;i<4;i++)createUnit('infantry',p,p.hq.x+96+i*8,p.hq.y-48+i*24,true);
  createUnit('scout',p,p.hq.x+143,p.hq.y+3,true);
  spawnPing(p.hq.x+100,p.hq.y,'#84e9d4');notify('وصلت التعزيزات إلى القاعدة');g.uiDirty=true;return true;
 }
 return false;
}
function callBombard(p,x,y){
 const d=ABILITIES.bombard;if(p.money<d.cost||g.command.bombard>0)return false;
 p.money-=d.cost;g.command.bombard=d.cooldown;
 g.strikes.push({x,y,delay:.6,remaining:6,elapsed:0});
 g.mode=null;g.uiDirty=true;notify('تم تأكيد الإحداثيات، القصف قادم!');return true;
}
function tickStrikes(dt){
 for(let i=g.strikes.length-1;i>=0;i--){const strike=g.strikes[i];strike.delay-=dt;
  if(strike.delay>0)continue;
  const a=strike.remaining*2.4,tx=strike.x+Math.cos(a)*rand(6,67),ty=strike.y+Math.sin(a)*rand(5,66);
  g.particles.push({x:tx,y:ty,vx:0,vy:0,life:.5,max:.5,color:'#fff0b0',size:27,blast:true});
  g.particles.push({x:tx,y:ty,vx:0,vy:-27,life:.65,max:.65,color:'#465452',size:37,smoke:true});
  for(const e of [...g.units,...g.buildings])if(e.alive&&e.p.team!==0){const d=hypot(e.x-tx,e.y-ty);if(d<89+e.r)damage(e,Math.max(12,103*(1-d/(100+e.r)*.66)),g.players[0]);}
  strike.delay=.20;strike.remaining--;if(!strike.remaining)g.strikes.splice(i,1);
 }
 for(const key of Object.keys(g.command))g.command[key]=Math.max(0,g.command[key]-dt);
}
function isBlocked(x,y,r=12){return g.world.rocks.some(o=>hypot(x-o.x,y-o.y)<o.r+r+6);}
const CELL=66;
function navGrid(){
 const world=g.world;
 if(world.nav)return world.nav;
 const cols=Math.ceil(world.W/CELL),rows=Math.ceil(world.H/CELL),blocked=new Uint8Array(cols*rows);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  if(world.rocks.some(r=>hypot((x+.5)*CELL-r.x,(y+.5)*CELL-r.y)<r.r+29))blocked[y*cols+x]=1;
 }
 world.nav={cols,rows,blocked};return world.nav;
}
// Binary heap avoids scanning the entire open set on every A* step.
function heapPush(heap,item){let i=heap.length;heap.push(item);while(i>0){let p=(i-1)>>1;if(heap[p].f<=item.f)break;heap[i]=heap[p];i=p;}heap[i]=item;}
function heapPop(heap){const result=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return result;}
function pathfind(sx,sy,tx,ty){
 const {cols,rows,blocked:grid}=navGrid();
 const x0=clamp(Math.floor(sx/CELL),0,cols-1),y0=clamp(Math.floor(sy/CELL),0,rows-1);
 let x1=clamp(Math.floor(tx/CELL),0,cols-1),y1=clamp(Math.floor(ty/CELL),0,rows-1);
 const blocked=(x,y)=>x<0||y<0||x>=cols||y>=rows||!!grid[y*cols+x];
 if(blocked(x1,y1)){
  let found=false;for(let radius=1;radius<=5&&!found;radius++)for(let dy=-radius;dy<=radius&&!found;dy++)for(let dx=-radius;dx<=radius&&!found;dx++){
   if(!blocked(x1+dx,y1+dy)){x1+=dx;y1+=dy;found=true;}
  }
 }
 const start=y0*cols+x0,end=y1*cols+x1;
 if(start===end)return [{x:tx,y:ty}];
 const scores=new Float64Array(cols*rows).fill(Infinity),parents=new Int32Array(cols*rows).fill(-1),visited=new Uint8Array(cols*rows);
 const heap=[];scores[start]=0;heapPush(heap,{id:start,f:0});
 let checks=0,found=false;
 while(heap.length&&checks++<cols*rows*2){
  const here=heapPop(heap).id;if(visited[here])continue;visited[here]=1;
  if(here===end){found=true;break;}
  const cx=here%cols,cy=Math.floor(here/cols);
  for(const [dx,dy,c] of [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[-1,1,1.414],[1,-1,1.414],[-1,-1,1.414]]){
   const nx=cx+dx,ny=cy+dy;if(blocked(nx,ny))continue;
   if(dx&&dy&&(blocked(cx+dx,cy)||blocked(cx,cy+dy)))continue;
   const id=ny*cols+nx,ng=scores[here]+c;
   if(ng<scores[id]){scores[id]=ng;parents[id]=here;heapPush(heap,{id,f:ng+Math.hypot(nx-x1,ny-y1)});}
  }
 }
 if(!found)return [{x:tx,y:ty}];
 const pts=[];let cur=end,lim=0;
 while(cur!==start&&cur!==-1&&lim++<300){pts.push({x:(cur%cols+.5)*CELL,y:(Math.floor(cur/cols)+.5)*CELL});cur=parents[cur];}
 pts.reverse();pts.push({x:tx,y:ty});
 const out=[];let anchor={x:sx,y:sy};for(let i=0;i<pts.length;){let last=i;for(let j=i+1;j<pts.length;j++)if(clearLine(anchor,pts[j]))last=j;else break;out.push(pts[last]);anchor=pts[last];i=last+1;}
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
function issueTacticalOrder(type){
 if(!g||g.paused)return false;
 const units=g.selected.filter(u=>u.alive&&u.p.id===0);if(!units.length){notify('حدد وحداتك أولاً');return false;}
 if(type==='hold'){
  for(const u of units){u.order='hold';u.target=null;u.goal=null;u.path=[];}
  notify('تثبيت المواقع: الوحدات تهاجم من مواقعها دون مطاردة');
 }else if(type==='retreat'){
  const base=g.players[0].hq;if(!base?.alive)return false;
  assignOrder(units,base.x+110,base.y,false);notify('أمر انسحاب إلى المقر');
 }else if(type==='scatter'){
  const center={x:units.reduce((a,u)=>a+u.x,0)/units.length,y:units.reduce((a,u)=>a+u.y,0)/units.length};
  for(let i=0;i<units.length;i++){
   const a=i*2.39996,r=70+Math.sqrt(i)*30,u=units[i];
   const tx=clamp(center.x+Math.cos(a)*r,25,g.world.W-25),ty=clamp(center.y+Math.sin(a)*r,25,g.world.H-25);
   u.goal={x:tx,y:ty};u.path=pathfind(u.x,u.y,tx,ty);u.order='move';u.target=null;
  }
  notify('انتشار تكتيكي: القوات تتفرق لتجنب القصف');
 }else return false;
 sound('click');g.uiDirty=true;return true;
}
function spawnPing(x,y,color){for(let i=0;i<9;i++)g.particles.push({x,y,vx:Math.cos(i*TAU/9)*80,vy:Math.sin(i*TAU/9)*80,life:.45,max:.45,color,size:3});}
function damage(ent,amount,source){if(!ent.alive)return;
 ent.hp-=Math.max(0,amount);
 // Being attacked creates an emergency for an AI; a rally/retreat becomes possible.
 if(ent.p?.ai&&ent.p.hq?.alive&&ent.p===ent.p.hq.p)ent.p.lastThreat={x:ent.x,y:ent.y,time:g.time};
 if(ent.hp<=0){ent.alive=false;let r=ent.r;
  if(source && source.type && !source.queue && source.p && source.p!==ent.p){
   source.kills=(source.kills||0)+1;
   const rank=source.kills>=8?2:source.kills>=3?1:0;
   if(rank>source.rank){source.rank=rank;source.max=Math.round(source.max*1.16);source.hp=Math.min(source.max,source.hp+Math.round(source.max*.28));source.dmg*=1.13;
    g.particles.push({x:source.x,y:source.y-18,vx:0,vy:-25,life:1,max:1,color:'#f5e7a0',size:9});
   }
  }
  if(ent.p.team===1)g.kills++;
  g.decals.push({x:ent.x,y:ent.y,r:Math.min(48,r*.83),age:0,ttl:135});
  if(g.decals.length>170)g.decals.shift();
  sound(ent.queue||r>20?'blast':'cannon',ent.x,ent.y);for(let k=0;k<(ent.type==='hq'?38:ent.queue?16:8);k++){
  let angle=rand(0,TAU),spd=rand(20,190);g.particles.push({x:ent.x,y:ent.y,vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd,life:rand(.35,.95),max:1,color:Math.random()<.55?'#f8b76b':'#535456',size:rand(3,r*.30)});
 }if(ent.type==='hq'&&ent.p.hq===ent){ent.p.hq=null;notify(ent.p.team===0?'خسر حليف لنا مقره الرئيسي!':'دُمّر مقر أحد الأعداء!');}
 if(ent.p.team===1)g.destroyed++;
 g.uiDirty=true;
 }}
function closestEnemy(ent,radius){
 let best=null,score=Infinity;
 const table=DAMAGE_TABLE[ent.type]||DAMAGE_TABLE.turret;
 for(const item of [g.units,g.buildings])for(const target of item){
  if(!target.alive||target.p.team===ent.p.team)continue;
  if(target.type==='gunship'&&!['rocket','infantry','turret','gunship'].includes(ent.type))continue;
  const d=distance(target,ent)-target.r;if(d>=radius)continue;
  const armour=target.queue?'building':(TYPES[target.type]?.kind||'building');
  let priority=table[armour]||1;
  let rating=d+45/Math.max(.3,priority)-Math.min(110,priority*35);
  if(target.target===ent)rating-=28;
  if(rating<score){score=rating;best=target;}
 }
 return best;
}
function fireProjectile(from,target,dmg,splash=0){
 if(!target.alive)return;
 const armour=target.queue?'building':(TYPES[target.type]?.kind||'building');
 dmg*=DAMAGE_TABLE[from.type]?.[armour]||1;
 sound(from.type==='artillery'||from.type==='tank'||from.type==='special'?'cannon':'shoot',from.x,from.y);
 g.projectiles.push({x:from.x,y:from.y,vx:0,vy:0,target,team:from.p.team,source:from,damage:dmg,splash,speed:from.type==='artillery'?410:from.type==='rocket'?510:750,alive:true,life:2.3,color:from.p.team?'#ffaa74':'#9dffe0'});
}
function tickUnits(dt){
 for(const u of g.units){if(!u.alive)continue;
  u.cool-=dt;
  if(u.target&&!u.target.alive)u.target=null;
  let enemy=closestEnemy(u,u.range+185);
  let target=u.target && u.target.alive?u.target:enemy;
  if(target){let d=distance(u,target);if(d<=u.range+target.r){
    if(u.cool<=0){fireProjectile(u,target,u.dmg,u.splash||TYPES[u.type].splash||0);u.cool=u.fire;u.gun=.16;}
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
 // Spatial hashing avoids a quadratic cost on the large 4v4 battlefield.
 const grid=new Map(),cell=68;
 for(const unit of g.units){if(!unit.alive)continue;
  const k=(Math.floor(unit.x/cell))+','+(Math.floor(unit.y/cell));
  if(!grid.has(k))grid.set(k,[]);grid.get(k).push(unit);
 }
 for(const a of g.units){if(!a.alive)continue;
  const cx=Math.floor(a.x/cell),cy=Math.floor(a.y/cell);
  for(let xx=cx-1;xx<=cx+1;xx++)for(let yy=cy-1;yy<=cy+1;yy++){
   for(const b of grid.get(xx+','+yy)||[]){if(!b.alive||a.id>=b.id||Math.abs(a.x-b.x)>50||Math.abs(a.y-b.y)>50)continue;
    const d=distance(a,b)||.1,min=(a.r+b.r)*.86;
    if(d<min){let push=(min-d)*.22,dx=(a.x-b.x)/d,dy=(a.y-b.y)/d;
     a.x+=dx*push;a.y+=dy*push;b.x-=dx*push;b.y-=dy*push;
    }
   }
  }
 }
}
function moveTowards(u,x,y,dt){
 let dx=x-u.x,dy=y-u.y,d=hypot(dx,dy);if(d<1)return;
 let step=Math.min(u.speed*dt,d),nx=u.x+dx/d*step,ny=u.y+dy/d*step;
 if(u.type!=='gunship'&&isBlocked(nx,ny,u.r*.6)){
  let left={x:u.x-dy/d*step,y:u.y+dx/d*step};let right={x:u.x+dy/d*step,y:u.y-dx/d*step};
  if(!isBlocked(left.x,left.y,u.r*.6)){nx=left.x;ny=left.y;}
  else if(!isBlocked(right.x,right.y,u.r*.6)){nx=right.x;ny=right.y;}
  else {u.stuck+=dt;if(u.stuck>.7&&u.goal){u.path=pathfind(u.x,u.y,u.goal.x,u.goal.y);u.stuck=0;}return;}
 }
 u.tracks=(u.tracks||0)+(u.type==='gunship'?0:step);u.x=clamp(nx,u.r,g.world.W-u.r);u.y=clamp(ny,u.r,g.world.H-u.r);u.theta=Math.atan2(dy,dx);u.stuck=0;
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
  if(b.repairing&&b.hp<b.max&&b.p.money>1){const restore=Math.min(b.max-b.hp,dt*64,b.p.money*3);
    b.hp+=restore;b.p.money-=restore/3;
    if(b.hp>=b.max-.1){b.hp=b.max;b.repairing=false;g.uiDirty=true;}
  }
  if(b.complete<1){b.complete=Math.min(1,b.complete+dt/b.buildTime);if(b.complete>=1)g.uiDirty=true;continue;}
  if(b.p.ai&&b.hp<b.max*.74&&b.p.money>180&&!b.repairing)b.repairing=true;
  if(b.type==='turret'){
   b.cool-=dt;if(b.cool<=0){let e=closestEnemy(b,BUILDINGS.turret.range);if(e){fireProjectile(b,e,BUILDINGS.turret.dmg,0);b.cool=BUILDINGS.turret.fire;}}
  }
  if(b.queue.length){let q=b.queue[0];q.remain-=dt;if(q.remain<=0){
    const side=b.p.team?-1:1;let x=b.x+side*(b.r+40),y=b.y+rand(-25,25);
    for(let t=0;t<8&&(isBlocked(x,y,18)||g.buildings.some(a=>a.alive&&distance(a,{x,y})<a.r+20));t++){x=b.x+Math.cos(t*TAU/8)*(b.r+45);y=b.y+Math.sin(t*TAU/8)*(b.r+45);}
    let u=createUnit(q.type,b.p,clamp(x,20,g.world.W-20),clamp(y,20,g.world.H-20));
    if(b.rally&&!b.p.ai){u.goal={...b.rally};u.path=pathfind(u.x,u.y,u.goal.x,u.goal.y);u.order='move';}
    if(b.p.ai){const dest=findStrategicTarget(b.p);if(dest){u.goal={x:dest.x,y:dest.y};u.path=pathfind(u.x,u.y,dest.x,dest.y);u.order='attack';}}
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

const FOG_CELL=55;
function initFog(){
 const w=Math.ceil(g.world.W/FOG_CELL),h=Math.ceil(g.world.H/FOG_CELL);
 const fogCanvas=document.createElement('canvas');fogCanvas.width=w;fogCanvas.height=h;
 g.fog={w,h,seen:new Uint8Array(w*h),visible:new Uint8Array(w*h),canvas:fogCanvas,ctx:fogCanvas.getContext('2d'),revision:0};
 updateFog(true);
}
function updateFog(force=false){
 if(!g?.fog)return;
 const f=g.fog;f.visible.fill(0);
 const reveal=(x,y,r)=>{
  const x0=Math.max(0,Math.floor((x-r)/FOG_CELL)),y0=Math.max(0,Math.floor((y-r)/FOG_CELL)),
  x1=Math.min(f.w-1,Math.floor((x+r)/FOG_CELL)),y1=Math.min(f.h-1,Math.floor((y+r)/FOG_CELL));
  for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++){
   const mx=(xx+.5)*FOG_CELL,my=(yy+.5)*FOG_CELL;if((mx-x)**2+(my-y)**2<r*r){
    const i=yy*f.w+xx;f.seen[i]=1;f.visible[i]=1;
   }
  }
 };
 for(const e of [...g.units,...g.buildings])if(e.alive&&e.p.team===0&&(!e.queue||e.complete>=.9))reveal(e.x,e.y,VISION[e.type]||280);
 for(const o of g.world.outposts)if(o.owner===0)reveal(o.x,o.y,360);
 const im=f.ctx.createImageData(f.w,f.h),d=im.data;
 for(let i=0;i<f.w*f.h;i++){
  const a=i*4;if(f.visible[i])d[a+3]=0;else{
   d[a]=8;d[a+1]=18;d[a+2]=24;d[a+3]=f.seen[i]?105:155;
  }
 }
 f.ctx.putImageData(im,0,0);f.revision++;
}
function isDiscovered(e){if(!g.fog||e.p?.team===0)return true;
 const f=g.fog,xx=Math.floor(e.x/FOG_CELL),yy=Math.floor(e.y/FOG_CELL);
 return xx>=0&&yy>=0&&xx<f.w&&yy<f.h&&!!f.visible[yy*f.w+xx];
}
function tickOutposts(dt){
 for(const o of g.world.outposts){let a=0,b=0;
  for(const u of g.units){if(!u.alive||distance(u,o)>o.r+u.r)continue;
   if(u.p.team===0)a++;else b++;
  }
  const contested=a>0&&b>0;o.contested=contested;
  if(contested||(!a&&!b))continue;
  const target=a>0?1:-1,pressure=target*Math.min(2,1+.20*Math.max(0,(target>0?a:b)-1));
  o.pressure=clamp(o.pressure+pressure*dt/7,-1,1);
  const previous=o.owner;
  o.owner=o.pressure>=.985?0:o.pressure<=-.985?1:-1;
  if(o.owner!==previous){
   g.uiDirty=true;
   if(o.owner===0){spawnPing(o.x,o.y,'#75f4c5');notify('سيطرنا على نقطة إمداد استراتيجية!');sound('capture',o.x,o.y);}
   if(previous===0&&o.owner!==0)notify('فقدنا السيطرة على نقطة استراتيجية!');
  }
 }
}
function findStrategicTarget(p){
 const enemyTeam=p.team===0?1:0;
 const targets=g.world.outposts.filter(o=>o.owner!==p.team);
 const first=targets.sort((a,b)=>distance(a,p.hq)-distance(b,p.hq))[0];
 // Attack neutral/captured outposts during the expansion phase, switch to HQ after map control.
 if(first)return first;
 // Exploration, clashes and map control first — no 50-second AI base-rush that ends the tutorial.
 if(g.time<125){return g.world.outposts.reduce((a,b)=>distance(a,p.hq)<distance(b,p.hq)?a:b);}
 const enemies=g.players.filter(v=>v.team!==p.team&&v.hq?.alive);
 if(!enemies.length)return null;
 return enemies.reduce((a,b)=>distance(a.hq,p.hq)<distance(b.hq,p.hq)?a:b).hq;
}

function tickAI(dt){
 const settings={easy:{speed:1.8,attack:6,ratio:.7},normal:{speed:1.05,attack:5,ratio:1},hard:{speed:.70,attack:4,ratio:1.2}}[g.diff];
 for(const p of g.players){if(!p.ai||!p.hq||!p.hq.alive)continue;
  p.think-=dt;if(p.think>0)continue;p.think=rand(1.1,2.1)*settings.speed;
  const owned=g.units.filter(u=>u.alive&&u.p===p), barracks=buildingsOf(p,'barracks'), factories=buildingsOf(p,'factory'),mines=buildingsOf(p,'mine'),airfields=buildingsOf(p,'airfield');
  const myNodes=g.world.nodes.filter(n=>(!n.mine||!n.mine.alive)&&distance(n,p.hq)<570).sort((a,b)=>distance(a,p.hq)-distance(b,p.hq));
  if(mines.length<2&&myNodes.length&&p.money>BUILDINGS.mine.cost+100){const n=myNodes[0];if(buyBuilding('mine',p,n.x,n.y))continue;}
  if(!barracks.length&&p.money>390){aiBuildNear(p,'barracks',p.hq.x,p.hq.y);continue;}
  if(!factories.length&&p.money>950&&g.time>(g.diff==='hard'?10:20)){aiBuildNear(p,'factory',p.hq.x,p.hq.y);continue;}
  if(g.time>52&&airfields.length<1&&p.money>1600){if(aiBuildNear(p,'airfield',p.hq.x,p.hq.y))continue;}
  if(g.diff==='hard'&&g.time>18&&buildingsOf(p,'turret').length<1&&p.money>750){aiBuildNear(p,'turret',p.hq.x,p.hq.y);continue;}
  if(g.diff==='hard'&&p.money>1350&&factories.length&&g.time>75){const missing=Object.keys(UPGRADES).filter(k=>!p.upgrades[k]);if(missing.length&&buyUpgrade(missing[0],p,true))continue;}
  if(owned.length<23){
   const type=airfields.length&&p.money>1000&&Math.random()<.18?'gunship':factories.length&&p.money>650?(Math.random()<.45?'tank':Math.random()<.25?'special':'scout'):(Math.random()<.27?'rocket':'infantry');
   buyUnit(type,p,true);
   if(settings.ratio>1&&Math.random()<.35)buyUnit('infantry',p,true);
  }
  let ready=owned.filter(u=>u.order==='guard'||u.order==='move'||!u.goal);const targets=g.players.filter(v=>v.team!==p.team&&v.hq&&v.hq.alive);
  if(ready.length>=Math.max(3,settings.attack-2)&&targets.length){
   let dest=findStrategicTarget(p)||targets.reduce((a,b)=>distance(a.hq,p.hq)<distance(b.hq,p.hq)?a:b).hq;
   // Under attack, hold at home and repel the raiders before the next offensive wave.
   if(p.lastThreat&&g.time-p.lastThreat.time<13&&distance(p.lastThreat,p.hq)<420){
     const threat=g.units.filter(u=>u.alive&&u.p.team!==p.team&&distance(u,p.hq)<540)
      .sort((a,b)=>distance(a,p.hq)-distance(b,p.hq))[0];if(threat)dest=threat;
   }
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
 tickAI(dt);tickBuildings(dt);tickUnits(dt);tickProjectiles(dt);tickStrikes(dt);
 tickOutposts(dt);
 g.fogTimer+=dt;if(g.fogTimer>=.30){g.fogTimer=0;updateFog();}
 for(const dec of g.decals)dec.age+=dt;
 if(g.decals.length>150)g.decals.splice(0,g.decals.length-150);
 g.decals=g.decals.filter(d=>d.age<d.ttl);
 if(Math.floor(g.time)!==g.lastUiSecond){g.lastUiSecond=Math.floor(g.time);g.uiDirty=true;}
 for(const part of g.particles){part.x+=part.vx*dt;part.y+=part.vy*dt;part.vx*=1-dt*2;part.vy*=1-dt*2;part.life-=dt;}
 kill(g.particles);kill(g.units);
 // Buildings can be destroyed; preserve their wrecks for a brief visual trace.
 kill(g.buildings);
 g.selected=g.selected.filter(u=>u.alive);if(g.selectedBuilding&&!g.selectedBuilding.alive)g.selectedBuilding=null;
 checkVictory();
}
function formatClock(s){s=Math.floor(s);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function resizeCanvas(){const dpr=Math.min(window.devicePixelRatio||1,(g&&g.players.length>4)?1.25:1.6),w=canvas.clientWidth,h=canvas.clientHeight;
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=true;
 if(g)limitCam();}
function size(){return {w:canvas.clientWidth,h:canvas.clientHeight};}
function limitCam(){if(!g)return;let v=size(),c=g.cam;c.x=clamp(c.x,0,Math.max(0,g.world.W-v.w/c.zoom));c.y=clamp(c.y,0,Math.max(0,g.world.H-v.h/c.zoom));}
function centerCamera(x,y){let v=size();g.cam.x=x-v.w/(2*g.cam.zoom);g.cam.y=y-v.h/(2*g.cam.zoom);limitCam();}
function worldAt(sx,sy){let c=g.cam;return {x:c.x+sx/c.zoom,y:c.y+sy/c.zoom};}
function screenAt(x,y){return {x:(x-g.cam.x)*g.cam.zoom,y:(y-g.cam.y)*g.cam.zoom};}
function setZoom(z,sx,sy){let c=g.cam,v=size();sx=sx??v.w/2;sy=sy??v.h/2;
 const before=worldAt(sx,sy);c.zoom=clamp(z,.52,1.7);c.x=before.x-sx/c.zoom;c.y=before.y-sy/c.zoom;limitCam();}
function isVisible(x,y,r=0){if(g?.terrainCaching)return true;let s=screenAt(x,y),v=size();return s.x>-r-30&&s.y>-r-30&&s.x<v.w+r+30&&s.y<v.h+r+30;}
function cacheStaticTerrain(){
 const world=g.world;
 if(world.static)return;
 // One-time prerender: roads, rock fields and texture should never be repainted at 60 FPS.
 const c=document.createElement('canvas');c.width=world.W;c.height=world.H;
 const live=ctx;ctx=c.getContext('2d',{alpha:false});g.terrainCaching=true;
 try{drawTerrain();}finally{ctx=live;g.terrainCaching=false;}
 world.static=c;g.terrainCached=true;
}
function renderGround(){
 const w=g.world,v=size(),c=g.cam,x=Math.max(0,c.x),y=Math.max(0,c.y),
 sw=Math.min(w.W-x,v.w/c.zoom),sh=Math.min(w.H-y,v.h/c.zoom);
 if(sw>0&&sh>0&&w.static)ctx.drawImage(w.static,x,y,sw,sh,x,y,sw,sh);
 else drawTerrain();
}
function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function initTerrainGraphics(world){
 if(world.tile)return;
 const tex=document.createElement('canvas');tex.width=256;tex.height=256;const t=tex.getContext('2d');
 const sandy=world.theme==='desert',green=world.theme==='hills',r=seeded(world.W+world.H+21);
 const base=sandy?'#837656':green?'#617668':'#687566';
 t.fillStyle=base;t.fillRect(0,0,256,256);
 for(let i=0;i<2350;i++){
  let x=r()*256,y=r()*256,sz=.7+r()*4;
  t.globalAlpha=.024+r()*.072;t.fillStyle=r()>.48?'#eddcaa':'#172924';t.fillRect(x,y,sz,sz*(.55+r()));
 }
 t.globalAlpha=1;
 for(let i=0;i<42;i++){
  let x=r()*256,y=r()*256;
  t.fillStyle=sandy?'#c3ac7940':'#bfd2a429';t.beginPath();t.ellipse(x,y,8+r()*21,2+r()*4,r()*6,0,TAU);t.fill();
 }
 world.tile=ctx.createPattern(tex,'repeat');
 world.features=[];
 for(let i=0;i<190;i++){
  let x=r()*world.W,y=r()*world.H,rad=2+r()*10,kind=r();
  if(world.rocks.some(rock=>hypot(rock.x-x,rock.y-y)<rock.r+40))continue;
  world.features.push({x,y,r:rad,kind,a:r()*TAU});
 }
}
function terrainRoad(path,width){
 ctx.lineCap='round';ctx.lineJoin='round';
 ctx.strokeStyle='#27363062';ctx.lineWidth=width+23;ctx.stroke(path);
 ctx.strokeStyle=g.world.theme==='desert'?'#8d8165':'#728078';ctx.lineWidth=width+8;ctx.stroke(path);
 ctx.strokeStyle=g.world.theme==='desert'?'#a49572':'#87928a';ctx.lineWidth=width;ctx.stroke(path);
 ctx.strokeStyle='#3d474237';ctx.lineWidth=3;ctx.stroke(path);
 ctx.setLineDash([25,31]);ctx.strokeStyle='#ded4ac52';ctx.lineWidth=2;ctx.stroke(path);ctx.setLineDash([]);
}
function drawTerrain(){
 const world=g.world,w=world.W,h=world.H,c=g.cam,v=size();initTerrainGraphics(world);
 ctx.fillStyle=world.tile;ctx.fillRect(0,0,w,h);
 const left=c.x,top=c.y,right=left+v.w/c.zoom,bottom=top+v.h/c.zoom;
 // Deep landscape bands add depth to the lightweight overhead view.
 for(let i=0;i<7;i++){
  ctx.fillStyle=i%2?'#31453b0e':'#edcc9810';ctx.beginPath();
  const y=h*(i+1)/8;ctx.moveTo(0,y);ctx.bezierCurveTo(w*.32,y-90,w*.67,y+80,w,y-18);ctx.lineTo(w,y+35);ctx.bezierCurveTo(w*.67,y+125,w*.31,y-43,0,y+45);ctx.fill();
 }
 // A real road network, readable across all three maps.
 const tracks=world.theme==='desert'?[.29,.71]:world.theme==='hills'?[.24,.5,.78]:[.17,.36,.63,.85];
 for(const [i,vv] of tracks.entries()){
  const path=new Path2D(),y=h*vv;
  path.moveTo(-100,y-15);path.bezierCurveTo(w*.27,y+(i%2?58:-45),w*.7,y+(i%2?-46:65),w+100,y+7);
  terrainRoad(path,world.theme==='desert'?49:38);
 }
 let cross=new Path2D();cross.moveTo(w*.5,-60);cross.bezierCurveTo(w*.45,h*.31,w*.56,h*.66,w*.50,h+60);terrainRoad(cross,24);
 // Sparse utility grid is part of the command-map language, but not intrusive.
 ctx.beginPath();ctx.lineWidth=.7;ctx.strokeStyle='#e6e3c10d';const grid=104;
 for(let x=Math.floor(left/grid)*grid;x<right+grid;x+=grid){ctx.moveTo(x,top);ctx.lineTo(x,bottom);}
 for(let y=Math.floor(top/grid)*grid;y<bottom+grid;y+=grid){ctx.moveTo(left,y);ctx.lineTo(right,y);}ctx.stroke();
 // Vegetation, sand fissures and abandoned terrain details are deterministic.
 for(const f of world.features){
  if(f.x<left-25||f.x>right+25||f.y<top-25||f.y>bottom+25)continue;
  ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.a);
  if(f.kind<.36){ctx.strokeStyle='#253b3078';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-f.r,-2);ctx.lineTo(f.r,.8);ctx.stroke();ctx.strokeStyle='#99a57f55';ctx.beginPath();ctx.moveTo(-f.r*.8,-4);ctx.lineTo(f.r*.9,-1.2);ctx.stroke();}
  else if(f.kind<.72){ctx.fillStyle=world.theme==='desert'?'#344d3a82':'#335341af';for(let j=0;j<4;j++){let a=j*1.58;ctx.beginPath();ctx.ellipse(Math.cos(a)*f.r*.5,Math.sin(a)*f.r*.3,f.r*.7,f.r*.27,a,0,TAU);ctx.fill();}}
  else{ctx.fillStyle='#273a356b';ctx.beginPath();ctx.ellipse(3,3,f.r*1.7,f.r*.7,0,0,TAU);ctx.fill();ctx.fillStyle=world.theme==='desert'?'#ac9b78':'#929b87';ctx.beginPath();ctx.ellipse(0,-1,f.r*1.1,f.r*.57,.2,0,TAU);ctx.fill();}
  ctx.restore();
 }

 // Scattered wrecks, concrete ruins, guard towers and cargo yards make the map feel occupied.
 for(const p of world.props){if(!isVisible(p.x,p.y,65))continue;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
  const dark=world.theme==='desert'?'#414b42':'#314e46';
  ctx.fillStyle='#07161887';ctx.beginPath();ctx.ellipse(10,16,p.r*1.45,p.r*.76,0,0,TAU);ctx.fill();
  if(p.kind==='ruin'){
    extrudedBox(0,0,47,39,10,'#7e8477','#555d56','#35443e');
    ctx.fillStyle='#3a4744';ctx.fillRect(-19,-14,14,13);ctx.fillRect(5,-11,11,12);
    ctx.fillStyle='#182525';ctx.fillRect(-21,7,16,9);
    ctx.strokeStyle='#d1c69c66';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-22,-20);ctx.lineTo(-8,-5);ctx.lineTo(3,-14);ctx.moveTo(2,20);ctx.lineTo(10,8);ctx.stroke();
    ctx.fillStyle='#283832';for(let i=0;i<3;i++)ctx.fillRect(-30+i*21,21,9,4);
  }else if(p.kind==='container'){
    extrudedBox(0,0,51,23,9,world.theme==='desert'?'#6a776f':'#476c72','#354849','#24363c');
    ctx.strokeStyle='#b4ba9c66';ctx.lineWidth=1.5;for(let i=-19;i<=19;i+=6){ctx.beginPath();ctx.moveTo(i,-10);ctx.lineTo(i,9);ctx.stroke();}
    ctx.fillStyle='#c9aa6d';ctx.fillRect(16,-13,5,4);
  }else if(p.kind==='barricade'){
    ctx.fillStyle='#636453';for(let i=0;i<4;i++){
      ctx.beginPath();ctx.ellipse((i-1.5)*13,0,9,7,-.23,0,TAU);ctx.fill();
      ctx.fillStyle='#acaa83';ctx.beginPath();ctx.ellipse((i-1.5)*13,-2,7,5,-.23,0,TAU);ctx.fill();ctx.fillStyle='#636453';
    }
  }else if(p.kind==='tower'){
    ctx.fillStyle=dark;ctx.fillRect(-3,-31,6,54);ctx.fillStyle='#758877';ctx.fillRect(-22,-36,44,14);
    ctx.fillStyle='#192d33';ctx.fillRect(-14,-37,28,8);ctx.fillStyle='#cfbc8f';ctx.fillRect(-20,-36,4,5);ctx.fillRect(16,-36,4,5);
    ctx.strokeStyle='#c8ceb855';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(-3,-20);ctx.lineTo(-15,18);ctx.moveTo(3,-20);ctx.lineTo(15,18);ctx.stroke();
  }else{
    ctx.save();ctx.rotate(.2);ctx.fillStyle='#2a3b38';roundRect(-20,-9,40,20,4,'#3c4c45','#a0a083');
    ctx.fillStyle='#152d31';ctx.fillRect(-8,-7,18,9);ctx.fillStyle='#df986c66';ctx.beginPath();ctx.arc(-16,0,6,0,TAU);ctx.fill();ctx.restore();
  }
  ctx.restore();
 }

 for(const o of world.rocks){if(o.prop)continue;if(!isVisible(o.x,o.y,o.r*c.zoom))continue;
  ctx.save();ctx.translate(o.x,o.y);
  ctx.fillStyle='#101c18a3';ctx.beginPath();ctx.ellipse(13,22,o.r*1.23,o.r*.68,-.12,0,TAU);ctx.fill();
  ctx.fillStyle=world.theme==='desert'?'#645e4d':'#495b53';ctx.beginPath();ctx.moveTo(-o.r,-o.r*.15);ctx.lineTo(-o.r*.69,-o.r*.74);ctx.lineTo(o.r*.3,-o.r*.9);ctx.lineTo(o.r*.94,-o.r*.22);ctx.lineTo(o.r*.7,o.r*.65);ctx.lineTo(-o.r*.53,o.r*.7);ctx.closePath();ctx.fill();
  ctx.fillStyle=world.theme==='desert'?'#aea080':'#899b8b';ctx.beginPath();ctx.moveTo(-o.r,-o.r*.15);ctx.lineTo(-o.r*.69,-o.r*.74);ctx.lineTo(o.r*.3,-o.r*.9);ctx.lineTo(o.r*.2,-o.r*.35);ctx.lineTo(-o.r*.36,o.r*.28);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#e5ead244';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-o.r*.69,-o.r*.74);ctx.lineTo(o.r*.3,-o.r*.9);ctx.lineTo(o.r*.94,-o.r*.22);ctx.stroke();ctx.restore();
 }
 for(const n of world.nodes){if(!isVisible(n.x,n.y,65))continue;
  ctx.save();ctx.translate(n.x,n.y);const mining=n.mine&&n.mine.alive;
  ctx.fillStyle='#1626219c';ctx.beginPath();ctx.ellipse(3,12,46,29,0,0,TAU);ctx.fill();
  ctx.strokeStyle=mining?'#70efc869':'#eedc96b0';ctx.lineWidth=1.6;ctx.setLineDash([7,6]);ctx.beginPath();ctx.arc(0,0,43,0,TAU);ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<6;i++){
   const a=i*TAU/6+.18,xx=Math.cos(a)*19,yy=Math.sin(a)*15;
   ctx.fillStyle='#6d542a';ctx.beginPath();ctx.moveTo(xx-8,yy+6);ctx.lineTo(xx+2,yy-15);ctx.lineTo(xx+12,yy+6);ctx.closePath();ctx.fill();
   ctx.fillStyle=mining?'#76d7bb':'#edcc7b';ctx.beginPath();ctx.moveTo(xx-8,yy+1);ctx.lineTo(xx,yy-21);ctx.lineTo(xx+12,yy+1);ctx.lineTo(xx+2,yy+10);ctx.closePath();ctx.fill();
   ctx.fillStyle='#ffecba99';ctx.beginPath();ctx.moveTo(xx,yy-19);ctx.lineTo(xx+2,yy+5);ctx.lineTo(xx-4,yy+2);ctx.closePath();ctx.fill();
  }ctx.restore();
 }
}

function drawDecals(){
 const w=g.world;
 for(const d of g.decals){if(!isVisible(d.x,d.y,d.r+20))continue;
 ctx.save();ctx.globalAlpha=Math.min(.32,(d.ttl-d.age)/d.ttl*.35);ctx.fillStyle='#071310';
 ctx.beginPath();ctx.ellipse(d.x,d.y,d.r*1.4,d.r*.78,-.25,0,TAU);ctx.fill();
 ctx.strokeStyle='#c6ad7e';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(d.x,d.y,d.r,d.r*.58,-.25,.3,2.7);ctx.stroke();ctx.restore();
 }
}
function drawOutposts(){
 for(const o of g.world.outposts){if(!isVisible(o.x,o.y,120))continue;
 const owned=o.owner>=0,color=owned?(o.owner===0?'#59e5be':'#ff826d'):'#efce88';
 ctx.save();ctx.translate(o.x,o.y);
 // An elevated strategic relay tower and rotating capture ring, visible at low zoom.
 ctx.fillStyle='#0310129d';ctx.beginPath();ctx.ellipse(14,20,67,39,0,0,TAU);ctx.fill();
 ctx.fillStyle='#3b4d43';ctx.strokeStyle='#a7ab8960';ctx.lineWidth=3;
 ctx.beginPath();for(let k=0;k<6;k++){let a=k*TAU/6-Math.PI/6;const x=55*Math.cos(a),y=41*Math.sin(a);if(!k)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle='#1c3438';ctx.fillRect(-27,-20,54,42);ctx.fillStyle='#70847a';ctx.fillRect(-22,-24,44,33);
 ctx.fillStyle='#132c35';ctx.fillRect(-13,-30,26,30);ctx.fillStyle='#c4d1bd';ctx.fillRect(-8,-31,16,10);
 ctx.fillStyle='#364b4a';ctx.fillRect(-4,-57,8,30);ctx.fillStyle='#0a2730';ctx.beginPath();ctx.arc(0,-64,18,0,TAU);ctx.fill();
 ctx.strokeStyle='#c2c6a2';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-64,12,-.6,.6);ctx.stroke();
 ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,-64,6,0,TAU);ctx.fill();
 ctx.strokeStyle='#f4ecd177';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,61,0,TAU);ctx.stroke();
 ctx.strokeStyle=color;ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();
 ctx.arc(0,0,61,-Math.PI/2,-Math.PI/2+(o.pressure+1)*Math.PI);ctx.stroke();
 if(o.contested){ctx.strokeStyle='#ffe1a7';ctx.setLineDash([8,12]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,71,0,TAU);ctx.stroke();ctx.setLineDash([]);}
 ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.strokeStyle='#112127';ctx.lineWidth=4;ctx.strokeText(owned?'موقع مسيطر':'مركز إمداد',0,86);ctx.fillStyle=owned?color:'#fff1c2';ctx.fillText(owned?'موقع مسيطر':'مركز إمداد',0,86);
 ctx.restore();
 }
}
function drawFog(){
 if(!g.fog)return;
 ctx.save();const old=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=true;
 ctx.drawImage(g.fog.canvas,0,0,g.world.W,g.world.H);
 ctx.imageSmoothingEnabled=old;ctx.restore();
}
function drawHealth(e){if(e.hp>=e.max||!e.alive)return;let w=e.r*2.0,x=e.x-w/2,y=e.y-e.r-23;ctx.fillStyle='#0b161be5';ctx.fillRect(x,y,w,6);ctx.fillStyle=e.p.team?'#ec6a67':'#72e6a9';ctx.fillRect(x+1,y+1,(w-2)*clamp(e.hp/e.max,0,1),4);}
function extrudedBox(cx,cy,w,h,depth,top,front,side,outline='#1b2b2e'){
 const x=cx-w/2,y=cy-h/2;
 ctx.fillStyle=side;ctx.beginPath();ctx.moveTo(x+w,y);ctx.lineTo(x+w+depth*.52,y+depth*.52);ctx.lineTo(x+w+depth*.52,y+h+depth*.52);ctx.lineTo(x+w,y+h);ctx.closePath();ctx.fill();
 ctx.fillStyle=front;ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x+w,y+h);ctx.lineTo(x+w+depth*.52,y+h+depth*.52);ctx.lineTo(x+depth*.52,y+h+depth*.52);ctx.closePath();ctx.fill();
 roundRect(x,y,w,h,2,top,outline);
 ctx.fillStyle='#ffffff16';ctx.fillRect(x+3,y+2,w-6,2);
}
function roofVent(x,y,w=11,h=10){roundRect(x,y,w,h,2,'#283a3b','#95a8a166');ctx.fillStyle='#aab8a06b';ctx.fillRect(x+2,y+2,w-4,2);}
function drawBuilding(b){if(!isDiscovered(b)||!isVisible(b.x,b.y,b.r*g.cam.zoom))return;
 const team=b.p.team?COLORS.enemy:COLORS.friendly,fac=FACTIONS[b.p.faction].color;
 const active=b.complete>=1;const r=b.r;
 ctx.save();ctx.translate(b.x,b.y);
 ctx.fillStyle='#081a1a85';ctx.beginPath();ctx.ellipse(9,17,r*1.47,r*.92,-.1,0,TAU);ctx.fill();
 // Foundations and concrete aprons anchor structures to the battlefield.
 ctx.fillStyle='#34483eb5';ctx.fillRect(-r-12,-r*.82-11,r*2+24,r*1.65+23);
 ctx.strokeStyle='#172a26';ctx.lineWidth=4;ctx.strokeRect(-r-12,-r*.82-11,r*2+24,r*1.65+23);
 ctx.strokeStyle='#8d98776f';ctx.lineWidth=1.5;ctx.strokeRect(-r-7,-r*.82-6,r*2+14,r*1.65+13);
 if(b.type==='hq'){
  extrudedBox(0,-5,98,62,20,'#75867a','#384e4c','#2b4443');
  extrudedBox(-10,-7,66,41,14,'#a2a994','#536766','#3c5555');
  extrudedBox(-11,-9,39,26,11,'#304348','#203841','#15272c');
  for(let i=0;i<4;i++)roofVent(-31+i*13,0,9,6);
  roundRect(-29,23,67,18,3,'#182e34','#9fb1a0');ctx.fillStyle='#c3a365';ctx.fillRect(-23,27,54,3);
  ctx.fillStyle='#264349';ctx.fillRect(-39,-30,24,8);ctx.fillStyle=team;ctx.fillRect(-38,-27,22,4);
  ctx.strokeStyle='#c6d3bd';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(32,-38);ctx.lineTo(32,-67);ctx.stroke();
  ctx.strokeStyle=fac;ctx.beginPath();ctx.arc(32,-66,7,-1.5,1.5);ctx.stroke();ctx.fillStyle=team;ctx.beginPath();ctx.arc(32,-67,3,0,TAU);ctx.fill();
 }else if(b.type==='airfield'){
  // Landing pad and hangar create an immediately recognizable air production building.
  ctx.fillStyle='#1e3335';ctx.fillRect(-55,-49,110,98);ctx.strokeStyle='#bcc2a04d';ctx.lineWidth=2;ctx.strokeRect(-55,-49,110,98);
  ctx.fillStyle='#4b5d58';ctx.beginPath();ctx.ellipse(7,2,31,30,0,0,TAU);ctx.fill();
  ctx.strokeStyle='#f1d18d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(7,2,25,0,TAU);ctx.stroke();
  ctx.font='bold 24px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#dfd6a7';ctx.fillText('H',7,2);
  extrudedBox(-34,-35,32,25,13,'#647c78','#2f4546','#243f40');
  for(let i=0;i<5;i++){ctx.strokeStyle='#f9d58d66';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-49+i*12,45);ctx.lineTo(-45+i*12,49);ctx.stroke();}
  ctx.fillStyle=fac;ctx.fillRect(-50,-48,30,5);
 }else if(b.type==='barracks'){
  extrudedBox(-2,-2,72,48,14,'#76867e','#334a49','#2b4244');
  extrudedBox(-3,-6,57,30,12,'#405b58','#263b3c','#1d3536');
  ctx.fillStyle='#9baa9b';for(let i=0;i<4;i++)ctx.fillRect(-27+i*13,-19,8,5);
  for(let i=0;i<3;i++){roundRect(-27+i*20,18,15,12,1,'#253c41','#8c9f93');ctx.fillStyle=team;ctx.fillRect(-25+i*20,22,10,3);}
  ctx.fillStyle=fac;ctx.fillRect(-30,-24,58,4);
 }else if(b.type==='factory'){
  extrudedBox(-3,-2,93,70,19,'#5d726e','#344c4e','#263e40');
  extrudedBox(-10,-13,69,34,15,'#83938a','#3e5655','#2a4246');
  for(let i=0;i<5;i++)roofVent(-36+i*15,-26,11,12);
  roundRect(-38,13,66,23,2,'#142b30','#92a79b');
  ctx.strokeStyle='#809992';ctx.lineWidth=2;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(-34+i*15,13);ctx.lineTo(-34+i*15,34);ctx.stroke();}
  ctx.fillStyle=team;ctx.fillRect(-40,-36,72,5);
  ctx.fillStyle='#65766c';ctx.fillRect(34,-37,9,20);
  ctx.fillStyle='#d4c39b';ctx.fillRect(35,-38,7,3);
 }else if(b.type==='mine'){
  extrudedBox(0,-2,57,42,12,'#69766b','#394f4d','#2c4443');
  for(let i=0;i<3;i++){ctx.fillStyle='#d4ac64';ctx.beginPath();ctx.ellipse(-18+i*18,-9,8,11,0,0,TAU);ctx.fill();ctx.fillStyle='#5b6e62';ctx.fillRect(-23+i*18,-10,9,10);}
  ctx.save();ctx.rotate(g.time*.38);ctx.strokeStyle='#f1d188';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,3,15,0,TAU);ctx.stroke();ctx.strokeStyle='#ffe8a0';ctx.beginPath();ctx.moveTo(-22,3);ctx.lineTo(22,3);ctx.stroke();ctx.restore();
 }else if(b.type==='turret'){
  ctx.fillStyle='#253a3a';ctx.beginPath();for(let i=0;i<8;i++){const a=i*TAU/8;ctx.lineTo(Math.cos(a)*29,Math.sin(a)*27);}ctx.closePath();ctx.fill();
  ctx.strokeStyle='#87948c';ctx.lineWidth=5;ctx.stroke();
  ctx.save();ctx.rotate(g.time*.17);roundRect(-11,-13,22,25,4,'#617c70','#1b2f31');
  ctx.fillStyle='#263c3c';ctx.fillRect(-5,-40,10,33);ctx.fillStyle='#b1bead';ctx.fillRect(-2,-43,4,6);ctx.restore();
  ctx.fillStyle=team;ctx.beginPath();ctx.arc(0,0,6,0,TAU);ctx.fill();
 }
 // Faction colors and identification lights, visible even at reduced zoom.
 ctx.fillStyle=team;ctx.beginPath();ctx.arc(-r*.86,-r*.67,5.5,0,TAU);ctx.fill();
 ctx.fillStyle=fac;ctx.fillRect(-r*.70,r*.42,Math.max(13,r*.65),3.5);
 ctx.fillStyle='#fff2b7';ctx.beginPath();ctx.arc(r*.74,-r*.65,2,0,TAU);ctx.fill();
 if(!active){ctx.fillStyle='#091b1ac5';ctx.fillRect(-r,-r,r*2,r*2*(1-b.complete));ctx.strokeStyle='#f6d48b';ctx.lineWidth=3;ctx.strokeRect(-r-5,-r-4,2*r+10,2*r+8);}
 ctx.restore();
 drawHealth(b);
 if(b.queue.length){const q=b.queue[0];ctx.strokeStyle='#f6d386';ctx.lineWidth=4;ctx.beginPath();ctx.arc(b.x,b.y,r+15,-Math.PI/2,-Math.PI/2+TAU*(1-q.remain/q.total));ctx.stroke();}
 if(g.selectedBuilding===b){ctx.strokeStyle='#fbe2a0';ctx.lineWidth=2/g.cam.zoom;ctx.setLineDash([9,5]);ctx.beginPath();ctx.ellipse(b.x,b.y,r+18,r+8,0,0,TAU);ctx.stroke();ctx.setLineDash([]);if(b.rally){ctx.strokeStyle='#f2d687';ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.rally.x,b.rally.y);ctx.stroke();}}
}

function drawUnit(u){if(!isDiscovered(u)||!isVisible(u.x,u.y,u.r*g.cam.zoom))return;
 const team=u.p.team?COLORS.enemy:COLORS.friendly,fac=FACTIONS[u.p.faction].color,r=u.r;
 ctx.save();ctx.translate(u.x,u.y);ctx.rotate(u.theta);
 ctx.fillStyle='#07191982';ctx.beginPath();ctx.ellipse(7,8,r*1.44,r*.81,0,0,TAU);ctx.fill();
 if(u.type==='gunship'){
  // Airborne shadow offset and original multi-part gunship silhouette.
  ctx.fillStyle='#05151a70';ctx.beginPath();ctx.ellipse(13,39,31,14,0,0,TAU);ctx.fill();
  ctx.translate(0,-21+Math.sin(g.time*3+u.id)*2);
  const shell=u.p.faction==='legion'?'#6a6554':u.p.faction==='rebels'?'#5c6261':'#435e62';
  ctx.fillStyle='#152e32';ctx.beginPath();ctx.moveTo(-38,0);ctx.lineTo(10,-16);ctx.lineTo(33,0);ctx.lineTo(10,16);ctx.closePath();ctx.fill();
  ctx.fillStyle=shell;ctx.beginPath();ctx.ellipse(0,0,23,11,0,0,TAU);ctx.fill();
  ctx.fillStyle='#b8c6af';ctx.beginPath();ctx.ellipse(5,-1,9,7,0,0,TAU);ctx.fill();
  ctx.fillStyle='#192d34';ctx.beginPath();ctx.ellipse(9,-3,7,5,0,0,TAU);ctx.fill();
  ctx.strokeStyle=fac;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-4,-8);ctx.lineTo(-27,-8);ctx.moveTo(-4,8);ctx.lineTo(-27,8);ctx.stroke();
  ctx.fillStyle='#1d3335';ctx.fillRect(-42,-3,24,6);
  ctx.strokeStyle='#a6b8b9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-43,-11);ctx.lineTo(-43,11);ctx.stroke();
  const spin=g.time*23+u.id;ctx.save();ctx.rotate(spin);ctx.globalAlpha=.42;ctx.strokeStyle='#b9cfc8';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-35,0);ctx.lineTo(35,0);ctx.moveTo(0,-33);ctx.lineTo(0,33);ctx.stroke();ctx.restore();
  ctx.fillStyle=team;ctx.fillRect(-16,-3,8,6);
  ctx.fillStyle='#e9d39e';ctx.fillRect(17,-4,9,3);
 }else if(TYPES[u.type].kind==='infantry'){
  ctx.strokeStyle='#1c302c';ctx.lineCap='round';ctx.lineWidth=4.5;
  ctx.beginPath();ctx.moveTo(-3,2);ctx.lineTo(-7,10);ctx.moveTo(2,2);ctx.lineTo(5,10);ctx.stroke();
  roundRect(-7,-6,13,13,4,fac,'#233a3b');
  ctx.fillStyle='#192b2a';ctx.beginPath();ctx.arc(-2,-2,5.5,0,TAU);ctx.fill();
  ctx.fillStyle='#a8b99d';ctx.beginPath();ctx.arc(-2,-5,4.5,Math.PI,TAU);ctx.fill();
  ctx.strokeStyle=u.type==='rocket'?'#4c4e42':'#182b2e';ctx.lineWidth=u.type==='rocket'?5:3.5;
  ctx.beginPath();ctx.moveTo(3,-1);ctx.lineTo(u.type==='rocket'?22:16,-1);ctx.stroke();
  if(u.type==='rocket'){ctx.strokeStyle='#c9b789';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(6,-3);ctx.lineTo(20,-3);ctx.stroke();}
  ctx.fillStyle=team;ctx.fillRect(-7,-10,5,4);
 }else if(u.type==='scout'){
  const w=r*1.75,h=r*1.18;
  for(const sx of [-1,1])for(const sy of [-1,1])roundRect(sx*r*.52-4,sy*r*.57-4,9,8,2,'#152327','#a3aa937d');
  extrudedBox(-1,0,w,h,4,fac,'#344d49','#25413e');
  roundRect(-r*.25,-r*.37,r*.74,r*.66,3,'#233d40','#a8baa575');
  ctx.fillStyle='#182d2d';ctx.fillRect(r*.4,-r*.1,r*.47,r*.18);
  ctx.fillStyle='#f2e7c3';ctx.fillRect(r*.73,-r*.43,3,4);ctx.fillRect(r*.73,r*.28,3,4);
  ctx.fillStyle=team;ctx.fillRect(-r*.6,-r*.38,r*.5,3);
 }else{
  const special=u.type==='special',artillery=u.type==='artillery',heavy=special&&u.p.faction==='legion';
  const bodyR=heavy?r*1.10:r;
  for(const sy of [-1,1]){
   roundRect(-bodyR,-bodyR*(sy>0?-.53:.80),bodyR*1.95,bodyR*.3,3,'#1b2729','#83918a');
   ctx.strokeStyle='#53655f';ctx.lineWidth=1.7;for(let i=-3;i<=3;i++){const xx=i*bodyR*.23;ctx.beginPath();ctx.moveTo(xx,sy*bodyR*.67);ctx.lineTo(xx+3,sy*bodyR*.57);ctx.stroke();}
  }
  // Polygon hull with explicit facets reads as a three-dimensional armored chassis.
  ctx.fillStyle=heavy?'#525e51':'#384f4b';ctx.beginPath();ctx.moveTo(-bodyR*.9,-bodyR*.53);ctx.lineTo(bodyR*.63,-bodyR*.55);ctx.lineTo(bodyR*.95,-bodyR*.25);ctx.lineTo(bodyR*.95,bodyR*.27);ctx.lineTo(bodyR*.58,bodyR*.54);ctx.lineTo(-bodyR*.9,bodyR*.5);ctx.closePath();ctx.fill();
  ctx.fillStyle=fac;ctx.beginPath();ctx.moveTo(-bodyR*.76,-bodyR*.44);ctx.lineTo(bodyR*.49,-bodyR*.44);ctx.lineTo(bodyR*.79,-bodyR*.18);ctx.lineTo(bodyR*.79,bodyR*.2);ctx.lineTo(bodyR*.46,bodyR*.4);ctx.lineTo(-bodyR*.76,bodyR*.4);ctx.closePath();ctx.fill();
  ctx.fillStyle='#ffffff25';ctx.beginPath();ctx.moveTo(-bodyR*.62,-bodyR*.41);ctx.lineTo(bodyR*.43,-bodyR*.41);ctx.lineTo(bodyR*.2,-bodyR*.3);ctx.closePath();ctx.fill();
  if(u.type==='artillery'){
   ctx.fillStyle='#2a4542';ctx.fillRect(-r*.4,-r*.35,r*.8,r*.7);
   ctx.fillStyle='#b3bca5';ctx.fillRect(-r*.1,-r*.12,r*2.2,r*.24);
   ctx.fillStyle='#283e3f';ctx.fillRect(r*1.24,-r*.14,r*.72,r*.28);
   ctx.fillStyle='#d5c4a0';ctx.fillRect(r*1.92,-r*.1,r*.18,r*.2);
   ctx.fillStyle='#263c3e';ctx.fillRect(-r*.8,-r*.37,r*.47,r*.74);
  }else{
   const tur=heavy?r*.61:r*.5;
   ctx.fillStyle='#2b4240';ctx.beginPath();ctx.ellipse(-r*.08,0,tur,tur*.84,0,0,TAU);ctx.fill();
   ctx.fillStyle='#8d9e8a';ctx.beginPath();ctx.ellipse(-r*.08,-r*.05,tur*.85,tur*.68,0,0,TAU);ctx.fill();
   ctx.fillStyle='#273d3a';ctx.fillRect(r*.1,-r*.14,r*(special?1.76:1.35),r*.28);
   ctx.fillStyle='#9eac9d';ctx.fillRect(r*.15,-r*.14,r*.87,r*.08);
   if(special&&u.p.faction==='rebels'){
    for(let j=-1;j<=1;j++){roundRect(-r*.3,j*r*.35-4,19,8,2,'#46574c','#a2b299');ctx.fillStyle='#c4ab67';ctx.fillRect(-r*.16,j*r*.35-2,5,3);}
   }
   if(special&&u.p.faction==='alliance'){
    ctx.fillStyle='#9fd4d3';ctx.fillRect(-r*.51,-r*.17,7,4);ctx.fillRect(-r*.51,r*.12,7,4);
   }
  }
  ctx.fillStyle=team;ctx.fillRect(-bodyR*.62,-bodyR*.48,bodyR*.62,4);
  ctx.fillStyle='#fff4d8';ctx.fillRect(bodyR*.78,-bodyR*.29,4,5);ctx.fillRect(bodyR*.78,bodyR*.23,4,5);
 }
 if(u.gun>0){
  ctx.globalAlpha=clamp(u.gun/.16,0,1);ctx.fillStyle='#ffe3a0';ctx.beginPath();ctx.moveTo(r*1.10,-5);ctx.lineTo(r*2.1,-2);ctx.lineTo(r*2.28,0);ctx.lineTo(r*2.1,3);ctx.lineTo(r*1.10,5);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
 }
 ctx.restore();drawHealth(u);
 if(u.rank){ctx.save();ctx.fillStyle='#fce3a1';ctx.strokeStyle='#192e2c';ctx.lineWidth=2;const y=u.y-u.r-18;
  for(let i=0;i<u.rank;i++){ctx.beginPath();ctx.moveTo(u.x+(i-(u.rank-1)/2)*11-4,y);ctx.lineTo(u.x+(i-(u.rank-1)/2)*11,y-5);ctx.lineTo(u.x+(i-(u.rank-1)/2)*11+4,y);ctx.stroke();ctx.fill();}
  ctx.restore();
 }
 if(g.selected.includes(u)){
  ctx.strokeStyle='#f3df98';ctx.lineWidth=2/g.cam.zoom;ctx.beginPath();ctx.ellipse(u.x,u.y,r+8,(r+8)*.7,0,0,TAU);ctx.stroke();
  if(u.goal){ctx.strokeStyle='#c2e8ac44';ctx.lineWidth=1/g.cam.zoom;ctx.beginPath();ctx.moveTo(u.x,u.y);ctx.lineTo(u.goal.x,u.goal.y);ctx.stroke();}
 }
}

function drawCombat(){
 for(const p of g.projectiles){if(!isVisible(p.x,p.y,12))continue;
  ctx.shadowColor=p.color;ctx.shadowBlur=7;ctx.strokeStyle=p.color;ctx.lineWidth=p.splash?4:2.5;
  ctx.beginPath();ctx.moveTo(p.x-p.vx*17,p.y-p.vy*17);ctx.lineTo(p.x,p.y);ctx.stroke();
  ctx.fillStyle='#fff0ba';ctx.beginPath();ctx.arc(p.x,p.y,p.splash?3:2.3,0,TAU);ctx.fill();ctx.shadowBlur=0;
 }
 for(const p of g.particles){if(!isVisible(p.x,p.y,100))continue;
  const alpha=clamp(p.life/p.max,0,1);ctx.globalAlpha=p.smoke?alpha*.46:alpha;
  if(p.blast){
   const prog=1-alpha,sz=(p.size||20)*(.25+prog*1.6);
   ctx.fillStyle='#d77937';ctx.beginPath();ctx.arc(p.x,p.y,sz,0,TAU);ctx.fill();
   ctx.fillStyle='#ffe8a4';ctx.beginPath();ctx.arc(p.x,p.y,sz*.5,0,TAU);ctx.fill();
   ctx.strokeStyle='#fff2b4';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,sz*1.4,0,TAU);ctx.stroke();
  }else if(p.smoke){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1+.3*(1-alpha)),0,TAU);ctx.fill();}
  else{ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill();}
 }
 ctx.globalAlpha=1;ctx.shadowBlur=0;
}

function drawTactical(){
 const v=size(),c=g.cam;
 if(g.mode?.type==='build'){
  const def=BUILDINGS[g.mode.key],x=mouse.worldX,y=mouse.worldY,ok=canPlace(g.players[0],g.mode.key,x,y);
  ctx.save();ctx.fillStyle=ok?'#51eab33b':'#ff73654b';ctx.strokeStyle=ok?'#8affcb':'#ff9985';ctx.lineWidth=3/c.zoom;
  ctx.fillRect(x-def.r,y-def.r*.8,def.r*2,def.r*1.6);ctx.strokeRect(x-def.r,y-def.r*.8,def.r*2,def.r*1.6);
  ctx.setLineDash([13,8]);ctx.beginPath();ctx.arc(x,y,500,0,TAU);ctx.strokeStyle='#b9d89b40';ctx.stroke();ctx.setLineDash([]);ctx.restore();
 }
 if(g.mode?.type==='ability'){
  const x=mouse.worldX,y=mouse.worldY;ctx.save();ctx.strokeStyle='#ffab6f';ctx.lineWidth=2.5/c.zoom;
  ctx.beginPath();ctx.arc(x,y,92,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(x-115,y);ctx.lineTo(x+115,y);ctx.moveTo(x,y-115);ctx.lineTo(x,y+115);ctx.stroke();ctx.restore();
 }
 if(drag&&drag.selecting&&drag.moved){const a=drag.start,b={x:drag.currentX,y:drag.currentY};const dpr=canvas.width/v.w;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#80e2b727';ctx.strokeStyle='#bdf3c7';ctx.lineWidth=1.3;ctx.fillRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));ctx.strokeRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));
 }
}

function drawMinimap(){const w=mini.width,h=mini.height,m=g.world,c=g.cam;
 mc.fillStyle=m.ground;mc.fillRect(0,0,w,h);let sx=w/m.W,sy=h/m.H;
 mc.fillStyle='#253b3b';for(const r of m.rocks){mc.beginPath();mc.arc(r.x*sx,r.y*sy,Math.max(1,r.r*sx),0,TAU);mc.fill();}
 mc.fillStyle='#e5d093';for(const n of m.nodes){mc.beginPath();mc.arc(n.x*sx,n.y*sy,2,0,TAU);mc.fill();}
 for(const o of m.outposts){mc.strokeStyle=o.owner===0?'#61f3c6':o.owner===1?'#e89d7b':'#e8cb88';mc.lineWidth=2.8;
  mc.beginPath();mc.arc(o.x*sx,o.y*sy,3,0,TAU);mc.stroke();}
 for(const b of g.buildings){if(!b.alive||!isDiscovered(b))continue;mc.fillStyle=b.p.team?'#f38a76':'#5ff3c7';mc.fillRect(b.x*sx-2,b.y*sy-2,b.type==='hq'?6:4,b.type==='hq'?6:4);}
 for(const u of g.units){if(!u.alive||!isDiscovered(u))continue;mc.fillStyle=u.p.team?'#f4aa78':'#b7ffe0';mc.fillRect(u.x*sx,u.y*sy,1.8,1.8);}
 if(g.fog){mc.save();mc.globalAlpha=.47;mc.drawImage(g.fog.canvas,0,0,w,h);mc.restore();}
 mc.strokeStyle='#ffebac';mc.lineWidth=1.5;mc.strokeRect(c.x*sx,c.y*sy,canvas.clientWidth/c.zoom*sx,canvas.clientHeight/c.zoom*sy);
}
function render(){const v=size(),c=g.cam,dpr=canvas.width/v.w;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#182a2b';ctx.fillRect(0,0,v.w,v.h);
 ctx.save();ctx.scale(c.zoom,c.zoom);ctx.translate(-c.x,-c.y);
 renderGround();drawDecals();drawOutposts();
 for(const b of g.buildings)drawBuilding(b);for(const u of g.units)drawUnit(u);
 drawCombat();drawFog();drawTactical();ctx.restore();
 drawMinimap();}
function frame(now){raf=requestAnimationFrame(frame);let dt=Math.min(.04,(now-lastFrame)/1000||.016);lastFrame=now;
 if(!g)return;
 if($('fps'))$('fps').textContent=String(Math.round(1/Math.max(.01,dt)));
 if(!g.paused&&dt>0){simAccumulator=Math.min(.14,simAccumulator+dt);const STEP=1/30;let steps=0;while(simAccumulator>=STEP&&steps<4){tick(STEP);simAccumulator-=STEP;steps++;if(g.paused)break;}}
 else simAccumulator=0;
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
 const sites=g.world.outposts.filter(o=>o.owner===0).length;
 if($('siteCount'))$('siteCount').textContent=sites+'/'+g.world.outposts.length;
 // One clear next objective instead of a wall of tutorial text.
 const mine=buildingsOf(p,'mine').length,barr=buildingsOf(p,'barracks').length,fac=buildingsOf(p,'factory').length;
 let objective=mine?'': '1/4  ابنِ مصفاة قرب بلورات الموارد لتزيد دخلك';
 if(mine&&!barr)objective='2/4  ابنِ ثكنة ثم درّب المشاة والقاذفين';
 else if(mine&&barr&&!fac)objective='3/4  ابنِ مصنعاً وأنتج الدبابات والاستطلاع';
 else if(mine&&barr&&fac)objective=sites?'4/4  تقدم واضغط على قواعد العدو، واحمِ نقاط الإمداد':'4/4  أرسل جيشك إلى أبراج الإمداد بوسط الخريطة للسيطرة عليها';
 if($('objectiveText')&&$('objectiveText').textContent!==objective)$('objectiveText').textContent=objective;
 if(!force&&!g.uiDirty)return;
 g.uiDirty=false;
 let info='ابنِ مصفاة للموارد وثكنة ومصنعاً لإنتاج القوات.',title='القيادة العسكرية';
 if(g.selected.length){let counts={};for(const u of g.selected)counts[u.type]=(counts[u.type]||0)+1;title=`القوات المحددة (${g.selected.length})`;
  info=Object.entries(counts).map(([k,n])=>TYPES[k].name+' ×'+n).join(' • ');
  if(g.selected.length===1){const u=g.selected[0];info+=` | صحة ${Math.round(u.hp)}/${u.max}`+(u.rank?` | رتبة ${u.rank+1} ★`:'');}
  else info+=' | تقدر توزع القوات أو تثبّت مواقعها';
 }
 if(g.selectedBuilding){let b=g.selectedBuilding;title=b.type==='hq'?'المقر الرئيسي':BUILDINGS[b.type].name;info=`سلامة ${Math.ceil(b.hp)}/${b.max}`+(b.queue.length?` • إنتاج ${TYPES[b.queue[0].type].name} (${Math.max(0,Math.ceil(b.queue[0].remain))}ث)`:'')+(b.repairing?' • قيد الإصلاح':'');}
 if(g.mode?.type==='build'){title='وضع البناء';info='المس موقعاً مناسباً داخل نطاق قاعدتك. الأصفر للمصفاة قرب البلورات.';}
 if(g.mode?.type==='ability'){title='تحديد الضربة';info='المس المكان الذي تريد قصفه على الخريطة.';}
 if(g.mode?.type==='rally'){title='نقطة التجمّع';info='المس الوجهة التي تتحرك إليها وحدات المصنع الجديدة.';}
 $('selectedTitle').textContent=title;$('selectedDetails').textContent=info;
 $('cancelMode').classList.toggle('hidden',!g.mode);
 let bar=$('actionBar');bar.replaceChildren();let group=document.createDocumentFragment();
 for(const b of document.querySelectorAll('#panelTabs .panelTab'))b.classList.toggle('active',b.dataset.tab===g.tab);
 if(g.tab==='build'){
  if(g.selectedBuilding&&g.selectedBuilding.type!=='hq'){
    const b=g.selectedBuilding;
    group.append(actionButton(b.repairing?'إيقاف الإصلاح':'إصلاح المنشأة','✚',null,'manage','repair',b.repairing,b.hp>=b.max));
    group.append(actionButton('بيع المنشأة','↶',null,'manage','sell',false));
  }
  for(const key of ['barracks','factory','mine','turret','airfield']){let d=BUILDINGS[key];group.append(actionButton(d.name,d.glyph,costOf(p,key,true),'build',key,g.mode?.key===key,p.money<costOf(p,key,true)));}
 }
 if(g.tab==='units')for(const key of ['infantry','rocket','scout','tank','artillery','special','gunship']){let d=TYPES[key],has=buildingsOf(p,d.needs).length>0;
  group.append(actionButton(key==='special'?FACTIONS[p.faction].special:d.name,d.glyph,costOf(p,key),'unit',key,false,p.money<costOf(p,key)||!has));}
 if(g.tab==='tech')for(const key of Object.keys(UPGRADES)){const d=UPGRADES[key],done=p.upgrades[key];const btn=actionButton(d.name,d.glyph,done?null:d.cost,'upgrade',key,false,done||p.money<d.cost||!buildingsOf(p,d.requires).length);if(done){btn.classList.add('done');btn.querySelector('.cost')?.remove();const t=document.createElement('span');t.className='cost';t.textContent='✓ مطوّر';btn.append(t);}group.append(btn);}
 if(g.tab==='command'){
  if(g.selected.length){for(const [key,label,glyph] of [['hold','تثبيت الموقع','◉'],['scatter','انتشار','⤧'],['retreat','انسحاب','↶']])group.append(actionButton(label,glyph,null,'order',key,false));}
  for(const key of Object.keys(ABILITIES)){const d=ABILITIES[key],cd=g.command[key],btn=actionButton(d.name,d.glyph,cd>0?Math.ceil(cd)+'ث':d.cost,'ability',key,g.mode?.key===key,cd>0||p.money<d.cost);if(cd>0)btn.querySelector('.cost')?.classList.add('cooldown');group.append(btn);}
  if(g.selectedBuilding&&['factory','barracks','airfield'].includes(g.selectedBuilding.type)){group.append(actionButton('تجمّع القوات','⚑',null,'rally','rally',g.mode?.type==='rally'));}
 }

 bar.append(group);
}
function pointerWorld(ev){const rect=canvas.getBoundingClientRect();return {x:ev.clientX-rect.left,y:ev.clientY-rect.top};}
function pick(x,y){
 // Prioritize visible units over structures for touch-friendly selection.
 let u=null,du=28/g.cam.zoom;for(const e of g.units){if(!e.alive||!isDiscovered(e))continue;let d=hypot(e.x-x,e.y-y);if(d<du&&d<e.r+15){du=d;u=e;}}
 if(u)return u;
 let b=null,db=62/g.cam.zoom;for(const e of g.buildings){if(!e.alive||!isDiscovered(e))continue;let d=hypot(e.x-x,e.y-y);if(d<db&&d<e.r+15){db=d;b=e;}}
 return b;
}
function onTap(x,y){if(!g||g.paused||g.over)return;
 let w=worldAt(x,y),o=pick(w.x,w.y),me=g.players[0];
 if(g.mode?.type==='ability'){if(callBombard(me,w.x,w.y))updateUI(true);return;}
 if(g.mode?.type==='rally'){if(g.selectedBuilding){g.selectedBuilding.rally={x:w.x,y:w.y};notify('تم تعيين نقطة تجمّع الإنتاج');}g.mode=null;g.uiDirty=true;return;}
 if(g.mode?.type==='build'){
  let key=g.mode.key;if(buyBuilding(key,me,w.x,w.y)){notify(BUILDINGS[key].name+' — جارٍ البناء');g.mode=null;g.uiDirty=true;}
  else notify(me.money<costOf(me,key,true)?'الرصيد غير كافٍ':'موقع غير متاح — ابحث عن مساحة أو بلورات للمصفاة');return;
 }
 if(o){
  if(o.p===me){
   if(o.queue){g.selectedBuilding=o;g.selected=[];if(['barracks','factory','airfield'].includes(o.type))g.tab='units';}else{g.selected=[o];g.selectedBuilding=null;}
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
 let obj=pick(w.x,w.y);drag={start:pt,currentX:pt.x,currentY:pt.y,last:pt,selecting:g.selectionMode||!!(obj&&obj.p.id===0&&!obj.queue&&!g.mode),moved:false,worldStart:w};
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
  g.selected=g.units.filter(u=>u.alive&&u.p.id===0&&u.x>=x0&&u.x<=x1&&u.y>=y0&&u.y<=y1);g.selectedBuilding=null;g.selectionMode=false;$('selectArea')?.classList.remove('active');g.uiDirty=true;
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
 }else if(button.dataset.kind==='upgrade'){buyUpgrade(key,g.players[0]);}
 else if(button.dataset.kind==='ability'){buyAbility(key,g.players[0]);}
 else if(button.dataset.kind==='order'){issueTacticalOrder(key);}
 else if(button.dataset.kind==='manage'){manageBuilding(g.players[0],key);}
 else if(button.dataset.kind==='rally'&&g.selectedBuilding){g.mode={type:'rally'};notify('المس مكان تجمّع القوات');}
 else if(buyUnit(key,g.players[0])){notify('أُضيفت '+(key==='special'?FACTIONS[g.players[0].faction].special:TYPES[key].name)+' إلى قائمة الإنتاج');}
 updateUI(true);
});
function togglePause(v){if(!g||g.over)return;g.paused=v;simAccumulator=0;$('pauseOverlay').classList.toggle('hidden',!v);$('pauseBtn').textContent=v?'▶':'Ⅱ';}
$('pauseBtn').onclick=()=>g&&togglePause(!g.paused);$('resumeBtn').onclick=()=>togglePause(false);
$('exitBtn').onclick=()=>{if(g)g.paused=true;g=null;$('pauseOverlay').classList.add('hidden');$('hud').classList.add('hidden');$('startScreen').classList.remove('hidden');};
$('selectArea').onclick=()=>{if(!g||g.paused)return;g.selectionMode=!g.selectionMode;g.mode=null;$('selectArea').classList.toggle('active',g.selectionMode);notify(g.selectionMode?'اسحب مستطيلاً لتحديد مجموعة من الوحدات':'تم إلغاء التحديد بالمستطيل');};
$('selectArmy').onclick=()=>{if(!g||g.paused)return;g.selected=g.units.filter(u=>u.alive&&u.p.id===0);g.selectedBuilding=null;g.mode=null;g.selectionMode=false;$('selectArea').classList.remove('active');g.uiDirty=true;updateUI(true);notify(g.selected.length?'تم تحديد '+g.selected.length+' وحدة':'أنتج وحدات أولاً');};
$('attackMove').onclick=()=>{if(!g||g.paused)return;g.attackMove=!g.attackMove;g.uiDirty=true;notify(g.attackMove?'الأوامر الآن هجوم أثناء الحركة':'الأوامر الآن تحرك عادي');};
$('zoomIn').onclick=()=>g&&setZoom(g.cam.zoom*1.22);
$('zoomOut').onclick=()=>g&&setZoom(g.cam.zoom/1.22);
$('centerBase').onclick=()=>g&&g.players[0].hq&&centerCamera(g.players[0].hq.x,g.players[0].hq.y);
const frontBtn=$('centerFront');if(frontBtn)frontBtn.onclick=()=>{if(!g)return;
 const base=g.players[0].hq||g.players[0].start;
 const candidates=g.world.outposts.filter(o=>o.owner!==0);
 const pt=(candidates.length?candidates:g.world.outposts).sort((a,b)=>distance(a,base)-distance(b,base))[0];
 if(pt){centerCamera(pt.x,pt.y);spawnPing(pt.x,pt.y,'#f3cf89');}
};
$('cancelMode').onclick=()=>{if(!g)return;g.mode=null;g.uiDirty=true;updateUI(true);};
$('restartBtn').onclick=()=>{g=null;$('endScreen').classList.add('hidden');$('startScreen').classList.remove('hidden');};
for(const [container,key,attr] of [['mapChoices','map','map'],['factionChoices','faction','faction'],['difficultyChoices','diff','diff']]){
 $(container).addEventListener('click',ev=>{const b=ev.target.closest('button[data-'+attr+']');if(!b)return;choice[key]=b.dataset[attr];for(const c of $(container).children)c.classList.toggle('active',c===b);if(key==='faction'&&$('doctrineInfo'))$('doctrineInfo').textContent=FACTIONS[choice.faction].description;});
}
$('startBtn').onclick=()=>{sound('click');newGame();};
const soundBtn=$('soundBtn');if(soundBtn)soundBtn.onclick=()=>{audioEnabled=!audioEnabled;soundBtn.textContent=audioEnabled?'♫':'♪';soundBtn.title=audioEnabled?'كتم المؤثرات':'تشغيل المؤثرات';if(audioEnabled)sound('click');};
const panelBtn=$('panelToggle');if(panelBtn)panelBtn.onclick=()=>{
 const compact=$('gameRoot').classList.toggle('compactHud');panelBtn.textContent=compact?'▴':'▾';panelBtn.title=compact?'فتح لوحة الأوامر':'تصغير لوحة الأوامر';
 resizeCanvas();if(g){limitCam();g.uiDirty=true;}
};
window.addEventListener('resize',resizeCanvas);
window.addEventListener('keydown',ev=>{
 if(!g)return;
 if(ev.key==='Escape'){if(g.mode){g.mode=null;g.uiDirty=true;}else togglePause(!g.paused);}
 if(ev.key==='a'||ev.key==='A')$('selectArmy').click();
 if(ev.key==='q'||ev.key==='Q')$('attackMove').click();
 if(ev.key==='s'||ev.key==='S')issueTacticalOrder('hold');
 if(ev.key==='r'||ev.key==='R')issueTacticalOrder('retreat');
});
document.addEventListener('visibilitychange',()=>{if(g&&!document.hidden)lastFrame=performance.now();if(g&&document.hidden&&!g.over){g.paused=true;$('pauseOverlay').classList.remove('hidden');}});
resizeCanvas();raf=requestAnimationFrame(frame);
window.__zeroFrontier={get game(){return g;},start:(map='duel',diff='normal',faction='alliance')=>{choice={map,diff,faction};newGame();},buyBuilding:(t,x,y)=>g&&buyBuilding(t,g.players[0],x,y),buyUnit:(t)=>g&&buyUnit(t,g.players[0]),tick:(dt)=>g&&tick(dt),mapNames:Object.keys(MAPS),stats:()=>g&&({units:g.units.length,buildings:g.buildings.length,players:g.players.length,time:g.time,canvas:[canvas.width,canvas.height],upgrades:{...g.players[0].upgrades},cooldowns:{...g.command},outposts:g.world.outposts.map(o=>({owner:o.owner,pressure:o.pressure})),fogRevisions:g.fog?.revision,kills:g.kills,fps:Number($('fps')?.textContent||0)}),buyUpgrade:(key)=>g&&buyUpgrade(key,g.players[0]),callBombard:(x,y)=>g&&callBombard(g.players[0],x,y)};
})();

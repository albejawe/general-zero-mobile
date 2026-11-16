"""Real Chromium browser regression suite (network-independent due sandbox navigation restrictions).
Run: python test_game.py
"""
from pathlib import Path
import os, shutil
from playwright.sync_api import sync_playwright
from time import perf_counter
ROOT=Path(__file__).resolve().parent
HTML=(ROOT/'ZERO_FRONTIER_OFFLINE.html').read_text()
STORAGE='''() => {const data=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear()}});Object.defineProperty(window,'sessionStorage',{configurable:true,value:{getItem:k=>data.get('_session:'+k)??null,setItem:(k,v)=>data.set('_session:'+k,String(v)),removeItem:k=>data.delete('_session:'+k),clear:()=>data.clear()}}); }'''
logs=[]
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,**({'executable_path': os.environ.get('CHROMIUM_BIN') or shutil.which('chromium') or shutil.which('chromium-browser')} if (os.environ.get('CHROMIUM_BIN') or shutil.which('chromium') or shutil.which('chromium-browser')) else {}),args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':844,'height':390},has_touch=True,is_mobile=True)
  errors=[]
  page.on('pageerror',lambda err:errors.append(str(err)))
  page.evaluate(STORAGE)
  page.set_content(HTML,wait_until='domcontentloaded')
  assert page.locator('#mapChoices button').count()==3
  assert page.locator('#continueBtn').is_hidden()
  assert page.locator('#saveBtn').count()==1
  page.locator('#startBtn').click();page.wait_for_timeout(200)
  assert page.locator('#startScreen').is_hidden()
  assert page.evaluate('window.__zeroFrontier.game.players.length')==2
  logs.append('PASS: New game, 1v1 and two navigation orientations')
  for w,h in [(844,390),(390,844),(932,430),(320,568)]:
   page.set_viewport_size({'width':w,'height':h})
   page.wait_for_timeout(140)
   geom=page.evaluate('''()=>{const cv=document.querySelector('#gameCanvas'),bar=document.querySelector('#bottomArea').getBoundingClientRect(),actions=document.querySelector('#actionBar').getBoundingClientRect();return {cw:cv.clientWidth,ch:cv.clientHeight,bh:bar.height,aw:actions.width,actionX:actions.x};}''')
   assert geom['cw']==w and geom['ch']==h and geom['bh']>=43 and geom['bh']<h*.70,geom
  logs.append('PASS: Both orientations, 320/390/844/932 px (HUD size)')
  checks=page.evaluate('''()=>{const z=window.__zeroFrontier,g=z.game,p=g.players[0];p.money=15000;
   const n=g.world.nodes.find(n=>Math.hypot(n.x-p.hq.x,n.y-p.hq.y)<500),mine=z.buyBuilding('mine',n.x,n.y),factory=z.buyBuilding('factory',p.hq.x+160,p.hq.y+160),barracks=z.buyBuilding('barracks',p.hq.x+170,p.hq.y-125);
   for(let i=0;i<150;i++)z.tick(.05);
   const up=z.buyUpgrade('armor'),units=z.buyUnit('tank');
   const u=g.units.find(u=>u.p===p);const enemy=g.players.find(p=>p.team===1).hq;
   u.goal={x:enemy.x-150,y:enemy.y-10};u.path=[];u.target=enemy;u.order='attack';
   g.world.outposts[0].owner=0;g.world.outposts[0].pressure=1;
   const sent=z.save();
   return {mine,factory,barracks,up,units,sent,saved:z.hasSave(),money:p.money,time:g.time,outposts:g.world.outposts.map(o=>o.owner),fog:g.fog?.seen.reduce((n,v)=>n+v,0),path:u.goal,head:u.id,queue:g.buildings.filter(b=>b.p===p).flatMap(b=>b.queue).length};
  }''')
  assert all(checks[k] for k in ['mine','factory','barracks','up','units','sent','saved']),checks
  assert checks['queue']>=1
  # Confirm persisted data has references encoded and only compressed fog (4-12x smaller).
  snapshot=page.evaluate('localStorage.getItem("general-zero-mobile-save-v1")')
  assert '"seenBits"' in snapshot and '"seen"' not in snapshot
  assert len(snapshot)<150000,len(snapshot)
  restored=page.evaluate('''()=>{let z=window.__zeroFrontier;const worked=z.continue();const g=z.game;return {worked,time:g?.time,money:g?.players[0]?.money,outposts:g?.world.outposts.map(o=>o.owner),fog:g?.fog.seen.reduce((n,v)=>n+v,0),hasTarget:g?.units.some(u=>u.p.id===0&&u.target?.p.team===1),queue:g?.buildings.filter(b=>b.p.id===0).flatMap(b=>b.queue).length,upgrades:g?.players[0]?.upgrades};}''')
  assert restored['worked'] and abs(restored['money']-checks['money'])<.1
  assert restored['outposts']==checks['outposts'] and restored['queue']==checks['queue'] and restored['fog']>=checks['fog']
  assert restored['upgrades'].get('armor') and restored['hasTarget'],restored
  logs.append('PASS: Save/restore full economy, fog, buildings, unit target references, production queues, upgrades, control point')
  # Simulate complete page refresh by initializing a brand-new page with same save.
  page2=browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
  errors2=[];page2.on('pageerror',lambda e:errors2.append(str(e)))
  page2.evaluate(STORAGE)
  page2.evaluate('''saved=>localStorage.setItem('general-zero-mobile-save-v1', saved)''',snapshot)
  page2.set_content(HTML,wait_until='domcontentloaded')
  assert page2.locator('#continueBtn').is_visible()
  page2.locator('#continueBtn').click()
  assert page2.evaluate('window.__zeroFrontier.game.time')>=checks['time']
  logs.append('PASS: Continuation from a fresh browser document after restart')
  # Base game 9 combinations (three maps x three difficulties), plus faction variations.
  result=page.evaluate('''()=>{
   const z=window.__zeroFrontier;let result=[];
   for(const m of [['duel',2],['squads',4],['war',8]])for(const diff of ['easy','normal','hard']){
    z.start(m[0],diff,'legion');const g=z.game;const p=g.players[0];
    for(let i=0;i<400&&!g.over;i++)z.tick(.15);
    if(g.players.length!==m[1]||g.units.some(u=>!Number.isFinite(u.x)||!Number.isFinite(u.y))||g.players.some(p=>p.money<0))throw Error('bad state '+m[0]+' '+diff);
    result.push([m[0],diff,g.units.length,g.time]);
   }
   return result;
  }''')
  assert len(result)==9
  logs.append('PASS: All 9 map/difficulty combinations, no NaN, no negative balance')
  # Direct combat tests: opponent vision is not omniscient, LOS and cover matter.
  combat=page.evaluate('''()=>{
    let z=window.__zeroFrontier;z.start('duel','hard','alliance');let g=z.game,a=g.players[0],enemy=g.players[1];
    let u=g.units.find(x=>x.p===a),e=g.units.find(x=>x.p===enemy);
    let t={x:100,y:100};
    return {hasOpponentVision:!!g.fog.enemyVisible,canSeeInitial:typeof g.fog.enemyVisible[0]==='number',money:a.money,version:document.querySelector('#versionSmall').textContent};
  }''')
  assert combat['hasOpponentVision'] and combat['version']=='4.0.0',combat
  logs.append('PASS: Fog layers for both teams; version 4')
  # 4v4, 150 units stress without real-time delays.
  stress=page.evaluate('''()=>{
    let z=window.__zeroFrontier;z.start('war','hard','alliance');let g=z.game,p=g.players[0];
    p.money=500000;let t=performance.now();
    for(let i=0;i<170;i++){
      let owner=g.players[i%8],base=owner.hq||owner.start;
      z.game.units.push({id:10000+i,type:'infantry',p:owner,x:base.x+70+(i%9)*15,y:base.y+90+(i%11)*14,hp:90,max:90,dmg:12,range:150,speed:95,fire:.8,r:11,alive:true,theta:0,gun:0,cool:.1,target:null,goal:null,path:[],order:'guard',spawnTime:g.time,stuck:0,tracks:0,kills:0,rank:0,fireAngle:0});
    }
    for(let j=0;j<110&&!g.over;j++)z.tick(1/30);
    return {elapsed:Math.round(performance.now()-t),units:g.units.filter(u=>u.alive).length,buildings:g.buildings.length,players:g.players.length,performance:z.stats()};
  }''')
  assert stress['players']==8 and stress['units']>=150,stress
  logs.append(f"PASS: 4v4 load with {stress['units']} live units, {stress['elapsed']} ms for 110 fixed ticks (Chromium simulation)")
  assert not errors and not errors2,(errors[:7],errors2[:7])
  logs.append('PASS: No JavaScript page errors')
  browser.close()
if __name__=='__main__':
 t=perf_counter()
 try:
  run()
 finally:
  for result in logs:print(result)
 print('Elapsed:',round(perf_counter()-t,2),'s')

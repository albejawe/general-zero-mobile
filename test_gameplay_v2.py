"""Smoke and regression tests for General Zero Mobile v2. Requires Playwright and Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright
r=Path(__file__).resolve().parent
h=(r/'ZERO_FRONTIER_OFFLINE.html').read_text('utf8')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(h)
 assert not page.locator('#portraitGuard').count()
 assert page.locator('#mapChoices .choice').count()==3
 page.locator('#startBtn').click()
 assert page.evaluate('window.__zeroFrontier.stats().players')==2
 page.locator('[data-tab="tech"]').click()
 assert page.locator('#actionBar .action').count()==3
 page.locator('[data-tab="command"]').click()
 assert page.locator('#actionBar .action').count()==2
 result=page.evaluate('''() => {
  const z=window.__zeroFrontier,g=z.game,p=g.players[0];p.money=20000;
  const n=g.world.nodes.find(n=>Math.hypot(n.x-p.start.x,n.y-p.start.y)<470);
  const mine=z.buyBuilding('mine',n.x,n.y),factory=z.buyBuilding('factory',p.start.x+135,p.start.y+110);
  for(let i=0;i<50;i++)z.tick(.1);
  const tech=z.buyUpgrade('weapons'),tech2=z.buyUpgrade('armor'),tech3=z.buyUpgrade('engines'),repeated=z.buyUpgrade('armor');
  const e=g.players.find(p=>p.team===1).hq,h=e.hp;
  const strike=z.callBombard(e.x,e.y);for(let i=0;i<35;i++)z.tick(.1);
  return {mine,factory,tech,tech2,tech3,repeated,strike,damage:h-e.hp};
 }''')
 assert all(result[k] for k in ['mine','factory','tech','tech2','tech3','strike']) and not result['repeated'] and result['damage']>0,result
 for w,h in [(844,390),(390,844),(320,568),(932,430)]:
  page.set_viewport_size({'width':w,'height':h})
  assert page.evaluate('document.querySelector("#actionBar").getBoundingClientRect().height')>35
 for mp,count in [('duel',2),('squads',4),('war',8)]:
  for difficulty in ['easy','normal','hard']:
   out=page.evaluate('''({mp,difficulty})=>{let z=window.__zeroFrontier;z.start(mp,difficulty,'legion');let g=z.game;for(let i=0;i<1500&&!g.over;i++)z.tick(.12);return {players:g.players.length,resources:g.players.map(p=>p.money)};}''',{'mp':mp,'difficulty':difficulty})
   assert out['players']==count and min(out['resources'])>=0,out
 assert not errors,errors
 b.close()
print('All smoke, portrait/landscape, upgrade, artillery and 9 AI configuration tests passed.')

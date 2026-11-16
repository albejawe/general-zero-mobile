"""General Zero Mobile v3 smoke tests. Requires playwright and Chromium.
Run: python test_gameplay_v3.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
html=(root/'ZERO_FRONTIER_OFFLINE.html').read_text('utf8')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html)
 page.locator('#startBtn').click()
 initial=page.evaluate('''()=>{let g=window.__zeroFrontier.game;return {points:g.world.outposts.length,terrain:!!g.world.static,seen:g.fog.seen.reduce((a,b)=>a+b,0)};}''')
 assert initial['points']==2 and initial['terrain'] and initial['seen']>0
 page.locator('#panelToggle').click()
 assert page.locator('#gameRoot.compactHud').count()==1
 page.locator('#panelToggle').click()
 assert not page.locator('#gameRoot.compactHud').count()
 for w,h in [(390,844),(844,390),(320,568),(932,430)]:
  page.set_viewport_size({'width':w,'height':h})
  assert page.evaluate('document.querySelector("#actionBar").getBoundingClientRect().height')>20
 for mp,count in [('duel',2),('squads',4),('war',8)]:
  for difficulty in ['easy','normal','hard']:
   out=page.evaluate('''({mp,difficulty})=>{const z=window.__zeroFrontier;z.start(mp,difficulty,'legion');const g=z.game;for(let i=0;i<1400&&!g.over;i++)z.tick(.12);return {players:g.players.length,units:g.units.length,credits:g.players.map(p=>p.money)};}''',{'mp':mp,'difficulty':difficulty})
   assert out['players']==count and min(out['credits'])>=0 and out['units']>=0
 assert not errors,errors
 browser.close()
print('V3 smoke: maps, AI, orientation, UI, zero browser exceptions passed')

"""Screen-driven commands via real Chromium pointer input, independent of API shortcuts."""
from pathlib import Path
import os, shutil
from playwright.sync_api import sync_playwright
from time import perf_counter
H=(Path(__file__).resolve().parent/'ZERO_FRONTIER_OFFLINE.html').read_text()
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,**({'executable_path': os.environ.get('CHROMIUM_BIN') or shutil.which('chromium') or shutil.which('chromium-browser')} if (os.environ.get('CHROMIUM_BIN') or shutil.which('chromium') or shutil.which('chromium-browser')) else {}),args=['--no-sandbox','--disable-dev-shm-usage'])
 for w,h in [(932,430),(390,844)]:
  page=b.new_page(viewport={'width':w,'height':h},has_touch=True,is_mobile=True)
  page.evaluate("() => { const d=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>d.get(k)||null,setItem:(k,v)=>d.set(k,String(v)),removeItem:k=>d.delete(k)}})}")
  page.set_content(H)
  page.locator('#startBtn').click()
  page.wait_for_timeout(120)
  n=page.evaluate('''()=>{const g=window.__zeroFrontier.game,p=g.players[0];const node=g.world.nodes.find(n=>Math.hypot(n.x-p.hq.x,n.y-p.hq.y)<500);return {x:(node.x-g.cam.x)*g.cam.zoom,y:(node.y-g.cam.y)*g.cam.zoom,r:node.r,pre:g.buildings.length};}''')
  assert n['x']>40 and 75<n['y']<h-130, (w,h,n)
  page.locator('#actionBar button[data-key="mine"]').click()
  assert page.locator('#cancelMode').is_visible()
  page.mouse.click(n['x'],n['y'])
  bcount=page.evaluate('window.__zeroFrontier.game.buildings.length')
  assert bcount==n['pre']+1,(w,h,n,bcount)
  page.locator('#selectArmy').click()
  sel=page.evaluate('window.__zeroFrontier.game.selected.length')
  assert sel>=3
  # Issue real move command on visible world, away from buttons.
  coord=page.evaluate('''()=>{let g=window.__zeroFrontier.game,p=g.players[0],v={x:p.hq.x+240,y:p.hq.y-60};return {x:(v.x-g.cam.x)*g.cam.zoom,y:(v.y-g.cam.y)*g.cam.zoom};}''')
  assert coord['x']<w-18 and 65<coord['y']<h-120,coord
  page.mouse.click(coord['x'],coord['y'])
  goals=page.evaluate('''()=>window.__zeroFrontier.game.units.filter(u=>u.p.id===0&&u.goal).length''')
  assert goals>=3,(w,goals,coord)
  page.locator('#pauseBtn').click()
  assert page.locator('#pauseOverlay').is_visible()
  page.locator('#saveBtn').click()
  assert page.evaluate('window.__zeroFrontier.hasSave()')
  page.locator('#resumeBtn').click()
  page.locator('#panelToggle').click()
  assert page.locator('#gameRoot.compactHud').count()==1
  page.locator('#panelToggle').click()
  assert page.locator('#gameRoot.compactHud').count()==0
  print('PASS',w,h,'tap to build',bcount,'tap army move',goals,'pause+save, panel toggle')
  page.close()
 b.close()

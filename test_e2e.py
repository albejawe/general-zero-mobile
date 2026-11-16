"""Browser smoke tests for General Zero Mobile. Requires Playwright + Chromium.
Usage: python test_e2e.py
Tests the independent offline HTML without network access.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from time import perf_counter

ROOT=Path(__file__).resolve().parent
HTML=(ROOT/'ZERO_FRONTIER_OFFLINE.html').read_text(encoding='utf-8')

def run():
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':932,'height':430}, has_touch=True, is_mobile=True)
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.set_content(HTML,wait_until='load')
        assert page.locator('#mapChoices .choice').count()==3
        assert page.locator('#factionChoices .choice').count()==3
        assert page.locator('#difficultyChoices .choice').count()==3
        results.append('Menu: 3 maps, 3 factions, 3 difficulties')
        page.locator('#startBtn').click()
        page.wait_for_timeout(300)
        assert page.evaluate('window.__zeroFrontier.stats().players')==2
        assert page.locator('#actionBar .action').count()==4
        colors=page.evaluate('''() => {let c=document.querySelector('#gameCanvas'),v=c.getContext('2d').getImageData(500,200,1,1).data;return [...v];}''')
        assert colors[3]==255 and colors[:3]!=[8,17,22],colors
        results.append('Canvas rendering and UI')
        page.locator('[data-tab="units"]').click()
        assert page.locator('#actionBar .action').count()==6
        page.locator('[data-tab="build"]').click()
        result=page.evaluate('''() => {
            let z=window.__zeroFrontier,g=z.game,p=g.players[0],n=g.world.nodes.find(n=>Math.hypot(n.x-p.start.x,n.y-p.start.y)<500);
            let before=p.money;
            return {invalid:z.buyBuilding('mine',p.start.x,p.start.y), valid:z.buyBuilding('mine',n.x,n.y),before,after:p.money,nodes:g.world.nodes.filter(n=>n.mine&&n.mine.p===p).length};
        }''')
        assert result['invalid'] is False and result['valid'] is True
        assert round(result['before']-result['after'])==250 and result['nodes']==1,result
        results.append('Mine placement rules and resource cost')
        train=page.evaluate('''() => {
            let z=window.__zeroFrontier,g=z.game,p=g.players[0];
            let placed=z.buyBuilding('barracks',p.start.x+120,p.start.y-112);
            for(let i=0;i<30;i++)z.tick(.1);
            let started=z.buyUnit('infantry');
            for(let i=0;i<32;i++)z.tick(.1);
            return {placed,started,units:g.units.filter(u=>u.alive&&u.p===p).length};
        }''')
        assert train['placed'] and train['started'] and train['units']>=4,train
        results.append('Barracks build and troop production')
        page.locator('#centerBase').click()
        coords=page.evaluate('''() => {let g=window.__zeroFrontier.game,u=g.units.find(u=>u.p.id===0);return {x:(u.x-g.cam.x)*g.cam.zoom,y:(u.y-g.cam.y)*g.cam.zoom};}''')
        if coords['y']>55 and coords['y']<310:
            page.mouse.click(coords['x'],coords['y'])
            assert page.evaluate('window.__zeroFrontier.game.selected.length')==1
            page.mouse.click(650,180)
            assert page.evaluate('!!window.__zeroFrontier.game.units.find(u=>u.p.id===0).goal')
            results.append('Tap selection and move')
        page.evaluate('''() => {let z=window.__zeroFrontier,g=z.game;for(let p of g.players.filter(p=>p.team===1)){p.hq.alive=false;}z.tick(.02);}''')
        assert page.locator('#endScreen').is_visible()
        assert 'انتصار' in page.locator('#endTitle').inner_text()
        results.append('Victory state and overlay')
        for mode,count in [('duel',2),('squads',4),('war',8)]:
            page.evaluate('''({mode}) => window.__zeroFrontier.start(mode,'hard','legion')''',{'mode':mode})
            assert page.evaluate('window.__zeroFrontier.stats().players')==count
            for step in range(0,180,30):
                page.evaluate('''() => {const z=window.__zeroFrontier;for(let i=0;i<150;i++)z.tick(.2);}''')
            report=page.evaluate('''() => {const z=window.__zeroFrontier,g=z.game;return {n:g.players.length,units:g.units.length,buildings:g.buildings.length,resources:g.players.map(p=>p.money),time:g.time};}''')
            assert report['n']==count and report['units']>=0 and report['buildings']>=0
            assert all(v>=-0.01 for v in report['resources']),report
            results.append(f'{mode}: {round(report["time"])} seconds, {report["units"]} units')
        page.set_viewport_size({'width':844,'height':390})
        page.wait_for_timeout(250)
        assert page.evaluate('document.querySelector("#gameCanvas").width')>=844
        assert not errors,errors
        results.append('Landscape resize; no JavaScript exceptions')
        browser.close()
    return results

if __name__=='__main__':
    started=perf_counter()
    for line in run(): print('PASS',line)
    print('PASS Total runtime:',round(perf_counter()-started,2),'seconds')

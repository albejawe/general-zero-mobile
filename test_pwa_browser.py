"""Real Chromium service-worker/PWA integration test: install, offline, two upgrades,
mid-game safe continuation. Requires Playwright Chromium and loopback HTTP access.

The test spins up a disposable local HTTP site and never mutates repository files.
"""
from pathlib import Path
import functools, tempfile, shutil, threading, os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
FILES = ['index.html', 'styles.css', 'game.js', 'sw.js', 'pwa.js',
         'sprite_atlas.png', 'manifest.webmanifest', 'icon.svg']

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def end_headers(self):
        # Prevent aggressive HTTP caching: SW handles offline caching itself.
        if self.path.startswith(('/sw.js', '/index.html')) or self.path == '/':
            self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()


def run():
    with tempfile.TemporaryDirectory(prefix='gzm-pwa-') as tmp:
        for name in FILES:
            shutil.copy2(ROOT / name, Path(tmp) / name)
        handler = functools.partial(Handler, directory=tmp)
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f'http://127.0.0.1:{server.server_port}/'
            with sync_playwright() as playwright:
                executable = os.environ.get('CHROMIUM_BIN')
                browser = playwright.chromium.launch(
                    headless=True,
                    **({'executable_path': executable} if executable else {}),
                    args=['--no-sandbox', '--disable-dev-shm-usage'])
                context = browser.new_context(
                    viewport={'width': 844, 'height': 390},
                    service_workers='allow')
                page = context.new_page()
                errors=[]
                page.on('pageerror',lambda err: errors.append(str(err)))
                page.goto(url, wait_until='domcontentloaded')
                page.wait_for_function("'serviceWorker' in navigator && !!navigator.serviceWorker.controller", timeout=15000)
                page.wait_for_function("async () => (await caches.keys()).includes('general-zero-mobile-4.0.0')", timeout=15000)
                assert page.locator('#startBtn').is_visible()
                print('PASS: Actual Service Worker registered and first PWA shell cached')

                context.set_offline(True)
                page.reload(wait_until='domcontentloaded', timeout=10000)
                assert page.locator('#startBtn').is_visible()
                assert page.evaluate('typeof window.__zeroFrontier.start')=='function'
                print('PASS: Game and original sprite atlas available offline')

                context.set_offline(False)
                page.reload(wait_until='domcontentloaded', timeout=10000)
                sw_path = Path(tmp) / 'sw.js'
                original_sw=sw_path.read_text('utf8')
                sw_path.write_text(original_sw.replace('4.0.0', '4.0.1'), 'utf8')
                # First update is on the menu; safe and automatic refresh expected.
                page.evaluate('() => navigator.serviceWorker.getRegistration().then(r=>r.update())')
                page.wait_for_function("async () => (await caches.keys()).includes('general-zero-mobile-4.0.1')", timeout=15000)
                page.wait_for_timeout(250)
                assert page.locator('#startBtn').is_visible()
                print('PASS: Updated installed PWA to 4.0.1 without reinstalling')

                page.locator('#startBtn').click()
                page.wait_for_timeout(120)
                assert page.evaluate('window.__zeroFrontier.game?.players.length')==2
                sw_path.write_text(original_sw.replace('4.0.0', '4.0.2'), 'utf8')
                page.evaluate('() => navigator.serviceWorker.getRegistration().then(r=>r.update())')
                page.wait_for_function("async () => (await caches.keys()).includes('general-zero-mobile-4.0.2')", timeout=15000)
                page.locator('#updateToast:not(.hidden)').wait_for(timeout=10000)
                assert page.evaluate('window.__zeroFrontier.game !== null')
                page.locator('#updateNow').click()
                page.wait_for_function("!!window.__zeroFrontier?.game && window.__zeroFrontier?.hasSave()", timeout=15000)
                assert page.locator('#startScreen').is_hidden()
                assert page.evaluate("sessionStorage.getItem('gzmResumeAfterUpdate')") is None
                print('PASS: Active match saved and resumed across a real SW update')
                assert not errors, errors
                context.close();browser.close()
        finally:
            server.shutdown();server.server_close()

if __name__=='__main__':
    run()

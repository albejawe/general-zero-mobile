"""Rebuild standalone offline HTML from canonical index, styles, JS, and sprite atlas."""
from pathlib import Path
import re,base64
ROOT=Path(__file__).resolve().parent
html=(ROOT/'index.html').read_text(encoding='utf-8')
img='data:image/png;base64,'+base64.b64encode((ROOT/'sprite_atlas.png').read_bytes()).decode('ascii')
css=(ROOT/'styles.css').read_text(encoding='utf-8').replace('sprite_atlas.png?v=4.0.0',img)
js=(ROOT/'game.js').read_text(encoding='utf-8').replace('sprite_atlas.png?v=4.0.0',img)
def sub(pattern,replacement):
 global html
 html,n=re.subn(pattern,lambda _:replacement,html,count=1)
 if n!=1:raise RuntimeError(f'Missing expected source marker: {pattern}')
sub(r'<link rel="manifest" href="manifest.webmanifest\?v=[^"]+">','')
sub(r'<link rel="icon" href="icon.svg" type="image/svg\+xml">','')
sub(r'<link rel="stylesheet" href="styles.css\?v=[^"]+">','<style>\n'+css+'\n</style>')
sub(r'<script src="game.js\?v=[^"]+"></script>','<script>\n'+js+'\n</script>')
sub(r'<script src="pwa.js\?v=[^"]+" defer></script>','')
(ROOT/'ZERO_FRONTIER_OFFLINE.html').write_text(html,encoding='utf-8')
print('Built fully offline single-file HTML:',len(html),'chars')

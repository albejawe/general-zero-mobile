"""Build single-file offline HTML from the canonical source without external dependencies."""
from pathlib import Path
import re
root=Path(__file__).resolve().parent
html=(root/'index.html').read_text('utf8')
css=(root/'styles.css').read_text('utf8')
js=(root/'game.js').read_text('utf8')
for pattern in [r'<link rel="manifest" href="manifest.webmanifest\?v=[^"]+">',r'<link rel="icon" href="icon.svg" type="image/svg\+xml">',r'<script src="pwa.js\?v=[^"]+" defer></script>']:
 html,n=re.subn(pattern,'',html);assert n==1,pattern
html,n=re.subn(r'<link rel="stylesheet" href="styles.css\?v=[^"]+">',lambda m:'<style>\n'+css+'\n</style>',html);assert n==1
html,n=re.subn(r'<script src="game.js\?v=[^"]+"></script>',lambda m:'<script>\n'+js+'\n</script>',html);assert n==1
(root/'ZERO_FRONTIER_OFFLINE.html').write_text(html,'utf8')
print('Offline bundle regenerated')

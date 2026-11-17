#!/usr/bin/env python3
"""Stamp index.html's script/style URLs with a hash of their contents (?v=abc123), so browsers
(and GitHub Pages' 10-minute cache) fetch fresh copies after every change. Run before committing;
tools/process_assets.py runs it too. Also sets window.WIKIPONIA_V for dynamic imports (map3d.js)."""
import hashlib, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
index = ROOT / 'index.html'
html = index.read_text()
files = sorted(ROOT.glob('js/*.js')) + sorted(ROOT.glob('css/*.css')) + [ROOT / 'assets/art/manifest.js']
digest = hashlib.sha1(b''.join(f.read_bytes() for f in files if f.exists())).hexdigest()[:8]

def stamp(m):
    return f'{m.group(1)}{m.group(2)}?v={digest}"'
html = re.sub(r'((?:src|href)=")((?:js|css|assets/art)/[^"?]+\.(?:js|css))(?:\?v=[0-9a-f]+)?"', stamp, html)
html = re.sub(r'<script>window\.WIKIPONIA_V = "[0-9a-f]*";</script>', f'<script>window.WIKIPONIA_V = "{digest}";</script>', html)
if 'window.WIKIPONIA_V' not in html:
    html = html.replace('<link rel="stylesheet" href="css/', f'<script>window.WIKIPONIA_V = "{digest}";</script>\n  <link rel="stylesheet" href="css/', 1)
index.write_text(html)
print('stamped', digest)

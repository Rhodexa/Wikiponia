#!/usr/bin/env python3
"""Turn raw art from new_assets/ into app-ready WebP files in assets/art/.

    new_assets/<folder>/<pose>.png  ->  assets/art/<folder>/<pose>.webp
    (folder = a pony id, or bg / fx / brand)

What it does to each image:
  - cleans the alpha channel (AI tools leave near-opaque bodies and faint haze)
  - trims empty space around characters and props (not backgrounds)
  - shrinks to the largest size the app ever shows it at (x3 for sharp phones)
  - writes a WebP, and rebuilds assets/art/manifest.js so the app picks it up

Run:  python3 tools/process_assets.py          (only new/changed files)
      python3 tools/process_assets.py --force  (redo everything)
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SFX_OUT = ROOT / 'assets' / 'sfx'
AUDIO = {'.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aiff', '.aif'}
SRC = ROOT / 'new_assets'
OUT = ROOT / 'assets' / 'art'
EXTS = {'.png', '.webp', '.jpg', '.jpeg'}
SKIP_DIRS = {'intermediates', 'sfx'}

# Longest side, in pixels, by pose name prefix (first match wins).
LIMITS = [
    ('bust', 384), ('toast', 384), ('wax-seal', 256), ('icon', 512), ('mark', 512),
    ('library', 1800), ('map-table', 1800), ('shelf-tile', 1024), ('parchment', 768),
]
DEFAULT_LIMIT = 768
OPAQUE_FOLDERS = {'bg'}          # full-bleed scenes: keep opaque, don't trim
OPAQUE_POSES = {'parchment'}     # textures
SEQUENCE = re.compile(r'-\d{3}$')  # animation frames (run-000, run-001, ...): never trim, or they jitter


def limit_for(pose):
    for prefix, px in LIMITS:
        if pose.startswith(prefix):
            return px
    return DEFAULT_LIMIT


def process(src, dst, folder, pose):
    im = Image.open(src).convert('RGBA')
    w0, h0 = im.size
    notes = []
    opaque_ok = folder in OPAQUE_FOLDERS or pose in OPAQUE_POSES
    a = im.getchannel('A')
    lo, hi = a.getextrema()
    if not opaque_ok:
        if lo == 255:
            notes.append('NO TRANSPARENCY (background baked in, or a fake checkerboard?)')
        else:
            a = a.point(lambda v: 0 if v < 16 else 255 if v >= 240 else v)
            im.putalpha(a)
            box = a.getbbox()
            if box and not SEQUENCE.search(pose):
                edges = [n for n, hit in (('left', box[0] == 0), ('top', box[1] == 0),
                                          ('right', box[2] == w0), ('bottom', box[3] == h0)) if hit]
                if edges and not pose.startswith(('bust', 'toast')):
                    notes.append('touches edge: ' + ', '.join(edges) + ' (cut off?)')
                pad = round(max(box[2] - box[0], box[3] - box[1]) * 0.02)
                box = (max(0, box[0] - pad), max(0, box[1] - pad), min(w0, box[2] + pad), min(h0, box[3] + pad))
                im = im.crop(box)
    lim = limit_for(pose)
    if max(im.size) > lim:
        im.thumbnail((lim, lim), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if opaque_ok and lo == 255:
        im.convert('RGB').save(dst, 'WEBP', quality=86, method=6)
    else:
        im.save(dst, 'WEBP', quality=90, method=6)
    return (w0, h0), im.size, notes


import subprocess


def process_audio(src, dst, cut=None):
    """Trim leading silence, normalize loudness, mono MP3: snappy and even across the kit.
    cut = {start, end, fade_in, fade_out} takes a slice of the source first (see new_assets/sfx/splits.json)."""
    import subprocess
    dst.parent.mkdir(parents=True, exist_ok=True)
    pre, trim = [], []
    if cut:
        trim = ['-ss', str(cut.get('start', 0))] + (['-to', str(cut['end'])] if cut.get('end') is not None else [])
        if cut.get('fade_in'):
            pre.append(f"afade=t=in:d={cut['fade_in']}")
        if cut.get('fade_out') and cut.get('end') is not None:
            length = cut['end'] - cut.get('start', 0)
            pre.append(f"afade=t=out:st={max(0, length - cut['fade_out']):.3f}:d={cut['fade_out']}")
    af = ','.join(pre + ['silenceremove=start_periods=1:start_threshold=-45dB', 'loudnorm=I=-18:TP=-2:LRA=11'])
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', *trim, '-i', str(src), '-af', af, '-ac', '1', '-ar', '44100',
                        '-codec:a', 'libmp3lame', '-b:a', '96k', str(dst)], capture_output=True, text=True)
    if r.returncode:
        return None, r.stderr.strip()[:200]
    p = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(dst)],
                       capture_output=True, text=True)
    try:
        return float(p.stdout.strip()), None
    except ValueError:
        return 0.0, None


def main():
    force = '--force' in sys.argv
    if not SRC.exists():
        print('No new_assets/ folder yet.')
        return
    done = 0
    for src in sorted(SRC.rglob('*')):
        if src.suffix.lower() not in EXTS or not src.is_file():
            continue
        rel = src.relative_to(SRC)
        if any(part.lower() in SKIP_DIRS for part in rel.parts[:-1]):
            continue
        if len(rel.parts) < 2:
            print(f'skip  {rel}  (put it in a folder: new_assets/<pony>/<pose>.png)')
            continue
        # Use the last folder, so extracted zips (new_assets/new_assets/<pony>/...) work too.
        folder, pose = rel.parts[-2].lower(), src.stem.lower().replace(' ', '-').replace('_', '-')
        dst = OUT / folder / f'{pose}.webp'
        if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime and not force:
            continue
        (w0, h0), (w1, h1), notes = process(src, dst, folder, pose)
        kb = dst.stat().st_size / 1024
        print(f'ok    {folder}/{pose}  {w0}x{h0} -> {w1}x{h1}  {kb:.0f} KB' + ''.join(f'\n      ! {n}' for n in notes))
        done += 1

    # Sounds: new_assets/sfx/<name>.wav -> assets/sfx/<name>.mp3 (and slices from splits.json)
    sfx_dir = SRC / 'sfx'
    splits_file = sfx_dir / 'splits.json'
    splits = json.loads(splits_file.read_text()) if splits_file.exists() else {}
    jobs = []   # (src, name, cut)
    for src in sorted(sfx_dir.glob('*')) if sfx_dir.exists() else []:
        if src.suffix.lower() not in AUDIO:
            continue
        spec = splits.get(src.name)
        if spec and spec.get('slices'):
            jobs += [(src, n, cut) for n, cut in spec['slices'].items()]
            if not spec.get('keep_source', False):
                continue
        whole = {'start': 0, 'end': None, 'cues': spec.get('cues', {})} if spec and spec.get('cues') else None
        jobs.append((src, src.stem.lower().replace(' ', '-').replace('_', '-'), whole))
    newest_spec = splits_file.stat().st_mtime if splits_file.exists() else 0
    for src, name, cut in jobs:
        dst = SFX_OUT / f'{name}.mp3'
        fresh = dst.exists() and dst.stat().st_mtime >= max(src.stat().st_mtime, newest_spec if cut else 0)
        if fresh and not force:
            continue
        dur, err = process_audio(src, dst, cut if cut and (cut.get('start') or cut.get('end') is not None) else None)
        if err is None and cut and cut.get('cues'):
            # cues are in source seconds; shift by the slice start and by the leading silence we trimmed
            p = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(src)],
                               capture_output=True, text=True)
            src_dur = float(p.stdout.strip() or 0)
            expected = (cut['end'] if cut.get('end') is not None else src_dur) - cut.get('start', 0)
            trimmed = max(0.0, expected - dur)
            cues = {k: round(max(0.0, v - cut.get('start', 0) - trimmed), 3) for k, v in cut['cues'].items()}
            (SFX_OUT / f'{name}.json').write_text(json.dumps({'cues': cues, 'trimmed': round(trimmed, 3)}))
        label = f'{name} <- {src.name}' + (f" [{cut.get('start', 0)}s-{str(cut['end']) + 's' if cut.get('end') is not None else 'end'}]" if cut else '')
        print(f'sfx   {label}  ' + (f'{dur:.2f}s  {dst.stat().st_size / 1024:.0f} KB' if err is None else f'FAILED: {err}'))
        done += 1

    # Manifest: { folder: { pose: { src, w, h } } }, plus sfx: { name: { src } }
    manifest = {}
    for f in sorted(SFX_OUT.glob('*.mp3')) if SFX_OUT.exists() else []:
        entry = {'src': f.relative_to(ROOT).as_posix()}
        side = f.with_suffix('.json')
        if side.exists():
            entry.update(json.loads(side.read_text()))
        manifest.setdefault('sfx', {})[f.stem] = entry
    for f in sorted(OUT.rglob('*.webp')):
        with Image.open(f) as im:
            w, h = im.size
        manifest.setdefault(f.parent.name, {})[f.stem] = {'src': f.relative_to(ROOT).as_posix(), 'w': w, 'h': h}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'manifest.js').write_text('/* generated by tools/process_assets.py */\nwindow.ART = ' + json.dumps(manifest, indent=1) + ';\n')
    total = sum(len(v) for v in manifest.values())
    print(f'{done} processed, {total} in manifest.')
    import runpy
    runpy.run_path(str(ROOT / 'tools' / 'stamp_version.py'))   # cache-bust index.html


if __name__ == '__main__':
    main()

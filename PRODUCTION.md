# Wikiponia: production log

Where the art comes from, how it gets into the app, and what was decided along the way. Newest first.

## How art gets in

1. **Raw art** goes in `new_assets/<folder>/<pose>.png`, where the folder is a pony id, `bg`, `fx` or `brand`. Nested folders work too: the script uses the last folder name. `intermediates/` and `sfx/` are ignored.
2. `python3 tools/process_assets.py` cleans the transparency, trims, shrinks and writes WebP to `assets/art/` plus `assets/art/manifest.js`.
3. The app reads `window.ART`: every slot looks for new art first, then falls back to the old show SVGs in `assets/ponies/`.

**Animations** are numbered poses (`run-000.png`, `run-001.png`, …). The script never trims them, so they don't jitter, and `Ponies.frames(pony, 'run')` returns them in order.

**Testing:** `tools/cdp_drive.mjs` drives headless Chrome at phone size. Instructions are in its header.

---

## 2026-11-17: first sounds (book, party horn, Spike's burp)

- The user exported `book.wav`, `party-horn.wav` and `spike-burp.wav` from their Audacity pack (`new_assets/sfx/pack.aup3`, which isn't in git).
- `new_assets/sfx/splits.json` holds per-file sound options:
  - **slices:** `book.wav` becomes `book-magic` (the magical pad, 0–1.68 s, played while Twilight runs) and `page-turn` (from 1.66 s, played when the book opens and for chapters and cards). The page turn's attack was measured at 1.68 s.
  - **cues:** `spike-burp.wav` has its `pop` at 0.73 s, the moment the letter appears. The script stores it corrected for trimmed silence (0.68 s in the installed MP3), and Spike's Scroll starts the scroll's pop animation on that cue.
- To change a timing, edit the number in `splits.json` and rerun `tools/process_assets.py`. The sources are never modified.

## 2026-11-17: Git, sound system, Spike's real fire

- **Git:** the repo started on `main`, ready for GitHub Pages: all paths are relative and there's a `.nojekyll` file. `.gitignore` skips the zip (an identical copy of `new_assets/new_assets/`) and Audacity work files.
- **Sound:** `js/sound.js` (Web Audio, unlocked on the first tap) plus `tools/process_assets.py`, which turns `new_assets/sfx/<name>.wav` into trimmed, loudness-normalized MP3s in `assets/sfx/`. The hook names and fallbacks are in `ASSETS.md` → Sounds. The app is silent until sounds exist. There's a toggle in the Spellbook.
- **Spike's fire** is the show's own breath animation (FLA-RE `output/fx/stock_spike-fire-ref`), mirrored and imported as `fx/spike-fire-000…014`.
  - In Spike's Scroll it plays at 24 fps from the end of the AI burp's flame.
  - It's **aimed at runtime**: rotated around its source and scaled so its curl reaches the spot where the closed scroll pops out, on any screen.
- **Fix:** long titles on the open scroll now wrap and shrink, like the book cover.

## 2026-11-17: Twilight's gallop from the show rigs

- The stacks run plays `twilight/run-000…007`, an 8-frame back-view gallop at 24 fps.
- Source: FLA-RE `recipes/twilight_back_run.json`, rendered to `FLA-RE/output/retarget/twilight_back_run_v3/`. It's adult Sweetie Belle's S09E22 back-run rig with Twilight's coat colors, a recolored mane and Princess Twilight's real tail. Full notes are in `FLA-RE/RETARGET.md`.
- To re-import after changing the recipe:
  ```
  cd ../Studio/FLA-RE && python3 retarget.py recipes/twilight_back_run.json
  cd - && for f in ../Studio/FLA-RE/output/retarget/twilight_back_run_v3/f00[0-7].svg; do
    magick -density 300 -background none "$f" -resize x900 "new_assets/twilight/$(basename $f .svg | sed 's/^f/run-/').png"; done
  python3 tools/process_assets.py
  ```
- Also kept in FLA-RE for later: adult Apple Bloom's three-quarter rear run (the user wants it for something), adult Scootaloo's run, and the genuine Princess Twilight three-quarter rear walk (627 frames).
- Ideas from the user, not built yet:
  - a **side-view library**, where Twilight's side run `~TS_Prun_Character` works, with different books and animations
  - **Spike's fire**: `spike_fire_fire_ref` in `stk_c07_spike_the_dragon.fla`, and the fire effects in `STK_F18_fire.fla` (binary format) recolored green

## 2026-11-17: Cutie Map in 3D

- `js/map3d.js` is the toon-shaded `assets/models/cutie-map.glb` (made in Tripo from the user's "Pastel Equestria Cutie Map v2"). It uses a 3-step cel ramp and an inverted-hull outline in `#1E98D5`, the blue of Rainbow Dash's mane in the show file.
- The graph is a hologram plane above the table. Nodes are still SVG, but their positions come from the 3D projection, so dragging orbits the camera.
- The user rejected the first version, a flat graph floating over the table, because it slid and bounced. They also flagged a hard horizontal line, which came from a CSS beam and is now a 3D light cylinder.
- three.js 0.160.0 comes from jsDelivr through an importmap. Without WebGL, the tab falls back to the flat map.

## 2026-11-16: art batch 1 (AI-assisted, by the user)

- 49 assets: busts, toast poses, full-body moments, scenes and props. See `ASSETS.md` for the list, the prompt kit and the style block.
- The Luna test set the template: show style, real transparency, facing right, an expressive bust.

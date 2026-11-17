# Wikiponia: asset wishlist (raster + AI edition)

Status (batch 1 is in): **49 of 51 assets are live in the app.** Every bust, toast, full-body pose, scene and prop has been processed and wired in.

Still open:
- ✅ `twilight/run-000…007`: a real 8-frame back-view gallop, retargeted in FLA-RE from adult Sweetie Belle's S09E22 back run with Twilight's colors and her real tail (`FLA-RE/recipes/twilight_back_run.json`, notes in `FLA-RE/RETARGET.md`). The stacks run plays any numbered `<pony>/<name>-NNN` sequence.
- ⏸ `fx/dragonfire/`: Spike's fire as real animation frames from the show sources. The current single image works until then.
- ✅ `assets/models/cutie-map.glb`: the 3D table (from `intermediates/`), live in the Cutie Map tab with toon shading and outlines. To swap the model, replace that file.
- ➕ *(optional)* `discord/snap`
- ➕ *(optional)* a loading animation; the current one is a CSS flipping book.
- ➕ *(optional)* sounds

---

## How it works now

1. Generate an image (AI, by hand, or both).
2. Save it as `new_assets/<folder>/<pose>.png`. The folder is a pony id (`twilight`, `pinkie`…) or `bg`, `fx`, `brand`; the pose is the file name listed below.
3. Run `python3 tools/process_assets.py`.
4. Refresh the app. Anything in the **wired** list below shows up by itself.

The script handles all the cleanup, so you don't need to:
- It fixes AI transparency quirks. Your Luna's body was 99% opaque (alpha 253), with a faint invisible haze across 4% of the canvas.
- It trims the empty space and shrinks to the size the app actually uses: Luna went from a 1 MB PNG to a 22 KB WebP.
- It warns you if an image has **no real transparency** or is **cut off at an edge**.

So: deliver big, don't worry about exact sizes, and don't bother cropping.

---

## Feedback on the Luna test

It's a keeper. What made it work, so you can repeat it:
- **Show-accurate style:** colored outlines darker than the fill (not black), one flat shadow tone, show-style eyes and eyeshadow, stars in the mane, the correct crescent on the peytral.
- **Real transparency,** not a painted checkerboard.
- **Faces right,** toward the speech bubble.
- **Expression with attitude** (the smug, raised-eyebrow look), which reads well even at 56 px.
- **Bust framing:** head and shoulders, cut off at the chest by the bottom edge, horn fully in frame. Reuse this framing for every bust.

The one thing I adjusted is on my side: in night mode, her navy coat almost sank into the dark cards, so the app adds a soft moonlight glow to all new art at night.

---

## Prompt kit

### 1. Style block (paste at the start of every prompt)

> Style: 2D vector cartoon in the visual language of *My Little Pony: Friendship Is Magic* (2010 series), as if exported from Adobe Flash. Flat color fills with one cel-shadow tone, clean colored outlines slightly darker than each fill (never black), show-accurate large eyes with highlights. No painterly texture, no 3D, no gradients except where the show uses them (eyes, magical manes). Minimal and clean, Flash-game vibe. **Transparent background (real alpha; no checkerboard, no white box, no floor, no frame).** One character only, nothing else in frame unless specified. No text, no watermark, no signature, no border.

### 2. Consistency trick

**Attach `new_assets/luna/bust.png` as a reference image** to every prompt, with a line like: *"Match the style, line weight and shading of the reference image exactly; it's from the same set."* Once a pony has a bust you like, attach that pony's bust too when making its other poses.

Batching by type helps as well: do all the busts in one session, then all the toast poses.

### 3. Framings (refer to these by name in prompts)

| Name | What | Canvas | On screen |
|---|---|---|---|
| **BUST** | Head and shoulders, cut off at the chest by the bottom edge, like the Luna test | square | 56–92 px |
| **POP-UP** | Upper body leaning into frame from the bottom edge, as if popping up from below the screen, cut off at the bottom; expressive | square | 92 px wide |
| **FULL** | Full body with a small soft ground shadow, whole character in frame with margin | square | 200–280 px |
| **SCENE** | Full-bleed background, opaque, no characters | landscape | full width |
| **PROP** | A single object, transparent background | square | 100–320 px |

Every character should **face right (toward the viewer's right)** unless noted. If one comes out facing left, keep it; I can mirror it.

### 4. Character canon checklist

AI tends to drift on these details, so check them before saving:

| Pony | Must-haves |
|---|---|
| twilight | lavender coat, dark indigo mane with a pink and violet streak, horn, magenta six-point star cutie mark (no wings unless you want princess Twilight) |
| pinkie | pink coat, very curly magenta mane, blue eyes, three balloons (2 blue, 1 yellow) |
| rainbow | sky-blue coat, rainbow mane, magenta eyes, wings, cloud with tri-color lightning bolt |
| applejack | orange coat, freckles, blonde mane tied with red bands, brown stetson, green eyes, three red apples |
| rarity | white coat, styled purple curled mane, horn, blue eyes with eyeshadow, three blue diamonds |
| fluttershy | butter-yellow coat, long pink mane over one eye, teal eyes, wings, three pink butterflies |
| spike | purple baby dragon, green spines and belly, green eyes |
| celestia | white alicorn, flowing cyan/teal/green/pink "aurora" mane, gold crown and peytral, magenta eyes, sun cutie mark |
| luna | ✅ done (bust) |
| discord | draconequus: pony head, goat horn plus deer antler, one fang, eagle claw plus lion paw, snake-like tail, mismatched everything |
| trixie | light-blue coat, silvery-white mane, purple eyes, horn, wand-and-moon cutie mark; often a starry purple hat and cape |
| derpy | grey pegasus, blonde mane, yellow eyes that look in different directions, bubbles cutie mark |
| lyra | mint-green unicorn, mint and white mane, golden eyes, golden lyre cutie mark |
| octavia | grey earth pony, black mane, violet eyes, pink bow tie, treble-clef cutie mark |
| starlight | lilac unicorn, purple mane with a teal streak, violet eyes, starry-staff cutie mark |
| bonbon | cream earth pony, navy mane with a pink streak, three wrapped candies |

### 5. Quick quality check on each result

- [ ] Real transparency: open it on a dark background and check that no checkerboard or white box shows
- [ ] Faces right (or is fine to mirror)
- [ ] Correct cutie mark, eye color and accessories (see the checklist)
- [ ] Horns and wings only on the right ponies; four legs; no extra ears
- [ ] No text, signature or watermark
- [ ] Matches the Luna test's style (outline color, flat shading)

---

## The list

✅ = done · 🔌 = **wired**, so dropping the file in makes it appear automatically · 🛠 = I'll do the layout when it arrives

### Priority 1

| | File | Framing | Prompt idea | Where it shows |
|---|---|---|---|---|
| ✅ | `luna/bust` | BUST | — | annotation box, toasts |
| 🔌 | `luna/raise-moon` | POP-UP | Luna proudly raising the moon with her glowing horn, a crescent moon floating behind | night-mode toast |
| 🔌 | `celestia/raise-sun` | POP-UP | Celestia cheerfully raising a glowing sun, warm smile | day-mode toast |
| 🔌 | `twilight/hero-welcome` | FULL | Twilight standing, levitating a stack of books with her magic, waving hello with one hoof | home banner (new visitors) |
| 🔌 | `twilight/hero-returning` | FULL | Twilight bouncing excitedly, hugging a book to her chest | home banner (returning visitors) |
| ⏸ | `twilight/run-a` and `twilight/run-b` | FULL | **On hold:** may come from the original show rigs instead (Nirik's gallop experiments), which would give a real multi-frame cycle. The AI fallback: Twilight galloping **away from the viewer, seen from behind (3/4 rear view)**, as two frames, legs extended (a) and legs gathered (b). | the run through the stacks (alternates a/b; I'll extend it to a full frame sequence if the rigs pan out) |
| 🔌 | `twilight/found-it` | FULL | Twilight turned toward the viewer, triumphantly levitating one glowing book above her head | "Found it!" moment |
| 🔌 | `discord/starfleet` | POP-UP | Discord in a red Starfleet-style uniform tunic doing the Vulcan salute with his lion paw, smug | Star Trek gag toast (for your dad) |
| 🛠 | `spike/burp` | FULL | Spike mid-burp, a puff of green dragonfire bursting from his mouth | Spike's Scroll overlay |
| 🛠 | `fx/scroll-open` | PROP | an open parchment scroll, landscape, wooden rollers top and bottom, **blank center** (I write the article title there) | Spike's Scroll overlay |

### Priority 2: busts (BUST framing, all 🔌)

`twilight` · `pinkie` · `rainbow` · `applejack` · `rarity` · `fluttershy` · `spike` · `celestia` · `trixie` · `discord` · `derpy` · `lyra` · `octavia` · `starlight` · `bonbon`

Each one is `<pony>/bust`. Give every bust a **personality expression**, not a neutral face:

| Pony | Expression idea |
|---|---|
| twilight | delighted, glasses perched on her nose, quill behind ear |
| pinkie | huge grin, a bit of confetti in her mane |
| rainbow | smug grin, one eyebrow up |
| applejack | tipping her hat, friendly smirk |
| rarity | eyes half-closed, hoof to her chest, dramatic |
| fluttershy | shy smile, half hidden behind her mane, a bunny peeking in |
| spike | cheeky grin, quill behind his ear |
| celestia | serene, warm, regal |
| trixie | chin up, smug, hat and cape |
| discord | scheming smirk, claw to chin |
| derpy | happy, eyes in different directions, holding a muffin |
| lyra | wide-eyed, sitting like a human (if it fits the frame) |
| octavia | unimpressed, half-lidded |
| starlight | slightly-too-wide friendly smile |
| bonbon | sunglasses, serious secret-agent look |

### Priority 2: toast reactions (POP-UP framing, all 🔌)

| File | The line it reacts to | Pose idea |
|---|---|---|
| `twilight/toast-tip` | "Tap any blue link to cross-reference it…" | raising a hoof like a teacher, helpful smile |
| `twilight/toast-gotcha` | "Cross-referenced! 3 tomes are cited by both books." | excited, sparkles around her |
| `twilight/toast-scold` | "Discord! Put the article back!" | annoyed, ears back, glaring to the left |
| `twilight/toast-meta` | "Wait… is this article about… *us*?" | staring straight at the viewer, a sweat drop |
| `pinkie/toast-wave` | "Fourth wall? What fourth wall?" | leaning in close, waving at the viewer |
| `rarity/toast-sniff` | "Our rival encyclopedia. So… unadorned." | nose in the air, disdain |
| `fluttershy/toast-aww` | "Oh my… distant cousins!" (horse articles) | hooves to cheeks, teary-eyed joy |
| `spike/toast-salute` | saddlebag added, "you've read 4 books!" | saluting proudly |
| `spike/toast-burp` | "*burp* Sent!" (friendship report) | hand over mouth, a little green smoke |
| `derpy/toast-oops` | "I dropped that book. Try again?" | sheepish, books tumbling |
| `lyra/toast-smug` | "I ponified 12 passages. You're welcome." | smug, holding a pencil with a *hand-like* grip |

### Priority 2: full-page moments (FULL framing, all 🔌)

| File | Prompt idea | Where |
|---|---|---|
| `derpy/error` | Derpy who just crashed into a pile of books, dazed, smiling | "I just don't know what went wrong!" |
| `fluttershy/no-results` | Fluttershy hiding behind her own mane, apologetic | search found nothing |
| `twilight/blank-map` | Twilight looking puzzled at an empty glowing map, hoof on chin | empty Cutie Map |
| `spike/journal-writing` | Spike writing on a very long scroll with a quill, tongue out in concentration | Journal tab header |
| `celestia/reading-letter` | Celestia reading a scroll, gently smiling (POP-UP framing is also fine) | under the friendship report |

### Priority 3: scenes and props (all 🛠)

| File | Framing | Prompt idea | Notes |
|---|---|---|---|
| `bg/library-day` | SCENE | inside a library carved into a giant hollow tree, curved wooden walls with shelves cut into the trunk, a round window with sunlight, warm and cozy, no characters | I'll put Twilight on the left and the speech bubble on the right, so **keep the bottom fairly simple** |
| `bg/library-night` | SCENE | the same library at night, moonlight through the round window, a candle | ask for "the same room at night" right after the day version |
| `bg/shelf-tile` | SCENE | a straight-on wall of bookshelves, 4–5 rows of chunky colorful books, an occasional odd item (a cupcake, an owl, a skull) | I'll make it tile seamlessly |
| `bg/map-table` | SCENE | a top-down view of a dark teal and purple crystal table surface with a faint etched fantasy map, subtle, dim | goes under the glowing Cutie Map nodes, so **dim and low-detail** |
| `fx/scroll-closed` | PROP | a rolled parchment scroll with a red ribbon and wax seal | pops out of Spike's flame |
| `fx/dragonfire` | PROP | a puff of bright green magical dragon fire with sparkles | Spike's Scroll burst |
| `fx/wax-seal` | PROP | a round red wax seal, **plain center** (I stamp the cutie mark in it) | friendship report |
| `fx/book-cover` | PROP | a closed hardcover book, front view, portrait, gold corner trims, **blank cover** | the book that flies at the screen |
| `fx/spellbook` | PROP | an open, glowing spellbook with sparkles | Settings sheet header |
| `brand/mark` | PROP | an emblem: a puzzle-piece globe (like Wikipedia's logo) with a unicorn horn and sparkles | top-bar icon, favicon, phone home-screen icon |

**Skip asking an AI for:** the "Wikiponia" wordmark (AI text comes out garbled). Hand-letter it if you like; otherwise I'll keep the typeset one.

---

## Optional: sounds (from your samples)

All short (under 1 s), quiet, and toggleable in settings. Put them in `new_assets/sfx/`.

`page-turn` · `magic-zap` (book opens) · `whoosh-loop` (stacks run, ~1.2 s) · `spike-burp` · `party-horn` · `discord-snap` · `tap-sparkle`

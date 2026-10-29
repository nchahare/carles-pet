# Carles Pet

A small pixel-art desktop pet: **Carles**, a chibi man with a beard, a moustache and a pink shirt. He and every one of his 38 animations are **drawn in code** from coloured blocks, with no image files. He lives on your Windows taskbar (on any of your screens), says things in Catalan in speech bubbles, and you can view and tune his animations in a browser page.

**Status:** the character, the animations and the Windows desktop pet (with a tray menu) are done. Publishing a release is next (see [Roadmap](#roadmap)).

---

## Quick start

**Desktop pet (Windows):** with [Python 3](https://www.python.org/) installed (tested with 3.12; only the standard library is used), run

```
pythonw -I desktop\carles_pet.py
```

He appears on the taskbar. Right-click him, or click his icon by the clock, for the menu. See [The desktop pet](#the-desktop-pet).

Easier ways to start him:
- **Desktop shortcut:** run `powershell -ExecutionPolicy Bypass -File desktop\make-shortcut.ps1` once. It puts a "Carles" shortcut with his icon on your desktop. Run it again if you move the folder or reinstall Python.
- **Double-click** `desktop\start-carles.cmd`.
- **Every time you log in:** tick "Start with Windows" in his menu.

**Animation Lab:** open `index.html` in a browser by double-clicking it. Nothing needs to be installed and there's no build step.

```
carles-pet/
  index.html                 the Animation Lab page for viewing and tuning
  carles.js                  the character, his props and all animations (plain JS, global `Carles`)
  tools/bake.html            samples every animation into frames for the desktop pet
  tools/bake.ps1             runs the bake in headless Edge -> desktop/carles-frames.json
  desktop/carles-frames.json the baked frames (generated; commit it after re-baking)
  desktop/carles_pet.py      the desktop pet (Python + tkinter, Windows)
  desktop/frases.md          what he says in his speech bubbles (edit it freely)
  desktop/start-carles.cmd   double-click launcher
  desktop/make-shortcut.ps1  creates a desktop shortcut (and desktop/carles.ico, not tracked)
  README.md
  LICENSE                    CC0 1.0
```

## The Animation Lab (`index.html`)

| Area | What it does |
|---|---|
| Left list | All animations grouped: Basic, Movement, Activities, Rest, Reactions, Moods |
| Stage | The selected animation on a floor line. "Travel" animations (walk across, scuttle, hop along, carry) move across and turn at the edges |
| Controls | Play/pause, step frames, restart, loop, speed 0.25–2×, size S–XL, shirt colour, block grid, facing left/right |
| Frames strip | Every keyframe of the current animation. Click one to jump to it |
| Gallery | Every animation looping side by side. Click one to select it |

**Keys:** `Space` play/pause · `←` `→` step frames · `↑` `↓` previous/next animation · `G` grid · `F` flip · `R` restart

**URL options:**
- `index.html?anim=build&t=800&paused=1` opens one animation frozen at 800 ms. Add `&size=8` or `&grid=1` as needed.
- `index.html?sheet=1` shows a contact sheet with every frame of every animation. Add `&unit=4` to zoom and `&only=build,nap` to limit it.

The selected animation is remembered in `localStorage`.

---

## How Carles is drawn (`carles.js`)

### Units and coordinates
- **1 unit = 1 character "pixel"**, and the art is built on blocks of 2 units.
- Carles is **16 × 22 units**:
  - head 16 × 12, with a 2-unit hair band and a strip down the back
  - beard on the bottom 3 rows, with a sideburn
  - 6 × 1 moustache, and 2 × 2 eyes on the front half
  - shirt 12 × 6, hands 2 × 2, two legs of 4 × 4
- `x = 0` is his centre and `y = 0` is the ground, with **y increasing upward**. He faces right by default.
- At render time each unit becomes `scale` canvas pixels, drawn as crisp `fillRect`s.

### A pose is just numbers
Every frame is a **pose object**. `BASE` is the neutral pose, and animations start and end on it so they can be chained.

| Field | Meaning |
|---|---|
| `x`, `y` | Offset in units (`y` = height above the ground, for jumps) |
| `bh` | Extra shirt height, for breathing (±1) and crouching (−1) |
| `legH` | Leg length: 4 normal, 5–6 tiptoe or dangling, 0 crouched on the ground |
| `lift` | Per-leg lift `[back, front]` for walking and stomping |
| `armL`, `armR` | A number slides the hand up (+) or down (−). `'up'` raises the arm above the head, `'out'` holds it straight out |
| `eyes` | `open` · `line` (closed) · `happy` (^ ^) · `wide` · `angry` · `sad` · `none` |
| `lx`, `ly` | Where the eyes look (±1). `lx: -2` puts them mid-face: the front view used while turning |
| `mouth` | `null` · `'o'` · `'O'` |
| `blush` | Pink cheek |
| `red` | Face flushed red (angry) |
| `facing` | `1` right, `-1` left. The whole drawing is mirrored |
| `props` | List of attached sprites (see below) |
| `clip`, `clipBack` | x of a "screen edge" that hides everything past it, used by Peek. `clipBack` hides the side behind him instead |

`Carles.draw(ctx, pose, { x, y, scale, facing, palette })` renders a pose. Here `y` is the ground line on the canvas.

### Props and sprites
- `SPRITES` are small pixel drawings written as rows of palette letters, top row first, with `.` for empty.
- A prop is `{ s: spriteName, a: anchor, dx, dy }`, built with the helper `P(s, a, dx, dy)`.
- **Anchors:**
  - `head`: top centre of the head
  - `handL` / `handR`: the outer corner of a hand
  - `body`: bottom centre of the shirt
  - `ground`: on the floor, ignoring jumps
- `headphones` and `glasses` are drawn by code because they follow his head and eyes.
- **Palette letters:**
  - `o` shirt (pink `#E86AA0`, changed by the colour picker), `s` skin, `R` flushed skin, `h` hair, `d` beard, `t` trousers
  - `k` eyes, `i` ink (symbols, switched for dark mode), `w` white
  - `g`/`G` grey, `b` wood, `y` yellow, `r` red, `p` pink, `B` navy, `n` blue, `c`/`C` cardboard

### Animations
An animation is a list of **stepped keyframes**, like GIF frames:

```js
add('hop', 'Happy hop', 'Reactions', seq([
  [250, {}],                                   // [duration ms, changes from BASE]
  [120, { bh: -1, legH: 3 }],                  // crouch
  [140, { y: 6, legH: 5, eyes: 'happy' }],     // in the air
  [120, { bh: -1, legH: 3 }],                  // land
  [260, {}],
]));
```

`add()` options:
- `loop`: false for one-shot animations.
- `travel`: units per second, for animations that move across the stage.
- `extra(t, pose, frameIndex)`: changes the pose continuously, for floating z's, notes, hearts, gravity, juggling balls and confetti.

To add an animation, write an `add(...)` block in `carles.js`. It appears automatically in the list, the gallery and the sheet.

### All 38 animations

| Group | Animations (`id`) |
|---|---|
| Basic | idle, blink, look, fidget |
| Movement | walk, walkAcross\*, turn, scuttle\*, hopAlong\*, peek |
| Activities | build, groove, dance, think, read, type, sweep, carry\*, juggle |
| Rest | stretch¹, yawn¹, nap, wake¹, sit |
| Reactions | hop, doubleJump, annoyed, giggle, dangle, fall, land, love, surprised |
| Moods | sad, excited, tired, celebrate, angry |

\* moves across the stage (`travel`) · ¹ plays once (`loop: false`)

Idle and Look around turn him to face left for a few seconds, so he doesn't always look the same way.

### Checking frames without a browser window
Headless Edge or Chrome can render the contact sheet to a PNG:

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu `
  --hide-scrollbars --window-size=1900,1300 --virtual-time-budget=2000 `
  --screenshot="$env:TEMP\sheet.png" "file:///<path to>/carles-pet/index.html?sheet=1&unit=4&only=build,nap"
```

---

## The desktop pet

A frameless, always-on-top window just big enough for Carles, standing on the taskbar of one of your screens. Clicks pass through the empty space around him. He has no taskbar button, doesn't appear in Alt+Tab, and clicking him doesn't take focus from your window. Only one copy runs at a time.

### What he does

| Situation | Behaviour |
|---|---|
| On his own | Picks idle, walk, build, groove, read, dance, think, sweep or carry for 5–10 s. Never the same one twice in a row |
| Walking | To a random spot at about 50 px/s, facing the way he walks. About 1 walk in 5, he walks off a screen edge, peeks back in and waves, then walks back on |
| 60 s without mouse or keyboard input | stretch → yawn → nap. Any input plays wake |
| Taps | 1 tap → hop, 2 → doubleJump. 3 taps within about 5 s tickle him (giggle and a happy bubble). The 6th tap within 5 s makes him angry (angry and an angry bubble). A tap starts about 0.3 s later, while he waits to see if another one follows |
| Talking | Every so often (see Talk in the menu) a speech bubble over his head shows a random phrase from `desktop/frases.md`. It follows him as he walks, stays a few seconds, and closes when you click it |
| Coming and going | With Appear set to a time, he visits: he walks in, peeks in from a side or drops in from the top, at a random spot on a random screen, says hello, stays a minute or two, says goodbye and walks off. He only comes back while you're at the computer |
| More than one screen | Now and then he walks off one screen and drops in on another. Drag him onto any screen and he falls to its taskbar |
| Pointer resting on him (about 2 s) | love, until the pointer moves away |
| Drag | dangle from the pointer while held, then he falls to the taskbar and lands (fall → land) |
| Full-screen app, game or presentation in front | He hides and stops completely, and comes back afterwards |
| Windows dark mode | Symbols (z, !) switch to a light colour |

His own activity changes wait for the end of an animation cycle, so he's always back on `BASE`. Reactions to you (clicks, drag, hover, waking) start straight away.

### The menu
Right-click him, or click his icon in the notification area (it may be under the `^` at first):

| Item | What it does |
|---|---|
| Size | 0.75×, 1× (about 88 px tall at 100 % display scaling), 2× or 3× |
| Shirt colour | Pink, red, orange, yellow, green, teal, blue, purple or grey. The tray icon follows |
| Talk | How often he says something: Often (about every minute), Sometimes (about 5 min, the default), Rarely (about 15 min) or Never |
| Appear | Always here (the default), or come and go: away for about 5 min, 15 min or an hour between visits |
| Say something | A random phrase now. While he's away this is **Come here now** instead |
| Pause | He stands still and ignores clicks until you untick it |
| Start with Windows | Adds or removes him in your user's startup list (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, value `CarlesPet`). It's also listed in Task Manager → Startup apps |
| Quit | Closes him |

Size, shirt colour, Talk and Appear are remembered in `%APPDATA%\CarlesPet\settings.json`. Delete that file to go back to the defaults.

**Testing options:** `pythonw -I desktop\carles_pet.py nap` limits him to one animation, and `--sleep-after 10` makes him nap after 10 s instead of 60. `python -I desktop\carles_pet.py --save-icon carles.ico` writes his icon file.

### What he says (`desktop/frases.md`)
A Markdown file of phrases, in Catalan. Each `- ` line is one phrase, grouped under headings: `## Hello` (arriving), `## Bye` (leaving), `## Happy` (tickled), `## Angry` (tapped too much). Every other heading, like `## Random`, adds to the random chatter. Lines before the first heading are notes and are ignored. He reads the file again whenever it changes, so there's no need to restart him.

**Resource use** (measured on Windows 11): about 0.1 % CPU and 15 MB of memory. He only redraws when a frame changes and sleeps in between.

### How it works: bake, then play
`carles.js` stays the single source of truth, and the desktop pet never runs JavaScript:

1. **Bake.** `tools/bake.html` loads `carles.js` and samples every animation at its keyframes, plus every 66 ms for continuous effects (z's, hearts, confetti). Each frame is painted onto a unit grid exactly as `draw()` paints it (including peek's screen-edge clip), packed back into rectangles, and stored for both facings. Facing left isn't a plain mirror, because symbols like z and ! must stay readable. Identical consecutive frames are merged into one frame with a longer duration.
2. **Play.** `desktop/carles_pet.py` reads `desktop/carles-frames.json` and draws the rectangles on a tkinter canvas at the chosen scale.

**After changing `carles.js`, re-bake:**

```powershell
powershell -ExecutionPolicy Bypass -File tools\bake.ps1
```

This needs Microsoft Edge (or change the path in the script to Chrome). To check the bake, open `tools/bake.html?view=1&unit=3` (add `&only=nap,peek` to limit it). It shows every baked frame above the live `draw()` of the same moment. The first line counts the frames whose pixels differ, which should be 0. The lab's grey peek edge is ignored, because on the desktop the real screen edge does that job.

**The frame file** (`carles-frames.json`):
- `keys` and `colors` are the palette: letter → `#RRGGBB`, plus `_shadow` (`#RRGGBBAA`).
- `anims` is a list of `{ id, name, group, loop, travel, dur, frames }`.
- Each frame is `{ t, d, R, L }`: start time and duration in ms, then flat rectangle lists `[x, y, w, h, colourIndex, ...]` facing right (`R`) and left (`L`).
- Units are character pixels with `y` up and `y = 0` as the ground. The shadow row is `y = -1`.
- Peek frames also have `eR`/`eL`: `[x, side]` of the screen edge that clips him.

**Desktop limitations:**
- The window uses one see-through colour (tkinter's `-transparentcolor`), so the soft ground shadow is left out.
- Every screen uses the scale of the main screen, so on a screen with different display scaling he looks a little soft.
- If the taskbar moves while he runs, restart him.

## Roadmap

- **Next:** a GitHub release with a short "how to install" for people who aren't developers.
- **Ideas:** a custom shirt colour picker, standing on top of windows, and small visual fixes (for example, the cursor drawn while he dangles is hard to see on dark backgrounds).

---

## License
Released into the public domain under [CC0 1.0 Universal](LICENSE). You can copy, change and use it for anything, with no permission or credit needed.

Built with AI-assisted coding.

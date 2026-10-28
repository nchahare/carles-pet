# Carles Pet

A small pixel-art desktop pet: **Carles**, a chibi man with a beard, a moustache and a pink shirt. He and every one of his 36 animations are **drawn in code** from coloured blocks, with no image files. You can view and tune the animations in a browser page.

**Status:** the character and animations are done. The desktop app itself is next (see [Roadmap](#roadmap)).

---

## Quick start

Open `index.html` in a browser by double-clicking it. Nothing needs to be installed and there's no build step.

```
carles-pet/
  index.html     the Animation Lab page for viewing and tuning
  carles.js      the character, his props and all animations (plain JS, global `Carles`)
  README.md
  LICENSE        CC0 1.0
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
  - `o` shirt (pink `#E86AA0`, changed by the colour picker), `s` skin, `h` hair, `d` beard, `t` trousers
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

### All 36 animations

| Group | Animations (`id`) |
|---|---|
| Basic | idle, blink, look, fidget |
| Movement | walk, walkAcross\*, turn, scuttle\*, hopAlong\*, peek |
| Activities | build, groove, dance, think, read, type, sweep, carry\*, juggle |
| Rest | stretch¹, yawn¹, nap, wake¹, sit |
| Reactions | hop, doubleJump, annoyed, dangle, fall, land, love, surprised |
| Moods | sad, excited, tired, celebrate |

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

## Roadmap

### Next: the desktop pet
A transparent, frameless, always-on-top window where Carles stands on the taskbar. It's click-through except on him.

Planned behaviour:

| Situation | Behaviour |
|---|---|
| Idle | Random pick of idle, walk, build, groove, read, dance, think, sweep or carry. Never the same one twice in a row |
| Walking | Toward a random spot, facing the way he walks and turning at screen edges |
| 60 s with no mouse activity | stretch → yawn → nap. Moving the mouse plays wake |
| Click | 1 click → hop, double-click → doubleJump, 4 fast clicks → annoyed, hover → love |
| Drag | dangle while held, then fall → land when released |
| Screen edge | peek |

Technology is still open. Electron would reuse `carles.js` unchanged, and Python + PySide6 is the other option.

---

## License
Released into the public domain under [CC0 1.0 Universal](LICENSE). You can copy, change and use it for anything, with no permission or credit needed.

Built with AI-assisted coding.

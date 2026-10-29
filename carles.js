/*
 * Carles — a code-drawn pixel character: a small chibi man with a beard and a pink shirt.
 * No images: every frame is built from coloured blocks.
 *
 * Units: 1 unit = 1 "pixel" of the character; the art's blocks are 2 units.
 * He is 16 × 22 units: legs 4 × 4, shirt 12 × 6, hands 2 × 2, head 16 × 12, eyes 2 × 2.
 * Coordinates: x = 0 is his centre, y = 0 is the ground, y grows upward.
 * He faces right by default, so the face sits on the right half of the head.
 */
(function (root) {
  'use strict';

  const PALETTE = {
    o: '#E86AA0', // shirt, pink (the preview's colour picker overrides 'o')
    s: '#E8AE74', // skin
    R: '#E2725B', // skin flushed red (angry)
    h: '#151515', // hair
    d: '#3B2618', // beard and moustache
    t: '#3A2A4E', // trousers
    k: '#111111', // eyes
    i: '#2a2622', // ink for floating symbols (!) — the preview swaps it for dark mode
    w: '#ffffff',
    g: '#a7b0ba', // light grey
    G: '#5d6772', // dark grey
    b: '#8a5a3c', // wood
    y: '#f5c542', // yellow
    r: '#e0443e', // red
    p: '#f28cb1', // pink
    B: '#1f3f7a', // navy
    n: '#3d6fb6', // blue
    c: '#c9975b', // cardboard
    C: '#a8753f', // cardboard edge
  };

  // The neutral pose every animation starts and ends on.
  const BASE = {
    x: 0, y: 0,          // offset in units (y = height above ground)
    bh: 0,               // extra shirt height (breathing)
    legH: 4,             // leg length; 0 = crouched on the ground
    lift: [0, 0],        // per-leg lift off the ground [back, front]
    armL: 0, armR: 0,    // hand slide up (+) / down (-), 'up' raised over the head, 'out' held straight out
    eyes: 'open',        // open | line | happy | wide | angry | sad | none
    lx: 0, ly: 0,        // where the eyes look
    mouth: null,         // null | 'o' | 'O'
    blush: false,
    red: false,          // face flushed red
    facing: 1,           // 1 = right, -1 = left
    props: [],           // [{ s: spriteName, a: anchor, dx, dy }]
    clip: null,          // x of a screen edge he can hide behind (peek)
    clipBack: false,     // hide the side behind him instead of in front
  };

  // Sprites are rows of palette letters, top row first; '.' is empty.
  const SPRITES = {
    hammerUp:   ['ggggg', 'ggggg', '..b..', '..b..', '..b..', '..b..'],
    hammerDown: ['.....ggg', '.....ggg', 'bbbbbggg', '.....ggg', '.....ggg'],
    object:     ['..yy..', '.gggg.', 'GGGGGG', 'GGGGGG'],
    spark:      ['.y.', 'yyy', '.y.'],
    dust:       ['.g.', 'g.g'],
    note:       ['..nn', '..n.', '..n.', 'nnn.', 'nnn.'],
    zBig:       ['iiii', '..i.', '.i..', 'iiii'],
    zSmall:     ['iii', '.i.', 'i..', 'iii'],
    dotS:       ['gg', 'gg'],
    dotM:       ['ggg', 'ggg', 'ggg'],
    dotL:       ['.gg.', 'gggg', 'gggg', '.gg.'],
    bulb:       ['.yyy.', 'yywyy', 'yyyyy', 'yyyyy', '.yyy.', '.ggg.', '..g..'],
    anger:      ['.r.r.', 'rr.rr', '.....', 'rr.rr', '.r.r.'],
    excl:       ['ii', 'ii', 'ii', '..', 'ii'],
    heart:      ['.pp.pp.', 'ppppppp', 'ppppppp', '.ppppp.', '..ppp..', '...p...'],
    heartS:     ['p.p', 'ppp', '.p.'],
    cursor:     ['k....', 'kk...', 'kwk..', 'kwwk.', 'kwwwk', 'kwkkk', 'kk...'],
    book:       ['wwwwwBBwwwww', 'nnnnnBBnnnnn', 'nnnnnBBnyyyn', 'nnnnnBBnnnnn', 'nnnnnBBnnnnn'],
    pageR:      ['..www', 'wwwww'],
    pageM:      ['ww', 'ww', 'ww'],
    pageL:      ['www..', 'wwwww'],
    keyboard:   ['GGGGGGGGGGGGGG', 'GgGgGgGgGgGgGG', 'GGGGGGGGGGGGGG'],
    keypop:     ['w'],
    broomOut:   ['b......', '.b.....', '..b....', '..b....', '...b...', '...b...',
                 '.yyyyy.', 'yyyyyyy', 'yyyyyyy', 'y.y.y.y'],
    broomIn:    ['..b..', '..b..', '..b..', '..b..', '..b..', '.yyy.', 'yyyyy', 'yyyyy', 'y.y.y'],
    box:        ['C'.repeat(18), ...Array(6).fill('C' + 'c'.repeat(7) + 'yy' + 'c'.repeat(7) + 'C'), 'C'.repeat(18)],
    ballR: ['.r.', 'rrr', '.r.'], ballY: ['.y.', 'yyy', '.y.'], ballN: ['.n.', 'nnn', '.n.'],
    tear:       ['n', 'n'],
    sweat:      ['.n.', 'nnn', '.n.'],
    cfR: ['r'], cfY: ['y'], cfN: ['n'], cfP: ['p'], cfG: ['g'],
    ha:         ['i.i.iii', 'i.i.i.i', 'iii.iii', 'i.i.i.i', 'i.i.i.i'],
  };
  // Symbols that must still read correctly when he faces left.
  const NOFLIP = new Set(['zBig', 'zSmall', 'excl', 'note', 'bulb', 'ha']);

  const EYES = {
    open:  ['kk', 'kk'],
    line:  ['kk'],
    happy: ['.kk.', 'k..k'],
    wide:  ['kk', 'kk', 'kk'],
    angryL: ['k.', 'kk'],
    angryR: ['.k', 'kk'],
    sadL:   ['.k', 'kk'],
    sadR:   ['k.', 'kk'],
  };

  // Turn a pose into a list of unit rects { x, y, w, h, c } (before facing is applied).
  function buildRects(p, f) {
    const out = [];
    const bot = p.legH, hb = bot + 6 + p.bh, top = hb + 12; // shirt bottom, head bottom, head top

    const rect = (x, y, w, h, c, ground) =>
      out.push({ x: x + p.x, y: y + (ground ? 0 : p.y), w, h, c });
    const sprite = (rows, x, y, ground, noflip) => {
      const h = rows.length;
      rows.forEach((row, r) => {
        const s = noflip && f < 0 ? [...row].reverse().join('') : row;
        for (let c = 0; c < s.length; c++) {
          if (s[c] !== '.') rect(x + c, y + (h - 1 - r), 1, 1, s[c], ground);
        }
      });
    };

    // legs (trousers)
    [-6, 2].forEach((x, i) => {
      const lift = p.lift[i] || 0;
      if (p.legH - lift > 0) rect(x, lift, 4, p.legH - lift, 't');
    });

    // shirt
    rect(-6, bot, 12, hb - bot, 'o');

    // hands sit just outside the shirt — return their outer corner for props.
    // A raised or outstretched arm gets a sleeve in the shirt colour.
    const hand = (side, v) => {
      const sx = (x, w) => (side < 0 ? -x - w : x); // mirror an x span to the left side
      if (v === 'up') {
        rect(sx(6, 4), hb - 2, 4, 2, 'o');
        rect(sx(8, 2), hb, 2, 11, 'o');
        rect(sx(8, 2), hb + 11, 2, 2, 's');
        return [side < 0 ? -10 : 10, hb + 13];
      }
      if (v === 'out') {
        rect(sx(6, 4), hb - 2, 4, 2, 'o');
        rect(sx(10, 2), hb - 2, 2, 2, 's');
        return [side < 0 ? -12 : 12, hb - 2];
      }
      const y = bot + 1 + v;
      rect(side < 0 ? -8 : 6, y, 2, 2, 's');
      return [side < 0 ? -8 : 8, y];
    };
    const handL = hand(-1, p.armL);
    const handR = hand(1, p.armR);

    // head, then hair: a band across the top and a strip down the back to eye level
    const skin = p.red ? 'R' : 's';
    rect(-8, hb, 16, 12, skin);
    rect(-8, top - 2, 16, 2, 'h');
    rect(-8, hb + 5, 2, 5, 'h');

    // beard: the lower jaw plus a sideburn up the back to meet the hair; a skin gap marks the lips
    rect(-8, hb, 16, 3, 'd');
    rect(-8, hb + 3, 4, 2, 'd');
    rect(2, hb + 3, 6, 1, 'd');            // moustache
    if (p.mouth === 'o') rect(3, hb + 1, 2, 2, 'k');
    else if (p.mouth === 'O') rect(3, hb, 2, 3, 'k');
    else rect(2, hb + 2, 4, 1, skin);

    // eyes, both on the front half of the face
    if (p.eyes !== 'none') {
      const ey = hb + 6 + p.ly;
      [[1, 'L'], [5, 'R']].forEach(([cx, side]) => {
        const rows = EYES[p.eyes + side] || EYES[p.eyes] || EYES.open; // angry/sad differ per side
        sprite(rows, cx - rows[0].length / 2 + p.lx, ey);
      });
    }
    if (p.blush) rect(5, hb + 4, 2, 1, 'p');

    // props
    const A = { head: [0, top], handL, handR, ground: [0, 0], body: [0, bot] };
    for (const pr of p.props) {
      if (pr.s === 'headphones') { headphones(rect, hb, top); continue; }
      if (pr.s === 'glasses') { glasses(rect, hb + 6 + p.ly, p.lx); continue; }
      const [ax, ay] = A[pr.a || 'head'];
      sprite(SPRITES[pr.s], ax + (pr.dx || 0), ay + (pr.dy || 0), pr.a === 'ground', NOFLIP.has(pr.s));
    }
    return out;
  }

  // Headphones: a band over the hair and a cup on each side of the head.
  function headphones(rect, hb, top) {
    rect(-10, hb + 3, 2, 5, 'B'); rect(8, hb + 3, 2, 5, 'B');
    rect(-9, hb + 8, 1, top - hb - 8, 'B'); rect(8, hb + 8, 1, top - hb - 8, 'B');
    rect(-8, top, 16, 1, 'B');
  }

  // Reading glasses: one white frame around both eyes (they sit close together) and an arm to the ear.
  function glasses(rect, ey, lx) {
    rect(-1 + lx, ey - 1, 8, 1, 'w'); rect(-1 + lx, ey + 2, 8, 1, 'w');
    rect(-1 + lx, ey, 1, 2, 'w'); rect(6 + lx, ey, 1, 2, 'w'); rect(2 + lx, ey, 2, 1, 'w');
    rect(-5, ey + 1, 4 + lx, 1, 'w');
  }

  // Draw a pose. o = { x, y: ground line (canvas px), scale (canvas px per unit), facing, palette }
  function draw(ctx, pose, o) {
    const pal = Object.assign({}, PALETTE, o.palette);
    const f = (pose.facing || 1) * (o.facing || 1);
    const s = o.scale, ox = Math.round(o.x), gy = Math.round(o.y);

    // pose.clip: an "edge of the screen" at that x — everything beyond it is hidden
    // (clipBack hides the side behind him instead, so he can peek face-first)
    const cx = pose.clip == null ? null : ox + pose.clip * s * f;
    const cs = pose.clipBack ? -f : f;
    if (cx !== null) {
      ctx.save();
      ctx.beginPath();
      if (cs > 0) ctx.rect(0, 0, cx, gy + s); else ctx.rect(cx, 0, ctx.canvas.width - cx, gy + s);
      ctx.clip();
    }

    // ground shadow, shrinking as he rises
    const sw = Math.max(6, 14 - Math.floor(pose.y / 2));
    ctx.fillStyle = o.shadow || 'rgba(0,0,0,0.14)';
    ctx.fillRect(ox + Math.round(pose.x * f - sw / 2) * s, gy, sw * s, s);

    for (const r of buildRects(pose, f)) {
      const x = f > 0 ? r.x : -(r.x + r.w);
      ctx.fillStyle = pal[r.c] || r.c;
      ctx.fillRect(ox + x * s, gy - (r.y + r.h) * s, r.w * s, r.h * s);
    }

    if (cx !== null) {
      ctx.restore();
      ctx.fillStyle = pal.G;
      ctx.fillRect(cs > 0 ? cx : cx - s, gy - 30 * s, s, 30 * s);
    }
  }

  // ---------- animation engine ----------

  function makePose(d) {
    const p = Object.assign({}, BASE, d);
    p.lift = d.lift || BASE.lift;
    p.props = d.props || [];
    return p;
  }

  // Stepped keyframes, like GIF frames: [[ms, poseChanges], ...]. `common` applies to every frame.
  function seq(frames, common = {}) {
    const marks = [];
    let acc = 0;
    for (const [ms] of frames) { marks.push(acc); acc += ms; }
    return {
      dur: acc, marks,
      at(t) {
        let i = marks.length - 1;
        while (i > 0 && marks[i] > t) i--;
        const fr = frames[i][1];
        const d = Object.assign({}, common, fr);
        d.props = [...(common.props || []), ...(fr.props || [])];
        return { i, d };
      },
    };
  }

  const ANIMS = [];
  function add(id, name, group, s, opt = {}) {
    ANIMS.push({
      id, name, group,
      dur: s.dur, marks: s.marks,
      loop: opt.loop !== false,
      travel: opt.travel || 0,   // units per second when played "across"
      frameAt: (t) => s.at(t).i,
      pose(t) {
        const { i, d } = s.at(t);
        if (opt.extra) opt.extra(t, d, i);
        return makePose(d);
      },
    });
  }

  const P = (s, a, dx = 0, dy = 0) => ({ s, a, dx, dy });

  // Halfway through a turn his eyes slide to the middle of the face, as if seen from the front.
  // Idle and look use it to face left for a while, so he doesn't always look the same way.
  const FRONT = { lx: -2, bh: -1 };
  const LEFT = (d = {}) => Object.assign({ facing: -1 }, d);

  // ===== Basic =====
  add('idle', 'Idle', 'Basic', seq([
    [1000, {}], [1000, { bh: 1 }], [400, {}], [110, { eyes: 'line' }], [490, {}],
    [90, FRONT],
    [1000, LEFT({ bh: 1 })], [400, LEFT()], [110, LEFT({ eyes: 'line' })], [490, LEFT({ lx: 1 })],
    [1000, LEFT({ bh: 1 })],
    [90, FRONT],
    [1000, { bh: 1, lx: 1 }], [300, { lx: 1 }], [700, { lx: -1 }], [1000, { bh: 1 }],
  ]));

  add('blink', 'Blink', 'Basic', seq([
    [700, {}], [90, { eyes: 'line' }], [160, {}], [90, { eyes: 'line' }], [360, {}],
  ]));

  add('look', 'Look around', 'Basic', seq([
    [500, {}], [800, { lx: -1 }], [200, {}], [800, { lx: 1 }], [200, {}],
    [90, FRONT], [800, LEFT({ lx: 1 })], [200, LEFT()], [800, LEFT({ ly: 1 })], [90, FRONT],
    [800, { ly: 1 }], [300, { ly: 1, lx: 1 }], [800, {}],
  ]));

  // ===== Movement =====
  // hands swing against the legs: back leg up with the front hand forward, and vice versa
  const WALK = [
    [120, { lift: [1, 0], armL: -1, armR: 1 }],
    [120, { bh: -1 }],
    [120, { lift: [0, 1], armL: 1, armR: -1 }],
    [120, { bh: -1 }],
  ];
  add('walk', 'Walk (in place)', 'Movement', seq(WALK, { lx: 1 }));
  add('walkAcross', 'Walk across', 'Movement', seq(WALK, { lx: 1 }), { travel: 10 });

  add('turn', 'Turn around', 'Movement', seq([
    [600, { lx: 1 }], [90, FRONT], [600, LEFT({ lx: 1 })], [90, LEFT(FRONT)],
  ]));

  // ===== Reactions =====
  add('hop', 'Happy hop', 'Reactions', seq([
    [250, {}], [120, { bh: -1, legH: 3 }],
    [80, { y: 3, eyes: 'happy' }],
    [140, { y: 6, legH: 5, armL: 2, armR: 2, eyes: 'happy' }],
    [100, { y: 5, armL: 2, armR: 2, eyes: 'happy' }],
    [80, { y: 2, eyes: 'happy' }],
    [120, { bh: -1, legH: 3, eyes: 'happy', props: [P('dust', 'ground', -10), P('dust', 'ground', 7)] }],
    [350, { eyes: 'happy', blush: true }], [260, {}],
  ]));

  // ===== Basic, Movement, Rest =====
  const CROUCH = { bh: -1, legH: 3 }; // a quick dip before a jump or after a landing
  const TALL = { legH: 5 };           // up on tiptoe

  add('fidget', 'Bored fidget', 'Basic', seq([
    [300, {}],
    [150, { lift: [0, 1] }], [150, {}], [150, { lift: [0, 1] }], [150, {}],   // taps his front foot
    [150, { lift: [0, 1] }], [150, {}],
    [700, { lx: -1 }],
    [450, { bh: -1, eyes: 'line', ly: -1 }],                                   // sigh
    [200, { armL: 1, armR: -1 }], [200, { armL: -1, armR: 1 }],                 // swings his arms
    [200, { armL: 1, armR: -1 }], [200, { armL: -1, armR: 1 }],
    [400, { lx: 1 }], [300, {}],
  ]));

  // a bigger stride than walk: feet lift 2, hands pump hard
  add('scuttle', 'Scuttle (fast)', 'Movement', seq([
    [70, { lift: [2, 0], armL: -2, armR: 2, props: [P('dust', 'ground', -10)] }],
    [70, { bh: -1 }],
    [70, { lift: [0, 2], armL: 2, armR: -2, props: [P('dust', 'ground', -12, 1)] }],
    [70, { bh: -1 }],
  ], { lx: 1 }), { travel: 28 });

  add('hopAlong', 'Hop along', 'Movement', seq([
    [100, CROUCH],
    [90, { y: 2 }],
    [110, Object.assign({ y: 4, armL: 2, armR: 2 }, TALL)],
    [90, { y: 2 }],
    [100, CROUCH],
  ], { lx: 1 }), { travel: 14 });

  // His face is on his front, so he faces away from the edge (facing -1) and the edge
  // hides what is BEHIND him (clipBack): he leans out face-first and waves his front hand.
  add('peek', 'Peek from edge', 'Movement', seq([
    [400, { x: -26 }], [120, { x: -22 }], [120, { x: -18 }],
    [600, { x: -16, lx: 1 }],
    [500, { x: -14, lx: 1 }],
    [120, { x: -14, eyes: 'line' }],
    [500, { x: -14, lx: 1, ly: 1 }],
    [300, { x: -12, lx: 1 }],
    [300, { x: -12, armR: 'up', eyes: 'happy' }], [300, { x: -12, armR: 2, eyes: 'happy' }],
    [300, { x: -12, armR: 'up', eyes: 'happy' }], [300, { x: -12, armR: 2, eyes: 'happy' }],
    [120, { x: -18 }], [120, { x: -24 }], [400, { x: -26 }],
  ], { facing: -1, clip: -12, clipBack: true }));

  // ----- Rest -----
  add('stretch', 'Stretch', 'Rest', seq([
    [400, {}], [200, CROUCH], [150, { armL: 2, armR: 2 }],
    [900, Object.assign({ armL: 'up', armR: 'up', eyes: 'line', mouth: 'o' }, TALL)],
    [150, { armL: 'up', armR: 'up', eyes: 'line' }],
    [200, { armL: 2, armR: 2, eyes: 'line' }],
    [150, CROUCH], [450, {}],
  ]), { loop: false });

  add('yawn', 'Yawn', 'Rest', seq([
    [300, {}],
    [200, { eyes: 'line', mouth: 'o', bh: 1 }],
    [900, Object.assign({ eyes: 'line', mouth: 'O', armL: 1, armR: 1 }, TALL)],
    [200, { eyes: 'line', mouth: 'o' }],
    [200, { eyes: 'line' }], [150, {}], [100, { eyes: 'line' }], [550, {}],
  ]), { loop: false });

  // slumped on the ground, chin down, hands resting on the floor
  const NAP = { legH: 0, bh: -1, armL: -1, armR: -1, eyes: 'line', ly: -1 };
  add('nap', 'Nap (z z z)', 'Rest', seq([[1500, {}], [1500, { bh: 0 }]], NAP), {
    extra(t, d) {
      for (let k = 0; k < 3; k++) {
        const ph = (t / 3000 + k / 3) % 1;
        if (ph < 0.9) d.props.push(P(ph < 0.4 ? 'zSmall' : 'zBig', 'head', 6 + Math.floor(ph * 9), 1 + Math.floor(ph * 18)));
      }
    },
  });

  const EXCL = P('excl', 'head', 3, 2);
  add('wake', 'Wake up', 'Rest', seq([
    [500, NAP],
    [120, Object.assign({}, NAP, { eyes: 'wide', ly: 0, props: [EXCL] })],
    [180, Object.assign({ y: 3, eyes: 'wide', armL: 'up', armR: 'up', props: [EXCL] }, TALL)],
    [120, Object.assign({ y: 5, eyes: 'wide', armL: 'up', armR: 'up' }, TALL)],
    [100, { y: 2, eyes: 'wide' }],
    [120, CROUCH],
    [300, {}], [100, { eyes: 'line' }], [300, {}], [100, { eyes: 'line' }], [360, {}],
  ]), { loop: false });

  add('sit', 'Sit / crouch', 'Rest', seq([
    [300, {}], [150, { legH: 2 }],
    [900, { legH: 0 }], [900, { legH: 0, bh: 1 }],
    [600, { legH: 0, lx: 1 }], [100, { legH: 0, eyes: 'line' }], [600, { legH: 0, lx: -1 }],
    [900, { legH: 0, bh: 1 }],
    [150, { legH: 2 }], [300, {}],
  ]));

  // ===== Activities =====
  // A broom from his fist down to the floor: the handle runs from (0, top) to the bristles centred on `foot`.
  function broom(foot, top) {
    const g = Array.from({ length: top + 1 }, () => Array(foot + 4).fill('.'));
    const put = (x, y, c) => { g[top - y][x] = c; };
    for (let x = 0; x <= foot; x++) put(x, Math.round(top - (top - 4) * x / foot), 'b');
    for (let y = 5; y < top; y++) { // fill gaps on a steep handle
      const x = Math.round(foot * (top - y) / (top - 4));
      put(x, y, 'b');
    }
    for (let x = foot - 2; x <= foot + 2; x++) put(x, 3, 'y');
    for (let x = foot - 3; x <= foot + 3; x++) { put(x, 2, 'y'); put(x, 1, 'y'); }
    for (let x = foot - 3; x <= foot + 3; x += 2) put(x, 0, 'y');
    return g.map((r) => r.join(''));
  }
  Object.assign(SPRITES, {
    // a small desk he stands behind, with a keyboard on it and a monitor at the far end
    desk:    [...Array(2).fill('b'.repeat(32)), ...Array(5).fill('bb' + '.'.repeat(28) + 'bb')],
    kbd:     ['gGgGgGgGgGgG', 'GGGGGGGGGGGG'],
    monitor: ['GGGGGGG', 'GnnnnnG', 'GnwwwnG', 'GnnnnnG', 'GnwwnnG', 'GnnnnnG', 'GGGGGGG', '...G...', '..GGG..'],
    broomOut: broom(10, 9),
    broomIn:  broom(6, 9),
    ballW:    ['.w.', 'www', '.w.'], // a white ball, so none vanishes against the shirt
  });

  // build: a hammer in his front fist, swung up over his head and down onto the block
  const OBJ = P('object', 'ground', 12);
  const HD = P('hammerDown', 'handR', -1, -1); // level, head forward
  const HU = P('hammerUp', 'handR', -3, 1);    // upright, handle in the fist
  add('build', 'Build (hammer)', 'Activities', seq([
    [260, { props: [OBJ, HD] }],
    [160, { armR: 'out', bh: 1, ly: 1, props: [OBJ, HU] }],
    [160, { armR: 'up', bh: 1, ly: 1, props: [OBJ, HU] }],
    [60, { armR: 'out', props: [OBJ, HD] }],
    [110, Object.assign({ ly: -1, props: [OBJ, HD, P('spark', 'ground', 9, 6), P('spark', 'ground', 17, 6)] }, CROUCH)],
    [250, Object.assign({ ly: -1, props: [OBJ, HD] }, CROUCH)],
    [300, { props: [OBJ, HD] }],
  ], { lx: 1 }));

  // groove: sway and tap a foot to the beat, notes drifting up from the headphones
  const SWAY = [0, 1, 1, 0, 0, -1, -1, 0];
  add('groove', 'Groove (headphones)', 'Activities', seq(
    SWAY.map((x, i) => [200, {
      x, bh: i % 2 ? -1 : 0,
      armL: i % 4 < 2 ? 1 : 0, armR: i % 4 < 2 ? 0 : 1,
      lift: i % 4 === 1 ? [0, 1] : i % 4 === 3 ? [1, 0] : [0, 0],
    }]),
    { eyes: 'happy', props: [{ s: 'headphones' }] },
  ), {
    extra(t, d) {
      [0, 0.5].forEach((k, n) => {
        const ph = (t / 1600 + k) % 1;
        if (ph < 0.85) d.props.push(P('note', 'head', (n ? -15 : 11) + (Math.floor(ph * 4) % 2), 2 + Math.floor(ph * 8)));
      });
    },
  });

  add('dance', 'Dance / wave', 'Activities', seq([
    [200, CROUCH],
    [200, { y: 2, legH: 5, armL: 'up', armR: 'up', eyes: 'happy' }],
    [150, Object.assign({ eyes: 'happy' }, CROUCH)],
    [250, { x: -2, armL: 'up', armR: 2, eyes: 'happy', lift: [0, 1] }],
    [150, { x: -2, eyes: 'happy' }],
    [250, { x: 2, armR: 'up', armL: 2, eyes: 'happy', lift: [1, 0] }],
    [150, { x: 2, eyes: 'happy' }],
    [300, { armL: 'out', armR: 'out', bh: 1 }],
    [150, { armL: 2, armR: 2 }],
    [300, { y: 1, armL: 'up', armR: 'up', eyes: 'happy', blush: true }],
    [300, {}],
  ]));

  // think: hand to the chin, thought dots rising off the front of his head, then the bulb
  const D1 = P('dotS', 'head', 7, 1), D2 = P('dotM', 'head', 9, 4), D3 = P('dotL', 'head', 11, 8);
  const CHIN = { lx: 1, ly: 1, armR: 3 };
  const BULB = P('bulb', 'head', -2, 3);
  add('think', 'Think / idea', 'Activities', seq([
    [300, {}],
    [300, CHIN],
    [400, Object.assign({ props: [D1] }, CHIN)],
    [400, Object.assign({ props: [D1, D2] }, CHIN)],
    [500, Object.assign({ props: [D1, D2, D3] }, CHIN)],
    [120, { y: 1, eyes: 'wide', ly: 1, armR: 'up', props: [BULB] }],
    [1100, { eyes: 'wide', ly: 1, armR: 'up', props: [BULB] }],
    [480, {}],
  ]), {
    extra(t, d, i) { // the bulb sparkles while it's lit
      if (i === 6) {
        const on = Math.floor(t / 150) % 2;
        d.props.push(P('spark', 'head', on ? -7 : 5, on ? 8 : 10), P('spark', 'head', on ? 5 : -7, on ? 5 : 6));
      }
    },
  });

  // read: the book held open in front of his chest with both hands
  const BOOK = P('book', 'body', -6, 1);
  const SCAN = [[450, { lx: -1 }], [450, {}], [450, { lx: 1 }]];
  add('read', 'Read (glasses)', 'Activities', seq([
    ...SCAN, [150, { lx: -1, bh: -1 }], ...SCAN,
    [120, { props: [P('pageR', 'body', 1, 5)] }],
    [120, { props: [P('pageM', 'body', -1, 5)] }],
    [120, { props: [P('pageL', 'body', -6, 5)] }],
    [500, { eyes: 'happy' }],
  ], { ly: -1, armL: 1, armR: 1, props: [BOOK, { s: 'glasses' }] }));

  // type: standing at a little desk, tapping the keyboard, glancing at the monitor
  const DESK = [P('desk', 'ground', -12), P('kbd', 'ground', -6, 7), P('monitor', 'ground', 11, 7)];
  const TAP_L = { armL: 1, props: [P('keypop', 'ground', -4, 9)] };
  const TAP_R = { armR: 1, props: [P('keypop', 'ground', 3, 9)] };
  add('type', 'Type', 'Activities', seq([
    [100, TAP_L], [100, {}], [100, TAP_R], [100, {}], [100, TAP_L], [100, TAP_R], [100, {}],
    [100, TAP_R], [100, {}], [100, TAP_L], [100, {}],
    [600, { ly: 0, lx: 1 }],      // pause to read the screen
    [100, { eyes: 'line', ly: 0 }],
  ], { ly: -1, armL: 2, armR: 2, props: DESK }));

  // sweep: both hands on the handle, pushing the bristles out and pulling them back
  const BR_OUT = P('broomOut', 'ground', 4), BR_IN = P('broomIn', 'ground', 4);
  const STROKE = [
    [220, { props: [BR_OUT] }],
    [160, { props: [BR_OUT, P('dust', 'ground', 19)] }],
    [220, { x: -1, bh: -1, props: [BR_IN, P('dust', 'ground', 21, 2)] }],
    [200, { x: -1, props: [BR_IN] }],
  ];
  add('sweep', 'Sweep', 'Activities', seq([
    ...STROKE, ...STROKE, [600, { ly: 0, eyes: 'happy', props: [BR_IN] }],
  ], { armL: 2, armR: 2, lx: 1, ly: -1 }));

  // carry: the box held up over his head with both arms while he walks
  add('carry', 'Carry (box)', 'Activities', seq(
    WALK.map(([ms, f]) => [ms, Object.assign({}, f, { armL: 'up', armR: 'up' })]),
    { lx: 1, props: [P('box', 'head', -9, 1)] },
  ), { travel: 7 });

  // juggle: arms held out, a high arc over his head left→right (steep sides clear his face) and a low pass back under
  const BALLS = ['ballW', 'ballY', 'ballN'];
  add('juggle', 'Juggle', 'Activities', seq(Array(6).fill([200, {}]), { armL: 'out', armR: 'out', ly: 1 }), {
    extra(t, d) {
      BALLS.forEach((b, k) => {
        const ph = (t / 1200 + k / 3) % 1;
        const hi = ph < 0.6, u = hi ? ph / 0.6 : (ph - 0.6) / 0.4, arc = Math.sin(Math.PI * u);
        const x = Math.round(hi ? -12 + 22 * u : 10 - 22 * u);
        d.props.push(P(b, 'ground', x, hi ? 10 + Math.round(20 * Math.sqrt(arc)) : 10 - Math.round(4 * arc)));
      });
      d.lx = Math.cos(2 * Math.PI * t / 1200) > 0 ? 1 : -1;
    },
  });

  // ===== Reactions & Moods (doubleJump, annoyed, dangle, fall, land, love, surprised, sad, excited, tired, celebrate) =====
  Object.assign(SPRITES, {
    // the back of his head, laid over the head for the double-jump spin: hair, ears, beard edges, nape
    backOfHead: [
      ...Array(5).fill('h'.repeat(16)),
      ...Array(2).fill('s' + 'h'.repeat(14) + 's'),
      ...Array(2).fill('h'.repeat(16)),
      'dd' + 'h'.repeat(12) + 'dd',
      ...Array(2).fill('dd' + 's'.repeat(12) + 'dd'),
    ],
  });
  const BACK = P('backOfHead', 'head', -8, -12);
  const DUST = (n = 0) => [P('dust', 'ground', -10 - 2 * n, n), P('dust', 'ground', 7 + 2 * n, n)];

  add('doubleJump', 'Double-jump', 'Reactions', seq([
    [250, {}], [110, CROUCH],
    [80, { y: 3, legH: 5 }],
    [120, { y: 6, legH: 5, armL: 2, armR: 2 }],
    [90, { y: 7, armL: 2, armR: 2 }],
    [80, Object.assign({ y: 6 }, CROUCH)],                               // kick off the air
    [70, { y: 9, legH: 5, armL: 'up', armR: 'up' }],
    [90, { y: 12, legH: 5, armL: 'up', armR: 'up', lx: -2 }],              // spin: front...
    [90, { y: 14, armL: 'up', armR: 'up', facing: -1, lx: 1 }],           // ...other side...
    [90, { y: 14, armL: 'up', armR: 'up', eyes: 'none', props: [BACK] }], // ...back
    [90, { y: 13, armL: 2, armR: 2, eyes: 'happy' }],
    [80, { y: 10, armL: 2, armR: 2 }],
    [70, { y: 6, legH: 5 }], [60, { y: 2, legH: 5 }],
    [130, { bh: -2, legH: 2, eyes: 'line', props: DUST() }],
    [100, CROUCH],
    [400, { eyes: 'happy', blush: true }], [300, {}],
  ]));

  const ANG = P('anger', 'head', 6, -1);
  const CROSS = { eyes: 'angry', armL: -2, armR: -2, props: [ANG] };
  add('annoyed', 'Annoyed', 'Reactions', seq([
    [200, {}],
    [100, { bh: -1, eyes: 'angry', props: [ANG] }],
    ...[1, -1, 1, -1, 1, -1].map((x) => [70, { x, bh: -1, eyes: 'angry', props: [ANG] }]),
    [500, Object.assign({ bh: -1 }, CROSS)],
    [120, Object.assign({ lift: [2, 0] }, CROSS)],  // stomp
    [120, Object.assign({ bh: -1 }, CROSS)],
    [120, Object.assign({ lift: [0, 2] }, CROSS)],
    [120, Object.assign({ bh: -1 }, CROSS)],
    [300, { eyes: 'line', bh: 1 }],                 // huff
    [400, {}],
  ]));

  // giggle: tickled, he shakes with laughter and "HA"s bubble up in front of and behind his head
  const GIG = { eyes: 'happy', blush: true, armL: 1, armR: 1 };
  const gig = (d) => Object.assign({}, GIG, d);
  add('giggle', 'Giggle (tickled)', 'Reactions', seq([
    [200, {}],
    [100, gig(CROUCH)],
    [120, gig({ y: 2, legH: 5, armL: 2, armR: 2, mouth: 'o' })],
    [100, gig(CROUCH)],
    ...[1, -1, 1, -1, 1, -1, 1, -1].map((x, i) => [100, gig({ x, bh: i % 2 ? -1 : 0, mouth: i % 2 ? null : 'o' })]),
    [300, gig({ eyes: 'line', bh: 1, mouth: 'o' })],
    [260, {}],
  ]), {
    extra(t, d, i) {
      if (i === 0 || i === 13) return;
      [[9, 0], [-16, 0.5]].forEach(([dx, k]) => {
        const ph = (t / 1000 + k) % 1;
        if (ph < 0.8) d.props.push(P('ha', 'head', dx + (Math.floor(ph * 6) % 2), 1 + Math.floor(ph * 12)));
      });
    },
  });

  // the cursor's tip is pinched into the hair band on top of his head
  add('dangle', 'Picked up (dangling)', 'Reactions', seq(
    [[0, [0, 2]], [1, [2, 0]], [0, [0, 2]], [-1, [2, 0]]].map(([x, lift]) => [300, { x, lift }]),
    { y: 10, legH: 6, eyes: 'wide', mouth: 'o', armL: -3, armR: -3, props: [P('cursor', 'head', -1, -1)] },
  ));

  const LANDED = [
    [110, { bh: -2, legH: 2, eyes: 'line', props: DUST() }],
    [100, Object.assign({ props: DUST(1) }, CROUCH)],
    [100, { y: 1, legH: 5 }],
    [80, {}],
  ];
  add('fall', 'Falling', 'Reactions', seq([
    [700, { legH: 5, armL: 'up', armR: 'up', eyes: 'wide', mouth: 'o' }],
    ...LANDED, [500, {}],
  ]), {
    extra(t, d, i) { if (i === 0) d.y = Math.round(20 * (1 - (t / 700) ** 2)); }, // gravity
  });

  add('land', 'Land squash', 'Reactions', seq([...LANDED, [350, { eyes: 'happy' }], [460, {}]]));

  add('love', 'Love (hearts)', 'Reactions', seq(
    [0, 1, 0, -1].map((x) => [400, { x, armL: x ? 2 : 1, armR: x ? 2 : 1 }]),
    { eyes: 'happy', blush: true },
  ), {
    extra(t, d) {
      [0, 0.5].forEach((k, n) => {
        const ph = (t / 1600 + k) % 1;
        if (ph < 0.9) d.props.push(P(ph < 0.35 ? 'heartS' : 'heart', 'head', (n ? -11 : 5) + (Math.floor(ph * 6) % 2), 1 + Math.floor(ph * 14)));
      });
    },
  });

  const EX = P('excl', 'head', 9, 2);
  add('surprised', 'Surprised', 'Reactions', seq([
    [300, {}],
    [120, { y: 3, x: -1, legH: 5, eyes: 'wide', mouth: 'O', armL: 'up', armR: 'up', props: [EX] }],
    [100, { y: 1, x: -2, eyes: 'wide', mouth: 'O', armL: 2, armR: 2, props: [EX] }],
    [100, Object.assign({ x: -2, eyes: 'wide', mouth: 'o' }, CROUCH)],
    [700, { x: -2, eyes: 'wide', mouth: 'o' }],
    [100, { x: -2, eyes: 'line' }],
    [150, { x: -1 }], [430, {}],
  ]));

  // ===== Moods =====
  // the tear leaves the outer corner of his front eye and runs down over the beard, past the chin
  add('sad', 'Sad', 'Moods', seq([
    [800, {}], [800, { x: -1, bh: -2 }], [800, {}], [800, { x: 1, bh: -2 }],
  ], { eyes: 'sad', armL: -3, armR: -3, bh: -1, ly: -1 }), {
    extra(t, d) {
      const ph = (t / 1600) % 1;
      if (ph < 0.8) d.props.push(P('tear', 'head', 6, -9 - Math.floor(ph * 10)));
    },
  });

  const SP_L = P('spark', 'head', -14, 0), SP_R = P('spark', 'head', 11, 1);
  add('excited', 'Excited', 'Moods', seq([
    [100, CROUCH],
    [100, { y: 2, legH: 5, armL: 'up', armR: 2 }],
    [100, { y: 3, armL: 'up', armR: 2, props: [SP_L] }],
    [100, { y: 1, armL: 2, armR: 'up', props: [SP_L] }],
    [100, Object.assign({ armL: 2, armR: 'up' }, CROUCH)],
    [100, { y: 2, legH: 5, armL: 2, armR: 'up', props: [SP_R] }],
    [100, { y: 3, armL: 2, armR: 'up', props: [SP_R] }],
    [100, { y: 1, armL: 'up', armR: 2 }],
  ], { eyes: 'happy', blush: true }));

  // a sweat drop slides down his temple, just off the front of the face
  add('tired', 'Tired (sweat)', 'Moods', seq([
    [900, {}], [900, { bh: -2 }], [900, {}], [250, { eyes: 'open', ly: -1 }], [650, { bh: -2 }],
  ], { eyes: 'line', armL: -3, armR: -3, bh: -1 }), {
    extra(t, d) {
      const ph = (t / 1800) % 1;
      d.props.push(P('sweat', 'head', 7, -5 - Math.floor(ph * 5)));
    },
  });

  // angry: worse than annoyed. A red face and steam from his head, stomping, then both fists shaken at you
  const MAD = (d = {}) => Object.assign({ red: true, eyes: 'angry', armL: -2, armR: -2 }, d, { props: [ANG, ...(d.props || [])] });
  const STOMP = [
    [130, MAD({ lift: [2, 0] })],
    [110, MAD({ bh: -1, props: [P('dust', 'ground', -10)] })],
    [130, MAD({ lift: [0, 2] })],
    [110, MAD({ bh: -1, props: [P('dust', 'ground', 7)] })],
  ];
  const SHAKE = [
    [150, MAD({ y: 2, legH: 5, armL: 'up', armR: 2, mouth: 'O' })],
    [150, MAD({ y: 2, legH: 5, armL: 2, armR: 'up', mouth: 'O' })],
  ];
  add('angry', 'Angry (steaming)', 'Moods', seq([
    [200, {}],
    [100, { bh: -1, eyes: 'angry', props: [ANG] }],
    [200, MAD({ bh: -1 })],
    ...STOMP, ...STOMP,
    [100, MAD(CROUCH)],
    ...SHAKE, ...SHAKE,
    [120, MAD(CROUCH)],
    [500, MAD({ bh: 1, mouth: 'o' })],       // fuming
    [300, { eyes: 'line', bh: 1 }],          // huff
    [400, {}],
  ]), {
    extra(t, d) { // puffs of steam, growing as they rise off both sides of his head
      if (!d.red) return;
      [[9, 0], [-12, 0.5]].forEach(([dx, k]) => {
        const ph = (t / 600 + k) % 1;
        const s = ph < 0.35 ? 'dotS' : ph < 0.7 ? 'dotM' : 'dotL';
        d.props.push(P(s, 'head', dx + Math.sign(dx) * Math.floor(ph * 3), -4 + Math.floor(ph * 12)));
      });
    },
  });

  const CONFETTI = ['cfR', 'cfY', 'cfN', 'cfP', 'cfG'];
  add('celebrate', 'Celebrate (confetti)', 'Moods', seq([
    [150, CROUCH],
    [200, { y: 4, legH: 5, armL: 'up', armR: 'up' }],
    [150, { y: 2, armL: 'up', armR: 'up' }],
    [150, CROUCH],
    [300, { x: -1, armL: 'up', armR: 2, blush: true }],
    [300, { x: 1, armR: 'up', armL: 2, blush: true }],
  ], { eyes: 'happy' }), {
    extra(t, d) {
      for (let k = 0; k < 14; k++) {
        const x = ((k * 37) % 44) - 22 + (Math.floor(t / 150 + k) % 2);
        const y = 40 - Math.floor((t / 1250 * 36 + k * 7) % 40);
        d.props.push(P(CONFETTI[k % 5], 'ground', x, y));
      }
    },
  });

  const GROUPS = ['Basic', 'Movement', 'Activities', 'Rest', 'Reactions', 'Moods'];
  const PLANNED = {}; // add names here to show them greyed out
  ANIMS.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group)); // stable: keeps order within a group

  root.Carles = { id: 'carles', name: 'Carles', PALETTE, BASE, SPRITES, ANIMS, PLANNED, GROUPS, draw, buildRects, makePose };
})(window);

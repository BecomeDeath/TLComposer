// Motion and interaction. Everything here is an enhancement: without it the pages still work
// (links open YouTube, the demo has plain players, all content is visible).
//
//   - the living score: a WebGL liquid with the staves of an orchestral score flowing over it.
//     Sweep across the staves (or tap them on a phone) to pluck them: they ring, a note is
//     written where you touched, and with sound on each staff plays like an orchestral section.
//     Short phrases write themselves now and then, and the staves play along with the demo.
//   - smooth scrolling with a mouse or trackpad (Lenis); phones keep their own native scrolling
//   - a notehead cursor with labels, magnetic buttons, fills that grow from the pointer
//   - headings that rise word by word, a statement that lights up as you read it
//   - the latest release growing to full width, a marquee driven by scroll speed
//   - work titles with a liquid cover preview, videos in a lightbox
//   - the PromptMIDI demo: the real notes of each example, drawn in time with its audio
//   - a count-in on the first visit, a curtain with a staff between pages
//
// Prefers-reduced-motion turns the movement off; the content and controls stay.

(() => {
  "use strict";

  const root = document.documentElement;
  const reduce = root.classList.contains("reduce");
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt / 1000));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutExpo = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2);
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  if (!fine) root.classList.add("touch");

  //============================================================================
  // Frame loop and scrolling

  const tickers = new Set();
  const scroll = { y: window.scrollY, v: 0 };
  let lenis = null;

  // Smooth scrolling only with a mouse or trackpad: phones keep their own, native scrolling.
  if (!reduce && fine && typeof window.Lenis === "function") {
    try {
      lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1, autoRaf: false });
      lenis.on("scroll", (l) => {
        scroll.y = Number.isFinite(l.scroll) ? l.scroll : window.scrollY;
        scroll.v = Number.isFinite(l.velocity) ? clamp(l.velocity, -400, 400) : 0;
      });
    } catch (e) { lenis = null; }
  }

  let lastT = performance.now();
  function loop(t) {
    const dt = Math.min(64, t - lastT);
    lastT = t;
    if (lenis) lenis.raf(t);
    else { const y = window.scrollY; scroll.v = clamp(y - scroll.y, -400, 400); scroll.y = y; }
    for (const f of tickers) {
      try { f(t, dt); } catch (e) { tickers.delete(f); console.warn(e); }
    }
    requestAnimationFrame(loop);
  }

  function scrollToY(y, el) {
    if (lenis) lenis.scrollTo(el || y, { duration: 1.6, easing: easeInOutExpo, offset: 0 });
    else window.scrollTo({ top: el ? el.getBoundingClientRect().top + window.scrollY : y, behavior: reduce ? "auto" : "smooth" });
  }

  //============================================================================
  // Small things: theme, email, menu, clock, back to top

  $(".theme-toggle")?.addEventListener("click", () => {
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    store.set("theme", next);
  });

  // Email links are put together here, so the address isn't sitting in the page for harvesters.
  $$(".email-link").forEach((a) => {
    a.href = `mailto:${a.dataset.u}@${a.dataset.d}`;
    $$(".at", a).forEach((s) => { s.textContent = "@"; });
  });

  const menu = $("#menu"), menuBtn = $(".menu-toggle");
  function setMenu(open) {
    if (!menu) return;
    root.classList.toggle("menu-open", open);
    menuBtn?.setAttribute("aria-expanded", String(open));
    menu.inert = !open;
    if (lenis) open ? lenis.stop() : lenis.start();
  }
  if (menu) {
    menu.hidden = false;
    menu.inert = true;
    menuBtn?.addEventListener("click", () => setMenu(!root.classList.contains("menu-open")));
    $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && root.classList.contains("menu-open")) { setMenu(false); menuBtn?.focus(); } });
  }

  $$(".clock").forEach((c) => {
    const out = $(".clock-time", c);
    let fmt;
    try { fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: c.dataset.tz || undefined, timeZoneName: "short" }); }
    catch (e) { fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }); }
    const update = () => { out.textContent = fmt.format(new Date()); };
    update();
    setInterval(update, 15000);
  });

  $(".to-top")?.addEventListener("click", () => scrollToY(0));

  //============================================================================
  // The fixed layers (liquid and staves) and when they're on screen

  const layer = $(".liquid");

  // Sized to the largest viewport (100lvh), so a phone's address bar sliding in and out never
  // resizes them. A change of size is picked up inside the frame loop, never between frames,
  // so the canvases are never shown cleared.
  const view = { w: 0, h: 0, version: 0 };
  function measure() {
    if (!layer) return;
    const w = layer.clientWidth, h = layer.clientHeight;
    if (w !== view.w || h !== view.h) { view.w = w; view.h = h; view.version++; }
  }
  measure();
  addEventListener("resize", measure);
  addEventListener("orientationchange", () => setTimeout(measure, 300));

  // Only drawn while a section that shows them is on screen.
  const showing = new Set();
  const liquidIO = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? showing.add(e.target) : showing.delete(e.target))); });
  $$("[data-liquid]").forEach((s) => liquidIO.observe(s));
  const layerVisible = () => showing.size > 0 && !document.hidden;

  //============================================================================
  // Audio: one context for the interface sounds, made on the first gesture.

  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { audioCtx = new AC(); } catch (e) { return null; }
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  //============================================================================
  // The liquid (WebGL)

  const liquid = (() => {
    const api = { pulse: 0, level: () => 0, kick(v) { this.pulse = Math.min(1.2, this.pulse + v); } };
    const canvas = layer && $(".liquid-gl", layer);
    if (!canvas) return api;

    let gl = null;
    try { gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: fine ? "high-performance" : "default" }); } catch (e) { gl = null; }
    if (!gl) return api;

    const vert = "attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
    // Phones get one octave less: the look is the same, the cost a quarter lower.
    const frag = `precision highp float;
#define OCTAVES ${fine ? 4 : 3}
varying vec2 vUv;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform vec2 uVel;
uniform float uEnergy; uniform float uPulse; uniform float uScroll; uniform float uLight;
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;

float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
const mat2 M = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < OCTAVES; i++) { v += a * noise(p); p = M * p + 3.1; a *= .5; } return v; }
float field(vec2 p, float t, out vec2 q, out vec2 r){
  q = vec2(fbm(p + vec2(0., t * .6)), fbm(p + vec2(5.2, 1.3) - t * .4));
  r = vec2(fbm(p + 3.4 * q + vec2(1.7, 9.2) + t * .5), fbm(p + 3.4 * q + vec2(8.3, 2.8) - t * .3));
  return fbm(p + 2.8 * r);
}
void main(){
  float asp = uRes.x / uRes.y;
  vec2 p = (vUv - .5) * vec2(asp, 1.) * 1.5;
  vec2 m = (uMouse - .5) * vec2(asp, 1.) * 1.5;
  vec2 d = p - m;
  float fall = exp(-dot(d, d) * 2.4);
  float ang = (.6 + 3. * length(uVel)) * fall;
  float s = sin(ang), c = cos(ang);
  p = m + mat2(c, -s, s, c) * d;
  p -= uVel * fall * 1.2;
  p += normalize(d + 1e-4) * sin(length(d) * 16. - uTime * 5.) * .025 * uPulse * exp(-length(d) * 1.4);
  p.y -= uScroll * .25;
  float t = uTime * (.045 + .07 * uEnergy) + uScroll * .15;
  vec2 q, r, q2, r2;
  vec2 P = p * 1.15;
  float h = field(P, t, q, r);
  float e = .01;
  float hx = field(P + vec2(e, 0.), t, q2, r2);
  float hy = field(P + vec2(0., e), t, q2, r2);
  vec3 n = normalize(vec3((h - hx) / e, (h - hy) / e, 2.2));
  vec3 L = normalize(vec3(-.45, .6, .75));
  float diff = clamp(dot(n, L), 0., 1.);
  float spec = pow(clamp(dot(reflect(-L, n), vec3(0., 0., 1.)), 0., 1.), 22.);

  vec3 col = mix(uC0, uC1, smoothstep(.22, .82, h));
  col = mix(col, uC2, smoothstep(.58, 1.12, length(q)) * (.62 + .3 * uEnergy));
  float vein = smoothstep(.5, .78, r.x) * smoothstep(.45, .95, h);
  col = mix(col, uC3, vein * (.42 + .45 * uEnergy));
  col *= mix(.62 + .55 * diff, .9 + .14 * diff, uLight);
  col += spec * mix(uC3, vec3(1.), .6) * (.22 + .45 * uEnergy) * (1. - .55 * uLight);

  vec2 v = vUv - .5;
  col = mix(col, uC0, smoothstep(.2, 1., dot(v, v) * 1.7) * .75);
  gl_FragColor = vec4(col, 1.);
}`;

    let U = {}, ok = false;
    function init() {
      const compile = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(sh)); return null; }
        return sh;
      };
      const vs = compile(gl.VERTEX_SHADER, vert), fs = compile(gl.FRAGMENT_SHADER, frag);
      if (!vs || !fs) return false;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.bindAttribLocation(prog, 0, "p");
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      U = {};
      for (const n of ["uRes", "uTime", "uMouse", "uVel", "uEnergy", "uPulse", "uScroll", "uLight", "uC0", "uC1", "uC2", "uC3"]) U[n] = gl.getUniformLocation(prog, n);
      colorsDirty = true;
      sized = -1;
      return true;
    }

    const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); const n = m ? parseInt(m[1], 16) : 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
    let colorsDirty = true, sized = -1, quality = 1;
    function colors() {
      [0, 1, 2, 3].forEach((i) => gl.uniform3fv(U[`uC${i}`], hex(css(`--liquid-${i}`))));
      gl.uniform1f(U.uLight, root.dataset.theme === "light" ? 1 : 0);
      colorsDirty = false;
    }
    function size() {
      const k = (fine ? 0.5 : 0.4) * quality;
      const cap = Math.min(1, 1000 / Math.max(1, view.w * k));
      const w = Math.max(2, Math.round(view.w * k * cap)), h = Math.max(2, Math.round(view.h * k * cap));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(U.uRes, w, h);
      sized = view.version;
    }

    new MutationObserver(() => { colorsDirty = true; }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    const mouse = { x: 0.62, y: 0.55, tx: 0.62, ty: 0.55, vx: 0, vy: 0 };
    addEventListener("pointermove", (e) => { mouse.tx = e.clientX / Math.max(1, view.w); mouse.ty = 1 - e.clientY / Math.max(1, view.h); }, { passive: true });

    let energy = 0, time = 8 + Math.random() * 40, drawnOnce = false;
    function draw() {
      if (sized !== view.version) size();
      if (colorsDirty) colors();
      gl.uniform1f(U.uTime, time);
      gl.uniform2f(U.uMouse, mouse.x, mouse.y);
      gl.uniform2f(U.uVel, mouse.vx, mouse.vy);
      gl.uniform1f(U.uEnergy, energy);
      gl.uniform1f(U.uPulse, api.pulse);
      gl.uniform1f(U.uScroll, scroll.y / Math.max(1, view.h));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      drawnOnce = true;
    }

    // Android can drop the GPU context when the browser goes to the background: build it again.
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); ok = false; layer.classList.remove("on"); });
    canvas.addEventListener("webglcontextrestored", () => { ok = init(); if (ok) layer.classList.add("on"); });

    ok = init();
    if (!ok) return api;
    layer.classList.add("on");

    // If the device struggles (frames over ~22 ms on average), draw the liquid at a lower resolution.
    let slow = 0, frames = 0;
    tickers.add((t, dt) => {
      if (!ok) return;
      if (reduce) {   // one still frame, redrawn only when the size or theme changes
        if (!drawnOnce || sized !== view.version || colorsDirty) draw();
        return;
      }
      if (!layerVisible()) return;
      if (quality > 0.5 && ++frames > 40) {
        slow = slow * 0.95 + (dt > 22 ? 1 : 0) * 0.05;
        if (slow > 0.6) { quality = Math.max(0.5, quality * 0.75); slow = 0; frames = 0; sized = -1; }
      }
      const nx = damp(mouse.x, mouse.tx, 3.2, dt), ny = damp(mouse.y, mouse.ty, 3.2, dt);
      mouse.vx = damp(mouse.vx, (nx - mouse.x) * (1000 / Math.max(1, dt)) * 0.12, 6, dt);
      mouse.vy = damp(mouse.vy, (ny - mouse.y) * (1000 / Math.max(1, dt)) * 0.12, 6, dt);
      mouse.x = nx; mouse.y = ny;
      energy = damp(energy, clamp(api.level(), 0, 1), 8, dt);
      api.pulse = api.pulse * Math.exp(-dt / 700);
      time += dt / 1000 * (1 + Math.min(2.5, Math.abs(scroll.v) * 0.04));
      if (!Number.isFinite(time)) time = 10;
      if (!Number.isFinite(energy)) energy = 0;
      draw();
    });
    return api;
  })();

  //============================================================================
  // Sound (off unless the visitor turns it on): hover notes and the plucked staves.

  const sound = (() => {
    const toggles = $$("[data-sound-toggle]");
    let on = store.get("sound") === "on", out = null, lastHover = 0, lastPluck = 0;
    const pentatonic = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];   // D major pentatonic

    function bus(ctx) {
      if (out) return out;
      const master = ctx.createGain(); master.gain.value = 0.16;
      const delay = ctx.createDelay(1); delay.delayTime.value = 0.27;
      const fb = ctx.createGain(); fb.gain.value = 0.3;
      const wet = ctx.createGain(); wet.gain.value = 0.32;
      const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 3000;
      master.connect(ctx.destination);
      master.connect(delay); delay.connect(tone); tone.connect(fb); fb.connect(delay); tone.connect(wet); wet.connect(ctx.destination);
      out = master;
      return out;
    }

    // One voice. "bell" for the interface; the staves sound like the sections of an orchestra.
    const voices = {
      bell:   { parts: [[1, 1, "sine"], [2, 0.22, "sine"], [3.01, 0.06, "triangle"]], attack: 0.006, decay: 1.8, gain: 0.5 },
      flute:  { parts: [[1, 1, "sine"], [2, 0.08, "sine"]], attack: 0.045, decay: 1.3, gain: 0.42, vibrato: 5.2 },
      reed:   { parts: [[1, 0.7, "square"], [1, 0.4, "triangle"]], attack: 0.02, decay: 0.9, gain: 0.16, filter: 1700 },
      brass:  { parts: [[1, 0.8, "sawtooth"], [0.5, 0.25, "sine"]], attack: 0.03, decay: 1.0, gain: 0.17, filter: 1300, sweep: true },
      pizz:   { parts: [[1, 1, "triangle"], [2, 0.18, "sine"]], attack: 0.003, decay: 0.8, gain: 0.5, filter: 2600, sweep: true },
    };

    function voice(midi, vel, kind) {
      const ctx = getAudio();
      if (!ctx) return;
      const v = voices[kind] || voices.bell, dest = bus(ctx), t = ctx.currentTime;
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(v.gain * vel, t + v.attack);
      env.gain.exponentialRampToValueAtTime(0.0001, t + v.decay);
      let node = env;
      if (v.filter) {
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
        lp.frequency.setValueAtTime(v.filter * (v.sweep ? 1.6 : 1), t);
        if (v.sweep) lp.frequency.exponentialRampToValueAtTime(v.filter * 0.45, t + v.decay * 0.6);
        lp.connect(env);
        node = lp;
      }
      env.connect(dest);
      for (const [mul, g, type] of v.parts) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = type; o.frequency.value = f * mul; og.gain.value = g;
        if (v.vibrato) {
          const lfo = ctx.createOscillator(), lg = ctx.createGain();
          lfo.frequency.value = v.vibrato; lg.gain.value = f * 0.006;
          lfo.connect(lg); lg.connect(o.frequency); lfo.start(t + 0.15); lfo.stop(t + v.decay + 0.1);
        }
        o.connect(og); og.connect(node);
        o.start(t); o.stop(t + v.decay + 0.1);
      }
    }

    function hover(i, vel = 1) {
      if (!on) return;
      const now = performance.now();
      if (now - lastHover < 45) return;
      lastHover = now;
      voice(pentatonic[((i % pentatonic.length) + pentatonic.length) % pentatonic.length], vel, "bell");
      liquid.kick(0.2);
    }

    // A score of eight staves, top to bottom like an orchestral page: flutes, oboes, clarinets,
    // horns, trumpets, violins, violas, cellos. The five lines of each staff climb its pentatonic.
    const sections = [[86, "flute"], [81, "flute"], [74, "reed"], [69, "brass"], [64, "brass"], [62, "pizz"], [57, "pizz"], [50, "pizz"]];
    function string(staff, line, vel) {
      if (!on) return;
      const now = performance.now();
      if (now - lastPluck < 28) return;
      lastPluck = now;
      const [base, kind] = sections[((staff % 8) + 8) % 8];
      voice(base + [0, 2, 4, 7, 9][4 - line], clamp(vel, 0.3, 1), kind);
    }

    function set(v, chime = true) {
      on = v;
      store.set("sound", on ? "on" : "off");
      root.classList.toggle("sound-on", on);
      toggles.forEach((b) => b.setAttribute("aria-pressed", String(on)));
      $$(".sound-state").forEach((s) => { s.textContent = on ? "on" : "off"; });
      if (on && chime) { getAudio(); hover(0); setTimeout(() => hover(2, 0.8), 90); setTimeout(() => hover(4, 0.7), 180); }
    }

    // On a phone the staves are tapped, not swept.
    if (!fine) $$(".score-hint-text span").forEach((el) => { el.textContent = el.textContent.replace("sweep across", "tap"); });

    set(on, false);
    toggles.forEach((b) => b.addEventListener("click", () => set(!on)));

    // Hovering a link that carries data-sound plays a note; neighbours climb the scale.
    let lastEl = null;
    document.addEventListener("pointerover", (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      const el = e.target.closest?.("[data-sound]");
      if (el === lastEl) return;
      lastEl = el;
      if (!el || !on) return;
      const group = el.parentElement?.parentElement ? $$("[data-sound]", el.parentElement.parentElement) : [el];
      hover(Math.max(0, group.indexOf(el)) + 2, 0.75);
    });
    return { hover, string, get on() { return on; } };
  })();

  //============================================================================
  // The staves: an orchestral score drawn over the liquid (2D canvas, sharp at any density)

  const staves = (() => {
    const api = { excite() {} };
    const canvas = layer && $(".staves", layer);
    const ctx = canvas?.getContext("2d");
    if (!ctx) return api;

    let W = 0, H = 0, dpr = 1, sized = -1;
    let s = 9, P = 90, A = 14;          // line spacing, staff period, how far the liquid bends the lines
    const drift = 0.32;                 // the score moves at a third of the scroll speed
    let t = 0, scoreX = 0;              // time in seconds; the score creeps left, like a page being played
    let ink = "#f2efe9", warm = "#ffb877", base = 0.1, colorsDirty = true;

    const readColors = () => {
      ink = css("--fg") || ink;
      warm = css("--warm") || warm;
      base = root.dataset.theme === "light" ? 0.2 : 0.17;
      colorsDirty = true;
    };
    readColors();
    new MutationObserver(readColors).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = view.w; H = view.h;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      s = clamp(W * 0.0078, 7, 10.5);
      P = s * 4 + s * 6.5;
      A = s * 1.5;
      sized = view.version;
    }

    // Smooth value noise: the same flow bends neighbouring lines alike, so each staff moves as one.
    const perm = new Uint8Array(512);
    { let x = 2463534242; for (let i = 0; i < 256; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; perm[i] = perm[i + 256] = (x >>> 0) & 255; } }
    const fade = (v) => v * v * (3 - 2 * v);
    function noise(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const a = perm[X + perm[Y]], b = perm[X + 1 + perm[Y]], c = perm[X + perm[Y + 1]], d = perm[X + 1 + perm[Y + 1]];
      const u = fade(xf), v = fade(yf);
      return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) / 255;
    }

    const offset = () => (reduce ? 0 : scroll.y * drift);
    const restY = (J, k) => J * P + k * s - offset();                  // where line k (0 = top) of staff J rests
    const flow = (x, J, k) => {
      const sy = J * P + k * s;
      return ((noise(x * 0.0024 + t * 0.05, sy * 0.004 - t * 0.025) - 0.5) * 2 + (noise(x * 0.007 - t * 0.09, sy * 0.011 + 3.1) - 0.5) * 0.4) * A;
    };

    const plucks = [];   // { J, k, x, t0, amp }
    const notes = [];    // { J, pos (half-steps below the top line, 0..8), sx (score x), t0, life, hot, up, beam }
    const ptr = { x: -1e4, y: -1e4, lx: -1e4, ly: -1e4, near: 0, inside: false };

    function pluckY(x, J, k, list) {
      let dy = 0;
      for (const p of list) {
        if (p.J !== J || p.k !== k) continue;
        const age = t - p.t0, dx = Math.abs(x - p.x);
        dy += p.amp * Math.exp(-age * 3.2) * Math.sin(age * 34 - dx * 0.05) * Math.exp(-dx / (50 + age * 420));
      }
      return dy;
    }
    // Lines lean a little towards the pointer, like strings under a hand.
    function lean(x, by) {
      if (ptr.near < 0.01) return 0;
      const dx = x - ptr.x, dy = ptr.y - by;
      return dy * 0.2 * ptr.near * Math.exp(-(dx * dx) / (2 * 120 * 120)) * Math.exp(-(dy * dy) / (2 * (s * 4) * (s * 4)));
    }
    const lineY = (x, J, k, live) => restY(J, k) + flow(x, J, k) + (live ? pluckY(x, J, k, plucks) + lean(x, restY(J, k)) : 0);

    function pluck(J, k, x, amp, { silent = false } = {}) {
      plucks.push({ J, k, x, t0: t, amp: clamp(amp, 2.5, 10) });
      if (plucks.length > 24) plucks.shift();
      let sx = x + scoreX;
      for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i];
        if (n.hot && n.J === J && t - n.t0 < 0.45 && Math.abs(n.sx - sx) < s * 5) { sx = n.sx; break; }
      }
      if (!notes.some((n) => n.hot && n.J === J && n.pos === k * 2 && n.sx === sx && t - n.t0 < 0.45))
        notes.push({ J, pos: k * 2, sx, t0: t, life: 1.6, hot: true, up: k >= 2 });
      if (notes.length > 80) notes.shift();
      if (!silent) sound.string(J, k, amp / 8);
      liquid.kick(0.08);
    }

    // Which staves are inside a section that shows them (in screen y)?
    function liquidBands() {
      const out = [];
      for (const sec of showing) {
        const r = sec.getBoundingClientRect();
        const top = Math.max(0, r.top), bottom = Math.min(H, r.bottom);
        if (bottom - top > 40) out.push([top, bottom]);
      }
      return out;
    }

    // Where the pointer crosses a line, the line is plucked.
    function crossings(x0, y0, x1, y1) {
      const lo = Math.min(y0, y1) - A * 2.5, hi = Math.max(y0, y1) + A * 2.5;
      const off = offset();
      const J0 = Math.floor((lo + off) / P) - 1, J1 = Math.ceil((hi + off) / P) + 1;
      const speed = Math.hypot(x1 - x0, y1 - y0);
      let n = 0;
      for (let J = J0; J <= J1 && n < 6; J++) {
        for (let k = 0; k < 5 && n < 6; k++) {
          const ya = lineY(x0, J, k, false), yb = lineY(x1, J, k, false);
          if ((y0 - ya) * (y1 - yb) < 0) {
            const f = Math.abs(y0 - ya) / Math.max(0.001, Math.abs(y0 - ya) + Math.abs(y1 - yb));
            pluck(J, k, lerp(x0, x1, f), 2.5 + speed * 0.12);
            n++;
          }
        }
      }
    }

    // The nearest line to a point (for taps and clicks).
    function nearest(x, y) {
      const off = offset();
      const Jc = Math.floor((y + off) / P);
      let best = null, bd = 1e9;
      for (let J = Jc - 1; J <= Jc + 1; J++) for (let k = 0; k < 5; k++) {
        const d = Math.abs(lineY(x, J, k, false) - y);
        if (d < bd) { bd = d; best = [J, k]; }
      }
      return bd < s * 2.5 ? best : null;
    }

    // The pointer plays the staves only over the open score: not over cards, controls or solid sections.
    const playable = (target) => target && target.closest && target.closest("[data-liquid]") && !target.closest("a, button, input, .pm-demo, .hero-latest, .links-card, .score-hint, [role=slider]");

    if (!reduce) {
      addEventListener("pointermove", (e) => {
        const x = e.clientX, y = e.clientY;
        const ok = playable(e.target);
        if (ok && ptr.inside && ptr.lx > -1e3) crossings(ptr.lx, ptr.ly, x, y);
        ptr.x = x; ptr.y = y; ptr.lx = x; ptr.ly = y; ptr.inside = !!ok;
      }, { passive: true });
      addEventListener("mouseout", (e) => { if (!e.relatedTarget) ptr.inside = false; });
      const lift = (e) => { if (e.pointerType !== "mouse") { ptr.inside = false; ptr.lx = -1e4; } };
      addEventListener("pointerup", lift, { passive: true });
      addEventListener("pointercancel", lift, { passive: true });
      addEventListener("pointerdown", (e) => {
        ptr.lx = e.clientX; ptr.ly = e.clientY;   // a new touch starts here, not where the last one ended
        if (!playable(e.target)) return;
        const hit = nearest(e.clientX, e.clientY);
        if (hit) pluck(hit[0], hit[1], e.clientX, e.pointerType === "mouse" ? 6 : 7);
      }, { passive: true });
    }

    // Now and then a short phrase writes itself onto a staff.
    let nextPhrase = 1.2;
    function phrase() {
      const bands = liquidBands();
      if (!bands.length) return;
      const [top, bottom] = bands[Math.floor(Math.random() * bands.length)];
      const off = offset();
      const Ja = Math.ceil((top + off + s) / P), Jb = Math.floor((bottom + off - 5 * s) / P);
      if (Jb < Ja) return;
      const J = Ja + Math.floor(Math.random() * (Jb - Ja + 1));
      const count = 3 + Math.floor(Math.random() * 4);
      const gap = s * (3.4 + Math.random() * 1.2);
      const width = gap * (count - 1);
      const yMid = restY(J, 2);
      const clear = (x) => [[x, yMid - s * 4], [x, yMid], [x, yMid + s * 4], [x + width / 2, yMid], [x + width, yMid - s * 3], [x + width, yMid + s * 3]]
        .every(([px, py]) => {
          const el = document.elementFromPoint(px, py);
          return !el || el.matches("section, main, body, html, .wrap, .hero-inner, .hero-foot, .pm-grid, .contact .wrap, [data-liquid]");
        });
      let x0 = -1;
      for (let i = 0; i < 6 && x0 < 0; i++) {
        const x = W * (0.05 + Math.random() * 0.9) - width / 2;
        if (x > 8 && x + width < W - 8 && clear(x)) x0 = x;
      }
      if (x0 < 0) return;
      let pos = 2 + Math.floor(Math.random() * 5);
      const items = [];
      for (let i = 0; i < count; i++) {
        pos = clamp(pos + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)], 0, 8);
        items.push({ J, pos, sx: x0 + i * gap + scoreX, t0: t + i * 0.17, life: 3.6 - i * 0.1, hot: false });
      }
      const up = items.reduce((a, n) => a + n.pos, 0) / items.length >= 4;
      items.forEach((n, i) => { n.up = up; if (i % 2 === 0 && i + 1 < items.length && Math.random() < 0.6) n.beam = items[i + 1]; });
      notes.push(...items);
    }

    // The demo plays along: its melody plucks the staves in the section it's in.
    let lastExcite = 0;
    api.excite = (pitch01, vel, box) => {
      if (reduce || t - lastExcite < 0.07) return;
      lastExcite = t;
      const r = box ? box.closest("[data-liquid]")?.getBoundingClientRect() : null;
      const top = r ? Math.max(0, r.top) : 0, bottom = r ? Math.min(H, r.bottom) : H;
      if (bottom - top < 60) return;
      const y = lerp(bottom - s * 4, top + s * 4, clamp(pitch01, 0, 1));
      const x = W * (0.05 + Math.random() * 0.9);
      const hit = nearest(x, y);
      if (hit) pluck(hit[0], hit[1], x, 3 + vel * 5, { silent: true });
    };

    function noteAt(n) {
      const x = n.sx - scoreX;
      const k = n.pos / 2, ka = Math.floor(k), kb = Math.min(4, ka + 1);
      const ya = lineY(x, n.J, ka, false), yb = lineY(x, n.J, kb, false);
      return [x, ka === kb ? ya : lerp(ya, yb, k - ka)];
    }

    function draw() {
      if (sized !== view.version) size();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const off = offset();
      const J0 = Math.floor((off - A * 2) / P) - 1, J1 = Math.ceil((off + H + A * 2) / P);
      const step = W > 900 ? 16 : 12;
      const nearBand = s * 6;
      ctx.lineWidth = 1;
      ctx.lineJoin = "round";

      for (let J = J0; J <= J1; J++) {
        const yTop = restY(J, 0);
        if (yTop > H + A * 2 || yTop + 4 * s < -A * 2) continue;
        for (let k = 0; k < 5; k++) {
          const by = restY(J, k);
          let ring = 0;
          for (const p of plucks) if (p.J === J && p.k === k) ring = Math.max(ring, Math.exp(-(t - p.t0) * 2.4));
          const close = ptr.inside ? Math.exp(-((by - ptr.y) ** 2) / (2 * nearBand * nearBand)) * ptr.near : 0;
          const own = plucks.filter((p) => p.J === J && p.k === k);
          const path = new Path2D();
          for (let x = -step, i = 0; x <= W + step; x += step, i++) {
            const y = by + flow(x, J, k) + (own.length ? pluckY(x, J, k, own) : 0) + lean(x, by);
            if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
          }
          ctx.strokeStyle = ink;
          ctx.globalAlpha = base + close * 0.22;
          ctx.stroke(path);
          if (ring > 0.04) { ctx.strokeStyle = warm; ctx.globalAlpha = ring * 0.85; ctx.stroke(path); }
        }
        // Barlines, moving with the score.
        const bar = s * 46;
        ctx.strokeStyle = ink;
        ctx.globalAlpha = base * 0.9;
        for (let bx = ((-scoreX % bar) + bar) % bar - bar + (J * 137) % bar; bx < W + bar; bx += bar) {
          if (bx < -2) continue;
          ctx.beginPath();
          ctx.moveTo(bx, lineY(bx, J, 0, true));
          ctx.lineTo(bx, lineY(bx, J, 4, true));
          ctx.stroke();
        }
      }

      // Notes: written in, then fading back into the liquid.
      for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i], age = t - n.t0;
        if (age > n.life) { notes.splice(i, 1); continue; }
        if (age < 0) continue;
        const [x, y] = noteAt(n);
        if (x < -40 || x > W + 40 || y < -60 || y > H + 60) continue;
        const appear = Math.min(1, age / 0.14), vanish = clamp((n.life - age) / 0.9, 0, 1);
        const alpha = appear * vanish * (n.hot ? 0.95 : 0.55);
        const col = n.hot ? warm : ink;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = col;
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.ellipse(x, y, s * 0.66 * (0.6 + 0.4 * appear), s * 0.48 * (0.6 + 0.4 * appear), -0.4, 0, Math.PI * 2);
        ctx.fill();
        if (n.hot) continue;
        ctx.lineWidth = 1.2;
        const sx = n.up ? x + s * 0.6 : x - s * 0.6, sy0 = n.up ? y - s * 0.15 : y + s * 0.15, sy1 = n.up ? y - s * 3.4 : y + s * 3.4;
        ctx.beginPath(); ctx.moveTo(sx, sy0); ctx.lineTo(sx, sy1); ctx.stroke();
        if (n.beam && t >= n.beam.t0) {
          const [bx2, by2] = noteAt(n.beam);
          const ex = n.up ? bx2 + s * 0.6 : bx2 - s * 0.6, ey = n.up ? by2 - s * 3.4 : by2 + s * 3.4;
          ctx.lineWidth = s * 0.42;
          ctx.beginPath(); ctx.moveTo(sx, sy1); ctx.lineTo(ex, ey); ctx.stroke();
        }
        ctx.lineWidth = 1;
      }
      ctx.globalAlpha = 1;
      colorsDirty = false;
    }

    let drawnOnce = false;
    tickers.add((now, dt) => {
      if (reduce) {
        if (!drawnOnce || sized !== view.version || colorsDirty) { draw(); drawnOnce = true; }
        return;
      }
      if (!layerVisible()) return;
      t += dt / 1000;
      scoreX += dt * 0.012;
      ptr.near = damp(ptr.near, ptr.inside ? 1 : 0, 6, dt);
      for (let i = plucks.length - 1; i >= 0; i--) if (t - plucks[i].t0 > 2.6) plucks.splice(i, 1);
      if ((nextPhrase -= dt / 1000) <= 0) { phrase(); nextPhrase = 1.8 + Math.random() * 2.2; }
      draw();
    });
    return api;
  })();

  //============================================================================
  // Text: split headings into words (or letters), reveal on scroll

  function maskSpan(txt, i) {
    const o = document.createElement("span"); o.className = "w";
    const s = document.createElement("span"); s.textContent = txt; s.style.setProperty("--i", i);
    o.append(s);
    return o;
  }

  function splitText(el, mode) {
    let i = 0;
    const walk = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const part of child.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { frag.append(" "); continue; }
            if (mode === "chars") {
              const word = document.createElement("span");
              word.style.whiteSpace = "nowrap";
              for (const ch of part) word.append(maskSpan(ch, i++));
              frag.append(word);
            } else frag.append(maskSpan(part, i++));
          }
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      }
    };
    if (mode === "chars") el.setAttribute("aria-label", el.textContent.trim());
    walk(el);
    if (mode === "chars") $$(".w", el).forEach((w) => w.setAttribute("aria-hidden", "true"));
  }

  $$("[data-split]").forEach((el) => splitText(el, el.dataset.split));

  // The hero name: letters numbered across both lines.
  $$(".hero-title .c").forEach((c, i) => c.style.setProperty("--i", i));

  const statements = $$("[data-words]").map((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    const spans = words.map((w, i) => {
      const s = document.createElement("span"); s.className = "sw"; s.textContent = w;
      el.append(s);
      if (i < words.length - 1) el.append(" ");
      return s;
    });
    return { el, spans, lit: -1 };
  });

  const revealIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); }
  }), { rootMargin: "0px 0px -6% 0px" });

  function startReveals() {
    $$("[data-reveal], [data-split]").forEach((el) => { if (!el.closest(".hero")) revealIO.observe(el); });
  }

  //============================================================================
  // Count-in, hero entrance, page curtain

  const curtain = $(".curtain");
  const loader = $(".loader");
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]);

  function heroIn() {
    root.classList.add("ready");
    $$(".hero [data-reveal]").forEach((el, i) => { el.style.setProperty("--i", i + 6); el.classList.add("in"); });
  }

  if (loader && !root.classList.contains("no-loader")) {
    try { sessionStorage.setItem("seen", "1"); } catch (e) { /* ignore */ }
    // A count-in: four beats at 160, then the curtain lifts.
    const beats = $$(".beat", loader), beat = 60000 / 160;
    if (lenis) lenis.stop();
    beats.forEach((b, i) => setTimeout(() => { beats.forEach((x) => x.classList.remove("on")); b.classList.add("on"); }, 120 + i * beat));
    setTimeout(() => fontsReady.then(() => {
      loader.classList.add("done");
      setTimeout(heroIn, 380);
      setTimeout(() => { loader.remove(); if (lenis) lenis.start(); }, 1200);
    }), 120 + beats.length * beat);
    startReveals();
  } else if (root.classList.contains("pt-in") && curtain) {
    fontsReady.then(() => requestAnimationFrame(() => {
      curtain.classList.add("revealing");
      root.classList.remove("pt-in");
      setTimeout(heroIn, 250);
      setTimeout(startReveals, 300);
      curtain.addEventListener("transitionend", () => curtain.classList.remove("revealing"), { once: true });
    }));
  } else {
    fontsReady.then(() => { heroIn(); startReveals(); });
  }

  const samePage = (url) => url.origin === location.origin && url.pathname.replace(/index\.html$/, "") === location.pathname.replace(/index\.html$/, "");

  function navigate(href, name) {
    if (!curtain || reduce) { location.href = href; return; }
    $(".curtain-mark", curtain).textContent = name || "";
    curtain.classList.remove("revealing");
    void curtain.offsetWidth;
    curtain.classList.add("covering");
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      try { sessionStorage.setItem("pt", "1"); } catch (e) { /* ignore */ }
      location.href = href;
    };
    curtain.addEventListener("transitionend", go, { once: true });
    setTimeout(go, 950);
  }

  addEventListener("pageshow", (e) => {
    if (e.persisted && curtain) { curtain.classList.remove("covering"); root.classList.remove("pt-in"); }
  });

  //============================================================================
  // Lightbox for videos (YouTube, privacy-enhanced; nothing loads before a click)

  const lightbox = $(".lightbox");
  let demoPause = () => {};

  function openVideo(src, title, x, y) {
    if (!lightbox || typeof lightbox.showModal !== "function") return false;
    lightbox.style.setProperty("--ox", `${x}px`);
    lightbox.style.setProperty("--oy", `${y}px`);
    const f = document.createElement("iframe");
    f.src = src + (src.includes("?") ? "&" : "?") + "autoplay=1";
    f.title = title || "Video";
    f.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    f.allowFullscreen = true;
    $(".lightbox-frame", lightbox).replaceChildren(f);
    $(".lightbox-title", lightbox).textContent = title || "";
    demoPause();
    lightbox.classList.remove("closing");
    lightbox.showModal();
    root.classList.add("lightbox-open");
    if (lenis) lenis.stop();
    return true;
  }

  function closeVideo() {
    if (!lightbox?.open || lightbox.classList.contains("closing")) return;
    if (reduce) { lightbox.close(); return; }
    lightbox.classList.add("closing");
    setTimeout(() => { lightbox.close(); lightbox.classList.remove("closing"); }, 480);
  }

  if (lightbox) {
    lightbox.addEventListener("close", () => {
      $(".lightbox-frame", lightbox).replaceChildren();
      root.classList.remove("lightbox-open");
      if (lenis) lenis.start();
    });
    lightbox.addEventListener("cancel", (e) => { e.preventDefault(); closeVideo(); });
    lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeVideo(); });
    $(".lightbox-close", lightbox)?.addEventListener("click", closeVideo);
  }

  // Clicks: videos open in the lightbox, anchors glide, other pages arrive through the curtain.
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const v = e.target.closest("[data-video]");
    if (v) {
      const r = v.getBoundingClientRect();
      const keyboard = e.detail === 0;
      if (openVideo(v.dataset.video, v.dataset.title, keyboard ? r.left + r.width / 2 : e.clientX, keyboard ? r.top + r.height / 2 : e.clientY)) e.preventDefault();
      return;
    }
    const a = e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    const url = new URL(a.href, location.href);
    if (!/^https?:$/.test(url.protocol)) return;
    if (samePage(url)) {
      if (!url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      scrollToY(0, target);
      history.pushState(null, "", url.hash);
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      return;
    }
    if (url.origin === location.origin) {
      e.preventDefault();
      const name = a.classList.contains("brand") ? $(".brand-name", a)?.textContent : (a.textContent || "").trim().split("\n")[0];
      navigate(url.href, (name || "").slice(0, 40));
    }
  });

  //============================================================================
  // Cursor, magnetism, fills, spotlights, tilt (fine pointers only)

  if (fine && !reduce) {
    const cur = $(".cursor");
    if (cur) {
      root.classList.add("has-cursor");
      const ring = $(".cursor-ring", cur), dot = $(".cursor-dot", cur), label = $(".cursor-label", cur);
      let x = -100, y = -100, rx = -100, ry = -100, seen = false;
      cur.classList.add("is-hidden");
      addEventListener("pointermove", (e) => {
        if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
        x = e.clientX; y = e.clientY;
        dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        if (!seen) { seen = true; rx = x; ry = y; }
        cur.classList.remove("is-hidden");
      }, { passive: true });
      document.addEventListener("mouseleave", () => { cur.classList.add("is-hidden"); seen = false; });
      addEventListener("pointerdown", () => cur.classList.add("is-down"));
      addEventListener("pointerup", () => cur.classList.remove("is-down"));
      document.addEventListener("pointerover", (e) => {
        const labelled = e.target.closest?.("[data-cursor]");
        const link = e.target.closest?.("a, button, [role=slider], summary, label");
        if (labelled && (!link || link === labelled || link.contains(labelled))) {
          label.textContent = labelled.dataset.cursor;
          cur.classList.add("is-label"); cur.classList.remove("is-link");
        } else if (link) {
          cur.classList.add("is-link"); cur.classList.remove("is-label");
        } else cur.classList.remove("is-link", "is-label");
      });
      tickers.add((t, dt) => {
        rx = damp(rx, x, 16, dt); ry = damp(ry, y, 16, dt);
        ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
      });
    }

    const magnets = new Set();
    $$("[data-magnetic]").forEach((el) => {
      const m = { el, k: parseFloat(el.dataset.magnetic) || 0.35, x: 0, y: 0, tx: 0, ty: 0, c: null };
      el.addEventListener("pointerenter", () => {
        const r = el.getBoundingClientRect();
        m.c = { x: r.left + r.width / 2 - m.x, y: r.top + r.height / 2 - m.y };
        magnets.add(m);
      });
      el.addEventListener("pointermove", (e) => { if (m.c) { m.tx = (e.clientX - m.c.x) * m.k; m.ty = (e.clientY - m.c.y) * m.k; } });
      el.addEventListener("pointerleave", () => { m.c = null; m.tx = 0; m.ty = 0; });
    });
    tickers.add((t, dt) => {
      for (const m of magnets) {
        m.x = damp(m.x, m.tx, m.c ? 14 : 7, dt); m.y = damp(m.y, m.ty, m.c ? 14 : 7, dt);
        if (!m.c && Math.abs(m.x) < 0.05 && Math.abs(m.y) < 0.05) { m.el.style.translate = ""; magnets.delete(m); continue; }
        m.el.style.translate = `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px`;
      }
    });

    $$(".spot").forEach((el) => el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    }));

    $$("[data-tilt]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
        el.style.setProperty("--rx", `${((e.clientY - r.top) / r.height - 0.5) * -8}deg`);
      });
      el.addEventListener("pointerleave", () => { el.style.removeProperty("--rx"); el.style.removeProperty("--ry"); });
    });

    // Button fills grow from the point the pointer came in (and leave the same way).
    $$(".button, .pill, .link-button").forEach((el) => {
      const at = (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--x", `${e.clientX - r.left}px`);
        el.style.setProperty("--y", `${e.clientY - r.top}px`);
      };
      el.addEventListener("pointerenter", at);
      el.addEventListener("pointerleave", at);
    });
  }

  //============================================================================
  // Scroll scenes

  const hero = $("[data-hero]");
  const showcase = $("[data-showcase]");
  const parallax = $$("[data-speed]").map((el) => ({ el, k: parseFloat(el.dataset.speed) || 0 }));
  const marquee = $(".marquee-track");
  let marqueeX = 0, marqueeOn = false, lastY = -1, headerY = 0;
  if (marquee) new IntersectionObserver(([e]) => { marqueeOn = e.isIntersecting; }).observe(marquee);

  tickers.add((t, dt) => {
    const y = scroll.y, vh = innerHeight;
    const moved = y !== lastY;
    lastY = y;

    if (moved) {
      root.classList.toggle("scrolled", y > 30);
      // With a mouse, the header slips away while you read and returns when you scroll up.
      // On phones it stays, so its buttons are always there.
      if (fine && Math.abs(y - headerY) > 6) {
        root.classList.toggle("header-hidden", y > headerY && y > vh * 0.7 && !root.classList.contains("menu-open"));
        headerY = y;
      }
    }

    // The hero drifts and fades as you leave it (not on phones: there it would slide under the next section).
    if (fine && !reduce && moved && hero && y < vh * 1.4) {
      hero.style.transform = `translate3d(0, ${(y * 0.2).toFixed(1)}px, 0)`;
      hero.style.opacity = String(clamp(1 - y / (vh * 0.9), 0, 1));
    }

    if (showcase && (moved || t < 2000)) {
      const r = showcase.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        const p = reduce ? 1 : easeOut(clamp(1 - (r.top - vh * 0.08) / (vh * 0.85), 0, 1));
        showcase.style.setProperty("--ss", (0.84 + 0.16 * p).toFixed(4));
        showcase.style.setProperty("--sr", `${lerp(64, 22, p).toFixed(1)}px`);
        if (!reduce) showcase.style.setProperty("--sy", `${(((r.top + r.height / 2) - vh / 2) / vh * -7).toFixed(2)}%`);
      }
    }

    if (moved || t < 2000) for (const s of statements) {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) continue;
      const p = clamp((vh * 0.9 - r.top) / (r.height + vh * 0.34), 0, 1);
      const lit = reduce ? s.spans.length : Math.round(p * s.spans.length * 1.1);
      if (lit !== s.lit) { s.spans.forEach((w, i) => w.classList.toggle("lit", i < lit)); s.lit = lit; }
    }

    if (!reduce && moved) for (const p of parallax) {
      const r = p.el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      p.el.style.transform = `translate3d(0, ${((r.top + r.height / 2 - vh / 2) * p.k).toFixed(1)}px, 0)`;
    }

    if (!reduce && marquee && marqueeOn) {
      const w = marquee.scrollWidth / 2;
      marqueeX -= dt * 0.045 + scroll.v * 0.5;
      if (!Number.isFinite(marqueeX)) marqueeX = 0;
      if (marqueeX <= -w) marqueeX += w;
      if (marqueeX > 0) marqueeX -= w;
      marquee.style.transform = `translate3d(${marqueeX.toFixed(1)}px, 0, 0) skewX(${clamp(-scroll.v * 0.35, -10, 10).toFixed(2)}deg)`;
    }
  });

  //============================================================================
  // Works: the cover follows the pointer, wobbling like liquid with its speed.

  const preview = $(".work-preview");
  if (preview && fine && !reduce) {
    const inner = $(".work-preview-inner", preview);
    const disp = $("#liquid-distort feDisplacementMap"), turb = $("#liquid-distort feTurbulence");
    const imgs = new Map();
    let on = false, px = 0, py = 0, tx = 0, ty = 0, vx = 0, vy = 0, lastScale = -1;
    const show = (src) => {
      if (!src) return;
      if (!imgs.has(src)) { const im = new Image(); im.src = src; im.alt = ""; im.decoding = "async"; inner.append(im); imgs.set(src, im); }
      imgs.forEach((im, k) => im.classList.toggle("on", k === src));
    };
    addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    $$(".work").forEach((w) => {
      w.addEventListener("pointerenter", (e) => {
        if (!on) { px = e.clientX; py = e.clientY; }
        on = true; preview.classList.add("on"); show(w.dataset.image);
      });
    });
    $(".works-list")?.addEventListener("pointerleave", () => { on = false; preview.classList.remove("on"); });
    addEventListener("scroll", () => { if (on && !$(".works-list:hover")) { on = false; preview.classList.remove("on"); } }, { passive: true });
    tickers.add((t, dt) => {
      if (!on && !preview.classList.contains("on")) return;
      const nx = damp(px, tx, 8, dt), ny = damp(py, ty, 8, dt);
      vx = damp(vx, nx - px, 10, dt); vy = damp(vy, ny - py, 10, dt);
      px = nx; py = ny;
      const pw = preview.offsetWidth, ph = preview.offsetHeight;
      preview.style.transform = `translate3d(${(px - pw / 2).toFixed(1)}px, ${(py - ph / 2).toFixed(1)}px, 0) rotate(${clamp(vx * 0.6, -9, 9).toFixed(2)}deg)`;
      const s = clamp(Math.hypot(vx, vy) * 5, 0, 80);
      if (Math.abs(s - lastScale) > 0.3) {
        disp?.setAttribute("scale", s.toFixed(1));
        turb?.setAttribute("baseFrequency", `${(0.012 + s * 0.00004).toFixed(4)} ${(0.02 + s * 0.0001).toFixed(4)}`);
        inner.style.filter = s < 0.6 ? "none" : "";
        lastScale = s;
      }
    });
  }

  //============================================================================
  // The PromptMIDI demo

  $$("[data-demo]").forEach((box) => {
    const chips = $$(".pm-chip", box);
    const canvas = $(".pm-roll canvas", box), ctx = canvas?.getContext("2d");
    const rollBox = $(".pm-roll", box);
    const promptEl = $("[data-prompt]", box), meta = $("[data-meta]", box), status = $("[data-status]", box);
    const playBtn = $(".pm-play", box), bar = $(".pm-progress", box), fill = $("span", bar), timeEl = $("[data-time]", box);
    if (!chips.length || !ctx) return;

    // The audio plays as it is (no Web Audio routing, so it also plays with a phone on silent);
    // the liquid and the staves follow the notes themselves.
    const audio = new Audio();
    audio.preload = "none";
    const rolls = new Map();
    const getRoll = (url) => {
      if (!rolls.has(url)) rolls.set(url, fetch(url).then((r) => (r.ok ? r.json() : null)).then(prepare).catch(() => null));
      return rolls.get(url);
    };

    let roll = null, idx = 0, token = 0, genAt = 0, visible = false, started = false, lastT = 0;
    let palette = {};
    const readPalette = () => {
      palette = {
        melody: css("--roll-melody"), countermelody: css("--roll-counter"), chords: css("--roll-chords"), pad: css("--roll-pad"),
        arpeggio: css("--roll-arp"), ostinato: css("--roll-arp"), bass: css("--roll-bass"), percussion: css("--roll-perc"),
        grid: css("--roll-grid"), fg: css("--fg"), accent: css("--accent"), warm: css("--warm"),
      };
    };
    readPalette();
    new MutationObserver(readPalette).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    // Melody drawn last, so it sits on top.
    const order = { pad: 0, chords: 1, arpeggio: 2, ostinato: 2, bass: 3, countermelody: 4, melody: 5, percussion: 6 };
    function prepare(r) {
      if (!r || !Array.isArray(r.tracks)) return null;
      r.tracks.forEach((t) => t.n.sort((a, b) => a[0] - b[0]));
      r.tracks.sort((a, b) => (order[a.role] ?? 2) - (order[b.role] ?? 2));
      r.hasDrums = r.tracks.some((t) => t.drum);
      return r;
    }

    // How busy and loud the music is right now (from the notes), for the liquid.
    function energyAt(sec) {
      if (!roll) return 0;
      const ms = sec * 1000;
      let sum = 0;
      for (const tr of roll.tracks) {
        if (tr.drum) continue;
        for (const [s0, l, , v] of tr.n) {
          if (s0 > ms) break;
          if (s0 + l > ms) sum += v / 127 * (tr.role === "melody" ? 1.4 : tr.role === "pad" ? 0.5 : 1);
        }
      }
      return clamp(sum / 7, 0, 1);
    }
    liquid.level = () => (audio.paused ? 0 : energyAt(audio.currentTime || 0));

    // Melody onsets pluck the staves around the demo.
    function onsets(from, to) {
      if (!roll || to <= from || to - from > 0.5) return;
      const a = from * 1000, b = to * 1000, span = Math.max(1, roll.hi - roll.lo);
      for (const tr of roll.tracks) {
        if (tr.drum || (tr.role !== "melody" && tr.role !== "countermelody" && tr.role !== "bass")) continue;
        for (const [s0, , p, v] of tr.n) {
          if (s0 >= b) break;
          if (s0 >= a) staves.excite((p - roll.lo) / span, v / 127, box);
        }
      }
    }

    const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    const setStatus = (txt, busy) => { status.textContent = txt; status.classList.toggle("busy", !!busy); };

    function type(textValue, my) {
      if (reduce) { promptEl.textContent = textValue; return Promise.resolve(); }
      promptEl.textContent = "";
      return new Promise((done) => {
        let i = 0;
        const step = () => {
          if (my !== token) return done();
          promptEl.textContent = textValue.slice(0, ++i);
          if (i < textValue.length) setTimeout(step, 16 + Math.random() * 30); else setTimeout(done, 220);
        };
        setTimeout(step, 120);
      });
    }

    async function select(i, { autoplay = false } = {}) {
      const my = ++token;
      const chip = chips[i];
      const wasPlaying = !audio.paused;
      idx = i;
      chips.forEach((c, k) => c.setAttribute("aria-pressed", String(k === i)));
      audio.pause();
      setStatus("Generating…", true);
      const pending = getRoll(chip.dataset.roll);
      await type(chip.dataset.prompt, my);
      const r = await pending;
      if (my !== token) return;
      roll = r;
      genAt = performance.now();
      audio.src = chip.dataset.src;
      lastT = 0;
      playBtn.setAttribute("aria-label", `Play ${chip.dataset.title}`);
      if (r) {
        const tracks = r.tracks.length;
        meta.textContent = `${r.key} · ${r.tempo} BPM · ${r.meter} · ${tracks} ${tracks === 1 ? "track" : "tracks"}`;
      } else meta.textContent = "";
      setTimeout(() => { if (my === token) setStatus("Generated · offline"); }, reduce ? 0 : 900);
      updateTime();
      if (autoplay || wasPlaying) start();
    }

    function start() {
      started = true;
      box.classList.add("started");
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
    }
    function pause() { audio.pause(); }
    demoPause = pause;

    audio.addEventListener("play", () => { box.classList.add("playing"); rollBox.dataset.cursor = "Pause"; playBtn.setAttribute("aria-label", `Pause ${chips[idx].dataset.title}`); });
    audio.addEventListener("pause", () => { box.classList.remove("playing"); rollBox.dataset.cursor = "Play"; playBtn.setAttribute("aria-label", `Play ${chips[idx].dataset.title}`); });
    audio.addEventListener("ended", () => { audio.currentTime = 0; updateTime(); });
    audio.addEventListener("timeupdate", updateTime);

    function updateTime() {
      const d = audio.duration || (roll && roll.dur) || 30;
      const c = audio.currentTime || 0;
      fill.style.width = `${(c / d) * 100}%`;
      timeEl.textContent = fmt(c);
      bar.setAttribute("aria-valuemax", String(Math.round(d)));
      bar.setAttribute("aria-valuenow", String(Math.round(c)));
      bar.setAttribute("aria-valuetext", fmt(c));
    }

    const toggle = () => { if (audio.paused) start(); else pause(); };
    playBtn.addEventListener("click", toggle);
    rollBox.addEventListener("click", toggle);
    chips.forEach((c, i) => c.addEventListener("click", () => { if (i !== idx || !roll) select(i, { autoplay: true }); else toggle(); }));

    const seekTo = (e) => {
      const r = bar.getBoundingClientRect();
      const f = clamp((e.clientX - r.left) / r.width, 0, 1);
      const go = () => { audio.currentTime = f * (audio.duration || 30); lastT = audio.currentTime; updateTime(); };
      if (audio.readyState >= 1) go(); else { audio.preload = "metadata"; audio.addEventListener("loadedmetadata", go, { once: true }); audio.load(); }
    };
    let dragging = false;
    bar.addEventListener("pointerdown", (e) => { dragging = true; bar.setPointerCapture(e.pointerId); seekTo(e); });
    bar.addEventListener("pointermove", (e) => { if (dragging) seekTo(e); });
    bar.addEventListener("pointerup", () => { dragging = false; });
    bar.addEventListener("pointercancel", () => { dragging = false; });
    bar.addEventListener("keydown", (e) => {
      const d = audio.duration || 30;
      const k = { ArrowRight: 2, ArrowUp: 2, ArrowLeft: -2, ArrowDown: -2, Home: -1e9, End: 1e9 }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      audio.currentTime = clamp((audio.currentTime || 0) + k, 0, d - 0.05);
      lastT = audio.currentTime;
      updateTime();
    });

    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !roll && token === 0) select(0);
    }, { rootMargin: "0px 0px -10% 0px" }).observe(box);

    function roundRect(x, y, w, h, r) {
      if (w < 2 * r) r = w / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
      ctx.fill();
    }

    function draw(now) {
      const W = canvas.clientWidth, H = canvas.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (!W || !H) return;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!roll) return;

      const t = audio.currentTime || 0;
      const span = clamp(W / 62, 6, 15);
      const t0 = clamp(t - span * 0.3, 0, Math.max(0, roll.dur - span));
      const pps = W / span;
      const beat = 60 / roll.tempo, perBar = parseInt(roll.meter, 10) || 4;

      // Beats and bars.
      ctx.globalAlpha = 1;
      for (let b = Math.floor(t0 / beat); b * beat <= t0 + span; b++) {
        ctx.fillStyle = palette.grid;
        const x = Math.round((b * beat - t0) * pps);
        ctx.fillRect(x, 0, b % perBar === 0 ? 1.5 : 1, H);
        if (b % perBar === 0) ctx.fillRect(x, 0, 1, H);
      }

      const drumH = roll.hasDrums ? Math.max(18, H * 0.14) : 0;
      const top = 12, bottom = H - 26 - drumH;
      const rows = roll.hi - roll.lo + 3;
      const rowH = Math.min(9, (bottom - top) / rows);
      const y0 = top + ((bottom - top) - rowH * rows) / 2;
      const yOf = (p) => y0 + (roll.hi + 1.5 - p) * rowH;
      const g = reduce ? 1 : clamp((now - genAt) / 950, 0, 1);
      const reveal = easeOut(g) * (W + 40);
      const playing = !audio.paused;

      for (const tr of roll.tracks) {
        const color = palette[tr.role] || palette.chords;
        ctx.fillStyle = color;
        for (const [s, l, p, v] of tr.n) {
          const ss = s / 1000;
          if (ss > t0 + span) break;
          const ee = ss + l / 1000;
          if (ee < t0) continue;
          const x = (ss - t0) * pps;
          if (x > reveal) break;
          const active = playing && t >= ss && t < ee;
          const vel = v / 127;
          if (tr.drum) {
            const hh = (drumH - 6) * (0.35 + 0.65 * vel);
            ctx.globalAlpha = active ? 1 : 0.28 + 0.4 * vel;
            ctx.fillRect(x, H - 20 - hh, 2, hh);
            continue;
          }
          const w = Math.max(2, (l / 1000) * pps - 1.5);
          const y = yOf(p);
          if (active) {
            ctx.globalAlpha = 0.25;
            roundRect(x - 2, y - 2, w + 4, rowH + 3, 4);
            ctx.globalAlpha = 1;
          } else ctx.globalAlpha = tr.role === "pad" ? 0.22 + 0.3 * vel : 0.35 + 0.45 * vel;
          roundRect(x, y, w, Math.max(1.5, rowH - 1), Math.min(2.5, rowH / 2));
        }
      }
      ctx.globalAlpha = 1;

      if (g < 1) {
        const grad = ctx.createLinearGradient(reveal - 60, 0, reveal, 0);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, palette.accent);
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(reveal - 60, 0, 60, H);
        ctx.globalAlpha = 1;
        ctx.fillRect(reveal, 0, 1.5, H);
      }

      if (started || t > 0) {
        const x = (t - t0) * pps;
        ctx.fillStyle = palette.fg;
        ctx.fillRect(x, 0, 1.5, H);
        ctx.beginPath(); ctx.arc(x + 0.75, 6, 4, 0, Math.PI * 2); ctx.fill();
      }
    }

    tickers.add((now) => {
      if (!audio.paused) {
        const ct = audio.currentTime || 0;
        onsets(lastT, ct);
        lastT = ct;
      }
      if (visible) draw(now);
    });
  });

  //============================================================================

  requestAnimationFrame(loop);
})();

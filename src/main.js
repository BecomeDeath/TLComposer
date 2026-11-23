// Motion and interaction. Everything here is an enhancement: without it the pages still work
// (links open YouTube, the demo has plain players, all content is visible).
//
//   - the stage: a red velvet curtain behind the hero, PromptMIDI and contact sections, with one
//     spotlight and dust in its beam. The light follows the pointer, or finds the heading of the
//     section you're reading; the curtain sways as the page moves; the light swells with the
//     PromptMIDI demo's music.
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
  // The fixed stage layer and when it's on screen

  const layer = $(".stage");

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
  const stageIO = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? showing.add(e.target) : showing.delete(e.target))); });
  $$("[data-stage]").forEach((s) => stageIO.observe(s));
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
  // Shared between the music and the picture: how much is going on (the demo's notes) and
  // short pulses (a note played), which brighten the spotlight.

  const fx = { pulse: 0, level: () => 0, kick(v) { fx.pulse = Math.min(1.2, fx.pulse + v); } };

  //============================================================================
  // Sound (off unless the visitor turns it on): soft notes when hovering links.

  const sound = (() => {
    const toggles = $$("[data-sound-toggle]");
    let on = store.get("sound") === "on", out = null, lastHover = 0;
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

    // One voice: a soft bell.
    const voices = {
      bell:   { parts: [[1, 1, "sine"], [2, 0.22, "sine"], [3.01, 0.06, "triangle"]], attack: 0.006, decay: 1.8, gain: 0.5 },
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
      fx.kick(0.2);
    }

    function set(v, chime = true) {
      on = v;
      store.set("sound", on ? "on" : "off");
      root.classList.toggle("sound-on", on);
      toggles.forEach((b) => b.setAttribute("aria-pressed", String(on)));
      $$(".sound-state").forEach((s) => { s.textContent = on ? "on" : "off"; });
      if (on && chime) { getAudio(); hover(0); setTimeout(() => hover(2, 0.8), 90); setTimeout(() => hover(4, 0.7), 180); }
    }

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
    return { hover, get on() { return on; } };
  })();

  //============================================================================
  // The stage (WebGL): a red velvet curtain in deep folds, one spotlight from above and dust
  // drifting in its beam. The light follows the pointer; otherwise it finds the heading of the
  // section you're reading. The curtain sways when the page moves, and the light swells with
  // the PromptMIDI demo's music.

  const stage = (() => {
    const canvas = layer && $(".stage-gl", layer);
    if (!canvas) return null;

    let gl = null;
    try { gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: fine ? "high-performance" : "default" }); } catch (e) { gl = null; }
    if (!gl) return null;

    const vert = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const frag = `precision highp float;
uniform vec2 uRes; uniform float uT; uniform vec2 uSpot; uniform float uFolds; uniform float uSway;
uniform float uEnergy; uniform float uPulse; uniform float uLight;
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y); }

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * asp, uv.y);

  // The curtain: deep folds, swaying a little, more when the page moves.
  float ph = (uv.x * uFolds + (.06 + uSway) * sin(uT * .5 + uv.y * 2.2) * (1.2 - uv.y) + .04 * sin(uT * .31 + uv.x * 5.)) * 6.2832;
  float fold = sin(ph) + .45 * sin(ph * 2.13 + 1.7) + .18 * sin(ph * 4.7 + .4);
  float slope = cos(ph) + .96 * cos(ph * 2.13 + 1.7) + .85 * cos(ph * 4.7 + .4);
  vec3 n = normalize(vec3(-slope * .32, 0., 1.));

  // The spotlight: a cone from above the stage, aimed at uSpot.
  vec2 src = vec2(asp * .5 + (uSpot.x - asp * .5) * .35, 1.5);
  vec2 dir = normalize(uSpot - src), rel = p - src;
  float along = dot(rel, dir), across = length(rel - dir * along);
  float spread = .03 + along * (.2 + .04 * uEnergy);
  float cone = smoothstep(spread, spread * .45, across) * smoothstep(.1, .5, along);
  float haze = cone * (.5 + .5 * noise(vec2(p.x * 4. - uT * .12, p.y * 2.5 + uT * .2)));
  float pool = exp(-pow(length((p - uSpot) * vec2(1., 1.2)) / (spread * 1.25 + .06), 2.));
  vec3 L = normalize(vec3(src - p, 1.1));
  float diff = clamp(dot(n, L), 0., 1.);
  float rim = pow(1. - n.z, 1.5) * 2.2;
  float light = (1. + .45 * uEnergy + .5 * uPulse) * mix(1., .4, uLight);

  vec3 velvet = mix(uC1, uC2, clamp(.42 + .3 * fold, 0., 1.));
  vec3 col = velvet * (mix(.28, .78, uLight) + .3 * diff) + velvet * rim * .22;
  col += velvet * pool * (1.3 * diff + .9 * rim) * 1.9 * light;
  col += uC3 * pool * pow(diff, 6.) * .2 * light;

  // Dust drifting in the beam.
  vec2 dp = p * 30. + vec2(sin(uT * .2) * 2., -uT * (.5 + .4 * uEnergy));
  vec2 cell = floor(dp), fp = fract(dp);
  vec2 star = vec2(hash(cell), hash(cell + 7.1)) * .8 + .1;
  float tw = .5 + .5 * sin(uT * (1. + hash(cell + 3.) * 2.) + hash(cell) * 6.28);
  float mote = smoothstep(.07, 0., length(fp - star)) * step(.6 - .12 * uEnergy, hash(cell + 11.)) * tw;
  col += uC3 * (haze * .24 * light + mote * cone * (.9 + uPulse) * mix(1., .5, uLight));

  // The floor of the stage is darker; the edges fall away into the hall.
  col *= mix(.5 + .5 * smoothstep(0., .28, uv.y), 1., uLight);
  vec2 v = uv - vec2(.55, .5);
  col = mix(col, uC0, clamp(dot(v, v) * .9, 0., 1.));
  gl_FragColor = vec4(min(col, vec3(1.)), 1.);
}`;

    let U = {}, ok = false, colorsDirty = true, sized = -1, quality = 1;
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
      for (const n of ["uRes", "uT", "uSpot", "uFolds", "uSway", "uEnergy", "uPulse", "uLight", "uC0", "uC1", "uC2", "uC3"]) U[n] = gl.getUniformLocation(prog, n);
      colorsDirty = true;
      sized = -1;
      return true;
    }

    const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); const n = m ? parseInt(m[1], 16) : 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
    function colors() {
      [0, 1, 2, 3].forEach((i) => gl.uniform3fv(U[`uC${i}`], hex(css(`--stage-${i}`))));
      gl.uniform1f(U.uLight, root.dataset.theme === "light" ? 1 : 0);
      colorsDirty = false;
    }
    function size() {
      const k = (view.w < 700 ? 0.7 : 0.6) * quality;
      const cap = Math.min(1, 1200 / Math.max(1, view.w * k));
      const w = Math.max(2, Math.round(view.w * k * cap)), h = Math.max(2, Math.round(view.h * k * cap));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(U.uRes, w, h);
      // About one fold every 80 CSS pixels, so the velvet looks the same size on a phone and a desktop.
      gl.uniform1f(U.uFolds, Math.max(5, view.w / 80));
      sized = view.version;
    }
    new MutationObserver(() => { colorsDirty = true; }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    // Where the light goes: the pointer (with a mouse), otherwise the heading of the section in view.
    const ptr = { x: 0, y: 0, at: -1e9 };
    if (fine) addEventListener("pointermove", (e) => {
      if (e.target.closest?.("[data-stage]")) { ptr.x = e.clientX; ptr.y = e.clientY; ptr.at = performance.now(); }
    }, { passive: true });
    const headings = ".hero-title, .pm-hero-title, .contact-title, .links-name, .nf-title, .display";
    function headingTarget() {
      let best = null, bd = 1e9;
      for (const sec of showing) {
        const r = sec.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - view.h / 2);
        if (d < bd) { bd = d; best = sec; }
      }
      const h = best && best.querySelector(headings);
      if (!h) return null;
      const r = h.getBoundingClientRect();
      return [r.left + Math.min(r.width, view.w * 0.6) * 0.5, clamp(r.top + r.height * 0.5, view.h * 0.15, view.h * 0.85)];
    }

    let t = 8 + Math.random() * 20, energy = 0, sway = 0, drawnOnce = false;
    const spot = { x: view.w * 0.62, y: view.h * 0.45 };

    function draw() {
      if (sized !== view.version) size();
      if (colorsDirty) colors();
      gl.uniform1f(U.uT, t);
      gl.uniform2f(U.uSpot, (spot.x / Math.max(1, view.w)) * (view.w / Math.max(1, view.h)), 1 - spot.y / Math.max(1, view.h));
      gl.uniform1f(U.uSway, sway);
      gl.uniform1f(U.uEnergy, energy);
      gl.uniform1f(U.uPulse, fx.pulse);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      drawnOnce = true;
    }

    // Android can drop the GPU context when the browser goes to the background: build it again.
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); ok = false; layer.classList.remove("on"); });
    canvas.addEventListener("webglcontextrestored", () => { ok = init(); if (ok) layer.classList.add("on"); });

    ok = init();
    if (!ok) return null;
    layer.classList.add("on");

    let slow = 0, frames = 0;
    tickers.add((now, dt) => {
      if (!ok) return;
      if (reduce) {   // one still frame, the light on the first heading
        if (!drawnOnce || sized !== view.version || colorsDirty) { const h = headingTarget(); if (h) { spot.x = h[0]; spot.y = h[1]; } draw(); }
        return;
      }
      if (!layerVisible()) return;
      if (quality > 0.5 && ++frames > 40) {
        slow = slow * 0.95 + (dt > 22 ? 1 : 0) * 0.05;
        if (slow > 0.6) { quality = Math.max(0.5, quality * 0.75); slow = 0; frames = 0; sized = -1; }
      }
      t += dt / 1000;
      let target = null;
      if (fine && now - ptr.at < 4000) target = [ptr.x, ptr.y];
      else {
        const h = headingTarget();
        if (h) target = [h[0] + Math.sin(t * 0.35) * view.w * 0.04, h[1] + Math.sin(t * 0.27) * view.h * 0.03];
      }
      if (target) { spot.x = damp(spot.x, target[0], 2.6, dt); spot.y = damp(spot.y, target[1], 2.6, dt); }
      sway = damp(sway, Math.min(0.45, Math.abs(scroll.v) * 0.015), 3, dt);
      energy = damp(energy, clamp(fx.level(), 0, 1), 8, dt);
      fx.pulse = fx.pulse * Math.exp(-dt / 600);
      if (!Number.isFinite(t)) t = 10;
      draw();
    });
    return { draw };
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
  // Downloads: "Download free" fetches the installer for the visitor's system. On a phone or an
  // unknown system it keeps pointing at the list of installers.

  function visitorOS() {
    const ua = navigator.userAgent || "";
    const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    if (/Android|iPhone|iPad|iPod|CrOS/i.test(ua) || /Android|Chrome OS/i.test(platform)) return "";
    if (/Mac/i.test(platform) && navigator.maxTouchPoints > 1) return "";   // an iPad asking for the desktop site
    if (/Win/i.test(platform) || /Windows/.test(ua)) return "windows";
    if (/Mac/i.test(platform) || /Mac OS X/.test(ua)) return "macos";
    if (/Linux/i.test(platform) || /Linux|X11/.test(ua)) return "linux";
    return "";
  }

  const os = visitorOS();

  let toast, toastTimer;
  function downloadStarted(file) {
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.setAttribute("role", "status");
      document.body.append(toast);
    }
    toast.textContent = file
      ? `Downloading ${file}. Open it when it's done to install PromptMIDI.`
      : "Your download has started.";
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-on"), 7000);
  }

  $$("[data-installers]").forEach((a) => {
    let map = {};
    try { map = JSON.parse(a.dataset.installers); } catch (err) { return; }
    const mine = map[os];
    if (!mine || !mine.url) return;
    a.href = mine.url;
    a.dataset.file = mine.file || "";
    const text = `Download for ${mine.label}`;
    $$("[data-text]", a).forEach((s) => { s.dataset.text = text; s.textContent = text; });
    a.setAttribute("aria-label", `${text} (${mine.file || "installer"})`);
  });

  $$(".download-card[data-os]").forEach((card) => {
    if (card.dataset.os !== os) return;
    card.classList.add("is-yours");
    const badge = $(".download-yours", card);
    if (badge) badge.hidden = false;
  });

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-file]");
    if (!a || e.button !== 0 || !a.dataset.file || !/^https:/.test(a.href)) return;
    downloadStarted(a.dataset.file);
  });

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
    // the spotlight follows the notes themselves.
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

    // How busy and loud the music is right now (from the notes), for the spotlight.
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
    fx.level = () => (audio.paused ? 0 : energyAt(audio.currentTime || 0));

    // The melody's notes make the light flicker.
    function onsets(from, to) {
      if (!roll || to <= from || to - from > 0.5) return;
      const a = from * 1000, b = to * 1000, span = Math.max(1, roll.hi - roll.lo);
      for (const tr of roll.tracks) {
        if (tr.drum || (tr.role !== "melody" && tr.role !== "countermelody" && tr.role !== "bass")) continue;
        for (const [s0, , p, v] of tr.n) {
          if (s0 >= b) break;
          if (s0 >= a) fx.kick(0.05 + 0.12 * v / 127);
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

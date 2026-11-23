// Page templates: plain functions that return HTML. Every value from site.json goes through
// esc() (text) or safeUrl() (links), so content can't break the markup.
//
// The pages work without JavaScript: links go to YouTube, the demo has plain audio players, and
// everything that animates in is visible from the start. main.js adds the motion on top.

import { brandIcons } from "./brand-icons.mjs";

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Links: http(s), mailto and relative paths only. */
export function safeUrl(url) {
  const u = String(url ?? "").trim();
  if (!u) return "";
  if (/^(https?:|mailto:)/i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";   // javascript:, data: ...
  return u;
}

const isTodo = (s) => !s || /^TODO\b/.test(String(s));

/** Text, or nothing while it's still a placeholder (so drafts don't show "TODO" on the page). */
const text = (s, fallback = "") => (isTodo(s) ? fallback : s);

const pad2 = (n) => String(n).padStart(2, "0");

//==============================================================================
// Icons

const stroke = (d, w = 1.6) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const icon = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
  download: stroke("M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 15.5V19h14v-3.5"),
  arrow: stroke("M5 12h13m-5-5 5 5-5 5"),
  arrowUp: stroke("M12 19V6m-5 5 5-5 5 5"),
  external: stroke("M7 17 17 7m-8 0h8v8"),
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m4.5 7 7.5 6 7.5-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: stroke("m6 6 12 12M18 6 6 18"),
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z" fill="currentColor"/></svg>',
  check: stroke("m5 12.5 4.5 4.5L19 7.5", 1.8),
};

function brandSvg(platform) {
  const b = brandIcons[platform];
  return b ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${b.path}" fill="currentColor"/></svg>` : "";
}

export const platformLabel = (p) => brandIcons[p]?.label ?? p;

/** The PromptMIDI mark: the same rounded square and note as the plug-in. */
export const mark = `<svg class="mark" viewBox="0 0 28 28" aria-hidden="true"><defs><linearGradient id="mk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a99bff"/><stop offset="1" stop-color="#5141c9"/></linearGradient></defs><rect width="28" height="28" rx="7" fill="url(#mk)"/><ellipse cx="11.75" cy="18.75" rx="4.25" ry="3.25" fill="#fff"/><rect x="14.6" y="6" width="1.8" height="13" fill="#fff"/><rect x="14.6" y="6" width="6.5" height="1.8" fill="#fff"/></svg>`;

//==============================================================================
// Pieces

const socials = (site) => site.socials.filter((s) => safeUrl(s.url));

function initials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "♪";
}

/** Text that rolls up to a copy of itself on hover (nav links, buttons). */
const roll = (label) => `<span class="roll"><span data-text="${esc(label)}">${esc(label)}</span></span>`;

/** A button-looking link. Its fill grows from where the pointer came in (main.js). */
function button(href, label, { cls = "", iconHtml = "", external = false, attrs = "" } = {}) {
  return `<a class="button ${cls}" href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ""} data-magnetic ${attrs}><span class="button-fill" aria-hidden="true"></span>${roll(label)}${iconHtml ? `<span class="button-icon">${iconHtml}</span>` : ""}</a>`;
}

function cover(release, cls = "cover", { lazy = true, sizes = "" } = {}) {
  if (!safeUrl(release.cover)) return `<div class="${cls} cover-placeholder" aria-hidden="true"><span>${esc(initials(text(release.title, "New release")))}</span></div>`;
  const [w, h] = release.wide ? [1280, 720] : [600, 600];
  return `<img class="${cls}" src="${esc(safeUrl(release.cover))}" alt=""${lazy ? ' loading="lazy"' : ""} decoding="async" width="${w}" height="${h}"${sizes ? ` sizes="${sizes}"` : ""}>`;
}

/** Where a release goes: the video in the lightbox (main.js), else its first link. */
function releaseTarget(release) {
  const firstLink = Object.values(release.links || {}).map(safeUrl).find(Boolean) || "";
  const e = release.embedResolved;
  const video = e && e.label === "YouTube" ? e.src : "";
  return { href: firstLink || "#music", video };
}

/** An email link that spam harvesters can't read in the page source (main.js assembles it). */
function emailLink(email, cls, inner, attrs = "") {
  const [user, domain] = String(email).split("@");
  if (!user || !domain) return "";
  return `<a class="${cls} email-link" href="#contact" data-u="${esc(user)}" data-d="${esc(domain)}" ${attrs}>${inner(`<span class="email-text">${esc(user)}<span class="at"> [at] </span>${esc(domain)}</span>`)}</a>`;
}

/** A heading that main.js splits into words (or letters) that rise into place. */
const split = (tag, html, { cls = "", id = "", mode = "words" } = {}) =>
  `<${tag}${id ? ` id="${id}"` : ""} class="${cls}" data-split="${mode}">${html}</${tag}>`;

const label = (n, s) => `<p class="label"><span class="label-n">(${pad2(n)})</span> ${esc(s)}</p>`;

function nav(current) {
  return [
    ["index.html#work", "Work", "work"],
    ["index.html#about", "About", "about"],
    ["promptmidi.html", "PromptMIDI", "promptmidi"],
    ["index.html#contact", "Contact", "contact"],
  ].map(([href, name, id]) => ({ href, name, id, current: current === id }));
}

function header(site, current) {
  const a = site.artist;
  const items = nav(current);
  return `<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="index.html" aria-label="${esc(a.name)}, home" data-magnetic="0.25">
    <span class="brand-mark" aria-hidden="true">${esc(initials(a.name))}</span>
    <span class="brand-name">${esc(a.name)}</span>
  </a>
  <nav class="nav" aria-label="Main">
    <ul>${items.map((i) => `<li><a href="${i.href}"${i.current ? ' aria-current="page"' : ""} data-sound>${roll(i.name)}</a></li>`).join("")}</ul>
  </nav>
  <div class="header-tools">
    <button class="sound-toggle" type="button" aria-pressed="false" title="Interface sounds" data-magnetic="0.3">
      <span class="sound-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="sound-label">Sound <span class="sound-state">off</span></span>
    </button>
    <button class="icon-button theme-toggle" type="button" aria-label="Switch between dark and light" data-magnetic="0.3">${icon.sun}${icon.moon}</button>
    <button class="menu-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="menu"><span class="menu-lines" aria-hidden="true"><i></i><i></i></span></button>
  </div>
</header>
<div class="menu" id="menu" hidden>
  <nav aria-label="Menu">
    <ol class="menu-links">${[...items, { href: "links.html", name: "Links", id: "links" }].map((i, n) => `<li style="--i:${n}"><a href="${i.href}"><span class="menu-n">${pad2(n + 1)}</span><span class="menu-name">${esc(i.name)}</span></a></li>`).join("")}</ol>
  </nav>
  <div class="menu-foot">
    ${site.contact.email ? emailLink(site.contact.email, "menu-email", (t) => t) : ""}
    <ul class="menu-socials">${socials(site).map((s) => `<li><a href="${esc(safeUrl(s.url))}" target="_blank" rel="me noopener">${esc(platformLabel(s.platform))}</a></li>`).join("")}</ul>
  </div>
</div>`;
}

function footer(site) {
  const a = site.artist;
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="wrap footer-top">
    <div class="footer-col">
      <p class="label">Menu</p>
      <ul>${nav("").map((i) => `<li><a href="${i.href}">${roll(i.name)}</a></li>`).join("")}<li><a href="links.html">${roll("Links")}</a></li></ul>
    </div>
    <div class="footer-col">
      <p class="label">Social</p>
      <ul>${socials(site).map((s) => `<li><a href="${esc(safeUrl(s.url))}" target="_blank" rel="me noopener">${roll(platformLabel(s.platform))}</a></li>`).join("")}</ul>
    </div>
    <div class="footer-col">
      <p class="label">Local time</p>
      <p class="clock" data-tz="${esc(a.timezone || "")}"><span class="clock-place">${esc(a.location || "")}</span> <span class="clock-time"></span></p>
      ${site.contact.email ? emailLink(site.contact.email, "footer-email", (t) => roll("Email") + `<span class="visually-hidden">${t}</span>`) : ""}
    </div>
    <button class="to-top" type="button" data-magnetic>${icon.arrowUp}<span>Back to top</span></button>
  </div>
  <div class="footer-word" aria-hidden="true"><span data-speed="-0.08">${esc(a.name)}</span></div>
  <div class="wrap footer-bottom">
    <span>© ${year} ${esc(a.name)}</span>
    <span>Made in ${esc(a.location || "Denmark")}</span>
  </div>
</footer>`;
}

/** The fixed layers every page shares: the liquid canvas, cursor, page curtain, video lightbox. */
function chrome() {
  return `<div class="liquid" aria-hidden="true"><canvas></canvas><div class="liquid-fallback"><i></i><i></i><i></i></div></div>
<div class="cursor" aria-hidden="true"><div class="cursor-ring"><span class="cursor-label"></span></div><div class="cursor-dot"></div></div>
<div class="curtain" aria-hidden="true"><span class="curtain-mark"></span></div>
<dialog class="lightbox" aria-label="Video">
  <div class="lightbox-frame"></div>
  <p class="lightbox-title"></p>
  <button class="lightbox-close" type="button" aria-label="Close the video" autofocus data-magnetic>${icon.close}</button>
</dialog>
<svg class="defs" aria-hidden="true" width="0" height="0">
  <filter id="liquid-distort" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>`;
}

/** The whole page: head (meta, social cards, structured data), header, content, footer. */
function layout(site, { title, description, path, current, body, bodyClass = "", jsonLd = null, image = "", bare = false, loader = false }) {
  const base = site.site.url ? site.site.url.replace(/\/?$/, "/") : "";
  const canonical = base ? base + (path === "index.html" ? "" : path) : "";
  const ogImage = image && base ? base + image : "";
  return `<!doctype html>
<html lang="${esc(site.site.language || "en")}" data-theme="dark" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ""}
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}"><meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<meta name="theme-color" content="#08080c">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="preload" href="assets/fonts/instrument-serif.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/inter-regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="styles.css">
<script>(function(d){var r=d.documentElement,m=matchMedia("(prefers-reduced-motion: reduce)").matches,pt=false,seen=true;r.className="js"+(m?" reduce":"");try{var t=localStorage.getItem("theme");r.dataset.theme=t||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark")}catch(e){}try{pt=!!sessionStorage.getItem("pt");sessionStorage.removeItem("pt");seen=!!sessionStorage.getItem("seen")}catch(e){}if(pt&&!m)r.classList.add("pt-in");if(${loader ? "seen||m||pt" : "true"})r.classList.add("no-loader")})(document)</script>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body class="${bodyClass}">
${loader ? `<div class="loader" aria-hidden="true"><div class="loader-name">${esc(site.artist.name).split("").map((c, i) => `<span style="--i:${i}">${c === " " ? "&nbsp;" : c}</span>`).join("")}</div><div class="loader-count"><span>000</span></div></div>` : ""}
${chrome()}
${bare ? "" : header(site, current)}
<main id="main">
${body}
</main>
${bare ? "" : footer(site)}
<script src="assets/vendor/lenis.min.js" defer></script>
<script src="main.js" defer></script>
</body>
</html>
`;
}

//==============================================================================
// The PromptMIDI demo: a prompt, the real notes of that example, and its audio.

function demo(site, { large = false } = {}) {
  const p = site.promptmidi;
  const ex = p.examples.filter((e) => safeUrl(e.file));
  if (!ex.length) return "";
  const rollFor = (e) => `assets/rolls/${e.file.split("/").pop().replace(/\.mp3$/, "")}.json`;
  return `<div class="pm-demo${large ? " pm-demo-large" : ""}" data-demo>
  <div class="pm-demo-bar">
    <span class="pm-dots" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="pm-demo-name">${mark}${esc(p.name)}</span>
    <span class="pm-status" data-status aria-live="polite">Offline</span>
  </div>
  <div class="pm-prompt">
    <span class="pm-prompt-icon">${icon.spark}</span>
    <span class="pm-prompt-text" data-prompt>${esc(ex[0].prompt)}</span><span class="pm-caret" aria-hidden="true"></span>
  </div>
  <p class="pm-meta" data-meta>&nbsp;</p>
  <div class="pm-roll" data-cursor="Play"><canvas aria-hidden="true"></canvas><p class="pm-roll-hint">The notes PromptMIDI wrote for this prompt</p></div>
  <div class="pm-transport">
    <button class="pm-play" type="button" aria-label="Play ${esc(ex[0].title)}" data-magnetic="0.3">${icon.play}${icon.pause}</button>
    <span class="pm-time" data-time>0:00</span>
    <div class="pm-progress" role="slider" aria-label="Position" aria-valuemin="0" aria-valuemax="30" aria-valuenow="0" aria-valuetext="0:00" tabindex="0"><span></span></div>
    <span class="pm-time pm-dur">0:30</span>
  </div>
  <div class="pm-chips" role="group" aria-label="Examples">${ex.map((e, i) => `<button class="pm-chip" type="button" aria-pressed="${i === 0}" data-src="${esc(safeUrl(e.file))}" data-roll="${esc(rollFor(e))}" data-prompt="${esc(e.prompt)}" data-title="${esc(e.title)}" data-sound>${esc(e.title)}</button>`).join("")}</div>
  <noscript><ul class="pm-plain">${ex.map((e) => `<li><strong>${esc(e.title)}</strong> “${esc(e.prompt)}”<audio controls preload="none" src="${esc(safeUrl(e.file))}"></audio></li>`).join("")}</ul></noscript>
  ${text(p.examplesNote) ? `<p class="pm-note">${esc(p.examplesNote)}</p>` : ""}
</div>`;
}

//==============================================================================
// Pages

export function homePage(site) {
  const a = site.artist, m = site.music, p = site.promptmidi;
  const releases = m.releases.filter((r) => !isTodo(r.title));
  const featured = releases.find((r) => r.featured) || releases[0];
  const email = site.contact.email;
  const youtube = site.socials.find((s) => s.platform === "youtube" && safeUrl(s.url));
  const [first, ...rest] = String(a.name).split(" ");
  const ft = featured ? releaseTarget(featured) : null;
  const chars = (s) => esc(s).split("").map((c) => (c === " " ? " " : `<span class="c">${c}</span>`)).join("");

  const body = `
<section class="hero" id="top" data-liquid>
  <div class="hero-inner" data-hero>
    <p class="hero-eyebrow" data-reveal><span>${esc(a.tagline.replace(/\.$/, ""))}</span></p>
    <h1 class="hero-title" aria-label="${esc(a.name)}">
      <span class="hero-line" aria-hidden="true">${chars(first)}</span>
      ${rest.length ? `<span class="hero-line hero-line-2" aria-hidden="true"><em>${chars(rest.join(" "))}</em></span>` : ""}
    </h1>
    <div class="hero-foot">
      ${text(a.intro) ? `<p class="hero-intro" data-reveal>${esc(a.intro)}</p>` : ""}
      ${featured ? `<a class="hero-latest" href="${esc(ft.href)}" target="_blank" rel="noopener"${ft.video ? ` data-video="${esc(ft.video)}" data-title="${esc(featured.title)}"` : ""} data-cursor="Play" data-reveal data-sound>
        <span class="hero-latest-media">${cover({ ...featured, wide: true }, "hero-latest-img", { lazy: false })}<span class="hero-latest-play">${icon.play}</span></span>
        <span class="hero-latest-text"><span class="label">Latest release</span><strong>${esc(featured.title)}</strong></span>
      </a>` : ""}
    </div>
  </div>
  <a class="scroll-cue" href="#about" aria-label="Scroll to About"><span>Scroll</span><i aria-hidden="true"></i></a>
</section>

<section class="section about solid fade-in" id="about" aria-labelledby="about-h">
  <div class="wrap about-grid">
    <div class="about-side">
      ${label(1, "About")}
      <h2 id="about-h" class="visually-hidden">About</h2>
    </div>
    <div class="about-main">
      <p class="statement" data-words>${esc(text(a.statement, a.tagline))}</p>
      <div class="about-cols">
        <div class="bio" data-reveal>${a.bio.filter((b) => !isTodo(b)).map((b) => `<p>${esc(b)}</p>`).join("")}</div>
        <dl class="facts" data-reveal>
          ${a.location ? `<div><dt>Based in</dt><dd>${esc(a.location)}</dd></div>` : ""}
          ${(a.focus || []).length ? `<div><dt>Focus</dt><dd>${a.focus.map(esc).join(", ")}</dd></div>` : ""}
          <div><dt>Plug-in</dt><dd><a class="text-link" href="promptmidi.html">${esc(p.name)}</a>, free</dd></div>
        </dl>
      </div>
    </div>
  </div>
</section>

${featured ? `<section class="showcase solid" id="work" aria-labelledby="showcase-h">
  <div class="wrap showcase-head">${label(2, "Latest release")}</div>
  <a class="showcase-frame" href="${esc(ft.href)}" target="_blank" rel="noopener"${ft.video ? ` data-video="${esc(ft.video)}" data-title="${esc(featured.title)}"` : ""} data-cursor="Play" data-showcase>
    <span class="showcase-media">${cover({ ...featured, wide: true }, "showcase-img", { sizes: "100vw" })}</span>
    <span class="showcase-shade" aria-hidden="true"></span>
    <span class="showcase-caption">
      ${featured.type ? `<span class="label">${esc(featured.type)}</span>` : ""}
      <span id="showcase-h" class="showcase-title">${esc(featured.title)}</span>
    </span>
    <span class="showcase-play" aria-hidden="true">${icon.play}<span>Watch</span></span>
  </a>
</section>` : ""}

<section class="section works solid" id="music" aria-labelledby="music-h">
  <div class="wrap">
    <div class="section-head">
      ${label(3, "Selected works")}
      ${split("h2", esc(m.heading || "Music"), { cls: "display", id: "music-h" })}
      ${text(m.intro) ? `<p class="section-intro" data-reveal>${esc(m.intro)}</p>` : ""}
    </div>
    <ol class="works-list">${releases.map((r, i) => {
      const t = releaseTarget(r);
      return `<li data-reveal style="--i:${i}"><a class="work" href="${esc(t.href)}" target="_blank" rel="noopener"${t.video ? ` data-video="${esc(t.video)}" data-title="${esc(r.title)}"` : ""}${safeUrl(r.cover) ? ` data-image="${esc(safeUrl(r.cover))}"` : ""} data-cursor="Play" data-sound>
        <span class="work-index">${pad2(i + 1)}</span>
        <span class="work-title">${esc(r.title)}</span>
        <span class="work-type">${esc(r.type || "")}</span>
        <span class="work-go" aria-hidden="true">${icon.play}</span>
        ${cover({ ...r, wide: true }, "work-thumb")}
        ${text(r.description) ? `<span class="work-desc">${esc(r.description)}</span>` : ""}
      </a></li>`;
    }).join("")}</ol>
    ${youtube ? `<div class="works-more">${button(safeUrl(youtube.url), "All music on YouTube", { external: true, iconHtml: icon.external })}</div>` : ""}
  </div>
  <div class="work-preview" aria-hidden="true"><div class="work-preview-inner"></div></div>
</section>

<div class="marquee solid" aria-hidden="true"><div class="marquee-track">${Array(2).fill(`<span class="marquee-group">${(site.marquee || []).map((w, i) => `<span class="${i % 2 ? "it" : ""}">${esc(w)}</span><i>${icon.spark}</i>`).join("")}</span>`).join("")}</div></div>

<section class="section pm" id="promptmidi" aria-labelledby="pm-h" data-liquid>
  <div class="wrap pm-grid">
    <div class="pm-copy">
      ${label(4, "Free plug-in")}
      ${split("h2", esc(p.name), { cls: "display", id: "pm-h" })}
      <p class="lead" data-reveal>${esc(p.tagline)}</p>
      <p class="muted" data-reveal>${esc(p.summary)}</p>
      <ul class="pm-points" data-reveal>${p.features.slice(0, 3).map((f) => `<li>${icon.check}<span><strong>${esc(f.title)}.</strong> ${esc(f.text)}</span></li>`).join("")}</ul>
      <div class="actions" data-reveal>
        ${button("promptmidi.html#download", "Download free", { cls: "primary", iconHtml: icon.download })}
        ${button("promptmidi.html", "See what it does", { iconHtml: icon.arrow })}
      </div>
    </div>
    <div class="pm-demo-wrap" data-reveal>${demo(site)}</div>
  </div>
</section>

<section class="section contact" id="contact" aria-labelledby="contact-h" data-liquid>
  <div class="wrap">
    ${label(5, "Contact")}
    ${split("h2", esc(text(site.contact.heading, "Get in touch")), { cls: "contact-title display", id: "contact-h" })}
    <p class="lead" data-reveal>${esc(site.contact.note)}</p>
    ${email ? `<div class="contact-email-wrap" data-reveal>${emailLink(email, "contact-email", (t) => `${t}<span class="contact-email-arrow">${icon.arrow}</span>`, 'data-magnetic="0.15" data-cursor="Write"')}</div>` : ""}
    <ul class="pills" data-reveal>${socials(site).map((s) => `<li><a class="pill" href="${esc(safeUrl(s.url))}" target="_blank" rel="me noopener" data-magnetic="0.3" data-sound><span class="button-fill" aria-hidden="true"></span>${brandSvg(s.platform)}<span>${esc(platformLabel(s.platform))}</span></a></li>`).join("")}</ul>
  </div>
</section>`;

  return layout(site, {
    title: site.site.title || a.name,
    description: site.site.description,
    path: "index.html",
    current: "home",
    body,
    bodyClass: "page-home",
    loader: true,
    image: featured && safeUrl(featured.cover) ? safeUrl(featured.cover) : "assets/promptmidi/screenshot.png",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Person",
      name: a.name,
      jobTitle: "Composer",
      description: site.site.description,
      ...(site.site.url ? { url: site.site.url } : {}),
      sameAs: site.socials.map((s) => safeUrl(s.url)).filter((u) => /^https?:/.test(u)),
    },
  });
}

export function promptmidiPage(site) {
  const p = site.promptmidi;
  const body = `
<section class="pm-hero" data-liquid>
  <div class="wrap">
    <p class="label" data-reveal>${mark} Free · VST3, AU and standalone</p>
    ${split("h1", esc(p.name), { cls: "pm-hero-title", mode: "chars" })}
    <p class="lead pm-hero-lead" data-reveal>${esc(p.tagline)}</p>
    <div class="actions" data-reveal>
      ${button("#download", "Download free", { cls: "primary", iconHtml: icon.download })}
      ${button("#listen", "Hear examples", { iconHtml: icon.play })}
    </div>
  </div>
  <div class="wrap pm-hero-demo" id="listen" data-reveal>${demo(site, { large: true })}</div>
</section>

<section class="section solid fade-in" aria-labelledby="intro-h">
  <div class="wrap about-grid">
    <div class="about-side">${label(1, "What it is")}</div>
    <div class="about-main">
      <h2 id="intro-h" class="visually-hidden">What it is</h2>
      <p class="statement" data-words>${esc(text(p.statement, p.tagline))}</p>
    </div>
  </div>
</section>

<section class="section solid" aria-labelledby="features-h">
  <div class="wrap">
    <div class="section-head">
      ${label(2, "Features")}
      ${split("h2", "What it does", { cls: "display", id: "features-h" })}
    </div>
    <ul class="features">${p.features.map((f, i) => `<li class="feature spot" data-reveal style="--i:${i % 3}">
      <span class="feature-n">${pad2(i + 1)}</span>
      <h3>${esc(f.title)}</h3>
      <p>${esc(f.text)}</p>
    </li>`).join("")}</ul>
  </div>
</section>

<section class="section solid" aria-labelledby="how-h">
  <div class="wrap how">
    <div class="how-side">
      ${label(3, "How it works")}
      ${split("h2", "Three steps", { cls: "display", id: "how-h" })}
    </div>
    <ol class="steps">${p.steps.map((s, i) => `<li class="step" data-reveal>
      <span class="step-n">${pad2(i + 1)}</span>
      <div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>
    </li>`).join("")}</ol>
  </div>
  <div class="wrap shots">
    <figure class="shot" data-tilt data-reveal><img src="assets/promptmidi/screenshot.png" alt="PromptMIDI's window: the prompt box, example prompts, the Key, Scale, Tempo, Bars, Length and Instruments controls, and a 21-track orchestral piece in the arrangement view" loading="lazy" decoding="async" width="1400" height="903"></figure>
    <figure class="shot" data-tilt data-reveal style="--i:1"><img src="assets/promptmidi/editor.png" alt="The note editor open on a piccolo part, with the arrangement above it" loading="lazy" decoding="async" width="1400" height="903"></figure>
  </div>
</section>

<section class="section download" id="download" aria-labelledby="download-h" data-liquid>
  <div class="wrap">
    <div class="section-head">
      ${label(4, "Download")}
      ${split("h2", "Get PromptMIDI", { cls: "display", id: "download-h" })}
      <p class="section-intro" data-reveal>${esc(p.requirements)}</p>
    </div>
    <ul class="downloads">${p.downloads.filter((d) => safeUrl(d.url)).map((d, i) => `<li data-reveal style="--i:${i}"><a class="download-card spot" href="${esc(safeUrl(d.url))}" target="_blank" rel="noopener" data-cursor="Get" data-sound>
      <span class="download-os">${esc(d.label)}</span>
      <span class="download-detail">${esc(d.detail)}</span>
      <span class="download-icon">${icon.download}</span>
    </a></li>`).join("")}</ul>
    <p class="small muted" data-reveal>Copy the whole <code>PromptMIDI.vst3</code> folder into your VST3 folder and rescan plug-ins. ${safeUrl(p.repo) ? `Source code, build instructions and the full guide are on <a class="text-link" href="${esc(safeUrl(p.repo))}" target="_blank" rel="noopener">GitHub</a>.` : ""}</p>
  </div>
</section>

<section class="section solid fade-in" aria-labelledby="faq-h">
  <div class="wrap how">
    <div class="how-side">
      ${label(5, "Questions")}
      ${split("h2", "FAQ", { cls: "display", id: "faq-h" })}
    </div>
    <div class="faq">${p.faq.map((f) => `<details data-reveal><summary data-sound><span>${esc(f.q)}</span><i aria-hidden="true"></i></summary><div class="faq-a"><p>${esc(f.a)}</p></div></details>`).join("")}</div>
  </div>
</section>`;

  return layout(site, {
    title: `${p.name}: ${p.tagline}`,
    description: p.summary,
    path: "promptmidi.html",
    current: "promptmidi",
    body,
    bodyClass: "page-promptmidi",
    image: "assets/promptmidi/screenshot.png",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: p.name,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Windows, macOS, Linux",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description: p.summary,
      author: { "@type": "Person", name: site.artist.name },
    },
  });
}

export function linksPage(site) {
  const a = site.artist;
  const featured = site.music.releases.find((r) => r.featured) || site.music.releases[0];
  const ft = featured ? releaseTarget(featured) : null;
  const items = [
    ...socials(site).map((s) => ({ label: platformLabel(s.platform), url: safeUrl(s.url), icon: brandSvg(s.platform) })),
    ...(site.links.extra || []).filter((l) => safeUrl(l.url)).map((l) => ({ label: l.label, url: safeUrl(l.url), icon: /promptmidi/i.test(l.url) ? mark : icon.external })),
  ];

  const body = `
<section class="links-page" data-liquid>
  <div class="links-card">
    <a class="links-brand" href="index.html"><span class="brand-mark">${esc(initials(a.name))}</span></a>
    <h1 class="links-name">${esc(a.name)}</h1>
    <p class="muted">${esc(a.tagline)}</p>
    ${featured && ft ? `<a class="links-feature" href="${esc(ft.href)}" target="_blank" rel="noopener"${ft.video ? ` data-video="${esc(ft.video)}" data-title="${esc(featured.title)}"` : ""} data-cursor="Play">
      ${cover({ ...featured, wide: true }, "links-feature-img", { lazy: false })}
      <span class="links-feature-text"><span class="label">Listen</span><strong>${esc(featured.title)}</strong></span>
      <span class="links-feature-play">${icon.play}</span>
    </a>` : ""}
    <ul class="link-list">${items.map((l, i) => `<li data-reveal style="--i:${i}"><a class="link-button" href="${esc(l.url)}"${/^https?:/.test(l.url) ? ' target="_blank" rel="noopener"' : ""} data-magnetic="0.12" data-sound><span class="button-fill" aria-hidden="true"></span>${l.icon}<span>${esc(l.label)}</span>${icon.arrow}</a></li>`).join("")}${
      site.contact.email ? `<li data-reveal style="--i:${items.length}">${emailLink(site.contact.email, "link-button", () => `<span class="button-fill" aria-hidden="true"></span>${icon.mail}<span>Email</span>${icon.arrow}`, 'data-magnetic="0.12" data-sound')}</li>` : ""}</ul>
    <a class="small muted text-link" href="index.html">${esc(a.name)} · website</a>
  </div>
</section>`;

  return layout(site, {
    title: `${a.name}: links`,
    description: `${a.tagline} Music, socials and PromptMIDI.`,
    path: "links.html",
    current: "links",
    body,
    bodyClass: "page-links",
    bare: true,
  });
}

export function notFoundPage(site) {
  return layout(site, {
    title: `Not found · ${site.artist.name}`,
    description: site.site.description,
    path: "404.html",
    current: "",
    bodyClass: "page-404",
    body: `<section class="nf" data-liquid><div class="wrap">
      <p class="label">Error 404</p>
      ${split("h1", "Lost in the <em>score</em>.", { cls: "nf-title display" })}
      <p class="lead">This page isn't here. It may have moved.</p>
      <div class="actions">${button("index.html", "Home", { cls: "primary", iconHtml: icon.arrow })}${button("links.html", "Links", { iconHtml: icon.arrow })}</div>
    </div></section>`,
  });
}

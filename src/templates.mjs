// Page templates: plain functions that return HTML. Every value from site.json goes through
// esc() (text) or safeUrl() (links), so content can't break the markup.

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

//==============================================================================
// Icons

export const icon = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 15.5V19h14v-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5m0-5-8 8M18 14v4.5a.5.5 0 0 1-.5.5h-12a.5.5 0 0 1-.5-.5v-12a.5.5 0 0 1 .5-.5H10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m4.5 7 7.5 6 7.5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  github: brandSvg("github"),
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

function socialLinks(site, cls = "socials") {
  const items = site.socials.filter((s) => safeUrl(s.url));
  if (!items.length) return "";
  return `<ul class="${cls}">${items
    .map((s) => `<li><a href="${esc(safeUrl(s.url))}" rel="me noopener" target="_blank" aria-label="${esc(platformLabel(s.platform))}" title="${esc(platformLabel(s.platform))}">${brandSvg(s.platform)}</a></li>`)
    .join("")}</ul>`;
}

function initials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "♪";
}

function cover(release, cls = "cover") {
  const c = release.wide ? `${cls} wide` : cls;
  const [w, h] = release.wide ? [1280, 720] : [600, 600];
  if (safeUrl(release.cover)) return `<img class="${c}" src="${esc(safeUrl(release.cover))}" alt="${esc(release.title)}" loading="lazy" width="${w}" height="${h}">`;
  return `<div class="${c} cover-placeholder" aria-hidden="true"><span>${esc(initials(text(release.title, "New release")))}</span></div>`;
}

/** A video's thumbnail that turns into its player when clicked (nothing loads from YouTube before that). */
function videoFacade(release) {
  const e = release.embedResolved;
  if (!e || e.label !== "YouTube" || !safeUrl(release.cover)) return "";
  return `<div class="embed video-facade" data-src="${esc(e.src)}" data-height="0" data-title="${esc(text(release.title, "Video"))}">
    <button class="embed-load cover-button" type="button" aria-label="Play ${esc(text(release.title, "the video"))}">
      ${cover({ ...release, wide: true })}
      <span class="play-badge">${icon.play}</span>
    </button>
  </div>`;
}

/** An email link that spam harvesters can't read in the page source (main.js assembles it). */
function emailLink(email, cls, inner) {
  const [user, domain] = String(email).split("@");
  if (!user || !domain) return "";
  return `<a class="${cls} email-link" href="#contact" data-u="${esc(user)}" data-d="${esc(domain)}">${inner(`<span class="email-text">${esc(user)} [at] ${esc(domain)}</span>`)}</a>`;
}

/** A player that loads the provider's embed only when asked (no tracking until then). */
function embed(release) {
  const e = release.embedResolved;
  if (!e) return "";
  return `<div class="embed" data-src="${esc(e.src)}" data-height="${e.height}" data-title="${esc(text(release.title, "Release"))}">
    <button class="embed-load" type="button">${icon.play}<span>Play on ${esc(e.label)}</span></button>
    <p class="embed-note">Loads the ${esc(e.label)} player</p>
  </div>`;
}

function releaseLinks(release) {
  const links = Object.entries(release.links || {}).filter(([, u]) => safeUrl(u));
  if (!links.length) return "";
  return `<ul class="platforms">${links
    .map(([p, u]) => `<li><a href="${esc(safeUrl(u))}" target="_blank" rel="noopener">${brandSvg(p)}<span>${esc(platformLabel(p))}</span></a></li>`)
    .join("")}</ul>`;
}

function header(site, current) {
  const a = site.artist;
  const nav = [
    ["index.html#music", "Music", "music"],
    ["promptmidi.html", "PromptMIDI", "promptmidi"],
    ["index.html#about", "About", "about"],
    ["index.html#contact", "Contact", "contact"],
  ];
  return `<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="index.html">${esc(a.name)}</a>
    <nav class="nav" id="nav" aria-label="Main">
      <ul>${nav.map(([href, label, id]) => `<li><a href="${href}"${current === id ? ' aria-current="page"' : ""}>${label}</a></li>`).join("")}</ul>
    </nav>
    <div class="header-tools">
      <button class="icon-button theme-toggle" type="button" aria-label="Switch between dark and light">${icon.sun}${icon.moon}</button>
      <button class="icon-button menu-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav">${icon.menu}${icon.close}</button>
    </div>
  </div>
</header>`;
}

function footer(site) {
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="wrap footer-row">
    <div>
      <a class="brand" href="index.html">${esc(site.artist.name)}</a>
      <p class="muted">© ${year} ${esc(site.artist.name)}</p>
    </div>
    ${socialLinks(site)}
    <ul class="footer-links">
      <li><a href="promptmidi.html">PromptMIDI</a></li>
      <li><a href="links.html">Links</a></li>
      ${site.contact.email ? `<li>${emailLink(site.contact.email, "", () => "Email")}</li>` : ""}
    </ul>
  </div>
</footer>`;
}

/** The whole page: head (meta, social cards, structured data), header, content, footer. */
function layout(site, { title, description, path, current, body, bodyClass = "", jsonLd = null, image = "" }) {
  const base = site.site.url ? site.site.url.replace(/\/?$/, "/") : "";
  const canonical = base ? base + (path === "index.html" ? "" : path) : "";
  const ogImage = image && base ? base + image : "";
  return `<!doctype html>
<html lang="${esc(site.site.language || "en")}" data-theme="dark">
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
<meta name="theme-color" content="#0d0f13">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="preload" href="assets/fonts/inter-regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="styles.css">
<script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t;else if(matchMedia("(prefers-color-scheme: light)").matches)document.documentElement.dataset.theme="light"}catch(e){}</script>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body class="${bodyClass}">
${body.includes('class="links-page"') ? "" : header(site, current)}
<main id="main">
${body}
</main>
${body.includes('class="links-page"') ? "" : footer(site)}
<script src="main.js" defer></script>
</body>
</html>
`;
}

//==============================================================================
// Pages

export function homePage(site) {
  const a = site.artist, m = site.music, p = site.promptmidi;
  const releases = m.releases.filter((r) => !isTodo(r.title) || true);
  const featured = releases.find((r) => r.featured) || releases[0];
  const others = releases.filter((r) => r !== featured);
  const email = site.contact.email;

  const body = `
<section class="hero">
  <div class="hero-roll" aria-hidden="true">${site.pianoRoll}</div>
  <div class="wrap hero-grid">
    <div class="hero-copy">
      ${a.location ? `<p class="eyebrow">${esc(a.location)}</p>` : ""}
      <h1>${esc(a.name)}</h1>
      <p class="lead">${esc(a.tagline)}</p>
      ${text(a.intro) ? `<p class="intro">${esc(a.intro)}</p>` : ""}
      <div class="actions">
        <a class="button primary" href="#music">${icon.play}<span>Listen</span></a>
        <a class="button" href="promptmidi.html">${mark}<span>Get PromptMIDI</span></a>
      </div>
      ${socialLinks(site)}
    </div>
    ${featured ? `<a class="hero-release" href="#music">
      ${cover(featured, "cover")}
      <span class="hero-release-meta"><span class="eyebrow">Latest release</span><strong>${esc(text(featured.title, "New release"))}</strong></span>
    </a>` : ""}
  </div>
</section>

<section class="section" id="music" aria-labelledby="music-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="music-h">${esc(m.heading || "Music")}</h2>
      ${text(m.intro) ? `<p class="muted">${esc(m.intro)}</p>` : ""}
    </div>
    ${featured ? `<article class="feature${featured.wide ? " feature-wide" : ""}">
      ${videoFacade(featured) || cover(featured, "cover feature-cover")}
      <div class="feature-body">
        ${[featured.type, featured.date].filter(Boolean).length ? `<p class="eyebrow">${esc([featured.type, featured.date].filter(Boolean).join(" · "))}</p>` : ""}
        <h3>${esc(text(featured.title, "New release"))}</h3>
        ${text(featured.description) ? `<p>${esc(featured.description)}</p>` : ""}
        ${videoFacade(featured) ? "" : embed(featured)}
        ${releaseLinks(featured)}
      </div>
    </article>` : ""}
    ${others.length ? `<ul class="release-grid${others.some((r) => r.wide) ? " release-grid-wide" : ""}">${others.map((r) => `<li class="release">
      ${videoFacade(r) || cover(r)}
      <div class="release-body">
        ${[r.type, r.date].filter(Boolean).length ? `<p class="eyebrow">${esc([r.type, r.date].filter(Boolean).join(" · "))}</p>` : ""}
        <h3>${esc(text(r.title, "Release"))}</h3>
        ${text(r.description) ? `<p class="muted">${esc(r.description)}</p>` : ""}
        ${videoFacade(r) ? "" : embed(r)}
        ${releaseLinks(r)}
      </div>
    </li>`).join("")}</ul>` : ""}
  </div>
</section>

<section class="section section-alt" id="promptmidi" aria-labelledby="pm-h">
  <div class="wrap split">
    <div>
      <p class="eyebrow">${mark} Free plug-in</p>
      <h2 id="pm-h">${esc(p.name)}</h2>
      <p class="lead">${esc(p.tagline)}</p>
      <p>${esc(p.summary)}</p>
      <ul class="checks">${p.features.slice(0, 3).map((f) => `<li><strong>${esc(f.title)}.</strong> ${esc(f.text)}</li>`).join("")}</ul>
      <div class="actions">
        <a class="button primary" href="promptmidi.html#download">${icon.download}<span>Download</span></a>
        <a class="button" href="promptmidi.html">${icon.arrow}<span>See what it does</span></a>
      </div>
    </div>
    <a class="shot" href="promptmidi.html"><img src="assets/promptmidi/screenshot.png" alt="PromptMIDI: a prompt box, the controls, and a fantasy orchestral piece in the arrangement view" loading="lazy" width="1400" height="903"></a>
  </div>
</section>

<section class="section" id="about" aria-labelledby="about-h">
  <div class="wrap about">
    ${safeUrl(a.photo) ? `<img class="portrait" src="${esc(safeUrl(a.photo))}" alt="${esc(a.name)}" loading="lazy" width="640" height="800">` : `<div class="portrait portrait-placeholder" aria-hidden="true"><span>${esc(initials(a.name))}</span></div>`}
    <div>
      <h2 id="about-h">About</h2>
      ${a.bio.filter((b) => !isTodo(b)).map((b) => `<p>${esc(b)}</p>`).join("") || `<p class="muted">A short bio is coming soon.</p>`}
    </div>
  </div>
</section>

<section class="section section-alt" id="contact" aria-labelledby="contact-h">
  <div class="wrap contact">
    <div>
      <h2 id="contact-h">Contact</h2>
      <p class="lead">${esc(site.contact.note)}</p>
    </div>
    <div class="contact-actions">
      ${email ? emailLink(email, "button primary", (t) => `${icon.mail}${t}`) : ""}
      ${socialLinks(site, "socials socials-large")}
    </div>
  </div>
</section>`;

  return layout(site, {
    title: site.site.title || a.name,
    description: site.site.description,
    path: "index.html",
    current: "home",
    body,
    image: "assets/promptmidi/screenshot.png",
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
<section class="hero hero-product">
  <div class="hero-roll" aria-hidden="true">${site.pianoRoll}</div>
  <div class="wrap center">
    <p class="eyebrow">${mark} Free · VST3, AU and standalone</p>
    <h1>${esc(p.name)}</h1>
    <p class="lead">${esc(p.tagline)}</p>
    <p class="intro">${esc(p.summary)}</p>
    <div class="actions center">
      <a class="button primary" href="#download">${icon.download}<span>Download</span></a>
      <a class="button" href="#listen">${icon.play}<span>Hear examples</span></a>
    </div>
    <figure class="product-shot">
      <img src="assets/promptmidi/screenshot.png" alt="PromptMIDI's window: the prompt box, example prompts, the Key, Scale, Tempo, Bars, Length and Instruments controls, and a 21-track orchestral piece in the arrangement view" width="1400" height="903">
    </figure>
  </div>
</section>

<section class="section" id="listen" aria-labelledby="listen-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="listen-h">Hear it</h2>
      <p class="muted">${esc(p.examplesNote)}</p>
    </div>
    <ul class="tracks">${p.examples.map((e, i) => `<li class="track">
      <button class="track-play" type="button" data-src="${esc(safeUrl(e.file))}" aria-label="Play ${esc(e.title)}">${icon.play}${icon.pause}</button>
      <div class="track-body">
        <div class="track-title"><strong>${esc(e.title)}</strong><span class="track-time" data-time>0:00</span></div>
        <p class="prompt">“${esc(e.prompt)}”</p>
        <div class="track-progress" role="slider" aria-label="Position in ${esc(e.title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"><span></span></div>
      </div>
    </li>`).join("")}</ul>
  </div>
</section>

<section class="section section-alt" aria-labelledby="features-h">
  <div class="wrap">
    <div class="section-head"><h2 id="features-h">What it does</h2></div>
    <ul class="features">${p.features.map((f) => `<li><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></li>`).join("")}</ul>
  </div>
</section>

<section class="section" aria-labelledby="how-h">
  <div class="wrap split">
    <div>
      <h2 id="how-h">How it works</h2>
      <ol class="steps">${p.steps.map((s) => `<li><strong>${esc(s.title)}</strong><span>${esc(s.text)}</span></li>`).join("")}</ol>
    </div>
    <figure class="shot"><img src="assets/promptmidi/editor.png" alt="The note editor open on a piccolo part, with the arrangement above it" loading="lazy" width="1400" height="903"></figure>
  </div>
</section>

<section class="section section-alt" id="download" aria-labelledby="download-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="download-h">Download</h2>
      <p class="muted">${esc(p.requirements)}</p>
    </div>
    <ul class="downloads">${p.downloads.filter((d) => safeUrl(d.url)).map((d) => `<li><a class="download" href="${esc(safeUrl(d.url))}" target="_blank" rel="noopener">
      ${icon.download}<span><strong>${esc(d.label)}</strong><span class="muted">${esc(d.detail)}</span></span></a></li>`).join("")}</ul>
    <p class="muted small">Copy the whole <code>PromptMIDI.vst3</code> folder into your VST3 folder and rescan plug-ins. ${safeUrl(p.repo) ? `Source code, build instructions and the full guide are on <a href="${esc(safeUrl(p.repo))}" target="_blank" rel="noopener">GitHub</a>.` : ""}</p>
  </div>
</section>

<section class="section" aria-labelledby="faq-h">
  <div class="wrap narrow">
    <h2 id="faq-h">Questions</h2>
    <div class="faq">${p.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
  </div>
</section>`;

  return layout(site, {
    title: `${p.name}: ${p.tagline}`,
    description: p.summary,
    path: "promptmidi.html",
    current: "promptmidi",
    body,
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
  const featuredUrl = featured ? Object.values(featured.links || {}).map(safeUrl).find(Boolean) : "";
  const items = [
    ...(featured && featuredUrl ? [{ label: `Listen: ${text(featured.title, "the latest release")}`, url: featuredUrl, icon: icon.play, primary: true }] : []),
    ...site.socials.filter((s) => safeUrl(s.url)).map((s) => ({ label: platformLabel(s.platform), url: safeUrl(s.url), icon: brandSvg(s.platform) })),
    ...(site.links.extra || []).filter((l) => safeUrl(l.url)).map((l) => ({ label: l.label, url: safeUrl(l.url), icon: /promptmidi/i.test(l.url) ? mark : icon.external })),
  ];

  const body = `
<div class="links-page">
  <div class="hero-roll" aria-hidden="true">${site.pianoRoll}</div>
  <div class="links-card">
    ${safeUrl(a.photo) ? `<img class="avatar" src="${esc(safeUrl(a.photo))}" alt="" width="96" height="96">` : `<div class="avatar avatar-placeholder" aria-hidden="true">${esc(initials(a.name))}</div>`}
    <h1>${esc(a.name)}</h1>
    <p class="muted">${esc(a.tagline)}</p>
    <ul class="link-list">${items.map((l) => `<li><a class="link-button${l.primary ? " primary" : ""}" href="${esc(l.url)}"${/^https?:/.test(l.url) ? ' target="_blank" rel="noopener"' : ""}>${l.icon}<span>${esc(l.label)}</span></a></li>`).join("")}${
      site.contact.email ? `<li>${emailLink(site.contact.email, "link-button", () => `${icon.mail}<span>Email</span>`)}</li>` : ""}</ul>
    <a class="muted small" href="index.html">${esc(a.name)} · website</a>
  </div>
</div>`;

  return layout(site, {
    title: `${a.name}: links`,
    description: `${a.tagline} Music, socials and PromptMIDI.`,
    path: "links.html",
    current: "links",
    body,
  });
}

export function notFoundPage(site) {
  return layout(site, {
    title: `Not found · ${site.artist.name}`,
    description: site.site.description,
    path: "404.html",
    current: "",
    body: `<section class="section"><div class="wrap narrow center">
      <p class="eyebrow">404</p><h1>This page isn't here</h1>
      <p class="lead">It may have moved. Try the <a href="index.html">home page</a> or the <a href="links.html">links</a>.</p>
    </div></section>`,
  });
}

#!/usr/bin/env node
// Builds the website into dist/ from site.json. No dependencies: Node 18 or later.
//
//   node build.mjs            build
//   node build.mjs --serve    build, then serve dist/ on http://localhost:4321 (rebuilds on each page load)

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { homePage, linksPage, notFoundPage, promptmidiPage, safeUrl } from "./src/templates.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const dist = join(root, "dist");

//==============================================================================
// Embeds: paste a share link in site.json; this turns it into the provider's player.

function resolveEmbed(url) {
  const u = safeUrl(url);
  if (!/^https:/.test(u)) return null;
  let m;

  if ((m = u.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|artist)\/([A-Za-z0-9]+)/)))
    return { label: "Spotify", src: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0`, height: m[1] === "track" || m[1] === "episode" ? 152 : 352 };

  if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/)))
    return { label: "YouTube", src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`, height: 0 };

  if ((m = u.match(/youtube\.com\/playlist\?list=([A-Za-z0-9_-]+)/)))
    return { label: "YouTube", src: `https://www.youtube-nocookie.com/embed/videoseries?list=${m[1]}`, height: 0 };

  if (/^https:\/\/(www\.|m\.)?soundcloud\.com\//.test(u))
    return { label: "SoundCloud", src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&color=%237d6ff7&auto_play=false&visual=false`, height: /\/sets\//.test(u) ? 300 : 166 };

  if (/^https:\/\/music\.apple\.com\//.test(u))
    return { label: "Apple Music", src: u.replace("https://music.apple.com/", "https://embed.music.apple.com/"), height: /[?&]i=/.test(u) ? 175 : 450 };

  if (/bandcamp\.com\/EmbeddedPlayer\//.test(u))
    return { label: "Bandcamp", src: u, height: /size=large/.test(u) ? 470 : 120 };

  return null;
}

//==============================================================================
// The piano-roll pattern behind the heroes: deterministic, drawn as one SVG.

function pianoRoll(accent) {
  let s = 1234567;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const rows = 26, w = 1600, h = 520, rowH = h / rows;
  let bars = "";
  let pitch = 13;

  for (let x = 0; x < w;) {
    pitch = Math.max(2, Math.min(rows - 3, pitch + Math.round((rnd() - 0.5) * 5)));
    const len = [24, 48, 48, 72, 96, 144][Math.floor(rnd() * 6)];
    const o = (0.25 + rnd() * 0.55).toFixed(2);
    bars += `<rect x="${x}" y="${(pitch * rowH).toFixed(1)}" width="${len - 4}" height="${(rowH - 4).toFixed(1)}" rx="3" fill="${accent}" opacity="${o}"/>`;

    if (rnd() < 0.35) {   // a chord tone under it
      const p2 = Math.min(rows - 1, pitch + 3 + Math.floor(rnd() * 3));
      bars += `<rect x="${x}" y="${(p2 * rowH).toFixed(1)}" width="${len - 4}" height="${(rowH - 4).toFixed(1)}" rx="3" fill="${accent}" opacity="${(o * 0.6).toFixed(2)}"/>`;
    }

    x += len + (rnd() < 0.2 ? 24 : 0);
  }

  let grid = "";
  for (let x = 0; x <= w; x += 192) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" />`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><g class="roll-grid">${grid}</g>${bars}</svg>`;
}

//==============================================================================

function warnings(site) {
  const out = [];
  const walk = (v, path) => {
    if (typeof v === "string" && /^TODO\b/.test(v)) out.push(`${path}: still a placeholder`);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (k !== "_help") walk(x, path ? `${path}.${k}` : k);
  };
  walk(site, "");
  if (site.artist.name === "Your Artist Name") out.push("artist.name: still a placeholder");
  if (!site.contact.email) out.push("contact.email: empty (the Contact section shows only the social links)");
  if (!site.socials.some((s) => s.url && s.platform !== "github")) out.push("socials: no profiles yet");
  if (!site.site.url) out.push("site.url: empty (needed for canonical links, social cards and the sitemap)");
  return out;
}

export function build({ quiet = false } = {}) {
  const site = JSON.parse(readFileSync(join(root, "site.json"), "utf8"));

  for (const r of site.music.releases) {
    r.embedResolved = resolveEmbed(r.embed);
    if (r.embed && !r.embedResolved && !quiet) console.warn(`  ! ${r.title}: can't make a player from ${r.embed}`);
  }

  site.pianoRoll = pianoRoll(site.site.accent || "#7d6ff7");

  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  cpSync(join(root, "assets"), join(dist, "assets"), { recursive: true });
  cpSync(join(root, "src", "styles.css"), join(dist, "styles.css"));
  cpSync(join(root, "src", "main.js"), join(dist, "main.js"));

  const pages = {
    "index.html": homePage(site),
    "promptmidi.html": promptmidiPage(site),
    "links.html": linksPage(site),
    "404.html": notFoundPage(site),
  };

  for (const [name, html] of Object.entries(pages)) {
    let out = html;

    // GitHub Pages serves 404.html at any missing path: anchor its links to the site.
    if (name === "404.html" && site.site.url)
      out = out.replace("<head>", `<head>\n<base href="${site.site.url.replace(/\/?$/, "/")}">`);

    writeFileSync(join(dist, name), out);
  }

  writeFileSync(join(dist, ".nojekyll"), "");
  writeFileSync(join(dist, "assets", "img", "favicon.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a99bff"/><stop offset="1" stop-color="#5141c9"/></linearGradient></defs><rect width="28" height="28" rx="7" fill="url(#g)"/><ellipse cx="11.75" cy="18.75" rx="4.25" ry="3.25" fill="#fff"/><rect x="14.6" y="6" width="1.8" height="13" fill="#fff"/><rect x="14.6" y="6" width="6.5" height="1.8" fill="#fff"/></svg>`);

  if (site.site.url) {
    const base = site.site.url.replace(/\/?$/, "/");
    writeFileSync(join(dist, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${base}sitemap.xml\n`);
    writeFileSync(join(dist, "sitemap.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      ["", "promptmidi.html", "links.html"].map((p) => `  <url><loc>${base}${p}</loc></url>`).join("\n") + "\n</urlset>\n");
  }

  if (!quiet) {
    console.log(`Built ${Object.keys(pages).length} pages into dist/`);
    const w = warnings(site);
    if (w.length) console.log(`\nStill to fill in (site.json):\n${w.map((x) => "  - " + x).join("\n")}`);
  }
}

build();

if (process.argv.includes("--serve")) {
  const port = Number(process.env.PORT || 4321);
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml",
                  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".mp3": "audio/mpeg",
                  ".xml": "application/xml", ".txt": "text/plain" };

  createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    if (path.endsWith(".html")) build({ quiet: true });   // edits to site.json show on reload
    const file = normalize(join(dist, path));

    if (!file.startsWith(dist) || !existsSync(file)) {
      res.writeHead(404, { "content-type": types[".html"] });
      res.end(readFileSync(join(dist, "404.html")));
      return;
    }

    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  }).listen(port, () => console.log(`\nServing dist/ on http://localhost:${port}`));
}

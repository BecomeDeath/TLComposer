# TLComposer

The website of Tobias Lauritsen, orchestral composer, live at **https://becomedeath.github.io/TLComposer/**: music, socials and [PromptMIDI](https://github.com/BecomeDeath/PromptMIDI). It has a home page (music, PromptMIDI, about, contact), a PromptMIDI page (examples to listen to, features, downloads, questions) and a link-in-bio page (`links.html`).

It's a static site with no dependencies: a small Node script turns `site.json` into plain HTML in `dist/`.

## Editing

Everything on the site comes from **`site.json`**:

- `artist`: name, tagline, intro, bio paragraphs, photo (a path like `assets/img/me.jpg` or a URL), location.
- `contact.email`: shown as a button (leave empty to hide it).
- `socials`: paste your profile URLs; empty ones are left out. Platforms: spotify, applemusic, soundcloud, youtube, bandcamp, instagram, tiktok, x, threads, bluesky, discord, twitch, patreon, github, facebook.
- `music.releases`: title, type, date, cover (path or URL), description, the links per platform, and `embed`: paste a Spotify, YouTube, SoundCloud or Apple Music share link (or a Bandcamp *EmbeddedPlayer* link) to show a player. Players load only when a visitor presses Play, so nothing is fetched from those services before that. Mark one release `"featured": true` to put it at the top.
- `promptmidi`: the plug-in page: features, audio examples (`assets/audio/`), download links, requirements and questions.
- `site.url`: the address the site ends up at (for social-media previews, the sitemap and search engines).

Text that still starts with `TODO` is a placeholder: it's hidden on the page, and the build lists what's left to fill in.

Put images in `assets/img/` (square covers around 1000 × 1000; a portrait photo around 800 × 1000).

## Preview and build

Needs [Node.js](https://nodejs.org) 18 or later.

```bash
node build.mjs --serve     # http://localhost:4321, rebuilt on every page load
node build.mjs             # writes dist/
```

## Publishing on GitHub Pages

1. In this repository: **Settings > Pages > Build and deployment > Source: GitHub Actions** (once).
2. Every push to `main` builds and publishes the site (`.github/workflows/pages.yml`) at https://becomedeath.github.io/TLComposer/.
3. For your own domain, add it under **Settings > Pages > Custom domain** and change `site.url` in `site.json` to it.

All links are relative, so the site works both at the root of a domain and in a repository's sub-folder.

## Credits

- [Inter](https://rsms.me/inter/) typeface (SIL Open Font License, `assets/fonts/Inter-OFL.txt`), subset to Latin.
- Brand icons from [Simple Icons](https://simpleicons.org) (CC0); the logos belong to their owners and are used only to link to the profiles.
- The audio examples were rendered by PromptMIDI's preview with the GeneralUser GS SoundFont by S. Christian Collins.

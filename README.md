# TLComposer

The website of Tobias Lauritsen, orchestral composer, live at **https://becomedeath.github.io/TLComposer/**: music, socials and [PromptMIDI](https://github.com/BecomeDeath/PromptMIDI). It has a home page (music, PromptMIDI, about, contact), a PromptMIDI page (examples to listen to, features, downloads, questions) and a link-in-bio page (`links.html`).

It's a static site with no build dependencies: a small Node script turns `site.json` into plain HTML in `dist/`.

## What moves

- **The stage**: behind the hero, PromptMIDI and contact sections hangs a red velvet curtain in deep folds, lit by one spotlight with dust drifting in its beam (WebGL). The light follows the pointer; on phones, and whenever the pointer rests, it finds the heading of the section you're reading. The curtain sways as the page moves, and the light swells with the PromptMIDI demo's music. Without WebGL it falls back to velvet stripes and a pool of light in CSS.
- **Smooth scrolling** with a mouse or trackpad ([Lenis](https://github.com/darkroomengineering/lenis), in `assets/vendor/`); phones keep their own native scrolling. Headings rise word by word, the About statement lights up as you read it, the latest release grows to full width, a marquee speeds up with your scroll.
- **Interaction**: a notehead cursor (it fills and grows a stem over links), magnetic buttons, button fills that grow from the pointer, work titles that show their cover as a liquid preview, videos in a lightbox, a curtain with a staff between pages, a count-in on the first visit.
- **Sections are named like movements**: I. Prelude, II. Theme, III. Variations, IV. Interlude, V. Coda.
- **The PromptMIDI demo**: each example's real notes, drawn in time with its audio. Pick a prompt, press Play.
- **Sound** is off by default; with it on, hovering links plays soft notes. The switch is in the header.

Slow devices get a lower resolution automatically. Everything still works without JavaScript, and visitors who prefer reduced motion get a still page with the same content.

## Editing

Everything on the site comes from **`site.json`**:

- `artist`: name, tagline, intro, `statement` (the large sentence under About), bio paragraphs, photo (a path like `assets/img/me.jpg` or a URL), location, `timezone` (for the clock in the footer) and `focus`.
- `contact`: `heading` (the big line above the email), `email` (leave empty to hide it) and a short note.
- `marquee`: the words in the moving band between Music and PromptMIDI.
- `socials`: paste your profile URLs; empty ones are left out. Platforms: spotify, applemusic, soundcloud, youtube, bandcamp, instagram, tiktok, x, threads, bluesky, discord, twitch, patreon, github, facebook.
- `music.releases`: title, type, date, cover (path or URL), description, the links per platform, and `embed`: paste a Spotify, YouTube, SoundCloud or Apple Music share link (or a Bandcamp *EmbeddedPlayer* link) to show a player. Players load only when a visitor presses Play, so nothing is fetched from those services before that. Mark one release `"featured": true` to put it at the top.
- `promptmidi`: the plug-in page: statement, features, audio examples, download links, requirements and questions.
- `site.url`: the address the site ends up at (for social-media previews, the sitemap and search engines).

Text that still starts with `TODO` is a placeholder: it's hidden on the page, and the build lists what's left to fill in.

Put images in `assets/img/` (square covers around 1000 × 1000; a portrait photo around 800 × 1000).

## PromptMIDI examples

Each example in `promptmidi.examples` has an audio file (`assets/audio/<name>.mp3`) and its notes (`assets/rolls/<name>.json`), which the demo draws in time with the audio. Both come from the plug-in itself. To add or change an example, edit its prompt in `site.json` and render it with a PromptMIDI build and ffmpeg:

```bash
PROMPTMIDI_CLI=path/to/promptmidi-cli \
PROMPTMIDI_RENDER=path/to/promptmidi_render_preview \
node tools/make-examples.mjs            # all examples, or name some: ... soft-piano lofi
```

An example's `seed` (default 7) picks the take.

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
- [Instrument Serif](https://github.com/Instrument/instrument-serif) typeface (SIL Open Font License, `assets/fonts/InstrumentSerif-OFL.txt`), via Fontsource.
- [Lenis](https://github.com/darkroomengineering/lenis) 1.3.26 smooth scrolling (MIT, `assets/vendor/LENIS-LICENSE.txt`).
- Brand icons from [Simple Icons](https://simpleicons.org) (CC0); the logos belong to their owners and are used only to link to the profiles.
- The audio examples were rendered by PromptMIDI's preview with the GeneralUser GS SoundFont by S. Christian Collins.

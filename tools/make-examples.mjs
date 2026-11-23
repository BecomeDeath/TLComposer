#!/usr/bin/env node
// Renders the PromptMIDI examples listed in site.json (promptmidi.examples) with the plug-in's own
// tools, so the audio on the site and the piano roll drawn over it are the same piece:
//
//   assets/audio/<name>.mp3   the in-plug-in preview, 30 seconds
//   assets/rolls/<name>.json  the notes of that preview, for the interactive piano roll
//
// Needs a PromptMIDI build (https://github.com/BecomeDeath/PromptMIDI) and ffmpeg:
//
//   PROMPTMIDI_CLI=path/to/promptmidi-cli \
//   PROMPTMIDI_RENDER=path/to/promptmidi_render_preview \
//   node tools/make-examples.mjs [name ...]
//
// An example's "seed" (default 7) picks the take; change it in site.json for another one.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = process.env.PROMPTMIDI_CLI, render = process.env.PROMPTMIDI_RENDER;
const seconds = 30;

if (!cli || !render) {
  console.error("Set PROMPTMIDI_CLI and PROMPTMIDI_RENDER to the plug-in's promptmidi-cli and promptmidi_render_preview.");
  process.exit(1);
}

const keyNames = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const modeName = (m) => ({ major: "major", minor: "minor", harmonic_minor: "harmonic minor" })[m] || m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, " ");

/** The plug-in's JSON export, cut to the rendered seconds and made compact (times in milliseconds). */
export function toRoll(piece, dur = seconds) {
  const ppq = piece.ticksPerBar / (piece.tsNum * 4 / piece.tsDen);
  const msPerTick = 60000 / piece.tempo / ppq;
  const tracks = [];
  let lo = 127, hi = 0;

  for (const t of piece.tracks) {
    const n = t.notes
      .map(([start, len, pitch, vel]) => [Math.round(start * msPerTick), Math.max(30, Math.round(len * msPerTick)), pitch, vel])
      .filter(([s]) => s < dur * 1000)
      .map(([s, l, p, v]) => [s, Math.min(l, dur * 1000 - s), p, v]);
    if (!n.length) continue;
    if (!t.drum) for (const [, , p] of n) { lo = Math.min(lo, p); hi = Math.max(hi, p); }
    tracks.push({ name: t.name, role: t.role, drum: !!t.drum, n });
  }

  return {
    v: 1,
    dur,
    tempo: piece.tempo,
    meter: `${piece.tsNum}/${piece.tsDen}`,
    key: `${keyNames[piece.keyRoot] ?? ""} ${modeName(piece.mode)}`.trim(),
    lo, hi,
    tracks,
  };
}

function loudness(file) {
  // volumedetect reports on stderr.
  return spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-i", file, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr || "";
}

function main() {
  const site = JSON.parse(readFileSync(join(root, "site.json"), "utf8"));
  const only = process.argv.slice(2);
  const work = mkdtempSync(join(tmpdir(), "promptmidi-examples-"));
  mkdirSync(join(root, "assets", "rolls"), { recursive: true });

  try {
    for (const ex of site.promptmidi.examples) {
      const name = basename(ex.file, ".mp3");
      if (only.length && !only.includes(name)) continue;
      const seed = String(ex.seed ?? 7);
      const wav = join(work, `${name}.wav`), json = join(work, `${name}.json`);

      execFileSync(render, [wav, ex.prompt, String(seconds), seed], { stdio: "ignore" });
      execFileSync(cli, [ex.prompt, "--seed", seed, "--json", json, "-o", join(work, `${name}.mid`)], { stdio: "ignore" });

      // Level every example to about -20 dBFS RMS (peaks under -1 dBFS) and fade the last 1.5 s.
      const stats = loudness(wav);
      const mean = Number(/mean_volume:\s*(-?[\d.]+)/.exec(stats)?.[1] ?? -20);
      const peak = Number(/max_volume:\s*(-?[\d.]+)/.exec(stats)?.[1] ?? -1);
      const gain = Math.min(-20 - mean, -1 - peak).toFixed(1);

      execFileSync("ffmpeg", ["-nostdin", "-loglevel", "error", "-y", "-i", wav,
        "-af", `volume=${gain}dB,afade=t=out:st=${seconds - 1.5}:d=1.5`, "-ar", "48000", "-ac", "2", "-b:a", "160k",
        join(root, ex.file)]);

      const roll = toRoll(JSON.parse(readFileSync(json, "utf8")));
      writeFileSync(join(root, "assets", "rolls", `${name}.json`), JSON.stringify(roll));
      console.log(`${name}: ${roll.key}, ${roll.tempo} BPM, ${roll.tracks.length} tracks, ${roll.tracks.reduce((a, t) => a + t.n.length, 0)} notes (gain ${gain} dB)`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

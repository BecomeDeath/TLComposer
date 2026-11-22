// Small enhancements; the site works without them.
(() => {
  const root = document.documentElement;

  // Theme: dark or light, remembered on this device.
  document.querySelector(".theme-toggle")?.addEventListener("click", () => {
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
  });

  // Mobile menu.
  const menu = document.querySelector(".menu-toggle");
  menu?.addEventListener("click", () => {
    const open = document.body.classList.toggle("menu-open");
    menu.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll(".nav a").forEach((a) => a.addEventListener("click", () => {
    document.body.classList.remove("menu-open");
    menu?.setAttribute("aria-expanded", "false");
  }));

  // Email links are put together here, so the address isn't sitting in the page for spam harvesters.
  document.querySelectorAll(".email-link").forEach((a) => {
    const address = `${a.dataset.u}@${a.dataset.d}`;
    a.href = `mailto:${address}`;
    const label = a.querySelector(".email-text");
    if (label) label.textContent = address;
  });

  // Players load only when asked: nothing is fetched from Spotify, YouTube and co. before that.
  document.querySelectorAll(".embed").forEach((box) => {
    box.querySelector(".embed-load")?.addEventListener("click", () => {
      const frame = document.createElement("iframe");
      frame.src = box.dataset.src + (box.dataset.src.includes("youtube") ? "&autoplay=1" : "");
      frame.title = box.dataset.title || "Player";
      frame.loading = "lazy";
      frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
      const h = Number(box.dataset.height);
      if (h > 0) frame.height = h; else frame.className = "video";
      box.replaceChildren(frame);
    });
  });

  // Example tracks: one plays at a time.
  let current = null;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  document.querySelectorAll(".track").forEach((track) => {
    const button = track.querySelector(".track-play");
    const bar = track.querySelector(".track-progress");
    const fill = bar?.querySelector("span");
    const time = track.querySelector("[data-time]");
    let audio = null;

    const ensure = () => {
      if (audio) return audio;
      audio = new Audio(button.dataset.src);
      audio.preload = "metadata";
      audio.addEventListener("timeupdate", () => {
        const p = audio.duration ? audio.currentTime / audio.duration : 0;
        fill.style.width = `${p * 100}%`;
        bar.setAttribute("aria-valuenow", String(Math.round(p * 100)));
        time.textContent = fmt(audio.currentTime);
      });
      audio.addEventListener("ended", () => { track.classList.remove("playing"); audio.currentTime = 0; });
      audio.addEventListener("pause", () => track.classList.remove("playing"));
      audio.addEventListener("play", () => track.classList.add("playing"));
      return audio;
    };

    button.addEventListener("click", () => {
      const a = ensure();
      if (a.paused) {
        if (current && current !== a) current.pause();
        current = a;
        a.play();
      } else {
        a.pause();
      }
    });

    const seek = (fraction) => {
      const a = ensure();
      const go = () => { a.currentTime = Math.max(0, Math.min(1, fraction)) * a.duration; };
      if (a.duration) go(); else a.addEventListener("loadedmetadata", go, { once: true });
    };

    bar?.addEventListener("click", (e) => {
      const r = bar.getBoundingClientRect();
      seek((e.clientX - r.left) / r.width);
    });

    bar?.addEventListener("keydown", (e) => {
      if (!audio || !audio.duration) return;
      const step = e.key === "ArrowRight" ? 5 : e.key === "ArrowLeft" ? -5 : 0;
      if (step) { e.preventDefault(); audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + step)); }
    });
  });
})();

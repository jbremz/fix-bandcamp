// Adds a Bandcamp-style bottom player with a seekable progress bar for
// whatever is currently playing on the feed.
// Runs in the page's MAIN world at document_start; media.js (loaded first)
// tracks which <audio> element is playing.
(() => {
  if (window.__bcPlusSeek || !window.__bcPlus) return;
  window.__bcPlusSeek = true;

  const KEY_STEP = 5; // seconds per arrow-key press on the progress bar

  let media = null;
  let seekFrac = null; // non-null while the user is dragging
  let ui = null;

  const MEDIA_EVENTS = ["timeupdate", "durationchange", "loadedmetadata", "progress", "play", "pause", "emptied", "seeked", "waiting", "playing"];

  window.__bcPlus.onChange((el) => {
    if (media) {
      for (const ev of MEDIA_EVENTS) media.removeEventListener(ev, render);
    }
    media = el;
    for (const ev of MEDIA_EVENTS) media.addEventListener(ev, render);
    render();
  });

  // Same mm:ss format as Bandcamp's player.
  function fmt(s) {
    if (!isFinite(s)) return "00:00";
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600);
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
  }

  function build() {
    const root = document.createElement("div");
    root.id = "bcplus-player";
    root.innerHTML = `
      <div class="bcplus-inner">
        <div class="bcplus-now-playing">
          <img class="bcplus-art" alt="">
          <div class="bcplus-np-info">
            <div class="bcplus-np-title"></div>
            <div class="bcplus-np-artist"></div>
          </div>
        </div>
        <div class="bcplus-progress-transport">
          <div class="bcplus-playpause" role="button" tabindex="0" aria-label="Play/pause">
            <div class="bcplus-play"></div>
            <div class="bcplus-pause"></div>
            <div class="bcplus-busy"></div>
          </div>
          <div class="bcplus-info-progress">
            <div class="bcplus-info">
              <div class="bcplus-title"></div>
              <div class="bcplus-pos-dur"><span class="bcplus-pos">00:00</span> / <span class="bcplus-dur">00:00</span></div>
            </div>
            <div class="bcplus-progress-bar" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0">
              <div class="bcplus-progress"></div>
              <div class="bcplus-buffer"></div>
              <div class="bcplus-progress-bg"></div>
              <div class="bcplus-seek-control-outer"><div class="bcplus-seek-control"></div></div>
            </div>
          </div>
        </div>
        <div class="bcplus-controls-extra"></div>
      </div>`;
    document.body.appendChild(root);

    const $ = (sel) => root.querySelector(sel);
    ui = {
      root,
      art: $(".bcplus-art"),
      npTitle: $(".bcplus-np-title"),
      npArtist: $(".bcplus-np-artist"),
      nowPlaying: $(".bcplus-now-playing"),
      playpause: $(".bcplus-playpause"),
      title: $(".bcplus-title"),
      pos: $(".bcplus-pos"),
      dur: $(".bcplus-dur"),
      bar: $(".bcplus-progress-bar"),
      progress: $(".bcplus-progress"),
      buffer: $(".bcplus-buffer"),
      knob: $(".bcplus-seek-control"),
    };

    // Go through Bandcamp's own control for the item so its player state
    // stays in charge; calling media.play() directly gets overridden.
    const togglePlay = () => {
      const trigger = lastItem?.isConnected && lastItem.querySelector(".track_play_auxiliary");
      if (trigger) trigger.click();
      else if (media) media.paused ? media.play() : media.pause();
    };
    ui.playpause.addEventListener("click", togglePlay);
    ui.playpause.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    });

    ui.nowPlaying.addEventListener("click", () => {
      playingItem()?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    // Click or drag anywhere on the bar to seek; commit on release.
    const fracAt = (e) => {
      const r = ui.bar.getBoundingClientRect();
      return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    };
    ui.bar.addEventListener("pointerdown", (e) => {
      if (!canSeek()) return;
      e.preventDefault();
      ui.bar.setPointerCapture(e.pointerId);
      ui.bar.classList.add("seeking");
      seekFrac = fracAt(e);
      render();
    });
    ui.bar.addEventListener("pointermove", (e) => {
      if (seekFrac === null) return;
      seekFrac = fracAt(e);
      render();
    });
    const endSeek = () => {
      if (seekFrac === null) return;
      if (canSeek()) media.currentTime = seekFrac * media.duration;
      seekFrac = null;
      ui.bar.classList.remove("seeking");
      render();
    };
    ui.bar.addEventListener("pointerup", endSeek);
    ui.bar.addEventListener("pointercancel", endSeek);
    ui.bar.addEventListener("keydown", (e) => {
      if (!canSeek()) return;
      const step = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP }[e.key];
      if (step) {
        e.preventDefault();
        media.currentTime = Math.min(media.duration, Math.max(0, media.currentTime + step));
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        media.currentTime = e.key === "Home" ? 0 : media.duration - 0.5;
      }
    });

    render();
  }

  const canSeek = () => media && isFinite(media.duration) && media.duration > 0;

  // Bandcamp marks the playing feed item with .playing.
  function playingItem() {
    return document.querySelector(".collection-item-container.playing");
  }

  // Sidebar "new releases" carry their metadata as JSON in data-item-json;
  // main-column stories only have it in the markup.
  function itemInfo(item) {
    try {
      const j = item.dataset.itemJson && JSON.parse(item.dataset.itemJson);
      if (j) {
        return {
          track: j.featured_track_title,
          album: j.item_title,
          artist: j.band_name,
          art: j.item_art?.thumb_url || j.item_art_url,
        };
      }
    } catch {}
    const text = (sel) => item.querySelector(sel)?.textContent.trim().replace(/\s+/g, " ") || "";
    return {
      track: text(".collection-item-title"),
      album: text(".collection-item-title"),
      artist: text(".collection-item-artist").replace(/^by\s+/, ""),
      art: item.querySelector(".tralbum-art-container img, .collection-item-art")?.src,
    };
  }

  let lastItem = null;
  function renderNowPlaying() {
    // Keep showing the last item while paused (Bandcamp drops .playing).
    const item = playingItem();
    if (!item || item === lastItem) return;
    lastItem = item;
    const info = itemInfo(item);
    ui.npTitle.textContent = info.album || info.track || "";
    ui.npArtist.textContent = info.artist ? `by ${info.artist}` : "";
    ui.title.textContent = info.track || info.album || "";
    ui.art.src = info.art || "";
    ui.art.hidden = !info.art;
  }

  function render() {
    if (!ui) return;
    const show = !!(media && media.currentSrc && canSeek());
    ui.root.classList.toggle("show", show);
    document.documentElement.classList.toggle("bcplus-player-open", show);
    if (!show) return;

    const busy = !media.paused && media.readyState < 3;
    ui.playpause.classList.toggle("is-playing", !media.paused && !busy);
    ui.playpause.classList.toggle("is-busy", busy);
    renderNowPlaying();

    const d = media.duration;
    const t = seekFrac === null ? media.currentTime : seekFrac * d;
    const pct = `${(t / d) * 100}%`;
    ui.progress.style.width = pct;
    ui.knob.style.left = pct;
    ui.pos.textContent = fmt(t);
    ui.dur.textContent = fmt(d);
    ui.bar.setAttribute("aria-valuemax", String(Math.round(d)));
    ui.bar.setAttribute("aria-valuenow", String(Math.round(t)));
    ui.bar.setAttribute("aria-valuetext", `${fmt(t)} of ${fmt(d)}`);

    const b = media.buffered;
    const buffEnd = b.length ? b.end(b.length - 1) : 0;
    ui.buffer.style.width = `${(buffEnd / d) * 100}%`;
  }

  // timeupdate only fires ~4x/sec; smooth it out while playing.
  function tick() {
    if (media && !media.paused) render();
    requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build, { once: true });
  } else {
    build();
  }
  requestAnimationFrame(tick);
})();

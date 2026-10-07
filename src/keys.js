// YouTube-style keyboard shortcuts for Bandcamp:
//   K                  play / pause
//   Shift+N / Shift+P  next / previous track
//   0-9                jump to 0%-90% of the current track
// On release pages (album/track) these drive Bandcamp's own player
// (window.gplaylist). On the feed they use feed-nav.js and the <audio>
// element tracked by media.js.
// Runs in the page's MAIN world.
(() => {
  if (window.__fixBcKeys) return;
  window.__fixBcKeys = true;

  const isFeed = /^\/[^/]+\/feed\/?$/.test(location.pathname);

  function isTyping(el) {
    return el instanceof Element && !!el.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
  }

  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    // composedPath()[0] sees through shadow DOM (the header search box
    // lives inside the <menu-bar> web component).
    if (isTyping(e.composedPath()[0])) return;

    let handled = false;
    if (!e.shiftKey && e.code === "KeyK") {
      handled = playPause();
    } else if (e.shiftKey && (e.code === "KeyN" || e.code === "KeyP")) {
      handled = skip(e.code === "KeyN" ? 1 : -1);
    } else if (!e.shiftKey) {
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
      if (m) handled = seekTo(Number(m[1]) / 10);
    }
    if (handled) e.preventDefault();
  });

  // ---- release pages: Bandcamp's own playlist player ----

  const releasePlayer = () => (!isFeed && window.gplaylist?.next_track ? window.gplaylist : null);

  function playPause() {
    const gp = releasePlayer();
    if (gp) {
      gp.playpause();
      return true;
    }
    return isFeed && !!window.__fixBc?.feed?.playPause();
  }

  function skip(dir) {
    const gp = releasePlayer();
    if (gp) {
      dir > 0 ? gp.next_track() : gp.prev_track();
      return true;
    }
    return isFeed && !!window.__fixBc?.feed?.skip(dir);
  }

  function seekTo(frac) {
    const gp = releasePlayer();
    if (gp) {
      releaseSeek(gp, frac);
      return true;
    }
    const media = window.__fixBc?.media;
    if (isFeed && media && isFinite(media.duration) && media.duration > 0) {
      media.currentTime = frac * media.duration;
      return true;
    }
    return false;
  }

  // gplaylist.seek takes seconds, and is ignored until the track has
  // started, so from idle we start playback and seek once it's playing.
  function releaseSeek(gp, frac) {
    if (gp.get_state() !== "IDLE") {
      gp.seek(frac * gp.duration());
      return;
    }
    gp.play();
    const started = Date.now();
    const wait = setInterval(() => {
      if (gp.get_state() === "PLAYING" && gp.duration() > 0) {
        clearInterval(wait);
        gp.seek(frac * gp.duration());
      } else if (Date.now() - started > 8000) {
        clearInterval(wait);
      }
    }, 100);
  }
})();

// YouTube-style keyboard shortcuts for Bandcamp:
//   K                  play / pause
//   Shift+N / Shift+P  next / previous track
//   0-9                jump to 0%-90% of the current track
// On release pages (album/track) these drive Bandcamp's own player
// (window.gplaylist). On the feed, "next" is the next playable item in the
// feed, and seeking uses the <audio> element tracked by media.js.
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
    return isFeed && feedPlayPause();
  }

  function skip(dir) {
    const gp = releasePlayer();
    if (gp) {
      dir > 0 ? gp.next_track() : gp.prev_track();
      return true;
    }
    return isFeed && feedSkip(dir);
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

  // ---- feed: no queue, so walk the playable items in page order ----

  let lastFeedItem = null;
  document.addEventListener(
    "play",
    () => setTimeout(() => (lastFeedItem = document.querySelector(".collection-item-container.playing") || lastFeedItem), 0),
    true,
  );

  const trigger = (el) => (el.matches(".track_play_auxiliary") ? el : el.querySelector(".track_play_auxiliary"));

  // Playable items in the same list as `el`: the main story feed, or a
  // sidebar grid (e.g. "New Releases"), so skipping never jumps between them.
  function feedList(el) {
    const scope = el?.closest("#story-list") || el?.closest("ol, ul") || document.getElementById("story-list");
    return scope ? [...scope.querySelectorAll(".collection-item-container")].filter(trigger) : [];
  }

  function feedCurrent() {
    const current = document.querySelector(".collection-item-container.playing") || lastFeedItem;
    return current?.isConnected ? current : null;
  }

  // Toggle via the item's own button (calling media.play() directly gets
  // overridden by Bandcamp); with nothing played yet, start the first post.
  function feedPlayPause() {
    const current = feedCurrent();
    if (current) {
      trigger(current).click();
      return true;
    }
    return feedSkip(1);
  }

  function feedSkip(dir) {
    const current = feedCurrent();
    const items = feedList(current);
    if (!items.length) return false;
    const i = current ? items.indexOf(current) : -1;
    const next = i === -1 ? items[0] : items[i + dir];
    if (!next) return true; // at the start/end: swallow the key, do nothing
    trigger(next).click();
    lastFeedItem = next;
    next.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return true;
  }
})();

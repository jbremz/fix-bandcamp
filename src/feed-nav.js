// Feed navigation shared by the player bar (seek.js) and the keyboard
// shortcuts (keys.js). The feed has no queue, so "next"/"previous" walk the
// playable items in page order, staying within the current list (the main
// story feed, or a sidebar grid like "New Releases"). When a track finishes,
// the next item starts automatically.
// Exposed as window.__fixBc.feed. Runs in the MAIN world after media.js.
(() => {
  if (!window.__fixBc || window.__fixBc.feed) return;

  // The item the user actually started. We can't just look for .playing:
  // the same release can appear in both the main feed and the sidebar, and
  // Bandcamp marks every copy as playing.
  let lastItem = null;
  document.addEventListener(
    "click",
    (e) => {
      const item = e.target.closest?.(".track_play_auxiliary")?.closest(".collection-item-container");
      if (item) lastItem = item;
    },
    true,
  );

  const trigger = (el) => (el.matches(".track_play_auxiliary") ? el : el.querySelector(".track_play_auxiliary"));

  function list(el) {
    const scope = el?.closest("#story-list") || el?.closest("ol, ul") || document.getElementById("story-list");
    return scope ? [...scope.querySelectorAll(".collection-item-container")].filter(trigger) : [];
  }

  function current() {
    const playing = [...document.querySelectorAll(".collection-item-container.playing")];
    // Bandcamp drops .playing when paused or finished, so keep lastItem then.
    if (lastItem?.isConnected && (!playing.length || playing.includes(lastItem))) return lastItem;
    return playing[0] || null;
  }

  // Neighbour of the current item in direction dir (+1/-1), or the first
  // item when nothing has played yet.
  function neighbour(dir) {
    const cur = current();
    const items = list(cur);
    const i = cur ? items.indexOf(cur) : -1;
    return i === -1 ? items[0] : items[i + dir];
  }

  window.__fixBc.feed = {
    current,

    hasNeighbour: (dir) => !!neighbour(dir),

    // Plays the next/previous item. Returns false if the page has no feed.
    // scroll: bring the new item into view (off for autoplay, so the page
    // doesn't move under you while you're reading elsewhere).
    skip(dir, { scroll = true } = {}) {
      if (!list(current()).length) return false;
      const next = neighbour(dir);
      if (!next) return true; // at the start/end: nothing to do
      trigger(next).click();
      lastItem = next;
      if (scroll) next.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return true;
    },

    // Toggle via the item's own button (calling media.play() directly gets
    // overridden by Bandcamp); with nothing played yet, start the first post.
    playPause() {
      const cur = current();
      if (!cur) return this.skip(1);
      trigger(cur).click();
      return true;
    },
  };

  // Autoplay: Bandcamp's feed just stops at the end of a track (and drops
  // .playing), so move on to the next item; current() falls back to lastItem.
  window.__fixBc.onChange((el) => {
    if (el.__fixBcAutoplay) return;
    el.__fixBcAutoplay = true;
    el.addEventListener("ended", () => {
      if (el === window.__fixBc.media) window.__fixBc.feed.skip(1, { scroll: false });
    });
  });
})();

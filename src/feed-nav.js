// Feed navigation shared by the player bar (seek.js) and the keyboard
// shortcuts (keys.js). The feed has no queue, so "next"/"previous" walk the
// playable items in page order, staying within the current list (the main
// story feed, or a sidebar grid like "New Releases").
// Exposed as window.__fixBc.feed. Runs in the MAIN world after media.js.
(() => {
  if (!window.__fixBc || window.__fixBc.feed) return;

  let lastItem = null;
  document.addEventListener(
    "play",
    () => setTimeout(() => (lastItem = document.querySelector(".collection-item-container.playing") || lastItem), 0),
    true,
  );

  const trigger = (el) => (el.matches(".track_play_auxiliary") ? el : el.querySelector(".track_play_auxiliary"));

  function list(el) {
    const scope = el?.closest("#story-list") || el?.closest("ol, ul") || document.getElementById("story-list");
    return scope ? [...scope.querySelectorAll(".collection-item-container")].filter(trigger) : [];
  }

  function current() {
    const item = document.querySelector(".collection-item-container.playing") || lastItem;
    return item?.isConnected ? item : null;
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
    skip(dir) {
      if (!list(current()).length) return false;
      const next = neighbour(dir);
      if (!next) return true; // at the start/end: nothing to do
      trigger(next).click();
      lastItem = next;
      next.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
})();

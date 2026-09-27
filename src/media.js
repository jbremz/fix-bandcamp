// Tracks whichever media element the page is playing, attached to the DOM
// or not, and exposes it as window.__bcPlus.media for the other scripts.
// Runs in the page's MAIN world at document_start, before Bandcamp's code.
(() => {
  if (window.__bcPlus) return;

  const listeners = new Set();
  const api = {
    media: null,
    // fn(el) is called whenever a different media element becomes current.
    onChange(fn) {
      listeners.add(fn);
      if (api.media) fn(api.media);
    },
  };
  window.__bcPlus = api;

  function adopt(el) {
    if (!(el instanceof HTMLMediaElement) || el === api.media) return;
    api.media = el;
    for (const fn of listeners) fn(el);
  }

  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    adopt(this);
    return origPlay.apply(this, args);
  };
  // In-DOM elements started by other means (autoplay, native controls).
  document.addEventListener("play", (e) => adopt(e.target), true);
})();

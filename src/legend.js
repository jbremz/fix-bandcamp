// Keyboard-shortcut legend, opened with "?" (keys.js) or a "keyboard
// shortcuts" link, plus shortcut hints in the tooltips of Bandcamp's own
// release-page player buttons. Anything can open it by dispatching a
// "fixbc-shortcuts" event on document.
// Runs in the page's MAIN world alongside keys.js.
(() => {
  if (window.__fixBcLegend) return;
  window.__fixBcLegend = true;

  const isFeed = /^\/[^/]+\/feed\/?$/.test(location.pathname);

  const SHORTCUTS = [
    [["K"], "Play / pause"],
    [["Shift", "N"], "Next track"],
    [["Shift", "P"], "Previous track"],
    [["0", "–", "9"], "Jump to 0%–90% of the track"],
    ...(isFeed ? [[["←", "→"], "Back / forward 5 seconds (progress bar focused)"]] : []),
    [["?"], "Show / hide this list"],
  ];

  let panel = null;
  let lastFocus = null;

  function build() {
    panel = document.createElement("div");
    panel.id = "fixbc-legend";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="fixbc-legend-card" role="dialog" aria-modal="true" aria-labelledby="fixbc-legend-title" tabindex="-1">
        <div class="fixbc-legend-head">
          <h2 id="fixbc-legend-title">Keyboard shortcuts</h2>
          <button type="button" class="fixbc-legend-close" aria-label="Close">×</button>
        </div>
        <table><tbody></tbody></table>
      </div>`;
    const tbody = panel.querySelector("tbody");
    for (const [keys, label] of SHORTCUTS) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      for (const k of keys) {
        // "–" is a range separator, not a key.
        const el = document.createElement(k === "–" ? "span" : "kbd");
        el.textContent = k;
        th.append(el);
      }
      const td = document.createElement("td");
      td.textContent = label;
      tr.append(th, td);
      tbody.append(tr);
    }
    panel.addEventListener("click", (e) => {
      if (e.target === panel || e.target.closest(".fixbc-legend-close")) close();
    });
    document.body.append(panel);
  }

  function open() {
    if (!panel) build();
    lastFocus = document.activeElement;
    panel.hidden = false;
    panel.querySelector(".fixbc-legend-card").focus();
  }

  function close() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    lastFocus?.focus?.();
  }

  document.addEventListener("fixbc-shortcuts", () => (panel && !panel.hidden ? close() : open()));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel && !panel.hidden) {
      e.preventDefault();
      close();
    }
  });

  // ---- release pages: hints on Bandcamp's own player ----

  function decorateReleasePlayer() {
    const player = document.querySelector(".inline_player");
    if (!player || !window.gplaylist?.next_track || player.dataset.fixbcHints) return;
    player.dataset.fixbcHints = "1";

    const hints = [
      [".play_cell a[role=button]", "Play/pause (K)"],
      [".prev_cell a[role=button]", "Previous track (Shift+P)"],
      [".next_cell a[role=button]", "Next track (Shift+N)"],
      [".progbar", "Seek (0–9 jump to 0%–90%)"],
    ];
    for (const [sel, title] of hints) {
      const el = player.querySelector(sel);
      if (el) el.title = title;
    }

    // The inner "secondaryText" span picks up the artist page's muted colour
    // (on the <a> itself the page's link colour wins).
    const link = document.createElement("a");
    link.href = "#";
    link.className = "fixbc-shortcuts-link";
    link.innerHTML = `<span class="secondaryText">keyboard shortcuts</span>`;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      open();
    });
    player.after(link);
  }

  if (!isFeed) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", decorateReleasePlayer, { once: true });
    } else {
      decorateReleasePlayer();
    }
  }
})();

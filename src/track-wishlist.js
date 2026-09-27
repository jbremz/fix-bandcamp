// Adds a per-track wishlist heart to album tracklists, next to "buy track",
// so tracks can be wishlisted without opening each track page.
// Runs in the page's MAIN world to use Bandcamp's own FanControls.doPost
// (which handles CSRF crumbs) and TralbumData.
(() => {
  if (window.__fixBcTrackWishlist) return;
  window.__fixBcTrackWishlist = true;

  const STATUS_CONCURRENCY = 3;

  function pagedata() {
    try {
      return JSON.parse(document.getElementById("pagedata").dataset.blob);
    } catch {
      return null;
    }
  }

  function init() {
    const ftd = pagedata()?.fan_tralbum_data;
    const fanId = ftd?.fan_id || window.FanControls?.fan_id;
    const bandId = window.TralbumData?.current?.band_id || ftd?.band_id;
    const tracks = window.TralbumData?.trackinfo;
    if (!fanId || !bandId || !tracks || !window.FanControls?.doPost) return; // logged out, or not a tralbum page

    const byLink = new Map(tracks.filter((t) => t.title_link).map((t) => [t.title_link, t]));
    const queue = [];

    for (const row of document.querySelectorAll("#track_table tr.track_row_view")) {
      const href = row.querySelector(".title-col a[href]")?.getAttribute("href");
      const track = href && byLink.get(href);
      if (!track || row.querySelector(".fixbc-wl")) continue;
      const btn = makeButton(track, fanId, bandId);
      // Live inside .dl_link so Bandcamp's own hover rule reveals it.
      let cell = row.querySelector(".download-col");
      if (!cell) {
        cell = document.createElement("td");
        cell.className = "download-col";
        row.appendChild(cell);
      }
      let dl = cell.querySelector(".dl_link");
      if (!dl) {
        dl = document.createElement("div");
        dl.className = "dl_link";
        cell.appendChild(dl);
      }
      dl.classList.add("fixbc-dl");
      if (dl.querySelector("a")) {
        const sep = document.createElement("span");
        sep.className = "fixbc-wl-sep";
        sep.textContent = "·";
        dl.appendChild(sep);
      }
      dl.appendChild(btn);
      queue.push(() => loadStatus(track, btn));
    }

    // Look up each track's current wishlist state, a few at a time.
    const worker = async () => {
      while (queue.length) await queue.shift()();
    };
    for (let i = 0; i < STATUS_CONCURRENCY; i++) worker();
  }

  function makeButton(track, fanId, bandId) {
    const btn = document.createElement("a");
    btn.className = "fixbc-wl";
    btn.href = "#";
    btn.setAttribute("role", "button");
    // Hearts come from Bandcamp's own SVG sprite already on the page.
    btn.innerHTML = `
      <svg class="fixbc-wl-icon" viewBox="0 0 21 20" aria-hidden="true">
        <use class="fixbc-wl-off" href="#collect-control-wishlist"></use>
        <use class="fixbc-wl-on" href="#collect-control-wishlisted"></use>
      </svg>`;
    setState(btn, { wishlisted: false });

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation(); // rows are clickable (they start playback)
      if (btn.dataset.busy) return;
      const want = btn.dataset.state !== "on";
      const data = { fan_id: fanId, item_id: track.track_id, item_type: "t", band_id: bandId };
      if (want && window.ReferrerToken) data.ref_token = window.ReferrerToken;

      btn.dataset.busy = "1";
      setState(btn, { wishlisted: want }); // optimistic
      window.FanControls.doPost(want ? "/collect_item_cb" : "/uncollect_item_cb", data, (res) => {
        delete btn.dataset.busy;
        if (!(res && res.ok === true)) setState(btn, { wishlisted: !want });
      });
    });
    return btn;
  }

  function setState(btn, { wishlisted, purchased }) {
    if (purchased) {
      btn.dataset.state = "owned";
      btn.hidden = true;
      const sep = btn.previousElementSibling;
      if (sep?.classList.contains("fixbc-wl-sep")) sep.hidden = true;
      return;
    }
    btn.dataset.state = wishlisted ? "on" : "off";
    btn.title = wishlisted ? "Remove this track from your wishlist" : "Add this track to your wishlist";
    btn.setAttribute("aria-label", btn.title);
  }

  // The album page doesn't say which tracks are wishlisted; each track
  // page's pagedata does.
  async function loadStatus(track, btn) {
    try {
      const html = await fetch(track.title_link, { credentials: "include" }).then((r) => r.text());
      const doc = new DOMParser().parseFromString(html, "text/html");
      const ftd = JSON.parse(doc.getElementById("pagedata").dataset.blob).fan_tralbum_data;
      if (ftd && !btn.dataset.busy) {
        setState(btn, { wishlisted: ftd.is_wishlisted, purchased: ftd.is_purchased });
      }
    } catch {
      // Leave the default (not wishlisted) state; clicking still works.
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

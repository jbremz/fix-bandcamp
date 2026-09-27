# Bandcamp Plus

A small Chromium extension (Arc, Chrome, etc.) that augments Bandcamp.

## Features

- **Feed player bar**: the feed has no bottom player, so this adds one styled like Bandcamp's own collection-page player: artwork, title, play/pause, and a seekable progress bar (click or drag; arrow keys step ±5s when focused).
  Clicking the artwork/title scrolls back to the playing item.
  It reads position from the page's actual `<audio>` element (hooking `HTMLMediaElement.play`), and play/pause goes through Bandcamp's own item button so their player state stays in sync.

- **Per-track wishlist hearts**: on album pages (`*.bandcamp.com/album/*`), each tracklist row gets a ♡ next to "buy track" (shown on hover, like Bandcamp's own row links).
  Click to wishlist that single track; wishlisted tracks keep a filled ♥ visible.
  Uses Bandcamp's own heart icons and `FanControls.doPost` to hit `/collect_item_cb` / `/uncollect_item_cb`, the same endpoints the track page's Wishlist button uses.
  Current state is read from each track page in the background (3 at a time). Tracks you own get no heart.
  Albums on custom domains (not `*.bandcamp.com`) aren't covered yet.

- **Keyboard shortcuts** (YouTube-style), on release pages and the feed:
  - `K`: play / pause. On the feed with nothing played yet, starts the first post.
  - `Shift+N` / `Shift+P`: next / previous track. On album pages this drives Bandcamp's own player (`gplaylist`); on the feed it plays the next/previous item in the same list (main feed or a sidebar grid), starting from the top of the feed if nothing's playing.
  - `0`–`9`: jump to 0%–90% of the current track. On a release page with nothing playing, it starts playback and then jumps.
  - Ignored while typing in a text field (including the header search, which lives in shadow DOM) or with Cmd/Ctrl/Alt held.

## Install (Arc / Chrome)

1. Open `arc://extensions` (or `chrome://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked**, then select this folder.
4. After editing files, press the reload icon on the extension card and refresh the Bandcamp tab.

## Limitations

- **Unofficial.** Not affiliated with Bandcamp. It relies on Bandcamp's internal page code (`gplaylist`, `FanControls`, `TralbumData`, CSS class names), so a Bandcamp site update can break parts of it without warning.
- **`*.bandcamp.com` only.** Artists on custom domains aren't covered.
- **Wishlist hearts need you to be logged in**, and fetch each track page once per album view to show the current state.
- **Chromium only for now.** The scripts run in the page's main world (`"world": "MAIN"`); Safari/Firefox would need a small loader shim.

## License

[MIT](LICENSE)

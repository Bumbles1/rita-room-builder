# Rita's Room Builder 🏠

A 3D room-design toy for Rita, built around her real bedroom (BED 2 on the floorplan:
3.0 m × 4.4 m, with the north wall being the floor-to-ceiling mirrored doors of the built-in wardrobe,
which is on your right as you come through the door in the top-right corner; the wardrobe itself sits
outside those measurements so it takes no floor space. Window on the west wall). Everything is plain HTML + JavaScript with Three.js loaded from a CDN, so there is
nothing to install or build.

## Run it

**Live:** https://bumbles1.github.io/rita-room-builder/ (GitHub Pages from the `main` branch of
`Bumbles1/rita-room-builder`; pushing to `main` republishes it in about a minute).

**Install it on a Chromebook (or any Chrome):** open the live link, then use the install icon at the
right end of the address bar (or ⋮ → *Cast, save and share* → *Install page as app*). It gets its
own icon on the shelf and opens without the browser bars. `manifest.webmanifest` and `icons/` make
this work; there is no service worker, so it still needs internet to load.

To run it locally instead: the browser needs the files served over http (module scripts don't load from `file://`).
From this folder:

```bash
python3 -m http.server 5180
```

Then open http://localhost:5180 in Chrome or Safari. It also works on an iPad on the same
Wi-Fi if you use the Mac's IP address instead of localhost (touch drag and pinch-zoom are supported).

## What Rita can do

- **Add things** from seven tabs: Beds, Build it, Desk & study, Storage, Play & climb, Split the
  room, Decorate. Tap a card to drop it in the room.
- **Drag** anything. Floor things stack on top of each other (drop a mattress on a Tall frame to
  make a loft, put a desk underneath). Wall things slide along walls and jump between walls;
  ceiling things (monkey bars, swing, rope ladder, gym rings, hanging chair, horizontal net) slide across the
  ceiling; the net's *Hang down* slider sets how high up it is.
- **Things stay where they fit**: furniture can't go through walls, into the wardrobe, into the door
  swing, or through other furniture. Things slide around each other instead, chairs still tuck under
  desks, and desks and beds still fit under a loft or tall frame. Rugs, mats and lights go anywhere.
- **Resize, spin, lift, recolour** from the panel that appears when something is selected.
- **Fold-down wall desk** has a switch to fold it up or down.
- **Share the room**: curtain, shelf, half wall, folding screen, sliding panel, floor tape, name
  signs, plus a halfway line with both names (🎨 Room → Sharing the room).
- **Paint** the floor or any wall by tapping it, or from the Room panel.
- **Views**: 3D (drag empty space to spin, scroll/pinch to zoom), Top, and Door (standing in the doorway).
- **Save**: the room auto-saves in the browser. 💾 Designs lets her keep named versions, download a
  `.json` file to back up or share, and open one again. 📸 Photo downloads a picture.
- **Undo / redo**, and keyboard shortcuts: R to turn, arrows to nudge, Delete to remove.

## Fixing the room if the plan was read wrong

🎨 Room has every measurement: room size, ceiling height, robe on/off, door wall / position /
width / hinge side, window wall / position / width / sill / height. Positions are measured from
the left corner as you stand in the room facing that wall.

## Backlog

Ideas that are not built yet (Modes, measuring, sharing links…) are in `BACKLOG.md`.

## Files

- `index.html` – page and panels
- `style.css` – look and feel (desktop + phone layouts)
- `catalog.js` – every item, built from simple shapes so it can be resized and recoloured.
  Add a new item by appending to `ITEMS`. `soft`, `under` and `collideH` tell the collision
  system which parts of an item are solid.
- `app.js` – the 3D scene, room from the floorplan, dragging/stacking, inspector, saving.
- `manifest.webmanifest`, `icons/` – web-app install (name, colours, icons; PNGs rendered from
  `icons/icon.svg` with `rsvg-convert`).

# MindAR PlayCanvas Scripts

PlayCanvas script components for integrating MindAR image tracking and face tracking into a PlayCanvas project via the online editor.

## Scripts

| File | Description |
|------|-------------|
| `mindarLoader.js` | Loads the MindAR image and face libraries before the PlayCanvas engine initializes |
| `mindarImageTracker.mjs` | Script component that starts the image tracking session and drives anchor entities |
| `mindarImageAnchor.mjs` | Script component attached to entities that should be positioned on a tracked image target |
| `mindarFaceTracker.mjs` | Script component that starts the face tracking session and drives anchor entities |
| `mindarFaceAnchor.mjs` | Script component attached to entities that should be positioned on a face landmark |

---

## Setup

### 1. Add mindarLoader.js (required)

Upload `mindarLoader.js` to your PlayCanvas project and set its **Loading Type** to **Before Engine** in the asset inspector. This ensures the MindAR controllers are available on `window.MINDAR` before any scripts run.

### 2. Add the remaining scripts

Upload the `.mjs` files to your project. Their loading type can be left at the default.

---

## Image Tracking

Image tracking detects and tracks flat image targets (e.g. posters, cards) using the device camera.

### Generating a .mind file

You need to compile your target images into a `.mind` file first. Use the online compiler:

**https://hiukim.github.io/mind-ar-js-doc/tools/compile**

Upload one or more target images and download the resulting `.mind` file. Add it to your PlayCanvas project as a binary asset.

### Scene setup

1. **Camera entity** — add the `mindarImageTracker` script to it (or any entity). Configure the attributes:
   - **Image Target Asset** — select your `.mind` binary asset
   - **Camera Entity** — assign the camera entity (used to update projection parameters)
   - **Max Track** — maximum number of targets to track simultaneously (default: `1`)
   - **Use User Camera** — enable for front-facing camera (default: `false`)
   - **Anchor Tag** — tag used to find anchor entities (default: `mindar-image-anchor`)

2. **Anchor entities** — create one entity per image target and attach the `mindarImageAnchor` script:
   - **Target Index** — the zero-based index of the target inside the `.mind` file
   - Tag the entity with the value set in **Anchor Tag** (default: `mindar-image-anchor`)
   - Place your 3D content as children of the anchor entity

The tracker will show/hide and reposition anchor entities automatically as targets come in and out of view.

---

## Face Tracking

Face tracking detects and tracks facial landmarks using the front-facing camera.

### Scene setup

1. **Camera entity** — add the `mindarFaceTracker` script to it (or any entity). Configure the attributes:
   - **Camera Entity** — assign the camera entity
   - **Use User Camera** — use the front-facing camera (default: `true`)
   - **Disable Face Mirror** — disable horizontal mirroring of the video feed (default: `false`)
   - **Draw Face Mesh** — render a face mesh overlay (default: `false`)
   - **Face Mesh Material** — optional material asset applied to the face mesh
   - **Anchor Tag** — tag used to find anchor entities (default: `mindar-face-anchor`)

2. **Anchor entities** — create one entity per landmark and attach the `mindarFaceAnchor` script:
   - **Landmark Index** — the face landmark index (0–467, following the MediaPipe face mesh topology)
   - Tag the entity with the value set in **Anchor Tag** (default: `mindar-face-anchor`)
   - Place your 3D content as children of the anchor entity

The tracker will show/hide and reposition anchor entities whenever a face is detected.

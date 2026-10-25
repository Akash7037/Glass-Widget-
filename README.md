# Liquid Glass Widget

**Version: v2.0.1**

Two widgets made of real glass on a sky: a clock and a web-search bar. Drag
them anywhere, resize them with the pencil, and keep the layout — it is saved
in `localStorage`.

The glass is [React Bits' `GlassSurface`](https://reactbits.dev/components/glass-surface)
(JavaScript + CSS variant), used unmodified in `src/GlassSurface.jsx` /
`src/GlassSurface.css`. It bends the clouds behind it with an SVG displacement
filter, so the edge of the capsule refracts instead of just blurring.

## Run it

```bash
npm install
npm run build      # -> dist/app.js + dist/app.css
```

Then open `index.html` — or load the folder as an unpacked extension
(`chrome://extensions` → *Load unpacked*) to replace the new tab page
(`manifest.json` already wires that up).

`npm run watch` rebuilds on save.

## The widgets

- **Clock** — `src/main.jsx` keeps the time in React state (the tick is
  aligned to the second boundary, so the minute never lags).
- **Search** — searches Google, or opens the URL directly when the query looks
  like one. Press `/` anywhere to focus it.
- **Pencil (top-right of each widget)** — one press arms **every** widget:
  resize grips appear on all of them at once. Escape or the pencil again exits.
- **Drag** — from anywhere, including inside the search field (a press that
  stays under 4px counts as a click, so the caret still lands). Widgets are
  clamped to the window; arrow keys nudge the focused widget, shift+arrows
  resize it when a grip has focus.
- **Version badge (bottom-left)** — shows `v2.0.1` and checks
  [GitHub Releases](https://github.com/Akash7037/Glass-Widget-/releases)
  (cached for a day; click to re-check). When a newer release exists the badge
  turns into a link to it.

Props in use are the component's documented example:

```jsx
<GlassSurface
  width="100%"
  height="100%"
  borderRadius={radius}
  distortionScale={-180}
  displace={0.5}
  backgroundOpacity={0.1}
>
  {children}
</GlassSurface>
```

`refraction` is on by default, so Chromium gets the SVG filter path. Other
engines fall back to the component's frosted look.

## Files

| File | What it is |
| --- | --- |
| `src/GlassSurface.jsx` | The component, verbatim |
| `src/GlassSurface.css` | The component's stylesheet, verbatim |
| `src/main.jsx` | Clock, search, drag/resize, version check |
| `src/app.css` | Sky background, widget and badge styling |
| `index.html` | Page shell (`dist/app.css` + `dist/app.js`) |
| `manifest.json` | Makes the page the Chrome new tab |
| `build.mjs` | esbuild bundling |
| `preview.png` | Render of the result |

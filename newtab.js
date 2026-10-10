/* =========================================================================
   Liquid Glass — new tab app
   Widgets: clock, weather, notes, tasks, saved links, focus timer.
   Settings: background image, glass blur/opacity/radius, theme, accent,
             widget visibility, drag-to-reorder layout editing.
   ========================================================================= */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const hasExt =
  typeof chrome !== "undefined" && !!(chrome.storage && chrome.storage.local);
const isExt =
  typeof chrome !== "undefined" && !!(chrome.runtime && chrome.runtime.id);

/* ---------- storage (falls back to memory when opened as a plain file) --- */
const mem = {};
const store = {
  getAll() {
    if (hasExt) {
      return new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime?.lastError) resolve({ ...mem });
          else resolve(items || {});
        });
      });
    }
    return Promise.resolve({ ...mem });
  },
  set(obj) {
    Object.assign(mem, obj);
    if (hasExt) {
      return new Promise((resolve) => {
        chrome.storage.local.set(obj, () => {
          if (chrome.runtime?.lastError) {
            console.warn("Storage set warning:", chrome.runtime.lastError);
          }
          resolve();
        });
      });
    }
    return Promise.resolve();
  },
  onChange(cb) {
    if (hasExt)
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local") cb(changes);
      });
  }
};

function sendMessage(msg) {
  if (!hasExt || !chrome.runtime) return simFocus(msg);
  try {
    return Promise.resolve(chrome.runtime.sendMessage(msg)).catch((err) => ({
      ok: false,
      error: String(err)
    }));
  } catch (err) {
    return Promise.resolve({ ok: false, error: String(err) });
  }
}

/** In-memory stand-in for the service worker (plain-file preview). */
function simFocus(msg) {
  if (msg.type === "focus:start") {
    mem.focus = {
      sites: msg.sites,
      minutes: msg.minutes,
      startTs: Date.now(),
      endTs: Date.now() + msg.minutes * 60000
    };
    return Promise.resolve({ ok: true, focus: mem.focus });
  }
  if (msg.type === "focus:stop") {
    mem.focus = null;
    return Promise.resolve({ ok: true });
  }
  if (msg.type === "focus:status")
    return Promise.resolve({ ok: true, focus: mem.focus || null });
  return Promise.resolve({ ok: false });
}

/* ---------- defaults ------------------------------------------------------ */
const GRADIENTS = [
  "linear-gradient(135deg, #0b1120 0%, #1e3a8a 38%, #5b21b6 70%, #0e7490 100%)",
  "linear-gradient(140deg, #111827 0%, #4c1d95 45%, #9d174d 78%, #f59e0b 130%)",
  "linear-gradient(135deg, #f8fafc 0%, #dbeafe 40%, #e9d5ff 75%, #ccfbf1 100%)",
  "linear-gradient(135deg, #042f2e 0%, #0f766e 45%, #155e75 75%, #312e81 100%)",
  "linear-gradient(180deg, #090909 0%, #050505 100%)"
];

const PHOTOS = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1920&q=80"
];

const WIDGET_NAMES = {
  clock: "Clock",
  weather: "Weather",
  news: "News Radar (AI & Tech)",
  webUsage: "Web Screen Time & Top Sites",
  notes: "Notes",
  tasks: "Today (tasks)",
  links: "Saved links",
  focus: "Focus timer"
};

const DEFAULT_SITES = [
  "youtube.com",
  "instagram.com",
  "reddit.com",
  "pinterest.com",
  "tiktok.com",
  "x.com",
  "facebook.com",
  "netflix.com",
  "twitch.tv",
  "linkedin.com"
];

const DEFAULTS = {
  bg: { type: "image", value: PHOTOS[0] },
  brightness: 100,
  blur: 11,
  opacity: 0,
  radius: 25,
  theme: "dark",
  accent: "#7dd3fc",
  accent2: "#c4b5fd",
  timeFormat: "12h",
  showSeconds: true,
  order: ["clock", "weather", "news", "tasks", "links", "notes", "focus"],
  hidden: [],
  weather: { city: "", unit: "c", lat: null, lon: null },
  links: [
    { title: "YouTube", url: "https://youtube.com" },
    { title: "Gmail", url: "https://mail.google.com" },
    { title: "GitHub", url: "https://github.com" },
    { title: "Wikipedia", url: "https://wikipedia.org" },
    { title: "Drive", url: "https://drive.google.com" },
    { title: "Reddit", url: "https://reddit.com" }
  ],
  notes: "",
  tasks: [],
  focusPref: {
    sites: [...DEFAULT_SITES],
    selected: [...DEFAULT_SITES],
    minutes: 25
  },
  sessions: 0,
  name: "",
  sizes: {},
  liquid: {
    enabled: true,
    profile: "convex-squircle",
    refractionScale: 5,
    bezel: 11,
    specularOpacity: 0.35,
    specularSaturation: 4,
    lightAngle: -120,
    cursorLight: false
  }
};

function openExternalTab(url) {
  if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url });
  } else if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: "tabs:create", url });
  } else {
    setTimeout(() => {
      window.open(url, "_blank");
    }, 50);
  }
}

let S = JSON.parse(JSON.stringify(DEFAULTS));
let activeFocus = null; // running session: {sites, minutes, startTs, endTs}
let editMode = false;

const debounce = (fn, ms) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

async function save(partial) {
  await store.set(partial);
}

/* ---------- toast --------------------------------------------------------- */
let toastT;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastT);
  toastT = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => (el.hidden = true), 300);
  }, 2600);
}

/* ---------- appearance ----------------------------------------------------- */
function hexToHsl(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  let r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function shiftHue(hex, deg) {
  const { h, s, l } = hexToHsl(hex);
  const hh = (h + deg + 360) % 360;
  return `hsl(${hh} ${Math.min(100, s)}% ${Math.min(78, l + 8)}%)`;
}

/* ---------- Dynamic Cursor Light Tracking --------------------------------- */
let cursorLightRaf = null;
let lastPointerX = typeof window !== "undefined" ? window.innerWidth / 2 : 500;
let lastPointerY = typeof window !== "undefined" ? window.innerHeight / 2 : 400;

function updateDynamicLight() {
  cursorLightRaf = null;
  const lq = S.liquid || DEFAULTS.liquid;
  if (!lq.cursorLight) return;

  const bezel = lq.bezel != null ? lq.bezel : 24;
  const elements = $$(".card, .search");

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = lastPointerX - cx;
    const dy = lastPointerY - cy;

    // Angle of element towards cursor
    const cursorAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    // Light reflection orientation: points directly towards cursor
    const lightAngle = cursorAngle - 180;
    const rad = (lightAngle * Math.PI) / 180;

    // Proximity factor: closer cursor produces a tighter, crisper specular gleam
    const dist = Math.hypot(dx, dy);
    const proximity = Math.max(0.75, Math.min(1.35, 1.35 - dist / 1100));
    const effectiveBezel = bezel * proximity;

    const bevelX = Math.round(Math.cos(rad) * (effectiveBezel * 0.15 + 1.2) * 10) / 10;
    const bevelY = Math.round(Math.sin(rad) * (effectiveBezel * 0.15 + 1.2) * 10) / 10;

    el.style.setProperty("--glass-angle", `${Math.round(lightAngle)}deg`);
    el.style.setProperty("--glass-bevel-x", `${bevelX}px`);
    el.style.setProperty("--glass-bevel-y", `${bevelY}px`);
  }
}

function queueDynamicLight(e) {
  if (e && typeof e.clientX === "number") {
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  }
  const lq = S.liquid || DEFAULTS.liquid;
  if (!lq.cursorLight) return;
  if (!cursorLightRaf) {
    cursorLightRaf = requestAnimationFrame(updateDynamicLight);
  }
}

function applyAppearance() {
  const root = document.documentElement;
  const b = S.blur != null ? S.blur : 24;
  const a = S.opacity != null ? S.opacity / 100 : 0.22;
  const r = S.radius != null ? S.radius : 20;
  const br = S.brightness != null ? S.brightness : 100;
  const lq = S.liquid || DEFAULTS.liquid;
  const isLiquid = lq.enabled !== false;
  const spec = isLiquid ? (lq.specularOpacity != null ? lq.specularOpacity : 0.65) : 0.05;
  const sat = isLiquid ? (lq.specularSaturation != null ? lq.specularSaturation : 6) : 0;
  const angle = lq.lightAngle != null ? lq.lightAngle : -60;
  const bezel = lq.bezel != null ? lq.bezel : 24;
  const refr = lq.refractionScale != null ? lq.refractionScale : 28;
  const profile = lq.profile || "convex-squircle";

  // Calculate physical 3D light vector from light angle
  const rad = (angle * Math.PI) / 180;
  const bevelX = Math.round(Math.cos(rad) * (bezel * 0.15 + 1.2) * 10) / 10;
  const bevelY = Math.round(Math.sin(rad) * (bezel * 0.15 + 1.2) * 10) / 10;

  root.dataset.profile = profile;
  root.classList.toggle("liquid", isLiquid);
  root.classList.toggle("no-liquid", !isLiquid);

  root.style.setProperty("--bg-brightness", String(br / 100));
  root.style.setProperty("--glass-blur", `${b}px`);
  root.style.setProperty("--glass-a", String(a));
  root.style.setProperty("--radius", `${r}px`);
  root.style.setProperty("--accent", S.accent);
  root.style.setProperty("--accent-2", S.accent2);
  root.style.setProperty("--glass-specular", String(spec));
  root.style.setProperty("--glass-sat", String(sat));
  root.style.setProperty("--glass-angle", `${angle}deg`);
  root.style.setProperty("--glass-bezel", `${bezel}px`);
  root.style.setProperty("--glass-refract", `${refr}px`);
  root.style.setProperty("--glass-bevel-x", `${bevelX}px`);
  root.style.setProperty("--glass-bevel-y", `${bevelY}px`);

  // Direct element style update for instant frame-by-frame reactivity.
  // Setting backdropFilter directly on elements forces Chromium's GPU compositor
  // to immediately repaint the blur on every slider drag frame!
  const cardBackdrop = b > 0 
    ? `blur(${b}px) saturate(${100 + sat * 18}%) brightness(${102 + spec * 14}%) contrast(104%)` 
    : `saturate(${100 + sat * 18}%) brightness(${102 + spec * 14}%) contrast(104%)`;

  $$(".card, .search").forEach((c) => {
    c.style.setProperty("--glass-blur", `${b}px`);
    c.style.setProperty("--glass-a", String(a));
    c.style.setProperty("--radius", `${r}px`);
    c.style.setProperty("--glass-specular", String(spec));
    c.style.setProperty("--glass-sat", String(sat));
    c.style.setProperty("--glass-angle", `${angle}deg`);
    c.style.setProperty("--glass-bezel", `${bezel}px`);
    c.style.setProperty("--glass-refract", `${refr}px`);
    c.style.setProperty("--glass-bevel-x", `${bevelX}px`);
    c.style.setProperty("--glass-bevel-y", `${bevelY}px`);
    c.style.backdropFilter = cardBackdrop;
    c.style.webkitBackdropFilter = cardBackdrop;
  });

  const drawerEl = $("#drawer");
  if (drawerEl) {
    const drawerBackdrop = b > 0 ? `blur(${b + 14}px) saturate(180%)` : "none";
    drawerEl.style.backdropFilter = drawerBackdrop;
    drawerEl.style.webkitBackdropFilter = drawerBackdrop;
  }

  let theme = S.theme;
  if (theme === "auto")
    theme = matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  document.body.dataset.theme = theme;

  const themeToggleBtn = $("#themeToggleBtn");
  if (themeToggleBtn) {
    const isOled = S.theme === "oled";
    themeToggleBtn.classList.toggle("on", isOled);
    themeToggleBtn.title = isOled ? "Switch to Normal Liquid Glass mode" : "Switch to Minimal OLED Dark mode";
    themeToggleBtn.setAttribute("aria-label", themeToggleBtn.title);
    themeToggleBtn.innerHTML = isOled
      ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
      : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }

  $$("#themeSeg button").forEach((btn) =>
    btn.classList.toggle("on", btn.dataset.theme === S.theme)
  );

  const isCursorLight = Boolean(lq.cursorLight);
  const quickBtn = $("#dynamicLightQuickBtn");
  if (quickBtn) {
    quickBtn.classList.toggle("on", isCursorLight);
    quickBtn.title = isCursorLight
      ? "Dynamic Cursor Light ON (click to use fixed angle)"
      : "Turn on Dynamic Cursor Light (elements follow mouse)";
  }
  const cursorToggle = $("#cursorLightToggle");
  if (cursorToggle) {
    cursorToggle.checked = isCursorLight;
  }
  const angleRow = $("#angleSliderRow");
  if (angleRow) {
    angleRow.style.opacity = isCursorLight ? "0.4" : "1";
    angleRow.style.pointerEvents = isCursorLight ? "none" : "auto";
  }

  if (isCursorLight) {
    updateDynamicLight();
  }

  if (window.LiquidGlass && window.LiquidGlass.refresh) {
    window.LiquidGlass.refresh();
  }
}

function applyBackground() {
  const layer = $("#bgLayer");
  layer.style.background = "";
  layer.style.backgroundImage = "";
  document.body.classList.remove("has-photo");

  const { type, value } = S.bg;
  if (type === "image") {
    layer.style.backgroundImage = `url("${value}")`;
    layer.style.backgroundSize = "cover";
    layer.style.backgroundPosition = "center";
    document.body.classList.add("has-photo");
  } else {
    layer.style.background =
      GRADIENTS.includes(value) || value.startsWith("linear-gradient")
        ? value
        : GRADIENTS[0];
  }
}

/* ---------- layout / edit mode -------------------------------------------- */
function applyOrder() {
  const grid = $("#grid");
  const seen = new Set();
  S.order.forEach((id) => {
    const card = grid.querySelector(`[data-widget="${id}"]`);
    if (card) {
      grid.appendChild(card);
      seen.add(id);
    }
  });
  $$(".card", grid).forEach((c) => {
    if (!seen.has(c.dataset.widget)) grid.appendChild(c);
  });
}

function applyVisibility() {
  $$(".card").forEach((c) =>
    c.classList.toggle("is-hidden", S.hidden.includes(c.dataset.widget))
  );
  $$("#widgetToggles .widget-toggle").forEach((el) => {
    el.classList.toggle("on", !S.hidden.includes(el.dataset.widget));
  });
}

function applySizes() {
  if (!S.sizes) return;
  const grid = $("#grid");
  let hasCustom = false;

  $$(".card").forEach((card) => {
    const id = card.dataset.widget;
    const sz = S.sizes && S.sizes[id];
    if (sz) {
      if (sz.w) { card.style.width  = sz.w; hasCustom = true; }
      if (sz.h) { card.style.height = sz.h; hasCustom = true; }
      if (sz.left != null) { card.style.left = sz.left; hasCustom = true; }
      if (sz.top  != null) { card.style.top  = sz.top;  hasCustom = true; }
    }
  });

  if (hasCustom) {
    grid.classList.add("canvas-freeform");
  } else {
    grid.classList.remove("canvas-freeform");
  }
}

function ensureResizeHandles() {
  $$(".card").forEach((card) => {
    if (!card.querySelector(".resize-handle")) {
      const h = document.createElement("div");
      h.className = "resize-handle";
      h.setAttribute("title", "Pull to resize widget");
      card.appendChild(h);
    }
  });
}

/* ---- Unified pointer-based drag & resize (freeform canvas) ---- */
function wireInteractions() {
  ensureResizeHandles();

  const grid = $("#grid");

  // State
  let mode = null;         // 'drag' | 'resize' | null
  let activeCard = null;
  let startX = 0, startY = 0;
  let startLeft = 0, startTop = 0, startW = 0, startH = 0;

  /* ---------- helpers ---------- */
  function enterFreeform(card) {
    if (!grid.classList.contains("canvas-freeform")) {
      const gridRect = grid.getBoundingClientRect();
      // Ensure grid has an explicit initial minimum height so it doesn't collapse
      grid.style.minHeight = `${Math.max(680, Math.round(gridRect.height))}px`;
      $$(".card:not(.is-hidden)", grid).forEach((c) => {
        const r = c.getBoundingClientRect();
        c.style.left   = `${Math.round(r.left - gridRect.left)}px`;
        c.style.top    = `${Math.round(r.top  - gridRect.top)}px`;
        c.style.width  = `${Math.round(r.width)}px`;
        c.style.height = `${Math.round(r.height)}px`;
      });
      grid.classList.add("canvas-freeform");
    }
  }

  function persist(card) {
    if (!S.sizes) S.sizes = {};
    // Save state for all positioned cards
    $$(".card:not(.is-hidden)", grid).forEach((c) => {
      const cid = c.dataset.widget;
      if (c.style.left) {
        S.sizes[cid] = {
          w:    c.style.width  || null,
          h:    c.style.height || null,
          left: c.style.left   || null,
          top:  c.style.top    || null
        };
      }
    });
    save({ sizes: S.sizes });
    if (window.LiquidGlass && window.LiquidGlass.applyToElement) {
      window.LiquidGlass.applyToElement(card);
    }
  }

  /* ---------- mousedown ---------- */
  document.addEventListener("mousedown", (e) => {
    // Resize handle takes priority
    const handle = e.target.closest(".resize-handle");
    if (handle) {
      const card = handle.closest(".card");
      if (!card || !editMode) return;
      e.preventDefault();
      e.stopPropagation();

      enterFreeform(card);
      mode        = "resize";
      activeCard  = card;
      startX      = e.clientX;
      startY      = e.clientY;
      const rect  = card.getBoundingClientRect();
      startW      = rect.width;
      startH      = rect.height;
      document.body.classList.add("resizing");
      return;
    }

    // Drag anywhere on card in edit mode (except inside inputs/buttons)
    if (!editMode) return;
    const card = e.target.closest(".card");
    if (!card) return;
    if (e.target.matches("input, textarea, button, a, select, [contenteditable]")) return;
    if (e.target.closest(".resize-handle")) return;

    e.preventDefault();
    enterFreeform(card);

    mode       = "drag";
    activeCard = card;
    startX     = e.clientX;
    startY     = e.clientY;
    startLeft  = parseInt(card.style.left, 10) || 0;
    startTop   = parseInt(card.style.top,  10) || 0;

    card.classList.add("dragging");
    card.style.zIndex = "100";
    document.body.classList.add("dragging-card");
  });

  /* ---------- mousemove ---------- */
  document.addEventListener("mousemove", (e) => {
    if (!activeCard) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (mode === "drag") {
      const gridRect = grid.getBoundingClientRect();
      const maxLeft  = Math.max(gridRect.width - 60, window.innerWidth - activeCard.offsetWidth - 20);
      const newLeft  = Math.max(0, Math.min(maxLeft, startLeft + dx));
      const newTop   = Math.max(0, startTop + dy);
      activeCard.style.left = `${Math.round(newLeft)}px`;
      activeCard.style.top  = `${Math.round(newTop)}px`;

      // Dynamically expand grid height when dragged down
      const bottom = newTop + activeCard.offsetHeight + 100;
      if (bottom > grid.offsetHeight) {
        grid.style.minHeight = `${bottom}px`;
      }

    } else if (mode === "resize") {
      const newW = Math.max(200, Math.min(window.innerWidth - 60, startW + dx));
      const newH = Math.max(130, startH + dy);
      activeCard.style.width  = `${Math.round(newW)}px`;
      activeCard.style.height = `${Math.round(newH)}px`;

      const cardTop = parseInt(activeCard.style.top, 10) || 0;
      const bottom = cardTop + newH + 80;
      if (bottom > grid.offsetHeight) {
        grid.style.minHeight = `${bottom}px`;
      }
    }
  });

  /* ---------- mouseup ---------- */
  document.addEventListener("mouseup", () => {
    if (!activeCard) return;

    if (mode === "drag") {
      activeCard.classList.remove("dragging");
      activeCard.style.zIndex = "";
      document.body.classList.remove("dragging-card");
    } else if (mode === "resize") {
      document.body.classList.remove("resizing");
    }

    persist(activeCard);
    S.order = $$(".card", grid).map((c) => c.dataset.widget);
    save({ order: S.order, sizes: S.sizes });

    activeCard = null;
    mode       = null;
  });
}

async function executeResetLayout() {
  const grid = $("#grid");
  grid.classList.remove("canvas-freeform");
  grid.style.minHeight = "";
  $$(".card").forEach((card) => {
    card.style.width      = "";
    card.style.height     = "";
    card.style.left       = "";
    card.style.top        = "";
    card.style.gridColumn = "";
    card.style.zIndex     = "";
  });
  S.order = [...DEFAULTS.order];
  S.hidden = [];
  S.sizes = {};
  await save({ order: S.order, hidden: S.hidden, sizes: S.sizes });
  applyOrder();
  applyVisibility();
  buildWidgetToggles();
  if (window.LiquidGlass && window.LiquidGlass.refresh) {
    window.LiquidGlass.refresh();
  }
  toast("Layout reset to default clean grid");
}

function setEditMode(on) {
  editMode = on;
  document.body.classList.toggle("edit", on);
  $("#editBtn").classList.toggle("on", on);
  const toolbar = $("#editToolbar");
  if (toolbar) toolbar.hidden = !on;

  $$(".card").forEach((c) => (c.draggable = false));
  ensureResizeHandles();
  if (on) toast("Edit mode active: drag cards freely, pull ⌟ to resize");
}

function wireDragDrop() {
  // Legacy stub kept for compatibility
}

/* ---------- clock & vibe greeting --------------------------------------- */
const VIBE_GREETINGS = [
  "Vibe coding mode: ON",
  "In the flow state",
  "Ready to build something legendary",
  "Zero friction, pure momentum",
  "What will you craft today?",
  "Architecting the future",
  "High frequency thinking",
  "Time to ship brilliance",
  "Fuel your creative spark",
  "Stay curious, code boldly",
  "Welcome to the zone",
  "Turning vision into reality",
  "Ideas taking flight",
  "Deep focus unlocked",
  "Clean pixels & sharp logic",
  "The canvas is all yours",
  "Unleash pure creative energy",
  "Chasing breakthroughs",
  "Momentum is on your side",
  "Build, test, elevate",
  "Speed meets artistry",
  "Limitless possibilities today"
];

let currentGreetIdx = Math.floor(Math.random() * VIBE_GREETINGS.length);

function updateGreeting() {
  const phrase = VIBE_GREETINGS[currentGreetIdx];
  const el = $("#greeting");
  if (!el) return;
  el.textContent = S.name ? `${phrase}, ${S.name}` : phrase;
}

function nextGreeting() {
  currentGreetIdx = (currentGreetIdx + 1) % VIBE_GREETINGS.length;
  const el = $("#greeting");
  if (el) {
    el.style.opacity = "0.2";
    el.style.transform = "translateY(-4px)";
    setTimeout(() => {
      updateGreeting();
      el.style.opacity = "1";
      el.style.transform = "none";
    }, 120);
  }
}

function tickClock() {
  const d = new Date();
  let h = d.getHours();
  const is12h = S.timeFormat !== "24h";
  let period = "";
  if (is12h) {
    period = h >= 12 ? " PM" : " AM";
    h = h % 12 || 12;
  }
  const pad = (n) => String(n).padStart(2, "0");
  $("#tH").textContent = is12h ? String(h) : pad(h);
  $("#tM").textContent = pad(d.getMinutes());

  const showSec = S.showSeconds !== false;
  const secEl = $("#tS");
  if (secEl) {
    secEl.style.display = showSec ? "inline" : "none";
    secEl.textContent = (showSec ? pad(d.getSeconds()) : "") + period;
  }

  const formatBtn = $("#clockFormatBtn");
  if (formatBtn) formatBtn.textContent = is12h ? "12H" : "24H";

  $("#tDate").textContent = d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
  $("#tTz").textContent =
    Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop() ||
    "Local";
  $("#heroDate").textContent = d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  updateGreeting();
}

function initClockToggle() {
  const btn = $("#clockFormatBtn");
  const wrap = $("#clockTimeWrap");
  const toggle = async () => {
    S.timeFormat = S.timeFormat === "24h" ? "12h" : "24h";
    if (btn) btn.textContent = S.timeFormat.toUpperCase();
    $$("#clockFormatSeg button").forEach((b) => {
      b.classList.toggle("on", b.dataset.format === S.timeFormat);
    });
    await save({ timeFormat: S.timeFormat });
    tickClock();
    toast(`Clock format: ${S.timeFormat.toUpperCase()}`);
  };

  btn?.addEventListener("click", toggle);
  wrap?.addEventListener("click", toggle);

  // Greeting shuffle
  $("#rerollGreetBtn")?.addEventListener("click", nextGreeting);
  $("#greeting")?.addEventListener("click", nextGreeting);
}

/* ---------- weather -------------------------------------------------------- */
const WMO = {
  0: ["Clear", "☀️"],
  1: ["Mainly clear", "🌤"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫"],
  48: ["Rime fog", "🌫"],
  51: ["Light drizzle", "🌦"],
  53: ["Drizzle", "🌦"],
  55: ["Heavy drizzle", "🌧"],
  56: ["Freezing drizzle", "🌧"],
  57: ["Freezing drizzle", "🌧"],
  61: ["Light rain", "🌦"],
  63: ["Rain", "🌧"],
  65: ["Heavy rain", "🌧"],
  66: ["Freezing rain", "🌧"],
  67: ["Freezing rain", "🌧"],
  71: ["Light snow", "🌨"],
  73: ["Snow", "🌨"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "❄️"],
  80: ["Rain showers", "🌦"],
  81: ["Rain showers", "🌧"],
  82: ["Violent showers", "⛈"],
  85: ["Snow showers", "🌨"],
  86: ["Snow showers", "🌨"],
  95: ["Thunderstorm", "⛈"],
  96: ["Storm + hail", "⛈"],
  99: ["Storm + hail", "⛈"]
};
const wmo = (code) => WMO[code] || ["Unknown", "🌡"];

function weatherStatus(html) {
  $("#wStatus").innerHTML = html;
}

async function loadWeather() {
  const w = S.weather;
  if (!w.lat || !w.lon) {
    $("#wTemp").textContent = "--°";
    $("#wCity").textContent = "No location set";
    $("#wIcon").textContent = "•";
    $("#wMeta").innerHTML = "";
    $("#wForecast").innerHTML = "";
    weatherStatus(
      'Search a city in <b>Settings → Weather</b> or <button id="wGeo">use my location</button>.'
    );
    const b = $("#wGeo");
    if (b) b.onclick = useGeolocation;
    return;
  }

  // Fast hydrate from cache to eliminate placeholder jump
  if (S.cached_weather_v1) {
    const cw = S.cached_weather_v1;
    if (cw.icon) $("#wIcon").textContent = cw.icon;
    if (cw.temp) $("#wTemp").textContent = cw.temp;
    if (cw.city) $("#wCity").textContent = cw.city;
    if (cw.metaHtml) $("#wMeta").innerHTML = cw.metaHtml;
    if (cw.forecastHtml) $("#wForecast").innerHTML = cw.forecastHtml;
  }

  const unit =
    w.unit === "f"
      ? "&temperature_unit=fahrenheit&wind_speed_unit=mph"
      : "";
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5${unit}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const c = data.current;
    const [label, icon] = wmo(c.weather_code);
    $("#wIcon").textContent = icon;
    $("#wTemp").textContent = `${Math.round(c.temperature_2m)}°`;
    $("#wCity").textContent = w.city || "Current location";
    const metaHtml = [
      `${label}`,
      `Feels ${Math.round(c.apparent_temperature)}°`,
      `Humidity ${c.relative_humidity_2m}%`,
      `Wind ${Math.round(c.wind_speed_10m)}`
    ]
      .map((t) => `<span>${t}</span>`)
      .join("");
    $("#wMeta").innerHTML = metaHtml;

    const days = data.daily.time.map((t, i) => {
      const d = new Date(t + "T12:00:00");
      const [, dIcon] = wmo(data.daily.weather_code[i]);
      const max = Math.round(data.daily.temperature_2m_max[i]);
      const min = Math.round(data.daily.temperature_2m_min[i]);
      return `<div class="w-day">${d.toLocaleDateString(undefined, {
        weekday: "short"
      })}<span class="d-ico">${dIcon}</span><b>${max}°/${min}°</b></div>`;
    });
    const forecastHtml = days.join("");
    $("#wForecast").innerHTML = forecastHtml;
    weatherStatus(
      `Updated ${new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })}`
    );

    // Persist cache
    save({
      cached_weather_v1: {
        icon,
        temp: `${Math.round(c.temperature_2m)}°`,
        city: w.city || "Current location",
        metaHtml,
        forecastHtml
      }
    });
  } catch (err) {
    weatherStatus(`Couldn't load weather (${err.message}). Retry later.`);
  }
}

async function geocodeCity(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    q
  )}&count=1&language=en&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results || !data.results.length) throw new Error("city not found");
  const r = data.results[0];
  const city = [r.name, r.admin1 || r.country].filter(Boolean).join(", ");
  return { lat: r.latitude, lon: r.longitude, city };
}

function useGeolocation() {
  if (!navigator.geolocation) {
    toast("Geolocation not available");
    return;
  }
  toast("Locating…");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      S.weather.lat = +pos.coords.latitude.toFixed(4);
      S.weather.lon = +pos.coords.longitude.toFixed(4);
      S.weather.city = "";
      await save({ weather: S.weather });
      loadWeather();
    },
    () => toast("Location permission denied — set a city instead"),
    { timeout: 10000 }
  );
}

/* ---------- notes ---------------------------------------------------------- */
function initNotes() {
  const area = $("#notesArea");
  area.value = S.notes || "";
  const flash = () => {
    const h = $("#notesSaved");
    h.classList.add("show");
    setTimeout(() => h.classList.remove("show"), 1200);
  };
  const persist = debounce(async () => {
    S.notes = area.value;
    await save({ notes: S.notes });
    flash();
  }, 350);
  area.addEventListener("input", persist);
  $("#notesClear").addEventListener("click", () => {
    if (!area.value || confirm("Clear all notes?")) {
      area.value = "";
      S.notes = "";
      save({ notes: "" });
    }
  });
}

/* ---------- tasks ---------------------------------------------------------- */
function renderTasks() {
  const list = $("#taskList");
  const done = S.tasks.filter((t) => t.done).length;
  $("#taskCount").textContent = `${done}/${S.tasks.length}`;
  if (!S.tasks.length) {
    list.innerHTML = `<li class="task-empty" style="border:0;background:none">Nothing yet — add your top priority above.</li>`;
    return;
  }
  list.innerHTML = S.tasks
    .map(
      (t, i) => `
      <li class="${t.done ? "done" : ""}" data-i="${i}">
        <button class="t-check" aria-label="Toggle">✓</button>
        <span class="t-text"></span>
        <button class="t-del" aria-label="Delete">✕</button>
      </li>`
    )
    .join("");
  $$("#taskList .t-text").forEach(
    (el, i) => (el.textContent = S.tasks[i].text)
  );
}

function initTasks() {
  renderTasks();
  $("#taskForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#taskInput");
    const text = input.value.trim();
    if (!text) return;
    S.tasks.push({ text, done: false });
    input.value = "";
    await save({ tasks: S.tasks });
    renderTasks();
  });
  $("#taskList").addEventListener("click", async (e) => {
    const li = e.target.closest("li[data-i]");
    if (!li) return;
    const i = +li.dataset.i;
    if (e.target.closest(".t-check")) S.tasks[i].done = !S.tasks[i].done;
    else if (e.target.closest(".t-del")) S.tasks.splice(i, 1);
    else return;
    await save({ tasks: S.tasks });
    renderTasks();
  });
}

/* ---------- saved links ----------------------------------------------------- */
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return null;
  }
}

function renderLinks() {
  const grid = $("#linkGrid");
  if (!S.links.length) {
    grid.innerHTML = `<div class="link-empty">No links yet — press + to add your favorites.</div>`;
    return;
  }
  grid.innerHTML = S.links
    .map((l, i) => {
      const host = hostOf(l.url) || "";
      const letter = (l.title || host || "?").trim().charAt(0).toUpperCase();
      const ico = host
        ? `<img src="https://www.google.com/s2/favicons?domain=${esc(
            host
          )}&sz=64" alt="">`
        : "";
      return `<div class="link" data-i="${i}" title="${esc(l.url)}">
          <button class="link-edit-btn" title="Edit link" aria-label="Edit link"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
          <a href="${esc(l.url)}" target="_self" style="display:flex;flex-direction:column;align-items:center;gap:9px;text-decoration:none;color:inherit;width:100%;">
            <span class="link-ico">${letter}${ico}</span>
            <span class="link-name"></span>
          </a>
          <button class="link-x" title="Remove" aria-label="Remove">✕</button>
        </div>`;
    })
    .join("");
  $$("#linkGrid .link-name").forEach(
    (el, i) => (el.textContent = S.links[i].title)
  );
  // MV3 CSP forbids inline handlers, so wire image fallbacks here.
  $$("#linkGrid .link-ico img").forEach((img) => {
    img.onerror = () => img.remove();
    img.onload = () => {
      const ico = img.closest(".link-ico");
      if (ico && ico.firstChild) ico.firstChild.textContent = "";
    };
    if (img.complete && img.naturalWidth > 0) img.onload();
  });
}

function initLinks() {
  renderLinks();
  const form = $("#linkForm");
  const editIdxInput = $("#linkEditIdx");
  const submitBtn = $("#linkSubmitBtn");
  const cancelBtn = $("#linkCancelBtn");

  const openForm = (idx = -1) => {
    editIdxInput.value = String(idx);
    if (idx >= 0 && S.links[idx]) {
      $("#linkTitle").value = S.links[idx].title;
      $("#linkUrl").value = S.links[idx].url;
      if (submitBtn) submitBtn.textContent = "Save Changes";
    } else {
      $("#linkTitle").value = "";
      $("#linkUrl").value = "";
      if (submitBtn) submitBtn.textContent = "Add";
    }
    form.hidden = false;
    $("#linkTitle").focus();
  };

  const closeForm = () => {
    form.hidden = true;
    editIdxInput.value = "-1";
    $("#linkTitle").value = "";
    $("#linkUrl").value = "";
  };

  $("#linkAddBtn")?.addEventListener("click", () => {
    if (!form.hidden && editIdxInput.value === "-1") {
      closeForm();
    } else {
      openForm(-1);
    }
  });

  cancelBtn?.addEventListener("click", closeForm);

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("#linkTitle").value.trim();
    let url = $("#linkUrl").value.trim();
    if (!title || !url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    if (!hostOf(url)) {
      toast("That URL doesn't look right");
      return;
    }
    const idx = parseInt(editIdxInput.value, 10);
    if (idx >= 0 && idx < S.links.length) {
      S.links[idx] = { title, url };
      toast("Link updated");
    } else {
      S.links.push({ title, url });
      toast("Link added");
    }
    closeForm();
    await save({ links: S.links });
    renderLinks();
  });

  $("#linkGrid")?.addEventListener("click", async (e) => {
    const editBtn = e.target.closest(".link-edit-btn");
    const delBtn = e.target.closest(".link-x");
    const linkEl = e.target.closest(".link");
    if (!linkEl) return;
    const i = +linkEl.dataset.i;

    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      openForm(i);
      return;
    }

    if (delBtn) {
      e.preventDefault();
      e.stopPropagation();
      S.links.splice(i, 1);
      await save({ links: S.links });
      renderLinks();
      toast("Link deleted");
      return;
    }
  });
}

/* ---------- News Radar ----------------------------------------------------- */
const NEWS_FEEDS = {
  ai: [
    {
      title: "Anthropic Claude 3.7 Sonnet: Hybrid reasoning models transform autonomous coding",
      url: "https://www.anthropic.com/news",
      source: "Anthropic",
      time: "20m ago"
    },
    {
      title: "DeepSeek v3 & R1: Open architecture benchmarks & local deployment scaling",
      url: "https://github.com/deepseek-ai",
      source: "Open Source",
      time: "1h ago"
    },
    {
      title: "OpenAI Operator protocol preview: Automated agent workflows across the web",
      url: "https://openai.com/news",
      source: "OpenAI",
      time: "2h ago"
    },
    {
      title: "Google DeepMind unveils Gemini 2.0 Flash Thinking for complex multi-step reasoning",
      url: "https://deepmind.google/news",
      source: "Google DeepMind",
      time: "3h ago"
    },
    {
      title: "Local LLM Inference: 120 tokens/sec sustained on Apple Silicon M4 Max",
      url: "https://github.com/ggerganov/llama.cpp",
      source: "llama.cpp",
      time: "5h ago"
    }
  ],
  vibe: [
    {
      title: "The Vibe Coding Paradigm: How developers build full-scale apps with natural dialogue",
      url: "https://news.ycombinator.com",
      source: "Tech Essay",
      time: "15m ago"
    },
    {
      title: "Cursor & Windsurf workflows: Accelerating full-stack SaaS builds from days to hours",
      url: "https://dev.to",
      source: "Dev.to",
      time: "40m ago"
    },
    {
      title: "Liquid Glass UI & Modern Refractive Aesthetics dominate 2025 web design",
      url: "https://news.ycombinator.com",
      source: "Design Trends",
      time: "2h ago"
    },
    {
      title: "Next.js 15 & Vite 6 performance benchmarks: Instant HMR and zero-bundle server components",
      url: "https://github.com/vercel/next.js",
      source: "GitHub",
      time: "3h ago"
    },
    {
      title: "TypeScript 5.8 released: Enhanced type narrowing and accelerated project compilation",
      url: "https://devblogs.microsoft.com/typescript",
      source: "TypeScript",
      time: "4h ago"
    }
  ],
  breaking: [
    {
      title: "Clean Energy Milestone: Sustained net fusion power output achieved in international trial",
      url: "https://www.nature.com",
      source: "Nature",
      time: "30m ago"
    },
    {
      title: "NASA Europa Clipper instruments confirmed operational in deep space journey to Jupiter",
      url: "https://www.nasa.gov",
      source: "NASA Space",
      time: "1h ago"
    },
    {
      title: "European Union establishes landmark digital sovereignty and open standard protocols",
      url: "https://www.reuters.com",
      source: "Reuters",
      time: "2h ago"
    },
    {
      title: "Quantum Breakthrough: 1,000 logical error-corrected qubits demonstrated simultaneously",
      url: "https://www.technologyreview.com",
      source: "MIT Tech Review",
      time: "4h ago"
    },
    {
      title: "Global Renewables: Solar and wind exceed fossil fuels in European electricity mix",
      url: "https://www.bbc.com/news",
      source: "BBC World",
      time: "6h ago"
    }
  ]
};

let currentNewsCat = "ai";

async function fetchLiveTechStories() {
  try {
    const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    if (!res.ok) return null;
    const ids = await res.json();
    const topIds = ids.slice(0, 3);
    const items = await Promise.all(
      topIds.map(async (id) => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        return r.json();
      })
    );
    return items.map((it) => ({
      title: it.title,
      url: it.url || `https://news.ycombinator.com/item?id=${it.id}`,
      source: hostOf(it.url) || "Hacker News",
      time: `${Math.max(1, Math.round((Date.now() / 1000 - it.time) / 60))}m ago`
    }));
  } catch (e) {
    return null;
  }
}

async function renderNews(cat) {
  if (cat) currentNewsCat = cat;
  const container = $("#newsBody");
  if (!container) return;

  $$("#newsTabs .news-tab").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.cat === currentNewsCat);
  });

  let items = NEWS_FEEDS[currentNewsCat] || NEWS_FEEDS.ai;

  if (currentNewsCat === "vibe" || currentNewsCat === "ai") {
    try {
      const liveItems = await fetchLiveTechStories();
      if (liveItems && liveItems.length > 0) {
        items = [liveItems[0], ...items.slice(1)];
      }
    } catch (e) {}
  }

  container.innerHTML = items
    .map(
      (item) => `
      <a class="news-item" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">
        <div class="news-item-content">
          <div class="news-item-title">${esc(item.title)}</div>
          <div class="news-item-meta">
            <span class="news-item-src">${esc(item.source)}</span>
            <span>•</span>
            <span>${esc(item.time)}</span>
          </div>
        </div>
        <svg class="news-item-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="7" y1="17" x2="17" y2="7"/>
          <polyline points="7 7 17 7 17 17"/>
        </svg>
      </a>
    `
    )
    .join("");
}

function initNews() {
  renderNews("ai");
  $("#newsTabs")?.addEventListener("click", (e) => {
    const tab = e.target.closest(".news-tab");
    if (!tab) return;
    renderNews(tab.dataset.cat);
  });
  $("#newsRefreshBtn")?.addEventListener("click", () => {
    toast("Refreshing radar feeds…");
    renderNews();
  });
}

/* ---------- Web Screen Time & Top 5 Sites ----------------------------------- */
async function getWebUsageData() {
  if (isExt && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "web:usage" }, (resp) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve(resp);
          }
        });
      });
      if (res && res.ok) return res;
    } catch (e) {}
  }

  return {
    ok: true,
    totalSeconds: 5240,
    topSites: [
      { host: "github.com", seconds: 2400 },
      { host: "youtube.com", seconds: 1560 },
      { host: "x.com", seconds: 680 },
      { host: "chatgpt.com", seconds: 420 },
      { host: "developer.mozilla.org", seconds: 180 }
    ]
  };
}

function formatDuration(sec) {
  if (!sec || sec < 60) return `${sec || 0}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

async function renderWebUsage() {
  const data = await getWebUsageData();
  const totalEl = $("#webTotalTime");
  const listEl = $("#topSitesList");
  if (!totalEl || !listEl) return;

  totalEl.textContent = `Today: ${formatDuration(data.totalSeconds)}`;

  const sites = data.topSites && data.topSites.length ? data.topSites.slice(0, 5) : [];
  if (!sites.length) {
    listEl.innerHTML = `<div class="task-empty">Browsing activity will appear here as you visit websites.</div>`;
    return;
  }

  const maxSec = Math.max(1, ...sites.map((s) => s.seconds || 60));

  listEl.innerHTML = sites
    .map((s) => {
      const host = s.host;
      const pct = Math.max(14, Math.round(((s.seconds || 30) / maxSec) * 100));
      const letter = host.charAt(0).toUpperCase();
      const timeStr = s.seconds > 0 ? formatDuration(s.seconds) : "Top Visited";
      return `
        <a class="top-site-row" href="https://${esc(host)}" target="_blank" rel="noopener">
          <div class="top-site-ico">
            <img src="https://www.google.com/s2/favicons?domain=${esc(host)}&sz=64" alt="" onerror="this.remove()">
            <span>${letter}</span>
          </div>
          <div class="top-site-info">
            <div class="top-site-name-row">
              <span class="top-site-host">${esc(host)}</span>
              <span class="top-site-time">${timeStr}</span>
            </div>
            <div class="top-site-bar">
              <div class="top-site-bar-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        </a>
      `;
    })
    .join("");
}

function initWebUsage() {
  renderWebUsage();
  $("#webRefreshBtn")?.addEventListener("click", () => {
    toast("Updated web usage");
    renderWebUsage();
  });
}

/* ---------- focus timer ------------------------------------------------------ */
function renderSiteChips() {
  const wrap = $("#siteChips");
  wrap.innerHTML = S.focusPref.sites
    .map(
      (s) =>
        `<button type="button" data-site="${s}" class="${
          S.focusPref.selected.includes(s) ? "on" : ""
        }">${s.replace(/^www\./, "")}</button>`
    )
    .join("");
}

function renderFocusSetup() {
  $$("#durationChips button").forEach((b) =>
    b.classList.toggle("on", +b.dataset.min === S.focusPref.minutes)
  );
  renderSiteChips();
  $("#customMin").value = "";
}

function fmtClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

let runTimer = null;
let endArmT = null;

const RING_C = 2 * Math.PI * 54; // matches .ring-fg stroke-dasharray
function setRing(pct) {
  const ring = $("#runRing");
  if (ring) ring.style.strokeDashoffset = String(RING_C * (1 - pct / 100));
}

function showRunView() {
  $("#focusSetup").hidden = true;
  $("#focusRun").hidden = false;
  $("#focusPill").textContent = "Blocking";
  $("#focusPill").classList.add("live");
  if (activeFocus) {
    const n = activeFocus.sites.length;
    $("#runSub").textContent = `blocking ${n} site${n === 1 ? "" : "s"} · ${
      activeFocus.minutes
    } min session`;
    $("#runTime").textContent = fmtClock(activeFocus.endTs - Date.now());
  }
}

function showSetupView() {
  $("#focusRun").hidden = true;
  $("#focusSetup").hidden = false;
  $("#focusPill").textContent = "Idle";
  $("#focusPill").classList.remove("live");
  setRing(0);
  if (typeof resetEndButton === "function") resetEndButton();
}

function tickRun() {
  if (!activeFocus) return;
  const now = Date.now();
  const left = activeFocus.endTs - now;
  if (left <= 0) {
    clearInterval(runTimer);
    runTimer = null;
    completeSession();
    return;
  }
  const span = Math.max(1, activeFocus.endTs - activeFocus.startTs);
  const pct = Math.min(100, ((now - activeFocus.startTs) / span) * 100);
  $("#runTime").textContent = fmtClock(left);
  setRing(pct);
}

async function completeSession() {
  if (!activeFocus) return;
  const finished = { ...activeFocus };
  activeFocus = null;
  await sendMessage({ type: "focus:stop" });
  S.sessions = (S.sessions || 0) + 1;
  await save({ sessions: S.sessions });
  const sessionEl = $("#sessionStat");
  if (sessionEl) {
    sessionEl.textContent = `${S.sessions} focus session${
      S.sessions === 1 ? "" : "s"
    }`;
  }
  showSetupView();
  toast("🎉 Focus session complete — nice work!");
  if (typeof promptFocusAccomplishment === "function") {
    promptFocusAccomplishment(finished);
  }
}

async function startFocus() {
  const sites = S.focusPref.selected.filter((s) =>
    S.focusPref.sites.includes(s)
  );
  if (!sites.length) {
    toast("Pick at least one site to block");
    return;
  }
  const custom = parseInt($("#customMin").value, 10);
  const minutes =
    custom > 0
      ? Math.min(480, custom)
      : S.focusPref.minutes || 25;

  const res = await sendMessage({ type: "focus:start", sites, minutes });
  if (!res || !res.ok) {
    toast("Could not start the blocker: " + (res && res.error));
    return;
  }
  activeFocus = res.focus;
  showRunView();
  tickRun();
  clearInterval(runTimer);
  runTimer = setInterval(tickRun, 500);
  toast(`Focus on — ${sites.length} sites blocked for ${minutes} min`);
}

async function stopFocus() {
  clearInterval(runTimer);
  runTimer = null;
  activeFocus = null;
  await sendMessage({ type: "focus:stop" });
  showSetupView();
  resetEndButton();
  toast("Session ended — blocking lifted");
}

function resetEndButton() {
  const b = $("#endFocus");
  b.dataset.armed = "0";
  b.textContent = "End session";
  b.classList.remove("armed");
}

function initFocus() {
  renderFocusSetup();

  $("#durationChips").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-min]");
    if (!b) return;
    S.focusPref.minutes = +b.dataset.min;
    $("#customMin").value = "";
    await save({ focusPref: S.focusPref });
    renderFocusSetup();
  });

  $("#customMin").addEventListener("change", () => {
    const v = parseInt($("#customMin").value, 10);
    if (v > 0) {
      S.focusPref.minutes = Math.min(480, v);
      save({ focusPref: S.focusPref });
      $$("#durationChips button").forEach((b) => b.classList.remove("on"));
    }
  });

  $("#siteChips").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-site]");
    if (!b) return;
    const site = b.dataset.site;
    const sel = S.focusPref.selected;
    const i = sel.indexOf(site);
    if (i >= 0) sel.splice(i, 1);
    else sel.push(site);
    await save({ focusPref: S.focusPref });
    renderSiteChips();
  });

  $("#siteAddForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = $("#siteAddInput").value.trim().toLowerCase();
    if (!raw) return;
    const host = raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (!host.includes(".")) {
      toast("Enter a domain like site.com");
      return;
    }
    if (!S.focusPref.sites.includes(host)) S.focusPref.sites.push(host);
    if (!S.focusPref.selected.includes(host)) S.focusPref.selected.push(host);
    $("#siteAddInput").value = "";
    await save({ focusPref: S.focusPref });
    renderSiteChips();
    renderFocusSiteList();
  });

  $("#startFocus").addEventListener("click", startFocus);
  // two-step confirm so nobody ends a session by accident
  $("#endFocus").addEventListener("click", (e) => {
    const b = e.currentTarget;
    if (b.dataset.armed !== "1") {
      b.dataset.armed = "1";
      b.textContent = "Click again to confirm";
      b.classList.add("armed");
      clearTimeout(endArmT);
      endArmT = setTimeout(resetEndButton, 3000);
      return;
    }
    stopFocus();
  });

  // sync with whatever the service worker is doing
  store.getAll().then((all) => {
    if (all.focus && all.focus.endTs > Date.now()) {
      activeFocus = all.focus;
      showRunView();
      tickRun();
      runTimer = setInterval(tickRun, 500);
    } else {
      showSetupView();
    }
  });

  store.onChange((changes) => {
    if (!changes.focus) return;
    const now = changes.focus.newValue;
    if (!now) {
      // Session ended elsewhere (alarm fired / another tab stopped it).
      if (activeFocus) {
        clearInterval(runTimer);
        runTimer = null;
        completeSession();
      }
    } else if (!activeFocus || now.endTs !== activeFocus.endTs) {
      // Session started in another tab.
      activeFocus = now;
      showRunView();
      tickRun();
      clearInterval(runTimer);
      runTimer = setInterval(tickRun, 500);
    }
  });
}

/* ---------- settings drawer --------------------------------------------------- */
function buildPresets() {
  const wrap = $("#presets");
  const items = [
    { type: "gradient", value: GRADIENTS[0] },
    { type: "gradient", value: GRADIENTS[1] },
    { type: "gradient", value: GRADIENTS[2] },
    { type: "gradient", value: GRADIENTS[3] },
    { type: "gradient", value: GRADIENTS[4] },
    ...PHOTOS.map((u) => ({ type: "image", value: u }))
  ];
  wrap.innerHTML = items
    .map((it, i) => {
      const style =
        it.type === "gradient"
          ? `background:${it.value}`
          : `background-image:url('${it.value}')`;
      const on =
        (S.bg.type === "gradient" && it.value === S.bg.value) ||
        (S.bg.type === "image" && it.value === S.bg.value);
      return `<button type="button" class="preset ${
        on ? "on" : ""
      }" data-i="${i}" style="${style}"></button>`;
    })
    .join("");
  wrap.onclick = async (e) => {
    const b = e.target.closest(".preset");
    if (!b) return;
    const it = items[+b.dataset.i];
    S.bg = { type: it.type, value: it.value };
    await save({ bg: S.bg });
    applyBackground();
    buildPresets();
  };
}

function buildWidgetToggles() {
  const wrap = $("#widgetToggles");
  wrap.innerHTML = S.order
    .map(
      (id) => `
      <div class="widget-toggle ${S.hidden.includes(id) ? "" : "on"}" data-widget="${id}">
        <span>${WIDGET_NAMES[id] || id}</span>
        <span class="switch"></span>
      </div>`
    )
    .join("");
  wrap.onclick = async (e) => {
    const el = e.target.closest(".widget-toggle");
    if (!el) return;
    const id = el.dataset.widget;
    const i = S.hidden.indexOf(id);
    if (i >= 0) S.hidden.splice(i, 1);
    else S.hidden.push(id);
    await save({ hidden: S.hidden });
    applyVisibility();
  };
}

function renderFocusSiteList() {
  const wrap = $("#focusSiteList");
  wrap.innerHTML = S.focusPref.sites
    .map(
      (s) =>
        `<button type="button" data-site="${s}" class="${
          S.focusPref.selected.includes(s) ? "on" : ""
        }">${s}<span class="x" title="Remove">✕</span></button>`
    )
    .join("");
}

function initSettings() {
  buildPresets();
  buildWidgetToggles();
  renderFocusSiteList();

  const drawer = $("#drawer");
  const scrim = $("#scrim");
  const open = () => {
    drawer.hidden = false;
    scrim.hidden = false;
    requestAnimationFrame(() => {
      drawer.classList.add("open");
      scrim.classList.add("open");
    });
    syncDrawerSliders();
    buildPresets();
    buildWidgetToggles();
    renderFocusSiteList();
  };
  const close = () => {
    drawer.classList.remove("open");
    scrim.classList.remove("open");
    setTimeout(() => {
      drawer.hidden = true;
      scrim.hidden = true;
    }, 300);
    // Explicitly guarantee all settings are flushed to storage on close
    save({
      brightness: S.brightness,
      blur: S.blur,
      opacity: S.opacity,
      radius: S.radius,
      liquid: S.liquid,
      theme: S.theme,
      accent: S.accent,
      accent2: S.accent2,
      timeFormat: S.timeFormat,
      showSeconds: S.showSeconds,
      name: S.name
    });
  };
  $("#settingsBtn").addEventListener("click", open);
  $("#drawerClose").addEventListener("click", close);
  scrim.addEventListener("click", close);

  const syncDrawerSliders = () => {
    const setVal = (id, val, text) => {
      const el = $("#" + id);
      const out = $("#" + id.replace("Range", "Val"));
      if (el) el.value = val;
      if (out && text) out.textContent = text;
    };
    setVal("brightnessRange", S.brightness != null ? S.brightness : 100, `${S.brightness != null ? S.brightness : 100}%`);
    setVal("blurRange", S.blur, `${S.blur}px`);
    setVal("opacityRange", S.opacity, `${S.opacity}%`);
    setVal("radiusRange", S.radius, `${S.radius}px`);
    if (S.liquid) {
      setVal("refractRange", S.liquid.refractionScale, `${S.liquid.refractionScale}px`);
      setVal("bezelRange", S.liquid.bezel, `${S.liquid.bezel}px`);
      setVal("specularRange", Math.round((S.liquid.specularOpacity != null ? S.liquid.specularOpacity : 0.55) * 100), `${Math.round((S.liquid.specularOpacity != null ? S.liquid.specularOpacity : 0.55) * 100)}%`);
      setVal("satRange", S.liquid.specularSaturation, `${S.liquid.specularSaturation}x`);
      setVal("angleRange", S.liquid.lightAngle, `${S.liquid.lightAngle}°`);
      const cursorToggle = $("#cursorLightToggle");
      if (cursorToggle) cursorToggle.checked = Boolean(S.liquid.cursorLight);
    }
  };
  syncDrawerSliders();

  /* glass sliders with live widget feedback on every input frame */
  const bindRange = (id, key, label, transform) => {
    const el = $("#" + id);
    const out = $("#" + id.replace("Range", "Val"));
    if (!el || !out) return;
    el.value = S[key];
    out.textContent = transform(S[key]);
    const push = debounce(async () => {
      await save({ [key]: S[key] });
    }, 120);
    el.addEventListener("input", () => {
      S[key] = +el.value;
      out.textContent = transform(S[key]);
      applyAppearance();
      push();
    });
    el.addEventListener("change", async () => {
      S[key] = +el.value;
      out.textContent = transform(S[key]);
      applyAppearance();
      await save({ [key]: S[key] });
    });
  };
  bindRange("brightnessRange", "brightness", "Brightness", (v) => `${v}%`);
  bindRange("blurRange", "blur", "Blur", (v) => `${v}px`);
  bindRange("opacityRange", "opacity", "Opacity", (v) => `${v}%`);
  bindRange("radiusRange", "radius", "Radius", (v) => `${v}px`);

  /* time & clock settings */
  const fmtSeg = $("#clockFormatSeg");
  if (fmtSeg) {
    $$("button", fmtSeg).forEach((b) =>
      b.classList.toggle("on", b.dataset.format === (S.timeFormat || "12h"))
    );
    fmtSeg.addEventListener("click", async (e) => {
      const b = e.target.closest("button[data-format]");
      if (!b) return;
      S.timeFormat = b.dataset.format;
      await save({ timeFormat: S.timeFormat });
      $$("button", fmtSeg).forEach((x) =>
        x.classList.toggle("on", x.dataset.format === S.timeFormat)
      );
      const btn = $("#clockFormatBtn");
      if (btn) btn.textContent = S.timeFormat.toUpperCase();
      tickClock();
      toast(`Clock format set to ${S.timeFormat.toUpperCase()}`);
    });
  }

  const secToggle = $("#showSecondsToggle");
  if (secToggle) {
    secToggle.checked = S.showSeconds !== false;
    secToggle.addEventListener("change", async () => {
      S.showSeconds = secToggle.checked;
      await save({ showSeconds: S.showSeconds });
      tickClock();
    });
  }

  /* theme + accent */
  $("#themeSeg").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-theme]");
    if (!b) return;
    const prevTheme = S.theme;
    S.theme = b.dataset.theme;
    if (S.theme === "oled") {
      S.radius = 6;
      S.opacity = 8;
      if (S.bg.type === "gradient" && S.bg.value === GRADIENTS[0]) {
        S.bg = { type: "gradient", value: GRADIENTS[4] };
        applyBackground();
      }
      toast("Minimal OLED Dark mode active");
    } else if (prevTheme === "oled") {
      S.radius = 24;
      S.opacity = 14;
      if (S.bg.type === "gradient" && S.bg.value === GRADIENTS[4]) {
        S.bg = { type: "gradient", value: GRADIENTS[0] };
        applyBackground();
      }
      toast("Normal Liquid Glass mode active");
    }
    await save({ theme: S.theme, radius: S.radius, opacity: S.opacity, bg: S.bg });
    syncDrawerSliders();
    applyAppearance();
    buildPresets();
  });

  const accent = $("#accentColor");
  accent.value = S.accent;
  accent.addEventListener("input", () => {
    S.accent = accent.value;
    S.accent2 = shiftHue(accent.value, 45);
    applyAppearance();
    debounce(() => save({ accent: S.accent, accent2: S.accent2 }), 200)();
  });
  accent.addEventListener("change", async () => {
    S.accent = accent.value;
    S.accent2 = shiftHue(accent.value, 45);
    applyAppearance();
    await save({ accent: S.accent, accent2: S.accent2 });
  });

  /* background upload */
  $("#bgUpload").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Please pick an image file");
      return;
    }
    toast("Processing image…");
    try {
      const dataUrl = await downscale(file, 1920, 0.82);
      S.bg = { type: "image", value: dataUrl };
      await save({ bg: S.bg });
      applyBackground();
      buildPresets();
      toast("Background applied");
    } catch (err) {
      toast("Could not load that image");
    }
    e.target.value = "";
  });

  $("#bgClear").addEventListener("click", async () => {
    S.bg = { type: "gradient", value: GRADIENTS[0] };
    await save({ bg: S.bg });
    applyBackground();
    buildPresets();
  });

  /* weather */
  $("#cityForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("#cityInput").value.trim();
    if (!q) return;
    $("#cityInput").value = "";
    toast("Searching…");
    try {
      const geo = await geocodeCity(q);
      S.weather = { ...S.weather, ...geo };
      await save({ weather: S.weather });
      loadWeather();
      toast(`Weather set to ${geo.city}`);
    } catch (err) {
      toast("City not found");
    }
  });

  $("#geoBtn").addEventListener("click", useGeolocation);

  $("#unitSeg").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-unit]");
    if (!b) return;
    S.weather.unit = b.dataset.unit;
    await save({ weather: S.weather });
    $$("#unitSeg button").forEach((x) =>
      x.classList.toggle("on", x.dataset.unit === S.weather.unit)
    );
    loadWeather();
  });

  /* focus settings */
  $("#focusSiteList").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-site]");
    if (!b) return;
    const site = b.dataset.site;
    if (e.target.classList.contains("x")) {
      S.focusPref.sites = S.focusPref.sites.filter((s) => s !== site);
      S.focusPref.selected = S.focusPref.selected.filter((s) => s !== site);
    } else {
      const sel = S.focusPref.selected;
      const i = sel.indexOf(site);
      if (i >= 0) sel.splice(i, 1);
      else sel.push(site);
    }
    await save({ focusPref: S.focusPref });
    renderFocusSiteList();
    renderSiteChips();
  });

  $("#focusSiteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = $("#focusSiteInput").value.trim().toLowerCase();
    if (!raw) return;
    const host = raw
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
    if (!host.includes(".")) {
      toast("Enter a domain like site.com");
      return;
    }
    $("#focusSiteInput").value = "";
    if (!S.focusPref.sites.includes(host)) S.focusPref.sites.push(host);
    if (!S.focusPref.selected.includes(host)) S.focusPref.selected.push(host);
    await save({ focusPref: S.focusPref });
    renderFocusSiteList();
    renderSiteChips();
  });

  $("#defaultMin").value = S.focusPref.minutes;
  $("#defaultMin").addEventListener("change", async () => {
    const v = parseInt($("#defaultMin").value, 10) || 25;
    S.focusPref.minutes = Math.min(480, Math.max(1, v));
    $("#defaultMin").value = S.focusPref.minutes;
    await save({ focusPref: S.focusPref });
    renderFocusSetup();
  });

  /* name */
  const nameInput = $("#nameInput");
  nameInput.value = S.name || "";
  nameInput.addEventListener(
    "input",
    debounce(async () => {
      S.name = nameInput.value.trim();
      await save({ name: S.name });
      tickClock();
    }, 400)
  );

  /* Liquid Glass Controls - Instant Live Preview on Every Input Frame */
  const bindLiquidRange = (id, key, transform) => {
    const el = $("#" + id);
    const out = $("#" + id.replace("Range", "Val"));
    if (!el || !out) return;
    const isPercent = key === "specularOpacity";
    el.value = isPercent ? Math.round((S.liquid[key] != null ? S.liquid[key] : 0.55) * 100) : S.liquid[key];
    out.textContent = transform(S.liquid[key]);
    const push = debounce(async () => {
      await save({ liquid: S.liquid });
    }, 120);
    el.addEventListener("input", () => {
      const v = isPercent ? (+el.value / 100) : +el.value;
      S.liquid[key] = v;
      out.textContent = transform(v);
      applyAppearance();
      if (window.LiquidGlass && window.LiquidGlass.updateSettings) {
        LiquidGlass.updateSettings({ [key]: v });
      }
      push();
    });
    el.addEventListener("change", async () => {
      const v = isPercent ? (+el.value / 100) : +el.value;
      S.liquid[key] = v;
      out.textContent = transform(v);
      applyAppearance();
      if (window.LiquidGlass && window.LiquidGlass.updateSettings) {
        LiquidGlass.updateSettings({ [key]: v });
      }
      await save({ liquid: S.liquid });
    });
  };

  bindLiquidRange("refractRange", "refractionScale", (v) => `${v}px`);
  bindLiquidRange("bezelRange", "bezel", (v) => `${v}px`);
  bindLiquidRange("specularRange", "specularOpacity", (v) => `${Math.round((v != null ? v : 0.65) * 100)}%`);
  bindLiquidRange("satRange", "specularSaturation", (v) => `${v}x`);
  bindLiquidRange("angleRange", "lightAngle", (v) => `${v}°`);

  const cursorLightToggle = $("#cursorLightToggle");
  if (cursorLightToggle) {
    cursorLightToggle.checked = Boolean(S.liquid?.cursorLight);
    cursorLightToggle.addEventListener("change", async () => {
      S.liquid.cursorLight = cursorLightToggle.checked;
      applyAppearance();
      await save({ liquid: S.liquid });
      toast(S.liquid.cursorLight ? "Dynamic cursor light tracking enabled" : "Fixed light angle restored");
    });
  }

  const quickDynamicBtn = $("#dynamicLightQuickBtn");
  if (quickDynamicBtn) {
    quickDynamicBtn.addEventListener("click", async () => {
      S.liquid.cursorLight = !S.liquid?.cursorLight;
      applyAppearance();
      await save({ liquid: S.liquid });
      toast(S.liquid.cursorLight ? "Dynamic cursor light tracking enabled" : "Fixed light angle restored");
    });
  }

  const liquidToggle = $("#liquidToggle");
  if (liquidToggle) {
    liquidToggle.checked = S.liquid.enabled !== false;
    liquidToggle.addEventListener("change", async () => {
      S.liquid.enabled = liquidToggle.checked;
      applyAppearance();
      if (window.LiquidGlass) LiquidGlass.toggle(S.liquid.enabled);
      await save({ liquid: S.liquid });
      toast(S.liquid.enabled ? "Liquid glass refraction active" : "Frosted glass mode active");
    });
  }

  const profileSeg = $("#profileSeg");
  if (profileSeg) {
    $$("button[data-profile]", profileSeg).forEach((b) =>
      b.classList.toggle("on", b.dataset.profile === S.liquid.profile)
    );
    profileSeg.addEventListener("click", async (e) => {
      const b = e.target.closest("button[data-profile]");
      if (!b) return;
      S.liquid.profile = b.dataset.profile;
      $$("button[data-profile]", profileSeg).forEach((x) =>
        x.classList.toggle("on", x === b)
      );
      if (window.LiquidGlass) LiquidGlass.updateSettings({ profile: S.liquid.profile });
      applyAppearance();
      await save({ liquid: S.liquid });
      toast(`Glass Profile: ${b.textContent}`);
    });
  }


  /* Layout controls */
  const autoArrange = $("#autoArrangeBtn");
  if (autoArrange) {
    autoArrange.addEventListener("click", async () => {
      S.sizes = {};
      $$(".card").forEach((card) => {
        card.style.width      = "";
        card.style.height     = "";
        card.style.left       = "";
        card.style.top        = "";
        card.style.gridColumn = "";
      });
      $("#grid").classList.remove("canvas-freeform");
      await save({ sizes: {} });
      toast("Widgets auto-arranged into responsive grid");
      if (window.LiquidGlass && window.LiquidGlass.refresh) {
        window.LiquidGlass.refresh();
      }
    });
  }

  const resetLayoutBtnEl = $("#resetLayoutBtn");
  if (resetLayoutBtnEl) {
    resetLayoutBtnEl.addEventListener("click", executeResetLayout);
  }

  /* reset */
  $("#resetBtn").addEventListener("click", async () => {
    if (!confirm("Reset all Liquid Glass settings, links, notes and tasks?"))
      return;
    if (hasExt) await chrome.storage.local.clear();
    else Object.keys(mem).forEach((k) => delete mem[k]);
    location.reload();
  });
}

function downscale(file, maxW, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Google Lens Integration -------------------------------------------- */
function initGoogleLens() {
  const lensBtn = $("#googleLensBtn");
  const modalBackdrop = $("#lensModalBackdrop");
  const closeBtn = $("#lensCloseBtn");
  const dropzone = $("#lensDropzone");
  const fileInput = $("#lensFileInput");
  const uploadBtn = $("#lensUploadBtn");
  const urlForm = $("#lensUrlForm");
  const urlInput = $("#lensUrlInput");
  const dropBox = $("#lensDropBox");
  const uploadLoading = $("#lensUploadLoading");

  if (!lensBtn || !modalBackdrop) return;

  function openLensModal() {
    modalBackdrop.hidden = false;
    if (urlInput) urlInput.value = "";
    resetDropzone();
    setTimeout(() => urlInput?.focus(), 50);
  }

  function closeLensModal() {
    modalBackdrop.hidden = true;
    resetDropzone();
  }

  function resetDropzone() {
    if (dropBox) dropBox.hidden = false;
    if (uploadLoading) uploadLoading.hidden = true;
    if (dropzone) dropzone.classList.remove("dragover");
  }

  lensBtn.addEventListener("click", openLensModal);
  closeBtn?.addEventListener("click", closeLensModal);

  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeLensModal();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalBackdrop.hidden) {
      closeLensModal();
    }
  });

  // URL search
  urlForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = urlInput ? urlInput.value.trim() : "";
    if (!url) return;
    const fullUrl = /^https?:\/\//i.test(url) ? url : "https://" + url;
    const searchUrl = "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(fullUrl);
    openExternalTab(searchUrl);
    closeLensModal();
  });

  // Dropzone click & file picking
  uploadBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput?.click();
  });

  dropzone?.addEventListener("click", () => {
    fileInput?.click();
  });

  fileInput?.addEventListener("change", () => {
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      // Immediately reset value to clear active file chooser state in Chromium
      fileInput.value = "";
      handleLensFile(file);
    }
  });

  // Drag and drop
  dropzone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add("dragover");
  });

  dropzone?.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("dragover");
  });

  dropzone?.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLensFile(e.dataTransfer.files[0]);
    }
  });

  // Paste image directly while modal is open
  window.addEventListener("paste", (e) => {
    if (modalBackdrop.hidden) return;
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.indexOf("image") === 0) {
        const blob = item.getAsFile();
        if (blob) {
          handleLensFile(blob);
          e.preventDefault();
          return;
        }
      }
    }
  });

  async function handleLensFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      toast("Please choose an image file (PNG, JPG, WebP)");
      return;
    }

    if (dropBox) dropBox.hidden = true;
    if (uploadLoading) uploadLoading.hidden = false;

    try {
      // 1. Try background upload via chrome.runtime messaging
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result;
          const base64 = typeof res === "string" ? res.split(",")[1] : "";
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const res = await sendMessage({
        type: "lens:upload",
        base64Data,
        mimeType: file.type,
        fileName: file.name || "image.png"
      });

      if (res && res.ok) {
        closeLensModal();
        toast("Searching with Google Lens…");
        return;
      }
    } catch (err) {
      console.warn("Background lens upload exception:", err);
    }

    // 2. Safe fallback via openExternalTab (uses chrome.tabs.create, immune to active file chooser blocker)
    openExternalTab("https://lens.google.com/");
    closeLensModal();
    toast("Opening Google Lens search…");
  }
}

/* ---------- Focus Accomplishment & History Prompt ------------------------------ */
let activeAccomplishSession = null;

function initFocusAccomplishment() {
  const backdrop = $("#focusAccomplishBackdrop");
  const form = $("#focusAccomplishForm");
  const closeBtn = $("#focusAccomplishClose");
  const skipBtn = $("#focusAccomplishSkip");
  const textInput = $("#focusAccomplishText");
  const catSelector = $("#focusCatSelector");

  if (!backdrop) return;

  catSelector?.addEventListener("click", (e) => {
    const pill = e.target.closest(".cat-pill");
    if (!pill) return;
    $$(".cat-pill", catSelector).forEach((p) => p.classList.remove("on"));
    pill.classList.add("on");
  });

  function closeAccomplishModal() {
    backdrop.hidden = true;
    activeAccomplishSession = null;
  }

  closeBtn?.addEventListener("click", closeAccomplishModal);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeAccomplishModal();
  });

  skipBtn?.addEventListener("click", async () => {
    if (activeAccomplishSession) {
      await saveSessionAccomplishment(activeAccomplishSession, "", getSelectedCat());
    }
    closeAccomplishModal();
    toast("Focus session logged in History!");
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const accomplishment = textInput ? textInput.value.trim() : "";
    const cat = getSelectedCat();
    if (activeAccomplishSession) {
      await saveSessionAccomplishment(activeAccomplishSession, accomplishment, cat);
      toast("Accomplishment saved to Focus History! 🎯");
    }
    closeAccomplishModal();
  });

  function getSelectedCat() {
    const onPill = $(".cat-pill.on", catSelector);
    return onPill ? onPill.dataset.cat : "Study";
  }

  checkPendingBackgroundFocus();
}

function promptFocusAccomplishment(session) {
  const backdrop = $("#focusAccomplishBackdrop");
  const subText = $("#focusAccomplishSub");
  const textInput = $("#focusAccomplishText");
  if (!backdrop) return;

  activeAccomplishSession = session || {
    minutes: 25,
    startTs: Date.now() - 25 * 60000,
    sites: S?.focusPref?.selected || []
  };

  const mins = activeAccomplishSession.minutes || 25;
  if (subText) {
    subText.textContent = `${mins} minute${mins === 1 ? "" : "s"} of distraction-free deep work logged.`;
  }
  if (textInput) {
    textInput.value = "";
  }

  backdrop.hidden = false;
  setTimeout(() => textInput?.focus(), 60);
}

async function saveSessionAccomplishment(session, notes, category) {
  const now = Date.now();
  const d = new Date();
  const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const all = await store.getAll();
  const history = Array.isArray(all.focus_history_v1) ? [...all.focus_history_v1] : [];

  const entry = {
    id: "focus_" + (session.startTs || now),
    timestamp: now,
    date: todayKey,
    durationMinutes: session.minutes || 25,
    accomplishment: notes || "Deep focus session completed",
    category: category || "Study",
    blockedSites: session.sites || []
  };

  const existingIdx = history.findIndex((h) => h.id === entry.id);
  if (existingIdx >= 0) {
    history[existingIdx] = entry;
  } else {
    history.unshift(entry);
  }

  await store.set({ focus_history_v1: history, latest_pending_focus: null });
}

async function checkPendingBackgroundFocus() {
  const all = await store.getAll();
  if (all.latest_pending_focus && all.latest_pending_focus.pendingNote) {
    promptFocusAccomplishment(all.latest_pending_focus);
  }
}

/* ---------- search bar ---------------------------------------------------------- */
function initSearch() {
  $("#searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#searchInput").value.trim();
    if (!q) return;
    const looksUrl =
      /^https?:\/\//i.test(q) ||
      (/^[^\s]+\.[^\s]{2,}(\/.*)?$/.test(q) && !q.includes(" "));
    if (looksUrl) {
      location.href = /^https?:\/\//i.test(q) ? q : "https://" + q;
    } else {
      location.href =
        "https://www.google.com/search?q=" + encodeURIComponent(q);
    }
  });
}

/* ---------- GitHub Auto-Update Checker ------------------------------------------- */
const CURRENT_VERSION = (typeof chrome !== "undefined" && chrome.runtime?.getManifest?.()?.version) || "1.0.3";
const GITHUB_REPO = "Akash7037/Glass-Widget-";
const GITHUB_RAW_MANIFEST = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/manifest.json`;
const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_ZIP_URL = `https://github.com/${GITHUB_REPO}/archive/refs/heads/main.zip`;

function extractVersion(str) {
  if (!str) return null;
  // Match full semver like "1.0.1" or "v1.0.1" first, else simple numbers
  const m = String(str).match(/(\d+(?:\.\d+)+)/) || String(str).match(/(\d+)/);
  return m ? m[1] : null;
}

function parseVersionParts(ver) {
  const clean = extractVersion(ver);
  if (!clean) return [0];
  return clean.split(".").map((n) => parseInt(n, 10) || 0);
}

function isVersionNewer(remote, local) {
  if (!remote || !local) return false;
  const r = parseVersionParts(remote);
  const l = parseVersionParts(local);
  const len = Math.max(r.length, l.length);
  for (let i = 0; i < len; i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

async function fetchRemoteVersion() {
  let releaseCandidate = null;
  let manifestCandidate = null;

  // 1. Fetch GitHub Releases API (latest release title, tag, notes, and direct URL)
  try {
    const relRes = await fetch(GITHUB_RELEASES_API, {
      headers: { Accept: "application/vnd.github.v3+json" }
    });
    if (relRes.ok) {
      const rel = await relRes.json();
      // Look at rel.name first ("v1.0.1"), then rel.tag_name ("Glass-widet-v2")
      const ver = extractVersion(rel.name) || extractVersion(rel.tag_name);
      if (ver) {
        releaseCandidate = {
          version: ver,
          name: rel.name || `v${ver}`,
          tag: rel.tag_name,
          notes: rel.body || "",
          url: rel.html_url || `https://github.com/${GITHUB_REPO}/releases`,
          zipUrl: rel.zipball_url || GITHUB_ZIP_URL,
          source: "release"
        };
      }
    }
  } catch (e) {}

  // 2. Also check raw manifest on GitHub main branch
  try {
    const rawRes = await fetch(`${GITHUB_RAW_MANIFEST}?_=${Date.now()}`, { cache: "no-store" });
    if (rawRes.ok) {
      const data = await rawRes.json();
      const ver = extractVersion(data?.version);
      if (ver) {
        manifestCandidate = {
          version: ver,
          name: `v${ver}`,
          notes: data.description || "",
          url: `https://github.com/${GITHUB_REPO}`,
          zipUrl: GITHUB_ZIP_URL,
          source: "manifest"
        };
      }
    }
  } catch (e) {}

  // Pick whichever version candidate is higher
  if (releaseCandidate && manifestCandidate) {
    if (isVersionNewer(releaseCandidate.version, manifestCandidate.version)) {
      return releaseCandidate;
    }
    return manifestCandidate;
  }

  return releaseCandidate || manifestCandidate || null;
}

function initUpdateChecker() {
  const curVerEl = $("#currentVerLabel");
  const statusLabel = $("#updateStatusLabel");
  const checkBtn = $("#checkUpdatesBtn");
  const drawerDownloadBtn = $("#drawerDownloadUpdateBtn");
  const banner = $("#updateBanner");
  const bannerText = $("#updateBannerText");
  const updateDownloadBtn = $("#updateDownloadBtn");
  const updateHowBtn = $("#updateHowBtn");
  const updateDismissBtn = $("#updateDismissBtn");
  const modalBackdrop = $("#updateModalBackdrop");
  const modalCloseBtn = $("#updateModalCloseBtn");
  const modalSummary = $("#updateModalSummary");
  const modalDownloadBtn = $("#modalDownloadBtn");

  if (curVerEl) curVerEl.textContent = `v${CURRENT_VERSION}`;

  let latestInfo = null;

  const openUpdateModal = (info) => {
    if (modalBackdrop) {
      modalBackdrop.hidden = false;
      const v = info?.version || "new";
      if (modalSummary) {
        modalSummary.textContent = `Liquid Glass v${v} is ready to install! Follow the quick steps below to update:`;
      }
      const notesEl = $("#updateModalNotes");
      if (notesEl) {
        if (info?.notes) {
          notesEl.innerHTML = `<strong>✨ What's New in v${v}:</strong><div style="margin-top:6px;white-space:pre-wrap;opacity:0.92;line-height:1.5;font-size:12.5px;">${info.notes}</div>`;
          notesEl.hidden = false;
        } else {
          notesEl.hidden = true;
        }
      }
      if (modalDownloadBtn) {
        modalDownloadBtn.href = info?.zipUrl || GITHUB_ZIP_URL;
      }
      const releasesBtn = $("#modalReleasesBtn");
      if (releasesBtn && info?.url) {
        releasesBtn.href = info.url;
      }
    }
  };

  const closeUpdateModal = () => {
    if (modalBackdrop) modalBackdrop.hidden = true;
  };

  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeUpdateModal);
  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeUpdateModal();
    });
  }

  const showUpdateBanner = (info) => {
    if (!banner || !bannerText) return;
    const dismissedVer = sessionStorage.getItem("lg_update_dismissed");
    if (dismissedVer === info.version) return;

    bannerText.textContent = `Liquid Glass v${info.version} is available! (Installed: v${CURRENT_VERSION})`;
    banner.hidden = false;
  };

  if (updateDownloadBtn) {
    updateDownloadBtn.addEventListener("click", () => {
      const url = latestInfo?.zipUrl || GITHUB_ZIP_URL;
      openExternalTab(url);
    });
  }

  if (drawerDownloadBtn) {
    drawerDownloadBtn.addEventListener("click", () => {
      const url = latestInfo?.zipUrl || GITHUB_ZIP_URL;
      openExternalTab(url);
    });
  }

  if (updateHowBtn) {
    updateHowBtn.addEventListener("click", () => openUpdateModal(latestInfo));
  }

  if (updateDismissBtn) {
    updateDismissBtn.addEventListener("click", () => {
      if (banner) banner.hidden = true;
      if (latestInfo?.version) {
        sessionStorage.setItem("lg_update_dismissed", latestInfo.version);
      }
    });
  }

  async function checkForUpdates(manual = false) {
    if (statusLabel) statusLabel.textContent = "Checking…";
    if (manual) toast("Checking GitHub for updates…");

    const remote = await fetchRemoteVersion();
    if (!remote || !remote.version) {
      if (statusLabel) statusLabel.textContent = "Could not reach GitHub";
      if (manual) toast("Could not reach GitHub to check updates");
      return;
    }

    latestInfo = remote;
    localStorage.setItem("lg_last_known_ver", remote.version);
    localStorage.setItem("lg_last_update_check", String(Date.now()));
    const hasUpdate = isVersionNewer(remote.version, CURRENT_VERSION);

    if (hasUpdate) {
      if (statusLabel) {
        statusLabel.innerHTML = `<span style="color:#38bdf8;font-weight:600;">Update v${remote.version} available!</span>`;
      }
      if (drawerDownloadBtn) drawerDownloadBtn.hidden = false;
      showUpdateBanner(remote);
      if (manual) {
        openUpdateModal(remote);
        toast(`✨ New update v${remote.version} found!`);
      }
    } else {
      if (statusLabel) statusLabel.textContent = `Up to date (v${CURRENT_VERSION})`;
      if (drawerDownloadBtn) drawerDownloadBtn.hidden = true;
      if (banner) banner.hidden = true;
      if (manual) toast(`Liquid Glass is up to date (v${CURRENT_VERSION})!`);
    }
  }

  if (checkBtn) {
    checkBtn.addEventListener("click", () => {
      checkForUpdates(true);
    });
  }

  // Automatic background update check on load (2s after load)
  setTimeout(() => checkForUpdates(false), 2000);
}

/* ---------- splash boot reveal animation ---------------------------------------- */
function dismissSplash() {
  const curtain = $("#splashCurtain");
  const splashIcon = $("#splashIcon");
  const targetSvg = $("#searchGlassIcon") || $(".search svg");

  if (!curtain) {
    document.body.classList.remove("is-booting");
    return;
  }

  if (splashIcon && targetSvg) {
    const targetRect = targetSvg.getBoundingClientRect();
    const currentRect = splashIcon.getBoundingClientRect();
    const dx = (targetRect.left + targetRect.width / 2) - (currentRect.left + currentRect.width / 2);
    const dy = (targetRect.top + targetRect.height / 2) - (currentRect.top + currentRect.height / 2);

    splashIcon.style.transform = `translate(${dx}px, ${dy}px) scale(0.38)`;
    splashIcon.style.opacity = "0.2";
  } else if (splashIcon) {
    splashIcon.style.transform = "translateY(-35vh) scale(0.45)";
    splashIcon.style.opacity = "0";
  }

  curtain.classList.add("revealing");
  document.body.classList.remove("is-booting");

  setTimeout(() => {
    curtain.classList.add("hidden");
  }, 440);
}

/* ---------- init --------------------------------------------------------------- */
async function init() {
  // Synchronous fast clock paint to eliminate initial time flicker
  tickClock();

  const all = await store.getAll();
  S = { ...JSON.parse(JSON.stringify(DEFAULTS)), ...all };
  for (const k of ["weather", "focusPref", "bg", "liquid", "sizes"])
    S[k] = { ...DEFAULTS[k], ...(all[k] || {}) };
  if (!Array.isArray(S.order) || !S.order.length) S.order = [...DEFAULTS.order];

  // Apply v1.0.3 default profile (blur 11px, opacity 0%, radius 25px, 6th background, -120 deg light angle)
  const v103Applied = localStorage.getItem("lg_v103_preset");
  if (!v103Applied) {
    S.blur = 11;
    S.opacity = 0;
    S.radius = 25;
    S.brightness = 100;
    if (!S.bg || S.bg.value === GRADIENTS[0] || (S.bg.type === "gradient" && S.bg.value.includes("#0b1120"))) {
      S.bg = { type: "image", value: PHOTOS[0] };
    }
    S.liquid = {
      ...S.liquid,
      enabled: true,
      profile: "convex-squircle",
      refractionScale: 5,
      bezel: 11,
      specularOpacity: 0.35,
      specularSaturation: 4,
      lightAngle: -120,
      cursorLight: false
    };
    localStorage.setItem("lg_v103_preset", "true");
    save({ blur: 11, opacity: 0, radius: 25, brightness: 100, bg: S.bg, liquid: S.liquid });
  }

  // Ensure valid fallback values if missing
  if (S.brightness == null) S.brightness = DEFAULTS.brightness;
  if (S.blur == null) S.blur = DEFAULTS.blur;
  if (S.opacity == null) S.opacity = DEFAULTS.opacity;
  if (S.radius == null) S.radius = DEFAULTS.radius;

  applyAppearance();
  applyBackground();
  applyOrder();
  applyVisibility();
  applySizes();
  wireInteractions();

  if (window.LiquidGlass) {
    LiquidGlass.init();
    LiquidGlass.updateSettings(S.liquid);
  }

  tickClock();
  setInterval(tickClock, 1000);

  initClockToggle();
  initNews();
  initWebUsage();
  initNotes();
  initTasks();
  initLinks();
  initFocus();
  initSettings();
  initSearch();
  initGoogleLens();
  initFocusAccomplishment();
  initUpdateChecker();
  wireDragDrop();

  const themeToggleBtn = $("#themeToggleBtn");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", async () => {
      const isOled = S.theme === "oled";
      if (isOled) {
        S.theme = "dark";
        S.radius = 24;
        S.opacity = 14;
        if (S.bg.type === "gradient" && S.bg.value === GRADIENTS[4]) {
          S.bg = { type: "gradient", value: GRADIENTS[0] };
          applyBackground();
        }
        toast("Normal Liquid Glass mode restored");
      } else {
        S.theme = "oled";
        S.radius = 6;
        S.opacity = 8;
        if (S.bg.type === "gradient" && S.bg.value === GRADIENTS[0]) {
          S.bg = { type: "gradient", value: GRADIENTS[4] };
          applyBackground();
        }
        toast("Minimal OLED Dark mode enabled");
      }
      await save({ theme: S.theme, radius: S.radius, opacity: S.opacity, bg: S.bg });
      applyAppearance();
      buildPresets();
    });
  }

  const sessStat = $("#sessionStat");
  if (sessStat) {
    sessStat.textContent = `${S.sessions || 0} focus session${
      (S.sessions || 0) === 1 ? "" : "s"
    }`;
  }

  // Global dynamic light tracking listeners
  window.addEventListener("pointermove", queueDynamicLight, { passive: true });
  window.addEventListener("resize", () => queueDynamicLight());
  window.addEventListener("scroll", () => queueDynamicLight(), { passive: true });

  const lensBtn = $("#lensBtn");
  if (lensBtn) {
    lensBtn.addEventListener("click", () => {
      if (window.LiquidGlass && window.LiquidGlass.togglePrecisionLens) {
        const on = window.LiquidGlass.togglePrecisionLens();
        lensBtn.classList.toggle("on", on);
        toast(on ? "Precision Lens active — drag to bend anything!" : "Precision Lens closed");
      }
    });
  }

  $("#editBtn").addEventListener("click", () => setEditMode(!editMode));
  const tbResetBtn = $("#tbResetLayoutBtn");
  if (tbResetBtn) tbResetBtn.addEventListener("click", executeResetLayout);
  const doneEditBtn = $("#doneEditBtn");
  if (doneEditBtn) doneEditBtn.addEventListener("click", () => setEditMode(false));

  document.addEventListener("keydown", (e) => {
    const typing =
      e.target.matches("input, textarea") || e.target.isContentEditable;
    if (e.key === "Escape") {
      if (!$("#drawer").hidden) $("#drawerClose").click();
      else if (editMode) setEditMode(false);
    }
    if (e.key === "/" && !typing) {
      e.preventDefault();
      $("#searchInput").focus();
    }
    if (e.key.toLowerCase() === "e" && !typing && !e.metaKey && !e.ctrlKey) {
      setEditMode(!editMode);
    }
  });


  // hide buttons
  document.addEventListener("click", async (e) => {
    const b = e.target.closest(".hide-btn");
    if (!b) return;
    const card = b.closest(".card");
    const id = card.dataset.widget;
    const i = S.hidden.indexOf(id);
    if (i >= 0) S.hidden.splice(i, 1);
    else S.hidden.push(id);
    await save({ hidden: S.hidden });
    applyVisibility();
    buildWidgetToggles();
  });

  loadWeather();

  // keep theme in sync with OS when on auto
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (S.theme === "auto") applyAppearance();
  });

  const flushState = () => {
    save({
      brightness: S.brightness,
      blur: S.blur,
      opacity: S.opacity,
      radius: S.radius,
      liquid: S.liquid,
      theme: S.theme,
      accent: S.accent,
      accent2: S.accent2,
      timeFormat: S.timeFormat,
      showSeconds: S.showSeconds,
      name: S.name
    });
  };
  window.addEventListener("pagehide", flushState);
  window.addEventListener("beforeunload", flushState);

  // Smooth reveal sequence: glide splash icon into search bar and unveil dashboard
  requestAnimationFrame(() => {
    setTimeout(dismissSplash, 80);
  });
}

init();

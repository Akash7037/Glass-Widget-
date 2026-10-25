import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import GlassSurface from './GlassSurface';
import './app.css';

const MARGIN = 12;
const MIN_W = 200;
const MIN_H = 60;
const MAX_W = 760;
const MAX_H = 460;
const KEY = 'glass.widgets.v1';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/* Keep a whole box inside the window, respecting the minimum size. */
const clampBox = ({ x, y, w, h }) => {
  const width = clamp(w, MIN_W, Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - MARGIN * 2)));
  const height = clamp(h, MIN_H, Math.min(MAX_H, Math.max(MIN_H, window.innerHeight - MARGIN * 2)));
  return {
    w: width,
    h: height,
    x: clamp(x, MARGIN, Math.max(MARGIN, window.innerWidth - width - MARGIN)),
    y: clamp(y, MARGIN, Math.max(MARGIN, window.innerHeight - height - MARGIN))
  };
};

const defaultBoxes = () => {
  const clock = { w: 320, h: 76, x: 0, y: Math.round(window.innerHeight * 0.3) };
  clock.x = Math.round((window.innerWidth - clock.w) / 2);
  const search = { w: 440, h: 64, x: 0, y: clock.y + clock.h + 26 };
  search.x = Math.round((window.innerWidth - search.w) / 2);
  return { clock: clampBox(clock), search: clampBox(search) };
};

function loadBoxes() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.clock && saved.search) {
        return { clock: clampBox(saved.clock), search: clampBox(saved.search) };
      }
    }
  } catch {
    /* ignore a malformed saved layout */
  }
  return defaultBoxes();
}

/* ---------------------------------------------------------------- clock -- */

function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNow(new Date());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    return () => window.clearTimeout(timer);
  }, []);

  const pad = value => String(value).padStart(2, '0');
  const hours = now.getHours();
  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="clock">
      <div className="clock__row">
        <span className="clock__time">
          {pad(hours)}:{pad(now.getMinutes())}
        </span>
        <span className="clock__meridiem">{hours >= 12 ? 'PM' : 'AM'}</span>
      </div>
      <div className="clock__date">{date}</div>
    </div>
  );
}

/* --------------------------------------------------------------- search -- */

const looksLikeUrl = value => /^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(value.trim());

function SearchBox() {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  /* "/" focuses the field, like every other search bar. */
  useEffect(() => {
    const onKey = event => {
      if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'Escape') inputRef.current?.blur();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = event => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    const target = looksLikeUrl(value)
      ? `https://${value}`
      : `https://www.google.com/search?q=${encodeURIComponent(value)}`;
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  return (
    <form className="search" onSubmit={submit} role="search">
      <svg className="search__icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7.5" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        className="search__input"
        type="search"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Search the web"
        aria-label="Search the web"
        autoComplete="off"
        spellCheck="false"
      />
      <button className="search__go" type="submit" aria-label="Search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <line x1="4" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    </form>
  );
}

/* ------------------------------------------------------------- version -- */

const APP_VERSION = 'v2.0.1';
const RELEASES_URL = 'https://github.com/Akash7037/Glass-Widget-/releases';
const LATEST_RELEASE_URL = 'https://api.github.com/repos/Akash7037/Glass-Widget-/releases/latest';
const VERSION_KEY = 'glass.version-check';
const DAY = 24 * 60 * 60 * 1000;

const numbers = tag => {
  const parts = String(tag).match(/\d+/g);
  /* Only full x.y.z tags are comparable — legacy tags like `glass-w-3` are not. */
  return parts && parts.length >= 3 ? parts.slice(0, 3).map(Number) : null;
};

/* Is the released tag ahead of the running version? (v2.0.2 > v2.0.1) */
const isNewer = (tag, current) => {
  const a = numbers(tag);
  const b = numbers(current);
  if (!a || !b) return false;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff) return diff > 0;
  }
  return false;
};

function VersionBadge() {
  const [state, setState] = useState('idle'); // idle | checking | current | update | error
  const [latest, setLatest] = useState('');

  const check = async showSpinner => {
    if (showSpinner) setState('checking');
    try {
      const response = await fetch(LATEST_RELEASE_URL, {
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!response.ok) throw new Error(String(response.status));
      const release = await response.json();
      const tag = release.tag_name || '';
      setLatest(tag);
      setState(isNewer(tag, APP_VERSION) ? 'update' : 'current');
      try {
        localStorage.setItem(VERSION_KEY, JSON.stringify({ tag, at: Date.now() }));
      } catch {
        /* storage may be unavailable */
      }
    } catch {
      setState('error');
    }
  };

  /* On load: trust a day-old answer, otherwise ask GitHub once. */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(VERSION_KEY) || 'null');
      if (saved && Date.now() - saved.at < DAY) {
        setLatest(saved.tag || '');
        setState(isNewer(saved.tag, APP_VERSION) ? 'update' : 'current');
        return;
      }
    } catch {
      /* ignore a malformed cache */
    }
    check(false);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  if (state === 'update') {
    return (
      <a
        className="version version--update"
        href={RELEASES_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={`${latest} is out on GitHub Releases — click to open`}
      >
        {latest} available ↗
      </a>
    );
  }

  const label = {
    idle: APP_VERSION,
    checking: 'checking…',
    current: `${APP_VERSION} ✓`,
    error: `${APP_VERSION} · retry`
  }[state];

  return (
    <button
      className={`version${state === 'error' ? ' version--error' : ''}`}
      type="button"
      onClick={() => check(true)}
      title={`Running ${APP_VERSION} — check GitHub Releases for updates`}
      aria-label={`Version ${APP_VERSION}. Check GitHub Releases for updates`}
    >
      {label}
    </button>
  );
}

/* -------------------------------------------------------------- widget --- */

function GlassWidget({ label, box, setBox, editing, toggleEditing, children }) {
  const [mode, setMode] = useState(null); // 'drag' | 'resize' | null
  const origin = useRef(null);

  const begin = (event, nextMode) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    /* Buttons keep their own behaviour — the pencil, the submit arrow. */
    if (event.target.closest?.('button, a')) return;
    event.stopPropagation();

    const editable = event.target.closest?.('input, textarea, [contenteditable]');
    /* A plain click on the search field must still place the caret. */
    if (!editable) event.preventDefault();

    origin.current = {
      px: event.clientX,
      py: event.clientY,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      moved: false,
      field: event.target.tagName === 'INPUT' ? event.target : null
    };
    setMode(nextMode);

    /* Window listeners: a fast drag that leaves the widget keeps tracking. */
    const onMove = moveEvent => {
      const start = origin.current;
      if (!start) return;
      const dx = moveEvent.clientX - start.px;
      const dy = moveEvent.clientY - start.py;

      if (nextMode === 'resize') {
        setBox(prev => clampBox({ ...prev, w: start.w + dx, h: start.h + dy }));
        return;
      }

      if (!start.moved) {
        if (Math.hypot(dx, dy) < 4) return; /* below the threshold it is a click */
        start.moved = true;
        /* Drop the text selection the drag would otherwise have started. */
        try {
          start.field?.setSelectionRange(start.field.value.length, start.field.value.length);
        } catch {
          /* not every input type exposes a caret */
        }
      }
      setBox(prev => clampBox({ ...prev, x: start.x + dx, y: start.y + dy }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      origin.current = null;
      setMode(null);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  /* Keyboard: arrows nudge the widget; with the grip focused they resize it. */
  const onKeyDown = event => {
    /* Never steal keys from the search field. */
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target.isContentEditable) return;
    const step = event.shiftKey ? 4 : 12;
    const map = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step]
    };
    const delta = map[event.key];
    if (!delta) return;
    event.preventDefault();
    const resizing = event.target.classList?.contains('resize-handle');
    if (resizing) {
      setBox(prev => clampBox({ ...prev, w: prev.w + delta[0], h: prev.h + delta[1] }));
    } else {
      setBox(prev => clampBox({ ...prev, x: prev.x + delta[0], y: prev.y + delta[1] }));
    }
  };

  const radius = Math.min(38, Math.round(box.h / 2));

  return (
    <div
      className={[
        'widget',
        mode === 'drag' ? 'is-dragging' : '',
        mode === 'resize' ? 'is-resizing' : '',
        editing ? 'is-editing' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.w}px`,
        height: `${box.h}px`,
        borderRadius: `${radius}px`,
        '--widget-h': `${box.h}px`
      }}
      onPointerDown={event => {
        if (event.target.closest('.resize-handle, button, a')) return;
        begin(event, 'drag');
      }}
      onKeyDown={onKeyDown}
      role="group"
      tabIndex={0}
      aria-label={`${label} widget. Arrow keys to move${editing ? ', grip or shift-arrow to resize' : ''}.`}
    >
      <button
        className={`edit-btn${editing ? ' on' : ''}`}
        type="button"
        aria-pressed={editing}
        aria-label={editing ? 'Done editing widgets' : 'Edit widgets'}
        title={editing ? 'Done editing' : 'Edit widgets'}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => {
          event.stopPropagation();
          toggleEditing();
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </button>

      <GlassSurface width="100%" height="100%" borderRadius={radius} distortionScale={-180} displace={0.5} backgroundOpacity={0.1}>
        {children}
      </GlassSurface>

      {editing && (
        <div
          className="resize-handle"
          role="button"
          aria-label={`Resize ${label} with the arrow keys`}
          tabIndex={0}
          onPointerDown={event => begin(event, 'resize')}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ app -- */

function App() {
  const [boxes, setBoxes] = useState(loadBoxes);
  /* One pencil arms every widget: grips appear on all of them at once. */
  const [editing, setEditing] = useState(false);

  /* Persist every change; clamp everything when the window changes shape. */
  const commit = next => {
    setBoxes(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable */
    }
  };

  useEffect(() => {
    const onResize = () =>
      commit({
        clock: clampBox(boxes.clock),
        search: clampBox(boxes.search)
      });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [boxes]);

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'Escape') setEditing(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setBox = id => updater =>
    setBoxes(current => {
      const prev = current[id];
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const merged = { ...current, [id]: next };
      try {
        localStorage.setItem(KEY, JSON.stringify(merged));
      } catch {
        /* storage may be unavailable */
      }
      return merged;
    });
  const toggleEditing = () => setEditing(current => !current);

  return (
    <div className="stage">
      <GlassWidget
        label="Clock"
        box={boxes.clock}
        setBox={setBox('clock')}
        editing={editing}
        toggleEditing={toggleEditing}
      >
        <Clock />
      </GlassWidget>

      <GlassWidget
        label="Search"
        box={boxes.search}
        setBox={setBox('search')}
        editing={editing}
        toggleEditing={toggleEditing}
      >
        <SearchBox />
      </GlassWidget>

      <VersionBadge />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);

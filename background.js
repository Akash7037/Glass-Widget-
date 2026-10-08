/**
 * Liquid Glass — background service worker.
 *
 * Keeps the focus (Pomodoro) blocker honest even when the new tab page is
 * closed: it applies declarativeNetRequest dynamic rules when a session starts,
 * schedules an alarm for the end of the session and tears everything down when
 * the alarm fires or the browser restarts.
 */

const RULE_ID_START = 1000;
const RULE_ID_END = 1999; // reserved range for focus blocks
const ALARM_END = 'focus:end';
const STORAGE_KEY = 'focus';

/** @returns {Promise<{sites:string[], minutes:number, startTs:number, endTs:number}|null>} */
async function getFocus() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const focus = data[STORAGE_KEY];
  if (!focus || !Array.isArray(focus.sites) || !focus.endTs) return null;
  return focus;
}

/** Build DNR rules, one per blocked host. */
function buildRules(sites) {
  return sites.slice(0, RULE_ID_END - RULE_ID_START + 1).map((host, i) => ({
    id: RULE_ID_START + i,
    priority: 100,
    action: {
      type: 'redirect',
      redirect: {
        extensionPath: '/blocked.html?site=' + encodeURIComponent(host)
      }
    },
    condition: {
      urlFilter: '||' + host + '^',
      resourceTypes: ['main_frame']
    }
  }));
}

/**
 * Make the stored focus state true: either install rules + alarm (still
 * running) or remove everything (expired / stopped).
 */
async function syncFocus() {
  const focus = await getFocus();
  const active = focus && focus.endTs > Date.now() ? focus : null;

  // If session expired and was not yet recorded, record it to history
  if (focus && focus.endTs <= Date.now() && !focus.recorded) {
    try {
      const histData = await chrome.storage.local.get(['focus_history_v1', 'sessions']);
      const history = histData.focus_history_v1 || [];
      const entryId = 'focus_' + focus.startTs;
      if (!history.some((h) => h.id === entryId)) {
        const entry = {
          id: entryId,
          timestamp: focus.endTs,
          date: getTodayKey(),
          durationMinutes: focus.minutes || 25,
          accomplishment: '',
          category: 'Study',
          blockedSites: focus.sites || [],
          pendingNote: true
        };
        history.unshift(entry);
        const sessions = (histData.sessions || 0) + 1;
        await chrome.storage.local.set({
          focus_history_v1: history,
          sessions,
          latest_pending_focus: entry
        });
      }
    } catch (e) {
      console.warn('Failed to record completed focus session in background:', e);
    }
  }

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing
    .filter((r) => r.id >= RULE_ID_START && r.id <= RULE_ID_END)
    .map((r) => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: active ? buildRules(active.sites) : []
  });

  await chrome.alarms.clear(ALARM_END);
  if (active) {
    chrome.alarms.create(ALARM_END, { when: active.endTs });
  }

  // Persist the cleaned-up state (null once expired).
  await chrome.storage.local.set({ [STORAGE_KEY]: active });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'focus:start') {
    const focus = {
      sites: msg.sites,
      minutes: msg.minutes,
      startTs: Date.now(),
      endTs: Date.now() + msg.minutes * 60000
    };
    chrome.storage.local
      .set({ [STORAGE_KEY]: focus })
      .then(syncFocus)
      .then(() => sendResponse({ ok: true, focus }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // async response
  }

  if (msg && msg.type === 'focus:stop') {
    chrome.storage.local
      .set({ [STORAGE_KEY]: null })
      .then(syncFocus)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (msg && msg.type === 'focus:status') {
    getFocus()
      .then((focus) => sendResponse({ ok: true, focus }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_END) syncFocus();
});

// Re-assert (or clean up) blocking rules on install / browser start-up.
chrome.runtime.onInstalled.addListener(syncFocus);
chrome.runtime.onStartup.addListener(syncFocus);

/* ---------- Web Usage & Screen Time Tracking ------------------------------ */
const WEB_USAGE_KEY = 'web_usage_v1';
let currentTabHost = null;
let currentTabStart = Date.now();

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isIgnoredHost(host) {
  if (!host) return true;
  host = host.toLowerCase().replace(/^www\./, '');
  // Ignore Google search & home portal (e.g. google.com, google.co.in, google.ca, etc.)
  // while preserving specific subdomains like scholar.google.com, docs.google.com
  if (host === 'google.com' || /^google\.[a-z]{2,}(\.[a-z]{2})?$/.test(host)) return true;
  // Ignore local & internal extension/browser tabs
  if (host === 'localhost' || host === '127.0.0.1' || host.includes('newtab') || host.endsWith('.local')) return true;
  return false;
}

function extractHost(url) {
  try {
    if (!url || !url.startsWith('http')) return null;
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (isIgnoredHost(host)) return null;
    return host;
  } catch (e) {
    return null;
  }
}

async function recordCurrentTime() {
  if (!currentTabHost) return;
  const now = Date.now();
  const elapsedSec = Math.round((now - currentTabStart) / 1000);
  currentTabStart = now;
  if (elapsedSec <= 0 || elapsedSec > 86400) return;

  const host = currentTabHost;
  const today = getTodayKey();

  try {
    const data = await chrome.storage.local.get(WEB_USAGE_KEY);
    const store = data[WEB_USAGE_KEY] || {};

    // Maintain multi-day history
    if (!store.byDate || typeof store.byDate !== 'object') {
      store.byDate = {};
      // Migrate legacy single-day store if present
      if (store.date && store.domains) {
        store.byDate[store.date] = {
          totalSeconds: store.totalSeconds || 0,
          domains: { ...store.domains }
        };
      }
    }

    if (!store.byDate[today]) {
      store.byDate[today] = { totalSeconds: 0, domains: {} };
    }

    store.byDate[today].totalSeconds = (store.byDate[today].totalSeconds || 0) + elapsedSec;
    store.byDate[today].domains[host] = (store.byDate[today].domains[host] || 0) + elapsedSec;

    // Maintain overall all-time aggregates
    if (!store.domains) store.domains = {};
    store.totalSeconds = (store.totalSeconds || 0) + elapsedSec;
    store.domains[host] = (store.domains[host] || 0) + elapsedSec;
    store.date = today;

    await chrome.storage.local.set({ [WEB_USAGE_KEY]: store });
  } catch (e) {
    // Storage access error or extension reload
  }
}

function onActiveTabChanged(tabId) {
  if (!chrome.tabs) return;
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;
    recordCurrentTime().then(() => {
      currentTabHost = extractHost(tab.url);
      currentTabStart = Date.now();
    });
  });
}

if (chrome.tabs) {
  chrome.tabs.onActivated.addListener((info) => {
    onActiveTabChanged(info.tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
      if (tab && tab.active) {
        recordCurrentTime().then(() => {
          currentTabHost = extractHost(tab.url);
          currentTabStart = Date.now();
        });
      }
    }
  });
}

if (chrome.windows) {
  chrome.windows.onFocusChanged.addListener((winId) => {
    if (winId === chrome.windows.WINDOW_ID_NONE) {
      recordCurrentTime();
      currentTabHost = null;
    } else if (chrome.tabs) {
      chrome.tabs.query({ active: true, windowId: winId }, (tabs) => {
        if (tabs && tabs[0]) {
          recordCurrentTime().then(() => {
            currentTabHost = extractHost(tabs[0].url);
            currentTabStart = Date.now();
          });
        }
      });
    }
  });
}

// Periodically flush tracked seconds every 15 seconds
setInterval(recordCurrentTime, 15000);

// Extend message handler for web:usage, lens:upload, focus:update_note
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'web:usage') {
    (async () => {
      await recordCurrentTime();
      const today = getTodayKey();
      const data = await chrome.storage.local.get(WEB_USAGE_KEY);
      let store = data[WEB_USAGE_KEY] || { date: today, totalSeconds: 0, domains: {}, byDate: {} };
      const range = msg.range || 'today'; // 'today', '7d', 'all'

      // Auto-prune any historical google.com or search portal records from store
      let pruned = false;
      if (store.domains) {
        for (const h of Object.keys(store.domains)) {
          if (isIgnoredHost(h)) {
            const sec = store.domains[h] || 0;
            store.totalSeconds = Math.max(0, (store.totalSeconds || 0) - sec);
            delete store.domains[h];
            pruned = true;
          }
        }
      }
      if (store.byDate && typeof store.byDate === 'object') {
        for (const dayEntry of Object.values(store.byDate)) {
          if (dayEntry && dayEntry.domains) {
            for (const h of Object.keys(dayEntry.domains)) {
              if (isIgnoredHost(h)) {
                const sec = dayEntry.domains[h] || 0;
                dayEntry.totalSeconds = Math.max(0, (dayEntry.totalSeconds || 0) - sec);
                delete dayEntry.domains[h];
                pruned = true;
              }
            }
          }
        }
      }
      if (pruned) {
        chrome.storage.local.set({ [WEB_USAGE_KEY]: store }).catch(() => {});
      }

      let activeDomains = {};

      if (range === 'today') {
        const todayData = (store.byDate && store.byDate[today]) || { totalSeconds: 0, domains: {} };
        activeDomains = todayData.domains || store.domains || {};
      } else if (range === '7d') {
        // Aggregate last 7 days
        const dates = [];
        const d = new Date();
        for (let i = 0; i < 7; i++) {
          const cur = new Date(d);
          cur.setDate(d.getDate() - i);
          const k = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
          dates.push(k);
        }
        for (const dateKey of dates) {
          const dayEntry = store.byDate && store.byDate[dateKey];
          if (dayEntry) {
            for (const [h, s] of Object.entries(dayEntry.domains || {})) {
              activeDomains[h] = (activeDomains[h] || 0) + s;
            }
          }
        }
      } else {
        // All-time
        activeDomains = store.domains || {};
      }

      // Convert domains to sorted list (filtering out any ignored hosts)
      const domainEntries = Object.entries(activeDomains)
        .filter(([host]) => !isIgnoredHost(host))
        .map(([host, sec]) => ({
          host,
          seconds: sec
        }))
        .sort((a, b) => b.seconds - a.seconds);

      // Clean total seconds matching the active unignored domains
      const totalSeconds = domainEntries.reduce((acc, cur) => acc + (cur.seconds || 0), 0);

      // Top 5 sites
      let top5 = domainEntries.slice(0, 5);

      // Augment with chrome.topSites if less than 5 domains and requested
      if (top5.length < 5 && chrome.topSites && chrome.topSites.get) {
        try {
          const topChromeSites = await new Promise((res) => chrome.topSites.get(res));
          if (Array.isArray(topChromeSites)) {
            const existingHosts = new Set(top5.map((s) => s.host));
            for (const item of topChromeSites) {
              const h = extractHost(item.url);
              if (h && !isIgnoredHost(h) && !existingHosts.has(h)) {
                existingHosts.add(h);
                top5.push({ host: h, seconds: 0, fromTopSites: true, title: item.title || h });
                if (top5.length >= 5) break;
              }
            }
          }
        } catch (e) {}
      }

      sendResponse({
        ok: true,
        range,
        totalSeconds,
        domains: domainEntries,
        topSites: top5,
        byDate: store.byDate || {}
      });
    })();
    return true; // async response
  }

  // Google Lens image file upload endpoint handler
  if (msg && msg.type === 'lens:upload') {
    (async () => {
      try {
        const byteCharacters = atob(msg.base64Data);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteNumbers], { type: msg.mimeType || 'image/png' });
        const fd = new FormData();
        fd.append('encoded_image', blob, msg.fileName || 'image.png');

        const res = await fetch('https://lens.google.com/v3/upload', {
          method: 'POST',
          body: fd,
          redirect: 'follow'
        });

        const destUrl = res.url && res.url.includes('lens.google.com') ? res.url : 'https://lens.google.com/';
        const tab = await chrome.tabs.create({ url: destUrl });
        sendResponse({ ok: true, url: destUrl, tabId: tab.id });
      } catch (err) {
        // Safe fallback to Lens homepage via chrome.tabs.create (immune to file chooser blocker)
        try {
          const tab = await chrome.tabs.create({ url: 'https://lens.google.com/' });
          sendResponse({ ok: true, url: 'https://lens.google.com/', tabId: tab.id });
        } catch (tabErr) {
          sendResponse({ ok: false, error: String(tabErr) });
        }
      }
    })();
    return true; // async response
  }

  // Safe tab creation message handler
  if (msg && msg.type === 'tabs:create') {
    if (msg.url) {
      chrome.tabs.create({ url: msg.url })
        .then((tab) => sendResponse({ ok: true, tabId: tab.id }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }
  }

  // Focus note update handler
  if (msg && msg.type === 'focus:update_note') {
    (async () => {
      try {
        const data = await chrome.storage.local.get(['focus_history_v1', 'latest_pending_focus']);
        let history = data.focus_history_v1 || [];
        if (msg.id) {
          const idx = history.findIndex((h) => h.id === msg.id);
          if (idx >= 0) {
            history[idx] = {
              ...history[idx],
              accomplishment: msg.accomplishment,
              category: msg.category || history[idx].category,
              pendingNote: false
            };
          }
        } else if (history.length > 0) {
          history[0] = {
            ...history[0],
            accomplishment: msg.accomplishment,
            category: msg.category || history[0].category,
            pendingNote: false
          };
        }
        await chrome.storage.local.set({ focus_history_v1: history, latest_pending_focus: null });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // async response
  }
});

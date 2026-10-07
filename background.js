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

function extractHost(url) {
  try {
    if (!url || !url.startsWith('http')) return null;
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (!host || host.includes('newtab') || host.includes('localhost') || host === '127.0.0.1') return null;
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
    if (store.date !== today) {
      store.date = today;
      store.totalSeconds = 0;
      store.domains = {};
    }
    store.totalSeconds = (store.totalSeconds || 0) + elapsedSec;
    store.domains[host] = (store.domains[host] || 0) + elapsedSec;

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

// Extend message handler for web:usage
const originalListener = chrome.runtime.onMessage.hasListeners();
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'web:usage') {
    (async () => {
      await recordCurrentTime();
      const today = getTodayKey();
      const data = await chrome.storage.local.get(WEB_USAGE_KEY);
      const store = data[WEB_USAGE_KEY] || { date: today, totalSeconds: 0, domains: {} };
      if (store.date !== today) {
        store.totalSeconds = 0;
        store.domains = {};
      }

      // Convert domains to sorted list
      const domainEntries = Object.entries(store.domains || {}).map(([host, sec]) => ({
        host,
        seconds: sec
      })).sort((a, b) => b.seconds - a.seconds);

      // Top 5 sites
      let top5 = domainEntries.slice(0, 5);

      // If less than 5 domains recorded, augment with chrome.topSites if available
      if (top5.length < 5 && chrome.topSites && chrome.topSites.get) {
        try {
          const topChromeSites = await new Promise((res) => chrome.topSites.get(res));
          if (Array.isArray(topChromeSites)) {
            const existingHosts = new Set(top5.map((s) => s.host));
            for (const item of topChromeSites) {
              const h = extractHost(item.url);
              if (h && !existingHosts.has(h)) {
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
        totalSeconds: store.totalSeconds || 0,
        topSites: top5
      });
    })();
    return true; // async response
  }
});

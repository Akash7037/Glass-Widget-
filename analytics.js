/* =========================================================================
   Analytics & Focus — Logic Engine
   Minimalist, high-density, no emojis, clean monochrome & refined category accents
   ========================================================================= */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const hasExt = typeof chrome !== "undefined" && !!(chrome.storage && chrome.storage.local);

/* ---------- Refined Category Taxonomy (Zero Emojis) ---------------------- */
const CATEGORIES = {
  study: { id: "study", name: "Study", color: "#10b981" },
  research: { id: "research", name: "Research", color: "#38bdf8" },
  coding: { id: "coding", name: "Engineering", color: "#818cf8" },
  productivity: { id: "productivity", name: "Productivity", color: "#60a5fa" },
  entertainment: { id: "entertainment", name: "Media", color: "#f59e0b" },
  social: { id: "social", name: "Social", color: "#f87171" },
  news: { id: "news", name: "News", color: "#c084fc" },
  other: { id: "other", name: "Other", color: "#737373" }
};

const KNOWN_DOMAINS = {
  // Study
  "coursera.org": "study",
  "edx.org": "study",
  "khanacademy.org": "study",
  "udemy.com": "study",
  "leetcode.com": "study",
  "hackerrank.com": "study",
  "quizlet.com": "study",
  "duolingo.com": "study",
  "wikipedia.org": "study",
  "w3schools.com": "study",
  "geeksforgeeks.org": "study",
  "freecodecamp.org": "study",
  "codecademy.com": "study",
  "canvas.net": "study",
  "instructure.com": "study",
  "blackboard.com": "study",
  "chegg.com": "study",
  "brainly.com": "study",
  "study.com": "study",
  "brilliant.org": "study",
  "datacamp.com": "study",
  "kaggle.com": "study",
  "mit.edu": "study",
  "stanford.edu": "study",
  "harvard.edu": "study",

  // Research
  "arxiv.org": "research",
  "scholar.google.com": "research",
  "researchgate.net": "research",
  "sciencedirect.com": "research",
  "nature.com": "research",
  "springer.com": "research",
  "ieee.org": "research",
  "pubmed.ncbi.nlm.nih.gov": "research",
  "ncbi.nlm.nih.gov": "research",
  "jstor.org": "research",
  "semanticscholar.org": "research",
  "biorxiv.org": "research",
  "medrxiv.org": "research",
  "ssrn.com": "research",
  "acm.org": "research",
  "huggingface.co": "research",
  "paperswithcode.com": "research",
  "medium.com": "research",
  "substack.com": "research",
  "dev.to": "research",

  // Engineering
  "github.com": "coding",
  "gitlab.com": "coding",
  "bitbucket.org": "coding",
  "stackoverflow.com": "coding",
  "stackexchange.com": "coding",
  "npmjs.com": "coding",
  "developer.mozilla.org": "coding",
  "docs.python.org": "coding",
  "codepen.io": "coding",
  "replit.com": "coding",
  "vercel.com": "coding",
  "netlify.com": "coding",
  "aws.amazon.com": "coding",
  "azure.com": "coding",
  "docker.com": "coding",
  "kubernetes.io": "coding",
  "rust-lang.org": "coding",
  "golang.org": "coding",
  "pypi.org": "coding",
  "crates.io": "coding",

  // Media
  "youtube.com": "entertainment",
  "netflix.com": "entertainment",
  "twitch.tv": "entertainment",
  "spotify.com": "entertainment",
  "soundcloud.com": "entertainment",
  "disneyplus.com": "entertainment",
  "hulu.com": "entertainment",
  "primevideo.com": "entertainment",
  "crunchyroll.com": "entertainment",
  "tiktok.com": "entertainment",
  "vimeo.com": "entertainment",
  "steampowered.com": "entertainment",

  // Social
  "x.com": "social",
  "twitter.com": "social",
  "reddit.com": "social",
  "instagram.com": "social",
  "facebook.com": "social",
  "linkedin.com": "social",
  "discord.com": "social",
  "telegram.org": "social",
  "whatsapp.com": "social",
  "threads.net": "social",

  // Productivity
  "notion.so": "productivity",
  "docs.google.com": "productivity",
  "drive.google.com": "productivity",
  "sheets.google.com": "productivity",
  "mail.google.com": "productivity",
  "gmail.com": "productivity",
  "figma.com": "productivity",
  "trello.com": "productivity",
  "linear.app": "productivity",
  "asana.com": "productivity",
  "slack.com": "productivity",
  "chatgpt.com": "productivity",
  "openai.com": "productivity",
  "claude.ai": "productivity",
  "perplexity.ai": "productivity",
  "overleaf.com": "productivity",

  // News
  "news.ycombinator.com": "news",
  "nytimes.com": "news",
  "bbc.com": "news",
  "theverge.com": "news",
  "techcrunch.com": "news",
  "wired.com": "news",
  "reuters.com": "news",
  "bloomberg.com": "news"
};

/* ---------- State --------------------------------------------------------- */
let currentRange = "today";
let customCategories = {};
let webUsageData = { totalSeconds: 0, domains: [] };
let focusHistoryData = [];
let siteSearchQuery = "";
let siteCategoryFilter = "all";
let historySearchQuery = "";
let historyCategoryFilter = "all";

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Fallback preview data
const MOCK_WEB_USAGE = {
  totalSeconds: 14800,
  domains: [
    { host: "github.com", seconds: 4200 },
    { host: "leetcode.com", seconds: 3600 },
    { host: "arxiv.org", seconds: 2800 },
    { host: "youtube.com", seconds: 1900 },
    { host: "notion.so", seconds: 1400 },
    { host: "stackoverflow.com", seconds: 900 }
  ]
};

const MOCK_FOCUS_HISTORY = [
  {
    id: "f_1",
    timestamp: Date.now() - 3600000,
    date: getTodayKey(),
    durationMinutes: 50,
    accomplishment: "Solved 3 dynamic programming problems on LeetCode; derived interval schedule recurrence.",
    category: "Study",
    blockedSites: ["youtube.com", "reddit.com"]
  },
  {
    id: "f_2",
    timestamp: Date.now() - 14400000,
    date: getTodayKey(),
    durationMinutes: 25,
    accomplishment: "Surveyed speculative decoding architectures on arXiv and summarized speedup metrics.",
    category: "Research",
    blockedSites: ["youtube.com", "x.com"]
  }
];

/* ---------- Categorizer --------------------------------------------------- */
function categorizeDomain(host) {
  if (!host) return "other";
  host = host.toLowerCase().replace(/^www\./, "");

  if (customCategories[host]) return customCategories[host];
  if (KNOWN_DOMAINS[host]) return KNOWN_DOMAINS[host];

  for (const [known, cat] of Object.entries(KNOWN_DOMAINS)) {
    if (host.endsWith("." + known)) return cat;
  }

  if (host.endsWith(".edu") || host.includes("learn") || host.includes("study") || host.includes("quiz") || host.includes("tutorial")) {
    return "study";
  }
  if (host.includes("scholar") || host.includes("research") || host.includes("paper") || host.includes("arxiv") || host.includes("science")) {
    return "research";
  }
  if (host.includes("github") || host.includes("git") || host.includes("code") || host.includes("dev") || host.includes("docs")) {
    return "coding";
  }
  if (host.includes("tube") || host.includes("stream") || host.includes("video") || host.includes("music") || host.includes("game")) {
    return "entertainment";
  }
  if (host.includes("social") || host.includes("chat") || host.includes("community")) {
    return "social";
  }
  if (host.includes("news") || host.includes("times") || host.includes("daily") || host.includes("post")) {
    return "news";
  }
  if (host.includes("mail") || host.includes("doc") || host.includes("sheet") || host.includes("task") || host.includes("note")) {
    return "productivity";
  }

  return "other";
}

/* ---------- Time Formatters ----------------------------------------------- */
function formatDuration(totalSec) {
  if (!totalSec || totalSec <= 0) return "0m";
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds > 0 ? seconds + "s" : ""}`;
  return `${seconds}s`;
}

function formatMinutes(min) {
  if (!min || min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m > 0 ? m + "m" : ""}`;
  return `${m}m`;
}

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

/* ---------- Load Data ------------------------------------------------------ */
async function loadData() {
  if (hasExt) {
    try {
      const stored = await new Promise((res) => chrome.storage.local.get(null, res));
      customCategories = stored.custom_site_categories || {};
      focusHistoryData = stored.focus_history_v1 || [];

      const resp = await new Promise((res) => {
        chrome.runtime.sendMessage({ type: "web:usage", range: currentRange }, (r) => {
          if (chrome.runtime.lastError || !r) res(null);
          else res(r);
        });
      });

      if (resp && resp.ok) {
        webUsageData = {
          totalSeconds: resp.totalSeconds || 0,
          domains: resp.domains || []
        };
      } else {
        const store = stored.web_usage_v1 || {};
        const domainEntries = Object.entries(store.domains || {}).map(([host, seconds]) => ({
          host,
          seconds
        })).sort((a, b) => b.seconds - a.seconds);
        webUsageData = {
          totalSeconds: store.totalSeconds || 0,
          domains: domainEntries
        };
      }
    } catch (e) {
      webUsageData = MOCK_WEB_USAGE;
      focusHistoryData = MOCK_FOCUS_HISTORY;
    }
  } else {
    webUsageData = MOCK_WEB_USAGE;
    focusHistoryData = MOCK_FOCUS_HISTORY;
  }

  renderAll();
}

function renderAll() {
  renderKpis();
  renderDonut();
  renderBars();
  renderSitesTable();
  renderHistory();
}

/* ---------- 1. KPIs ------------------------------------------------------- */
function renderKpis() {
  $("#kpiScreenTime").textContent = formatDuration(webUsageData.totalSeconds);
  const rangeLabels = { today: "Active today", "7d": "Last 7 days total", all: "All-time recorded" };
  $("#kpiScreenTimeMeta").textContent = rangeLabels[currentRange] || "Active screen time";

  const totalFocusMin = focusHistoryData.reduce((acc, c) => acc + (c.durationMinutes || 0), 0);
  $("#kpiFocusTime").textContent = formatMinutes(totalFocusMin);
  $("#kpiFocusSessionsMeta").textContent = `${focusHistoryData.length} session${focusHistoryData.length === 1 ? "" : "s"} logged`;
  $("#focusCountBadge").textContent = focusHistoryData.length;

  // Productive Ratio (Study + Research + Engineering)
  const catSecs = {};
  for (const d of webUsageData.domains) {
    const cat = categorizeDomain(d.host);
    catSecs[cat] = (catSecs[cat] || 0) + d.seconds;
  }

  const productiveSec = (catSecs.study || 0) + (catSecs.research || 0) + (catSecs.coding || 0);
  const prodRatio = webUsageData.totalSeconds > 0 ? Math.round((productiveSec / webUsageData.totalSeconds) * 100) : 0;
  $("#kpiProductiveRatio").textContent = `${prodRatio}%`;

  // Top Category
  let topCat = "study";
  let maxSec = -1;
  for (const [cat, sec] of Object.entries(catSecs)) {
    if (sec > maxSec) {
      maxSec = sec;
      topCat = cat;
    }
  }

  const topObj = CATEGORIES[topCat] || CATEGORIES.study;
  $("#kpiTopCatName").textContent = topObj.name;
  $("#kpiTopCatName").style.color = topObj.color;
  const pct = webUsageData.totalSeconds > 0 ? Math.round((maxSec / webUsageData.totalSeconds) * 100) : 0;
  $("#kpiTopCatMeta").textContent = `${pct}% of active time`;
}

/* ---------- 2. Donut Chart ------------------------------------------------ */
function renderDonut() {
  const svg = $("#donutSvg");
  const legend = $("#donutLegend");
  svg.innerHTML = "";
  legend.innerHTML = "";

  const totalSec = webUsageData.totalSeconds || 1;
  const catSums = {};
  for (const k of Object.keys(CATEGORIES)) catSums[k] = 0;

  for (const item of webUsageData.domains) {
    const cat = categorizeDomain(item.host);
    catSums[cat] = (catSums[cat] || 0) + item.seconds;
  }

  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  let accumulatedAngle = 0;

  const sortedCats = Object.entries(catSums)
    .filter(([_, sec]) => sec > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!sortedCats.length) {
    const placeholder = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    placeholder.setAttribute("cx", "110");
    placeholder.setAttribute("cy", "110");
    placeholder.setAttribute("r", radius);
    placeholder.setAttribute("class", "donut-segment");
    placeholder.setAttribute("stroke", "var(--border)");
    placeholder.setAttribute("stroke-dasharray", `${circumference} ${circumference}`);
    placeholder.setAttribute("stroke-dashoffset", "0");
    svg.appendChild(placeholder);

    $("#donutCenterLabel").textContent = "Total";
    $("#donutCenterVal").textContent = "0m";
    legend.innerHTML = `<span style="font-size:0.75rem; color:var(--text-faint)">No domain visits recorded</span>`;
    return;
  }

  $("#donutCenterLabel").textContent = "Total";
  $("#donutCenterVal").textContent = formatDuration(webUsageData.totalSeconds);

  sortedCats.forEach(([catKey, sec]) => {
    const cat = CATEGORIES[catKey];
    const fraction = sec / totalSec;
    const strokeDash = fraction * circumference;
    const offset = -accumulatedAngle;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "110");
    circle.setAttribute("cy", "110");
    circle.setAttribute("r", radius);
    circle.setAttribute("class", "donut-segment");
    circle.setAttribute("stroke", cat.color);
    circle.setAttribute("stroke-dasharray", `${strokeDash} ${circumference - strokeDash}`);
    circle.setAttribute("stroke-dashoffset", offset);

    circle.addEventListener("mouseenter", () => {
      $("#donutCenterLabel").textContent = cat.name;
      $("#donutCenterVal").textContent = formatDuration(sec);
    });

    circle.addEventListener("mouseleave", () => {
      $("#donutCenterLabel").textContent = "Total";
      $("#donutCenterVal").textContent = formatDuration(webUsageData.totalSeconds);
    });

    svg.appendChild(circle);
    accumulatedAngle += strokeDash;

    // Legend
    const pct = Math.round(fraction * 100);
    const legRow = document.createElement("div");
    legRow.className = "donut-item";
    legRow.innerHTML = `
      <div class="donut-item-left">
        <span class="donut-item-dot" style="background:${cat.color}"></span>
        <span class="donut-item-name">${cat.name}</span>
      </div>
      <div class="donut-item-right">
        <span class="donut-item-pct">${pct}%</span>
        <span class="donut-item-val">${formatDuration(sec)}</span>
      </div>
    `;

    legRow.addEventListener("mouseenter", () => {
      circle.dispatchEvent(new Event("mouseenter"));
      circle.style.strokeWidth = "22";
    });
    legRow.addEventListener("mouseleave", () => {
      circle.dispatchEvent(new Event("mouseleave"));
      circle.style.strokeWidth = "";
    });

    legend.appendChild(legRow);
  });
}

/* ---------- 3. Bars ------------------------------------------------------- */
function renderBars() {
  const container = $("#barChartContainer");
  container.innerHTML = "";

  const catSums = {};
  for (const item of webUsageData.domains) {
    const cat = categorizeDomain(item.host);
    catSums[cat] = (catSums[cat] || 0) + item.seconds;
  }

  const sortedCats = Object.entries(catSums)
    .filter(([_, sec]) => sec > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!sortedCats.length) {
    container.innerHTML = `<span style="font-size:0.75rem; color:var(--text-faint)">No category time logged yet</span>`;
    return;
  }

  const maxSec = sortedCats[0][1] || 1;

  sortedCats.forEach(([catKey, sec]) => {
    const cat = CATEGORIES[catKey];
    const widthPct = Math.max(3, Math.round((sec / maxSec) * 100));

    const row = document.createElement("div");
    row.className = "bar-entity";
    row.innerHTML = `
      <div class="bar-entity-head">
        <span class="bar-entity-name">${cat.name}</span>
        <span class="bar-entity-time">${formatDuration(sec)}</span>
      </div>
      <div class="bar-line-track">
        <div class="bar-line-fill" style="width:${widthPct}%; background:${cat.color};"></div>
      </div>
    `;
    container.appendChild(row);
  });
}

/* ---------- 4. Websites Table --------------------------------------------- */
function renderSitesTable() {
  const tbody = $("#sitesTableBody");
  const emptyNotice = $("#sitesEmptyState");
  tbody.innerHTML = "";

  const totalSec = webUsageData.totalSeconds || 1;
  let domains = [...webUsageData.domains];

  if (siteSearchQuery) {
    const q = siteSearchQuery.toLowerCase();
    domains = domains.filter((d) => d.host.toLowerCase().includes(q));
  }

  if (siteCategoryFilter !== "all") {
    domains = domains.filter((d) => categorizeDomain(d.host) === siteCategoryFilter);
  }

  if (!domains.length) {
    emptyNotice.hidden = false;
    return;
  }
  emptyNotice.hidden = true;

  domains.forEach((item, idx) => {
    const catKey = categorizeDomain(item.host);
    const cat = CATEGORIES[catKey] || CATEGORIES.other;
    const sharePct = Math.min(100, Math.round((item.seconds / totalSec) * 100));
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${item.host}&sz=32`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="color:var(--text-faint); font-family:var(--font-mono); font-size:0.72rem;">${idx + 1}</td>
      <td>
        <div class="domain-cell">
          <img src="${faviconUrl}" alt="" class="favicon-img" onerror="this.style.display='none'" />
          <a href="https://${item.host}" target="_blank" rel="noopener" class="domain-anchor">${item.host}</a>
        </div>
      </td>
      <td>
        <button type="button" class="category-tag-btn" data-host="${item.host}" style="color:${cat.color}; border-color:${cat.color}33;">
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${cat.color}"></span>
          <span>${cat.name}</span>
        </button>
      </td>
      <td style="text-align:right; font-family:var(--font-mono); font-size:0.78rem; font-weight:600;">
        ${formatDuration(item.seconds)}
      </td>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="distribution-track" style="flex:1;">
            <div class="distribution-fill" style="width:${sharePct}%; background:${cat.color};"></div>
          </div>
          <span style="font-family:var(--font-mono); font-size:0.72rem; color:var(--text-faint); width:28px; text-align:right;">${sharePct}%</span>
        </div>
      </td>
    `;

    const catBtn = tr.querySelector(".category-tag-btn");
    catBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openCategoryPopover(item.host, catBtn);
    });

    tbody.appendChild(tr);
  });
}

/* ---------- 5. History ---------------------------------------------------- */
function renderHistory() {
  const list = $("#historyTimeline");
  const emptyNotice = $("#historyEmptyState");
  list.innerHTML = "";

  const totalMin = focusHistoryData.reduce((acc, c) => acc + (c.durationMinutes || 0), 0);
  const totalHours = (totalMin / 60).toFixed(1);
  $("#fStatTotalTime").textContent = `${totalHours}h`;
  $("#fStatSessionsCount").textContent = focusHistoryData.length;

  const avgMin = focusHistoryData.length > 0 ? Math.round(totalMin / focusHistoryData.length) : 25;
  $("#fStatAvgDuration").textContent = `${avgMin}m`;

  const catFreq = {};
  focusHistoryData.forEach((h) => {
    const c = h.category || "Study";
    catFreq[c] = (catFreq[c] || 0) + 1;
  });
  let topFcat = "Study";
  let maxF = 0;
  for (const [c, cnt] of Object.entries(catFreq)) {
    if (cnt > maxF) {
      maxF = cnt;
      topFcat = c;
    }
  }
  $("#fStatTopCat").textContent = topFcat;

  let items = [...focusHistoryData];

  if (historySearchQuery) {
    const q = historySearchQuery.toLowerCase();
    items = items.filter(
      (h) => (h.accomplishment && h.accomplishment.toLowerCase().includes(q)) || (h.category && h.category.toLowerCase().includes(q))
    );
  }

  if (historyCategoryFilter !== "all") {
    items = items.filter((h) => (h.category || "Study").toLowerCase() === historyCategoryFilter.toLowerCase());
  }

  if (!items.length) {
    emptyNotice.hidden = false;
    return;
  }
  emptyNotice.hidden = true;

  items.forEach((item) => {
    const catLower = (item.category || "study").toLowerCase();
    const catObj = CATEGORIES[catLower] || CATEGORIES.study;

    const entry = document.createElement("div");
    entry.className = "history-entry";
    entry.innerHTML = `
      <div class="entry-head">
        <div class="entry-meta">
          <span class="category-tag-btn" style="color:${catObj.color}; border-color:${catObj.color}33;">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${catObj.color}"></span>
            <span>${item.category || "Study"}</span>
          </span>
          <span class="entry-duration">${item.durationMinutes || 25}m</span>
          <span class="entry-time">${formatTimestamp(item.timestamp)}</span>
        </div>
        <button type="button" class="entry-del-btn" title="Remove record">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>

      <div class="entry-body">
        ${item.accomplishment ? escapeHtml(item.accomplishment) : '<span style="color:var(--text-faint)">(No notes recorded)</span>'}
      </div>

      <div class="entry-foot">
        <span>${item.blockedSites ? item.blockedSites.length : 0} domains blocked</span>
        <span style="font-family:var(--font-mono); font-size:0.7rem;">${item.date || ""}</span>
      </div>
    `;

    entry.querySelector(".entry-del-btn").addEventListener("click", async () => {
      focusHistoryData = focusHistoryData.filter((h) => h.id !== item.id);
      if (hasExt) {
        await chrome.storage.local.set({ focus_history_v1: focusHistoryData });
      }
      renderHistory();
      renderKpis();
      showToast("Session removed");
    });

    list.appendChild(entry);
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- Category Popover ---------------------------------------------- */
function openCategoryPopover(host, triggerEl) {
  const popover = $("#categoryPopover");
  const optionsWrap = $("#popoverOptions");

  optionsWrap.innerHTML = "";
  Object.values(CATEGORIES).forEach((cat) => {
    const opt = document.createElement("div");
    opt.className = "popover-entry";
    opt.innerHTML = `
      <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${cat.color}"></span>
      <span>${cat.name}</span>
    `;
    opt.addEventListener("click", async () => {
      customCategories[host] = cat.id;
      if (hasExt) {
        await chrome.storage.local.set({ custom_site_categories: customCategories });
      }
      popover.hidden = true;
      renderAll();
      showToast(`Set ${host} to ${cat.name}`);
    });
    optionsWrap.appendChild(opt);
  });

  const rect = triggerEl.getBoundingClientRect();
  popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popover.style.left = `${rect.left + window.scrollX}px`;
  popover.hidden = false;
}

window.addEventListener("click", (e) => {
  const popover = $("#categoryPopover");
  if (!popover.hidden && !e.target.closest("#categoryPopover") && !e.target.closest(".category-tag-btn")) {
    popover.hidden = true;
  }
});

/* ---------- Event Wiring -------------------------------------------------- */
function initEvents() {
  $$(".segment-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".segment-btn").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      currentRange = btn.dataset.range;
      loadData();
    });
  });

  $("#tabBtnWebsites").addEventListener("click", () => {
    $("#tabBtnWebsites").classList.add("on");
    $("#tabBtnFocus").classList.remove("on");
    $("#viewWebsites").hidden = false;
    $("#viewFocus").hidden = true;
  });

  $("#tabBtnFocus").addEventListener("click", () => {
    $("#tabBtnFocus").classList.add("on");
    $("#tabBtnWebsites").classList.remove("on");
    $("#viewFocus").hidden = false;
    $("#viewWebsites").hidden = true;
  });

  $("#siteSearchInput").addEventListener("input", (e) => {
    siteSearchQuery = e.target.value.trim();
    renderSitesTable();
  });

  $("#siteCategoryFilters").addEventListener("click", (e) => {
    const tag = e.target.closest(".filter-tag");
    if (!tag) return;
    $$("#siteCategoryFilters .filter-tag").forEach((t) => t.classList.remove("on"));
    tag.classList.add("on");
    siteCategoryFilter = tag.dataset.cat;
    renderSitesTable();
  });

  $("#historySearchInput").addEventListener("input", (e) => {
    historySearchQuery = e.target.value.trim();
    renderHistory();
  });

  $("#historyCategoryFilters").addEventListener("click", (e) => {
    const tag = e.target.closest(".filter-tag");
    if (!tag) return;
    $$("#historyCategoryFilters .filter-tag").forEach((t) => t.classList.remove("on"));
    tag.classList.add("on");
    historyCategoryFilter = tag.dataset.fcat;
    renderHistory();
  });

  $("#refreshBtn").addEventListener("click", () => {
    loadData();
    showToast("Data refreshed");
  });

  $("#exportBtn").addEventListener("click", exportDataJson);
  $("#themeToggleBtn").addEventListener("click", toggleTheme);

  // Clear modal
  const clearBackdrop = $("#clearModalBackdrop");
  $("#clearHistoryBtn").addEventListener("click", () => (clearBackdrop.hidden = false));
  $("#clearModalClose").addEventListener("click", () => (clearBackdrop.hidden = true));
  $("#clearModalCancel").addEventListener("click", () => (clearBackdrop.hidden = true));
  clearBackdrop.addEventListener("click", (e) => {
    if (e.target === clearBackdrop) clearBackdrop.hidden = true;
  });
  $("#clearModalConfirm").addEventListener("click", async () => {
    focusHistoryData = [];
    if (hasExt) {
      await chrome.storage.local.set({ focus_history_v1: [], latest_pending_focus: null });
    }
    clearBackdrop.hidden = true;
    renderHistory();
    renderKpis();
    showToast("History cleared");
  });

  // Manual modal
  const manualBackdrop = $("#manualModalBackdrop");
  const openManualModal = () => {
    manualBackdrop.hidden = false;
    $("#manualAccomplishment").value = "";
    $("#manualDuration").value = "25";
    setTimeout(() => $("#manualAccomplishment").focus(), 60);
  };

  $("#logManualBtn").addEventListener("click", openManualModal);
  $("#emptyLogManualBtn")?.addEventListener("click", openManualModal);
  $("#manualModalClose").addEventListener("click", () => (manualBackdrop.hidden = true));
  $("#manualModalCancel").addEventListener("click", () => (manualBackdrop.hidden = true));
  manualBackdrop.addEventListener("click", (e) => {
    if (e.target === manualBackdrop) manualBackdrop.hidden = true;
  });

  $("#manualModalForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const duration = parseInt($("#manualDuration").value, 10) || 25;
    const cat = $("#manualCategory").value;
    const accomplishment = $("#manualAccomplishment").value.trim();

    const entry = {
      id: "focus_" + Date.now(),
      timestamp: Date.now(),
      date: getTodayKey(),
      durationMinutes: duration,
      accomplishment: accomplishment || "Completed study session",
      category: cat,
      blockedSites: []
    };

    focusHistoryData.unshift(entry);
    if (hasExt) {
      await chrome.storage.local.set({ focus_history_v1: focusHistoryData });
    }
    manualBackdrop.hidden = true;
    renderHistory();
    renderKpis();
    showToast("Session logged");
  });
}

function exportDataJson() {
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    range: currentRange,
    webUsage: webUsageData,
    focusHistory: focusHistoryData,
    customCategories
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `analytics-${getTodayKey()}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast("JSON downloaded");
}

/* ---------- Theme -------------------------------------------------------- */
function initTheme() {
  const saved = localStorage.getItem("analytics_theme") || "dark";
  document.documentElement.dataset.theme = saved;
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  const next = current === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("analytics_theme", next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const svg = $("#themeSvg");
  if (!svg) return;
  if (theme === "light") {
    svg.innerHTML = `
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    `;
  } else {
    svg.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  }
}

/* ---------- Toast --------------------------------------------------------- */
let toastTimer = null;
function showToast(msg) {
  const t = $("#studioToast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.hidden = true;
  }, 2200);
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initEvents();
  loadData();
});

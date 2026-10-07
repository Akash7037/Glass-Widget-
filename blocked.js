/** Block page shown when a distracting site is opened during a focus session. */

const $ = (id) => document.getElementById(id);

function fmt(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const site = new URLSearchParams(location.search).get('site') || 'this site';
$('siteName').textContent = site;

const CIRC = 2 * Math.PI * 54;
let endTs = 0;
let startTs = 0;
let timer = null;

function render() {
  const now = Date.now();
  const left = endTs - now;

  if (left <= 0) {
    clearInterval(timer);
    $('timeLeft').textContent = '00:00';
    $('ringFg').style.strokeDashoffset = '0';
    $('statusBadge').textContent = 'Session complete';
    $('message').textContent =
      'Nice work — the focus session just ended. Pick a new tab and carry the momentum.';
    $('fine').textContent = 'Blocking has been lifted. Enjoy your time.';
    return;
  }

  const span = Math.max(1, endTs - startTs);
  const progress = Math.min(1, Math.max(0, (now - startTs) / span));
  $('timeLeft').textContent = fmt(left);
  $('ringFg').style.strokeDashoffset = String(CIRC * (1 - progress));
}

async function init() {
  const data = await chrome.storage.local.get('focus');
  const focus = data.focus;

  if (!focus || !focus.endTs || focus.endTs <= Date.now()) {
    // No active session (rules should have been removed) — let the user leave.
    $('statusBadge').textContent = 'No active session';
    $('message').textContent = 'Blocking is not active right now.';
    $('fine').textContent = 'You can close this tab or open a new one.';
    $('timeLeft').textContent = '00:00';
    return;
  }

  endTs = focus.endTs;
  startTs = focus.startTs || endTs - focus.minutes * 60000;
  render();
  timer = setInterval(render, 250);
}

$('newTabBtn').addEventListener('click', () => {
  try {
    chrome.tabs.create({ url: 'chrome://newtab' });
  } catch (e) {
    location.href = 'chrome://newtab';
  }
});

init();

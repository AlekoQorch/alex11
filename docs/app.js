/* ── SMS Templates ── */
const SMS_TEMPLATES = [
  { id: 1, title: 'ზარის მოთხოვნა', message: 'გამარჯობა! გთხოვთ დაგვიბრუნოთ ზარი, როცა შეძლებთ. გმადლობთ!' },
  { id: 2, title: 'შეხსენება', message: 'გამარჯობა! გიგზავნით შეხსენებას — გთხოვთ დაგვიკავშირდეთ დღესვე. გმადლობთ!' },
  { id: 3, title: 'ვიზიტის დადასტურება', message: 'გამარჯობა! თქვენი ვიზიტი დადასტურებულია. დამატებითი კითხვებისთვის დაგვიკავშირდით.' },
  { id: 4, title: 'გადახდის შეხსენება', message: 'გამარჯობა! გიგზავნით შეხსენებას გადასახადის გადახდის შესახებ. გმადლობთ ყურადღებისთვის!' },
  { id: 5, title: 'მადლობა', message: 'გმადლობთ ჩვენთან კავშირისთვის! საჭიროების შემთხვევაში ნებისმიერ დროს დაგვიკავშირდით.' }
];

const RING_C = 326.7;
const $ = (id) => document.getElementById(id);

const state = {
  queue: [],
  index: 0,
  running: false,
  paused: false,
  callStartTime: null,
  timerInterval: null,
  countdownInterval: null,
  selectedSmsId: 1,
  waitingReturn: false,
  timeoutShown: false,
  stats: { answered: 0, missed: 0, skipped: 0 },
  history: []
};

/* ── Settings ── */
const settings = {
  timeout: 30,
  delay: 3,
  autoNext: true,
  vibrate: true,
  theme: 'light'
};

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('settings') || '{}');
    Object.assign(settings, s);
  } catch (_) {}
  $('setting-timeout').value = settings.timeout;
  $('setting-delay').value = settings.delay;
  $('setting-auto-next').checked = settings.autoNext;
  $('setting-vibrate').checked = settings.vibrate;
  $('help-timeout').textContent = settings.timeout;
  applyTheme(settings.theme);
}

function saveSettings() {
  settings.timeout = +$('setting-timeout').value;
  settings.delay = +$('setting-delay').value;
  settings.autoNext = $('setting-auto-next').checked;
  settings.vibrate = $('setting-vibrate').checked;
  $('help-timeout').textContent = settings.timeout;
  localStorage.setItem('settings', JSON.stringify(settings));
}

function loadHistory() {
  try {
    state.history = JSON.parse(localStorage.getItem('callHistory') || '[]');
  } catch (_) {
    state.history = [];
  }
}

function saveHistory() {
  localStorage.setItem('callHistory', JSON.stringify(state.history.slice(0, 100)));
}

/* ── Utils ── */
function parseNumbers(text) {
  return text
    .split(/[\n,;]+/)
    .map(n => n.trim().replace(/[\s\-()]/g, ''))
    .filter(n => n.replace(/\D/g, '').length >= 9)
    .filter((n, i, arr) => arr.indexOf(n) === i);
}

function normalizeTel(num) {
  return num.replace(/[^\d+]/g, '');
}

function formatDisplay(num) {
  const d = num.replace(/\D/g, '');
  if (d.length === 9) return d.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  return num;
}

function vibrate() {
  if (settings.vibrate && navigator.vibrate) navigator.vibrate([100, 50, 100]);
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  $('meta-theme').content = theme === 'dark' ? '#0f172a' : '#1e40af';
  document.querySelector('.icon-sun').classList.toggle('hidden', theme === 'dark');
  document.querySelector('.icon-moon').classList.toggle('hidden', theme !== 'dark');
}

/* ── Tabs ── */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

/* ── Theme ── */
$('btn-theme').addEventListener('click', () => {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  applyTheme(settings.theme);
  localStorage.setItem('settings', JSON.stringify(settings));
});

/* ── Numbers UI ── */
const numbersInput = $('numbers-input');

function updateNumbersUI() {
  const nums = parseNumbers(numbersInput.value);
  $('numbers-count').textContent = nums.length;
  const chips = $('number-chips');
  if (!nums.length) {
    chips.innerHTML = '';
    return;
  }
  chips.innerHTML = nums.slice(0, 20).map((n, i) => {
    let cls = 'chip';
    if (state.running && i < state.index) cls += ' done';
    if (state.running && i === state.index) cls += ' current';
    return `<span class="${cls}">${formatDisplay(n)}</span>`;
  }).join('') + (nums.length > 20 ? `<span class="chip">+${nums.length - 20}</span>` : '');
}

numbersInput.addEventListener('input', () => {
  updateNumbersUI();
  localStorage.setItem('savedNumbers', numbersInput.value);
});

$('btn-paste').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) { toast('ბუფერი ცარიელია'); return; }
    numbersInput.value = numbersInput.value ? numbersInput.value + '\n' + text : text;
    updateNumbersUI();
    localStorage.setItem('savedNumbers', numbersInput.value);
    toast(`${parseNumbers(text).length} ნომერი ჩაირთო`);
  } catch (_) {
    toast('ჩასმა ვერ მოხერხდა — ხელით ჩასვი');
  }
});

$('btn-clear').addEventListener('click', () => {
  if (state.running) return;
  numbersInput.value = '';
  updateNumbersUI();
  localStorage.removeItem('savedNumbers');
  toast('გასუფთავდა');
});

/* ── Status UI ── */
function setBadge(type, text) {
  const badge = $('status-badge');
  badge.className = `status-badge ${type}`;
  badge.textContent = { idle: 'მზად', calling: 'ირეკება', answered: 'პასუხი', missed: 'არ მიპასუხეს', paused: 'პაუზა', done: 'დასრულდა' }[type] || type;
  $('status-text').textContent = text;
}

function updateStats() {
  const total = state.queue.length;
  const done = state.index;
  const left = Math.max(0, total - done);
  $('stats-row').classList.toggle('hidden', !state.running && done === 0);
  $('stat-done').textContent = done;
  $('stat-answered').textContent = state.stats.answered;
  $('stat-missed').textContent = state.stats.missed;
  $('stat-left').textContent = left;
  $('header-subtitle').textContent = state.running
    ? `${done}/${total} ნომერი`
    : 'მზად ხარ';
}

function updateQueueProgress() {
  const total = state.queue.length;
  if (!total) return;
  const pct = (state.index / total) * 100;
  $('queue-fill').style.width = `${pct}%`;
  $('queue-label').textContent = `${state.index} / ${total}`;
  $('queue-progress').classList.remove('hidden');
  $('queue-label').classList.remove('hidden');
}

function showRing(show) {
  $('ring-wrap').classList.toggle('hidden', !show);
  $('status-info').style.display = show ? 'none' : 'block';
}

function updateRing() {
  if (!state.callStartTime) return;
  const elapsed = (Date.now() - state.callStartTime) / 1000;
  const remaining = Math.max(0, settings.timeout - elapsed);
  const pct = remaining / settings.timeout;
  $('ring-fill').style.strokeDashoffset = RING_C * (1 - pct);
  $('ring-time').textContent = Math.ceil(remaining);
}

function startTimer() {
  stopTimer();
  state.callStartTime = Date.now();
  state.timeoutShown = false;
  showRing(true);
  updateRing();

  state.timerInterval = setInterval(() => {
    updateRing();
    const elapsed = (Date.now() - state.callStartTime) / 1000;
    if (elapsed >= settings.timeout && !state.timeoutShown) {
      state.timeoutShown = true;
      $('timeout-modal').classList.remove('hidden');
      vibrate();
    }
  }, 200);
}

function stopTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = null;
  showRing(false);
}

/* ── Dialer ── */
function dialNumber(num) {
  window.location.href = `tel:${normalizeTel(num)}`;
}

function setRunningUI(running) {
  $('btn-start').classList.toggle('hidden', running);
  $('action-row').classList.toggle('hidden', !running);
  numbersInput.disabled = running;
  $('btn-pause').textContent = state.paused ? '▶ გაგრძელება' : '⏸ პაუზა';
}

function addHistory(num, status) {
  state.history.unshift({
    num,
    status,
    time: new Date().toISOString()
  });
  saveHistory();
  renderHistory();
}

function startQueue() {
  state.queue = parseNumbers(numbersInput.value);
  if (!state.queue.length) {
    toast('შეიყვანე მაინც ერთი ნომერი');
    return;
  }
  state.index = 0;
  state.running = true;
  state.paused = false;
  state.stats = { answered: 0, missed: 0, skipped: 0 };
  setRunningUI(true);
  updateStats();
  localStorage.setItem('savedNumbers', numbersInput.value);
  callCurrent();
}

function callCurrent() {
  if (!state.running || state.paused) return;

  if (state.index >= state.queue.length) {
    finishQueue();
    return;
  }

  const num = state.queue[state.index];
  setBadge('calling', `ირეკება ${state.index + 1} / ${state.queue.length}`);
  $('status-number').textContent = formatDisplay(num);
  $('status-number').classList.remove('hidden');
  state.waitingReturn = true;
  updateNumbersUI();
  updateQueueProgress();

  startTimer();
  dialNumber(num);
}

function onReturnFromCall() {
  if (!state.running || !state.waitingReturn || state.paused) return;
  state.waitingReturn = false;
  stopTimer();

  const num = state.queue[state.index];
  const elapsed = state.callStartTime ? (Date.now() - state.callStartTime) / 1000 : 0;
  const answered = elapsed > 8 && elapsed < settings.timeout;
  const timedOut = elapsed >= settings.timeout;

  let status;
  if (answered) {
    status = 'answered';
    state.stats.answered++;
    setBadge('answered', 'მიპასუხეს!');
  } else {
    status = 'missed';
    state.stats.missed++;
    setBadge('missed', timedOut ? `არ მიპასუხეს (${settings.timeout} წმ)` : 'არ მიპასუხეს');
  }
  addHistory(num, status);
  $('timeout-modal').classList.add('hidden');

  state.index++;
  updateStats();
  updateNumbersUI();
  updateQueueProgress();

  if (state.running && state.index < state.queue.length) {
    if (settings.autoNext) {
      showNextModal(state.queue[state.index]);
    } else {
      setBadge('idle', 'დააჭირე გაგრძელებას');
      toast('შემდეგი ნომერი მზადაა');
    }
  } else if (state.running) {
    finishQueue();
  }
}

function showNextModal(num) {
  $('modal-number').textContent = formatDisplay(num);
  $('modal-label').textContent = `შემდეგი (${state.index + 1}/${state.queue.length})`;
  $('next-call-modal').classList.remove('hidden');

  let left = settings.delay;
  const bar = $('countdown-bar');
  bar.style.width = '100%';

  if (state.countdownInterval) clearInterval(state.countdownInterval);
  state.countdownInterval = setInterval(() => {
    left -= 0.1;
    bar.style.width = `${(left / settings.delay) * 100}%`;
    if (left <= 0) {
      clearInterval(state.countdownInterval);
      hideNextModal();
      callCurrent();
    }
  }, 100);
}

function hideNextModal() {
  if (state.countdownInterval) clearInterval(state.countdownInterval);
  $('next-call-modal').classList.add('hidden');
}

function finishQueue() {
  state.running = false;
  state.paused = false;
  state.waitingReturn = false;
  stopTimer();
  hideNextModal();
  setRunningUI(false);
  setBadge('done', 'ყველა ნომერზე დასრულდა 🎉');
  $('status-number').classList.add('hidden');
  $('queue-progress').classList.add('hidden');
  $('queue-label').classList.add('hidden');
  updateNumbersUI();
  vibrate();
  toast(`დასრულდა: ${state.stats.answered} პასუხი, ${state.stats.missed} გამოტოვება`);
}

function stopQueue() {
  state.running = false;
  state.paused = false;
  state.waitingReturn = false;
  stopTimer();
  hideNextModal();
  $('timeout-modal').classList.add('hidden');
  setRunningUI(false);
  setBadge('idle', 'გაჩერებულია');
  $('status-number').classList.add('hidden');
  updateNumbersUI();
}

function skipCurrent() {
  if (!state.running) return;
  if (state.waitingReturn) {
    state.waitingReturn = false;
    stopTimer();
    const num = state.queue[state.index];
    state.stats.skipped++;
    addHistory(num, 'skipped');
    state.index++;
    updateStats();
    updateNumbersUI();
    updateQueueProgress();
    $('timeout-modal').classList.add('hidden');
  }
  hideNextModal();
  if (state.index >= state.queue.length) {
    finishQueue();
  } else {
    callCurrent();
  }
  toast('გამოტოვებულია');
}

/* ── Events: dialer ── */
$('btn-start').addEventListener('click', startQueue);
$('btn-stop').addEventListener('click', stopQueue);
$('btn-pause').addEventListener('click', () => {
  if (!state.running) return;
  state.paused = !state.paused;
  $('btn-pause').textContent = state.paused ? '▶ გაგრძელება' : '⏸ პაუზა';
  if (state.paused) {
    stopTimer();
    hideNextModal();
    setBadge('paused', 'დაპაუზებულია');
    toast('პაუზა');
  } else if (!state.waitingReturn) {
    callCurrent();
  } else {
    setBadge('calling', 'განახლდი ზარზე');
  }
});
$('btn-skip-current').addEventListener('click', skipCurrent);
$('btn-call-next').addEventListener('click', () => { hideNextModal(); callCurrent(); });
$('btn-skip-next').addEventListener('click', skipCurrent);
$('btn-timeout-ok').addEventListener('click', () => $('timeout-modal').classList.add('hidden'));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') setTimeout(onReturnFromCall, 400);
});
window.addEventListener('pageshow', (e) => {
  if (e.persisted) setTimeout(onReturnFromCall, 400);
});

/* ── SMS ── */
function renderSmsTemplates() {
  $('sms-templates').innerHTML = SMS_TEMPLATES.map(t => `
    <div class="sms-card ${t.id === state.selectedSmsId ? 'selected' : ''}" data-id="${t.id}">
      <div class="sms-card-head">
        <div class="sms-radio"></div>
        <span class="sms-title">${t.title}</span>
      </div>
      <p class="sms-preview">${t.message}</p>
      <div class="sms-footer">
        <span class="sms-chars">${t.message.length} სიმბოლო</span>
        <button class="btn-send" data-id="${t.id}" type="button">გაგზავნა</button>
      </div>
    </div>
  `).join('');

  $('sms-templates').querySelectorAll('.sms-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.classList.contains('btn-send')) return;
      state.selectedSmsId = +card.dataset.id;
      renderSmsTemplates();
    });
  });
  $('sms-templates').querySelectorAll('.btn-send').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const tmpl = SMS_TEMPLATES.find(t => t.id === +btn.dataset.id);
      sendSms(tmpl);
    });
  });
}

function getSmsTarget() {
  const manual = $('sms-number').value.trim();
  if (manual) return normalizeTel(manual);
  if (state.running && state.queue[state.index]) return normalizeTel(state.queue[state.index]);
  if (state.index > 0 && state.queue[state.index - 1]) return normalizeTel(state.queue[state.index - 1]);
  const first = parseNumbers(numbersInput.value)[0];
  return first ? normalizeTel(first) : '';
}

function sendSms(tmpl) {
  const num = getSmsTarget();
  if (!num) { toast('მიუთითე ნომერი'); return; }
  window.location.href = `sms:${num}?body=${encodeURIComponent(tmpl.message)}`;
}

$('btn-sms-current').addEventListener('click', () => {
  const num = getSmsTarget();
  if (num) {
    $('sms-number').value = formatDisplay(num);
    toast('ნომერი ჩაირთო');
  } else {
    toast('მიმდინარე ნომერი არ არის');
  }
});

/* ── History ── */
function renderHistory() {
  const list = $('history-list');
  if (!state.history.length) {
    list.innerHTML = '<p class="empty-state">ისტორია ცარიელია</p>';
    return;
  }
  list.innerHTML = state.history.map(h => {
    const icon = h.status === 'answered' ? '✓' : h.status === 'skipped' ? '⏭' : '✕';
    const label = h.status === 'answered' ? 'მიპასუხეს' : h.status === 'skipped' ? 'გამოტოვებული' : 'არ მიპასუხეს';
    const time = new Date(h.time).toLocaleString('ka-GE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `
      <div class="history-item">
        <div class="history-icon ${h.status}">${icon}</div>
        <div class="history-body">
          <div class="history-num">${formatDisplay(h.num)}</div>
          <div class="history-meta">${label} · ${time}</div>
        </div>
        <div class="history-actions">
          <button type="button" data-action="call" data-num="${h.num}" title="დარეკვა">📞</button>
          <button type="button" data-action="sms" data-num="${h.num}" title="SMS">💬</button>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-action="call"]').forEach(btn => {
    btn.addEventListener('click', () => dialNumber(btn.dataset.num));
  });
  list.querySelectorAll('[data-action="sms"]').forEach(btn => {
    btn.addEventListener('click', () => {
      $('sms-number').value = formatDisplay(btn.dataset.num);
      document.querySelector('[data-tab="sms"]').click();
    });
  });
}

$('btn-clear-history').addEventListener('click', () => {
  state.history = [];
  saveHistory();
  renderHistory();
  toast('ისტორია გასუფთავდა');
});

/* ── Settings ── */
['setting-timeout', 'setting-delay', 'setting-auto-next', 'setting-vibrate'].forEach(id => {
  $(id).addEventListener('change', saveSettings);
});

$('btn-install-hint').addEventListener('click', () => $('install-modal').classList.remove('hidden'));
$('btn-install-close').addEventListener('click', () => $('install-modal').classList.add('hidden'));

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.add('hidden');
  });
});

/* ── Init ── */
document.documentElement.style.setProperty('--ring-c', RING_C);
$('ring-fill').style.strokeDasharray = `${RING_C} ${RING_C}`;

loadSettings();
loadHistory();
const saved = localStorage.getItem('savedNumbers');
if (saved) numbersInput.value = saved;
updateNumbersUI();
renderSmsTemplates();
renderHistory();
setBadge('idle', 'ჩასვი ნომრები და დააჭირე დაწყებას');

if (!localStorage.getItem('installDismissed') && /iPhone|iPad/.test(navigator.userAgent)) {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (!standalone) setTimeout(() => $('install-modal').classList.remove('hidden'), 1500);
}
$('btn-install-close').addEventListener('click', () => localStorage.setItem('installDismissed', '1'));

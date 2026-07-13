const SMS_TEMPLATES = [
  { id: 1, title: 'ზარის მოთხოვნა', message: 'გამარჯობა! გთხოვთ დაგვიბრუნოთ ზარი, როცა შეძლებთ. გმადლობთ!' },
  { id: 2, title: 'შეხსენება', message: 'გამარჯობა! გიგზავნით შეხსენებას — გთხოვთ დაგვიკავშირდეთ დღესვე. გმადლობთ!' },
  { id: 3, title: 'ვიზიტის დადასტურება', message: 'გამარჯობა! თქვენი ვიზიტი დადასტურებულია. დამატებითი კითხვებისთვის დაგვიკავშირდით.' },
  { id: 4, title: 'გადახდის შეხსენება', message: 'გამარჯობა! გიგზავნით შეხსენებას გადასახადის გადახდის შესახებ. გმადლობთ ყურადღებისთვის!' },
  { id: 5, title: 'მადლობა', message: 'გმადლობთ ჩვენთან კავშირისთვის! საჭიროების შემთხვევაში ნებისმიერ დროს დაგვიკავშირდით.' }
];

const RING_LEN = 188.5;
const $ = (id) => document.getElementById(id);

const state = {
  queue: [], index: 0, running: false, paused: false,
  callStartTime: null, timerInterval: null, countdownInterval: null,
  selectedSmsId: 1, waitingReturn: false, timeoutShown: false,
  stats: { answered: 0, missed: 0, skipped: 0 },
  history: []
};

const settings = { timeout: 30, delay: 3, autoNext: true, vibrate: true, theme: 'light' };

function loadSettings() {
  try { Object.assign(settings, JSON.parse(localStorage.getItem('settings') || '{}')); } catch (_) {}
  $('setting-timeout').value = settings.timeout;
  $('setting-delay').value = settings.delay;
  $('setting-auto-next').checked = settings.autoNext;
  $('setting-vibrate').checked = settings.vibrate;
  applyTheme(settings.theme);
}

function saveSettings() {
  settings.timeout = +$('setting-timeout').value;
  settings.delay = +$('setting-delay').value;
  settings.autoNext = $('setting-auto-next').checked;
  settings.vibrate = $('setting-vibrate').checked;
  localStorage.setItem('settings', JSON.stringify(settings));
}

function loadHistory() {
  try { state.history = JSON.parse(localStorage.getItem('callHistory') || '[]'); } catch (_) { state.history = []; }
}
function saveHistory() { localStorage.setItem('callHistory', JSON.stringify(state.history.slice(0, 100))); }

function parseNumbers(text) {
  return text.split(/[\n,;]+/).map(n => n.trim().replace(/[\s\-()]/g, ''))
    .filter(n => n.replace(/\D/g, '').length >= 9)
    .filter((n, i, arr) => arr.indexOf(n) === i);
}
function normalizeTel(num) { return num.replace(/[^\d+]/g, ''); }
function formatDisplay(num) {
  const d = num.replace(/\D/g, '');
  if (d.length === 9) return d.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  return num;
}
function vibrate() { if (settings.vibrate && navigator.vibrate) navigator.vibrate([80, 40, 80]); }

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  $('meta-theme').content = theme === 'dark' ? '#1c1c1e' : '#ffffff';
  document.querySelector('.ico-sun').classList.toggle('hidden', theme === 'dark');
  document.querySelector('.ico-moon').classList.toggle('hidden', theme !== 'dark');
}

document.querySelectorAll('.tabbar .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tabbar .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

$('btn-theme').addEventListener('click', () => {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  applyTheme(settings.theme);
  localStorage.setItem('settings', JSON.stringify(settings));
});

const numbersInput = $('numbers-input');

function updateNumbersUI() {
  const nums = parseNumbers(numbersInput.value);
  $('numbers-count').textContent = nums.length;
  const chips = $('number-chips');
  if (!nums.length) { chips.innerHTML = ''; return; }
  chips.innerHTML = nums.slice(0, 24).map((n, i) => {
    let c = 'tag';
    if (state.running && i < state.index) c += ' done';
    if (state.running && i === state.index) c += ' cur';
    return `<span class="${c}">${formatDisplay(n)}</span>`;
  }).join('') + (nums.length > 24 ? `<span class="tag">+${nums.length - 24}</span>` : '');
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
    toast(`+${parseNumbers(text).length} ნომერი`);
  } catch (_) { toast('ჩასმა ვერ მოხერხდა'); }
});

$('btn-clear').addEventListener('click', () => {
  if (state.running) return;
  numbersInput.value = '';
  updateNumbersUI();
  localStorage.removeItem('savedNumbers');
  toast('გასუფთავდა');
});

function setBadge(type, text) {
  const b = $('status-badge');
  b.className = `badge ${type}`;
  b.textContent = { idle: 'მზად', calling: 'ირეკება', answered: 'პასუხი', missed: 'არ მიპასუხეს', paused: 'პაუზა', done: 'დასრულდა' }[type] || type;
  $('status-text').textContent = text;
}

function updateStats() {
  const total = state.queue.length;
  const left = Math.max(0, total - state.index);
  $('stats-row').classList.toggle('hidden', !state.running && state.index === 0);
  $('stat-answered').textContent = state.stats.answered;
  $('stat-missed').textContent = state.stats.missed;
  $('stat-left').textContent = left;
  $('header-subtitle').textContent = state.running ? `${state.index}/${total}` : 'მზად ხარ';
}

function updateQueueProgress() {
  const t = state.queue.length;
  if (!t) return;
  $('queue-fill').style.width = `${(state.index / t) * 100}%`;
  $('queue-label').textContent = `${state.index} / ${t}`;
  $('queue-progress').classList.remove('hidden');
  $('queue-label').classList.remove('hidden');
}

function showRing(on) {
  $('ring-wrap').classList.toggle('hidden', !on);
}

function updateRing() {
  if (!state.callStartTime) return;
  const rem = Math.max(0, settings.timeout - (Date.now() - state.callStartTime) / 1000);
  $('ring-fill').style.strokeDashoffset = RING_LEN * (1 - rem / settings.timeout);
  $('ring-time').textContent = Math.ceil(rem);
}

function startTimer() {
  stopTimer();
  state.callStartTime = Date.now();
  state.timeoutShown = false;
  showRing(true);
  updateRing();
  state.timerInterval = setInterval(() => {
    updateRing();
    if ((Date.now() - state.callStartTime) / 1000 >= settings.timeout && !state.timeoutShown) {
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

function dialNumber(num) { window.location.href = `tel:${normalizeTel(num)}`; }

function setRunningUI(on) {
  $('btn-start').classList.toggle('hidden', on);
  $('action-row').classList.toggle('hidden', !on);
  numbersInput.disabled = on;
  $('btn-pause').textContent = state.paused ? 'გაგრძელება' : 'პაუზა';
}

function addHistory(num, status) {
  state.history.unshift({ num, status, time: new Date().toISOString() });
  saveHistory();
  renderHistory();
}

function startQueue() {
  state.queue = parseNumbers(numbersInput.value);
  if (!state.queue.length) { toast('შეიყვანე ნომერი'); return; }
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
  if (state.index >= state.queue.length) { finishQueue(); return; }
  const num = state.queue[state.index];
  setBadge('calling', `${state.index + 1} / ${state.queue.length}`);
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
  if (answered) { state.stats.answered++; setBadge('answered', 'მიპასუხეს'); addHistory(num, 'answered'); }
  else { state.stats.missed++; setBadge('missed', timedOut ? 'ვერ მიპასუხეს' : 'არ მიპასუხეს'); addHistory(num, 'missed'); }
  $('timeout-modal').classList.add('hidden');
  state.index++;
  updateStats();
  updateNumbersUI();
  updateQueueProgress();
  if (state.running && state.index < state.queue.length) {
    settings.autoNext ? showNextModal(state.queue[state.index]) : toast('შემდეგი მზადაა');
  } else if (state.running) finishQueue();
}

function showNextModal(num) {
  $('modal-number').textContent = formatDisplay(num);
  $('modal-label').textContent = `შემდეგი · ${state.index + 1}/${state.queue.length}`;
  $('next-call-modal').classList.remove('hidden');
  let left = settings.delay;
  const bar = $('countdown-bar');
  bar.style.width = '100%';
  if (state.countdownInterval) clearInterval(state.countdownInterval);
  state.countdownInterval = setInterval(() => {
    left -= 0.1;
    bar.style.width = `${(left / settings.delay) * 100}%`;
    if (left <= 0) { clearInterval(state.countdownInterval); hideNextModal(); callCurrent(); }
  }, 100);
}

function hideNextModal() {
  if (state.countdownInterval) clearInterval(state.countdownInterval);
  $('next-call-modal').classList.add('hidden');
}

function finishQueue() {
  state.running = false; state.paused = false; state.waitingReturn = false;
  stopTimer(); hideNextModal(); setRunningUI(false);
  setBadge('done', 'დასრულდა');
  $('status-number').classList.add('hidden');
  $('queue-progress').classList.add('hidden');
  $('queue-label').classList.add('hidden');
  updateNumbersUI();
  toast(`${state.stats.answered} პასუხი · ${state.stats.missed} გამოტოვება`);
}

function stopQueue() {
  state.running = false; state.paused = false; state.waitingReturn = false;
  stopTimer(); hideNextModal();
  $('timeout-modal').classList.add('hidden');
  setRunningUI(false);
  setBadge('idle', 'გაჩერებულია');
  $('status-number').classList.add('hidden');
  updateNumbersUI();
}

function skipCurrent() {
  if (!state.running) return;
  if (state.waitingReturn) {
    state.waitingReturn = false; stopTimer();
    addHistory(state.queue[state.index], 'skipped');
    state.stats.skipped++; state.index++;
    updateStats(); updateNumbersUI(); updateQueueProgress();
    $('timeout-modal').classList.add('hidden');
  }
  hideNextModal();
  state.index >= state.queue.length ? finishQueue() : callCurrent();
  toast('გამოტოვებულია');
}

$('btn-start').addEventListener('click', startQueue);
$('btn-stop').addEventListener('click', stopQueue);
$('btn-pause').addEventListener('click', () => {
  if (!state.running) return;
  state.paused = !state.paused;
  $('btn-pause').textContent = state.paused ? 'გაგრძელება' : 'პაუზა';
  if (state.paused) { stopTimer(); hideNextModal(); setBadge('paused', 'დაპაუზებულია'); }
  else if (!state.waitingReturn) callCurrent();
});
$('btn-skip-current').addEventListener('click', skipCurrent);
$('btn-call-next').addEventListener('click', () => { hideNextModal(); callCurrent(); });
$('btn-skip-next').addEventListener('click', skipCurrent);
$('btn-timeout-ok').addEventListener('click', () => $('timeout-modal').classList.add('hidden'));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') setTimeout(onReturnFromCall, 400);
});
window.addEventListener('pageshow', (e) => { if (e.persisted) setTimeout(onReturnFromCall, 400); });

function renderSmsTemplates() {
  $('sms-templates').innerHTML = SMS_TEMPLATES.map(t => `
    <div class="sms-card ${t.id === state.selectedSmsId ? 'on' : ''}" data-id="${t.id}">
      <div class="sms-top"><div class="sms-dot"></div><span class="sms-title">${t.title}</span></div>
      <p class="sms-body">${t.message}</p>
      <div class="sms-foot"><span class="sms-len">${t.message.length} სიმბ.</span>
        <button class="btn-sms" data-id="${t.id}" type="button">გაგზავნა</button></div>
    </div>`).join('');
  $('sms-templates').querySelectorAll('.sms-card').forEach(c => {
    c.addEventListener('click', e => {
      if (e.target.classList.contains('btn-sms')) return;
      state.selectedSmsId = +c.dataset.id;
      renderSmsTemplates();
    });
  });
  $('sms-templates').querySelectorAll('.btn-sms').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      sendSms(SMS_TEMPLATES.find(t => t.id === +b.dataset.id));
    });
  });
}

function getSmsTarget() {
  const m = $('sms-number').value.trim();
  if (m) return normalizeTel(m);
  if (state.running && state.queue[state.index]) return normalizeTel(state.queue[state.index]);
  if (state.index > 0) return normalizeTel(state.queue[state.index - 1]);
  const f = parseNumbers(numbersInput.value)[0];
  return f ? normalizeTel(f) : '';
}

function sendSms(tmpl) {
  const num = getSmsTarget();
  if (!num) { toast('მიუთითე ნომერი'); return; }
  window.location.href = `sms:${num}?body=${encodeURIComponent(tmpl.message)}`;
}

$('btn-sms-current').addEventListener('click', () => {
  const n = getSmsTarget();
  if (n) { $('sms-number').value = formatDisplay(n); toast('ჩაირთო'); }
  else toast('ნომერი არ არის');
});

function renderHistory() {
  const list = $('history-list');
  if (!state.history.length) { list.innerHTML = '<p class="empty">ჯერ არაფერი არ არის</p>'; return; }
  list.innerHTML = state.history.map(h => {
    const ic = h.status === 'answered' ? '✓' : h.status === 'skipped' ? '›' : '✕';
    const lb = h.status === 'answered' ? 'პასუხი' : h.status === 'skipped' ? 'გამოტოვება' : 'არ მიპასუხეს';
    const tm = new Date(h.time).toLocaleString('ka-GE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<div class="hist-item"><div class="hist-ico ${h.status}">${ic}</div>
      <div class="hist-body"><div class="hist-num">${formatDisplay(h.num)}</div><div class="hist-meta">${lb} · ${tm}</div></div>
      <div class="hist-btns"><button type="button" data-a="call" data-n="${h.num}">📞</button>
      <button type="button" data-a="sms" data-n="${h.num}">💬</button></div></div>`;
  }).join('');
  list.querySelectorAll('[data-a="call"]').forEach(b => b.addEventListener('click', () => dialNumber(b.dataset.n)));
  list.querySelectorAll('[data-a="sms"]').forEach(b => b.addEventListener('click', () => {
    $('sms-number').value = formatDisplay(b.dataset.n);
    document.querySelector('[data-tab="sms"]').click();
  }));
}

$('btn-clear-history').addEventListener('click', () => {
  state.history = []; saveHistory(); renderHistory(); toast('გასუფთავდა');
});

['setting-timeout', 'setting-delay', 'setting-auto-next', 'setting-vibrate'].forEach(id => {
  $(id).addEventListener('change', saveSettings);
});

$('btn-install-hint').addEventListener('click', () => $('install-modal').classList.remove('hidden'));
$('btn-install-close').addEventListener('click', () => $('install-modal').classList.add('hidden'));
document.querySelectorAll('.sheet-bg').forEach(bg => {
  bg.addEventListener('click', () => bg.parentElement.classList.add('hidden'));
});

document.documentElement.style.setProperty('--ring-len', RING_LEN);
$('ring-fill').style.strokeDasharray = RING_LEN;

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
  if (!standalone) setTimeout(() => $('install-modal').classList.remove('hidden'), 2000);
}
$('btn-install-close').addEventListener('click', () => localStorage.setItem('installDismissed', '1'));

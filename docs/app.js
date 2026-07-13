const SMS_TEMPLATES = [
  { id: 1, title: 'ზარის მოთხოვნა', message: 'გამარჯობა! გთხოვთ დაგვიბრუნოთ ზარი, როცა შეძლებთ. გმადლობთ!' },
  { id: 2, title: 'შეხსენება', message: 'გამარჯობა! გიგზავნით შეხსენებას — გთხოვთ დაგვიკავშირდეთ დღესვე. გმადლობთ!' },
  { id: 3, title: 'ვიზიტის დადასტურება', message: 'გამარჯობა! თქვენი ვიზიტი დადასტურებულია. დამატებითი კითხვებისთვის დაგვიკავშირდით.' },
  { id: 4, title: 'გადახდის შეხსენება', message: 'გამარჯობა! გიგზავნით შეხსენებას გადასახადის გადახდის შესახებ. გმადლობთ ყურადღებისთვის!' },
  { id: 5, title: 'მადლობა', message: 'გმადლობთ ჩვენთან კავშირისთვის! საჭიროების შემთხვევაში ნებისმიერ დროს დაგვიკავშირდით.' }
];

const TIMEOUT_SEC = 30;
const HISTORY_KEY = 'callHistory';

const state = {
  queue: [],
  index: 0,
  running: false,
  paused: false,
  callStartTime: null,
  timerInterval: null,
  selectedSmsId: 1,
  waitingReturn: false,
  timeoutShown: false,
  stats: { answered: 0, missed: 0 }
};

const $ = (id) => document.getElementById(id);

// ── Navigation ──
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(d => d.classList.remove('active'));
  $('view-' + name)?.classList.add('active');
  document.querySelector(`.tab[data-view="${name}"]`)?.classList.add('active');
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ── Parser ──
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

function formatPhone(num) {
  const d = num.replace(/\D/g, '');
  if (d.length === 9) return d.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
  return num;
}

// ── Toast ──
let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
}

// ── UI ──
function setStatus(text, mode = 'idle', phone = '') {
  const badge = $('status-badge');
  const phoneEl = $('status-number');
  $('status-text').textContent = text;
  badge.className = 'badge ' + mode;
  const labels = { idle: 'მზად', active: 'ირეკება', waiting: 'მოლოდინი', done: 'დასრულდა' };
  badge.textContent = labels[mode] || 'მზად';

  if (phone) {
    phoneEl.textContent = formatPhone(phone);
    phoneEl.classList.remove('hidden');
  } else {
    phoneEl.classList.add('hidden');
  }

  const subtitles = {
    idle: 'მზად ხარ დასაწყებად',
    active: 'ზარი მიმდინარეობს...',
    waiting: 'შემდეგ ნომერზე გადასვლა',
    done: 'ყველა ნომერი დამუშავდა'
  };
  $('header-subtitle').textContent = subtitles[mode] || text;
}

function updateNumbersUI() {
  $('numbers-count').textContent = parseNumbers($('numbers-input').value).length;
}

function updateQueueProgress() {
  const wrap = $('queue-progress');
  const label = $('queue-label');
  if (!state.running || !state.queue.length) {
    wrap.classList.add('hidden');
    label.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');
  label.classList.remove('hidden');
  const pct = (state.index / state.queue.length) * 100;
  $('queue-fill').style.width = pct + '%';
  const left = state.queue.length - state.index;
  label.textContent = `${state.index}/${state.queue.length} · პასუხი ${state.stats.answered} · გამოტოვ. ${state.stats.missed} · დარჩა ${left}`;
}

function startTimer() {
  stopTimer();
  state.callStartTime = Date.now();
  state.timeoutShown = false;
  $('timer-text').classList.remove('hidden');
  updateTimerDisplay();

  state.timerInterval = setInterval(() => {
    updateTimerDisplay();
    const elapsed = (Date.now() - state.callStartTime) / 1000;
    if (elapsed >= TIMEOUT_SEC && !state.timeoutShown) {
      state.timeoutShown = true;
      showTimeoutAlert();
      vibrate();
    }
  }, 400);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  $('timer-text').classList.add('hidden');
}

function updateTimerDisplay() {
  if (!state.callStartTime) return;
  const elapsed = (Date.now() - state.callStartTime) / 1000;
  const remaining = Math.max(0, TIMEOUT_SEC - elapsed);
  $('timer-text').textContent = `${Math.ceil(remaining)} წმ`;
}

function vibrate() {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

function setRunningUI(running) {
  $('btn-start').classList.toggle('hidden', running);
  $('action-row').classList.toggle('hidden', !running);
  $('numbers-input').disabled = running;
  $('btn-pause').textContent = state.paused ? 'გაგრძელება' : 'პაუზა';
}

// ── History ──
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
}

function addHistory(num, type, detail) {
  const list = loadHistory();
  list.unshift({
    num,
    type,
    detail,
    time: new Date().toLocaleString('ka-GE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
  });
  saveHistory(list);
  renderHistory();
}

function renderHistory() {
  const list = loadHistory();
  const el = $('history-list');
  if (!list.length) {
    el.innerHTML = '<p class="empty">ჯერ ზარები არ გაქვს</p>';
    return;
  }
  el.innerHTML = list.map(h => `
    <div class="hist-item">
      <span class="hist-dot ${h.type}"></span>
      <div class="hist-body">
        <div class="hist-num">${formatPhone(h.num)}</div>
        <div class="hist-meta">${h.detail} · ${h.time}</div>
      </div>
    </div>
  `).join('');
}

// ── Dialer ──
function dialNumber(num) {
  window.location.href = `tel:${normalizeTel(num)}`;
}

function startQueue() {
  state.queue = parseNumbers($('numbers-input').value);
  if (!state.queue.length) {
    toast('შეიყვანე მაინც ერთი ნომერი');
    return;
  }
  state.index = 0;
  state.running = true;
  state.paused = false;
  state.stats = { answered: 0, missed: 0 };
  setRunningUI(true);
  localStorage.setItem('savedNumbers', $('numbers-input').value);
  callCurrent();
}

function callCurrent() {
  if (!state.running || state.paused) return;
  if (state.index >= state.queue.length) {
    finishQueue();
    return;
  }

  const num = state.queue[state.index];
  setStatus(`ირეკება ${state.index + 1}/${state.queue.length}`, 'active', num);
  updateQueueProgress();
  state.waitingReturn = true;
  startTimer();
  dialNumber(num);
}

function onReturnFromCall() {
  if (!state.running || !state.waitingReturn || state.paused) return;
  state.waitingReturn = false;
  stopTimer();

  const num = state.queue[state.index];
  const elapsed = state.callStartTime ? (Date.now() - state.callStartTime) / 1000 : 0;
  const answered = elapsed > 8 && elapsed < TIMEOUT_SEC;
  const missed = !answered;

  if (answered) {
    state.stats.answered++;
    addHistory(num, 'ok', 'მიპასუხეს');
    setStatus('მიპასუხეს ✓', 'waiting', num);
  } else {
    state.stats.missed++;
    addHistory(num, 'bad', elapsed >= TIMEOUT_SEC ? '30 წმ — პასუხი არა' : 'არ მიპასუხეს');
    setStatus('არ მიპასუხეს', 'waiting', num);
  }
  state.index++;
  updateQueueProgress();

  if (state.running && state.index < state.queue.length) {
    showNextCallModal(state.queue[state.index]);
  } else if (state.running) {
    finishQueue();
  }
}

function showNextCallModal(num) {
  $('modal-number').textContent = formatPhone(num);
  $('modal-label').textContent = `შემდეგი (${state.index + 1}/${state.queue.length})`;
  const modal = $('next-call-modal');
  modal.classList.remove('hidden');

  clearTimeout(modal._timer);
  modal._timer = setTimeout(() => {
    if (!modal.classList.contains('hidden')) triggerNextCall();
  }, 3000);
}

function hideNextCallModal() {
  clearTimeout($('next-call-modal')._timer);
  $('next-call-modal').classList.add('hidden');
}

function triggerNextCall() {
  hideNextCallModal();
  if (state.running && !state.paused) callCurrent();
}

function showTimeoutAlert() {
  $('timeout-modal').classList.remove('hidden');
  vibrate();
}

function finishQueue() {
  state.running = false;
  state.waitingReturn = false;
  stopTimer();
  hideNextCallModal();
  setRunningUI(false);
  setStatus('ყველა ნომერზე დასრულდა 🎉', 'done');
  updateQueueProgress();
}

function stopQueue() {
  state.running = false;
  state.paused = false;
  state.waitingReturn = false;
  stopTimer();
  hideNextCallModal();
  $('timeout-modal').classList.add('hidden');
  setRunningUI(false);
  setStatus('გაჩერებულია', 'idle');
  updateQueueProgress();
}

function skipCurrent() {
  if (!state.running) return;
  state.waitingReturn = false;
  stopTimer();
  const num = state.queue[state.index];
  addHistory(num, 'skip', 'გამოტოვებული');
  state.index++;
  updateQueueProgress();
  if (state.index < state.queue.length) {
    callCurrent();
  } else {
    finishQueue();
  }
}

function togglePause() {
  if (!state.running) return;
  state.paused = !state.paused;
  $('btn-pause').textContent = state.paused ? 'გაგრძელება' : 'პაუზა';
  if (state.paused) {
    stopTimer();
    setStatus('პაუზაზეა', 'waiting');
  } else if (!state.waitingReturn) {
    callCurrent();
  }
}

// ── SMS ──
function renderSmsTemplates() {
  const el = $('sms-templates');
  el.innerHTML = SMS_TEMPLATES.map(t => `
    <div class="tpl ${t.id === state.selectedSmsId ? 'selected' : ''}" data-id="${t.id}">
      <div class="tpl-head">
        <h3>${t.title}</h3>
        <button class="tpl-send" data-id="${t.id}" type="button">გაგზავნა</button>
      </div>
      <p>${t.message}</p>
    </div>
  `).join('');

  el.querySelectorAll('.tpl').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('tpl-send')) return;
      state.selectedSmsId = +card.dataset.id;
      renderSmsTemplates();
    });
  });

  el.querySelectorAll('.tpl-send').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tmpl = SMS_TEMPLATES.find(t => t.id === +btn.dataset.id);
      sendSms(tmpl);
    });
  });
}

function sendSms(tmpl) {
  let num = $('sms-number').value.trim()
    || (state.index > 0 ? state.queue[state.index - 1] : '')
    || parseNumbers($('numbers-input').value)[0]
    || '';
  num = normalizeTel(num);
  if (!num) { toast('მიუთითე ნომერი'); return; }
  window.location.href = `sms:${num}?body=${encodeURIComponent(tmpl.message)}`;
}

function useCurrentNumber() {
  const num = state.running && state.queue[state.index]
    ? state.queue[state.index]
    : state.index > 0 ? state.queue[state.index - 1]
    : parseNumbers($('numbers-input').value)[0];
  if (num) {
    $('sms-number').value = num;
    toast('ნომერი ჩასმულია');
  } else {
    toast('ნომერი ვერ მოიძებნა');
  }
}

// ── Events ──
$('numbers-input').addEventListener('input', updateNumbersUI);
$('btn-start').addEventListener('click', startQueue);
$('btn-stop').addEventListener('click', stopQueue);
$('btn-pause').addEventListener('click', togglePause);
$('btn-skip-current').addEventListener('click', skipCurrent);
$('btn-call-next').addEventListener('click', triggerNextCall);
$('btn-skip-next').addEventListener('click', () => {
  hideNextCallModal();
  skipCurrent();
});
$('btn-timeout-ok').addEventListener('click', () => $('timeout-modal').classList.add('hidden'));
$('btn-sms-current').addEventListener('click', useCurrentNumber);

$('btn-paste').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      $('numbers-input').value = text;
      updateNumbersUI();
      toast('ჩასმულია');
    }
  } catch {
    toast('ჩასმა ვერ მოხერხდა — ხელით ჩასვი');
  }
});

$('btn-clear').addEventListener('click', () => {
  $('numbers-input').value = '';
  updateNumbersUI();
  localStorage.removeItem('savedNumbers');
});

$('btn-clear-history').addEventListener('click', () => {
  saveHistory([]);
  renderHistory();
  toast('ისტორია გასუფთავდა');
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    setTimeout(onReturnFromCall, 400);
  }
});

window.addEventListener('pageshow', (e) => {
  if (e.persisted) setTimeout(onReturnFromCall, 400);
});

// ── Init ──
const saved = localStorage.getItem('savedNumbers');
if (saved) $('numbers-input').value = saved;
updateNumbersUI();
renderSmsTemplates();
renderHistory();
setStatus('ჩასვი ნომრები და დააჭირე დაწყებას', 'idle');

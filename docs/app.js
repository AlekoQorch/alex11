const SMS_TEMPLATES = [
  { id: 1, title: 'ზარის მოთხოვნა', message: 'გამარჯობა! გთხოვთ დაგვიბრუნოთ ზარი, როცა შეძლებთ. გმადლობთ!' },
  { id: 2, title: 'შეხსენება', message: 'გამარჯობა! გიგზავნით შეხსენებას — გთხოვთ დაგვიკავშირდეთ დღესვე. გმადლობთ!' },
  { id: 3, title: 'ვიზიტის დადასტურება', message: 'გამარჯობა! თქვენი ვიზიტი დადასტურებულია. დამატებითი კითხვებისთვის დაგვიკავშირდით.' },
  { id: 4, title: 'გადახდის შეხსენება', message: 'გამარჯობა! გიგზავნით შეხსენებას გადასახადის გადახდის შესახებ. გმადლობთ ყურადღებისთვის!' },
  { id: 5, title: 'მადლობა', message: 'გმადლობთ ჩვენთან კავშირისთვის! საჭიროების შემთხვევაში ნებისმიერ დროს დაგვიკავშირდით.' }
];

const TIMEOUT_SEC = 30;

const state = {
  queue: [],
  index: 0,
  running: false,
  callStartTime: null,
  timerInterval: null,
  selectedSmsId: 1,
  waitingReturn: false,
  timeoutShown: false
};

// ── DOM ──
const $ = (id) => document.getElementById(id);
const numbersInput = $('numbers-input');
const numbersCount = $('numbers-count');
const statusText = $('status-text');
const statusDot = $('status-dot');
const progressWrap = $('progress-wrap');
const progressFill = $('progress-fill');
const timerText = $('timer-text');
const lastResult = $('last-result');
const progressHint = $('progress-hint');
const btnStart = $('btn-start');
const btnStop = $('btn-stop');
const smsNumber = $('sms-number');
const smsTemplates = $('sms-templates');
const nextCallOverlay = $('next-call-overlay');
const timeoutOverlay = $('timeout-overlay');

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

// ── UI updates ──
function setStatus(text, mode = 'idle') {
  statusText.textContent = text;
  statusDot.className = 'status-dot' + (mode === 'active' ? ' active' : mode === 'waiting' ? ' waiting' : '');
}

function updateNumbersCount() {
  const count = parseNumbers(numbersInput.value).length;
  numbersCount.textContent = `ნაპოვნი ნომრები: ${count}`;
}

function showProgress(show) {
  progressWrap.classList.toggle('hidden', !show);
}

function startTimer() {
  stopTimer();
  state.callStartTime = Date.now();
  state.timeoutShown = false;
  showProgress(true);
  updateTimerDisplay();

  state.timerInterval = setInterval(() => {
    updateTimerDisplay();
    const elapsed = (Date.now() - state.callStartTime) / 1000;
    if (elapsed >= TIMEOUT_SEC && !state.timeoutShown) {
      state.timeoutShown = true;
      showTimeoutAlert();
      vibrate();
    }
  }, 500);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  showProgress(false);
}

function updateTimerDisplay() {
  if (!state.callStartTime) return;
  const elapsed = (Date.now() - state.callStartTime) / 1000;
  const remaining = Math.max(0, TIMEOUT_SEC - elapsed);
  progressFill.style.width = `${(remaining / TIMEOUT_SEC) * 100}%`;
  timerText.textContent = `${Math.ceil(remaining)} წმ`;
}

function vibrate() {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// ── Dialer ──
function dialNumber(num) {
  window.location.href = `tel:${normalizeTel(num)}`;
}

function startQueue() {
  state.queue = parseNumbers(numbersInput.value);
  if (!state.queue.length) {
    setStatus('შეიყვანე მაინც ერთი ნომერი');
    return;
  }
  state.index = 0;
  state.running = true;
  btnStart.disabled = true;
  btnStop.disabled = false;
  numbersInput.disabled = true;
  localStorage.setItem('savedNumbers', numbersInput.value);
  callCurrent();
}

function callCurrent() {
  if (!state.running || state.index >= state.queue.length) {
    finishQueue();
    return;
  }

  const num = state.queue[state.index];
  setStatus(`ირეკება: ${num} (${state.index + 1}/${state.queue.length})`, 'active');
  progressHint.textContent = `პროგრესი: ${state.index}/${state.queue.length}`;
  lastResult.classList.add('hidden');
  state.waitingReturn = true;

  startTimer();
  dialNumber(num);
}

function onReturnFromCall() {
  if (!state.running || !state.waitingReturn) return;
  state.waitingReturn = false;
  stopTimer();

  const num = state.queue[state.index];
  const elapsed = state.callStartTime ? (Date.now() - state.callStartTime) / 1000 : 0;
  const answered = elapsed > 8 && elapsed < TIMEOUT_SEC;
  const result = elapsed >= TIMEOUT_SEC
    ? `${num} — არ მიპასუხეს (30 წმ)`
    : answered
      ? `${num} — მიპასუხეს ✓`
      : `${num} — არ მიპასუხეს`;

  lastResult.textContent = result;
  lastResult.classList.remove('hidden');
  setStatus(result, 'waiting');

  state.index++;
  if (state.running && state.index < state.queue.length) {
    showNextCallOverlay(state.queue[state.index]);
  } else if (state.running) {
    finishQueue();
  }
}

function showNextCallOverlay(num) {
  $('overlay-number').textContent = num;
  $('overlay-title').textContent = `შემდეგი ნომერი (${state.index + 1}/${state.queue.length})`;
  nextCallOverlay.classList.remove('hidden');

  let count = 3;
  const countdownEl = $('overlay-countdown');
  countdownEl.textContent = `${count} წამში ავტომატურად...`;

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownEl.textContent = `${count} წამში ავტომატურად...`;
    } else {
      clearInterval(interval);
      countdownEl.textContent = '';
      triggerNextCall();
    }
  }, 1000);

  nextCallOverlay._countdownInterval = interval;
}

function hideNextCallOverlay() {
  if (nextCallOverlay._countdownInterval) {
    clearInterval(nextCallOverlay._countdownInterval);
  }
  nextCallOverlay.classList.add('hidden');
}

function triggerNextCall() {
  hideNextCallOverlay();
  if (state.running) callCurrent();
}

function showTimeoutAlert() {
  timeoutOverlay.classList.remove('hidden');
  vibrate();
}

function finishQueue() {
  state.running = false;
  state.waitingReturn = false;
  stopTimer();
  hideNextCallOverlay();
  btnStart.disabled = false;
  btnStop.disabled = true;
  numbersInput.disabled = false;
  setStatus('ყველა ნომერზე დასრულდა 🎉');
  progressHint.textContent = '';
}

function stopQueue() {
  state.running = false;
  state.waitingReturn = false;
  stopTimer();
  hideNextCallOverlay();
  timeoutOverlay.classList.add('hidden');
  btnStart.disabled = false;
  btnStop.disabled = true;
  numbersInput.disabled = false;
  setStatus('გაჩერებულია');
}

// ── SMS ──
function renderSmsTemplates() {
  smsTemplates.innerHTML = SMS_TEMPLATES.map(t => `
    <div class="sms-item ${t.id === state.selectedSmsId ? 'selected' : ''}" data-id="${t.id}">
      <h3>${t.title}</h3>
      <p>${t.message}</p>
      <button class="btn-send" data-id="${t.id}">📨 გაგზავნა</button>
      <div style="clear:both"></div>
    </div>
  `).join('');

  smsTemplates.querySelectorAll('.sms-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-send')) return;
      state.selectedSmsId = +el.dataset.id;
      renderSmsTemplates();
    });
  });

  smsTemplates.querySelectorAll('.btn-send').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tmpl = SMS_TEMPLATES.find(t => t.id === +btn.dataset.id);
      sendSms(tmpl);
    });
  });
}

function sendSms(tmpl) {
  let num = smsNumber.value.trim() || state.queue[state.index - 1] || parseNumbers(numbersInput.value)[0] || '';
  num = normalizeTel(num);
  if (!num) { alert('მიუთითე ნომერი SMS-ისთვის'); return; }
  const body = encodeURIComponent(tmpl.message);
  window.location.href = `sms:${num}?body=${body}`;
}

// ── Events ──
numbersInput.addEventListener('input', updateNumbersCount);

btnStart.addEventListener('click', startQueue);
btnStop.addEventListener('click', stopQueue);

$('btn-call-next').addEventListener('click', triggerNextCall);
$('btn-skip').addEventListener('click', () => {
  hideNextCallOverlay();
  if (state.running) callCurrent();
});
$('btn-timeout-ok').addEventListener('click', () => timeoutOverlay.classList.add('hidden'));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    setTimeout(onReturnFromCall, 300);
  }
});

window.addEventListener('pageshow', (e) => {
  if (e.persisted) setTimeout(onReturnFromCall, 300);
});

// ── Install banner (iOS Safari) ──
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
if (isIOS && !isStandalone && !localStorage.getItem('installDismissed')) {
  $('install-banner').classList.remove('hidden');
}
$('dismiss-install').addEventListener('click', () => {
  $('install-banner').classList.add('hidden');
  localStorage.setItem('installDismissed', '1');
});

// ── Init ──
const saved = localStorage.getItem('savedNumbers');
if (saved) numbersInput.value = saved;
updateNumbersCount();
renderSmsTemplates();

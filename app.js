import { db, STORES } from './db.js';
import { viewManual } from './manual.js';
import { createSync } from './sync.js';
import { firebaseConfig } from './firebase-config.js';
import { installAcademia, dueCards } from './academia.js';
import { installMetas, listState, quarterOf } from './metas.js';
import { installRevisao } from './revisao.js';

/* =========================================================================
   Utilidades
   ========================================================================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fromYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtLong = (s) => fromYmd(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = (s) => fromYmd(s).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const hhmm = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? pad(m % 60) : ''}` : `${m} min`);
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento: segue sem persistir */ } };

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* =========================================================================
   Estado (cópia em memória do IndexedDB, gravação imediata a cada mudança)
   ========================================================================= */
const DEFAULTS = { id: 'settings', focus: 25, short: 5, long: 20, autoBreak: true, sound: true };
const LISTS = ['tasks', 'sessions', 'journal', 'habits', 'habitLogs', 'cards', 'notes', 'goals', 'premortems', 'reviews'];
const S = { settings: { ...DEFAULTS }, tombstones: [] };
for (const k of LISTS) S[k] = [];
const SCHEMA = 4; // muda quando surgem coleções novas (ver sync.js)
let sync = null; // controlador de sincronização (criado no init)
let syncState = { status: 'off' };

async function load() {
  for (const k of LISTS) S[k] = (await db.all(k)) || [];
  const st = await db.get('settings', 'settings');
  S.settings = st ? { ...DEFAULTS, ...st } : { ...DEFAULTS };
  S.tombstones = (await db.all('tombstones')) || [];
  // Exclusões com mais de 90 dias já não importam para nenhum aparelho.
  const old = Date.now() - 90 * 86400000;
  for (const t of S.tombstones.filter((x) => x.u < old)) await db.del('tombstones', t.id);
  S.tombstones = S.tombstones.filter((x) => x.u >= old);
}
const tombKey = (store, id) => `${store}~${id}`;
async function dropTombstone(store, id) {
  const k = tombKey(store, id);
  if (!S.tombstones.some((t) => t.id === k)) return;
  S.tombstones = S.tombstones.filter((t) => t.id !== k);
  await db.del('tombstones', k);
}
// remote = true quando a mudança veio da nuvem: mantém a hora original e não reenvia.
async function save(store, obj, remote = false) {
  if (!remote) obj.updatedAt = Date.now();
  const arr = S[store];
  const i = arr.findIndex((x) => x.id === obj.id);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
  try {
    await db.put(store, obj);
    await dropTombstone(store, obj.id);
  } catch (e) { console.error(e); toast('Erro ao gravar. Faça um backup em Dados.'); }
  if (!remote) sync?.track(store, obj.id);
}
async function remove(store, id, remote = false) {
  S[store] = S[store].filter((x) => x.id !== id);
  try {
    await db.del(store, id);
    if (remote) await dropTombstone(store, id);
    else {
      const t = { id: tombKey(store, id), s: store, i: id, u: Date.now() };
      S.tombstones = S.tombstones.filter((x) => x.id !== t.id).concat(t);
      await db.put('tombstones', t);
    }
  } catch (e) { console.error(e); toast('Erro ao apagar.'); }
  if (!remote) sync?.track(store, id);
}
async function saveSettings() {
  S.settings.updatedAt = Date.now();
  await db.put('settings', S.settings);
  sync?.track('settings', 'settings');
}

/* ---------- Ponte com a sincronização ---------- */
const entryOf = (s, r) => ({ s, i: r.id, u: r.updatedAt || r.createdAt || 0, d: false, v: r });
const syncHooks = {
  localEntries: () => [
    ...LISTS.flatMap((s) => S[s].map((r) => entryOf(s, r))),
    entryOf('settings', S.settings),
    ...S.tombstones.map((t) => ({ s: t.s, i: t.i, u: t.u, d: true, v: null })),
  ],
  localEntry: (s, i) => {
    if (s === 'settings') return entryOf('settings', S.settings);
    const r = S[s]?.find((x) => x.id === i);
    if (r) return entryOf(s, r);
    const t = S.tombstones.find((x) => x.id === tombKey(s, i));
    return t ? { s, i, u: t.u, d: true, v: null } : null;
  },
  apply: async (entries) => {
    for (const e of entries) {
      if (e.s === 'settings') {
        if (e.v) { S.settings = { ...DEFAULTS, ...e.v, id: 'settings', updatedAt: e.u }; await db.put('settings', S.settings); }
      } else if (LISTS.includes(e.s)) {
        if (e.d) await remove(e.s, e.i, true);
        else await save(e.s, { ...e.v, id: e.i, updatedAt: e.u }, true);
      }
    }
    scheduleRender();
  },
  clearTombstone: (s, i) => { dropTombstone(s, i); },
  onChange: (state) => {
    syncState = state;
    paintSync();
    if (current === 'dados') scheduleRender();
  },
};

// Não redesenha a tela enquanto a pessoa está digitando; espera ela sair do campo.
// "Sujo" = campo de texto com conteúdo diferente do que foi desenhado (digitação não salva).
let renderPending = false;
const hasUnsavedTyping = () => [...document.querySelectorAll('#main input:not([type=checkbox]):not([type=radio]):not([type=file]), #main textarea')]
  .some((el) => el.value !== el.defaultValue);
function scheduleRender() {
  if (hasUnsavedTyping()) { renderPending = true; return; }
  renderPending = false;
  render();
}
document.addEventListener('focusout', () => {
  setTimeout(() => { if (renderPending) scheduleRender(); }, 0);
});

const SYNC_LABEL = {
  loading: ['Conectando…', 'busy'], signedOut: ['Sincronização: entrar', 'idle'], syncing: ['Sincronizando…', 'busy'],
  ok: ['Sincronizado', 'ok'], offline: ['Offline · salvo no aparelho', 'idle'], error: ['Erro de sincronização', 'err'],
  unavailable: ['Sincronização indisponível', 'idle'],
};
function paintSync() {
  const el = $('#sync-badge');
  if (!el) return;
  const lbl = SYNC_LABEL[syncState.status];
  el.hidden = !lbl;
  if (lbl) { el.textContent = lbl[0]; el.dataset.kind = lbl[1]; }
  $('.nav-data')?.setAttribute('data-sync', lbl ? lbl[1] : '');
}

/* ---------- Consultas ---------- */
const Q = {
  1: { n: 'Faça', d: 'Urgente e importante' },
  2: { n: 'Agende', d: 'Importante, não urgente' },
  3: { n: 'Delegue', d: 'Urgente, não importante' },
  4: { n: 'Elimine', d: 'Nem urgente, nem importante' },
};
const openTasks = () => S.tasks.filter((t) => t.status === 'open');
const byPriority = (a, b) => a.quadrant - b.quadrant || b.impact - a.impact || a.createdAt - b.createdAt;
const taskById = (id) => S.tasks.find((t) => t.id === id);
const focusMin = (date) => S.sessions.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0);
const pomosOn = (date) => S.sessions.filter((s) => s.date === date && s.completed).length;
const doneOn = (date) => S.tasks.filter((t) => t.status === 'done' && t.doneDate === date);
const activeHabits = () => S.habits.filter((h) => !h.archived).sort((a, b) => a.createdAt - b.createdAt);
const hLogId = (hid, date) => `${hid}|${date}`;
const hDone = (hid, date) => S.habitLogs.some((l) => l.id === hLogId(hid, date));
function streak(hid) {
  let d = new Date();
  if (!hDone(hid, ymd(d))) d = addDays(d, -1); // hoje ainda pode ser feito: não quebra a sequência
  let n = 0;
  while (hDone(hid, ymd(d))) { n++; d = addDays(d, -1); }
  return n;
}
function lastChangeFor(today) {
  // A "mudança para amanhã" do último diário anterior a hoje vira o lembrete do dia.
  return S.journal.filter((j) => j.date < today && j.change?.trim()).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

/* =========================================================================
   Temporizador Pomodoro
   Conta por horário de término (Date.now), não por "ticks", para não atrasar
   quando a janela fica em segundo plano. Os ticks vêm de um Web Worker, que
   o navegador não estrangula como faz com setInterval em abas ocultas.
   ========================================================================= */
const PHASE = { focus: 'Foco', short: 'Pausa', long: 'Pausa longa' };
const T = Object.assign(
  { phase: 'focus', running: false, endAt: 0, remaining: null, total: 0, startedAt: 0, cycle: 0, taskId: null },
  lsGet('arsenal.timer') || {}
);
const persistTimer = () => lsSet('arsenal.timer', T);
const phaseLen = (p) => (p === 'focus' ? S.settings.focus : p === 'short' ? S.settings.short : S.settings.long) * 60000;
const fresh = () => !T.running && T.remaining == null;
const remainingMs = () => (T.running ? Math.max(0, T.endAt - Date.now()) : T.remaining ?? phaseLen(T.phase));
const fmtClock = (ms) => { const s = Math.ceil(ms / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };

let audioCtx;
function unlockAudio() {
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch { /* sem áudio */ }
}
function beep() {
  if (!S.settings.sound || !audioCtx) return;
  const t0 = audioCtx.currentTime;
  [0, 0.28, 0.56].forEach((off, i) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = i === 2 ? 988 : 784;
    g.gain.setValueAtTime(0.0001, t0 + off);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + off + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.22);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0 + off);
    o.stop(t0 + off + 0.25);
  });
}
async function notify(title, body) {
  beep();
  toast(`${title}. ${body}`);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(title, { body, icon: 'icon.svg', tag: 'arsenal-timer' });
    else new Notification(title, { body, icon: 'icon.svg' });
  } catch { /* notificação indisponível */ }
}

function timerStart() {
  if (T.running) return;
  unlockAudio();
  if (T.remaining == null) { T.total = phaseLen(T.phase); T.remaining = T.total; T.startedAt = Date.now(); }
  T.endAt = Date.now() + T.remaining;
  T.running = true;
  persistTimer();
  timerUI(true);
}
function timerPause() {
  if (!T.running) return;
  T.remaining = Math.max(0, T.endAt - Date.now());
  T.running = false;
  persistTimer();
  timerUI(true);
}
async function logSession(ms, completed) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return;
  const task = taskById(T.taskId);
  await save('sessions', {
    id: uid(), date: ymd(new Date(T.startedAt || Date.now())), start: T.startedAt || Date.now(), end: Date.now(),
    minutes, completed, taskId: task?.id || null, taskTitle: task?.title || '',
  });
}
async function timerStop() {
  // Interromper o foco registra o tempo já feito (se passou de 1 minuto) como sessão parcial.
  if (T.phase === 'focus' && T.remaining != null) await logSession(T.total - remainingMs(), false);
  Object.assign(T, { running: false, remaining: null, phase: 'focus' });
  persistTimer();
  timerUI(true);
}
async function timerSkip() {
  if (T.phase === 'focus') {
    if (T.remaining != null) await logSession(T.total - remainingMs(), false);
    T.cycle++;
    T.phase = T.cycle % 4 === 0 ? 'long' : 'short';
  } else {
    T.phase = 'focus';
  }
  Object.assign(T, { running: false, remaining: null });
  persistTimer();
  timerUI(true);
}
let completing = false;
async function timerComplete() {
  if (completing) return;
  completing = true;
  const late = Date.now() - T.endAt > 60000; // app estava fechado quando acabou
  const p = T.phase;
  T.running = false;
  if (p === 'focus') {
    await logSession(T.total, true);
    T.cycle++;
    T.phase = T.cycle % 4 === 0 ? 'long' : 'short';
    T.remaining = null;
    if (!late) notify('Foco concluído', T.phase === 'long' ? 'Pausa longa: descanse de verdade.' : 'Pausa: caminhe, alongue-se, hidrate-se.');
    if (S.settings.autoBreak && !late) timerStart();
  } else {
    T.phase = 'focus';
    T.remaining = null;
    if (!late) notify('Pausa encerrada', 'Pronto para o próximo ciclo?');
  }
  persistTimer();
  completing = false;
  timerUI(true);
}
function onTick() {
  if (T.running && T.endAt - Date.now() <= 0) timerComplete();
  else paintTimer();
}
function startTicker() {
  try {
    const src = 'setInterval(() => postMessage(0), 500);';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = onTick;
  } catch {
    setInterval(onTick, 500);
  }
  document.addEventListener('visibilitychange', onTick);
}

function paintTimer() {
  const ms = remainingMs();
  const clock = fmtClock(ms);
  const d = $('#t-display');
  if (d) d.textContent = clock;
  const ring = $('#t-ring');
  if (ring) {
    const total = fresh() ? phaseLen(T.phase) : T.total || phaseLen(T.phase);
    ring.style.setProperty('--p', Math.min(1, Math.max(0, 1 - ms / total)).toFixed(4));
  }
  const mini = $('#mini');
  const active = !fresh();
  mini.hidden = !active;
  if (active) {
    mini.classList.toggle('paused', !T.running);
    mini.innerHTML = `<span><i class="dot"></i>${PHASE[T.phase]}</span><span>${clock}</span>`;
  }
  document.title = active ? `${clock} · ${PHASE[T.phase]} — ARSENAL` : 'ARSENAL';
}
function timerUI(full) {
  if (full && current === 'foco') render();
  else paintTimer();
}

/* ---------- Contagem 5-4-3-2-1 (regra dos 5 segundos) ---------- */
let launchTimers = [];
function cancelLaunch() {
  launchTimers.forEach(clearTimeout);
  launchTimers = [];
  $('#launch').hidden = true;
}
function launch(taskId) {
  unlockAudio();
  if (T.running) { location.hash = '#/foco'; return; }
  if (taskId) T.taskId = taskId;
  const box = $('#launch');
  const num = $('#launch-num');
  box.hidden = false;
  const show = (txt, go) => {
    num.classList.toggle('go', !!go);
    num.innerHTML = txt;
    num.style.animation = 'none';
    void num.offsetWidth; // reinicia a animação
    num.style.animation = '';
  };
  [5, 4, 3, 2, 1].forEach((n, i) => launchTimers.push(setTimeout(() => show(n), i * 1000)));
  launchTimers.push(setTimeout(() => show('MOVA O<br>SEU CORPO', true), 5000));
  launchTimers.push(setTimeout(() => {
    cancelLaunch();
    if (fresh() && T.phase !== 'focus') T.phase = 'focus';
    location.hash = '#/foco';
    timerStart();
  }, 5800));
}

/* =========================================================================
   Telas
   ========================================================================= */
const head = (kicker, title, sub, rules = []) => `
  <header class="view-head">
    <div class="kicker">${kicker}</div>
    <h1>${title}</h1>
    ${sub ? `<p class="sub">${sub}</p>` : ''}
    ${rules.length ? `<div class="rules">${rules.map((r) => {
      const n = /Regra (\d+)/.exec(r)?.[1];
      return n ? `<a class="rule" href="#/manual/${n}" title="Ver no manual">${r} ↗</a>` : `<span class="rule">${r}</span>`;
    }).join('')}</div>` : ''}
  </header>`;
const dots = (n) => `<span class="impact" title="Impacto ${n} de 5" aria-label="Impacto ${n} de 5">${'●'.repeat(n)}${'○'.repeat(5 - n)}</span>`;
const taskOptions = (selected, filter = () => true) => openTasks().filter(filter).sort(byPriority)
  .map((t) => `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${t.quadrant}· ${esc(t.title)}</option>`).join('');

/* ---------- 01 Painel ---------- */
function studyCard(today) {
  const due = dueCards(S.cards, today).length;
  const st = listState(S.goals.filter((g) => g.quarter === quarterOf(today)));
  if (!S.cards.length && !S.goals.length) return `<div class="card"><div class="card-head"><h2>Revisão semanal</h2><a class="link" href="#/revisao">Abrir →</a></div><p class="muted" style="margin:0">30 minutos no fim da semana: números, diários, matriz, metas e o foco da próxima.</p></div>`;
  return `<div class="card">
    <div class="card-head"><h2>Estudo e metas</h2><a class="link" href="#/revisao">Revisão semanal →</a></div>
    <div class="htoday"><span>${due ? `<b>${due}</b> cartão(ões) para revisar hoje` : 'Nenhum cartão para revisar hoje'}</span><a class="link" href="#/academia">Academia →</a></div>
    <div class="htoday"><span>Metas do trimestre: <b>${st.doneTop}</b> de ${st.top.length || 5} concluídas</span><a class="link" href="#/metas">Metas →</a></div>
  </div>`;
}
function viewPainel() {
  const today = ymd();
  const pri = openTasks().filter((t) => t.today).sort(byPriority);
  const change = lastChangeFor(today);
  const habits = activeHabits();
  const hDoneToday = habits.filter((h) => hDone(h.id, today)).length;
  const journalToday = S.journal.find((j) => j.date === today);
  const q1Open = openTasks().filter((t) => t.quadrant === 1).length;

  const days = [...Array(7)].map((_, i) => ymd(addDays(new Date(), i - 6)));
  const mins = days.map(focusMin);
  const max = Math.max(60, ...mins);
  const week = mins.reduce((a, b) => a + b, 0);

  const slots = [0, 1, 2].map((i) => {
    const t = pri[i];
    if (t) {
      return `<li><span class="n">${i + 1}</span>
        <span class="t">${esc(t.title)}<span class="qtag">${t.quadrant} · ${Q[t.quadrant].n}</span></span>
        <span class="row"><button type="button" class="btn sm primary" data-act="launch" data-id="${t.id}" title="Contar 5-4-3-2-1 e iniciar um Pomodoro">5s ▶</button>
        <button type="button" class="chk" data-act="done" data-id="${t.id}" title="Concluir" aria-label="Concluir ${esc(t.title)}">✓</button>
        <button type="button" class="icon on" data-act="star" data-id="${t.id}" title="Tirar das prioridades" aria-label="Tirar das prioridades">★</button></span></li>`;
    }
    const opts = taskOptions(null, (x) => !x.today && x.quadrant !== 4);
    return `<li><span class="n">${i + 1}</span>
      ${opts ? `<select data-change="setPriority" aria-label="Escolher prioridade ${i + 1}"><option value="">Escolher uma tarefa…</option>${opts}</select>` : `<span class="empty-slot">Nenhuma tarefa aberta. <a href="#/tarefas">Adicionar</a></span>`}
      <span></span></li>`;
  }).join('');

  return `
  ${head(`01 · ${fmtLong(today)}`, 'O que preciso fazer hoje?', 'Três prioridades, foco registrado e um minuto de reflexão à noite. O resto é ruído.')}
  ${revisao.painelCallouts(today)}
  ${change ? `<div class="callout" style="margin-bottom:20px"><div class="t">Mudança que você decidiu ontem</div><p>${esc(change.change)}</p></div>` : ''}
  <div class="grid g4" style="margin-bottom:20px">
    <div class="card stat"><div class="v">${fmtMin(focusMin(today)).replace(' min', '<small>min</small>')}</div><div class="l">de foco hoje · ${pomosOn(today)} pomodoro(s)</div></div>
    <div class="card stat"><div class="v">${doneOn(today).length}</div><div class="l">tarefas concluídas hoje</div></div>
    <div class="card stat"><div class="v">${hDoneToday}<small>/${habits.length}</small></div><div class="l">hábitos de hoje</div></div>
    <div class="card stat"><div class="v">${q1Open}</div><div class="l">abertas na casinha 1 (Faça)</div></div>
  </div>
  <div class="grid g2">
    <div class="card accent">
      <div class="card-head"><h2>Prioridades do dia</h2><a class="link" href="#/tarefas">Matriz →</a></div>
      <ol class="prio">${slots}</ol>
      <p class="muted small" style="margin:14px 0 0">Marque com ★ na matriz ou escolha aqui. Máximo de três.</p>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-head"><h2>Foco nos últimos 7 dias</h2><span class="muted small">${fmtMin(week)} no total</span></div>
        <div class="bars" role="img" aria-label="Minutos de foco por dia nos últimos sete dias">
          ${days.map((d, i) => `<div class="bar ${d === today ? 'today' : ''}"><span class="m">${mins[i] || ''}</span><div class="col" style="height:${(mins[i] / max) * 100}%"></div><span class="d">${fromYmd(d).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span></div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Hábitos de hoje</h2><a class="link" href="#/habitos">Hábitos →</a></div>
        ${habits.length ? habits.map((h) => `<div class="htoday"><span>${esc(h.action)}</span>
          <button type="button" class="chk ${hDone(h.id, today) ? 'on' : ''}" data-act="hlog" data-h="${h.id}" data-d="${today}" aria-pressed="${hDone(h.id, today)}" aria-label="Marcar ${esc(h.action)}">✓</button></div>`).join('')
          : `<p class="empty">Nenhum hábito ainda. <a href="#/habitos">Criar o primeiro</a></p>`}
      </div>
      ${studyCard(today)}
      <div class="card">
        <div class="card-head"><h2>Diário de hoje</h2><a class="link" href="#/diario">${journalToday ? 'Rever →' : 'Escrever →'}</a></div>
        <p class="muted" style="margin:0">${journalToday ? 'Feito. Ciclo fechado.' : 'Pendente. Leva uns 10 minutos, de preferência à noite.'}</p>
      </div>
    </div>
  </div>`;
}

/* ---------- 02 Tarefas ---------- */
function taskItem(t) {
  const q4 = t.quadrant === 4;
  return `<li class="task" draggable="true" data-drag="${t.id}">
    <button type="button" class="chk ${q4 ? 'x' : ''}" data-act="${q4 ? 'eliminate' : 'done'}" data-id="${t.id}" title="${q4 ? 'Eliminar' : 'Concluir'}" aria-label="${q4 ? 'Eliminar' : 'Concluir'} ${esc(t.title)}">${q4 ? '✕' : '✓'}</button>
    <span class="t">${esc(t.title)}</span>
    ${dots(t.impact)}
    <button type="button" class="icon ${t.today ? 'on' : ''}" data-act="star" data-id="${t.id}" title="${t.today ? 'Tirar das prioridades do dia' : 'Prioridade do dia'}" aria-pressed="${!!t.today}" aria-label="Prioridade do dia">★</button>
    <details class="more"><summary aria-label="Opções">⋯</summary>
      <div class="menu">
        <div><div class="lbl">Mover para</div><div class="qbtns">${[1, 2, 3, 4].map((q) => `<button type="button" class="btn sm ${q === t.quadrant ? 'cur' : ''}" data-act="move" data-id="${t.id}" data-q="${q}" title="${Q[q].n}">${q}</button>`).join('')}</div></div>
        <label><div class="lbl">Impacto</div><select data-change="impact" data-id="${t.id}">${[1, 2, 3, 4, 5].map((n) => `<option ${n === t.impact ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <div class="row"><button type="button" class="btn sm" data-act="launch" data-id="${t.id}">5s ▶ Focar</button><button type="button" class="btn sm danger" data-act="delete" data-id="${t.id}">Excluir</button></div>
      </div>
    </details>
  </li>`;
}
function viewTarefas() {
  const today = ymd();
  const open = openTasks();
  const cell = (q) => {
    const list = open.filter((t) => t.quadrant === q).sort(byPriority);
    const hints = {
      1: 'Resolva hoje.',
      2: 'Onde mora o progresso. Reserve horário.',
      3: 'Passe adiante ou resolva em lote, rápido.',
      4: 'Não faça. Elimine com ✕.',
    };
    return `<section class="quad q${q}" data-drop="${q}" aria-label="Casinha ${q}: ${Q[q].n}">
      <h3>${q}: ${Q[q].n.toUpperCase()}.<small>${list.length}</small></h3>
      <p class="hint">${hints[q]}</p>
      <ul class="tasks">${list.map(taskItem).join('') || '<li class="empty">Vazio.</li>'}</ul>
    </section>`;
  };
  const doneToday = S.tasks.filter((t) => (t.status === 'done' || t.status === 'eliminated') && t.doneDate === today)
    .sort((a, b) => b.doneAt - a.doneAt);
  const quick = doneToday.filter((t) => t.quick).length;

  return `
  ${head('02 · Gestão de tarefas', 'Classifique cada tarefa em uma casinha.', 'Arraste entre os quadrantes ou use ⋯. Se leva menos de 2 minutos, não entra na lista: faça agora.', ['Regra 3 · Eisenhower', 'Regra 4 · 2 minutos', 'Regra 11 · 80/20 (na revisão semanal)'])}
  <form class="capture card" data-form="task" autocomplete="off">
    <div class="line">
      <input type="text" name="title" placeholder="Surgiu uma tarefa? Escreva aqui…" aria-label="Nova tarefa" maxlength="200">
      <button type="submit" class="btn primary">Adicionar</button>
      <button type="button" class="btn" data-act="quick" title="Registra como feita, sem ir para a lista">&lt; 2 min · feito agora</button>
    </div>
    <div class="row">
      <fieldset class="qpick"><legend class="muted small" style="float:left;margin-right:8px;padding-top:6px">Casinha</legend>
        ${[1, 2, 3, 4].map((q) => `<label><input type="radio" name="quadrant" value="${q}" ${q === 2 ? 'checked' : ''}><span>${q} · ${Q[q].n}</span></label>`).join('')}
      </fieldset>
      <label class="row small" style="gap:6px;margin-left:auto">Impacto <select name="impact">${[1, 2, 3, 4, 5].map((n) => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>
  </form>

  <div class="matrix">
    <div class="corner"></div><div class="axis-x">Urgente</div><div class="axis-x">Não urgente</div>
    <div class="axis-y">Importante</div>${cell(1)}${cell(2)}
    <div class="axis-y b">Não importante</div>${cell(3)}${cell(4)}
  </div>

  <div class="card" style="margin-top:24px">
    <div class="card-head"><h2>Resolvidas hoje</h2><span class="muted small">${doneToday.length} no total${quick ? ` · ${quick} pela regra dos 2 minutos` : ''}</span></div>
    <ul class="tasks done-list">${doneToday.map((t) => `<li class="task" style="grid-template-columns:26px 1fr auto">
      <button type="button" class="chk on" data-act="undo" data-id="${t.id}" title="Desfazer" aria-label="Desfazer ${esc(t.title)}">${t.status === 'eliminated' ? '✕' : '✓'}</button>
      <span class="t">${esc(t.title)}</span>
      <span class="muted small">${t.quick ? '2 min' : t.status === 'eliminated' ? 'eliminada' : hhmm(t.doneAt)}</span></li>`).join('') || '<li class="empty">Nada ainda.</li>'}</ul>
  </div>`;
}

/* ---------- 03 Foco ---------- */
function viewFoco() {
  const today = ymd();
  const sessions = S.sessions.filter((s) => s.date === today).sort((a, b) => b.start - a.start);
  const brk = T.phase !== 'focus';
  const controls = T.running
    ? `<button type="button" class="btn big dark" data-act="t-pause">Pausar</button>
       <button type="button" class="btn big" data-act="t-skip">${brk ? 'Pular pausa' : 'Encerrar ciclo'}</button>
       <button type="button" class="btn big ghost" data-act="t-stop">Parar</button>`
    : fresh()
      ? (brk
        ? `<button type="button" class="btn big primary" data-act="t-start">Iniciar ${PHASE[T.phase].toLowerCase()}</button>
           <button type="button" class="btn big" data-act="t-skip">Pular pausa</button>`
        : `<button type="button" class="btn big primary" data-act="launch">5-4-3-2-1 · Iniciar</button>
           <button type="button" class="btn big" data-act="t-start">Iniciar já</button>`)
      : `<button type="button" class="btn big primary" data-act="t-start">Retomar</button>
         <button type="button" class="btn big ghost" data-act="t-stop">Parar</button>`;
  const cyc = T.cycle % 4;
  const filled = brk && cyc === 0 && T.cycle > 0 ? 4 : cyc;

  return `
  ${head('03 · Central de foco', 'Uma tarefa. Celular longe.', `Foco de ${S.settings.focus} min, pausa de ${S.settings.short} min e, depois de 4 ciclos, pausa longa de ${S.settings.long} min.`, ['Regra 1 · 5 segundos', 'Regra 5 · Pomodoro', 'Regra 8 · Trabalho profundo'])}
  <div class="focus-wrap">
    <div class="card">
      <div id="t-ring" class="ring ${brk ? 'brk' : ''}">
        <div class="ring-in">
          <div id="t-display" class="t-display">${fmtClock(remainingMs())}</div>
          <div class="t-mode">${PHASE[T.phase]}${!T.running && !fresh() ? ' · pausado' : ''}</div>
          <div class="cycles" aria-label="Ciclo ${filled} de 4">${[0, 1, 2, 3].map((i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('')}</div>
        </div>
      </div>
      <label class="field" style="max-width:440px;margin:0 auto 18px"><span>Trabalhando em</span>
        <select data-change="timerTask"><option value="">Sem tarefa vinculada</option>${taskOptions(T.taskId, (t) => t.quadrant !== 4)}</select>
      </label>
      <div class="controls">${controls}</div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-head"><h2>Hoje</h2><span class="muted small">${fmtMin(focusMin(today))} · ${pomosOn(today)} completo(s)</span></div>
        <ul class="sessions">${sessions.map((s) => `<li><span>${hhmm(s.start)} · ${esc(s.taskTitle) || '<span class="muted">sem tarefa</span>'}${s.completed ? '' : '<span class="partial">parcial</span>'}</span><span class="min">${s.minutes} min</span></li>`).join('') || '<li class="empty">Nenhuma sessão ainda.</li>'}</ul>
      </div>
      <div class="card">
        <h2>Antes de um bloco profundo</h2>
        <ul class="dw">
          <li><label class="check"><input type="checkbox"> Notificações do Windows em “Não perturbe”</label></li>
          <li><label class="check"><input type="checkbox"> Celular em outro cômodo</label></li>
          <li><label class="check"><input type="checkbox"> Uma única tarefa de alto valor escolhida</label></li>
          <li><label class="check"><input type="checkbox"> Bloco de 2 a 4 h marcado na agenda</label></li>
        </ul>
        <p class="muted small" style="margin:12px 0 0">O app não consegue silenciar o Windows por você. Este checklist é só um lembrete.</p>
      </div>
    </div>
  </div>`;
}

/* ---------- 04 Diário ---------- */
function viewDiario() {
  const today = ymd();
  const j = S.journal.find((x) => x.date === today) || {};
  const past = S.journal.filter((x) => x.date !== today).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
  const since = ymd(addDays(new Date(), -29));
  const consistency = S.journal.filter((x) => x.date >= since).length;
  const prev = lastChangeFor(today);
  const field = (name, color, label, ph) => `
    <div class="jfield"><span class="dotc" style="background:${color}"></span>
      <label class="field"><span>${label}</span><textarea name="${name}" placeholder="${ph}" rows="3">${esc(j[name])}</textarea></label></div>`;

  return `
  ${head('04 · Evolução pessoal', 'Diário de reflexão.', 'Dez minutos, todas as noites. Mantenha curto: não é um diário íntimo, é um ciclo de retroalimentação.', ['Regra 13 · Diário de reflexão'])}
  <div class="grid g2">
    <form class="card stack" data-form="journal">
      <div class="card-head" style="margin:0"><h2 style="text-transform:capitalize">${fmtLong(today)}</h2>${j.date ? '<span class="muted small">salvo</span>' : ''}</div>
      ${prev ? `<div class="callout"><div class="t">Ontem você decidiu</div><p>${esc(prev.change)}</p></div>` : ''}
      ${field('good', 'var(--ok)', 'O que deu certo hoje', 'Uma ou duas linhas.')}
      ${field('bad', 'var(--bad)', 'O que não deu certo', 'Sem julgamento, só o fato.')}
      ${field('change', 'var(--warn)', 'Uma mudança específica para amanhã', 'Ex.: começar pelo relatório antes de abrir o e-mail.')}
      <label class="check small"><input type="checkbox" name="mkTask"> Criar tarefa com essa mudança (casinha 2 · Agende)</label>
      <div class="row"><button type="submit" class="btn primary">Salvar diário</button></div>
    </form>
    <div class="card">
      <div class="card-head"><h2>Registros anteriores</h2><span class="muted small">${consistency} de 30 dias · <a class="link" href="#/revisao">Revisão semanal →</a></span></div>
      <ul class="jlist">${past.map((x) => `<li><div class="date">${fmtShort(x.date)}</div>
        ${x.good ? `<p><i style="background:var(--ok)"></i><span>${esc(x.good)}</span></p>` : ''}
        ${x.bad ? `<p><i style="background:var(--bad)"></i><span>${esc(x.bad)}</span></p>` : ''}
        ${x.change ? `<p><i style="background:var(--warn)"></i><span>${esc(x.change)}</span></p>` : ''}</li>`).join('') || '<li class="empty">Os dias anteriores aparecem aqui.</li>'}</ul>
    </div>
  </div>`;
}

/* ---------- 05 Hábitos ---------- */
function viewHabitos() {
  const today = ymd();
  const habits = activeHabits();
  const days = [...Array(7)].map((_, i) => ymd(addDays(new Date(), i - 6)));
  const since = ymd(addDays(new Date(), -29));
  const rate = (h) => {
    const start = h.createdDate > since ? h.createdDate : since;
    const total = Math.round((fromYmd(today) - fromYmd(start)) / 86400000) + 1;
    const n = S.habitLogs.filter((l) => l.habitId === h.id && l.date >= start).length;
    return Math.round((n / Math.max(1, total)) * 100);
  };

  return `
  ${head('05 · Evolução pessoal', 'O hábito existente vira o gatilho.', 'Encaixe o novo hábito logo depois de algo que você já faz todo dia. Pequeno o bastante para não falhar.', ['Regra 10 · Empilhamento de hábitos', 'Regra 7 · 1% (metáfora, não cálculo)'])}
  <form class="card" data-form="habit" autocomplete="off" style="margin-bottom:20px">
    <div class="stack-form">
      <span class="w">Depois de</span>
      <input type="text" name="trigger" required maxlength="120" placeholder="servir meu café" aria-label="Hábito existente (gatilho)">
      <span class="w">, vou</span>
      <input type="text" name="action" required maxlength="120" placeholder="escrever minhas 3 prioridades do dia" aria-label="Novo hábito">
      <button type="submit" class="btn primary">Criar</button>
    </div>
  </form>
  <div class="card">
    ${habits.length ? habits.map((h) => `<div class="habit">
      <div>
        <div class="sentence">Depois de <span class="trig">${esc(h.trigger)}</span>, vou <span class="new">${esc(h.action)}</span>.</div>
        <div class="meta">Sequência: <b>${streak(h.id)}</b> dia(s) · ${rate(h)}% nos últimos 30 dias
          · <button type="button" class="link" style="border:0;background:none;cursor:pointer;padding:0" data-act="hdel" data-id="${h.id}">arquivar</button></div>
      </div>
      <div class="days">${days.map((d) => `<button type="button" class="day ${hDone(h.id, d) ? 'on' : ''} ${d === today ? 'today' : ''}" data-act="hlog" data-h="${h.id}" data-d="${d}" aria-pressed="${hDone(h.id, d)}" aria-label="${fmtShort(d)}"><span>${fromYmd(d).toLocaleDateString('pt-BR', { weekday: 'narrow' })}</span><b>${fromYmd(d).getDate()}</b></button>`).join('')}</div>
    </div>`).join('') : '<p class="empty">Exemplo do material: “Depois de servir meu café, vou escrever minhas 3 prioridades do dia.”</p>'}
  </div>`;
}

/* ---------- Dados e backup ---------- */
function syncCard() {
  const s = syncState;
  const err = s.error ? `<p class="sync-err">${esc(s.error)}</p>` : '';
  if (s.status === 'off') {
    return `<div class="card"><h2>Sincronização entre aparelhos</h2>
      <p class="muted" style="margin-top:0">Desligada: os dados ficam só neste aparelho. Para usar o mesmo ARSENAL no tablet, no celular e no PC, siga o guia <b>CONFIGURAR-SINCRONIZACAO.md</b> (uma vez só, uns 15 minutos).</p></div>`;
  }
  if (s.status === 'loading') return `<div class="card"><h2>Sincronização</h2><p class="muted" style="margin:0">Conectando…</p></div>`;
  if (s.status === 'unavailable') return `<div class="card"><h2>Sincronização</h2>${err}<p class="muted small" style="margin:0">Abra o app com internet uma vez para ativar.</p></div>`;
  if (!s.user) {
    return `<form class="card" data-form="sync-login" autocomplete="on">
      <h2>Sincronização entre aparelhos</h2>
      <p class="muted small" style="margin-top:0">Entre com a <b>mesma conta</b> em todos os aparelhos. Na primeira vez, o que já existe aqui é juntado ao que está na nuvem.</p>
      ${err}
      <div class="stack">
        <label class="field"><span>E-mail</span><input type="email" name="email" required autocomplete="username" inputmode="email"></label>
        <label class="field"><span>Senha</span><input type="password" name="password" autocomplete="current-password" minlength="6"></label>
        <div class="row">
          <button type="submit" class="btn primary">Entrar</button>
          <button type="button" class="btn" data-act="sync-signup">Criar conta</button>
          <button type="button" class="btn ghost" data-act="sync-reset">Esqueci a senha</button>
        </div>
        <div class="row"><button type="button" class="btn ghost" data-act="sync-google">Entrar com Google</button></div>
      </div>
    </form>`;
  }
  const label = SYNC_LABEL[s.status]?.[0] || '';
  return `<div class="card"><h2>Sincronização</h2>
    <p style="margin-top:0">Conectado como <b>${esc(s.user.email)}</b></p>
    <p class="sync-line" data-kind="${SYNC_LABEL[s.status]?.[1] || ''}"><i></i>${label}${s.lastSync ? ` · última confirmação ${new Date(s.lastSync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}</p>
    ${err}
    <div class="row"><button type="button" class="btn" data-act="sync-now">Sincronizar agora</button><button type="button" class="btn ghost" data-act="sync-out">Sair</button></div>
    <p class="muted small" style="margin-bottom:0">Sem internet, tudo continua funcionando e é enviado quando a conexão voltar. O cronômetro em andamento é de cada aparelho.</p>
  </div>`;
}
const syncForm = () => $('#main form[data-form="sync-login"]');
async function syncAuth(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); } catch { /* a mensagem aparece no cartão */ }
  render();
}

function viewDados() {
  const st = S.settings;
  const notif = !('Notification' in window) ? 'indisponível neste navegador' : Notification.permission === 'granted' ? 'ativadas' : Notification.permission === 'denied' ? 'bloqueadas no navegador' : 'desativadas';
  const counts = `${S.tasks.length} tarefas · ${S.sessions.length} sessões · ${S.journal.length} diários · ${S.habits.length} hábitos · ${S.cards.length} cartões · ${S.goals.length} metas · ${S.premortems.length} pré-mortens`;

  return `
  ${head('Configuração', 'Dados e backup.', syncState.user
    ? 'Os dados ficam neste aparelho e uma cópia sincronizada fica na sua conta, na nuvem.'
    : 'Os dados ficam neste aparelho, no armazenamento do navegador. Limpar os dados do navegador apaga o ARSENAL. Faça backup.')}
  <div class="grid g2">
    <div class="stack">
      ${syncCard()}
      <div class="card">
        <h2>Backup</h2>
        <p class="muted small" style="margin-top:0">${counts}</p>
        <div class="row">
          <button type="button" class="btn primary" data-act="export-json">Exportar backup (.json)</button>
          <label class="btn">Restaurar backup<input type="file" accept="application/json,.json" data-change="import" hidden></label>
        </div>
        <p class="muted small">Restaurar substitui todos os dados atuais. Guarde o arquivo no OneDrive para ter cópia fora do PC.</p>
        <div class="row">
          <button type="button" class="btn sm" data-act="export-csv" data-what="tasks">Tarefas (.csv)</button>
          <button type="button" class="btn sm" data-act="export-csv" data-what="sessions">Sessões de foco (.csv)</button>
          <button type="button" class="btn sm" data-act="export-csv" data-what="journal">Diário (.csv)</button>
        </div>
        <p class="muted small" id="persist-status"></p>
      </div>
      <form class="card" data-form="settings">
        <h2>Pomodoro</h2>
        <div class="settings-grid">
          <label class="field"><span>Foco (min)</span><input type="number" name="focus" min="1" max="180" value="${st.focus}"></label>
          <label class="field"><span>Pausa (min)</span><input type="number" name="short" min="1" max="60" value="${st.short}"></label>
          <label class="field"><span>Pausa longa (min)</span><input type="number" name="long" min="1" max="90" value="${st.long}"></label>
        </div>
        <div class="stack" style="margin-top:14px">
          <label class="check"><input type="checkbox" name="autoBreak" ${st.autoBreak ? 'checked' : ''}> Iniciar a pausa automaticamente</label>
          <label class="check"><input type="checkbox" name="sound" ${st.sound ? 'checked' : ''}> Som ao terminar cada fase</label>
          <div class="row"><button type="submit" class="btn primary">Salvar</button>
            <button type="button" class="btn" data-act="notif" ${notif === 'ativadas' || notif.startsWith('indisp') ? 'disabled' : ''}>Notificações: ${notif}</button></div>
          <p class="muted small" style="margin:0">Avisos só funcionam com o ARSENAL aberto (pode estar minimizado). Com o app fechado, nada toca.</p>
        </div>
      </form>
      <div class="card">
        <h2>Zona de perigo</h2>
        <button type="button" class="btn danger" data-act="wipe">Apagar todos os dados</button>
      </div>
    </div>
    <div class="card" style="align-self:start">
      <h2>Manual</h2>
      <p class="muted" style="margin-top:0">As 14 regras com passo a passo, dicas, vantagens, armadilhas e o grau de evidência de cada uma. Também dá para imprimir ou salvar em PDF.</p>
      <a class="btn primary" href="#/manual">Abrir o manual</a>
    </div>
  </div>`;
}

/* =========================================================================
   Roteamento e renderização
   ========================================================================= */
const VIEWS = { painel: viewPainel, tarefas: viewTarefas, foco: viewFoco, diario: viewDiario, habitos: viewHabitos, academia: (a) => academia.view(a), metas: (a) => metas.view(a), revisao: () => revisao.view(), dados: viewDados, manual: viewManual };
const TABBED = new Set(['academia', 'metas']); // telas com abas: #/academia/feynman etc.
let current = 'painel';
let currentAnchor = '';
function render() {
  const main = $('#main');
  main.innerHTML = VIEWS[current](currentAnchor);
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === current;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  paintTimer();
  if (current === 'dados') paintPersist();
}
function route() {
  // Formato: #/tela ou #/tela/âncora (ex.: #/manual/3 abre o manual na regra 3).
  const [v = 'painel', anchor = ''] = location.hash.replace(/^#\/?/, '').split('/');
  const next = VIEWS[v] ? v : 'painel';
  const changed = next !== current || (TABBED.has(next) && anchor !== currentAnchor);
  current = next;
  currentAnchor = anchor;
  if (changed) render();
  const target = anchor && document.getElementById(`regra-${anchor}`);
  if (target) target.scrollIntoView({ block: 'start' });
  else if (changed) window.scrollTo(0, 0);
  if (changed) $('#main').focus({ preventScroll: true });
}
async function paintPersist() {
  const el = $('#persist-status');
  if (!el || !navigator.storage?.persisted) return;
  const p = await navigator.storage.persisted();
  el.textContent = p ? 'Armazenamento marcado como persistente: o navegador não apaga os dados sozinho.' : 'Armazenamento não persistente: o navegador pode apagar os dados se faltar espaço. Instale o app para reduzir esse risco.';
}

/* =========================================================================
   Ações
   ========================================================================= */
async function completeTask(t, status) {
  Object.assign(t, { status, today: false, doneAt: Date.now(), doneDate: ymd() });
  if (T.taskId === t.id && fresh()) T.taskId = null;
  await save('tasks', t);
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function toCsv(rows) {
  const cell = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n'); // ; e BOM: abre certo no Excel em português
}

const ACT = {
  launch: (el) => launch(el.dataset.id),
  print: () => window.print(),
  'export-json': () => {
    const data = {};
    for (const s of STORES) data[s] = s === 'settings' ? [S.settings] : S[s];
    download(`arsenal-backup-${ymd()}.json`, JSON.stringify({ app: 'arsenal', version: 1, exportedAt: new Date().toISOString(), data }, null, 2), 'application/json');
    toast('Backup exportado.');
  },
  'export-csv': (el) => {
    const w = el.dataset.what;
    let rows;
    if (w === 'tasks') rows = [['Título', 'Casinha', 'Impacto', 'Situação', 'Prioridade do dia', 'Regra 2 min', 'Criada', 'Resolvida em'],
      ...S.tasks.map((t) => [t.title, `${t.quadrant} ${Q[t.quadrant].n}`, t.impact, { open: 'aberta', done: 'concluída', eliminated: 'eliminada' }[t.status], t.today ? 'sim' : '', t.quick ? 'sim' : '', ymd(new Date(t.createdAt)), t.doneDate || ''])];
    else if (w === 'sessions') rows = [['Data', 'Início', 'Fim', 'Minutos', 'Completo', 'Tarefa'],
      ...S.sessions.sort((a, b) => a.start - b.start).map((s) => [s.date, hhmm(s.start), hhmm(s.end), s.minutes, s.completed ? 'sim' : 'parcial', s.taskTitle])];
    else rows = [['Data', 'Deu certo', 'Não deu certo', 'Mudança para amanhã'],
      ...S.journal.sort((a, b) => (a.date < b.date ? -1 : 1)).map((j) => [j.date, j.good, j.bad, j.change])];
    download(`arsenal-${w}-${ymd()}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  },
  quick: async (el) => {
    const input = el.closest('form').elements.namedItem('title'); // form.title seria o atributo title do form
    const title = input.value.trim();
    if (!title) { toast('Escreva a tarefa primeiro.'); input.focus(); return; }
    await save('tasks', { id: uid(), title, quadrant: 1, impact: 1, status: 'done', quick: true, today: false, createdAt: Date.now(), doneAt: Date.now(), doneDate: ymd() });
    toast('Faça agora. Registrada como resolvida, fora da lista.');
    render();
    $('#main input[name=title]')?.focus();
  },
  done: async (el) => { const t = taskById(el.dataset.id); if (t) { await completeTask(t, 'done'); toast('Concluída.'); render(); } },
  eliminate: async (el) => { const t = taskById(el.dataset.id); if (t) { await completeTask(t, 'eliminated'); toast('Eliminada. Menos ruído.'); render(); } },
  undo: async (el) => {
    const t = taskById(el.dataset.id);
    if (!t) return;
    if (t.quick) { await remove('tasks', t.id); render(); return; }
    Object.assign(t, { status: 'open', doneAt: null, doneDate: null });
    await save('tasks', t);
    render();
  },
  star: async (el) => {
    const t = taskById(el.dataset.id);
    if (!t) return;
    if (!t.today && openTasks().filter((x) => x.today).length >= 3) { toast('Já existem 3 prioridades. Tire uma antes.'); return; }
    t.today = !t.today;
    await save('tasks', t);
    render();
  },
  move: async (el) => {
    const t = taskById(el.dataset.id);
    if (!t) return;
    t.quadrant = Number(el.dataset.q);
    if (t.quadrant === 4) t.today = false;
    await save('tasks', t);
    render();
  },
  delete: async (el) => {
    const t = taskById(el.dataset.id);
    if (t && confirm(`Excluir “${t.title}”? Não dá para desfazer.`)) { await remove('tasks', t.id); render(); }
  },
  hlog: async (el) => {
    const { h, d } = el.dataset;
    const id = hLogId(h, d);
    if (hDone(h, d)) await remove('habitLogs', id);
    else await save('habitLogs', { id, habitId: h, date: d });
    render();
  },
  hdel: async (el) => {
    const h = S.habits.find((x) => x.id === el.dataset.id);
    if (h && confirm(`Arquivar o hábito “${h.action}”? O histórico fica no backup.`)) { h.archived = true; await save('habits', h); render(); }
  },
  't-start': () => timerStart(),
  't-pause': () => timerPause(),
  't-stop': () => timerStop(),
  't-skip': () => timerSkip(),
  notif: async () => {
    if (!('Notification' in window)) return;
    await Notification.requestPermission();
    render();
  },
  'sync-signup': () => {
    const f = syncForm();
    if (!f.reportValidity()) return;
    const email = f.elements.namedItem('email').value.trim();
    const pass = f.elements.namedItem('password').value;
    if (pass.length < 6) { toast('A senha precisa ter pelo menos 6 caracteres.'); return; }
    syncAuth(() => sync.signUp(email, pass), 'Conta criada. Sincronizando…');
  },
  'sync-reset': () => {
    const email = syncForm().elements.namedItem('email').value.trim();
    if (!email) { toast('Digite o e-mail primeiro.'); return; }
    syncAuth(() => sync.reset(email), 'Enviamos um e-mail para redefinir a senha.');
  },
  'sync-google': () => syncAuth(() => sync.google()),
  'sync-now': () => syncAuth(async () => { const r = await sync.syncNow(); if (r) toast(`Sincronizado: ${r.applied} recebido(s), ${r.pushed} enviado(s).`); }),
  'sync-out': () => {
    if (!confirm('Sair da sincronização? Os dados continuam neste aparelho, mas deixam de ser atualizados com os outros.')) return;
    syncAuth(() => sync.signOut(), 'Você saiu. Os dados continuam neste aparelho.');
  },
  wipe: async () => {
    if (!confirm('Apagar TODOS os dados do ARSENAL? Exporte um backup antes. Não dá para desfazer.')) return;
    if (prompt('Para confirmar, digite APAGAR') !== 'APAGAR') { toast('Nada foi apagado.'); return; }
    // Exclui registro a registro para que a exclusão também chegue aos outros aparelhos.
    for (const s of LISTS) for (const r of [...S[s]]) await remove(s, r.id);
    S.settings = { ...DEFAULTS };
    await saveSettings();
    Object.assign(T, { phase: 'focus', running: false, remaining: null, cycle: 0, taskId: null });
    persistTimer();
    toast('Dados apagados.');
    render();
  },
};

const CHG = {
  setPriority: async (el) => {
    const t = taskById(el.value);
    if (!t) return;
    if (openTasks().filter((x) => x.today).length >= 3) { toast('Já existem 3 prioridades.'); render(); return; }
    t.today = true;
    await save('tasks', t);
    render();
  },
  impact: async (el) => { const t = taskById(el.dataset.id); if (t) { t.impact = Number(el.value); await save('tasks', t); render(); } },
  timerTask: (el) => { T.taskId = el.value || null; persistTimer(); },
  import: async (el) => {
    const file = el.files?.[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (json?.app !== 'arsenal' || !json.data) throw new Error('Arquivo não é um backup do ARSENAL.');
      const d = json.data;
      const n = `${(d.tasks || []).length} tarefas, ${(d.sessions || []).length} sessões, ${(d.journal || []).length} diários, ${(d.habits || []).length} hábitos, ${(d.cards || []).length} cartões`;
      const synced = syncState.user;
      if (!confirm(`Restaurar backup de ${json.exportedAt?.slice(0, 10) || 'data desconhecida'} (${n})? Os dados atuais deste aparelho serão substituídos.${synced ? ' Com a sincronização ligada, o backup também é enviado à nuvem e se junta ao que já está lá.' : ''}`)) return;
      // Os registros restaurados ganham a hora de agora para prevalecer na nuvem.
      const now = Date.now();
      const data = {};
      for (const s of STORES) data[s] = (d[s] || []).map((r) => ({ ...r, updatedAt: now }));
      await db.replaceAll(data);
      await load();
      for (const s of [...LISTS, 'settings']) for (const r of (s === 'settings' ? [S.settings] : S[s])) sync?.track(s, r.id);
      toast('Backup restaurado.');
      render();
    } catch (e) {
      toast(`Não foi possível restaurar: ${e.message}`);
    } finally {
      el.value = '';
    }
  },
};

const FORM = {
  'sync-login': (f, fd) => syncAuth(() => sync.signIn(String(fd.get('email')).trim(), String(fd.get('password')))),
  task: async (f, fd) => {
    const title = String(fd.get('title') || '').trim();
    if (!title) { f.elements.namedItem('title').focus(); return; }
    await save('tasks', { id: uid(), title, quadrant: Number(fd.get('quadrant')) || 2, impact: Number(fd.get('impact')) || 3, status: 'open', today: false, createdAt: Date.now() });
    const q = fd.get('quadrant');
    render();
    const input = $('#main input[name=title]');
    $(`#main input[name=quadrant][value="${q}"]`).checked = true; // mantém a casinha escolhida para lançamentos em série
    input.focus();
  },
  journal: async (f, fd) => {
    const today = ymd();
    const entry = { id: today, date: today, good: fd.get('good').trim(), bad: fd.get('bad').trim(), change: fd.get('change').trim(), updatedAt: Date.now() };
    if (!entry.good && !entry.bad && !entry.change) { toast('Escreva pelo menos uma linha.'); return; }
    await save('journal', entry);
    if (fd.get('mkTask') && entry.change) {
      await save('tasks', { id: uid(), title: entry.change, quadrant: 2, impact: 3, status: 'open', today: false, createdAt: Date.now() });
      toast('Diário salvo e tarefa criada na casinha 2.');
    } else toast('Diário salvo.');
    render();
  },
  habit: async (f, fd) => {
    const trigger = fd.get('trigger').trim().replace(/[.,]$/, '');
    const action = fd.get('action').trim().replace(/[.,]$/, '');
    if (!trigger || !action) return;
    await save('habits', { id: uid(), trigger, action, createdAt: Date.now(), createdDate: ymd(), archived: false });
    toast('Hábito criado.');
    render();
  },
  settings: async (f, fd) => {
    const clamp = (v, lo, hi, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };
    Object.assign(S.settings, {
      focus: clamp(fd.get('focus'), 1, 180, 25),
      short: clamp(fd.get('short'), 1, 60, 5),
      long: clamp(fd.get('long'), 1, 90, 20),
      autoBreak: !!fd.get('autoBreak'),
      sound: !!fd.get('sound'),
    });
    await saveSettings();
    toast('Configurações salvas.');
    render();
  },
};

/* ---------- Academia (regras 2, 6 e 14) e Metas (regras 9 e 12) ---------- */
const ctx = { S, save, remove, uid, ymd, esc, toast, render, head, fmtShort, fmtMin, beep: () => { unlockAudio(); beep(); } };
const academia = installAcademia(ctx);
const metas = installMetas(ctx);
const revisao = installRevisao(ctx);
for (const m of [academia, metas, revisao]) { Object.assign(ACT, m.act); Object.assign(CHG, m.chg || {}); Object.assign(FORM, m.form); }

/* ---------- Delegação de eventos ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && CHG[el.dataset.change]) CHG[el.dataset.change](el, e);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  FORM[f.dataset.form]?.(f, new FormData(f));
});
// Fecha menus ⋯ abertos ao clicar fora.
document.addEventListener('click', (e) => {
  document.querySelectorAll('details.more[open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; });
});
// Arrastar tarefas entre quadrantes.
let dragId = null;
document.addEventListener('dragstart', (e) => {
  const el = e.target.closest?.('[data-drag]');
  if (!el) return;
  dragId = el.dataset.drag;
  el.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragId);
});
document.addEventListener('dragend', () => { dragId = null; document.querySelectorAll('.dragging, .over').forEach((x) => x.classList.remove('dragging', 'over')); });
document.addEventListener('dragover', (e) => {
  const z = e.target.closest?.('[data-drop]');
  if (!z || !dragId) return;
  e.preventDefault();
  document.querySelectorAll('.over').forEach((x) => x !== z && x.classList.remove('over'));
  z.classList.add('over');
});
document.addEventListener('drop', async (e) => {
  const z = e.target.closest?.('[data-drop]');
  if (!z || !dragId) return;
  e.preventDefault();
  const t = taskById(dragId);
  dragId = null;
  if (t && t.quadrant !== Number(z.dataset.drop)) {
    t.quadrant = Number(z.dataset.drop);
    if (t.quadrant === 4) t.today = false;
    await save('tasks', t);
  }
  render();
});
// Contagem: clique ou Esc cancela.
$('#launch').addEventListener('click', cancelLaunch);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#launch').hidden) cancelLaunch(); });

/* =========================================================================
   Inicialização
   ========================================================================= */
async function init() {
  try {
    await load();
  } catch (e) {
    console.error(e);
    $('#main').innerHTML = `<div class="card"><h2>Não foi possível abrir o banco de dados</h2><p class="muted">${esc(e.message)}. Feche outras janelas do ARSENAL e recarregue. Em janela anônima o armazenamento pode estar bloqueado.</p></div>`;
    return;
  }
  // Se o tempo acabou enquanto o app estava fechado, fecha a fase sem tocar alarme.
  if (T.running && T.endAt <= Date.now()) await timerComplete();
  sync = createSync({ config: window.__arsenalTestConfig || firebaseConfig, hooks: syncHooks, backendFactory: window.__arsenalTestBackend, schema: SCHEMA });
  syncState = sync.state;
  paintSync();
  window.addEventListener('hashchange', route);
  current = '';
  route();
  startTicker();
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker não registrado:', e));
  }
}
init();

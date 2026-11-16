// Revisão semanal: 30 minutos para fechar a semana e preparar a próxima.
// Junta o que as outras telas registram (foco, tarefas, hábitos, diário, metas) e
// termina com uma decisão: o foco principal da próxima semana.
import { listState, quarterOf } from './metas.js';

const pad = (n) => String(n).padStart(2, '0');
const toYmd = (x) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const shiftDays = (s, n) => { const x = parse(s); x.setDate(x.getDate() + n); return toYmd(x); };

/* ---------- Funções puras (testáveis) ---------- */
// Semana de segunda a domingo; a chave é a data da segunda-feira.
export const mondayOf = (s) => shiftDays(s, -((parse(s).getDay() + 6) % 7));
export const weekDays = (monday) => [...Array(7)].map((_, i) => shiftDays(monday, i));
// Segunda e terça costumam ser para revisar a semana que acabou.
export const defaultWeek = (today) => {
  const dow = parse(today).getDay();
  return dow === 1 || dow === 2 ? shiftDays(mondayOf(today), -7) : mondayOf(today);
};

export function weekStats(S, monday) {
  const days = weekDays(monday);
  const inWeek = (d) => d && d >= days[0] && d <= days[6];
  const sessions = S.sessions.filter((s) => inWeek(s.date));
  const focus = sessions.reduce((a, s) => a + s.minutes, 0);
  const byDay = days.map((d) => sessions.filter((s) => s.date === d).reduce((a, s) => a + s.minutes, 0));
  const resolved = S.tasks.filter((t) => t.status !== 'open' && inWeek(t.doneDate));
  const done = resolved.filter((t) => t.status === 'done');
  const doneQ = [1, 2, 3, 4].map((q) => done.filter((t) => !t.quick && t.quadrant === q).length);

  // Para onde foi o foco (base do 80/20): minutos por tarefa, com impacto e casinha.
  const per = new Map();
  for (const s of sessions) {
    const k = s.taskId || `sem:${s.taskTitle || ''}`;
    const t = s.taskId && S.tasks.find((x) => x.id === s.taskId);
    const e = per.get(k) || { title: t?.title || s.taskTitle || 'Sem tarefa vinculada', impact: t?.impact || 0, quadrant: t?.quadrant || 0, min: 0, linked: !!t };
    e.min += s.minutes;
    per.set(k, e);
  }
  const byTask = [...per.values()].sort((a, b) => b.min - a.min);
  const share = (fn) => (focus ? Math.round((byTask.filter(fn).reduce((a, e) => a + e.min, 0) / focus) * 100) : 0);

  const habits = S.habits.filter((h) => !h.archived).map((h) => ({
    action: h.action,
    n: S.habitLogs.filter((l) => l.habitId === h.id && inWeek(l.date)).length,
  }));
  const journals = S.journal.filter((j) => inWeek(j.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    days, focus, byDay, pomos: sessions.filter((s) => s.completed).length,
    done: done.length, quick: done.filter((t) => t.quick).length, eliminated: resolved.length - done.length, doneQ,
    byTask, q2share: share((e) => e.quadrant === 2), highShare: share((e) => e.impact >= 4), unlinked: share((e) => !e.linked),
    habits, journals,
  };
}

/* ---------- Tela ---------- */
export function installRevisao(ctx) {
  const { S, save, uid, ymd, esc, toast, render, head, fmtShort, fmtMin } = ctx;
  let week = null; // segunda-feira em exibição (null = padrão)
  const curWeek = () => week || defaultWeek(ymd());
  const reviewOf = (monday) => S.reviews.find((r) => r.week === monday);
  const weekLabel = (m) => `${fmtShort(m)} a ${fmtShort(shiftDays(m, 6))}`;
  const dots = (n) => (n ? `<span class="impact" title="Impacto ${n}">${'●'.repeat(n)}${'○'.repeat(5 - n)}</span>` : '');
  const sec = (n, title, hint, body) => `<section class="card rv"><div class="rv-h"><span class="step-n">${n}</span><div><h2>${title}</h2>${hint ? `<p class="muted small">${hint}</p>` : ''}</div></div>${body}</section>`;

  // Para o Painel: foco escolhido na revisão mais recente (vale por 8 dias) e lembrete de fim de semana.
  function painelCallouts(today) {
    const last = [...S.reviews].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const recent = last && last.next && last.date >= shiftDays(today, -8);
    const dow = parse(today).getDay();
    const due = (dow === 5 || dow === 6 || dow === 0) && !reviewOf(mondayOf(today));
    return `${recent ? `<div class="callout focus" style="margin-bottom:20px"><div class="t">Foco principal da semana</div><p>${esc(last.next)}</p></div>` : ''}
      ${due ? `<a class="callout rv-call" href="#/revisao" style="margin-bottom:20px"><div class="t">Fim de semana</div><p>Hora da revisão semanal: 30 minutos para fechar a semana e escolher o foco da próxima →</p></a>` : ''}`;
  }

  function view() {
    const today = ymd();
    const m = curWeek();
    const st = weekStats(S, m);
    const r = reviewOf(m) || {};
    const max = Math.max(60, ...st.byDay);
    const stale = S.tasks.filter((t) => t.status === 'open' && t.createdAt < Date.now() - 14 * 86400000).sort((a, b) => a.createdAt - b.createdAt);
    const q1 = S.tasks.filter((t) => t.status === 'open' && t.quadrant === 1).length;
    const q4 = S.tasks.filter((t) => t.status === 'open' && t.quadrant === 4);
    const goals = listState(S.goals.filter((g) => g.quarter === quarterOf(today)));
    const taskOpen = (id) => S.tasks.some((t) => t.id === id && t.status === 'open');
    const past = [...S.reviews].sort((a, b) => (a.week < b.week ? 1 : -1)).slice(0, 12);
    const isFuture = m > mondayOf(today);

    return `${head('Revisão semanal', 'Feche a semana. Escolha o foco da próxima.', 'Uns 30 minutos, de preferência na sexta à tarde ou no domingo. Olhe os números, releia os diários, limpe a matriz e decida uma coisa só.', ['Regra 11 · 80/20', 'Regra 13 · Diário de reflexão', 'Regra 12 · Duas listas'])}
    <div class="qnav">
      <button type="button" class="btn sm ghost" data-act="rv-week" data-n="-7" aria-label="Semana anterior">‹</button>
      <b>Semana de ${weekLabel(m)}</b>
      <button type="button" class="btn sm ghost" data-act="rv-week" data-n="7" ${isFuture ? 'disabled' : ''} aria-label="Próxima semana">›</button>
      ${r.id ? '<span class="qtag">revisão feita ✓</span>' : ''}
    </div>

    ${sec(1, 'Os números da semana', 'Só o que você registrou no app. Não julgue ainda, só observe.', `
      <div class="grid g4 rv-stats">
        <div class="stat"><div class="v">${fmtMin(st.focus).replace(' min', '<small>min</small>')}</div><div class="l">de foco · ${st.pomos} pomodoro(s)</div></div>
        <div class="stat"><div class="v">${st.done}</div><div class="l">tarefas concluídas${st.quick ? ` · ${st.quick} em 2 min` : ''}${st.eliminated ? ` · ${st.eliminated} eliminada(s)` : ''}</div></div>
        <div class="stat"><div class="v">${st.journals.length}<small>/7</small></div><div class="l">diários escritos</div></div>
        <div class="stat"><div class="v">${st.doneQ[1]}</div><div class="l">concluídas da casinha 2 (onde mora o progresso)</div></div>
      </div>
      <div class="bars rv-bars" role="img" aria-label="Minutos de foco por dia da semana">
        ${st.days.map((d, i) => `<div class="bar ${d === today ? 'today' : ''}"><span class="m">${st.byDay[i] || ''}</span><div class="col" style="height:${(st.byDay[i] / max) * 100}%"></div><span class="d">${parse(d).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span></div>`).join('')}
      </div>
      ${st.habits.length ? `<ul class="clist" style="margin-top:14px">${st.habits.map((h) => `<li style="grid-template-columns:1fr auto"><span class="t">${esc(h.action)}</span><span class="muted small"><b>${h.n}</b> de 7 dias</span></li>`).join('')}</ul>` : ''}`)}

    ${sec(2, 'Para onde foi o seu foco', 'O 80/20 na prática: poucas tarefas costumam levar a maior parte do tempo. Elas são as de maior impacto?', st.byTask.length ? `
      <p class="rv-share"><b>${st.highShare}%</b> do foco foi em tarefas de impacto 4 ou 5 · <b>${st.q2share}%</b> na casinha 2${st.unlinked ? ` · <span class="muted">${st.unlinked}% sem tarefa vinculada</span>` : ''}</p>
      <ul class="clist">${st.byTask.slice(0, 8).map((e) => `<li><span class="t">${esc(e.title)}${e.quadrant ? `<span class="qtag">${e.quadrant}</span>` : ''}</span>${dots(e.impact)}<b class="small">${fmtMin(e.min)}</b></li>`).join('')}</ul>
      ${st.highShare < 50 ? '<p class="muted small">Menos da metade do foco foi em tarefas de alto impacto. Na próxima semana, proteja um bloco para elas.</p>' : ''}`
      : '<p class="empty">Nenhuma sessão de foco nesta semana. Vincule uma tarefa ao Pomodoro para ver esta análise.</p>')}

    ${sec(3, 'Releia os diários', 'Procure padrões: o que se repete no que deu certo e no que não deu?', `
      ${st.journals.length ? `<ul class="jlist">${st.journals.map((x) => `<li><div class="date">${fmtShort(x.date)}</div>
        ${x.good ? `<p><i style="background:var(--ok)"></i><span>${esc(x.good)}</span></p>` : ''}
        ${x.bad ? `<p><i style="background:var(--bad)"></i><span>${esc(x.bad)}</span></p>` : ''}
        ${x.change ? `<p><i style="background:var(--warn)"></i><span>${esc(x.change)}</span></p>` : ''}</li>`).join('')}</ul>` : '<p class="empty">Nenhum diário nesta semana.</p>'}`)}

    ${sec(4, 'Limpe a matriz', 'Tarefa parada há semanas raramente é importante. Elimine sem culpa ou leve para a casinha certa.', `
      <p class="small">${q1 ? `<b>${q1}</b> aberta(s) na casinha 1 (Faça).` : 'Casinha 1 vazia.'} ${q4.length ? `<b>${q4.length}</b> na casinha 4 esperando para ser eliminada(s).` : ''}</p>
      ${q4.length ? `<div class="row" style="margin-bottom:12px"><button type="button" class="btn sm danger" data-act="rv-clear4">Eliminar as ${q4.length} da casinha 4</button></div>` : ''}
      ${stale.length ? `<h3 style="margin:8px 0 4px">Paradas há mais de 14 dias</h3><ul class="tasks">${stale.slice(0, 12).map((t) => `<li class="task" style="grid-template-columns:auto 1fr auto auto">
        <span class="qtag" style="margin:0">${t.quadrant}</span><span class="t">${esc(t.title)}</span>
        <span class="muted small">${fmtShort(ymd(new Date(t.createdAt)))}</span>
        <button type="button" class="btn sm" data-act="eliminate" data-id="${t.id}">Eliminar</button></li>`).join('')}</ul>` : '<p class="muted small">Nenhuma tarefa parada há mais de 14 dias.</p>'}
      <p style="margin:12px 0 0"><a class="link" href="#/tarefas">Abrir a matriz →</a></p>`)}

    ${sec(5, 'Confira as 5 metas do trimestre', 'Toda meta aberta precisa de um próximo passo concreto na lista de tarefas.', goals.top.length ? `
      <ul class="tasks">${goals.top.map((g) => `<li class="task" style="grid-template-columns:auto 1fr auto">
        <span class="chk ${g.done ? 'on' : ''}" aria-hidden="true">${g.done ? '✓' : ''}</span>
        <span class="t">${esc(g.title)}</span>
        ${g.done ? '<span class="muted small">concluída</span>' : taskOpen(g.taskId) ? '<span class="qtag">tem tarefa ✓</span>' : `<button type="button" class="btn sm" data-act="goal-task" data-id="${g.id}">→ Criar tarefa</button>`}</li>`).join('')}</ul>
      <p style="margin:12px 0 0"><a class="link" href="#/metas">Abrir Metas →</a></p>`
      : '<p class="empty">Nenhuma meta escolhida para este trimestre. <a href="#/metas">Escolher as 5</a></p>')}

    <form class="card accent rv" data-form="review" autocomplete="off">
      <div class="rv-h"><span class="step-n">6</span><div><h2>Decida a próxima semana</h2><p class="muted small">Curto e específico. Uma vitória pequena também conta.</p></div></div>
      <div class="stack">
        <label class="field"><span>Vitórias da semana</span><textarea name="wins" rows="2">${esc(r.wins)}</textarea></label>
        <label class="field"><span>Padrões e lições (dos números e dos diários)</span><textarea name="lessons" rows="3">${esc(r.lessons)}</textarea></label>
        <label class="field"><span>O que vou parar, começar ou mudar</span><textarea name="change" rows="2">${esc(r.change)}</textarea></label>
        <label class="field"><span>Foco principal da próxima semana (uma coisa só)</span><input type="text" name="next" maxlength="160" value="${esc(r.next)}" placeholder="Ex.: terminar o módulo 1 do curso"></label>
        ${r.taskId && S.tasks.some((t) => t.id === r.taskId) ? '<p class="muted small" style="margin:0">Tarefa do foco principal já criada.</p>' : '<label class="check small"><input type="checkbox" name="mkTask" checked> Criar tarefa com o foco principal (casinha 2, impacto 5)</label>'}
        <label class="check small"><input type="checkbox" name="blocks" ${r.blocks ? 'checked' : ''}> Marquei na agenda os blocos de trabalho profundo da próxima semana</label>
        <div class="row"><button type="submit" class="btn primary">Concluir a revisão</button><span class="muted small">O foco principal aparece no topo do Painel durante a semana.</span></div>
      </div>
    </form>

    ${past.length ? `<div class="card" style="margin-top:20px"><h2>Revisões anteriores</h2>
      <ul class="clist">${past.map((x) => `<li style="grid-template-columns:auto 1fr">
        <button type="button" class="linkbtn small" data-act="rv-open" data-w="${x.week}">${weekLabel(x.week)}</button>
        <span class="t muted small">${x.next ? `Foco: ${esc(x.next)}` : ''}</span></li>`).join('')}</ul></div>` : ''}`;
  }

  const act = {
    'rv-week': (el) => {
      const next = shiftDays(curWeek(), Number(el.dataset.n));
      if (next > mondayOf(ymd())) return;
      week = next;
      render();
    },
    'rv-open': (el) => { week = el.dataset.w; render(); window.scrollTo(0, 0); },
    'rv-clear4': async () => {
      const q4 = S.tasks.filter((t) => t.status === 'open' && t.quadrant === 4);
      if (!q4.length || !confirm(`Eliminar as ${q4.length} tarefa(s) da casinha 4?`)) return;
      for (const t of q4) await save('tasks', Object.assign(t, { status: 'eliminated', today: false, doneAt: Date.now(), doneDate: ymd() }));
      toast('Casinha 4 limpa. Menos ruído.');
      render();
    },
  };
  const form = {
    review: async (f, fd) => {
      const m = curWeek();
      const prev = reviewOf(m);
      const g = (k) => String(fd.get(k) || '').trim();
      const r = { ...(prev || { id: `w-${m}`, week: m, createdAt: Date.now() }), date: ymd(),
        wins: g('wins'), lessons: g('lessons'), change: g('change'), next: g('next'), blocks: !!fd.get('blocks') };
      if (!r.wins && !r.lessons && !r.change && !r.next) { toast('Escreva pelo menos uma resposta.'); return; }
      let msg = 'Revisão concluída.';
      if (fd.get('mkTask') && r.next) {
        const t = { id: uid(), title: r.next, quadrant: 2, impact: 5, status: 'open', today: false, createdAt: Date.now() };
        await save('tasks', t);
        r.taskId = t.id;
        msg += ' Tarefa criada na casinha 2.';
      }
      await save('reviews', r);
      toast(msg);
      render();
      window.scrollTo(0, 0);
    },
  };
  return { view, act, form, painelCallouts };
}

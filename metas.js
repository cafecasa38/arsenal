// 07 · Metas: estratégia das duas listas (regra 12) e pré-mortem (regra 9).

/* ---------- Trimestres e listas (funções puras, testáveis) ---------- */
export const quarterOf = (ymdStr) => { const [y, m] = ymdStr.split('-').map(Number); return `${y}-T${Math.ceil(m / 3)}`; };
export function shiftQuarter(q, n) {
  let [y, t] = q.split('-T').map(Number);
  t += n;
  while (t > 4) { t -= 4; y++; }
  while (t < 1) { t += 4; y--; }
  return `${y}-T${t}`;
}
const MONTHS = ['jan–mar', 'abr–jun', 'jul–set', 'out–dez'];
export const quarterLabel = (q) => { const [y, t] = q.split('-T').map(Number); return `${t}º trimestre de ${y} · ${MONTHS[t - 1]}`; };

export const MAX_TOP = 5;
export const MAX_ALL = 25;
// Lista A = até 5 prioridades da rodada atual. Lista B = o resto (ruído).
// "Travada": a rodada tem 5 prioridades e nem todas foram concluídas. Só depois de
// concluir as 5 dá para fechar a rodada e trazer algo do ruído.
export function listState(goals) {
  const open = goals.filter((g) => !g.closed);
  const top = open.filter((g) => g.top).sort((a, b) => a.order - b.order);
  const noise = open.filter((g) => !g.top).sort((a, b) => a.createdAt - b.createdAt);
  const doneTop = top.filter((g) => g.done).length;
  const full = top.length >= MAX_TOP;
  return {
    top, noise, doneTop, full,
    locked: full && doneTop < top.length,
    roundDone: full && doneTop === top.length,
    closed: goals.filter((g) => g.closed).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)),
    count: open.length,
  };
}

// Pré-mortem: nota de risco = probabilidade x impacto (1 a 3 cada). Os 3 piores recebem proteção.
export const riskScore = (c) => (c.p || 2) * (c.i || 2);
export const worst = (causes, n = 3) => [...causes]
  .map((c, k) => ({ c, k }))
  .sort((a, b) => riskScore(b.c) - riskScore(a.c) || a.k - b.k)
  .slice(0, n)
  .map((x) => x.c);

/* ---------- Telas e ações ---------- */
export function installMetas(ctx) {
  const { S, save, remove, uid, ymd, esc, toast, render, head, fmtShort } = ctx;
  let selQ = null; // trimestre em exibição (null = o atual)
  let pmId = null; // pré-mortem em edição
  const qNow = () => quarterOf(ymd());
  const curQ = () => selQ || qNow();
  const goalsOf = (q) => S.goals.filter((g) => g.quarter === q);
  const goal = (id) => S.goals.find((g) => g.id === id);
  const taskOpen = (id) => S.tasks.some((t) => t.id === id);
  const newTask = (title, impact) => {
    const t = { id: uid(), title, quadrant: 2, impact, status: 'open', today: false, createdAt: Date.now() };
    return save('tasks', t).then(() => t);
  };
  const LV = ['', 'Baixa', 'Média', 'Alta'];

  function tabs(cur) {
    const items = [['', 'Duas listas', 'Regra 12'], ['premortem', 'Pré-mortem', 'Regra 9']];
    return `<nav class="tabs" aria-label="Partes de Metas">${items.map(([k, l, r]) => `<a href="#/metas${k ? `/${k}` : ''}" class="${cur === k ? 'on' : ''}" ${cur === k ? 'aria-current="true"' : ''}>${l}<small>${r}</small></a>`).join('')}</nav>`;
  }

  /* ----- Duas listas ----- */
  function listsTab() {
    const q = curQ();
    const st = listState(goalsOf(q));
    const isNow = q === qNow();
    const slots = [...Array(MAX_TOP)].map((_, k) => {
      const g = st.top[k];
      if (!g) return `<li class="slot-empty"><span class="n">${k + 1}</span><span class="muted">${st.noise.length ? 'Escolha com ★ na lista ao lado.' : 'Vazio.'}</span><span></span></li>`;
      const tk = g.taskId && taskOpen(g.taskId);
      return `<li class="${g.done ? 'done' : ''}"><span class="n">${k + 1}</span>
        <span class="t">${esc(g.title)}</span>
        <span class="row" style="gap:4px">
          ${g.done ? '' : tk ? '<span class="qtag" title="Já existe tarefa para esta meta">tarefa ✓</span>' : `<button type="button" class="btn sm" data-act="goal-task" data-id="${g.id}" title="Criar tarefa na casinha 2 com impacto 5">→ Tarefa</button>`}
          ${g.done ? '' : `<button type="button" class="icon" data-act="goal-top" data-id="${g.id}" title="Devolver para o ruído" aria-label="Devolver para o ruído">↓</button>`}
          <button type="button" class="chk ${g.done ? 'on' : ''}" data-act="goal-done" data-id="${g.id}" aria-pressed="${!!g.done}" title="${g.done ? 'Desmarcar' : 'Concluída'}" aria-label="Concluir ${esc(g.title)}">✓</button>
        </span></li>`;
    }).join('');
    const noiseTitle = st.full ? 'Lista B · ruído: evitar a todo custo' : 'Lista B · todo o resto';
    return `
    <div class="qnav">
      <button type="button" class="btn sm ghost" data-act="q-prev" aria-label="Trimestre anterior">‹</button>
      <b>${quarterLabel(q)}</b>
      <button type="button" class="btn sm ghost" data-act="q-next" aria-label="Próximo trimestre">›</button>
      ${isNow ? '' : '<button type="button" class="btn sm" data-act="q-now">Trimestre atual</button>'}
    </div>
    <form class="capture card" data-form="goal" autocomplete="off">
      <div class="line">
        <input type="text" name="title" maxlength="160" placeholder="Uma meta ou desejo para este trimestre…" aria-label="Nova meta ou desejo">
        <button type="submit" class="btn primary">Adicionar</button>
      </div>
      <p class="muted small" style="margin:0">${st.count} de ${MAX_ALL}. Escreva tudo o que tenta você e depois escolha as 5 mais importantes com ★. Saúde, contas e obrigações não são metas: não entram em nenhuma das listas.</p>
    </form>
    <div class="grid g2">
      <div class="card accent">
        <div class="card-head"><h2>Lista A · as 5 prioridades</h2><span class="muted small">${st.doneTop}/${st.top.length || 0} concluídas</span></div>
        <ol class="prio goals">${slots}</ol>
        ${st.roundDone ? `<div class="callout ok" style="margin-top:14px"><div class="t">As 5 foram concluídas</div><p>Agora sim, dá para trazer algo do ruído.</p>
          <div class="row" style="margin-top:8px"><button type="button" class="btn sm primary" data-act="goal-round">Arquivar as 5 e escolher as próximas</button></div></div>` : ''}
      </div>
      <div class="card ${st.locked ? 'locked' : ''}">
        <div class="card-head"><h2>${noiseTitle}</h2><span class="muted small">${st.noise.length}</span></div>
        ${st.locked ? '<p class="lockmsg">🔒 Travada até você concluir as 5 prioridades. Uma ideia nova vem para cá: adiada, não descartada.</p>' : ''}
        <ul class="tasks">${st.noise.map((g) => `<li class="task" style="grid-template-columns:auto 1fr auto">
          <button type="button" class="icon" data-act="goal-top" data-id="${g.id}" ${st.full ? 'disabled' : ''} title="${st.full ? 'A lista A está cheia' : 'Levar para as prioridades'}" aria-label="Levar para as prioridades">★</button>
          <span class="t">${esc(g.title)}</span>
          <button type="button" class="icon" data-act="goal-del" data-id="${g.id}" title="Excluir" aria-label="Excluir">✕</button></li>`).join('') || '<li class="empty">Vazia.</li>'}</ul>
      </div>
    </div>
    ${st.closed.length ? `<div class="card" style="margin-top:20px"><h2>Concluídas em rodadas anteriores</h2>
      <ul class="tasks done-list">${st.closed.map((g) => `<li class="task" style="grid-template-columns:auto 1fr"><span class="chk on">✓</span><span class="t">${esc(g.title)}</span></li>`).join('')}</ul></div>` : ''}`;
  }

  /* ----- Pré-mortem ----- */
  function pmEditor(pm) {
    const top = worst(pm.causes);
    const topIds = new Set(top.map((c) => c.id));
    const sel = (c, k, label) => `<label class="pm-sel"><span>${label}</span><select data-change="pm-level" data-pm="${pm.id}" data-c="${c.id}" data-k="${k}">${[1, 2, 3].map((v) => `<option value="${v}" ${(c[k] || 2) === v ? 'selected' : ''}>${LV[v]}</option>`).join('')}</select></label>`;
    return `
    <form class="card stack" data-form="pm-head" autocomplete="off">
      <div class="card-head" style="margin:0"><h2>${esc(pm.project)}</h2><span class="muted small">${fmtShort(pm.date)}</span></div>
      <label class="field"><span>Projeto</span><input type="text" name="project" required maxlength="140" value="${esc(pm.project)}"></label>
      <label class="field"><span>Resultado esperado</span><input type="text" name="outcome" maxlength="200" value="${esc(pm.outcome)}"></label>
      <div class="row"><button type="submit" class="btn sm">Salvar</button></div>
    </form>
    <div class="card" style="margin-top:20px">
      <span class="step-n inline">2</span>
      <h2 style="display:inline">Daqui a 6 meses, fracassou completamente. Por quê?</h2>
      <p class="muted small">10 minutos, sem filtrar. Inclua causas pessoais: perder o ânimo, falta de tempo, ficar doente.</p>
      <form class="line" data-form="pm-cause" data-pm="${pm.id}" autocomplete="off" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <input type="text" name="text" maxlength="200" placeholder="Um motivo do fracasso…" aria-label="Motivo do fracasso" style="flex:1 1 260px">
        <button type="submit" class="btn primary">Adicionar</button>
      </form>
      <ul class="pm-causes">${pm.causes.map((c) => `<li class="${topIds.has(c.id) ? 'top' : ''}">
        <span class="t">${esc(c.text)}</span>
        <span class="row" style="gap:8px">${sel(c, 'p', 'Chance')}${sel(c, 'i', 'Impacto')}
          <b class="score" title="Chance × impacto">${riskScore(c)}</b>
          <button type="button" class="icon" data-act="pm-cdel" data-pm="${pm.id}" data-c="${c.id}" title="Excluir" aria-label="Excluir motivo">✕</button></span></li>`).join('') || '<li class="empty">Nenhum motivo ainda.</li>'}</ul>
    </div>
    ${top.length ? `<div class="card accent" style="margin-top:20px">
      <span class="step-n inline">3</span><h2 style="display:inline">Os ${top.length} piores: proteção e sinal de alerta</h2>
      <p class="muted small">Classifique acima por chance e impacto; os de nota mais alta sobem para cá. Cada proteção vira uma tarefa na casinha 2.</p>
      ${top.map((c) => {
        const tk = c.taskId && taskOpen(c.taskId);
        return `<div class="pm-top">
          <div class="pm-cause"><b class="score">${riskScore(c)}</b> ${esc(c.text)}</div>
          <div class="grid g2" style="gap:12px">
            <label class="field"><span>Proteção: o que fazer para evitar</span><input type="text" maxlength="200" value="${esc(c.protection)}" data-change="pm-field" data-pm="${pm.id}" data-c="${c.id}" data-k="protection"></label>
            <label class="field"><span>Sinal de alerta: como perceber cedo</span><input type="text" maxlength="200" value="${esc(c.signal)}" data-change="pm-field" data-pm="${pm.id}" data-c="${c.id}" data-k="signal"></label>
          </div>
          <div class="row" style="margin-top:8px">${tk ? '<span class="qtag">tarefa criada ✓</span>' : `<button type="button" class="btn sm" data-act="pm-task" data-pm="${pm.id}" data-c="${c.id}">→ Criar tarefa da proteção</button>`}</div>
        </div>`;
      }).join('')}
    </div>` : ''}`;
  }
  function pmTab() {
    const list = [...S.premortems].sort((a, b) => b.createdAt - a.createdAt);
    const pm = S.premortems.find((x) => x.id === pmId);
    const status = (x) => {
      const t = worst(x.causes);
      const prot = t.filter((c) => c.protection).length;
      return x.causes.length ? `${x.causes.length} motivo(s) · ${prot}/${t.length} protegidos` : 'sem motivos';
    };
    return `<div class="grid g-wide">
      <div>${pm ? pmEditor(pm) : `
        <form class="card stack" data-form="pm-head" autocomplete="off">
          <h2>Novo pré-mortem</h2>
          <p class="muted small" style="margin:0">Faça antes de começar um projeto. Imaginar o fracasso de antemão corrige o otimismo natural dos planos.</p>
          <label class="field"><span>1 · Projeto</span><input type="text" name="project" required maxlength="140" placeholder="Ex.: Lançar o curso online"></label>
          <label class="field"><span>Resultado esperado</span><input type="text" name="outcome" maxlength="200" placeholder="Ex.: 100 alunos até junho"></label>
          <div class="row"><button type="submit" class="btn primary">Começar</button></div>
        </form>`}</div>
      <div class="card" style="align-self:start">
        <div class="card-head"><h2>Projetos</h2>${pm ? '<button type="button" class="btn sm ghost" data-act="pm-new">+ Novo</button>' : ''}</div>
        <ul class="clist">${list.map((x) => `<li class="${x.id === pmId ? 'cur' : ''}">
          <button type="button" class="t linkbtn" data-act="pm-open" data-id="${x.id}">${esc(x.project)}</button>
          <span class="muted small">${status(x)}</span>
          <button type="button" class="icon" data-act="pm-del" data-id="${x.id}" title="Excluir" aria-label="Excluir">✕</button></li>`).join('') || '<li class="empty">Nenhum ainda.</li>'}</ul>
      </div>
    </div>`;
  }

  function view(tab = '') {
    const t = tab === 'premortem' ? 'premortem' : '';
    const sub = t ? 'Antes de começar, imagine que o projeto fracassou. Por quê? Depois, proteja-se dos 3 motivos mais perigosos.'
      : 'Cinco metas por trimestre. Todo o resto vira ruído e fica de lado até as cinco estarem concluídas. A clareza vem da eliminação.';
    return `${head('07 · Metas e projetos', t ? 'O pré-mortem.' : 'A estratégia das duas listas.', sub, ['Regra 12 · Duas listas', 'Regra 9 · Pré-mortem'])}
    ${tabs(t)}
    ${t ? pmTab() : listsTab()}`;
  }

  const pmOf = (el) => S.premortems.find((x) => x.id === el.dataset.pm);
  const causeOf = (pm, el) => pm?.causes.find((c) => c.id === el.dataset.c);
  const act = {
    'q-prev': () => { selQ = shiftQuarter(curQ(), -1); render(); },
    'q-next': () => { selQ = shiftQuarter(curQ(), 1); render(); },
    'q-now': () => { selQ = null; render(); },
    'goal-top': async (el) => {
      const g = goal(el.dataset.id);
      if (!g) return;
      const st = listState(goalsOf(g.quarter));
      if (!g.top && st.full) { toast(st.locked ? 'Conclua as 5 prioridades antes de trazer algo do ruído.' : 'Arquive as 5 concluídas primeiro.'); return; }
      g.top = !g.top;
      g.order = Date.now();
      await save('goals', g);
      render();
    },
    'goal-done': async (el) => {
      const g = goal(el.dataset.id);
      if (!g) return;
      g.done = !g.done;
      g.doneAt = g.done ? Date.now() : null;
      await save('goals', g);
      toast(g.done ? 'Meta concluída.' : 'Meta reaberta.');
      render();
    },
    'goal-task': async (el) => {
      const g = goal(el.dataset.id);
      if (!g) return;
      g.taskId = (await newTask(g.title, 5)).id;
      await save('goals', g);
      toast('Tarefa criada na casinha 2, com impacto 5.');
      render();
    },
    'goal-del': async (el) => {
      const g = goal(el.dataset.id);
      if (g && confirm(`Excluir “${g.title}”?`)) { await remove('goals', g.id); render(); }
    },
    'goal-round': async () => {
      const st = listState(goalsOf(curQ()));
      if (!st.roundDone) return;
      for (const g of st.top) { g.closed = true; await save('goals', g); }
      toast('Rodada arquivada. Escolha as próximas 5 com ★.');
      render();
    },
    'pm-new': () => { pmId = null; render(); },
    'pm-open': (el) => { pmId = el.dataset.id; render(); window.scrollTo(0, 0); },
    'pm-del': async (el) => {
      const pm = S.premortems.find((x) => x.id === el.dataset.id);
      if (!pm || !confirm(`Excluir o pré-mortem “${pm.project}”? As tarefas criadas continuam.`)) return;
      if (pmId === pm.id) pmId = null;
      await remove('premortems', pm.id);
      render();
    },
    'pm-cdel': async (el) => {
      const pm = pmOf(el);
      if (!pm) return;
      pm.causes = pm.causes.filter((c) => c.id !== el.dataset.c);
      await save('premortems', pm);
      render();
    },
    'pm-task': async (el) => {
      const pm = pmOf(el);
      const c = causeOf(pm, el);
      if (!c) return;
      // Garante que o texto digitado e ainda não salvo entre na tarefa.
      const input = document.querySelector(`#main input[data-c="${c.id}"][data-k="protection"]`);
      if (input) c.protection = input.value.trim();
      if (!c.protection) { toast('Escreva a proteção primeiro.'); input?.focus(); return; }
      c.taskId = (await newTask(`${c.protection} (pré-mortem: ${pm.project})`, riskScore(c) >= 6 ? 5 : 4)).id;
      await save('premortems', pm);
      toast('Tarefa criada na casinha 2.');
      render();
    },
  };
  const chg = {
    'pm-level': async (el) => {
      const pm = pmOf(el);
      const c = causeOf(pm, el);
      if (!c) return;
      c[el.dataset.k] = Number(el.value);
      await save('premortems', pm);
      render();
    },
    'pm-field': async (el) => {
      const pm = pmOf(el);
      const c = causeOf(pm, el);
      if (!c) return;
      c[el.dataset.k] = el.value.trim();
      el.defaultValue = el.value; // já salvo: não segura redesenhos vindos da nuvem
      await save('premortems', pm);
    },
  };
  const form = {
    goal: async (f, fd) => {
      const title = String(fd.get('title') || '').trim();
      if (!title) return;
      const q = curQ();
      if (listState(goalsOf(q)).count >= MAX_ALL) { toast(`O método pede no máximo ${MAX_ALL}. Corte alguma antes.`); return; }
      await save('goals', { id: uid(), quarter: q, title, top: false, done: false, createdAt: Date.now(), order: Date.now() });
      render();
      document.querySelector('#main input[name=title]')?.focus();
    },
    'pm-head': async (f, fd) => {
      const project = String(fd.get('project') || '').trim();
      if (!project) return;
      const prev = S.premortems.find((x) => x.id === pmId);
      const pm = { ...(prev || { id: uid(), causes: [], createdAt: Date.now(), date: ymd() }), project, outcome: String(fd.get('outcome') || '').trim() };
      await save('premortems', pm);
      pmId = pm.id;
      toast(prev ? 'Salvo.' : 'Agora imagine o fracasso e liste os motivos.');
      render();
      if (!prev) document.querySelector('#main form[data-form="pm-cause"] input')?.focus();
    },
    'pm-cause': async (f, fd) => {
      const pm = S.premortems.find((x) => x.id === f.dataset.pm);
      const text = String(fd.get('text') || '').trim();
      if (!pm || !text) return;
      pm.causes = [...pm.causes, { id: uid(), text, p: 2, i: 2, protection: '', signal: '' }];
      await save('premortems', pm);
      render();
      document.querySelector('#main form[data-form="pm-cause"] input')?.focus();
    },
  };
  return { view, act, chg, form, listState, quarterOf };
}

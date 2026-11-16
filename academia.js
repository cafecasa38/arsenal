// 06 · Academia: repetição espaçada (regra 14), técnica de Feynman (regra 2) e
// recuperação ativa (regra 6). As três se ligam: uma explicação ou um exercício de
// recuperação pode virar cartão, e o cartão agenda as revisões.

const pad = (n) => String(n).padStart(2, '0');
const shift = (s, n) => {
  const [y, m, d] = s.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const daysBetween = (a, b) => {
  const f = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((f(b) - f(a)) / 86400000);
};
const lines = (t) => String(t || '').split(/\r?\n/).map((x) => x.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);

/* ---------- Agenda de revisões (funções puras, testáveis) ----------
   Intervalos entre revisões, em dias. Os quatro primeiros reproduzem o material
   (revisar no dia 1, 3, 7 e 14 depois de aprender); depois o intervalo continua crescendo.
   "Errei" volta o cartão ao início do ciclo, como manda a regra. */
export const GAPS = [1, 2, 4, 7, 16, 30, 60, 120];
const gapAt = (step) => GAPS[Math.min(step, GAPS.length - 1)];

export const newCardDue = (today) => shift(today, GAPS[0]);

// grade: 'again' (errei), 'good' (lembrei) ou 'easy' (fácil).
export function schedule(card, grade, today) {
  const step = grade === 'again' ? 0 : (card.step || 0) + (grade === 'easy' ? 2 : 1);
  return {
    step,
    due: shift(today, grade === 'again' ? 1 : gapAt(step)),
    lastReview: today,
    reviews: (card.reviews || 0) + 1,
    lapses: (card.lapses || 0) + (grade === 'again' ? 1 : 0),
  };
}

export const dueCards = (cards, today) => cards
  .filter((c) => c.due <= today)
  .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.createdAt - b.createdAt));

/* ---------- Telas e ações ---------- */
export function installAcademia(ctx) {
  const { S, save, remove, uid, ymd, esc, toast, render, head, fmtShort, beep } = ctx;
  let revealed = null; // cartão com a resposta à mostra
  let feynId = null; // explicação em edição
  let recallId = null; // exercício em edição
  let deckFilter = '';
  let lastDeck = '';
  let recallEnd = 0;
  let recallTimer = null;

  const notes = (type) => S.notes.filter((n) => n.type === type).sort((a, b) => b.createdAt - a.createdAt);
  const decks = () => [...new Set(S.cards.map((c) => c.deck).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const when = (due, today) => {
    const d = daysBetween(today, due);
    return d <= 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`;
  };
  const hasCard = (id) => id && S.cards.some((c) => c.id === id);
  async function addCard(front, back, deck) {
    const today = ymd();
    const c = { id: uid(), front, back, deck: deck || '', step: 0, due: newCardDue(today), reviews: 0, lapses: 0, createdAt: Date.now(), createdDate: today };
    await save('cards', c);
    return c;
  }
  const newTask = (title, impact = 3) => save('tasks', { id: uid(), title, quadrant: 2, impact, status: 'open', today: false, createdAt: Date.now() });
  const step = (n, title, hint, body) => `<section class="step"><span class="step-n">${n}</span><div class="step-b"><h3>${title}</h3>${hint ? `<p class="hint">${hint}</p>` : ''}${body}</div></section>`;
  const recallLeft = () => Math.max(0, recallEnd - Date.now());
  const mmss = (ms) => { const s = Math.ceil(ms / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };

  function tabs(cur, due) {
    const items = [['', `Revisar cartões${due ? ` <b>${due}</b>` : ''}`, 'Regra 14'], ['feynman', 'Técnica de Feynman', 'Regra 2'], ['recuperacao', 'Recuperação ativa', 'Regra 6']];
    return `<nav class="tabs" aria-label="Partes da Academia">${items.map(([k, l, r]) => `<a href="#/academia${k ? `/${k}` : ''}" class="${cur === k ? 'on' : ''}" ${cur === k ? 'aria-current="true"' : ''}>${l}<small>${r}</small></a>`).join('')}</nav>`;
  }

  /* ----- Cartões ----- */
  function cardsTab(today) {
    const due = dueCards(S.cards, today);
    const c = due[0];
    const doneToday = S.cards.filter((x) => x.lastReview === today).length;
    let review;
    if (c) {
      const shown = revealed === c.id;
      const opt = (g, label) => `<button type="button" class="btn ${g === 'good' ? 'primary' : ''}" data-act="card-grade" data-id="${c.id}" data-g="${g}">${label}<small>${when(schedule(c, g, today).due, today)}</small></button>`;
      review = `<div class="card accent flash">
        <div class="card-head"><span class="muted small">${esc(c.deck || 'Sem assunto')} · ${c.reviews ? `${c.reviews + 1}ª revisão` : 'primeira revisão'}</span><span class="muted small">${due.length} para hoje${doneToday ? ` · ${doneToday} feita(s)` : ''}</span></div>
        <div class="flash-q">${esc(c.front)}</div>
        ${shown
          ? `<div class="flash-a">${c.back ? esc(c.back) : '<span class="muted">(sem resposta escrita)</span>'}</div>
             <p class="muted small">Seja honesto: se errou um detalhe importante, marque Errei. O cartão volta ao início do ciclo.</p>
             <div class="row grade">${opt('again', 'Errei')}${opt('good', 'Lembrei')}${opt('easy', 'Fácil')}</div>`
          : `<p class="muted small">Antes de virar, tente lembrar a resposta inteira. O esforço é o que fixa (regra 6).</p>
             <div class="row"><button type="button" class="btn primary big" data-act="card-show" data-id="${c.id}">Mostrar resposta</button></div>`}
      </div>`;
    } else {
      const next = [...S.cards].sort((a, b) => (a.due < b.due ? -1 : 1))[0];
      review = `<div class="card"><h2>${S.cards.length ? 'Nada para revisar hoje.' : 'Nenhum cartão ainda.'}</h2>
        <p class="muted" style="margin:0">${S.cards.length
          ? `${doneToday ? `Você revisou ${doneToday} cartão(ões) hoje. ` : ''}Próxima revisão: ${next ? `${fmtShort(next.due)} (${when(next.due, today)})` : '—'}.`
          : 'Crie o primeiro cartão abaixo. Ele aparece aqui amanhã e depois no dia 3, no dia 7 e no dia 14.'}</p></div>`;
    }
    const all = S.cards.filter((x) => !deckFilter || x.deck === deckFilter).sort((a, b) => b.createdAt - a.createdAt);
    const ds = decks();
    return `${review}
    <div class="grid g2" style="margin-top:20px">
      <form class="card" data-form="card" autocomplete="off">
        <h2>Novo cartão</h2>
        <div class="stack">
          <label class="field"><span>Pergunta (frente)</span><textarea name="front" rows="2" required maxlength="500" placeholder="Ex.: Por que os juros compostos crescem cada vez mais rápido?"></textarea></label>
          <label class="field"><span>Resposta (verso), com as suas palavras</span><textarea name="back" rows="3" maxlength="2000" placeholder="Curta. Uma ideia por cartão."></textarea></label>
          <label class="field"><span>Assunto (opcional)</span><input type="text" name="deck" list="arsenal-decks" maxlength="60" value="${esc(lastDeck)}" placeholder="Ex.: Finanças"></label>
          <datalist id="arsenal-decks">${ds.map((d) => `<option value="${esc(d)}">`).join('')}</datalist>
          <div class="row"><button type="submit" class="btn primary">Criar cartão</button><span class="muted small">Primeira revisão amanhã.</span></div>
        </div>
      </form>
      <div class="card">
        <div class="card-head"><h2>Todos os cartões</h2>
          ${ds.length ? `<select data-change="card-deck" aria-label="Filtrar por assunto" style="width:auto"><option value="">Todos os assuntos</option>${ds.map((d) => `<option ${d === deckFilter ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>` : `<span class="muted small">${S.cards.length}</span>`}</div>
        <ul class="clist">${all.slice(0, 150).map((x) => `<li>
          <span class="t">${esc(x.front)}${x.deck && !deckFilter ? `<span class="qtag">${esc(x.deck)}</span>` : ''}</span>
          <span class="muted small" title="Próxima revisão">${x.due <= today ? '<b class="due">hoje</b>' : fmtShort(x.due)}</span>
          <button type="button" class="icon" data-act="card-del" data-id="${x.id}" title="Excluir cartão" aria-label="Excluir cartão">✕</button></li>`).join('') || '<li class="empty">Os cartões aparecem aqui.</li>'}</ul>
        ${all.length > 150 ? `<p class="muted small">Mostrando os 150 mais recentes de ${all.length}.</p>` : ''}
      </div>
    </div>`;
  }

  /* ----- Feynman ----- */
  const feynStep = (n) => (n.simple ? 4 : n.gaps ? 3 : n.explanation ? 2 : 1);
  function feynTab() {
    const n = S.notes.find((x) => x.id === feynId) || {};
    const list = notes('feynman');
    const card = hasCard(n.cardId);
    return `<div class="grid g-wide">
      <form class="card stack" data-form="feynman" autocomplete="off">
        <div class="card-head" style="margin:0"><h2>${n.id ? esc(n.concept) : 'Nova explicação'}</h2>${n.id ? '<button type="button" class="btn sm ghost" data-act="feyn-new">+ Nova</button>' : ''}</div>
        ${step(1, 'Escolha um conceito específico', 'Não “economia”, mas “como funcionam os juros compostos”.',
          `<input type="text" name="concept" required maxlength="140" value="${esc(n.concept)}" aria-label="Conceito">`)}
        ${step(2, 'Ensine por escrito, como para alguém de 12 anos', 'Feche o material antes. Sem jargão, no máximo uma página.',
          `<textarea name="explanation" rows="8" aria-label="Explicação">${esc(n.explanation)}</textarea>`)}
        ${step(3, 'Diagnostique: onde você travou?', 'Uma lacuna por linha. Palavra difícil usada sem explicar também é lacuna.',
          `<textarea name="gaps" rows="3" aria-label="Lacunas">${esc(n.gaps)}</textarea>
           ${n.tasksMade ? '<p class="muted small">Tarefas “Reaprender” já criadas.</p>' : '<label class="check small"><input type="checkbox" name="mkTasks"> Criar uma tarefa “Reaprender: …” para cada lacuna (casinha 2)</label>'}`)}
        ${step(4, 'Reaprenda e reescreva', 'Volte à fonte só nas lacunas. Reescreva mais curto e com uma analogia. Teste final: consegue dar um exemplo que não estava na fonte?',
          `<textarea name="simple" rows="5" aria-label="Explicação simplificada">${esc(n.simple)}</textarea>
           ${card ? '<p class="muted small">Cartão de revisão já criado.</p>' : '<label class="check small"><input type="checkbox" name="mkCard"> Agendar revisões espaçadas: criar o cartão “Explique com suas palavras”</label>'}`)}
        <div class="row"><button type="submit" class="btn primary">Salvar</button><span class="muted small">Dá para salvar no meio e continuar depois.</span></div>
      </form>
      <div class="card" style="align-self:start">
        <h2>Explicações</h2>
        <ul class="clist">${list.map((x) => `<li class="${x.id === feynId ? 'cur' : ''}">
          <button type="button" class="t linkbtn" data-act="feyn-open" data-id="${x.id}">${esc(x.concept)}</button>
          <span class="muted small">${feynStep(x) === 4 ? '✓ completa' : `passo ${feynStep(x)} de 4`}</span>
          <button type="button" class="icon" data-act="note-del" data-id="${x.id}" title="Excluir" aria-label="Excluir">✕</button></li>`).join('') || '<li class="empty">Nenhuma ainda.</li>'}</ul>
      </div>
    </div>`;
  }

  /* ----- Recuperação ativa ----- */
  const prevMissed = (source, exceptId) => {
    const k = String(source || '').trim().toLowerCase();
    if (!k) return null;
    return notes('recall').find((x) => x.id !== exceptId && x.source.trim().toLowerCase() === k && x.missed);
  };
  const prevBox = (p) => (p ? `<div class="callout"><div class="t">Da última vez (${fmtShort(p.date)}) faltou</div><p style="white-space:pre-wrap">${esc(p.missed)}</p></div>` : '');
  function recallTab() {
    const n = S.notes.find((x) => x.id === recallId) || {};
    const list = notes('recall');
    const sources = [...new Set(list.map((x) => x.source))];
    const left = recallLeft();
    return `<div class="grid g-wide">
      <form class="card stack" data-form="recall" autocomplete="off">
        <div class="card-head" style="margin:0"><h2>${n.id ? esc(n.source) : 'Novo exercício'}</h2>${n.id ? '<button type="button" class="btn sm ghost" data-act="recall-new">+ Novo</button>' : ''}</div>
        ${step(1, 'O que você acabou de ler, estudar ou assistir?', 'Um capítulo, uma aula, uma reunião.',
          `<input type="text" name="source" required maxlength="140" list="arsenal-sources" value="${esc(n.source)}" data-change="recall-source" aria-label="Fonte">
           <datalist id="arsenal-sources">${sources.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
           <div id="recall-prev">${prevBox(prevMissed(n.source, n.id))}</div>`)}
        ${step(2, 'Feche tudo e escreva o que lembrar', 'Ideias, números, decisões. Não espie a fonte antes de terminar. Depois de reuniões: 3 decisões e os próximos passos.',
          `<div class="row" style="margin-bottom:8px"><button type="button" class="btn sm" data-act="recall-timer">${left ? 'Reiniciar' : 'Cronometrar 5 min'}</button><span id="recall-clock" class="clock">${left ? mmss(left) : ''}</span></div>
           <textarea name="recalled" rows="8" aria-label="O que você lembrou">${esc(n.recalled)}</textarea>`)}
        ${step(3, 'Abra a fonte e compare', 'O que faltou ou estava errado? Uma linha por item. Na próxima revisão, comece por aqui.',
          `<textarea name="missed" rows="4" aria-label="O que faltou">${esc(n.missed)}</textarea>
           ${hasCard(n.cardId) ? '<p class="muted small">Revisões já agendadas.</p>' : '<label class="check small"><input type="checkbox" name="mkCard" checked> Agendar revisões espaçadas desse conteúdo (cria um cartão)</label>'}`)}
        <div class="row"><button type="submit" class="btn primary">Salvar</button></div>
      </form>
      <div class="card" style="align-self:start">
        <h2>Exercícios</h2>
        <ul class="clist">${list.map((x) => `<li class="${x.id === recallId ? 'cur' : ''}">
          <button type="button" class="t linkbtn" data-act="recall-open" data-id="${x.id}">${esc(x.source)}</button>
          <span class="muted small">${fmtShort(x.date)}${x.missed ? ` · faltou ${lines(x.missed).length}` : ''}</span>
          <button type="button" class="icon" data-act="note-del" data-id="${x.id}" title="Excluir" aria-label="Excluir">✕</button></li>`).join('') || '<li class="empty">Nenhum ainda.</li>'}</ul>
      </div>
    </div>`;
  }

  function view(tab = '') {
    const today = ymd();
    const due = dueCards(S.cards, today).length;
    const t = ['feynman', 'recuperacao'].includes(tab) ? tab : '';
    const sub = {
      '': 'Revise um pouco todo dia: no dia 1, 3, 7 e 14 depois de aprender. Errou, o cartão volta ao começo.',
      feynman: 'Explicar mostra o que você realmente sabe. Entender ao ler não é saber explicar.',
      recuperacao: 'Fechar o material e lembrar fixa mais do que reler ou grifar.',
    }[t];
    return `${head('06 · Academia', 'Aprenda para lembrar.', sub, ['Regra 14 · Repetição espaçada', 'Regra 2 · Feynman', 'Regra 6 · Recuperação ativa'])}
    ${tabs(t, due)}
    ${t === 'feynman' ? feynTab() : t === 'recuperacao' ? recallTab() : cardsTab(today)}`;
  }

  const val = (fd, k) => String(fd.get(k) || '').trim();
  const act = {
    'card-show': (el) => { revealed = el.dataset.id; render(); },
    'card-grade': async (el) => {
      const c = S.cards.find((x) => x.id === el.dataset.id);
      if (!c) return;
      const n = schedule(c, el.dataset.g, ymd());
      Object.assign(c, n);
      revealed = null;
      await save('cards', c);
      render();
    },
    'card-del': async (el) => {
      const c = S.cards.find((x) => x.id === el.dataset.id);
      if (c && confirm(`Excluir o cartão “${c.front}”?`)) { await remove('cards', c.id); render(); }
    },
    'feyn-new': () => { feynId = null; render(); },
    'feyn-open': (el) => { feynId = el.dataset.id; render(); window.scrollTo(0, 0); },
    'recall-new': () => { recallId = null; render(); },
    'recall-open': (el) => { recallId = el.dataset.id; render(); window.scrollTo(0, 0); },
    'note-del': async (el) => {
      const n = S.notes.find((x) => x.id === el.dataset.id);
      if (!n || !confirm('Excluir este registro? Os cartões e tarefas criados a partir dele continuam.')) return;
      if (feynId === n.id) feynId = null;
      if (recallId === n.id) recallId = null;
      await remove('notes', n.id);
      render();
    },
    'recall-timer': () => {
      recallEnd = Date.now() + 5 * 60000;
      clearInterval(recallTimer);
      const paint = () => {
        const el = document.getElementById('recall-clock');
        const left = recallLeft();
        if (el) el.textContent = left ? mmss(left) : '';
        if (!left) {
          clearInterval(recallTimer);
          beep?.();
          toast('5 minutos. Agora abra a fonte e compare.');
        }
      };
      recallTimer = setInterval(paint, 500);
      paint();
      document.querySelector('#main textarea[name=recalled]')?.focus();
    },
  };
  const chg = {
    'card-deck': (el) => { deckFilter = el.value; render(); },
    'recall-source': (el) => {
      const box = document.getElementById('recall-prev');
      if (box) box.innerHTML = prevBox(prevMissed(el.value, recallId));
    },
  };
  const form = {
    card: async (f, fd) => {
      const front = val(fd, 'front');
      if (!front) return;
      lastDeck = val(fd, 'deck');
      await addCard(front, val(fd, 'back'), lastDeck);
      toast('Cartão criado. Primeira revisão amanhã.');
      render();
      document.querySelector('#main textarea[name=front]')?.focus();
    },
    feynman: async (f, fd) => {
      const prev = S.notes.find((x) => x.id === feynId);
      const n = { ...(prev || { id: uid(), type: 'feynman', createdAt: Date.now(), date: ymd() }),
        concept: val(fd, 'concept'), explanation: val(fd, 'explanation'), gaps: val(fd, 'gaps'), simple: val(fd, 'simple') };
      if (!n.concept) { toast('Escolha o conceito primeiro.'); return; }
      let msg = 'Explicação salva.';
      const gaps = lines(n.gaps);
      if (fd.get('mkTasks') && gaps.length && !n.tasksMade) {
        for (const g of gaps) await newTask(`Reaprender: ${g}`);
        n.tasksMade = true;
        msg += ` ${gaps.length} tarefa(s) na casinha 2.`;
      }
      if (fd.get('mkCard') && !hasCard(n.cardId)) {
        const back = n.simple || n.explanation;
        if (!back) msg += ' Escreva a explicação antes de criar o cartão.';
        else { n.cardId = (await addCard(`Explique com suas palavras: ${n.concept}`, back, 'Feynman')).id; msg += ' Cartão criado: primeira revisão amanhã.'; }
      }
      await save('notes', n);
      feynId = n.id;
      toast(msg);
      render();
    },
    recall: async (f, fd) => {
      const prev = S.notes.find((x) => x.id === recallId);
      const n = { ...(prev || { id: uid(), type: 'recall', createdAt: Date.now(), date: ymd() }),
        source: val(fd, 'source'), recalled: val(fd, 'recalled'), missed: val(fd, 'missed') };
      if (!n.source) { toast('Diga o que você estudou.'); return; }
      let msg = 'Exercício salvo.';
      if (fd.get('mkCard') && !hasCard(n.cardId)) {
        const back = n.missed ? `Da última vez faltou:\n${n.missed}` : n.recalled;
        n.cardId = (await addCard(`Sem olhar: o que você lembra de “${n.source}”?`, back, 'Recuperação')).id;
        msg += ' Revisões agendadas: primeira amanhã.';
      }
      await save('notes', n);
      recallId = n.id;
      clearInterval(recallTimer);
      recallEnd = 0;
      toast(msg);
      render();
    },
  };
  return { view, act, chg, form };
}

// Manual do ARSENAL: as 14 regras do PDF original, ampliadas com passo a passo,
// uso no app, dicas, vantagens e armadilhas. Conteúdo estático (sem dados do usuário).

const TAG = { e: 'evidência', h: 'heurística', m: 'metáfora' };

export const RULES = [
  {
    n: 1, title: 'A regra dos 5 segundos', tag: 'h', area: 'Foco', phase: 1,
    lead: 'Quando pensar em fazer algo produtivo, conte 5-4-3-2-1 e mova o seu corpo, antes que a dúvida se instale.',
    how: [
      'Perceba o momento da hesitação: “depois eu faço”, “só mais um minuto”.',
      'Conte de trás para frente, 5-4-3-2-1, em voz baixa ou mentalmente.',
      'No 1, faça um movimento físico concreto: levantar, abrir o arquivo, pegar o telefone.',
      'O movimento é só o primeiro passo da tarefa, não ela inteira.',
    ],
    app: 'O botão <b>5s ▶</b> no Painel, em cada tarefa e no Foco mostra a contagem em tela cheia. No final, o Pomodoro começa sozinho.',
    tips: [
      'Decida antes qual é o “primeiro movimento” (por exemplo, “abrir a planilha de custos”).',
      'Combine com o Pomodoro: você só precisa aguentar 25 minutos, não a tarefa toda.',
      'Para uma ligação difícil, disque no “1”, sem ensaiar.',
    ],
    gains: ['Corta a negociação interna antes que ela comece.', 'Não custa nada e funciona em qualquer lugar.', 'Transforma intenção em ação visível.'],
    traps: ['Não resolve falta de clareza: se você não sabe o que fazer, classifique a tarefa antes (regra 3).', 'Não serve para decisões que exigem reflexão.'],
  },
  {
    n: 2, title: 'A técnica de Feynman', tag: 'e', area: 'Academia', phase: 1,
    lead: 'Escolha um conceito, explique como se ensinasse uma criança de 12 anos, identifique onde trava e reaprenda essa parte.',
    how: [
      '<b>Escolha</b> um conceito específico: não “economia”, mas “como funcionam os juros compostos”.',
      '<b>Ensine</b> por escrito, sem jargão, como se o leitor tivesse 12 anos.',
      '<b>Diagnostique</b>: marque onde travou ou onde usou uma palavra difícil sem explicar. Ali está a lacuna.',
      '<b>Reaprenda</b> só esses pontos na fonte e reescreva a explicação, mais curta e com uma analogia.',
    ],
    app: 'Tela <b>Academia → Técnica de Feynman</b>: os 4 passos em sequência. Cada lacuna pode virar a tarefa “Reaprender: …” na casinha 2, e a explicação final vira um cartão de revisão espaçada.',
    tips: [
      'Feche o material antes de explicar. Senão vira um resumo copiado.',
      'Teste final: você consegue dar um exemplo que não estava na fonte?',
      'Explique em voz alta e grave; ouvir a gravação mostra as hesitações.',
      'Limite a explicação a uma página.',
    ],
    gains: ['Expõe a “ilusão de saber”: entender ao ler não é saber explicar.', 'Melhora a capacidade de comunicar a ideia a outras pessoas.'],
    traps: ['Simplificar demais até a explicação ficar errada.', 'Pular o passo 3: o valor está em achar a lacuna.'],
  },
  {
    n: 3, title: 'Matriz de Eisenhower', tag: 'h', area: 'Tarefas', phase: 1,
    lead: 'Classifique cada tarefa em uma casinha: 1 Faça, 2 Agende, 3 Delegue, 4 Elimine.',
    how: [
      'Para cada tarefa, pergunte: <b>é importante?</b> Ela contribui para uma meta sua.',
      'Depois: <b>é urgente?</b> Haverá consequência se não for feita hoje ou amanhã.',
      '1 Faça hoje · 2 Agende com dia e hora · 3 Delegue · 4 Elimine sem culpa.',
      'Sem equipe, “delegar” vira automatizar, agrupar, responder curto ou renegociar o prazo.',
    ],
    app: 'Tela <b>Tarefas</b>: escolha a casinha ao cadastrar, arraste entre quadrantes e use ✕ para eliminar a casinha 4. A ★ leva a tarefa para as prioridades do dia.',
    tips: [
      'Revise a matriz em 5 minutos no começo do dia.',
      'O sinal de saúde é a casinha 2 crescer e a 1 encolher. Casinha 1 sempre cheia é sintoma de falta de planejamento.',
      'Seja rígido com “importante”: o que outra pessoa considera urgente nem sempre é importante para você.',
    ],
    gains: ['Separa ruído de valor em segundos.', 'Dá permissão explícita para não fazer algumas coisas.'],
    traps: ['Tudo virar casinha 1.', 'Casinha 2 nunca ganhar horário e apodrecer na lista.'],
  },
  {
    n: 4, title: 'A regra dos 2 minutos', tag: 'h', area: 'Tarefas', phase: 1,
    lead: 'Se uma tarefa leva menos de 2 minutos, faça no momento e não coloque na lista.',
    how: [
      'Surgiu uma tarefa (e-mail, documento, mensagem)?',
      'Pergunte: leva menos de 2 minutos?',
      'Sim: faça agora. Não: registre e classifique na matriz.',
    ],
    app: 'Na tela <b>Tarefas</b>, o botão <b>&lt; 2 min · feito agora</b> conta a tarefa como resolvida sem criar um item pendente. Ela aparece em “Resolvidas hoje”.',
    tips: [
      'Durante um bloco de foco, a regra fica suspensa: anote e resolva depois, em lote.',
      'Agrupe as tarefas pequenas em janelas fixas, como 11h e 16h.',
    ],
    gains: ['Evita que as pequenas pendências virem bagunça mental.', 'Dá sensação de progresso rápido.'],
    traps: ['Uma cadeia de “só 2 minutos” que consome a manhã inteira.', 'Estimar com otimismo: muita coisa de “2 minutos” leva 15.'],
  },
  {
    n: 5, title: 'A técnica Pomodoro', tag: 'h', area: 'Foco', phase: 1,
    lead: 'Foco de 25 minutos com o celular longe, pausa de 5 e, depois de 4 ciclos, uma pausa de 20 a 30 minutos.',
    how: [
      'Escolha <b>uma</b> tarefa antes de iniciar.',
      'Foco por 25 min. Se lembrar de outra coisa, anote e volte.',
      'Pausa de 5 min: caminhe, alongue-se, beba água. Longe da tela.',
      'Depois de 4 ciclos, faça uma pausa longa de 20 a 30 min.',
    ],
    app: 'Tela <b>Foco</b>. Vincule a tarefa, inicie com a contagem e acompanhe os ciclos pelas bolinhas. As sessões ficam registradas, inclusive as parciais. Os tempos podem ser ajustados em Dados.',
    tips: [
      'Para trabalho profundo, teste 50/10 em vez de 25/5.',
      'Se estiver fluindo bem, use “Encerrar ciclo” quando terminar o raciocínio, não no meio dele.',
      'O total semanal no Painel é a medida honesta de quanto você realmente trabalhou.',
    ],
    gains: ['Começar fica fácil: são só 25 minutos.', 'Mede o esforço real, não a sensação de ocupação.', 'As pausas evitam a fadiga do fim do dia.'],
    traps: ['Ficar no celular durante a pausa: ela deixa de descansar.', 'Ser escravo do alarme em tarefas que exigem imersão longa.'],
  },
  {
    n: 6, title: 'Recuperação ativa', tag: 'e', area: 'Academia', phase: 1,
    lead: 'Depois de ler um capítulo ou participar de uma reunião, feche as anotações, escreva tudo o que lembra e revise o que deixou passar.',
    how: [
      'Termine a leitura ou a reunião.',
      'Feche tudo e escreva por 5 minutos o que lembrar: ideias, números, decisões.',
      'Abra a fonte e compare. Marque o que faltou.',
      'Na próxima revisão, comece pelo que faltou.',
    ],
    app: 'Tela <b>Academia → Recuperação ativa</b>: cronômetro de 5 minutos, campo para o que lembrou e campo para o que faltou. Na próxima vez com a mesma fonte, o app mostra o que faltou antes. Um cartão agenda as revisões.',
    tips: [
      'Depois de reuniões, escreva 3 decisões e os próximos passos, sem olhar a ata.',
      'Transforme o conteúdo em perguntas; responder é mais eficaz do que reler.',
      'O desconforto de não lembrar é o que fortalece a memória.',
    ],
    gains: ['Fixa melhor do que reler ou grifar (é o chamado “efeito de teste”).', 'Mostra com precisão o que você ainda não sabe.'],
    traps: ['Espiar a fonte antes de terminar de escrever.', 'Desistir porque parece mais difícil do que reler.'],
  },
  {
    n: 7, title: 'A regra do 1%', tag: 'm', area: 'Hábitos', phase: 1,
    lead: 'Escolha uma habilidade ou hábito e melhore uma quantidade quase imperceptível, todos os dias.',
    how: [
      'Escolha uma única habilidade ou hábito.',
      'Defina o menor avanço possível: 1 página a mais, 1 passo a mais, 1 contato a mais.',
      'Registre todo dia. A sequência importa mais que a intensidade.',
      'Só aumente a dose quando a atual estiver fácil.',
    ],
    app: 'Tela <b>Hábitos</b>: crie o hábito pequeno e acompanhe a sequência e o percentual de 30 dias. A sequência visível é o seu “juro composto”.',
    tips: [
      'Pequeno o bastante para fazer até no pior dia.',
      'Meça uma coisa simples: páginas, minutos, repetições.',
    ],
    gains: ['Baixíssimo atrito para começar.', 'Constrói identidade: “sou alguém que lê todo dia”.'],
    traps: [
      '1,01³⁶⁵ ≈ 37,8 é uma metáfora, não uma previsão. O progresso real tem platôs e recaídas.',
      'Abandonar ao primeiro dia perdido. Regra prática: nunca falhe dois dias seguidos.',
    ],
  },
  {
    n: 8, title: 'Blocos de trabalho profundo', tag: 'h', area: 'Foco', phase: 1,
    lead: 'Bloqueie de 2 a 4 horas na agenda, desligue as notificações, deixe o celular em outro cômodo e trabalhe em uma única tarefa de alto valor.',
    how: [
      'Marque o bloco na agenda como uma “reunião comigo mesmo”.',
      'Ative o “Não perturbe” do Windows (clique no relógio da barra de tarefas).',
      'Celular em outro cômodo, não só virado para baixo.',
      'Uma única tarefa da casinha 2, de alto impacto.',
    ],
    app: 'Tela <b>Foco</b>: o checklist “Antes de um bloco profundo” e Pomodoros seguidos com a mesma tarefa vinculada. O app <b>não</b> consegue silenciar o Windows: o checklist é um lembrete.',
    tips: [
      'Mesmo horário todos os dias. A manhã cedo costuma render mais.',
      'Prepare arquivos e materiais antes de começar, para não ter desculpa para sair.',
      'Se 4 horas parecer impossível, comece com 90 minutos.',
    ],
    gains: ['É aqui que sai o trabalho de maior valor.', 'Menos troca de contexto, menos cansaço.'],
    traps: ['Usar o bloco para e-mail e mensagens.', 'Deixar reuniões invadirem o horário: trate-o como inegociável.'],
  },
  {
    n: 9, title: 'O pré-mortem', tag: 'e', area: 'Metas', phase: 1,
    lead: 'Antes de iniciar um projeto, imagine que se passaram 6 meses e ele fracassou completamente. Por quê?',
    how: [
      'Descreva o projeto e o resultado esperado.',
      'Imagine o fracasso total daqui a 6 meses.',
      'Durante 10 minutos, liste todos os motivos possíveis, sem filtrar.',
      'Classifique os motivos por probabilidade e impacto, e escolha os 3 piores.',
      'Para cada um, defina uma proteção e um sinal de alerta.',
    ],
    app: 'Tela <b>Metas → Pré-mortem</b>: liste os motivos, classifique cada um por chance e impacto, e os 3 piores sobem sozinhos para receber proteção e sinal de alerta. Cada proteção vira tarefa na casinha 2 com um toque.',
    tips: [
      'Funciona sozinho. Em equipe, peça para cada pessoa escrever antes de falar.',
      'Inclua causas pessoais: perder o ânimo, falta de tempo, ficar doente.',
    ],
    gains: ['Torna aceitável falar de risco sem parecer pessimista.', 'Corrige o otimismo natural dos planos.'],
    traps: ['Virar uma lista bonita sem nenhuma ação.', 'Exagerar a ponto de travar o início do projeto.'],
  },
  {
    n: 10, title: 'Empilhamento de hábitos', tag: 'e', area: 'Hábitos', phase: 1,
    lead: 'Identifique um hábito que você já faz de forma consistente e encaixe o novo logo depois dele. O hábito existente vira o gatilho.',
    how: [
      'Liste o que você já faz todo dia: servir café, escovar os dentes, abrir o notebook.',
      'Escolha um gatilho com hora e lugar definidos.',
      'Escreva: “Depois de [gatilho], vou [novo hábito]”.',
      'No começo, o novo hábito deve levar menos de 2 minutos.',
    ],
    app: 'Tela <b>Hábitos</b>: o formulário já usa a frase “Depois de…, vou…”. Marque os dias nos quadradinhos e acompanhe pelo Painel.',
    tips: [
      'Gatilho preciso: “depois de servir o café”, não “de manhã”.',
      'Um hábito novo por vez. Acrescente outro só quando o anterior estiver automático.',
      'Deixe o material à vista: o caderno ao lado da cafeteira.',
    ],
    gains: ['Aproveita um automatismo que já existe.', 'Acaba com a pergunta “quando eu vou fazer isso?”.'],
    traps: ['Escolher um gatilho que não acontece todo dia.', 'Empilhar cinco hábitos de uma vez.'],
  },
  {
    n: 11, title: 'O princípio 80/20', tag: 'm', area: 'Tarefas', phase: 1,
    lead: '80% dos resultados vêm de 20% das ações. Elimine, delegue e reduza o tempo do resto.',
    how: [
      'Liste as atividades da semana.',
      'Para cada uma, anote o resultado que ela gerou.',
      'Identifique as poucas que geraram a maior parte do resultado.',
      'Proteja essas atividades e corte, delegue ou encurte as demais.',
    ],
    app: 'Cada tarefa tem um campo <b>Impacto (1–5)</b>. A <b>Revisão semanal</b> (link no Painel) mostra para onde foi o foco da semana, tarefa por tarefa, e quanto dele foi para tarefas de impacto 4–5. Para análises maiores, exporte os CSVs em Dados.',
    tips: [
      'A proporção raramente é exatamente 80/20. O que importa é a desigualdade, não o número.',
      'Faça essa análise uma vez por mês, com dados reais.',
    ],
    gains: ['Mostra onde o esforço tem mais retorno.', 'Justifica dizer “não” com base em dados.'],
    traps: ['Presumir quais são os 20% sem medir.', 'Cortar tarefas de manutenção que parecem inúteis, mas evitam problemas.'],
  },
  {
    n: 12, title: 'A estratégia das duas listas', tag: 'h', area: 'Metas', phase: 1,
    lead: 'Escreva suas 5 principais metas do trimestre. Faça uma segunda lista com tudo o mais que tenta você, e evite essas coisas até concluir as 5. A clareza vem da eliminação.',
    how: [
      'Escreva até 25 metas ou desejos para o trimestre.',
      'Circule as 5 mais importantes: essa é a lista de prioridades.',
      'O resto vai para a lista de ruído: evitar a todo custo.',
      'Só tire algo da lista de ruído depois de concluir as 5.',
    ],
    app: 'Tela <b>Metas → Duas listas</b>, por trimestre: escreva até 25, escolha 5 com ★. A lista de ruído fica <b>travada</b> até as 5 serem concluídas. Cada meta pode virar tarefa na casinha 2 com impacto 5.',
    tips: [
      'Revise as listas a cada trimestre, com o diário em mãos.',
      'Uma ideia nova vai para a lista de ruído: adiada, não descartada.',
    ],
    gains: ['Diminui a dispersão entre muitas frentes boas.', 'O perigo são as metas medianas, que roubam tempo das melhores.'],
    traps: ['Pôr na lista de ruído coisas obrigatórias, como saúde e contas.', 'Ter mais de 5 prioridades “porque todas são importantes”.'],
  },
  {
    n: 13, title: 'Diário de reflexão', tag: 'h', area: 'Evolução', phase: 1,
    lead: '10 minutos, todas as noites: o que deu certo, o que não deu certo e uma mudança específica para amanhã. Não é um diário íntimo, é um ciclo de retroalimentação.',
    how: [
      'Mesmo horário toda noite, por 10 minutos.',
      '🟢 O que deu certo hoje.',
      '🔴 O que não deu certo, sem julgamento.',
      '🟡 Uma mudança específica e verificável para amanhã.',
    ],
    app: 'Tela <b>Diário</b>. A mudança aparece no topo do Painel no dia seguinte e pode virar tarefa na casinha 2 com um clique.',
    tips: [
      'Específica: “abrir o e-mail só depois das 10h”, não “ser mais focado”.',
      'Uma vez por semana, releia o “não deu certo”. Os padrões que se repetem pedem ação.',
      'Empilhe o diário num hábito: “depois de escovar os dentes à noite, vou preencher o diário”.',
    ],
    gains: ['Cada dia ensina algo ao seguinte.', 'Cria um histórico para revisões mensais e trimestrais.'],
    traps: ['Virar desabafo longo e cansativo.', 'Escrever mudanças vagas, que não dá para verificar no dia seguinte.'],
  },
  {
    n: 14, title: 'Repetição espaçada', tag: 'e', area: 'Academia', phase: 1,
    lead: 'Depois de aprender algo novo, revise após 1 dia, 3 dias, 7 dias e 14 dias.',
    how: [
      'Registre o que aprendeu como perguntas e respostas curtas.',
      'Revise no dia 1, 3, 7 e 14 depois do aprendizado.',
      'Antes de olhar a resposta, tente lembrar (é a regra 6).',
      'Errou? Volte o cartão para o início do ciclo.',
    ],
    app: 'Tela <b>Academia → Revisar cartões</b>: o cartão novo aparece no dia 1, 3, 7 e 14 e depois em intervalos maiores. “Errei” volta ao início; “Fácil” pula uma etapa. O Painel mostra quantos estão para hoje.',
    tips: [
      'Uma ideia por cartão. Cartão grande vira releitura.',
      'Escreva com as suas palavras, não copie da fonte.',
      'Revise um pouco todo dia, para as revisões não se acumularem.',
    ],
    gains: ['É uma das técnicas de aprendizagem com mais respaldo científico.', 'Gasta pouco tempo para manter muito conteúdo.'],
    traps: ['Criar cartões demais e abandonar diante da pilha de revisões.', 'Decorar a resposta sem entender (combine com a regra 2).'],
  },
];

const ROUTINE = [
  { when: 'Manhã', time: '10 min', items: [
    ['10', 'Depois do café, escolha as <b>3 prioridades</b> no Painel.'],
    ['13', 'Leia a <b>mudança</b> que você decidiu ontem, no topo do Painel.'],
    ['3', 'Passe 5 minutos na <b>matriz</b>: o que é 1, o que é 2.'],
    ['14', 'Revise os <b>cartões do dia</b> na Academia.'],
  ] },
  { when: 'Durante o dia', time: 'blocos', items: [
    ['8', '<b>Bloco profundo</b> de 2 a 4 h numa tarefa da casinha 2.'],
    ['1', 'Comece com <b>5s ▶</b>, sem negociar.'],
    ['5', '<b>Pomodoros</b> com pausas longe da tela.'],
    ['4', 'Pequenas tarefas em <b>janelas</b> (11h e 16h), pela regra dos 2 minutos.'],
  ] },
  { when: 'Noite', time: '10 min', items: [
    ['13', 'Preencha o <b>diário</b>: três respostas curtas.'],
    ['10', 'Marque os <b>hábitos</b> do dia.'],
  ] },
  { when: 'Semana', time: '30 min', items: [
    ['11', 'Faça a <b>revisão semanal</b> (Painel → Revisão semanal): veja para onde foi o <b>foco</b> e se foi para o que dá <b>resultado</b>.'],
    ['12', 'Confira as <b>5 metas</b> do trimestre na tela Metas.'],
    ['9', 'Projeto novo à vista? Faça um <b>pré-mortem</b>.'],
    ['13', 'Na mesma revisão, releia os diários e escolha o <b>foco principal</b> da próxima semana.'],
  ] },
];

const list = (arr) => `<ul>${arr.map((x) => `<li>${x}</li>`).join('')}</ul>`;
const phaseLabel = (p) => (p === 1 ? 'No app hoje' : `Fase ${p}`);

export function viewManual() {
  return `
  <header class="view-head">
    <div class="kicker">Manual · O Arsenal de Alta Performance</div>
    <h1>14 regras para dominar seu foco, tempo e aprendizado.</h1>
    <p class="sub">O material original, ampliado com passo a passo, onde cada regra está no ARSENAL, dicas, vantagens e armadilhas.</p>
    <div class="row no-print" style="margin-top:16px">
      <button type="button" class="btn primary" data-act="print">Imprimir ou salvar em PDF</button>
      <a class="btn" href="#/manual/rotina">Rotina sugerida</a>
    </div>
  </header>

  <section class="man-intro grid g3">
    <div class="card"><h2>Comece com três</h2><p>Na primeira semana, use só a <b>matriz</b> (3), o <b>Pomodoro</b> (5) e o <b>diário</b> (13). Acrescente uma regra por semana. Adotar as 14 de uma vez é o jeito mais rápido de abandonar todas.</p></div>
    <div class="card"><h2>Execute, registre, melhore</h2><p>O app responde a três perguntas: <b>o que preciso fazer?</b> (Tarefas), <b>como executo com foco?</b> (Foco) e <b>estou evoluindo ou só ocupado?</b> (Diário, Hábitos e Painel). A <b>Academia</b> cuida do aprendizado e a tela <b>Metas</b>, do trimestre.</p></div>
    <div class="card"><h2>Nem toda regra pesa igual</h2><p class="man-legend">
      <span class="tag e">evidência</span> respaldo na pesquisa<br>
      <span class="tag h">heurística</span> regra prática útil, sem garantia<br>
      <span class="tag m">metáfora</span> ideia inspiradora, não cálculo</p></div>
  </section>

  <nav class="man-toc card" aria-label="Índice das regras">
    <h2>Índice</h2>
    <ol>${RULES.map((r) => `<li><a href="#/manual/${r.n}"><b>${r.n}</b> ${r.title}</a><span class="tag ${r.tag}">${TAG[r.tag]}</span><span class="man-ph ${r.phase === 1 ? 'on' : ''}">${phaseLabel(r.phase)}</span></li>`).join('')}</ol>
  </nav>

  ${RULES.map((r) => `
  <article class="man-rule" id="regra-${r.n}">
    <div class="man-num">${r.n}</div>
    <div class="man-body">
      <div class="man-top">
        <h2>${r.title}</h2>
        <span class="tag ${r.tag}">${TAG[r.tag]}</span>
        <span class="man-ph ${r.phase === 1 ? 'on' : ''}">${phaseLabel(r.phase)} · ${r.area}</span>
      </div>
      <blockquote>${r.lead}</blockquote>
      <div class="man-cols">
        <section><h3>Como executar</h3><ol>${r.how.map((x) => `<li>${x}</li>`).join('')}</ol></section>
        <section class="man-app"><h3>No ARSENAL</h3><p>${r.app}</p></section>
      </div>
      <div class="man-cols three">
        <section><h3>Dicas</h3>${list(r.tips)}</section>
        <section class="ok"><h3>Vantagens</h3>${list(r.gains)}</section>
        <section class="bad"><h3>Armadilhas</h3>${list(r.traps)}</section>
      </div>
      <a class="link no-print" href="#/manual">↑ Índice</a>
    </div>
  </article>`).join('')}

  <section class="man-routine" id="regra-rotina">
    <div class="kicker">Juntando tudo</div>
    <h2 class="man-h">Rotina sugerida</h2>
    <p class="sub" style="margin-top:0">As regras rendem mais combinadas. Adapte os horários: o importante é que o ciclo feche todos os dias.</p>
    <div class="grid g4">
      ${ROUTINE.map((b) => `<div class="card"><div class="card-head"><h3>${b.when}</h3><span class="muted small">${b.time}</span></div>
        <ul class="man-steps">${b.items.map(([n, t]) => `<li><a href="#/manual/${n}" class="man-chip">${n}</a><span>${t}</span></li>`).join('')}</ul></div>`).join('')}
    </div>
  </section>

  <p class="muted small man-foot">Baseado no material “O Arsenal de Alta Performance: 14 regras essenciais para dominar seu foco, tempo e aprendizado”. As classificações de evidência são indicativas e não substituem orientação profissional.</p>`;
}

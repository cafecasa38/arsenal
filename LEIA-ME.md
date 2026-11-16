# ARSENAL — MVP (Fase 1)

PWA offline baseada no PDF *O Arsenal de Alta Performance*. Sem dependências, sem servidor remoto, sem telemetria. Os dados ficam no IndexedDB do navegador, neste computador.

## Como abrir

> Para usar no tablet, no celular ou em mais de um aparelho, siga o **COMO-PUBLICAR-E-INSTALAR.md**. O passo a passo abaixo é só para usar no PC, sem publicar.

1. Dê dois cliques em `iniciar.cmd`. Ele sobe um servidor local com o Python (`http://localhost:5179`) e abre o navegador.
2. Para instalar como aplicativo no Edge ou no Chrome, use o ícone "Instalar" na barra de endereço. O app passa a abrir em janela própria.
3. Depois da primeira abertura, o app funciona sem internet. Mas o servidor local precisa estar rodando, ou o app precisa ter sido instalado e aberto ao menos uma vez.

**Importante:** use sempre a mesma porta (5179). O navegador guarda os dados por endereço. Se mudar a porta ou abrir em outro navegador, os dados parecem ter "sumido", mas continuam no endereço antigo.

## O que tem nesta fase

| Tela | Regras do PDF |
|---|---|
| 01 Painel | 3 prioridades do dia, foco em 7 dias, hábitos de hoje e lembrete da mudança decidida no diário de ontem |
| 02 Tarefas | 3 Eisenhower (arrastar entre casinhas), 4 regra dos 2 minutos (botão "feito agora", fora da lista), impacto de 1 a 5 (base para o 80/20 da Fase 3) |
| 03 Foco | 1 contagem 5-4-3-2-1, 5 Pomodoro 25/5/20 com 4 ciclos, 8 checklist de trabalho profundo, histórico de sessões |
| 04 Diário | 13 três perguntas; a mudança pode virar tarefa na casinha 2 |
| 05 Hábitos | 10 "Depois de [gatilho], vou [novo hábito]", sequência e percentual em 30 dias |
| 06 Academia | 14 cartões com revisão no dia 1, 3, 7 e 14 (depois intervalos maiores; "Errei" volta ao início), 2 Feynman em 4 passos (lacunas viram tarefas "Reaprender"), 6 recuperação ativa com cronômetro de 5 min e lembrete do que faltou da última vez |
| 07 Metas | 12 duas listas por trimestre (até 25, escolha 5; o ruído fica travado até concluir as 5), 9 pré-mortem (motivos com chance × impacto; os 3 piores recebem proteção, sinal de alerta e tarefa) |
| Revisão semanal | aberta pelo Painel e pelo Diário: números da semana, para onde foi o foco por tarefa e impacto (11, 80/20), releitura dos diários (13), limpeza da matriz, conferência das metas (12) e o foco principal da próxima semana, que fica no topo do Painel |
| Manual | as 14 regras com passo a passo, uso no app, dicas, vantagens, armadilhas e grau de evidência, mais uma rotina diária e semanal. As etiquetas "Regra N" de cada tela abrem a regra no manual. O botão "Imprimir ou salvar em PDF" gera a versão impressa; uma cópia pronta está em `Manual_ARSENAL.pdf` |
| Dados | backup e restauração em JSON, CSV para Excel (separador `;`), durações do Pomodoro, notificações e classificação das regras (evidência, heurística ou metáfora) |

## Sincronização entre aparelhos

Opcional, pelo Firebase (Google), no plano gratuito. Fica desligada até preencher o `firebase-config.js`. Veja o **CONFIGURAR-SINCRONIZACAO.md**. O código fica em `sync.js`; os testes ficam fora desta pasta, em `../tests/`.

## Limitações conhecidas

- **Avisos só funcionam com o app aberto**, mesmo minimizado. Fechado, nada toca.
- **Sem sincronização, limpar os dados do navegador apaga tudo.** Exporte o backup de vez em quando e guarde-o no OneDrive.
- **O tempo de foco só conta o que você cronometra no app.** O app não vê o que acontece fora dele.

## Arquivos

`index.html` (estrutura), `styles.css` (visual), `app.js` (telas, lógica e Pomodoro), `academia.js`, `metas.js` e `revisao.js` (telas 06, 07 e revisão semanal), `db.js` (IndexedDB), `sw.js` (offline), `manifest.webmanifest` e `icon.svg` (instalação).

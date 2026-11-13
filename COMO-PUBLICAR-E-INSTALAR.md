# Como colocar o ARSENAL no tablet, no celular e no PC

Resumo: você publica o app **uma vez**, de graça, no **GitHub Pages**. Ele ganha um endereço como `https://seunome.github.io/arsenal/`. Em cada aparelho, você abre esse endereço e escolhe **"Instalar"** ou **"Adicionar à tela inicial"**. Pronto: ele vira um ícone, abre em tela cheia e funciona sem internet.

> **Leia antes: cada aparelho tem os próprios dados.**
> Os dados ficam guardados dentro do aparelho, não na internet. Uma tarefa criada no tablet **não aparece** no celular sozinha.
> Para passar os dados de um aparelho para outro, use **Dados → Exportar backup** num aparelho e **Restaurar backup** no outro (por exemplo, salvando o arquivo no OneDrive).
> Sugestão: use o **tablet como aparelho principal** e faça um backup por semana.

---

## Parte 1 — Publicar (uma vez só, uns 15 minutos, no PC)

### 1. Criar a conta no GitHub (gratuita)
1. Acesse **github.com** e clique em **Sign up**.
2. Escolha um nome de usuário. Ele aparece no endereço do app: `nome.github.io`.
3. Confirme o e-mail.

### 2. Criar o repositório (a "pasta" do app no GitHub)
1. Já logado, clique no **+** no canto superior direito e escolha **New repository**.
2. Em **Repository name**, digite `arsenal`.
3. Marque **Public**. O GitHub Pages gratuito exige isso. Só o **código** do app fica público; **os seus dados nunca vão para lá**.
4. Clique em **Create repository**.

### 3. Enviar os arquivos
1. Na página do repositório recém-criado, clique no link **uploading an existing file**.
2. Abra a pasta do ARSENAL no Explorador de Arquivos, selecione **todos os arquivos** (Ctrl+A) e arraste para a página do GitHub.
3. Espere a lista carregar e clique em **Commit changes**, o botão verde no fim da página.

### 4. Ligar o site
1. No repositório, vá em **Settings** e depois em **Pages**, no menu à esquerda.
2. Em **Build and deployment** → **Branch**, escolha **main**, deixe **/ (root)** e clique em **Save**.
3. Espere de 1 a 2 minutos e recarregue a página. Vai aparecer: *"Your site is live at https://seunome.github.io/arsenal/"*.
4. Abra esse endereço para conferir. **Anote-o**: é ele que você vai usar nos aparelhos.

---

## Parte 2 — Instalar em cada aparelho

### Tablet ou celular Android (Chrome)
1. Abra o endereço no **Chrome**.
2. Toque no menu **⋮**, no canto superior direito.
3. Toque em **Instalar app** (em alguns aparelhos aparece **Adicionar à tela inicial**) e confirme.

### iPad ou iPhone (Safari)
1. Abra o endereço no **Safari**. Tem que ser o Safari: no Chrome do iPhone essa opção pode não aparecer.
2. Toque no botão **Compartilhar** (o quadrado com a seta para cima).
3. Role e toque em **Adicionar à Tela de Início** e depois em **Adicionar**.
4. **Use sempre pelo ícone**, não pelo Safari. Os dados do ícone e os do Safari ficam separados.

### PC com Windows (Edge ou Chrome)
1. Abra o endereço no **Edge**.
2. Clique no ícone **Instalar** que aparece na barra de endereço (um monitor com uma seta) ou vá em **⋯ → Aplicativos → Instalar este site como aplicativo**.
3. O app aparece no Menu Iniciar e pode ser fixado na barra de tarefas.

O `iniciar.cmd` deixa de ser necessário. Ele só servia para abrir o app localmente.

---

## Como é o uso no dia a dia

| Situação | O que acontece |
|---|---|
| Sem internet | Funciona normalmente depois da primeira abertura. |
| Pomodoro com a tela apagada | O tempo continua contando. Quando você volta, a sessão aparece registrada. **O alarme não toca com a tela bloqueada**, principalmente no iPad e no iPhone. Deixe a tela ligada se quiser ouvir o alarme. |
| Arrastar tarefas na matriz | No toque, use o **⋯ → Mover para**. O arrastar foi feito para mouse. |
| Mudar de aparelho | Faça **Exportar backup** num aparelho e **Restaurar backup** no outro. Restaurar **substitui** tudo no aparelho de destino. |
| Desinstalar o app ou limpar os dados do navegador | **Apaga os dados daquele aparelho.** Faça backup antes. |

## Como atualizar o app depois

Quando houver uma versão nova dos arquivos, volte ao repositório no GitHub, clique em **Add file → Upload files**, arraste os arquivos novos (eles substituem os antigos) e clique em **Commit changes**. Os aparelhos recebem a atualização na próxima vez que abrirem o app com internet. **Os dados não são afetados.**

## Alternativas ao GitHub Pages

- **Netlify** (netlify.com) ou **Cloudflare Pages**: também gratuitos. Você arrasta a pasta inteira para a página, sem criar repositório. Também exigem cadastro.
- Para um app pessoal, o GitHub Pages é o mais estável e não expira.

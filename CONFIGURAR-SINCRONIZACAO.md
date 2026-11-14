# Como ligar a sincronização entre aparelhos

Com a sincronização ligada, uma tarefa criada no PC aparece no tablet e no celular em segundos. Ela usa o **Firebase**, um serviço do Google, no **plano gratuito (Spark)**: não pede cartão de crédito e os limites diários (50 mil leituras, 20 mil gravações, 1 GB) ficam muito acima do uso pessoal.

Faça uma vez só, no PC. Leva uns 15 minutos.

## O que você precisa saber antes

- **Onde ficam os dados:** numa base de dados do Firebase **na sua conta Google**, em servidores do Google. Ficam protegidos por login: só a sua conta lê e grava. Não há criptografia de ponta a ponta, ou seja, o Google, como provedor, tecnicamente tem acesso. Se o diário tiver algo muito íntimo, leve isso em conta.
- **Quem acessa o quê:** o app só conversa com serviços do Google (login e banco de dados). Não há rastreamento nem Analytics.
- **Sem internet, tudo continua funcionando.** O que você fizer offline é enviado quando a conexão voltar.
- **Conflito:** se o mesmo item for alterado em dois aparelhos ao mesmo tempo, vale a alteração mais recente.

---

## Passo 1 — Criar o projeto
1. Acesse **console.firebase.google.com** e entre com a sua conta Google.
2. Clique em **Criar um projeto** (ou *Create a project*).
3. Nome: `arsenal`. Aceite os termos e continue.
4. Nas telas do **Gemini** e do **Google Analytics**, recuse ou desative. O app não usa nenhum dos dois.
5. Clique em **Criar projeto** e espere terminar.

## Passo 2 — Registrar o app e copiar a configuração
1. Na página inicial do projeto, clique no ícone **`</>`** (Web).
2. Apelido: `arsenal`. **Não** marque "Firebase Hosting".
3. Clique em **Registrar app**.
4. Aparece um trecho de código com `const firebaseConfig = { apiKey: ..., authDomain: ..., ... };`. **Copie só o bloco entre chaves `{ ... }`** e guarde. Você vai usá-lo no passo 5.
5. Clique em **Continuar no console**.

> A `apiKey` não é senha. Ela só identifica o projeto e pode ficar pública no GitHub. Quem protege os dados são o login e as regras do passo 4.

## Passo 3 — Ativar o login
1. No menu à esquerda, abra **Segurança → Authentication** e clique em **Vamos começar**. (Ou digite `Authentication` em **Pesquise produtos**, no topo do menu.)
2. Na aba **Método de login**, clique em **E-mail/senha**, ative a **primeira** opção e clique em **Salvar**.
3. *(Opcional)* Clique em **Adicionar novo provedor → Google**, ative, escolha seu e-mail de suporte e clique em **Salvar**.
4. Na aba **Configurações → Domínios autorizados**, clique em **Adicionar domínio** e digite: `cafecasa38.github.io`

## Passo 4 — Criar o banco de dados e protegê-lo
1. No menu, abra **Bancos de dados e armazenamento → Firestore** e clique em **Criar banco de dados**. (Ou digite `Firestore` em **Pesquise produtos**.)
2. Local: **`southamerica-east1 (São Paulo)`**. Isso não pode ser mudado depois.
3. Escolha **Iniciar no modo de produção** e clique em **Criar**.
4. Abra a aba **Regras**, apague tudo o que estiver lá e cole:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

5. Clique em **Publicar**.

Essas regras garantem que cada conta só enxerga os próprios dados.

## Passo 5 — Colocar a configuração no app
**Opção fácil:** mande para o Claude o bloco `{ ... }` copiado no passo 2, e ele preenche o arquivo.

**Ou faça você mesmo:** abra `firebase-config.js` no Bloco de Notas e troque a linha

```
export const firebaseConfig = null;
```

por

```
export const firebaseConfig = { ...o bloco que você copiou... };
```

Salve o arquivo.

Depois, envie ao GitHub os arquivos novos e alterados: no repositório, **Add file → Upload files**, arraste **todos os arquivos da pasta** (os repetidos são substituídos) e clique em **Commit changes**. Espere uns 2 minutos.

## Passo 6 — Entrar em cada aparelho
1. **No aparelho onde você já tem dados:** abra o ARSENAL, vá em **⚙ Dados**, digite e-mail e senha e toque em **Criar conta**. Tudo o que já existe nele sobe para a nuvem.
2. **Nos outros aparelhos:** **⚙ Dados → Entrar** com o mesmo e-mail e senha. Os dados chegam, e o que já existia no aparelho é **juntado** (nada é apagado).
3. O selo no menu mostra **● Sincronizado** (verde). No celular, aparece um pontinho verde no ⚙.

Se um aparelho estiver com o app aberto de antes, feche e abra de novo para ele carregar a versão nova.

## Passo 7 — Fechar a porta (recomendado)
Depois de criar a sua conta, impeça que outras pessoas criem contas no seu projeto:
**Authentication → Configurações → Ações do usuário →** desmarque **"Ativar criação (inscrição)"** e salve.

Nos outros aparelhos você continua usando **Entrar** normalmente.

---

## Problemas comuns

| Mensagem no app | O que fazer |
|---|---|
| "Configuração do Firebase inválida" | O bloco colado no `firebase-config.js` está incompleto. Copie de novo em **Configurações (engrenagem) → Configurações do projeto → Seus apps → Configuração do SDK → Config**. |
| "O login ainda não foi ativado" ou "Esse tipo de login não está ativado" | Volte ao passo 3. |
| "Este endereço não está autorizado" | Adicione `cafecasa38.github.io` em domínios autorizados (passo 3, item 4). |
| "A nuvem recusou o acesso" | As regras do passo 4 não foram publicadas. |
| "Entrar com Google" não abre no iPhone/iPad | Use e-mail e senha. Funcionam em todos os aparelhos. |
| Esqueci a senha | Digite o e-mail em Dados e toque em **Esqueci a senha**. |

Os backups em JSON (Dados → Exportar backup) continuam valendo como cópia de segurança extra.

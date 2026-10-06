---
title: Manual do desenvolvedor
description: Guia passo a passo para colaborar no CallingSupportApp desde o início: instale as ferramentas, baixe o repositório, veja o site e chegue ao seu primeiro PR.
updated: 2026-10-06
---

Este guia leva você **de um computador sem nada instalado até seu primeiro PR integrado**, sem precisar perguntar nada a ninguém. Siga-o na ordem. Cada passo diz o que fazer, o que você **deve ver** e o que fazer **se der errado**.

As regras do projeto (o motivo de cada coisa) estão em [CONTRIBUTING](https://github.com/MarAntBQ/CallingSupportApp/blob/main/CONTRIBUTING.md) e [AGENTS.md](https://github.com/MarAntBQ/CallingSupportApp/blob/main/AGENTS.md). Este manual é a sequência exata.

## 1. Antes de começar (10 minutos de leitura)

- **O que é:** ferramentas gratuitas para que uma ala ou ramo organize atividades (viagem ao templo, acampamentos, EnglishConnect). **Não é oficial** da Igreja e não substitui as Ferramentas do Membro. Leia o [README](https://github.com/MarAntBQ/CallingSupportApp#readme).
- **Três regras que prevalecem sobre todo o resto:**
  1. o **Manual Geral** da Igreja: se uma ideia o contrariar, ela não será construída;
  2. os **dados dos membros** são protegidos como o Manual determina (33.8): somente o necessário, somente para a atividade, nunca dados reais no repositório;
  3. o aplicativo **não lida com dinheiro** (capítulo 34).
- **Como trabalhamos:** CSATeam é uma equipe de iguais; ninguém é líder de ninguém. As dúvidas são feitas **por escrito, no issue**, nunca por chat privado.

- [ ] Li o README, as [Normas de uso](../rules/) e a [Política de dados](../privacy/).

## 2. Sua conta do GitHub

1. Crie uma conta no [github.com](https://github.com) se ainda não tiver.
2. Ative a **verificação em duas etapas**: *Settings → Password and authentication → Two-factor authentication*.
3. Ative o **e-mail privado** para os commits, para não publicar seu e-mail pessoal: *Settings → Emails → Keep my email addresses private*. Copie o endereço mostrado (termina em `@users.noreply.github.com`); você o usará no passo 4.

- [ ] Tenho uma conta, verificação em duas etapas e meu e-mail noreply.

## 3. Instalar as ferramentas

| Ferramenta | Windows | macOS / Linux |
|---|---|---|
| Git | [git-scm.com](https://git-scm.com/download/win) (inclui Git Bash) | já vem instalado, ou `brew install git` / `sudo apt install git` |
| Node.js 22 | [nvm-windows](https://github.com/coreybutler/nvm-windows) e depois `nvm install 22` | [nvm](https://github.com/nvm-sh/nvm) e depois `nvm install 22` |
| GitHub CLI | [cli.github.com](https://cli.github.com) | `brew install gh` / [instruções para Linux](https://github.com/cli/cli/blob/trunk/docs/install_linux.md) |
| Editor | [VS Code](https://code.visualstudio.com) ou o que você preferir | igual |

Confira as versões:

```sh
git --version
node -v
npm -v
gh --version
```

**Você deve ver** algo assim (os números podem ser mais novos; o Node precisa ser 22):

```
git version 2.54.0
v22.14.0
10.9.2
gh version 2.100.0
```

**Se der errado:** "no se reconoce el comando" significa que a ferramenta não foi adicionada ao `PATH`. Feche e abra o terminal novamente; se continuar, reinstale-a.

Inicie a sessão no GitHub pelo terminal:

```sh
gh auth login
```

Escolha *GitHub.com → HTTPS → Login with a web browser* e siga as instruções.

- [ ] As quatro ferramentas respondem e `gh auth status` diz que iniciei a sessão.

## 4. Configurar o Git

```sh
git config --global user.name "Seu nome"
git config --global user.email "123456+seu-usuario@users.noreply.github.com"
```

Quebras de linha (importante para os scripts funcionarem no servidor):

```sh
git config --global core.autocrlf true     # Windows
git config --global core.autocrlf input    # macOS y Linux
```

- [ ] `git config --global user.email` mostra meu e-mail noreply.

## 5. Baixar o repositório

**Se você ainda não é colaborador oficial** (o normal ao começar), trabalhe a partir do seu fork:

```sh
gh repo fork MarAntBQ/CallingSupportApp --clone
cd CallingSupportApp
git remote -v
```

**Você deve ver** dois remotos: `origin` é sua cópia e `upstream` é o original:

```
origin    https://github.com/<seu-usuario>/CallingSupportApp.git (fetch)
origin    https://github.com/<seu-usuario>/CallingSupportApp.git (push)
upstream  https://github.com/MarAntBQ/CallingSupportApp.git (fetch)
upstream  https://github.com/MarAntBQ/CallingSupportApp.git (push)
```

**Se você é colaborador oficial**, clone o original diretamente: `git clone https://github.com/MarAntBQ/CallingSupportApp.git` (você terá apenas `origin`).

**Se der errado:** se `gh repo fork` pedir para iniciar a sessão, volte ao passo 3 (`gh auth login`).

- [ ] Tenho o repositório no meu computador e `git remote -v` mostra o esperado.

## 6. Ver o site no seu computador

```sh
npm ci --prefix site
node site/build.mjs
node site/scripts/seo-check.mjs
npx serve _site
```

**Você deve ver:**

*(o programa imprime em espanhol)*

```
found 0 vulnerabilities
Sitio generado en _site/: 15 páginas, cada una con es, pt, en; 1 perfil(es), 2 novedad(es), 3 manual(es).
Sin problemas: títulos ≤ 60, descripciones 150–160, etiquetas únicas y JSON-LD válido.
```

E `npx serve _site` fornece um endereço (normalmente `http://localhost:3000`): abra-o no navegador. Cada vez que mudar um texto, execute novamente `node site/build.mjs` e recarregue.

Os testes do bot e dos perfis:

```sh
node --test .github/scripts/claim-logic.test.cjs .github/scripts/team-profiles.test.cjs
```

**Você deve ver** `# pass 15` e `# fail 0`.

**Se der errado:**
- `npm ci` falha → verifique se você tem o Node 22 (`node -v`).
- O build diz "El sitio no se generó" → leia a lista que ele imprime abaixo: ela informa o arquivo e o que está faltando.

- [ ] O site aparece no meu navegador e os testes passam.

## 7. Iniciar o aplicativo

Você precisa do **Docker** ([Docker Desktop](https://www.docker.com/products/docker-desktop/) no Windows e no macOS, ou Docker Engine no Linux) para o banco de dados de desenvolvimento: um Postgres 17 com dados fictícios.

```sh
nvm use                    # Node 22, a partir do .nvmrc
npm install
docker compose up -d
cp .env.example .env
npm run db:migrate
npm run dev
```

**Você deve ver:**
- `npm run db:migrate` termina sem erros (com a versão atual do drizzle-kit, diz `migrations applied successfully!`);
- `npm run dev` mostra `Ready` e o endereço `http://localhost:3000`;
- `http://localhost:3000/api/health` responde `{"ok":true,"db":true}`, e a página inicial diz "Em construção".

Antes de abrir um PR, estes quatro precisam terminar sem erros:

```sh
npm run typecheck
npm run lint
npm run test
npm run build
```

**Se falhar:**
- `/api/health` responde `{"ok":false,"db":false}` → o banco não está em execução. Confira `docker compose ps` (deve dizer `healthy`) e se o Docker Desktop está aberto.
- `Falta DIRECT_DATABASE_URL` *(o programa imprime em espanhol)* → você não copiou `.env.example` para `.env`.
- A porta 5432 está ocupada → você já tem outro Postgres. Troque-a no `docker-compose.yml` (por exemplo, `'5433:5432'`) e nas duas URLs do `.env`.

## 8. Sua primeira contribuição, com orientação: seu perfil na equipe

É a única contribuição que **não precisa de issue nem de `/tomar`**, e permite percorrer o fluxo completo sem risco.

1. Traga as últimas alterações e crie sua branch:

   ```sh
   git switch main
   git pull upstream main          # colaboradores oficiais: git pull origin main
   git switch -c docs/perfil-<seu-usuario>
   ```

2. Crie `team/<seu-usuario>.md` copiando o modelo de [team/README.md](https://github.com/MarAntBQ/CallingSupportApp/blob/main/team/README.md). Escreva de duas a quatro linhas sobre você, **sem títulos hierárquicos** ("líder", "fundador", "criador"…) e sem dados sensíveis (telefone, endereço, e-mail).

3. Valide-o:

   ```sh
   node site/build.mjs
   ```

   **Você deve ver** `2 perfil(es)` (ou um a mais que antes) na linha de "Sitio generado".

   **Se der errado**, o build diz o que corrigir. Por exemplo:

   *(o programa imprime em espanhol)*

   ```
   El sitio no se generó:
     team/seu-usuario.md: no se usan títulos de jerarquía ("líder"): en CSATeam todos somos colaboradores
   ```

4. Commit e push:

   ```sh
   git add team/<seu-usuario>.md
   git commit -m "docs: perfil de <seu-usuario> en el equipo"
   git push -u origin docs/perfil-<seu-usuario>
   ```

5. Abra o PR **como rascunho, com o modelo completo**. O GitHub o carrega automaticamente se você o abrir pelo botão *Compare & pull request* do seu fork. Se você for colaborador oficial, abra-o no repositório original comparando sua branch com a `main`. Preencha-o: o que mudou, como testar e o que você verificou (cole a linha do build).

6. Quando estiver pronto, passe-o para *Ready for review*. Responda às observações da revisão com novos commits na mesma branch. Entre na `main` por **squash**.

7. Depois do merge:

   ```sh
   git switch main
   git pull upstream main          # colaboradores oficiais: git pull origin main
   git push origin main            # só a partir de um fork: atualiza sua cópia
   git branch -d docs/perfil-<seu-usuario>
   ```

- [ ] Meu perfil aparece na página [Equipe](../team/).

## 9. Daí em diante, com qualquer issue

1. **Escolha** um issue sem responsável, sem `en-progreso`, sem `bloqueado` nem `necesita-diseño`. Se for sua primeira vez, procure `good first issue`. [Ver issues livres](https://github.com/MarAntBQ/CallingSupportApp/issues?q=is%3Aopen+is%3Aissue+no%3Aassignee+-label%3Abloqueado).
2. **Leia-o por completo.** Se algo não estiver claro, pergunte **no issue** antes de programar.
3. **Pegue-o** comentando `/tomar` no issue. O bot atribui o issue a você e adiciona `en-progreso`. Também funciona a partir de um fork. **Um issue por vez.**
4. **Branch:** `feat/<número>-titulo-corto` (ou `fix`, `docs`, `chore`…), criada a partir da `main` atualizada (`git switch main` e `git pull upstream main`; colaboradores oficiais, `git pull origin main`).
5. **PR em rascunho dentro de 48 horas**, com o modelo completo e `Refs #<número>`.
6. **Verifique executando:** o build, os testes e um percurso real. No PR, cole a saída, não um resumo.
7. **Revise seu próprio código** com a skill `revisar-codigo` e, se envolver dados de pessoas, com `datos-de-miembros`.
8. **Passe-o para pronto** com `Closes #<número>`.

## 10. Se você travar ou não puder continuar

- **Pergunte no issue**, informando o que tentou e o que aconteceu.
- **Se não puder continuar**, comente `/soltar`: o issue ficará livre para outra pessoa. Não tem problema.
- **Sem atividade:** depois de 7 dias o bot lembrará você do issue e, depois de 14, o liberará.

## 11. Se você usar inteligência artificial

Você pode usar o assistente que preferir:
- **Claude Code** lê `CLAUDE.md` (que importa `AGENTS.md`) e as skills de `.claude/skills/`. Peça, por exemplo: *"pegue o issue #12 seguindo a skill trabalhar-un-issue"*.
- **Outros agentes** (Codex, Cursor, Copilot): forneça a eles `AGENTS.md` e o `SKILL.md` correspondente.

**O que você entrega é sua responsabilidade:** revise e teste tudo o que o agente escrever.

## 12. O que nunca se faz

- Push direto para `main`: tudo entra por PR.
- Dados reais de pessoas no repositório, nem em testes, nem em capturas de tela.
- Segredos ou arquivos `.env` no repositório.
- Inventar requisitos fora do issue.
- Apresentar-se como líder, fundador ou criador do projeto.
- E-mails ou avisos com informações confidenciais: avisam e direcionam; o detalhe fica dentro do aplicativo.

## 13. Lista final antes de pedir revisão

- [ ] O issue foi pego com `/tomar` e é o único em que estou trabalhando.
- [ ] A branch sai da `main` atualizada e tem o número do issue.
- [ ] O PR usa o modelo completo, com `Closes #<número>`.
- [ ] Executei o build e os testes e colei a saída.
- [ ] Revisei meu código com `revisar-codigo` (e `datos-de-miembros` se envolver dados).
- [ ] Os textos novos estão em espanhol, português e inglês.
- [ ] Não há dados reais, segredos nem `.env`.

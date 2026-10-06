---
title: Developer Guide
description: Step-by-step guide to contributing to CallingSupportApp from scratch: install the tools, get the repository, view the site, and reach your PR successfully.
updated: 2026-10-06
---

This guide takes you **from a computer with nothing installed to your first merged PR**, without having to ask anyone anything. Follow it in order. Each step says what to do, what you **should see**, and what to do **if it fails**.

The project rules (the reason behind each one) are in [CONTRIBUTING](https://github.com/MarAntBQ/CallingSupportApp/blob/main/CONTRIBUTING.md) and [AGENTS.md](https://github.com/MarAntBQ/CallingSupportApp/blob/main/AGENTS.md). This guide is the exact sequence.

## 1. Before you start (10 minutes of reading)

- **What it is:** free tools for a ward or branch to organize activities (temple trip, camps, EnglishConnect). It is **not official** Church software and does not replace Member Tools. Read the [README](https://github.com/MarAntBQ/CallingSupportApp#readme).
- **Three rules that override everything else:**
  1. the Church's **General Handbook**: if an idea contradicts it, it is not built;
  2. **member data** is protected as the Handbook requires (33.8): only what is necessary, only for the activity, and never real data in the repository;
  3. the application **does not handle money** (chapter 34).
- **How we work:** CSATeam is a team of equals; no one is anyone else's leader. Questions are asked **in writing, in the issue**, never in a private chat.

- [ ] I read the README, the [Rules of use](../rules/) and the [Data policy](../privacy/).

## 2. Your GitHub account

1. Create an account on [github.com](https://github.com) if you do not have one.
2. Turn on **two-step verification**: *Settings → Password and authentication → Two-factor authentication*.
3. Turn on **private email** for commits so you do not publish your personal email: *Settings → Emails → Keep my email addresses private*. Copy the address it shows (it ends in `@users.noreply.github.com`); you will use it in step 4.

- [ ] I have an account, two-step verification, and my noreply email.

## 3. Install the tools

| Tool | Windows | macOS / Linux |
|---|---|---|
| Git | [git-scm.com](https://git-scm.com/download/win) (includes Git Bash) | already included, or `brew install git` / `sudo apt install git` |
| Node.js 22 | [nvm-windows](https://github.com/coreybutler/nvm-windows), then `nvm install 22` | [nvm](https://github.com/nvm-sh/nvm), then `nvm install 22` |
| GitHub CLI | [cli.github.com](https://cli.github.com) | `brew install gh` / [Linux instructions](https://github.com/cli/cli/blob/trunk/docs/install_linux.md) |
| Editor | [VS Code](https://code.visualstudio.com) or whichever you prefer | same |

Check the versions:

```sh
git --version
node -v
npm -v
gh --version
```

**You should see** something like this (the numbers may be newer; Node must be 22):

```
git version 2.54.0
v22.14.0
10.9.2
gh version 2.100.0
```

**If it fails:** "no se reconoce el comando" means the tool was not added to the `PATH`. Close and reopen the terminal; if it continues, reinstall it.

Sign in to GitHub from the terminal:

```sh
gh auth login
```

Choose *GitHub.com → HTTPS → Login with a web browser* and follow the instructions.

- [ ] All four tools respond and `gh auth status` says I am signed in.

## 4. Configure Git

```sh
git config --global user.name "Tu nombre"
git config --global user.email "123456+tu-usuario@users.noreply.github.com"
```

Line endings (important so the scripts work on the server):

```sh
git config --global core.autocrlf true     # Windows
git config --global core.autocrlf input    # macOS y Linux
```

- [ ] `git config --global user.email` shows my noreply email.

## 5. Get the repository

**If you are not an official collaborator yet** (normal when starting), work from your fork:

```sh
gh repo fork MarAntBQ/CallingSupportApp --clone
cd CallingSupportApp
git remote -v
```

**You should see** two remotes: `origin` is your copy and `upstream` is the original:

```
origin    https://github.com/<tu-usuario>/CallingSupportApp.git (fetch)
origin    https://github.com/<tu-usuario>/CallingSupportApp.git (push)
upstream  https://github.com/MarAntBQ/CallingSupportApp.git (fetch)
upstream  https://github.com/MarAntBQ/CallingSupportApp.git (push)
```

**If you are an official collaborator**, clone the original directly: `git clone https://github.com/MarAntBQ/CallingSupportApp.git` (you will have only `origin`).

**If it fails:** if `gh repo fork` asks you to sign in, go back to step 3 (`gh auth login`).

- [ ] I have the repository on my computer and `git remote -v` shows what I expect.

## 6. View the site on your computer

```sh
npm ci --prefix site
node site/build.mjs
node site/scripts/seo-check.mjs
npx serve _site
```

**You should see:**

*(the program prints in Spanish)*

```
found 0 vulnerabilities
Sitio generado en _site/: 15 páginas, cada una con es, pt, en; 1 perfil(es), 2 novedad(es), 3 manual(es).
Sin problemas: títulos ≤ 60, descripciones 150–160, etiquetas únicas y JSON-LD válido.
```

And `npx serve` gives you an address (usually `http://localhost:3000`): open it in your browser. Every time you change text, run `node site/build.mjs` again and reload.

The bot and profile tests:

```sh
node --test .github/scripts/claim-logic.test.cjs .github/scripts/team-profiles.test.cjs
```

**You should see** `# pass 15` and `# fail 0`.

**If it fails:**
- `npm ci` fails → check that you have Node 22 (`node -v`).
- The build says "El sitio no se generó" → read the list it prints below: it tells you the file and what is missing.

- [ ] The site appears in my browser and the tests pass.

## 7. Start the application

> **Arrives with [#4](https://github.com/MarAntBQ/CallingSupportApp/issues/4)** (Next.js + Supabase skeleton). When that issue is closed, this step will explain how to start the application and its development database.

## 8. Your first contribution, guided: your team profile

This is the only contribution that **does not need an issue or `/tomar`**, and it lets you go through the complete workflow without risk.

1. Get the latest changes and create your branch:

   ```sh
   git switch main
   git pull upstream main          # colaboradores oficiales: git pull origin main
   git switch -c docs/perfil-<tu-usuario>
   ```

2. Create `team/<tu-usuario>.md` by copying the template from [team/README.md](https://github.com/MarAntBQ/CallingSupportApp/blob/main/team/README.md). Write two to four lines about yourself, **without hierarchy titles** ("líder", "fundador", "creador"…) and without sensitive data (phone, address, email).

3. Validate it:

   ```sh
   node site/build.mjs
   ```

   **You should see** `2 perfil(es)` (or one more than before) on the "Sitio generado" line.

   **If it fails**, the build tells you what to fix. For example:

   *(the program prints in Spanish)*

   ```
   El sitio no se generó:
     team/tu-usuario.md: no se usan títulos de jerarquía ("líder"): en CSATeam todos somos colaboradores
   ```

4. Commit and push:

   ```sh
   git add team/<tu-usuario>.md
   git commit -m "docs: perfil de <tu-usuario> en el equipo"
   git push -u origin docs/perfil-<tu-usuario>
   ```

5. Open the PR **as a draft with the complete template**. GitHub loads it automatically if you open it from the *Compare & pull request* button on your fork. Fill it out: what you changed, how to test it, and what you verified (paste the build line).

6. When it is ready, move it to *Ready for review*. Respond to review comments with new commits on the same branch. Merge into `main` by **squash**.

7. After the merge:

   ```sh
   git switch main
   git pull upstream main
   git push origin main
   git branch -d docs/perfil-<tu-usuario>
   ```

- [ ] My profile appears on the [Team](../team/) page.

## 9. From then on, with any issue

1. **Choose** an unassigned issue, without `en-progreso`, `bloqueado`, or `necesita-diseño`. If this is your first time, look for `good first issue`. [View available issues](https://github.com/MarAntBQ/CallingSupportApp/issues?q=is%3Aopen+is%3Aissue+no%3Aassignee+-label%3Abloqueado).
2. **Read it completely.** If anything is unclear, ask **in the issue** before coding.
3. **Claim it** by commenting `/tomar` on the issue. The bot assigns it to you and adds `en-progreso`. It also works from a fork. **One issue at a time.**
4. **Branch:** `feat/<número>-titulo-corto` (or `fix`, `docs`, `chore`…), created from the updated `main`.
5. **Draft PR within 48 hours**, with the complete template and `Refs #<número>`.
6. **Verify by running:** the build, the tests, and a real walkthrough. Paste the output in the PR, not a summary.
7. **Review your own code** with the `revisar-codigo` skill and, if it involves people's data, with `datos-de-miembros`.
8. **Mark it ready** with `Closes #<número>`.

## 10. If you get stuck or can no longer continue

- **Ask in the issue**, including what you tried and what happened.
- **If you cannot continue**, comment `/soltar`: the issue becomes available to someone else. It is okay.
- **No activity:** after 7 days the bot reminds you about the issue, and after 14 it releases it.

## 11. If you use artificial intelligence

You can use whichever assistant you prefer:
- **Claude Code** reads `CLAUDE.md` (which imports `AGENTS.md`) and the skills in `.claude/skills/`. Ask it, for example: *"take issue #12 following the trabajar-un-issue skill"*.
- **Other agents** (Codex, Cursor, Copilot): give them `AGENTS.md` and the corresponding `SKILL.md`.

**What you deliver is your responsibility:** review and test everything the agent writes.

## 12. What is never done

- Direct push to `main`: everything goes through a PR.
- Real people's data in the repository, tests, or screenshots.
- Secrets or `.env` files in the repository.
- Inventing requirements outside the issue.
- Presenting yourself as the project's leader, founder, or creator.
- Emails or notices with confidential information: they notify and link; the details go inside the application.

## 13. Final checklist before requesting review

- [ ] The issue is claimed with `/tomar` and is the only one I have in progress.
- [ ] The branch comes from updated `main` and includes the issue number.
- [ ] The PR uses the complete template, with `Closes #<número>`.
- [ ] I ran the build and tests and pasted the output.
- [ ] I reviewed my code with `revisar-codigo` (and `datos-de-miembros` if it involves data).
- [ ] New text exists in Spanish, Portuguese, and English.
- [ ] There is no real data, secrets, or `.env`.

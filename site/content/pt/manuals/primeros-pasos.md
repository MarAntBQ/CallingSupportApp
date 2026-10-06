---
title: Primeiros passos: instalar na sua ala
description: Como instalar o CallingSupportApp na sua ala ou ramo e deixá-lo pronto para usar: requisitos, configuração inicial e primeiros usuários. Manual em preparação.
updated: 2026-10-06
order: 1
---

> **Estado:** em preparação. A instalação chega com os issues [#4](https://github.com/MarAntBQ/CallingSupportApp/issues/4) (esqueleto), [#8](https://github.com/MarAntBQ/CallingSupportApp/issues/8) (primeiro administrador) e [#27](https://github.com/MarAntBQ/CallingSupportApp/issues/27) (guia de implantação).

## Antes de começar

Antes de instalar, confira esta lista. Ela vem das [diretrizes oficiais para recursos on-line nos chamados](https://www.churchofjesuschrist.org/tools/help/use-of-online-resources-in-church-callings?lang=por) (Manual Geral 38.8.24.2):

- [ ] **A aprovação do seu bispo** para usar o aplicativo na unidade.
- [ ] **Pelo menos dois administradores**, para que o aplicativo continue funcionando quando um chamado mudar.
- [ ] Quem será o **responsável pelos dados** da sua instalação, e um **contato visível** dentro do aplicativo.
- [ ] O **aviso de que não é um produto oficial** da Igreja, sem o logotipo dela nem o nome oficial no nome da instalação.
- [ ] **Sem propaganda** nem promoção de negócios.
- [ ] Um **plano para desativá-lo** e apagar os dados quando não for mais usado.
- [ ] Uma conta gratuita no GitHub, no Vercel e no Supabase.

## Quando estiver pronta, as etapas serão

1. Criar o banco de dados no Supabase.
2. Implantar o aplicativo no Vercel com o botão "Deploy".
3. Abrir `/setup` e criar a primeira conta de administração.
4. Em **Configuração**: nome da unidade, logotipo, idioma padrão e responsável pelos dados.
5. Criar as organizações e os chamados e dar permissões por módulo.

Este manual será completado passo a passo, com capturas de tela, à medida que esses issues forem encerrados.

---
title: Política de dados e privacidade
description: Como o CallingSupportApp protege os dados dos membros segundo o Manual Geral 33.8: o que se guarda, quem pode ver, por quanto tempo e o que este site trata.
updated: 2026-10-06
---

Esta página explica as **regras de design** seguidas pelo software. Cada ala que instala o CallingSupportApp tem, dentro do seu aplicativo, **sua própria política de dados** com seu próprio responsável: a unidade que o utiliza.

## A regra que manda: Manual Geral 33.8

Os dados dos membros são regidos pelo [Manual Geral, seção 33.8 "Caráter confidencial dos registros"](https://www.churchofjesuschrist.org/study/manual/general-handbook/33-records-and-reports?lang=por). Os líderes garantem que as informações coletadas dos membros:

> - “Sejam limitadas ao que a Igreja exige.”
> - “Sejam usadas somente para os propósitos aprovados pela Igreja.”
> - “Sejam fornecidas somente às pessoas autorizadas a usá-las.”

*As citações do Manual Geral foram traduzidas do texto em espanhol; o texto oficial em português está nos links.*

E que esses dados “não sejam usados para objetivos pessoais, políticos ou comerciais”. Além disso: “Não se deve fornecer informações dos registros da Igreja, inclusive informações históricas, a nenhuma pessoa ou agência que realize estudos de pesquisa ou pesquisas de opinião”.

Se uma funcionalidade entrar em conflito com isso, ela não será construída.

## Quais dados cada módulo trata

Somente são tratados dados que **cada pessoa fornece por si mesma, com seu consentimento**, para uma atividade específica. **Nunca** são importadas listas dos sistemas oficiais da Igreja.

| Módulo | Dados | Para quê |
|---|---|---|
| Usuários e chamados | Nome, e-mail, telefone (opcional), função e chamados | Saber quem entra no aplicativo e o que pode fazer |
| Viagem ao Templo | Documento de identidade ou passaporte, data de nascimento, nome, telefone, e-mail, gênero, serviços escolhidos e ordenanças; data, IP e idioma do consentimento | Organizar a viagem: vagas, transporte, refeições, hospedagem |
| Acampamento | Do jovem: nome, data de nascimento, gênero e contato de emergência. Do pai, mãe ou responsável: nome, telefone e e-mail | Organizar o acampamento. **Não são armazenados dados médicos**: eles ficam no formulário oficial assinado pelos pais |
| EnglishConnect | Nome, e-mail e telefone (opcional); o representante, se for menor | Organizar os grupos |
| Autossuficiência | No diretório, somente o que cada irmão publica sobre seu negócio, além de um e-mail privado | Permitir que a unidade o apoie |

**As ordenanças são dados de crença religiosa**: são solicitadas com consentimento explícito e somente ficam visíveis para quem precisa delas. Quando um **menor** se inscreve, seu pai, mãe ou responsável dá o consentimento.

## Como são protegidos

- **Consentimento**: caixa desmarcada antes do envio; são armazenados a versão da política e o idioma em que ela foi aceita.
- **Acesso por chamado**: cada leitura, exportação, impressão e aviso passa pela permissão do módulo, verificada no servidor.
- **Contas pessoais e verificação em duas etapas** para quem tem acesso aos dados.
- **Um dado é usado somente na atividade em que foi fornecido**: nunca é cruzado entre módulos.
- **Sem dinheiro**: o aplicativo não registra pagamentos, parcelas nem doações ([Manual Geral, capítulo 34](https://www.churchofjesuschrist.org/study/manual/general-handbook/34-finances-and-audits?lang=por)).

## Por quanto tempo são guardados

Cada instalação define seu prazo de retenção, e uma tarefa diária **apaga** os dados vencidos. O Manual pede que os registros sejam guardados “somente durante o tempo necessário” (33.9.2) e que o que já não é necessário seja destruído “de tal modo que não seja possível recuperar nem reconstruir nenhuma informação” (33.9.3). Por isso, a exclusão é definitiva: não há lixeira.

## Uma instalação por ala

Não existe um servidor central com dados de várias alas. Cada unidade instala sua própria cópia e é a **responsável** por seus dados. Se usar Vercel e Supabase, os dados ficarão hospedados fora do país; sua política de dados deve informar isso.

## Este site

- Não tem formulários, contas, cookies nem análises.
- Os recursos são fornecidos pelo mesmo domínio.
- O navegador consulta a **API pública do GitHub** (`api.github.com`) para mostrar o progresso e os colaboradores, e carrega seus avatares do GitHub.
- A hospedagem mantém registros técnicos do servidor (como o IP) por segurança, de acordo com sua própria política.

## Contato

Para os dados armazenados no aplicativo de **uma ala**, escreva para o responsável por essa unidade. Sobre o projeto: [devteam@callingsupportapp.org](mailto:devteam@callingsupportapp.org).

---
title: Data and privacy policy
description: How CallingSupportApp protects member data under General Handbook 33.8: what is stored, who can see it, for how long, and what data this website handles.
updated: 2026-10-06
---

This page explains the software’s **design rules**. Each ward that installs CallingSupportApp has **its own data policy** inside its application, with its own data steward: the unit using it.

## The governing rule: General Handbook 33.8

Member data is governed by the [General Handbook, section 33.8 “Confidentiality of Records”](https://www.churchofjesuschrist.org/study/manual/general-handbook/33-records-and-reports?lang=eng). Leaders ensure that information collected from members:

> - “Is limited to what the Church requires.”
> - “Is used only for Church-approved purposes.”
> - “Is given only to people who are authorized to use it.”

*Quotes from the General Handbook are translated from the Spanish text; the official English text is at the links.*

And that this data “is not used for personal, political, or commercial purposes.” In addition: “Information from Church records, including historical information, should not be given to any person or agency conducting research studies or surveys.”

If a feature conflicts with this, it is not built.

## What data each module processes

Only data that **each person provides themselves, with their consent**, for a specific activity is processed. **Official Church system lists are never** imported.

| Module | Data | Purpose |
|---|---|---|
| Users and callings | Name, email, phone (optional), role, and callings | Know who enters the application and what they can do |
| Temple trip | National ID or passport, birth date, name, phone, email, gender, selected services and ordinances; consent date, IP, and language | Organize the trip: slots, transportation, meals, lodging |
| Camp | For the youth: name, birth date, gender, and emergency contact. For their father, mother, or guardian: name, phone, and email | Organize the camp. **Medical data is not stored**: it goes in the official form signed by the parents |
| EnglishConnect | Name, email, and phone (optional); the representative, if the student is a minor | Organize groups |
| Self-reliance | None: it is a portal of links to public, free resources | Help the unit find official, reliable resources |

**Ordinances are religious-belief data**: they are requested with explicit consent and are visible only to those who need them. When a **minor** registers, their parent or guardian gives consent.

## How data is protected

- **Consent:** an unchecked box before submission; the policy version and the language in which it was accepted are stored.
- **Access by calling:** every read, export, print, and notice goes through the module permission, verified on the server.
- **Personal accounts and two-step verification** for anyone with access to data.
- **Data is used only for the activity where it was provided:** it is never combined across modules.
- **No money:** the application does not record payments, installments, or donations ([General Handbook, chapter 34](https://www.churchofjesuschrist.org/study/manual/general-handbook/34-finances-and-audits?lang=eng)).

## How long data is kept

Each installation defines its retention period, and a daily task **deletes** expired data. The Handbook requires records to be kept “only as long as necessary” (33.9.2) and information that is no longer needed to be destroyed “in a way that makes it impossible to recover or reconstruct any information” (33.9.3). Therefore deletion is permanent: there is no recycle bin.

## One installation per ward

There is no central server with data from multiple wards. Each unit installs its own copy and is **responsible** for its data. If it uses Vercel and Supabase, the data is hosted outside the country; its data policy must say so.

## This site

- On the **Temple trip** manual, your browser loads a photo of the Quito Ecuador Temple directly from **churchofjesuschrist.org** (from the Gospel Media Library, whose use the Church's [Terms of Use](https://www.churchofjesuschrist.org/legal/terms-of-use?lang=eng) allow). The Church's site receives the technical data of that request, such as your IP address.
- **Contact form** (Contact page): it collects your name, email, and message only to reply to you. The project team receives them at devteam@callingsupportapp.org, and they are stored in the project server's database for **90 days**; after that they are deleted automatically, every day. Your IP address is not stored, only an irreversible fingerprint used to limit spam. It is protected by **Google reCAPTCHA v3**, which loads **only on that page**: your browser connects to Google and sends it technical data (including your IP address) under its [privacy policy](https://policies.google.com/privacy). Our server does not send your IP address to Google. We also record that you agreed, which version of this policy applied, and in which language.
- It has no accounts, first-party cookies, or analytics.
- Resources are served from this same domain.
- Your browser queries the **public GitHub API** (`api.github.com`) to show progress and contributors, and loads their avatars from GitHub.
- The hosting provider keeps technical server logs (such as the IP) for security, according to its own policy.

## Contact

For data stored in **a ward’s** application, write to that unit’s data steward. About the project: [devteam@callingsupportapp.org](mailto:devteam@callingsupportapp.org).

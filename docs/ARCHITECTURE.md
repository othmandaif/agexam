# Architecture AGExam

## 1. Couches et dépendances

```
app  ──►  features  ──►  domain
  │          │             ▲
  │          └──►  server ─┘
  └──►  components, lib
```

| Couche        | Contenu                                                      | Peut importer                     |
| ------------- | ------------------------------------------------------------ | --------------------------------- |
| `app/`        | Routage : pages, layouts, routes API. Aucune logique métier. | features, server, components, lib |
| `features/`   | Cas d'usage : Server Actions, requêtes, composants dédiés    | domain, server, components, lib   |
| `domain/`     | Règles métier pures, testées unitairement                    | rien (zod uniquement)             |
| `server/`     | Base, authentification, HTTP. Fichiers marqués `server-only` | domain, lib                       |
| `components/` | UI réutilisable, sans accès aux données                      | lib, features/auth (déconnexion)  |

La règle « domain reste pur » est vérifiée par ESLint (`eslint.config.mjs`).

**Pourquoi** : les règles sensibles (temps, notation, sanctions, publication des résultats)
sont dans `domain/`, sans dépendance à Next.js ni à la base. Elles sont testables en
millisecondes et réutilisables si l'on change d'hébergement ou de framework.

## 2. Règles de sécurité

1. **Le navigateur ne lit jamais la base.** Supabase sert à l'authentification et à
   l'hébergement PostgreSQL. RLS est activé sur toutes les tables sans politique, et les droits
   de `anon` / `authenticated` sont retirés (`drizzle/0001_security_lockdown.sql`).
   Seul le serveur accède aux données, via Drizzle.
2. **Le proxy n'est pas une protection.** `src/proxy.ts` ne fait que rafraîchir la session et
   rediriger. Chaque layout, Server Action et route API appelle `requireRole(...)` ou
   `requireApiUser(...)`.
3. **Le rôle est lu en base** (`profiles.role`), jamais dans le jeton ou les métadonnées.
4. **Le temps vient du serveur.** `attempt_questions.expires_at` fait foi. Le client affiche
   `expiresAt - (Date.now() + offset)`, l'offset est calculé avec `GET /api/health`.
5. **Les bonnes réponses ne quittent jamais le serveur.** La question en cours est envoyée
   sans `isCorrect`, avec les options dans l'ordre propre à la tentative.
6. **Toute entrée est validée avec Zod** avant usage.
7. **Une note non publiée n'est jamais envoyée.** `revealLevel()` décide de ce que l'API renvoie.

## 3. Modèle de données

| Table                     | Rôle                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| `establishments`          | Établissement (multi-établissement possible)                              |
| `profiles`                | Profil 1–1 avec `auth.users`, rôle, établissement                         |
| `modules`, `chapters`     | Classement pédagogique                                                    |
| `groups`, `group_members` | Groupes d'étudiants                                                       |
| `questions`               | Métadonnées stables d'une question                                        |
| `question_versions`       | Contenu IMMUABLE (énoncé, code, options JSONB, explication)               |
| `exams`                   | Examen : période, code, politique de violations, sécurité, visibilité     |
| `exam_groups`             | Groupes autorisés                                                         |
| `exam_questions`          | Liste fixe de questions, durée et points par question                     |
| `attempts`                | Tentative : statut, position, tiers-temps, compteurs, note, reçu          |
| `attempt_questions`       | Ordre propre à la tentative, ordre des options, fenêtre de temps, réponse |
| `incidents`               | Violation après fusion des événements + sanction (annulable)              |
| `security_events`         | Journal brut des événements navigateur                                    |
| `audit_logs`              | Actions sensibles des formateurs et admins                                |

Points clés :

- Modifier une question crée une **nouvelle version** : les résultats passés ne bougent pas.
- Un index unique partiel garantit **une seule tentative en cours** par étudiant et examen.
- Paramètres d'examen en JSONB typé (`$type<SecuritySettings>()`), validés par Zod.

## 4. Conventions

- **API** : réponses `{ data }` ou `{ error: { code, message, details? } }`, `Cache-Control: no-store`.
  Envelopper chaque route avec `apiRoute()`. Versionner sous `/api/v1`.
- **Mutations depuis un formulaire** : Server Actions dans `features/<x>/server/actions.ts`.
- **Mutations à haute fréquence pendant l'examen** (réponse, heartbeat, événements) :
  routes API sous `/api/v1/attempts/[attemptId]/…`, appelées par TanStack Query.
- **Transactions** : toute opération qui touche plusieurs tables (démarrer une tentative,
  appliquer une sanction, soumettre) passe par `getDb().transaction(...)`.
- **Suivi en direct** : l'écran formateur interroge `/api/v1/exams/[examId]/monitor` toutes les 4 s
  (pas de WebSocket). Chaque appel rattrape d'abord le temps des tentatives silencieuses
  (`syncExamAttempts`, limité à un passage / 3 s / examen), puis lit l'état en une requête.
  Les actions du formateur (annuler une sanction, temps en plus, message, prolongation) sont des
  Server Actions auditées. Dans le SQL brut (`db.execute`), passer les dates en ISO + `::timestamptz`.
- **Corrections après coup** : neutraliser une question (`exam_questions.neutralized_at`) ou
  corriger sa clé (nouvelle `question_version`, texte source réécrit) recalcule toutes les copies
  terminées dans la même transaction (`rescoreExam`). Les copies en cours sont notées à la
  soumission avec les nouvelles règles. Une copie annulée (`ANNULEE`) ne compte pas dans
  `maxAttempts` : c'est « autoriser à repasser ».
- **Banque de questions** : chaque version porte une empreinte (md5 du texte canonique,
  `domain/question-fingerprint`). À l'enregistrement d'un examen, une question identique
  (même module, version actuelle, non archivée) est réutilisée au lieu d'être recréée :
  les statistiques suivent la question d'un examen à l'autre.
- **Statistiques** : périmètre = examens de l'auteur (admin : tout l'établissement), publiés, déjà
  ouverts, hors entraînement. Une copie = dernière tentative non annulée et notée. Les calculs
  (regroupements, tendances, « à suivre ») sont dans `domain/analytics` (testés).
- **Noms** : code en anglais, textes d'interface et URL en français.
- **Tests** : toute nouvelle règle de `domain/` arrive avec son fichier `.test.ts`.

## 5. Évolution prévue

1. Banque de questions (recherche, stats tous examens, réutilisation automatique). ✓
2. Création d'examen (assistant en 5 étapes).
3. Passage d'examen (démarrage, question en cours, réponses, chrono, soumission).
4. Surveillance (événements, incidents, sanctions) et suivi en direct. ✓
5. Résultats (correction, publication, statistiques, exports). ✓

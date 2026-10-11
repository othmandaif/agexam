# Features

Un dossier par domaine fonctionnel. Chaque feature contient ses cas d'usage et son interface :

```
features/<feature>/
  schemas.ts          validation Zod des entrées (formulaires, API)
  server/
    queries.ts        lectures (appelées par les Server Components)
    actions.ts        Server Actions ("use server") : mutations depuis les formulaires
    services.ts       logique applicative : transaction Drizzle + règles de src/domain
  components/         composants propres à la feature
  hooks/              hooks client (TanStack Query…)
```

Features prévues :

| Feature      | Rôle                                                               |
| ------------ | ------------------------------------------------------------------ |
| `auth`       | Connexion, déconnexion (fait)                                      |
| `bank`       | Banque de questions : recherche, stats tous examens, réutilisation |
| `exams`      | Création (assistant), publication, code d'accès, groupes           |
| `attempts`   | Démarrage, question en cours, réponses, soumission, chrono serveur |
| `monitoring` | Événements de sécurité, incidents, sanctions, suivi en direct      |
| `results`    | Correction, publication, statistiques, neutralisation, exports     |
| `groups`     | Groupes, étudiants, tiers-temps                                    |

Règles :

- Une feature peut importer `@/domain`, `@/server`, `@/components`, `@/lib`.
- Une feature n'importe pas les fichiers internes d'une autre feature : passer par
  ses `server/queries.ts`, `server/service.ts`, ses Server Actions ou ses composants
  publics (`components/`, ex. le sélecteur de la banque dans l'éditeur d'examen).
- Toute entrée venant du navigateur est validée avec Zod, puis l'utilisateur est
  vérifié (`requireRole` / `requireApiUser`) AVANT tout accès aux données.

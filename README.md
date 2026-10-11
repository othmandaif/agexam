# AGExam

Plateforme web d'examens QCM en ligne pour les établissements de formation :
banque de questions, examens à temps par question, mode examen surveillé,
correction et statistiques. Principe directeur : **le navigateur affiche, le serveur décide**.

## Stack

| Besoin              | Choix                                                      |
| ------------------- | ---------------------------------------------------------- |
| Application         | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript |
| Base de données     | PostgreSQL (Supabase) via **Drizzle ORM**                  |
| Authentification    | Supabase Auth (`@supabase/ssr`, cookies)                   |
| Validation          | Zod 4                                                      |
| Interface           | Tailwind CSS 4, composants maison style shadcn/ui, Lucide  |
| Données côté client | TanStack Query                                             |
| Tests               | Vitest                                                     |

## Démarrage

Prérequis : Node.js 22.12 ou plus récent, un projet Supabase (région Europe conseillée).

```bash
npm install
cp .env.example .env.local     # puis remplir les valeurs
npm run db:migrate             # crée les tables, active RLS, ajoute le trigger de profil
npm run dev                    # http://localhost:3000
```

### Configuration Supabase

1. **Authentication > Sign In / Providers** : désactiver « Allow new users to sign up ».
   Les comptes sont créés par l'administrateur.
2. **Authentication > URL Configuration** : Site URL = `NEXT_PUBLIC_APP_URL`.
3. Créer le premier compte (Authentication > Users > Add user), puis le passer administrateur
   dans le SQL Editor :

   ```sql
   update public.profiles set role = 'ADMIN' where email = 'vous@exemple.ma';
   ```

## Scripts

| Commande              | Rôle                                              |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Serveur de développement                          |
| `npm run build`       | Build de production (vérifie aussi les types)     |
| `npm run check`       | Types + lint + tests                              |
| `npm run test`        | Tests unitaires (Vitest)                          |
| `npm run db:generate` | Génère une migration après modification du schéma |
| `npm run db:migrate`  | Applique les migrations                           |
| `npm run db:studio`   | Explorateur de base Drizzle Studio                |

## Structure

```
drizzle/                     migrations SQL (générées + 0001 sécurité écrite à la main)
src/
  app/                       routes uniquement (pages, layouts, routes API) — fines
    connexion/               page de connexion
    etudiant/                espace étudiant
    examen/[attemptId]/      mode examen plein écran, sans navigation
    formateur/               espace formateur (examens, banque, groupes, suivi, résultats)
    admin/                   administration
    api/                     API HTTP (health, v1/…)
  domain/                    règles métier PURES + tests (chrono, mélange, notation, sanctions, visibilité)
  features/                  cas d'usage par domaine (actions, requêtes, composants)
  server/                    infrastructure serveur
    auth/                    session, requireRole, requireApiUser
    db/                      client Drizzle + schéma
    http/                    format d'API, erreurs
    supabase/                clients Supabase (auth uniquement)
  components/                UI partagée (ui/, layout/, brand/, providers/)
  lib/                       utilitaires sans état (routes, env public, cn)
  proxy.ts                   rafraîchissement de session + redirection vers /connexion
```

Détails et règles : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

# Le Cercle du Ryô

Maison de jeu **100 % RP** pour Zenkai, sous le nom **Le Cercle du Ryô**. Les Ryôs affichés par l'application sont fictifs : aucun argent réel, aucune crypto, aucun dépôt et aucun retrait.

## Fonctionnalités

- Rooms privées à code court
- Pseudo RP sans compte pour le MVP
- Solde virtuel par room + ledger de transactions
- Pile ou Face serveur-authoritaire
- Blackjack multijoueur contre le croupier
- En mode croupier hôte, menu de sélection de la carte révélée puis des cartes tirées ; seules les cartes disponibles peuvent être choisies
- Texas Hold'em 2 à 8 joueurs avec blinds, check/call/raise/fold/all-in, showdown et side pots
- Journal RP copiable
- Contrôles hôte : verrouillage, reset des soldes, fermeture
- Reconnexion par token local
- Rafraîchissement quasi temps réel par polling (compatible Vercel sans serveur WebSocket persistant)

## Stack

Next.js App Router, TypeScript, Prisma, PostgreSQL, React, CSS natif.

## Installation locale

```bash
npm install
cp .env.example .env
# renseigner DATABASE_URL vers PostgreSQL / Supabase / Neon
npx prisma db push
npm run dev
```

## Déploiement Vercel

1. Importer `izyxg/zenkai-casino` dans Vercel.
2. Créer une base PostgreSQL (Neon ou Supabase conviennent).
3. Ajouter `DATABASE_URL` dans les variables d'environnement Vercel, au minimum pour Production.
4. Cliquer sur **Deploy**.

C'est tout : le build Vercel exécute automatiquement `prisma generate`, synchronise le schéma avec `prisma db push --skip-generate`, puis lance `next build`.

Le script `build` normal reste sans modification de base de données afin que la CI GitHub puisse vérifier le projet indépendamment. Le script `vercel-build` est réservé au déploiement Vercel.

Si une future modification Prisma nécessite une suppression ou une transformation destructive de données, `prisma db push` s'arrêtera au lieu d'accepter automatiquement la perte de données.

## Temps réel

Pour rester simple et compatible avec l'hébergement serverless Vercel, le MVP utilise un polling client toutes les ~1,4 seconde. La logique et les résultats restent calculés côté serveur. Une future version peut remplacer ce polling par Supabase Realtime, Ably ou Pusher sans modifier les moteurs de jeu.

## Sécurité / fair-play

- Les tirages aléatoires utilisent `crypto.randomInt` côté serveur.
- En mode automatique, les cartes sont tirées côté serveur. En mode croupier hôte, l'hôte choisit ses cartes dans un menu ; le serveur vérifie son rôle, le tour, la disponibilité de la carte et la règle des 17 points.
- Le menu est réservé au croupier hôte ; les autres joueurs et le journal public voient les révélations et tirages habituels, sans mention du choix manuel. Les joueurs ne choisissent jamais leurs propres cartes, les gagnants ou les paiements.
- Le paquet de Blackjack n'est pas exposé dans les réponses API ; seule la liste sans ordre des cartes sélectionnables est fournie au croupier hôte pendant son tour.
- Les cartes privées de poker des autres joueurs sont masquées dans les réponses API jusqu'au showdown.
- Chaque joueur dispose d'un token de session temporaire ; seul son hash SHA-256 est stocké.
- Les mouvements de Ryôs sont enregistrés dans `Transaction`.

## Important

Ce projet est un outil de roleplay. Il ne doit pas être connecté à une monnaie réelle, un moyen de paiement ou un système de cashout.

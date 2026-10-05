# Zenkai Casino

Casino **100 % RP** pour Zenkai. Les Ryôs affichés par l'application sont fictifs : aucun argent réel, aucune crypto, aucun dépôt et aucun retrait.

## Fonctionnalités

- Rooms privées à code court
- Pseudo RP sans compte pour le MVP
- Solde virtuel par room + ledger de transactions
- Pile ou Face serveur-authoritaire
- Blackjack multijoueur contre le croupier
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
3. Ajouter `DATABASE_URL` dans **Project Settings > Environment Variables**.
4. Déployer.
5. Une fois la base disponible, exécuter `npx prisma db push` depuis un terminal ayant accès à la même `DATABASE_URL` (ou utiliser une migration CI dédiée).

Le build lance `prisma generate` automatiquement.

## Temps réel

Pour rester simple et compatible avec l'hébergement serverless Vercel, le MVP utilise un polling client toutes les ~1,4 seconde. La logique et les résultats restent calculés côté serveur. Une future version peut remplacer ce polling par Supabase Realtime, Ably ou Pusher sans modifier les moteurs de jeu.

## Sécurité / fair-play

- Les tirages aléatoires utilisent `crypto.randomInt` côté serveur.
- Le client ne décide jamais d'une carte, d'un gagnant ou d'un paiement.
- Les cartes privées de poker des autres joueurs sont masquées dans les réponses API jusqu'au showdown.
- Chaque joueur dispose d'un token de session temporaire ; seul son hash SHA-256 est stocké.
- Les mouvements de Ryôs sont enregistrés dans `Transaction`.

## Important

Ce projet est un outil de roleplay. Il ne doit pas être connecté à une monnaie réelle, un moyen de paiement ou un système de cashout.

# Le Cercle du Ryô

Maison de jeu **100 % RP** pour Zenkai, sous le nom **Le Cercle du Ryô**. Les Ryôs affichés par l'application sont fictifs : aucun argent réel, aucune crypto, aucun dépôt et aucun retrait.

## Fonctionnalités

- Rooms privées à code court
- Pseudo RP sans compte pour le MVP
- Solde virtuel par room + ledger de transactions
- Pile ou Face serveur-authoritaire
- Blackjack jusqu'à 13 places, sabot de six jeux, mises exactes et croupier hôte ou automatique
- En mode croupier hôte, tirage aléatoire ou menu de sélection selon l'autorisation privée de la table
- Texas Hold'em 2 à 13 joueurs avec blinds tournantes, check/call/raise/fold/all-in, showdown et side pots
- Journal RP copiable
- Contrôles hôte : capacité de 2 à 13 places entre les manches, verrouillage, réglage et reset des soldes, fermeture
- Reconnexion par token local
- Rafraîchissement quasi temps réel par polling (compatible Vercel sans serveur WebSocket persistant)
- Interface adaptative : rangées de sièges de poker défilables sur mobile, mises et relances exactes, raccourcis de montant, confirmation du tapis

## Vérification

`npm test` couvre les règles, la confidentialité des snapshots et les routes avec une base simulée. `npm run build` valide la compilation sans modifier la base.

`tests/browser-qa.mjs` teste l'interface desktop/mobile avec des snapshots locaux : 13 places, mise exacte, relance, modes de croupier et connexion lente. Il nécessite Playwright (ou `PLAYWRIGHT_MODULE` vers son module) et une instance locale via `QA_URL` (par défaut `http://127.0.0.1:3100`). Les captures et le rapport sont écrits dans `qa-output/`, non versionné. Ces essais ne créent pas de table et ne modifient pas les soldes en production.

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
3. Ajouter `DATABASE_URL`, `ROOM_CREATE_CODE` et `ROOM_CREATE_RANDOM_CODE` dans les variables d'environnement Vercel, au minimum pour Production. Les deux codes doivent être différents et rester secrets, sans préfixe `NEXT_PUBLIC_`.
4. Cliquer sur **Deploy**.

C'est tout : le build Vercel exécute automatiquement `prisma generate`, synchronise le schéma avec `prisma db push --skip-generate`, puis lance `next build`.

Le script `build` normal reste sans modification de base de données afin que la CI GitHub puisse vérifier le projet indépendamment. Le script `vercel-build` est réservé au déploiement Vercel.

Si une future modification Prisma nécessite une suppression ou une transformation destructive de données, `prisma db push` s'arrêtera au lieu d'accepter automatiquement la perte de données.

## Temps réel

Le polling est séquentiel : 900 ms après une réponse pendant une main, 1,8 s au repos, pause lorsque l'onglet est masqué et reprise à son retour. Les erreurs ralentissent les nouvelles tentatives. Une réponse ancienne ne remplace pas le résultat d'une action. La présence en base est rafraîchie au maximum une fois toutes les cinq secondes. La logique et les résultats restent calculés côté serveur.

## Spectateurs et dépannage

- L'option **Rejoindre en spectateur** permet d'observer sans recevoir de cartes ni bloquer les tours. Une arrivée pendant une manche est spectatrice par défaut. Le bouton au-dessus du tapis permet de participer à la prochaine manche ou de se retirer entre les manches.
- Les anciens tours sans main jouable sont réparés automatiquement au rafraîchissement. Un joueur avec une vraie main n'est jamais passé automatiquement parce qu'il est hors ligne.
- Pendant une manche, l'hôte dispose de **Débloquer la table** : vérifier les tours, faire rester un joueur au Blackjack / le coucher au poker, ou annuler et rembourser les mises engagées (y compris les doubles et les contributions des joueurs couchés).
- Les interventions sont journalisées. Les actions d'une même table sont sérialisées dans une transaction PostgreSQL ; une confirmation devenue obsolète est refusée. Une annulation terminée ne peut pas être remboursée une seconde fois.

## Poker

À la création d'une table de poker, **Hôte spectateur** permet d'organiser les manches sans jouer. Les treize sièges concernent les participants, pas les observateurs. Le classement des mains est consultable avant et pendant les manches. Le poker se joue entre joueurs, sans banque ni commission.

Les scénarios couverts et les limites de vérification sont détaillés dans [le rapport poker](docs/POKER-CHECKS.md).

## Sécurité / fair-play

- Les tirages aléatoires utilisent `crypto.randomInt` côté serveur.
- `ROOM_CREATE_CODE` autorise la création de tables avec choix manuel du croupier hôte. `ROOM_CREATE_RANDOM_CODE` crée des tables où l'hôte révèle la carte déjà distribuée et tire dans le paquet mélangé côté serveur, sans menu de choix. Les codes ne sont jamais stockés dans les tables ou renvoyés par l'API.
- L'autorisation de choix est stockée uniquement côté serveur, fixée à la création et désactivée par défaut pour les tables existantes. Le serveur refuse toute carte imposée dans une table aléatoire, même si la requête du navigateur est modifiée.
- En mode automatique, les cartes sont tirées côté serveur. Pour les tables autorisées en mode croupier hôte, le serveur vérifie le rôle, le tour, la disponibilité de la carte et la règle des 17 points.
- Le menu est réservé au croupier hôte ; les autres joueurs et le journal public voient les révélations et tirages habituels, sans mention du choix manuel. Les joueurs ne choisissent jamais leurs propres cartes, les gagnants ou les paiements.
- Le paquet de Blackjack n'est pas exposé dans les réponses API ; seule la liste sans ordre des cartes sélectionnables est fournie au croupier hôte pendant son tour.
- Le paquet de poker n'est jamais envoyé au navigateur. Les cartes privées des autres joueurs sont masquées jusqu'au showdown.
- Chaque joueur dispose d'un token de session temporaire ; seul son hash SHA-256 est stocké.
- Les mouvements de Ryôs sont enregistrés dans `Transaction`.

## Important

Ce projet est un outil de roleplay. Il ne doit pas être connecté à une monnaie réelle, un moyen de paiement ou un système de cashout.

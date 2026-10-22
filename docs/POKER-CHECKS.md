# Vérification du Texas Hold'em

## Règles et correctifs

- Poker no-limit entre joueurs, sans banque ni commission sur le pot.
- L'hôte peut créer la table en spectateur, lancer les manches et gérer le salon sans cartes ni blinds.
- Treize sièges de jeu au maximum ; les spectateurs, y compris l'hôte, ne consomment pas de siège. Le salon reste limité à 64 membres au total.
- Grosse blind égale au double de la petite. Une blind courte ne réduit pas la mise préflop lorsque plusieurs joueurs peuvent encore miser.
- Le bouton avance au prochain joueur actif, même si son précédent détenteur est passé spectateur.
- Ordre préflop et postflop vérifié, notamment en tête-à-tête.
- Tapis courts, réouverture cumulative des relances et absence de relance possible face à des adversaires tous à tapis.
- Remboursement explicite des mises non suivies ; chaque pot secondaire est distribué séparément.
- En cas d'égalité, le Ryô indivisible va au premier gagnant à gauche du bouton.
- Contrôle de conservation du pot, validation des cartes, protection contre les tours périmés et les capitaux pouvant dépasser les entiers de la base.
- Les cartes adverses et la pioche restent masquées, même pour l'hôte spectateur. Les commandes de secours et les remboursements restent journalisés.

## Vérifications exécutées

- Les 2 598 960 combinaisons de cinq cartes : effectifs exacts des neuf catégories, dont les 40 quintes flush.
- 20 000 mains de sept cartes comparées à leurs 21 sous-ensembles de cinq cartes, avec vérification de l'invariance à l'ordre des cartes.
- 12 000 parties complètes reproductibles de 2 à 13 joueurs : fin de manche, soldes non négatifs, somme des soldes conservée, pot égal aux contributions, aucune rémunération d'un spectateur.
- Scénarios ciblés : pots multiples, joueurs couchés, kickers, tableau commun gagnant, as bas, blinds incomplètes, tête-à-tête, annulation, accès et messages obsolètes.
- Contrôles navigateur ordinateur/mobile : classement repliable, création d'un hôte spectateur, treize joueurs plus cet hôte, absence de boutons de jeu pour le spectateur et conservation des outils d'administration.

## Relancer les tests

```powershell
npm test
$env:POKER_EXHAUSTIVE='1'
$env:POKER_SEVEN_SAMPLES='20000'
npx vitest run tests/poker-evaluation.test.ts
$env:POKER_SIMULATION_GAMES='12000'
npx vitest run tests/poker-simulation.test.ts
```

Le classement s'appuie sur [pokersolver](https://github.com/goldfire/pokersolver), version 2.1.4. Les règles de mise et de partage sont vérifiées à partir des [règles Poker TDA](https://www.pokertda.com/view-poker-tda-rules/), en adaptant les procédures de tournoi à cette table privée.

## Limites

Les parties simulées utilisent un stockage de test ; les scénarios navigateur utilisent des réponses API isolées. Ils ne constituent pas un test de charge PostgreSQL ni une garantie d'absence de bugs. Aucune partie réelle ni aucun solde de production n'a été modifié pour ces vérifications.

L'audit npm signale encore neuf alertes dans l'arbre de dépendances : deux critiques (Vitest et sa dépendance Tinypool), cinq élevées et deux modérées. Elles concernent notamment l'outillage de test, la configuration Prisma et PostCSS fourni par Next.js. Vitest a reçu une mise à jour compatible ; les migrations majeures de Next.js/Prisma et les remplacements d'outils ne sont pas forcés dans ce correctif poker. Aucun serveur Vitest UI n'est exposé. Ce rapport ne vaut donc pas validation de sécurité complète des dépendances.

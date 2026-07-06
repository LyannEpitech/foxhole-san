# Roadmap — Foxhole Swiss Army Knife

> **Statut (2026-07-07) : intégralement implémentée** (phases 1–4).
> Écarts assumés : A3.2 limité aux capacités *vérifiées* (les camions-bennes
> Atlas/Loadlugger sont classés vrac, aucune capacité de caisse inventée) ;
> B2 sans agrégat de pertes (endpoint warReport coûteux pour un intérêt
> faible) ; B4 sans modèle de vent (non documenté de façon fiable) ;
> Tisiphone/Falconer hors calculateur d'artillerie (infobox wiki incohérente).

Plan d'amélioration de l'application : renforcer les quatre modules existants et ajouter les fonctionnalités qui répondent aux besoins réels des joueurs (logisticiens solo comme officiers de régiment).

## 1. Vue d'ensemble

L'app est aujourd'hui un outil cohérent et fonctionnel : quatre modules interconnectés (Production, Déploiement, Logistique, Attaque), un moteur de résolution de production rigoureusement testé (`src/engine/resolver.ts`), et une carte SVG maison sur 53 hexagones alimentée en direct par la War API officielle (`src/lib/warapi.ts`).

**Contrainte structurante** : l'app est un site statique (GitHub Pages) sans backend. Toutes les fonctionnalités ci-dessous respectent cette contrainte — l'état vit dans le localStorage, le partage passe par le hash d'URL ou des fichiers JSON, et les données live viennent de la War API officielle (ouverte au CORS).

**Opportunités révélées par l'inspection du code** :

- Le moteur multi-cibles existe déjà (`resolveMany()` dans `src/engine/resolver.ts`, utilisé par Logistique et Attaque), mais le module Production ne planifie qu'un seul article à la fois (`planStore.ts` ne stocke qu'un `targetId`).
- Les données MPF sont déjà présentes (`isMfpCraftable` + `cost` sur chaque item de `items.json`, bâtiment `mpf` dans `buildings.json`), mais la remise MPF (jusqu'à −50 %) n'est jamais calculée.
- `vehicles.json` ne contient que 2 véhicules — le calcul de trajets du module Logistique est bridé par cette lacune de données.
- La War API offre des endpoints inexploités : `/war` (numéro et état de la guerre), `/worldconquest/warReport/:map` (victimes, activité), `/maps/:map/static` (noms des villes et champs de ressources par hexagone).
- `logiStore` et `attackStore` ne sont pas persistés : un refresh fait perdre le manifeste et le plan d'attaque en cours.

---

## 2. Axe A — Améliorer les fonctionnalités existantes

Efforts estimés : **S** (heures), **M** (jours), **L** (semaine+).

### A1. Module Production

| # | Amélioration | Valeur joueur | S'appuie sur | Effort |
|---|---|---|---|---|
| A1.1 | **Plans multi-articles** — planifier une liste complète (« 30 fusils + 20 caisses de 7.62 + 4 camions ») au lieu d'un seul article. UI : liste de lignes cibles (article + quantité), arbre et totaux fusionnés. | C'est ainsi qu'arrivent les vraies commandes logi. Plus gros manque UX du module. | `resolveMany()` fusionne déjà les arbres et agrège bâtiments/séquence — migrer `planStore.ts` de `targetId/quantity` vers `targets: PlanTarget[]` (avec migration de la clé persistée `fsak-plan`) et adapter les panneaux de `ProductionModule.tsx`. | M |
| A1.2 | **Déduction « déjà en stock »** — champ par ressource/intermédiaire « déjà en réserve », soustrait avant le calcul des lots. | Personne ne part de zéro ; évite la surproduction. | Paramètre optionnel `stock: Record<refId, number>` dans `resolveMany` ; colonne éditable dans `ResourceTotals.tsx`. Alimentera plus tard le suivi de stocks (B1). | M |
| A1.3 | **Mode MPF + calcul de remise** — bascule « produire au MPF » : coût par caisse avec la remise de file (−10 % par caisse jusqu'à −50 %), économies totales vs Usine, temps de file MPF. | Le choix MPF vs Usine est une décision quotidienne de régiment ; la remise de 50 % change radicalement les totaux. | Flag `isMfpCraftable` + `cost` dans `items.json`, bâtiment `mpf` dans `buildings.json`. Fonction pure dans un nouveau `src/lib/mpf.ts` + bascule dans `ProductionModule.tsx`. | S (calculateur seul), M (intégré aux totaux du resolver) |
| A1.4 | **Timeline en heure réelle** — convertir les durées de la timeline en heures locales (« lancé maintenant → prêt à 14:32 »), avec sélecteur d'heure de départ. | Les files de raffinage durent des heures ; les joueurs planifient en heure réelle. | Timeline déjà calculée par le resolver et affichée dans `PlanExtras.tsx` ; ajout de formatage horaire localisé (i18next). | S |
| A1.5 | **Export des totaux** — « copier pour Discord » (tableau markdown des totaux + caisses) et téléchargement CSV. | Les commandes de régiment se postent sur Discord ; le copier-coller est la fonctionnalité qui tue. | API Clipboard ; les totaux sont déjà structurés dans le résultat du plan. | S |

### A2. Carte partagée (HexMap / PlanMap)

| # | Amélioration | Valeur joueur | S'appuie sur | Effort |
|---|---|---|---|---|
| A2.1 | **Labels statiques (villes, champs de ressources)** — appeler `/maps/:map/static` (ne change qu'au changement de guerre → cache agressif en localStorage, clé = numéro de guerre via `/war`), afficher les noms + icônes de champs au zoom. | Les joueurs pensent en noms de villes (« RDV à Abandoned Ward »), pas en noms d'hexagones. Prérequis pour un vrai confort en Déploiement/Logistique. | Nouveau `fetchRegionStatic()` dans `warapi.ts` (même format x/y que le dynamic) ; couche de rendu dans `HexMap.tsx` conditionnée au zoom ; bascule dans `MapLayersControl.tsx`. | M |
| A2.2 | **Undo/redo des annotations** — Ctrl+Z / Ctrl+Y, pile d'historique (~50 opérations) dans `annotationStore`. | Dessiner à main levée sans annuler est frustrant ; peu coûteux à ajouter. | Les actions de `annotationStore.ts` sont déjà discrètes (add/remove/update) — les envelopper d'une pile passé/futur (ne persister que l'état présent). | S |
| A2.3 | **Export PNG du plan de carte** — « télécharger l'image » de la vue courante (annotations, nœuds de déploiement, itinéraires) pour la poster sur Discord. | Les briefings d'opération sont des captures d'écran aujourd'hui ; un export propre bat une capture recadrée. | SVG → canvas → PNG (sérialiser le SVG existant de `HexMap.tsx`, inliner styles/polices). | M |
| A2.4 | **Audit mobile/responsive** — gestes tactiles (pinch-zoom), panneaux latéraux repliables, barre d'onglets accessible au pouce. | Beaucoup de joueurs utilisent un téléphone en second écran à côté du jeu. | Code pan/zoom de `HexMap.tsx` ; breakpoints Tailwind dans les 4 modules ; `Drawer.tsx` peut héberger les panneaux sur petit écran. | M (audit S, correctifs variables) |

### A3. Module Logistique

| # | Amélioration | Valeur joueur | S'appuie sur | Effort |
|---|---|---|---|---|
| A3.1 | **Persister `logiStore`** (waypoints, manifeste, véhicule), comme `deployStore`. | Perdre un manifeste au refresh est vécu comme un bug. | Copier le pattern `persist` de `deployStore.ts`. | S |
| A3.2 | **Enrichir `vehicles.json`** — flatbed, logistique conteneurs/palettes, cargo, train, variantes de camions par faction, avec `capacityCrates` (et capacité « shippables » si pertinent). | 2 véhicules, c'est très en dessous de ce que conduisent les logisticiens ; le calcul de trajets n'est utile que si la liste est réelle. | Schéma déjà validé par zod ; extension minimale du schéma, mise à jour de `planCargo()` dans `logistics.ts`. Surtout de la curation de données. | S–M |
| A3.3 | **Estimation distance / temps de trajet** — pas de graphe routier dans les données (vérifié) : version honnête = distance de la polyline des waypoints en coordonnées monde (géométrie des hexagones dans `regionLayout.json`) × vitesse du véhicule (`speedKmh` à ajouter dans `vehicles.json`), + pénalité par franchissement de frontière. Affiché clairement comme estimation. | « Combien de temps dure ce run ? » est la question n°1 avant un convoi. Même à ±20 %, c'est utile pour compter les rotations par heure. | Waypoints déjà dans `logiStore` ; calcul dans `logistics.ts`. | M |
| A3.4 | **Planning d'allers-retours** — combiner A3.3 et le nombre de trajets : « 6 trajets × 22 min ≈ 2 h 12, fini à 17:40 ». | Transforme le module en véritable outil de planification d'opération. | Trajets de `planCargo()` + temps A3.3 + formatage horaire A1.4. | S (après A3.3) |

### A4. Module Attaque

| # | Amélioration | Valeur joueur | S'appuie sur | Effort |
|---|---|---|---|---|
| A4.1 | **Persister `attackStore`** + presets de loadouts nommés (« infanterie d'assaut », « ligne de chars ») sauvegardés et réutilisables entre opérations. | Les officiers réutilisent les mêmes loadouts à chaque op ; les retaper est une friction. | Pattern `persist` ; petit CRUD de presets dans `AttackModule.tsx`. | S |
| A4.2 | **« Envoyer vers Production »** — les cibles d'attaque partent déjà vers la Logistique ; les pousser aussi vers le plan de production multi-articles (A1.1) pour boucler : attaque → production → déploiement → logistique. | Ferme la boucle entre les quatre modules — le différenciateur central de l'app. | Les cibles `resolveMany` sont la monnaie commune ; nécessite le format `targets[]` de A1.1. | S (après A1.1) |

### A5. Transverse — gestion d'état

| # | Amélioration | Valeur joueur | S'appuie sur | Effort |
|---|---|---|---|---|
| A5.1 | **Gestionnaire de plans sauvegardés** — nommer/sauver/charger/dupliquer/supprimer des snapshots complets (production + déploiement + logistique + attaque + annotations) en localStorage ; tiroir « Plans ». | Un régiment mène plusieurs opérations en parallèle ; aujourd'hui il n'existe qu'un seul plan implicite. | Nouveau `snapshotStore` qui sérialise les tranches persistées des stores existants (leurs `partialize` définissent déjà le schéma de snapshot — le valider avec zod au chargement). | M |
| A5.2 | **Partage par lien (hash d'URL)** — « Copier le lien » sérialise le snapshot (JSON → compression `CompressionStream` → base64url → `#p=...`) ; ouvrir le lien importe le plan. Aucun backend. | Partager un plan d'op sur Discord en un lien — la fonctionnalité collaborative la plus rentable pour un site statique. | Dépend du format de snapshot A5.1. Attention à la longueur d'URL (~8–16 Ko en pratique) : compresser, et basculer sur A5.3 pour les très gros plans. | M |
| A5.3 | **Export/import JSON de snapshot** (téléchargement/upload de fichier) — repli sans limite de taille et mécanisme de sauvegarde. | Archives de régiment, passation entre officiers. | Même schéma de snapshot ; téléchargement `Blob` + input fichier. | S |

---

## 3. Axe B — Nouvelles fonctionnalités orientées joueurs

| # | Fonctionnalité | Ce que ça apporte au joueur | Faisabilité & approche | Effort |
|---|---|---|---|---|
| B1 | **Suivi de stocks manuel** | Suivre le contenu de chaque stockpile (base/seaport) : lieux (ville choisie via les données statiques A2.1) × quantités d'articles, saisie manuelle rapide, timer « expire dans 50 h » par réservation. Déduit des plans de production (A1.2) et chargeable dans les manifestes logistiques. | Le besoin n°1 de la communauté. L'import OCR complet est hors périmètre (OCR lourd côté client ou backend), mais un tracker manuel à faible friction avec timers d'expiration et intégration aux plans est réellement utile et 100 % localStorage. Concevoir le schéma pour qu'un import OCR puisse l'alimenter plus tard. | L |
| B2 | **Tableau de bord de guerre** | Widget d'accueil : numéro et jour de la guerre, villes de victoire requises, victimes par faction, contrôle des villes par hexagone (colorer la carte par possession). | Fonctionnalité sans saisie, à large audience ; fournit aussi la clé de cache (numéro de guerre) dont A2.1 a besoin. Étendre `warapi.ts` avec `fetchWar()` et `fetchWarReport(regionId)` ; petit panneau + couche « contrôle » dans `MapLayersControl.tsx`. | M |
| B3 | **Calculateur de files de raffinerie** | Mini-outil autonome : « N salvage → bmats, lancé à HH:MM → prêt à HH:MM », plusieurs files en parallèle, notification navigateur optionnelle (API Notification) à la fin. | Le raffinage prend des heures ; les joueurs font ce calcul à la main en permanence. Les recettes avec `timeSeconds` sont déjà dans `recipes.json` — quasi gratuit après A1.4. | S |
| B4 | **Calculateur d'artillerie** | Style spotter : saisir distance + azimut spotter→cible et canon→spotter (ou cliquer deux points sur la carte zoomée), obtenir la solution de tir ; portées min/max par canon et tables de correction de vent. | Catégorie d'outil compagnon extrêmement populaire ; maths pures, sans backend. Nécessite un petit dataset `src/data/artillery.json` (canons, portées, décalages de vent — documentés par la communauté). Autonome d'abord ; intégration carte ensuite (une fois A2.1 en place). | M |
| B5 | **Suivi de l'arbre technologique** | Cases à cocher manuelles pour ce que la faction a débloqué cette guerre ; le module Production avertit alors « pas encore tech » au lieu de seulement lister les prérequis. | Les prérequis tech sont déjà modélisés dans le resolver — il manque un état par guerre (réinitialisé au changement de guerre via le numéro de B2) et un filtre/avertissement dans le sélecteur d'articles et les panneaux du plan. | M |
| B6 | **PWA / mode hors-ligne** | App installable ; JSON de données et coquille applicative en cache ; carte utilisable hors-ligne avec le dernier snapshot War API. | Site Vite statique → `vite-plugin-pwa` quasi drop-in. `fetchAllDynamic` dégrade déjà proprement en cas d'échec ; persister le dernier snapshot de `mapDataStore` pour l'affichage hors-ligne. | S–M |
| B7 | **Comparateur coût/caisse Usine vs MPF** | Petit tableau par article : coût unitaire à l'Usine vs MPF (remise incluse), caisses par camion, efficacité bmats par chargement. | Entièrement dérivable de `items.json` + les maths de A1.3 ; à afficher dans le détail d'article ou `ResourceTotals`. | S (après A1.3) |

**Écarté volontairement** : import OCR complet des stockpiles (nécessite un backend ou du WASM lourd), routage routier réel (aucune donnée de routes dans le projet ni dans l'API publique), toute fonctionnalité à compte/synchronisation (backend).

---

## 4. Axe C — Fondations techniques (bref)

1. **ESLint (flat config) + `tsc --noEmit` en CI** — des commentaires `eslint-disable` existent sans qu'aucun lint ne tourne, et le TypeScript strict n'est vérifié qu'en local (`deploy.yml` appelle `vite build` sans `tsc`). Effort : S.
2. **Test de fumée Playwright** — déjà installé, inutilisé. Un seul spec : charger l'app, parcourir les 4 onglets, créer un petit plan, recharger et vérifier la persistance. Protège toutes les migrations de stores de cette roadmap (A1.1 et A5.1 touchent des schémas persistés). Effort : S.
3. **Extension des tests du resolver** — couvrir la déduction de stock (A1.2) et les maths MPF (A1.3) dans `resolver.test.ts` / un nouveau `mpf.test.ts` au fur et à mesure. Continu.

---

## 5. Roadmap par phases

### Phase 1 — Gains rapides (quelques jours chacun, valeur immédiate)
1. A3.1 + A4.1 — persistance de `logiStore`/`attackStore` (correctifs de bugs perçus)
2. A1.4 — timeline en heure réelle, puis B3 — calculateur de raffinerie (mêmes maths)
3. A1.5 — export Discord/CSV des totaux
4. A2.2 — undo/redo des annotations
5. C1 + C2 — fondations (protège tout le reste)

### Phase 2 — Cœur de l'app
6. A1.1 — plans multi-articles → A4.2 — lien attaque→production (boucle des modules fermée)
7. A1.2 — déduction de stock + A1.3 — calculateur MPF (+ B7 — tableau comparatif)
8. A3.2 — enrichissement des véhicules → A3.3/A3.4 — temps de trajet & planning
9. B2 — tableau de bord de guerre (fournit aussi la clé de cache du numéro de guerre)
10. A2.1 — labels statiques des villes (dépend de la clé de cache de B2)

### Phase 3 — Partage & portée
11. A5.1 — gestionnaire de plans → A5.3 — export/import JSON → A5.2 — liens de partage par URL
12. A2.3 — export PNG de la carte
13. A2.4 — audit mobile + B6 — PWA (à livrer ensemble : même usage « sur le terrain »)

### Phase 4 — Nouveaux outils ambitieux
14. B1 — suivi de stocks (capitalise sur A1.2, A2.1 et l'infra de snapshots A5)
15. B5 — suivi de l'arbre technologique
16. B4 — calculateur d'artillerie (indépendant ; avançable plus tôt si envie — fort attrait communautaire, code isolé)

### Justification de l'ordre

La **phase 1** supprime les frictions de ce qui fonctionne déjà. La **phase 2** cible les deux meilleurs ratios valeur/effort révélés par l'inspection du code — la planification multi-cibles (moteur déjà prêt, UI manquante) et l'économie du MPF (données déjà présentes, maths manquantes) — et comble les lacunes de données (véhicules, villes) qui plafonnent l'utilité des modules carte. La **phase 3** transforme un outil solo en outil de régiment sans backend. Le suivi de stocks (**phase 4**) est le plus gros pari et vient volontairement en dernier parce qu'il réutilise l'infrastructure des phases 2–3.

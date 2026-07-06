# Foxhole Swiss Army Knife

Outil de planification pour [Foxhole](https://www.foxholegame.com/), en trois
modules. UI bilingue **FR/EN**, filtrage par faction (Colonial / Warden).

## 🏭 Production

À partir d'un objet cible et d'une quantité :

- 🌳 **L'arbre des besoins** : décomposition récursive jusqu'aux ressources brutes
  (ferraille, composants, soufre…), avec arrondi par commande/caisse.
- 📦 **Les totaux ressources** : brutes et raffinées (bmats, rmats, emats, hemats).
- 🏭 **Les bâtiments requis** : coût de (re)construction et prérequis
  (amélioration « Industrie » de la base de ville).
- 📋 **La séquence ordonnée** : débloquer → construire → produire (tri
  topologique, les entrées avant les sorties).

## 🗺️ Carte interactive (Logistique & Attaque)

- **Fond de carte officiel** : les 53 hexes rendus avec les vraies images du
  jeu (glisser pour déplacer, molette pour zoomer vers le curseur).
- **Marqueurs live de la War API** : villes, bases, industrie (usines,
  raffineries, ports…), champs de ressources et structures militaires, avec
  l'anneau coloré selon la faction qui les contrôle (bleu Warden / vert
  Colonial). Couches filtrables, bouton « Données de guerre » pour rafraîchir.
- **Annotations custom** : marqueurs allié ⬤ / ennemi ✖ / danger ⚠ (clic) et
  flèches alliées/ennemies (glisser), gomme et « tout effacer » — persistées
  en localStorage, partagées entre les modules.

## 🚚 Logistique — planificateur de routes

- Cliquer une région l'ajoute à l'itinéraire, les étapes sont numérotées sur
  la carte et le tracé est dessiné.
- **Manifeste de cargaison** : objets + quantités → nombre de caisses (arrondi
  par taille de caisse).
- **Véhicule** : choix d'un camion (R-1 Hauler / Dunne Transport, 15 caisses) →
  nombre d'allers-retours.
- **Coût de production de la cargaison** (repliable) : le manifeste est envoyé
  au moteur (`resolveMany`) → totaux, bâtiments, séquence.

## ⚔️ Attaque — planificateur d'opérations

- **Carte interactive** : placer l'objectif 🎯 et la zone de rassemblement 🏕
  en cliquant, l'axe d'attaque est tracé.
- **Effectifs** : nombre de soldats × équipement par soldat (loadout type
  par faction en un clic) + lignes de soutien à quantité fixe.
- **Envoyer vers la logistique** : exporte les besoins comme manifeste et
  pré-remplit l'itinéraire rassemblement → objectif.
- **Coût total de l'opération** (repliable) : ressources, bâtiments, séquence.

## Stack

Vite · React 19 · TypeScript strict · Tailwind CSS v4 · Zustand · zod ·
react-i18next · Vitest.

## Lancer

```bash
npm install
npm run dev      # serveur de dev
npm run test     # tests du moteur (Vitest)
npm run build    # build de production (tsc + vite)
```

## Structure

```
src/
  data/        # Données de jeu curées (JSON) + validation zod + Dataset + régions (War API)
  types/       # Types du domaine (Resource, Building, Recipe, Item, VehicleSpec…)
  engine/      # resolver.ts : resolve / resolveMany + tests
  lib/         # logistics.ts (caisses/voyages), attack.ts (agrégation), refs.ts
  store/       # Stores Zustand (plan, logistique, attaque, onglet actif)
  i18n/        # react-i18next, fr.json / en.json
  components/  # UI partagée (panneaux, sélecteurs, arbre, totaux, séquence)
  modules/     # ProductionModule, LogisticsModule, AttackModule
```

## Données

- **Objets (190)** : importés depuis la base communautaire
  [foxhole-item-api](https://github.com/joshuaHallee/foxhole-item-api)
  (`setup/foxhole-db.json`), transformés vers notre schéma. Quelques coûts
  datés ont été **corrigés avec les valeurs du
  [Wiki Foxhole](https://foxhole.wiki.gg)** (2026-07-06) : 120mm, Bomastone,
  A3 Harpa.
- **Régions (53)** : géométrie des hexes issue de
  [foxhole-map-annotate](https://github.com/attrib/foxhole-map-annotate)
  (`public/static.json`), mêmes ids que la War API officielle.
- **Fonds de carte (`public/maps/*.png`)** : images officielles des régions
  (1024×888, coins transparents) fournies par le jeu via le dépôt
  [clapfoot/warapi](https://github.com/clapfoot/warapi) (`Images/Maps/*.TGA`),
  récupérées en PNG depuis le [Wiki](https://foxhole.wiki.gg). © Siege Camp —
  assets mis à disposition pour les outils communautaires ; même pipeline que
  foxholestats / warden.express.
- **Recettes de raffinage & bâtiments** : vérifiés sur le Wiki (2026-07-06).
- **Icônes de structures (`public/icons/*.png`)** : assets officiels
  `Images/MapIcons/*.TGA` du dépôt warapi, convertis en PNG.
- **Marqueurs live** : appels directs (CORS ouvert) à
  `war-service-live.foxholeservices.com/api/worldconquest/maps/<hex>/dynamic/public`,
  mapping iconType aligné sur foxhole-map-annotate.

## Étendre les données

Pour ajouter/corriger un objet :

1. Ajouter l'entrée dans `items.json` (`cost` = coût d'une commande,
   `amountProduced` = taille de la caisse, `producedBy` = id de bâtiment).
2. Si l'objet demande une nouvelle ressource/recette, l'ajouter dans
   `resources.json` / `recipes.json`.
3. `npm run test` — la validation zod et les contrôles d'intégrité
   référentielle (`src/data/index.ts`) attrapent les fautes de frappe.

Les recettes de craft des objets sont générées automatiquement depuis
`cost` + `amountProduced` (voir `itemToRecipe`), le moteur ne manipule qu'un
seul concept : « une recette produit une référence ».

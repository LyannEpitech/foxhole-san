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

## 🚚 Logistique

- **Manifeste de cargaison** : objets + quantités → nombre de caisses (arrondi
  par taille de caisse).
- **Véhicule** : choix d'un camion (R-1 Hauler / Dunne Transport, 15 caisses) →
  nombre d'allers-retours.
- **Itinéraire** : séquence ordonnée de régions (les 53 hexes de la carte,
  récupérés depuis la War API officielle), réordonnables.
- **Coût de production de la cargaison** : le manifeste est envoyé au moteur
  (`resolveMany`) → totaux, bâtiments, séquence.

## ⚔️ Attaque

- **Effectifs** : nombre de soldats × équipement par soldat (loadout type
  par faction en un clic) + lignes de soutien à quantité fixe.
- **Coût total de l'opération** : agrégation → moteur → ressources, bâtiments,
  séquence de production.
- **Envoyer vers la logistique** : exporte les besoins comme manifeste de
  cargaison pour planifier le transport.

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

## Étendre les données

Les données de jeu vivent dans `src/data/*.json` et sont **vérifiées à la main
sur le [Wiki Foxhole](https://foxhole.wiki.gg)** (dernière vérification :
2026-07-06). Pour ajouter un objet :

1. Ajouter l'entrée dans `items.json` (`cost` = coût d'une commande,
   `amountProduced` = taille de la caisse, `producedBy` = id de bâtiment).
2. Si l'objet demande une nouvelle ressource/recette, l'ajouter dans
   `resources.json` / `recipes.json`.
3. `npm run test` — la validation zod et les contrôles d'intégrité
   référentielle (`src/data/index.ts`) attrapent les fautes de frappe.

Les recettes de craft des objets sont générées automatiquement depuis
`cost` + `amountProduced` (voir `itemToRecipe`), le moteur ne manipule qu'un
seul concept : « une recette produit une référence ».

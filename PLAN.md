# Navigation Plugin — Plan d'implémentation

## Phases

| # | Phase | Statut |
|---|-------|--------|
| 1 | Navigation tree simple | ✅ Terminé |
| 2 | Recherche intégrée | ⏳ À faire |
| 3 | Variables dans les liens | ⏳ À faire |
| 4 | Améliorations UX (icônes, état actif, breadcrumbs…) | ⏳ À faire |

---

## Phase 1 — Navigation tree simple

### Objectif
Afficher un arbre de navigation configurable dans le panel : un lien Home optionnel, des sections collapsibles (avec sous-sections), et des liens (dashboard Grafana ou URL externe).

---

### Structure de données

```typescript
// src/types.ts

export interface NavLink {
  title: string;
  type: 'dashboard' | 'external';
  uid?: string;
  url?: string;
}

// NavItem est soit un lien, soit une sous-section
export type NavItem = NavLink | NavSection;

export interface NavSection {
  title: string;
  items: NavItem[];   // peut contenir des NavLink ET des NavSection imbriqués
}

export interface NavConfig {
  homeLink?: NavLink;
  sections: NavSection[];
}

// Helper de discrimination
export const isNavSection = (item: NavItem): item is NavSection =>
  'items' in item;
```

Stocké dans `jsonData.navConfig` via `/api/plugins/saeme-navigation-app/settings`.

---

### Tâches

| Tâche | Statut |
|-------|--------|
| `src/types.ts` — types de base | ✅ Fait |
| `AppConfig` — formulaire visuel (sections + liens) | ✅ Fait |
| `AppConfig` — sélecteur dashboard (dropdown API) | ✅ Fait |
| `AppConfig` — bouton page d'accueil Grafana (/) | ✅ Fait |
| `SimplePanel` — rendu arbre collapsible | ✅ Fait |
| `SimplePanel` — police responsive selon largeur panel | ✅ Fait |
| `README` — note taille recommandée du panel | ✅ Fait |
| `types.ts` — support `NavItem` (union Link \| Section) | ✅ Fait |
| `AppConfig` — ajout de sous-sections dans les sections | ✅ Fait |
| `SimplePanel` — rendu récursif des sous-sections | ✅ Fait |

---

### Sous-sections — détail d'implémentation

#### `src/types.ts`
`NavSection.items` passe de `NavLink[]` à `NavItem[]` (union `NavLink | NavSection`).
Helper `isNavSection` pour discriminer dans les composants.

#### `src/components/AppConfig/AppConfig.tsx`
Dans chaque section, en plus de "Ajouter un lien", ajouter un bouton "Ajouter une sous-section".
Les sous-sections s'affichent indentées avec le même pattern (titre + ses propres liens).
Pas de profondeur infinie : **maximum 1 niveau d'imbrication** (section → sous-section → liens).

```
▼ Infrastructure                              [↑][↓][✕]
    • Servers   dashboard  [Dashboard A ▾]   [✕]
    ▼ Cloud                                   [✕]
        • AWS   dashboard  [Dashboard B ▾]   [✕]
        • GCP   dashboard  [Dashboard C ▾]   [✕]
        [ + Ajouter un lien ]
    [ + Ajouter un lien ]
    [ + Ajouter une sous-section ]
```

#### `src/panel/SimplePanel.tsx`
Rendu récursif : une fonction `renderItems(items, depth)` gère les deux cas.
Les sous-sections sont collapsibles indépendamment, indentées visuellement.
`openSections` devient `openSections: Set<string>` avec une clé `"si-ssi"` (ex: `"0-1"`).

---

### Ce qui est exclu de la phase 1
- Plus de 1 niveau d'imbrication (section → sous-section → sous-sous-section)
- Variables dans les liens (`$host`, etc.)
- Recherche
- Réorganisation par drag & drop
- Icônes sur les liens

---

## Phase 2 — Recherche intégrée

*(À détailler une fois la phase 1 validée)*

- Activer/désactiver la recherche dans la config
- Définir les types de recherche (`dashboard`, `custom_ip`, `custom_host`)
- Data source configurable (recommandé : Grafana Business Input)
- Rendu dans le panel : inputs Type + Value → navigation vers dashboard avec variables

---

## Phase 3 — Variables dans les liens

*(À détailler une fois la phase 2 validée)*

- Support de `$variable` dans les URLs/UIDs
- Variables de dashboard (injectées depuis le contexte Grafana)
- Variables statiques définies dans la config du plugin

---

## Phase 4 — Améliorations UX

*(À détailler une fois la phase 3 validée)*

- Icônes sur sections et liens
- État actif (lien correspondant au dashboard courant mis en valeur)
- Breadcrumbs
- Favoris / dashboards récents
- Support layout horizontal

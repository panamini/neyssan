

# AUDIT DASTI v1 — `my-app` React
## Phase 1 : Conformité design system · 18 mars 2026

---

## SYNTHÈSE EXÉCUTIVE

| Catégorie | Conformité | Gravité |
|---|---|---|
| Palette chromatique | **0%** — système monochrome générique | Blocant |
| Typographie | **0%** — Inter/Roboto, aucune des 3 familles dasti | Blocant |
| Spacing tokens | **~40%** — série 8px vs série 4px dasti | Majeur |
| Border-radius | **~30%** — 4 niveaux présents, valeurs erronées | Majeur |
| Variables CSS (nommage) | **0%** — `--background/foreground/primary` ≠ `--bg/sf1/ti` | Majeur |
| Composants (structure) | **~50%** — btn/input/dialog présents, classes ≠ dasti | Moyen |
| Shadows | **~20%** — `rgba(16,24,40,…)` vs shadows chaudes dasti | Moyen |

---

## FICHIER 1 — `src/styles/globals.css`

### 1.1 Couleurs hardcodées
| Ligne | Valeur actuelle | Remplacement dasti | Priorité |
|---|---|---|---|
| 22 | `--background: #ffffff` | `--bg: hsl(38,16%,95%)` (light) | **P1** |
| 23 | `--foreground: #050505` | `--ti: hsl(30,12%,11%)` | **P1** |
| 24 | `--primary: #343434` | Mapper sur `--ti` ou `--sf1` selon contexte | P2 |
| 25 | `--muted: #919191` | `--tm2: hsl(30,8%,42%)` | **P1** |
| 26 | `--accent: #626262` | `--ac: hsl(155,22%,30%)` (sauge) | **P1** |
| 27 | `--hover: #000000` | Supprimer — dasti utilise `brightness()` sur `--ac` | P2 |
| 28 | `--job-field-bg: #BFBFBF` | `--sf1: hsl(38,12%,93%)` | **P1** |
| 33-35 | `--success/danger/warning: var(--accent)` | `--ok`, `--er` dasti (hsl analogiques) | P2 |
| 38 | `--on-primary: #ffffff` | `--op: hsl(40,20%,99%)` (blanc chaud) | P2 |
| 73 | `--shadow-color: rgba(16,24,40,0.08)` | `--sha` dasti `hsla(30,20%,8%,.05)` | P3 |
| 90 | `--background: #272727` (dark) | `--bg: hsl(80,5%,7%)` (dark) | **P1** |
| 91 | `--foreground: #eeeeee` (dark) | `--ti: hsl(46,12%,86%)` (ivoire chaud) | **P1** |
| 92-94 | dark primary/muted/accent | Tous sur tokens dasti dark | **P1** |
| 101 | `--success: #059669` (dark) | `--ok: hsl(152,22%,56%)` | P2 |
| 102 | `--danger: #ef4444` (dark) | `--er: hsl(4,24%,56%)` | P2 |
| 103 | `--warning: #d97706` (dark) | Token `--wa` à créer (hsl analogique ~36°) | P2 |
| 162 | `--remirror-list-marker-color: #94a3b8` | `var(--tg2)` | P3 |

### 1.2 Typographie
| Ligne | Valeur actuelle | Remplacement dasti | Priorité |
|---|---|---|---|
| 117 | `Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial` | `'Source Sans 3', sans-serif` (shell applicatif) | **P1** |

### 1.3 Spacing — variables CSS
| Ligne | Valeur actuelle | Problème | Priorité |
|---|---|---|---|
| 9-19 | `--space-1: 8px` à `--space-16: 128px` (grille 8px) | Série dasti : 4·8·12·16·24·32·40·64. Grille 8px manque `4px` et `12px` | **P1** |
| 45 | `--header-height: var(--space-8)` → 64px | Dasti topbar = 54px (`--hdr`) | P2 |
| 49 | `--btn-height-base: var(--space-3)` → 24px | Dasti `--hm: 40px` | **P1** |
| 50 | `--btn-height-primary: ~38.8px` (φ-calculé) | Dasti `--hb: 44px` (WCAG 2.5.5) | **P1** |

### 1.4 Border-radius
| Ligne | Valeur actuelle | Remplacement dasti | Priorité |
|---|---|---|---|
| 65 | `--card-radius: 0.5rem` (8px) | `--rm: 12px` (cards/panels) | P2 |

---

## FICHIER 2 — `tailwind.config.js`

### 2.1 Couleurs — nommage et valeurs
| Ligne | Valeur actuelle | Problème dasti | Priorité |
|---|---|---|---|
| 14-19 | `background/foreground/primary/muted/accent/hover` | Nomenclature ≠ dasti (`bg/ti/tm2/tg2/ac`) | **P1** |
| 21-31 | Palette gray 50-900 | Doit être supprimée — dasti interdit Inter/gray generics | **P1** |

### 2.2 Typographie
| Ligne | Valeur actuelle | Problème dasti | Priorité |
|---|---|---|---|
| 40-46 | `text-xs: 0.618rem` … `text-3xl: 2.618rem` | Scale rem ≠ dasti (12·14·16·20·26·32 px fixes `--tx`→`--tx2`) | P2 |

### 2.3 Spacing
| Ligne | Valeur actuelle | Problème dasti | Priorité |
|---|---|---|---|
| 58-71 | Grille 8px (space-1=8px → space-20=160px) | Dasti : 4px minimum, série 4·8·12·16·24·32·40·64 | **P1** |

### 2.4 Border-radius
| Ligne | Valeur actuelle | Remplacement dasti | Priorité |
|---|---|---|---|
| 132 | `sm: 0.25rem` (4px) | `--rx: 4px` ✓ OK | — |
| 133 | `md: 0.5rem` (8px) | `--rs: 6px` (boutons/inputs) → écart | P2 |
| 134 | `lg: 0.75rem` (12px) | `--rm: 12px` ✓ OK | — |
| 135 | `xl: 1rem` (16px) | `--rl: 18px` (modals) → manque niveau | P2 |

### 2.5 Shadows
| Ligne | Valeur actuelle | Remplacement dasti | Priorité |
|---|---|---|---|
| 139 | `rgba(16,24,40,0.04/0.06)` | `--sha: 0 1px 2px hsla(30,20%,8%,.05)` | P3 |
| 140 | `rgba(16,24,40,0.08)` | `--shb: 0 4px 14px hsla(30,20%,8%,.07)` | P3 |

---

## FICHIER 3 — `src/index.css`

### 3.1 Couleurs hardcodées
| Ligne | Valeur actuelle | Remplacement dasti | Priorité |
|---|---|---|---|
| 5 | `--background: #ffffff` | `--bg: hsl(38,16%,95%)` | **P1** |
| 6 | `--foreground: #000000` | `--ti: hsl(30,12%,11%)` | **P1** |
| 7 | `--hover-outline: #FF7F50` (coral) | Supprimer — interdit (cyan/néon hors palette) | **P1** |
| 8 | `--job-field-bg: #BFBFBF` | `--sf1: hsl(38,12%,93%)` | **P1** |
| 12 | `--background: #272727` (dark) | `--bg: hsl(80,5%,7%)` (dark) | **P1** |
| 30 | Scrollbar thumb `#919191` | `var(--tm2)` | P3 |
| 35 | Scrollbar hover `#626262` | `var(--ac)` | P3 |
| 118 | Switch thumb `white` | `var(--op)` (blanc chaud dasti) | P2 |

### 3.2 Typographie
| Ligne | Valeur actuelle | Remplacement dasti | Priorité |
|---|---|---|---|
| 50 | `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, …` | `'Source Sans 3', sans-serif` | **P1** |
| 77 | `source-code-pro, Menlo, Monaco, …` | `'IBM Plex Mono', monospace` (style Expert) | P2 |

### 3.3 Patterns à supprimer
| Ligne | Pattern | Raison | Priorité |
|---|---|---|---|
| 59-74 | `.proposal-h1/h2/p` avec `font-size: 2em/1.5em` | Valeurs `em` hors spec dasti — remplacer par `--tx2/--tl/--tb` | P2 |

---

## FICHIER 4 — `src/styles/tailwind.css`

### 4.1 Nomenclature variables
| Ligne | Classe actuelle | Problème | Priorité |
|---|---|---|---|
| 8 | `.text-muted { color: var(--text-muted) }` | Token `--text-muted` inexistant — dasti = `--tm2` | P2 |
| 12 | `.bg-job-field { background-color: var(--job-field-bg) }` | Nommer `--sf1` | P2 |

---

## FICHIER 5 — `src/components/ui/button.tsx`

### 5.1 Correspondance composant dasti
Composant **existant** → mapper sur `.btn` dasti.

| Aspect | Valeur actuelle | Dasti cible | Priorité |
|---|---|---|---|
| Hauteurs | `btn-height-primary/base/tertiary` (φ-calculé) | `--hb:44px / --hm:40px / --hs:32px` fixes | **P1** |
| Variant `primary` | `bg-primary text-background` | `.bp` : `bg: var(--ac)` · `color: var(--op)` · `shadow: var(--sha)` | **P1** |
| Variant `secondary` | `bg-background border-accent hover:bg-accent/10` | `.bsec` : `bg: var(--sfr)` · `border: var(--bm)` | **P1** |
| Variant `ghost` | `bg-transparent hover:bg-accent/5` | `.bgh` : `transparent` · `hover: var(--sf2)` | P2 |
| Variant `danger` | `bg-accent` (même que primary !) | `.bdn` : `bg: var(--erb)` · `border: var(--er)/28%` · `color: var(--ert)` | **P1** |
| Border-radius | `rounded-md` (~8px) | `--rs: 6px` (btn standard) · `--rm: 12px` (blg) | P2 |
| Transition | `transition-colors` | `.12s var(--ez)` | P3 |

**Note critique P1** : variants `success/danger/warning/accent` utilisent tous `bg-accent` (gris) — violations sémantiques complètes.

---

## FICHIER 6 — `src/components/ui/input.tsx`

### 6.1 Correspondance composant dasti → `.field`
| Aspect | Valeur actuelle | Dasti cible | Priorité |
|---|---|---|---|
| Hauteur | `py-2` → ~40px via tailwind | `--hm: 40px` fixe ✓ approx. | P2 |
| Background | `bg-background` → `#ffffff` | `--sf1` (légèrement teinté lin) | **P1** |
| Border | `border-accent` | `var(--bm)` | P2 |
| Focus ring | `focus:ring-2 focus:ring-offset-2` | `3px solid var(--fr)` (ring dasti) | P2 |
| Radius | `rounded-md` (~8px) | `--rs: 6px` | P2 |

---

## FICHIER 7 — `src/components/ui/card.tsx`

### 7.1 Correspondance → `.sc` (section card dasti)
| Aspect | Valeur actuelle | Dasti cible | Priorité |
|---|---|---|---|
| Background | `bg-background` → blanc | `--sfr: hsl(40,20%,99%)` | **P1** |
| Border | `border border-accent` | `var(--bo)` (soft) | P2 |
| Radius | `rounded-lg` (~12px) | `--rm: 12px` ✓ | — |
| Shadow | `shadow-sm` | `var(--sha)` | P3 |

---

## FICHIER 8 — `src/components/ui/dialog.tsx`

### 8.1 Correspondance → `.dlg` / `.bdrop`
| Aspect | Valeur actuelle | Dasti cible | Priorité |
|---|---|---|---|
| Overlay | `bg-foreground/50 backdrop-blur-sm` | `hsla(30,12%,11%,.32)` · `blur(8px) saturate(1.2)` | P2 |
| Container bg | `bg-background` → blanc | `var(--sfr)` | **P1** |
| Border | `border-accent` | `var(--bm)` | P2 |
| Radius | `rounded-lg` (~12px) | `--rl: 18px` (modals) | P2 |
| Max-width | `max-w-md` (448px) | `680px` (spec dasti) | P2 |
| Shadow | `shadow-lg` | `var(--shc)` | P3 |

---

## FICHIER 9 — `src/components/Sidebar.tsx`

### 9.1 Correspondance → sidebar dasti (248px)
| Aspect | Valeur actuelle | Dasti cible | Priorité |
|---|---|---|---|
| Background | `bg-background` → blanc | `var(--sf1)` + `border-right var(--bo)` | **P1** |
| Item actif | `bg-accent text-background` | `var(--sfr)` bg · `var(--bo)` border · `var(--sha)` | **P1** |
| Item hover | `hover:bg-accent/10` | `hover: var(--sf2)` | P2 |
| Transition collapse | `duration-300` | `.22s var(--ez)` | P3 |

---

## FICHIER 10 — `src/components/CustomToggle.module.css`

### 10.1 Couleurs hardcodées — violations directes
| Ligne | Valeur actuelle | Remplacement dasti | Priorité |
|---|---|---|---|
| 14 | `text-gray-700` | `color: var(--tm2)` | **P1** |
| 17 | `hover:bg-gray-100` | `background: var(--sf2)` | **P1** |
| 27 | `text-white bg-gray-600` | `color: var(--op); background: var(--ac)` | **P1** |

---

## FICHIER 11 — `src/components/ProposalInputForm.module.css`

### 11.1 Couleurs hardcodées
| Ligne | Valeur actuelle | Remplacement dasti | Priorité |
|---|---|---|---|
| 26 | `text-red-500` | `color: var(--ert)` | **P1** |
| 10 | `background-color: rgba(191,191,191,0)` transparent | `var(--sf1)` | P2 |

---

## FICHIER 12 — `src/components/ProfileReviewCard.tsx`

### 12.1 Couleurs hardcodées critiques
| Ligne | Valeur actuelle | Remplacement dasti | Priorité |
|---|---|---|---|
| 376 | `bg-white border-neutral-200` | `bg: var(--sfr)` · `border: var(--bo)` | **P1** |
| 383 | `bg-neutral-50 dark:bg-neutral-900` | `bg: var(--sf1)` (light+dark via tokens) | **P1** |
| 391, 404 | `bg-neutral-100 hover:bg-neutral-200` | `bg: var(--sf2)` · `hover: var(--sf2)` | **P1** |
| 490 | `text-yellow-600` (saving status) | `color: var(--tm2)` ou token `--wa` | P2 |
| 492 | `text-green-600` (saved status) | `color: var(--ok)` | P2 |

---

## FICHIER 13 — `src/components/ConvexStatusBanner.tsx`

| Ligne | Valeur actuelle | Remplacement dasti | Priorité |
|---|---|---|---|
| 29 | `text-yellow-900 border-yellow-400 bg-yellow-50` | Tokens `--wa/--wab/--wat` à créer (hsl analogique ~36°, sat <26%) | P2 |

---

## FICHIER 14 — `src/components/LoadingSpinner.tsx`

| Ligne | Valeur actuelle | Remplacement dasti | Priorité |
|---|---|---|---|
| 8 | `text-gray-900 dark:text-background` | `color: var(--ti)` | P2 |

---

## FICHIER 15 — `src/components/AddSectionBottomSheet.tsx`

| Ligne | Valeur actuelle | Remplacement dasti | Priorité |
|---|---|---|---|
| 98 | `bg-black/40` (overlay) | `background: hsla(30,12%,11%,.32)` + backdrop-filter | P2 |

---

## FICHIER 16 — `src/components/dark-mode-toggle/DarkModeToggle.tsx`

| Ligne | Valeur actuelle | Remplacement dasti | Priorité |
|---|---|---|---|
| 44 | `hover:bg-surface dark:hover:bg-gray-700` | `hover: var(--sf2)` | **P1** |
| 48 | `text-gray-100` (icône lune) | `color: var(--ti)` | P2 |
| 50 | `text-gray-800` (icône soleil) | `color: var(--ti)` | P2 |

---

## RÉCAPITULATIF PAR PRIORITÉ

### P1 — Blocant (visible immédiatement, brise l'identité dasti)

1. **Palette entière** : remplacer le système monochrome `#ffffff/#050505/#343434` par les tokens warm dasti (`--bg/--sf1/--sf2/--sfr/--ti/--tm2/--tg2/--bo/--bm/--ac`)
2. **Typographie globale** : `Inter/Roboto/Arial` → `Source Sans 3` (shell) · `Fraunces` (display) · `Source Serif 4` (documents)
3. **Spacing** : ajouter `4px` et `12px` à la série, renommer `--s1`→`--s8`
4. **Hauteurs boutons** : `btn-height-base:24px` → `--hm:40px` · `btn-height-primary:~39px` → `--hb:44px`
5. **Fond sidebar** : `bg-background` → `var(--sf1)` + `border-right`
6. **Variant danger bouton** : identique au primary (gris) → `.bdn` dasti
7. **`#FF7F50` coral** dans `index.css` → supprimer immédiatement
8. **`neutral/gray` hardcodés** dans ProfileReviewCard, CustomToggle, DarkModeToggle

### P2 — Cohérence (visible au détail, dégrade l'identité)

9. **Nommage variables CSS** : `--background/foreground/primary/accent` → `--bg/ti/ac/sf*`
10. **Border-radius modals** : `rounded-lg:12px` → `--rl:18px`
11. **Sémantiques désaturées** : success `#059669` / danger `#ef4444` → hsl analogiques dasti (`--ok/--er` sat ≤26%)
12. **Max-width dialog** : `max-w-md:448px` → `680px`
13. **Overlay backdrop** : couleur et saturation backdrop-filter
14. **Topbar height** : `64px` → `54px` (`--hdr`)

### P3 — Nice-to-have (finition)

15. **Shadows** : `rgba(16,24,40,…)` → shadows chaudes dasti (`hsla(30,20%,8%,…)`)
16. **Transitions** : `duration-200/300` → `.12s/.22s var(--ez)` dasti
17. **Scrollbar** : couleurs hardcodées → `var(--tm2)/var(--ac)`
18. **Remirror list marker** : `#94a3b8` → `var(--tg2)`

---

**Fin de l'audit. Aucun fichier modifié.**
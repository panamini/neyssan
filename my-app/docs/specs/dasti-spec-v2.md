# DASTI — DESIGN SYSTEM SPEC v2
# Basé sur Neyssan v3 · Squelette HTML v16 · Mars 2026
# Source de vérité pour tout agent générant du code UI sur ce projet.

---

## AUDIT DE CONFORMITÉ NEYSSAN v3

### ✓ Respecté

| Spec Neyssan v3 | Statut | Note |
|---|---|---|
| Spacing série 4·8·12·16·24·32·40·64 | ✓ | Tokens --s1 à --s8 identiques |
| Typographic scale √2 depuis 12px | ✓ | --tx→--tx2 : 12·14·16·20·26·32 |
| Familles : Fraunces / Source Sans 3 / Source Serif 4 | ✓ | + IBM Plex Mono pour style Expert |
| Fraunces uniquement display/titres | ✓ | Jamais sur labels UI ou formulaires |
| Palette light Papier Lin hsl(38) | ✓ | Valeurs exactes Neyssan v3 §9 |
| Palette dark Graphite Kaki hsl(80,5%) | ✓ | Valeurs exactes Neyssan v3 §10 |
| Accent vert sauge H155 | ✓ | --ac light 22% · dark 28% sat |
| Radius série : rs=6 / rm=12 / rl=18 / rp=999 | ✓ | Niveaux respectés par composant |
| Hauteurs interactives : hs=32 / hm=40 / hb=44 | ✓ | Identiques §6 |
| Topbar h=54px sticky | ✓ | var(--hdr):54px |
| Sidebar fond surface-1 + border-right | ✓ | Solide, pas transparent |
| Nav item actif : surface-raised + border-soft + shadow-sm | ✓ | .sb-item.on |
| Bouton primary : accent-solid bg · brightness hover | ✓ | .bp |
| Bouton secondary : surface-raised + border-mid | ✓ | .bsec |
| Bouton ghost : transparent · surface-2 hover | ✓ | .bgh |
| Input h=40px · radius-sm · focus-ring 3px | ✓ | .field |
| Card : surface-raised · border-soft · radius-md · shadow-sm | ✓ | .sc, .cpn, .opn |
| Modal : radius-lg · shadow-lg · backdrop blur | ✓ | .dlg |
| Transitions 120ms cubic-bezier(.25,.1,.25,1) | ✓ | --ez partout |
| Sémantiques désaturées (ok/wa/er) | ✓ | Saturation 20-26%, analogiques |
| Un seul CTA primaire par zone de décision | ✓ | Règle appliquée dans tous les panels |
| App mode vs Document mode distincts | ✓ | Document = white paper in dark frame |
| Source Serif 4 dans les surfaces document | ✓ | .d-sig, .let-sig, .p-body |
| Grille φ = 1.618 sur layouts split | ✓ | Compose: 1fr / 1.618fr |

### △ Divergences intentionnelles (justifiées)

| Point | Neyssan v3 | Dasti v1 | Justification |
|---|---|---|---|
| Sidebar width | 272px | 248px | Interface plus compacte, densité accrue |
| IBM Plex Mono | Non prévu | Ajouté pour style Expert | Cohérent avec §11 mono stack |
| Sémantiques dark | sat 28-52% | sat 20-26% max | Correction Itten — fond kaki annule les saturés |
| 5 palettes interchangeables | Non prévu | Sauge/Ocre/Pierre/Bordeaux/Encre | Extension naturelle de §9-10 |
| 3 styles typographiques | Non prévu | Signature/Engaging/Expert | Feature métier justifiée |

### ✗ Points à régler en migration React

| Point | Statut | Note |
|---|---|---|
| Frosted glass topbar | ✗ Non fonctionnel en HTML | Contrainte layout flex — voir §NOTES |
| Responsive mobile (<768px) | ✗ Non implémenté | Sidebar collapsed uniquement |
| Typo style × layout template croisés | ✗ Partiel | engaging/expert ignorent 2col/editorial |

---

## 0. IDENTITÉ & DIRECTION ARTISTIQUE

Produit : outil éditorial premium pour la rédaction de CVs et lettres de motivation.
Nom : **dasti**

Ton visuel : minimalisme suisse contemporain. Sobre, éditorial, calme.
Références : Müller-Brockmann (grille) · Tschichold (typo) · Itten (couleur) · Frutiger (optique)

L'identité vient de : la typographie · l'espace · la structure · les proportions.

PAS de : cyan · néon · glassmorphism · gradients décoratifs · esthétique console IA
         · palette SaaS générique · Inter/Roboto/Arial.

---

## 1. SPACING — série canonique

4 · 8 · 12 · 16 · 24 · 32 · 40 · 64 · 80

```css
--s1:4px  --s2:8px  --s3:12px  --s4:16px
--s5:24px --s6:32px --s7:40px  --s8:64px
```

---

## 2. TYPE SCALE — √2 depuis 12px

12 · 14 · 16 · 20 · 26 · 32

```css
--tx:12px  --ts:14px  --tb:16px
--tm:20px  --tl:26px  --tx2:32px
```

Line-heights : 12→16 · 14→20 · 16→24 · 20→30 · 26→36 · 32→40
```css
--lx:16px  --ls:20px  --lb:24px
--ll:30px         (non utilisé directement)
--lx2:40px
```

Letter-spacing optique :
- Labels caps : +0.14em
- Petit corps 12-14px : +0.04em
- Corps 16-20px : 0
- Grand corps 26-32px : -0.01em
- 42px+ : -0.02em (plafond Fraunces)

---

## 3. RADIUS

```css
--rx:4px   /* décoratif, coins fins */
--rs:6px   /* boutons, inputs, chips */
--rm:12px  /* cards, panels, section cards */
--rl:18px  /* modals, grands panels */
--rp:999px /* badges, pills, dots, avatar */
```

Règle : ne jamais mélanger les niveaux (pas de rl sur un bouton).

---

## 4. HAUTEURS INTERACTIVES

```css
--hs:32px  /* contrôles secondaires, icon buttons, chips */
--hm:40px  /* inputs, selects, boutons standards */
--hb:44px  /* CTA principaux (WCAG 2.5.5) */
--hdr:54px /* topbar */
```

---

## 5. RATIOS DIRECTEURS

- φ = 1.618 → splits de layout, hiérarchie de zones
- √2 = 1.414 → aspect-ratio des cards

Usages dans dasti :
```css
/* Compose / Library : formulaire / output */
grid-template-columns: minmax(320px,1fr) minmax(0,1.618fr)

/* Style page : contrôles / preview */
grid-template-columns: 260px 1fr

/* Plib fallback */
grid-template-columns: 260px 1fr
```

---

## 6. PALETTES CHROMATIQUES

### Mode Light — "Papier Lin"
```css
--bg:  hsl(38,16%,95%)   /* fond principal */
--sf1: hsl(38,12%,93%)   /* sidebar (légèrement plus foncé que bg) */
--sf2: hsl(36,14%,88%)   /* hover, pressed, recessed */
--sfr: hsl(40,20%,99%)   /* surface raised — cartes, panels */
--ti:  hsl(30,12%,11%)   /* texte principal */
--tm2: hsl(30,8%,42%)    /* texte secondaire */
--tg2: hsl(30,6%,62%)    /* texte ghost, placeholders */
--bo:  hsla(30,12%,11%,.08)
--bm:  hsla(30,12%,11%,.13)
```

### Mode Dark — "Graphite Kaki Tellurique"
```css
--bg:  hsl(80,5%,7%)     /* fond principal — kaki, jamais noir pur */
--sf1: hsl(80,5%,11%)    /* sidebar */
--sf2: hsl(78,5%,16%)
--sfr: hsl(75,5%,19%)
--ti:  hsl(46,12%,86%)   /* ivoire chaud */
--tm2: hsl(44,8%,60%)
--tg2: hsl(42,6%,38%)
--bo:  hsla(46,12%,86%,.08)
--bm:  hsla(46,12%,86%,.13)
```

### Sémantiques (même principe light et dark)
Désaturées — analogiques avec l'accent sauge. Saturation max 22-26% en dark.
```css
/* Light */
--ok:hsl(152,20%,28%)  --okb:hsl(152,16%,92%)  --okt:hsl(152,20%,22%)
--er:hsl(4,26%,34%)    --erb:hsl(4,22%,92%)    --ert:hsl(4,26%,28%)

/* Dark */
--ok:hsl(152,22%,56%)  --okb:hsl(152,13%,13%)  --okt:hsl(152,22%,70%)
--er:hsl(4,24%,56%)    --erb:hsl(4,15%,13%)    --ert:hsl(4,24%,70%)
```

### Palettes accent interchangeables
5 harmonies conformes Itten — surchargeables via classe sur `<body>` :

| Palette | Classe | Accent HSL |
|---|---|---|
| Sauge (défaut) | `.pal-sauge` | hsl(155,22%,30%) light · hsl(155,28%,62%) dark |
| Ocre | `.pal-ocre` | hsl(34,38%,32%) light · hsl(36,32%,64%) dark |
| Pierre | `.pal-pierre` | hsl(220,14%,30%) light · hsl(220,18%,62%) dark |
| Bordeaux | `.pal-bordeaux` | hsl(348,22%,30%) light · hsl(348,26%,60%) dark |
| Encre | `.pal-encre` | hsl(200,18%,24%) light · hsl(200,20%,60%) dark |

Chaque palette définit 6 tokens : `--ac --am --ap --as --fr --op`

---

## 6bis. HIÉRARCHIE DES GRANDES SURFACES

Sur les écrans riches (`Compose`, `Saved`, `Library`, `Style`), garder **3 grandes surfaces neutres maximum visibles à l’écran** :

1. `--bg`
   - canvas global / fond de page
2. `--sfr`
   - panel shell / carte principale / surface raised
3. `--sf1`
   - well documentaire / zone d’écriture / surface de lecture

`--sf2` ne doit pas être utilisé comme grande surface de repos.
Il sert uniquement à :
- hover
- pressed
- chips
- focus local
- emphase douce
- bande de shimmer / skeleton

### Règle optique

Les grandes masses doivent toujours se lire immédiatement comme :

- canvas
- panel
- document

Pas comme une pile de gris quasi identiques.

### Application recommandée

- `Proposal Forge`
  - page = `--bg`
  - panneaux `Job Offer` / `Draft` = `--sfr`
  - `Job Title`, compose well, generated draft, saved editable draft = `--sf1`
- `Cv Forge`
  - page = `--bg`
  - sections/cards = `--sfr`
  - puits internes documentaires = `--sf1` seulement si une vraie hiérarchie de lecture est nécessaire
- `Style`
  - page = `--bg`
  - section cards = `--sfr`
  - previews internes = `--sf1` si la profondeur documentaire doit être marquée

### Pourquoi

Au-delà de 3 grandes valeurs neutres simultanées, la charge cognitive augmente et la hiérarchie visuelle devient floue, surtout en dark mode.

---

## 7. TYPOGRAPHIE — familles & usage

### Source Sans 3
Shell applicatif : navigation, labels, boutons, formulaires.
- Weight : 500-600 labels/contrôles · 400 texte courant · 300 leads
- Minimum UI : 14px

### Fraunces (serif opsz variable, ital)
Display et titres seulement : H1, titres de panel, noms de document, KPI.
- Weight : 600 roman · 400 italic
- Letter-spacing : -0.01em à 26px · -0.02em à 42px+
- Jamais dans les formulaires, jamais pour les labels UI

### Source Serif 4 (serif opsz)
Surfaces document uniquement : corps de lettre, preview CV, textarea proposalcontent.
- 14-15px pour le corps de document
- 17px pour les aperçus A4

### IBM Plex Mono
Style typographique Expert uniquement — headers de section monospace dans les previews CV.
- Weight : 300-500

### Eyebrows / sous-titres accentés

Les labels caps accentés (`JOB OFFER`, `DRAFT`, etc.) sont des **repères d’orientation**, pas une dépendance fonctionnelle.

Ils sont utiles quand :
- plusieurs panneaux coexistent
- l’écran est split en zones sœurs
- il faut réaffirmer rapidement la nature d’un panneau

Ils deviennent optionnels si :
- la navigation situe déjà clairement l’utilisateur
- le placeholder ou le contenu expliquent déjà l’action
- leur répétition crée plus de bruit que de clarté

Règle :
- petits
- sobres
- rares
- jamais seuls pour expliquer le fonctionnement

---

## 8. STYLES TYPOGRAPHIQUES DOCUMENT (feature dasti)

Trois styles applicables aux aperçus CV et lettres :

### Signature (défaut)
- Titres : Source Sans 3 semibold, caps, accent color
- Corps : Source Serif 4 regular
- Caractère : sobre, professionnel, lisible
- Classe document : `.d-sig` / `.let-sig`

### Engaging
- Titres : Fraunces semibold (roman)
- Corps : Fraunces light 300
- Caractère : chaleureux, littéraire, vivant
- Classe document : `.d-eng` / `.let-eng`

### Expert
- Titres : IBM Plex Mono medium, caps, border-left accent
- Corps : IBM Plex Mono light 300
- Caractère : factuel, monospace, technique
- Classe document : `.d-exp` / `.let-exp`

---

## 9. OMBRES

```css
--sha: 0 1px 2px hsla(30,20%,8%,.05), 0 3px 10px hsla(30,20%,8%,.04)
--shb: 0 4px 14px hsla(30,20%,8%,.07), 0 10px 28px hsla(30,20%,8%,.05)
--shc: 0 8px 24px hsla(30,20%,8%,.09), 0 20px 48px hsla(30,20%,8%,.07)

/* Dark */
--sha: 0 1px 3px hsla(0,0%,0%,.28), 0 4px 12px hsla(0,0%,0%,.22)
--shb: 0 4px 16px hsla(0,0%,0%,.36), 0 12px 30px hsla(0,0%,0%,.28)
--shc: 0 8px 28px hsla(0,0%,0%,.44), 0 24px 52px hsla(0,0%,0%,.34)
```

---

## 10. TRANSITIONS

```css
--ez:  cubic-bezier(.25,.1,.25,1)   /* standard */
--ezb: cubic-bezier(.34,1.56,.64,1) /* bounce léger pour dots/scale */

/* Durées */
.12s  /* interactions rapides : hover, focus, color */
.15s  /* bouton generate state */
.2s   /* thème, background */
.22s  /* sidebar collapse */
```

---

## 11. COMPOSANTS — classes et comportements

### Buttons

```css
.btn      /* base : inline-flex, border:1px, radius:rs, ts/fw500 */
.bsm      /* h:32px px:12px */
.bmd      /* h:40px px:16px */
.blg      /* h:44px px:24px radius:rm */
.bp       /* primary : bg accent · color on-primary · sha · brightness hover */
.bsec     /* secondary : bg sfr · border bm · sha */
.bgh      /* ghost : transparent · tm2 · sf2 hover */
.bdn      /* danger : bg erb · border er/28% · ert color · er hover */
```

Règle : un seul `.bp` par zone de décision.

### Icon Button

```css
.ib       /* 32×32 · rs · ghost · tm2 → ti hover + sf2 bg */
```

### Generate/Stop Button

```css
.gbtn     /* 32×32 · rp · ac bg · op color */
.gbtn.loading  /* bg sf2 · icône stop → ti color */
.gi-send  /* display:block au repos */
.gi-stop  /* display:none au repos · block en loading */
```

### Copy Button avec feedback

```css
.cbtn         /* overflow:hidden position:relative */
.cbtn-def     /* état normal */
.cbtn-ok      /* état copied — opacity:0→1 · color ok */
.cbtn.copied  /* trigger le swap */
```

### Chip dropdown (compose bar)

```css
.ichip    /* 26×26 · rs · ghost · on hover : border ac · as bg */
```

Dropdowns : `position:fixed` portal en bas du `<body>`. Positionnement calculé via `getBoundingClientRect()` au clic, ouverts vers le haut (`bottom: window.innerHeight - pillTop`).

### Inputs / Fields

```css
.field    /* w:100% h:40px · rs · sf1 bg · bm border · ts */
          /* focus: ac border + fr ring 3px */
select    /* idem */
```

### Section Card (app mode)

```css
.sc       /* rm · bo border · sfr bg · sha · overflow:hidden */
.sch      /* sf2 bg · bo border-bottom · flex space-between */
.sct      /* Fraunces tl · fw600 · -0.01em */
.scb      /* padding s5 */
```

### Compose Input Well

```css
.siw      /* rm · bm border · sf1 bg · position:relative */
          /* focus-within: ac border + fr ring */
.sta      /* min-h:200px max-h:360px · padding-bottom s7 (espace cbar) */
.cbar     /* flex nowrap · sf1 bg · bo border-top */
```

### Skill Dots (3 niveaux)

```css
.ldots    /* flex gap:5px */
.ld       /* 10×10 · rp · bm border · ezb transition */
          /* hover: am border + scale(1.2) */
          /* on: ac bg + ac border */
.llabel   /* 10px · tg2 · ml:s2 · min-w:66px */
```

3 niveaux uniquement : Beginner / Intermediate / Expert.

### Sidebar Document Item

```css
.sb-doc          /* flex-column · pl:32px · rs · position:relative */
.sb-doc.on       /* sfr bg · pl:30px · border-left 2px ac */
.sb-doc-t        /* ts · fw500 · ti · text-overflow:ellipsis max-w:160px */
.sb-doc-m        /* 10px · tg2 · flex gap:4px */
.sb-doc-type     /* tm2 · fw500 (dans .sb-doc-m) */
.sb-doc-del      /* position:absolute right:4px · 20×20 */
                 /* opacity:0 → 1 au hover du parent */
                 /* hover: ert + erb bg */
```

### Palette Colors picker

```css
.palgrid         /* flex-column · align-center · gap:s3 */
.palrow          /* flex · gap:s3 · justify-center */
.palcard         /* 20×20 · rp · cursor:pointer */
                 /* hover: scale(1.18) */
                 /* on: ring 2px sfr + 4px ac */
.palname-display /* tx · fw500 · tm2 · text-center · uppercase */
                 /* Affiché au-dessus des dots */
                 /* Mis à jour par selPal() via data-name */
```

Layout pyramide inversée : 3 dots ligne 1 (Sauge, Ocre, Pierre) · 2 dots ligne 2 (Bordeaux, Encre).

### Modal / Dialog

```css
.bdrop  /* fixed inset:0 · z:800 · hsla(30,12%,11%,.32) */
        /* backdrop-filter:blur(8px) saturate(1.2) — FONCTIONNE ici (fixed over body) */
.dlg    /* max-w:680px · sfr bg · bm border · rl radius · shc */
.dlh    /* sticky top:0 · sfr bg · z:1 */
.dlt    /* Fraunces tx2 · fw600 */
.dlb    /* padding s5/s6 · flex-column gap s5 */
.dlf    /* sticky bottom:0 · flex space-between */
.dzone  /* sf1 bg · bo border · rm · flex-column gap s4 */
        /* Zone visuellement distincte dans un modal */
```

### Style page layout

```css
.stypg  /* grid 260px 1fr · gap s7 */
.sty-l  /* flex-column · gap s5 */
.tcard  /* flex items-center · rm · 2px border bo */
        /* hover: am border + shb */
        /* on: ac border + as/sfr bg + 3px ring as */
.tchk   /* 18×18 rp · bm border */
        /* on: ac bg + ac border · checkmark svg blanc */
```

---

## 12. NAVIGATION — structure sidebar

Sidebar unifiée 248px · collapse à 52px (icônes seules).

Structure verticale :
```
[Brand wordmark "dasti" Fraunces]    [← toggle button]
─────────────────────────────────
RESUME (section label)
  ▸ Resume (nav item)
    · Board Ramanathapuram    (sb-doc)
    · Marion Bonnet — Design  (sb-doc)
  + New resume

WRITE (section label)
  ▸ Compose (nav item)
    · Junior RUST... · 18/03 Letter  (sb-doc)
  + New letter

SETTINGS (section label)
  ▸ Style (nav item)
─────────────────────────────────
[Avatar P] [User name]         [🌙]
```

Toggle collapse : `‹` / `›` · transition width `.22s`.
Éléments masqués en collapsed : section labels, captions, doc-items (max-height:0).
Icônes restantes : alignées au centre (justify-content:center sur .sb-item).

Theme toggle : footer sidebar bas gauche, avec profil user.

---

## 13. PAGES — structure

### Resume
- Intro panel (eyebrow + H2 Fraunces + description)
- Strip add section + upload
- CV title (Fraunces éditable)
- Section cards : Profile · Experience · Skills
- Skills : input texte + 3 dots niveau + label

### Write (Proposal Forge)
Toggle `Compose | Open` (underline tab style, pas de fond coloré).

**Compose view** :
- Panel gauche `minmax(320px,1fr)` : titre H2 Fraunces, Job Title field, compose well
- Compose well : textarea min-h:200px + cbar avec ichips + gbtn
- Panel droit `1.618fr` : output avec Copy button en header

**Open view** (Library) :
- Même grille que Compose
- Gauche : Document panel (titre éditable Fraunces, meta date+type, auto-saved)
- Droite : Content panel (eyebrow CONTENT + Copy/Regenerate/Delete icônes en header + textarea)

### Style
- Section Mise en page : 3 tcard (Swiss Minima / Two Column / Editorial)
- Section Style typographique : 3 tcard (Signature / Engaging / Expert) — libellés en leur propre fonte
- Section Colors : palette pyramide dots + nom dynamique
- Preview CV live (docframe + docpaper)
- Preview lettre live

---

## 14. DOCUMENT PREVIEW — modes de rendu

### docframe / docpaper
```css
.docframe  /* rm border · bg hsl(38,8%,78%) light / hsl(80,5%,12%) dark */
           /* Cadre warm qui contextualise le document blanc */
.docpaper  /* bg white · rs · shb · border hsla(0,0%,0%,.06) */
```

Document blanc = simulation papier. Cohérent en dark grâce au docframe sombre.

### Rendu piloté par renderDoc(ts, tpl, ac)
- `ts` (type style) : `'signature'` | `'engaging'` | `'expert'`
- `tpl` (template layout) : `'swiss'` | `'2col'` | `'editorial'`
- `ac` (accent color) : `getComputedStyle(body).getPropertyValue('--ac')`

Tous les headers de section reçoivent `color:${ac}` · le layout 2col/editorial reçoit `background:${ac}` sur la sidebar/header.

---

## 15. NOMENCLATURE — variables CSS (dasti v1)

| Token dasti v1 | Équivalent Neyssan v3 |
|---|---|
| `--bg` | `--canvas` |
| `--sf1` | `--surface-1` |
| `--sf2` | `--surface-2` |
| `--sfr` | `--surface-raised` |
| `--ti` | `--text-strong` |
| `--tm2` | `--text-muted` |
| `--tg2` | `--text-ghost` |
| `--bo` | `--border-soft` |
| `--bm` | `--border-mid` |
| `--ac` | `--accent-solid` |
| `--am` | `--accent-mid` |
| `--ap` | `--accent-pale` |
| `--as` | `--accent-soft` |
| `--fr` | `--focus-ring` |
| `--op` | `--on-primary` |
| `--sha/shb/shc` | `--shadow-sm/md/lg` |
| `--s1…s8` | `--space-1…space-8` |
| `--tx…tx2` | `--text-xs…text-xl` |
| `--rs/rm/rl/rp` | `--radius-sm/md/lg/pill` |
| `--hs/hm/hb` | `--height-sm/md/lg` |
| `--ez/ezb` | `--ease / --ease-bounce` |

---

## 16. RÈGLES DO / DON'T — dasti v1

**DO :**
- Utiliser exclusivement les tokens de ce fichier
- Un seul `.bp` (bouton primaire) par zone de décision
- Accent sauge avec parcimonie : CTA, focus, états actifs, palette doc
- Fraunces uniquement pour les titres et displays, jamais les labels UI
- Document mode : white paper dans un docframe sombre/warm
- Delete : ghost au repos, danger uniquement au hover
- Confirmations destructives compactes : entrée en suppression neutre, puis duo `V / X` séparé ; `V` peut porter `--erb/--ert` au repos et monter en `--er/--op` au hover, `X` reste neutre actif (`--sf2`/`--ti`)
- Dropdown type/tone : portals `position:fixed` en bas du `<body>`
- Palette : changer via classe `body.pal-*` (pas via style inline)

**DON'T :**
- Inventer des valeurs de spacing hors série
- Blanc pur (#fff) ou noir pur (#000) comme fond global
- Cyan, bleu générique, gradients décoratifs
- Mélanger les niveaux de radius (pas de rl sur un bouton)
- Plusieurs boutons primaires dans la même zone
- Texte rouge visible au repos (Delete toujours ghost by default)
- Saturation >26% sur les sémantiques dark (contraste simultané Itten)
- Badge sb-doc avec fond coloré (doit rester ghost pour ne pas capter l'œil)
- La description du ton affichée en permanence (pdesc-live = hidden)

---

## 17. NOTES D'IMPLÉMENTATION — migration React

### [A] Frosted glass topbar
`backdrop-filter` sur `.top` ne fonctionne pas en HTML flex car `.top` et `.pscroll`
sont siblings dans le même contexte : `.top` ne voit pas ce qui scroll dans `.pscroll`.

**Solution React :**
```jsx
<div className="page-area" style={{position:'relative'}}>
  <div className="top" style={{
    position:'absolute', top:0, left:0, right:0, zIndex:5,
    backdropFilter:'blur(16px) saturate(1.2)',
    background:'color-mix(in srgb, var(--bg) 78%, transparent)'
  }}/>
  <div className="pscroll" style={{
    position:'absolute', inset:0,
    overflowY:'auto', paddingTop:'var(--hdr)'
  }}>
    {/* page content */}
  </div>
</div>
```

Les modals (`.bdrop` en `position:fixed`) fonctionnent déjà avec backdrop-filter
car ils sont au-dessus de tout le contenu body.

### [B] Styles typographiques × layouts croisés
Actuellement `renderDoc()` : si `ts='engaging'` → template Fraunces fixe,
ignore `tpl='2col'`/`'editorial'`.

**Solution React :** `renderDoc` comme composant pur :
```jsx
// ts et tpl sont deux axes orthogonaux
<DocumentLayout tpl={tpl} ac={ac}>
  <DocumentContent ts={ts} data={cvData} />
</DocumentLayout>
```

`DocumentLayout` gère la mise en page (colonnes, header accent).
`DocumentContent` gère la typographie (classes d-sig / d-eng / d-exp).
L'accent `ac` est injecté via `style={{'--local-ac': ac}}` sur le wrapper.

### [C] Drag-and-drop skills
Différé. Utiliser `@dnd-kit/sortable` pour réordonner les skills.
Pas de bouton "Sort" statique — fausse promesse UX.

---

## 18. COMMENT UTILISER CE FICHIER

### Option A — Squelette HTML comme référence
Donner `dasti-v16.html` directement à l'agent.
Le squelette contient tous les tokens, classes, patterns et comportements JS.
L'agent peut adapter un site existant en important les classes CSS du fichier.

### Option B — Spec seule (ce fichier)
Suffisant pour un agent capable de générer du CSS à partir d'une spec.
La spec est complète : tokens, composants, pages, patterns, nomenclature.
Utile si le site cible utilise déjà Tailwind ou un autre système CSS.

### Option C — Les deux (recommandé)
Spec = intention + règles. Squelette = implémentation de référence.
Ensemble ils réduisent l'ambiguïté à zéro pour la migration React.

---
# Version : dasti v1 · Mars 2026
# Basé sur Neyssan design system v3

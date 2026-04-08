
# TwoWeeks locked design system

## Real implementation spec v1

This is the version I would actually lock and build.

---

# 1. Brand lock

## Positioning

**TwoWeeks turns rough input into polished, client-ready documents fast.**

## Core line

**One click. Two weeks. Done.**

## Product personality

TwoWeeks must feel:

* calm
* precise
* premium
* efficient
* editorial
* modern
* trustworthy
* quiet, not dull

Not:

* playful startup
* AI toy
* loud futurism
* fake luxury
* recruiter cliché
* generic template marketplace

---

# 2. Typography lock

## Final font system

### Primary UI / product / landing

**Geist**

Why locked:

* serious
* modern
* system-friendly
* crisp at small sizes
* less generic than Urbanist/Jost for this product
* fits the “tool” side of your brand

### Accent editorial serif

 **Fraunces**

Use only for:

* campaign/editorial sections
* premium feature titles
* special template families
* selected proposal/export variants

Do not use for core UI.

## Font fallback stacks

```css
--font-ui: "Geist", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-serif: "Newsreader", "Iowan Old Style", "Palatino Linotype", Georgia, serif;
```

## Type scale

```css
--text-display-xl: 80px;
--text-display-l: 64px;
--text-display-m: 48px;
--text-h1: 32px;
--text-h2: 24px;
--text-h3: 20px;
--text-body-l: 18px;
--text-body-m: 16px;
--text-body-s: 14px;
--text-label-m: 13px;
--text-label-s: 11px;
```

## Line-height scale

```css
--leading-display: 0.95;
--leading-heading: 1.1;
--leading-body: 1.55;
--leading-label: 1.2;
```

## Font weights

Lock them. Do not improvise.

```css
--weight-regular: 450;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;
```

## Usage rules

* Hero headlines: Geist Bold
* UI labels: Geist Semibold
* Body copy: Geist Regular
* Fine metadata: Geist Medium with light tracking
* Editorial accent: Newsreader only in sparse, intentional places

---

# 3. Color system lock

## Core neutrals

### Light mode neutrals

```css
--paper-0: #F7F6F2;
--paper-1: #F3F1EC;
--paper-2: #ECE8E1;
--paper-3: #E3DED6;

--ink-0: #12161C;
--ink-1: #1C222B;
--ink-2: #39424F;
--ink-3: #5C6674;

--line-light: rgba(18,22,28,0.08);
--line-default: rgba(18,22,28,0.12);
--line-strong: rgba(18,22,28,0.18);
```

### Dark mode neutrals

```css
--night-0: #05080D;
--night-1: #0A1018;
--night-2: #101823;
--night-3: #1A2431;

--fog-0: #E8EDF2;
--fog-1: #C9D3DC;
--fog-2: #98A7B7;
--fog-3: #6F8093;

--line-dark: rgba(255,255,255,0.08);
--line-dark-strong: rgba(255,255,255,0.14);
```

## Semantic tones

```css
--success: #3E7A63;
--warning: #A37A2C;
--danger:  #8B4A4A;
--info:    #4E6C90;
```

No neon. No bright SaaS green.

---

# 4. Gradient system lock

This is the important part.

## Final decision

You will not build “many equal gradients.”

You will build **one gradient language** with a few named shells.

The language is:

**cool depth at the top → misted middle → paper warmth at the base**

That is the TwoWeeks signature.

---

## 4.1 Primary light shell

### Name

**Aoba Kasumi**

This is the one from your latest favorite direction.

### Role

* default landing light shell
* default light marketing atmosphere
* premium but approachable
* can appear in light editor chrome only if subtle

### CSS

```css
--gradient-aoba-kasumi:
linear-gradient(
  180deg,
  #CFE3E1 0%,
  #D9E7E5 24%,
  #E6ECEA 52%,
  #E8E8EE 74%,
  #EFDCD6 100%
);
```

### Brutal truth adjustment

Your current version should be **5–8% less mint** and **5–10% more neutralized** than the screenshot.

It should feel:

* mist
* paper
* soft air

Not:

* spa
* toothpaste
* skincare gel

---

## 4.2 Primary dark shell

### Name

**Konjō**

### Role

* default dark mode shell
* main dark landing shell
* dark editor chrome
* premium / serious / trust-heavy mode

### CSS

```css
--gradient-konjo:
linear-gradient(
  180deg,
  #020913 0%,
  #071A31 20%,
  #163659 46%,
  #6E859D 76%,
  #E7D2CB 100%
);
```

### Notes

This should not become cyber blue.
Keep it deep, mature, almost architectural.

---

## 4.3 Secondary light shell

### Name

**Pale Wisteria**

### Role

* alternative light mode
* softer campaign mode
* proposal-oriented marketing variation
* limited use

### CSS

```css
--gradient-pale-wisteria:
linear-gradient(
  180deg,
  #CDE5E8 0%,
  #DDE7EF 36%,
  #E6E0EC 68%,
  #E9D7E6 100%
);
```

This is good, but it is not the main brand shell.

---

## 4.4 Dual-mode premium shell

### Name

**Quiet Material**

### Role

* featured premium theme
* upgrade screen
* hero experiments
* brand campaigns
* not default product mode

### CSS

```css
--gradient-quiet-material-light:
linear-gradient(
  180deg,
  #D8E3E8 0%,
  #D4DEE5 34%,
  #D8D8DE 68%,
  #ECD8D1 100%
);

--gradient-quiet-material-dark:
linear-gradient(
  180deg,
  #07111A 0%,
  #14314C 24%,
  #3F5870 58%,
  #93A1B0 82%,
  #E8D7D0 100%
);
```

---

## 4.5 One rule that must never break

**Gradients are shell backgrounds, not reading surfaces.**

Meaning:

* yes on page canvas
* yes on framing panels
* yes on side chrome
* yes on ambient sections

But:

* no behind long text
* no inside dense forms
* no under export body copy
* no behind complex editing content

---

# 5. Surface model lock

This is what makes the system mature.

## Shell vs surface

### Shell

Atmosphere layer. Can use gradient.

### Surface

Where work happens. Must be neutral.

That means inside a gradient shell, your cards should sit on:

### Light surfaces

```css
--surface-1: rgba(255,255,255,0.62);
--surface-2: rgba(250,248,244,0.78);
--surface-3: rgba(245,242,236,0.92);
```

### Dark surfaces

```css
--surface-dark-1: rgba(14,20,28,0.58);
--surface-dark-2: rgba(18,25,35,0.74);
--surface-dark-3: rgba(23,31,42,0.88);
```

### Glass rule

Use blur sparingly:

```css
backdrop-filter: blur(18px) saturate(120%);
```

Never more than this for production UI.

---

# 6. Spacing system lock

4px base. No exceptions.

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
--space-32: 128px;
```

## Use

* micro gaps: 8
* control padding: 12–16
* card padding: 20 or 24
* section gaps: 32
* major vertical spacing: 64 / 96 / 128

---

# 7. Radius system lock

```css
--radius-xs: 8px;
--radius-sm: 12px;
--radius-md: 16px;
--radius-lg: 20px;
--radius-xl: 24px;
--radius-2xl: 28px;
--radius-hero: 32px;
--radius-pill: 999px;
```

## Rules

* chips / pills: full
* controls: 14–16
* standard cards: 24
* hero frames: 32
* modal sheets: 28

Do not mix sharp and soft randomly.

---

# 8. Border and shadow system lock

## Borders first

This system should rely more on borders than giant shadows.

```css
--border-subtle: 1px solid rgba(18,22,28,0.08);
--border-default: 1px solid rgba(18,22,28,0.12);
--border-strong: 1px solid rgba(18,22,28,0.18);

--border-dark-subtle: 1px solid rgba(255,255,255,0.08);
--border-dark-default: 1px solid rgba(255,255,255,0.12);
--border-dark-strong: 1px solid rgba(255,255,255,0.18);
```

## Shadows

```css
--shadow-xs: 0 1px 2px rgba(16,24,40,0.04);
--shadow-sm: 0 8px 24px rgba(16,24,40,0.06);
--shadow-md: 0 18px 48px rgba(16,24,40,0.10);
--shadow-lg: 0 28px 80px rgba(16,24,40,0.14);
```

## Glow for shell only

```css
--glow-shell-light: 0 0 80px rgba(197,221,223,0.30);
--glow-shell-dark: 0 0 120px rgba(40,86,130,0.20);
```

No glowing buttons.

---

# 9. Button system lock

## Primary button

### Shape

* pill
* 44px min height desktop
* 42px min mobile

### Light theme

```css
background: #0E7C63;
color: #F8F7F4;
box-shadow: 0 8px 24px rgba(14,124,99,0.18);
```

### Dark theme

```css
background: #355E97;
color: #F8F7F4;
box-shadow: 0 8px 24px rgba(53,94,151,0.24);
```

You should not use 7 different primary button colors per gradient.

Lock the CTA family.

## Secondary button

* neutral surface
* thin border
* dark text
* no heavy shadow

## Tertiary button

* text or ghost
* subtle hover fill

---

# 10. Landing page spec lock

## Layout

12-col desktop grid.

### Hero

* max width container: 1440
* inner width content: 1280
* gap between left/right panels: 24
* left panel 7 cols
* right panel 5 cols

### Hero structure

Left panel:

* eyebrow
* headline
* supporting paragraph
* two CTAs
* three proof columns
* optional logo block

Right panel:

* live preview panel
* mode toggle
* fix list
* proof block
* CTA microstate

## Hero rules

* headline max 3 lines
* body max 4 lines before CTA
* first screen must explain:

  * what it does
  * for whom
  * what pain it removes
  * what output looks like

## Page sections after hero

1. two generators
2. how it works
3. product proof
4. output gallery
5. why quality matters
6. pricing
7. faq
8. final CTA

---

# 11. Editor spec lock

This is now locked:

## Core editor structure

**left: structured model**
**right: live preview**

That is the correct long-term architecture.

Not ResumeLab-style final-page popup editing as the primary system.

## Why

Because your system is stronger for:

* repeated use
* speed after onboarding
* universality across templates
* proposal + resume shared structure
* AI insertion points
* professional editing behavior

## Editor layout

### Desktop

* left nav: 240
* content/editor pane: 420–520
* preview pane: 480–640
* gutters: 24

### Tablet

* switchable stack
* persistent preview mini-toggle

### Mobile

* structured editing first
* preview as sheet or full tab

## Editor modes

Lock to 4:

* Structure
* Polish
* Theme
* Export

No more.

## Section model

Each section card must support:

* label
* status
* edit
* AI assist
* collapse
* reorder where appropriate

## AI entry points

Lock these:

* section-level action
* text-selection toolbar
* import correction assist
* rewrite modal with max 3 outputs
* quick fixes: shorten / clarify / formalize / warmer / stronger

No 10-output AI dump.

---

# 12. Resume / proposal export benchmark lock

## Resume exports

Two families only:

### ATS family

* plain background
* strong hierarchy
* no decorative sidebars unless ATS-safe
* parsing first
* simpler grids

### Premium family

* better typography
* better rhythm
* better section spacing
* still printable and professional

## Proposal exports

This is your differentiation.

Proposal must support:

* cover/meta header
* role/job source summary
* tone cue tags
* core argument structure
* CTA clarity
* subject line logic if email mode
* premium surface options

But never:

* noisy
* over-designed
* brochure-like
* template-shop energy

---

# 13. Auto-changing gradient feature decision

## Final decision

**Do not ship automatic hour-based gradient switching in v1.**

## Why

Because it adds:

* engineering complexity
* QA complexity
* screenshot inconsistency
* weaker identity consistency
* unclear user value

## Allowed in v2 labs only

If you ever do it:

* change only shell
* keep work surfaces constant
* keep CTA constant
* keep document preview constant
* allow user to pin theme
* default to off

---

# 14. What exactly to copy and avoid

## ResumeLab

Copy:

* low-friction start
* obvious flow
* clarity for first-time users

Avoid:

* popup dependency
* funnel interruptions
* generic AI text spam
* overly guided feeling

## Linear

Copy:

* control density
* seriousness
* speed
* minimal noise

Avoid:

* overcompression for normal users

## Vercel

Copy:

* type discipline
* neutral rigor
* premium restraint
* consistency

Avoid:

* over-technical coldness

## Apple

Copy:

* polish
* calm spacing
* clarity
* obvious interaction hierarchy

Avoid:

* over-silencing feature discoverability

## Notion

Copy:

* contextual AI
* inline transformation
* AI as assistant not mascot

Avoid:

* loose structure in important document flows

---

# 15. Tailwind token implementation starter

Here is the system direction in practical form.

```ts
// tailwind.theme.twoweeks.ts
export const twTheme = {
  fontFamily: {
    sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    serif: ['Newsreader', 'Georgia', 'serif'],
  },
  borderRadius: {
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '20px',
    xl: '24px',
    '2xl': '28px',
    hero: '32px',
    pill: '999px',
  },
  boxShadow: {
    xs: '0 1px 2px rgba(16,24,40,0.04)',
    sm: '0 8px 24px rgba(16,24,40,0.06)',
    md: '0 18px 48px rgba(16,24,40,0.10)',
    lg: '0 28px 80px rgba(16,24,40,0.14)',
  },
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
    20: '80px',
    24: '96px',
    32: '128px',
  },
}
```

## CSS variable layer

```css
:root {
  --font-ui: "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Newsreader", Georgia, serif;

  --paper-0: #F7F6F2;
  --paper-1: #F3F1EC;
  --paper-2: #ECE8E1;
  --paper-3: #E3DED6;

  --ink-0: #12161C;
  --ink-1: #1C222B;
  --ink-2: #39424F;
  --ink-3: #5C6674;

  --surface-1: rgba(255,255,255,0.62);
  --surface-2: rgba(250,248,244,0.78);
  --surface-3: rgba(245,242,236,0.92);

  --line-light: rgba(18,22,28,0.08);
  --line-default: rgba(18,22,28,0.12);
  --line-strong: rgba(18,22,28,0.18);

  --cta-light: #0E7C63;
  --cta-dark: #355E97;

  --gradient-shell: linear-gradient(
    180deg,
    #CFE3E1 0%,
    #D9E7E5 24%,
    #E6ECEA 52%,
    #E8E8EE 74%,
    #EFDCD6 100%
  );
}

[data-theme="dark"] {
  --paper-0: #0A1018;
  --paper-1: #101823;
  --paper-2: #1A2431;
  --paper-3: #243140;

  --ink-0: #F2F5F8;
  --ink-1: #DCE4EB;
  --ink-2: #AAB5C2;
  --ink-3: #7F8F9F;

  --surface-1: rgba(14,20,28,0.58);
  --surface-2: rgba(18,25,35,0.74);
  --surface-3: rgba(23,31,42,0.88);

  --line-light: rgba(255,255,255,0.08);
  --line-default: rgba(255,255,255,0.12);
  --line-strong: rgba(255,255,255,0.18);

  --gradient-shell: linear-gradient(
    180deg,
    #020913 0%,
    #071A31 20%,
    #163659 46%,
    #6E859D 76%,
    #E7D2CB 100%
  );
}
```

## Theme shells

```css
[data-shell="aoba"] { --gradient-shell: var(--gradient-aoba-kasumi); }
[data-shell="konjo"] { --gradient-shell: var(--gradient-konjo); }
[data-shell="wisteria"] { --gradient-shell: var(--gradient-pale-wisteria); }
[data-shell="quiet"] { --gradient-shell: var(--gradient-quiet-material-light); }
[data-theme="dark"][data-shell="quiet"] { --gradient-shell: var(--gradient-quiet-material-dark); }
```

---

# 16. Final locked decisions

This is the lock.

## Brand

* keep “One click. Two weeks. Done.”
* tone = calm premium tool, not AI toy

## Fonts

* primary = Geist
* accent = Newsreader

## Color logic

* neutral work surfaces
* atmospheric gradient shells
* restrained semantic colors

## Gradients

* default light = **Aoba Kasumi**
* default dark = **Konjō**
* alt light = **Pale Wisteria**
* premium shell = **Quiet Material**

## Architecture

* landing = conversion-first, product-proof heavy
* editor = skeleton left + preview right
* AI = contextual and compact
* export = ATS family + premium family + strong proposal differentiation

## What not to do

* no automatic hour-based theme switching by default
* no rainbow theme system
* no gradient on dense reading surfaces
* no AI suggestion spam
* no template gallery overload
* no ResumeLab-style funnel dependency as your core UX

---

# Final brutal truth

Your new first gradient direction is **worth keeping**.
It is **closer to a real premium software identity** than the more dramatic experiments.

But it only works if you are disciplined about:

* stronger neutral surfaces
* stricter contrast
* fewer competing moods
* one locked CTA language
* one locked shell family

Without that discipline it becomes pretty-but-soft.

With that discipline, it becomes **recognizable TwoWeeks**.

Say **“tokens file”** and I’ll write the exact production-ready token package:

* CSS variables
* Tailwind config
* light/dark shell mapping
* component token table for buttons, cards, panels, modals, editor chrome

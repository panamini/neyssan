Yes. Here is the **design-system spec for TwoWeeks** as I would set it up if I were defining the product and brand foundation for the next 12–24 months.

The principle behind all of it is simple:

**TwoWeeks should feel like a serious tool with editorial taste.**
Not a playful AI toy. Not a rigid enterprise dashboard. Not a marketing funnel disguised as a product.

It should sit in this zone:

* **clarity from Apple**
* **system rigor from Vercel / Geist**
* **speed and noise-reduction from Linear**
* **contextual AI from Notion**
* **conversion discipline from ResumeLab**
* **but with your own taste in typography, paper, atmosphere, and document craft** ([Apple Developer][1])

---

# 1. Brand operating system

## Core brand statement

**One click. Two weeks. Done.**

This is strong. Keep it.

Why it works:

* it is short
* rhythmic
* ownable
* product-shaped
* directly tied to the customer pain
* it frames speed without sounding cheap

This should not be replaced by something softer or more abstract.

## Brand personality

TwoWeeks should feel:

* calm
* efficient
* expensive
* precise
* modern
* helpful
* typographic
* non-hysterical
* quietly ambitious

Not:

* cheerful startup
* loud AI futurism
* fake luxury
* recruiter cliché
* template farm
* “dream job” cringe

## Positioning sentence

Use this internally:

**TwoWeeks turns rough input into client-ready documents fast — resumes, proposals, and polished career documents with premium structure, strong writing, and minimal friction.**

That gives you:

* broader than resume-only
* still concrete
* still commercial
* still legible

---

# 2. Font system

## Final call

**Primary UI / product font: Geist**
**Accent / editorial font: Newsreader**

That is the strongest pairing.

Geist is a very good base because Vercel explicitly positions it as a typeface for developers and designers inside a larger design system built around consistency, contrast, grid, and speed. That makes it a strong system font for a modern web product. Apple’s typography guidance also stresses that typography must support legibility, hierarchy, and brand expression, which is exactly why Geist works well as the main UI layer. ([Vercel][2])

Newsreader is the right accent because it gives you editorial gravity without becoming costume. It is more mature and less try-hard than many modern serif accents.

## Why not Urbanist or Jost as primary

They are not bad choices. But for TwoWeeks they are weaker than Geist.

Urbanist and Jost push the feeling more toward:

* marketing site
* modern generic SaaS
* slightly trend-led geometric softness

Geist feels:

* more controlled
* sharper
* more serious
* more product-native
* better aligned with premium tooling

So my recommendation is:

* **Geist for product and landing**
* **Newsreader only as an accent, not as a replacement**

## Where Newsreader should appear

Use it only in a few places:

* selected landing page section titles
* premium editorial proof blocks
* case study titles
* template family titles
* maybe one premium proposal export family

Do **not** use it for:

* nav
* controls
* inputs
* badges
* menus
* dashboard copy
* editor tooling
* section labels

## Font scale

### Display scale

* Display XL: 80 / 0.95 / 700
* Display L: 64 / 0.98 / 700
* Display M: 48 / 1.00 / 700
* Display S: 36 / 1.05 / 700

### Heading scale

* H1: 32 / 1.10 / 650
* H2: 24 / 1.15 / 650
* H3: 20 / 1.20 / 650
* H4: 18 / 1.25 / 600

### Body scale

* Body L: 18 / 1.55 / 450
* Body M: 16 / 1.55 / 450
* Body S: 14 / 1.50 / 450
* Caption: 12 / 1.40 / 500

### UI scale

* Button L: 16 / 1.20 / 600
* Button M: 14 / 1.20 / 600
* Label M: 13 / 1.20 / 600
* Label S: 11 / 1.20 / 600, tracked

## Typographic rules

* Large brand and hero moments can be bold and compressed in feeling, but not actually condensed.
* Product UI should never feel typographically decorative.
* Body copy should stay calm, open, and highly legible.
* Labels should feel systemized, never loud.
* If you use serif, use it as contrast, not as atmosphere everywhere.

---

# 3. Color system

You should **keep gradients**, but your real system must be built on **neutral surfaces**.

That is the key correction.

Vercel’s Geist system explicitly centers a high-contrast accessible color system, and Apple’s color guidance emphasizes colors that adapt well across backgrounds and appearance modes. That supports a model where your product is primarily driven by disciplined neutral surfaces and gradients are used as controlled brand atmosphere, not as the main content plane. WCAG still requires adequate contrast for text, so readability cannot depend on aesthetic mood alone. ([Vercel][2])

## Core neutral system

### Light neutrals

* `paper-0` `#F7F5F1`
* `paper-1` `#F2EFE9`
* `paper-2` `#E9E5DE`
* `mist-1` `#DEE4EA`
* `mist-2` `#CCD6E0`
* `ink-soft` `#4E5661`
* `ink-main` `#171B21`

### Dark neutrals

* `ink-0` `#0A0E13`
* `ink-1` `#101620`
* `ink-2` `#18212B`
* `steel-1` `#2B3642`
* `steel-2` `#40505F`
* `fog-1` `#AAB5C2`
* `fog-2` `#D5DDE6`

## Accent support hues

These are not brand-primary colors. They are modulation colors.

* `stone-blue` `#B7C7D7`
* `celadon` `#BFD3CB`
* `blush-paper` `#E8D0CB`
* `dust-rose` `#D9BEC9`
* `sulfur-halo` `#E6DF6D`
* `moss-slate` `#6A766E`
* `plum-steel` `#65576A`

## Semantic colors

* success: green-grey, muted not neon
* warning: warm ochre, not bright orange
* danger: wine-red or muted ember, not product-red
* info: steel blue, not saturated cobalt

### Rule

TwoWeeks should almost never use a pure saturated primary button color from the standard SaaS palette.

The product should feel:

* quieter
* more mature
* more document-like
* more editorial

---

# 4. Gradient system

This is where your brand becomes memorable.

## My chosen master gradient

**Quiet Material System / Gradient 11**

This should be the main TwoWeeks gradient family.

Why:

* premium
* calm
* modern
* serious
* flexible
* works with your document/product identity
* can scale into both marketing and product chrome

It gives you:

* dark indigo authority at the top
* steel/air transition in the middle
* human warmth at the base

That is the right emotional stack for TwoWeeks:
**competence → clarity → softness**

## My chosen light mode gradient

**Sakura Lift / Gradient 19**

Use for:

* light marketing sections
* proof panels
* softer premium themes
* lighter template family previewing

## My chosen dark mode gradient

**Moss Halo**

Use for:

* dark app chrome
* premium dark editor mode
* mood themes
* campaign surfaces

## My coup de coeur

**Celadon Rise**

This is the most refined secondary gradient family.
Use it for:

* premium editorial campaigns
* feature storytelling
* higher-tier product presentation
* investor / press deck mood

## One-family system if you want to simplify

If you only want one family:

* keep **Gradient 11**
* make three intensities:

  * dark shell
  * balanced shell
  * lifted shell

That gives consistency without flattening the brand.

## Gradient usage rules

Use gradients on:

* app shell
* landing shell
* preview frames
* premium cards
* ambient sidebars
* themed template families
* upgrade / premium states

Do not use gradients on:

* dense text reading surfaces
* form-heavy panes
* long-body export pages
* ATS resume body backgrounds
* complex modal content

## Gradient behavior rules

* one dominant gradient per screen
* no rainbow systems
* no hyper-saturated transitions
* no “liquid glass” nonsense unless it improves hierarchy
* gradients should feel atmospheric, not decorative

---

# 5. Spacing, radius, border, shadow tokens

This is where your product either becomes premium or amateur.

## Spacing system

Use a **4px base** and commit to it fully.

### Tokens

* `space-1` 4
* `space-2` 8
* `space-3` 12
* `space-4` 16
* `space-5` 20
* `space-6` 24
* `space-8` 32
* `space-10` 40
* `space-12` 48
* `space-16` 64
* `space-20` 80
* `space-24` 96
* `space-32` 128

### Product rules

* inputs: 12–16 internal padding
* buttons: 12 vertical / 16–20 horizontal
* cards: minimum 20, default 24
* modal bodies: 24–32
* section spacing inside editor: 32–48
* landing page vertical rhythm: 64 / 96 / 128

## Radius system

You are in the “soft precision” category.

### Tokens

* `radius-xs` 8
* `radius-sm` 12
* `radius-md` 16
* `radius-lg` 20
* `radius-xl` 24
* `radius-2xl` 28
* `radius-card-hero` 32
* `radius-pill` 999

### Rules

* controls: 12–16
* cards: 24
* large panels: 28–32
* do not round everything equally
* dense utility UI should be slightly tighter than marketing surfaces

## Border system

Borders matter a lot in this product.

### Tokens

* `border-subtle`: 1px low-contrast line
* `border-default`: 1px neutral visible line
* `border-strong`: 1px contrast line for selected states
* `border-focus`: 2px accessible highlight

Use borders more than shadows.

## Shadow system

Apple’s visual language and Vercel’s system both lean toward restraint, contrast, and hierarchy rather than giant decorative blurs. That is the right reference. ([Apple Developer][1])

### Light shadows

* `shadow-xs` `0 1px 2px rgba(16,24,40,.04)`
* `shadow-sm` `0 8px 24px rgba(16,24,40,.06)`
* `shadow-md` `0 18px 48px rgba(16,24,40,.10)`

### Dark shadows

Dark mode should use:

* soft inner edge
* slight outer atmosphere
* low-opacity glows
* more border separation than blur

### Rule

If every layer has a strong shadow, the whole product becomes cheap.

---

# 6. Interaction and accessibility benchmark

WCAG 2.2 requires sufficient text contrast and adds minimum target-size guidance at AA, with spacing or size safeguards for controls. Apple also advises limiting controls shown side by side and keeping interfaces clear and manageable. ([W3C][3])

## Minimum standards

* standard text contrast: 4.5:1 minimum
* large text: 3:1 minimum
* control targets: at least 24px equivalent minimum area or adequate spacing
* visible focus states on every interactive element
* keyboard-complete editor flows
* never rely on color alone for state

## Interaction rules

* hover should be subtle
* selection must be obvious
* destructive action must be unmistakable
* AI actions must feel reversible
* export should feel stable and high-trust
* loading states must explain whether work is “processing,” “rewriting,” or “exporting”

---

# 7. Voice and tone system

## Brand voice

TwoWeeks copy should sound like:

* calm
* smart
* fast
* unsentimental
* credible
* quietly premium

## Tone pillars

1. **Name the mess**
2. **Promise the outcome**
3. **Skip the theater**
4. **Sound like a sharp operator**
5. **Use fewer adjectives**

## Approved copy style

* “Drop in the ugly version.”
* “Turn rough input into client-ready output.”
* “A stronger proposal, without the rewrite spiral.”
* “Make the document better. Not busier.”

## Banned copy style

* “Unlock your future”
* “Revolutionary AI”
* “Dream job”
* “Perfect in seconds”
* “Stunning templates”
* “10x your workflow”

## AI writing rules

Notion’s AI guidance emphasizes transformation and generation within the workspace rather than treating AI as an isolated spectacle. That supports a product-writing style where the AI quietly helps improve a paragraph, shorten a section, or rewrite selected text in context. ([Notion][4])

So:

* AI should feel embedded
* AI copy should be concise
* suggestions should be sorted and curated
* users should not be forced to read ten long alternatives
* the AI should feel like an editor, not a slot machine

---

# 8. Landing page benchmark

## Goal

The landing page must convert:

* fast one-shot users
* premium design-sensitive users
* repeat long-term users
* proposal users
* resume users

## Information architecture

### Above the fold

Left:

* headline
* subhead
* primary CTA
* secondary CTA
* small proof or trust line

Right:

* live product preview
* resume/proposal toggle
* friction-removal visual
* before/after outcome logic

### After hero

1. what it fixes
2. how it works in 3 steps
3. product proof
4. output quality
5. use cases
6. templates/export trust
7. testimonials or trust
8. pricing
9. FAQ
10. final CTA

## Homepage style rules

* no giant template wall near the top
* no feature dump
* no fake “AI” animation overload
* no excessive icon soup
* no loud conversion gimmicks
* no 20 testimonials before product proof

## CTA strategy

Primary CTA:

* **Upload the mess**
  Secondary CTA:
* **See proposal templates** or **See output quality**

This is stronger than generic “Get started.”

---

# 9. Editor benchmark

This is your core moat.

## Best structure

**Left: structured skeleton**
**Right: live preview**

You were right to think this is stronger long-term.

ResumeLab’s guided modal editing lowers anxiety for first-time users, but it is more funnel-shaped and less scalable as a durable workspace. Notion’s strength is that actions happen inside the working context, and Linear’s strength is speed through reduced noise. Your editor should take both lessons: stable structure plus contextual actions. ([Notion][4])

## Ideal editor IA

### Top bar

* doc switcher
* mode switch
* theme
* export
* undo/redo
* AI utilities
* more menu

### Left pane

* profile / context
* job source
* structure tree
* editable sections
* section status
* suggestions / missing data flags

### Right pane

* live preview
* page navigation
* zoom
* final template rendering
* export parity

## Editor modes

Keep it to 4:

* Structure
* Polish
* Theme
* Export

No more.

## AI behavior inside editor

### Section level

* Rewrite
* Shorten
* Strengthen
* Clarify
* Fix tone

### Selection toolbar

* Rewrite
* Fix
* Shorten
* Ask AI

This part of your app is good. Keep it.

### What to add

For section-level work:

* 2–3 compact suggestions max
* one recommended option
* one reason label like:

  * stronger
  * tighter
  * more formal
  * more human

That is better than a giant suggestion flood.

---

# 10. Template benchmark

## Main rule

Do **not** make a giant gallery the center of the experience.

Users do not need Pinterest at the moment of writing. They need confidence.

## Best pattern

* one template visible at a time
* fast next/previous
* compact drawer/gallery if needed
* save favorites
* filters:

  * ATS-safe
  * premium
  * proposal
  * executive
  * creative-light

## Template families

You need fewer, better families.

### Resume families

1. ATS Core
2. Editorial Classic
3. Modern Minimal
4. Executive Quiet
5. Designer Clean

### Proposal families

1. Freelance Tight
2. Consultant Formal
3. Client-facing Premium
4. Agency Structured
5. Solo Operator Fast-close

Each family should have:

* clear use case
* typography logic
* spacing logic
* export logic
* tone match

---

# 11. Export benchmark

## Resumes

Two families only matter:

### ATS-safe family

* almost plain background
* clean sectioning
* no unstable decoration
* consistent alignment
* parsing-first

### Premium family

* stronger typography
* subtle block structure
* tasteful hierarchy
* still printable and professional

## Proposals

This is where you can outclass most competitors.

Proposal exports can carry:

* stronger headers
* softer tone bands
* issue / proof / CTA scaffolding
* small metadata chips
* selective visual polish
* more distinct personality

But:

* no gimmicks
* no busy art direction
* no heavy gradient reading surfaces
* no design that harms scanability

## Export parity rule

What users see in preview must feel trustworthy relative to final PDF.

Vercel’s design system emphasis on consistency and Apple’s HIG focus on clarity/hierarchy both point in the same direction here: predictable output beats flashy UI tricks. ([Vercel][2])

---

# 12. What to copy and what to avoid

## From ResumeLab

### Copy

* first-time reassurance
* obvious document steps
* visible progress
* low ambiguity
* obvious resume + cover letter pairing

### Avoid

* modal overload
* upsell pressure
* generic AI suggestion walls
* too many theme/tone labels that blur together
* funnel behavior interrupting flow

## From Linear

### Copy

* speed
* low noise
* confidence
* compact control systems
* serious product atmosphere

### Avoid

* over-compression
* too much expert bias
* hidden complexity for normal users

## From Vercel

### Copy

* system discipline
* type confidence
* monochrome restraint
* consistency across marketing and product
* premium precision

### Avoid

* dev-tool coldness
* abstraction
* being more “design system” than “customer problem”

## From Apple

### Copy

* reduction
* hierarchy
* legibility
* consistency
* polished spatial rhythm

### Avoid

* over-minimalizing discoverability
* making everything too silent
* removing helpful explicitness

## From Notion

### Copy

* contextual AI
* inline actions
* AI as editing layer
* fluid transformation of existing text

### Avoid

* block chaos
* weak structural containment
* too much free-form ambiguity in serious document flows

---

# 13. Concrete token starter pack

## Typography tokens

* `font-ui`: Geist, system-ui, sans-serif

* `font-accent`: Newsreader, Georgia, serif

* `text-display-xl`: 80/0.95/700

* `text-display-l`: 64/0.98/700

* `text-h1`: 32/1.1/650

* `text-h2`: 24/1.15/650

* `text-h3`: 20/1.2/600

* `text-body-l`: 18/1.55/450

* `text-body-m`: 16/1.55/450

* `text-body-s`: 14/1.5/450

* `text-label-m`: 13/1.2/600

* `text-label-s`: 11/1.2/600

## Radius tokens

* `radius-control`: 14
* `radius-chip`: 999
* `radius-card`: 24
* `radius-sheet`: 28
* `radius-hero`: 32

## Border tokens

* `line-subtle`: rgba(23,27,33,.08)
* `line-default`: rgba(23,27,33,.14)
* `line-strong`: rgba(23,27,33,.24)
* `line-inverse`: rgba(255,255,255,.14)

## Shadow tokens

* `shadow-sm`: 0 8px 24px rgba(16,24,40,.06)
* `shadow-md`: 0 18px 48px rgba(16,24,40,.10)
* `shadow-xl`: 0 32px 80px rgba(16,24,40,.14)

## Focus token

* `focus-ring`: 0 0 0 2px rgba(93,123,168,.38)

---

# 14. My final design verdict

## Keep

* Geist
* gradients
* skeleton + live preview editor
* inline AI toolbar
* strong typographic ambition
* proposal-first differentiation
* premium atmospheric shell

## Add

* stricter system tokens
* more stable neutral surfaces
* one master gradient family
* one accent serif only
* curated AI suggestions
* lighter onboarding
* stronger ATS-safe export family
* better parser confidence and correction UX

## Remove or reduce

* too many visual directions at once
* too many tone names
* too much gradient under reading surfaces
* any generic SaaS accent colors
* any AI theater that slows users down
* any gallery-first behavior in core workflow

---

# 15. The final system I would ship

If I had to lock the system today:

**Primary font:** Geist
**Accent font:** Newsreader
**Master gradient:** Quiet Material System / Gradient 11
**Light companion:** Sakura Lift
**Dark companion:** Moss Halo
**Premium secondary:** Celadon Rise
**Design philosophy:** plain work surfaces, atmospheric shells, premium typography, contextual AI, low-noise speed

That is the strongest benchmark for TwoWeeks.

Next step: I can turn this into a **real implementation spec** with:

* exact token JSON
* exact Tailwind theme extension
* exact homepage wireframe
* exact editor wireframe
* exact button/input/card component rules
* exact light/dark theme mapping for your chosen gradients

[1]: https://developer.apple.com/design/human-interface-guidelines/typography?utm_source=chatgpt.com "Typography | Apple Developer Documentation"
[2]: https://vercel.com/geist/introduction?utm_source=chatgpt.com "Geist"
[3]: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html?utm_source=chatgpt.com "Understanding Success Criterion 1.4.3: Contrast (Minimum)"
[4]: https://www.notion.com/help/guides/notion-ai-for-docs?utm_source=chatgpt.com "Use Notion AI to write better, more efficient notes and docs"

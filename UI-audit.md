
DASTI — Full Design Audit

1. Executive Summary
This is a genuinely ambitious product with a thoughtful, custom design system (dasti v1) that far exceeds what most solo or small-team projects achieve. The token architecture, the φ layout decisions, the color semantics, and the Fraunces + Source Sans 3 pairing all show real taste. However, the product sits at a split level: the system thinking is strong, but the execution has gaps — rough edges in component consistency, three colliding styling paradigms in the same file, dev artifacts in the UI, and a few places where the design language breaks down under scrutiny. It is not yet elite. It is good, trending toward strong, with specific fixable blockers.

2. Overall Verdict
Rating: Good → Strong (6.5/10).
The bones are excellent. The finish is inconsistent. The design system is real and intentional — this is not a Shadcn template with a palette swap. But several issues prevent it from passing a rigorous internal review at a place like Linear or Vercel.

3. What Already Works Well
* The DASTI token system. Canonical spacing (4·8·12·16·24·32·40·64), √2-adjacent type scale, 3-level shadow system, semantic ok/er/wa tokens with separate text/bg/border values. This is more sophisticated than most production apps.
* The φ ratio as a structural principle. Sidebar 38.2% / content 61.8%. Compose grid 1fr / 1.618fr. Page padding 64px × 40px (≈φ). These are intentional, not accidental.
* Fraunces + Source Sans 3 pairing. The serif display font against a humanist sans is a genuinely thoughtful typographic choice. It gives the product personality without being eccentric.
* The 5-palette interchangeable accent system. Sauge, Ocre, Pierre, Bordeaux, Encre — all muted earth tones, all with correct dark-mode variants. The pyramid dot layout in StyleForge is a nice UX gesture.
* Dark mode architecture. Proper semantic token overrides, saturation controlled at ≤26% per dark mode (the code even cites Itten — someone has done color theory homework).
* The compose well pattern. The textarea + cbar (command bar) pattern is a clean, modern interaction model — textarea that flows into a toolbar with type/tone chips and a send button. Reminiscent of Linear's comment model.
* Tab underline implementation. marginBottom: -1 to merge with the container border. Elegant, correct.
* Shadow hierarchy. sha (subtle card lift) / shb (modal) / shc (elevated modal) — used correctly throughout. Cards feel lifted without looking plasticky.
* The StyleForge preview system. Live preview thumbnails of CV and letter with real typographic variations is genuinely valuable UX, well-executed technically.

4. What Feels Weak, Off, or Unrefined
Here is everything that fails under serious scrutiny.

5. Typography and Hierarchy Review
Font choice: B+. Fraunces (variable weight optical serif) for display, Source Sans 3 (humanist sans) for UI, Source Serif 4 for rich text editing, IBM Plex Mono for code. Four fonts total. This is one font too many. Source Serif 4 is used only inside the rich text editor — a case could be made to drop it and use Source Sans 3 at low weight for body copy, which would reduce the font load and simplify the system.
Type scale: documented incorrectly. The comment says §2 Type scale √2 depuis 12px. True √2 from 12 would give 12 → 17 → 24 → 34 → 48. The actual scale is 12, 14, 16, 20, 26, 32. The bottom steps (12→14, 14→16) are ratio 1.14–1.16, not 1.414. This is not a √2 scale. It is a pragmatic web type scale, which is fine — but the stated rationale is false. The documentation should say "pragmatic 8px-anchored scale" rather than √2.
The 12px (--tx) usage. Sidebar section labels, the chip font, date stamps — all 12px. At 12px Source Sans 3 is readable but very tight on retina. On 1080p displays (the primary target), 12px begins to strain legibility, especially for low-contrast ghost text (--tg2). The minimum should be 11.5px rendered, so 12px CSS is at the edge.
Line heights. The declared line heights (16, 20, 24, 30, 40) are too disconnected from the type sizes. --lb: 24px paired with --ts: 14px gives a 1.71 ratio — generous. --ls: 20px with --ts: 14px gives 1.43. These are used inconsistently across components: the intro panel description uses --ls (line-height: 20px for 14px text), the modal subtitle uses --ls too. Consistent, but the 20px line-height for 14px body text feels slightly airy. Not broken, but slightly loose.
Heading hierarchy problem. On the Write page (/proposal): the eyebrow div says "Write" in all-caps small text. The h2 below it also says "Write" in 32px Fraunces. Two elements with the same word in the same component. This is not hierarchy — it is repetition. The eyebrow label should describe the section category (e.g., "PROPOSAL STUDIO" or "COMPOSE"), and the h2 should give the page its distinctive name. Compare: CvForge has "RESUME WORKSPACE" as eyebrow and "Resume" as h2 — slightly better because the eyebrow adds context. StyleForge has "STYLE" as eyebrow and "Layout" as h2 — this is actually the best of the three because the h2 is specific to what the page does.
Paragraph measure. The intro panels have no max-width on the description paragraph, which means at wide viewports the line gets very long (well past 75ch). The StyleForge panel does have maxWidth: "42ch" on the <p> — good. The other two pages don't. Optimal reading width is 60–75ch. Fix: add maxWidth: "60ch" to all description paragraphs.

6. Color Harmony and Palette Review
Hue selection: A. Sage green (hsl 155, 22%, 30%) against a linen background (hsl 38, 16%, 95%) is a warm/cool analogous pairing — about 117° apart on the wheel, which lands in split-complementary territory. The relationship feels natural, organic, and non-corporate without being playful. Correct for a professional writing tool.
Saturation control: A. Nothing is oversaturated. Semantic colors (ok/er/wa) are kept at 20–26% saturation in both modes. This is careful, mature color work. The colors never shout.
The palette's emotional weakness. The entire system — all five accent options — lives in the same emotional register: muted, restrained, earthy. For a product that helps people write compelling documents and win jobs, there is no energy in the palette. It communicates "calm" but not "effective." A user who wants to project confidence or ambition has no visual option for that. This is not a critical bug, but it is a brand positioning gap. Consider adding one assertive accent (a controlled cobalt or a clean slate blue) to the palette options.
The --sfr raised surface is hsl(40,20%,99%) — near white. The --bg canvas is hsl(38,16%,95%). The delta between the two is very small (~4 lightness points). On certain monitors this distinction is nearly invisible. Cards appear to barely lift off the background. The shadow (sha: 0 1px 2px 5%, 0 3px 10px 4%) is doing most of the work. This is intentional minimalism, but it risks the surface hierarchy being imperceptible. The dark mode avoids this problem (bg 7%, sf1 11%, sf2 16%, sfr 19% — 4-5% increments, same strategy).
Semantic colors in light mode: B+. --ok: hsl(152,20%,28%) — a sage-adjacent green for success. --er: hsl(4,26%,34%) — a warm terracotta for error. --wa: hsl(34,36%,32%) — ochre for warning. These are analogous to the brand palette rather than traffic-light primaries. This is a deliberate, high-taste choice. The risk: some users won't immediately identify a muted terracotta as an error state. The success green (--ok) and the accent green (--ac: hsl(155,22%,30%)) are only 3° apart on the hue wheel — visually they can be confused. Consider shifting --ok to hsl(142,...) to create more hue separation from the accent.
Inconsistency: --am definition. In :root (Sauge default): --am: hsl(155,24%,44%). In .pal-sauge: --am: hsl(155,18%,40%). These are different values for the same semantic token. The .pal-sauge overrides :root when the body has .pal-sauge, which the AppShell always applies. So the effective --am is hsl(155,18%,40%), not hsl(155,24%,44%). This shadow definition in :root is a dead value — it only matters before the body class loads, causing a flash. This needs to be reconciled: either :root and .pal-sauge should match, or :root should not define accent tokens at all.
Modal max-width token inconsistency. --modal-max-width: 680px in the token layer. dasti-modal { max-width: 720px } in the component layer. These disagree. One is a dead token.

7. Proportion Analysis (φ, √2, Modular Harmony)
What works:
* Sidebar/content split at 38.2/61.8 is exact φ. Intentional and correct.
* Compose panel grid 1fr / 1.618fr is exact φ. Excellent.
* Page padding 64px top / 40px sides (--s8/--s7) gives a 1.6 ratio that approximates φ. Whether intentional or accidental, it works.
* Card radius progression: 4, 6, 12, 18, 999. The 6→12→18 steps are ×2 and ×1.5 — not a clean geometric, but reasonable.
What is arbitrary:
* The SbDoc item left-padding is 40px (dense) or 40px (default with slight variation) to create indentation from the parent nav item. This 40px value correctly uses --s7, but the visual indent relationship between parent nav item and child sub-document could be more deliberate — currently it's just pushing text right with a hardcoded pixel offset rather than expressing hierarchy through a clean proportional step.
* The cbar button height of 26px — not a grid value, not a halved grid value. Arbitrary.
* The 30px avatar size — not on the height scale (--hs=32). 2px below the smallest interactive height. Should be 32px.

8. 8px Grid and Spacing Review
The grid is generally respected. The violations are targeted:
* height: dense ? 28 : 30 on the "New resume" / "New letter" buttons. Neither 28 nor 30 is on the canonical spacing scale. Should be --hs (32px) or at minimum 24px (--s5). This creates a micro-inconsistency in the sidebar rhythm.
* height: 26 on the cbar chips (Type, Tone). Off-grid. Nearest token is --hs: 32px or --s5: 24px. Use 24px.
* The generate button width/height: var(--hs) (32px). This is correct — uses the grid token properly. Good.
* SbDoc right: 24 and right: 4 for action buttons. right: 24 is --s5 accessed as a raw number (missing var()). right: 4 is --s1 accessed as a raw number. These should use CSS variables for maintainability, even if the computed values are grid-compliant.
* SbDoc maxWidth: dense ? 150 : 160. These are magic numbers with no relationship to the grid or the sidebar width. These should be derived: calc(var(--sidebar-width) - 80px) or similar.
* Switch thumb: 20×20px. Not in the spacing scale. Acceptable for a switch thumb specifically, but worth noting.
* Scrollbar width: 5px. Fine. Scrollbars are exempt from grid constraints.
* margin: 3px 0 0 on .dasti-modal-subtitle. 3px is not a grid value. Should be --s1 (4px).

9. Optical Design Review
The topbar brand weight. "dasti" at 14px weight-600 Fraunces next to "› Resume" at 14px weight-500 Source Sans 3 — the brand name doesn't have enough visual authority. At 14px, even Fraunces 600 blends with the surrounding UI. The wordmark should be 16px (--tb) minimum, or rendered separately at the left edge with its own visual weight.
The (d) brand mark. The sidebar header shows (d) in 13px Fraunces. This reads as a draft placeholder, not a logotype. Parentheses around a letter is not a brand mark — it looks like a keyboard shortcut annotation. When the sidebar collapses, this completely disappears (opacity 0, scaleX 0). The collapsed sidebar has no brand identity at all — just three icons floating in --sf1. This is a significant brand gap.
Icon size inconsistency. FileText size={15}, Pencil size={15}, Settings size={16}. 15px vs 16px icons in the same navigation component. This is a 1px difference that compounds optically over 3 items. Standardize to 16px.
The "Sign in" button position. The Sign in button floats in the far right of the topbar, 40px from the edge (--s7 padding). At 650px viewport width, it appears correct. At 1440px wide with a 248px sidebar, the button is at the far right of an 1192px area — which is nearly 12 grid columns away from the brand name. This extreme span feels empty and directionless. The topbar has nothing between the brand/breadcrumb and the Sign in button. At wide viewports this creates a dead horizontal zone.
Intro panel height. On the Write page, the intro panel (/proposal) says "Write" twice — eyebrow + h2 — as noted in §5. Optically this creates a double-punch at the top of the page that doesn't earn its space.
The debug banner. 🔥 OFF Enable debug — a floating fixed-position element bottom-right of the viewport. Even when toggled OFF, it is visible on every page. This is a dev-only control that should not render in any viewport a user would see. It currently bleeds into product screenshots, demos, and any screen share.
Card border opacity. --bo: hsla(30,12%,11%,.08) for light mode. On the linen background (hsl 38,16%,95%), this translates to an extremely faint border. The card edges are optically almost invisible — the shadow is doing all the card-defining work. This is intentional minimalism, but in areas where shadow is not applied (e.g., the dasti-zone component uses --bo border with no shadow), the borders almost disappear.

10. UI System Review
Buttons. There is no centralized button component applied consistently across the app. Some buttons use the Button component from ./ui/button (in the CV picker dialog). Most buttons are raw <button> elements with full inline styles. The ProposalInputForm uses both <Button variant="primary"> and raw styled <button>. This creates visual inconsistency: the Button component presumably has its own hover/active/focus implementation, while the inline-styled buttons handle hover via onMouseEnter/onMouseLeave DOM mutations.
The onMouseEnter/onMouseLeave style mutation pattern. Multiple interactive elements use this pattern:
onMouseEnter={(e) => { e.currentTarget.style.color = "var(--ti)"; }}
onMouseLeave={(e) => { e.currentTarget.style.color = "var(--tg2)"; }}
This directly mutates the DOM outside React's render cycle. It works, but: (1) state is lost on re-render, (2) it's not accessible (keyboard focus doesn't trigger it unless paired with :focus-visible), (3) it prevents React DevTools from inspecting the hover state. All hover states should be CSS-driven (:hover pseudo-class via a class, or useState with Tailwind/CSS).
The window.confirm() delete dialog. Both CV delete and proposal delete use window.confirm(). This is a native browser modal — it breaks the visual design completely. No styling, no token system, no keyboard management beyond the browser's own. In a product that goes to this level of design investment, this is jarring. Replace with a small inline confirmation or a styled Dialog component.
Empty states. "No CV loaded. Provide a cvId prop to load a CV, or open the library to select one." This is an error message written for a developer, not a user. cvId is an internal prop name leaking into user-facing copy. The empty state should be: "Select a resume from the sidebar, or create a new one" with a clickable action.
The ProposalInputForm "Resume: none" label. The lowercase none is cold, developer-facing copy. A user reading this wonders if "none" means nothing is linked or if it's a named option called "none." It should say "Resume: not selected" or simply show an — dash.
Inputs. The job title input (styles.inputElement + styles.jobField) and the textarea are styled via CSS modules. The job title has no visible label — only a placeholder "Enter Job Title". For accessibility, every input needs a visible label or an aria-label. Using placeholder as a label fails accessibility standards and disappears the moment the user starts typing.
The disabled PDF Preview / Export PDF buttons. Two prominent, primary-weight buttons at the bottom of StyleForge that do nothing. cursor: not-allowed, opacity: 0.65. They communicate "this product is incomplete." Either remove them entirely, replace with a "Coming soon" note, or move them behind a feature flag that hides them.

11. UX Review
Navigation clarity. Three nav items: Studio (CV), Compose (Write), Style (Settings). The icons are: FileText, Pencil, Settings. These match the sections adequately, but "Studio" vs "Write" vs "Style" are slightly inconsistent in abstraction level — "Studio" is a workspace metaphor, "Write" is an action, "Style" is an attribute. The topbar breadcrumb says "Resume" / "Write" / "Style" while the sidebar says "Studio" / "Compose" / "Style." Two different label systems for the same destinations.
Sidebar collapse UX. The sidebar auto-collapses below 1220px viewport width. At the test viewport (650px) the sidebar shows only icons. The icons have no tooltips on hover except through the title attribute — which only shows on desktop after a hover delay. On a narrow screen, the collapsed sidebar is navigable only if you know what the icons mean. A tooltip on hover would improve discoverability.
The LibraryView (saved proposals). The sidebar lists saved proposals as sub-items under "Compose." The Library tab in ProposalForge also shows saved proposals. This is two access points for the same data, which is fine, but the experiences may diverge (sidebar is always visible; library tab requires being on /proposal). If a user is on /cv, they can see their proposals in the sidebar but clicking one takes them to /proposal?view=saved&id=X. This is correct behavior but the mental model may be non-obvious.
Loading/generating state. The generate button switches from ArrowUp to a Square (stop) icon when generating. This is correct — clear affordance change. But there is no loading indicator in the output panel. While generating, the Draft panel presumably shows nothing (proposalContent is null, loading=true). The user stares at an empty panel with no progress feedback. There should be at minimum a skeleton or a spinner in the Draft panel during generation.
Trust signals. For a product that handles user resume data and generates proposals via AI, the authentication state (Sign in button, no user name shown when signed in) and the data flow (where CVs are stored, how proposals are saved) are not communicated to the user anywhere visible. A user would not know if their data is in localStorage, in a cloud DB, or anywhere else. This is a trust gap for a data-sensitive product.

12. Redundancies, Noise, and Overdesign
Three styling paradigms in ProposalInputForm. The same file uses: (1) CSS Modules (styles.container, styles.composeWell), (2) Tailwind utility classes (className="mb-3 flex flex-wrap..."), and (3) inline style={{...}} objects. This is not a design issue per se but it creates visual inconsistency because each paradigm applies tokens differently. Tailwind uses the --foreground, --muted-foreground compat aliases; inline styles use var(--ti), var(--tm2) directly; CSS modules are separate. Audit and reconcile into one approach.
The compat alias layer. globals.css has three alias blocks: (1) Tailwind compat aliases mapping old token names to dasti tokens, (2) Neyssan v3 aliases, (3) the core dasti tokens. This three-layer indirection means a color like text-foreground in Tailwind resolves to --foreground → --sfr → hsl(40,20%,99%). Any developer debugging color values has to trace through three files. The --sfr value (raised surface near-white) being aliased as --background is semantically incorrect — --background implies the canvas, not a raised surface.
The !important Tailwind ring reset. Overriding Tailwind's CSS custom properties globally with !important on *, *::before, *::after is a sledgehammer fix. The correct solution is to configure Tailwind to not inject those variables, or to apply the focus ring only through dasti's token system from the start. This block in the global CSS makes it very hard to ever use Tailwind's ring utilities intentionally.
The components.bak.1756564393/ directory. A backup directory inside src/. This should not exist in the repo at all, let alone in the source directory where it can accidentally be imported. Delete it and let git history handle archaeology.
The false √2 documentation. The comment §2 Type scale √2 depuis 12px is incorrect. Either implement a true geometric scale or fix the comment. Misleading documentation in a design system causes future developers to make wrong assumptions.

13. Prioritized Improvements
CRITICAL — Fix immediately
C1. window.confirm() delete dialogs.
* What: Every CV and proposal delete uses a native browser window.confirm().
* Why it matters: Breaks the entire visual design contract. A single native browser popup destroys the premium impression.
* Fix: Replace with an inline confirmation pattern — e.g., a two-step button ("Delete" → turns red, shows "Confirm?") or a small Dialog component. The dasti-modal system is already built; use it.
C2. "No CV loaded" copy exposes internal prop name.
* What: "Provide a cvId prop to load a CV, or open the library to select one." The word cvId is a React prop name leaked into user-facing text.
* Fix: "Select a resume from the sidebar, or create a new one →".
C3. The debug banner in the UI.
* What: 🔥 OFF Enable debug is visible on every page at all times.
* Fix: Gate behind import.meta.env.DEV AND a query param — only show if ?debug=1 is in the URL while in dev mode. Never render in production.
C4. Write page h2 "Write" + eyebrow "WRITE" duplication.
* What: ProposalForge intro panel says "WRITE" (eyebrow) then "Write" (h2) — identical words.
* Fix: Eyebrow → "PROPOSAL STUDIO". h2 → "Write". Or: eyebrow → "COMPOSE", h2 → "Write". Give the eyebrow descriptive context the h2 doesn't already carry.
C5. Missing visible labels on inputs.
* What: Job Title input has only a placeholder, no label. Placeholder disappears when typing. Fails WCAG 2.1 §1.3.1.
* Fix: Add <label htmlFor="jobTitle"> above the input, or use aria-label at minimum.

HIGH IMPACT — Do next
H1. Reconcile --am token between :root and .pal-sauge.
* :root defines --am: hsl(155,24%,44%), .pal-sauge defines --am: hsl(155,18%,40%). These are different. Since AppShell always applies .pal-sauge, the :root value is dead. Remove accent definitions from :root entirely, or make them match .pal-sauge.
H2. Fix the (d) brand mark.
* The parentheses make it look like a keyboard annotation, not a logotype.
* Fix: Either design a proper small wordmark (even "d" alone in Fraunces, or a simple geometric mark), or show the word "dasti" in small Fraunces. The collapsed sidebar state needs some persistent brand identity — even a 16px "d" in Fraunces reads better than (d) disappearing on collapse.
H3. Replace onMouseEnter/onMouseLeave style mutations with CSS.
* There are at least 8 components using direct DOM style mutations for hover states.
* Fix: Convert to CSS :hover using .dasti-icon-button:hover patterns (already in globals.css). For the sidebar items, use useState(false) for hover (which is already done in SbDoc — extend to the nav items above it) or use a CSS class approach. Remove all e.currentTarget.style.X = ... patterns.
H4. Off-grid interactive heights in the compose bar.
* The cbar chips are height: 26 and "New resume"/"New letter" buttons are height: 28/30.
* Fix: Standardize all secondary interactive elements to --hs (32px). Adjust the cbar accordingly. These 2-4px differences read as "slightly off" to trained eyes.
H5. Add a loading skeleton to the Draft panel.
* When generating, the Draft panel is empty. Users have no feedback.
* Fix: Show 3–4 animated skeleton lines (using --sf2 background, --sf1 shimmer) that match the expected proposal length.
H6. The disabled PDF buttons in StyleForge.
* Two prominent disabled CTAs signal an unfinished product.
* Fix: Remove them entirely for now, or replace with a small badge: "PDF export — coming soon" in ghost text. Don't let dead UI occupy prime real estate.
H7. Topbar wordmark visual weight.
* "dasti" at 14px 600 Fraunces in the topbar is too small to command attention as a brand name.
* Fix: Increase to var(--tm) (20px) or at minimum var(--tb) (16px). Add 2–4px more letter-spacing: -.02em. This single change dramatically improves brand presence in the topbar.

POLISH — When the above are resolved
P1. Fix the --modal-max-width: 680px vs dasti-modal { max-width: 720px } inconsistency. Pick one. 680px is more appropriate for a dialog; 720px is pushing into page-width territory.
P2. Add maxWidth: "60ch" to description paragraphs on CvForge and ProposalForge intro panels. Currently the line length at wide viewports exceeds 100ch on long descriptions — unreadable.
P3. Standardize icon sizes in the sidebar nav. FileText={15}, Pencil={15}, Settings={16}. Change all to size={16}.
P4. Avatar size: 30px → 32px (--hs). 30px is 2px off the smallest grid-aligned interactive height.
P5. Fix margin: 3px 0 0 on .dasti-modal-subtitle → margin: var(--s1) 0 0 (4px). Non-grid value.
P6. Fix the components.bak.1756564393/ directory. Delete it from the repo. Use git rm -r and commit.
P7. Document the type scale correctly. The --tx through --tx2 values are not a √2 scale. Fix the comment or change the scale.
P8. Move --ok hue separation from --ac. Both are hsl(155, ...) and hsl(152, ...) — only 3° apart. A success state and an accent should be clearly distinguishable. Shift --ok to hsl(142,...) (≈13° separation).
P9. Reconcile the three styling paradigms in ProposalInputForm. Commit to either CSS modules or inline dasti tokens. Remove Tailwind from this component (it's the only file mixing all three). This is a code quality issue that will eventually cause visual bugs.
P10. Add hover tooltips to collapsed sidebar icons. When collapsed, icons have no labels. Add a title attribute on each nav item and consider a CSS tooltip on :hover with position: absolute; left: calc(--sidebar-collapsed + 8px).

14. Final Maturity Rating and What Prevents Elite Quality
Current rating: 6.5/10 — Good, trending toward Strong.
The three things preventing elite:
1. No single authoritative styling approach. Elite products (Linear, Vercel, Notion) have one styling system. Dasti has a brilliant token system, but it's implemented through three competing approaches simultaneously. When the design system fights itself, the output is inconsistent — and inconsistency is the clearest signal of non-elite craft.
2. Dev artifacts and placeholder copy in production UI. The debug banner, the (d) placeholder mark, window.confirm(), cvId in user-facing copy, disabled prominent CTAs — each of these individually is minor. Together they read as "this was built with focus on the backend and deferred the surface." Elite products have zero visible seams between implementation and presentation.
3. The topbar is too thin as a brand expression. The topbar at 54px with a 14px wordmark and a 500-weight breadcrumb is the one element every user sees on every page. It is the most underinvested surface in the product. A 16–20px Fraunces wordmark with a clear visual anchor would make the entire product feel more confident from the first frame.
Smallest set of changes for the biggest quality jump:
1. Fix the Write page h2/eyebrow duplication (30 min, immediately raises perceived coherence)
2. Increase the wordmark to 18px Fraunces (5 min, large brand impact)
3. Replace window.confirm() with inline confirmations (2 hours, eliminates the single most jarring design break)
4. Remove the debug banner from default render (10 min, removes a constant visual distraction)
5. Fix the empty state copy (cvId prop name leak) (10 min, removes developer-speak from user-facing copy)
These five changes alone would move the product from 6.5 to 7.5. The rest of the list brings it from 7.5 to 8.5. Getting to elite (9+) requires resolving the styling paradigm conflict and building a proper brand mark.


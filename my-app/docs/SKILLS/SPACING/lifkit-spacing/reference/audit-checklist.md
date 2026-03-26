# LiftKit spacing audit checklist

Use this checklist to review whether a website or app follows the LiftKit-style spacing system defined in `spacing-rules.md`.

## Goal

Determine whether the codebase matches the spacing system in a concrete, file-by-file way.

Classify each finding as:
- matches system
- partially matches
- conflicts with system
- unclear / needs deeper inspection

---

## 1. Root layout spacing

Check whether non-text layout spacing is based on root-relative tokens.

### Pass criteria
- Layout spacing uses `rem`-based tokens or an equivalent root-based scale.
- The main spacing ladder matches the intended proportional system:
  - `xxs = 0.236`
  - `xs = 0.382`
  - `s = 0.618`
  - `m = 1`
  - `l = 1.618`
  - `xl = 2.618`
  - `xxl = 4.236`
- Grid gaps, section spacing, stack spacing, and other non-text spacing use these layout tokens.

### Red flags
- Arbitrary pixel spacing for layout such as `12px`, `18px`, `22px`, `37px`
- Multiple unrelated spacing scales
- Section and grid spacing not tied to the root system
- Components using hardcoded spacing with no token reference

### Check
- global CSS variables
- Tailwind theme spacing config
- section wrappers
- grid layouts
- stack/layout utilities
- container padding

---

## 2. Text-relative spacing

Check whether spacing between text elements is tied to text context, not just root spacing.

### Pass criteria
- Text rhythm uses `em`-based or equivalent text-relative spacing.
- Margins between text elements are derived from the active text context.
- The code distinguishes text rhythm from layout rhythm.

### Red flags
- Heading-to-paragraph spacing defined only in `rem` or `px`
- Spacer divs used to separate text blocks
- Same spacing applied to all text pairings regardless of type scale
- Text flow utilities that ignore the active text class

### Check
- typography utilities
- prose/text flow helpers
- heading + paragraph patterns
- label + helper text patterns
- form field vertical rhythm

---

## 3. Text context mapping

Check whether the system distinguishes the three text spacing contexts correctly.

### Expected contexts
- `display1` = tighter optical spacing
- `body` = looser spacing
- all other text classes = default middle spacing

### Pass criteria
- Display text uses tighter effective spacing than default text.
- Body text uses looser effective spacing than default text.
- Default text classes use the default spacing column.

### Red flags
- Display text and body text sharing the same spacing logic
- No distinction between display, body, and default text rhythm
- Body bold using a different line-height model than body regular unless intentionally justified
- Text classes assigning inconsistent spacing tokens

### Check
- display utilities
- body utilities
- heading/title/subheading/callout/label/caption utilities
- line-height assignments
- local text spacing variables

---

## 4. “Larger element owns the spacing” rule

Check whether spacing is generally derived from the larger related text element.

### Pass criteria
- In mixed text pairs, spacing is set relative to the dominant/larger text element.
- Cards and list items derive rhythm from the largest relevant text style inside.

### Red flags
- Spacing based on the smaller text element
- No clear dominant spacing logic in mixed typography components
- Utility usage that makes rhythm shrink incorrectly when paired with smaller text

### Check
- title + body blocks
- heading + subheading
- label + helper text
- card heading + paragraph
- list item title + metadata

---

## 5. Card optical correction

Check whether cards follow the optical padding rule.

### Expected rule
Let:
- `X` = largest font size in the card
- `H` = line-height of `X`

Then:
- left padding = `X`
- right padding = `X`
- bottom padding = `X`
- top padding = `X / H`
- border radius = corrected top padding

### Why
The text bounding box contains a small invisible space above capital letters. If top padding is mechanically equal to left/right/bottom, the top looks too loose. The top must be optically reduced.

### Pass criteria
- Cards use asymmetric optical top padding
- Radius matches corrected top padding
- Card spacing is derived from dominant text, not arbitrary spacing tokens

### Red flags
- Symmetrical padding on cards with text-heavy headers
- Radius chosen from an unrelated token with no optical relationship
- Card padding set only by generic layout spacing tokens
- Hardcoded pixel card padding unrelated to typography

### Check
- card components
- panel/surface components
- modal/dialog bodies
- feature cards
- pricing cards
- list cards

---

## 6. Button optical spacing

Check whether buttons use optical correction instead of naive symmetry.

### Expected rule
Buttons, especially icon buttons and start/end-icon buttons, should feel visually centered and balanced. Optical equality matters more than purely mechanical equality.

### Pass criteria
- Button padding feels intentionally balanced around text and icons
- Start-icon and end-icon buttons account for icon placement
- Icon-only buttons feel optically centered
- Button radius is tied to its spacing logic where appropriate

### Red flags
- Same horizontal padding regardless of icon placement
- Icons appearing too close to one side
- Icon-only buttons that feel off-center
- Button padding based on random px values with no spacing logic

### Check
- primary buttons
- secondary buttons
- text buttons
- start-icon buttons
- end-icon buttons
- icon-only buttons
- button groups

---

## 7. List rhythm

Check whether list items derive rhythm from the larger text element inside the item.

### Pass criteria
- Multi-line list items use text-relative spacing
- Compact single-line items use tighter spacing consistently
- List layout is readable without becoming loose

### Red flags
- Same layout spacing used for all list types
- List items padded only by generic rem tokens even when text hierarchy differs
- Title/metadata spacing in lists not tied to type scale

### Check
- nav lists
- settings lists
- inbox/message rows
- feature lists
- card lists
- menu items

---

## 8. Layout vs text spacing separation

Check whether the code clearly separates:
- layout spacing
- text spacing

### Pass criteria
- Layout utilities use root spacing tokens
- Text flow utilities use context-local text spacing values
- The code makes this distinction understandable

### Red flags
- Same variable set used for both text and layout without distinction
- Text rhythm accidentally using layout tokens
- Grid/section gaps using text-relative values without a reason
- Text stacks using root spacing only

### Check
- spacing tokens
- flow utilities
- gap utilities
- stack utilities
- global design token files

---

## 9. Fixed pixel spacing misuse

Check whether pixel values are used where relative spacing should be used.

### Pass criteria
- Pixels are rare and justified
- Most rhythm spacing is tokenized and relative
- Text and layout scale well under font-size changes

### Red flags
- Fixed `px` spacing between text elements
- Fixed-height spacer blocks
- Button/card/list spacing locked to pixels
- Accessibility breakage when font size changes

### Check
Search for:
- `px`
- spacer divs
- hardcoded margins/padding/gaps
- one-off utility classes

---

## 10. Accessibility and scaling behavior

Check whether the spacing system preserves proportions when text size changes.

### Pass criteria
- Increasing root font size keeps visual relationships coherent
- Text spacing scales with text
- Layout spacing still feels structured and stable

### Red flags
- Layout collapses or becomes cramped when font size increases
- Text spacing becomes too tight or too loose under scaling
- Cards and buttons lose proportion under zoom/default font changes

### Check
- browser zoom
- increased default font size
- responsive breakpoints
- large text settings

---

## 11. Refactor strategy

If mismatches are found, prefer incremental migration.

### Priorities
1. Fix token architecture
2. Separate layout spacing from text spacing
3. Fix text context mapping
4. Fix body/display inconsistencies
5. Add card optical correction
6. Improve button optical spacing
7. Replace remaining hardcoded px rhythm values

### Rules
- preserve visual intent
- avoid destructive rewrites
- make small reversible changes
- map every fix to a concrete selector or component

---

## 12. Audit output format

Use this structure when reporting findings:

### A. Summary verdict
- matches well
- partially matches
- does not match

### B. Findings by category
- root layout spacing
- text-relative spacing
- text context mapping
- cards
- buttons
- lists
- fixed pixel misuse
- accessibility/scaling

### C. For each issue
- file path
- selector or component name
- current code
- why it conflicts with the spacing rules
- recommended fix
- severity:
  - high
  - medium
  - low

### D. Refactor plan
- smallest safe first step
- next most important steps
- remaining optional improvements

---

## 13. Quick yes/no review

Use this as a fast triage pass:

- Does the app have a clear root spacing token ladder?
- Are layout gaps based on root-relative spacing?
- Are text relationships spaced relative to text context?
- Does display text use tighter spacing than default?
- Does body text use looser spacing than default?
- Do cards use reduced top padding based on dominant text?
- Does card radius match corrected top padding?
- Do buttons show optical balancing, especially with icons?
- Do lists derive rhythm from the larger text element?
- Are fixed px values minimized where relative spacing should be used?

If several answers are “no,” the app does not fully match the system.
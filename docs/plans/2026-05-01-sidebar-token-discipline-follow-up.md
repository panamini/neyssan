# Follow-up task: sidebar token discipline

Status: deferred from Jobs PR3.

Audit `App.tsx`, `Sidebar.tsx`, and shell/product CSS for any hard-coded or custom sidebar background color that makes the collapsed sidebar read darker than `docs/UI/APP-SKELETON.html`.

Acceptance criteria:
- Collapsed sidebar surface references foundation tokens only, such as `--sf1`, `--sf2`, `--sf3`, or the skeleton-approved equivalent.
- No inline hex/rgb/hsl sidebar surface color is introduced outside token files.
- If a dedicated sidebar surface token is needed, add it to `foundation.css` under both light and dark theme blocks.
- Do not bundle with Jobs PR3 visual changes.

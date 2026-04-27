Drop local font files for Dasti here.

Supported auto-detected families:

- `Baskervville`
- `Fraunces`
- `Syne`
- `Thestral Neue`
- `BioRhyme`
- `Courier Prime`
- `Archivo`
- `Parisienne`
- `Cormorant`
- `Bonbance`
- `Geist`
- `Grave Presse`
- `Borel`
- `Algo`
- `Hepta Slab`
- `Special Elite`
- `Bricolage Grotesque`
- `Sono`
- `Nunito Sans`
- `Ortica`
- `Source Code Pro`
- `Doto`
- `FD Garamond`
- `Chaumont Script`

Accepted formats:

- `.woff2`
- `.woff`
- `.ttf`
- `.otf`

The app scans this folder on startup, registers any matching font files with
`@font-face`, and exposes them through curated font pairs in Settings and Style
Forge.

For editor-safe typography, bundle roman and italic sources whenever they exist,
plus the weights needed for bold text.

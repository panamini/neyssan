# Prompt to Dev / Senior Parser Engineer

**Context:**
We’re still seeing severe issues when parsing French CVs: the output produces **only one suggestion section**, often truncated, and most content does not populate the expected suggestion categories. This breaks the reviewer flow and undermines user trust.

**Observed symptoms:**

1. Only one suggestion section is generated, even though the CV has multiple logical sections (Profile, Experience, Skills, Education, Achievements, Languages, Links, etc.).
2. Many sections of the CV remain empty in the reviewer UI.
3. The generated category names often **do not match the schema or the expected reviewer categories**, so suggestions fail to populate correctly.
4. Markdown and French headers seem to cause the parser or validator to reject sections or mis-map categories.

**Relevant context:**

- `llmPostProcessor` splits sections using Markdown headers, bold headings, or all-caps heuristics.
- `llmValidator` performs snippet-based validation to ensure content exists in the original text.
- Suggestion categories in the reviewer are strict and mapped from `fieldKey` (e.g., `"introduction"`, `"experience"`, `"skills"`, `"education"`, `"achievements"`, `"contact"`, `"languages"`, `"links"`).
- French CV headers may not match the expected canonical strings (e.g., `"Profil"` vs `"Profile"`, `"Formation"` vs `"Education"`).

**Tasks / Investigations:**

1. **Check category mapping:** Ensure `mapHeaderToField` correctly maps French (and other non-English) section headers to schema `fieldKey`s. Missing mappings likely cause sections to collapse into a single default category.
2. **Check validation pass/fail:** Determine whether `validateLLMOutput` is rejecting sections due to low coverage or snippet match failure. French content may fail normalization/substring match, producing empty suggestions.
3. **Check post-processor splitting:** Verify that `splitByMarkdownHeaders` and `splitByBoldHeadings` correctly detect multiple sections in French, including accented characters and special formatting.
4. **Check the full flow:** `CV → hybridParser → llmPostProcessor → llmValidator → formatCompleteCV`. Identify where sections are being dropped or truncated.

**Goal:**

- Ensure **all logical sections** in the CV, including French headers, are correctly parsed, validated, and mapped to the proper reviewer categories.
- Generate full suggestions for each section without truncation.
- Preserve original content wherever possible to respect the user’s effort.

**Deliverable:**

- Updated `mapHeaderToField` or post-processing logic to handle French and other non-English headers.
- Debug logs showing why sections fail to appear in the reviewer (validation failures, unmapped fieldKeys, or parser drops).
- Optional: unit test using a representative French CV to verify correct section mapping and suggestion generation.

**Notes / Implementation hints:**

- Normalize both original text and LLM output (strip markdown, deaccent, collapse whitespace) before snippet matching in the validator.
- Add comprehensive French synonyms for headers: "coordonnées", "profil", "principales competences", "compétences", "expérience", "formation", "réalisations", "langues", "liens".
- When mapping, prefer exact matches first then fuzzy/inclusive matches to avoid misclassifications.
- Log the header raw text, cleaned header, mapped fieldKey, and a short snippet for failing sections.

**Example failing CV excerpts (for tests / repro):**

- "### Coordonnées\n**Farid Saidani**\n[www.linkedin.com/in/farid-saidani-]..."
- "### Principales compétences\n- Assurances\n- Business-to-Business (BtoB)\n- Gestion des comptes"

**Contact:**

- Link to code: [`my-app/convex/lib/parsing/llmPostProcessor.ts:1`](my-app/convex/lib/parsing/llmPostProcessor.ts:1)
- Validator: [`my-app/convex/lib/parsing/llmValidator.ts:1`](my-app/convex/lib/parsing/llmValidator.ts:1)
- Hybrid: [`my-app/convex/lib/parsing/hybridParser.ts:1`](my-app/convex/lib/parsing/hybridParser.ts:1)

Please implement the fixes and push a branch with the changes and tests; include the failing French CV as a test fixture.

---

Informations générales
Langue du CV


Français

Intitulé du poste
ex. Conseillère de vente confirmée
add
Prénom
Farid
Nom
Saidani
Email
Numéro de téléphone
Code postal
Ville
Limoges, Nouvelle-Aquitaine, France
Afficher les informations supplémentaires
Résumé de profil
Mettez en évidence votre expérience professionnelle générale, vos compétences clés et votre objectif de carrière en 3 à 4 lignes minimum.

Générer avec IA
Générer avec IA
Indiquez le poste que vous visez, et nous vous suggérerons des accroches percutantes :
Poste occupé :
ex. Conseillère de vente
Générer
Ex. Après plus de 5 ans d'expérience en vente dans le secteur du luxe et du prêt-à-porter...

Expérience professionnelle
edit
Mettez en avant vos principales missions, responsabilités et résultats obtenus en utilisant 3 à 4 points clés pour chaque expérience.
Agent général - MMA Assurances
2020 - À aujourd'hui
Delete
Directeur de Filière - MUTUALITE FRANCAISE BOURGUIGNONNE SERVICES DESOINS ET ACCOMPAGNEMENT MUTUALISTES SSAM
2017 - 2019
Delete
Ingénieur commercial grands comptes - Toshiba
2014 - 2016
Intitulé du poste
Ingénieur commercial grands comptes
Nom de l'entreprise
Toshiba
Ville
Date de début
2014
Date de fin
2016
Description

Générer avec IA
Générer avec IA
Indiquez le poste que vous occupez, et nous vous suggérerons des missions correspondantes :
Poste occupé :
Ingénieur commercial grands comptes
Générer
Développement et fidélisation d’un portefeuille clients privés/publics (CA : 10millions d’€/an)
Vente de solutions complexes (matériels, logiciels, services, financements)
Stratégies de compte, négociation multi-décideurs
Réponse aux appels d'offres et déploiement des marchés, suivi des contratset de la satisfaction client
Delete
Acheteur - UGAP
2011 - 2013
Delete
Ingénieur commercial grands comptes - Toshiba
2008 - 2010
Delete

Ajouter une expérience
Diplômes et formations
edit
Indiquez l'intitulé exacte du diplôme ou de la formation, en précisant si obtenu et la mention (les plus récents uniquement).
Sans titre - NEOMA Business School
1997 - 2001
Delete

Ajouter un diplôme / formation
Compétences
edit

Vos savoir-faire (technique) et savoir-être (relationnel) pour le poste concerné. Précisez le niveau de maitrise de la compétence si pertinent.

Prise d'initiative

Curiosité

Esprit d'équipe

Capacité à fédérer

Empathie

Autonomie

Rigueur

Persévérance

Force de proposition

Leadership

Créativité
Assurances
Delete
Business-to-Business (BtoB)
Delete
Gestion des comptes
Delete

Ajouter une compétence / qualité
Langues
edit

Précisez votre niveau en langues étrangères en utilisant de préférence le référentiel européen (CECRL).
French
Nom de la langue
French
Niveau
Delete

Ajouter une langue
Centres d'intérêt
edit

Parlez de manière précise de vos activités personnelles, si celles-ci apportent un plus à votre candidature.
Sans titre
Centres d'intérêt

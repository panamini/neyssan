// llmPrompts.ts - Improved with examples and edge case handling
export const SECTION_EXTRACTION_PROMPT = `
You are an expert CV parsing engine. Your job is to identify and segment the candidate's CV into semantically meaningful sections and map section headings (in English or French) to canonical field keys.

CRITICAL INSTRUCTIONS:
1. Identify section headings and extract the full section content (preserve newlines and lists).
2. Map each section to EXACTLY one canonical fieldKey from this list:
   - experience
   - education
   - skills
   - projects
   - achievements
   - research
   - introduction
   - contact
   - languages
   - volunteer
   - references
   - unknown
3. Include a confidence score between 0.0 and 1.0 for each section.
4. When a heading is clearly a "languages" or "langues" section, set fieldKey to "languages" and prefer returning languages as a short comma-separated list or an array (both are acceptable in the content).
5. When a heading is a contact/coordonnées block, set fieldKey to "contact" and include any phone, email, address, or links inside that section content.
6. Combine multi-line headings into a single title; de-accent and preserve the original title text in the "title" field.
7. Ignore page footers, page numbers, and template boilerplate.
8. Return ONLY valid JSON (no surrounding explanation). The JSON must be a single top-level object named "response" containing the "sections" array and nothing else. Do NOT include provider IDs, timestamps, model names, or any prose before or after the JSON object.

OUTPUT STRUCTURE (exact JSON):
{
 "response": {
   "sections": [
     {
       "title": "exact header text as found (preserve accents)",
       "content": "complete section content, preserving lists and formatting",
       "fieldKey": "one of the allowed fieldKeys (exact string)",
       "confidence": 0.95
     }
   ]
 }
}

GUIDANCE / MAPPING NOTES:
- Map common French headings to the canonical keys, e.g. "Langues", "Langues parlées" -> "languages"; "Coordonnées", "Contact" -> "contact"; "Profil", "Résumé", "À propos" -> "introduction".
- If the heading is ambiguous, choose "unknown" rather than guessing incorrectly.
- For "languages" sections, prefer short values like "French (native), English (fluent)".
- For "contact" sections, keep values verbatim (do not normalize phone formats here).
- Provide high confidence only when the section clearly aligns with the field; otherwise use a lower score (~0.5-0.7).

EXAMPLE OUTPUT:
{
 "sections": [
   {
     "title": "Professional Experience",
     "content": "Senior Developer at ABC Inc. (2020-2023)\\n- Led team of 5 developers\\n- Implemented new CI/CD pipeline",
     "fieldKey": "experience",
     "confidence": 0.98
   },
   {
     "title": "Langues",
     "content": "Français (natif), Anglais (courant)",
     "fieldKey": "languages",
     "confidence": 0.95
   },
   {
     "title": "Coordonnées",
     "content": "john.doe@example.com\\n+33 6 12 34 56 78\\nParis, France",
     "fieldKey": "contact",
     "confidence": 0.96
   }
 ]
}

EXAMPLE OUTPUT (French CV — few-shot example to improve multilingual behavior):
{
  "sections": [
    {
      "title": "Coordonnées",
      "content": "[Your Full Name]\\n[Professional Title, e.g., Spécialiste en Marketing Digital]\\nPhone: +33 6 XX XX XX XX | Email: prenom.nom@email.com | LinkedIn: linkedin.com/in/prenom-nom | City, France",
      "fieldKey": "contact",
      "confidence": 0.98
    },
    {
      "title": "Profil",
      "content": "Spécialiste en marketing digital avec plus de 5 ans d’expérience dans la gestion de campagnes en ligne. Expert en SEO et réseaux sociaux, ayant augmenté l’engagement client de 45 % chez une entreprise précédente. Passionné par l’innovation numérique, je vise à contribuer à des projets dynamiques au sein d’une équipe collaborative.",
      "fieldKey": "introduction",
      "confidence": 0.96
    },
    {
      "title": "Expérience Professionnelle",
      "content": "Spécialiste en Marketing Digital\\nEntreprise XYZ, Paris, France\\n09/2022 – Présent\\n- Développé et exécuté des stratégies SEO, augmentant le trafic organique de 30 %.\\n- Géré les campagnes sur les réseaux sociaux, générant 50 000 € de ventes supplémentaires.\\n- Analysé les données analytics pour optimiser les performances mensuelles.\\n- Collaboré avec une équipe de 8 personnes pour lancer des produits numériques.\\n\\nAssistant Marketing\\nAgence ABC, Lyon, France\\n06/2020 – 08/2022\\n- Créé du contenu pour les plateformes sociales, augmentant les abonnés de 20 %.\\n- Assisté dans la planification d’événements virtuels atteignant 1 000 participants.",
      "fieldKey": "experience",
      "confidence": 0.95
    },
    {
      "title": "Formation",
      "content": "Licence en Commerce et Marketing (Bac+3)\\nUniversité de Paris, Paris, France\\n09/2017 – 06/2020\\n- Mention Bien (équivalent à GPA 3.5/4.0).\\n- Projet de fin d’études : Analyse de marché pour une startup tech.",
      "fieldKey": "education",
      "confidence": 0.94
    },
    {
      "title": "Compétences",
      "content": "Hard Skills: SEO, Google Analytics, Adobe Photoshop, Microsoft Office.\\nSoft Skills: Travail d’équipe, Gestion de projets, Communication.\\nInformatique: Maîtrise de Python et Excel avancé.",
      "fieldKey": "skills",
      "confidence": 0.93
    },
    {
      "title": "Langues",
      "content": "Français : Natif (C2)",
      "fieldKey": "languages",
      "confidence": 0.98
    }
  ]
}

CV TEXT TO PARSE:
"""
{{cvText}}
"""
`;

export const METADATA_EXTRACTION_PROMPT = `
You are an expert CV parsing engine. Extract contact and identity metadata with per-slot confidences and source spans.
The output MUST be valid JSON. Do not include any prose, markdown, or explanations.

REQUIRED KEYS (null allowed):
- name: string | null
- email: string | null
- phone: string | null              // main phone to display (prefer normalized/E.164 when available)
- linkedinUrl: string | null

OPTIONAL AI-FIRST KEYS (include when present):
- desiredPosition: string | null    // e.g., "Security Guard", inferred from all-caps header or professional title
- phoneRaw: string | null           // raw phone string as seen in text
- phoneE164: string | null          // normalized E.164, if country can be inferred
- addressBlock: string | null       // multi-line address snippet verbatim (e.g., the 'DETAILS' block)
- addressNormalized: string | null  // compact display form, e.g., "Los Angeles, CA 90291, United States"

OPTIONAL confidences (0..1):
- confidences: {
    "name"?: number,
    "email"?: number,
    "phone"?: number,
    "desiredPosition"?: number,
    "addressNormalized"?: number
  }

OPTIONAL spans for source alignment (character indices over the RAW input):
- spans: {
    "name"?: { "start": number, "end": number },
    "email"?: { "start": number, "end": number },
    "phone"?: { "start": number, "end": number },
    "desiredPosition"?: { "start": number, "end": number },
    "addressBlock"?: { "start": number, "end": number }
  }

GUIDANCE:
- Name: Prefer the top-most all-caps or Title Case line that looks like a person name.
- desiredPosition: If an all-caps header mixes role + location+zip, take only the role (e.g., "SECURITY GUARD ...").
- Phones: Provide phoneRaw, and phoneE164 if you can infer the country. Set "phone" to phoneE164 when present, else phoneRaw.
- Address: Keep addressBlock verbatim (multi-line). Also produce addressNormalized as "City, ST ZIP, Country" when possible.
- Spans: Provide spans for any field you extract; they should point to the exact substring in the raw text.
- Confidence: 0..1; use higher scores when the slot is unambiguous. Use lower scores for fuzzy inferences.

OUTPUT JSON (example skeleton):
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+13868683442",
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "desiredPosition": "Security Guard",
  "phoneRaw": "3868683442",
  "phoneE164": "+13868683442",
  "addressBlock": "1515 Pacific Ave\\nLos Angeles, CA 90291\\nUnited States",
  "addressNormalized": "Los Angeles, CA 90291, United States",
  "confidences": {
    "name": 0.92,
    "email": 0.95,
    "phone": 0.9,
    "desiredPosition": 0.85,
    "addressNormalized": 0.9
  },
  "spans": {
    "name": { "start": 0, "end": 13 },
    "phone": { "start": 64, "end": 74 },
    "desiredPosition": { "start": 14, "end": 28 },
    "addressBlock": { "start": 120, "end": 180 }
  }
}

FEW-SHOT EXAMPLE 1 (All-caps header with inline location/phone):
INPUT:
"ROBERT COOPER
SECURITY GUARD LOS ANGELES, CA 90291, UNITED STATES 3868683442
DETAILS
1515 Pacific Ave
Los Angeles, CA 90291
United States
3868683442
email@email.com
..."

EXPECTED (abbreviated):
{
  "name": "ROBERT COOPER",
  "desiredPosition": "Security Guard",
  "email": "email@email.com",
  "phoneRaw": "3868683442",
  "phoneE164": "+13868683442",
  "phone": "+13868683442",
  "addressBlock": "1515 Pacific Ave\\nLos Angeles, CA 90291\\nUnited States",
  "addressNormalized": "Los Angeles, CA 90291, United States",
  "linkedinUrl": null,
  "confidences": { "name": 0.9, "desiredPosition": 0.85, "phone": 0.9, "addressNormalized": 0.9 },
  "spans": { "name": {"start":0,"end":13} }
}

FEW-SHOT EXAMPLE 2 (Multi-line DETAILS block):
INPUT:
"DETAILS
Jane Smith
Senior Data Scientist
221B Baker Street
London NW1 6XE
United Kingdom
+44 20 7946 0958
jane@smith.co.uk"

EXPECTED (abbreviated):
{
  "name": "Jane Smith",
  "desiredPosition": "Senior Data Scientist",
  "email": "jane@smith.co.uk",
  "phoneRaw": "+44 20 7946 0958",
  "phoneE164": "+442079460958",
  "phone": "+442079460958",
  "addressBlock": "221B Baker Street\\nLondon NW1 6XE\\nUnited Kingdom",
  "addressNormalized": "London NW1 6XE, United Kingdom",
  "linkedinUrl": null,
  "confidences": { "name": 0.9, "desiredPosition": 0.85, "phone": 0.9, "addressNormalized": 0.85 }
}

RETURN ONLY JSON. NO MARKDOWN, NO PROSE.

CV TEXT:
"""
{{cvText}}
"""
`;
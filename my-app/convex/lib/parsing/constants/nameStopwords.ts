function stripDiacritics(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function normalize(value: string): string {
  return stripDiacritics(String(value ?? "")).toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

const HEADER_STOPWORDS_LIST = [
  // English
  "profile",
  "about",
  "summary",
  "objective",
  "skills",
  "skill",
  "experience",
  "professional experience",
  "work experience",
  "employment history",
  "career",
  "education",
  "training",
  "certifications",
  "achievements",
  "accomplishments",
  "awards",
  "projects",
  "languages",
  "contacts",
  "contact",
  "links",
  "interests",
  "hobbies",
  "references",
  "driving license",
  "driving licence",
  "place of birth",

  // French
  "profil",
  "coordonnees",
  "coordonnees",
  "resume",
  "sommaire",
  "objectif",
  "competences",
  "competence",
  "competences techniques",
  "competences cle",
  "competences cles",
  "experience",
  "experiences",
  "experiences professionnelles",
  "experience professionnelle",
  "formation",
  "formations",
  "certifications",
  "langues",
  "projets",
  "realisations",
  "distinctions",
  "coordonnees",

  // German
  "profil",
  "zusammenfassung",
  "ziel",
  "kenntnisse",
  "fertigkeiten",
  "berufserfahrung",
  "arbeitserfahrung",
  "laufbahn",
  "ausbildung",
  "qualifikationen",
  "bescheinigungen",
  "sprachen",
  "projekte",
  "auszeichnungen",

  // Spanish
  "perfil",
  "resumen",
  "objetivo",
  "habilidades",
  "competencias",
  "experiencia",
  "experiencia profesional",
  "historial laboral",
  "educacion",
  "formacion",
  "certificaciones",
  "logros",
  "idiomas",
  "proyectos",
  "premios",

  // Italian & Portuguese variants
  "profilo",
  "riassunto",
  "obiettivo",
  "competenze",
  "esperienza",
  "esperienze",
  "esperienza professionale",
  "istruzione",
  "formazione",
  "certificazioni",
  "lingue",
  "progetti",
  "riconoscimenti",
  "habilidades tecnicas",
  "resumo",
  "objetivo profissional",
  "experiencia profissional",
  "formacao",
  "idiomas",
];

const GEO_STOPWORDS_LIST = [
  "mediterranean",
  "mediterranean sea",
  "atlantic",
  "atlantic ocean",
  "pacific",
  "pacific ocean",
  "indian ocean",
  "arctic",
  "caribbean",
  "baltic",
  "black sea",
  "red sea",
  "adriatic",
  "mediterranee",
  "mer mediterranee",
  "ocean atlantique",
  "ocean pacifique",
  "mediterraneo",
  "mare mediterraneo",
  "oceano atlantico",
  "oceano pacifico",
  "oceano indiano",
  "mare del nord",
  "europe",
  "asia",
  "africa",
  "america",
  "south america",
  "north america",
  "oceania",
  "australia",
  "france",
  "italy",
  "italia",
  "germany",
  "deutschland",
  "spain",
  "espana",
  "mexico",
  "brazil",
  "portugal",
  "canada",
  "india",
  "china",
  "ocean",
  "sea",
];

const HEADER_STOPWORDS = new Set(HEADER_STOPWORDS_LIST.map(normalize).filter(Boolean));
const GEO_STOPWORDS = new Set(GEO_STOPWORDS_LIST.map(normalize).filter(Boolean));

export function normalizeCandidateForStoplist(value: string): string {
  return normalize(value);
}

export function isHeaderStopword(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = normalize(value);
  if (!normalized) return false;
  if (HEADER_STOPWORDS.has(normalized)) return true;
  for (const stop of HEADER_STOPWORDS) {
    if (!stop) continue;
    if (normalized.endsWith(` ${stop}`) || normalized.startsWith(`${stop} `)) {
      return true;
    }
  }
  return false;
}

export function isGeoStopword(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = normalize(value);
  if (!normalized) return false;
  if (GEO_STOPWORDS.has(normalized)) return true;
  if (/\b(sea|ocean|river|bay|lake)\b/.test(normalized)) return true;
  return false;
}

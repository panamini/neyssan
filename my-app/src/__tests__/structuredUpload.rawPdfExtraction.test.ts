// @vitest-environment node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

type HelperPage = {
  pageNumber: number;
  width: number;
  height: number;
  text: string;
};

type HelperFixture = {
  fixture: string;
  fixturePath: string;
  pageCount: number;
  pages: HelperPage[];
  joinedText: string;
  pipelineRawText: string;
  flattening: {
    runtimeRawTextType: string;
    runtimeRawTextIsFlattenedSingleString: boolean;
    runtimeRawTextMatchesJoinedText: boolean;
    layoutPageCount: number;
    diagnosticsPageCount: number;
  };
  diagnostics: Record<string, unknown>;
};

type DiagnosticPage = HelperPage & {
  headingLikeLines: string[];
  allCapsLikeLines: string[];
  titleLikeLines: string[];
  bulletLikeLines: string[];
};

type DiagnosticFixture = Omit<HelperFixture, "pages"> & {
  pages: DiagnosticPage[];
  runtimeFlattensPagesBeforeRecovery: boolean;
};

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const pythonCommand = process.env.PYTHON ?? "python3";
const helperPath = path.join(repoRoot, "cv_parser/tests/raw_pdf_diagnostic_helper.py");

const FIXTURE_PATHS = [
  path.join(repoRoot, "cv_parser/tests/fixtures/sample_07.pdf"),
  path.join(repoRoot, "cv_parser/tests/fixtures/sample_12.pdf"),
  path.join(repoRoot, "cv_parser/tests/fixtures/golden/cv_517.pdf"),
];

function lightlyNormalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function normalizeFlattenedText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function collapseSpacedLetters(line: string): string {
  const normalized = lightlyNormalizeWhitespace(line);
  if (/^(?:[A-Za-z]\s+){3,}[A-Za-z](?:\s+[A-Za-z]{2,})*$/.test(normalized)) {
    return normalized.replace(/\s+/g, "");
  }
  return normalized;
}

function normalizeForComparison(value: string): string {
  return value
    .split("\n")
    .map((line) => collapseSpacedLetters(line))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

function extractInterestingLines(text: string): Pick<DiagnosticPage, "headingLikeLines" | "allCapsLikeLines" | "titleLikeLines" | "bulletLikeLines"> {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headingLikeLines: string[] = [];
  const allCapsLikeLines: string[] = [];
  const titleLikeLines: string[] = [];
  const bulletLikeLines: string[] = [];

  for (const line of lines) {
    const collapsed = collapseSpacedLetters(line);
    const lower = collapsed.toLowerCase();
    const words = collapsed.split(/\s+/).filter(Boolean);
    const letters = collapsed.replace(/[^A-Za-z]/g, "");
    const isAllCapsLike = letters.length >= 4 && letters === letters.toUpperCase();
    const isTitleLike =
      words.length > 0 &&
      words.length <= 8 &&
      words.every((word) => /^[A-Z][A-Za-z&'./-]*:?$/.test(word) || /^[A-Z]{2,}$/.test(word));
    const isHeadingKeyword =
      words.length <= 6 &&
      /\b(curriculum vitae|profile|objective|summary|experience|education|academic|skills|languages|references|declaration|qualification|background|dossier)\b/.test(
        lower,
      );
    const isBulletLike = /^(?:[•◦▪●○◉◆▶►➤➢✓✔>-]|o(?=\s))/u.test(line);

    if (isBulletLike) {
      bulletLikeLines.push(line);
    }
    if (isAllCapsLike) {
      allCapsLikeLines.push(line);
    }
    if (isTitleLike) {
      titleLikeLines.push(line);
    }
    if (isAllCapsLike || isTitleLike || isHeadingKeyword) {
      headingLikeLines.push(line);
    }
  }

  return {
    headingLikeLines: Array.from(new Set(headingLikeLines)),
    allCapsLikeLines: Array.from(new Set(allCapsLikeLines)),
    titleLikeLines: Array.from(new Set(titleLikeLines)),
    bulletLikeLines: Array.from(new Set(bulletLikeLines)),
  };
}

function runRawPdfDiagnostic(fixtures: string[]): DiagnosticFixture[] {
  const stdout = execFileSync(pythonCommand, [helperPath, ...fixtures], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const parsed = JSON.parse(stdout) as HelperFixture[];
  return parsed.map((fixture) => ({
    ...fixture,
    pages: fixture.pages.map((page) => ({
      ...page,
      ...extractInterestingLines(page.text),
    })),
    runtimeFlattensPagesBeforeRecovery:
      fixture.pageCount > 1 &&
      fixture.flattening.runtimeRawTextIsFlattenedSingleString &&
      normalizeFlattenedText(fixture.pipelineRawText) === normalizeFlattenedText(fixture.joinedText) &&
      !fixture.flattening.runtimeRawTextMatchesJoinedText,
  }));
}

function renderFixtureReport(fixture: DiagnosticFixture): string {
  const pages = fixture.pages
    .map((page) => {
      const pageHeader = `Page ${page.pageNumber}/${fixture.pageCount}`;
      return [
        pageHeader,
        `headingLikeLines=${JSON.stringify(page.headingLikeLines, null, 2)}`,
        `allCapsLikeLines=${JSON.stringify(page.allCapsLikeLines, null, 2)}`,
        `titleLikeLines=${JSON.stringify(page.titleLikeLines, null, 2)}`,
        `bulletLikeLines=${JSON.stringify(page.bulletLikeLines, null, 2)}`,
        "text:",
        page.text,
      ].join("\n");
    })
    .join("\n\n====\n\n");

  return [
    `Fixture: ${fixture.fixture}`,
    `fixturePath: ${path.relative(repoRoot, fixture.fixturePath)}`,
    `pageCount: ${fixture.pageCount}`,
    `joinedTextLength: ${fixture.joinedText.length}`,
    `pipelineRawTextLength: ${fixture.pipelineRawText.length}`,
    `runtimeFlattensPagesBeforeRecovery: ${fixture.runtimeFlattensPagesBeforeRecovery}`,
    `flattening: ${JSON.stringify(fixture.flattening, null, 2)}`,
    "",
    pages,
  ].join("\n");
}

describe("structuredUpload plain-PDF raw extraction diagnostics", () => {
  // Diagnostic intent:
  // - This traces the actual plain PDF structured-import path, not the OCR path.
  // - UI route: StructuredUploadButton -> structuredUpload action -> parser service run_pipeline(mode=auto).
  // - For text PDFs, the parser service goes through cv_parser.pipeline.runner.run_pipeline ->
  //   cv_parser.extract.text_pdf.extract_text_pdf -> _reconstruct_page_text(page).
  // - If headings are visible here, later loss happens during segmentation/mapping/recovery.
  // - If headings are already garbled here, the issue starts at raw extraction.

  it("captures raw page-level text, heading-like lines, bullet-like lines, and flattening signals from real fixture PDFs", () => {
    FIXTURE_PATHS.forEach((fixturePath) => {
      expect(existsSync(fixturePath)).toBe(true);
    });
    expect(existsSync(helperPath)).toBe(true);

    const diagnostics = runRawPdfDiagnostic(FIXTURE_PATHS);

    const sample07 = diagnostics.find((fixture) => fixture.fixture === "sample_07.pdf");
    const sample12 = diagnostics.find((fixture) => fixture.fixture === "sample_12.pdf");
    const cv517 = diagnostics.find((fixture) => fixture.fixture === "cv_517.pdf");

    expect(sample07).toBeTruthy();
    expect(sample12).toBeTruthy();
    expect(cv517).toBeTruthy();

    for (const fixture of diagnostics) {
      expect(fixture.pages.length).toBe(fixture.pageCount);
      expect(fixture.joinedText.length).toBeGreaterThan(200);
      expect(fixture.flattening.layoutPageCount).toBe(fixture.pageCount);
      expect(fixture.flattening.diagnosticsPageCount).toBe(fixture.pageCount);
      expect(normalizeFlattenedText(fixture.pipelineRawText)).toBe(
        normalizeFlattenedText(fixture.joinedText),
      );
    }

    expect(normalizeForComparison(sample07?.joinedText ?? "")).toContain("CURRICULUM VITAE");
    expect(normalizeForComparison(sample07?.joinedText ?? "")).toContain("PROFESSIONAL PROFILE");

    expect(sample12?.pageCount).toBeGreaterThan(1);
    expect(normalizeForComparison(sample12?.joinedText ?? "")).toContain("PERSONAL DOSSIER");
    expect(normalizeForComparison(sample12?.joinedText ?? "")).toContain("ACADEMIC CREDENTIALS");
    expect(normalizeForComparison(sample12?.joinedText ?? "")).toContain("PROFESSIONAL SKILLS");

    expect(cv517?.pageCount).toBeGreaterThan(1);
    expect(normalizeForComparison(cv517?.joinedText ?? "")).toContain("OBJECTIVE");
    expect(normalizeForComparison(cv517?.joinedText ?? "")).toContain("PROFESSIONALSUMMARY");
    expect(normalizeForComparison(cv517?.joinedText ?? "")).toContain("ACADEMICQUALIFICATION");

    expect(sample12?.runtimeFlattensPagesBeforeRecovery).toBe(true);
    expect(cv517?.runtimeFlattensPagesBeforeRecovery).toBe(true);

    // Current diagnostic conclusion from these fixtures:
    // - Page boundaries are available at extraction time and remain in layout metadata.
    // - The runtime text extractor also flattens those pages into one raw string before parser/recovery.
    // - sample_07/sample_12 keep readable headings at raw extraction, so later structure loss would be downstream.
    // - cv_517 already shows spaced-letter degradation at raw extraction, so at least part of the trust problem starts before recovery routing.
    expect(diagnostics.map(renderFixtureReport).join("\n\n==========\n\n")).toMatchInlineSnapshot(`
      "Fixture: sample_07.pdf
      fixturePath: cv_parser/tests/fixtures/sample_07.pdf
      pageCount: 1
      joinedTextLength: 1012
      pipelineRawTextLength: 1012
      runtimeFlattensPagesBeforeRecovery: false
      flattening: {
        "runtimeRawTextType": "str",
        "runtimeRawTextIsFlattenedSingleString": true,
        "runtimeRawTextMatchesJoinedText": true,
        "layoutPageCount": 1,
        "diagnosticsPageCount": 1
      }

      Page 1/1
      headingLikeLines=[
        "CURRICULUM VITAE",
        "MOHAMMAD JAMSHED",
        "ADDR.- B-441,INDER ENCLAVE PHASE-1,KIRARI SULEMAN NAGAR, NORTH",
        "WEST DELHI - 110086",
        "MOBILE : +91 8802876921(AIRTEL)",
        "POST APPLIED FOR: STORE KEEPER",
        "PROFESSIONAL PROFILE:",
        "PERSONAL EXPERIENCE:",
        "PERSONAL BACKGROUND:",
        "EDUCATION BACKGROUND:",
        "LANGUAGES",
        "DECLARATION",
        "MOHAMMED JAMSHED"
      ]
      allCapsLikeLines=[
        "CURRICULUM VITAE",
        "MOHAMMAD JAMSHED",
        "ADDR.- B-441,INDER ENCLAVE PHASE-1,KIRARI SULEMAN NAGAR, NORTH",
        "WEST DELHI - 110086",
        "MOBILE : +91 8802876921(AIRTEL)",
        "POST APPLIED FOR: STORE KEEPER",
        "PROFESSIONAL PROFILE:",
        "PERSONAL EXPERIENCE:",
        "PERSONAL BACKGROUND:",
        "EDUCATION BACKGROUND:",
        "LANGUAGES",
        "DECLARATION",
        "MOHAMMED JAMSHED"
      ]
      titleLikeLines=[
        "CURRICULUM VITAE",
        "MOHAMMAD JAMSHED",
        "POST APPLIED FOR: STORE KEEPER",
        "PROFESSIONAL PROFILE:",
        "PERSONAL EXPERIENCE:",
        "PERSONAL BACKGROUND:",
        "EDUCATION BACKGROUND:",
        "LANGUAGES",
        "DECLARATION",
        "MOHAMMED JAMSHED"
      ]
      bulletLikeLines=[
        " 3 year Experience in store keeper",
        " ( Qatar Technical aluminum company)",
        ">: 10+2 (Intermediate)",
        ">: Basic computer knowledge"
      ]
      text:
      CURRICULUM VITAE
      MOHAMMAD JAMSHED
      ADDR.- B-441,INDER ENCLAVE PHASE-1,KIRARI SULEMAN NAGAR, NORTH
      WEST DELHI - 110086
      MOBILE : +91 8802876921(AIRTEL)
      :+917992204995 (JIO)
      Email : mohdjamshed.786jems@gmail.com
      POST APPLIED FOR: STORE KEEPER
      PROFESSIONAL PROFILE:
      To Work in an environment which offers a good opportunity to share my knowledge
      and skills with other and participant my self and work towards for a compete satisfaction
      of the company.
      PERSONAL EXPERIENCE:
       3 year Experience in store keeper
       ( Qatar Technical aluminum company)
      PERSONAL BACKGROUND:
      Name : MOHAMMAD JAMSHED
      Date of Birth : 04/08/1982
      Sex : Male
      Marital Status : Married
      Nationality : India
      Passport No : J1198564
      Issue Date : 11/05/2010
      Expiry Date : 10/05/2020
      EDUCATION BACKGROUND:
      >: 10+2 (Intermediate)
      >: Basic computer knowledge
      LANGUAGES
      English,Hindi,Urdu
      DECLARATION
      I Herby declare That the above Given details are true and correct to the best of my
      knowledge please consider my humble request and oblige.
      MOHAMMED JAMSHED

      ==========

      Fixture: sample_12.pdf
      fixturePath: cv_parser/tests/fixtures/sample_12.pdf
      pageCount: 3
      joinedTextLength: 1214
      pipelineRawTextLength: 1212
      runtimeFlattensPagesBeforeRecovery: true
      flattening: {
        "runtimeRawTextType": "str",
        "runtimeRawTextIsFlattenedSingleString": true,
        "runtimeRawTextMatchesJoinedText": false,
        "layoutPageCount": 3,
        "diagnosticsPageCount": 3
      }

      Page 1/3
      headingLikeLines=[
        "ARUN KUMAR U.C.",
        "PERSONAL DOSSIER",
        "VILAYODI POST",
        "PALAKKAD",
        "Languages Known : Malayalam, English, Tamil",
        "ACADEMIC CREDENTIALS",
        "Year",
        "Sl. College/",
        "Course University/ Board Of",
        "No Institution",
        "Passing",
        "Victoria",
        "History University",
        "Palakkad",
        "Higher Secondary",
        "School",
        "IT FORTE",
        "M.S Office"
      ]
      allCapsLikeLines=[
        "ARUN KUMAR U.C.",
        "PERSONAL DOSSIER",
        "VILAYODI POST",
        "PALAKKAD",
        "ACADEMIC CREDENTIALS",
        "IT FORTE"
      ]
      titleLikeLines=[
        "ARUN KUMAR U.C.",
        "PERSONAL DOSSIER",
        "VILAYODI POST",
        "PALAKKAD",
        "ACADEMIC CREDENTIALS",
        "Year",
        "Sl. College/",
        "Course University/ Board Of",
        "No Institution",
        "Passing",
        "Victoria",
        "History University",
        "Palakkad",
        "Higher Secondary",
        "School",
        "IT FORTE",
        "M.S Office"
      ]
      bulletLikeLines=[]
      text:
      ARUN KUMAR U.C.
      Mob:+91 9745004628 Email: arunkumar.uc@stfc.in
      PERSONAL DOSSIER
      Address : UPPUKARANCHALLA
      VILAYODI POST
      PALAKKAD
      PIN-678103
      Date of Birth : 25/02/1983
      Gender : Male
      Marital Status : Single
      Languages Known : Malayalam, English, Tamil
      ACADEMIC CREDENTIALS
      Year
      Sl. College/
      Course University/ Board Of
      No Institution
      Passing
      Victoria
      Bachelor of Arts- Calicut
      1 college, 2004
      History University
      Palakkad
      Higher Secondary
      2 2001
      School
      IT FORTE
      M.S Office
      
      Windows XP and Internet
      

      ====

      Page 2/3
      headingLikeLines=[
        "PROFESSIONAL SKILLS",
        "Good writing and presentation Skills",
        "EXPERIENCE",
        "REFERENCES",
        "Mr. Baiju KS",
        "DECLARATION",
        "Place: Thrissur"
      ]
      allCapsLikeLines=[
        "PROFESSIONAL SKILLS",
        "EXPERIENCE",
        "REFERENCES",
        "DECLARATION"
      ]
      titleLikeLines=[
        "PROFESSIONAL SKILLS",
        "EXPERIENCE",
        "REFERENCES",
        "Mr. Baiju KS",
        "DECLARATION",
        "Place: Thrissur"
      ]
      bulletLikeLines=[
        "• Worked at ICICI Bank, Palakkad from 2004-2006",
        "• Worked at Shriram Transport Finance Company. Ltd. From 2006-"
      ]
      text:
      PROFESSIONAL SKILLS
      Good communication, interpersonal and problem solving skills
      
      Good writing and presentation Skills
      
      Work effectively both as a team member and independently
      
      Accomplish projects with little supervision
      
      Expressive writer and fluent speaker
      
      EXPERIENCE
      • Worked at ICICI Bank, Palakkad from 2004-2006
      • Worked at Shriram Transport Finance Company. Ltd. From 2006-
      Present. Currently working as Branch Manager at Irinjalakuda
      Branch, Kerala
      REFERENCES
      Mr. Baiju KS
      Regional Business Head, STFC
      Ph:+91 9745553222
      DECLARATION
      I do hereby declare that all above mentioned information are true and
      correct to the best of knowledge
      Place: Thrissur

      ====

      Page 3/3
      headingLikeLines=[]
      allCapsLikeLines=[]
      titleLikeLines=[]
      bulletLikeLines=[]
      text:
      D a t e : 3 . 0 6 . 2 0 1 7 A r u n K u m a r U C

      ==========

      Fixture: cv_517.pdf
      fixturePath: cv_parser/tests/fixtures/golden/cv_517.pdf
      pageCount: 4
      joinedTextLength: 10813
      pipelineRawTextLength: 10810
      runtimeFlattensPagesBeforeRecovery: true
      flattening: {
        "runtimeRawTextType": "str",
        "runtimeRawTextIsFlattenedSingleString": true,
        "runtimeRawTextMatchesJoinedText": false,
        "layoutPageCount": 4,
        "diagnosticsPageCount": 4
      }

      Page 1/4
      headingLikeLines=[
        "A r o c k i a",
        "J u s l i n D e e p a n",
        "O B J E C T I V E",
        "S e e k i n g a p o s i t i o n a s P r o j e c t E n g i n e e r w i t h a r e p u t e d o r g a n i z a t i o n w h e r e I c a n c o n t r i b u t e a n d",
        "P R O F E S S I O N A L S U M M A R Y",
        "P o s s e s s v a l i d U A E d r i v i n g l i c e n c e",
        "H a v e t h o r o u g h k n o w l e d g e o n M E P e l e c t r i c a l i n s t a l l a t i o n",
        "P R O F E S S I O N A L E X P E R I E N C E",
        "P r o j e c t H a n d l e d",
        "P V P R O J E C T S",
        "C O N S T R U C T I O N",
        "F A C I L I T Y A N D M A I N T E N A N C E"
      ]
      allCapsLikeLines=[
        "O B J E C T I V E",
        "P R O F E S S I O N A L S U M M A R Y",
        "P R O F E S S I O N A L E X P E R I E N C E",
        "P V P R O J E C T S",
        "C O N S T R U C T I O N",
        "F A C I L I T Y A N D M A I N T E N A N C E"
      ]
      titleLikeLines=[
        "A r o c k i a",
        "J u s l i n D e e p a n",
        "O B J E C T I V E",
        "S e e k i n g a p o s i t i o n a s P r o j e c t E n g i n e e r w i t h a r e p u t e d o r g a n i z a t i o n w h e r e I c a n c o n t r i b u t e a n d",
        "P R O F E S S I O N A L S U M M A R Y",
        "P o s s e s s v a l i d U A E d r i v i n g l i c e n c e",
        "H a v e t h o r o u g h k n o w l e d g e o n M E P e l e c t r i c a l i n s t a l l a t i o n",
        "P R O F E S S I O N A L E X P E R I E N C E",
        "P r o j e c t H a n d l e d",
        "P V P R O J E C T S",
        "C O N S T R U C T I O N",
        "F A C I L I T Y A N D M A I N T E N A N C E"
      ]
      bulletLikeLines=[
        "o 7 + y e a r s o f e x p e r i e n c e a s E l e c t r i c a l E n g i n e e r i n U A E & I n d i a .",
        "o R e g i s t e r e d m e m b e r i n S o c i e t y o f e n g i n e e r i n g",
        "o O r g a n i z e d k n o w l e d g e i n p r o j e c t c o o r d i n a t i o n , p r o p o s a l s u b m i s s i o n , B O Q , R F I s , P C R s",
        "o P o s s e s s a n a l y t i c k n o w l e d g e o n A r c h i t e c t u r e a n d E l e c t r i c a l d e s i g n",
        "o P o s s e s s t h e e n o u g h k n o w l e d g e i n H V m a i n t e n a n c e & O p e r a t i o n s @ 1 1 K V S u b s t a t i o n",
        "o H o l d a B a c h e l o r o f E n g i n e e r i n g ( B E ) i n e l e c t r i c a l & E l e c t r o n i c s .",
        "o S e l f - m o t i v a t e d , c o m f o r t a b l e i n t a k i n g i n i t i a t i v e a n d w o r k i n g i n d e p e n d e n t l y .",
        "o E x c e l l e n t c o m m u n i c a t i o n s k i l l s i n E n g l i s h , H i n d i , T a m i l & M a l a y a l a m ."
      ]
      text:
      A r o c k i a
      J u s l i n D e e p a n
      D u b a i , U A E
      M o b i l e : 9 7 1 5 5 8 0 5 8 3 7 5
      E m a i l : d e e p a n e e e 2 0 1 0 @ g m a i l . c o m
      O B J E C T I V E
      S e e k i n g a p o s i t i o n a s P r o j e c t E n g i n e e r w i t h a r e p u t e d o r g a n i z a t i o n w h e r e I c a n c o n t r i b u t e a n d
      u t i l i z e m y k n o w l e d g e & s k i l l s f o r m u t u a l g r o w t h .
      P R O F E S S I O N A L S U M M A R Y
      o 7 + y e a r s o f e x p e r i e n c e a s E l e c t r i c a l E n g i n e e r i n U A E & I n d i a .
      P o s s e s s v a l i d U A E d r i v i n g l i c e n c e
      o
      o R e g i s t e r e d m e m b e r i n S o c i e t y o f e n g i n e e r i n g
      T h r o u g h e x p e r t i s e i n p r o j e c t s - e l e c t r i c a l e n g i n e e r i n g , i n s t a l l a t i o n o f c o n d u i t s , c a b l e s e t c .
      o
      o O r g a n i z e d k n o w l e d g e i n p r o j e c t c o o r d i n a t i o n , p r o p o s a l s u b m i s s i o n , B O Q , R F I s , P C R s
      H a v e t h o r o u g h k n o w l e d g e o n M E P e l e c t r i c a l i n s t a l l a t i o n
      o
      o P o s s e s s a n a l y t i c k n o w l e d g e o n A r c h i t e c t u r e a n d E l e c t r i c a l d e s i g n
      H a v e w e l l o r g a n i s e d k n o w l e d g e i n F a c i l i t y M a n a g e m e n t , h i g h r i s e b u i l d i n g f a c i l i t y a n d
      o
      m a i n t e n a n c e o p e r a t i o n , s y s t e m a n d e q u i p m e n t ’ s m a i n t e n a n c e .
      o P o s s e s s t h e e n o u g h k n o w l e d g e i n H V m a i n t e n a n c e & O p e r a t i o n s @ 1 1 K V S u b s t a t i o n
      H a v e g o o d k n o w l e d g e a b o u t t h e L V p a n e l s e r e c t i o n @ 1 1 k V S u b s t a t i o n
      o
      o H o l d a B a c h e l o r o f E n g i n e e r i n g ( B E ) i n e l e c t r i c a l & E l e c t r o n i c s .
      H o l d a D i p l o m a i n A u t o C A D .
      o
      o S e l f - m o t i v a t e d , c o m f o r t a b l e i n t a k i n g i n i t i a t i v e a n d w o r k i n g i n d e p e n d e n t l y .
      C a n w o r k u n d e r p r e s s u r e a n d m e e t d e a d l i n e s .
      o
      o E x c e l l e n t c o m m u n i c a t i o n s k i l l s i n E n g l i s h , H i n d i , T a m i l & M a l a y a l a m .
      P R O F E S S I O N A L E X P E R I E N C E
      P r o j e c t H a n d l e d
      P V P R O J E C T S
      P V B r i d g e s a n d s h o o t e r s , 4 . 3 M W p K A M E , M a k k a h , S a u d i A r a b i a
      C O N S T R U C T I O N
      M a t a f l i g h t i n g & S h a m i y a h E x p a n s i o n K A M E , M a k k a h , S a u d i A r a b i a
      L V 1 1 K V s u b s t a t i o n ( A T S & L V P a n e l P o w e r t e c h , C h e n n a i , I n d i a
      I n s t a l l a t i o n )
      F A C I L I T Y A N D M A I N T E N A N C E
      1 8 S t o r i e d x 2 , h i g h r i s e t o w e r D a m a c P r o p e r t i e s , B u s i n e s s b a y , D u b a i
      3 0 s t o r i e d h i g h r i s e t o w e r ( M a n c h e s t e r t o w e r ) D u b a i M a r i n a , D u b a i
      1 0 s t o r i e d c o m m e r c i a l t o w e r ( A l k h o r p l a z a ) B i n T a m i m , A l k h o r , D u b a i
      4 0 S t o r i e d h i g h r i s e t o w e r , O 2 r e s i d e n c e O p e n e y e , J L T , D u b a i
      G + 2 x 1 8 B u i l d i n g , J w i n S t a f f A c c o m o d a t i o n I D A M A , M u h a i s n a - 2 , D u b a i

      ====

      Page 2/4
      headingLikeLines=[
        "Responsibilities:"
      ]
      allCapsLikeLines=[]
      titleLikeLines=[
        "Responsibilities:"
      ]
      bulletLikeLines=[
        " Monitor compliance to applicable codes, practices, QA/QC policies,",
        " Interact daily with the clients to interpret their needs and requirements and",
        " Review tender package, plans/drawings to make sure accuracy, completeness",
        " Compare the electrical/architectural project plans design whether matching with",
        " Coordinate site works include cable pulling, installing conduits, installation of",
        " Perform overall quality control of the work schedule, plans, and report regularly",
        " Cooperate and communicate effectively with project managers and other project",
        " Planning to find out solution for unexpected errors as they occur in the site.",
        " Analyse the design and material proposals, matching to the international",
        " Prepare project technical proposals and coordinate approvals and permits, prior",
        " Make clarification to the comments on the material submission to the",
        " Raise RFIs for the unclear task in the projects and make sure, all norms",
        " Coordinate with sub-contractors and supplier for the right type of materials,",
        " Attending technical &MEP meeting discussing the progressive of the project",
        " Creating the Bill of Quantities (BOQ)",
        " Raise the project change request (PCR) if necessary",
        " Schedule meeting with supplier to discuss about the material’s quality and",
        " Pre checking installation electrical luminaires in the factory",
        " Attending technical & progress review meetings with client/consultant to discuss about",
        " Prepare the project proposal analysing the equipment’s and loads and man power"
      ]
      text:
      10 Storied x 2 commercial tower CBRE, Chennai, India
      Current Position: Project engineer- Electrical
      Employer : Premier composite technology (DIP-2, Dubai)
      Tenure : February-2015 to still working
      Responsibilities:
       Monitor compliance to applicable codes, practices, QA/QC policies,
      performance standards and specifications.
       Interact daily with the clients to interpret their needs and requirements and
      represent them in the field.
       Review tender package, plans/drawings to make sure accuracy, completeness
      and conduct site inspection, check matching tenders.
       Compare the electrical/architectural project plans design whether matching with
      tender specs, prior to the site installation.
       Coordinate site works include cable pulling, installing conduits, installation of
      boxes, monitor electrical panel erection.
       Perform overall quality control of the work schedule, plans, and report regularly
      on project status.
       Cooperate and communicate effectively with project managers and other project
      participants to provide assistance and technical support.
       Planning to find out solution for unexpected errors as they occur in the site.
       Analyse the design and material proposals, matching to the international
      standards
       Prepare project technical proposals and coordinate approvals and permits, prior
      to installation at the site, make sure the standards followed
       Make clarification to the comments on the material submission to the
      consultants
       Raise RFIs for the unclear task in the projects and make sure, all norms
      followed based on tender specs
       Coordinate with sub-contractors and supplier for the right type of materials,
      which match international standards and tender specs
       Attending technical &MEP meeting discussing the progressive of the project
      architecture and electrical design.
       Creating the Bill of Quantities (BOQ)
       Raise the project change request (PCR) if necessary
       Schedule meeting with supplier to discuss about the material’s quality and
      supply
       Pre checking installation electrical luminaires in the factory
      Position held: MEP / Facility Engineer
      Employer : Palmon Group of companies (Jabel Ali, Dubai)
      Tenure : January 2013 to January 2015
      Responsibilities:
       Attending technical & progress review meetings with client/consultant to discuss about
      the project progress and bottleneck, if any.
       Prepare the project proposal analysing the equipment’s and loads and man power
      calculating for the successful operation

      ====

      Page 3/4
      headingLikeLines=[
        "Responsibilities:"
      ]
      allCapsLikeLines=[]
      titleLikeLines=[
        "Responsibilities:"
      ]
      bulletLikeLines=[
        " Able to demonstrate skills and knowledge in installation and servicing MEP assets and",
        " Interpreting HVAC, Electrical, Plumbing, Mechanical, BMS and Electronics system, and",
        " Planning to Troubleshoot day today building operations, engineering and systems and",
        " Verify the load schedule and alter that as per the (Future load) requirements, following",
        " Monitor job sites, one time projects assuring safety measures following the risk",
        " Interact/work well with tenants, professional staff, vendors, subcontractors, laborers, craft",
        " Ensure that contractor understands the contract documents including drawings / specs,",
        " Coordinate with consultant on reviews for shop drawings, MEP related designs, HVAC,",
        " Perform the tasks of preparing reports on daily activities, work progress, weekly, monthly",
        " Ensure MEP Subcontractors adhere with relevant Quality records /regulations including",
        " Monitor & report MEP work progress",
        " Review drawings submitted by main contractor & verify bill of quantities",
        " Review contractor monthly progress valuation of MEP work prior to invoicing",
        " Verify contractor valuation invoices",
        " Troubleshooting in maintenance of electrical systems which include Diesel",
        " Daily, weekly and monthly maintenance on Generators including, performing PPM on",
        " B Check performance on Generator on every 300 hours running basis",
        " Semi synchronizing of multi diesel generator in the time of power failure",
        " Trial run on DG operation and performance on daily basis",
        " Transformer monitoring and maintenance on daily and monthly schedules",
        " VCB monitoring and performance analysis on daily basis and maintenance in schedules hours",
        " Trouble shooting the break downs in lighting control circuits",
        " PPM on switch gears and HV & LV equipment’s based on scheduled hours",
        " UPS and Inverter operation monitoring and maintenance",
        " Duties will be at the Tower handling the day to day problems and looking after the",
        " Troubleshooting problems related to Electrical and Electronic Equipment",
        " Identifying areas of obstruction/breakdowns and taking steps to rectify the equipment’s.",
        " Trial run on firefighting engines on every week"
      ]
      text:
       Able to demonstrate skills and knowledge in installation and servicing MEP assets and
      mechanical equipment.
       Interpreting HVAC, Electrical, Plumbing, Mechanical, BMS and Electronics system, and
      replacing faulty operational and safety control systems and spare parts.
       Planning to Troubleshoot day today building operations, engineering and systems and
      equipment maintenance, total MEP operation.
       Verify the load schedule and alter that as per the (Future load) requirements, following
      DEWA codes and regulation for the new installation on the existing system.
       Monitor job sites, one time projects assuring safety measures following the risk
      assessment and the method of statement, technical data.
       Interact/work well with tenants, professional staff, vendors, subcontractors, laborers, craft
      persons and other workers to carry out daily maintenance in the buildings
       Ensure that contractor understands the contract documents including drawings / specs,
      phase plans, MEP systems interrelationships, workflow & schedule
       Coordinate with consultant on reviews for shop drawings, MEP related designs, HVAC,
      Fire Alarm / Fighting & provide solution options
       Perform the tasks of preparing reports on daily activities, work progress, weekly, monthly
      facility management, accidents and material report
       Ensure MEP Subcontractors adhere with relevant Quality records /regulations including
      safety
       Monitor & report MEP work progress
       Review drawings submitted by main contractor & verify bill of quantities
       Review contractor monthly progress valuation of MEP work prior to invoicing
       Verify contractor valuation invoices
      Position held: Shift Engineer-Electrical
      Employer :CBRE -Goms Electrical Company, India
      Tenure : November 2011– October 2012
      Responsibilities:
       Troubleshooting in maintenance of electrical systems which include Diesel
      Generators(2250KVA & 1010KVA), Transformers(2000KVA two no’s at 11KV/105A
      433V/2667A substation), LV & HV switch gears VFD, UPS & lighting control in high
      rise building
       Daily, weekly and monthly maintenance on Generators including, performing PPM on
      scheduled basis
       B Check performance on Generator on every 300 hours running basis
       Semi synchronizing of multi diesel generator in the time of power failure
       Trial run on DG operation and performance on daily basis
       Transformer monitoring and maintenance on daily and monthly schedules
       VCB monitoring and performance analysis on daily basis and maintenance in schedules hours
       Trouble shooting the break downs in lighting control circuits
       PPM on switch gears and HV & LV equipment’s based on scheduled hours
       UPS and Inverter operation monitoring and maintenance
       Duties will be at the Tower handling the day to day problems and looking after the
      maintenance staff detailed at the tower MEP/ Electrical, sewage treatment plant.
       Troubleshooting problems related to Electrical and Electronic Equipment
       Identifying areas of obstruction/breakdowns and taking steps to rectify the equipment’s.
       Trial run on firefighting engines on every week

      ====

      Page 4/4
      headingLikeLines=[
        "A C A D E M I C Q U A L I F I C A T I O N",
        "T E C H N I C A L S K I L L S",
        "T e c h n i c a l P r o f i c i e n c y",
        "P e r s o n a l D e t a i l s"
      ]
      allCapsLikeLines=[
        "A C A D E M I C Q U A L I F I C A T I O N",
        "T E C H N I C A L S K I L L S"
      ]
      titleLikeLines=[
        "A C A D E M I C Q U A L I F I C A T I O N",
        "T E C H N I C A L S K I L L S",
        "T e c h n i c a l P r o f i c i e n c y",
        "P e r s o n a l D e t a i l s"
      ]
      bulletLikeLines=[
        " S u b m i t t i n g m o n t h l y / w e e k l y / d a i l y p r e v e n t i v e a n d r e a c t i v e m a i n t e n a n c e r e p o r t",
        " R O p l a n t m o n i t o r i n g a n d m a i n t e n a n c e",
        " A n a l y s e t h e a r c h i t e c t u r e d e s i g n d r a w i n g a n d p l a n n i n g t h e i n s t a l l a t i o n",
        " S t u d y i n g t h e D W G a n d e x p l a i n i n g t h e c o - w o r k e r s f o r t h e e r e c t i o n o f t h e p a n e l s",
        " M o n i t o r t h e i n s t a l l a t i o n t e a m f o r t h e p r o p e r e r e c t i o n o f L V P a n e l s",
        " Q u a l i t y c h e c k a f t e r t h e i n s t a l l a t i o n o f L V p a n e l s",
        " T o r q u e t e s t f o r t h e b u s b a r s i n t h e L V p a n e l s",
        " C a b l e t e r m i n a t i o n i n t h e L V p a n e l s a s p e r t h e t e c h n i c a l d a t a",
        " E l e c t r i c a l C i r c u i t s",
        " C i r c u i t B r e a k e r s",
        " I n d u c t i o n M o t o r s",
        " M o t o r S t a r t e r s",
        " D C A D D – A u t o C A D",
        " S m a r t s h e e t a p p l i c a t i o n , B o x a p p l i c a t i o n",
        " M i c r o s o f t o f f i c e 2 0 0 3 , 2 0 0 7 & 2 0 1 0 o p e n o f f i c e",
        " P o w e r p o i n t & P h o t o S h o p"
      ]
      text:
       S u b m i t t i n g m o n t h l y / w e e k l y / d a i l y p r e v e n t i v e a n d r e a c t i v e m a i n t e n a n c e r e p o r t
       R O p l a n t m o n i t o r i n g a n d m a i n t e n a n c e
      P o s i t i o n h e l d : S i t e E n g i n e e r
      E m p l o y e r : P o w e r t e c h P v t l t d , I n d i a
      T e n u r e : S e p t e m b e r 2 0 1 0 – A u g u s t 2 0 1 1
      R e s p o n s i b i l i t i e s :
       A n a l y s e t h e a r c h i t e c t u r e d e s i g n d r a w i n g a n d p l a n n i n g t h e i n s t a l l a t i o n
       S t u d y i n g t h e D W G a n d e x p l a i n i n g t h e c o - w o r k e r s f o r t h e e r e c t i o n o f t h e p a n e l s
       M o n i t o r t h e i n s t a l l a t i o n t e a m f o r t h e p r o p e r e r e c t i o n o f L V P a n e l s
       Q u a l i t y c h e c k a f t e r t h e i n s t a l l a t i o n o f L V p a n e l s
       T o r q u e t e s t f o r t h e b u s b a r s i n t h e L V p a n e l s
       C a b l e t e r m i n a t i o n i n t h e L V p a n e l s a s p e r t h e t e c h n i c a l d a t a
      A C A D E M I C Q U A L I F I C A T I O N
       B a c h e l o r o f E n g i n e e r i n g ( B . E ) w i t h f i r s t c l a s s i n E l e c t r i c a l & E l e c t r o n i c s f r o m A n n a
      U n i v e r s i t y , I n d i a ( A u g u s t 2 0 0 6 - A p r i l 2 0 1 0 )
      T E C H N I C A L S K I L L S
       E l e c t r i c a l C i r c u i t s
       C i r c u i t B r e a k e r s
       I n d u c t i o n M o t o r s
       M o t o r S t a r t e r s
      T e c h n i c a l P r o f i c i e n c y
       D C A D D – A u t o C A D
       S m a r t s h e e t a p p l i c a t i o n , B o x a p p l i c a t i o n
       M i c r o s o f t o f f i c e 2 0 0 3 , 2 0 0 7 & 2 0 1 0 o p e n o f f i c e
       P o w e r p o i n t & P h o t o S h o p
      P e r s o n a l D e t a i l s
      D a t e o f B i r t h , A g e : 2 0 t h O c t o b e r 1 9 8 5
      N a t i o n a l i t y : I n d i a n
      C i v i l S t a t u s : M a r r i e d
      V i s a S t a t u s : E m p l o y m e n t V i s a
      L a n g u a g e K n o w n : E n g l i s h , H i n d i , T a m i l , M a l a y a l a m"
    `);
  });
});

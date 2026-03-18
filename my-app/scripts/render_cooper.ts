import { readFileSync } from 'node:fs';
import { canonicalizeParserResult } from '../convex/lib/parsing/canonicalize';
import { buildTypedSectionsFromNormalized } from '../src/utils/cv/mapping-utils';

type ResultFixture = {
  normalized: any;
  rawSections?: any;
  result?: any;
};

const fixturePath = '../my-app/convex/lib/parsing/__tests__/fixtures/robert_cooper.json';
const raw: ResultFixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

const context = { rawText: raw.normalized?.rawText ?? '', mode: 'text', parserUrl: '' };
const canonical = canonicalizeParserResult(raw, context as any);
const normalized = canonical.normalized as any;
const sections = buildTypedSectionsFromNormalized(normalized);

const findSection = (type: string) => sections.find((section) => String(section.type) === type) ?? null;

const output = {
  summary: findSection('summary')?.structuredContent ?? normalized?.summary ?? null,
  experience: findSection('experience')?.structuredContent ?? null,
  education: findSection('education')?.structuredContent ?? null,
  languages: findSection('languages')?.structuredContent ?? null,
  profile: findSection('profile')?.structuredContent ?? null,
  diagnostics: canonical.diagnostics ?? null,
};

console.log(JSON.stringify(output, null, 2));

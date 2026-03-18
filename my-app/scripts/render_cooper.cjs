require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true,
    resolveJsonModule: true,
  },
});

const { readFileSync } = require('fs');
const { canonicalizeParserResult } = require('../convex/lib/parsing/canonicalize');
const { buildTypedSectionsFromNormalized } = require('../src/utils/cv/mapping-utils');

const fixturePath = '../my-app/convex/lib/parsing/__tests__/fixtures/robert_cooper.json';
const raw = JSON.parse(readFileSync(fixturePath, 'utf-8'));
const context = { rawText: raw.normalized?.rawText ?? '', mode: 'text', parserUrl: '' };
const canonical = canonicalizeParserResult(raw, context);
const normalized = canonical.normalized;
const sections = buildTypedSectionsFromNormalized(normalized);

const findSection = (type) => sections.find((section) => String(section.type) === type) || null;

const output = {
  summary: findSection('summary')?.structuredContent ?? normalized?.summary ?? null,
  experience: findSection('experience')?.structuredContent ?? null,
  education: findSection('education')?.structuredContent ?? null,
  languages: findSection('languages')?.structuredContent ?? null,
  profile: findSection('profile')?.structuredContent ?? null,
  diagnostics: canonical.diagnostics ?? null,
};

console.log(JSON.stringify(output, null, 2));

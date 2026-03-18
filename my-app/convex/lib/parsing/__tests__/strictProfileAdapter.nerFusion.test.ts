import { describe, it, expect } from 'vitest';
import { mapParsedToStrict } from '../../parsing/strictProfileAdapter';

describe('strictProfileAdapter NER fusion for location and desiredPosition', () => {
  const rawText = [
    'Jane Doe',
    'Senior Engineer',
    'Email: jane@example.com',
    'Phone: +1 415 555 0000',
    'San Francisco, CA',
  ].join('\n');

  it('fills location from NER GPE/LOC (span-first)', () => {
    const sections = [
      { title: 'Summary', content: 'Experienced engineer', fieldKey: 'summary', confidence: 0.9 },
    ];
    const metadata = { name: null, email: null, phone: null, linkedinUrl: null };

    const nerEntities = [
      { label: 'GPE', text: 'San Francisco, CA', start: 60, end: 78 },
    ];
    const mappedCv = { _ner: { entities: nerEntities } } as any;

    const strict = mapParsedToStrict({ rawText, parsedSections: sections, metadata, mappedCv }) as any;

    // Location is placed into strict profile slot
    expect(strict.location).toMatch(/San Francisco/i);
  });
});

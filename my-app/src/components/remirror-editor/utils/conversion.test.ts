import { describe, it, expect, vi } from 'vitest';
import { RemirrorJSON } from 'remirror';
import { ensureRemirrorDoc, remirrorDocToSection, jsonToStructuredFields, remirrorJsonToStructuredFields } from './conversion';

describe('jsonToStructuredFields (simple)', () => {
    it('should return an empty array for an empty document', () => {
        const json: RemirrorJSON = { type: 'doc', content: [] };
        expect(jsonToStructuredFields(json)).toEqual([]);
    });

    it('should convert a single paragraph with text', () => {
        const json: RemirrorJSON = {
            type: 'doc',
            content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Hello, world!' }],
            }, ],
        };
        const result = jsonToStructuredFields(json);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('paragraph');
        expect(result[0].content).toHaveLength(1);
        expect(result[0].content?.[0].type).toBe('text');
        expect(result[0].content?.[0].text).toBe('Hello, world!');
    });

    it('should handle multiple paragraphs', () => {
        const json: RemirrorJSON = {
            type: 'doc',
            content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph.' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph.' }] },
            ],
        };
        const result = jsonToStructuredFields(json);
        expect(result).toHaveLength(2);
        expect(result[0].content?.[0].text).toBe('First paragraph.');
        expect(result[1].content?.[0].text).toBe('Second paragraph.');
    });

    it('should convert a simple bullet list', () => {
        const json: RemirrorJSON = {
            type: 'doc',
            content: [{
                type: 'bulletList',
                content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] },
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }] },
                ],
            }, ],
        };

        const result = jsonToStructuredFields(json);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('bulletList');
        expect(result[0].content).toHaveLength(2);

        const listItem1 = result[0].content?.[0];
        expect(listItem1?.type).toBe('paragraph');
        expect(listItem1?.content?.[0]?.text).toBe('Item 1');

        const listItem2 = result[0].content?.[1];
        expect(listItem2?.type).toBe('paragraph');
        expect(listItem2?.content?.[0]?.text).toBe('Item 2');
    });
    
    it('should return an empty array for invalid RemirrorJSON', () => {
        const invalidJson: any = { type: 'invalid' };
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(jsonToStructuredFields(invalidJson)).toEqual([]);
        expect(consoleWarnSpy).toHaveBeenCalledWith('Invalid RemirrorJSON object provided:', invalidJson);
        consoleWarnSpy.mockRestore();
    });
});


describe('remirrorJsonToStructuredFields (legacy)', () => {
  it('should correctly parse a flat structured experience block', () => {
    const json: RemirrorJSON = {
      type: 'doc',
      content: [
        { type: 'experienceTitle', content: [{ type: 'text', text: 'Software Engineer' }] },
        { type: 'experienceCompany', content: [{ type: 'text', text: 'Tech Corp' }] },
        { type: 'experienceLocation', content: [{ type: 'text', text: 'San Francisco, CA' }] },
      ],
    };

    const result = remirrorJsonToStructuredFields(json, 'experience');

    expect(result).toEqual({
      position: 'Software Engineer',
      company: 'Tech Corp',
      location: 'San Francisco, CA',
    });
  });

  it('should correctly parse a nested structured experience block', () => {
    const json: RemirrorJSON = {
        type: 'doc',
        content: [
            {
                type: 'experienceBlock',
                content: [
                    { type: 'experienceTitle', content: [{ type: 'text', text: 'Lead Developer' }] },
                    { type: 'experienceCompany', content: [{ type: 'text', text: 'Innovate LLC' }] },
                ]
            }
        ]
    };
    const result = remirrorJsonToStructuredFields(json, 'experience');
    expect(result).toEqual({
        position: 'Lead Developer',
        company: 'Innovate LLC'
    });
  });

  it('should correctly extract responsibilities as a Remirror JSON document', () => {
    const responsibilitiesDoc = {
      type: 'experienceResponsibilities',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Developed new features.' }],
        },
      ],
    };
    const json: RemirrorJSON = {
      type: 'doc',
      content: [
        {
          type: 'experienceBlock',
          content: [
             { type: 'experienceTitle', content: [{ type: 'text', text: 'SDE' }] },
             responsibilitiesDoc
            ],
        },
      ],
    };

    const result = remirrorJsonToStructuredFields(json, 'experience');
    expect(result.position).toBe('SDE');
    expect(result.responsibilities).toEqual({
        type: 'doc',
        content: [responsibilitiesDoc]
    });
  });
});

describe('remirror conversion: html', () => {
    it('preserves bold, italic and links when serializing and deserializing', () => {
        const html = '<p>This is <strong>bold</strong>, <em>italic</em>, and a <a href="https://example.com">link</a>.</p>';
        const doc = ensureRemirrorDoc(html);
        const section = remirrorDocToSection(doc, 'test-section', 'Test');
        
        const content = section.blocks[0].content as RemirrorJSON;
        const para = content.content?.[0];
        expect(para?.type).toBe('paragraph');

        const textNodes = para?.content;
        expect(textNodes).toBeInstanceOf(Array);
        const isObjectMark = (m: any): m is { type: string, attrs?: any } => typeof m === 'object' && m !== null;
        expect(textNodes?.find(n => n.text?.includes('bold') && n.marks?.some(m => isObjectMark(m) && m.type === 'bold'))).toBeDefined();
        expect(textNodes?.find(n => n.text?.includes('italic') && n.marks?.some(m => isObjectMark(m) && m.type === 'italic'))).toBeDefined();
        expect(textNodes?.find(n => n.text?.includes('link') && n.marks?.some(m => isObjectMark(m) && m.type === 'link' && m.attrs?.href === 'https://example.com'))).toBeDefined();
    });

  it('round-trips an empty string into a minimal non-empty doc', () => {
    const doc = ensureRemirrorDoc('');
    expect(doc).toBeDefined();
    expect(doc.type).toBe('doc');
    expect(Array.isArray((doc as any).content)).toBe(true);
    expect((doc as any).content.length).toBeGreaterThanOrEqual(1);
  });
});
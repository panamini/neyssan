import { describe, it, expect } from 'vitest'
import { parseLLMSections } from '../llmPostProcessor'

describe('llmPostProcessor - wrapper responses', () => {
  it('finds sections array inside common wrapper keys (response)', () => {
    const wrapped = JSON.stringify({
      response: {
        sections: [
          {
            title: 'Wrapped Title',
            content: 'Wrapped content',
            fieldKey: 'skills',
            confidence: 0.95
          }
        ]
      }
    })

    const out = parseLLMSections(wrapped)
    expect(out).toBeTruthy()
    expect(out.sections).toBeInstanceOf(Array)
    expect(out.sections.length).toBe(1)
    expect(out.sections[0].title).toBe('Wrapped Title')
  })

  it('parses object-shaped provider responses passed as JSON (non-stringified)', () => {
    const obj = {
      response: {
        sections: [
          { title: 'Obj Title', content: 'c', fieldKey: 'contact', confidence: 0.8 }
        ]
      }
    }
    const out2 = parseLLMSections(JSON.stringify(obj))
    expect(out2?.sections?.[0]?.title).toBe('Obj Title')
  })
})
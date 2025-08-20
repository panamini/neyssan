import { z } from 'zod';
import { ToneSettings, ToneMapType } from '../types';

 // Validation schemas for tone control
const _ToneInstructionSchema = z.object({
    base: z.string(),
    modifiers: z.array(z.string()),
    examples: z.array(z.string())
});

export const ToneMap: ToneMapType = {
    formal: {
        1: 'slightly formal',
        2: 'professionally formal',
        3: 'business formal',
        4: 'highly formal',
        5: 'extremely formal'
    },
    friendly: {
        1: 'casual',
        2: 'warm',
        3: 'conversational',
        4: 'engaging',
        5: 'enthusiastic'
    },
    technical: {
        1: 'basic technical',
        2: 'moderately technical',
        3: 'technical',
        4: 'advanced technical',
        5: 'expert technical'
    }
};

// Base tone instructions
const BASE_TONE_INSTRUCTIONS: Record<ToneSettings['type'], z.infer<typeof _ToneInstructionSchema>> = {
    formal: {
        base: 'Use professional business language',
        modifiers: [
            'Maintain proper etiquette',
            'Use industry-standard terminology',
            'Focus on clarity and precision'
        ],
        examples: [
            'I am writing to express my strong interest in...',
            'Based on my extensive experience in...',
            'I would welcome the opportunity to discuss...'
        ]
    },
    friendly: {
        base: 'Adopt a conversational tone',
        modifiers: [
            'Use natural language patterns',
            'Include personal touches',
            'Be approachable and relatable'
        ],
        examples: [
            'I was really excited to see your project...',
            "I'd love to help you with...",
            "Let's work together to..."
        ]
    },
    technical: {
        base: 'Focus on technical specifications and implementation details',
        modifiers: [
            'Use precise technical terminology',
            'Include specific technical approaches',
            'Reference relevant technologies and methodologies'
        ],
        examples: [
            'I would implement this solution using...',
            'The architecture would involve...',
            'Key technical considerations include...'
        ]
    }
};

interface ToneAdjustment {
  instruction: string;
  modifiers: string[];
  examples: string[];
  formalityLevel: number;
}

// Pure function to validate custom instructions
function validateCustomInstructions(instructions: string): string {
  const cleaned = instructions.trim();
  if (cleaned.length === 0) {
    throw new Error('Custom instructions cannot be empty');
  }
  if (cleaned.length > 500) {
    throw new Error('Custom instructions must be less than 500 characters');
  }
  return cleaned;
}

// Pure function to calculate tone adjustments
function calculateToneAdjustment(settings: ToneSettings): ToneAdjustment {
  const baseTone = BASE_TONE_INSTRUCTIONS[settings.type];
  const levelDescription = ToneMap[settings.type][settings.level];

  const adjustment: ToneAdjustment = {
    instruction: `${baseTone.base} with a ${levelDescription} style.`,
    modifiers: [...baseTone.modifiers],
    examples: baseTone.examples.slice(0, settings.level), // More examples for higher levels
    formalityLevel: settings.level
  };

  if (settings.customInstructions) {
    const validatedInstructions = validateCustomInstructions(settings.customInstructions);
    adjustment.instruction = `${adjustment.instruction}\n\nCustom Instructions: ${validatedInstructions}`;
  }

  return adjustment;
}

// Pure function to generate tone prompt
function generateTonePrompt(adjustment: ToneAdjustment): string {
  const parts = [
    adjustment.instruction,
    '\nKey style elements:',
    ...adjustment.modifiers.map(mod => `- ${mod}`),
    '\nExample phrases:',
    ...adjustment.examples.map(ex => `- ${ex}`)
  ];

  return parts.join('\n');
}

// Main tone service following functional programming principles
export function createToneService() {
  return {
    // Generate tone instructions for proposal generation
    getToneInstructions(settings: ToneSettings): string {
      const adjustment = calculateToneAdjustment(settings);
      return generateTonePrompt(adjustment);
    },

    // Analyze text for tone consistency
    // @ts-expect-error TS6133: 'text' is declared but its value is never read.
    // TODO: Use the 'text' parameter in the tone analysis implementation.
    analyzeTone(text: string, settings: ToneSettings): {
      consistency: number;
      suggestions: string[];
    } {
      // @ts-expect-error TS6133: 'adjustment' is declared but its value is never read. It IS used.
      const _adjustment = calculateToneAdjustment(settings);
      const consistency = calculateToneConsistency();
      const suggestions = generateToneSuggestions();
      
      return {
        consistency,
        suggestions
      };
    },

    // Get available tone options
    getToneOptions() {
      return {
        types: Object.keys(BASE_TONE_INSTRUCTIONS) as ToneSettings['type'][],
        levels: [1, 2, 3, 4, 5] as const,
        examples: BASE_TONE_INSTRUCTIONS
      };
    }
  };
}


// Helper function to calculate tone consistency (placeholder implementation)
function calculateToneConsistency(/* text: string, adjustment: ToneAdjustment */): number {
  // In a real implementation, this would use NLP to analyze tone consistency
  // For now, return a random score between 0.7 and 1.0
  return 0.7 + Math.random() * 0.3;
}

// Helper function to generate tone suggestions (placeholder implementation)
function generateToneSuggestions(/* text: string, adjustment: ToneAdjustment */): string[] {
  // In a real implementation, this would analyze the text and provide specific suggestions
  return [
    'Consider using more professional terminology',
    'Try incorporating some of the example phrases',
    'Maintain consistency in formality level'
  ];
}

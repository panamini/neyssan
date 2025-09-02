// metadataExtractor.ts - Comprehensive fallback metadata extraction
interface ExtractedMetadata {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
}

export function extractMetadataHeuristically(text: string): ExtractedMetadata {
  const lines = text.split('\n').map(line => line.trim());
  
  return {
    name: extractName(lines),
    email: extractEmail(text),
    phone: extractPhone(text),
    linkedinUrl: extractLinkedInUrl(text)
  };
}

function extractName(lines: string[]): string | null {
  // Multiple strategies for name extraction
  const strategies = [
    // Strategy 1: First non-empty line that looks like a name
    () => {
      const candidate = lines.find(line => 
        line.length > 3 && 
        line.length < 40 && 
        /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(line) &&
        !line.includes('@') &&
        !line.match(/\d/)
      );
      return candidate || null;
    },
    
    // Strategy 2: Line before email address
    () => {
      const emailLineIndex = lines.findIndex(line => extractEmail(line));
      if (emailLineIndex > 0) {
        const candidate = lines[emailLineIndex - 1];
        if (candidate && candidate.length < 50 && !candidate.includes('@')) {
          return candidate;
        }
      }
      return null;
    },
    
    // Strategy 3: Capitalized words at the very beginning
    () => {
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        const words = lines[i].split(/\s+/);
        if (words.length >= 2 && words.length <= 4) {
          const allCapitalized = words.every(word => 
            word.length > 1 && /^[A-Z][a-z]*$/.test(word)
          );
          if (allCapitalized) return lines[i];
        }
      }
      return null;
    }
  ];
  
  for (const strategy of strategies) {
    const result = strategy();
    if (result) return result;
  }
  
  return null;
}

function extractEmail(text: string): string | null {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex);
  return emails && emails.length > 0 ? emails[0] : null;
}

function extractPhone(text: string): string | null {
  // Comprehensive international phone number regex
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
  const phones = text.match(phoneRegex);
  
  if (!phones || phones.length === 0) return null;
  
  // Prefer numbers that look more like actual phone numbers
  const scoredPhones = phones.map(phone => {
    let score = 0;
    
    // Higher score for numbers with country code
    if (phone.includes('+')) score += 2;
    
    // Higher score for numbers with typical length
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length >= 8 && digitsOnly.length <= 15) score += 2;
    
    // Higher score for numbers with common separators
    if (/[-.\s]/.test(phone)) score += 1;
    
    return { phone, score };
  });
  
  // Return the highest scoring phone number
  scoredPhones.sort((a, b) => b.score - a.score);
  return scoredPhones[0].phone;
}

function extractLinkedInUrl(text: string): string | null {
  const linkedinRegex = /(https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+)|(linkedin\.com\/in\/[a-zA-Z0-9_-]+)/gi;
  const urls = text.match(linkedinRegex);
  return urls && urls.length > 0 ? urls[0] : null;
}
// enhancedParser.ts - Improved with real-world header data
export const FIELD_KEY_MAP: Record<string, string[]> = {
  experience: [
    'experience', 'work history', 'employment', 'career', 'professional background', 
    'roles', 'work experience', 'employment history', 'career history', 'professional experience',
    'berufserfahrung', 'expérience professionnelle', 'experiencia laboral', '工作经历'
  ],
  education: [
    'education', 'academic', 'training', 'certifications', 'courses', 'qualifications',
    'academic background', 'degrees', 'bildung', 'formation', 'educación', '教育背景'
  ],
  // ... other categories with international variations
};

export function isPotentialHeader(line: string, context: {
  previousLine: string;
  nextLine: string;
  lineIndex: number;
}): boolean {
  const trimmed = line.trim();
  const { previousLine, nextLine, lineIndex } = context;
  
  // Early exit for obvious non-headers
  if (trimmed.length > 80 || trimmed.length < 2) return false;
  
  // Check against known header patterns (most efficient check first)
  const isKnownHeader = Object.values(FIELD_KEY_MAP).some(patterns =>
    patterns.some(pattern => {
      const normalized = trimmed.toLowerCase();
      return normalized === pattern || 
             normalized.startsWith(pattern + ':') ||
             normalized.startsWith(pattern + ' -');
    })
  );
  
  if (isKnownHeader) return true;
  
  // Structural cues (ordered by reliability)
  const isAllCaps = trimmed.toUpperCase() === trimmed && 
                   /[A-Z]{3,}/.test(trimmed) &&
                   trimmed.length < 50;
  
  const hasHeaderFormatting = /^(#+\s+|={3,}|-{3,}|\*\s+|\d+\.\s+)/.test(trimmed);
  
  const precededByEmptyLine = previousLine.trim() === '' && lineIndex > 0;
  
  const followedBySeparator = /^[-=*_]{3,}$/.test(nextLine.trim());
  
  const hasHighCapitalRatio = (trimmed.match(/[A-Z]/g) || []).length / trimmed.length > 0.6;
  
  // Weighted scoring system
  const scores = {
    isAllCaps: 3,
    hasHeaderFormatting: 2,
    precededByEmptyLine: 2,
    followedBySeparator: 3,
    hasHighCapitalRatio: 1
  };
  
  let totalScore = 0;
  if (isAllCaps) totalScore += scores.isAllCaps;
  if (hasHeaderFormatting) totalScore += scores.hasHeaderFormatting;
  if (precededByEmptyLine) totalScore += scores.precededByEmptyLine;
  if (followedBySeparator) totalScore += scores.followedBySeparator;
  if (hasHighCapitalRatio) totalScore += scores.hasHighCapitalRatio;
  
  return totalScore >= 5; // Threshold for header detection
}
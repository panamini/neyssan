# Hybrid CV Parser - v2

**Authored:** 2025-08-31  
**Status:** Draft v2 - Internationalized & Heuristics Enhanced  

## 1. Overview

This v2 document outlines the updates to the hybrid CV parser to fully support **international CVs** and improve **header detection heuristics**. The goal is to robustly map CV sections from multiple languages and formats to canonical `fieldKeys`.

### Key Changes in v2
- Expanded `FIELD_KEY_MAP` to cover major languages: English, French, German, Spanish, Chinese, Italian, Portuguese, Dutch, Japanese, Russian, Arabic.  
- Enhanced `isPotentialHeader()` with:
  - Bold/italic headers (`**PROFILE**`, `*Skills*`)  
  - All-caps short lines detection  
  - Separators (`---`, `===`)  
  - Capital-to-text ratio scoring  
  - Context-aware cues (preceding empty line, following separator)  
- Improved normalization: deaccent, smart-quote removal, punctuation tolerance.  
- Ready for mixed-language CVs.  

---

## 2. International Field Key Map (`FIELD_KEY_MAP`)

```typescript
export const FIELD_KEY_MAP: Record<string, string[]> = {
  experience: [
    'experience', 'work history', 'employment', 'career', 'professional background',
    'roles', 'work experience', 'employment history', 'career history', 'professional experience',
    'berufserfahrung', 'expérience professionnelle', 'experiencia laboral', '工作经历',
    'esperienza lavorativa', 'experiência profissional', 'werkervaring',
    '職務経歴', 'опыт работы', 'الخبرة العملية'
  ],
  education: [
    'education', 'academic', 'training', 'certifications', 'courses', 'qualifications',
    'academic background', 'degrees', 'bildung', 'formation', 'educación', '教育背景',
    'istruzione', 'formação', 'opleiding', '学歴', 'образование', 'التعليم'
  ],
  skills: [
    'skills', 'competence', 'competences', 'compétence', 'compétences', 'technical',
    'tech stack', 'technical skills', 'stack', 'proficien', 
    'abilità', 'competenze', 'competências', 'vaardigheden', 'スキル', 'навыки', 'مهارات'
  ],
  achievements: [
    'achievement', 'award', 'certif', 'publication', 'hobby', 'réalisation', 'réalisations', 'achievements',
    'realizzazioni', 'passatempos', "hobby's", '成果', 'достижения', 'الهوايات'
  ],
  identity: [
    'link', 'website', 'linkedin', 'github', 'portfolio', 'contact', 'coordonne', 
    'adresse', 'phone', 'telephone', 'téléphone', 'email', 'identity', 'url',
    'contatti', 'contato', '連絡先', 'контакты', 'معلومات الاتصال'
  ]
};

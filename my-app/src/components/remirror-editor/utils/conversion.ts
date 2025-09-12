import {
  isRemirrorJSON,
  RemirrorJSON,
} from '@remirror/core';
import { EditorSchema } from '@remirror/core-types';
import { v4 as uuidv4 } from 'uuid';
import { CvSection as Section } from '../../../types/cvDocument';

const ENABLE_CONVERSION_TRACE = false;

// Debug toggle honoring global __CV_EDITOR_DEBUG__ flag
function conversionDebugEnabled(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return ENABLE_CONVERSION_TRACE || (typeof window !== 'undefined' && (window as any).__CV_EDITOR_DEBUG__ === true);
  } catch {
    return ENABLE_CONVERSION_TRACE;
  }
}

type PMNode = RemirrorJSON;

// Define a type for structured content to be used in the application
export interface StructuredField {
  type: 'paragraph' | 'bulletList' | 'text' | string;
  id: string; // Add a unique ID for React keys
  text?: string;
  content?: StructuredField[];
}

/**
 * Transforms a RemirrorJSON object into a structured array of fields.
 * This is useful for rendering the JSON in a custom component or for data manipulation.
 *
 * @param json - The RemirrorJSON object to convert.jsonToStructuredFields
 * @returns An array of StructuredField objects.
 */
export function jsonToStructuredFields(
  json: RemirrorJSON,
): StructuredField[] {
  if (!isRemirrorJSON(json) || json.type !== 'doc' || !json.content) {
    console.warn('Invalid RemirrorJSON object provided:', json);
    return [];
  }
  return convertNodesToStructuredFields(json.content);
}

function convertNodesToStructuredFields(
  nodes: RemirrorJSON[],
): StructuredField[] {
  return nodes
    .map((node, index) => {
      // Basic unique ID generation
      const id = uuidv4();

      switch (node.type) {
        case 'paragraph':
          return {
            type: 'paragraph',
            id,
            content: node.content
              ? convertNodesToStructuredFields(node.content)
              : [],
          };
        case 'text':
          return {
            type: 'text',
            id,
            text: node.text || '',
          };
        case 'bulletList':
          return {
            type: 'bulletList',
            id,
            content: node.content
              ? convertNodesToStructuredFields(node.content)
              : [],
          };
        // Add other cases for different node types like 'heading', 'listItem', etc.
        case 'listItem': {
          // Flatten listItem content to simplify structure, assuming listItems contain paragraphs
          const listItemContent = node.content
            ? convertNodesToStructuredFields(node.content)
            : [];
          return listItemContent[0] && listItemContent[0].type === 'paragraph'
            ? { ...listItemContent[0], id } // Use the paragraph's content but with a new ID
            : {
                type: 'paragraph', // Fallback for empty or non-standard listItems
                id,
                content: [],
              };
        }

        default:
          console.warn(`Unsupported node type: ${node.type}`);
          return null; // Ignore unsupported node types
      }
    })
    .filter((field): field is StructuredField => field !== null);
}

/**
 * A simple dummy function to demonstrate the conversion process.
 * More advanced conversion logic will be implemented here.
 *
 * @param json - The RemirrorJSON object.
 * @returns A string representation of the conversion.
 */
function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

function htmlToPmFragment(html: string): PMNode[] {
  if (typeof document === 'undefined') return [];
  const container = document.createElement('div');
  container.innerHTML = html;
  const nodes: PMNode[] = [];
 
  // Remirror expects marks to be an array of string or ObjectMark with attrs of literal values.
  // Keep attrs as Record<string, string> to satisfy the literal constraint.
  type MarkLiteral = string | { type: string; attrs?: Record<string, string> };
  const blockTagMap: Record<string, string> = {
    p: 'paragraph',
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
    ul: 'bullet_list',
    ol: 'ordered_list',
    li: 'list_item',
  };
 
  function marksForTag(tag: string, el: HTMLElement): MarkLiteral[] {
    if (tag === 'strong' || tag === 'b') return [{ type: 'bold' }];
    if (tag === 'em' || tag === 'i') return [{ type: 'italic' }];
    if (tag === 'a') return [{ type: 'link', attrs: { href: el.getAttribute('href') || '' } }];
    return [];
  }

  function processNode(node: ChildNode, inherited: MarkLiteral[] = []): PMNode | null {
    if (node.nodeType === Node.TEXT_NODE) {
      // Preserve meaningful spaces between inline nodes; collapse multiple spaces.
      const raw = node.textContent ?? '';
      const textContent = raw.replace(/\s+/g, ' ').trim();
      if (!textContent) return null;
      return inherited.length > 0
        ? { type: 'text', text: textContent, marks: [...inherited] as unknown as (string | { type: string; attrs?: Record<string, string> })[] }
        : { type: 'text', text: textContent };
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Block elements
    if (blockTagMap[tag]) {
      const children: PMNode[] = [];
      el.childNodes.forEach((c) => {
        const n = processNode(c, []);
        if (!n) return;
        // Flatten inline containers that wrapped their children in a paragraph
        if (n.type === 'paragraph' && Array.isArray((n as any).content)) {
          (n as any).content.forEach((cc: any) => {
            children.push(cc as PMNode);
          });
        } else {
          children.push(n);
        }
      });

      // Normalize list structures
      if (tag === 'li') {
        return {
          type: 'list_item',
          content: [{ type: 'paragraph', content: children.length ? children : [{ type: 'text', text: '' }] }],
        };
      }
      if (tag === 'ul' || tag === 'ol') {
        const items = children.filter((c) => c.type === 'list_item');
        return {
          type: blockTagMap[tag],
          content: items.length
            ? items
            : [{ type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }] }],
        };
      }

      const attrs = (tag === 'h1' || tag === 'h2' || tag === 'h3') ? { level: parseInt(tag[1], 10) } : undefined;
      return { type: blockTagMap[tag], content: children.length ? children : [{ type: 'text', text: '' }], attrs };
    }

    // Inline or unknown container — accumulate marks and recurse
    const nextMarks = [...inherited, ...marksForTag(tag, el)];
    const children: PMNode[] = [];
    el.childNodes.forEach((c) => {
      const n = processNode(c, nextMarks);
      if (n) children.push(n);
    });

    if (children.length === 0) {
      const textContent = (el.textContent ?? '').trim();
      if (!textContent) return null;
      return nextMarks.length > 0
        ? { type: 'text', text: textContent, marks: nextMarks as unknown as (string | { type: string; attrs?: Record<string, string> })[] }
        : { type: 'text', text: textContent };
    }

    // For inline containers, prefer returning a single text node when possible.
    if (children.length === 1 && children[0].type === 'text') {
      return children[0];
    }

    // Otherwise return a lightweight wrapper; paragraph parents will flatten this.
    return { type: 'paragraph', content: children };
  }

  container.childNodes.forEach((child) => {
    const node = processNode(child, []);
    if (!node) return;
    if (node.type === 'text') {
      nodes.push({ type: 'paragraph', content: [node] });
    } else {
      nodes.push(node);
    }
  });

  return nodes.length ? nodes : [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }];
}

/**
 * Serialize a ProseMirror-like fragment array into an HTML string.
 * Paragraphs -> <p>, headings -> <hN>, lists -> <ul>/<ol>.
 */
function renderTextWithMarks(node: PMNode): string {
  let text = escapeHtml(node.text ?? '');
  if (!node.marks || node.marks.length === 0) return text;
  // Wrap marks in order
  node.marks.forEach((m: any) => {
    if (m.type === 'bold') text = `<strong>${text}</strong>`;
    else if (m.type === 'italic') text = `<em>${text}</em>`;
    else if (m.type === 'link' && m.attrs) {
      const href = String(m.attrs.href ?? '#');
      text = `<a href="${escapeHtml(href)}">${text}</a>`;
    }
  });
  return text;
}

function pmFragmentToHtml(fragment?: PMNode[]): string {
  if (!fragment || fragment.length === 0) return '';

  function renderNode(node: PMNode): string {
    if (!node || typeof node !== 'object') return '';
    const t = node.type;

    if (t === 'paragraph') {
      const inner = (node.content || []).map((c) => {
        if (c.type === 'text') return renderTextWithMarks(c);
        // For nested blocks, render their text content
        if (Array.isArray(c.content)) return (c.content || []).map((cc) => (cc.type === 'text' ? renderTextWithMarks(cc) : '')).join('');
        return '';
      }).join('');
      return `<p>${inner}</p>`;
    }

    if (t === 'heading') {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1));
      const text = (node.content?.map((c) => (c.type === 'text' ? renderTextWithMarks(c) : '')).join('')) || '';
      return `<h${level}>${text}</h${level}>`;
    }

    if (t === 'bullet_list' || t === 'ordered_list') {
      const items = (node.content || [])
        .map((li) => {
          const txt = (li.content?.map((c) => (c.type === 'text' ? renderTextWithMarks(c) : '')).join('')) || '';
          return `<li>${txt}</li>`;
        })
        .join('');
      const tag = t === 'ordered_list' ? 'ol' : 'ul';
      return `<${tag}>${items}</${tag}>`;
    }

    // Default fallback: render paragraph from content
    const text = (node.content?.map((c) => (c.type === 'text' ? renderTextWithMarks(c) : '')).join('')) || '';
    return `<p>${text}</p>`;
  }

  return fragment.map(renderNode).join('');
}

/**
 * Extracts plain text from a Remirror JSON document for simple previews or heuristics.
 * Ignores placeholder content such as "Start typing here…".
 */
function extractPlainText(json: RemirrorJSON | undefined | null): string {
  if (!json || typeof json !== 'object' || !json.content) return '';
  const parts: string[] = [];
  function walk(node: any) {
    if (!node) return;
    if (node.type === 'text' && typeof node.text === 'string') parts.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  }
  walk(json);
  const text = parts.join(' ').replace(/\s\s+/g, ' ').trim();
  const normalized = text.replace(/\u2026/g, '...'); // unify ellipsis to '...'
  const placeholders = new Set(['Start typing here...', 'Start typing here…']);
  return placeholders.has(normalized) ? '' : text;
}

/**
 * Mappings from Remirror node types to structured field names.
 * This allows a generic traversal approach instead of section-specific logic.
 */
const FIELD_TYPE_MAP: Record<string, string> = {
  // Experience Section
  experienceTitle: 'position',
  experienceCompany: 'company',
  experienceLocation: 'location',
  experienceStartDate: 'startDate',
  experienceEndDate: 'endDate',
  experienceResponsibilities: 'responsibilities',

  // Education Section
  educationDegree: 'degree',
  educationInstitution: 'institution',
  educationFieldOfStudy: 'fieldOfStudy',
  educationGrade: 'grade',
  educationStartDate: 'startDate',
  educationEndDate: 'endDate',
  educationDescription: 'description',

  // Profile Section (v1)
  profileName: 'name',
  profileEmail: 'email',
  profilePhone: 'phone',
  profileLinkedin: 'linkedin',
  profileWebsite: 'website',
  profileDesiredPosition: 'desiredPosition',
  profileLocation: 'location',

  // Summary Section (v1)
  summaryText: 'summary',
};

/**
 * Normalize node type names to a compact key used for mapping.
 * Rules:
 * - lowercase
 * - strip dashes / underscores
 * - remove trailing "node" suffix (if present)
 *
 * Examples:
 *   "experience-title" -> "experiencetitle"
 *   "ExperienceTitle"  -> "experiencetitle"
 *   "experience_title" -> "experiencetitle"
 */
function normalizeNodeType(type?: string): string {
  if (!type || typeof type !== 'string') return '';
  const lower = type.toLowerCase();
  const stripped = lower.replace(/[-_]/g, '');
  return stripped.replace(/node$/, '');
}

/**
 * Build a normalized lookup map from FIELD_TYPE_MAP so incoming node.type
 * variations (hyphens/underscores/casing) match the mapped structured field.
 */
const NORMALIZED_FIELD_TYPE_MAP: Record<string, string> = Object.entries(FIELD_TYPE_MAP).reduce(
  (acc, [key, val]) => {
    acc[normalizeNodeType(key)] = val;
    return acc;
  },
  {} as Record<string, string>,
);

/**
 * Extracts the text content from a Remirror JSON node.
 * This helper function concatenates the `text` properties of all descendant text nodes.
 */
function extractTextFromNode(node: PMNode | undefined | null): string {
  if (!node) return '';
  const textParts: string[] = [];

  function walk(n: PMNode) {
    if (n.type === 'text' && typeof n.text === 'string') {
      textParts.push(n.text);
    }
    if (Array.isArray(n.content)) {
      n.content.forEach(walk);
    }
  }

  walk(node);
  const text = textParts.join('').trim();
  const normalized = text.replace(/\u2026/g, '...');
  if (normalized === 'Start typing here...' || normalized === 'Start typing here…') return '';
  return text;
}

/**
 * Converts Remirror JSON from a block's editor back into a partial
 * structured data object for live synchronization.
 *
 * This implementation traverses the Remirror JSON tree directly, using the `type`
 * property of each node to identify and map it to a structured field. This is more
 * robust and maintainable than regex-based parsing.
 */
export function remirrorJsonToStructuredFields(json: RemirrorJSON, sectionType?: string): Record<string, any> {
    if (!json || !Array.isArray(json.content)) {
        return {};
    }

    const structuredData: Record<string, any> = {};
    const unmappedTypes: Set<string> = new Set();
  
    function traverse(nodes: PMNode[]) {
      // Log the raw types for debugging when enabled
      if (conversionDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.debug('[DBG][conversion] traversing node types', nodes.map(n => n.type));
      }
      for (const node of nodes) {
        // Normalize incoming node.type to handle variations like "experience-title" or "ExperienceTitle"
        const normalized = normalizeNodeType(node.type);
        const fieldName = NORMALIZED_FIELD_TYPE_MAP[normalized];
  
        if (fieldName) {
          if (fieldName === 'responsibilities' || fieldName === 'description' || fieldName === 'summary') {
            // Keep rich content shape for these fields
            structuredData[fieldName] = { type: 'doc', content: [node] };
          } else {
            structuredData[fieldName] = extractTextFromNode(node);
          }
        } else if (node.content && Array.isArray(node.content)) {
          // Recurse into children when no direct mapping
          traverse(node.content);
        } else if (normalized) {
          // Leaf with no mapping — record for diagnostics
          unmappedTypes.add(normalized);
        }
      }
    }

    traverse(json.content as PMNode[]);
  
    // Diagnostics: log unmapped node types when enabled
    if (conversionDebugEnabled() && unmappedTypes.size > 0) {
      // eslint-disable-next-line no-console
      console.debug('[DBG][conversion] unmapped node types observed', Array.from(unmappedTypes).slice(0, 20));
    }
  
    // If no structured fields were found via traversal, apply fallback heuristics
    if (Object.keys(structuredData).length === 0) {
      const text = extractPlainText(json);
      // Summary fallback: prefer returning the full doc for summary sections
      if (sectionType === 'summary') {
        return { summary: json };
      }
  
      if (!text) return {};
  
      switch (sectionType) {
        case 'experience': {
          const expMatch = text.match(/(.*) at (.*)/);
          if (expMatch) return { position: expMatch[1].trim(), company: expMatch[2].trim() };
  
          const sepMatch = text.match(/(.+)[\u2014\u2013\-•\u2022]\s*(.+)/);
          if (sepMatch) return { position: sepMatch[1].trim(), company: sepMatch[2].trim() };
          
          return { position: text };
        }
        case 'education': {
          const eduMatchIn = text.match(/(.*) in (.*)/);
          if (eduMatchIn) return { degree: eduMatchIn[1].trim(), fieldOfStudy: eduMatchIn[2].trim() };
  
          const eduMatchFrom = text.match(/(.*) from (.*)/);
          if (eduMatchFrom) return { degree: eduMatchFrom[1].trim(), institution: eduMatchFrom[2].trim() };
  
          return { degree: text };
        }
        default:
          // For other sections (profile/skills/languages), leave unmapped fields empty (explicitly blank)
          return {};
      }
    }
  
    return structuredData;
}

/* ===== Public API ===== */

export function sectionsToRemirrorJSON(sections: Section[]): RemirrorJSON {
  const content = sections.map((section) => {
    // When serializing back to a Remirror doc, prefer section.content if present, otherwise
    // collapse blocks into a single fragment (this preserves editor content).
    const doc = ensureRemirrorDoc((section as any).content ?? (section.blocks && section.blocks[0] ? section.blocks[0].content : undefined));
    const fragment = Array.isArray((doc as any).content) ? (doc as any).content : [];
    return {
      type: 'cvSection',
      attrs: { sectionId: section.id, title: section.title ?? '', type: section.type ?? 'text', structuredContent: section.structuredContent ?? null },
      content: fragment,
    };
  });

  return { type: 'doc', content };
}

/* ===== Utilities used for structured -> blocks splitting ===== */

function topParagraphNodesFromDoc(doc: RemirrorJSON): PMNode[] {
  const content = Array.isArray((doc as any).content) ? (doc as any).content : [];
  return content.filter((n: any) => n?.type === 'paragraph');
}

function asRemirrorDocFromStringOrDoc(raw: string | RemirrorJSON | undefined | null): RemirrorJSON {
  if (!raw) return emptyDoc;
  if (typeof raw === 'string') return ensureRemirrorDoc(raw);
  return ensureRemirrorDoc(raw as any);
}

/* ===== Main conversion: remirrorJSON -> sections ===== */

export function remirrorJSONToSections(doc: RemirrorJSON): Section[] {
  if (!doc || !Array.isArray((doc as any).content)) return [];

  return (doc as any).content
    .filter((node: any) => node?.type === 'cvSection')
    .map((node: any) => {
      const attrs = node.attrs || {};
      const id = String(attrs.sectionId ?? '') || uuidv4();
      const title = String(attrs.title ?? '') || '';
      const sectionType = (typeof attrs.type === 'string'
        ? (attrs.type as Section['type'])
        : typeof attrs.sectionType === 'string'
        ? (attrs.sectionType as Section['type'])
        : 'text') as Section['type'];

      // Detect raw structured data in several possible attribute keys
      const rawStructured = Array.isArray(attrs.structuredContent)
        ? attrs.structuredContent
        : Array.isArray(attrs.structured)
        ? attrs.structured
        : Array.isArray(attrs.structuredItems)
        ? attrs.structuredItems
        : null;

      // -------- Experience --------
      if (Array.isArray(rawStructured) && rawStructured.length > 0 && sectionType === 'experience') {
        const structured = rawStructured.map((it: any, idx: number) => {
          const rawItemId = String(it?.id ?? '').trim();
          const itemId = rawItemId !== '' ? rawItemId : uuidv4();

          const company = String(it?.company ?? '');
          const position = String(it?.position ?? it?.role ?? '');
          const startDate = typeof it?.startDate === 'string' ? it.startDate : '';
          const endDate = typeof it?.endDate === 'string' ? it.endDate : (it?.endDate ?? null);
          const location = String(it?.location ?? '');
          const achievements = Array.isArray(it?.achievements) ? it.achievements.map(String) : [];
          const currentlyWorking = typeof it?.currentlyWorking === 'boolean' ? it.currentlyWorking : false;

          // Normalize responsibilities as Remirror doc if provided as string; if already doc, keep.
          const responsibilities = (typeof it?.responsibilities === 'string' || !it?.responsibilities)
            ? asRemirrorDocFromStringOrDoc(it?.responsibilities)
            : ensureRemirrorDoc(it.responsibilities);

          return {
            id: itemId,
            company,
            position,
            startDate,
            endDate,
            location,
            responsibilities,
            achievements,
            currentlyWorking,
            ...it, // keep extras but do not let these override the above normalized fields
          };
        });

        // Create blocks per paragraph inside each item's responsibilities (or single block fallback)
        const blocks: import("../../../schemas/cvDocument.schema").CvBlock[] = structured.flatMap((item: any, idx: number) => {
          const itemLinkedId = item.id ?? uuidv4();
          const normalized: RemirrorJSON = asRemirrorDocFromStringOrDoc(item.responsibilities);
          const paraNodes = topParagraphNodesFromDoc(normalized);

          const titleBase = String(item.company ?? '') || `Experience ${idx + 1}`;

          if (!Array.isArray(paraNodes) || paraNodes.length === 0) {
            const blkId = uuidv4();
            return [{
              id: blkId,
              title: titleBase,
              type: 'text',
              content: normalized,
              attributes: { linkedStructuredId: itemLinkedId },
            }];
          }

          return paraNodes.map((pnode: PMNode, sub: number) => {
            const partDoc: RemirrorJSON = { type: 'doc', content: [pnode] };
            const blkId = uuidv4();
            const blkTitle = paraNodes.length > 1 ? `${titleBase} (${sub + 1})` : titleBase;
            return {
              id: blkId,
              title: blkTitle,
              type: 'text',
              content: ensureRemirrorDoc(partDoc),
              attributes: { linkedStructuredId: itemLinkedId },
            };
          });
        });

        const sectionObj: Section = {
          id,
          title,
          type: sectionType,
          blocks,
          structuredContent: structured,
        };
        return sectionObj;
      }

      // -------- Education --------
      if (Array.isArray(rawStructured) && rawStructured.length > 0 && sectionType === 'education') {
        const structured = rawStructured.map((it: any, idx: number) => {
          const rawItemId = String(it?.id ?? '').trim();
          const itemId = rawItemId !== '' ? rawItemId : uuidv4();

          const institution = String(it?.institution ?? '');
          const degree = String(it?.degree ?? '');
          const fieldOfStudy = String(it?.fieldOfStudy ?? it?.field ?? '');
          const startDate = typeof it?.startDate === 'string' ? it.startDate : '';
          const endDate = typeof it?.endDate === 'string' ? it.endDate : (it?.endDate ?? null);
          const grade = String(it?.grade ?? '');

          const description = (typeof it?.description === 'string' || !it?.description)
            ? asRemirrorDocFromStringOrDoc(it?.description)
            : ensureRemirrorDoc(it.description);

          return {
            id: itemId,
            institution,
            degree,
            fieldOfStudy,
            startDate,
            endDate,
            grade,
            description,
            ...it,
          };
        });

        const blocks: import("../../../schemas/cvDocument.schema").CvBlock[] = structured.flatMap((item: any, idx: number) => {
          const itemLinkedId = item.id ?? uuidv4();
          const normalized: RemirrorJSON = asRemirrorDocFromStringOrDoc(item.description);
          const paraNodes = topParagraphNodesFromDoc(normalized);

          const titleBase = String(item.institution ?? '') || `Education ${idx + 1}`;

          if (!Array.isArray(paraNodes) || paraNodes.length === 0) {
            const blkId = uuidv4();
            return [{
              id: blkId,
              title: titleBase,
              type: 'text',
              content: normalized,
              attributes: { linkedStructuredId: itemLinkedId },
            }];
          }

          return paraNodes.map((pnode: PMNode, sub: number) => {
            const partDoc: RemirrorJSON = { type: 'doc', content: [pnode] };
            const blkId = uuidv4();
            const blkTitle = paraNodes.length > 1 ? `${titleBase} (${sub + 1})` : titleBase;
            return {
              id: blkId,
              title: blkTitle,
              type: 'text',
              content: ensureRemirrorDoc(partDoc),
              attributes: { linkedStructuredId: itemLinkedId },
            };
          });
        });

        const sectionObj: Section = {
          id,
          title,
          type: sectionType,
          blocks,
          structuredContent: structured,
        };
        return sectionObj;
      }

      // -------- Summary / Personal Info --------
      if (Array.isArray(rawStructured) && rawStructured.length > 0 && sectionType === 'summary') {
        const structured = rawStructured.map((it: any, idx: number) => {
          const rawItemId = String(it?.id ?? '').trim();
          const itemId = rawItemId !== '' ? rawItemId : uuidv4();

          const name = String(it?.name ?? it?.fullName ?? '');
          const email = String(it?.email ?? '');
          const linkedin = String(it?.linkedin ?? it?.profile ?? '');
          const address = String(it?.address ?? '');
          const summary = (typeof it?.summary === 'string' || !it?.summary) ? asRemirrorDocFromStringOrDoc(it?.summary) : ensureRemirrorDoc(it.summary);

          return {
            id: itemId,
            name,
            email,
            linkedin,
            address,
            summary,
            ...it,
          };
        });

        const blocks: import("../../../schemas/cvDocument.schema").CvBlock[] = structured.flatMap((item: any, idx: number) => {
          const itemLinkedId = item.id ?? uuidv4();

          const fields = ['name', 'email', 'linkedin', 'address'] as const;
          const fieldBlocks = fields.map((field) => {
            const fieldValue = String(item[field] ?? '');
            const blkId = uuidv4();
            const blkTitle = `${field.charAt(0).toUpperCase() + field.slice(1)}`;
            return {
              id: blkId,
              title: blkTitle,
              type: 'text',
              content: ensureRemirrorDoc(fieldValue),
              attributes: { linkedStructuredId: itemLinkedId },
            } as import("../../../schemas/cvDocument.schema").CvBlock;
          });

          // Summary block (already doc or string)
          const summaryDoc: RemirrorJSON = typeof item.summary === 'string' ? ensureRemirrorDoc(item.summary) : (item.summary as RemirrorJSON) ?? emptyDoc;
          const summaryBlk: import("../../../schemas/cvDocument.schema").CvBlock = {
            id: uuidv4(),
            title: 'Summary',
            type: 'text',
            content: ensureRemirrorDoc(summaryDoc),
            attributes: { linkedStructuredId: itemLinkedId },
          };

          return [...fieldBlocks, summaryBlk];
        });

        const sectionObj: Section = {
          id,
          title,
          type: sectionType,
          blocks,
          structuredContent: structured,
        };
        return sectionObj;
      }

      // -------- Skills --------
      if (Array.isArray(rawStructured) && rawStructured.length > 0 && sectionType === 'skills') {
        const structured = rawStructured.map((it: any, idx: number) => {
          const rawItemId = String(it?.id ?? '').trim();
          const itemId = rawItemId !== '' ? rawItemId : `st-${id}-${idx}`;

          // Normalize name and level according to v1 schema
          const rawName = typeof it === 'string' ? it : String(it?.name ?? it?.skill ?? it?.title ?? it ?? '');
          const name = String(rawName ?? '').trim();

          const rawLevel = typeof it?.level === 'string' ? it.level : '';
          const allowed = new Set(['Beginner', 'Elementary', 'Intermediate', 'Advanced', 'Fluent']);
          const level = allowed.has(rawLevel) ? rawLevel : 'Intermediate';

          return {
            ...it,
            id: itemId,
            name,
            level,
          };
        });

        // Representative blocks: still render chips as blocks fallback (use name)
        const blocks: import("../../../schemas/cvDocument.schema").CvBlock[] = structured.flatMap((item: any, idx: number) => {
          const itemLinkedId = item.id ?? uuidv4();
          const display = String(item.name ?? '').trim();
          const blkId = uuidv4();
          const blk: import("../../../schemas/cvDocument.schema").CvBlock = {
            id: blkId,
            title: display || `Skill ${idx + 1}`,
            type: 'text',
            content: ensureRemirrorDoc(display),
            attributes: { linkedStructuredId: itemLinkedId },
          };
          return [blk];
        });

        const sectionObj: Section = {
          id,
          title,
          type: sectionType,
          blocks,
          structuredContent: structured,
        };
        return sectionObj;
      }

      // -------- Languages --------
      if (Array.isArray(rawStructured) && rawStructured.length > 0 && sectionType === 'languages') {
        const structured = rawStructured.map((it: any, idx: number) => {
          const rawItemId = String(it?.id ?? '').trim();
          const itemId = rawItemId !== '' ? rawItemId : `lg-${id}-${idx}`;
          const rawName = typeof it === 'string' ? it : String(it?.language ?? it?.name ?? it?.title ?? it ?? '');
          const name = String(rawName ?? '').trim();

          const rawLevel = typeof it?.level === 'string' ? it.level : '';
          const allowed = new Set(['Beginner', 'Elementary', 'Intermediate', 'Advanced', 'Fluent']);
          const level = allowed.has(rawLevel) ? rawLevel : 'Intermediate';

          return {
            ...it,
            id: itemId,
            name,
            level,
          };
        });

        // For languages we keep structured-only (no representative blocks in v1)
        const blocks: import("../../../schemas/cvDocument.schema").CvBlock[] = [];

        const sectionObj: Section = {
          id,
          title,
          type: sectionType,
          blocks,
          structuredContent: structured,
        };
        return sectionObj;
      }
 
       // -------- Achievements (separate from skills) --------
       if (Array.isArray(rawStructured) && rawStructured.length > 0 && sectionType === 'achievements') {
        const structured = rawStructured.map((it: any, idx: number) => {
          const rawItemId = String(it?.id ?? '').trim();
          const itemId = rawItemId !== '' ? rawItemId : `st-${id}-${idx}`;
          const rawVal = typeof it === 'string' ? it : String(it?.achievement ?? it?.title ?? it?.name ?? it ?? '');
          const text = String(rawVal ?? '').trim();
          return {
            ...it,
            id: itemId,
            achievement: text,
          };
        });

        const blocks: import("../../../schemas/cvDocument.schema").CvBlock[] = structured.flatMap((item: any, idx: number) => {
          const itemLinkedId = item.id ?? uuidv4();
          const text = String(item.achievement ?? '').trim();
          const blkId = uuidv4();
          const blk: import("../../../schemas/cvDocument.schema").CvBlock = {
            id: blkId,
            title: text || `Achievement ${idx + 1}`,
            type: 'text',
            content: ensureRemirrorDoc(text),
            attributes: { linkedStructuredId: itemLinkedId },
          };
          return [blk];
        });

        const sectionObj: Section = {
          id,
          title,
          type: sectionType,
          blocks,
          structuredContent: structured,
        };
        return sectionObj;
      }

      // -------- Fallback: create single block from node.content --------
      const fragmentNodes = Array.isArray(node.content) ? node.content : [];
      const blockContent = ensureRemirrorDoc({ type: 'doc', content: fragmentNodes });
      const blockId = uuidv4();

      const block: import("../../../schemas/cvDocument.schema").CvBlock = {
        id: blockId,
        title: title || `Block 1`,
        type: 'text',
        content: blockContent,
      };

      const section: Section = {
        id,
        title,
        type: sectionType,
        blocks: [block],
        structuredContent: null,
      };

      return section;
    });
}

/* ===== Empty doc helper & conversion helpers ===== */

const emptyDoc: RemirrorJSON = {
  type: 'doc',
  // Provide a helpful placeholder so empty editors show guidance instead of a blank line.
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Start typing here…' }] }],
};

export function sectionToRemirrorDoc(section: Section): RemirrorJSON {
  const raw = (section as any).content ?? (section.blocks && section.blocks[0] ? (section.blocks[0].content as any) : undefined);
  return ensureRemirrorDoc(raw);
}

export function ensureRemirrorDoc(content: string | RemirrorJSON | undefined | null): RemirrorJSON {
  if (ENABLE_CONVERSION_TRACE) {
    // eslint-disable-next-line no-console
    console.debug('[TRACE-CV][conversion] ensureRemirrorDoc input type:', typeof content, content);
  }

  if (!content) {
    if (ENABLE_CONVERSION_TRACE) {
      // eslint-disable-next-line no-console
      console.debug('[TRACE-CV][conversion] ensureRemirrorDoc: content is falsy, returning emptyDoc');
    }
    return emptyDoc;
  }

  if (typeof content === 'string') {
    const fragment = htmlToPmFragment(content ?? '');
    if (Array.isArray(fragment) && fragment.length > 0) {
      if (ENABLE_CONVERSION_TRACE) {
        // eslint-disable-next-line no-console
        console.debug('[conversion] ensureRemirrorDoc: converted string to doc with fragment length', fragment.length);
      }
      return { type: 'doc', content: fragment } as RemirrorJSON;
    }
    if (ENABLE_CONVERSION_TRACE) {
      // eslint-disable-next-line no-console
      console.debug('[conversion] ensureRemirrorDoc: string conversion produced empty fragment, returning emptyDoc');
    }
    return emptyDoc;
  }

  // At this point `content` is an object.
  if (typeof content === 'object' && (content as any).type === 'doc' && Array.isArray((content as any).content)) {
    const doc = content as RemirrorJSON & { content?: any[] };

    // If the doc contains wrapper cvSection nodes (our serialized multi-section doc),
    // extract the inner fragment of the first cvSection node to produce an editor-ready doc.
    const cvNodes = (doc.content || []).filter((n: any) => n?.type === 'cvSection');
    if (cvNodes.length > 0) {
      const first = cvNodes[0];
      const fragment = Array.isArray(first.content) ? first.content : [];
      if (fragment.length > 0) {
        if (ENABLE_CONVERSION_TRACE) {
          // eslint-disable-next-line no-console
          console.debug('[conversion] ensureRemirrorDoc: extracted fragment from cvSection node, length=', fragment.length);
        }
        return { type: 'doc', content: fragment } as RemirrorJSON;
      }
      if (ENABLE_CONVERSION_TRACE) {
        // eslint-disable-next-line no-console
        console.debug('[conversion] ensureRemirrorDoc: cvSection node present but empty, falling back to emptyDoc');
      }
      return emptyDoc;
    }

    // If no cvSection wrappers, but the doc has block content, return it (it's already editor-ready).
    if (Array.isArray(doc.content) && doc.content.length > 0) {
      if (ENABLE_CONVERSION_TRACE) {
        // eslint-disable-next-line no-console
        console.debug('[conversion] ensureRemirrorDoc: doc has block content, returning as-is');
      }
      return doc as RemirrorJSON;
    }

    // Fallback for empty doc.content
    if (ENABLE_CONVERSION_TRACE) {
      // eslint-disable-next-line no-console
      console.debug('[conversion] ensureRemirrorDoc: doc has no content, returning emptyDoc');
    }
    return emptyDoc;
  }

  // Unexpected shape
  if (ENABLE_CONVERSION_TRACE) {
    // eslint-disable-next-line no-console
    console.debug('[conversion] ensureRemirrorDoc: content has unexpected shape, falling back to emptyDoc');
  }
  return emptyDoc;
}

/**
 * Ensure sections array is safe:
 * - Remove falsy elements
 * - Guarantee id/title/content exist
 * - Ensure ids are unique (generate UUID when missing/duplicate)
 */
export function sanitizeSections(sections: Array<Partial<Section> | null | undefined>): Section[] {
  if (!Array.isArray(sections)) return [];
  const seen = new Set<string>();
  return sections
    .filter(Boolean)
    .map((s) => {
      const raw = s ?? {};
      const idRaw = String((raw as any).id ?? '').trim();
      const id = idRaw || uuidv4();
      let finalId = id;
      if (seen.has(finalId)) {
        finalId = uuidv4();
      }
      seen.add(finalId);

      const title = typeof (raw as any).title === 'string' ? (raw as any).title : String((raw as any).title ?? '');
      const type = typeof (raw as any).type === 'string' ? (raw as any).type as Section['type'] : 'text';
      const structuredContent = typeof (raw as any).structuredContent !== 'undefined' ? (raw as any).structuredContent : null;
      const collapsed = typeof (raw as any).collapsed === 'boolean' ? (raw as any).collapsed : undefined;
      const order = typeof (raw as any).order === 'number' ? (raw as any).order : undefined;

      // Normalize blocks: if provided, convert each to CvBlock; otherwise generate a single block from `content`.
      const rawBlocks = Array.isArray((raw as any).blocks) ? (raw as any).blocks as any[] : [];
      const blocks: import("../../../schemas/cvDocument.schema").CvBlock[] = rawBlocks.map((b, idx) => {
        const bid = String(b?.id ?? uuidv4());
        const btitle = typeof b?.title === 'string' ? b.title : `${title} - Block ${idx + 1}`;
        const btype = typeof b?.type === 'string' ? (b.type as import("../../../schemas/cvDocument.schema").BlockType) : 'text';
        const bcontent = ensureRemirrorDoc(b?.content ?? (raw as any).content);
        const blockObj: import("../../../schemas/cvDocument.schema").CvBlock = {
          id: bid,
          title: btitle,
          type: btype,
          content: bcontent,
        };
        return blockObj;
      });

      if (blocks.length === 0) {
        const doc = ensureRemirrorDoc((raw as any).content);
        const blkId = uuidv4();
        blocks.push({
          id: blkId,
          title: title || `Block 1`,
          type: 'text',
          content: doc,
        });
      }

      const out: Section = {
        id: finalId,
        title,
        type,
        blocks,
        structuredContent,
      };

      if (typeof collapsed === 'boolean') out.collapsed = collapsed;
      if (typeof order === 'number') out.order = order;

      return out;
    });
}

export function remirrorDocToSection(doc: RemirrorJSON, sectionId: string, title: string): Section {
  if (!doc || !Array.isArray((doc as any).content)) {
    const emptyBlock = {
      id: uuidv4(),
      title: title || 'Block 1',
      type: 'text' as const,
      content: emptyDoc,
    };
    return { id: sectionId, title, type: 'text' as const, blocks: [emptyBlock], structuredContent: null } as Section;
  }
  try {
    // Prefer to keep the Remirror doc as the block content to avoid data loss.
    const blockContent = ensureRemirrorDoc(doc);
    const blk = {
      id: uuidv4(),
      title: title || 'Block 1',
      type: 'text' as const,
      content: blockContent,
    };
    if (ENABLE_CONVERSION_TRACE) {
      // eslint-disable-next-line no-console
      console.debug('[TRACE-CV][conversion] remirrorDocToSection produced block for', sectionId);
    }
    return { id: sectionId, title, type: 'text' as const, blocks: [blk], structuredContent: null } as Section;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[TRACE-CV][conversion] remirrorDocToSection failed', err, doc);
    const emptyBlock = {
      id: uuidv4(),
      title: title || 'Block 1',
      type: 'text' as const,
      content: emptyDoc,
    };
    return { id: sectionId, title, type: 'text' as const, blocks: [emptyBlock], structuredContent: null } as Section;
  }
}

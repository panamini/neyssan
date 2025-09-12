import React, { useEffect, useMemo, useState } from "react";
import type { RemirrorJSON } from "remirror";
import type { CvSection } from "../../schemas/cvDocument.schema";
import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";

/**
 * SummaryBlock
 *
 * Renders an editable structured "summary / personal info" section.
 * - If the section contains structuredContent (array) we edit the first item.
 * - Fields: name, email, linkedin, address (simple text inputs), and summary (rich text stored as RemirrorJSON).
 * - Persist order: call onContentChange(sectionId, summaryDoc) first, then onChange(updatedSection).
 *
 * Accessibility:
 * - All inputs are labelled; Save is keyboard-accessible.
 */
export interface SummaryBlockProps {
  section: CvSection;
  onChange: (updatedSection: CvSection) => void;
  onContentChange?: (sectionId: string, json: RemirrorJSON) => void;
}

export function SummaryBlock({ section, onChange, onContentChange }: SummaryBlockProps) {
  // Resolve the first structured item when present, otherwise fall back to empty fields.
  const firstStructured = useMemo(() => {
    if (Array.isArray(section.structuredContent) && section.structuredContent.length > 0) return section.structuredContent[0] as Record<string, any>;
    return null;
  }, [section.structuredContent]);

  const [name, setName] = useState<string>(String(firstStructured?.name ?? ""));
  const [email, setEmail] = useState<string>(String(firstStructured?.email ?? ""));
  const [linkedin, setLinkedin] = useState<string>(String(firstStructured?.linkedin ?? ""));
  const [address, setAddress] = useState<string>(String(firstStructured?.address ?? ""));
  // Store editable summary as plain text but persist as RemirrorJSON using ensureRemirrorDoc on save.
  const summaryInitialPlain = useMemo(() => {
    const s = firstStructured?.summary;
    if (!s) return "";
    // If it's a Remirror doc, extract paragraph text
    try {
      if (typeof s === "object" && Array.isArray((s as any).content)) {
        const paras = (s as any).content
          .filter((n: any) => n?.type === "paragraph")
          .map((p: any) => (Array.isArray(p.content) ? p.content.map((c: any) => String(c.text ?? "")).join("") : ""))
          .filter(Boolean);
        return paras.join("\n\n");
      }
      if (typeof s === "string") return s;
    } catch {
      /* noop */
    }
    return "";
  }, [firstStructured?.summary]);

  const [summaryPlain, setSummaryPlain] = useState<string>(summaryInitialPlain);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Do not reset local state on every prop change, as this prevents typing when parent re-renders.
  // The component will remount with a new key when section.id changes (parent should pass key),
  // which is the correct moment to reinitialize these controlled fields.

  function buildRemirrorDocFromText(value: string): RemirrorJSON {
    const trimmed = String(value ?? "");
    const paragraphs = trimmed.split(/\n{1,2}/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length === 0) {
      return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: " " }] }] } as RemirrorJSON;
    }
    return {
      type: "doc",
      content: paragraphs.map((p) => ({
        type: "paragraph",
        content: [{ type: "text", text: p }],
      })),
    } as RemirrorJSON;
  }

  function createOrUpdateFieldBlock(existingBlocks: any[], itemId: string, field: string, value: string) {
    // Try to reuse an existing block linked to this structured item with a matching title.
    const title = field.charAt(0).toUpperCase() + field.slice(1);
    const found = existingBlocks.find((b) => {
      const linked = (b as any).attributes?.linkedStructuredId ?? (b as any).attributes?.linkedstructuredid;
      return String(linked) === String(itemId) && String(b.title ?? "").toLowerCase().includes(field);
    });
    const blkId = found?.id ?? `blk-${section.id}-${itemId}-${field}`;
    return {
      id: blkId,
      title,
      type: "text" as const,
      content: ensureRemirrorDoc(value),
      attributes: { linkedStructuredId: itemId },
    };
  }

  function handleSave() {
    setIsSaving(true);
    try {
      // Build Remirror doc for the summary
      const summaryDoc = buildRemirrorDocFromText(summaryPlain);

      // Prepare the structured item (we edit the first item or create one)
      const itemId = firstStructured?.id ?? `sum-${section.id}-0`;
      const newStructuredItem = {
        id: itemId,
        name: String(name ?? ""),
        email: String(email ?? ""),
        linkedin: String(linkedin ?? ""),
        address: String(address ?? ""),
        summary: summaryDoc,
      };

      // Persist Remirror JSON first
      if (typeof onContentChange === "function" && section.id) {
        try {
          onContentChange(String(section.id), summaryDoc);
        } catch {
          /* noop */
        }
      }

      // Build blocks for the section: reuse other blocks not linked to this item, and replace/add blocks for this item
      const existingBlocks = Array.isArray(section.blocks) ? section.blocks : [];
      const otherBlocks = existingBlocks.filter((b) => {
        const linked = (b as any).attributes?.linkedStructuredId ?? (b as any).attributes?.linkedstructuredid;
        return String(linked) !== String(firstStructured?.id ?? itemId);
      });

      const fields = ["name", "email", "linkedin", "address"] as const;
      const fieldBlocks = fields.map((f) => createOrUpdateFieldBlock(existingBlocks, itemId, f, String((newStructuredItem as any)[f] ?? "")));
      const summaryBlock = {
        id: existingBlocks.find((b) => (b as any).attributes?.linkedStructuredId === itemId && String(b.title ?? "").toLowerCase().includes("summary"))?.id ?? `blk-${section.id}-${itemId}-summary`,
        title: "Summary",
        type: "text" as const,
        content: ensureRemirrorDoc(summaryDoc),
        attributes: { linkedStructuredId: itemId },
      };

      const updatedBlocks = [...otherBlocks, ...fieldBlocks, summaryBlock];

      // Build updated structuredContent array: prefer replacing the first item if present
      const updatedStructured = Array.isArray(section.structuredContent) && section.structuredContent.length > 0
        ? [ { ...firstStructured, ...newStructuredItem }, ...section.structuredContent.slice(1) ]
        : [ newStructuredItem ];

      const updatedSection: CvSection = {
        ...section,
        structuredContent: updatedStructured as any,
        blocks: updatedBlocks as any,
      };

      // Emit onChange with the updated Section
      onChange(updatedSection);
    } finally {
      setTimeout(() => setIsSaving(false), 150);
    }
  }

  return (
    <div className="p-3 bg-white border rounded dark:bg-slate-900">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label htmlFor={`summary-name-${section.id}`} className="block text-xs font-medium text-slate-600 dark:text-slate-300">Name</label>
          <input id={`summary-name-${section.id}`} value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 mt-1 bg-transparent border rounded text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label htmlFor={`summary-email-${section.id}`} className="block text-xs font-medium text-slate-600 dark:text-slate-300">Email</label>
          <input id={`summary-email-${section.id}`} value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2 mt-1 bg-transparent border rounded text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label htmlFor={`summary-linkedin-${section.id}`} className="block text-xs font-medium text-slate-600 dark:text-slate-300">LinkedIn</label>
          <input id={`summary-linkedin-${section.id}`} value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className="w-full p-2 mt-1 bg-transparent border rounded text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label htmlFor={`summary-address-${section.id}`} className="block text-xs font-medium text-slate-600 dark:text-slate-300">Address</label>
          <input id={`summary-address-${section.id}`} value={address} onChange={(e) => setAddress(e.target.value)} className="w-full p-2 mt-1 bg-transparent border rounded text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="mt-3">
        <label htmlFor={`summary-text-${section.id}`} className="block text-xs font-medium text-slate-600 dark:text-slate-300">Summary</label>
        <textarea
          id={`summary-text-${section.id}`}
          aria-label="Summary rich text"
          value={summaryPlain}
          onChange={(e) => setSummaryPlain(e.target.value)}
          className="w-full min-h-[120px] mt-2 p-2 border rounded resize-y bg-transparent text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Write a short summary..."
        />
      </div>

      <div className="flex items-center justify-end mt-3">
        <button type="button" onClick={handleSave} disabled={isSaving} className="px-3 py-1 text-sm font-medium text-white bg-[var(--primary)] rounded disabled:opacity-50">
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
import React, { useEffect, useMemo, useState } from "react";
import { Trash2, ArrowUp, ArrowDown, Plus } from "lucide-react";
import type { CvSection } from "../../schemas/cvDocument.schema";

/**
 * SkillsBlock
 *
 * Renders a small list of skill chips editable inline.
 * - section.structuredContent is expected to be string[] (skills)
 * - onChange will be called with an updated CvSection containing structuredContent: string[]
 *
 * Accessibility:
 * - Keyboard add via Enter on input
 * - Buttons are labeled and keyboard-focusable
 */
export function SkillsBlock({ section, onChange }: { section: CvSection; onChange: (updatedSection: CvSection) => void }) {
  const initialSkills = useMemo(() => {
    if (Array.isArray(section.structuredContent)) return section.structuredContent as string[];
    // Try to coerce from blocks or empty array
    try {
      if (Array.isArray(section.blocks) && section.blocks.length > 0) {
        const first = section.blocks[0];
        const doc = (first.content as any) ?? {};
        const content = Array.isArray(doc.content) ? doc.content : [];
        const text = content
          .map((n: any) =>
            Array.isArray(n.content) ? n.content.map((t: any) => t.text ?? "").join("") : n.text ?? ""
          )
          .join("\n");
        return text.split(/\n/).map((s: string) => s.trim()).filter(Boolean);
      }
    } catch {
      // fallback
    }
    return [];
  }, [section]);

  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [input, setInput] = useState<string>("");

  useEffect(() => {
    setSkills(initialSkills);
  }, [initialSkills]);

  function persist(next: string[]) {
    const updated: CvSection = { ...section, structuredContent: next };
    onChange(updated);
  }

  function handleAdd(skill: string) {
    if (!skill || !skill.trim()) return;
    const next = [...skills, skill.trim()];
    setSkills(next);
    setInput("");
    persist(next);
  }

  function handleRemove(idx: number) {
    const next = skills.filter((_, i) => i !== idx);
    setSkills(next);
    persist(next);
  }

  function handleEdit(idx: number, value: string) {
    const next = skills.map((s, i) => (i === idx ? value : s));
    setSkills(next);
    persist(next);
  }

  function moveUp(idx: number) {
    if (idx <= 0) return;
    const next = [...skills];
    const tmp = next[idx - 1];
    next[idx - 1] = next[idx];
    next[idx] = tmp;
    setSkills(next);
    persist(next);
  }

  function moveDown(idx: number) {
    if (idx >= skills.length - 1) return;
    const next = [...skills];
    const tmp = next[idx + 1];
    next[idx + 1] = next[idx];
    next[idx] = tmp;
    setSkills(next);
    persist(next);
  }

  return (
    <div className="p-3 [background:var(--sfr)] border border-bo rounded">
      <label className="block text-sm font-medium [color:var(--tm2)]">Skills</label>

      <div className="flex flex-wrap gap-2 mt-3">
        {skills.map((s, idx) => (
          <div
            key={`${s}-${idx}`}
            className="flex items-center px-2 py-1 space-x-2 text-sm [background:var(--sf2)] border border-bo rounded"
            role="group"
            aria-label={`Skill ${s}`}
          >
            <input
              aria-label={`Edit skill ${s}`}
              className="text-sm bg-transparent focus:outline-none"
              value={s}
              onChange={(e) => handleEdit(idx, e.target.value)}
            />
            <div className="flex items-center ml-2 space-x-1">
              <button
                type="button"
                onClick={() => moveUp(idx)}
                className="p-1 rounded hover:[background:var(--sf2)]"
                aria-label={`Move ${s} up`}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => moveDown(idx)}
                className="p-1 rounded hover:[background:var(--sf2)]"
                aria-label={`Move ${s} down`}
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="p-1 rounded hover:[background:var(--erb)]"
                aria-label={`Remove ${s}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center mt-3 space-x-2">
        <input
          aria-label="Add skill"
          placeholder="Add a skill and press Enter"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd(input);
            }
          }}
          className="flex-grow px-2 py-1 bg-transparent border border-[color:var(--bm)] rounded-[var(--rs)] focus:border-[color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)] outline-none"
        />
        <button
          type="button"
          onClick={() => handleAdd(input)}
          className="px-2 py-1 text-sm font-medium text-[var(--foreground)] bg-[var(--primary)] rounded"
          aria-label="Add skill"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
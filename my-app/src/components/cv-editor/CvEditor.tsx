/* eslint-disable @typescript-eslint/no-unused-vars -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import React from "react";
import type { Section, CvState, CvBlock } from "./types";
import { uid } from "./types";
import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";
import { SectionPanel } from "./SectionPanel";

export function CvEditor({
  initialSections,
  onCvStateChange,
}: {
  initialSections?: Section[];
  onCvStateChange?: (state: CvState) => void;
}) {
  const exampleSections = React.useCallback((): Section[] => {
    const contactSectionId = uid();
    const summaryStructuredId = uid();
    const exp1Id = uid();
    const exp2Id = uid();
    const edu1Id = uid();

    const contactBlocks: CvBlock[] = [
      {
        id: uid(),
        title: "Name",
        type: "text",
        content: ensureRemirrorDoc("Jane Doe"),
      },
      {
        id: uid(),
        title: "Email",
        type: "text",
        content: ensureRemirrorDoc("jane.doe@example.com"),
      },
      {
        id: uid(),
        title: "Phone",
        type: "text",
        content: ensureRemirrorDoc("+33 1 23 45 67 89"),
      },
      {
        id: uid(),
        title: "Location",
        type: "text",
        content: ensureRemirrorDoc("Paris, France"),
      },
    ];

    const summaryStructured = [
      {
        id: summaryStructuredId,
        title: "Profile summary",
        description: "Senior frontend engineer with experience in React, TypeScript and Web3.",
      },
    ];

    const summaryBlocks: CvBlock[] = [
      {
        id: uid(),
        title: "Summary",
        type: "text",
        content: ensureRemirrorDoc("Senior frontend engineer with experience in React, TypeScript and Web3."),
        attributes: { linkedStructuredId: summaryStructuredId },
      },
    ];

    const experienceStructured = [
      {
        id: exp1Id,
        company: "Acme Corp",
        title: "Frontend Engineer",
        responsibilities: "Built and maintained responsive React applications.",
      },
      {
        id: exp2Id,
        company: "Beta Ltd",
        title: "UI Engineer",
        responsibilities: "Led design system development and componentization.",
      },
    ];

    const experienceBlocks: CvBlock[] = experienceStructured.map((it) => ({
      id: uid(),
      title: `${it.company} — ${it.title}`,
      type: "text",
      content: ensureRemirrorDoc(it.responsibilities ?? ""),
      attributes: { linkedStructuredId: it.id },
    }));

    const educationStructured = [
      {
        id: edu1Id,
        institution: "Université de Paris",
        title: "MSc Computer Science",
        description: "Focused on HCI and web technologies.",
      },
    ];

    const educationBlocks: CvBlock[] = educationStructured.map((it) => ({
      id: uid(),
      title: `${it.institution} — ${it.title}`,
      type: "text",
      content: ensureRemirrorDoc(it.description ?? ""),
      attributes: { linkedStructuredId: it.id },
    }));

    const skills = ["React", "TypeScript", "TailwindCSS", "Remirror", "Web3"];
    const skillsBlocks: CvBlock[] = skills.map((s) => ({
      id: uid(),
      title: s,
      type: "text",
      content: ensureRemirrorDoc(s),
    }));

    const projectsStructured = [
      {
        id: uid(),
        title: "Cv Editor",
        description: "Block-based CV editor built for structured editing.",
      },
    ];

    const projectsBlocks: CvBlock[] = projectsStructured.map((p) => ({
      id: uid(),
      title: p.title,
      type: "text",
      content: ensureRemirrorDoc(p.description ?? ""),
      attributes: { linkedStructuredId: p.id },
    }));

    return [
      {
        id: contactSectionId,
        title: "Contact",
        type: "contact",
        structuredContent: null,
        blocks: contactBlocks,
      },
      {
        id: uid(),
        title: "Summary",
        type: "summary",
        structuredContent: summaryStructured,
        blocks: summaryBlocks,
      },
      {
        id: uid(),
        title: "Experience",
        type: "experience",
        structuredContent: experienceStructured,
        blocks: experienceBlocks,
      },
      {
        id: uid(),
        title: "Education",
        type: "education",
        structuredContent: educationStructured,
        blocks: educationBlocks,
      },
      {
        id: uid(),
        title: "Skills",
        type: "skills",
        structuredContent: skills.map((s, i) => ({ id: `skill-${i}`, skill: s })),
        blocks: skillsBlocks,
      },
      {
        id: uid(),
        title: "Projects",
        type: "projects",
        structuredContent: projectsStructured,
        blocks: projectsBlocks,
      },
    ];
  }, []);

  const [state, setState] = React.useState<CvState>({
    sections: initialSections ?? exampleSections(),
  });

  const updateSection = React.useCallback(
    (next: Section) => {
      setState((prev) => {
        const nextAll = prev.sections.map((s) => (s.id === next.id ? next : s));
        const nextState: CvState = { sections: nextAll };
        try {
          onCvStateChange?.(nextState);
        } catch (_e) {
          // swallow to avoid crashing parent
        }
        return nextState;
      });
    },
    [onCvStateChange]
  );

  // if parent provides new initialSections, sync once
  React.useEffect(() => {
    if (initialSections && Array.isArray(initialSections)) {
      setState({ sections: initialSections });
    }
  }, [initialSections]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">CV Editor</h2>
        <div className="text-sm [color:var(--tm2)]">{state.sections.length} sections</div>
      </div>

      <div className="space-y-4">
        {state.sections.map((sec) => (
          <SectionPanel key={sec.id} section={sec} onSectionChange={(next) => updateSection(next)} />
        ))}
      </div>
    </div>
  );
}
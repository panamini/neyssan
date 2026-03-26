import type { ResumeData } from "./resume.types";

export const resumeMock: ResumeData = {
  name: "Elena Marlowe",
  title: "Senior Product Designer",
  summary:
    "Editorially minded product designer with 9+ years shaping product systems, design language, and content-rich experiences across SaaS, commerce, and media. Known for translating ambiguity into calm, precise interfaces with strong narrative structure.",
  metadata: [
    { label: "Location", value: "Amsterdam, NL" },
    { label: "Availability", value: "Open to leadership roles" },
    { label: "Portfolio", value: "elenamarlowe.design" },
  ],
  contact: [
    { label: "Email", value: "elena@sample.design" },
    { label: "Phone", value: "+31 6 5555 2381" },
    { label: "Web", value: "elenamarlowe.design" },
    { label: "LinkedIn", value: "linkedin.com/in/elenamarlowe" },
  ],
  skills: [
    "Design direction",
    "Product strategy",
    "Interaction design",
    "Visual systems",
    "Editorial UI",
    "Research synthesis",
    "Prototyping",
    "Cross-functional leadership",
  ],
  languages: [
    { name: "English", level: "Native" },
    { name: "Dutch", level: "Professional" },
    { name: "French", level: "Conversational" },
  ],
  experience: [
    {
      role: "Lead Product Designer",
      company: "Northline Studio",
      period: "2021 — Present",
      location: "Amsterdam",
      bullets: [
        "Led the redesign of a multi-market B2B platform, reducing workflow time by 28% through clearer information architecture and faster editorial navigation.",
        "Defined a visual system with content-first page patterns, typography scales, and reusable layout primitives adopted by three product squads.",
        "Partnered with product and engineering leadership to establish design review rituals, content QA, and rollout guidance for major releases.",
      ],
    },
    {
      role: "Senior Product Designer",
      company: "Signal House",
      period: "2018 — 2021",
      location: "Berlin",
      bullets: [
        "Designed publishing and analytics tools for editors and growth teams, balancing speed, legibility, and complex data workflows.",
        "Introduced component-level documentation and motion standards that improved implementation consistency across web and mobile.",
      ],
    },
    {
      role: "Product Designer",
      company: "Common Table",
      period: "2015 — 2018",
      location: "London",
      bullets: [
        "Delivered end-to-end features for marketplace discovery, booking, and account management with a strong focus on narrative merchandising.",
        "Worked closely with researchers to turn qualitative findings into journey-level service improvements and clearer transactional UI.",
      ],
    },
  ],
  projects: [
    {
      name: "Atlas Design Language",
      meta: "System strategy · 2024",
      description:
        "Created a modular design language for dense product surfaces with article-like reading flow, semantic tokens, and print-aware documentation.",
    },
    {
      name: "Editorial Commerce Toolkit",
      meta: "Experimentation platform · 2023",
      description:
        "Designed a toolkit for merchandisers to compose narrative product features, improving campaign velocity without sacrificing brand consistency.",
    },
  ],
  achievements: [
  "Reduced production time for new screens through a reusable design system.",
  "Improved clarity across dense workflows and editorially structured pages.",
  "Bridged product design and engineering with production-ready UI patterns.",
],

  education: [
    {
      degree: "MA, Information Design",
      school: "University of the Arts London",
      period: "2013 — 2015",
    },
    {
      degree: "BA, Visual Communication",
      school: "Kingston University",
      period: "2009 — 2013",
    },
  ],
};
  export const resumeMockOnecol: ResumeData = {
  name: "Elena Marlowe",
  title: "Senior Product Designer",
  summary:
    "Product designer shaping systems and content-rich interfaces.",
  metadata: [
    { label: "Location", value: "Amsterdam, NL" },
    { label: "Portfolio", value: "elenamarlowe.design" },
  ],
  contact: [
    { label: "Email", value: "hello@elenamarlowe.io" },
    { label: "Phone", value: "+31 6 5555 2381" },
    { label: "Web", value: "elenamarlowe.io" },
    { label: "LinkedIn", value: "linkedin.com/in/elenamarlowe" },
  ],
  skills: [
    "Design direction",
    "Product strategy",
    "Interaction design",
    "Visual systems",
    "Editorial UI",
    "Color theory",

  ],
  languages: [
    { name: "English", level: "Fluent" },
    { name: "French", level: "Native" },
  ],
  experience: [
    {
      role: "Lead Product Designer",
      company: "Northline Studio",
      period: "2021 — Present",
      location: "Amsterdam",
      bullets: [
        "Led the redesign of a multi-market B2B platform, improving workflow clarity and editorial navigation.",
        "Defined a reusable visual system spanning page patterns, typography scales, and product primitives.",
      ],
    },
    {
      role: "Senior Product Designer",
      company: "Signal House",
      period: "2018 — 2021",
      location: "Berlin",
      bullets: [
        "Designed publishing and analytics tools for editors and growth teams across complex workflows.",
        "Introduced documentation and motion standards for more consistent implementation.",
      ],
    },
  
  ],
  projects: [],
  achievements: [
    "Reduced production time for new screens through a reusable design system.",
    "Improved clarity across dense workflows and editorial structures.",
  ],
  education: [
    {
      degree: "MA, Information Design",
      school: "University of the Arts London",
      period: "2013 — 2015",
    },
    {
      degree: "BA, Visual Communication",
      school: "Kingston University",
      period: "2009 — 2013",
    },
  ],
};
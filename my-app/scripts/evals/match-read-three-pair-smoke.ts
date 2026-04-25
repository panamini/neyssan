import {
  buildStructuredMatchReadDebug,
  buildStructuredPendingMatchRead,
  buildVisibleMatchReadFromStructuredDebug,
  type StructuredMatchReadShadowRow,
} from "../../convex/lib/jobs/structuredMatchRead";
import type { NormalizedJobExtraction } from "../../convex/lib/jobs/jobExtractionSchema";

type Pair = {
  id: string;
  label: string;
  job: NormalizedJobExtraction;
  profile: Record<string, unknown>;
};

const model = "mistral-small-latest";
const promptVersion = "p9_v2";

function row(job: NormalizedJobExtraction): StructuredMatchReadShadowRow {
  return {
    llm_normalized_output: job,
    validation_status: "valid",
    fallback_used: false,
    model,
    prompt_version: promptVersion,
    created_at: 1,
  };
}

const pairs: Pair[] = [
  {
    id: "production-designer",
    label: "Production Designer <> ecommerce designer CV",
    job: {
      summary_short:
        "Production Designer role creating ecommerce assets from templates and brand systems.",
      role_title_normalized: "Production Designer",
      requirements: [
        { value: "Figma", type: "tool", required: true },
        { value: "Adobe Photoshop", type: "tool", required: true },
        { value: "Ecommerce asset production", type: "experience", required: true },
        { value: "Image retouching", type: "skill", required: false },
        { value: "Strong attention to detail", type: "skill", required: true },
        { value: "Ability to follow style guides accurately", type: "skill", required: true },
      ],
      keywords_canonical: ["Figma", "Photoshop", "ecommerce assets", "retouching"],
      licenses_or_certifications: [],
      schedule_constraints: [],
      environment: {
        customer_facing: null,
        onsite: null,
        physical_standing: null,
        retail: null,
      },
      confidence: "high",
    },
    profile: {
      _id: "cv_production_designer",
      summary:
        "Production designer creating ecommerce product assets with Figma, Photoshop, retouching, and brand templates.",
      skills: ["Figma", "Adobe Photoshop", "image retouching", "ecommerce asset production"],
      experience: [
        {
          company: "Studio Market",
          title: "Production Designer",
          description:
            "Produced ecommerce banners, PDP images, social assets, and retouched product photography from brand templates.",
        },
      ],
      projects: [
        {
          name: "Ecommerce launch system",
          description: "Built repeatable Figma templates and Photoshop workflows for weekly launches.",
        },
      ],
    },
  },
  {
    id: "security-guard",
    label: "Security Guard <> licensed guard CV",
    job: {
      summary_short:
        "Security Guard role monitoring store entry, visitor safety, reports, and digital incident logs.",
      role_title_normalized: "Security Guard",
      requirements: [
        { value: "Guard card/license", type: "certification", required: true },
        { value: "Valid driver's license", type: "certification", required: true },
        { value: "Basic computer knowledge", type: "skill", required: true },
        { value: "Strong communication skills", type: "skill", required: true },
        { value: "Customer service experience", type: "experience", required: false },
        { value: "Comfortable using a computer/tablet", type: "tool", required: false },
      ],
      keywords_canonical: ["security guard", "guard card", "incident reports", "tablet"],
      licenses_or_certifications: ["Guard card/license"],
      schedule_constraints: [],
      environment: {
        customer_facing: true,
        onsite: true,
        physical_standing: true,
        retail: true,
      },
      confidence: "high",
    },
    profile: {
      _id: "cv_security_guard",
      summary:
        "Security Guard with licensed site protection experience, visitor support, incident reporting, CCTV monitoring, and tablet-based logs.",
      skills: ["incident reports", "CCTV monitoring", "visitor support", "customer-facing security"],
      certifications: ["State Guard Card License", "Certified Protection Guard Program"],
      additionalInformation: ["Valid driver's license"],
      experience: [
        {
          company: "Metro Security",
          title: "Security Guard",
          description:
            "Monitored entrances, supported visitors, wrote incident reports, used CCTV software, and completed tablet-based patrol logs.",
        },
      ],
    },
  },
  {
    id: "junior-web-developer",
    label: "Junior Web Developer <> frontend developer CV",
    job: {
      summary_short:
        "Junior Web Developer role building responsive websites and debugging frontend integrations.",
      role_title_normalized: "Junior Web Developer",
      requirements: [
        { value: "React", type: "tool", required: true },
        { value: "TypeScript", type: "tool", required: true },
        { value: "REST API integration", type: "tool", required: true },
        { value: "Responsive website development", type: "experience", required: true },
        { value: "WordPress", type: "tool", required: false },
        { value: "Basic SEO standards", type: "skill", required: false },
        { value: "Ability to troubleshoot and debug browsers", type: "skill", required: true },
      ],
      keywords_canonical: ["React", "TypeScript", "REST API", "responsive", "WordPress", "SEO"],
      licenses_or_certifications: [],
      schedule_constraints: [],
      environment: {
        customer_facing: null,
        onsite: null,
        physical_standing: null,
        retail: null,
      },
      confidence: "high",
    },
    profile: {
      _id: "cv_frontend_developer",
      summary:
        "Frontend developer building responsive React and TypeScript websites with REST API integrations, browser debugging, WordPress edits, and SEO basics.",
      skills: ["React", "TypeScript", "REST API integration", "responsive CSS", "browser debugging", "WordPress", "SEO"],
      experience: [
        {
          company: "Web Forge",
          title: "Junior Web Developer",
          description:
            "Built responsive marketing pages, integrated REST APIs, fixed cross-browser bugs, edited WordPress pages, and applied basic SEO metadata.",
        },
      ],
      projects: [
        {
          name: "Responsive catalog",
          description: "React and TypeScript catalog with REST API data and mobile-first layouts.",
        },
      ],
    },
  },
];

function summarize(pair: Pair) {
  const pending = buildStructuredPendingMatchRead({
    jobId: pair.id,
    profileId: String(pair.profile._id),
    now: 1,
  });
  const debug = buildStructuredMatchReadDebug({
    old: pending,
    job: { id: pair.id, rawLanguageDetected: "en" },
    profile: pair.profile,
    shadowRows: [row(pair.job)],
    model,
    promptVersion,
  });
  const visible = buildVisibleMatchReadFromStructuredDebug({
    pendingMatchRead: pending,
    debug,
    now: 2,
  });

  if (debug.structured.status !== "available") {
    return {
      id: pair.id,
      label: pair.label,
      status: debug.structured.status,
      reason: debug.structured.reason,
    };
  }

  const supporting = debug.structured.jobRequirements
    .filter((requirement) => requirement.importance === "supporting")
    .map((requirement) => requirement.value);

  return {
    id: pair.id,
    label: pair.label,
    score: visible.score,
    tier: visible.tier,
    confidence: visible.confidence,
    matched: visible.matched,
    missing: visible.missing,
    supporting,
    requirements: debug.structured.jobRequirements.map((requirement) => ({
      value: requirement.value,
      category: requirement.category,
      importance: requirement.importance,
    })),
  };
}

console.log(JSON.stringify(pairs.map(summarize), null, 2));

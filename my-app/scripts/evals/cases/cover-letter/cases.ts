import type {
  PremiumCoverLetterContextClass,
  PremiumCoverLetterPersonalizationContext,
  PremiumCoverLetterPreset,
} from "../../../../convex/lib/proposals/premiumCoverLetter";

export type CoverLetterBenchmarkCase = {
  id: string;
  preset: PremiumCoverLetterPreset;
  jobTitle: string;
  jobDescription: string;
  personalizationContext: PremiumCoverLetterPersonalizationContext;
  expectedContextClass: PremiumCoverLetterContextClass;
  notes?: string;
  realismTag?: string;
};

const securityHyattContext: PremiumCoverLetterPersonalizationContext = {
  name: "Daniel Ruiz",
  summary:
    "Security operations professional coordinating incident response, patrol coverage, and guest safety in high-traffic hotel environments.",
  topSkills: [
    "Incident reporting",
    "Access control",
    "CCTV monitoring",
    "Team coordination",
  ],
  recentExperience: [
    {
      company: "Hyatt Regency Paris",
      position: "Security Operations Coordinator",
      highlights: [
        "Coordinated daily incident reporting, patrol coverage, and access control across a 320-room hotel.",
        "Reduced overnight response times by 22% by tightening shift handoffs and escalation workflows.",
        "Trained 6 new officers on post orders, guest-incident documentation, and emergency procedures.",
      ],
    },
  ],
  standoutAchievements: [
    "Built a weekly dashboard for incident trends and staffing gaps used by site leadership.",
  ],
};

const opsAdminContext: PremiumCoverLetterPersonalizationContext = {
  name: "Leila Haddad",
  summary:
    "Operations and administrative coordinator supporting scheduling, documentation, and cross-team follow-through.",
  topSkills: [
    "Scheduling",
    "Documentation",
    "Excel",
    "Office coordination",
  ],
  recentExperience: [
    {
      company: "Nexa Services",
      position: "Operations Coordinator",
      highlights: [
        "Managed scheduling, vendor follow-up, and service documentation for a regional field team.",
        "Prepared weekly status reports and kept task trackers current across operations and finance.",
        "Handled intake, record updates, and handoffs for maintenance requests and service visits.",
      ],
    },
  ],
  standoutAchievements: [
    "Standardized service-request templates that reduced back-and-forth on incomplete submissions.",
  ],
};

const adjacentWarehouseContext: PremiumCoverLetterPersonalizationContext = {
  name: "Maya Chen",
  summary:
    "Warehouse operations coordinator working across inventory flow, dispatch handoffs, and reporting.",
  topSkills: [
    "Inventory coordination",
    "Dispatch reporting",
    "Excel",
    "Process documentation",
  ],
  recentExperience: [
    {
      company: "Northline Logistics",
      position: "Warehouse Operations Coordinator",
      highlights: [
        "Owned dispatch handoffs, exception tracking, and daily shipment reporting across warehouse and transport teams.",
        "Built weekly backlog and on-time dashboards to surface process bottlenecks.",
        "Reduced delayed order escalations by 17% through tighter exception routing and follow-up.",
      ],
    },
  ],
  standoutAchievements: [
    "Documented standard handoff steps for inbound, picking, and carrier issue escalation.",
  ],
};

const weakDirectChecklistRiskContext: PremiumCoverLetterPersonalizationContext = {
  name: "Samir Patel",
  summary:
    "Facilities support coordinator handling maintenance intake, scheduling, and service record follow-through.",
  topSkills: [
    "Excel",
    "Word",
    "Windows",
    "Scheduling",
    "Vendor coordination",
  ],
  recentExperience: [
    {
      company: "Metro Facilities",
      position: "Facilities Coordinator",
      highlights: [
        "Handled maintenance intake, scheduling, and vendor follow-up for office sites.",
        "Kept service records and completion status current across recurring facilities requests.",
        "Improved work-order turnaround by 9% after reorganizing request routing and follow-up.",
      ],
    },
  ],
  standoutAchievements: [
    "Built a simple tracker that reduced missed vendor callbacks during weekly scheduling reviews.",
  ],
};

const strongAdjacentHonestTransferContext: PremiumCoverLetterPersonalizationContext =
  {
    name: "Jordan Lee",
    summary:
      "Customer operations lead coordinating onboarding handoffs, status reporting, and launch issue escalation across support, product, and finance.",
    topSkills: [
      "Reporting",
      "Cross-functional coordination",
      "Process documentation",
      "Stakeholder communication",
      "Excel",
    ],
    recentExperience: [
      {
        company: "Northstar SaaS",
        position: "Customer Operations Lead",
        highlights: [
          "Reduced onboarding backlog by 24% by tightening handoffs between support, product, and finance.",
          "Owned launch checklists, status reporting, and exception escalation for enterprise customer rollouts.",
          "Built weekly launch-readiness dashboards used by support and product managers.",
        ],
      },
    ],
    standoutAchievements: [
      "Documented a standard escalation path that cut time-to-resolution for launch blockers.",
    ],
  };

const strongDirectRankingConflictContext: PremiumCoverLetterPersonalizationContext =
  {
    name: "Amina Rahman",
    summary:
      "Revenue operations manager leading reporting, process improvements, and cross-team delivery for B2B sales operations.",
    topSkills: [
      "Salesforce",
      "Excel",
      "Windows",
      "French basics",
      "English",
      "Tableau",
      "Ready to learn",
    ],
    recentExperience: [
      {
        company: "Helix Cloud",
        position: "Revenue Operations Manager",
        highlights: [
          "Improved forecast accuracy by 19% after redesigning pipeline review and reporting workflows.",
          "Led quarterly operating cadence across sales, finance, and customer success for a 3-team revenue organization.",
          "Owned Salesforce hygiene, dashboard reviews, and cross-functional escalation for pipeline risk.",
        ],
      },
    ],
    standoutAchievements: [
      "Built executive dashboards used in quarterly business reviews.",
      "Kept a Salesforce certification in progress while leading weekly KPI reviews.",
    ],
  };

// no_cv: no prior experience, system must rely on job offer content only
const noCvEntryOfficeContext: PremiumCoverLetterPersonalizationContext = {
  name: "Sophie Martin",
};

// multi-employer: two employers with unequal evidence weight
// current role has strong quantified proof; older role has only task-level detail
// tests that the writer prioritizes current/stronger evidence over weaker older entries
const multiEmployerRankingContext: PremiumCoverLetterPersonalizationContext = {
  name: "Carlos Mendez",
  summary:
    "Operations lead coordinating cross-team delivery, project tracking, and reporting for client-facing and internal teams.",
  topSkills: [
    "Project coordination",
    "Cross-functional reporting",
    "Stakeholder communication",
    "Process improvement",
  ],
  recentExperience: [
    {
      company: "BrightPath Solutions",
      position: "Operations Lead",
      highlights: [
        "Reduced project delivery delays by 31% by restructuring cross-team handoffs and weekly review cadence.",
        "Led coordination across a 6-person team spanning operations, finance, and client services.",
        "Built a real-time project status dashboard used by senior leadership for weekly reporting.",
      ],
    },
    {
      company: "Clover Admin Services",
      position: "Administrative Coordinator",
      highlights: [
        "Managed scheduling, correspondence, and document filing for a 12-person office team.",
        "Coordinated travel bookings and expense reports for three department heads.",
      ],
    },
  ],
  standoutAchievements: [
    "Recognized for operational improvement at BrightPath after the delay reduction initiative.",
  ],
};

// clean engaging direct: strong direct match, no checklist noise, no ranking conflict
// tests engaging preset doing its warm-but-grounded job without distractions
const cleanEngagingDirectContext: PremiumCoverLetterPersonalizationContext = {
  name: "Priya Sharma",
  summary:
    "Customer success manager building retention through structured onboarding and proactive account management.",
  topSkills: [
    "Account management",
    "Customer onboarding",
    "Stakeholder communication",
    "Health-score reporting",
  ],
  recentExperience: [
    {
      company: "Lumio Health",
      position: "Customer Success Manager",
      highlights: [
        "Improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
        "Managed a portfolio of 40+ enterprise accounts with quarterly business reviews.",
        "Built a customer health-score dashboard used by the CS team to prioritize at-risk accounts.",
      ],
    },
  ],
  standoutAchievements: [
    "Top-performing CSM two consecutive quarters based on NPS and retention metrics.",
  ],
};

export const coverLetterBenchmarkCases: CoverLetterBenchmarkCase[] = [
  {
    id: "security-hyatt",
    preset: "signature",
    jobTitle: "Security Operations Supervisor",
    jobDescription:
      "Lead security operations, supervise patrol coverage, manage incident reporting, coordinate access control, and maintain clear escalation workflows across hotel operations.",
    personalizationContext: securityHyattContext,
    expectedContextClass: "cv_direct",
    notes: "Strong direct hotel-security match with quantified operational proof.",
    realismTag: "strong_direct",
  },
  {
    id: "ops-admin",
    preset: "expert",
    jobTitle: "Operations Administrator",
    jobDescription:
      "Own scheduling, documentation, service intake, status reporting, and administrative follow-through for a busy operations team. Strong Excel skills and flexibility are appreciated.",
    personalizationContext: opsAdminContext,
    expectedContextClass: "cv_direct",
    notes: "Medium direct operations case with less quantified proof and more process detail.",
    realismTag: "medium_direct",
  },
  {
    id: "adjacent-warehouse",
    preset: "engaging",
    jobTitle: "Implementation Analyst",
    jobDescription:
      "Coordinate implementation workflows, track deliverables, manage cross-functional handoffs, and maintain reporting across teams.",
    personalizationContext: adjacentWarehouseContext,
    expectedContextClass: "cv_adjacent",
    notes:
      "Adjacent transfer case from warehouse operations into workflow-heavy implementation coordination.",
    realismTag: "adjacent_transfer",
  },
  {
    id: "weak-direct-checklist-risk",
    preset: "signature",
    jobTitle: "Facilities Support Coordinator",
    jobDescription:
      "Coordinate maintenance requests, schedule vendors, update service records, manage Excel trackers, answer emails, support Word documentation, stay flexible, and be ready to help across office operations. Candidates should be organized, reliable, adaptable, willing to learn, and comfortable with Windows, Microsoft Word, Microsoft Excel, and general administrative support.",
    personalizationContext: weakDirectChecklistRiskContext,
    expectedContextClass: "cv_direct",
    notes:
      "Direct but thin case with heavy checklist pressure; the turnaround improvement should outrank filler.",
    realismTag: "weak_direct_checklist_risk",
  },
  {
    id: "strong-adjacent-honest-transfer",
    preset: "expert",
    jobTitle: "Implementation Analyst",
    jobDescription:
      "Coordinate implementation workflows, track deliverables, manage cross-functional handoffs, maintain reporting, and keep stakeholders aligned during customer rollouts.",
    personalizationContext: strongAdjacentHonestTransferContext,
    expectedContextClass: "cv_adjacent",
    notes:
      "Strong adjacent transfer case with quantified workflow improvement and no exact target-role title match.",
    realismTag: "strong_adjacent_honest_transfer",
  },
  {
    id: "strong-direct-ranking-conflict",
    preset: "engaging",
    jobTitle: "Revenue Operations Lead",
    jobDescription:
      "Lead revenue operations reporting, manage forecasting workflows, maintain CRM hygiene, coordinate cross-functional pipeline reviews, and support operating decisions. Salesforce, Excel, Windows, English, French basics, adaptability, and a certification mindset are all appreciated.",
    personalizationContext: strongDirectRankingConflictContext,
    expectedContextClass: "cv_direct",
    notes:
      "Direct case with strong quantified proof and leadership scope alongside many distracting weaker details.",
    realismTag: "strong_direct_ranking_conflict",
  },
  {
    id: "no-cv-entry-office",
    preset: "engaging",
    jobTitle: "Office Coordinator",
    jobDescription:
      "Coordinate daily office operations, manage scheduling and correspondence, handle supply ordering, support onboarding logistics, and keep shared administrative workflows organized across a busy team.",
    personalizationContext: noCvEntryOfficeContext,
    expectedContextClass: "no_cv",
    notes:
      "No CV case with name only; system must build the letter entirely from job offer content without inventing candidate history.",
    realismTag: "no_cv_entry",
  },
  {
    id: "multi-employer-ranking",
    preset: "signature",
    jobTitle: "Project Operations Lead",
    jobDescription:
      "Lead cross-functional project coordination, manage delivery tracking and reporting, and drive operational cadence across teams to keep projects moving on time.",
    personalizationContext: multiEmployerRankingContext,
    expectedContextClass: "cv_direct",
    notes:
      "Two-employer case where the current role has strong quantified proof and the older role has only task-level detail; tests that the writer prioritizes the stronger evidence.",
    realismTag: "multi_employer_ranking",
  },
  {
    id: "clean-engaging-direct",
    preset: "engaging",
    jobTitle: "Customer Success Manager",
    jobDescription:
      "Own enterprise account health, lead quarterly business reviews, coordinate onboarding for new customers, and build reporting that keeps the CS team focused on retention and expansion.",
    personalizationContext: cleanEngagingDirectContext,
    expectedContextClass: "cv_direct",
    notes:
      "Clean strong-direct case with no checklist noise or ranking conflict; tests engaging preset doing its warm-but-grounded job on a straightforward match.",
    realismTag: "clean_engaging_direct",
  },
];

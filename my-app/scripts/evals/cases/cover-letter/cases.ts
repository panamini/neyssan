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
];

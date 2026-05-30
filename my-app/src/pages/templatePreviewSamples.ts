import type { ProposalHeaderVisibility } from "../lib/proposal-header";
import type { ProposalApplicantHeaderData } from "../lib/proposal-personalization";

export const templatePreviewApplicant: ProposalApplicantHeaderData = {
  name: "Elena Marlowe",
  role: "Senior Product Designer",
  company: "Marlowe Studio",
  email: "elena@sample.design",
  phone: "+31 6 5555 2381",
  website: "elenamarlowe.design",
  linkedin: "linkedin.com/in/elenamarlowe",
  location: "Amsterdam, NL",
  tag: "Portfolio-ready sample",
};

export const templatePreviewProposal = {
  content: [
    "Hello Linear team,",
    "I am writing to share my interest in the Senior Product Designer role. My work sits at the intersection of product systems, editorial clarity, and calm workflows for complex teams.",
    "Across SaaS and media products, I have helped teams translate ambiguous briefs into interfaces that feel precise, durable, and easy to maintain. I would bring that same systems-minded craft to Linear's design practice.",
    "I would welcome the chance to discuss how my background in design direction and product storytelling could support the team.",
    "Kind regards,\nElena Marlowe",
  ].join("\n\n"),
  letterDate: "May 9, 2026",
  recipientDetails: "Linear team\nDesign org\nRemote",
  documentTitle: "Senior Product Designer",
  documentMeta: "Cover letter sample",
  contactLine: "elena@sample.design · elenamarlowe.design",
  railTitle: "Elena Marlowe",
  railMeta: "Senior Product Designer",
  headerVisibility: {
    showSender: true,
    showDate: true,
    showRecipient: true,
    showRecipientDetails: true,
    showSubject: true,
  } satisfies ProposalHeaderVisibility,
};

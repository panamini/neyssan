export type ProposalSourceKey =
  | "linkedin"
  | "indeed"
  | "upwork"
  | "ziprecruiter"
  | "hellowork";

export type ProposalExtensionSourceLink = {
  key: ProposalSourceKey;
  label: string;
  href: string;
  tier: "primary" | "secondary";
};

type ProposalSourceLinkTemplate = Omit<ProposalExtensionSourceLink, "href"> & {
  href: string | ((locale: string | null) => string);
};

export const PROPOSAL_EXTENSION_INSTALL_LINK = {
  label: "Install extension",
  // Temporary generic store entry until the production listing URL is finalized.
  href: "https://chromewebstore.google.com/",
} as const;

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  upwork: "Upwork",
  ziprecruiter: "ZipRecruiter",
  hellowork: "HelloWork",
  fiverr: "Fiverr",
};

const GENERIC_PLATFORM_LABELS = new Set(["web", "site", "website"]);

const PROPOSAL_EXTENSION_SOURCE_LINK_TEMPLATES: ProposalSourceLinkTemplate[] = [
  {
    key: "linkedin",
    label: "LinkedIn",
    href: "https://www.linkedin.com/jobs/",
    tier: "primary",
  },
  {
    key: "indeed",
    label: "Indeed",
    href: "https://www.indeed.com/jobs",
    tier: "primary",
  },
  {
    key: "upwork",
    label: "Upwork",
    href: "https://www.upwork.com/nx/jobs/search/",
    tier: "primary",
  },
  {
    key: "ziprecruiter",
    label: "ZipRecruiter",
    href: (locale: string | null) =>
      locale?.toLowerCase().startsWith("fr")
        ? "https://www.ziprecruiter.fr/"
        : "https://www.ziprecruiter.com",
    tier: "secondary",
  },
  {
    key: "hellowork",
    label: "HelloWork",
    href: "https://www.hellowork.com/fr-fr/",
    tier: "secondary",
  },
];

export function readProposalExtensionLocale(): string | null {
  if (typeof navigator !== "undefined") {
    const preferredLocale =
      Array.isArray(navigator.languages) && navigator.languages.length > 0
        ? navigator.languages[0]
        : navigator.language;
    if (typeof preferredLocale === "string" && preferredLocale.trim()) {
      return preferredLocale;
    }
  }
  if (typeof Intl !== "undefined") {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (typeof locale === "string" && locale.trim()) {
      return locale;
    }
  }
  return null;
}

export function getProposalExtensionSourceLinks(
  locale: string | null = readProposalExtensionLocale(),
): ProposalExtensionSourceLink[] {
  return PROPOSAL_EXTENSION_SOURCE_LINK_TEMPLATES.map((source) => ({
    ...source,
    href: typeof source.href === "function" ? source.href(locale) : source.href,
  }));
}

function readUrlHostname(value: string): string | null {
  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      return null;
    }
    try {
      return new URL(`https://${value}`).hostname
        .replace(/^www\./i, "")
        .toLowerCase();
    } catch {
      return null;
    }
  }
}

function inferProposalSourceKeyFromHostname(
  hostname: string | null,
): ProposalSourceKey | null {
  if (!hostname) return null;
  if (hostname.includes("linkedin.")) return "linkedin";
  if (hostname.includes("indeed.")) return "indeed";
  if (hostname.includes("upwork.")) return "upwork";
  if (hostname.includes("ziprecruiter.")) return "ziprecruiter";
  if (hostname.includes("hellowork.")) return "hellowork";
  return null;
}

export function getProposalSourceLabel(
  platform: string | null | undefined,
  sourceUrl: string | null | undefined,
): string | null {
  const normalizedPlatform = String(platform ?? "").trim().toLowerCase();
  if (normalizedPlatform && !GENERIC_PLATFORM_LABELS.has(normalizedPlatform)) {
    const knownLabel = PLATFORM_LABELS[normalizedPlatform];
    if (knownLabel) {
      return knownLabel;
    }
    return (
      normalizedPlatform.charAt(0).toUpperCase() + normalizedPlatform.slice(1)
    );
  }

  const hostname = readUrlHostname(String(sourceUrl ?? "").trim());
  const sourceKey = inferProposalSourceKeyFromHostname(hostname);
  if (sourceKey) {
    return PLATFORM_LABELS[sourceKey];
  }

  if (hostname) {
    return hostname;
  }

  return null;
}

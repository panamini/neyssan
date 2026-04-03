import type { ResumeLayoutVariantId } from "./resume.types";

export type ResumeDensitySpec = {
  displaySizeAdjust: string;
  titleSizeAdjust: string;
  bodySizeAdjust: string;
  bodySmSizeAdjust: string;
  sectionGapAdjust: string;
  headingMarginAdjust: string;
  bulletGapAdjust: string;
  projectGapAdjust: string;
  projectPaddingAdjust: string;
};

export type ResumeVariantSpec = {
  id: ResumeLayoutVariantId;
  label: string;
  title: string;
  subtitle: string;
  chips: string[];
  margins: { top: string; right: string; bottom: string; left: string };
  columns: { sidebar: string; gutter: string; main: string };
  liveArea: { width: string; height: string };
  header: {
    rowGap: string;
    bottomPadding: string;
    summaryMaxWidth: string;
    titleMarginTop: string;
  };
  body: { rowGap: string; sidebarRightPadding: string; mainLeftPadding: string };
  sidebarSection: {
    marginBottom: string;
    titleMarginBottom: string;
    titlePaddingBottom: string;
    contentGap: string;
  };
  mainSection: {
    marginBottom: string;
    headingGap: string;
    headingMarginBottom: string;
  };
  experience: {
    dateColumn: string;
    columnGap: string;
    itemGap: string;
    orgMarginBottom: string;
    bulletsPaddingLeft: string;
    bulletsGap: string;
  };
  projects: { cardGap: string; cardPadding: string; cardBackground: "surface" | "surfaceMuted" };
  education: { itemGap: string };
  skills: { gap: string; paddingInline: string; paddingBlock: string };
  density: ResumeDensitySpec;
};

export const resumeLayoutSpec = {
  page: {
    width: "210mm",
    height: "297mm",
    borderRadius: "1mm",
  },
  variants: {



    

    tschichold: {
      id: "tschichold",
      label: "Canon 12",
      title: "A4 12-grid résumé",
subtitle: "True A4 résumé canon: 18 / 25 / 35 / 50 mm",
chips: ["Resume", "A4", "12-grid"],
margins: { top: "25mm", right: "35mm", bottom: "50mm", left: "18mm" },
columns: { sidebar: "40mm", gutter: "9mm", main: "108mm" },
liveArea: { width: "157mm", height: "222mm" },
header: { rowGap: "3mm", bottomPadding: "5mm", summaryMaxWidth: "110mm", titleMarginTop: "1mm" },
      body: { rowGap: "8mm", sidebarRightPadding: "2mm", mainLeftPadding: "5mm" },
      sidebarSection: { marginBottom: "6mm", titleMarginBottom: "2mm", titlePaddingBottom: "1.5mm", contentGap: "1.6mm" },
      mainSection: { marginBottom: "6mm", headingGap: "3mm", headingMarginBottom: "2.5mm" },
      experience: { dateColumn: "20mm", columnGap: "4mm", itemGap: "5mm", orgMarginBottom: "1.6mm", bulletsPaddingLeft: "4mm", bulletsGap: "1.2mm" },
      projects: { cardGap: "3.5mm", cardPadding: "3.2mm", cardBackground: "surface" },
      education: { itemGap: "1.8mm" },
      skills: { gap: "2mm", paddingInline: "2.6mm", paddingBlock: "1.2mm" },
      density: {
        displaySizeAdjust: "-0.45mm",
        titleSizeAdjust: "-0.14mm",
        bodySizeAdjust: "-0.12mm",
        bodySmSizeAdjust: "-0.12mm",
        sectionGapAdjust: "-1.15mm",
        headingMarginAdjust: "-0.45mm",
        bulletGapAdjust: "-0.22mm",
        projectGapAdjust: "-0.55mm",
        projectPaddingAdjust: "-0.35mm",
      },
    },
   golden: {
  id: "golden",
  label: "Grid 17/18 atelier",
  title: "Editorial résumé alt",
  subtitle: "A quieter Grid 17/18 variant with a slimmer sidebar and wider content field",
  chips: ["Resume", "A4", "Editorial", "Alt"],

  margins: {
    top: "25mm",
    right: "27mm",
    bottom: "29mm",
    left: "25mm",
  },

  columns: {
    sidebar: "35mm",
    gutter: "13mm",
    main: "110mm",
  },

  liveArea: {
    width: "158mm",
    height: "243mm",
  },

  header: {
    rowGap: "4mm",
    bottomPadding: "6.5mm",
    summaryMaxWidth: "94mm",
    titleMarginTop: "2mm",
  },

  body: {
    rowGap: "8.2mm",
    sidebarRightPadding: "2.2mm",
    mainLeftPadding: "6.2mm",
  },

  sidebarSection: {
    marginBottom: "5.8mm",
    titleMarginBottom: "1.9mm",
    titlePaddingBottom: "1.1mm",
    contentGap: "1.45mm",
  },

  mainSection: {
    marginBottom: "6.2mm",
    headingGap: "3mm",
    headingMarginBottom: "2.3mm",
  },

  experience: {
    dateColumn: "22mm",
    columnGap: "5mm",
    itemGap: "5.1mm",
    orgMarginBottom: "1.35mm",
    bulletsPaddingLeft: "4.1mm",
    bulletsGap: "1.7mm",
  },

  projects: {
    cardGap: "3.8mm",
    cardPadding: "3.25mm",
    cardBackground: "surfaceMuted",
  },

  education: {
    itemGap: "1.8mm",
  },

  skills: {
    gap: "1.7mm",
    paddingInline: "1.95mm",
    paddingBlock: "0.82mm",
  },

  density: {
    displaySizeAdjust: "-0.05mm",
    titleSizeAdjust: "-0.05mm",
    bodySizeAdjust: "0mm",
    bodySmSizeAdjust: "-0.05mm",
    sectionGapAdjust: "-0.2mm",
    headingMarginAdjust: "0mm",
    bulletGapAdjust: "0.12mm",
    projectGapAdjust: "0mm",
    projectPaddingAdjust: "-0.05mm",
  },







      

    },

robial: {
  id: "robial",
  label: "Grid 17/18",
  title: "17/18 modular canon approximation",
  subtitle: "Closest practical 17 / 18 mm approximation to the A4 canon",
  chips: ["Modular", "17/18", "A4"],
  margins: {
    top: "26mm",
    right: "35mm",
    bottom: "53mm",
    left: "18mm",
  },
  columns: {
    sidebar: "35mm",
    gutter: "17mm",
    main: "105mm",
  },
  liveArea: {
    width: "157mm",
    height: "218mm",
  },
  header: {
    rowGap: "3mm",
    bottomPadding: "5mm",
    summaryMaxWidth: "128mm",
    titleMarginTop: "1mm",
  },
  body: {
    rowGap: "8mm",
    sidebarRightPadding: "0mm",
    mainLeftPadding: "0mm",
  },
  sidebarSection: {
    marginBottom: "5mm",
    titleMarginBottom: "2mm",
    titlePaddingBottom: "1.5mm",
    contentGap: "1.5mm",
  },
  mainSection: {
    marginBottom: "5mm",
    headingGap: "3mm",
    headingMarginBottom: "2.4mm",
  },
  experience: {
    dateColumn: "18mm",
    columnGap: "4mm",
    itemGap: "4.5mm",
    orgMarginBottom: "1.4mm",
    bulletsPaddingLeft: "3.5mm",
    bulletsGap: "1.1mm",
  },
  projects: {
    cardGap: "3mm",
    cardPadding: "3mm",
    cardBackground: "surfaceMuted",
  },
  education: {
    itemGap: "1.6mm",
  },
  skills: {
    gap: "1.6mm",
    paddingInline: "2.2mm",
    paddingBlock: "1mm",
  },
  density: {
    displaySizeAdjust: "-0.15mm",
    titleSizeAdjust: "0mm",
    bodySizeAdjust: "0mm",
    bodySmSizeAdjust: "-0.05mm",
    sectionGapAdjust: "-0.6mm",
    headingMarginAdjust: "-0.2mm",
    bulletGapAdjust: "-0.08mm",
    projectGapAdjust: "-0.2mm",
    projectPaddingAdjust: "-0.15mm",
  },
},
onecol: {
  id: "onecol",
  label: "One-column A4",
  title: "One-column editorial résumé",
  subtitle: "A4 one-column layout using the 17/18 page frame only",
  chips: ["Resume", "A4", "One-column"],

  margins: {
    top: "30mm",
    right: "35mm",
    bottom: "52mm",
    left: "35mm",
  },

  /* kept only for compatibility with the existing spec shape */
  columns: {
    sidebar: "0mm",
    gutter: "0mm",
    main: "0mm",
  },

  liveArea: {
    width: "150mm",
    height: "212mm",
  },

  header: {
    rowGap: "3.4mm",
    bottomPadding: "3.5mm",
    summaryMaxWidth: "98mm",
    titleMarginTop: "2mm",
  },

  body: {
    rowGap: "5.8mm",
    sidebarRightPadding: "0mm",
    mainLeftPadding: "0mm",
  },

  sidebarSection: {
    marginBottom: "0mm",
    titleMarginBottom: "0mm",
    titlePaddingBottom: "0mm",
    contentGap: "0mm",
  },

  mainSection: {
    marginBottom: "4.6mm",
    headingGap: "0mm",
    headingMarginBottom: "2.1mm",
  },

  experience: {
    dateColumn: "0mm",
    columnGap: "0mm",
    itemGap: "4mm",
    orgMarginBottom: "0.8mm",
    bulletsPaddingLeft: "3.4mm",
    bulletsGap: "0.9mm",
  },

  projects: {
    cardGap: "3.2mm",
    cardPadding: "2.8mm",
    cardBackground: "surfaceMuted",
  },

  education: {
    itemGap: "2mm",
  },

  skills: {
    gap: "1.5mm",
    paddingInline: "1.8mm",
    paddingBlock: "0.75mm",
  },

  density: {
    displaySizeAdjust: "-0.2mm",
    titleSizeAdjust: "-0.2mm",
    bodySizeAdjust: "-0.1mm",
    bodySmSizeAdjust: "-0.2mm",
    sectionGapAdjust: "-0.2mm",
    headingMarginAdjust: "0mm",
    bulletGapAdjust: "-0.1mm",
    projectGapAdjust: "-0.1mm",
    projectPaddingAdjust: "-0.1mm",
  },
},
swissminima: {
  id: "swissminima",
  label: "Swiss Minima",
  title: "Swiss register on a Robial field",
  subtitle: "Swiss editorial language rebuilt on the Robial 17/18 modular A4 grid",
  chips: ["Swiss", "Robial 17/18", "A4"],
  margins: {
    top: "17mm",
    right: "35mm",
    bottom: "35mm",
    left: "17mm",
  },
  columns: {
    sidebar: "35mm",
    gutter: "18mm",
    main: "105mm",
  },
  liveArea: {
    width: "158mm",
    height: "245mm",
  },
  header: {
    rowGap: "4mm",
    bottomPadding: "5mm",
    summaryMaxWidth: "108mm",
    titleMarginTop: "2mm",
  },
  body: {
    rowGap: "8mm",
    sidebarRightPadding: "0mm",
    mainLeftPadding: "0mm",
  },
  sidebarSection: {
    marginBottom: "0mm",
    titleMarginBottom: "0mm",
    titlePaddingBottom: "0mm",
    contentGap: "0mm",
  },
  mainSection: {
    marginBottom: "0mm",
    headingGap: "0mm",
    headingMarginBottom: "0mm",
  },
  experience: {
    dateColumn: "0mm",
    columnGap: "0mm",
    itemGap: "5mm",
    orgMarginBottom: "1.4mm",
    bulletsPaddingLeft: "3.5mm",
    bulletsGap: "1.2mm",
  },
  projects: {
    cardGap: "3mm",
    cardPadding: "2.6mm",
    cardBackground: "surfaceMuted",
  },
  education: {
    itemGap: "1.8mm",
  },
  skills: {
    gap: "1.7mm",
    paddingInline: "2mm",
    paddingBlock: "0.9mm",
  },
  density: {
    displaySizeAdjust: "0mm",
    titleSizeAdjust: "0mm",
    bodySizeAdjust: "-0.05mm",
    bodySmSizeAdjust: "-0.08mm",
    sectionGapAdjust: "-0.2mm",
    headingMarginAdjust: "0mm",
    bulletGapAdjust: "-0.05mm",
    projectGapAdjust: "-0.1mm",
    projectPaddingAdjust: "-0.1mm",
  },
},
editorialmag: {
  id: "editorialmag",
  label: "Editorial Wide",
  title: "Magazine editorial résumé",
  subtitle: "Canon 12 page field with a text-led feature column and a quieter support rail",
  chips: ["Editorial", "Canon 12", "Magazine"],
  margins: {
    top: "24.75mm",
    right: "35mm",
    bottom: "49.5mm",
    left: "17.5mm",
  },
  columns: {
    sidebar: "36mm",
    gutter: "17.5mm",
    main: "104mm",
  },
  liveArea: {
    width: "157.5mm",
    height: "222.75mm",
  },
  header: {
    rowGap: "4.5mm",
    bottomPadding: "6mm",
    summaryMaxWidth: "102mm",
    titleMarginTop: "2.4mm",
  },
  body: {
    rowGap: "7.5mm",
    sidebarRightPadding: "0mm",
    mainLeftPadding: "0mm",
  },
  sidebarSection: {
    marginBottom: "4.5mm",
    titleMarginBottom: "1.8mm",
    titlePaddingBottom: "1.2mm",
    contentGap: "1.8mm",
  },
  mainSection: {
    marginBottom: "5mm",
    headingGap: "2.5mm",
    headingMarginBottom: "2.2mm",
  },
  experience: {
    dateColumn: "0mm",
    columnGap: "0mm",
    itemGap: "4.6mm",
    orgMarginBottom: "1.1mm",
    bulletsPaddingLeft: "3.7mm",
    bulletsGap: "1.1mm",
  },
  projects: {
    cardGap: "3mm",
    cardPadding: "2.8mm",
    cardBackground: "surface",
  },
  education: {
    itemGap: "1.8mm",
  },
  skills: {
    gap: "1.6mm",
    paddingInline: "2mm",
    paddingBlock: "0.8mm",
  },
  density: {
    displaySizeAdjust: "-0.1mm",
    titleSizeAdjust: "0mm",
    bodySizeAdjust: "-0.05mm",
    bodySmSizeAdjust: "-0.05mm",
    sectionGapAdjust: "-0.1mm",
    headingMarginAdjust: "0mm",
    bulletGapAdjust: "-0.05mm",
    projectGapAdjust: "-0.05mm",
    projectPaddingAdjust: "-0.05mm",
  },
},
signalgrid: {
  id: "signalgrid",
  label: "Modernist Grid",
  title: "Modernist signal resume",
  subtitle: "A 17/18 modular A4 with a narrow signal rail, stronger data hierarchy, and whiter paper behaviour",
  chips: ["Modernist", "17/18", "Signal rail"],
  margins: {
    top: "17mm",
    right: "35mm",
    bottom: "35mm",
    left: "17mm",
  },
  columns: {
    sidebar: "28mm",
    gutter: "18mm",
    main: "105mm",
  },
  liveArea: {
    width: "158mm",
    height: "245mm",
  },
  header: {
    rowGap: "4mm",
    bottomPadding: "5mm",
    summaryMaxWidth: "96mm",
    titleMarginTop: "1mm",
  },
  body: {
    rowGap: "7mm",
    sidebarRightPadding: "0mm",
    mainLeftPadding: "0mm",
  },
  sidebarSection: {
    marginBottom: "4mm",
    titleMarginBottom: "1.6mm",
    titlePaddingBottom: "0.8mm",
    contentGap: "1.5mm",
  },
  mainSection: {
    marginBottom: "4.4mm",
    headingGap: "2.2mm",
    headingMarginBottom: "1.8mm",
  },
  experience: {
    dateColumn: "0mm",
    columnGap: "0mm",
    itemGap: "4mm",
    orgMarginBottom: "1mm",
    bulletsPaddingLeft: "3.5mm",
    bulletsGap: "0.9mm",
  },
  projects: {
    cardGap: "2.8mm",
    cardPadding: "2.6mm",
    cardBackground: "surface",
  },
  education: {
    itemGap: "1.6mm",
  },
  skills: {
    gap: "1.5mm",
    paddingInline: "1.8mm",
    paddingBlock: "0.75mm",
  },
  density: {
    displaySizeAdjust: "-0.08mm",
    titleSizeAdjust: "-0.05mm",
    bodySizeAdjust: "-0.05mm",
    bodySmSizeAdjust: "-0.08mm",
    sectionGapAdjust: "-0.1mm",
    headingMarginAdjust: "0mm",
    bulletGapAdjust: "-0.05mm",
    projectGapAdjust: "-0.05mm",
    projectPaddingAdjust: "-0.05mm",
  },
},
studiopop: {
  id: "studiopop",
  label: "Studio Pop",
  title: "Playful creative résumé with portrait",
  subtitle: "Expressive split-page layout with photo, colour fields, and a lighter creative tempo",
  chips: ["Creative", "Photo", "Expressive"],
  margins: {
    top: "20mm",
    right: "18mm",
    bottom: "20mm",
    left: "18mm",
  },
  columns: {
    sidebar: "58mm",
    gutter: "12mm",
    main: "104mm",
  },
  liveArea: {
    width: "174mm",
    height: "257mm",
  },
  header: {
    rowGap: "4mm",
    bottomPadding: "4mm",
    summaryMaxWidth: "86mm",
    titleMarginTop: "0mm",
  },
  body: {
    rowGap: "6.8mm",
    sidebarRightPadding: "0mm",
    mainLeftPadding: "0mm",
  },
  sidebarSection: {
    marginBottom: "4.4mm",
    titleMarginBottom: "1.8mm",
    titlePaddingBottom: "0.8mm",
    contentGap: "1.4mm",
  },
  mainSection: {
    marginBottom: "4.8mm",
    headingGap: "2.2mm",
    headingMarginBottom: "2mm",
  },
  experience: {
    dateColumn: "0mm",
    columnGap: "0mm",
    itemGap: "4mm",
    orgMarginBottom: "1.1mm",
    bulletsPaddingLeft: "3.6mm",
    bulletsGap: "1.05mm",
  },
  projects: {
    cardGap: "2.8mm",
    cardPadding: "2.8mm",
    cardBackground: "surface",
  },
  education: {
    itemGap: "1.6mm",
  },
  skills: {
    gap: "1.5mm",
    paddingInline: "1.8mm",
    paddingBlock: "0.8mm",
  },
  density: {
    displaySizeAdjust: "0mm",
    titleSizeAdjust: "0mm",
    bodySizeAdjust: "-0.05mm",
    bodySmSizeAdjust: "-0.08mm",
    sectionGapAdjust: "-0.1mm",
    headingMarginAdjust: "0mm",
    bulletGapAdjust: "-0.05mm",
    projectGapAdjust: "-0.05mm",
    projectPaddingAdjust: "-0.05mm",
  },
},
softribbon: {
  id: "softribbon",
  label: "Soft Ribbon",
  title: "Rounded portrait ribbon résumé",
  subtitle: "Soft rails, pill headings, and an integrated portrait for a friendlier premium document",
  chips: ["Rounded", "Photo", "Pastel"],
  margins: {
    top: "18mm",
    right: "18mm",
    bottom: "18mm",
    left: "18mm",
  },
  columns: {
    sidebar: "62mm",
    gutter: "10mm",
    main: "102mm",
  },
  liveArea: {
    width: "174mm",
    height: "261mm",
  },
  header: {
    rowGap: "4mm",
    bottomPadding: "4mm",
    summaryMaxWidth: "92mm",
    titleMarginTop: "0mm",
  },
  body: {
    rowGap: "6.4mm",
    sidebarRightPadding: "0mm",
    mainLeftPadding: "0mm",
  },
  sidebarSection: {
    marginBottom: "4.2mm",
    titleMarginBottom: "1.8mm",
    titlePaddingBottom: "0.7mm",
    contentGap: "1.4mm",
  },
  mainSection: {
    marginBottom: "4.4mm",
    headingGap: "2mm",
    headingMarginBottom: "1.8mm",
  },
  experience: {
    dateColumn: "0mm",
    columnGap: "0mm",
    itemGap: "4mm",
    orgMarginBottom: "1mm",
    bulletsPaddingLeft: "3.6mm",
    bulletsGap: "1.05mm",
  },
  projects: {
    cardGap: "2.8mm",
    cardPadding: "2.8mm",
    cardBackground: "surfaceMuted",
  },
  education: {
    itemGap: "1.5mm",
  },
  skills: {
    gap: "1.4mm",
    paddingInline: "1.9mm",
    paddingBlock: "0.75mm",
  },
  density: {
    displaySizeAdjust: "-0.05mm",
    titleSizeAdjust: "-0.05mm",
    bodySizeAdjust: "-0.08mm",
    bodySmSizeAdjust: "-0.08mm",
    sectionGapAdjust: "-0.1mm",
    headingMarginAdjust: "0mm",
    bulletGapAdjust: "-0.05mm",
    projectGapAdjust: "-0.05mm",
    projectPaddingAdjust: "-0.05mm",
  },
},
slateprofile: {
  id: "slateprofile",
  label: "Slate Column",
  title: "Profile rail résumé",
  subtitle: "Dark slate column with a sharper corporate reading field and structured section bands",
  chips: ["Slate", "Structured", "Corporate"],
  margins: {
    top: "16mm",
    right: "16mm",
    bottom: "16mm",
    left: "16mm",
  },
  columns: {
    sidebar: "54mm",
    gutter: "10mm",
    main: "114mm",
  },
  liveArea: {
    width: "178mm",
    height: "265mm",
  },
  header: {
    rowGap: "4mm",
    bottomPadding: "4mm",
    summaryMaxWidth: "92mm",
    titleMarginTop: "0mm",
  },
  body: {
    rowGap: "6mm",
    sidebarRightPadding: "0mm",
    mainLeftPadding: "0mm",
  },
  sidebarSection: {
    marginBottom: "4.2mm",
    titleMarginBottom: "1.7mm",
    titlePaddingBottom: "0.7mm",
    contentGap: "1.35mm",
  },
  mainSection: {
    marginBottom: "4.6mm",
    headingGap: "2.1mm",
    headingMarginBottom: "1.9mm",
  },
  experience: {
    dateColumn: "0mm",
    columnGap: "0mm",
    itemGap: "3.8mm",
    orgMarginBottom: "1mm",
    bulletsPaddingLeft: "3.4mm",
    bulletsGap: "1mm",
  },
  projects: {
    cardGap: "2.6mm",
    cardPadding: "2.7mm",
    cardBackground: "surface",
  },
  education: {
    itemGap: "1.5mm",
  },
  skills: {
    gap: "1.4mm",
    paddingInline: "1.8mm",
    paddingBlock: "0.72mm",
  },
  density: {
    displaySizeAdjust: "-0.1mm",
    titleSizeAdjust: "-0.08mm",
    bodySizeAdjust: "-0.08mm",
    bodySmSizeAdjust: "-0.1mm",
    sectionGapAdjust: "-0.12mm",
    headingMarginAdjust: "0mm",
    bulletGapAdjust: "-0.08mm",
    projectGapAdjust: "-0.08mm",
    projectPaddingAdjust: "-0.06mm",
  },
},

quire: {
  id: "quire",
  label: "Quire",
  title: "Typographic editorial résumé",
  subtitle: "Prose skills, monospace dates, italic serif roles — pure typographic hierarchy without decorative structure",
  chips: ["Editorial", "Typographic", "A4"],

  margins: {
    top: "22mm",
    right: "28mm",
    bottom: "38mm",
    left: "20mm",
  },

  columns: {
    sidebar: "57mm",
    gutter: "0mm",
    main: "105mm",
  },

  liveArea: {
    width: "162mm",
    height: "237mm",
  },

  header: {
    rowGap: "3.5mm",
    bottomPadding: "5.5mm",
    summaryMaxWidth: "115mm",
    titleMarginTop: "1.5mm",
  },

  body: {
    rowGap: "7mm",
    sidebarRightPadding: "0mm",
    mainLeftPadding: "0mm",
  },

  sidebarSection: {
    marginBottom: "5.5mm",
    titleMarginBottom: "2mm",
    titlePaddingBottom: "1.2mm",
    contentGap: "1.6mm",
  },

  mainSection: {
    marginBottom: "5.5mm",
    headingGap: "2.8mm",
    headingMarginBottom: "2.4mm",
  },

  experience: {
    dateColumn: "19mm",
    columnGap: "4mm",
    itemGap: "5mm",
    orgMarginBottom: "1.2mm",
    bulletsPaddingLeft: "3.6mm",
    bulletsGap: "1.2mm",
  },

  projects: {
    cardGap: "3.2mm",
    cardPadding: "3mm",
    cardBackground: "surface",
  },

  education: {
    itemGap: "2mm",
  },

  skills: {
    gap: "1.8mm",
    paddingInline: "0mm",
    paddingBlock: "0mm",
  },

  density: {
    displaySizeAdjust: "-0.55mm",
    titleSizeAdjust: "-0.1mm",
    bodySizeAdjust: "-0.05mm",
    bodySmSizeAdjust: "-0.08mm",
    sectionGapAdjust: "-0.2mm",
    headingMarginAdjust: "0mm",
    bulletGapAdjust: "-0.05mm",
    projectGapAdjust: "-0.1mm",
    projectPaddingAdjust: "-0.05mm",
  },
},

  } satisfies Record<ResumeLayoutVariantId, ResumeVariantSpec>,
} as const;

import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { canonicalizeParserResult } from "../canonicalize";
import { buildTypedSectionsFromNormalized } from "../../../../src/utils/cv/mapping-utils";

describe("canonicalizeParserResult", () => {
  const context = {
    rawText: "Sample resume text",
    mode: "text",
    parserUrl: "https://example.test/parse-cv",
  };

  it("synthesizes canonical arrays from raw sections when normalized data is absent", () => {
    const parserResult = {
      diagnostics: { fallback_used: true },
      raw_sections: [
        { label: "EXPERIENCE", content: "Foo Corp — Software Engineer" },
        { label: "EDUCATION", content: "Bar University — BSc Computer Science" },
        { label: "SKILLS", content: "Python, Typescript" },
        { label: "LANGUAGES", content: "English; French" },
        { label: "ACHIEVEMENTS", content: "Employee of the Month" },
      ],
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const normalized = canonical.normalized ?? {};

    expect(Array.isArray(normalized.experience)).toBe(true);
    expect(normalized.experience.length).toBeGreaterThan(0);
    expect(normalized.experience[0]?.company).toContain("Foo Corp");

    expect(Array.isArray(normalized.education)).toBe(true);
    expect(normalized.education.length).toBeGreaterThan(0);
    expect(normalized.education[0]?.institution).toContain("Bar University");

    expect(Array.isArray(normalized.skills)).toBe(true);
    expect(normalized.skills.map((item: any) => item?.name)).toContain("Python");

    expect(Array.isArray(normalized.languages)).toBe(true);
    expect(normalized.languages.map((item: any) => item?.name)).toContain("English");

    expect(Array.isArray(normalized.achievements)).toBe(true);
    expect(normalized.achievements[0]?.text).toContain("Employee of the Month");

    expect(Array.isArray(normalized.rawSections)).toBe(true);
    expect(normalized.rawSections.length).toBeGreaterThan(0);
  });

  it("preserves existing normalized arrays and metadata", () => {
    const parserResult = {
      diagnostics: { fallback_used: false },
      normalized: {
        experience: [{ id: "exp-1", company: "ACME", position: "Manager" }],
        education: [{ id: "edu-1", institution: "Example College", degree: "MBA" }],
        skills: [{ id: "skill-1", name: "Leadership" }],
        languages: [{ id: "lang-1", name: "English", level: "Native" }],
        achievements: [{ id: "ach-1", text: "Closed $1M deal" }],
        rawSections: [{ label: "EXPERIENCE", content: "ACME" }],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const normalized = canonical.normalized ?? {};

    expect(normalized.experience).toHaveLength(1);
    expect(normalized.experience[0]?.company).toBe("ACME");

    expect(normalized.education).toHaveLength(1);
    expect(normalized.education[0]?.degree).toBe("MBA");

    expect(normalized.skills).toHaveLength(1);
    expect(normalized.skills[0]?.name).toBe("Leadership");

    expect(normalized.languages).toHaveLength(1);
    expect(normalized.languages[0]?.name).toBe("English");

    expect(normalized.achievements).toHaveLength(1);
    expect(normalized.achievements[0]?.text).toBe("Closed $1M deal");
  });

  it("splits raw experience sections into discrete entries", () => {
    const parserResult = {
      raw_sections: [
        {
          label: "EXPERIENCE",
          content: "Engineer Jan 2020 – Apr 2021\nACME Corp, Seattle, WA\n- Automated deployments\nScaled tooling",
        },
        {
          label: "EXPERIENCE",
          content: "Analyst May 2021 – Present\nExample Inc, New York, NY\n- Led reporting modernization",
        },
      ],
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const experience = canonical.normalized?.experience ?? [];
    expect(experience.length).toBe(2);
    expect((experience[0]?.achievements || []).join(" ")).toContain("Automated deployments");
    expect(experience[1]?.isCurrent).toBe(true);
    expect(canonical.diagnostics?.experience_fallback_count).toBe(2);
  });

  it("preserves coherent normalized experience even when raw sections are noisier and more numerous", () => {
    const parserResult = {
      normalized: {
        experience: [
          {
            id: "exp-1",
            company: "ADT Security",
            position: "Security Guard",
            startDate: "2021-01-01",
            endDate: "2022-04-01",
            location: "Port Washington",
            responsibilityBullets: [
              "Maintaining environments by monitoring the grounds and equipment controls.",
            ],
          },
        ],
        rawSections: [
          {
            label: "EXPERIENCE",
            content:
              "Security Guard\nADT Security\nJanuary 2021 — April 2022\n\nSecurity Guard\nADT Security • Experience\nJanuary 2021\n\nJanuary 2020 — April 2022 Inspecting restrooms after closing time",
          },
        ],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const experience = canonical.normalized?.experience ?? [];

    expect(experience).toHaveLength(1);
    expect(experience[0]?.company).toBe("ADT Security");
    expect(experience[0]?.position).toBe("Security Guard");
    expect(experience[0]?.startDate).toBe("2021-01-01");
    expect(experience[0]?.endDate).toBe("2022-04-01");
  });

  it("splits a Jake-style collapsed normalized projects blob into distinct project entries", () => {
    const rawProjects =
      "Gitlytics | Python, Flask, React, PostgreSQL, Docker June 2020 – Present - Developed a full-stack web application using Flask serving a REST API with React as the frontend - Implemented GitHub OAuth to get data from user's repositories - Visualized GitHub data to show collaboration - Used Celery and Redis for asynchronous tasks Simple Paintball | Spigot API, Java, Maven, TravisCI, Git May 2018 – May 2020 - Developed a Minecraft server plugin to entertain kids during free time for a previous job - Published plugin to websites gaining 2K+ downloads and an average 4.5/5-star review - Implemented continuous delivery using TravisCI to build the plugin upon new a release - Collaborated with Minecraft server administrators to suggest features and get feedback about the plugin";

    const canonical = canonicalizeParserResult(
      {
        normalized: {
          projects: [
            { title: rawProjects },
            { title: "Gitlytics | Python, Flask, React, PostgreSQL, Docker June 2020 Present" },
          ],
          rawSections: [{ label: "Projects", content: rawProjects }],
        },
      },
      context,
    );

    const projects = canonical.normalized?.projects ?? [];
    expect(projects).toHaveLength(2);
    expect(projects[0]?.title).toBe("Gitlytics | Python, Flask, React, PostgreSQL, Docker | June 2020 – Present");
    expect(projects[1]?.title).toBe("Simple Paintball | Spigot API, Java, Maven, TravisCI, Git | May 2018 – May 2020");
    expect(projects[0]?.summary).toContain("Developed a full-stack web application");
    expect(projects[1]?.summary).toContain("Published plugin to websites gaining 2K+ downloads");
  });

  it("filters Qwikresume footer education noise, keeps summary on the explicit summary section, and recovers skills from core competencies without reopening experience recovery", () => {
    const summarySection =
      "Cash handling accuracy Excellent multi-tasker Organized Friendly Dependable Reliable Strong communication skills Punctual Flexible schedule Knowledge of MS Office and POS.";
    const competenciesSection = "Accounting, Data Entry, WindowsXP-8, Technology Management. ##";
    const experienceSection = [
      "Lead Customer Advocate",
      "CitySquare - 2015 – Present",
      "Worked with men, women and children who were attempting to leave a violent relationship",
      "",
      "Advocate",
      "ABC Corporation - 2011 – 2015",
      "45133 (937) 393-8118 Facilitating groups such as, Anger Management, Mens Domestic Violence Offender Program, Teen Anger Management, Parenting/Child Abuse and Youth Violence Prevention",
      "Assisting victims of domestic violence through court advocacy, safety planning, housing referral and crisis intervention",
      "Planning and facilitating school/youth success programs that target at-risk youth",
    ].join("\n");
    const educationNoise =
      "2259 Oak Street\nOld Forge, New York, 13420 This Free Resume Template is the copyright of Qwikresume.com. Usage Guidelines";

    const canonical = canonicalizeParserResult(
      {
        raw_sections: [
          { label: "SUMMARY", content: summarySection },
          { label: "CORE COMPETENCIES", content: competenciesSection },
          { label: "EXPERIENCE", content: experienceSection },
          { label: "EDUCATION", content: educationNoise },
        ],
        normalized: {
          summary: {
            text: "Worked with men women and children who were attempting to leave a violent relationship",
          },
          experience: [
            {
              company: "CitySquare",
              position: "Lead Customer Advocate",
              startDate: "2015-01-01",
              isCurrent: true,
            },
          ],
          rawText: [
            "ROBERT SMITH",
            "Lead Customer Advocate",
            "info@qwikresume.com",
            summarySection,
            "CORE COMPETENCIES",
            competenciesSection,
            experienceSection,
            educationNoise,
            "Qwikresume.com",
          ].join("\n"),
        },
      },
      context,
    );

    expect(canonical.normalized?.summary?.text).toBe(summarySection);
    expect(canonical.normalized?.education ?? []).toHaveLength(0);
    expect(canonical.normalized?.skills?.map((item: any) => item?.name)).toEqual(
      expect.arrayContaining(["Accounting", "Data Entry", "WindowsXP-8", "Technology Management"]),
    );
    expect((canonical.normalized?.rawSections ?? []).some((section: any) => /Qwikresume/i.test(String(section?.content ?? "")))).toBe(false);
  });

  it("keeps normalized experience and repairs header-echo locations when entries are otherwise coherent", () => {
    const parserResult = {
      normalized: {
        rawText: [
          "ROBERT COOPER",
          "Security Guard at ADT Security, Port Washington",
          "January 2021 - April 2022",
          "Responsible for completing reports by recording information, observations, occurrences, and surveillance activities.",
          "",
          "Security Guard at Copwatch, Jogbani",
          "January 2020 - April 2022",
          "Inspecting restrooms after closing time for vagrants/ unauthorized personnel.",
        ].join("\n"),
        experience: [
          {
            id: "exp-1",
            company: "ADT Security",
            position: "Security Guard",
            startDate: "2021-01-01",
            endDate: "2022-04-01",
            location: "Security Guard at ADT Security, Port Washington",
            responsibilityBullets: [
              "Responsible for completing reports by recording information, observations, occurrences, and surveillance activities.",
            ],
          },
          {
            id: "exp-2",
            company: "Copwatch",
            position: "Security Guard",
            startDate: "2020-01-01",
            endDate: "2022-04-01",
            location: "Security Guard at Copwatch, Jogbani",
            responsibilityBullets: [
              "Inspecting restrooms after closing time for vagrants/ unauthorized personnel.",
            ],
          },
        ],
        rawSections: [
          {
            label: "EXPERIENCE",
            content: [
              "Security Guard at ADT Security, Port Washington",
              "January 2021 - April 2022",
              "Responsible for completing reports by recording information, observations, occurrences, and surveillance activities.",
              "",
              "Security Guard at Copwatch, Jogbani",
              "January 2020 - April 2022",
              "Inspecting restrooms after closing time for vagrants/ unauthorized personnel.",
            ].join("\n"),
          },
        ],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const experience = canonical.normalized?.experience ?? [];

    expect(canonical.diagnostics?.experience_source).not.toBe("raw_sections");
    expect(experience).toHaveLength(2);
    expect(experience[0]?.company).toBe("ADT Security");
    expect(experience[0]?.position).toBe("Security Guard");
    expect(experience[0]?.location).toBe("Port Washington");
    expect(experience[1]?.location).toBe("Jogbani");
    expect(experience.some((entry: any) => /security guard at/i.test(String(entry?.location ?? "")))).toBe(false);
  });

  it("keeps a real header name over a same-block header location and recovers the location", () => {
    const rawText = [
      "HELEN D. KETTER",
      "New York",
      "Fashion Writer Turned Designer",
      "helen@example.com",
    ].join("\n");

    const canonical = canonicalizeParserResult(
      {
        normalized: {
          rawText,
          name: "New York",
          contact: {
            raw: rawText,
            name: "New York",
            email: "helen@example.com",
          },
        },
      },
      {
        rawText,
        mode: "text",
        parserUrl: "https://parser.dasti.ai/mistral-ocr/parse",
      },
    );

    expect(canonical.normalized?.name).toBe("Helen D. Ketter");
    expect(canonical.normalized?.contact?.name).toBe("Helen D. Ketter");
    expect(canonical.normalized?.identitySchema?.name).toBe("Helen D. Ketter");
    expect(canonical.normalized?.desiredPosition).toBe("Fashion Writer Turned Designer");
    expect(canonical.normalized?.contact?.location).toBe("New York");
    expect(canonical.normalized?.contact?.addressNormalized).toBe("New York");
  });

  it("keeps the coherent normalized subset instead of falling back to raw sections for the whole experience section", () => {
    const parserResult = {
      normalized: {
        experience: [
          {
            id: "exp-1",
            company: "ADT Security",
            position: "Security Guard",
            startDate: "2021-01-01",
            endDate: "2022-04-01",
            location: "Security Guard at ADT Security, Port Washington",
            responsibilityBullets: [
              "Responsible for completing reports by recording information, observations, occurrences, and surveillance activities.",
            ],
          },
          {
            id: "exp-2",
            company: "Southwestern University",
            position: "",
            responsibilities: "Communicate with managers to set up campus computers used on campus.",
          },
        ],
        rawSections: [
          {
            label: "EXPERIENCE",
            content: [
              "Security Guard at ADT Security, Port Washington",
              "January 2021 - April 2022",
              "Responsible for completing reports by recording information, observations, occurrences, and surveillance activities.",
              "",
              "Information Technology Support Specialist",
              "Southwestern University",
              "Sep 1, 2018 — Present",
              "Communicate with managers to set up campus computers used on campus.",
            ].join("\n"),
          },
        ],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const experience = canonical.normalized?.experience ?? [];

    expect(canonical.diagnostics?.experience_source).not.toBe("raw_sections");
    expect(experience).toHaveLength(1);
    expect(experience[0]?.company).toBe("ADT Security");
    expect(experience[0]?.position).toBe("Security Guard");
    expect(experience[0]?.location).toBe("Port Washington");
  });

  it("trusts explicit responsibility bullets over a duplicated flattened responsibilities string", () => {
    const bullets = [
      "Responsible for completing reports by recording information, observations, occurrences, and surveillance activities, including interviewing of witnesses and acquiring signatures",
      "Maintaining environments by monitoring the grounds and equipment controls",
      "Logging into security headquarters on the hour during the day and every 2 hours with the night shift, notifying control of all in order statuses",
    ];
    const parserResult = {
      normalized: {
        experience: [
          {
            id: "exp-1",
            company: "ADT Security",
            position: "Security Guard",
            startDate: "2021-01-01",
            endDate: "2022-04-01",
            location: "Port Washington",
            responsibilityBullets: bullets,
            responsibilities: `${bullets.join("\n")} ${bullets.join(" ")}`,
          },
        ],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const experience = canonical.normalized?.experience ?? [];

    expect(canonical.diagnostics?.experience_source).not.toBe("raw_sections");
    expect(experience).toHaveLength(1);
    expect(experience[0]?.responsibilityBullets).toEqual(bullets);
    expect(experience[0]?.responsibilities).toBe(bullets.join("\n"));
  });

  it("keeps distinct normalized Jake entries without duplicating each responsibility block", () => {
    const supportBullets = [
      "Communicate with managers to set up campus computers used on campus",
      "Assess and troubleshoot computer problems brought by students, faculty and staff",
      "Maintain upkeep of computers, classroom equipment, and 200 printers across campus",
    ];
    const researchBullets = [
      "Explored methods to generate video game dungeons based off of The Legend of Zelda",
      "Developed a game in Java to test the generated dungeons",
      "Contributed 50K+ lines of code to an established codebase via Git",
    ];
    const parserResult = {
      normalized: {
        experience: [
          {
            id: "exp-1",
            company: "Southwestern University",
            position: "Information Technology Support Specialist",
            startDate: "2018-09-01",
            isCurrent: true,
            responsibilityBullets: supportBullets,
            responsibilities: `${supportBullets.join("\n")} ${supportBullets.join(" ")}`,
          },
          {
            id: "exp-2",
            company: "Southwestern University",
            position: "Artificial Intelligence Research Assistant",
            startDate: "2019-05-01",
            isCurrent: true,
            responsibilityBullets: researchBullets,
            responsibilities: `${researchBullets.join("\n")} ${researchBullets.join(" ")}`,
          },
        ],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const experience = canonical.normalized?.experience ?? [];

    expect(canonical.diagnostics?.experience_source).not.toBe("raw_sections");
    expect(experience).toHaveLength(2);
    expect(experience[0]?.responsibilityBullets).toEqual(supportBullets);
    expect(experience[0]?.responsibilities).toBe(supportBullets.join("\n"));
    expect(experience[1]?.responsibilityBullets).toEqual(researchBullets);
    expect(experience[1]?.responsibilities).toBe(researchBullets.join("\n"));
  });

  it("fails closed on matrix-header residue instead of surfacing a fake experience entry", () => {
    const matrixBlock = [
      "Name Of City , Reason For",
      "Designation From To Duration",
      "Organization Country. Leaving",
      "Applied Plant",
      "Coimbatore, Layoff due to",
      "Automation Maintenance 02/05/2010 05/11/2010 6 Months",
      "India. power cut.",
      "Systems technician.",
      "Maintenance",
      "Coimbatore, Apprentice",
      "LMW (Unit - I) work quality 24/12/2010 24/12/2011 1 Year",
      "India. Period Over.",
      "Inspector",
      "AMC",
      "Sun Business Trichy , Salary",
      "Maintenance 05/02/2012 12/08/2012 6 Months",
      "Solutions India. Problem.",
      "technician.",
      "AMC",
    ].join("\n");

    const parserResult = {
      normalized: {
        rawText: matrixBlock,
        experience: [
          {
            id: "exp-1",
            company: "Organization Country",
            position: "Designation From To Duration",
            startDate: "2010-01-01",
            endDate: "2010-11-05",
            location: "Name Of City , Reason For",
            responsibilityBullets: ["Reason for leaving: Layoff due to power cut."],
          },
        ],
        rawSections: [{ label: "EXPERIENCE", content: matrixBlock }],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const experience = canonical.normalized?.experience ?? [];

    expect(experience).toEqual([]);
    expect(canonical.diagnostics?.experience_source).toBeUndefined();
  });

  it("still falls back to raw sections when normalized experience is placeholder-like", () => {
    const parserResult = {
      normalized: {
        experience: [
          {
            id: "exp-1",
            company: "",
            position: "Professional Experience",
            responsibilities: "",
          },
        ],
        rawSections: [
          {
            label: "EXPERIENCE",
            content:
              "Engineer Jan 2020 – Apr 2021\nACME Corp, Seattle, WA\n- Automated deployments",
          },
        ],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const experience = canonical.normalized?.experience ?? [];

    expect(canonical.diagnostics?.experience_source).toBe("raw_sections");
    expect(experience.length).toBeGreaterThan(0);
    expect(experience[0]?.company).toContain("ACME");
  });

  it("blocks personal-details residue from experience fallback output", () => {
    const parserResult = {
      normalized: {
        experience: [],
        rawSections: [
          {
            label: "EXPERIENCE",
            content: [
              "Father S Name Ali Adil",
              "## PERSONAL DETAILS:",
              "Jul 1, 1996",
              "Marital Status : Unmarried",
            ].join("\n"),
          },
        ],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const experience = canonical.normalized?.experience ?? [];

    expect(experience).toEqual([]);
    expect(canonical.diagnostics?.experience_source).toBeUndefined();
  });

  it("fails closed for the real Divyank fixture text because it has training but no experience section", () => {
    const rawText = [
      "CURRICULUM VITAE",
      "DIVYANK SINGH",
      "Email: divyank_singh@outlook.com",
      "CAREER OBJECTIVE:",
      "Seeking entry level assignments in Engine Research centre Production Maintenance Quality with a growth oriented organisation.",
      "TRAINING:",
      "Completed 4 weeks training in TATA Motors Ltd Lucknow.",
      "Department Trim line 2.",
      "Topic Lean Manufacture.",
      "Project description: The project is about reducing motion of operators by implementing Spaghetti diagram.",
      "CORE STRENGTH:",
      "Hard working and quick learner",
      "ACADEMIC QUALIFICATION:",
      "B.TECH 2014 Engineering and Technology Jaipur National University 67.4",
      "SKILLS:",
      "Microsoft office",
      "ACHIEVEMENTS:",
      "Played one time National and three times regional in Handball",
    ].join("\n");

    const canonical = canonicalizeParserResult(
      {
        normalized: {
          rawText,
          experience: [],
        },
      },
      {
        ...context,
        rawText,
      },
    );

    expect(canonical.normalized?.experience ?? []).toEqual([]);
    expect(canonical.diagnostics?.experience_source).toBeUndefined();
  });

  it("keeps Prasanna-style fragmented rows as surfaced experience entries when normalized experience is empty", () => {
    const rawExperience = [
      "Plant Maintenance technician",
      "Applied Automation Systems • Coimbatore, India.",
      "Jan 1, 2010",
      "Reason for leaving: Layoff due to power cut.",
      "",
      "Maintenance work quality Inspector",
      "LMW (Unit - I) • Coimbatore, India.",
      "Jan 1, 2010",
      "Reason for leaving: Apprentice Period Over.",
      "",
      "AMC Maintenance technician",
      "Sun Business Solutions • Trichy, India.",
      "Jan 1, 2012",
      "Reason for leaving: Salary Problem.",
    ].join("\n");

    const canonical = canonicalizeParserResult(
      {
        normalized: {
          experience: [],
          rawText: `Experience\n${rawExperience}`,
          rawSections: [{ label: "EXPERIENCE", content: rawExperience }],
        },
      },
      {
        ...context,
        rawText: `Experience\n${rawExperience}`,
      },
    );

    const experience = canonical.normalized?.experience ?? [];
    expect(experience).toHaveLength(3);
    expect(String(experience[0]?.company ?? "")).toContain("Applied Automation Systems");
    expect(experience[0]?.position).toBe("Plant Maintenance technician");
    expect(String(experience[1]?.company ?? "")).toContain("LMW (Unit - I)");
    expect(String(experience[2]?.company ?? "")).toContain("Sun Business Solutions");

    const sections = buildTypedSectionsFromNormalized(canonical.normalized ?? {});
    const experienceSection = sections.find((section) => section.type === "experience");
    expect(experienceSection?.structuredContent).toHaveLength(3);
  });

  it("fails closed on Jessica-style merged OCR experience blocks instead of emitting malformed fallback rows", () => {
    const rawExperience = [
      "Spring Education Group - Middle School Language Arts Teacher Issaquah, WA 08/2010 - Current - Taught all levels of English language arts including intensive, regular, and advanced students - Taught seventh and eight grade students - Instructed English language learners, students with disabilities, and gifted students - Taught special education students in an inclusion classroom - Analyzes and uses student data to drive instruction - Participating teacher in Collier County's Instruction through Digital Innovation Program - Coaches school scholar bowl team in which students compete against other private and public school teams to answer questions from the areas of mathematics, science, language arts, social studies, current events, and fine arts - Master teacher of Florida Teaching Evaluation Model - Seventh grade team leader for three years - Plans grade level field trips and leads grade level meetings - Served on the principal's advisory council - Host for college student observers - Served on the sunshine committee responsible for planning socials and showing appreciation to staff",
      "Falcon School District 49 - Elementary School Teacher Peyton, CO 08/2008 - 06/2010 - Gained experience teaching in a Title I school with a diverse student population including migrant students and English language learners - Taught three subject areas - Taught sixth grade - Collaborated with administrators, special education teachers, language tutors, and other support personnel to ensure success of English language learners, migrant students, students with disabilities, low achieving students, and at-risk students - Completed Sheltered Instruction Observation Protocol (SIOP) training which helps prepare all students, especially English learners for college and careers - Modified general education curriculum for English language learners using various instructional techniques and technologies - Organized and led safety patrol",
      "Falcon School District 49 - Elementary School Teacher Peyton, CO 08/2007 - 06/2008 - Taught five subject areas - Taught fourth grade - Integrated a biblical worldview into all subject areas and lessons - Taught Bible classes - Led staff devotions - Established and maintained rapport with other staff, students, and parents to facilitate communication and academic progress - Built positive relationships with parents to involve families in educational process",
      "ACCOMPLISHMENTS - Interviewed and selected to be the attending teacher of an instructional residency program with another school district in state of Florida. Led virtual PLC meetings in which principals and lead teachers from another district learned from my instructional practice",
    ].join(" ");

    const canonical = canonicalizeParserResult(
      {
        normalized: {
          experience: [],
          rawText: rawExperience,
          rawSections: [{ label: "EXPERIENCE", content: rawExperience }],
        },
      },
      {
        ...context,
        rawText: rawExperience,
      },
    );

    const experience = canonical.normalized?.experience ?? [];

    expect(experience).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          position: "Spring Education Group",
          company: "Education Group",
        }),
      ]),
    );
    expect(
      experience.some((entry: any) => {
        const responsibilities = String(entry?.responsibilities ?? "");
        return (
          responsibilities.includes("Spring Education Group - Middle School Language Arts Teacher") &&
          responsibilities.includes("Falcon School District 49 - Elementary School Teacher")
        );
      }),
    ).toBe(false);

    const signatures = experience.map(
      (entry: any) =>
        `${String(entry?.company ?? "")}|${String(entry?.position ?? "")}|${String(entry?.startDate ?? "")}|${String(entry?.endDate ?? "")}`,
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("recovers non-empty Jessica-style experience entries without the malformed single-row fallback", () => {
    const rawExperience = [
      "Spring Education Group - Middle School Language Arts Teacher Issaquah, WA 08/2010 - Current - Taught all levels of English language arts including intensive, regular, and advanced students - Taught seventh and eight grade students - Instructed English language learners, students with disabilities, and gifted students - Taught special education students in an inclusion classroom - Analyzes and uses student data to drive instruction - Participating teacher in Collier County's Instruction through Digital Innovation Program - Coaches school scholar bowl team in which students compete against other private and public school teams to answer questions from the areas of mathematics, science, language arts, social studies, current events, and fine arts - Master teacher of Florida Teaching Evaluation Model - Seventh grade team leader for three years - Plans grade level field trips and leads grade level meetings - Served on the principal's advisory council - Host for college student observers - Served on the sunshine committee responsible for planning socials and showing appreciation to staff",
      "Falcon School District 49 - Elementary School Teacher Peyton, CO 08/2008 - 06/2010 - Gained experience teaching in a Title I school with a diverse student population including migrant students and English language learners - Taught three subject areas - Taught sixth grade - Collaborated with administrators, special education teachers, language tutors, and other support personnel to ensure success of English language learners, migrant students, students with disabilities, low achieving students, and at-risk students - Completed Sheltered Instruction Observation Protocol (SIOP) training which helps prepare all students, especially English learners for college and careers - Modified general education curriculum for English language learners using various instructional techniques and technologies - Organized and led safety patrol",
      "Falcon School District 49 - Elementary School Teacher Peyton, CO 08/2007 - 06/2008 - Taught five subject areas - Taught fourth grade - Integrated a biblical worldview into all subject areas and lessons - Taught Bible classes - Led staff devotions - Established and maintained rapport with other staff, students, and parents to facilitate communication and academic progress - Built positive relationships with parents to involve families in educational process",
      "ACCOMPLISHMENTS - Interviewed and selected to be the attending teacher of an instructional residency program with another school district in state of Florida. Led virtual PLC meetings in which principals and lead teachers from another district learned from my instructional practice",
    ].join(" ");

    const canonical = canonicalizeParserResult(
      {
        normalized: {
          experience: [],
          rawText: rawExperience,
          rawSections: [{ label: "EXPERIENCE", content: rawExperience }],
        },
      },
      {
        ...context,
        rawText: rawExperience,
      },
    );

    const experience = canonical.normalized?.experience ?? [];

    expect(experience.length).toBeGreaterThan(0);
    expect(experience).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          position: "Spring Education Group",
          company: "Education Group",
        }),
      ]),
    );
  });

  it("does not backfill desired position from Jessica's recovered first experience row", () => {
    const canonical = canonicalizeParserResult(
      {
        normalized: {
          rawText: [
            "Jessica Claire",
            "Montgomery Street, San Francisco, CA 94105",
            "jessica@example.com",
          ].join("\n"),
          contact: {
            raw: [
              "Jessica Claire",
              "Montgomery Street, San Francisco, CA 94105",
              "jessica@example.com",
            ].join("\n"),
            name: "Jessica Claire",
            email: "jessica@example.com",
            location: "Montgomery Street, San Francisco, CA 94105",
            addressNormalized: "Montgomery Street, San Francisco, CA 94105",
          },
          experience: [
            {
              id: "exp-1",
              company: "Spring Education Group",
              position: "Middle School Language Arts Teacher",
              startDate: "2010-01-01",
              endDate: null,
              isCurrent: true,
              location: "Issaquah, WA",
              responsibilityBullets: [
                "Taught all levels of English language arts including intensive, regular, and advanced students",
              ],
            },
            {
              id: "exp-2",
              company: "Falcon School District 49",
              position: "Elementary School Teacher",
              startDate: "2008-01-01",
              endDate: "2010-01-01",
              location: "Peyton, CO",
              responsibilityBullets: ["Taught sixth grade"],
            },
            {
              id: "exp-3",
              company: "Falcon School District 49",
              position: "Elementary School Teacher",
              startDate: "2007-01-01",
              endDate: "2008-01-01",
              location: "Peyton, CO",
              responsibilityBullets: ["Taught fourth grade"],
            },
          ],
        },
      },
      {
        ...context,
        rawText: [
          "Jessica Claire",
          "Montgomery Street, San Francisco, CA 94105",
          "jessica@example.com",
        ].join("\n"),
      },
    );

    expect(canonical.normalized?.experience).toHaveLength(3);
    expect(canonical.normalized?.desiredPosition).not.toBe("Middle School Language Arts Teacher");
    expect(canonical.normalized?.contact?.desiredPosition).not.toBe("Middle School Language Arts Teacher");
    expect(canonical.normalized?.contact?.location).toBe("Montgomery Street, San Francisco, CA 94105");
    expect(canonical.normalized?.contact?.addressNormalized).toBe("Montgomery Street, San Francisco, CA 94105");
  });

  it("normalizes skills text and deduplicates case-insensitively", () => {
    const parserResult = {
      normalized: {
        skills: { text: "C, C++, Go, go, R, JavaScript" },
      },
    };
    const canonical = canonicalizeParserResult(parserResult, context);
    const skills = canonical.normalized?.skills ?? [];
    const names = skills.map((item: any) => item.name);
    expect(names).toContain("R");
    expect(names).toContain("JavaScript");
    expect(names.filter((name: string) => name.toLowerCase() === "go").length).toBe(1);
  });

  it("strips proficiency annotations from skills and languages", () => {
    const parserResult = {
      normalized: {
        skills: [
          { name: "Python (Advanced)" },
          { name: "Project Management - Expert" },
          { name: "Data Analysis" },
        ],
        languages: [
          { name: "French (C1)" },
          { name: "Spanish - Intermediate" },
        ],
      },
    };
    const canonical = canonicalizeParserResult(parserResult, context);
    const skillNames = (canonical.normalized?.skills ?? []).map((item: any) => item.name);
    expect(skillNames).toContain("Python");
    expect(skillNames).toContain("Project Management");
    expect(skillNames).not.toContain(expect.stringMatching(/Advanced|Expert/i));

    const languages = canonical.normalized?.languages ?? [];
    const languageNames = languages.map((item: any) => item.name);
    expect(languageNames).toEqual(expect.arrayContaining(["French", "Spanish"]));
    expect(languages.find((entry: any) => entry.name === "French")?.level).toBeDefined();
    expect(languages.find((entry: any) => entry.name === "Spanish")?.level).toMatch(/Intermediate/i);
  });

  it("extracts responsibility bullets from experience summaries", () => {
    const parserResult = {
      normalized: {
        experience: [
          {
            id: "exp-1",
            company: "Example Corp",
            position: "Engineer",
            responsibilities: "• Built API integrations\n• Coordinated release train",
          },
        ],
      },
    };
    const canonical = canonicalizeParserResult(parserResult, context);
    const entry = canonical.normalized?.experience?.[0];
    expect(entry).toBeTruthy();
    expect(Array.isArray(entry?.responsibilityBullets)).toBe(true);
    expect(entry?.responsibilityBullets).toEqual([
      "Built API integrations",
      "Coordinated release train",
    ]);
    expect(typeof entry?.responsibilities).toBe("string");
    expect(String(entry?.responsibilities)).toContain("Built API integrations");
  });

  it("preserves fuller profile text in summary and keeps first sentence as fallback metadata", () => {
    const parserResult = {
      raw_sections: [
        {
          label: "PROFILE",
          content:
            "Safety conscious, attentive Security Guard with 5+ years protecting high-profile assets. Sharp observation skills and constant awareness of immediate surroundings. Completing a bachelor's in criminal justice and qualified as a CPO (Certified Protection Officer).",
        },
      ],
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const normalized = canonical.normalized as any;

    expect(normalized.summary?.text).toContain("Sharp observation skills and constant awareness of immediate surroundings.");
    expect(normalized.summary?.text).toContain("qualified as a CPO");
    expect(normalized.summaryFirstSentence).toBe(
      "Safety conscious, attentive Security Guard with 5+ years protecting high-profile assets.",
    );

    const sections = buildTypedSectionsFromNormalized(normalized);
    const summarySection = sections.find((section) => section.type === "summary");
    const summaryDoc = (summarySection?.structuredContent?.[0] as any)?.summary;
    const summaryText = summaryDoc?.content?.[0]?.content?.map((node: any) => node?.text ?? "").join("");

    expect(summaryText).toContain("Sharp observation skills and constant awareness of immediate surroundings.");
    expect(summaryText).toContain("qualified as a CPO");
  });

  it("promotes fuller raw summary when normalized summary is only the first sentence", () => {
    const parserResult = {
      normalized: {
        summary: {
          text: "Safety conscious attentive Security Guard with eight years experience in protecting and guarding VIP individuals in the military and defense sectors.",
          confidence: 0.5,
        },
        summaryFirstSentence:
          "Safety conscious attentive Security Guard with eight years experience in protecting and guarding VIP individuals in the military and defense sectors.",
        rawText:
          "PROFILE\nSafety conscious, attentive Security Guard with eight years experience in protecting and guarding VIP individuals in the military and defense sectors. Proficient at observing surroundings and immediate settings for possible threats of nonhuman and human nature. Presently finishing a bachelor’s in criminal justice and qualified as a CPO (Certified Protection Guard).",
        rawSections: [
          {
            label: "SUMMARY",
            content:
              "Safety conscious, attentive Security Guard with eight years experience in protecting and guarding VIP individuals in the military and defense sectors. Proficient at observing surroundings and immediate settings for possible threats of nonhuman and human nature. Presently finishing a bachelor’s in criminal justice and qualified as a CPO (Certified Protection Guard).",
          },
        ],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const normalized = canonical.normalized as any;

    expect(normalized.summary?.text).toContain("Proficient at observing surroundings and immediate settings for possible threats of nonhuman and human nature.");
    expect(normalized.summary?.text).toContain("qualified as a CPO");
    expect(normalized.summaryFirstSentence).toBe(
      "Safety conscious, attentive Security Guard with eight years experience in protecting and guarding VIP individuals in the military and defense sectors.",
    );

    const sections = buildTypedSectionsFromNormalized(normalized);
    const summarySection = sections.find((section) => section.type === "summary");
    const summaryDoc = (summarySection?.structuredContent?.[0] as any)?.summary;
    const summaryText = summaryDoc?.content?.[0]?.content?.map((node: any) => node?.text ?? "").join("");

    expect(summaryText).toContain("Proficient at observing surroundings and immediate settings for possible threats of nonhuman and human nature.");
    expect(summaryText).toContain("qualified as a CPO");
  });

  it("canonically maps Robert Cooper fixture", () => {
    const fixturePath = path.join(__dirname, "fixtures", "robert_cooper.json");
    const fixtureRaw = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
    const canonical = canonicalizeParserResult(fixtureRaw, context);
    const normalized = canonical.normalized as any;

    expect(normalized.summary?.text).toContain("Safety conscious, attentive Security Guard");
    expect(normalized.summary?.text).not.toMatch(/Place of birth/i);
    expect(normalized.summaryFirstSentence).toBe("Safety conscious, attentive Security Guard with 5+ years protecting high-profile assets.");
    expect(normalized.contact?.locationBirth).toBe("London, United Kingdom");

    const experience = Array.isArray(normalized.experience) ? normalized.experience : [];
    expect(experience.length).toBeGreaterThanOrEqual(2);
    expect(experience[0]?.company).toBe("SecureIt Ltd");
    expect(experience[0]?.startDate).toBe("2021-01-01");
    expect(experience[0]?.endDate).toBe("2022-04-01");
    expect(experience[1]?.company).toContain("RetailCo");

    const education = Array.isArray(normalized.education) ? normalized.education : [];
    expect(education.length).toBeGreaterThanOrEqual(2);
    const educationText = education.map((e: any) => `${e.degree} ${e.institution}`).join(" ");
    expect(educationText).not.toMatch(/English|Spanish|Italian/i);

    const languages = Array.isArray(normalized.languages) ? normalized.languages : [];
    const languageNames = languages.map((entry: any) => entry.name.toLowerCase());
    expect(languageNames).toEqual(expect.arrayContaining(["english", "spanish", "italian"]));

    const skills = Array.isArray(normalized.skills) ? normalized.skills : [];
    expect(skills.map((s: any) => s.name)).toEqual(expect.arrayContaining(["Investigation skills"]));

    const achievements = Array.isArray(normalized.achievements) ? normalized.achievements : [];
    expect(achievements.length).toBe(1);
  });

  it("rewrites Robert-style noisy languagesRaw only when canonical languages are cleaner", () => {
    const parserResult = {
      normalized: {
        languages: [{ name: "English" }, { name: "Spanish" }, { name: "Italian English Spanish Italian" }],
        languagesRaw: ["English", "Spanish", "Italian English Spanish Italian"],
        rawSections: [
          { label: "LANGUAGES", content: "English\nSpanish\nItalian" },
          { label: "LANGUAGES", content: "English Spanish Italian" },
        ],
        rawText: "LANGUAGES\nEnglish\nSpanish\nItalian\nEnglish Spanish Italian",
      },
      raw_sections: [
        { label: "LANGUAGES", content: "English\nSpanish\nItalian" },
        { label: "LANGUAGES", content: "English Spanish Italian" },
      ],
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const normalized = canonical.normalized as any;

    expect(normalized.languages.map((entry: any) => entry.name)).toEqual(["English", "Spanish", "Italian"]);
    expect(normalized.languagesRaw).toEqual(["English", "Spanish", "Italian"]);
  });

  it("cleans Anne-style markdown table skills into left-column skill names only", () => {
    const parserResult = {
      normalized: {
        skills: [
          { name: "| Machine Learning | |" },
          { name: "| --- | --- |" },
          { name: "| Data Visualization | |" },
          { name: "| Big Data | |" },
          { name: "| Data Mining | |" },
          { name: "| Python | |" },
          { name: "| R | |" },
          { name: "| Java | |" },
          { name: "| Scala | |" },
          { name: "| PERL | |" },
          { name: "| Problem-Solving | |" },
          { name: "| Active Learning | |" },
          { name: "| Risk Analysis | | | Machine Learning | | | --- | --- | | Data Visualization | |" },
        ],
        rawSections: [
          {
            label: "SKILLS",
            content: "| Machine Learning | |\n| --- | --- |\n| Data Visualization | |\n| Big Data | |\n| Data Mining | |\n| Python | |\n| R | |\n| Java | |\n| Scala | |\n| PERL | |\n| Problem-Solving | |\n| Active Learning | |\n| Risk Analysis | |",
          },
        ],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const skillNames = (canonical.normalized?.skills ?? []).map((item: any) => item.name);

    expect(skillNames).not.toEqual(expect.arrayContaining(["| Machine Learning | |", "| --- | --- |"]));
    expect(skillNames).toEqual(
      expect.arrayContaining([
        "Machine Learning",
        "Data Visualization",
        "Big Data",
        "Data Mining",
        "Python",
        "R",
        "Java",
        "Scala",
        "PERL",
        "Problem-Solving",
        "Active Learning",
        "Risk Analysis",
      ]),
    );
  });

  it("keeps Jessica-style OCR education blocks grouped instead of fragmenting institution and degree lines", () => {
    const educationBlock = [
      "Cedarville University",
      "Cedarville, Ohio 08/2013",
      "**Master of Arts:** Education - Majored in Teacher Leader",
      "**Bachelor of Arts:** Education",
      "- Majored in Middle Childhood Education - Minored in Bible",
      "- Specializations: Social Studies; Reading/Language Arts",
      "- Graduated with Honors",
    ].join("\n");
    const flattenedEducationBlock =
      "Cedarville University Cedarville, Ohio 08/2013 **Master of Arts:** Education - Majored in Teacher Leader Cedarville University Cedarville, Ohio 05/2007 **Bachelor of Arts:** Education - Majored in Middle Childhood Education - Minored in Bible - Specializations: Social Studies; Reading/Language Arts - Graduated with Honors";

    const canonical = canonicalizeParserResult(
      {
        raw_sections: [
          { label: "EDUCATION", content: educationBlock },
          { label: "EDUCATION", content: flattenedEducationBlock },
        ],
        normalized: {
          experience: [],
          rawText: `${educationBlock}\n${flattenedEducationBlock}`,
          raw: `${educationBlock}\n${flattenedEducationBlock}`,
        },
      },
      context,
    );

    const education = Array.isArray(canonical.normalized?.education) ? canonical.normalized.education : [];
    const institutions = education.map((entry: any) => entry?.institution ?? "");
    const degrees = education.map((entry: any) => entry?.degree ?? "").join(" ");

    expect(education.length).toBeGreaterThan(0);
    expect(institutions.join(" ")).toContain("Cedarville University");
    expect(institutions.join(" ")).not.toMatch(/\*\*Master of Arts|\*\*Bachelor of Arts|- Majored in Middle Childhood Education|\bBachelor of Arts:\*\* Education - Majored/i);
    expect(degrees).toMatch(/Master of Arts/i);
  });
});

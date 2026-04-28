import { describe, expect, it } from "vitest";

import {
  deriveResponsibilityBullets,
  projectResponsibilitiesForWorkshop,
  responsibilityValueToPlainText,
} from "../resumeResponsibilityAuthority";

describe("projectResponsibilitiesForWorkshop", () => {
  it("preserves paragraph text in paragraph-only remirror responsibilities", () => {
    const projection = projectResponsibilitiesForWorkshop({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Led platform migration planning." }],
        },
      ],
    });

    expect(projection).toEqual({
      prose: "Led platform migration planning.",
      bullets: [],
      rich: {
        blocks: [
          {
            kind: "paragraph",
            runs: [{ text: "Led platform migration planning." }],
          },
        ],
      },
    });
  });

  it("preserves bullet item order in bullet-list-only remirror responsibilities", () => {
    const projection = projectResponsibilitiesForWorkshop({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cut release rollback rate by 38%." }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Formalized launch checklists across squads." }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(projection).toEqual({
      prose: "",
      bullets: [
        "Cut release rollback rate by 38%.",
        "Formalized launch checklists across squads.",
      ],
      rich: {
        blocks: [
          {
            kind: "bullet_list",
            items: [
              {
                runs: [{ text: "Cut release rollback rate by 38%." }],
              },
              {
                runs: [{ text: "Formalized launch checklists across squads." }],
              },
            ],
          },
        ],
      },
    });
  });

  it("preserves mixed block order and inline marks in remirror responsibilities", () => {
    const projection = projectResponsibilitiesForWorkshop({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Led " },
            {
              type: "text",
              text: "platform migration",
              marks: [{ type: "bold" }],
            },
            { type: "text", text: " planning." },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Cut " },
                    {
                      type: "text",
                      text: "release rollback rate",
                      marks: [{ type: "italic" }],
                    },
                    { type: "text", text: " by 38%." },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Formalized " },
                    {
                      type: "text",
                      text: "launch checklists",
                      marks: [{ type: "underline" }],
                    },
                    { type: "text", text: " across squads." },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(projection).toEqual({
      prose: "Led platform migration planning.",
      bullets: [
        "Cut release rollback rate by 38%.",
        "Formalized launch checklists across squads.",
      ],
      rich: {
        blocks: [
          {
            kind: "paragraph",
            runs: [
              { text: "Led " },
              { text: "platform migration", bold: true },
              { text: " planning." },
            ],
          },
          {
            kind: "bullet_list",
            items: [
              {
                runs: [
                  { text: "Cut " },
                  { text: "release rollback rate", italic: true },
                  { text: " by 38%." },
                ],
              },
              {
                runs: [
                  { text: "Formalized " },
                  { text: "launch checklists", underline: true },
                  { text: " across squads." },
                ],
              },
            ],
          },
        ],
      },
    });
  });

  it("projects plain strings into ordered paragraph and bullet blocks", () => {
    const projection = projectResponsibilitiesForWorkshop(
      "Built operating cadences.\n\n- Reduced incident volume.\n- Standardized handoffs.\n\nGuided launch reviews.",
    );

    expect(projection).toEqual({
      prose: "Built operating cadences.\n\nGuided launch reviews.",
      bullets: ["Reduced incident volume.", "Standardized handoffs."],
      rich: {
        blocks: [
          {
            kind: "paragraph",
            runs: [{ text: "Built operating cadences." }],
          },
          {
            kind: "bullet_list",
            items: [
              {
                runs: [{ text: "Reduced incident volume." }],
              },
              {
                runs: [{ text: "Standardized handoffs." }],
              },
            ],
          },
          {
            kind: "paragraph",
            runs: [{ text: "Guided launch reviews." }],
          },
        ],
      },
    });
  });

  it("keeps Shorten and Rewrite text results as paragraph/list/mixed structure", () => {
    const rewritten = projectResponsibilitiesForWorkshop(
      "Led operating cadence redesign.\n\n- Reduced incident volume.\n- Standardized handoffs.",
    );
    const shortened = projectResponsibilitiesForWorkshop(
      "Led operating cadence redesign.\n- Reduced incidents.",
    );

    expect(rewritten.rich.blocks).toEqual([
      {
        kind: "paragraph",
        runs: [{ text: "Led operating cadence redesign." }],
      },
      {
        kind: "bullet_list",
        items: [
          {
            runs: [{ text: "Reduced incident volume." }],
          },
          {
            runs: [{ text: "Standardized handoffs." }],
          },
        ],
      },
    ]);
    expect(shortened.rich.blocks).toEqual([
      {
        kind: "paragraph",
        runs: [{ text: "Led operating cadence redesign." }],
      },
      {
        kind: "bullet_list",
        items: [
          {
            runs: [{ text: "Reduced incidents." }],
          },
        ],
      },
    ]);
  });

  it("projects string array responsibilities into a bullet list block", () => {
    const projection = projectResponsibilitiesForWorkshop([
      "Reduced incident volume.",
      "Standardized handoffs.",
    ]);

    expect(projection).toEqual({
      prose: "",
      bullets: ["Reduced incident volume.", "Standardized handoffs."],
      rich: {
        blocks: [
          {
            kind: "bullet_list",
            items: [
              {
                runs: [{ text: "Reduced incident volume." }],
              },
              {
                runs: [{ text: "Standardized handoffs." }],
              },
            ],
          },
        ],
      },
    });
  });

  it("projects JSON-stringified responsibility arrays as clean bullet lists", () => {
    const projection = projectResponsibilitiesForWorkshop(
      JSON.stringify(["Reduced incident volume.", "Standardized handoffs."]),
    );

    expect(projection).toEqual({
      prose: "",
      bullets: ["Reduced incident volume.", "Standardized handoffs."],
      rich: {
        blocks: [
          {
            kind: "bullet_list",
            items: [
              {
                runs: [{ text: "Reduced incident volume." }],
              },
              {
                runs: [{ text: "Standardized handoffs." }],
              },
            ],
          },
        ],
      },
    });
    expect(
      responsibilityValueToPlainText(
        JSON.stringify(["Reduced incident volume.", "Standardized handoffs."]),
      ),
    ).toBe("Reduced incident volume.\nStandardized handoffs.");
    expect(
      deriveResponsibilityBullets({
        responsibilities: JSON.stringify([
          "Reduced incident volume.",
          "Standardized handoffs.",
        ]),
        hasResponsibilitiesField: true,
      }),
    ).toEqual(["Reduced incident volume.", "Standardized handoffs."]);
  });

  it("projects snake-case editor list nodes as responsibility bullets", () => {
    const projection = projectResponsibilitiesForWorkshop({
      type: "doc",
      content: [
        {
          type: "bullet_list",
          content: [
            {
              type: "list_item",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Reduced incident volume." }],
                },
              ],
            },
            {
              type: "list_item",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Standardized handoffs." }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(projection.bullets).toEqual([
      "Reduced incident volume.",
      "Standardized handoffs.",
    ]);
    expect(
      deriveResponsibilityBullets({
        responsibilities: {
          type: "doc",
          content: [
            {
              type: "bullet_list",
              content: [
                {
                  type: "list_item",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Reduced incident volume." },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        hasResponsibilitiesField: true,
      }),
    ).toEqual(["Reduced incident volume."]);
  });
});

export type RobialAxis = "inline" | "block";

export type RobialGridContract = {
  page: {
    size: {
      width: "210mm";
      height: "297mm";
    };
    margins: {
      top: "17mm";
      right: "35mm";
      bottom: "35mm";
      left: "17mm";
    };
    columns: {
      sidebar: "35mm";
      gutter: "18mm";
      main: "105mm";
    };
    steps: {
      stepA: "17mm";
      stepB: "18mm";
      halfStep: "8.5mm";
    };
  };
  positions: {
    inline: readonly string[];
    block: readonly string[];
  };
  docx: {
    marginsTwip: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    columnsTwip: {
      sidebar: number;
      gutter: number;
      main: number;
    };
  };
  helpers: {
    mmToPt: (value: number) => number;
    mmToTwip: (value: number) => number;
    axisPositionMm: (axis: RobialAxis, index: number) => string | null;
  };
};

const MM_TO_PT = 72 / 25.4;
const MM_TO_TWIP = 1440 / 25.4;

function mm(value: number): string {
  return `${value}mm`;
}

function buildAlternatingPositions(limit: number): string[] {
  const output: string[] = [];
  let total = 0;
  let next = 17;

  while (total + next < limit) {
    total += next;
    output.push(mm(total));
    next = next === 17 ? 18 : 17;
  }

  return output;
}

export function mmToPt(value: number): number {
  return Number((value * MM_TO_PT).toFixed(3));
}

export function mmToTwip(value: number): number {
  return Math.round(value * MM_TO_TWIP);
}

export function buildRobialExportCssVarMap(): Record<string, string> {
  return {
    "--page-width": ROBIAL_EXPORT_GRID.page.size.width,
    "--page-height": ROBIAL_EXPORT_GRID.page.size.height,
    "--page-margin-top": ROBIAL_EXPORT_GRID.page.margins.top,
    "--page-margin-right": ROBIAL_EXPORT_GRID.page.margins.right,
    "--page-margin-bottom": ROBIAL_EXPORT_GRID.page.margins.bottom,
    "--page-margin-left": ROBIAL_EXPORT_GRID.page.margins.left,
    "--page-sidebar": ROBIAL_EXPORT_GRID.page.columns.sidebar,
    "--page-gutter": ROBIAL_EXPORT_GRID.page.columns.gutter,
    "--page-main": ROBIAL_EXPORT_GRID.page.columns.main,
    "--robial-step-a": ROBIAL_EXPORT_GRID.page.steps.stepA,
    "--robial-step-b": ROBIAL_EXPORT_GRID.page.steps.stepB,
    "--robial-step-half": ROBIAL_EXPORT_GRID.page.steps.halfStep,
  };
}

export const ROBIAL_EXPORT_GRID: RobialGridContract = {
  page: {
    size: {
      width: "210mm",
      height: "297mm",
    },
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
    steps: {
      stepA: "17mm",
      stepB: "18mm",
      halfStep: "8.5mm",
    },
  },
  positions: {
    inline: buildAlternatingPositions(210),
    block: buildAlternatingPositions(297),
  },
  docx: {
    marginsTwip: {
      top: mmToTwip(17),
      right: mmToTwip(35),
      bottom: mmToTwip(35),
      left: mmToTwip(17),
    },
    columnsTwip: {
      sidebar: mmToTwip(35),
      gutter: mmToTwip(18),
      main: mmToTwip(105),
    },
  },
  helpers: {
    mmToPt,
    mmToTwip,
    axisPositionMm: (axis, index) => {
      const positions =
        axis === "inline"
          ? ROBIAL_EXPORT_GRID.positions.inline
          : ROBIAL_EXPORT_GRID.positions.block;
      return positions[index] ?? null;
    },
  },
};

export default ROBIAL_EXPORT_GRID;

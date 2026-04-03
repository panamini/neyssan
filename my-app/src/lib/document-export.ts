function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function collectHeadMarkup(): string {
  return Array.from(
    document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
      'style, link[rel="stylesheet"]',
    ),
  )
    .map((node) => node.outerHTML)
    .join("\n");
}

export function printElementAsPdf(args: {
  node: HTMLElement;
  title: string;
}): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const printWindow = window.open(
    "",
    "_blank",
    "noopener,noreferrer,width=1100,height=1400",
  );
  if (!printWindow) {
    return false;
  }

  const clonedNode = args.node.cloneNode(true) as HTMLElement;
  const htmlClassName = escapeHtmlAttribute(
    document.documentElement.className ?? "",
  );
  const bodyClassName = escapeHtmlAttribute(document.body.className ?? "");
  const title = escapeHtmlAttribute(args.title);

  printWindow.document.write(`<!doctype html>
<html class="${htmlClassName}">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    ${collectHeadMarkup()}
    <style>
      html, body {
        margin: 0;
        min-height: 100%;
        background: #f3f0eb;
      }

      body {
        display: grid;
        place-items: start center;
        padding: 24px;
        box-sizing: border-box;
      }

      .dasti-print-export {
        width: 100%;
        display: grid;
        place-items: start center;
      }

      .dasti-print-export__sheet {
        display: grid;
        place-items: start center;
      }

      .dasti-print-export__sheet .resume-page-frame,
      .dasti-print-export__sheet .resume-page-stage,
      .dasti-print-export__sheet .resume-page,
      .dasti-print-export__sheet .dasti-document-stage__canvas[data-document-page="true"],
      .dasti-print-export__sheet .dasti-proposal-document__page {
        box-shadow: none !important;
      }

      .dasti-print-export__sheet .resume-page-frame {
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
      }

      @page {
        size: A4;
        margin: 12mm;
      }

      @media print {
        html, body {
          background: white;
        }

        body {
          padding: 0;
        }

        .dasti-print-export {
          padding: 0;
        }
      }
    </style>
  </head>
  <body class="${bodyClassName}">
    <div class="dasti-print-export">
      <div class="dasti-print-export__sheet">${clonedNode.outerHTML}</div>
    </div>
  </body>
</html>`);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
  };

  if (printWindow.document.readyState === "complete") {
    window.setTimeout(triggerPrint, 180);
  } else {
    printWindow.addEventListener(
      "load",
      () => {
        window.setTimeout(triggerPrint, 180);
      },
      { once: true },
    );
  }

  printWindow.addEventListener(
    "afterprint",
    () => {
      printWindow.close();
    },
    { once: true },
  );

  return true;
}

export function printFirstMatchingNodeAsPdf(args: {
  container: HTMLElement | null;
  selectors: string[];
  title: string;
}): boolean {
  if (!args.container) {
    return false;
  }

  for (const selector of args.selectors) {
    const node = args.container.querySelector<HTMLElement>(selector);
    if (node) {
      return printElementAsPdf({ node, title: args.title });
    }
  }

  return false;
}

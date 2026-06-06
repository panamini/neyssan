import { useEffect, useState } from "react";

const FALLBACK_POSITION = { top: 32, right: 32 };

function findActiveJobAnchor(): HTMLElement | null {
  const selectors = [
    '[data-testid*="job"][aria-selected="true"]',
    '[data-test*="job"][aria-selected="true"]',
    '[aria-current="page"][href*="/jobs/"]',
    '[data-testid*="job-detail"]',
    '[data-test*="job-detail"]',
    '[class*="job-detail"]',
    '[class*="jobsearch"]',
    "article",
    "main",
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      return element;
    }
  }

  return null;
}

export function useActiveJobAnchor() {
  const [position, setPosition] = useState(FALLBACK_POSITION);

  useEffect(() => {
    let frameId = 0;
    let observer: MutationObserver | null = null;

    const update = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const anchor = findActiveJobAnchor();
        if (!anchor) {
          setPosition(FALLBACK_POSITION);
          return;
        }

        const rect = anchor.getBoundingClientRect();
        const top = Math.max(16, Math.min(rect.top + 16, window.innerHeight - 220));
        const right = Math.max(16, window.innerWidth - Math.min(rect.right, window.innerWidth - 12) + 16);
        setPosition({ top, right });
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer?.disconnect();
    };
  }, []);

  return position;
}

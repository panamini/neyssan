import { useEffect, useState } from "react";
import {
  detectPlatform,
  hasUsefulDescription,
  mergeJobData,
  scrapeJobData,
  shouldObserveDeferredScrapes,
  shouldScheduleDeferredScrapes,
  type JobData,
} from "../_shared/job-scraper";

export function useScrapedJob() {
  const [jobData, setJobData] = useState<JobData>({
    platform: "manual",
    title: "Untitled",
    url: window.location.href,
  });

  useEffect(() => {
    let urlPollId: number | null = null;
    let scrapeRetryIds: number[] = [];
    let mutationObserver: MutationObserver | null = null;
    let observerTimeoutId: number | null = null;
    let observerDebounceId: number | null = null;
    let lastObservedUrl = window.location.href;

    const applyScrape = (mode: "replace" | "merge" = "merge") => {
      const activePlatform = detectPlatform(window.location.href);
      if (!activePlatform) return null;
      const nextJobData = scrapeJobData(activePlatform);
      setJobData((current) => {
        if (mode === "replace" || current.platform === "manual") {
          return nextJobData;
        }
        return mergeJobData(current, nextJobData);
      });
      return nextJobData;
    };

    const scheduleDeferredScrapes = (activePlatform: string, initialJobData?: JobData | null) => {
      if (!shouldScheduleDeferredScrapes(activePlatform, initialJobData?.description)) {
        return;
      }

      scrapeRetryIds.forEach((id) => window.clearTimeout(id));
      scrapeRetryIds = [400, 1200, 2500, 5000].map((delay) =>
        window.setTimeout(() => {
          const refreshed = applyScrape("merge");
          if (refreshed && hasUsefulDescription(refreshed.platform, refreshed.description)) {
            scrapeRetryIds.forEach((id) => window.clearTimeout(id));
            scrapeRetryIds = [];
          }
        }, delay),
      );

      if (!shouldObserveDeferredScrapes(activePlatform)) {
        return;
      }

      mutationObserver?.disconnect();
      if (observerTimeoutId !== null) window.clearTimeout(observerTimeoutId);
      if (observerDebounceId !== null) window.clearTimeout(observerDebounceId);

      mutationObserver = new MutationObserver(() => {
        if (observerDebounceId !== null) window.clearTimeout(observerDebounceId);
        observerDebounceId = window.setTimeout(() => {
          void applyScrape("merge");
        }, 250);
      });

      const observerRoot = document.querySelector("main") || document.body;
      mutationObserver.observe(observerRoot, { childList: true, subtree: true, characterData: true });
      observerTimeoutId = window.setTimeout(() => {
        mutationObserver?.disconnect();
        mutationObserver = null;
      }, 8000);
    };

    const platform = detectPlatform(window.location.href);
    if (platform) {
      const initialJobData = applyScrape("replace");
      scheduleDeferredScrapes(platform, initialJobData);
    }

    urlPollId = window.setInterval(() => {
      if (window.location.href === lastObservedUrl) return;
      lastObservedUrl = window.location.href;
      const nextPlatform = detectPlatform(lastObservedUrl);
      if (!nextPlatform) return;
      const nextJobData = applyScrape("replace");
      scheduleDeferredScrapes(nextPlatform, nextJobData);
    }, 1000);

    return () => {
      scrapeRetryIds.forEach((id) => window.clearTimeout(id));
      mutationObserver?.disconnect();
      if (observerTimeoutId !== null) window.clearTimeout(observerTimeoutId);
      if (observerDebounceId !== null) window.clearTimeout(observerDebounceId);
      if (urlPollId !== null) window.clearInterval(urlPollId);
    };
  }, []);

  return { jobData, setJobData };
}

type StorageAreaName = "localStorage" | "sessionStorage";

export type StorageDiagnosticEntry = {
  area: StorageAreaName;
  key: string;
  keyBytes: number;
  valueBytes: number;
  totalBytes: number;
  relevant: boolean;
};

export type StorageDiagnosticReport = {
  generatedAt: string;
  localStorage: {
    totalBytes: number;
    entries: StorageDiagnosticEntry[];
  };
  sessionStorage: {
    totalBytes: number;
    entries: StorageDiagnosticEntry[];
  };
  combinedBytes: number;
  relevantEntries: StorageDiagnosticEntry[];
};

export type StorageDiagnosticsApi = {
  collect: () => StorageDiagnosticReport;
  logSummary: () => StorageDiagnosticReport;
};

const RELEVANT_STORAGE_KEY_PATTERNS = [
  /^dasti:/i,
  /^cv(?::|-|Documents|Library|ActiveId)/i,
  /^theme$/i,
];

function measureBytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function isRelevantStorageKey(key: string): boolean {
  return RELEVANT_STORAGE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function collectStorageEntries(
  storage: Storage | undefined,
  area: StorageAreaName,
): StorageDiagnosticEntry[] {
  if (!storage) {
    return [];
  }

  const entries: StorageDiagnosticEntry[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) {
      continue;
    }

    const rawValue = storage.getItem(key);
    if (rawValue === null) {
      continue;
    }

    const keyBytes = measureBytes(key);
    const valueBytes = measureBytes(rawValue);

    entries.push({
      area,
      key,
      keyBytes,
      valueBytes,
      totalBytes: keyBytes + valueBytes,
      relevant: isRelevantStorageKey(key),
    });
  }

  return entries.sort((left, right) => right.totalBytes - left.totalBytes);
}

export function collectBrowserStorageDiagnostics(): StorageDiagnosticReport {
  if (typeof window === "undefined") {
    return {
      generatedAt: new Date().toISOString(),
      localStorage: { totalBytes: 0, entries: [] },
      sessionStorage: { totalBytes: 0, entries: [] },
      combinedBytes: 0,
      relevantEntries: [],
    };
  }

  const localEntries = collectStorageEntries(window.localStorage, "localStorage");
  const sessionEntries = collectStorageEntries(
    window.sessionStorage,
    "sessionStorage",
  );
  const localTotal = localEntries.reduce(
    (total, entry) => total + entry.totalBytes,
    0,
  );
  const sessionTotal = sessionEntries.reduce(
    (total, entry) => total + entry.totalBytes,
    0,
  );
  const relevantEntries = [...localEntries, ...sessionEntries]
    .filter((entry) => entry.relevant)
    .sort((left, right) => right.totalBytes - left.totalBytes);

  return {
    generatedAt: new Date().toISOString(),
    localStorage: {
      totalBytes: localTotal,
      entries: localEntries,
    },
    sessionStorage: {
      totalBytes: sessionTotal,
      entries: sessionEntries,
    },
    combinedBytes: localTotal + sessionTotal,
    relevantEntries,
  };
}

export function logBrowserStorageDiagnostics(): StorageDiagnosticReport {
  const report = collectBrowserStorageDiagnostics();

  if (typeof console !== "undefined") {
    console.info("[storage-diagnostics] combined bytes", report.combinedBytes);
    console.info("[storage-diagnostics] localStorage bytes", report.localStorage.totalBytes);
    console.info(
      "[storage-diagnostics] sessionStorage bytes",
      report.sessionStorage.totalBytes,
    );
    console.table(
      report.relevantEntries.map((entry) => ({
        area: entry.area,
        key: entry.key,
        totalBytes: entry.totalBytes,
        valueBytes: entry.valueBytes,
      })),
    );
  }

  return report;
}

declare global {
  interface Window {
    __DASTI_STORAGE_DIAGNOSTICS__?: StorageDiagnosticsApi;
  }
}

export function installStorageDiagnostics(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.__DASTI_STORAGE_DIAGNOSTICS__ = {
    collect: collectBrowserStorageDiagnostics,
    logSummary: logBrowserStorageDiagnostics,
  };
}

export const LOCAL_CV_LIBRARY_STORAGE_KEY = "cvDocuments";
export const LEGACY_LOCAL_CV_LIBRARY_STORAGE_KEY = "cvLibrary";
export const LOCAL_CV_DOC_STORAGE_KEY_PREFIX = "cv:";
export const LEGACY_LOCAL_CV_DOC_STORAGE_KEY_PREFIX = "cv-doc:";

export function getLocalCvDocumentStorageKey(id: string): string {
  return `${LOCAL_CV_DOC_STORAGE_KEY_PREFIX}${id}`;
}

export function getLegacyLocalCvDocumentStorageKey(id: string): string {
  return `${LEGACY_LOCAL_CV_DOC_STORAGE_KEY_PREFIX}${id}`;
}

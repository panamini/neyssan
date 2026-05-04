export const LOCAL_CV_LIBRARY_STORAGE_KEY = "cvDocuments";
export const LEGACY_LOCAL_CV_LIBRARY_STORAGE_KEY = "cvLibrary";
export const ACTIVE_CV_STORAGE_KEY = "dasti:cv-library-current-id:v1";
export const LEGACY_ACTIVE_CV_STORAGE_KEY = "cvActiveId";
export const LOCAL_CV_DOC_STORAGE_KEY_PREFIX = "cv:";
export const LEGACY_LOCAL_CV_DOC_STORAGE_KEY_PREFIX = "cv-doc:";

export function getLocalCvDocumentStorageKey(id: string): string {
  return `${LOCAL_CV_DOC_STORAGE_KEY_PREFIX}${id}`;
}

export function getLegacyLocalCvDocumentStorageKey(id: string): string {
  return `${LEGACY_LOCAL_CV_DOC_STORAGE_KEY_PREFIX}${id}`;
}

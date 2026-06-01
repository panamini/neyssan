import { DOCUMENT_PAGE_SIZES } from "./document-page-size";

export { MM_TO_PX } from "./document-page-size";

export const A4_PAGE_WIDTH_PX = DOCUMENT_PAGE_SIZES.a4.widthPx;
export const A4_PAGE_HEIGHT_PX = DOCUMENT_PAGE_SIZES.a4.heightPx;
export const A4_STAGE_RATIO = DOCUMENT_PAGE_SIZES.a4.aspectRatio;
export const DOCUMENT_ZOOM_STEPS = [0.8, 1.0, 1.25, 1.5, 2.0] as const;

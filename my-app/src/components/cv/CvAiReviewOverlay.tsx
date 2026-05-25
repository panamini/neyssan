import DocumentAiReviewOverlay, {
  type DocumentAiReviewOverlayProps,
  type DocumentAiReviewState,
  type DocumentAiReviewTarget,
} from "../document-ai/DocumentAiReviewOverlay";

export type CvAiReviewTarget = DocumentAiReviewTarget;
export type CvAiReviewState = DocumentAiReviewState;

export function CvAiReviewOverlay(props: DocumentAiReviewOverlayProps) {
  return <DocumentAiReviewOverlay {...props} />;
}

export default CvAiReviewOverlay;

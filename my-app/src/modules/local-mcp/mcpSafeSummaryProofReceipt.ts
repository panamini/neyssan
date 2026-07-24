export const MCP_SAFE_SUMMARY_PROOF_RECEIPT_PREFIX = "mcp-proof-v1:" as const;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type McpSafeSummaryProofReceiptV1 = `${typeof MCP_SAFE_SUMMARY_PROOF_RECEIPT_PREFIX}${string}`;

export function isMcpSafeSummaryProofReceipt(
  value: unknown,
): value is McpSafeSummaryProofReceiptV1 {
  return typeof value === "string" &&
    value.startsWith(MCP_SAFE_SUMMARY_PROOF_RECEIPT_PREFIX) &&
    UUID_V4_PATTERN.test(value.slice(MCP_SAFE_SUMMARY_PROOF_RECEIPT_PREFIX.length));
}

export function createMcpSafeSummaryProofReceipt(
  uuid: string,
): McpSafeSummaryProofReceiptV1 {
  if (!UUID_V4_PATTERN.test(uuid)) throw new TypeError("invalid_controlled_receipt_uuid");
  return `${MCP_SAFE_SUMMARY_PROOF_RECEIPT_PREFIX}${uuid}`;
}

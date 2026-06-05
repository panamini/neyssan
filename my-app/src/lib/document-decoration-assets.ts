export type DocumentDecorationUploadDebugContext = {
  routeProfileId?: string | null;
  currentCvId?: string | null;
  proposalId?: string | null;
};

export async function uploadDocumentDecorationAsset({
  generateUploadUrl,
  file,
  mimeType,
  debugContext,
  onDebug,
}: {
  generateUploadUrl: () => Promise<string>;
  file: File;
  mimeType?: string;
  debugContext?: DocumentDecorationUploadDebugContext;
  onDebug?: (label: string, payload: Record<string, unknown>) => void;
}): Promise<string> {
  onDebug?.("[document-image-upload] generateUploadUrl", {
    called: true,
    ...debugContext,
  });
  const uploadUrl = await generateUploadUrl();
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": mimeType || file.type || "application/octet-stream",
    },
    body: file,
  });

  onDebug?.("[document-image-upload] upload-post", {
    attempted: true,
    status: response.status,
    ok: response.ok,
    ...debugContext,
  });

  if (!response.ok) {
    throw new Error(`Image upload failed (${response.status})`);
  }

  const payload = (await response.json()) as { storageId?: unknown };
  onDebug?.("[document-image-upload] upload-result", {
    responseKeys:
      payload && typeof payload === "object" ? Object.keys(payload) : [],
    hasStorageId: typeof payload.storageId === "string",
    ...debugContext,
  });

  if (typeof payload.storageId !== "string" || !payload.storageId) {
    throw new Error("Image upload did not return a storage id.");
  }

  return payload.storageId;
}

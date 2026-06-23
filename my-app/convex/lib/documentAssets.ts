/* eslint-disable @typescript-eslint/no-unsafe-return -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
export function sanitizeRemoteDocumentDecoration(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const next = { ...(value as Record<string, unknown>) };
  delete next.dataUrl;
  delete next.resolvedUrl;
  delete next.assetMissing;
  return next;
}

export function sanitizeRemoteProfileImage(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const profileImage = { ...(value as Record<string, unknown>) };
  if (
    typeof profileImage.src === "string" &&
    profileImage.src.startsWith("data:")
  ) {
    delete profileImage.src;
  }
  return profileImage;
}

export function sanitizeRemoteMetadataImages(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const metadata = { ...(value as Record<string, unknown>) };
  if ("documentDecoration" in metadata) {
    metadata.documentDecoration = sanitizeRemoteDocumentDecoration(
      metadata.documentDecoration,
    );
  }
  if ("profileImage" in metadata) {
    metadata.profileImage = sanitizeRemoteProfileImage(metadata.profileImage);
  }
  return metadata;
}

function isImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.trim().startsWith("data:image/");
}

const REMOTE_RUNTIME_IMAGE_KEYS = new Set([
  "dataUrl",
  "resolvedUrl",
  "imageDataUrl",
  "assetMissing",
]);

const REMOTE_IMAGE_REFERENCE_KEYS = new Set([
  "src",
  "photoUrl",
  "url",
  "href",
]);

export function sanitizeRemoteRuntimeImages(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeRemoteRuntimeImages);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (REMOTE_RUNTIME_IMAGE_KEYS.has(key)) {
      continue;
    }
    if (REMOTE_IMAGE_REFERENCE_KEYS.has(key) && isImageDataUrl(entry)) {
      continue;
    }
    if (
      key === "json" &&
      typeof entry === "string" &&
      entry.includes("data:image")
    ) {
      try {
        next[key] = JSON.stringify(sanitizeRemoteRuntimeImages(JSON.parse(entry)));
      } catch {
        next[key] = entry;
      }
      continue;
    }
    next[key] = sanitizeRemoteRuntimeImages(entry);
  }
  return next;
}

export function stripStructuredSectionBlocksForRemote(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const cv = value as Record<string, unknown>;
  if (!Array.isArray(cv.sections)) {
    return cv;
  }

  return {
    ...cv,
    sections: cv.sections.map((section) => {
      if (!section || typeof section !== "object" || Array.isArray(section)) {
        return section;
      }

      const record = section as Record<string, unknown>;
      const hasStructuredContent =
        Array.isArray(record.structuredContent) &&
        record.structuredContent.length > 0;
      if (!hasStructuredContent || record.type === "text") {
        return record;
      }

      return {
        ...record,
        blocks: [],
      };
    }),
  };
}

export function sanitizeRemoteCvDocument(value: unknown): unknown {
  return stripStructuredSectionBlocksForRemote(
    sanitizeRemoteRuntimeImages(value),
  );
}

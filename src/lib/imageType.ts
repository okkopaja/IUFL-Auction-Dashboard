type ImageExtension = "jpg" | "png" | "webp" | "gif" | "avif" | "svg";

export interface ResolvedImageType {
  contentType: string;
  extension: ImageExtension;
}

const IMAGE_BY_CONTENT_TYPE: Record<string, ResolvedImageType> = {
  "image/jpeg": { contentType: "image/jpeg", extension: "jpg" },
  "image/jpg": { contentType: "image/jpeg", extension: "jpg" },
  "image/png": { contentType: "image/png", extension: "png" },
  "image/webp": { contentType: "image/webp", extension: "webp" },
  "image/gif": { contentType: "image/gif", extension: "gif" },
  "image/avif": { contentType: "image/avif", extension: "avif" },
  "image/svg+xml": { contentType: "image/svg+xml", extension: "svg" },
};

function normalizeContentType(
  contentType: string | null | undefined,
): string | null {
  if (!contentType) return null;
  const normalized = contentType.split(";")[0]?.trim().toLowerCase();
  return normalized || null;
}

function startsWithBytes(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function hasAsciiAt(bytes: Uint8Array, offset: number, value: string): boolean {
  if (bytes.length < offset + value.length) return false;

  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) {
      return false;
    }
  }

  return true;
}

function detectSvg(bytes: Uint8Array): ResolvedImageType | null {
  if (bytes.length === 0) return null;

  const snippet = new TextDecoder("utf-8")
    .decode(bytes.subarray(0, Math.min(bytes.length, 512)))
    .trimStart()
    .toLowerCase();

  if (!snippet.includes("<svg")) return null;
  return { contentType: "image/svg+xml", extension: "svg" };
}

function detectByMagicBytes(bytes: Uint8Array): ResolvedImageType | null {
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47])) {
    return { contentType: "image/png", extension: "png" };
  }

  if (hasAsciiAt(bytes, 0, "GIF8")) {
    return { contentType: "image/gif", extension: "gif" };
  }

  if (hasAsciiAt(bytes, 0, "RIFF") && hasAsciiAt(bytes, 8, "WEBP")) {
    return { contentType: "image/webp", extension: "webp" };
  }

  if (
    hasAsciiAt(bytes, 4, "ftyp") &&
    (hasAsciiAt(bytes, 8, "avif") || hasAsciiAt(bytes, 8, "avis"))
  ) {
    return { contentType: "image/avif", extension: "avif" };
  }

  return detectSvg(bytes);
}

export function resolveImageType(
  declaredContentType: string | null | undefined,
  bytes: Uint8Array,
): ResolvedImageType | null {
  const normalizedType = normalizeContentType(declaredContentType);
  if (normalizedType && IMAGE_BY_CONTENT_TYPE[normalizedType]) {
    return IMAGE_BY_CONTENT_TYPE[normalizedType];
  }

  return detectByMagicBytes(bytes);
}

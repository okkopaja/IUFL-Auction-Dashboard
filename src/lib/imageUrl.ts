const STORAGE_OBJECT_PUBLIC_SEGMENT = "/storage/v1/object/public/";
const STORAGE_RENDER_PUBLIC_SEGMENT = "/storage/v1/render/image/public/";
const IMAGE_DETAIL_SUFFIX = ".detail.webp";
const IMAGE_THUMB_SUFFIX = ".thumb.webp";

type DisplayImageVariant = "detail" | "thumb";

/**
 * Some historical uploads were stored with a generic binary MIME type.
 * For Supabase public object URLs ending in .bin, route through render endpoint
 * so browsers still get a valid image response.
 */
export function toDisplayImageUrl(
  rawUrl: string | null | undefined,
): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const lowerPath = parsed.pathname.toLowerCase();

    if (
      lowerPath.includes(STORAGE_OBJECT_PUBLIC_SEGMENT) &&
      lowerPath.endsWith(".bin")
    ) {
      parsed.pathname = parsed.pathname.replace(
        STORAGE_OBJECT_PUBLIC_SEGMENT,
        STORAGE_RENDER_PUBLIC_SEGMENT,
      );
    }

    return parsed.toString();
  } catch {
    return trimmed;
  }
}

function replaceVariantSuffix(
  pathname: string,
  variant: DisplayImageVariant,
): string {
  const lowerPath = pathname.toLowerCase();
  const isVariantPath =
    lowerPath.endsWith(IMAGE_DETAIL_SUFFIX) ||
    lowerPath.endsWith(IMAGE_THUMB_SUFFIX);

  if (!isVariantPath) {
    return pathname;
  }

  if (variant === "detail") {
    if (lowerPath.endsWith(IMAGE_DETAIL_SUFFIX)) return pathname;
    return pathname.replace(/\.thumb\.webp$/i, IMAGE_DETAIL_SUFFIX);
  }

  if (lowerPath.endsWith(IMAGE_THUMB_SUFFIX)) return pathname;
  return pathname.replace(/\.detail\.webp$/i, IMAGE_THUMB_SUFFIX);
}

export function toDisplayVariantImageUrl(
  rawUrl: string | null | undefined,
  variant: DisplayImageVariant,
): string | null {
  const baseUrl = toDisplayImageUrl(rawUrl);
  if (!baseUrl) return null;

  try {
    const parsed = new URL(baseUrl);
    parsed.pathname = replaceVariantSuffix(parsed.pathname, variant);
    return parsed.toString();
  } catch {
    return baseUrl;
  }
}

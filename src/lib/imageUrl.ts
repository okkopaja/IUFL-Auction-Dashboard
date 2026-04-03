const STORAGE_OBJECT_PUBLIC_SEGMENT = "/storage/v1/object/public/";
const STORAGE_RENDER_PUBLIC_SEGMENT = "/storage/v1/render/image/public/";

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

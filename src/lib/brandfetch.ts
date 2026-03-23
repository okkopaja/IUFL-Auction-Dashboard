const CLIENT_ID = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID ?? "";

/**
 * Returns a Brandfetch CDN logo URL.
 *
 * @param domain  - e.g. "arsenal.com"
 * @param type    - "icon" (square icon, default) | "logo" (wordmark) | "symbol"
 * @param theme   - "dark" (logo for light backgrounds) | "light" (logo for dark backgrounds)
 * @param size    - pixel size for w/h path params (Retina: doubled internally)
 */
export function getTeamLogoUrl(
  domain: string,
  type: "icon" | "logo" | "symbol" = "icon",
  theme: "dark" | "light" = "light",
  size?: number,
): string {
  if (!domain) return "";

  const baseUrl = "https://cdn.brandfetch.io";
  const sizePart = size ? `/w/${size * 2}/h/${size * 2}` : "";
  // lettermark fallback for clubs not in the Brandfetch database
  return `${baseUrl}/${domain}${sizePart}/theme/${theme}/fallback/lettermark/${type}?c=${CLIENT_ID}`;
}

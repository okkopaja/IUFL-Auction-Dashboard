import sharp from "sharp";
import type { ResolvedImageType } from "@/lib/imageType";

export const IMAGE_DETAIL_MAX_EDGE = 960;
export const IMAGE_THUMB_SIZE = 96;

export const IMAGE_DETAIL_SUFFIX = ".detail.webp";
export const IMAGE_THUMB_SUFFIX = ".thumb.webp";

export type ImageVariantKind = "detail" | "thumb";

export interface ProcessedImageVariants {
  detailBytes: Uint8Array;
  thumbBytes: Uint8Array;
}

export interface VariantStoragePaths {
  detailPath: string;
  thumbPath: string;
}

export function buildVariantStoragePaths(
  basePath: string,
): VariantStoragePaths {
  return {
    detailPath: `${basePath}${IMAGE_DETAIL_SUFFIX}`,
    thumbPath: `${basePath}${IMAGE_THUMB_SUFFIX}`,
  };
}

export function isVariantStoragePath(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return (
    normalized.endsWith(IMAGE_DETAIL_SUFFIX) ||
    normalized.endsWith(IMAGE_THUMB_SUFFIX)
  );
}

export function toVariantStoragePath(
  pathname: string,
  variant: ImageVariantKind,
): string {
  if (!isVariantStoragePath(pathname)) return pathname;

  if (variant === "detail") {
    if (pathname.toLowerCase().endsWith(IMAGE_DETAIL_SUFFIX)) return pathname;
    return pathname.replace(/\.thumb\.webp$/i, IMAGE_DETAIL_SUFFIX);
  }

  if (pathname.toLowerCase().endsWith(IMAGE_THUMB_SUFFIX)) return pathname;
  return pathname.replace(/\.detail\.webp$/i, IMAGE_THUMB_SUFFIX);
}

export function shouldGenerateWebpVariants(
  imageType: ResolvedImageType,
): boolean {
  // Keep vector and potentially animated content in original format.
  return (
    imageType.contentType !== "image/svg+xml" &&
    imageType.contentType !== "image/gif"
  );
}

export async function createWebpVariants(
  sourceBytes: Uint8Array,
): Promise<ProcessedImageVariants | null> {
  const sourceBuffer = Buffer.from(sourceBytes);

  const metadata = await sharp(sourceBuffer, {
    animated: true,
    failOn: "none",
  }).metadata();

  if ((metadata.pages ?? 1) > 1) {
    return null;
  }

  const detailBuffer = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .resize({
      width: IMAGE_DETAIL_MAX_EDGE,
      height: IMAGE_DETAIL_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();

  const thumbBuffer = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .resize({
      width: IMAGE_THUMB_SIZE,
      height: IMAGE_THUMB_SIZE,
      fit: "cover",
      position: "attention",
      withoutEnlargement: true,
    })
    .webp({ quality: 68, effort: 4 })
    .toBuffer();

  return {
    detailBytes: new Uint8Array(detailBuffer),
    thumbBytes: new Uint8Array(thumbBuffer),
  };
}

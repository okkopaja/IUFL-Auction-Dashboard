import type { NextConfig } from "next";

const supabaseHostname = (() => {
  try {
    const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return value ? new URL(value).hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  typescript: {
    tsconfigPath:
      process.env.NODE_ENV === "production"
        ? "tsconfig.build.json"
        : "tsconfig.json",
  },
  allowedDevOrigins: ["localtesting.fastcrew.in"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "drive.google.com",
      },
      {
        protocol: "https",
        hostname: "drive.usercontent.google.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/render/image/public/**",
            },
            {
              protocol: "http" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
            {
              protocol: "http" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/render/image/public/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;

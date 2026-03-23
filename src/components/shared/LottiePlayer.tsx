"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

// Use dynamic import to avoid SSR issues with Lottie
const Lottie = dynamic(() => import("lottie-react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-transparent" />
  ),
});

export function LottiePlayer(props: ComponentProps<typeof Lottie>) {
  return <Lottie {...props} />;
}

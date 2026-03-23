"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/ErrorState";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return <ErrorState error={error} reset={reset} />;
}

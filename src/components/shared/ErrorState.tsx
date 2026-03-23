import { AlertCircle } from "lucide-react";
import { Button } from "../ui/button";

export function ErrorState({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
      <AlertCircle className="w-12 h-12 text-destructive mb-4 opacity-80" />
      <h3 className="text-xl font-semibold mb-2">Something went wrong</h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        {error.message ||
          "An unexpected error occurred while loading this data."}
      </p>
      {reset && (
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
      )}
    </div>
  );
}

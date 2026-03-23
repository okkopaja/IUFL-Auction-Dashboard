import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-8">
      <h2 className="text-4xl font-bold mb-4 font-mono text-accent-gold">
        404
      </h2>
      <h3 className="text-2xl font-semibold mb-2">Page Not Found</h3>
      <p className="text-muted-foreground mb-8">
        We couldn't find the page you were looking for.
      </p>
      <Link href="/dashboard">
        <Button>Return to Dashboard</Button>
      </Link>
    </div>
  );
}

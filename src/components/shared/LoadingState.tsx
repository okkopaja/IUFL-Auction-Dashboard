export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[200px]">
      <div className="w-8 h-8 rounded-full border-2 border-accent-gold border-t-transparent animate-spin mb-4" />
      <p className="text-sm text-muted-foreground animate-pulse">
        Loading data...
      </p>
    </div>
  );
}

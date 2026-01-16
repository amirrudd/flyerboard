export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse text-6xl mb-4">🔄</div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Loading...</h2>
        <p className="text-muted-foreground">Please wait</p>
      </div>
    </div>
  );
}

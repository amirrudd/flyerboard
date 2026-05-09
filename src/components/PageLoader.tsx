export function PageLoader() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground font-medium animate-pulse">Checking authentication...</p>
        </div>
    );
}

export default PageLoader;

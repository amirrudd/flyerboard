import { memo } from "react";
import { User, LogIn } from "lucide-react";

interface HeaderRightActionsProps {
    user: any;
    isAuthenticated?: boolean;
    onPostClick: () => void;
    onDashboardClick: () => void;
    onSignInClick: () => void;
}

export const HeaderRightActions = memo(function HeaderRightActions({
    user,
    isAuthenticated,
    onPostClick,
    onDashboardClick,
    onSignInClick,
}: HeaderRightActionsProps) {
    // Determine if authenticated based on prop OR presence of user object
    const isAuthed = isAuthenticated !== undefined ? isAuthenticated : !!user;

    return (
        <>
            <button
                onClick={onPostClick}
                className="h-10 px-4 text-sm font-semibold text-primary-foreground bg-primary rounded-full hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 shadow-sm shadow-primary/25 hover:shadow-md hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                Pin Your Flyer
            </button>

            {isAuthed ? (
                <button
                    onClick={onDashboardClick}
                    className="flex items-center justify-center gap-2 min-w-[140px] h-10 px-3 text-sm font-medium text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <User className="w-4 h-4" strokeWidth={2} />
                    My Dashboard
                </button>
            ) : (
                <button
                    onClick={onSignInClick}
                    className="flex items-center justify-center gap-2 min-w-[140px] h-10 px-3 text-sm font-medium text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <LogIn className="w-4 h-4" strokeWidth={2} />
                    Sign In
                </button>
            )}
        </>
    );
});

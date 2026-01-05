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
                className="h-10 px-4 text-base font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-none"
            >
                Pin Your Flyer
            </button>

            {isAuthed ? (
                <button
                    onClick={onDashboardClick}
                    className="flex items-center justify-center gap-2 min-w-[140px] px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                    <User className="w-4 h-4" />
                    My Dashboard
                </button>
            ) : (
                <button
                    onClick={onSignInClick}
                    className="flex items-center justify-center gap-2 min-w-[140px] px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                    <LogIn className="w-4 h-4" />
                    Sign In
                </button>
            )}
        </>
    );
});

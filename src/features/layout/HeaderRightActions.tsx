import { memo } from "react";
import { User, LogIn } from "lucide-react";

interface HeaderRightActionsProps {
    user: any;
    onPostClick: () => void;
    onDashboardClick: () => void;
    onSignInClick: () => void;
}

export const HeaderRightActions = memo(function HeaderRightActions({
    user,
    onPostClick,
    onDashboardClick,
    onSignInClick,
}: HeaderRightActionsProps) {
    return (
        <>
            <button
                onClick={onPostClick}
                className="h-10 px-4 text-base font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-none"
            >
                Pin Your Flyer
            </button>

            {user ? (
                <button
                    onClick={onDashboardClick}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                    <User className="w-4 h-4" />
                    My Dashboard
                </button>
            ) : (
                <button
                    onClick={onSignInClick}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                    <LogIn className="w-4 h-4" />
                    Sign In
                </button>
            )}
        </>
    );
});

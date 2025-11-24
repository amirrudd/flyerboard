import { memo } from "react";

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
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    My Dashboard
                </button>
            ) : (
                <button
                    onClick={onSignInClick}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Sign In
                </button>
            )}
        </>
    );
});

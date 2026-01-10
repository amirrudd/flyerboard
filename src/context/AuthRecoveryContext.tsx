import { createContext, useContext, ReactNode } from "react";
import { useAuthRecovery, isAuthError } from "../lib/useAuthRecovery";

interface AuthRecoveryContextType {
    /** Force logout the user, clearing all session data */
    forceLogout: () => Promise<void>;
    /** Attempt to recover from auth error - tries refresh first, then logout */
    attemptRecovery: () => Promise<boolean>;
    /** Check if an error is authentication-related */
    isAuthError: (error: Error | null | undefined) => boolean;
    /** Current authentication state */
    isAuthenticated: boolean;
}

const AuthRecoveryContext = createContext<AuthRecoveryContextType | undefined>(undefined);

/**
 * Provider component for authentication recovery functionality.
 * Wrap your app with this to enable auth error recovery throughout.
 * 
 * Must be placed inside AuthProvider but can be outside ConvexProviderWithAuth.
 */
export function AuthRecoveryProvider({ children }: { children: ReactNode }) {
    const recovery = useAuthRecovery();

    return (
        <AuthRecoveryContext.Provider value={{
            forceLogout: recovery.forceLogout,
            attemptRecovery: recovery.attemptRecovery,
            isAuthError: recovery.isAuthError,
            isAuthenticated: recovery.isAuthenticated,
        }}>
            {children}
        </AuthRecoveryContext.Provider>
    );
}

/**
 * Hook to access auth recovery functions.
 * Must be used within an AuthRecoveryProvider.
 */
export function useAuthRecoveryContext() {
    const context = useContext(AuthRecoveryContext);
    if (context === undefined) {
        throw new Error("useAuthRecoveryContext must be used within an AuthRecoveryProvider");
    }
    return context;
}

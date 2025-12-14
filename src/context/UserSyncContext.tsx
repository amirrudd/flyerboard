import { createContext, useContext, ReactNode } from "react";
import { useDescopeUserSync } from "../lib/useDescopeUserSync";

interface UserSyncContextType {
    isUserSynced: boolean;
}

const UserSyncContext = createContext<UserSyncContextType | undefined>(undefined);

export function UserSyncProvider({ children }: { children: ReactNode }) {
    const isUserSynced = useDescopeUserSync();

    return (
        <UserSyncContext.Provider value={{ isUserSynced }}>
            {children}
        </UserSyncContext.Provider>
    );
}

export function useUserSync() {
    const context = useContext(UserSyncContext);
    if (context === undefined) {
        throw new Error("useUserSync must be used within a UserSyncProvider");
    }
    return context;
}

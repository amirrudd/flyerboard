import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUserSync } from "../context/UserSyncContext";
import { AdminDashboard } from "../features/admin/AdminDashboard";
import { PageLoader } from "../components/PageLoader";

export default function AdminDashboardPage() {
    const navigate = useNavigate();
    const { isAuthenticated, isSessionLoading } = useSession();
    const { isUserSynced } = useUserSync();
    // Gate on user-sync to avoid the "Not authenticated" race; false (not
    // undefined) means the query resolved and the user isn't an admin.
    const isAdmin = useQuery(
        api.admin.isCurrentUserAdmin,
        isAuthenticated && !isSessionLoading && isUserSynced ? {} : "skip"
    );

    useEffect(() => {
        if (!isSessionLoading && !isAuthenticated) {
            void navigate('/', { replace: true });
        }
    }, [isAuthenticated, isSessionLoading, navigate]);

    // Redirect non-admins at the route level, matching the other guarded
    // pages, instead of letting AdminDashboard render its Access Denied state.
    useEffect(() => {
        if (isAdmin === false) {
            void navigate('/', { replace: true });
        }
    }, [isAdmin, navigate]);

    if (isSessionLoading || !isAuthenticated || isAdmin !== true) {
        return <PageLoader />;
    }

    return <AdminDashboard onBack={() => { void navigate("/"); }} />;
}

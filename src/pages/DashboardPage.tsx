import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { UserDashboard } from "../features/dashboard/UserDashboard";
import { PageLoader } from "../components/PageLoader";
import { getLegacyChatsRedirect } from "../lib/legacyChatsRedirect";

export function DashboardPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, isSessionLoading } = useSession();

    const chatsRedirect = getLegacyChatsRedirect(location.search);

    // Redirect shim for legacy chats-tab URLs. Single URL writer with
    // replace:true (no history spam, no effect ping-pong — see the OOM guard
    // notes in UserDashboard.tsx). Declared BEFORE the auth guard effect so
    // that, for signed-out users, the auth guard's navigate('/') runs last
    // and wins — signed-out legacy links land on the auth flow, not a
    // double redirect.
    useEffect(() => {
        if (chatsRedirect) {
            void navigate(chatsRedirect, { replace: true });
        }
    }, [chatsRedirect, navigate]);

    useEffect(() => {
        if (!isSessionLoading && !isAuthenticated) {
            void navigate('/', { replace: true });
        }
    }, [isAuthenticated, isSessionLoading, navigate]);

    if (isSessionLoading || !isAuthenticated) {
        return <PageLoader />;
    }

    // While the shim redirect is pending, never mount UserDashboard — its
    // tab-sync effects must not see tab=chats (that tab is now a redirect).
    if (chatsRedirect) {
        return <PageLoader />;
    }

    return (
        <UserDashboard
            onBack={() => { void navigate('/'); }}
            onPostAd={() => { void navigate('/post', { state: { from: '/dashboard' } }); }}
            onEditAd={(ad) => { void navigate('/post', { state: { editingAd: ad, from: '/dashboard' } }); }}
        />
    );
}

export default DashboardPage;

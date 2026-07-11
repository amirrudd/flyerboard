import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { PageLoader } from "../components/PageLoader";
import { useHeaderSlots } from "../features/layout/HeaderSlots";
import { useDeviceInfo } from "../hooks/useDeviceInfo";

/**
 * Dedicated Messages destination.
 *
 * Routes: `/messages` (inbox) and `/messages/:chatId` (conversation thread).
 * The legacy dashboard chats tab (`/dashboard?tab=chats[&chat=X]`) redirects
 * here — see the shim in `DashboardPage.tsx`. An optional `?flyer=<adId>`
 * query filters the inbox to conversations about one flyer and is preserved
 * across the redirect.
 *
 * Phase 1 scaffolding: real auth gate + chrome rules; the inbox and thread
 * UIs land in later phases (built from `src/features/messages/`).
 */
export function MessagesPage() {
    const navigate = useNavigate();
    const { isAuthenticated, isSessionLoading } = useSession();
    const { chatId } = useParams<{ chatId: string }>();
    const [searchParams] = useSearchParams();
    const flyerParam = searchParams.get("flyer");
    const { isMobile } = useDeviceInfo();

    // `/messages/archived` matches the `:chatId` route but is an inbox
    // sub-view (Phase 2), not a conversation thread — it keeps the normal
    // header and bottom nav.
    const isThread = !!chatId && chatId !== "archived";

    // On the full-screen conversation route (<md) the thread supplies its own
    // header (Phase 3) — hide the persistent shell header via the `hidden`
    // slot, the same mechanism the dashboard uses for AdMessages. The inbox
    // route keeps the normal header. Registering `{}` keeps the default
    // header (hook must be called unconditionally — hooks rules).
    useHeaderSlots(isThread && isMobile ? { hidden: true } : {});

    // Route guard — same pattern as DashboardPage: PageLoader while the
    // session resolves, redirect home when unauthenticated.
    useEffect(() => {
        if (!isSessionLoading && !isAuthenticated) {
            void navigate('/', { replace: true });
        }
    }, [isAuthenticated, isSessionLoading, navigate]);

    if (isSessionLoading || !isAuthenticated) {
        return <PageLoader />;
    }

    return (
        <div className="container-padding content-max-width mx-auto w-full py-6 pb-bottom-nav">
            <h1 className="font-display text-2xl font-semibold text-foreground">Messages</h1>
            <p className="mt-2 text-sm text-muted-foreground">
                {isThread
                    ? "This conversation view is under construction."
                    : "Your conversations are moving here."}
                {flyerParam ? " Showing chats about one flyer." : ""}
            </p>
        </div>
    );
}

export default MessagesPage;

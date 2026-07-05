import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { PostAd } from "../features/ads/PostAd";
import { PageLoader } from "../components/PageLoader";

export function PostAdPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, isSessionLoading } = useSession();
    const editingAd = location.state?.editingAd;
    const from = location.state?.from || '/';

    useEffect(() => {
        if (!isSessionLoading && !isAuthenticated) {
            void navigate('/', { replace: true });
        }
    }, [isAuthenticated, isSessionLoading, navigate]);

    if (isSessionLoading || !isAuthenticated) {
        return <PageLoader />;
    }

    const handleBack = (reason?: "cancel" | "delete") => {
        // Deleted flyer: its detail page would render not-found, so never
        // return to /ad/<id> — dashboard (their flyers) or refreshed home.
        if (reason === 'delete') {
            if (from === '/dashboard') {
                void navigate('/dashboard');
            } else {
                void navigate('/', { state: { forceRefresh: true } });
            }
            return;
        }
        // Cancel: return the user to wherever they came from — abandoning the
        // form shouldn't dump them on home when they started on an ad page.
        if (reason === 'cancel' && from.startsWith('/ad/')) {
            void navigate(from);
            return;
        }
        // If posting from dashboard, navigate back to dashboard
        // If editing from an ad detail page, return there to show the updated flyer
        // Otherwise navigate to home to see the newly posted flyer
        if (from === '/dashboard') {
            void navigate('/dashboard');
        } else if (editingAd && from.startsWith('/ad/')) {
            void navigate(from);
        } else {
            // Pass forceRefresh flag to trigger immediate refresh on home page
            void navigate('/', { state: { forceRefresh: true } });
        }
    };

    return (
        <PostAd
            onBack={handleBack}
            editingAd={editingAd}
            origin={from}
        />
    );
}

export default PostAdPage;

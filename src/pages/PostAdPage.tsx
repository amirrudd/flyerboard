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

    const handleBack = () => {
        // If posting from dashboard, navigate back to dashboard
        // Otherwise navigate to home to see the newly posted flyer
        if (from === '/dashboard') {
            void navigate('/dashboard');
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

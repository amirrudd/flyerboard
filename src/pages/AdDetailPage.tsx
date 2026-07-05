import { Id } from "../../convex/_generated/dataModel";
import { AdDetail } from "../features/ads/AdDetail";
import { useNavigate, useLocation, useOutletContext } from "react-router-dom";

interface LayoutContext {
    setShowAuthModal: (show: boolean) => void;
}

export function AdDetailPage() {
    const navigate = useNavigate();
    const location = useLocation();
    // Auth modal is owned by Layout (single instance for the whole shell) —
    // the page used to render its own copy, which would now double up with
    // the persistent header's Sign In flow.
    const { setShowAuthModal } = useOutletContext<LayoutContext>();

    // Extract adId from URL params
    const pathSegments = location.pathname.split('/');
    const adIdFromUrl = pathSegments[pathSegments.length - 1];
    const adId = adIdFromUrl as Id<"ads">;

    // Get initialAd from location state if available
    const initialAd = location.state?.initialAd;

    // React Router stores its own history index in history.state.idx; 0 means
    // this is the first in-app entry (deep link, shared URL, new tab), where
    // navigate(-1) would be a no-op or leave the site entirely.
    const handleBack = () => {
        if (typeof window.history.state?.idx === "number" && window.history.state.idx > 0) {
            void navigate(-1);
        } else {
            void navigate("/");
        }
    };

    return (
        <AdDetail
            adId={adId}
            initialAd={initialAd}
            onBack={handleBack}
            onShowAuth={() => setShowAuthModal(true)}
        />
    );
}

export default AdDetailPage;

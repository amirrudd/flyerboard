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

    return (
        <AdDetail
            adId={adId}
            initialAd={initialAd}
            onBack={() => { void navigate(-1); }}
            onShowAuth={() => setShowAuthModal(true)}
        />
    );
}

export default AdDetailPage;

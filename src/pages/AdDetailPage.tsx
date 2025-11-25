import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AdDetail } from "../features/ads/AdDetail";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { AuthModal } from "../features/auth/AuthModal";
import { extractIdFromSlug } from "../utils/slugs";

export function AdDetailPage() {
    const { id, slugId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [showAuthModal, setShowAuthModal] = useState(false);

    const initialAd = location.state?.initialAd;

    // Determine the ID: either from the direct :id param or extracted from :slugId
    const adId = id || (slugId ? extractIdFromSlug(slugId) : null);

    if (!adId) return null;

    return (
        <>
            <AdDetail
                adId={adId as Id<"ads">}
                initialAd={initialAd}
                onBack={() => navigate(-1)}
                onShowAuth={() => setShowAuthModal(true)}
            />
            <AuthModal
                showAuthModal={showAuthModal}
                setShowAuthModal={setShowAuthModal}
            />
        </>
    );
}

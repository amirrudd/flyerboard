import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AdDetail } from "../features/ads/AdDetail";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { AuthModal } from "../features/auth/AuthModal";

export function AdDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [showAuthModal, setShowAuthModal] = useState(false);

    const initialAd = location.state?.initialAd;

    if (!id) return null;

    return (
        <>
            <AdDetail
                adId={id as Id<"ads">}
                initialAd={initialAd}
                onBack={() => navigate('/')}
                onShowAuth={() => setShowAuthModal(true)}
            />
            <AuthModal
                showAuthModal={showAuthModal}
                setShowAuthModal={setShowAuthModal}
            />
        </>
    );
}

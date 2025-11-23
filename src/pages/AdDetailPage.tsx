import { useParams, useNavigate } from "react-router-dom";
import { AdDetail } from "../features/ads/AdDetail";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { AuthModal } from "../features/auth/AuthModal";

export function AdDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [showAuthModal, setShowAuthModal] = useState(false);

    if (!id) return null;

    return (
        <>
            <AdDetail
                adId={id as Id<"ads">}
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

import { Id } from "../../convex/_generated/dataModel";
import { AdDetail } from "../features/ads/AdDetail";
import { useState } from "react";
import { createPortal } from "react-dom";
import { SmsOtpSignIn } from "../features/auth/SmsOtpSignIn";
import { useNavigate, useLocation } from "react-router-dom";
import { X } from 'lucide-react';

export function AdDetailPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [isModalDismissable, setIsModalDismissable] = useState(true);

    // Extract adId from URL params
    const pathSegments = location.pathname.split('/');
    const adIdFromUrl = pathSegments[pathSegments.length - 1];
    const adId = adIdFromUrl as Id<"ads">;

    // Get initialAd from location state if available
    const initialAd = location.state?.ad;

    return (
        <>
            <AdDetail
                adId={adId}
                initialAd={initialAd}
                onBack={() => navigate(-1)}
                onShowAuth={() => setShowAuthModal(true)}
            />

            {/* OTP Sign-In Modal */}
            {showAuthModal && createPortal(
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in modal-scroll-lock"
                    onClick={() => isModalDismissable && setShowAuthModal(false)}
                >
                    <div
                        className="bg-card rounded-2xl p-4 sm:p-6 w-full max-w-md shadow-2xl transform transition-all border border-border my-8 max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isModalDismissable && (
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={() => setShowAuthModal(false)}
                                    className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        )}
                        <SmsOtpSignIn
                            onClose={() => setShowAuthModal(false)}
                            onDismissableChange={setIsModalDismissable}
                        />
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

export default AdDetailPage;

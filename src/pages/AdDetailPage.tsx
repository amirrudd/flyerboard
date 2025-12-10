import { Id } from "../../convex/_generated/dataModel";
import { AdDetail } from "../features/ads/AdDetail";
import { useState } from "react";
import { SmsOtpSignIn } from "../features/auth/SmsOtpSignIn";
import { useNavigate, useLocation } from "react-router-dom";

export function AdDetailPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [showAuthModal, setShowAuthModal] = useState(false);

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
            {showAuthModal && (
                <div
                    className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in modal-scroll-lock"
                    onClick={() => setShowAuthModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-md shadow-2xl transform transition-all border border-white/20 my-8 max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-end mb-2">
                            <button
                                onClick={() => setShowAuthModal(false)}
                                className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <SmsOtpSignIn onClose={() => setShowAuthModal(false)} />
                    </div>
                </div>
            )}
        </>
    );
}

export default AdDetailPage;

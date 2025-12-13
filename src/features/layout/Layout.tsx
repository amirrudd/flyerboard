import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { X } from 'lucide-react';
import { SmsOtpSignIn } from "../auth/SmsOtpSignIn";
import { useState, useEffect } from "react";
import { useSession } from "@descope/react-sdk";
import { Header } from "./Header";

export function Layout() {
    const { isAuthenticated } = useSession();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authKey, setAuthKey] = useState(0);
    const [isModalDismissable, setIsModalDismissable] = useState(true);

    // Re-render child components when user logs in to show authenticated features
    useEffect(() => {
        if (isAuthenticated) {
            // Force re-render of child components to show authenticated features
            // Note: Don't close the auth modal here - let SmsOtpSignIn handle it
            // (new users need to see step 3 for name collection)
            setAuthKey(prev => prev + 1);
        }
    }, [isAuthenticated]);

    return (
        <div className="flex flex-col h-screen h-dvh overflow-hidden">
            <main className="flex-1 overflow-y-auto mobile-scroll-container">
                <Outlet key={authKey} context={{ setShowAuthModal }} />
            </main>

            {/* Bottom Nav - positioned outside flex flow for proper fixed positioning */}
            <BottomNav setShowAuthModal={setShowAuthModal} />

            {/* OTP Sign-In Modal */}
            {showAuthModal && (
                <div
                    className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto modal-scroll-lock"
                    onClick={() => isModalDismissable && setShowAuthModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-md shadow-2xl transform transition-all border border-white/20 my-8 max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isModalDismissable && (
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={() => setShowAuthModal(false)}
                                    className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
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
                </div>
            )}
        </div>
    );
}

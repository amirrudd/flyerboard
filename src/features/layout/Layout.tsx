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
    const [isModalDismissable, setIsModalDismissable] = useState(true);

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <main className="flex-1 overflow-y-auto mobile-scroll-container">
                <Outlet context={{ setShowAuthModal }} />
            </main>

            {/* Bottom Nav - positioned outside flex flow for proper fixed positioning */}
            <BottomNav setShowAuthModal={setShowAuthModal} />

            {/* OTP Sign-In Modal */}
            {showAuthModal && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto modal-scroll-lock"
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
                </div>
            )}


        </div>
    );
}

import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { X } from '@phosphor-icons/react';
import { SmsOtpSignIn } from "../auth/SmsOtpSignIn";
import { useState, useEffect } from "react";
import { useSession } from "@descope/react-sdk";
import { Header } from "./Header";
import { CommandPalette } from "../../components/ui/CommandPalette";

export function Layout() {
    const { isAuthenticated } = useSession();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [isModalDismissable, setIsModalDismissable] = useState(true);
    const [showCommandPalette, setShowCommandPalette] = useState(false);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setShowCommandPalette(prev => !prev);
            }
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, []);

    return (
        <div className="flex flex-col h-dynamic-screen overflow-hidden pt-safe bg-background">
            <main className="flex-1 overflow-y-auto md:overflow-hidden mobile-scroll-container scrollbar-hide">
                <Outlet context={{ setShowAuthModal }} />
            </main>

            {/* Bottom Nav - positioned outside flex flow for proper fixed positioning */}
            <BottomNav setShowAuthModal={setShowAuthModal} />

            {/* OTP Sign-In Modal */}
            {showAuthModal && (
                <div
                    className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in overflow-y-auto modal-scroll-lock"
                    onClick={() => isModalDismissable && setShowAuthModal(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Sign in"
                >
                    <div
                        className="bg-card ring-1 ring-border/70 rounded-2xl p-4 sm:p-6 w-full max-w-md shadow-2xl transform transition-all my-8 max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isModalDismissable && (
                            <div className="flex justify-end mb-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAuthModal(false)}
                                    className="p-2 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                    aria-label="Close sign in"
                                >
                                    <X className="w-6 h-6" aria-hidden="true" />
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


            <CommandPalette
                open={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
            />
        </div>
    );
}

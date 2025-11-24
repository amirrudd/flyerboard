import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { AuthModal } from "../auth/AuthModal";
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";

export function Layout() {
    const [showAuthModal, setShowAuthModal] = useState(false);
    const user = useQuery(api.auth.loggedInUser);

    // Close auth modal when user logs in
    useEffect(() => {
        if (user && showAuthModal) {
            setShowAuthModal(false);
            toast.success("Successfully signed in");
        }
    }, [user, showAuthModal]);

    return (
        <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
            <Outlet context={{ setShowAuthModal }} />
            <BottomNav setShowAuthModal={setShowAuthModal} />
            <AuthModal
                showAuthModal={showAuthModal}
                setShowAuthModal={setShowAuthModal}
            />
        </div>
    );
}

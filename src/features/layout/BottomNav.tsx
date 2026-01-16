import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Plus, User, MessageSquare, Heart, LayoutDashboard } from "lucide-react";
import { useSession } from "@descope/react-sdk";
import { memo } from "react";

interface BottomNavProps {
    setShowAuthModal: (show: boolean) => void;
}

export const BottomNav = memo(function BottomNav({ setShowAuthModal }: BottomNavProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated } = useSession();
    const user = isAuthenticated ? { name: "User" } : null;

    const isActive = (path: string) => {
        // Handle dashboard tab states
        if (path.startsWith('/dashboard')) {
            const currentParams = new URLSearchParams(location.search);
            const currentTab = currentParams.get('tab') || 'ads';
            const targetParams = new URLSearchParams(path.split('?')[1]);
            const targetTab = targetParams.get('tab') || 'ads';
            return location.pathname === '/dashboard' && currentTab === targetTab;
        }
        return location.pathname === path;
    };

    const handleAuthGuard = (path: string) => {
        if (user) {
            navigate(path);
        } else {
            setShowAuthModal(true);
        }
    };

    return (
        <div
            className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-lg border-t border-border md:hidden z-50 pb-safe"
            style={{
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                willChange: 'transform',
                height: 'calc(72px + env(safe-area-inset-bottom, 0px))',
            }}
        >
            <div className="grid grid-cols-5 items-end px-4 pt-2 pb-4">
                <Link
                    to="/"
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/") ? "text-primary-bright" : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    <Home size={24} />
                    <span className="text-xs font-medium">Home</span>
                </Link>

                <button
                    onClick={() => handleAuthGuard("/dashboard?tab=saved")}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/dashboard?tab=saved") ? "text-primary-bright" : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    <Heart size={24} />
                    <span className="text-xs font-medium">Saved</span>
                </button>

                <button
                    onClick={() => handleAuthGuard("/post")}
                    className="flex flex-col items-center gap-1 -mt-6"
                >
                    <div className="bg-primary text-white p-3 rounded-full shadow-lg hover:opacity-90 transition-all active:scale-95 shadow-primary/20">
                        <Plus size={28} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">PIN</span>
                </button>

                <button
                    onClick={() => handleAuthGuard("/dashboard?tab=chats")}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/dashboard?tab=chats") ? "text-primary-bright" : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    <MessageSquare size={24} />
                    <span className="text-xs font-medium">Messages</span>
                </button>

                <button
                    onClick={() => handleAuthGuard("/dashboard?tab=ads")}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/dashboard?tab=ads") ? "text-primary-bright" : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    {user ? <LayoutDashboard size={24} /> : <User size={24} />}
                    <span className="text-xs font-medium">{user ? "Dashboard" : "Sign In"}</span>
                </button>
            </div>
        </div>
    );
});

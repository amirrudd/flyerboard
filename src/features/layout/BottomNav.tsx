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

    const navItemClass = (active: boolean) =>
        `relative flex flex-col items-center gap-1 p-2 rounded-xl transition-colors duration-200 active:scale-95 ${
            active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        }`;

    const ActiveDot = () => (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" aria-hidden />
    );

    return (
        <div
            className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-border/70 md:hidden z-50 pb-safe"
            style={{
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                willChange: 'transform',
                height: 'calc(72px + env(safe-area-inset-bottom, 0px))',
            }}
        >
            <div className="grid grid-cols-5 items-end px-4 pt-2 pb-4">
                <Link to="/" className={navItemClass(isActive("/"))}>
                    {isActive("/") && <ActiveDot />}
                    <Home size={22} strokeWidth={isActive("/") ? 2.25 : 2} />
                    <span className="text-[11px] font-medium tracking-wide">Home</span>
                </Link>

                <button
                    onClick={() => handleAuthGuard("/dashboard?tab=saved")}
                    className={navItemClass(isActive("/dashboard?tab=saved"))}
                >
                    {isActive("/dashboard?tab=saved") && <ActiveDot />}
                    <Heart size={22} strokeWidth={isActive("/dashboard?tab=saved") ? 2.25 : 2} />
                    <span className="text-[11px] font-medium tracking-wide">Saved</span>
                </button>

                <button
                    onClick={() => handleAuthGuard("/post")}
                    className="flex flex-col items-center gap-1 -mt-6 group"
                    aria-label="Pin Your Flyer"
                >
                    <div className="bg-primary text-primary-foreground p-3 rounded-full shadow-[0_8px_24px_-4px_hsl(var(--primary)/0.45)] hover:shadow-[0_10px_28px_-4px_hsl(var(--primary)/0.55)] transition-all duration-200 group-active:scale-90 ring-4 ring-background">
                        <Plus size={26} strokeWidth={2.5} />
                    </div>
                    <span className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">PIN</span>
                </button>

                <button
                    onClick={() => handleAuthGuard("/dashboard?tab=chats")}
                    className={navItemClass(isActive("/dashboard?tab=chats"))}
                >
                    {isActive("/dashboard?tab=chats") && <ActiveDot />}
                    <MessageSquare size={22} strokeWidth={isActive("/dashboard?tab=chats") ? 2.25 : 2} />
                    <span className="text-[11px] font-medium tracking-wide">Messages</span>
                </button>

                <button
                    onClick={() => handleAuthGuard("/dashboard?tab=ads")}
                    className={navItemClass(isActive("/dashboard?tab=ads"))}
                >
                    {isActive("/dashboard?tab=ads") && <ActiveDot />}
                    {user ? (
                        <LayoutDashboard size={22} strokeWidth={isActive("/dashboard?tab=ads") ? 2.25 : 2} />
                    ) : (
                        <User size={22} strokeWidth={2} />
                    )}
                    <span className="text-[11px] font-medium tracking-wide">{user ? "Dashboard" : "Sign In"}</span>
                </button>
            </div>
        </div>
    );
});

import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, PlusCircle, User, MessageCircle, Heart, LayoutDashboard } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface BottomNavProps {
    setShowAuthModal: (show: boolean) => void;
}

export function BottomNav({ setShowAuthModal }: BottomNavProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const user = useQuery(api.auth.loggedInUser);

    const isActive = (path: string) => location.pathname === path;

    const handleAuthGuard = (path: string) => {
        if (user) {
            navigate(path);
        } else {
            setShowAuthModal(true);
        }
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-4 py-2 md:hidden z-50 pb-safe">
            <div className="flex justify-around items-center">
                <Link
                    to="/"
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/") ? "text-primary-600" : "text-neutral-500 hover:text-neutral-900"
                        }`}
                >
                    <Home size={24} />
                    <span className="text-xs font-medium">Home</span>
                </Link>

                <button
                    onClick={() => handleAuthGuard("/saved")}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/saved") ? "text-primary-600" : "text-neutral-500 hover:text-neutral-900"
                        }`}
                >
                    <Heart size={24} />
                    <span className="text-xs font-medium">Saved</span>
                </button>

                <button
                    onClick={() => handleAuthGuard("/post")}
                    className="flex flex-col items-center gap-1 p-2 -mt-6"
                >
                    <div className="bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 transition-colors">
                        <PlusCircle size={28} />
                    </div>
                    <span className="text-xs font-medium text-neutral-500">Post</span>
                </button>

                <button
                    onClick={() => handleAuthGuard("/dashboard")} // Using dashboard for messages/chats for now as per user request to consolidate or separate? 
                    // User said: "The chat functionality seems like not implemented... They both should be behind auth"
                    // Assuming /messages route exists or should be handled. 
                    // Wait, BottomNav had /messages link before.
                    // I'll keep /messages but guard it.
                    // Actually, Dashboard has a "Messages" tab. 
                    // If I navigate to /dashboard, it defaults to "Ads".
                    // Maybe I should navigate to /dashboard?tab=chats?
                    // For now, let's just guard /messages if it exists, or redirect to dashboard.
                    // The original code had Link to="/messages".
                    // Let's stick to that but guard it.
                    // Wait, does /messages route exist in App.tsx?
                    // No, it wasn't in App.tsx I viewed earlier.
                    // App.tsx has: /, /ad/:id, /post, /dashboard, /terms, /community-guidelines.
                    // So /messages link was likely broken or handled by a catch-all?
                    // UserDashboard handles messages.
                    // So I should probably redirect "Chat" to Dashboard with "chats" tab active?
                    // Or just leave it as is if there's a route I missed?
                    // Let's assume /messages is not implemented as a separate page yet.
                    // I'll redirect to /dashboard for now, or keep it as /messages if I plan to add it.
                    // User said "The chat functionality seems like not implemented."
                    // I'll redirect to /dashboard for now as it has messages tab.
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/messages") ? "text-primary-600" : "text-neutral-500 hover:text-neutral-900"
                        }`}
                >
                    <MessageCircle size={24} />
                    <span className="text-xs font-medium">Chat</span>
                </button>

                <button
                    onClick={() => handleAuthGuard("/dashboard")}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/dashboard") ? "text-primary-600" : "text-neutral-500 hover:text-neutral-900"
                        }`}
                >
                    {user ? <LayoutDashboard size={24} /> : <User size={24} />}
                    <span className="text-xs font-medium">{user ? "Dashboard" : "Sign In"}</span>
                </button>
            </div>
        </div>
    );
}

import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, PlusCircle, User, MessageSquare, Heart, LayoutDashboard } from "lucide-react";
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
                    onClick={() => handleAuthGuard("/dashboard?tab=saved")}
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
                    onClick={() => handleAuthGuard("/dashboard?tab=chats")}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/messages") ? "text-primary-600" : "text-neutral-500 hover:text-neutral-900"
                        }`}
                >
                    <MessageSquare size={24} />
                    <span className="text-xs font-medium">Messages</span>
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

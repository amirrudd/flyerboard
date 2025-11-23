import { Link, useLocation } from "react-router-dom";
import { Home, PlusCircle, User, MessageCircle, Heart } from "lucide-react";

export function BottomNav() {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

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

                <Link
                    to="/saved"
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/saved") ? "text-primary-600" : "text-neutral-500 hover:text-neutral-900"
                        }`}
                >
                    <Heart size={24} />
                    <span className="text-xs font-medium">Saved</span>
                </Link>

                <Link
                    to="/post"
                    className="flex flex-col items-center gap-1 p-2 -mt-6"
                >
                    <div className="bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 transition-colors">
                        <PlusCircle size={28} />
                    </div>
                    <span className="text-xs font-medium text-neutral-500">Post</span>
                </Link>

                <Link
                    to="/messages"
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/messages") ? "text-primary-600" : "text-neutral-500 hover:text-neutral-900"
                        }`}
                >
                    <MessageCircle size={24} />
                    <span className="text-xs font-medium">Chat</span>
                </Link>

                <Link
                    to="/dashboard"
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/dashboard") ? "text-primary-600" : "text-neutral-500 hover:text-neutral-900"
                        }`}
                >
                    <User size={24} />
                    <span className="text-xs font-medium">Profile</span>
                </Link>
            </div>
        </div>
    );
}

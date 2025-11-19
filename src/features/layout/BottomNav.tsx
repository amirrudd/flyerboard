import { Link, useLocation } from "react-router-dom";
import { Home, PlusCircle, User, MessageCircle, Heart } from "lucide-react";

export function BottomNav() {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 md:hidden z-50 pb-safe">
            <div className="flex justify-around items-center">
                <Link
                    to="/"
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/") ? "text-[#FF6600]" : "text-gray-500 hover:text-gray-900"
                        }`}
                >
                    <Home size={24} />
                    <span className="text-xs font-medium">Home</span>
                </Link>

                <Link
                    to="/saved"
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/saved") ? "text-[#FF6600]" : "text-gray-500 hover:text-gray-900"
                        }`}
                >
                    <Heart size={24} />
                    <span className="text-xs font-medium">Saved</span>
                </Link>

                <Link
                    to="/post"
                    className="flex flex-col items-center gap-1 p-2 -mt-6"
                >
                    <div className="bg-[#FF6600] text-white p-3 rounded-full shadow-lg hover:bg-[#e55a00] transition-colors">
                        <PlusCircle size={28} />
                    </div>
                    <span className="text-xs font-medium text-gray-500">Post</span>
                </Link>

                <Link
                    to="/messages"
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/messages") ? "text-[#FF6600]" : "text-gray-500 hover:text-gray-900"
                        }`}
                >
                    <MessageCircle size={24} />
                    <span className="text-xs font-medium">Chat</span>
                </Link>

                <Link
                    to="/dashboard"
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive("/dashboard") ? "text-[#FF6600]" : "text-gray-500 hover:text-gray-900"
                        }`}
                >
                    <User size={24} />
                    <span className="text-xs font-medium">Profile</span>
                </Link>
            </div>
        </div>
    );
}

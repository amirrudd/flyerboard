import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export function Layout() {
    return (
        <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
            <Outlet />
            <BottomNav />
        </div>
    );
}

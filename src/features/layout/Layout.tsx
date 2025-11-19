import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { AnimatePresence, motion } from "framer-motion";

export function Layout() {
    const location = useLocation();

    return (
        <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
            <AnimatePresence mode="wait">
                <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="min-h-screen"
                >
                    <Outlet />
                </motion.div>
            </AnimatePresence>
            <BottomNav />
        </div>
    );
}

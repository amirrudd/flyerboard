import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { Id } from '../../../../convex/_generated/dataModel';
import { SidebarContent } from './SidebarContent';
import { useScrollLock } from '../../../hooks/useScrollLock';

interface Category {
    _id: Id<"categories">;
    name: string;
    slug: string;
    icon?: string;
    parentId?: Id<"categories">;
}

interface MobileSidebarProps {
    sidebarCollapsed: boolean;
    categories: Category[];
    selectedCategory: Id<"categories"> | null;
    setSelectedCategory: (categoryId: Id<"categories"> | null) => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    isLoading?: boolean;
}

/**
 * Mobile sidebar - Portal-based overlay with scroll locking
 * Renders outside normal DOM hierarchy to prevent scroll chaining
 */
export function MobileSidebar({
    sidebarCollapsed,
    categories,
    selectedCategory,
    setSelectedCategory,
    setSidebarCollapsed,
    isLoading,
}: MobileSidebarProps) {
    const { lockScroll, unlockScroll } = useScrollLock();

    // Lock scroll when sidebar is open
    useEffect(() => {
        if (!sidebarCollapsed) {
            lockScroll();
            return () => unlockScroll();
        }
    }, [sidebarCollapsed, lockScroll, unlockScroll]);

    if (sidebarCollapsed) {
        return null;
    }

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-[60] touch-none"
                onClick={() => setSidebarCollapsed(true)}
                aria-label="Close sidebar"
            />

            {/* Sidebar */}
            <div
                className="fixed top-0 left-0 h-screen w-64 bg-white shadow-2xl z-[70] overflow-y-auto scrollbar-hide pb-bottom-nav"
                style={{
                    overscrollBehavior: 'contain',
                    touchAction: 'pan-y',
                    WebkitOverflowScrolling: 'touch',
                }}
                onClick={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
            >
                <SidebarContent
                    categories={categories}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    setSidebarCollapsed={setSidebarCollapsed}
                    isLoading={isLoading}
                    showCloseButton={true}
                />
            </div>
        </>,
        document.body
    );
}

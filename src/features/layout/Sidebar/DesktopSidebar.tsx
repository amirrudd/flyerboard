import { Id } from '../../../../convex/_generated/dataModel';
import { SidebarContent } from './SidebarContent';
import type { Category } from '../../../context/MarketplaceContext';

interface DesktopSidebarProps {
    categories: Category[];
    selectedCategory: Id<"categories"> | null;
    setSelectedCategory: (categoryId: Id<"categories"> | null) => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    isLoading?: boolean;
}

/**
 * Desktop sidebar - Sticky positioned, no overlay
 * Simple wrapper around SidebarContent
 */
export function DesktopSidebar({
    categories,
    selectedCategory,
    setSelectedCategory,
    setSidebarCollapsed,
    isLoading,
}: DesktopSidebarProps) {
    return (
        <div className="hidden md:block w-64">
            <SidebarContent
                categories={categories}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                setSidebarCollapsed={setSidebarCollapsed}
                isLoading={isLoading}
                showCloseButton={false}
            />
        </div>
    );
}

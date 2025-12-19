import { Id } from '../../../../convex/_generated/dataModel';
import { useDeviceInfo } from '../../../hooks/useDeviceInfo';
import { MobileSidebar } from './MobileSidebar';
import { DesktopSidebar } from './DesktopSidebar';

interface Category {
    _id: Id<"categories">;
    name: string;
    slug: string;
    icon?: string;
    parentId?: Id<"categories">;
}

interface SidebarProps {
    sidebarCollapsed: boolean;
    categories: Category[];
    selectedCategory: Id<"categories"> | null;
    setSelectedCategory: (categoryId: Id<"categories"> | null) => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    isLoading?: boolean;
}

/**
 * Smart sidebar wrapper that automatically renders the correct variant
 * - Mobile: Portal-based overlay with scroll locking
 * - Desktop: Sticky sidebar
 */
export function Sidebar(props: SidebarProps) {
    const { isMobile } = useDeviceInfo();

    if (isMobile) {
        return <MobileSidebar {...props} />;
    }

    // Desktop: only render if not collapsed
    if (props.sidebarCollapsed) {
        return null;
    }

    return <DesktopSidebar {...props} />;
}

// Export individual components for testing
export { MobileSidebar } from './MobileSidebar';
export { DesktopSidebar } from './DesktopSidebar';
export { SidebarContent } from './SidebarContent';

// NOTE: This file (and LucideIconPicker.tsx) intentionally stays on lucide-react,
// even though the rest of the app migrated to @phosphor-icons/react. Category icons
// are stored in the DB as Lucide icon-name slugs (e.g. "Car", "Home") via the admin
// LucideIconPicker, and getIconCdnUrl() builds lucide-static CDN URLs from them.
// "Finishing" the migration here would require a data migration of every category's
// stored `icon` field — don't swap these to Phosphor without that.
//
// This module is imported eagerly (homepage sidebar), so it only bundles a curated
// subset of icons — a superset of every slug actually in use by prod categories.
// The full ~180-icon mega-map lives in ./adminIconMap.ts and is only reachable from
// the lazy admin route. Ceiling: an admin-picked icon outside this curated map
// renders as LayoutGrid on public surfaces until added here (admin previews still
// work via the CDN fallback in CategoriesTab).
import {
    Car,
    Home,
    Smartphone,
    Armchair,
    Wrench,
    Shirt,
    Dumbbell,
    Briefcase,
    Watch,
    Book,
    PawPrint,
    Palette,
    CalendarClock,
    Baby,
    Gamepad2,
    LayoutGrid,
    LucideIcon,
    // Additional icons for common categories
    Music,
    Camera,
    Utensils,
    Plane,
    Heart,
} from "lucide-react";

const LUCIDE_CDN_BASE = "https://cdn.jsdelivr.net/npm/lucide-static@0.517.0";

/**
 * Convert PascalCase to kebab-case for CDN URLs
 */
function pascalToKebab(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
        .toLowerCase();
}

/**
 * Curated map of available icon names to Lucide components — covers every
 * icon slug actually assigned to a category in prod. Icon names stored in
 * the DB should be PascalCase (e.g., "Car", "ShoppingBag").
 */
export const iconMap: Record<string, LucideIcon> = {
    // Core category icons
    Car, Home, Smartphone, Armchair, Wrench, Shirt, Dumbbell, Briefcase,
    Watch, Book, PawPrint, Palette, CalendarClock, Baby, Gamepad2, LayoutGrid,
    // Extended icons for common categories
    Music, Camera, Utensils, Plane, Heart,
};

/**
 * Get category icon component from database icon name.
 * Falls back to LayoutGrid if icon is not found or not provided.
 *
 * @param icon - Icon name from database (PascalCase, e.g., "Car", "ShoppingBag")
 * @returns Lucide icon component
 */
export const getCategoryIcon = (icon?: string): LucideIcon => {
    if (icon && iconMap[icon]) {
        return iconMap[icon];
    }
    return LayoutGrid;
};

/**
 * Check if an icon exists in the pre-imported (curated) map
 */
export const hasIcon = (icon: string): boolean => {
    return icon in iconMap;
};

/**
 * Get CDN URL for an icon SVG (for fallback rendering)
 * @param icon - Icon name in PascalCase
 */
export const getIconCdnUrl = (icon: string): string => {
    const kebabName = pascalToKebab(icon);
    return `${LUCIDE_CDN_BASE}/icons/${kebabName}.svg`;
};

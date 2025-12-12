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
    LayoutGrid,
    LucideIcon
} from "lucide-react";

// Map of icon names to Lucide components
export const categoryIcons: Record<string, LucideIcon> = {
    // By slug (backward compatibility)
    "vehicles": Car,
    "real-estate": Home,
    "electronics": Smartphone,
    "home-garden": Armchair,
    "services": Wrench,
    "fashion": Shirt,
    "sports": Dumbbell,
    "jobs": Briefcase,
    "temporary-hire": Briefcase,
    "personal-items": Watch,
    "books-media": Book,
    "pets-animals": PawPrint,

    // By icon name (for database-driven icons)
    "Car": Car,
    "Home": Home,
    "Smartphone": Smartphone,
    "Armchair": Armchair,
    "Wrench": Wrench,
    "Shirt": Shirt,
    "Dumbbell": Dumbbell,
    "Briefcase": Briefcase,
    "Watch": Watch,
    "Book": Book,
    "PawPrint": PawPrint,
};

/**
 * Get category icon component
 * @param slug - Category slug (for backward compatibility)
 * @param icon - Optional icon name from database (takes precedence)
 * @returns Lucide icon component
 */
export const getCategoryIcon = (slug: string, icon?: string): LucideIcon => {
    // If icon is provided from database, try to use it first
    if (icon && categoryIcons[icon]) {
        return categoryIcons[icon];
    }

    // Fall back to slug-based mapping
    return categoryIcons[slug] || LayoutGrid;
};

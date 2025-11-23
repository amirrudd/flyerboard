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

export const categoryIcons: Record<string, LucideIcon> = {
    "vehicles": Car,
    "real-estate": Home,
    "electronics": Smartphone,
    "home-garden": Armchair,
    "services": Wrench,
    "fashion": Shirt,
    "sports": Dumbbell,
    "jobs": Briefcase,
    "personal-items": Watch,
    "books-media": Book,
    "pets-animals": PawPrint,
};

export const getCategoryIcon = (slug: string): LucideIcon => {
    return categoryIcons[slug] || LayoutGrid;
};

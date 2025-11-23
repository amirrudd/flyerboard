import { Id } from "../../../convex/_generated/dataModel";
import { memo } from "react";
import { LayoutGrid } from "lucide-react";
import { getCategoryIcon } from "../../lib/categoryIcons";

interface Category {
  _id: Id<"categories">;
  name: string;
  slug: string;
  parentId?: Id<"categories">;
}

interface SidebarProps {
  sidebarCollapsed: boolean;
  categories: Category[];
  selectedCategory: Id<"categories"> | null;
  setSelectedCategory: (categoryId: Id<"categories"> | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const Sidebar = memo(function Sidebar({
  sidebarCollapsed,
  categories,
  selectedCategory,
  setSelectedCategory,
  setSidebarCollapsed,
}: SidebarProps) {
  return (
    <div className="w-full">
      <h3 className="font-medium text-sm text-gray-500 mb-4 px-2">Categories</h3>
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 text-sm font-medium flex items-center gap-3 ${!selectedCategory
            ? 'text-primary-700 bg-primary-50'
            : 'text-gray-700 hover:bg-gray-100'
            }`}
        >
          <LayoutGrid className={`w-5 h-5 ${!selectedCategory ? "text-primary-700" : "text-gray-500"}`} />
          All Categories
        </button>
        {categories.map((category) => {
          const Icon = getCategoryIcon(category.slug);
          const isSelected = selectedCategory === category._id;
          return (
            <button
              type="button"
              key={category._id}
              onClick={() => setSelectedCategory(category._id)}
              className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 text-sm font-medium flex items-center gap-3 ${isSelected
                ? 'text-primary-700 bg-primary-50'
                : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              <Icon className={`w-5 h-5 ${isSelected ? "text-primary-700" : "text-gray-500"}`} />
              <span className="truncate">{category.name}</span>
            </button>
          );
        })}
      </div>

      <div className="my-4 border-t border-gray-200"></div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 px-2">
        {[
          { label: "About Us", href: "#" },
          { label: "Support", href: "#" },
          { label: "Terms & Conditions", href: "/terms" },
          { label: "Privacy Policy", href: "/terms#privacy" },
          { label: "Community Guidelines", href: "/community-guidelines" },
          { label: "Contact", href: "#" },
        ].map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="text-xs text-gray-500 hover:text-gray-900 transition-colors duration-200"
          >
            {link.label}
          </a>
        ))}
      </div>
      <div className="px-2 pt-4 text-[10px] text-gray-400">
        © 2025 FlyerBoard
      </div>
    </div>
  );
});

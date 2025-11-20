import { Id } from "../../../convex/_generated/dataModel";
import { memo } from "react";

interface Category {
  _id: Id<"categories">;
  name: string;
  icon: string;
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
          <span className="text-lg">📋</span>
          All Categories
        </button>
        {categories.map((category) => (
          <button
            type="button"
            key={category._id}
            onClick={() => setSelectedCategory(category._id)}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 text-sm font-medium flex items-center gap-3 ${selectedCategory === category._id
              ? 'text-primary-700 bg-primary-50'
              : 'text-gray-700 hover:bg-gray-100'
              }`}
          >
            <span className="text-lg opacity-80">{category.icon}</span>
            <span className="truncate">{category.name}</span>
          </button>
        ))}
      </div>

      <div className="my-4 border-t border-gray-200"></div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 px-2">
        {[
          { label: "About Us", href: "#" },
          { label: "Support", href: "#" },
          { label: "Terms & Conditions", href: "/terms#terms" },
          { label: "Privacy Policy", href: "/terms#privacy" },
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

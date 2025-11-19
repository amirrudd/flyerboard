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
    <div className={`sidebar-transition flex-shrink-0 ${sidebarCollapsed
        ? 'w-0 md:w-16 overflow-hidden md:overflow-visible'
        : 'w-full md:w-80'
      }`}>
      <div className={`bg-white border border-gray-200 rounded-lg sticky top-20 sm:top-24 ${sidebarCollapsed ? 'p-2 md:p-4' : 'p-3 sm:p-4'
        } ${!sidebarCollapsed ? 'md:border md:border-gray-200' : ''}`}>

        {/* Sidebar Toggle Button - Desktop Only */}
        <div className="hidden md:flex justify-end mb-4">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-[#FF6600]"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            <h3 className="font-semibold text-[#333333] mb-4">Categories</h3>
            <div className="space-y-2 mb-6">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2.5 sm:py-2 rounded-lg transition-colors duration-200 text-sm sm:text-base ${!selectedCategory
                    ? 'bg-[#FF6600] text-white'
                    : 'hover:bg-gray-100'
                  }`}
              >
                All Categories
              </button>
              {categories.map((category) => (
                <button
                  type="button"
                  key={category._id}
                  onClick={() => setSelectedCategory(category._id)}
                  className={`w-full text-left px-3 py-2.5 sm:py-2 rounded-lg transition-colors duration-200 flex items-center gap-3 text-sm sm:text-base ${selectedCategory === category._id
                      ? 'bg-[#FF6600] text-white'
                      : 'hover:bg-gray-100'
                    }`}
                >
                  <span className="text-lg">{category.icon}</span>
                  <span className="truncate">{category.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {sidebarCollapsed && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`w-full p-2 rounded-lg transition-colors duration-200 ${!selectedCategory
                  ? 'bg-[#FF6600] text-white'
                  : 'hover:bg-gray-100'
                }`}
              title="All Categories"
            >
              📋
            </button>
            {categories.map((category) => (
              <button
                type="button"
                key={category._id}
                onClick={() => setSelectedCategory(category._id)}
                className={`w-full p-2 rounded-lg transition-colors duration-200 ${selectedCategory === category._id
                    ? 'bg-[#FF6600] text-white'
                    : 'hover:bg-gray-100'
                  }`}
                title={category.name}
              >
                {category.icon}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

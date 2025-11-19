import { Id } from "../../../convex/_generated/dataModel";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Ad {
  _id: Id<"ads">;
  title: string;
  description: string;
  price: number;
  location: string;
  categoryId: Id<"categories">;
  images: string[];
  userId: Id<"users">;
  isActive: boolean;
  views: number;
}

interface Category {
  _id: Id<"categories">;
  name: string;
  icon: string;
  slug: string;
  parentId?: Id<"categories">;
}

interface AdsGridProps {
  ads: Ad[];
  categories: Category[];
  selectedCategory: Id<"categories"> | null;
  sidebarCollapsed: boolean;
  onAdClick: (adId: Id<"ads">) => void;
}

export const AdsGrid = memo(function AdsGrid({
  ads,
  categories,
  selectedCategory,
  sidebarCollapsed,
  onAdClick,
}: AdsGridProps) {

  return (
    <div className="flex-1">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#333333] mb-2">
          {selectedCategory
            ? categories.find(c => c._id === selectedCategory)?.name
            : 'All Listings'
          }
        </h2>
        <p className="text-gray-600">{ads.length} listings found</p>
      </div>

      {/* Ads Grid with Framer Motion */}
      <motion.div
        layout
        className={`ads-grid grid gap-3 sm:gap-4 ${sidebarCollapsed
          ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}
      >
        <AnimatePresence mode="popLayout">
          {ads.map((ad) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              key={ad._id}
              onClick={() => onAdClick(ad._id)}
              className="bg-white border border-neutral-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer group"
            >
              <div className="aspect-video bg-gray-100 overflow-hidden relative">
                <ImageDisplay
                  src={ad.images[0] || ''}
                  alt={ad.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {ad.images.length > 1 && (
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                    +{ad.images.length - 1} more
                  </div>
                )}
              </div>
              <div className="p-3 sm:p-4">
                <h3 className="font-semibold text-[#333333] mb-2 line-clamp-2 group-hover:text-[#FF6600] transition-colors">
                  {ad.title}
                </h3>
                <p className="text-lg font-bold text-[#FF6600] mb-2">
                  ${ad.price.toLocaleString()} AUD
                </p>
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {ad.description}
                </p>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{ad.location}</span>
                  <span>{ad.views} views</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {ads.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-[#333333] mb-2">No listings found</h3>
          <p className="text-gray-600">Please adjust your filters or try a new search</p>
        </motion.div>
      )}
    </div>
  );
});

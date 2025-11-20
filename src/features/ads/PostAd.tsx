import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ImageUpload } from "../../components/ui/ImageUpload";
import { ImageDisplay } from "../../components/ui/ImageDisplay";

interface PostAdProps {
  onBack: () => void;
  editingAd?: any;
}

export function PostAd({ onBack, editingAd }: PostAdProps) {
  const [formData, setFormData] = useState({
    title: editingAd?.title || "",
    description: editingAd?.description || "",
    extendedDescription: editingAd?.extendedDescription || "",
    price: editingAd?.price || "",
    location: editingAd?.location || "",
    categoryId: editingAd?.categoryId || "",
  });

  const [images, setImages] = useState<string[]>(editingAd?.images || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = useQuery(api.categories.getCategories);
  const createAd = useMutation(api.posts.createAd);
  const updateAd = useMutation(api.posts.updateAd);

  const locations = [
    "Sydney, CBD",
    "Sydney, Northern Beaches",
    "Melbourne, CBD",
    "Melbourne, South Yarra",
    "Brisbane, South Bank",
    "Brisbane, Fortitude Valley",
    "Perth, Fremantle",
    "Perth, Subiaco",
    "Adelaide, CBD",
    "Gold Coast, Surfers Paradise",
    "Canberra, City Centre",
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description || !formData.price || !formData.location || !formData.categoryId) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (images.length === 0) {
      toast.error("Please add at least one image");
      return;
    }

    setIsSubmitting(true);

    try {
      const adData = {
        title: formData.title,
        description: formData.description,
        extendedDescription: formData.extendedDescription || undefined,
        price: parseFloat(formData.price),
        location: formData.location,
        categoryId: formData.categoryId as Id<"categories">,
        images: images,
      };

      if (editingAd) {
        await updateAd({
          adId: editingAd._id,
          ...adData,
        });
        toast.success("Ad updated successfully!");
      } else {
        await createAd(adData);
        toast.success("Ad posted successfully!");
      }

      onBack();
    } catch (error: any) {
      toast.error(error.message || "Failed to save ad");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="text-xl font-semibold text-neutral-800">
              {editingAd ? "Edit Listing" : "Post New Listing"}
            </h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-800 mb-4">Basic Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-primary-600 focus:ring-1 focus:ring-primary-600 outline-none transition-colors"
                  placeholder="Enter a descriptive title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Category *
                </label>
                <select
                  name="categoryId"
                  value={formData.categoryId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-primary-600 focus:ring-1 focus:ring-primary-600 outline-none transition-colors"
                  required
                >
                  <option value="">Select a category</option>
                  {(categories || []).map((category: any) => (
                    <option key={category._id} value={category._id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Price (AUD) *
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-primary-600 focus:ring-1 focus:ring-primary-600 outline-none transition-colors"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Location *
                </label>
                <select
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-primary-600 focus:ring-1 focus:ring-primary-600 outline-none transition-colors"
                  required
                >
                  <option value="">Select a location</option>
                  {locations.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-primary-600 focus:ring-1 focus:ring-primary-600 outline-none transition-colors"
                placeholder="Describe your item..."
                required
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Extended Description
              </label>
              <textarea
                name="extendedDescription"
                value={formData.extendedDescription}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-primary-600 focus:ring-1 focus:ring-primary-600 outline-none transition-colors"
                placeholder="Additional details (optional)..."
              />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-800 mb-4">Images *</h2>
            <ImageUpload
              images={images}
              onImagesChange={setImages}
              maxImages={10}
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 px-6 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-100 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || images.length === 0}
              className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Saving..." : (editingAd ? "Update Listing" : "Post Listing")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

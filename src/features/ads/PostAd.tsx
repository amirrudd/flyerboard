import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ImageUpload } from "../../components/ui/ImageUpload";
import { searchLocations, formatLocation, LocationData } from "../../lib/locationService";
import { getCategoryIcon } from "../../lib/categoryIcons";
import { Header } from "../layout/Header";

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
  const [selectedFiles, setSelectedFiles] = useState<Array<{ dataUrl: string, type: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);

  // Location search state
  const [locationQuery, setLocationQuery] = useState(editingAd?.location || "");
  const [locationSuggestions, setLocationSuggestions] = useState<LocationData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const locationWrapperRef = useRef<HTMLDivElement>(null);
  const categoryWrapperRef = useRef<HTMLDivElement>(null);

  const categories = useQuery(api.categories.getCategories);
  const createAd = useMutation(api.posts.createAd);
  const updateAd = useMutation(api.posts.updateAd);
  const uploadListingImage = useAction(api.image_actions.uploadListingImage);

  // Handle location search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (locationQuery.length >= 2) {
        setIsSearchingLocation(true);
        try {
          const results = await searchLocations(locationQuery);
          setLocationSuggestions(results);
          setShowSuggestions(true);
        } catch (error) {
          console.error("Failed to search locations", error);
        } finally {
          setIsSearchingLocation(false);
        }
      } else {
        setLocationSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [locationQuery]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationWrapperRef.current && !locationWrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (categoryWrapperRef.current && !categoryWrapperRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLocationSelect = (location: LocationData) => {
    const formatted = formatLocation(location);
    setFormData(prev => ({ ...prev, location: formatted }));
    setLocationQuery(formatted);
    setShowSuggestions(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCancel = () => {
    onBack();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description || !formData.price || !formData.location || !formData.categoryId) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate that location is selected from list (or at least matches the format roughly, though strict validation is better)
    // For now, we rely on the user selecting from the list or typing a valid string. 
    // To enforce selection, we could clear formData.location if it doesn't match a selection, 
    // but since we allow free text in the original requirement "type in their suburb", 
    // we should probably allow it but strongly encourage selection.
    // However, the requirement says "User must select from list to be able to proceed."
    // So we should probably enforce that the current query matches the selected location.
    // But since we store it as a string, it's hard to enforce without keeping the selected object.
    // Let's assume if they typed it and it's in the input, it's fine, but the UI encourages selection.
    // Actually, let's enforce it by checking if the current query matches the stored location.
    if (formData.location !== locationQuery) {
      // This happens if they typed something but didn't select. 
      // Or if they modified it after selecting.
      // We should probably force them to select.
      // But for better UX, if they typed a valid location manually, maybe let it slide?
      // "User must select from list to be able to proceed." -> Strict requirement.
      // So we should clear location if they type something new.
      // Let's implement a check: if locationQuery is not equal to formData.location, it means they changed it without selecting.
      // So we set location to empty string in that case? 
      // Better: update formData.location only on select.
    }

    if (images.length === 0) {
      toast.error("Please add at least one image");
      return;
    }

    setIsSubmitting(true);
    setProgressPercent(0);

    try {
      if (editingAd) {
        // Editing existing ad - upload new images if any
        setUploadProgress("Updating ad...");
        setProgressPercent(20);

        let finalImages = [...images];

        if (selectedFiles.length > 0) {
          setUploadProgress(`Uploading ${selectedFiles.length} new image(s)...`);
          setProgressPercent(40);

          for (let i = 0; i < selectedFiles.length; i++) {
            setUploadProgress(`Uploading image ${i + 1}/${selectedFiles.length}...`);
            setProgressPercent(40 + (i / selectedFiles.length) * 40);

            const ref = await uploadListingImage({
              postId: editingAd._id,
              base64Data: selectedFiles[i].dataUrl,
              contentType: selectedFiles[i].type,
            });
            finalImages.push(ref);
          }
        }

        setUploadProgress("Saving changes...");
        setProgressPercent(90);

        await updateAd({
          adId: editingAd._id,
          title: formData.title,
          description: formData.description,
          extendedDescription: formData.extendedDescription || undefined,
          price: parseFloat(formData.price),
          location: formData.location,
          categoryId: formData.categoryId as Id<"categories">,
          images: finalImages,
        });

        setProgressPercent(100);
        toast.success("Ad updated successfully!");
      } else {
        // Creating new ad - 3-step process
        setUploadProgress("Creating ad...");
        setProgressPercent(10);

        const adId = await createAd({
          title: formData.title,
          description: formData.description,
          extendedDescription: formData.extendedDescription || undefined,
          price: parseFloat(formData.price),
          location: formData.location,
          categoryId: formData.categoryId as Id<"categories">,
          images: [], // Empty initially
        });

        // Step 2: Upload images to R2
        setUploadProgress("Uploading images...");
        const uploadedRefs: string[] = [];

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];

          try {
            const ref = await uploadListingImage({
              postId: adId,
              base64Data: file.dataUrl,
              contentType: file.type,
            });

            uploadedRefs.push(ref);

            // Update progress AFTER successful upload
            setUploadProgress(`Uploaded ${i + 1}/${selectedFiles.length} images`);
            setProgressPercent(20 + ((i + 1) / selectedFiles.length) * 60); // Adjusting for overall progress
          } catch (error) {
            console.error(`Failed to upload image ${i + 1}:`, error);
            toast.error(`Failed to upload image ${i + 1}`);
            throw error;
          }
        }

        setUploadProgress("Finalizing...");
        setProgressPercent(90);

        // Update ad with images
        await updateAd({
          adId,
          title: formData.title,
          description: formData.description,
          extendedDescription: formData.extendedDescription || undefined,
          price: parseFloat(formData.price),
          location: formData.location,
          categoryId: formData.categoryId as Id<"categories">,
          images: uploadedRefs,
        });

        setProgressPercent(100);
        toast.success("Ad posted successfully!");
      }

      onBack();
    } catch (error: any) {
      toast.error(error.message || "Failed to save ad");
    } finally {
      setIsSubmitting(false);
      setUploadProgress("");
      setProgressPercent(0);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100">
      <Header
        leftNode={
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        }
        centerNode={
          <h1 className="text-xl font-semibold text-neutral-800">
            {editingAd ? "Edit Listing" : "Post New Listing"}
          </h1>
        }
        rightNode={
          <div className="w-20"></div>
        }
      />

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
                <div className="relative" ref={categoryWrapperRef}>
                  <button
                    type="button"
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-primary-600 focus:ring-1 focus:ring-primary-600 outline-none transition-colors text-left flex items-center justify-between bg-white"
                  >
                    {formData.categoryId ? (
                      <span className="flex items-center gap-2">
                        {(() => {
                          const cat = categories?.find(c => c._id === formData.categoryId);
                          if (!cat) return "Select a category";
                          const Icon = getCategoryIcon(cat.slug);
                          return (
                            <>
                              <Icon className="w-4 h-4 text-neutral-500" />
                              {cat.name}
                            </>
                          );
                        })()}
                      </span>
                    ) : (
                      <span className="text-neutral-500">Select a category</span>
                    )}
                    <svg className={`w-5 h-5 text-neutral-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showCategoryDropdown && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {(categories || []).map((category: any) => {
                        const Icon = getCategoryIcon(category.slug);
                        return (
                          <button
                            key={category._id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, categoryId: category._id }));
                              setShowCategoryDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 transition-colors flex items-center gap-3"
                          >
                            <Icon className="w-4 h-4 text-neutral-500" />
                            <span className="font-medium text-neutral-700">{category.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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

              <div className="relative" ref={locationWrapperRef}>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Location *
                </label>
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => {
                    setLocationQuery(e.target.value);
                    // If user types, invalidate the selected location until they select again
                    // But we keep the formData.location as is until submit check? 
                    // Or we clear it? Let's clear it to enforce selection.
                    if (formData.location && e.target.value !== formData.location) {
                      setFormData(prev => ({ ...prev, location: "" }));
                    }
                  }}
                  onFocus={() => {
                    if (locationSuggestions.length > 0) setShowSuggestions(true);
                  }}
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${!formData.location && locationQuery.length > 0 ? "border-amber-500 focus:border-amber-500 focus:ring-amber-500" : "border-neutral-300 focus:border-primary-600 focus:ring-primary-600"
                    }`}
                  placeholder="Enter suburb or postcode"
                  required
                />
                {isSearchingLocation && (
                  <div className="absolute right-3 top-[38px]">
                    <svg className="w-4 h-4 animate-spin text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                )}

                {showSuggestions && locationSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {locationSuggestions.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleLocationSelect(loc)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 transition-colors flex items-center justify-between group"
                      >
                        <span className="font-medium text-neutral-700 group-hover:text-neutral-900">{loc.locality}</span>
                        <span className="text-neutral-400 text-xs group-hover:text-neutral-500">{loc.state} {loc.postcode}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!formData.location && locationQuery.length > 0 && !isSearchingLocation && (
                  <p className="text-xs text-amber-600 mt-1">Please select a location from the list</p>
                )}
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
              onFilesSelected={setSelectedFiles}
              maxImages={5}
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-6 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-100 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || images.length === 0 || !formData.location}
              className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Saving..." : (editingAd ? "Update Listing" : "Post Listing")}
            </button>
          </div>
        </form>
      </div>

      {/* Progress Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
              <h3 className="text-xl font-semibold text-gray-900">
                {editingAd ? 'Updating Ad...' : 'Creating Ad...'}
              </h3>
            </div>

            <p className="text-gray-600 mb-4 text-center">{uploadProgress}</p>

            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary-600 h-3 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="text-sm text-gray-500 mt-3 text-center">
              {progressPercent}% complete
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

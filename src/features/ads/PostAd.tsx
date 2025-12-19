import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ImageUpload } from "../../components/ui/ImageUpload";
import { CircularProgress } from "../../components/ui/CircularProgress";
import { searchLocations, formatLocation, LocationData } from "../../lib/locationService";
import { getCategoryIcon } from "../../lib/categoryIcons";
import { Header } from "../layout/Header";
import { uploadImageToR2 } from "../../lib/uploadToR2";
import { ChevronLeft, Trash2, ChevronDown, Loader2, AlertTriangle } from "lucide-react";
import { ContextualNotificationModal } from "../../components/notifications/ContextualNotificationModal";

interface ImageState {
  id: string;
  preview: string;
  file: File;
  compressed: File | null;
  status: 'compressing' | 'ready' | 'error';
  error?: string;
}

interface PostAdProps {
  onBack: () => void;
  editingAd?: any;
  origin?: string;
}

export function PostAd({ onBack, editingAd, origin = '/' }: PostAdProps) {
  const [formData, setFormData] = useState({
    title: editingAd?.title || "",
    description: editingAd?.description || "",
    extendedDescription: editingAd?.extendedDescription || "",
    price: editingAd?.price || "",
    location: editingAd?.location || "",
    categoryId: editingAd?.categoryId || "",
  });

  const [images, setImages] = useState<string[]>(editingAd?.images || []);
  const [imageStates, setImageStates] = useState<Map<string, ImageState>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaitingForCompression, setIsWaitingForCompression] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

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
  const deleteAd = useMutation(api.posts.deleteAd);
  const generateListingUploadUrl = useAction(api.upload_urls.generateListingUploadUrl);

  // Scroll to top when component mounts (especially important for edit mode)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

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

  const handleDelete = async () => {
    if (!editingAd) return;

    setIsSubmitting(true);
    try {
      await deleteAd({ adId: editingAd._id });
      toast.success("Flyer deleted successfully!");
      onBack();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete flyer");
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
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

    // Check if any images are still compressing
    const states = Array.from(imageStates.values());
    const compressingImages = states.filter(s => s.status === 'compressing');

    if (compressingImages.length > 0) {
      setIsWaitingForCompression(true);

      // Wait for all compressions to complete
      const checkInterval = setInterval(() => {
        const currentStates = Array.from(imageStates.values());
        const stillCompressing = currentStates.filter(s => s.status === 'compressing');
        const total = currentStates.length;
        const completed = total - stillCompressing.length;

        setCompressionProgress(Math.round((completed / total) * 100));

        if (stillCompressing.length === 0) {
          clearInterval(checkInterval);
          setIsWaitingForCompression(false);
          // Proceed with upload
          performUpload();
        }
      }, 100);

      return;
    }

    // All images ready, proceed immediately
    await performUpload();
  };

  const performUpload = async () => {

    setIsSubmitting(true);
    setProgressPercent(0);

    // Get compressed files from imageStates
    const compressedFiles: File[] = [];
    const states = Array.from(imageStates.values());

    for (const state of states) {
      if (state.status === 'ready' && state.compressed) {
        compressedFiles.push(state.compressed);
      } else if (state.status === 'error') {
        toast.error('Some images failed to compress. Please remove and re-add them.');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      if (editingAd) {
        // Editing existing flyer - upload new images if any
        setUploadProgress("Updating flyer...");
        setProgressPercent(20);

        // Keep track of existing image keys (from database)
        // Filter to only include images that haven't been removed by user
        const existingImageKeys = (editingAd.images || []).filter((imgKey: string) =>
          images.includes(imgKey)
        );
        const newImageKeys: string[] = [];

        // Upload new compressed images only
        if (compressedFiles.length > 0) {
          setUploadProgress(`Uploading ${compressedFiles.length} new image(s)...`);
          setProgressPercent(40);

          for (let i = 0; i < compressedFiles.length; i++) {
            setUploadProgress(`Uploading image ${i + 1}/${compressedFiles.length}...`);
            const baseProgress = 40 + (i / compressedFiles.length) * 40;

            // Get presigned URL for this image
            const { url: uploadUrl, key } = await generateListingUploadUrl({ postId: editingAd._id });

            // Upload directly to R2 (already compressed)
            await uploadImageToR2(
              compressedFiles[i],
              async () => uploadUrl,
              async () => null,
              (percent) => setProgressPercent(baseProgress + (percent / 100) * (40 / compressedFiles.length))
            );

            newImageKeys.push(key);
          }
        }

        setUploadProgress("Saving changes...");
        setProgressPercent(90);

        // Combine existing keys with new keys
        const finalImages = [...existingImageKeys, ...newImageKeys];

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
        toast.success("Flyer updated successfully!");
      } else {
        // Creating new ad - 3-step process
        setUploadProgress("Creating flyer...");
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

        // Step 2: Upload compressed images directly to R2
        setUploadProgress("Uploading images...");
        const uploadedRefs: string[] = [];

        for (let i = 0; i < compressedFiles.length; i++) {
          try {
            const baseProgress = 20 + (i / compressedFiles.length) * 60;
            setUploadProgress(`Uploading image ${i + 1}/${compressedFiles.length}...`);

            // Get presigned URL for this image
            const { url: uploadUrl, key } = await generateListingUploadUrl({ postId: adId });

            // Upload directly to R2 with progress tracking (already compressed)
            await uploadImageToR2(
              compressedFiles[i],
              async () => uploadUrl,
              async () => null, // No metadata sync needed
              (percent) => setProgressPercent(baseProgress + (percent / 100) * (60 / compressedFiles.length))
            );

            uploadedRefs.push(key);
            setUploadProgress(`Uploaded ${i + 1}/${compressedFiles.length} images`);
          } catch (error) {
            console.error(`Failed to upload image ${i + 1}:`, error);
            toast.error(`Failed to upload image ${i + 1}`);
            throw error;
          }
        }

        setUploadProgress("Finalizing...");
        setProgressPercent(90);

        // Update flyer with images
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
        toast.success("Flyer posted successfully!");

        // Show notification permission modal for new posts (not edits)
        setShowNotificationModal(true);
      }

      // Don't call onBack() immediately - let modal show first
      // Modal will call onBack when it closes
      if (editingAd) {
        onBack();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save flyer");
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
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Back</span>
          </button>
        }
        centerNode={
          <h1 className="text-xl font-semibold text-neutral-800">
            {editingAd ? "Edit Flyer" : "Pin New Flyer"}
          </h1>
        }
        rightNode={
          editingAd ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 transition-colors font-medium"
              disabled={isSubmitting}
            >
              <Trash2 className="w-5 h-5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          ) : (
            <div className="w-20"></div>
          )
        }
      />

      <div className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-bottom-nav md:pb-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-800 mb-4">Basic Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  maxLength={100}
                  autoComplete="off"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-primary-600 focus:ring-1 focus:ring-primary-600 outline-none transition-colors"
                  placeholder="Enter a descriptive title"
                  required
                />
                <div className="min-h-[20px] mt-1">
                  {/* Reserved space for support text */}
                </div>
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
                    <ChevronDown className={`w-5 h-5 text-neutral-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
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
                <div className="min-h-[20px] mt-1">
                  {/* Reserved space for support text */}
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
                  max="999999999"
                  step="0.01"
                  required
                />
                <div className="min-h-[20px] mt-1">
                  {/* Reserved space for support text */}
                </div>
              </div>

              <div className="relative" ref={locationWrapperRef}>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Location *
                </label>
                <input
                  type="text"
                  value={locationQuery}
                  maxLength={100}
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
                    <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
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
                <div className="min-h-[20px] mt-1">
                  {!formData.location && locationQuery.length > 0 && !isSearchingLocation ? (
                    <p className="text-xs text-amber-600">Please select a location from the list</p>
                  ) : null}
                </div>
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
                maxLength={500}
                rows={4}
                autoComplete="off"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-primary-600 focus:ring-1 focus:ring-primary-600 outline-none transition-colors"
                placeholder="Describe your item..."
                required
              />
              <div className="min-h-[20px] mt-1">
                <p className="text-xs text-neutral-400 text-right">
                  {formData.description.length} / 500 characters
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Extended Description
              </label>
              <textarea
                name="extendedDescription"
                value={formData.extendedDescription}
                onChange={handleInputChange}
                maxLength={2000}
                rows={3}
                autoComplete="off"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-primary-600 focus:ring-1 focus:ring-primary-600 outline-none transition-colors"
                placeholder="Additional details (optional)..."
              />
              <div className="min-h-[20px] mt-1">
                <p className="text-xs text-neutral-400 text-right">
                  {formData.extendedDescription.length} / 2000 characters
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-800 mb-4">Images *</h2>
            <ImageUpload
              images={images}
              onImagesChange={setImages}
              onCompressionStateChange={setImageStates}
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
              {isSubmitting ? "Saving..." : (editingAd ? "Update Flyer" : "Pin Flyer")}
            </button>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Flyer</h3>
                <p className="text-gray-600 text-sm">
                  Are you sure you want to delete this flyer? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-100 font-medium transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Compression Wait Modal */}
      {isWaitingForCompression && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex flex-col items-center">
              <CircularProgress progress={compressionProgress} size={140} strokeWidth={10}>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600">{compressionProgress}%</div>
                  <div className="text-xs text-gray-500 mt-1">Compressing</div>
                </div>
              </CircularProgress>

              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">
                Optimizing Images
              </h3>
              <p className="text-gray-600 text-center text-sm">
                Please wait while we compress your images for faster uploads...
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Upload Progress Overlay */}
      {isSubmitting && !showDeleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex flex-col items-center">
              <CircularProgress progress={progressPercent} size={140} strokeWidth={10}>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600">{progressPercent}%</div>
                  <div className="text-xs text-gray-500 mt-1">Uploading</div>
                </div>
              </CircularProgress>

              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">
                {editingAd ? 'Updating Flyer' : 'Pinning Flyer'}
              </h3>
              <p className="text-gray-600 text-center text-sm">
                {uploadProgress}
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Contextual Notification Modal */}
      <ContextualNotificationModal
        context="post-flyer"
        isOpen={showNotificationModal}
        onClose={() => {
          setShowNotificationModal(false);
          onBack();
        }}
      />
    </div>
  );
}

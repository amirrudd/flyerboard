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
import { ChevronLeft, Trash2, ChevronDown, Loader2, AlertTriangle, DollarSign, Repeat, Handshake } from "lucide-react";
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
    listingType: (editingAd?.listingType || "sale") as "sale" | "exchange" | "both",
    price: editingAd?.price?.toString() || "",
    exchangeDescription: editingAd?.exchangeDescription || "",
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

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Allow empty string (for clearing the field)
    if (value === '') {
      setFormData(prev => ({ ...prev, price: '' }));
      return;
    }

    // Only allow whole numbers (no decimals, no leading zeros except for "0")
    // Regex: ^[1-9]\d*$ (starts with 1-9, followed by any digits) OR ^0$ (just "0")
    const wholeNumberRegex = /^(0|[1-9]\d*)$/;

    if (wholeNumberRegex.test(value)) {
      const numValue = parseInt(value, 10);
      // Check max value
      if (numValue <= 999999999) {
        setFormData(prev => ({ ...prev, price: value }));
      }
    }
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

    // Price is only required for "sale" and "both" listing types
    const needsPrice = formData.listingType === "sale" || formData.listingType === "both";
    if (!formData.title || !formData.description || !formData.location || !formData.categoryId) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (needsPrice && !formData.price) {
      toast.error("Please enter a price for sale listings");
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
          listingType: formData.listingType,
          price: formData.price ? parseFloat(formData.price) : undefined,
          exchangeDescription: formData.exchangeDescription || undefined,
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
          listingType: formData.listingType,
          price: formData.price ? parseFloat(formData.price) : undefined,
          exchangeDescription: formData.exchangeDescription || undefined,
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
          listingType: formData.listingType,
          price: formData.price ? parseFloat(formData.price) : undefined,
          exchangeDescription: formData.exchangeDescription || undefined,
          location: formData.location,
          categoryId: formData.categoryId as Id<"categories">,
          images: uploadedRefs,
        });

        setProgressPercent(100);
        toast.success("Flyer posted successfully!");

        // Show notification permission modal for new posts (not edits)
        setShowNotificationModal(true);
      }

      // For edits, navigate back immediately
      // For new posts, let modal handle navigation (it will call onBack)
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
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        leftNode={
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Back</span>
          </button>
        }
        centerNode={
          <h1 className="text-xl font-semibold text-foreground">
            {editingAd ? "Edit Flyer" : "Pin New Flyer"}
          </h1>
        }
        rightNode={
          editingAd ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 text-destructive hover:opacity-80 transition-colors font-medium"
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

      <div className="flex-1 max-w-3xl mx-auto container-padding py-8 pb-bottom-nav md:pb-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">Basic Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  maxLength={100}
                  autoComplete="off"
                  className="w-full px-3 py-2 border border-input rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors bg-background text-foreground placeholder:text-muted-foreground"
                  placeholder="Enter a descriptive title"
                  required
                />
                <div className="min-h-[20px] mt-1">
                  {/* Reserved space for support text */}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Category *
                </label>
                <div className="relative" ref={categoryWrapperRef}>
                  <button
                    type="button"
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors text-left flex items-center justify-between bg-background text-foreground"
                  >
                    {formData.categoryId ? (
                      <span className="flex items-center gap-2">
                        {(() => {
                          const cat = categories?.find(c => c._id === formData.categoryId);
                          if (!cat) return "Select a category";
                          const Icon = getCategoryIcon(cat.icon);
                          return (
                            <>
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              {cat.name}
                            </>
                          );
                        })()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Select a category</span>
                    )}
                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showCategoryDropdown && (
                    <div className="absolute z-20 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {(categories || []).map((category: any) => {
                        const Icon = getCategoryIcon(category.icon);
                        return (
                          <button
                            key={category._id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, categoryId: category._id }));
                              setShowCategoryDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-3"
                          >
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-foreground">{category.name}</span>
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

              {/* Listing Type Selector */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Listing Type *
                </label>
                <div className="flex rounded-lg border border-input overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, listingType: "sale" }))}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${formData.listingType === "sale"
                      ? "bg-primary text-white"
                      : "bg-background text-muted-foreground hover:bg-accent"
                      }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>For Sale</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, listingType: "exchange", price: "" }))}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border-l border-r border-input transition-colors ${formData.listingType === "exchange"
                      ? "bg-primary text-white"
                      : "bg-background text-muted-foreground hover:bg-accent"
                      }`}
                  >
                    <Repeat className="w-4 h-4" />
                    <span>Exchange</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, listingType: "both" }))}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${formData.listingType === "both"
                      ? "bg-primary text-white"
                      : "bg-background text-muted-foreground hover:bg-accent"
                      }`}
                  >
                    <Handshake className="w-4 h-4" />
                    <span>Both</span>
                  </button>
                </div>
                <div className="min-h-[20px] mt-1">
                  <p className="text-xs text-muted-foreground">
                    {formData.listingType === "sale" && "List for sale at a fixed price"}
                    {formData.listingType === "exchange" && "Open to trading for other items"}
                    {formData.listingType === "both" && "Accept payment or trade offers"}
                  </p>
                </div>
              </div>

              {/* Price Field - conditional on listing type */}
              {(formData.listingType === "sale" || formData.listingType === "both") && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Price (AUD) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="price"
                    value={formData.price}
                    onChange={handlePriceChange}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors bg-background text-foreground placeholder:text-muted-foreground"
                    placeholder="0"
                    pattern="[0-9]*"
                    required
                  />
                  <div className="min-h-[20px] mt-1">
                    <p className="text-xs text-muted-foreground">Enter whole numbers only (no decimals)</p>
                  </div>
                </div>
              )}

              {/* Exchange Description - conditional on listing type */}
              {(formData.listingType === "exchange" || formData.listingType === "both") && (
                <div className={formData.listingType === "exchange" ? "col-span-1 md:col-span-2" : ""}>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    What are you looking for?
                  </label>
                  <textarea
                    name="exchangeDescription"
                    value={formData.exchangeDescription}
                    onChange={handleInputChange}
                    maxLength={500}
                    rows={2}
                    autoComplete="off"
                    className="w-full px-3 py-2 border border-input rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors bg-background text-foreground placeholder:text-muted-foreground"
                    placeholder="e.g., Looking for rare holographic Pokémon cards, Nintendo games..."
                  />
                  <div className="min-h-[20px] mt-1">
                    <p className="text-xs text-muted-foreground text-right">
                      {formData.exchangeDescription.length} / 500 characters
                    </p>
                  </div>
                </div>
              )}

              <div className="relative" ref={locationWrapperRef}>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
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
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors bg-background text-foreground placeholder:text-muted-foreground ${!formData.location && locationQuery.length > 0 ? "border-amber-500 focus:border-amber-500 focus:ring-amber-500" : "border-input focus:border-primary focus:ring-primary"
                    }`}
                  placeholder="Enter suburb or postcode"
                  required
                />
                {isSearchingLocation && (
                  <div className="absolute right-3 top-[38px]">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {showSuggestions && locationSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {locationSuggestions.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleLocationSelect(loc)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between group"
                      >
                        <span className="font-medium text-foreground group-hover:text-foreground">{loc.locality}</span>
                        <span className="text-muted-foreground text-xs group-hover:text-muted-foreground">{loc.state} {loc.postcode}</span>
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
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                maxLength={1500}
                rows={6}
                autoComplete="off"
                className="w-full px-3 py-2 border border-input rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors bg-background text-foreground placeholder:text-muted-foreground"
                placeholder="Describe your item..."
                required
              />
              <div className="min-h-[20px] mt-1">
                <p className="text-xs text-muted-foreground text-right">
                  {formData.description.length} / 1500 characters
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">Images *</h2>
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
              className="flex-1 px-6 py-3 border border-input text-foreground rounded-lg hover:bg-accent font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || images.length === 0 || !formData.location}
              className="flex-1 bg-primary text-white px-6 py-3 rounded-lg hover:opacity-90 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Saving..." : (editingAd ? "Update Flyer" : "Pin Flyer")}
            </button>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-2">Delete Flyer</h3>
                <p className="text-muted-foreground text-sm">
                  Are you sure you want to delete this flyer? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-input text-foreground rounded-lg hover:bg-accent font-medium transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-destructive text-white rounded-lg hover:opacity-90 font-medium transition-colors disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex flex-col items-center">
              <CircularProgress progress={compressionProgress} size={140} strokeWidth={10}>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{compressionProgress}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Compressing</div>
                </div>
              </CircularProgress>

              <h3 className="text-xl font-semibold text-foreground mt-6 mb-2">
                Optimizing Images
              </h3>
              <p className="text-muted-foreground text-center text-sm">
                Please wait while we compress your images for faster uploads...
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Upload Progress Overlay */}
      {isSubmitting && !showDeleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex flex-col items-center">
              <CircularProgress progress={progressPercent} size={140} strokeWidth={10}>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{progressPercent}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Uploading</div>
                </div>
              </CircularProgress>

              <h3 className="text-xl font-semibold text-foreground mt-6 mb-2">
                {editingAd ? 'Updating Flyer' : 'Pinning Flyer'}
              </h3>
              <p className="text-muted-foreground text-center text-sm">
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

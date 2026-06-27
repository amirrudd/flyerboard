import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ImageUpload } from "../../components/ui/ImageUpload";
import { CircularProgress } from "../../components/ui/CircularProgress";
import { searchLocations, formatLocation, LocationData } from "../../lib/locationService";
import { getCategoryIcon } from "../../lib/categoryIcons";
import { Header } from "../layout/Header";
import { uploadImageToR2 } from "../../lib/uploadToR2";
import { CaretLeft, Trash, CaretDown, CircleNotch, Warning, CurrencyDollar, Repeat, Handshake } from '@phosphor-icons/react';
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
  editingAd?: Doc<"ads">;
  origin?: string;
}

// Shared utility class strings to keep markup readable.
const kickerClass = "block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
const fieldLabelClass = "block text-sm font-medium text-foreground/80 mb-2";
const pillInputClass =
  "w-full h-11 px-4 rounded-full bg-muted/50 ring-1 ring-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-ring focus:bg-card transition-all";
const textareaClass =
  "w-full px-4 py-3 rounded-2xl bg-muted/50 ring-1 ring-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-ring focus:bg-card transition-all resize-y";

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
        // Funnel to only include images that haven't been removed by user
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

  const needsPrice = formData.listingType === "sale" || formData.listingType === "both";
  const needsExchange = formData.listingType === "exchange" || formData.listingType === "both";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        leftNode={
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Back"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors rounded-full px-3 h-10 hover:bg-muted/60 active:scale-[0.98]"
          >
            <CaretLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Back</span>
          </button>
        }
        centerNode={
          <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            {editingAd ? "Edit Flyer" : "Pin New Flyer"}
          </h1>
        }
        rightNode={
          editingAd ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Delete flyer"
              className="flex items-center gap-2 text-destructive hover:bg-destructive/10 transition-colors font-medium rounded-full px-3 h-10 ring-1 ring-destructive/30 hover:ring-destructive/60 active:scale-[0.98] disabled:opacity-60"
              disabled={isSubmitting}
            >
              <Trash className="w-4 h-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          ) : (
            <span />
          )
        }
      />

      <main className="flex-1 w-full max-w-3xl mx-auto container-padding py-8 pb-bottom-nav md:pb-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <article className="bg-card ring-1 ring-border/70 rounded-2xl p-6 sm:p-8 shadow-sm">
            {/* Section: Basics */}
            <section aria-labelledby="section-basics">
              <header className="mb-5">
                <h2 id="section-basics" className={kickerClass}>Basics</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Give your flyer a clear title and category.
                </p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                <div>
                  <label htmlFor="post-title" className={fieldLabelClass}>
                    Title *
                  </label>
                  <input
                    id="post-title"
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    maxLength={100}
                    autoComplete="off"
                    className={pillInputClass}
                    placeholder="Enter a descriptive title"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="post-category" className={fieldLabelClass}>
                    Category *
                  </label>
                  <div className="relative" ref={categoryWrapperRef}>
                    <button
                      id="post-category"
                      type="button"
                      onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                      aria-haspopup="listbox"
                      aria-expanded={showCategoryDropdown}
                      className="w-full h-11 px-4 rounded-full bg-muted/50 ring-1 ring-transparent hover:ring-foreground/10 text-left flex items-center justify-between text-foreground focus:outline-none focus:ring-ring focus:bg-card transition-all active:scale-[0.99]"
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
                        <span className="text-muted-foreground/70">Select a category</span>
                      )}
                      <CaretDown className={`w-4 h-4 text-muted-foreground transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showCategoryDropdown && (
                      <div
                        role="listbox"
                        className="absolute z-20 w-full mt-2 bg-popover ring-1 ring-border/70 rounded-2xl shadow-lg max-h-60 overflow-y-auto py-1"
                      >
                        {(categories || []).map((category: any) => {
                          const Icon = getCategoryIcon(category.icon);
                          return (
                            <button
                              key={category._id}
                              type="button"
                              role="option"
                              aria-selected={formData.categoryId === category._id}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, categoryId: category._id }));
                                setShowCategoryDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors flex items-center gap-3"
                            >
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium text-foreground">{category.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="post-description" className={fieldLabelClass}>
                    Description *
                  </label>
                  <textarea
                    id="post-description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    maxLength={1500}
                    rows={6}
                    autoComplete="off"
                    className={textareaClass}
                    placeholder="Describe your item..."
                    required
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground text-right tabular-nums">
                    {formData.description.length} / 1500 characters
                  </p>
                </div>
              </div>
            </section>

            {/* Hairline divider */}
            <div className="my-8 h-px bg-border/70" aria-hidden="true" />

            {/* Section: Pricing */}
            <section aria-labelledby="section-pricing">
              <header className="mb-5">
                <h2 id="section-pricing" className={kickerClass}>Pricing</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose how you'd like to list this item.
                </p>
              </header>

              <fieldset>
                <legend className={fieldLabelClass}>Listing Type *</legend>
                <div
                  role="tablist"
                  aria-label="Listing type"
                  className="inline-flex w-full md:w-auto p-1 rounded-full bg-muted/50 ring-1 ring-border/70"
                >
                  {[
                    { value: "sale", label: "For Sale", icon: CurrencyDollar },
                    { value: "exchange", label: "Exchange", icon: Repeat },
                    { value: "both", label: "Both", icon: Handshake },
                  ].map(({ value, label, icon: Icon }) => {
                    const active = formData.listingType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          listingType: value as "sale" | "exchange" | "both",
                          // Clear price when switching to exchange
                          ...(value === "exchange" ? { price: "" } : {}),
                        }))}
                        className={
                          "flex-1 md:flex-none flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium rounded-full transition-all active:scale-[0.98] " +
                          (active
                            ? "bg-card text-primary ring-1 ring-primary/40 shadow-sm"
                            : "text-muted-foreground hover:text-foreground")
                        }
                      >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formData.listingType === "sale" && "List for sale at a fixed price"}
                  {formData.listingType === "exchange" && "Open to trading for other items"}
                  {formData.listingType === "both" && "Accept payment or trade offers"}
                </p>
              </fieldset>

              {(needsPrice || needsExchange) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 mt-5">
                  {needsPrice && (
                    <div>
                      <label htmlFor="post-price" className={fieldLabelClass}>
                        Price (AUD) *
                      </label>
                      <input
                        id="post-price"
                        type="text"
                        inputMode="numeric"
                        name="price"
                        value={formData.price}
                        onChange={handlePriceChange}
                        className={`${pillInputClass} font-display font-semibold tabular-nums`}
                        placeholder="0"
                        pattern="[0-9]*"
                        required
                      />
                      <p className="mt-1.5 text-xs text-muted-foreground">Enter whole numbers only (no decimals)</p>
                    </div>
                  )}

                  {needsExchange && (
                    <div className={formData.listingType === "exchange" ? "md:col-span-2" : ""}>
                      <label htmlFor="post-exchange" className={fieldLabelClass}>
                        What are you looking for?
                      </label>
                      <textarea
                        id="post-exchange"
                        name="exchangeDescription"
                        value={formData.exchangeDescription}
                        onChange={handleInputChange}
                        maxLength={500}
                        rows={2}
                        autoComplete="off"
                        className={textareaClass}
                        placeholder="e.g., Looking for rare holographic Pokémon cards, Nintendo games..."
                      />
                      <p className="mt-1.5 text-xs text-muted-foreground text-right tabular-nums">
                        {formData.exchangeDescription.length} / 500 characters
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Hairline divider */}
            <div className="my-8 h-px bg-border/70" aria-hidden="true" />

            {/* Section: Photos */}
            <section aria-labelledby="section-photos">
              <header className="mb-5">
                <h2 id="section-photos" className={kickerClass}>Photos</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Images *. Add up to 5 — the first becomes the cover.
                </p>
              </header>

              <div className="rounded-2xl ring-1 ring-dashed ring-border/80 bg-muted/30 hover:bg-muted/50 transition-colors p-4 sm:p-6">
                <ImageUpload
                  images={images}
                  onImagesChange={setImages}
                  onCompressionStateChange={setImageStates}
                  maxImages={5}
                />
              </div>
            </section>

            {/* Hairline divider */}
            <div className="my-8 h-px bg-border/70" aria-hidden="true" />

            {/* Section: Location */}
            <section aria-labelledby="section-location">
              <header className="mb-5">
                <h2 id="section-location" className={kickerClass}>Location</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick the suburb where buyers can meet you.
                </p>
              </header>

              <div className="relative" ref={locationWrapperRef}>
                <label htmlFor="post-location" className={fieldLabelClass}>
                  Location *
                </label>
                <input
                  id="post-location"
                  type="text"
                  value={locationQuery}
                  maxLength={100}
                  onChange={(e) => {
                    setLocationQuery(e.target.value);
                    if (formData.location && e.target.value !== formData.location) {
                      setFormData(prev => ({ ...prev, location: "" }));
                    }
                  }}
                  onFocus={() => {
                    if (locationSuggestions.length > 0) setShowSuggestions(true);
                  }}
                  className={
                    `w-full h-11 px-4 rounded-full bg-muted/50 ring-1 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:bg-card transition-all ` +
                    (!formData.location && locationQuery.length > 0
                      ? "ring-amber-500/60 focus:ring-amber-500"
                      : "ring-transparent focus:ring-ring")
                  }
                  placeholder="Enter suburb or postcode"
                  required
                />
                {isSearchingLocation && (
                  <div className="absolute right-4 top-[42px]">
                    <CircleNotch className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {showSuggestions && locationSuggestions.length > 0 && (
                  <div
                    role="listbox"
                    className="absolute z-10 w-full mt-2 bg-popover ring-1 ring-border/70 rounded-2xl shadow-lg max-h-60 overflow-y-auto py-1"
                  >
                    {locationSuggestions.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => handleLocationSelect(loc)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between group"
                      >
                        <span className="font-medium text-foreground">{loc.locality}</span>
                        <span className="text-muted-foreground text-xs tabular-nums">{loc.state} {loc.postcode}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!formData.location && locationQuery.length > 0 && !isSearchingLocation ? (
                  <p className="mt-1.5 text-xs text-amber-600">Please select a location from the list</p>
                ) : null}
              </div>
            </section>
          </article>

          <div className="flex gap-3 sm:gap-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 h-12 px-6 rounded-full bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || images.length === 0 || !formData.location}
              className="flex-1 h-12 px-6 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] font-semibold shadow-sm shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : (editingAd ? "Update Flyer" : "Pin Flyer")}
            </button>
          </div>
        </form>
      </main>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-flyer-title"
          className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div className="bg-card ring-1 ring-border/70 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <Warning className="w-6 h-6 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 id="delete-flyer-title" className="font-display text-xl font-semibold tracking-tight text-foreground mb-2">
                  Delete Flyer
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Are you sure you want to delete this flyer? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-11 px-4 rounded-full bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] font-medium transition-all disabled:opacity-50"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 h-11 px-4 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98] font-semibold shadow-sm shadow-destructive/25 transition-all disabled:opacity-50"
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
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Optimizing Images"
          className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div className="bg-card ring-1 ring-border/70 rounded-2xl p-8 max-w-md w-full shadow-xl">
            <div className="flex flex-col items-center">
              <CircularProgress progress={compressionProgress} size={140} strokeWidth={10}>
                <div className="text-center">
                  <div className="font-display text-3xl font-semibold tracking-tight text-primary tabular-nums">{compressionProgress}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Compressing</div>
                </div>
              </CircularProgress>

              <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground mt-6 mb-2">
                Optimizing Images
              </h3>
              <p className="text-muted-foreground text-center text-sm leading-relaxed">
                Please wait while we compress your images for faster uploads...
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Upload Progress Overlay */}
      {isSubmitting && !showDeleteConfirm && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingAd ? 'Updating Flyer' : 'Pinning Flyer'}
          className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div className="bg-card ring-1 ring-border/70 rounded-2xl p-8 max-w-md w-full shadow-xl">
            <div className="flex flex-col items-center">
              <CircularProgress progress={progressPercent} size={140} strokeWidth={10}>
                <div className="text-center">
                  <div className="font-display text-3xl font-semibold tracking-tight text-primary tabular-nums">{progressPercent}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Uploading</div>
                </div>
              </CircularProgress>

              <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground mt-6 mb-2">
                {editingAd ? 'Updating Flyer' : 'Pinning Flyer'}
              </h3>
              <p className="text-muted-foreground text-center text-sm leading-relaxed">
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

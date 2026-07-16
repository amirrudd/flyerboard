import { useQuery, useMutation } from "convex/react";
import { useHeaderSlots, type HeaderSlotsConfig } from "../layout/HeaderSlots";
import { HeaderRightActions } from "../layout/HeaderRightActions";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useMemo } from "react";
import { m, useAnimation } from "framer-motion";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";
import { useBoostAction, type BoostableAd } from "../../hooks/useBoostAction";
import { BoostConfirmModal } from "./BoostConfirmModal";
import { BoostRingOverlay, BoostArrowFloat } from "./BoostFx";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ReportModal } from "../../components/ReportModal";
import { RatingModal } from "../../components/RatingModal";
import { ReviewListModal } from "../../components/ReviewListModal";
import { useSession } from "@descope/react-sdk";
import { getDisplayName, getInitials } from "../../lib/displayName";
import { Flag, CaretLeft, ShareNetwork, BookmarkSimple, X, SmileySad, Image as ImageIcon, MapPin, CaretRight, PencilSimple, Repeat, ChatCircle, House, ArrowUp } from '@phosphor-icons/react';
import { ContextualNotificationModal } from "../../components/notifications/ContextualNotificationModal";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { SellerProfile } from "../../components/ui/SellerProfile";
import { ConversationThread, MessageComposer } from "../messages";
import type { ThreadMessage } from "../messages";

import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { LocationMap } from "../../components/ui/LocationMap";
import { ImageLightbox } from "../../components/ui/ImageLightbox";
import { formatPriceWithCurrency, formatPrice } from "../../lib/priceFormatter";
import { formatPickupShort } from "../movingSale/saleHelpers";
import { trackView, setFlushCallback } from "../../lib/viewTracker";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import { BundleBanner } from "../bundles/BundleBanner";


interface AdDetailProps {
  adId: Id<"ads">;
  initialAd?: any; // Using any to avoid strict type matching issues with partial data
  onBack: () => void;
  onShowAuth: () => void;
}

export function AdDetail({ adId, initialAd, onBack, onShowAuth }: AdDetailProps) {
  const navigate = useNavigate();
  const { whileInView, reduced } = useMotionPrefs();
  const heartControls = useAnimation();
  const shareControls = useAnimation();
  const [showChat, setShowChat] = useState(false);
  const [showMobileChatSheet, setShowMobileChatSheet] = useState(false);
  const [showMobileSellerSheet, setShowMobileSellerSheet] = useState(false);
  const [chatId, setChatId] = useState<Id<"chats"> | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportProfileModal, setShowReportProfileModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showReviewListModal, setShowReviewListModal] = useState(false);
  const [avatarImageError, setAvatarImageError] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showMessageNotificationModal, setShowMessageNotificationModal] = useState(false);
  const [showLikeNotificationModal, setShowLikeNotificationModal] = useState(false);

  // Combined query for ad data, saved status, and existing chat
  const adContext = useQuery(api.adDetail.getAdWithContext, { adId });
  const ad = adContext?.ad;
  const isAdSaved = adContext?.isSaved ?? false;
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);
  const displaySaved = optimisticSaved !== null ? optimisticSaved : isAdSaved;

  const allCategories = useQuery(api.categories.getCategories);
  const adCategory = useMemo(
    () => Array.isArray(allCategories) ? allCategories.find(c => c._id === ad?.categoryId) : undefined,
    [allCategories, ad?.categoryId]
  );
  const existingChat = adContext?.existingChat;

  const messages = useQuery(
    api.adDetail.getChatMessages,
    chatId ? { chatId } : "skip"
  );

  // adDetail.getChatMessages spreads the raw message doc, so rows already
  // carry the real `senderId` ConversationThread keys on.
  const threadMessages: ThreadMessage[] = messages || [];

  const saveAd = useMutation(api.adDetail.saveAd);
  const sendFirstMessage = useMutation(api.adDetail.sendFirstMessage);
  const sendMessage = useMutation(api.adDetail.sendMessage);
  const batchIncrementViews = useMutation(api.adDetail.batchIncrementViews);

  // Owner-facing Boost CTA (flag-gated). Called unconditionally here (before the
  // loading/not-found early returns) per the rules of hooks — `useBoostAction`
  // tolerates an undefined ad and only activates once the doc + ownership resolve.
  const boostEnabled = useFeatureFlag("boostToTop");
  const boost = useBoostAction((ad ?? initialAd) as BoostableAd | undefined);
  // Single source of truth for "render Boost UI" — mirrors MyAdCard's `showBoost`.
  const showBoost = boostEnabled && boost.state !== "ineligible";

  // Use Descope for authentication state
  const { isAuthenticated } = useSession();
  // Get real user data from Convex
  const convexUser = useQuery(api.descopeAuth.getCurrentUser);
  const user = isAuthenticated ? convexUser : null;

  useEffect(() => {
    if (existingChat) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local chatId from server-loaded existingChat
      setChatId(existingChat._id);
    }
  }, [existingChat]);

  // Scroll to top when component mounts or adId changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [adId]);

  // Set up view tracker flush callback (once per component lifecycle)
  useEffect(() => {
    setFlushCallback(async (adIds: string[]) => {
      await batchIncrementViews({ adIds: adIds as Id<"ads">[] });
    });
  }, [batchIncrementViews]);

  useEffect(() => {
    // Track view - batched and deduplicated by viewTracker
    trackView(adId);
  }, [adId]); // Only re-run if adId changes

  const handleSave = async () => {
    if (!user) {
      toast.error("Please sign in to save ads");
      return;
    }
    const next = !displaySaved;
    setOptimisticSaved(next);
    try {
      const result = await saveAd({ adId });
      toast.success(result.saved ? "Ad saved!" : "Ad removed from saved");
      if (result.saved) {
        if (!reduced) {
          void heartControls.start({
            scale: [1, 1.35, 0.9, 1],
            transition: { duration: 0.3, ease: "easeOut" },
          });
        }
        setShowLikeNotificationModal(true);
      }
      setOptimisticSaved(null);
    } catch {
      setOptimisticSaved(null);
      toast.error("Failed to save ad");
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/ad/${adId}`;
    // Warm the OG share-card cache: the first render of /api/og/ad/:id takes
    // ~2s, so trigger it now — by the time the pasted link is crawled, the CDN
    // serves the cached card instantly. Cancel the body: we only need the
    // render+cache to happen server-side, not a ~1MB download here.
    void fetch(`/api/og/ad/${adId}`)
      .then((r) => r.body?.cancel())
      .catch(() => undefined);
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link to flyer copied to clipboard");
    if (!reduced) {
      void shareControls.start({
        scale: [1, 1.18, 0.96, 1],
        transition: { duration: 0.32, ease: "easeOut" },
      });
    }
  };

  const handleStartChat = async () => {
    if (!user) {
      onShowAuth();
      return;
    }

    // Just show the chat UI - chat will be created when first message is sent
    setShowChat(true);
  };

  // MessageComposer contract: onSend clears the draft on success and toasts
  // on a thrown error, so this just needs to route to the right mutation
  // based on whether a chat already exists (routes to sendFirstMessage vs
  // sendMessage) and let errors propagate.
  const handleSendMessage = async (content: string) => {
    if (!chatId) {
      // First message - create chat and send message atomically
      const result = await sendFirstMessage({ adId, content });
      setChatId(result.chatId);

      // Show notification modal after first message
      setShowMessageNotificationModal(true);
    } else {
      // Subsequent messages
      await sendMessage({ chatId, content });
    }
  };

  const nextImage = () => {
    if (ad && ad.images.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % ad.images.length);
    }
  };

  const prevImage = () => {
    if (ad && ad.images.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + ad.images.length) % ad.images.length);
    }
  };

  // Hoisted above the early returns so the header slots below can use it.
  const displayAd = ad || initialAd;

  // ── Persistent Layout header ─────────────────────────────────────────────
  // AdDetail no longer renders its own <Header>; it registers slots on the
  // shared Layout header instead (also correct when AdDetail is embedded
  // inline in the dashboard — its registration stacks on top of the
  // dashboard's and pops off on unmount). The config is rebuilt every render,
  // so nodes may freely close over live state (displaySaved, user, handlers).
  // Must be computed/registered BEFORE the early returns (hooks rules).
  let headerSlots: HeaderSlotsConfig;
  if (ad === null) {
    // Ad not found
    headerSlots = {
      leftNode: (
        <div className="flex items-center gap-6 flex-shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <CaretLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Back to flyers</span>
          </button>
        </div>
      ),
      centerNode: (
        <button type="button" onClick={onBack} aria-label="Back to flyers" className="font-display text-xl font-semibold text-foreground cursor-pointer tracking-[-0.02em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full">FlyerBoard</button>
      ),
      rightNode: <div />,
    };
  } else if (!displayAd) {
    // Loading skeleton (previously an inline <header> in the skeleton state)
    headerSlots = {
      leftNode: (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <CaretLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back to flyers</span>
        </button>
      ),
      centerNode: (
        <span className="font-display text-xl font-semibold text-foreground tracking-tight">Loading...</span>
      ),
      rightNode: (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-lg animate-pulse"></div>
          <div className="w-10 h-10 bg-muted rounded-lg animate-pulse"></div>
        </div>
      ),
    };
  } else {
    headerSlots = {
      leftNode: (
        <div className="flex items-center gap-6 flex-shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Back to flyers</span>
          </button>
        </div>
      ),
      centerNode: (
        <button type="button" onClick={onBack} aria-label="Back to flyers" className="font-display text-xl font-semibold text-foreground cursor-pointer tracking-[-0.02em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full">FlyerBoard</button>
      ),
      rightNode: (
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <m.button
              onClick={() => { void handleShare(); }}
              whileTap={{ scale: 0.9 }}
              className="inline-flex items-center justify-center p-2 rounded-lg bg-accent text-muted-foreground hover:bg-accent/80 transition-colors"
              title="Share flyer"
            >
              <m.span animate={shareControls} style={{ display: 'inline-flex' }}>
                <ShareNetwork className="w-5 h-5" />
              </m.span>
            </m.button>
            {user && displayAd.userId !== user._id && (
              <>
                <m.button
                  onClick={() => { void handleSave(); }}
                  whileTap={{ scale: 0.88 }}
                  className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors ${displaySaved
                    ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  title={displaySaved ? "Remove from saved" : "Save ad"}
                >
                  <m.span animate={heartControls} style={{ display: 'inline-flex' }}>
                    <BookmarkSimple className="w-5 h-5" weight={displaySaved ? "fill" : "regular"} />
                  </m.span>
                </m.button>
                <m.button
                  onClick={() => setShowReportModal(true)}
                  whileTap={{ scale: 0.9 }}
                  className="inline-flex items-center justify-center p-2 rounded-lg bg-accent text-muted-foreground hover:bg-accent/80 transition-colors sm:hidden"
                  title="Report flyer"
                >
                  <Flag className="w-5 h-5" />
                </m.button>
              </>
            )}
          </div>

          <div className="h-6 w-px bg-border hidden sm:block"></div>

          <div className="hidden sm:flex items-center gap-4">
            <HeaderRightActions
              user={user}
              isAuthenticated={isAuthenticated}
              onPostClick={() => {
                if (user) {
                  void navigate('/post', { state: { from: `/ad/${adId}` } });
                } else {
                  onShowAuth();
                }
              }}
              onDashboardClick={() => { void navigate('/dashboard'); }}
              onSignInClick={onShowAuth}
            />
          </div>
        </div>
      ),
    };
  }
  useHeaderSlots(headerSlots);

  // If ad is explicitly null (loaded but not found), show not found state
  if (ad === null) {
    return (
      <div className="min-h-screen bg-background">
        <div className="content-max-width mx-auto container-padding py-12 text-center">
          <div className="bg-card ring-1 ring-border/70 rounded-2xl p-12 shadow-card max-w-lg mx-auto">
            <SmileySad className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" weight="light" />
            <h2 className="font-display text-3xl font-semibold text-foreground mb-2 tracking-tight">Ad Not Found</h2>
            <p className="text-muted-foreground mb-6">This ad may have been deleted or removed.</p>
            <button
              onClick={onBack}
              className="bg-primary text-primary-foreground px-6 h-11 rounded-full hover:bg-primary/90 active:scale-[0.98] transition-all font-semibold shadow-sm shadow-primary/25"
            >
              Return to Flyers
            </button>
          </div>
        </div>
      </div>
    );
  }

  // v3.1: if this ad belongs to a Sale, show the rich context banner here (feed
  // items are no longer differentiated — this is the sole discovery surface).
  // eslint-disable-next-line react-hooks/rules-of-hooks -- existing conditional placement after early returns; matches the useEffect below
  const saleBanner = useQuery(
    api.saleEvents.getSaleBannerForAd,
    displayAd?.saleEventId ? { adId: displayAd._id } : "skip"
  );

  // Bundle Listing (v1): "Available as a bundle" banner for items in an
  // ACTIVE standalone bundle. Gated on the bundleListing feature flag.
  // eslint-disable-next-line react-hooks/rules-of-hooks -- existing conditional placement after early returns; matches saleBanner above
  const bundleBanner = useQuery(
    api.bundles.getBundleBannerForAd,
    displayAd?._id ? { adId: displayAd._id } : "skip"
  );
  // eslint-disable-next-line react-hooks/rules-of-hooks -- existing conditional placement after early returns; matches the queries above
  const bundleListingEnabled = useFeatureFlag("bundleListing");

  // Auto-open chat for logged-in users viewing other users' ads
  // eslint-disable-next-line react-hooks/rules-of-hooks -- existing conditional placement after early returns; see note
  useEffect(() => {
    if (user && displayAd && displayAd.userId !== user._id && !showChat) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- handleStartChat opens the chat UI as a deliberate side-effect of viewing another user's ad
      void handleStartChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, displayAd]);

  if (!displayAd) {
    return (
      <div className="bg-background flex flex-col">
        {/* Header skeleton is registered on the persistent Layout header above */}

        {/* Loading content - MATCHES LOADED STRUCTURE EXACTLY */}
        <div className="w-full flex-1 content-max-width mx-auto container-padding py-6 pb-bottom-nav md:pb-6">
          {/* Breadcrumb skeleton - same height as loaded nav to avoid CLS */}
          <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <button onClick={onBack} className="hover:text-foreground transition-colors">Home</button>
            <span>/</span>
            <span className="shimmer bg-muted rounded h-3 w-16 inline-block" aria-hidden="true" />
          </nav>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Content - 70% */}
            <div className="lg:w-[70%] min-w-0 space-y-6">
              {/* Image Gallery skeleton */}
              <div className="bg-card rounded-2xl overflow-hidden shadow-card ring-1 ring-border/70">
                <div className="relative aspect-video bg-muted shimmer"></div>
              </div>

              {/* Ad Information skeleton */}
              <div className="bg-card rounded-2xl p-6 shadow-card ring-1 ring-border/70">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="h-8 bg-muted rounded shimmer mb-2 w-3/4"></div>
                    <div className="h-10 bg-muted rounded shimmer w-1/3"></div>
                  </div>
                  <div className="text-right">
                    <div className="h-5 w-16 bg-muted rounded shimmer mb-1"></div>
                    <div className="h-5 w-24 bg-muted rounded shimmer"></div>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="h-6 bg-muted rounded shimmer mb-3 w-1/4"></div>
                  <div className="h-4 bg-muted rounded shimmer mb-2"></div>
                  <div className="h-4 bg-muted rounded shimmer mb-2 w-5/6"></div>
                  <div className="h-4 bg-muted rounded shimmer w-2/3"></div>
                </div>
                <div className="h-5 bg-muted rounded shimmer w-1/2"></div>
              </div>

              {/* Map skeleton */}
              <div className="bg-card rounded-2xl p-6 shadow-card ring-1 ring-border/70">
                <div className="h-6 bg-muted rounded shimmer mb-4 w-1/4"></div>
                <div className="h-48 bg-muted rounded shimmer"></div>
              </div>
            </div>

            {/* Sidebar skeleton - 30% with sticky positioning */}
            <div className="lg:w-[30%] lg:max-w-[400px] sticky top-21 self-start">
              <div className="space-y-6">
                {/* Seller Info skeleton */}
                <div className="bg-card rounded-2xl p-6 shadow-card ring-1 ring-border/70">
                  <div className="h-6 bg-muted rounded shimmer mb-4 w-1/2"></div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-muted shimmer"></div>
                    <div className="flex-1">
                      <div className="h-5 bg-muted rounded shimmer mb-2 w-2/3"></div>
                      <div className="h-4 bg-muted rounded shimmer w-1/2"></div>
                    </div>
                  </div>
                  <div className="h-12 bg-muted rounded shimmer"></div>
                </div>

                {/* Quick Actions skeleton */}
                <div className="bg-card rounded-2xl p-6 shadow-card hidden sm:block ring-1 ring-border/70">
                  <div className="h-6 bg-muted rounded shimmer mb-4 w-1/2"></div>
                  <div className="space-y-3">
                    <div className="h-10 bg-muted rounded shimmer"></div>
                    <div className="h-10 bg-muted rounded shimmer"></div>
                    <div className="h-10 bg-muted rounded shimmer"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const timeAgo = displayAd._creationTime
    ? formatDistanceToNow(new Date(displayAd._creationTime), { addSuffix: true })
    : 'recently';
  const images = displayAd.images.length > 0 ? displayAd.images : [];

  return (
    <div className="bg-background flex flex-col">
      {/* Header slots (back / FlyerBoard / share+save) are registered on the
          persistent Layout header above the early returns */}

      <div className="w-full flex-1 content-max-width mx-auto container-padding py-6 pb-bottom-nav md:pb-6">
        {/* Breadcrumbs — always rendered (same height loading or loaded) to avoid CLS */}
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <button onClick={onBack} className="hover:text-foreground transition-colors">Home</button>
          {adCategory && (
            <>
              <span>/</span>
              <button onClick={onBack} className="hover:text-foreground transition-colors">
                {adCategory.name}
              </button>
            </>
          )}
          <span>/</span>
          {displayAd?.title ? (
            <span className="text-foreground/70 line-clamp-1 max-w-[180px] sm:max-w-xs">{displayAd.title}</span>
          ) : (
            <span className="shimmer bg-muted rounded h-3 w-16 inline-block" aria-hidden="true" />
          )}
        </nav>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content - 70% of container width */}
          <div className="lg:w-[70%] min-w-0 space-y-6">
            {/* Image Gallery with Slider */}
            <div className="ambient-glow">
            <m.div {...whileInView(0)} className="bg-card rounded-2xl overflow-hidden shadow-card ring-1 ring-border/70">
              <div className="relative aspect-video bg-muted">
                {images.length > 0 ? (
                  <ImageDisplay
                    imageRef={images[currentImageIndex]}
                    alt={`${displayAd.title} - Image ${currentImageIndex + 1}`}
                    className="w-full h-full object-contain cursor-pointer"
                    variant="large"
                    onClick={() => setShowLightbox(true)}
                    size="hero"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <ImageIcon className="w-24 h-24 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground">No images available</p>
                    </div>
                  </div>
                )}

                {/* Navigation arrows for multiple images */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      aria-label="Previous image"
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/85 backdrop-blur-md text-foreground p-2.5 rounded-full ring-1 ring-border/60 hover:bg-background active:scale-95 transition-all shadow-card"
                    >
                      <CaretLeft className="w-4 h-4" weight="bold" />
                    </button>
                    <button
                      onClick={nextImage}
                      aria-label="Next image"
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/85 backdrop-blur-md text-foreground p-2.5 rounded-full ring-1 ring-border/60 hover:bg-background active:scale-95 transition-all shadow-card"
                    >
                      <CaretRight className="w-4 h-4" weight="bold" />
                    </button>
                  </>
                )}

                {/* Image counter */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 right-4 bg-background/85 backdrop-blur-md text-foreground ring-1 ring-border/60 px-3 py-1 rounded-full text-xs font-semibold tabular shadow-card">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                )}
              </div>

              {/* Thumbnail strip for multiple images */}
              {images.length > 1 && (
                <div className="px-4 py-3 bg-muted/40 border-t border-border/60">
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide p-1 -m-1">
                    {images.map((image: string, index: number) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        aria-label={`Show image ${index + 1}`}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all duration-200 ${index === currentImageIndex
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100'
                          : 'ring-1 ring-border opacity-70 hover:opacity-100 hover:ring-foreground/20'
                          }`}
                      >
                        <ImageDisplay
                          imageRef={image}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                          variant="small"
                          size="thumb"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </m.div>
            </div>

            {/* Ad Information */}
            <m.div {...whileInView(0.05)} className="bg-card rounded-2xl p-6 shadow-card ring-1 ring-border/70">
              <div className="flex items-start justify-between gap-6 mb-5">
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground mb-3 leading-[1.1] tracking-[-0.02em]">{displayAd.title}</h1>
                  {/* Price display based on listing type */}
                  {(!displayAd.listingType || displayAd.listingType === "sale") && displayAd.price !== undefined && (
                    <p className="font-display text-4xl font-semibold text-primary tabular leading-none">{formatPriceWithCurrency(displayAd.price)}</p>
                  )}
                  {displayAd.listingType === "exchange" && (
                    <p className="font-display text-3xl font-semibold text-primary-bright flex items-center gap-2 leading-none">
                      <Repeat className="w-6 h-6" weight="bold" />
                      Open to Trade
                    </p>
                  )}
                  {displayAd.listingType === "both" && displayAd.price !== undefined && (
                    <p className="font-display text-4xl font-semibold text-primary flex items-baseline gap-3 tabular leading-none">
                      {formatPriceWithCurrency(displayAd.price)}
                      <span className="font-sans text-xs font-semibold tracking-[0.18em] uppercase text-primary-bright">• Trade</span>
                    </p>
                  )}
                </div>
                <div className="text-right text-sm flex-shrink-0">
                  {ad ? (
                    <p><span className="font-display text-foreground font-semibold tabular text-base">{ad.views}</span> <span className="text-muted-foreground text-xs uppercase tracking-wider ml-0.5">views</span></p>
                  ) : (
                    <div className="h-5 w-16 bg-muted rounded animate-pulse ml-auto" />
                  )}
                  <p className="text-muted-foreground text-xs mt-1">Posted {timeAgo}</p>
                </div>
              </div>

              {/* Sale context banner (v3.1) — the one place a sale item reveals
                  it belongs to a Moving Sale. Text row + thumbnail strip; the whole
                  banner taps through to the Sale page. */}
              {saleBanner?.slug && (
                <button
                  type="button"
                  onClick={() => { void navigate(`/sale/${saleBanner.slug}`); }}
                  className="mb-6 w-full rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 text-left transition active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <House size={20} weight="fill" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">
                        {saleBanner.currentItemSold
                          ? "This item has sold"
                          : `Part of ${saleBanner.sellerFirstName}'s Moving Sale`}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {saleBanner.currentItemSold
                          ? `${saleBanner.availableCount} items still available`
                          : [
                              saleBanner.suburb,
                              `${saleBanner.itemCount} items`,
                              formatPickupShort(saleBanner.pickupWindowStart),
                              saleBanner.minPrice > 0 ? `from ${formatPrice(saleBanner.minPrice)}` : null,
                            ].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <CaretRight size={18} className="shrink-0 text-muted-foreground" />
                  </div>

                  {/* Thumbnail strip: current item (dimmed) + up to 3 others + "+N". */}
                  <div className="mt-3 flex gap-1">
                    {saleBanner.currentImage && (
                      <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-md ring-2 ring-primary">
                        <ImageDisplay imageRef={saleBanner.currentImage} alt="" className="h-full w-full object-cover opacity-50" size="thumb" />
                      </div>
                    )}
                    {saleBanner.otherImages.map((img, i) => (
                      <div key={i} className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-md bg-muted">
                        <ImageDisplay imageRef={img} alt="" className="h-full w-full object-cover" size="thumb" />
                      </div>
                    ))}
                    {saleBanner.moreCount > 0 && (
                      <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-md bg-neutral-900/70 text-xs font-semibold text-white">
                        +{saleBanner.moreCount}
                      </div>
                    )}
                  </div>
                </button>
              )}

              {/* Bundle Listing banner — an ad is never in both a Sale and a
                  standalone bundle, so both banners rendering is impossible,
                  but placing this one after the sale banner is fine either way. */}
              {bundleListingEnabled && bundleBanner && (
                <BundleBanner
                  {...bundleBanner}
                  onItemClick={(adId) => { void navigate(`/ad/${adId}`); }}
                  onBannerClick={() => { void navigate(`/bundle/${bundleBanner.bundleId}`); }}
                />
              )}

              {/* Exchange Description - shown for exchange and both types */}
              {(displayAd.listingType === "exchange" || displayAd.listingType === "both") && displayAd.exchangeDescription && (
                <div className="mb-6 p-5 bg-primary/[0.06] rounded-2xl ring-1 ring-primary/20 relative overflow-hidden">
                  <span className="absolute left-0 top-3 bottom-3 w-[3px] bg-primary rounded-r-full" aria-hidden />
                  <h3 className="kicker text-primary mb-2 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5" weight="bold" />
                    Looking for
                  </h3>
                  <p className="text-foreground/90 leading-relaxed">{displayAd.exchangeDescription}</p>
                </div>
              )}

              <div className="mb-6">
                <h3 className="kicker mb-3">Description</h3>
                <p className="text-foreground/80 leading-relaxed whitespace-pre-line text-[15px]">{displayAd.description}</p>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground border-t border-border/60 pt-4">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-foreground/80 font-medium">{displayAd.location}</span>
                </div>
              </div>
            </m.div>

            {/* Map */}
            <m.div {...whileInView(0.1)} className="bg-card ring-1 ring-border/70 rounded-2xl p-6 shadow-card">
              <h3 className="kicker mb-4">Location</h3>
              <LocationMap location={displayAd.location} />
            </m.div>
          </div>

          {/* Sidebar - 30% of container width, capped at 400px - Hidden on mobile, shown on desktop */}
          <div className="hidden lg:block lg:w-[30%] lg:max-w-[400px] sticky top-21 self-start">
            <div className="space-y-6">
              {/* Seller Info */}
              <div className="bg-card ring-1 ring-border/70 rounded-2xl p-6 shadow-card">
                <h3 className="kicker mb-4">Seller Information</h3>
                <div className="flex items-center gap-3 mb-4">
                  <SellerProfile
                    seller={displayAd.seller}
                    avatarImageError={avatarImageError}
                    onAvatarError={() => setAvatarImageError(true)}
                    onRatingClick={() => setShowReviewListModal(true)}
                    size="md"
                  />
                  {user && displayAd.userId !== user._id && (
                    <button
                      onClick={() => setShowReportProfileModal(true)}
                      className="inline-flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      title="Report seller"
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {user && displayAd.userId !== user._id && (
                  <>
                    {!showChat && (
                      <button
                        onClick={() => { void handleStartChat(); }}
                        className="w-full bg-primary text-primary-foreground h-11 px-4 rounded-full hover:bg-primary/90 active:scale-[0.98] transition-all font-semibold shadow-sm shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background mb-2"
                      >
                        Contact Seller
                      </button>
                    )}
                    {chatId && (
                      <button
                        onClick={() => setShowRatingModal(true)}
                        className="w-full bg-transparent text-primary ring-1 ring-primary/40 hover:ring-primary py-2.5 px-4 rounded-full hover:bg-primary/[0.06] active:scale-[0.98] transition-all font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Rate Seller
                      </button>
                    )}
                  </>
                )}

                {user && displayAd.userId === user._id && (
                  <button
                    onClick={() => { void navigate('/dashboard'); }}
                    className="w-full bg-primary text-primary-foreground h-11 px-4 rounded-full hover:bg-primary/90 active:scale-[0.98] transition-all font-semibold shadow-sm shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Manage Your Flyers
                  </button>
                )}

                {!user && (
                  <button
                    onClick={onShowAuth}
                    className="w-full bg-primary text-primary-foreground h-11 px-4 rounded-full hover:bg-primary/90 active:scale-[0.98] transition-all font-semibold shadow-sm shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Sign in to contact seller
                  </button>
                )}
              </div>

              {/* Chat Section - Desktop only */}
              {showChat && (
                <div className="bg-card rounded-2xl shadow-card hidden lg:flex lg:flex-col ring-1 ring-border/70 overflow-hidden">
                  <div className="p-4 border-b border-border shrink-0">
                    <div className="flex items-center justify-between">
                      <h3 className="kicker">Chat with Seller</h3>
                      <button
                        onClick={() => setShowChat(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col min-h-0 max-h-64">
                    <ConversationThread
                      messages={threadMessages}
                      currentUserId={user?._id ?? ""}
                      className="p-4"
                    />
                  </div>

                  <MessageComposer
                    onSend={handleSendMessage}
                    placeholder="Type your message..."
                  />
                </div>
              )}

              {/* Quick Actions */}
              <m.div animate={boost.cardControls} className="relative bg-card ring-1 ring-border/70 rounded-2xl p-6 shadow-card hidden sm:block">
                <BoostRingOverlay ringKey={boost.ringKey} ringProps={boost.ringProps} />
                <h3 className="kicker mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  {user && displayAd.userId === user._id ? (
                    // Owner: Boost is the primary action; Edit demoted to secondary.
                    <>
                      {showBoost && (
                        <div className="relative">
                          <button
                            type="button"
                            disabled={boost.state === "cooldown"}
                            aria-label={boost.state === "cooldown" ? boost.cooldownAria : "Boost to top"}
                            title={boost.state === "cooldown" ? boost.cooldownAria : undefined}
                            onClick={() => boost.openConfirm()}
                            className={boost.state === "cooldown"
                              ? "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-muted/40 text-muted-foreground ring-1 ring-border font-medium text-sm cursor-not-allowed"
                              : "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all font-semibold shadow-sm shadow-primary/25 text-sm"}
                          >
                            <ArrowUp className="w-4 h-4" weight="bold" />
                            {boost.state === "cooldown" ? boost.cooldownLabel : "Boost to top"}
                          </button>
                          <BoostArrowFloat show={boost.showArrow} arrowProps={boost.arrowProps} />
                        </div>
                      )}
                      <button
                        onClick={() => { void navigate('/post', { state: { editingAd: displayAd, from: `/ad/${adId}` } }); }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 transition-all active:scale-[0.98] font-medium text-sm"
                      >
                        <PencilSimple className="w-4 h-4" weight="bold" />
                        Edit Flyer
                      </button>
                    </>
                  ) : (
                    // Show Save and Report buttons for other users' flyers
                    user && (
                      <>
                        <button
                          onClick={() => { void handleSave(); }}
                          className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full transition-all active:scale-[0.98] font-medium text-sm ${displaySaved
                            ? 'bg-destructive/[0.08] text-destructive ring-1 ring-destructive/30 hover:bg-destructive/[0.12]'
                            : 'bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15'
                            }`}
                        >
                          <BookmarkSimple className="w-4 h-4" weight={displaySaved ? "fill" : "regular"} />
                          {displaySaved ? 'Remove from Saved' : 'Save Ad'}
                        </button>
                        <button
                          onClick={() => setShowReportModal(true)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 transition-all active:scale-[0.98] font-medium text-sm"
                        >
                          <Flag className="w-4 h-4" />
                          Report Flyer
                        </button>
                      </>
                    )
                  )}
                  <button
                    onClick={() => { void handleShare(); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 transition-all active:scale-[0.98] font-medium text-sm"
                  >
                    <ShareNetwork className="w-4 h-4" />
                    Share Flyer
                  </button>
                </div>
              </m.div>
            </div>
          </div>
        </div>
      </div>

      {/* Owner Boost confirm modal (shared shell; primary confirm, not destructive) */}
      {showBoost && (
        <BoostConfirmModal
          open={boost.isConfirmOpen}
          cooldownDays={boost.cooldownDays}
          isBoosting={boost.isBoosting}
          onConfirm={() => void boost.confirmBoost()}
          onCancel={boost.closeConfirm}
        />
      )}

      {/* Mobile owner Boost FAB — Quick Actions is hidden sm:block, so without this a
          mobile owner has no way to boost from the detail page. Sits at the same
          bottom offset as the buyer's Message FAB (bottom-nav gotcha). */}
      {user && displayAd.userId === user._id && showBoost && createPortal(
        <div className="lg:hidden">
          <div className="fixed right-4 z-40" style={{ bottom: 'calc(var(--bottom-nav-height) + 1rem)' }}>
            <m.button
              animate={boost.cardControls}
              type="button"
              disabled={boost.state === "cooldown"}
              onClick={() => boost.openConfirm()}
              aria-label={boost.state === "cooldown" ? boost.cooldownAria : "Boost to top"}
              title={boost.state === "cooldown" ? boost.cooldownAria : undefined}
              className={boost.state === "cooldown"
                ? "flex items-center gap-2 py-3 px-5 rounded-full bg-card text-muted-foreground ring-1 ring-border font-medium text-sm shadow-card-hover cursor-not-allowed"
                : "flex items-center gap-2 py-3 px-5 rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-[0_8px_24px_-4px_hsl(var(--primary)/0.45)] hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all ring-4 ring-background"}
            >
              <ArrowUp className="w-5 h-5" weight="bold" />
              {boost.state === "cooldown" ? boost.cooldownLabel : "Boost to top"}
            </m.button>
            <BoostArrowFloat show={boost.showArrow} arrowProps={boost.arrowProps} />
          </div>
        </div>,
        document.body
      )}

      {/* Mobile FABs - Using Portal to ensure fixed positioning works */}
      {user && displayAd.userId !== user._id && createPortal(
        <div className="lg:hidden">
          <button
            onClick={() => setShowMobileSellerSheet(true)}
            className="fixed right-4 bg-card ring-1 ring-border/70 p-2 rounded-full shadow-card-hover hover:scale-105 active:scale-95 transition-all z-40"
            style={{ bottom: 'calc(var(--bottom-nav-height) + 5rem)' }}
            title="Seller Info"
          >
            <div className="flex items-center gap-1">
              {displayAd.seller?.image && !avatarImageError ? (
                <ImageDisplay
                  src={displayAd.seller.image}
                  alt={displayAd.seller.name}
                  className="w-10 h-10 rounded-full object-cover"
                  onError={() => setAvatarImageError(true)}
                  size="thumb"
                />
              ) : (
                <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-semibold text-sm">
                  {displayAd.seller ? getInitials(displayAd.seller) : "U"}
                </div>
              )}
            </div>
          </button>

          {/* Message Seller FAB */}
          <button
            onClick={() => setShowMobileChatSheet(true)}
            className="fixed right-4 bg-primary text-primary-foreground p-4 rounded-full shadow-[0_8px_24px_-4px_hsl(var(--primary)/0.45)] hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all z-40 ring-4 ring-background"
            style={{ bottom: 'calc(var(--bottom-nav-height) + 1rem)' }}
            title="Message Seller"
          >
            <ChatCircle className="w-6 h-6" />
          </button>
        </div>,
        document.body
      )}

      {/* Mobile Seller Info Bottom Sheet */}
      <BottomSheet
        isOpen={showMobileSellerSheet}
        onClose={() => setShowMobileSellerSheet(false)}
        title="Seller Information"
      >
        <div className="p-4 space-y-4">
          <SellerProfile
            seller={displayAd.seller}
            avatarImageError={avatarImageError}
            onAvatarError={() => setAvatarImageError(true)}
            onRatingClick={() => {
              setShowMobileSellerSheet(false);
              setShowReviewListModal(true);
            }}
            size="lg"
          />

          <div className="space-y-2 pt-2">
            <button
              onClick={() => {
                setShowMobileSellerSheet(false);
                setShowMobileChatSheet(true);
              }}
              className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-full hover:bg-primary/90 active:scale-[0.98] transition-all font-semibold shadow-sm shadow-primary/25 flex items-center justify-center gap-2"
            >
              <ChatCircle className="w-5 h-5" />
              Message Seller
            </button>
            {chatId && (
              <button
                onClick={() => {
                  setShowMobileSellerSheet(false);
                  setShowRatingModal(true);
                }}
                className="w-full bg-card text-primary ring-1 ring-primary/40 hover:ring-primary py-3 px-4 rounded-full hover:bg-primary/[0.06] active:scale-[0.98] transition-all font-semibold"
              >
                Rate Seller
              </button>
            )}
            <button
              onClick={() => {
                setShowMobileSellerSheet(false);
                setShowReportProfileModal(true);
              }}
              className="w-full bg-muted/40 text-foreground ring-1 ring-border py-3 px-4 rounded-full hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all font-medium flex items-center justify-center gap-2"
            >
              <Flag className="w-4 h-4" />
              Report Seller
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Mobile Chat Bottom Sheet */}
      <BottomSheet
        isOpen={showMobileChatSheet}
        onClose={() => setShowMobileChatSheet(false)}
        title="Chat with Seller"
      >
        <div className="flex flex-col min-h-0 max-h-[50dvh]">
          <ConversationThread
            messages={threadMessages}
            currentUserId={user?._id ?? ""}
            className="p-4"
          />
        </div>

        <MessageComposer
          onSend={async (content) => {
            const wasNewChat = !chatId;
            await handleSendMessage(content);
            // Create chat if needed — mirrors the previous behavior of
            // revealing the desktop chat section state after the first
            // message is sent from the mobile sheet.
            if (wasNewChat) {
              setShowChat(true);
            }
          }}
          placeholder="Type your message..."
        />
      </BottomSheet>

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportType="ad"
        reportedEntityId={adId}
        reportedEntityName={displayAd.title}
      />

      {/* Report Profile Modal */}
      <ReportModal
        isOpen={showReportProfileModal}
        onClose={() => setShowReportProfileModal(false)}
        reportType="profile"
        reportedEntityId={displayAd.userId}
        reportedEntityName={getDisplayName(displayAd.seller)}
      />

      {/* Rating Modal */}
      {displayAd.seller && (
        <>
          <RatingModal
            isOpen={showRatingModal}
            onClose={() => setShowRatingModal(false)}
            userId={displayAd.userId}
            userName={getDisplayName(displayAd.seller)}
            chatId={chatId || undefined}
          />
          <ReviewListModal
            isOpen={showReviewListModal}
            onClose={() => setShowReviewListModal(false)}
            userId={displayAd.userId}
            userName={getDisplayName(displayAd.seller)}
          />
        </>
      )}

      {/* Image Lightbox */}
      <ImageLightbox
        images={images}
        currentIndex={currentImageIndex}
        isOpen={showLightbox}
        onClose={() => setShowLightbox(false)}
        onNavigate={setCurrentImageIndex}
        altPrefix={displayAd.title}
      />

      {/* Contextual Notification Modals */}
      <ContextualNotificationModal
        context="send-message"
        isOpen={showMessageNotificationModal}
        onClose={() => setShowMessageNotificationModal(false)}
      />

      <ContextualNotificationModal
        context="like-flyer"
        isOpen={showLikeNotificationModal}
        onClose={() => setShowLikeNotificationModal(false)}
      />
    </div >
  );
}

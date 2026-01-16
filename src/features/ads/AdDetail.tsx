import { useQuery, useMutation } from "convex/react";
import { Header } from "../layout/Header";
import { HeaderRightActions } from "../layout/HeaderRightActions";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ReportModal } from "../../components/ReportModal";
import { StarRating } from "../../components/ui/StarRating";
import { RatingModal } from "../../components/RatingModal";
import { ReviewListModal } from "../../components/ReviewListModal";
import { useSession } from "@descope/react-sdk";
import { getDisplayName, getInitials } from "../../lib/displayName";
import { Flag, ChevronLeft, Share2, Heart, X, Frown, Image as ImageIcon, MapPin, ChevronRight, Send, Pencil, Repeat, MessageCircle } from "lucide-react";
import { ContextualNotificationModal } from "../../components/notifications/ContextualNotificationModal";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { SellerProfile } from "../../components/ui/SellerProfile";
import { ChatMessages } from "../../components/ui/ChatMessages";

import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { LocationMap } from "../../components/ui/LocationMap";
import { ImageLightbox } from "../../components/ui/ImageLightbox";
import { formatPriceWithCurrency } from "../../lib/priceFormatter";
import { trackView, setFlushCallback } from "../../lib/viewTracker";


interface AdDetailProps {
  adId: Id<"ads">;
  initialAd?: any; // Using any to avoid strict type matching issues with partial data
  onBack: () => void;
  onShowAuth: () => void;
}

export function AdDetail({ adId, initialAd, onBack, onShowAuth }: AdDetailProps) {
  const navigate = useNavigate();
  const [showChat, setShowChat] = useState(false);
  const [showMobileChatSheet, setShowMobileChatSheet] = useState(false);
  const [showMobileSellerSheet, setShowMobileSellerSheet] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [chatId, setChatId] = useState<Id<"chats"> | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportProfileModal, setShowReportProfileModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showReviewListModal, setShowReviewListModal] = useState(false);
  const [avatarImageError, setAvatarImageError] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [showMessageNotificationModal, setShowMessageNotificationModal] = useState(false);
  const [showLikeNotificationModal, setShowLikeNotificationModal] = useState(false);

  // Combined query for ad data, saved status, and existing chat
  const adContext = useQuery(api.adDetail.getAdWithContext, { adId });
  const ad = adContext?.ad;
  const isAdSaved = adContext?.isSaved ?? false;
  const existingChat = adContext?.existingChat;

  const messages = useQuery(
    api.adDetail.getChatMessages,
    chatId ? { chatId } : "skip"
  );

  const saveAd = useMutation(api.adDetail.saveAd);
  const sendFirstMessage = useMutation(api.adDetail.sendFirstMessage);
  const sendMessage = useMutation(api.adDetail.sendMessage);
  const batchIncrementViews = useMutation(api.adDetail.batchIncrementViews);

  // Use Descope for authentication state
  const { isAuthenticated } = useSession();
  // Get real user data from Convex
  const convexUser = useQuery(api.descopeAuth.getCurrentUser);
  const user = isAuthenticated ? convexUser : null;

  useEffect(() => {
    if (existingChat) {
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
    try {
      const result = await saveAd({ adId });
      toast.success(result.saved ? "Ad saved!" : "Ad removed from saved");

      // Show notification modal only when saving (not removing)
      if (result.saved) {
        setShowLikeNotificationModal(true);
      }
    } catch (error) {
      toast.error("Please sign in to save ads");
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/ad/${adId}`;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link to flyer copied to clipboard");
  };

  const handleStartChat = async () => {
    if (!user) {
      onShowAuth();
      return;
    }

    // Just show the chat UI - chat will be created when first message is sent
    setShowChat(true);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    try {
      if (!chatId) {
        // First message - create chat and send message atomically
        const result = await sendFirstMessage({ adId, content: messageText.trim() });
        setChatId(result.chatId);

        // Show notification modal after first message
        setShowMessageNotificationModal(true);
      } else {
        // Subsequent messages
        await sendMessage({ chatId, content: messageText.trim() });
      }
      setMessageText("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
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

  // If ad is explicitly null (loaded but not found), show not found state
  if (ad === null) {
    return (
      <div className="min-h-screen bg-background">
        <Header
          leftNode={
            <div className="flex items-center gap-6 flex-shrink-0">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to flyers</span>
              </button>
            </div>
          }
          centerNode={
            <h1 className="text-xl font-bold text-foreground cursor-pointer" onClick={onBack}>FlyerBoard</h1>
          }
          rightNode={<div />}
        />
        <div className="content-max-width mx-auto container-padding py-12 text-center">
          <div className="bg-card border border-border rounded-lg p-12 shadow-sm max-w-lg mx-auto">
            <Frown className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Ad Not Found</h2>
            <p className="text-muted-foreground mb-6">This ad may have been deleted or removed.</p>
            <button
              onClick={onBack}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              Return to Flyers
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayAd = ad || initialAd;

  // Auto-open chat for logged-in users viewing other users' ads
  useEffect(() => {
    if (user && displayAd && displayAd.userId !== user._id && !showChat) {
      handleStartChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, displayAd]);

  if (!displayAd) {
    return (
      <div className="bg-background flex flex-col">
        {/* Header skeleton */}
        <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
          <div className="content-max-width mx-auto container-padding">
            <div className="flex items-center justify-between h-14">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to flyers</span>
              </button>
              <h1 className="text-xl font-semibold text-foreground">Loading...</h1>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-lg animate-pulse"></div>
                <div className="w-10 h-10 bg-muted rounded-lg animate-pulse"></div>
              </div>
            </div>
          </div>
        </header>

        {/* Loading content - MATCHES LOADED STRUCTURE EXACTLY */}
        <div className="w-full flex-1 content-max-width mx-auto container-padding py-6 pb-bottom-nav md:pb-6">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Content - 70% */}
            <div className="lg:w-[70%] min-w-0 space-y-6">
              {/* Image Gallery skeleton */}
              <div className="bg-card rounded-lg overflow-hidden shadow-sm border border-border">
                <div className="relative aspect-video bg-muted shimmer"></div>
              </div>

              {/* Ad Information skeleton */}
              <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
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
              <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
                <div className="h-6 bg-muted rounded shimmer mb-4 w-1/4"></div>
                <div className="h-48 bg-muted rounded shimmer"></div>
              </div>
            </div>

            {/* Sidebar skeleton - 30% with sticky positioning */}
            <div className="lg:w-[30%] lg:max-w-[400px] sticky top-21 self-start">
              <div className="space-y-6">
                {/* Seller Info skeleton */}
                <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
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
                <div className="bg-card rounded-lg p-6 shadow-sm hidden sm:block border border-border">
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
      {/* Header */}
      <Header
        leftNode={
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
        }
        centerNode={
          <h1 className="text-xl font-bold text-foreground cursor-pointer" onClick={onBack}>FlyerBoard</h1>
        }
        rightNode={
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="p-2 rounded-lg bg-accent text-muted-foreground hover:bg-accent/80 transition-colors"
                title="Share flyer"
              >
                <Share2 className="w-5 h-5" />
              </button>
              {user && displayAd.userId !== user._id && (
                <>
                  <button
                    onClick={handleSave}
                    className={`p-2 rounded-lg transition-colors ${isAdSaved
                      ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                    title={isAdSaved ? "Remove from saved" : "Save ad"}
                  >
                    <Heart className="w-5 h-5" fill={isAdSaved ? "currentColor" : "none"} />
                  </button>
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="p-2 rounded-lg bg-accent text-muted-foreground hover:bg-accent/80 transition-colors sm:hidden"
                    title="Report flyer"
                  >
                    <Flag className="w-5 h-5" />
                  </button>
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
                    navigate('/post', { state: { from: `/ad/${adId}` } });
                  } else {
                    onShowAuth();
                  }
                }}
                onDashboardClick={() => navigate('/dashboard')}
                onSignInClick={onShowAuth}
              />
            </div>
          </div>
        }
      />

      <div className="w-full flex-1 content-max-width mx-auto container-padding py-6 pb-bottom-nav md:pb-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content - 70% of container width */}
          <div className="lg:w-[70%] min-w-0 space-y-6">
            {/* Image Gallery with Slider */}
            <div className="bg-card rounded-lg overflow-hidden shadow-sm border border-border">
              <div className="relative aspect-video bg-muted">
                {images.length > 0 ? (
                  <ImageDisplay
                    imageRef={images[currentImageIndex]}
                    alt={`${displayAd.title} - Image ${currentImageIndex + 1}`}
                    className="w-full h-full object-contain cursor-pointer"
                    variant="large"
                    onClick={() => setShowLightbox(true)}
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
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Image counter */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                )}
              </div>

              {/* Thumbnail strip for multiple images */}
              {images.length > 1 && (
                <div className="p-4 bg-muted">
                  <div className="flex gap-2 overflow-x-auto">
                    {images.map((image: string, index: number) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${index === currentImageIndex
                          ? 'border-primary ring-2 ring-primary ring-opacity-30'
                          : 'border-border hover:border-muted-foreground'
                          }`}
                      >
                        <ImageDisplay
                          imageRef={image}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                          variant="small"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ad Information */}
            <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground mb-2">{displayAd.title}</h1>
                  {/* Price display based on listing type */}
                  {(!displayAd.listingType || displayAd.listingType === "sale") && displayAd.price !== undefined && (
                    <p className="text-3xl font-bold text-primary">{formatPriceWithCurrency(displayAd.price)}</p>
                  )}
                  {displayAd.listingType === "exchange" && (
                    <p className="text-2xl font-bold text-primary-bright flex items-center gap-2">
                      <Repeat className="w-6 h-6" />
                      Open to Trade
                    </p>
                  )}
                  {displayAd.listingType === "both" && displayAd.price !== undefined && (
                    <p className="text-3xl font-bold text-primary flex items-center gap-2">
                      {formatPriceWithCurrency(displayAd.price)}
                      <span className="text-lg font-medium text-primary-bright">• Trade</span>
                    </p>
                  )}
                </div>
                <div className="text-right text-sm">
                  {ad ? (
                    <p><span className="text-primary-bright font-medium">{ad.views}</span> <span className="text-muted-foreground">views</span></p>
                  ) : (
                    <div className="h-5 w-16 bg-muted rounded animate-pulse ml-auto" />
                  )}
                  <p className="text-muted-foreground">Posted {timeAgo}</p>
                </div>
              </div>

              {/* Exchange Description - shown for exchange and both types */}
              {(displayAd.listingType === "exchange" || displayAd.listingType === "both") && displayAd.exchangeDescription && (
                <div className="mb-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <h3 className="text-sm font-semibold text-primary-bright mb-2 flex items-center gap-2">
                    <Repeat className="w-4 h-4" />
                    Looking for
                  </h3>
                  <p className="text-foreground/90">{displayAd.exchangeDescription}</p>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-foreground mb-3">Description</h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{displayAd.description}</p>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{displayAd.location}</span>
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-4">Location</h3>
              <LocationMap location={displayAd.location} />
            </div>
          </div>

          {/* Sidebar - 30% of container width, capped at 400px - Hidden on mobile, shown on desktop */}
          <div className="hidden lg:block lg:w-[30%] lg:max-w-[400px] sticky top-21 self-start">
            <div className="space-y-6">
              {/* Seller Info */}
              <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground mb-4">Seller Information</h3>
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
                      className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
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
                        onClick={handleStartChat}
                        className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:opacity-90 transition-colors font-medium mb-2"
                      >
                        Contact Seller
                      </button>
                    )}
                    <button
                      onClick={() => setShowRatingModal(true)}
                      className="w-full bg-transparent text-primary border border-primary py-2 px-4 rounded-lg hover:bg-primary/10 transition-colors font-medium"
                    >
                      Rate Seller
                    </button>
                  </>
                )}

                {user && displayAd.userId === user._id && (
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:opacity-90 transition-colors font-medium"
                  >
                    Manage Your Flyers
                  </button>
                )}

                {!user && (
                  <button
                    onClick={onShowAuth}
                    className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:opacity-90 transition-colors font-medium"
                  >
                    Sign in to contact seller
                  </button>
                )}
              </div>

              {/* Chat Section - Desktop only */}
              {showChat && (
                <div className="bg-card rounded-lg shadow-sm hidden lg:block border border-border">
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">Chat with Seller</h3>
                      <button
                        onClick={() => setShowChat(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>


                  <ChatMessages messages={messages || []} />


                  <div className={`p-4 ${messages && messages.length > 0 ? 'border-t border-border' : ''}`}>
                    <div className="flex gap-2">
                      <input
                        ref={chatInputRef}
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type your message..."
                        className="flex-1 px-3 py-2 border border-input bg-background rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground placeholder:text-muted-foreground"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!messageText.trim()}
                        className="bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-card border border-border rounded-lg p-6 shadow-sm hidden sm:block">
                <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  {user && displayAd.userId === user._id ? (
                    // Show Edit button for own flyers
                    <button
                      onClick={() => navigate('/post', { state: { editingAd: displayAd } })}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-primary text-white border border-primary hover:opacity-90 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit Flyer
                    </button>
                  ) : (
                    // Show Save and Report buttons for other users' flyers
                    user && (
                      <>
                        <button
                          onClick={handleSave}
                          className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all shadow-sm active:scale-[0.98] ${isAdSaved
                            ? 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20'
                            : 'bg-background text-foreground border border-border hover:bg-accent hover:border-muted-foreground'
                            }`}
                        >
                          <Heart className="w-4 h-4" fill={isAdSaved ? "currentColor" : "none"} />
                          {isAdSaved ? 'Remove from Saved' : 'Save Ad'}
                        </button>
                        <button
                          onClick={() => setShowReportModal(true)}
                          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-background text-foreground border border-border hover:bg-accent hover:border-muted-foreground transition-all shadow-sm active:scale-[0.98]"
                        >
                          <Flag className="w-4 h-4" />
                          Report Flyer
                        </button>
                      </>
                    )
                  )}
                  <button
                    onClick={handleShare}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-background text-foreground border border-border hover:bg-accent hover:border-muted-foreground transition-all shadow-sm active:scale-[0.98]"
                  >
                    <Share2 className="w-4 h-4" />
                    Share Flyer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile FABs - Using Portal to ensure fixed positioning works */}
      {user && displayAd.userId !== user._id && createPortal(
        <div className="lg:hidden">
          <button
            onClick={() => setShowMobileSellerSheet(true)}
            className="fixed right-4 bg-card border border-border p-2 rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all z-40"
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
            className="fixed right-4 bg-primary text-primary-foreground p-4 rounded-full shadow-lg hover:opacity-90 hover:scale-105 active:scale-95 transition-all z-40"
            style={{ bottom: 'calc(var(--bottom-nav-height) + 1rem)' }}
            title="Message Seller"
          >
            <MessageCircle className="w-6 h-6" />
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
              className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg hover:opacity-90 transition-opacity font-medium flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Message Seller
            </button>
            <button
              onClick={() => {
                setShowMobileSellerSheet(false);
                setShowRatingModal(true);
              }}
              className="w-full bg-card text-primary-bright border border-primary py-3 px-4 rounded-lg hover:bg-primary/5 transition-colors font-medium"
            >
              Rate Seller
            </button>
            <button
              onClick={() => {
                setShowMobileSellerSheet(false);
                setShowReportProfileModal(true);
              }}
              className="w-full bg-card text-muted-foreground border border-border py-3 px-4 rounded-lg hover:bg-accent transition-colors font-medium flex items-center justify-center gap-2"
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
        <ChatMessages messages={messages || []} />

        <div className={`p-4 ${messages && messages.length > 0 ? 'border-t border-border' : ''}`}>
          <div className="flex gap-2">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                  // Create chat if needed and show notification
                  if (!chatId) {
                    setShowChat(true);
                  }
                }
              }}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background text-foreground"
            />
            <button
              onClick={() => {
                handleSendMessage();
                if (!chatId) {
                  setShowChat(true);
                }
              }}
              disabled={!messageText.trim()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
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

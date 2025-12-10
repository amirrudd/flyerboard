
import { useQuery, useMutation } from "convex/react";
import { Header } from "../layout/Header";
import { HeaderRightActions } from "../layout/HeaderRightActions";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ReportModal } from "../../components/ReportModal";
import { StarRating } from "../../components/ui/StarRating";
import { RatingModal } from "../../components/RatingModal";
import { useSession } from "@descope/react-sdk";
import { getDisplayName, getInitials } from "../../lib/displayName";

import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { LocationMap } from "../../components/ui/LocationMap";


interface AdDetailProps {
  adId: Id<"ads">;
  initialAd?: any; // Using any to avoid strict type matching issues with partial data
  onBack: () => void;
  onShowAuth: () => void;
}

export function AdDetail({ adId, initialAd, onBack, onShowAuth }: AdDetailProps) {
  const navigate = useNavigate();
  const [showChat, setShowChat] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [chatId, setChatId] = useState<Id<"chats"> | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportProfileModal, setShowReportProfileModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [avatarImageError, setAvatarImageError] = useState(false);

  const ad = useQuery(api.adDetail.getAdById, { adId });
  const isAdSaved = useQuery(api.adDetail.isAdSaved, { adId });
  const existingChat = useQuery(api.adDetail.getChatForAd, { adId });
  const messages = useQuery(
    api.adDetail.getChatMessages,
    chatId ? { chatId } : "skip"
  );

  const saveAd = useMutation(api.adDetail.saveAd);
  const getOrCreateChat = useMutation(api.adDetail.getOrCreateChat);
  const sendMessage = useMutation(api.adDetail.sendMessage);
  const incrementViews = useMutation(api.adDetail.incrementViews);

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

  useEffect(() => {
    // Increment views when component mounts
    incrementViews({ adId }).catch(() => {
      // Ignore errors for view counting
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adId]); // Only re-run if adId changes

  const handleSave = async () => {
    try {
      const result = await saveAd({ adId });
      toast.success(result.saved ? "Ad saved!" : "Ad removed from saved");
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

    try {
      const newChatId = await getOrCreateChat({ adId });
      setChatId(newChatId);
      setShowChat(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to start chat");
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !chatId) return;

    try {
      await sendMessage({ chatId, content: messageText.trim() });
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
      <div className="min-h-screen bg-gray-50">
        <Header
          leftNode={
            <div className="flex items-center gap-6 flex-shrink-0">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to flyers
              </button>
            </div>
          }
          centerNode={
            <h1 className="text-xl font-bold text-gray-900 cursor-pointer" onClick={onBack}>FlyerBoard</h1>
          }
          rightNode={<div />}
        />
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <div className="bg-white rounded-lg p-12 shadow-sm max-w-lg mx-auto">
            <svg className="w-16 h-16 text-neutral-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-neutral-800 mb-2">Ad Not Found</h2>
            <p className="text-neutral-600 mb-6">This ad may have been deleted or removed.</p>
            <button
              onClick={onBack}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Return to Flyers
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayAd = ad || initialAd;

  if (!displayAd) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header skeleton */}
        <header className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to flyers
              </button>
              <h1 className="text-xl font-semibold text-neutral-800">Loading...</h1>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
                <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
              </div>
            </div>
          </div>
        </header>

        {/* Loading content */}
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                <div className="aspect-video bg-gray-200 animate-pulse"></div>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="h-8 bg-gray-200 rounded animate-pulse mb-4"></div>
                <div className="h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="h-6 bg-gray-200 rounded animate-pulse mb-4"></div>
                <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header
        leftNode={
          <div className="flex items-center gap-6 flex-shrink-0">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to flyers
            </button>
          </div>
        }
        centerNode={
          <h1 className="text-xl font-bold text-gray-900 cursor-pointer" onClick={onBack}>FlyerBoard</h1>
        }
        rightNode={
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="p-2 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-gray-200 transition-colors"
                title="Share flyer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
              </button>
              {user && displayAd.userId !== user._id && (
                <button
                  onClick={handleSave}
                  className={`p-2 rounded-lg transition-colors ${isAdSaved
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-gray-200'
                    }`}
                  title={isAdSaved ? "Remove from saved" : "Save ad"}
                >
                  <svg className="w-5 h-5" fill={isAdSaved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              )}
            </div>

            <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>

            <div className="hidden sm:flex items-center gap-4">
              <HeaderRightActions
                user={user}
                onPostClick={() => {
                  if (user) {
                    navigate('/post');
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

      <div className="flex-1 overflow-y-auto mobile-scroll-container lg:overflow-visible max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-bottom-nav">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery with Slider */}
            <div className="bg-white rounded-lg overflow-hidden shadow-sm">
              <div className="relative aspect-video bg-neutral-100">
                {images.length > 0 ? (
                  <ImageDisplay
                    imageRef={images[currentImageIndex]}
                    alt={`${displayAd.title} - Image ${currentImageIndex + 1}`}
                    className="w-full h-full object-contain"
                    variant="large"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-24 h-24 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-500">No images available</p>
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
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}

                {/* Image counter */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                )}
              </div>

              {/* Thumbnail strip for multiple images */}
              {images.length > 1 && (
                <div className="p-4 bg-neutral-100">
                  <div className="flex gap-2 overflow-x-auto">
                    {images.map((image: string, index: number) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${index === currentImageIndex
                          ? 'border-primary-600 ring-2 ring-primary-600 ring-opacity-30'
                          : 'border-neutral-200 hover:border-neutral-300'
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
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-neutral-800 mb-2">{displayAd.title}</h1>
                  <p className="text-3xl font-bold text-primary-600">${displayAd.price.toLocaleString()} AUD</p>
                </div>
                <div className="text-right text-sm text-neutral-500">
                  {ad ? (
                    <p>{ad.views} views</p>
                  ) : (
                    <div className="h-5 w-16 bg-gray-200 rounded animate-pulse ml-auto" />
                  )}
                  <p>Posted {timeAgo}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3">Description</h3>
                <p className="text-neutral-700 leading-relaxed">{displayAd.description}</p>
                {displayAd.extendedDescription && (
                  <div className="mt-4 pt-4 border-t border-neutral-200">
                    <h4 className="font-medium text-neutral-800 mb-2">Additional Details</h4>
                    <p className="text-neutral-700 leading-relaxed">{displayAd.extendedDescription}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-neutral-600">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{displayAd.location}</span>
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">Location</h3>
              <LocationMap location={displayAd.location} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Seller Info */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">Seller Information</h3>
              <div className="flex items-center gap-3 mb-4">
                {displayAd.seller?.image && !avatarImageError ? (
                  <ImageDisplay
                    src={displayAd.seller.image}
                    alt={displayAd.seller.name}
                    className="w-12 h-12 rounded-full object-cover"
                    onError={() => setAvatarImageError(true)}
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-neutral-600 font-semibold text-lg">
                    {displayAd.seller ? getInitials(displayAd.seller) : "U"}
                  </div>
                )}
                <div className="flex-1">
                  {displayAd.seller ? (
                    <p className="font-medium text-neutral-800 flex items-center gap-1">
                      {getDisplayName(displayAd.seller)}
                      {displayAd.seller.isVerified && (
                        <div title="Verified User" className="relative">
                          <img src="/verified-badge.svg" alt="Verified Seller" className="w-10 h-10" />
                        </div>
                      )}
                    </p>
                  ) : (
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2" />
                  )}
                  {displayAd.seller ? (
                    <StarRating
                      rating={displayAd.seller.averageRating || 0}
                      count={displayAd.seller.ratingCount || 0}
                      size="sm"
                      showCount={true}
                    />
                  ) : (
                    <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
                  )}
                </div>
                {user && displayAd.userId !== user._id && (
                  <button
                    onClick={() => setShowReportProfileModal(true)}
                    className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                    title="Report seller"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                  </button>
                )}
              </div>

              {user && displayAd.userId !== user._id && (
                <>
                  <button
                    onClick={handleStartChat}
                    className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium mb-2"
                  >
                    Contact Seller
                  </button>
                  <button
                    onClick={() => setShowRatingModal(true)}
                    className="w-full bg-white text-primary-600 border border-primary-600 py-2 px-4 rounded-lg hover:bg-primary-50 transition-colors font-medium"
                  >
                    Rate Seller
                  </button>
                </>
              )}

              {user && displayAd.userId === user._id && (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Manage Your Flyers
                </button>
              )}

              {!user && (
                <button
                  onClick={onShowAuth}
                  className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Sign in to contact seller
                </button>
              )}
            </div>

            {/* Chat Section */}
            {showChat && chatId && (
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-4 border-b border-neutral-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-neutral-800">Chat with Seller</h3>
                    <button
                      onClick={() => setShowChat(false)}
                      className="text-neutral-500 hover:text-neutral-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="h-64 overflow-y-auto p-4 space-y-3">
                  {messages?.map((message) => (
                    <div
                      key={message._id}
                      className={`flex ${message.isCurrentUser ? 'justify-end' : 'justify-start'} `}
                    >
                      <div
                        className={`max-w-xs px-3 py-2 rounded-lg ${message.isCurrentUser
                          ? 'bg-primary-600 text-white'
                          : 'bg-neutral-100 text-neutral-900'
                          }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${message.isCurrentUser ? 'text-orange-200' : 'text-neutral-500'
                          }`}>
                          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-neutral-200">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type your message..."
                      className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageText.trim()}
                      className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                {user && displayAd.userId === user._id ? (
                  // Show Edit button for own flyers
                  <button
                    onClick={() => navigate('/post', { state: { editingAd: displayAd } })}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-primary-600 text-white border border-primary-600 hover:bg-primary-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Flyer
                  </button>
                ) : (
                  // Show Save and Report buttons for other users' flyers
                  user && (
                    <>
                      <button
                        onClick={handleSave}
                        className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-colors ${isAdSaved
                          ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                          : 'bg-neutral-100 text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                          }`}
                      >
                        <svg className="w-4 h-4" fill={isAdSaved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {isAdSaved ? 'Remove from Saved' : 'Save Ad'}
                      </button>
                      <button
                        onClick={() => setShowReportModal(true)}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-100 hover:border-neutral-400 hover:text-neutral-900 transition-all shadow-sm active:scale-[0.98]"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                        Report Flyer
                      </button>
                    </>
                  )
                )}
                <button
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-100 hover:border-neutral-400 hover:text-neutral-900 transition-all shadow-sm active:scale-[0.98]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                  Share Flyer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

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
        <RatingModal
          isOpen={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          userId={displayAd.userId}
          userName={getDisplayName(displayAd.seller)}
          chatId={chatId || undefined}
        />
      )}
    </div >
  );
}

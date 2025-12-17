import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { Id } from "../../../convex/_generated/dataModel";
import { AdDetail } from "../ads/AdDetail";
import { AdMessages } from "../ads/AdMessages";
import { SignOutButton } from "../auth/SignOutButton";
import { Header } from "../layout/Header";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useSession, useUser } from "@descope/react-sdk";
import { getDisplayName, getInitials } from "../../lib/displayName";
import { uploadImageToR2 } from "../../lib/uploadToR2";
import {
  LayoutDashboard,
  MessageSquare,
  Heart,
  Archive,
  User,
  Plus,
  LogOut,
  ChevronLeft,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  MapPin,
  Search,
  Filter,
  Image as ImageIcon
} from "lucide-react";
import { StarRating } from "../../components/ui/StarRating";
import { UserProfileSkeleton, AdListingSkeleton, SavedAdSkeleton, ChatItemSkeleton } from "../../components/ui/DashboardSkeleton";

interface UserDashboardProps {
  onBack: () => void;
  onPostAd: () => void;
  onEditAd: (ad: any) => void;
}

export function UserDashboard({ onBack, onPostAd, onEditAd }: UserDashboardProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as "ads" | "chats" | "saved" | "profile" | "archived" | null;

  const [activeTab, setActiveTab] = useState<"ads" | "chats" | "saved" | "profile" | "archived">(tabParam || "ads");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAccountDeleteConfirm, setShowAccountDeleteConfirm] = useState(false);
  const [profileData, setProfileData] = useState({ name: "", email: "" });
  const [nameError, setNameError] = useState<string>("");
  const [selectedAdId, setSelectedAdId] = useState<Id<"ads"> | null>(null);
  const [showMessagesForAd, setShowMessagesForAd] = useState<Id<"ads"> | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<Id<"chats"> | null>(null);
  const [expandedChatId, setExpandedChatId] = useState<Id<"chats"> | null>(null);
  const [selectedArchivedChats, setSelectedArchivedChats] = useState<Set<Id<"chats">>>(new Set());
  const [newMessage, setNewMessage] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState(false);

  // Refs for tab content sections (for mobile auto-scroll)
  const adsContentRef = useRef<HTMLDivElement>(null);
  const chatsContentRef = useRef<HTMLDivElement>(null);
  const savedContentRef = useRef<HTMLDivElement>(null);
  const profileContentRef = useRef<HTMLDivElement>(null);
  const archivedContentRef = useRef<HTMLDivElement>(null);

  // Track whether we should scroll to content (only on manual sidebar clicks)
  const [shouldScrollToContent, setShouldScrollToContent] = useState(false);

  // Name validation function
  const validateName = (name: string): { valid: boolean; error: string } => {
    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      return { valid: false, error: "Name cannot be empty" };
    }

    if (trimmedName.length < 2) {
      return { valid: false, error: "Name must be at least 2 characters long" };
    }

    if (trimmedName.length > 15) {
      return { valid: false, error: "Name cannot exceed 15 characters" };
    }

    const validNamePattern = /^[a-zA-Z\s\-']+$/;
    if (!validNamePattern.test(trimmedName)) {
      return { valid: false, error: "Name can only contain letters, spaces, hyphens, and apostrophes" };
    }

    return { valid: true, error: "" };
  };

  // Use Descope for authentication state
  const { isAuthenticated } = useSession();
  const { user: descopeUser } = useUser();

  // Fetch real user data from Convex
  const convexUser = useQuery(api.descopeAuth.getCurrentUser);

  // Use Convex user data if available, otherwise fall back to Descope session info or null
  const user = isAuthenticated ? (convexUser || {
    name: descopeUser?.name || descopeUser?.email?.split('@')[0] || "Loading...",
    email: descopeUser?.email || "",
    _id: "temp-id" as Id<"users">,
    image: descopeUser?.picture || undefined,
    isVerified: false
  }) : null;
  const userAds = useQuery(api.posts.getUserAds);
  const userStats = useQuery(api.users.getUserStats);
  const sellerChats = useQuery(api.posts.getSellerChats);
  const buyerChats = useQuery(api.posts.getBuyerChats);
  const savedAds = useQuery(api.adDetail.getSavedAds);
  const archivedChats = useQuery(
    api.messages.getArchivedChats,
    user && activeTab === "archived" ? {} : "skip"
  );

  // Get messages for expanded chat
  const chatMessages = useQuery(
    api.messages.getChatMessages,
    expandedChatId ? { chatId: expandedChatId } : "skip"
  );

  // Get unread counts for all user ads
  const unreadCounts = useQuery(
    api.messages.getUnreadCounts,
    userAds ? { adIds: userAds.map(ad => ad._id) } : "skip"
  );

  const deleteAd = useMutation(api.posts.deleteAd);
  const toggleAdStatus = useMutation(api.posts.toggleAdStatus);
  const generateProfileUploadUrl = useAction(api.upload_urls.generateProfileUploadUrl);
  const updateProfile = useMutation(api.users.updateProfile);
  const deleteAccount = useMutation(api.users.deleteAccount);
  const sendMessage = useMutation(api.messages.sendMessage);
  const markAsRead = useMutation(api.messages.markChatAsRead);
  const archiveChat = useMutation(api.messages.archiveChat);
  const deleteArchivedChats = useMutation(api.messages.deleteArchivedChats);
  const verifyIdentity = useMutation(api.users.verifyIdentity);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Mark chat as read when expanded
  useEffect(() => {
    if (expandedChatId) {
      markAsRead({ chatId: expandedChatId });
    }
  }, [expandedChatId, markAsRead]);

  // Initialize profile form data when user data is loaded
  useEffect(() => {
    if (user && user._id !== "temp-id") {
      setProfileData({
        name: user.name || "",
        email: user.email || ""
      });
    }
  }, [user]);

  // Sync activeTab with URL search params (for bottom nav navigation)
  useEffect(() => {
    const tabParam = searchParams.get("tab") as "ads" | "chats" | "saved" | "profile" | "archived" | null;
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams, activeTab]);

  // Auto-scroll to content on mobile when tab changes (only if triggered by sidebar click)
  useEffect(() => {
    // Only scroll on mobile devices (below lg breakpoint)
    const isMobile = window.innerWidth < 1024;
    if (!isMobile || !shouldScrollToContent) return;

    // Small delay to ensure content is rendered
    const timer = setTimeout(() => {
      const refMap = {
        ads: adsContentRef,
        chats: chatsContentRef,
        saved: savedContentRef,
        profile: profileContentRef,
        archived: archivedContentRef,
      };

      const targetRef = refMap[activeTab];
      if (targetRef?.current) {
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // Reset the flag after scrolling
      setShouldScrollToContent(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [activeTab, shouldScrollToContent]);

  const handleDeleteAd = async (adId: string) => {
    try {
      await deleteAd({ adId: adId as any });
      toast.success("Flyer deleted successfully");
      setShowDeleteConfirm(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete flyer");
    }
  };

  const handleToggleStatus = async (adId: string) => {
    try {
      const result = await toggleAdStatus({ adId: adId as any });
      toast.success(result?.isActive ? "Flyer activated" : "Flyer deactivated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update flyer status");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (user?._id === "temp-id") {
      toast.error("Please wait for profile sync to complete");
      return;
    }

    // Validate name before submitting
    const nameValidation = validateName(profileData.name);
    if (!nameValidation.valid) {
      setNameError(nameValidation.error);
      toast.error(nameValidation.error);
      return;
    }

    // Clear any previous errors
    setNameError("");

    try {
      await updateProfile(profileData);
      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      toast.success("Account deleted successfully");
      onBack();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete account");
    }
  };

  const handleVerifyIdentity = async () => {
    try {
      await verifyIdentity();
      toast.success("Identity verified successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to verify identity");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !expandedChatId) return;

    try {
      await sendMessage({
        chatId: expandedChatId,
        content: newMessage.trim(),
      });
      setNewMessage("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    }
  };

  const handleChatClick = (chatId: Id<"chats">) => {
    if (expandedChatId === chatId) {
      setExpandedChatId(null);
    } else {
      setExpandedChatId(chatId);
    }
  };

  const handleViewFlyer = (adId: Id<"ads">) => {
    navigate(`/ad/${adId}`);
    // Mark as read when viewing flyer
    if (expandedChatId) {
      markAsRead({ chatId: expandedChatId });
    }
  };

  const handleArchiveChat = async (chatId: Id<"chats">) => {
    try {
      await archiveChat({ chatId });
      toast.success("Chat archived successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to archive chat");
    }
  };

  const handleDeleteArchivedChats = async () => {
    if (selectedArchivedChats.size === 0) return;

    try {
      await deleteArchivedChats({ chatIds: Array.from(selectedArchivedChats) });
      toast.success("Selected chats deleted successfully");
      setSelectedArchivedChats(new Set());
    } catch (error: any) {
      toast.error(error.message || "Failed to delete chats");
    }
  };

  const handleSelectArchivedChat = (chatId: Id<"chats">) => {
    const newSelected = new Set(selectedArchivedChats);
    if (newSelected.has(chatId)) {
      newSelected.delete(chatId);
    } else {
      newSelected.add(chatId);
    }
    setSelectedArchivedChats(newSelected);
  };

  const handleSelectAllArchivedChats = () => {
    if (selectedArchivedChats.size === (archivedChats || []).length) {
      setSelectedArchivedChats(new Set());
    } else {
      setSelectedArchivedChats(new Set((archivedChats || []).map(chat => chat._id)));
    }
  };

  const handleProfileImageClick = () => {
    profileImageInputRef.current?.click();
  };

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setUploadProgress(0);

    try {
      // Get presigned URL with proper folder structure (profiles/{userId}/{uuid})
      const { url: uploadUrl, key } = await generateProfileUploadUrl();

      // Upload directly to R2 with compression and progress tracking
      await uploadImageToR2(
        file,
        async () => uploadUrl,
        async () => null, // No metadata sync needed
        (percent) => setUploadProgress(percent)
      );

      // Update profile with R2 reference
      await updateProfile({ image: key });

      // Reset image error to force refresh
      setImageError(false);

      toast.success("Profile picture updated successfully");
    } catch (error: any) {
      console.error('Profile image upload error:', error);
      toast.error(error.message || "Failed to upload profile picture");
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
      // Reset input
      if (profileImageInputRef.current) {
        profileImageInputRef.current.value = '';
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Please sign in</h2>
          <button
            onClick={onBack}
            className="text-primary-600 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // Show ad messages if selected
  if (showMessagesForAd) {
    return (
      <AdMessages
        adId={showMessagesForAd}
        onBack={() => setShowMessagesForAd(null)}
      />
    );
  }

  // Show ad detail if an ad is selected
  if (selectedAdId) {
    return (
      <AdDetail
        adId={selectedAdId}
        onBack={() => setSelectedAdId(null)}
        onShowAuth={() => { }}
      />
    );
  }

  return (
    <>
      <div className="bg-white">
        <Header
          leftNode={
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden md:inline">back</span>
            </button>
          }
          centerNode={
            <h1 className="text-xl font-bold text-gray-900">
              <span className="md:hidden">My dashboard</span>
              <span className="hidden md:inline">FlyerBoard</span>
            </h1>
          }
          rightNode={
            <>
              <div className="md:hidden">
                <SignOutButton onSignOut={onBack} iconOnly />
              </div>
              <div className="hidden md:block">
                <SignOutButton onSignOut={onBack} />
              </div>
            </>
          }
        />

        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-6 pb-bottom-nav">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              {!convexUser || userStats === undefined ? (
                <UserProfileSkeleton />
              ) : (
                <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
                  <input
                    ref={profileImageInputRef}
                    type="file"
                    accept="image/*,.heic,.heif"
                    onChange={handleProfileImageUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      onClick={handleProfileImageClick}
                      className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-neutral-600 font-semibold cursor-pointer hover:opacity-80 transition-opacity relative overflow-hidden"
                      title="Click to upload profile picture"
                    >
                      {uploadingImage ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                      ) : user.image && !imageError ? (
                        <ImageDisplay
                          imageRef={user.image}
                          alt="Profile"
                          className="w-full h-full object-cover"
                          onError={() => setImageError(true)}
                        />
                      ) : (
                        getInitials(user)
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-800 max-w-[120px] truncate">{getDisplayName(user)}</h3>
                        {user.isVerified && (
                          <div title="Verified User" className="relative">
                            <img src="/verified-badge.svg" alt="Verified User" className="w-11 h-11" />
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setActiveTab("profile");
                            setSearchParams({ tab: "profile" });
                          }}
                          className="p-1 rounded-md text-gray-500 hover:text-primary-600 hover:bg-gray-100 transition-colors"
                          title="Edit profile"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary-600">{userStats!.totalAds}</div>
                      <div className="text-xs text-gray-500">Total Ads</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary-600">{userStats!.totalViews}</div>
                      <div className="text-xs text-gray-500">Total Views</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <StarRating
                      rating={userStats!.averageRating || 0}
                      count={userStats!.ratingCount || 0}
                      size="sm"
                      showCount={true}
                    />
                  </div>
                </div>
              )}

              <nav className="bg-white rounded-lg p-4 shadow-sm">
                <div className="space-y-2">
                  {[
                    { id: "ads", label: "My Flyers", icon: LayoutDashboard },
                    {
                      id: "chats",
                      label: "Messages",
                      icon: MessageSquare,
                      badge: buyerChats ? buyerChats.reduce((total: number, chat: any) => total + (chat.unreadCount || 0), 0) : 0
                    },
                    { id: "saved", label: "Saved Flyers", icon: Heart },
                    { id: "archived", label: "Archived", icon: Archive },
                    { id: "profile", label: "Profile", icon: User },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setSearchParams({ tab: tab.id });
                        // Trigger scroll when clicking sidebar menu
                        setShouldScrollToContent(true);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 text-sm font-medium flex items-center justify-between ${activeTab === tab.id ? 'text-primary-700 bg-primary-50' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? "text-primary-700" : "text-gray-500"}`} />
                        <span>{tab.label}</span>
                      </div>
                      {tab.badge && tab.badge > 0 && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${activeTab === tab.id
                          ? 'bg-primary-600 text-white'
                          : 'bg-primary-600 text-white'
                          }`}>
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </nav>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              {activeTab === "ads" && (
                <div ref={adsContentRef} className="bg-white rounded-lg p-3 sm:p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-800">My Flyers</h2>
                    <button
                      onClick={onPostAd}
                      className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                    >
                      Pin Next Flyer
                    </button>
                  </div>

                  <div className="space-y-4">
                    {userAds === undefined ? (
                      // Loading state - show skeletons
                      <>
                        <AdListingSkeleton />
                        <AdListingSkeleton />
                        <AdListingSkeleton />
                      </>
                    ) : userAds.length === 0 ? (
                      // Empty state
                      <div className="text-center py-12">
                        <div className="flex justify-center mb-4"><LayoutDashboard className="w-16 h-16 text-gray-300" /></div>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">No Flyers Yet</h3>
                        <p className="text-gray-600 mb-4">Start by pinning your first flyer</p>
                        <button
                          onClick={onPostAd}
                          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                        >
                          Pin Your First Flyer
                        </button>
                      </div>
                    ) : (
                      // Loaded state - show ads
                      userAds.map((ad) => (
                        <div
                          key={ad._id}
                          className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
                          onClick={() => onEditAd(ad)}
                        >
                          {/* Mobile: Vertical layout, Desktop: Horizontal layout */}
                          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                            {/* Image */}
                            {ad.images[0] ? (
                              <ImageDisplay
                                imageRef={ad.images[0]}
                                alt={ad.title}
                                className="w-full sm:w-20 h-32 sm:h-20 object-cover rounded-lg"
                              />
                            ) : (
                              <div className="w-full sm:w-20 h-32 sm:h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                                <ImageIcon className="w-8 h-8 text-gray-400" />
                              </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {/* Title and Price */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="font-semibold text-gray-800 flex-1 min-w-0">{ad.title}</h3>
                                <p className="text-lg font-bold text-primary-600 whitespace-nowrap">
                                  ${ad.price.toLocaleString()}
                                </p>
                              </div>

                              {/* Stats and Status */}
                              <div className="flex items-center gap-3 mb-3 text-sm text-gray-500">
                                <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {ad.views}</span>
                                <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${ad.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                  {ad.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  {ad.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMessagesForAd(ad._id);
                                  }}
                                  className="relative p-2 md:px-3 md:py-1 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-1"
                                  title="Messages"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  <span className="hidden md:inline">Messages</span>
                                  {unreadCounts && unreadCounts[ad._id] > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                      {unreadCounts[ad._id]}
                                    </span>
                                  )}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleStatus(ad._id);
                                  }}
                                  className="p-2 md:px-3 md:py-1 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-1"
                                  title={ad.isActive ? 'Deactivate' : 'Activate'}
                                >
                                  {ad.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4 text-green-600" />}
                                  <span className="hidden md:inline">{ad.isActive ? 'Deactivate' : 'Activate'}</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditAd(ad);
                                  }}
                                  className="p-2 md:px-3 md:py-1 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-1"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                  <span className="hidden md:inline">Edit</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === "chats" && (
                <div ref={chatsContentRef} className="bg-white rounded-lg p-6 shadow-sm">
                  <h2 className="text-xl font-semibold text-gray-800 mb-6">My Messages</h2>
                  <p className="text-gray-600 mb-6">Conversations for flyers you're interested in</p>

                  <div className="space-y-4">
                    {buyerChats === undefined ? (
                      // Loading state - show skeletons
                      <>
                        <ChatItemSkeleton />
                        <ChatItemSkeleton />
                      </>
                    ) : buyerChats.length === 0 ? (
                      // Empty state
                      <div className="text-center py-12">
                        <div className="flex justify-center mb-4"><MessageSquare className="w-16 h-16 text-gray-300" /></div>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">No messages yet</h3>
                        <p className="text-gray-600">Start a conversation by messaging sellers on flyers you're interested in</p>
                      </div>
                    ) : (
                      // Loaded state - show chats
                      buyerChats.map((chat: any) => (
                        <div key={chat._id} className="border border-gray-200 rounded-lg overflow-hidden">
                          {/* Chat Header */}
                          <div
                            onClick={() => handleChatClick(chat._id)}
                            className="p-4 hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4 flex-1">
                                {chat.ad?.images?.[0] ? (
                                  <ImageDisplay
                                    imageRef={chat.ad.images[0]}
                                    alt={chat.ad.title}
                                    className="w-16 h-16 object-cover rounded-lg"
                                  />
                                ) : (
                                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                                    <ImageIcon className="w-6 h-6 text-gray-400" />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <h3 className="font-semibold text-gray-800 mb-1">
                                        {chat.ad?.title || "Deleted Flyer"}
                                      </h3>
                                      {!chat.ad?.isActive && chat.ad && (
                                        <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full mb-1">
                                          Flyer Inactive
                                        </span>
                                      )}
                                      <p className="text-sm text-gray-600 mb-1">
                                        Seller: {getDisplayName(chat.seller)}
                                      </p>
                                      {chat.seller && (
                                        <StarRating
                                          rating={chat.seller.averageRating || 0}
                                          count={chat.seller.ratingCount || 0}
                                          size="sm"
                                          showCount={false}
                                        />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {chat.ad && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewFlyer(chat.ad!._id);
                                          }}
                                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                        >
                                          View Flyer
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleArchiveChat(chat._id);
                                        }}
                                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                                      >
                                        Archive
                                      </button>
                                      {chat.unreadCount > 0 && (
                                        <span className="bg-primary-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium">
                                          {chat.unreadCount}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {chat.latestMessage && (
                                    <p className="text-sm text-gray-500 line-clamp-2">
                                      "{chat.latestMessage.content}"
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between mt-2">
                                    <p className="text-xs text-gray-400">
                                      {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: true })}
                                    </p>
                                    <div className="text-lg font-bold text-primary-600">
                                      ${chat.ad?.price?.toLocaleString() || 0} AUD
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Chat Messages */}
                          {expandedChatId === chat._id && (
                            <div className="border-t border-gray-200">
                              {/* Messages */}
                              <div className="max-h-96 overflow-y-auto p-4 space-y-3 bg-gray-100" style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
                                {(chatMessages || []).map((message) => (
                                  <div
                                    key={message._id}
                                    className={`flex ${message.senderId === user._id ? 'justify-end' : 'justify-start'
                                      }`}
                                  >
                                    <div
                                      className={`max-w-xs px-3 py-2 rounded-lg ${message.senderId === user._id
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-white text-gray-900 border border-gray-200'
                                        }`}
                                    >
                                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                      <p
                                        className={`text-xs mt-1 ${message.senderId === user._id
                                          ? 'text-white/70'
                                          : 'text-gray-500'
                                          }`}
                                      >
                                        {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                                <div ref={messagesEndRef} />
                              </div>

                              {/* Message Input */}
                              <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type your message..."
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                                    disabled={!chat.ad?.isActive}
                                  />
                                  <button
                                    type="submit"
                                    disabled={!newMessage.trim() || !chat.ad?.isActive}
                                    className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Send
                                  </button>
                                </div>
                                {!chat.ad?.isActive && (
                                  <p className="text-xs text-red-600 mt-2">
                                    Cannot send messages - flyer is inactive or deleted
                                  </p>
                                )}
                              </form>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === "saved" && (
                <div ref={savedContentRef} className="bg-white rounded-lg p-6 shadow-sm">
                  <h2 className="text-xl font-semibold text-gray-800 mb-6">Saved Ads</h2>

                  <div className="grid gap-4">
                    {savedAds === undefined ? (
                      // Loading state - show skeletons
                      <>
                        <SavedAdSkeleton />
                        <SavedAdSkeleton />
                      </>
                    ) : savedAds.length === 0 ? (
                      // Empty state
                      <div className="text-center py-12">
                        <div className="flex justify-center mb-4"><Heart className="w-16 h-16 text-gray-300" /></div>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">No saved ads</h3>
                        <p className="text-gray-600">Save ads you're interested in to view them here</p>
                      </div>
                    ) : (
                      // Loaded state - show saved ads
                      savedAds.filter(savedAd => savedAd.ad).map((savedAd) => (
                        <div
                          key={savedAd._id}
                          onClick={() => setSelectedAdId(savedAd.ad!._id)}
                          className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300 hover:border-primary-600 cursor-pointer group"
                        >
                          <div className="flex items-start gap-4">
                            <ImageDisplay
                              src={savedAd.ad!.images[0] || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop'}
                              alt={savedAd.ad!.title}
                              className="w-20 h-20 object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-800 mb-1 group-hover:text-primary-600 transition-colors">
                                {savedAd.ad!.title}
                              </h3>
                              <p className="text-lg font-bold text-primary-600 mb-2">
                                ${savedAd.ad!.price.toLocaleString()} AUD
                              </p>
                              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                {savedAd.ad!.description}
                              </p>
                              <div className="flex items-center justify-between text-sm text-gray-500">
                                <span>{savedAd.ad!.location}</span>
                                <span>{savedAd.ad!.views} views</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === "profile" && (
                <div ref={profileContentRef} className="bg-white rounded-lg p-6 shadow-sm">
                  <h2 className="text-xl font-semibold text-gray-800 mb-6">Profile Settings</h2>

                  <form onSubmit={handleUpdateProfile} className="space-y-4 mb-8">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                      <input
                        type="text"
                        value={profileData.name}
                        onChange={(e) => {
                          setProfileData(prev => ({ ...prev, name: e.target.value }));
                          // Clear error when user starts typing
                          if (nameError) setNameError("");
                        }}
                        maxLength={15}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none ${nameError ? 'border-red-500' : 'border-gray-300'
                          }`}
                        placeholder={getDisplayName(user)}
                      />
                      {nameError && (
                        <p className="text-sm text-red-600 mt-1">{nameError}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                        placeholder={user.email || "Enter your email"}
                      />
                    </div>

                    <button
                      type="submit"
                      className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                    >
                      Update Profile
                    </button>
                  </form>

                  <div className="border-t border-gray-200 pt-6 mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Identity Verification</h3>
                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          Status: {user.isVerified ? (
                            <span className="text-primary-600 flex items-center gap-1">
                              Verified
                              <img src="/verified-badge.svg" alt="Verified" className="w-16 h-16" />
                            </span>
                          ) : (
                            <span className="text-gray-500">Unverified</span>
                          )}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {user.isVerified
                            ? "Your identity has been verified. A badge is displayed on your profile and flyers."
                            : "Verify your identity to build trust with other users and get a verified badge."}
                        </p>
                      </div>
                      {!user.isVerified && (
                        <button
                          onClick={handleVerifyIdentity}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Verify Identity
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h3>
                    <p className="text-gray-600 mb-4">
                      Deleting your account will permanently remove all your data, including ads, messages, and saved items. This action cannot be undone.
                    </p>
                    <button
                      onClick={() => setShowAccountDeleteConfirm(true)}
                      className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "archived" && (
                <div ref={archivedContentRef} className="bg-white rounded-lg p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-800">Archived Messages</h2>
                    {(archivedChats || []).length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSelectAllArchivedChats}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                        >
                          {selectedArchivedChats.size === (archivedChats || []).length ? 'Deselect All' : 'Select All'}
                        </button>
                        {selectedArchivedChats.size > 0 && (
                          <button
                            onClick={handleDeleteArchivedChats}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                          >
                            Delete Selected ({selectedArchivedChats.size})
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {(archivedChats || []).length === 0 ? (
                      <div className="text-center py-12">
                        <div className="flex justify-center mb-4"><Archive className="w-16 h-16 text-gray-300" /></div>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">No archived messages</h3>
                        <p className="text-gray-600">Archived conversations will appear here</p>
                      </div>
                    ) : (
                      <div>Archived chats will be displayed here</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Flyer Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeleteConfirm(null)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Delete Flyer</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this flyer? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAd(showDeleteConfirm)}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Account Confirmation Modal */}
      {showAccountDeleteConfirm && createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAccountDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-red-600 mb-4">Delete Account</h3>
            <p className="text-gray-600 mb-6">
              Are you absolutely sure? This will permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowAccountDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

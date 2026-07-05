import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { Id } from "../../../convex/_generated/dataModel";
import { AdDetail } from "../ads/AdDetail";
import { AdMessages } from "../ads/AdMessages";
import { SignOutButton } from "../auth/SignOutButton";
import { useHeaderSlots } from "../layout/HeaderSlots";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useSession, useUser } from "@descope/react-sdk";
import { useUserSync } from "../../context/UserSyncContext";
import { ReportModal } from "../../components/ReportModal";
import {
  useInbox,
  useTotalUnreadCount,
  InboxRow,
  ConversationThread,
  MessageComposer,
  ConversationHeader,
  isSaleThread,
  getCounterpartName,
  getItemTitle,
} from "../messages";
import type { InboxFilter } from "../messages";
import { getDisplayName, getInitials } from "../../lib/displayName";
import { uploadImageToR2 } from "../../lib/uploadToR2";
import { useDeviceInfo } from "../../hooks/useDeviceInfo";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import { formatPrice, formatPriceWithCurrency } from "../../lib/priceFormatter";
import {
  SquaresFour,
  ChatText,
  BookmarkSimple,
  Archive,
  User,
  CaretLeft,
  PencilSimple,
  Eye,
  CheckCircle,
  XCircle,
  MapPin,
  Image as ImageIcon,
  Envelope,
  Package,
  X
} from '@phosphor-icons/react';
import { MovingSalesTab } from "./MovingSalesTab";
import { StarRating } from "../../components/ui/StarRating";
import { UserProfileSkeleton, AdListingSkeleton, SavedAdSkeleton, ChatItemSkeleton } from "../../components/ui/DashboardSkeleton";
import { ThemeToggle } from "../../components/ThemeToggle";

// Feature flags removed - now using database-driven flags

// Segmented filter options for the unified inbox (chats tab).
const INBOX_FILTERS: Array<{ id: InboxFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "selling", label: "Selling" },
  { id: "buying", label: "Buying" },
];

// Per-filter empty-state copy (from the unified-messaging contract).
const INBOX_EMPTY_COPY: Record<InboxFilter, { title: string; body: string }> = {
  all: {
    title: "No messages yet",
    body: "Conversations with buyers and sellers will appear here",
  },
  selling: {
    title: "No buyer messages yet",
    body: "When someone messages you about a flyer, it shows up here",
  },
  buying: {
    title: "Nothing here yet",
    body: "Message a seller from any flyer to start a conversation",
  },
};

function CountUp({ value, reduced }: { value: number; reduced: boolean }) {
  const motionValue = useMotionValue(reduced ? value : 0);
  const rounded = useTransform(motionValue, Math.round);

  useEffect(() => {
    if (reduced) return;
    const controls = animate(motionValue, value, { duration: 0.7, ease: "easeOut" });
    return controls.stop;
  }, [value, reduced]);

  return <motion.span>{rounded}</motion.span>;
}

interface UserDashboardProps {
  onBack: () => void;
  onPostAd: () => void;
  onEditAd: (ad: any) => void;
}

export function UserDashboard({ onBack, onPostAd, onEditAd }: UserDashboardProps) {
  const navigate = useNavigate();
  const { whileInView, reduced } = useMotionPrefs();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as "ads" | "chats" | "saved" | "sales" | "profile" | "archived" | null;
  const { isMobile } = useDeviceInfo();

  const [activeTab, setActiveTab] = useState<"ads" | "chats" | "saved" | "sales" | "profile" | "archived">(tabParam || "ads");
  const movingSaleModeEnabled = useFeatureFlag("movingSaleMode");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAccountDeleteConfirm, setShowAccountDeleteConfirm] = useState(false);
  const [profileData, setProfileData] = useState({ name: "", email: "" });
  const [nameError, setNameError] = useState<string>("");
  const [emailError, setEmailError] = useState<string>("");
  const [selectedAdId, setSelectedAdId] = useState<Id<"ads"> | null>(null);
  const [showMessagesForAd, setShowMessagesForAd] = useState<Id<"ads"> | null>(null);
  const [selectedArchivedChats, setSelectedArchivedChats] = useState<Set<Id<"chats">>>(new Set());
  const [showReportModal, setShowReportModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
  const scrollIntentRef = useRef<'top' | 'content' | null>(null);

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

  // Email validation function
  const validateEmail = (email: string): { valid: boolean; error: string } => {
    const trimmedEmail = email.trim();

    if (trimmedEmail.length === 0) {
      return { valid: true, error: "" }; // Empty is valid (optional field)
    }

    if (trimmedEmail.length > 50) {
      return { valid: false, error: "Email cannot exceed 50 characters" };
    }

    // Minimum length check for local part (before @)
    const atIndex = trimmedEmail.indexOf('@');
    if (atIndex !== -1 && atIndex < 2) {
      return { valid: false, error: "Email local part must be at least 2 characters" };
    }

    // Standard email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return { valid: false, error: "Please enter a valid email address" };
    }

    return { valid: true, error: "" };
  };

  // Use Descope for authentication state
  const { isAuthenticated, isSessionLoading } = useSession();
  const { user: descopeUser } = useUser();
  const { isUserSynced } = useUserSync();
  // Standard auth gate for Convex queries/mutations (see CLAUDE.md user-sync race)
  const authReady = isAuthenticated && !isSessionLoading && isUserSynced;

  // Combined query for user data and stats - reduces 2 function calls to 1
  const userWithStats = useQuery(api.descopeAuth.getCurrentUserWithStats);
  const convexUser = userWithStats?.user;
  const userStats = userWithStats?.stats;

  // Use Convex user data if available, otherwise fall back to Descope session info or null
  const user = isAuthenticated ? (convexUser || {
    name: descopeUser?.name || descopeUser?.email?.split('@')[0] || "Loading...",
    email: descopeUser?.email || "",
    _id: "temp-id" as Id<"users">,
    image: descopeUser?.picture || undefined,
    isVerified: false,
    emailNotificationsEnabled: false
  }) : null;

  // Only fetch when viewing the ads tab
  const userAds = useQuery(
    api.posts.getUserAds,
    activeTab === "ads" ? {} : "skip"
  );

  // ── Unified inbox (chats tab) ─────────────────────────────────────────
  // URL is the single source of truth for the open conversation + flyer
  // filter: ?tab=chats&chat=<chatId>&flyer=<adId>. Back/refresh restore it.
  const chatParam = searchParams.get("chat");
  const flyerParam = searchParams.get("flyer");

  // Merged selling + buying conversations, sorted desc; auth-gated internally.
  // enabled gates the two chat queries to the tab that renders them.
  const inbox = useInbox({
    flyerId: flyerParam ?? undefined,
    enabled: activeTab === "chats",
  });

  const activeConversation = useMemo(
    () =>
      chatParam
        ? inbox.conversations.find((conversation) => conversation._id === chatParam) ?? null
        : null,
    [inbox.conversations, chatParam]
  );

  // Total unread across all conversations — sidebar "Messages" badge.
  const totalUnreadCount = useTotalUnreadCount();

  // Only fetch when viewing the saved tab
  const savedAds = useQuery(
    api.adDetail.getSavedAds,
    activeTab === "saved" ? {} : "skip"
  );
  const savedSales = useQuery(
    api.saleEvents.getSavedSaleEvents,
    activeTab === "saved" && movingSaleModeEnabled ? {} : "skip"
  );

  // Only fetch when viewing the archived tab
  const archivedChats = useQuery(
    api.messages.getArchivedChats,
    user && activeTab === "archived" ? {} : "skip"
  );

  // Messages for the open conversation. Gated on the conversation actually
  // existing in the inbox (not just the raw URL param) so a bogus/foreign
  // ?chat= id never hits getChatMessages' participant check.
  const chatMessages = useQuery(
    api.messages.getChatMessages,
    activeTab === "chats" && authReady && activeConversation
      ? { chatId: activeConversation._id as Id<"chats"> }
      : "skip"
  );

  // Per-ad unread badges render in the "ads" tab (My Flyers), so the query
  // must run there — it was previously mis-gated on "chats" and always skipped
  // where its data was displayed.
  const unreadCounts = useQuery(
    api.messages.getUnreadCounts,
    activeTab === "ads" && userAds ? { adIds: userAds.map(ad => ad._id) } : "skip"
  );

  // Get feature flag for identity verification
  const isVerificationEnabled = useQuery(
    api.featureFlags.getFeatureFlag,
    { key: "identityVerification" }
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
  const updateEmailNotificationPreference = useMutation(api.users.updateEmailNotificationPreference);

  // Mark the open conversation as read (covers row taps AND ?chat deep links)
  useEffect(() => {
    if (activeTab === "chats" && chatParam && authReady) {
      markAsRead({ chatId: chatParam as Id<"chats"> }).catch(() => {
        // Invalid/foreign chat ids in the URL simply don't get marked read.
      });
    }
  }, [activeTab, chatParam, authReady, markAsRead]);

  // Initialize profile form data when user data is loaded
  useEffect(() => {
    if (user && user._id !== "temp-id") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing editable profile form from server-loaded user
      setProfileData({
        name: user.name || "",
        email: user.email || ""
      });
    }
  }, [user]);

  // Sync activeTab with URL search params (for bottom nav navigation)
  useEffect(() => {
    const tabParam = searchParams.get("tab") as "ads" | "chats" | "saved" | "sales" | "profile" | "archived" | null;
    if (tabParam && tabParam !== activeTab) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing active tab from URL search params (bottom-nav navigation)
      setActiveTab(tabParam);
      // Clear any open message views when navigating via URL (e.g., bottom nav)
      setShowMessagesForAd(null);
      setSelectedAdId(null);
    }
  }, [searchParams, activeTab]);

  // Bounce away from the sales tab if Moving Sale Mode is off (e.g. a
  // bookmarked ?tab=sales link) — the sidebar entry is already hidden below.
  useEffect(() => {
    if (activeTab === "sales" && movingSaleModeEnabled === false) {
      // Only push the URL — the "sync activeTab with URL" effect above is the
      // single writer of activeTab. Also calling setActiveTab here raced it:
      // searchParams updates one tick behind direct state, so on the
      // in-between render this effect saw activeTab="ads" while the sync
      // effect still saw the stale tab=sales param and flipped it back,
      // which re-triggered this effect — an infinite ping-pong between the
      // two effects (reproduced live: browser tab crashed with "Maximum
      // update depth exceeded" after toggling the flag while on this tab).
      setSearchParams({ tab: "ads" }, { replace: true });
    }
  }, [activeTab, movingSaleModeEnabled, setSearchParams]);

  // Scroll to top only when navigating TO dashboard from external route
  useEffect(() => {
    // Check if this is a fresh navigation to dashboard (not tab change within dashboard)
    const fromParam = new URLSearchParams(location.search).get('from');
    if (fromParam !== 'internal') {
      window.scrollTo(0, 0);
    }
  }, []);

  // Redirect invalid tabs on mobile (archived needs sidebar nav for batch actions)
  useEffect(() => {
    if (isMobile && activeTab === 'archived') {
      // Only push the URL — the "sync activeTab with URL" effect above is the
      // single writer of activeTab. Also calling setActiveTab here raced it
      // exactly like the sales-tab bounce documented above (searchParams
      // updates one tick behind direct state → the two effects ping-pong
      // until "Maximum update depth exceeded").
      setSearchParams({ tab: 'ads' }, { replace: true });
    }
  }, [isMobile, activeTab, setSearchParams]);


  // Handle scroll behavior based on intent
  useEffect(() => {
    // Priority 1: Back button scroll to top
    if (scrollIntentRef.current === 'top') {
      const timer = setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        scrollIntentRef.current = null;
      }, 100);
      return () => clearTimeout(timer);
    }

    // Priority 2: Auto-scroll to content on mobile tab change
    if (isMobile && shouldScrollToContent && !scrollIntentRef.current) {
      const timer = setTimeout(() => {
        const refMap = {
          ads: adsContentRef,
          chats: chatsContentRef,
          saved: savedContentRef,
          // MovingSalesTab manages its own scroll; reuse the ads ref (null when
          // the sales tab is active, so the optional-chain below simply no-ops).
          sales: adsContentRef,
          profile: profileContentRef,
          archived: archivedContentRef,
        };

        const targetRef = refMap[activeTab];
        if (targetRef?.current) {
          targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // Reset the flag after scrolling
        setShouldScrollToContent(false);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isMobile, shouldScrollToContent, activeTab]);


  // Debounced email validation
  useEffect(() => {
    if (!profileData.email) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing validation error when the email field is emptied
      setEmailError("");
      return;
    }

    const timeoutId = setTimeout(() => {
      const validation = validateEmail(profileData.email);
      setEmailError(validation.error);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [profileData.email]);

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

    // Validate name if provided
    const nameValidation = validateName(profileData.name);
    if (!nameValidation.valid) {
      setNameError(nameValidation.error);
      toast.error(nameValidation.error);
      return;
    }

    // Validate email if provided
    if (profileData.email) {
      const emailValidation = validateEmail(profileData.email);
      if (!emailValidation.valid) {
        setEmailError(emailValidation.error);
        toast.error(emailValidation.error);
        return;
      }
    }

    // Clear any previous errors
    setNameError("");
    setEmailError("");

    try {
      await updateProfile(profileData);
      toast.success("Profile updated successfully");
      // Clear local state after success to reset inputs
      setProfileData({ name: "", email: "" });
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

  const handleToggleEmailNotifications = async (enabled: boolean) => {
    try {
      await updateEmailNotificationPreference({ enabled });
      toast.success(
        enabled
          ? "Email notifications enabled"
          : "Email notifications disabled"
      );
    } catch (error: any) {
      toast.error(error.message || "Failed to update notification settings");
    }
  };

  /**
   * Single writer for the chats-tab URL state. Preserves tab=chats and only
   * touches the keys passed (null clears a key). replace:true so back/refresh
   * restore the inbox state without polluting history on every selection.
   */
  const updateChatParams = (next: { chat?: string | null; flyer?: string | null }) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", "chats");
    const setOrDelete = (key: string, value: string | null | undefined) => {
      if (value === undefined) return; // key not passed — leave untouched
      if (value) params.set(key, value);
      else params.delete(key);
    };
    setOrDelete("chat", next.chat);
    setOrDelete("flyer", next.flyer);
    setSearchParams(params, { replace: true });
  };

  const handleArchiveChat = async (chatId: Id<"chats">) => {
    try {
      await archiveChat({ chatId });
      // Archiving the open conversation closes its thread pane.
      if (chatId === chatParam) {
        updateChatParams({ chat: null });
      }
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

  // ── Unified inbox derived state (shared helpers — same derivations as InboxRow) ──
  const activeIsSale = activeConversation ? isSaleThread(activeConversation) : false;
  const counterpartName = activeConversation
    ? getCounterpartName(activeConversation, activeConversation.role)
    : "Deleted User";
  // Title for the removable "?flyer=" filter chip — taken from any matching
  // conversation's ad (the deep link comes from a context that has chats).
  const flyerFilterTitle = flyerParam
    ? inbox.conversations.find((conversation) => conversation.adId === flyerParam)?.ad?.title ?? "this flyer"
    : null;

  // ── Persistent Layout header ─────────────────────────────────────────────
  // Registered before the early returns below (hooks rules). Config is rebuilt
  // every render so the back button tracks isMobile/activeTab without stale
  // closures. Sub-screens:
  //  - AdMessages / "please sign in" never had a header → hidden.
  //  - inline AdDetail registers its OWN slots on top of these (stack), so the
  //    detail header wins while it's open and this one is restored on close.
  useHeaderSlots(
    !user || showMessagesForAd
      ? { hidden: true }
      : {
        leftNode: (
          <button
            type="button"
            onClick={() => {
              // On mobile, if we're not on the default "ads" tab, go back to it first
              if (isMobile && activeTab !== "ads") {
                // Set scroll intent to top - prevents auto-scroll race condition
                scrollIntentRef.current = 'top';
                setShouldScrollToContent(false);
                setActiveTab("ads");
                setSearchParams({ tab: "ads" }, { replace: true });
              } else {
                // Otherwise, leave the dashboard
                onBack();
              }
            }}
            aria-label="Back"
            className="inline-flex items-center gap-2 h-10 px-3 -ml-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all"
          >
            <CaretLeft className="w-5 h-5" />
            <span className="hidden md:inline text-sm font-medium">back</span>
          </button>
        ),
        centerNode: (
          <span className="font-display text-xl font-semibold tracking-tight text-foreground">
            <span className="md:hidden">My dashboard</span>
            <span className="hidden md:inline">FlyerBoard</span>
          </span>
        ),
        rightNode: (
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <>
              <div className="md:hidden">
                <SignOutButton onSignOut={onBack} iconOnly />
              </div>
              <div className="hidden md:block">
                <SignOutButton onSignOut={onBack} />
              </div>
            </>
          </div>
        ),
      }
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-prose px-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground mb-3">Please sign in</h2>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center h-11 px-5 rounded-full bg-muted/40 ring-1 ring-border text-foreground font-medium hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
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
      <div className="bg-background flex flex-col">
        {/* Header slots registered on the persistent Layout header above */}

        <div className="flex-1 w-full content-max-width mx-auto container-padding py-6 pb-bottom-nav md:pb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 md:gap-6">
            {/* Sidebar */}
            <aside className="md:col-span-1 md:sticky md:top-21 md:self-start">
              {!convexUser || userStats === undefined ? (
                <UserProfileSkeleton />
              ) : (
                <motion.section {...whileInView()} className="bg-card rounded-2xl ring-1 ring-border/70 shadow-card p-5 mb-6" aria-label="Your profile summary">
                  <input
                    ref={profileImageInputRef}
                    type="file"
                    accept="image/*,.heic,.heif"
                    onChange={(e) => { void handleProfileImageUpload(e); }}
                    className="hidden"
                    aria-label="Upload profile picture"
                  />
                  <div className="flex items-center gap-3 mb-5">
                    <button
                      type="button"
                      onClick={handleProfileImageClick}
                      aria-label="Click to upload profile picture"
                      className="w-12 h-12 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-semibold hover:opacity-80 active:scale-[0.98] transition-all relative overflow-hidden ring-1 ring-border/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {uploadingImage ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" aria-hidden="true"></div>
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
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-semibold tracking-tight text-foreground max-w-[120px] truncate">{getDisplayName(user)}</h3>
                        {user.isVerified && (
                          <div title="Verified User" className="relative">
                            <img src="/verified-badge.svg" alt="Verified User" className="w-11 h-11" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab("profile");
                            setSearchParams({ tab: "profile" }, { replace: true });
                            setShouldScrollToContent(true);
                          }}
                          aria-label="Edit profile"
                          className="ml-auto w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.95] transition-all flex items-center justify-center"
                        >
                          <PencilSimple className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="text-center">
                      <div className="font-display text-3xl font-semibold tracking-[-0.02em] text-primary tabular-nums leading-none">
                        <CountUp value={userStats.totalAds} reduced={reduced} />
                      </div>
                      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Total Ads</div>
                    </div>
                    <div className="text-center">
                      <div className="font-display text-3xl font-semibold tracking-[-0.02em] text-primary tabular-nums leading-none">
                        <CountUp value={userStats.totalViews} reduced={reduced} />
                      </div>
                      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Total Views</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/70">
                    <StarRating
                      rating={userStats.averageRating || 0}
                      count={userStats.ratingCount || 0}
                      size="sm"
                      showCount={true}
                    />
                  </div>
                </motion.section>
              )}

              <nav className="bg-card rounded-2xl ring-1 ring-border/70 shadow-card p-4 hidden md:block" aria-label="Dashboard sections">
                <span className="block px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sections</span>
                <ul className="space-y-1">
                  {[
                    { id: "ads", label: "My Flyers", icon: SquaresFour },
                    {
                      id: "chats",
                      label: "Messages",
                      icon: ChatText,
                      badge: totalUnreadCount
                    },
                    { id: "saved", label: "Saved Flyers", icon: BookmarkSimple },
                    ...(movingSaleModeEnabled
                      ? [{ id: "sales", label: "Moving sales", icon: Package }]
                      : []),
                    { id: "archived", label: "Archived", icon: Archive },
                    { id: "profile", label: "Profile", icon: User },
                  ].map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <li key={tab.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab(tab.id as any);
                            setSearchParams({ tab: tab.id }, { replace: true });
                            // Trigger scroll when clicking sidebar menu
                            setShouldScrollToContent(true);
                          }}
                          aria-current={isActive ? "page" : undefined}
                          className={`relative w-full text-left pl-4 pr-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium flex items-center justify-between active:scale-[0.99] ${isActive
                            ? 'text-primary bg-primary/[0.08]'
                            : 'text-foreground hover:bg-muted/50'
                            }`}
                        >
                          {isActive && (
                            <span aria-hidden="true" className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary" />
                          )}
                          <span className="flex items-center gap-3">
                            <tab.icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                            <span>{tab.label}</span>
                          </span>
                          {tab.badge && tab.badge > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-2 rounded-full text-[11px] font-semibold tabular-nums bg-primary text-primary-foreground">
                              {tab.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </aside>

            {/* Main Content */}
            <div className="md:col-span-3 min-h-[600px]">
              {/* Email collection banner - show on all tabs if no email */}
              {user && user._id !== "temp-id" && !user.email && (
                <section className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card p-5 mb-6" aria-label="Email setup">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <Envelope className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">Stay in the loop</span>
                      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground mb-1">
                        Get notified when buyers message you
                      </h3>
                      <p className="text-[15px] leading-relaxed text-foreground/75 mb-3">
                        Add your email to receive instant notifications about new messages.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("profile");
                          setSearchParams({ tab: "profile" });
                        }}
                        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary/[0.08] ring-1 ring-primary/30 text-primary text-sm font-semibold hover:bg-primary/[0.14] hover:ring-primary/50 active:scale-[0.98] transition-all"
                      >
                        Add email address →
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === "ads" && (
                <section ref={adsContentRef} className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card p-4 sm:p-6" aria-label="My flyers">
                  <header className="flex items-center justify-between gap-3 mb-6">
                    <div>
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">Your listings</span>
                      <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">My Flyers</h2>
                    </div>
                    <button
                      type="button"
                      onClick={onPostAd}
                      className="inline-flex items-center justify-center h-11 px-4 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
                    >
                      Pin Next Flyer
                    </button>
                  </header>

                  {/* Entry point to Moving Sale Mode (visible on all viewports) */}
                  {movingSaleModeEnabled && <button
                    type="button"
                    onClick={() => { void navigate("/sell/moving-sale"); }}
                    className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-3 text-left transition active:scale-[0.99]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Package size={20} weight="fill" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">
                        Moving house? Run a moving sale
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        List everything at once — photos in, listings out.
                      </span>
                    </span>
                  </button>}

                  <div className="space-y-3 sm:space-y-4">
                    {userAds === undefined ? (
                      // Loading state - show skeletons
                      <>
                        <AdListingSkeleton />
                        <AdListingSkeleton />
                        <AdListingSkeleton />
                      </>
                    ) : userAds.length === 0 ? (
                      // Empty state
                      <div className="text-center py-16">
                        <div className="flex justify-center mb-4"><SquaresFour className="w-16 h-16 text-muted-foreground/30" weight="light" aria-hidden="true" /></div>
                        <h3 className="font-display text-xl font-semibold tracking-tight text-foreground mb-2">No Flyers Yet</h3>
                        <p className="text-[15px] text-muted-foreground mb-5 max-w-prose mx-auto">Start by pinning your first flyer</p>
                        <button
                          type="button"
                          onClick={onPostAd}
                          className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
                        >
                          Pin Your First Flyer
                        </button>
                      </div>
                    ) : (
                      // Loaded state - show ads
                      userAds.map((ad) => (
                        <article
                          key={ad._id}
                          className="ring-1 ring-border/70 rounded-2xl p-3 sm:p-4 hover:ring-foreground/15 hover:shadow-card transition-all cursor-pointer bg-card"
                          onClick={() => onEditAd(ad)}
                        >
                          {/* Mobile: Vertical layout, Desktop: Horizontal layout */}
                          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                            {/* Image */}
                            {ad.images[0] ? (
                              <ImageDisplay
                                imageRef={ad.images[0]}
                                alt={ad.title}
                                className="w-full sm:w-20 h-32 sm:h-20 object-cover rounded-xl ring-1 ring-border/60"
                              />
                            ) : (
                              <div className="w-full sm:w-20 h-32 sm:h-20 bg-muted rounded-xl flex items-center justify-center ring-1 ring-border/60">
                                <ImageIcon className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
                              </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {/* Title and Price */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="font-display text-base font-semibold tracking-tight text-foreground flex-1 min-w-0 leading-snug">{ad.title}</h3>
                                <div className="flex flex-col items-end">
                                  {ad.previousPrice !== undefined && ad.price !== undefined && ad.previousPrice > ad.price && (
                                    <p className="text-xs text-muted-foreground line-through tabular-nums">
                                      {formatPrice(ad.previousPrice)}
                                    </p>
                                  )}
                                  <p className="font-display text-lg font-semibold tabular-nums text-primary whitespace-nowrap">
                                    {formatPrice(ad.price || 0)}
                                  </p>
                                </div>
                              </div>

                              {/* Stats and Status */}
                              <div className="flex items-center gap-3 mb-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1 tabular-nums"><Eye className="w-4 h-4" aria-hidden="true" /> {ad.views}</span>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${ad.isActive ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400' : 'bg-muted text-muted-foreground ring-border/60'
                                  }`}>
                                  {ad.isActive ? <CheckCircle className="w-3 h-3" aria-hidden="true" /> : <XCircle className="w-3 h-3" aria-hidden="true" />}
                                  {ad.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMessagesForAd(ad._id);
                                  }}
                                  aria-label="Messages"
                                  className="relative inline-flex items-center gap-1.5 h-9 px-2.5 md:px-3.5 rounded-full bg-muted/40 ring-1 ring-border text-foreground text-sm font-medium hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all"
                                >
                                  <ChatText className="w-4 h-4" aria-hidden="true" />
                                  <span className="hidden md:inline">Messages</span>
                                  {unreadCounts && unreadCounts[ad._id] > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold tabular-nums shadow-sm">
                                      {unreadCounts[ad._id]}
                                    </span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleToggleStatus(ad._id);
                                  }}
                                  aria-label={ad.isActive ? 'Deactivate' : 'Activate'}
                                  className="inline-flex items-center gap-1.5 h-9 px-2.5 md:px-3.5 rounded-full bg-muted/40 ring-1 ring-border text-foreground text-sm font-medium hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all"
                                >
                                  {ad.isActive ? <XCircle className="w-4 h-4" aria-hidden="true" /> : <CheckCircle className="w-4 h-4 text-primary" aria-hidden="true" />}
                                  <span className="hidden md:inline">{ad.isActive ? 'Deactivate' : 'Activate'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditAd(ad);
                                  }}
                                  aria-label="Edit"
                                  className="inline-flex items-center gap-1.5 h-9 px-2.5 md:px-3.5 rounded-full bg-muted/40 ring-1 ring-border text-foreground text-sm font-medium hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all"
                                >
                                  <PencilSimple className="w-4 h-4" aria-hidden="true" />
                                  <span className="hidden md:inline">Edit</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              )}

              {activeTab === "chats" && (
                <section ref={chatsContentRef} className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card p-4 sm:p-6" aria-label="My messages">
                  {/* Header + filters — on <lg the open thread replaces the list, so hide these */}
                  <div className={activeConversation ? "hidden lg:block" : ""}>
                    <header className="mb-4">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">Inbox</span>
                      <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Messages</h2>
                      <p className="text-[15px] leading-relaxed text-foreground/75 mt-1 max-w-prose">All your conversations — selling and buying</p>
                    </header>

                    <div className="flex flex-wrap items-center gap-2 mb-5">
                      <div role="tablist" aria-label="Filter conversations" className="inline-flex items-center gap-1 rounded-full bg-muted/50 ring-1 ring-border p-1">
                        {INBOX_FILTERS.map((option) => {
                          const isActiveFilter = inbox.filter === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              role="tab"
                              aria-selected={isActiveFilter}
                              onClick={() => inbox.setFilter(option.id)}
                              className={`relative h-8 px-4 rounded-full text-sm font-medium transition-colors active:scale-[0.98] ${isActiveFilter ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                              {isActiveFilter && (
                                <motion.span
                                  layoutId="inbox-filter-pill"
                                  aria-hidden="true"
                                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                                  className="absolute inset-0 rounded-full bg-card shadow-sm ring-1 ring-border/70"
                                />
                              )}
                              <span className="relative z-10">{option.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {flyerParam && (
                        <button
                          type="button"
                          onClick={() => updateChatParams({ flyer: null })}
                          aria-label={`Remove flyer filter: ${flyerFilterTitle}`}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary/[0.08] ring-1 ring-primary/30 text-primary text-sm font-medium hover:bg-primary/[0.14] hover:ring-primary/50 active:scale-[0.98] transition-all max-w-full"
                        >
                          <span className="truncate">Filtering: {flyerFilterTitle}</span>
                          <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="lg:grid lg:grid-cols-3 lg:gap-6">
                    {/* Conversation list — 1/3 on lg+, replaced by the thread below lg */}
                    <div className={`lg:col-span-1 ${activeConversation ? "hidden lg:block" : ""}`}>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={inbox.filter}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: reduced ? 0 : 0.15 }}
                        >
                          {inbox.isLoading ? (
                            <div className="space-y-3">
                              <ChatItemSkeleton />
                              <ChatItemSkeleton />
                            </div>
                          ) : inbox.conversations.length === 0 ? (
                            <div className="text-center py-16">
                              <div className="flex justify-center mb-4"><ChatText className="w-16 h-16 text-muted-foreground/30" weight="light" aria-hidden="true" /></div>
                              <h3 className="font-display text-xl font-semibold tracking-tight text-foreground mb-2">{INBOX_EMPTY_COPY[inbox.filter].title}</h3>
                              <p className="text-[15px] text-muted-foreground max-w-prose mx-auto">{INBOX_EMPTY_COPY[inbox.filter].body}</p>
                            </div>
                          ) : (
                            <div
                              className="ring-1 ring-border/70 rounded-2xl overflow-hidden divide-y divide-border/60 bg-card lg:max-h-[calc(100vh-320px)] lg:overflow-y-auto"
                              style={{ touchAction: "pan-y", overscrollBehavior: "contain" }}
                            >
                              {inbox.conversations.map((conversation, index) => (
                                <InboxRow
                                  key={conversation._id}
                                  chat={conversation}
                                  role={conversation.role}
                                  index={index}
                                  isActive={conversation._id === chatParam}
                                  onOpen={(chatId) => updateChatParams({ chat: chatId })}
                                  onArchive={(chatId) => { void handleArchiveChat(chatId as Id<"chats">); }}
                                />
                              ))}
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    {/* Thread pane — 2/3 on lg+, full width below lg when open */}
                    <div className={`lg:col-span-2 ${activeConversation ? "" : "hidden lg:block"}`}>
                      {activeConversation ? (
                        <div className="flex flex-col h-[calc(100dvh-300px)] min-h-[360px] lg:h-[calc(100vh-320px)] lg:min-h-[420px] ring-1 ring-border/70 rounded-2xl bg-card overflow-hidden">
                          <ConversationHeader
                            image={activeConversation.ad?.images?.[0]}
                            title={getItemTitle(activeConversation)}
                            subtitle={`${activeConversation.role === "selling" ? "Buyer" : "Seller"}: ${counterpartName}`}
                            price={activeConversation.ad?.price}
                            onBack={() => updateChatParams({ chat: null })}
                            viewItemLabel={activeIsSale ? "View sale" : "View flyer"}
                            onViewItem={
                              activeConversation.ad && activeConversation.adId
                                ? () => { void navigate(`/ad/${activeConversation.adId}`); }
                                : activeIsSale && activeConversation.sale?.slug
                                  ? () => { void navigate(`/sale/${activeConversation.sale?.slug}`); }
                                  : undefined
                            }
                            onReport={() => setShowReportModal(true)}
                          />
                          <ConversationThread
                            messages={chatMessages ?? []}
                            currentUserId={String(user._id)}
                          />
                          <MessageComposer
                            onSend={async (content) => {
                              await sendMessage({ chatId: activeConversation._id as Id<"chats">, content });
                            }}
                            disabled={activeIsSale ? !activeConversation.sale : !activeConversation.ad?.isActive}
                            disabledReason={activeIsSale ? "This sale is no longer available" : "This flyer is no longer active"}
                          />
                        </div>
                      ) : (
                        <div className="hidden lg:flex items-center justify-center h-full min-h-[420px] ring-1 ring-border/70 rounded-2xl bg-card">
                          <div className="text-center p-8 max-w-prose">
                            <div className="flex justify-center mb-4"><ChatText className="w-12 h-12 text-muted-foreground/30" weight="light" aria-hidden="true" /></div>
                            <h3 className="font-display text-xl font-semibold tracking-tight text-foreground mb-2">Select a conversation</h3>
                            <p className="text-[15px] leading-relaxed text-foreground/70">Choose a conversation from the list to start messaging</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {activeTab === "saved" && (
                <section ref={savedContentRef} className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card p-4 sm:p-6" aria-label="Saved flyers">
                  {savedSales !== undefined && savedSales.length > 0 && (
                    <div className="mb-6 pb-6 border-b border-border/70">
                      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground mb-3">Saved Sales</h3>
                      <div className="grid gap-2 sm:gap-3">
                        {savedSales.map((saved) => (
                          <button
                            key={saved._id}
                            type="button"
                            onClick={() => { void navigate(`/sale/${saved.sale.slug}`); }}
                            className="flex items-center gap-3 ring-1 ring-border/70 rounded-xl p-3 hover:ring-foreground/15 hover:shadow-card transition-all text-left bg-card"
                          >
                            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5" weight="fill" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground truncate">{saved.sale.title}</p>
                              <p className="text-xs text-muted-foreground">{saved.sale.suburb} · {saved.sale.itemCount} items</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <header className="mb-6">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">Bookmarks</span>
                    <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Saved Ads</h2>
                  </header>

                  <div className="grid gap-3 sm:gap-4">
                    {savedAds === undefined ? (
                      // Loading state - show skeletons
                      <>
                        <SavedAdSkeleton />
                        <SavedAdSkeleton />
                      </>
                    ) : savedAds.length === 0 ? (
                      // Empty state
                      <div className="text-center py-16">
                        <div className="flex justify-center mb-4"><BookmarkSimple className="w-16 h-16 text-muted-foreground/30" weight="light" aria-hidden="true" /></div>
                        <h3 className="font-display text-xl font-semibold tracking-tight text-foreground mb-2">No saved ads</h3>
                        <p className="text-[15px] text-muted-foreground max-w-prose mx-auto">Save ads you're interested in to view them here</p>
                      </div>
                    ) : (
                      // Loaded state - show saved ads
                      savedAds.filter(savedAd => savedAd.ad).map((savedAd) => (
                        <article
                          key={savedAd._id}
                          onClick={() => setSelectedAdId(savedAd.ad!._id)}
                          className="ring-1 ring-border/70 rounded-2xl p-4 hover:ring-foreground/15 hover:shadow-card transition-all duration-300 cursor-pointer group bg-card"
                        >
                          <div className="flex items-start gap-4">
                            <ImageDisplay
                              src={savedAd.ad!.images[0] || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop'}
                              alt={savedAd.ad!.title}
                              className="w-20 h-20 object-cover rounded-xl ring-1 ring-border/60 group-hover:scale-[1.03] transition-transform duration-300 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-display text-base font-semibold tracking-tight text-foreground mb-1 leading-snug group-hover:text-primary transition-colors">
                                {savedAd.ad!.title}
                              </h3>
                              <p className="font-display text-lg font-semibold tabular-nums text-primary mb-2">
                                {formatPriceWithCurrency(savedAd.ad!.price || 0)}
                              </p>
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-2 leading-relaxed">
                                {savedAd.ad!.description}
                              </p>
                              <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                                <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" aria-hidden="true" /> {savedAd.ad!.location}</span>
                                <span>{savedAd.ad!.views} views</span>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              )}

              {activeTab === "sales" && movingSaleModeEnabled && <MovingSalesTab />}

              {activeTab === "profile" && (
                <section ref={profileContentRef} className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card p-4 sm:p-6" aria-label="Profile settings">
                  <header className="mb-6">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">Account</span>
                    <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Profile Settings</h2>
                  </header>

                  <form onSubmit={(e) => { void handleUpdateProfile(e); }} className="space-y-5 mb-8">
                    <div>
                      <label htmlFor="profile-name-input" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Name</label>
                      <input
                        id="profile-name-input"
                        type="text"
                        value={profileData.name}
                        onChange={(e) => {
                          setProfileData(prev => ({ ...prev, name: e.target.value }));
                          // Clear error when user starts typing
                          if (nameError) setNameError("");
                        }}
                        maxLength={15}
                        className={`w-full h-11 px-4 bg-muted/50 ring-1 rounded-full focus:bg-card focus:outline-none text-foreground placeholder:text-muted-foreground/70 transition-all ${nameError ? 'ring-destructive focus:ring-destructive' : 'ring-transparent focus:ring-ring'
                          }`}
                        placeholder={getDisplayName(user)}
                        aria-invalid={nameError ? "true" : undefined}
                      />
                      {nameError && (
                        <p className="text-sm text-destructive mt-2">{nameError}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="profile-email-input" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Email</label>
                      <input
                        id="profile-email-input"
                        type="email"
                        value={profileData.email}
                        onChange={(e) => {
                          setProfileData(prev => ({ ...prev, email: e.target.value }));
                          // Clear error when user starts typing
                          if (emailError) setEmailError("");
                        }}
                        maxLength={50}
                        className={`w-full h-11 px-4 bg-muted/50 ring-1 rounded-full focus:bg-card focus:outline-none text-foreground placeholder:text-muted-foreground/70 transition-all ${emailError ? 'ring-destructive focus:ring-destructive' : 'ring-transparent focus:ring-ring'
                          }`}
                        placeholder={user.email || "Enter your email"}
                        aria-invalid={emailError ? "true" : undefined}
                      />
                      {emailError && (
                        <p className="text-sm text-destructive mt-2">{emailError}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
                    >
                      Update Profile
                    </button>
                  </form>

                  {isVerificationEnabled && (
                    <div className="border-t border-border/70 pt-6 mb-8">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">Identity Verification</h3>
                      <div className="flex items-center justify-between gap-4 bg-muted/40 p-5 rounded-2xl ring-1 ring-border/60">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-display text-base font-semibold tracking-tight text-foreground flex items-center gap-2 flex-wrap">
                            Status: {user.isVerified ? (
                              <span className="text-primary flex items-center gap-1">
                                Verified
                                <img src="/verified-badge.svg" alt="Verified" className="w-16 h-16" />
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Unverified</span>
                            )}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-prose">
                            {user.isVerified
                              ? "Your identity has been verified. A badge is displayed on your profile and flyers."
                              : "Verify your identity to build trust with other users and get a verified badge."}
                          </p>
                        </div>
                        {!user.isVerified && (
                          <button
                            type="button"
                            onClick={() => { void handleVerifyIdentity(); }}
                            className="inline-flex items-center justify-center h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all flex-shrink-0"
                          >
                            Verify Identity
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-border/70 pt-6 mb-8">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">Notifications</h3>
                    {user.email && (
                      <div className="bg-muted/40 ring-1 ring-border/60 p-5 rounded-2xl">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-display text-base font-semibold tracking-tight text-foreground mb-1">
                              Email notifications for new messages
                            </h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              Receive email notifications at {user.email} when you get a new message
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0" aria-label="Toggle email notifications">
                            <input
                              type="checkbox"
                              checked={user.emailNotificationsEnabled || false}
                              onChange={(e) => { void handleToggleEmailNotifications(e.target.checked); }}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 rounded-full peer bg-muted ring-1 ring-border peer-focus:ring-2 peer-focus:ring-ring peer-focus:ring-offset-2 peer-focus:ring-offset-background peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:ring-1 after:ring-border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-checked:ring-primary">
                            </div>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border/70 pt-6">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-destructive mb-4">Danger Zone</h3>
                    <p className="text-[15px] leading-relaxed text-foreground/75 mb-4 max-w-prose">
                      Deleting your account will permanently remove all your data, including ads, messages, and saved items. This action cannot be undone.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAccountDeleteConfirm(true)}
                      className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-destructive text-destructive-foreground font-semibold shadow-sm shadow-destructive/25 hover:bg-destructive/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
                    >
                      Delete Account
                    </button>
                  </div>
                </section>
              )}

              {activeTab === "archived" && (
                <section ref={archivedContentRef} className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card p-4 sm:p-6" aria-label="Archived messages">
                  <header className="flex items-center justify-between gap-3 mb-6">
                    <div>
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">Storage</span>
                      <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Archived Messages</h2>
                    </div>
                    {(archivedChats || []).length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllArchivedChats}
                          className="inline-flex items-center h-9 px-3.5 rounded-full bg-muted/40 ring-1 ring-border text-foreground text-sm font-medium hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all"
                        >
                          {selectedArchivedChats.size === (archivedChats || []).length ? 'Deselect All' : 'Select All'}
                        </button>
                        {selectedArchivedChats.size > 0 && (
                          <button
                            type="button"
                            onClick={() => { void handleDeleteArchivedChats(); }}
                            className="inline-flex items-center h-9 px-3.5 rounded-full bg-destructive/10 ring-1 ring-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/20 active:scale-[0.98] transition-all"
                          >
                            Delete Selected ({selectedArchivedChats.size})
                          </button>
                        )}
                      </div>
                    )}
                  </header>

                  <div className="space-y-3">
                    {(archivedChats || []).length === 0 ? (
                      <div className="text-center py-16">
                        <div className="flex justify-center mb-4"><Archive className="w-16 h-16 text-muted-foreground/30" weight="light" aria-hidden="true" /></div>
                        <h3 className="font-display text-xl font-semibold tracking-tight text-foreground mb-2">No archived messages</h3>
                        <p className="text-[15px] text-muted-foreground max-w-prose mx-auto">Archived conversations will appear here</p>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">Archived chats will be displayed here</div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Report open conversation (unified inbox thread pane) */}
      {activeConversation && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportType="chat"
          reportedEntityId={activeConversation._id}
          reportedEntityName={`Conversation with ${counterpartName}`}
        />
      )}

      {/* Delete Flyer Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div
          className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowDeleteConfirm(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-flyer-title"
        >
          <div
            className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card-hover p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-flyer-title" className="font-display text-2xl font-semibold tracking-tight text-foreground mb-3">Delete Flyer</h2>
            <p className="text-[15px] leading-relaxed text-foreground/75 mb-6 max-w-prose">
              Are you sure you want to delete this flyer? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 inline-flex items-center justify-center h-11 px-4 rounded-full bg-muted/40 ring-1 ring-border text-foreground font-medium hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleDeleteAd(showDeleteConfirm); }}
                className="flex-1 inline-flex items-center justify-center h-11 px-4 rounded-full bg-destructive text-destructive-foreground font-semibold shadow-sm shadow-destructive/25 hover:bg-destructive/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
      }

      {/* Delete Account Confirmation Modal */}
      {
        showAccountDeleteConfirm && createPortal(
          <div
            className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setShowAccountDeleteConfirm(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <div
              className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card-hover p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="delete-account-title" className="font-display text-2xl font-semibold tracking-tight text-destructive mb-3">Delete Account</h2>
              <p className="text-[15px] leading-relaxed text-foreground/75 mb-6 max-w-prose">
                Are you absolutely sure? This will permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAccountDeleteConfirm(false)}
                  className="flex-1 inline-flex items-center justify-center h-11 px-4 rounded-full bg-muted/40 ring-1 ring-border text-foreground font-medium hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { void handleDeleteAccount(); }}
                  className="flex-1 inline-flex items-center justify-center h-11 px-4 rounded-full bg-destructive text-destructive-foreground font-semibold shadow-sm shadow-destructive/25 hover:bg-destructive/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </>
  );
}

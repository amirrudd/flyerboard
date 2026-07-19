import { useState, useEffect, useMemo, useRef } from "react";
import { m, useMotionValue, useTransform, animate } from "framer-motion";
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
import { useTotalUnreadCount } from "../messages";
import { getDisplayName, getInitials } from "../../lib/displayName";
import { uploadImageToR2 } from "../../lib/uploadToR2";
import { useDeviceInfo } from "../../hooks/useDeviceInfo";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { notificationService } from "../../services/notifications";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import { useBoostAction, type BoostableAd } from "../../hooks/useBoostAction";
import { BoostConfirmModal } from "../ads/BoostConfirmModal";
import { BoostRingOverlay, BoostArrowFloat } from "../ads/BoostFx";
import { formatPrice, formatPriceWithCurrency } from "../../lib/priceFormatter";
import {
  SquaresFour,
  ChatText,
  BookmarkSimple,
  User,
  CaretLeft,
  PencilSimple,
  Eye,
  CheckCircle,
  XCircle,
  MapPin,
  Image as ImageIcon,
  Envelope,
  BellRinging,
  Package,
  Plus,
  Stack,
  ArrowUp
} from '@phosphor-icons/react';
import { MovingSalesTab } from "./MovingSalesTab";
import { BundlesTab } from "./BundlesTab";
import { BundleManageModal } from "../bundles/BundleManageModal";
import { StarRating } from "../../components/ui/StarRating";
import { UserProfileSkeleton, AdListingSkeleton, SavedAdSkeleton } from "../../components/ui/DashboardSkeleton";
import { ThemeToggle } from "../../components/ThemeToggle";

// Feature flags removed - now using database-driven flags

// Tabs that still live on the dashboard. Chats/archived moved to /messages
// (mobile chat redesign) — unknown or legacy ?tab values fall back to "ads".
const DASHBOARD_TABS = ["ads", "saved", "sales", "bundles", "profile"] as const;
type DashboardTab = (typeof DASHBOARD_TABS)[number];
const parseDashboardTab = (value: string | null): DashboardTab | null =>
  value && (DASHBOARD_TABS as readonly string[]).includes(value)
    ? (value as DashboardTab)
    : null;

/** One row in the Saved tab's Sales/Bundles groups — identical shell, per-kind tint. */
function SavedGroupRow({
  tintClass,
  title,
  subtitle,
  onClick,
}: {
  tintClass: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 ring-1 ring-border/70 rounded-xl p-3 hover:ring-foreground/15 hover:shadow-card transition-all text-left bg-card"
    >
      <div className={`w-10 h-10 rounded-lg ${tintClass} flex items-center justify-center flex-shrink-0`}>
        <Package className="w-5 h-5" weight="fill" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground truncate">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </button>
  );
}

function CountUp({ value, reduced }: { value: number; reduced: boolean }) {
  const motionValue = useMotionValue(reduced ? value : 0);
  const rounded = useTransform(motionValue, Math.round);

  useEffect(() => {
    if (reduced) return;
    const controls = animate(motionValue, value, { duration: 0.7, ease: "easeOut" });
    return controls.stop;
  }, [value, reduced]);

  return <m.span>{rounded}</m.span>;
}

function ToggleSwitch({ checked, disabled, ariaLabel, className = "", onChange }: {
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`relative inline-flex items-center cursor-pointer flex-shrink-0 ${className}`} aria-label={ariaLabel}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 rounded-full peer bg-muted ring-1 ring-border peer-focus:ring-2 peer-focus:ring-ring peer-focus:ring-offset-2 peer-focus:ring-offset-background peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:ring-1 after:ring-border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-checked:ring-primary">
      </div>
    </label>
  );
}

// Own component so usePushNotifications' mount work (service-worker/pushManager
// lookups) only runs when the profile tab actually renders the card.
function BrowserNotificationsCard() {
  const { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  const handleEnable = async () => {
    const ok = await subscribe();
    if (ok) {
      toast.success("Browser notifications enabled");
    } else if (notificationService.getPermissionStatus() === "denied") {
      // Read the live permission: the hook's state updates async
      toast.error("Notifications are blocked in your browser settings");
    } else {
      toast.error("Couldn't enable browser notifications");
    }
  };

  const handleDisable = async () => {
    const ok = await unsubscribe();
    if (ok) toast.success("Browser notifications disabled");
    else toast.error("Couldn't disable browser notifications");
  };

  return (
    <div className="relative overflow-hidden bg-muted/40 ring-1 ring-border/60 p-5 rounded-2xl">
      {permission !== "denied" && !isSubscribed && (
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/[0.07] blur-2xl" />
      )}
      <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <BellRinging size={20} weight="light" />
          </span>
          <div className="flex-1 min-w-0">
            <h4 className="font-display text-base font-semibold tracking-tight text-foreground mb-1">
              Browser notifications
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {permission === "denied"
                ? "Blocked for this site. Allow notifications in your browser settings to get message alerts on this device."
                : isSubscribed
                  ? "You'll get an alert on this device the moment a new message arrives."
                  : "Get an alert on this device the moment someone messages you — even when FlyerBoard is closed."}
            </p>
          </div>
        </div>
        {permission === "denied" ? (
          <span className="inline-flex items-center self-start h-7 px-3 rounded-full bg-muted ring-1 ring-border text-xs font-medium text-muted-foreground flex-shrink-0">
            Blocked in browser
          </span>
        ) : isSubscribed ? (
          <ToggleSwitch
            checked={isSubscribed}
            disabled={isLoading}
            ariaLabel="Toggle browser notifications"
            className="self-start sm:mt-1"
            onChange={() => { void handleDisable(); }}
          />
        ) : (
          <button
            type="button"
            onClick={() => { void handleEnable(); }}
            disabled={isLoading}
            className="group inline-flex items-center self-start gap-2.5 h-10 pl-5 pr-1.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 active:shadow-sm disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex-shrink-0"
          >
            {isLoading ? "Enabling…" : "Enable"}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:scale-110 group-hover:bg-white/30">
              <BellRinging size={13} weight="bold" className="motion-safe:animate-bell-ring" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

interface MyAdCardProps {
  ad: any;
  boostEnabled: boolean;
  bundleModeEnabled: boolean;
  bundleInfo?: { bundleId: string; label: string };
  unreadCount: number;
  onEdit: (ad: any) => void;
  onOpenMessages: (adId: string) => void;
  onToggleStatus: (adId: string) => void;
  onManageBundle: (bundleId: string) => void;
  onAddToBundle: (adId: string) => void;
}

/**
 * A single My-Ads card. Extracted from the map so `useBoostAction` (a hook) can be
 * called at a component top level rather than inside a `.map` callback (rules of
 * hooks). Owns the card lift + ring pulse on a successful boost; the Boost button is
 * the ONLY filled-primary element on the card (leftmost via `mr-auto`).
 */
function MyAdCard({
  ad,
  boostEnabled,
  bundleModeEnabled,
  bundleInfo,
  unreadCount,
  onEdit,
  onOpenMessages,
  onToggleStatus,
  onManageBundle,
  onAddToBundle,
}: MyAdCardProps) {
  const boost = useBoostAction(ad as BoostableAd);
  const showBoost = boostEnabled && boost.state !== "ineligible";
  const inCooldown = boost.state === "cooldown";

  return (
    <m.article
      animate={boost.cardControls}
      className="relative ring-1 ring-border/70 rounded-2xl p-3 sm:p-4 hover:ring-foreground/15 hover:shadow-card transition-all cursor-pointer bg-card"
      onClick={() => onEdit(ad)}
    >
      <BoostRingOverlay ringKey={boost.ringKey} ringProps={boost.ringProps} />
      {/* Mobile: Vertical layout, Desktop: Horizontal layout */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        {/* Image */}
        {ad.images[0] ? (
          <ImageDisplay
            imageRef={ad.images[0]}
            alt={ad.title}
            className="w-full sm:w-20 h-32 sm:h-20 object-cover rounded-xl ring-1 ring-border/60"
            size="card"
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

          {/* Bundle membership tag / "Bundle this" action (flag-gated) */}
          {bundleModeEnabled && (() => {
            if (bundleInfo) {
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onManageBundle(bundleInfo.bundleId);
                  }}
                  className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-bundle/10 px-2.5 py-1 text-xs font-semibold text-bundle-emphasis ring-1 ring-bundle/20 hover:bg-bundle/15 transition"
                >
                  <Package size={13} weight="fill" className="shrink-0" />
                  <span className="truncate">In bundle: {bundleInfo.label}</span>
                </button>
              );
            }
            // Mirrors backend eligibility (bundles.createBundle / getEligibleAdsForBundle):
            // trade-only (exchange) ads can't join a bundle.
            const eligible = !ad.isSold && !ad.bundleId && !ad.saleEventId && ad.listingType !== "exchange";
            if (eligible) {
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToBundle(ad._id);
                  }}
                  className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-bundle-emphasis ring-1 ring-bundle/40 hover:bg-bundle/10 active:scale-[0.98] transition"
                >
                  <Plus size={13} weight="bold" className="shrink-0" />
                  Add to a bundle
                </button>
              );
            }
            return null;
          })()}

          {/* Stats and Status */}
          <div className="flex items-center gap-3 mb-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 tabular-nums"><Eye className="w-4 h-4" aria-hidden="true" /> {ad.views}</span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${ad.isActive ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400' : 'bg-muted text-muted-foreground ring-border/60'
              }`}>
              {ad.isActive ? <CheckCircle className="w-3 h-3" aria-hidden="true" /> : <XCircle className="w-3 h-3" aria-hidden="true" />}
              {ad.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Action Buttons. `flex-wrap` is the narrow-viewport safety valve; Boost is
              the leftmost hero action (`mr-auto`), utilities pushed right. */}
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {showBoost && (
              <div className="relative mr-auto">
                <button
                  type="button"
                  disabled={inCooldown}
                  aria-label={inCooldown ? boost.cooldownAria : "Boost to top"}
                  title={inCooldown ? boost.cooldownAria : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    boost.openConfirm();
                  }}
                  className={inCooldown
                    ? "inline-flex items-center gap-1.5 h-11 md:h-9 px-3.5 rounded-full bg-muted/40 ring-1 ring-border text-muted-foreground text-sm font-medium cursor-not-allowed"
                    : "inline-flex items-center gap-1.5 h-11 md:h-9 px-3.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"}
                >
                  <ArrowUp className="w-4 h-4" weight="bold" aria-hidden="true" />
                  <span>{inCooldown ? boost.cooldownLabel : "Boost to top"}</span>
                </button>
                <BoostArrowFloat show={boost.showArrow} arrowProps={boost.arrowProps} />
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMessages(ad._id);
              }}
              aria-label="Messages"
              className="relative inline-flex items-center gap-1.5 h-9 px-2.5 md:px-3.5 rounded-full bg-muted/40 ring-1 ring-border text-foreground text-sm font-medium hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all"
            >
              <ChatText className="w-4 h-4" aria-hidden="true" />
              <span className="hidden md:inline">Messages</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold tabular-nums shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(ad._id);
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
                onEdit(ad);
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

      {showBoost && (
        <BoostConfirmModal
          open={boost.isConfirmOpen}
          cooldownDays={boost.cooldownDays}
          isBoosting={boost.isBoosting}
          onConfirm={() => void boost.confirmBoost()}
          onCancel={boost.closeConfirm}
        />
      )}
    </m.article>
  );
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
  const tabParam = parseDashboardTab(searchParams.get("tab"));
  const { isMobile } = useDeviceInfo();

  const [activeTab, setActiveTab] = useState<DashboardTab>(tabParam || "ads");
  const movingSaleModeEnabled = useFeatureFlag("movingSaleMode");
  const bundleModeEnabled = useFeatureFlag("bundleListing");
  const boostEnabled = useFeatureFlag("boostToTop");
  const [manageBundleId, setManageBundleId] = useState<string | null>(null);
  const [showAccountDeleteConfirm, setShowAccountDeleteConfirm] = useState(false);
  const [profileData, setProfileData] = useState({ name: "", email: "" });
  const [nameError, setNameError] = useState<string>("");
  const [emailError, setEmailError] = useState<string>("");
  // Inline drill-in views are URL-encoded: ?ad=<id> renders AdDetail,
  // ?messages=<id> renders AdMessages (legacy deep links only — the My
  // Flyers button now navigates to /messages?flyer=<adId>).
  // URL as source of truth means refresh restores the view and tab switches
  // (which write fresh params) implicitly close it.
  const selectedAdId = searchParams.get("ad") as Id<"ads"> | null;
  const showMessagesForAd = searchParams.get("messages") as Id<"ads"> | null;
  // Single writer for URL-encoded view state. For each key in `updates`, a
  // string sets it, null clears it, undefined leaves it untouched; `force`
  // keys are always set. replace:true so back/refresh restore the encoded
  // state without polluting history on every selection.
  const updateSearchParams = (
    updates: Record<string, string | null | undefined>,
    force?: Record<string, string>,
  ) => {
    const params = new URLSearchParams(searchParams);
    if (force) for (const [k, v] of Object.entries(force)) params.set(k, v);
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue; // leave untouched
      if (value) params.set(key, value);
      else params.delete(key);
    }
    setSearchParams(params, { replace: true });
  };
  const updateInlineViewParams = (next: { ad?: string | null; messages?: string | null }) =>
    updateSearchParams(next);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState(false);

  // Refs for tab content sections (for mobile auto-scroll)
  const adsContentRef = useRef<HTMLDivElement>(null);
  const savedContentRef = useRef<HTMLDivElement>(null);
  const profileContentRef = useRef<HTMLDivElement>(null);

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
  const { isAuthenticated } = useSession();
  const { user: descopeUser } = useUser();

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

  // Bundles the seller owns — used to tag ad cards that belong to a bundle.
  const myBundles = useQuery(
    api.bundles.getMyBundles,
    activeTab === "ads" && bundleModeEnabled ? {} : "skip"
  );
  // adId -> { bundleId, label } for O(1) per-card tag lookup.
  const bundleByAdId = useMemo(() => {
    const map = new Map<string, { bundleId: string; label: string }>();
    for (const b of myBundles ?? []) {
      for (const adId of b.adIds) map.set(adId, { bundleId: b._id, label: b.label });
    }
    return map;
  }, [myBundles]);

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
  const savedBundles = useQuery(
    api.bundles.getSavedBundles,
    activeTab === "saved" && bundleModeEnabled ? {} : "skip"
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

  const toggleAdStatus = useMutation(api.posts.toggleAdStatus);
  const generateProfileUploadUrl = useAction(api.upload_urls.generateProfileUploadUrl);
  const updateProfile = useMutation(api.users.updateProfile);
  const deleteAccount = useMutation(api.users.deleteAccount);
  const verifyIdentity = useMutation(api.users.verifyIdentity);
  const updateEmailNotificationPreference = useMutation(api.users.updateEmailNotificationPreference);

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
    const tabParam = parseDashboardTab(searchParams.get("tab"));
    if (tabParam && tabParam !== activeTab) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing active tab from URL search params (bottom-nav navigation)
      setActiveTab(tabParam);
      // Open inline views (?ad= / ?messages=) are URL-derived, so tab
      // navigation that writes fresh params closes them automatically.
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

  // Same guard for the bundles tab when Bundle Listing is off. Only pushes the
  // URL (the URL→activeTab sync effect is the single writer) to avoid the
  // effect ping-pong documented on the sales guard above.
  useEffect(() => {
    if (activeTab === "bundles" && bundleModeEnabled === false) {
      setSearchParams({ tab: "ads" }, { replace: true });
    }
  }, [activeTab, bundleModeEnabled, setSearchParams]);

  // Scroll to top only when navigating TO dashboard from external route
  useEffect(() => {
    // Check if this is a fresh navigation to dashboard (not tab change within dashboard)
    const fromParam = new URLSearchParams(location.search).get('from');
    if (fromParam !== 'internal') {
      window.scrollTo(0, 0);
    }
  }, []);

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
          saved: savedContentRef,
          // MovingSalesTab / BundlesTab manage their own scroll; reuse the ads
          // ref (null when those tabs are active, so the chain below no-ops).
          sales: adsContentRef,
          bundles: adsContentRef,
          profile: profileContentRef,
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
        onBack={() => updateInlineViewParams({ messages: null })}
      />
    );
  }

  // Show ad detail if an ad is selected
  if (selectedAdId) {
    return (
      <AdDetail
        adId={selectedAdId}
        onBack={() => updateInlineViewParams({ ad: null })}
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
                <m.section {...whileInView()} className="bg-card rounded-2xl ring-1 ring-border/70 shadow-card p-5 mb-6" aria-label="Your profile summary">
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
                          size="full"
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
                </m.section>
              )}

              <nav className="bg-card rounded-2xl ring-1 ring-border/70 shadow-card p-4 hidden md:block" aria-label="Dashboard sections">
                <span className="block px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sections</span>
                <ul className="space-y-1">
                  {[
                    { id: "ads", label: "My Flyers", icon: SquaresFour },
                    // Messages moved to its own destination (/messages) — this
                    // entry is the pointer for dashboard-habituated users, and
                    // it keeps the live unread badge.
                    {
                      id: "messages-link",
                      label: "Messages",
                      icon: ChatText,
                      badge: totalUnreadCount,
                      href: "/messages",
                    },
                    { id: "saved", label: "Saved Flyers", icon: BookmarkSimple },
                    ...(movingSaleModeEnabled
                      ? [{ id: "sales", label: "Moving sales", icon: Package }]
                      : []),
                    ...(bundleModeEnabled
                      ? [{ id: "bundles", label: "Bundles", icon: Stack }]
                      : []),
                    { id: "profile", label: "Profile", icon: User },
                  ].map((tab: { id: string; label: string; icon: typeof SquaresFour; badge?: number; href?: string }) => {
                    const isActive = !tab.href && activeTab === tab.id;
                    return (
                      <li key={tab.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (tab.href) {
                              void navigate(tab.href);
                              return;
                            }
                            setActiveTab(tab.id as DashboardTab);
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
                          setSearchParams({ tab: "profile" }, { replace: true });
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
                    <div className="flex flex-col-reverse items-end gap-2 sm:flex-row sm:items-center">
                      {bundleModeEnabled && (
                        <button
                          type="button"
                          onClick={() => { void navigate("/sell/bundle"); }}
                          className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-full bg-transparent text-bundle-emphasis font-semibold ring-1 ring-bundle/40 hover:bg-bundle/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bundle focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
                        >
                          <Package size={18} weight="fill" />
                          Bundle ads
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onPostAd}
                        className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
                      >
                        <Plus size={18} weight="bold" />
                        Pin Next Flyer
                      </button>
                    </div>
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
                        <MyAdCard
                          key={ad._id}
                          ad={ad}
                          boostEnabled={!!boostEnabled}
                          bundleModeEnabled={!!bundleModeEnabled}
                          bundleInfo={bundleByAdId.get(ad._id)}
                          unreadCount={unreadCounts?.[ad._id] ?? 0}
                          onEdit={onEditAd}
                          onOpenMessages={(adId) => void navigate(`/messages?flyer=${adId}`)}
                          onToggleStatus={(adId) => void handleToggleStatus(adId)}
                          onManageBundle={(bundleId) => setManageBundleId(bundleId)}
                          onAddToBundle={(adId) => void navigate(`/sell/bundle?preselect=${adId}`)}
                        />
                      ))
                    )}
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
                          <SavedGroupRow
                            key={saved._id}
                            tintClass="bg-primary/10 text-primary"
                            title={saved.sale.title}
                            subtitle={`${saved.sale.suburb} · ${saved.sale.itemCount} items`}
                            onClick={() => { void navigate(`/sale/${saved.sale.slug}`); }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {savedBundles !== undefined && savedBundles.length > 0 && (
                    <div className="mb-6 pb-6 border-b border-border/70">
                      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground mb-3">Saved Bundles</h3>
                      <div className="grid gap-2 sm:gap-3">
                        {savedBundles.map((saved) => (
                          <SavedGroupRow
                            key={saved._id}
                            tintClass="bg-bundle/10 text-bundle-emphasis"
                            title={saved.bundle.label}
                            subtitle={`${saved.bundle.itemCount} items · ${formatPriceWithCurrency(saved.bundle.bundlePrice)}${saved.bundle.status === "partial" ? " · no longer available" : ""}`}
                            onClick={() => { void navigate(`/bundle/${saved.bundle._id}`); }}
                          />
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
                          onClick={() => updateInlineViewParams({ ad: savedAd.ad!._id })}
                          className="ring-1 ring-border/70 rounded-2xl p-4 hover:ring-foreground/15 hover:shadow-card transition-all duration-300 cursor-pointer group bg-card"
                        >
                          <div className="flex items-start gap-4">
                            <ImageDisplay
                              src={savedAd.ad!.images[0] || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop'}
                              alt={savedAd.ad!.title}
                              className="w-20 h-20 object-cover rounded-xl ring-1 ring-border/60 group-hover:scale-[1.03] transition-transform duration-300 flex-shrink-0"
                              size="card"
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

              {activeTab === "bundles" && bundleModeEnabled && <BundlesTab />}

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
                    <div className="space-y-3">
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
                          <ToggleSwitch
                            checked={user.emailNotificationsEnabled || false}
                            ariaLabel="Toggle email notifications"
                            onChange={(checked) => { void handleToggleEmailNotifications(checked); }}
                          />
                        </div>
                      </div>
                    )}
                    <BrowserNotificationsCard />
                    </div>
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
            </div>
          </div>
        </div>
      </div>

      {/* Delete Flyer Confirmation Modal */}
      {manageBundleId && (
        <BundleManageModal
          bundleId={manageBundleId}
          onClose={() => setManageBundleId(null)}
        />
      )}

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

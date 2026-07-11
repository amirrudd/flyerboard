import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
    Archive,
    CaretLeft,
    ChatText,
    DotsThree,
    X,
} from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageLoader } from "../components/PageLoader";
import { ReportModal } from "../components/ReportModal";
import { ChatItemSkeleton } from "../components/ui/DashboardSkeleton";
import { useUserSync } from "../context/UserSyncContext";
import { SignOutButton } from "../features/auth/SignOutButton";
import { ThemeToggle } from "../components/ThemeToggle";
import { useHeaderSlots } from "../features/layout/HeaderSlots";
import { useDeviceInfo } from "../hooks/useDeviceInfo";
import { useMotionPrefs } from "../hooks/useMotionPrefs";
import {
    ConversationHeader,
    ConversationThread,
    InboxRow,
    MessageComposer,
    getCounterpartName,
    getItemTitle,
    getThreadMeta,
    useInbox,
} from "../features/messages";
import type { InboxChat, InboxFilter, ThreadMessage } from "../features/messages";

const NO_MESSAGES: never[] = [];

/**
 * Focus restoration (a11y): on mobile the full-screen thread replaces the
 * inbox wholesale, so the originating row is tracked at module scope and
 * re-focused the next time the inbox mounts with its rows rendered.
 */
let lastOpenedChatId: string | null = null;

/** An optimistic outgoing message, keyed by a client-generated UUID. */
interface PendingMessage {
    clientId: string;
    content: string;
    timestamp: number;
    failed: boolean;
}

const OFFLINE_MESSAGE =
    "You're offline — messages will update when you reconnect";

/** How long the socket must stay down before the UI surfaces "offline". */
const OFFLINE_DEBOUNCE_MS = 2000;

// Segmented filter options for the unified inbox (ported from the dashboard
// chats tab — same ids the shared `useInbox` filter expects).
const INBOX_FILTERS: Array<{ id: InboxFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "selling", label: "Selling" },
    { id: "buying", label: "Buying" },
];

/**
 * Dedicated Messages destination.
 *
 * Routes: `/messages` (inbox), `/messages/archived` (archived sub-view) and
 * `/messages/:chatId` (conversation thread). The legacy dashboard chats tab
 * (`/dashboard?tab=chats[&chat=X]`) redirects here — see the shim in
 * `DashboardPage.tsx`. An optional `?flyer=<adId>` query filters the inbox to
 * conversations about one flyer and is preserved across the redirect.
 *
 * The inbox and the conversation thread are assembled entirely from
 * `src/features/messages/` (the ONE sanctioned chat implementation).
 */
export function MessagesPage() {
    const navigate = useNavigate();
    const goHome = () => { void navigate('/'); };
    const { isAuthenticated, isSessionLoading } = useSession();
    const { chatId } = useParams<{ chatId: string }>();
    const { isMobile } = useDeviceInfo();

    // `/messages/archived` matches the `:chatId` route but is an inbox
    // sub-view, not a conversation thread — it keeps the normal header and
    // bottom nav.
    const isThread = !!chatId && chatId !== "archived";

    // On the full-screen conversation route (<md) the thread supplies its own
    // header (Phase 3) — hide the persistent shell header via the `hidden`
    // slot, the same mechanism the dashboard uses for AdMessages. Everywhere
    // else mirror the dashboard's app bar: back, title, theme + sign out —
    // no search/location chrome.
    // (Hook must be called unconditionally — hooks rules.)
    useHeaderSlots(
        isThread && isMobile
            ? { hidden: true }
            : {
                  leftNode: (
                      <button
                          type="button"
                          onClick={goHome}
                          aria-label="Back"
                          className="inline-flex items-center gap-2 h-10 px-3 -ml-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all"
                      >
                          <CaretLeft className="w-5 h-5" />
                          <span className="hidden md:inline text-sm font-medium">back</span>
                      </button>
                  ),
                  centerNode: (
                      <span className="font-display text-xl font-semibold tracking-tight text-foreground">
                          {isMobile ? "Messages" : "FlyerBoard"}
                      </span>
                  ),
                  rightNode: (
                      <div className="flex items-center gap-3">
                          <ThemeToggle />
                          <SignOutButton onSignOut={goHome} iconOnly={isMobile} />
                      </div>
                  ),
              }
    );

    // Route guard — same pattern as DashboardPage: PageLoader while the
    // session resolves, redirect home when unauthenticated.
    useEffect(() => {
        if (!isSessionLoading && !isAuthenticated) {
            void navigate('/', { replace: true });
        }
    }, [isAuthenticated, isSessionLoading, navigate]);

    // Leaving /messages* entirely discards any pending focus-restore target —
    // a stale id must never steal focus on a much later inbox visit. (The
    // page stays mounted across inbox <-> thread navigation, so the in-flow
    // restore still works.)
    useEffect(() => () => { lastOpenedChatId = null; }, []);

    if (isSessionLoading || !isAuthenticated) {
        return <PageLoader />;
    }

    if (chatId === "archived") {
        return <ArchivedView />;
    }

    // Mobile (<md): full-screen swaps — inbox page or portal thread.
    if (isMobile) {
        return isThread ? <ThreadView key={chatId} chatId={chatId} /> : <InboxView />;
    }

    // Desktop (≥md): two-pane master–detail. The URL (:chatId) is the single
    // source of truth for the selection — a row tap navigates, no ?chat=
    // params. Height is dvh-derived flex (dynamic viewport minus the 57px
    // sticky header + page padding), never static viewport units.
    return (
        <div className="container-padding mx-auto w-full max-w-6xl py-6">
            <div className="grid grid-cols-[24rem_1fr] h-[calc(100dvh-8rem)] min-h-[420px] ring-1 ring-border/70 rounded-2xl bg-card shadow-card overflow-hidden">
                <aside
                    aria-label="Conversations"
                    className="min-h-0 border-r border-border/70"
                >
                    <InboxView pane activeChatId={isThread ? chatId : undefined} />
                </aside>
                <div className="min-h-0 min-w-0 flex flex-col">
                    {isThread ? (
                        <ThreadView key={chatId} chatId={chatId} />
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center p-8 max-w-prose">
                                <div className="flex justify-center mb-4">
                                    <ChatText className="w-12 h-12 text-muted-foreground/30" weight="light" aria-hidden="true" />
                                </div>
                                <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-2">Select a conversation</h2>
                                <p className="text-[15px] leading-relaxed text-foreground/70">Choose a conversation from the list to start messaging</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Overflow ("⋯") menu on the inbox header. Small accessible disclosure menu:
 * closes on outside pointer-down and Escape. Currently one entry — Archived.
 */
function OverflowMenu() {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    return (
        <div ref={containerRef} className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-label="More options"
                aria-haspopup="menu"
                aria-expanded={open}
                className="inline-flex items-center justify-center w-11 h-11 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all"
            >
                <DotsThree className="w-6 h-6" weight="bold" aria-hidden="true" />
            </button>
            {open && (
                <div
                    role="menu"
                    aria-label="Messages options"
                    className="absolute right-0 top-full mt-1 z-20 min-w-44 bg-card ring-1 ring-border/70 rounded-2xl shadow-card-hover py-1.5"
                >
                    <Link
                        role="menuitem"
                        to="/messages/archived"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 min-h-11 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 rounded-xl mx-1 transition-colors"
                    >
                        <Archive className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        Archived
                    </Link>
                </div>
            )}
        </div>
    );
}

/**
 * The unified inbox at `/messages`: page header + overflow menu, All/Selling/
 * Buying filter pills (ported from the dashboard chats tab), optional
 * `?flyer=` chip, and the conversation list.
 *
 * Two render contexts:
 * - Page (mobile default): scrolling happens in Layout's `<main>` — no
 *   nested scroller (mobile body is scroll-locked).
 * - `pane` (desktop two-pane left column): fills its parent and owns its own
 *   list scroll; `activeChatId` highlights the open thread's row.
 */
function InboxView({
    pane = false,
    activeChatId,
}: {
    pane?: boolean;
    activeChatId?: string;
}) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const flyerParam = searchParams.get("flyer");
    const { reduced } = useMotionPrefs();

    const inbox = useInbox({ flyerId: flyerParam ?? undefined });
    const archiveChat = useMutation(api.messages.archiveChat);

    // Restore focus to the row that opened the last thread (mobile back —
    // the thread unmounted this whole view). Waits for rows to render.
    const inboxLoading = inbox.isLoading;
    useEffect(() => {
        if (inboxLoading || !lastOpenedChatId) return;
        const row = document.querySelector<HTMLElement>(
            `[data-chat-id="${lastOpenedChatId}"]`
        );
        row?.focus();
        // One shot either way: a row missing from this list (filtered out,
        // archived, deleted) must not ambush a later inbox visit.
        lastOpenedChatId = null;
    }, [inboxLoading]);

    // Title for the removable "?flyer=" chip — taken from any matching
    // conversation (the deep link comes from a context that has chats).
    const flyerFilterTitle = flyerParam
        ? (() => {
            const match = inbox.conversations.find(
                (conversation) => conversation.adId === flyerParam
            );
            return match ? getItemTitle(match) : "this flyer";
        })()
        : null;

    // Single URL writer for this page's params: dismissing the chip clears
    // `flyer` with replace:true (no history spam, no second writer).
    const dismissFlyerFilter = () => {
        const next = new URLSearchParams(searchParams);
        next.delete("flyer");
        setSearchParams(next, { replace: true });
    };

    const handleArchive = async (chatId: string) => {
        try {
            await archiveChat({ chatId: chatId as Id<"chats"> });
            toast.success("Chat archived successfully");
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Failed to archive chat"
            );
        }
    };

    return (
        <div
            className={
                pane
                    ? "flex h-full min-h-0 flex-col p-4"
                    : "container-padding mx-auto w-full max-w-2xl py-6 pb-bottom-nav"
            }
        >
            <div className="flex items-center justify-between gap-3">
                <h1 className="font-display text-2xl font-semibold text-foreground">Messages</h1>
                <OverflowMenu />
            </div>

            {/* Filter pills + flyer chip (ported from UserDashboard chats tab) */}
            <div className="flex flex-wrap items-center gap-2 mt-3 mb-5">
                <div
                    role="tablist"
                    aria-label="Filter conversations"
                    className="inline-flex items-center gap-1 rounded-full bg-muted/50 ring-1 ring-border p-1"
                >
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
                                        layoutId="messages-filter-pill"
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
                        onClick={dismissFlyerFilter}
                        aria-label={`Stop showing chats about ${flyerFilterTitle}`}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary/[0.08] ring-1 ring-primary/30 text-primary text-sm font-medium hover:bg-primary/[0.14] hover:ring-primary/50 active:scale-[0.98] transition-all max-w-full"
                    >
                        <span className="truncate">Showing chats about: {flyerFilterTitle}</span>
                        <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    </button>
                )}
            </div>

            {/* In pane mode the list scrolls inside the column (the page has
                no scroller of its own on desktop two-pane). */}
            <div className={pane ? "flex-1 min-h-0 overflow-y-auto" : undefined}>
            {inbox.isLoading ? (
                <div
                    role="status"
                    aria-label="Loading conversations"
                    className="space-y-3"
                >
                    {Array.from({ length: 6 }, (_, index) => (
                        <ChatItemSkeleton key={index} />
                    ))}
                </div>
            ) : inbox.conversations.length === 0 ? (
                flyerParam ? (
                    <div className="text-center py-16">
                        <div className="flex justify-center mb-4">
                            <ChatText className="w-16 h-16 text-muted-foreground/30" weight="light" aria-hidden="true" />
                        </div>
                        <p className="text-[15px] text-muted-foreground max-w-prose mx-auto">
                            No conversations about this flyer yet.
                        </p>
                    </div>
                ) : inbox.filter === "all" ? (
                    <div className="text-center py-16">
                        <div className="flex justify-center mb-4">
                            <ChatText className="w-16 h-16 text-muted-foreground/30" weight="light" aria-hidden="true" />
                        </div>
                        <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-2">No messages yet</h2>
                        <p className="text-[15px] text-muted-foreground max-w-prose mx-auto mb-6">
                            Conversations with buyers and sellers will appear here
                        </p>
                        <Link
                            to="/"
                            className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all"
                        >
                            Browse flyers
                        </Link>
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <div className="flex justify-center mb-4">
                            <ChatText className="w-16 h-16 text-muted-foreground/30" weight="light" aria-hidden="true" />
                        </div>
                        <p className="text-[15px] text-muted-foreground max-w-prose mx-auto">
                            No {inbox.filter} conversations yet.
                        </p>
                    </div>
                )
            ) : (
                <div className="ring-1 ring-border/70 rounded-2xl overflow-hidden divide-y divide-border/70 bg-card">
                    {inbox.conversations.map((conversation, index) => (
                        <InboxRow
                            key={conversation._id}
                            chat={conversation}
                            role={conversation.role}
                            index={index}
                            isActive={conversation._id === activeChatId}
                            className="min-h-[4.5rem]"
                            onOpen={(chatId) => {
                                lastOpenedChatId = chatId;
                                void navigate(flyerParam ? `/messages/${chatId}?flyer=${encodeURIComponent(flyerParam)}` : `/messages/${chatId}`);
                            }}
                            // Archive is buyer-only: the archived view only
                            // surfaces buyer-archived chats, so a chat archived
                            // from a selling row would have no recovery UI.
                            onArchive={
                                conversation.role === "buying"
                                    ? (chatId) => { void handleArchive(chatId); }
                                    : undefined
                            }
                        />
                    ))}
                </div>
            )}
            </div>
        </div>
    );
}

/**
 * Archived sub-view at `/messages/archived` (ported from the dashboard's
 * archived tab): back link, buyer-side archived list, per-row Unarchive,
 * bulk-select, and bulk delete behind a strong confirm — `deleteArchivedChats`
 * HARD-deletes the conversation and its messages for BOTH participants.
 */
function ArchivedView() {
    const navigate = useNavigate();

    // Auth + user-sync gate (same pattern as useInbox) — querying before the
    // sync completes causes "Not authenticated" race errors.
    const { isAuthenticated, isSessionLoading } = useSession();
    const { isUserSynced } = useUserSync();
    const ready = isAuthenticated && !isSessionLoading && isUserSynced;

    const archivedChatsRaw = useQuery(
        api.messages.getArchivedChats,
        ready ? {} : "skip"
    );
    const unarchiveChat = useMutation(api.messages.unarchiveChat);
    const deleteArchivedChats = useMutation(api.messages.deleteArchivedChats);

    const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Anything before data arrives (session resolving, user-sync pending,
    // query in flight) must read as loading — never as an empty archive.
    const isLoading = !ready || archivedChatsRaw === undefined;

    // getArchivedChats returns buyer-side rows without an unreadCount —
    // normalize to the shared InboxChat shape (archived rows show no badge).
    const archivedChats: InboxChat[] = useMemo(
        () => (archivedChatsRaw ?? []).map((chat) => ({ ...chat, unreadCount: 0 })),
        [archivedChatsRaw]
    );

    // Derived selection, pruned against the live list so rows that disappear
    // (deleted or unarchived, possibly from another device) can't stay
    // counted in the bulk-delete selection.
    const selectedChats = useMemo(() => {
        const liveIds = new Set(archivedChats.map((chat) => chat._id));
        const pruned = new Set(
            [...selectedChatIds].filter((chatId) => liveIds.has(chatId))
        );
        return pruned.size === selectedChatIds.size ? selectedChatIds : pruned;
    }, [selectedChatIds, archivedChats]);

    // Escape closes the confirm dialog — but not while the delete mutation is
    // in flight (the dialog is the only signal the delete is still running).
    useEffect(() => {
        if (!showDeleteConfirm || isDeleting) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setShowDeleteConfirm(false);
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [showDeleteConfirm, isDeleting]);

    const toggleSelected = (chatId: string) => {
        setSelectedChatIds((previous) => {
            const next = new Set(previous);
            if (next.has(chatId)) {
                next.delete(chatId);
            } else {
                next.add(chatId);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedChats.size === archivedChats.length) {
            setSelectedChatIds(new Set());
        } else {
            setSelectedChatIds(new Set(archivedChats.map((chat) => chat._id)));
        }
    };

    const handleUnarchive = async (chatId: string) => {
        try {
            await unarchiveChat({ chatId: chatId as Id<"chats"> });
            setSelectedChatIds((previous) => {
                if (!previous.has(chatId)) return previous;
                const next = new Set(previous);
                next.delete(chatId);
                return next;
            });
            toast.success("Chat moved back to your inbox");
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Failed to unarchive chat"
            );
        }
    };

    const handleDeleteSelected = async () => {
        if (isDeleting) return;
        if (selectedChats.size === 0) return;
        setIsDeleting(true);
        try {
            await deleteArchivedChats({
                chatIds: Array.from(selectedChats) as Id<"chats">[],
            });
            toast.success("Selected chats deleted");
            setSelectedChatIds(new Set());
            setShowDeleteConfirm(false);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Failed to delete chats"
            );
        } finally {
            setIsDeleting(false);
        }
    };

    const selectedCount = selectedChats.size;

    return (
        <div className="container-padding mx-auto w-full max-w-2xl py-6 pb-bottom-nav">
            <Link
                to="/messages"
                className="inline-flex items-center gap-1 min-h-11 -ml-2 px-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                <CaretLeft className="w-4 h-4" aria-hidden="true" />
                Back to Messages
            </Link>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-1 mb-5">
                <h1 className="font-display text-2xl font-semibold text-foreground">Archived Messages</h1>
                {archivedChats.length > 0 && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={toggleSelectAll}
                            className="inline-flex items-center h-9 px-3.5 rounded-full bg-muted/40 ring-1 ring-border text-foreground text-sm font-medium hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all"
                        >
                            {selectedCount === archivedChats.length ? 'Deselect All' : 'Select All'}
                        </button>
                        {selectedCount > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="inline-flex items-center h-9 px-3.5 rounded-full bg-destructive/10 ring-1 ring-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/20 active:scale-[0.98] transition-all"
                            >
                                Delete Selected ({selectedCount})
                            </button>
                        )}
                    </div>
                )}
            </div>

            {isLoading ? (
                <div
                    role="status"
                    aria-label="Loading archived conversations"
                    className="space-y-3"
                >
                    {Array.from({ length: 3 }, (_, index) => (
                        <ChatItemSkeleton key={index} />
                    ))}
                </div>
            ) : archivedChats.length === 0 ? (
                <div className="text-center py-16">
                    <div className="flex justify-center mb-4">
                        <Archive className="w-16 h-16 text-muted-foreground/30" weight="light" aria-hidden="true" />
                    </div>
                    <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-2">No archived messages</h2>
                    <p className="text-[15px] text-muted-foreground max-w-prose mx-auto">
                        Archived conversations will appear here
                    </p>
                </div>
            ) : (
                <div className="ring-1 ring-border/70 rounded-2xl overflow-hidden divide-y divide-border/70 bg-card">
                    {archivedChats.map((chat, index) => (
                        <div key={chat._id} className="flex items-stretch">
                            <label className="flex items-center justify-center w-11 shrink-0 pl-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedChats.has(chat._id)}
                                    onChange={() => toggleSelected(chat._id)}
                                    aria-label={`Select conversation about ${getItemTitle(chat)}`}
                                    className="w-4 h-4 rounded accent-primary"
                                />
                            </label>
                            <div className="flex-1 min-w-0">
                                <InboxRow
                                    chat={chat}
                                    role="buying"
                                    index={index}
                                    className="min-h-[4.5rem]"
                                    archiveLabel="Unarchive"
                                    onOpen={(chatId) => { void navigate(`/messages/${chatId}`); }}
                                    onArchive={(chatId) => { void handleUnarchive(chatId); }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Strong confirm: deleteArchivedChats hard-deletes for BOTH sides. */}
            {showDeleteConfirm && createPortal(
                <div
                    className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => {
                        if (!isDeleting) setShowDeleteConfirm(false);
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-chats-title"
                >
                    <div
                        className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card-hover p-6 w-full max-w-md"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="delete-chats-title" className="font-display text-2xl font-semibold tracking-tight text-foreground mb-3">
                            Delete {selectedCount === 1 ? 'this conversation' : `${selectedCount} conversations`}?
                        </h2>
                        <p className="text-[15px] leading-relaxed text-foreground/75 mb-6 max-w-prose">
                            This permanently deletes {selectedCount === 1 ? 'the conversation' : 'these conversations'} and
                            every message inside — for both you <strong>and the other person</strong>. They
                            lose their copy too, and it cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                // Focus lands on the non-destructive action when the modal opens.
                                autoFocus
                                disabled={isDeleting}
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 inline-flex items-center justify-center h-11 px-4 rounded-full bg-muted/40 ring-1 ring-border text-foreground font-medium hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] disabled:opacity-60 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => { void handleDeleteSelected(); }}
                                className="flex-1 inline-flex items-center justify-center h-11 px-4 rounded-full bg-destructive text-destructive-foreground font-semibold shadow-sm shadow-destructive/25 hover:bg-destructive/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 transition-all"
                            >
                                Delete for both sides
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

/**
 * Full-screen conversation at `/messages/:chatId`.
 *
 * Mobile (<md): rendered through a body portal (`fixed inset-0` column) — the
 * shell `<main>` has `contain: paint`, so `position: fixed` inside it would be
 * contained; the portal escapes it (same pattern as AdMessages). BottomNav and
 * the persistent header are both hidden on this route, so the column owns the
 * whole viewport: `pt-safe` header, `pb-safe` composer, no static
 * viewport-height units anywhere (inset-0/dvh only).
 *
 * Desktop (≥md): rendered as the right pane of the two-pane master–detail
 * layout owned by MessagesPage — no portal, fills the parent column.
 */
function ThreadView({ chatId }: { chatId: string }) {
    const navigate = useNavigate();
    // Preserve an active ?flyer= inbox filter across the open/back round trip.
    const [searchParams] = useSearchParams();
    const flyerParam = searchParams.get("flyer");
    const { isMobile } = useDeviceInfo();
    const { slideOver } = useMotionPrefs();
    const [showReportModal, setShowReportModal] = useState(false);
    // Mobile portal column — used to focus the back button on entry (a11y).
    const portalColumnRef = useRef<HTMLDivElement>(null);

    // Optimistic sends: rendered merged into the live thread until the
    // mutation resolves (removed — the real message arrives via the live
    // query) or rejects (marked failed, bubble offers retry).
    const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);

    // Convex connection state (reactive hook, convex 1.42). "Offline" only
    // after the socket has (a) connected once — the initial connect window
    // must not flash the banner — and (b) stayed down ~2s, so routine
    // reconnect blips (tab wake, network switch) don't flicker it either.
    const connection = useConvexConnectionState();
    const socketDown =
        connection.hasEverConnected && !connection.isWebSocketConnected;
    const [isOffline, setIsOffline] = useState(false);
    useEffect(() => {
        // Down: latch "offline" only after the debounce window. Back up:
        // clear on the next tick (0ms) — effectively immediate.
        const timer = window.setTimeout(
            () => setIsOffline(socketDown),
            socketDown ? OFFLINE_DEBOUNCE_MS : 0
        );
        return () => window.clearTimeout(timer);
    }, [socketDown]);

    // Canonical auth+sync gate (same as useInbox) for this view's own query.
    const { isAuthenticated, isSessionLoading } = useSession();
    const { isUserSynced } = useUserSync();
    const authReady = isAuthenticated && !isSessionLoading && isUserSynced;

    // Conversation metadata comes from the same merged inbox the list uses —
    // the same derivation the dashboard chats tab used for ?chat=.
    const inbox = useInbox();
    const inboxConversation = useMemo(
        () =>
            inbox.conversations.find((entry) => entry._id === chatId) ?? null,
        [inbox.conversations, chatId]
    );

    // Archived chats are excluded from getSellerChats/getBuyerChats, so an
    // archived row (or a deep link to one) would dead-end on "not found" —
    // fall back to the buyer-side archived list for the lookup. Subscribed
    // only when the inbox has loaded and come up empty for this id.
    const archivedChatsRaw = useQuery(
        api.messages.getArchivedChats,
        authReady && !inbox.isLoading && !inboxConversation ? {} : "skip"
    );
    const conversation = useMemo(() => {
        if (inboxConversation) return inboxConversation;
        const archived = (archivedChatsRaw ?? []).find((chat) => chat._id === chatId);
        // Same normalization as ArchivedView: buyer-archived only, no badge.
        return archived ? { ...archived, unreadCount: 0, role: "buying" as const } : null;
    }, [inboxConversation, archivedChatsRaw, chatId]);

    // Still resolving while the inbox loads, or while the archived fallback
    // for an id missing from the inbox hasn't answered yet.
    const isResolving =
        inbox.isLoading ||
        (!inboxConversation && authReady && archivedChatsRaw === undefined);

    // Messages are gated on the conversation actually existing in the inbox
    // (not just the raw URL param) so a bogus/foreign :chatId never hits
    // getChatMessages' participant check — a throwing useQuery would surface
    // via the route ErrorBoundary, and the in-page "Conversation not found"
    // state below is the intended UX instead (established pattern from the
    // dashboard chats tab).
    const messages = useQuery(
        api.messages.getChatMessages,
        conversation ? { chatId: conversation._id as Id<"chats"> } : "skip"
    );

    // All thread kinds (flyer/sale/bundle) send through messages.sendMessage —
    // the mutation participant-checks against the shared `chats` row, exactly
    // as the dashboard chats tab did.
    const sendMessage = useMutation(api.messages.sendMessage);
    const markAsRead = useMutation(api.messages.markChatAsRead);

    // Mark the conversation read on entry, on thread change, and whenever a
    // new message arrives while the thread is open (keyed on the newest
    // visible timestamp — markChatAsRead only patches lastReadBy*, which
    // never feeds these deps, so no loop). Gated on the conversation being
    // FOUND: a foreign or malformed id must never touch read state.
    const conversationId = conversation?._id;
    const latestMessageTimestamp = messages?.length
        ? messages[messages.length - 1].timestamp
        : 0;
    useEffect(() => {
        if (conversationId) {
            markAsRead({ chatId: conversationId as Id<"chats"> }).catch(() => {
                // Read-state failures are non-fatal; the badge just persists.
            });
        }
    }, [conversationId, latestMessageTimestamp, markAsRead]);

    // A11y: on the mobile full-screen thread, move focus to the header's
    // back button once the conversation has rendered (inbox → thread and
    // deep-link entries alike).
    useEffect(() => {
        if (!isMobile || !conversationId) return;
        portalColumnRef.current
            ?.querySelector<HTMLElement>('button[aria-label="Back"]')
            ?.focus();
    }, [isMobile, conversationId]);

    // Fire-and-forget send: the promise deliberately outlives this component
    // (navigating away must not lose an in-flight send). Resolution removes
    // the pending bubble — Convex applies the mutation's writes to the live
    // getChatMessages subscription before resolving, so the real message is
    // already on screen. Rejection marks the bubble failed (tap to retry)
    // and toasts; the typed content is never lost.
    const dispatchSend = useCallback(
        (clientId: string, content: string, chatId: Id<"chats">) => {
            sendMessage({ chatId, content }).then(
                () => {
                    setPendingMessages((previous) =>
                        previous.filter((pending) => pending.clientId !== clientId)
                    );
                },
                (error: unknown) => {
                    setPendingMessages((previous) =>
                        previous.map((pending) =>
                            pending.clientId === clientId
                                ? { ...pending, failed: true }
                                : pending
                        )
                    );
                    toast.error(
                        error instanceof Error && error.message
                            ? error.message
                            : "Failed to send message"
                    );
                }
            );
        },
        [sendMessage]
    );

    // The role tag tells us which side of the chat we are — no extra
    // current-user query needed for bubble alignment. Empty while the
    // conversation is still resolving (nothing renders bubbles then).
    const currentUserId = conversation
        ? conversation.role === "selling"
            ? conversation.sellerId
            : conversation.buyerId
        : "";

    // Retry a failed optimistic send. Guarded: bail unless the entry still
    // exists AND is still failed — a stale closure (double-tap, memoized
    // bubble) must never double-fire the mutation.
    const retrySend = useCallback(
        (pending: PendingMessage) => {
            const entry = pendingMessages.find(
                (candidate) => candidate.clientId === pending.clientId
            );
            if (!entry || !entry.failed || !conversationId) return;
            setPendingMessages((previous) =>
                previous.map((candidate) =>
                    candidate.clientId === pending.clientId
                        ? { ...candidate, failed: false, timestamp: Date.now() }
                        : candidate
                )
            );
            dispatchSend(pending.clientId, pending.content, conversationId as Id<"chats">);
        },
        [pendingMessages, conversationId, dispatchSend]
    );

    // Live messages + optimistic bubbles. ConversationThread sorts by
    // timestamp, so a plain concat keeps chronology. Memoized so unrelated
    // re-renders of this view hand ConversationThread a stable array
    // (belt-and-braces with its newest-id-keyed auto-scroll).
    const threadMessages: ThreadMessage[] = useMemo(
        () => [
            ...(messages ?? NO_MESSAGES),
            ...pendingMessages.map((pending) => ({
                _id: `pending-${pending.clientId}`,
                content: pending.content,
                timestamp: pending.timestamp,
                senderId: currentUserId,
                pending: !pending.failed,
                failed: pending.failed,
                onRetry: pending.failed ? () => retrySend(pending) : undefined,
            })),
        ],
        [messages, pendingMessages, currentUserId, retrySend]
    );

    if (isResolving) {
        return (
            <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4" aria-hidden="true"></div>
                    <p className="text-muted-foreground font-medium">Loading conversation...</p>
                </div>
            </div>
        );
    }

    if (!conversation) {
        // Foreign, malformed, or archived-away ids land here — an in-page
        // state, never the route ErrorBoundary.
        return (
            <div className="container-padding mx-auto w-full max-w-2xl py-16 text-center">
                <div className="flex justify-center mb-4">
                    <ChatText className="w-16 h-16 text-muted-foreground/30" weight="light" aria-hidden="true" />
                </div>
                <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground mb-2">Conversation not found</h1>
                <p className="text-[15px] text-muted-foreground max-w-prose mx-auto mb-6">
                    This conversation may have been deleted, or the link is invalid.
                </p>
                <button
                    type="button"
                    onClick={() => { void navigate("/messages"); }}
                    className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all"
                >
                    Back to messages
                </button>
            </div>
        );
    }

    const meta = getThreadMeta(conversation);
    const counterpartName = getCounterpartName(conversation, conversation.role);

    const handleSend = async (content: string) => {
        const clientId = crypto.randomUUID();
        setPendingMessages((previous) => [
            ...previous,
            { clientId, content, timestamp: Date.now(), failed: false },
        ]);
        // Resolve immediately: the composer clears its draft right away
        // (<100ms perceived send) and the mutation continues independently.
        dispatchSend(clientId, content, conversation._id as Id<"chats">);
    };

    const threadColumn = (
        <>
            <ConversationHeader
                image={conversation.ad?.images?.[0]}
                title={getItemTitle(conversation)}
                subtitle={`${conversation.role === "selling" ? "Buyer" : "Seller"}: ${counterpartName}`}
                price={conversation.ad?.price}
                statusLabel={meta.statusLabel}
                onBack={() => { void navigate(flyerParam ? `/messages?flyer=${encodeURIComponent(flyerParam)}` : "/messages"); }}
                viewItemLabel={meta.viewItemLabel}
                onViewItem={meta.viewItemHref ? () => { void navigate(meta.viewItemHref as string); } : undefined}
                onReport={() => setShowReportModal(true)}
            />
            <ConversationThread
                messages={threadMessages}
                currentUserId={currentUserId}
            />
            {isOffline && (
                <div
                    role="status"
                    className="shrink-0 px-4 py-2 border-t border-border/70 bg-muted/70 text-xs font-medium text-muted-foreground text-center"
                >
                    {OFFLINE_MESSAGE}
                </div>
            )}
            {/* pb-safe keeps the composer above the iOS home indicator. */}
            <div className="pb-safe bg-card shrink-0">
                <MessageComposer
                    onSend={handleSend}
                    disabled={meta.composerDisabled || isOffline}
                    // A permanent thread-kind reason (e.g. deleted flyer) wins
                    // over the transient offline one.
                    disabledReason={
                        meta.composerDisabled
                            ? meta.composerDisabledReason
                            : "You're offline"
                    }
                />
            </div>
            <ReportModal
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                reportType="chat"
                reportedEntityId={conversation._id}
                reportedEntityName={`Conversation with ${counterpartName}`}
            />
        </>
    );

    // Mobile: body portal (escapes <main>'s `contain: paint`), full-viewport
    // column. BottomNav is hidden on this route, so bottom-0 is correct.
    // slideOver() gives the inbox → thread swap its ~200ms slide-in (motion
    // helpers only ever come from useMotionPrefs — collapses under
    // prefers-reduced-motion).
    if (isMobile && typeof document !== "undefined") {
        return createPortal(
            <motion.div
                ref={portalColumnRef}
                {...slideOver()}
                className="fixed inset-0 z-40 bg-card flex flex-col pt-safe"
            >
                {threadColumn}
            </motion.div>,
            document.body
        );
    }

    // Desktop: fills the two-pane right column (parent owns height/borders).
    return <div className="flex flex-col h-full min-h-0">{threadColumn}</div>;
}

export default MessagesPage;

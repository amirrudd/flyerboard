import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { useMutation, useQuery } from "convex/react";
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
import { ChatItemSkeleton } from "../components/ui/DashboardSkeleton";
import { useUserSync } from "../context/UserSyncContext";
import { useHeaderSlots } from "../features/layout/HeaderSlots";
import { useDeviceInfo } from "../hooks/useDeviceInfo";
import { useMotionPrefs } from "../hooks/useMotionPrefs";
import { InboxRow, getItemTitle, useInbox } from "../features/messages";
import type { InboxChat, InboxFilter } from "../features/messages";

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
 * The inbox is assembled entirely from `src/features/messages/` (the ONE
 * sanctioned chat implementation). The thread route is a Phase 3 placeholder.
 */
export function MessagesPage() {
    const navigate = useNavigate();
    const { isAuthenticated, isSessionLoading } = useSession();
    const { chatId } = useParams<{ chatId: string }>();
    const { isMobile } = useDeviceInfo();

    // `/messages/archived` matches the `:chatId` route but is an inbox
    // sub-view, not a conversation thread — it keeps the normal header and
    // bottom nav.
    const isThread = !!chatId && chatId !== "archived";

    // On the full-screen conversation route (<md) the thread supplies its own
    // header (Phase 3) — hide the persistent shell header via the `hidden`
    // slot, the same mechanism the dashboard uses for AdMessages. The inbox
    // route keeps the normal header. Registering `{}` keeps the default
    // header (hook must be called unconditionally — hooks rules).
    useHeaderSlots(isThread && isMobile ? { hidden: true } : {});

    // Route guard — same pattern as DashboardPage: PageLoader while the
    // session resolves, redirect home when unauthenticated.
    useEffect(() => {
        if (!isSessionLoading && !isAuthenticated) {
            void navigate('/', { replace: true });
        }
    }, [isAuthenticated, isSessionLoading, navigate]);

    if (isSessionLoading || !isAuthenticated) {
        return <PageLoader />;
    }

    if (chatId === "archived") {
        return <ArchivedView />;
    }

    if (isThread) {
        // Phase 3 builds the full-screen conversation here.
        return (
            <div className="container-padding mx-auto w-full max-w-2xl py-6 pb-bottom-nav">
                <h1 className="font-display text-2xl font-semibold text-foreground">Messages</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    This conversation view is under construction.
                </p>
            </div>
        );
    }

    return <InboxView />;
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
 * `?flyer=` chip, and the conversation list. Scrolling happens in Layout's
 * `<main>` — no nested scroller here (mobile body is scroll-locked).
 */
function InboxView() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const flyerParam = searchParams.get("flyer");
    const { reduced } = useMotionPrefs();

    const inbox = useInbox({ flyerId: flyerParam ?? undefined });
    const archiveChat = useMutation(api.messages.archiveChat);

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
        <div className="container-padding mx-auto w-full max-w-2xl py-6 pb-bottom-nav">
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
                            className="min-h-[4.5rem]"
                            onOpen={(chatId) => { void navigate(`/messages/${chatId}`); }}
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

export default MessagesPage;

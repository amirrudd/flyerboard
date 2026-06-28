import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../../convex/_generated/dataModel";
import {
    MagnifyingGlass,
    UserCircleCheck,
    UserMinus,
    Trash,
    Shield,
    ShieldCheck,
    Eye,
    CaretDown,
    CaretUp,
} from '@phosphor-icons/react';
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { getDisplayName, getInitials } from "../../lib/displayName";
import { StarRating } from "../../components/ui/StarRating";
import { formatPrice } from "../../lib/priceFormatter";

export function UsersTab() {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "verified">("all");
    const [expandedUserId, setExpandedUserId] = useState<Id<"users"> | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<Id<"users"> | null>(null);

    const usersData = useQuery(api.admin.getAllUsers, {
        searchTerm: searchTerm || undefined,
        filterStatus: filterStatus === "all" ? undefined : filterStatus,
        paginationOpts: { numItems: 50, cursor: null },
    });

    const userDetails = useQuery(
        api.admin.getUserDetails,
        expandedUserId ? { userId: expandedUserId } : "skip"
    );

    const toggleUserStatus = useMutation(api.admin.toggleUserStatus);
    const deleteUser = useMutation(api.admin.deleteUserAccount);
    const toggleVerification = useMutation(api.admin.toggleUserVerification);

    const handleToggleStatus = async (userId: Id<"users">) => {
        try {
            const result = await toggleUserStatus({ userId });
            toast.success(result.isActive ? "User activated" : "User deactivated");
        } catch (error: any) {
            toast.error(error.message || "Failed to update user status");
        }
    };

    const handleDeleteUser = async (userId: Id<"users">) => {
        try {
            await deleteUser({ userId });
            toast.success("User deleted successfully");
            setShowDeleteConfirm(null);
        } catch (error: any) {
            toast.error(error.message || "Failed to delete user");
        }
    };

    const handleToggleVerification = async (userId: Id<"users">) => {
        try {
            const result = await toggleVerification({ userId });
            toast.success(result.isVerified ? "User verified" : "User unverified");
        } catch (error: any) {
            toast.error(error.message || "Failed to update verification status");
        }
    };

    const users = usersData?.users || [];

    return (
        <section className="space-y-6">
            {/* Header */}
            <header>
                <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">Accounts</h3>
                <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground mb-1">User Management</h2>
                <p className="text-[15px] text-muted-foreground">Manage user accounts, verification, and access</p>
            </header>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" aria-hidden="true" />
                    <label htmlFor="user-search" className="sr-only">Search users</label>
                    <input
                        id="user-search"
                        type="text"
                        placeholder="Search users by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all placeholder:text-muted-foreground/70 text-foreground"
                    />
                </div>
                <label htmlFor="user-filter" className="sr-only">Filter users</label>
                <select
                    id="user-filter"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground"
                >
                    <option value="all">All Users</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                    <option value="verified">Verified Only</option>
                </select>
            </div>

            {/* Stats */}
            {usersData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <article className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-4">
                        <div className="font-display text-2xl font-semibold tabular-nums text-foreground">{users.length}</div>
                        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mt-1">Total Users</div>
                    </article>
                    <article className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-4">
                        <div className="font-display text-2xl font-semibold tabular-nums text-green-600 dark:text-green-400">
                            {users.filter((u) => u.isActive !== false).length}
                        </div>
                        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mt-1">Active</div>
                    </article>
                    <article className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-4">
                        <div className="font-display text-2xl font-semibold tabular-nums text-destructive">
                            {users.filter((u) => u.isActive === false).length}
                        </div>
                        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mt-1">Inactive</div>
                    </article>
                    <article className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-4">
                        <div className="font-display text-2xl font-semibold tabular-nums text-purple-600 dark:text-purple-400">
                            {users.filter((u) => u.isVerified).length}
                        </div>
                        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mt-1">Verified</div>
                    </article>
                </div>
            )}

            {/* Users List */}
            <div className="space-y-3">
                {usersData === undefined ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto" aria-label="Loading users"></div>
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">No users found</p>
                    </div>
                ) : (
                    users.map((user) => (
                        <article key={user._id} className="bg-card ring-1 ring-border/70 rounded-2xl overflow-hidden shadow-sm transition-colors hover:ring-foreground/15">
                            {/* User Card */}
                            <div className="p-4">
                                <div className="flex items-start gap-4">
                                    {/* Avatar */}
                                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-semibold flex-shrink-0 overflow-hidden ring-1 ring-border/70">
                                        {user.image ? (
                                            <ImageDisplay
                                                imageRef={user.image}
                                                alt={user.name || "User"}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            getInitials(user)
                                        )}
                                    </div>

                                    {/* User Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">{getDisplayName(user)}</h3>
                                                    {user.isVerified && (
                                                        <div title="Verified" aria-label="Verified">
                                                            <ShieldCheck className="w-4 h-4 text-green-600" aria-hidden="true" />
                                                        </div>
                                                    )}
                                                    {user.isAdmin && (
                                                        <div title="Admin" aria-label="Admin">
                                                            <Shield className="w-4 h-4 text-primary" aria-hidden="true" />
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">{user.email}</p>
                                                <div className="mt-1">
                                                    <StarRating
                                                        rating={user.averageRating || 0}
                                                        count={user.ratingCount || 0}
                                                        size="sm"
                                                        showCount={true}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase ring-1 ${user.isActive === false
                                                        ? "bg-destructive/10 text-destructive ring-destructive/30"
                                                        : "bg-green-500/10 text-green-700 dark:text-green-400 ring-green-500/30"
                                                        }`}
                                                >
                                                    {user.isActive === false ? "Inactive" : "Active"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3 tabular-nums">
                                            <span>{user.totalAds || 0} flyers</span>
                                            <span>{user.activeAds || 0} active</span>
                                            <span className="text-xs text-muted-foreground/70">
                                                Joined {new Date(user._creationTime).toLocaleDateString()}
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpandedUserId(expandedUserId === user._id ? null : user._id)
                                                }
                                                aria-expanded={expandedUserId === user._id}
                                                className="h-8 px-3 inline-flex items-center gap-1 bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] rounded-full text-sm font-medium transition-all"
                                            >
                                                <Eye className="w-4 h-4" aria-hidden="true" />
                                                Details
                                                {expandedUserId === user._id ? (
                                                    <CaretUp className="w-4 h-4" aria-hidden="true" />
                                                ) : (
                                                    <CaretDown className="w-4 h-4" aria-hidden="true" />
                                                )}
                                            </button>

                                            {!user.isAdmin && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => { void handleToggleStatus(user._id); }}
                                                        className={`h-8 px-3 inline-flex items-center gap-1 ring-1 rounded-full text-sm font-medium transition-all active:scale-[0.98] ${user.isActive === false
                                                            ? "bg-transparent text-green-700 dark:text-green-400 ring-green-500/40 hover:ring-green-500 hover:bg-green-500/[0.06]"
                                                            : "bg-transparent text-destructive ring-destructive/40 hover:ring-destructive hover:bg-destructive/[0.06]"
                                                            }`}
                                                    >
                                                        {user.isActive === false ? (
                                                            <>
                                                                <UserCircleCheck className="w-4 h-4" aria-hidden="true" />
                                                                Activate
                                                            </>
                                                        ) : (
                                                            <>
                                                                <UserMinus className="w-4 h-4" aria-hidden="true" />
                                                                Deactivate
                                                            </>
                                                        )}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => { void handleToggleVerification(user._id); }}
                                                        className={`h-8 px-3 inline-flex items-center gap-1 ring-1 rounded-full text-sm font-medium transition-all active:scale-[0.98] ${user.isVerified
                                                            ? "bg-muted/40 text-foreground ring-border hover:bg-muted/70 hover:ring-foreground/15"
                                                            : "bg-transparent text-purple-700 dark:text-purple-400 ring-purple-500/40 hover:ring-purple-500 hover:bg-purple-500/[0.06]"
                                                            }`}
                                                    >
                                                        <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                                                        {user.isVerified ? "Unverify" : "Verify"}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setShowDeleteConfirm(user._id)}
                                                        className="h-8 px-3 inline-flex items-center gap-1 bg-transparent text-destructive ring-1 ring-destructive/40 hover:ring-destructive hover:bg-destructive/[0.06] active:scale-[0.98] rounded-full text-sm font-medium transition-all"
                                                    >
                                                        <Trash className="w-4 h-4" aria-hidden="true" />
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedUserId === user._id && userDetails && (
                                <div className="border-t border-border/60 bg-muted/30 p-4">
                                    <h4 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-3">User Activity</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                        <div>
                                            <div className="font-display text-lg font-semibold tabular-nums text-foreground">
                                                {userDetails.stats.totalAds}
                                            </div>
                                            <div className="text-xs text-muted-foreground">Total Flyers</div>
                                        </div>
                                        <div>
                                            <div className="font-display text-lg font-semibold tabular-nums text-green-600 dark:text-green-400">
                                                {userDetails.stats.activeAds}
                                            </div>
                                            <div className="text-xs text-muted-foreground">Active Flyers</div>
                                        </div>
                                        <div>
                                            <div className="font-display text-lg font-semibold tabular-nums text-destructive">
                                                {userDetails.stats.deletedAds}
                                            </div>
                                            <div className="text-xs text-muted-foreground">Deleted Flyers</div>
                                        </div>
                                        <div>
                                            <div className="font-display text-lg font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                                                {userDetails.stats.totalViews}
                                            </div>
                                            <div className="text-xs text-muted-foreground">Total Views</div>
                                        </div>
                                    </div>

                                    {userDetails.recentAds.length > 0 && (
                                        <div>
                                            <h5 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">Recent Flyers</h5>
                                            <div className="space-y-2">
                                                {userDetails.recentAds.map((ad) => (
                                                    <div
                                                        key={ad._id}
                                                        className="flex items-center gap-3 bg-card p-2 rounded-2xl ring-1 ring-border/70 shadow-sm"
                                                    >
                                                        {ad.images[0] && (
                                                            <ImageDisplay
                                                                imageRef={ad.images[0]}
                                                                alt={ad.title}
                                                                className="w-12 h-12 object-cover rounded-lg"
                                                            />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm text-foreground truncate">
                                                                {ad.title}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground tabular-nums">{formatPrice(ad.price ?? 0)}</p>
                                                        </div>
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase ring-1 ${ad.isDeleted
                                                                ? "bg-destructive/10 text-destructive ring-destructive/30"
                                                                : ad.isActive
                                                                    ? "bg-green-500/10 text-green-700 dark:text-green-400 ring-green-500/30"
                                                                    : "bg-muted text-muted-foreground ring-border"
                                                                }`}
                                                        >
                                                            {ad.isDeleted ? "Deleted" : ad.isActive ? "Active" : "Inactive"}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </article>
                    ))
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && createPortal(
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-user-title"
                    className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-scroll-lock"
                >
                    <div className="bg-card ring-1 ring-border/70 rounded-2xl shadow-xl p-6 max-w-md w-full">
                        <h2 id="delete-user-title" className="font-display text-2xl font-semibold tracking-tight text-foreground mb-2">Delete User Account</h2>
                        <p className="text-[15px] text-foreground/80 leading-relaxed mb-6">
                            Are you sure you want to delete this user? This will soft-delete all their flyers and
                            cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 h-11 px-4 bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] rounded-full font-medium transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => { void handleDeleteUser(showDeleteConfirm); }}
                                className="flex-1 h-11 px-4 bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98] rounded-full font-semibold shadow-sm shadow-destructive/25 transition-all"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </section>
    );
}

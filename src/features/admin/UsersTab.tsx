import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../../convex/_generated/dataModel";
import {
    Search,
    UserCheck,
    UserX,
    Trash2,
    Shield,
    ShieldCheck,
    Eye,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
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
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">User Management</h2>
                <p className="text-muted-foreground">Manage user accounts, verification, and access</p>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-border bg-background rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground"
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-4 py-2 border border-border bg-background rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground"
                >
                    <option value="all">All Users</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                    <option value="verified">Verified Only</option>
                </select>
            </div>

            {/* Stats */}
            {usersData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{users.length}</div>
                        <div className="text-sm text-muted-foreground">Total Users</div>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {users.filter((u) => u.isActive !== false).length}
                        </div>
                        <div className="text-sm text-muted-foreground">Active</div>
                    </div>
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-destructive">
                            {users.filter((u) => u.isActive === false).length}
                        </div>
                        <div className="text-sm text-muted-foreground">Inactive</div>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {users.filter((u) => u.isVerified).length}
                        </div>
                        <div className="text-sm text-muted-foreground">Verified</div>
                    </div>
                </div>
            )}

            {/* Users List */}
            <div className="space-y-4">
                {usersData === undefined ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">No users found</p>
                    </div>
                ) : (
                    users.map((user) => (
                        <div key={user._id} className="border border-border rounded-lg overflow-hidden bg-card/50">
                            {/* User Card */}
                            <div className="p-4">
                                <div className="flex items-start gap-4">
                                    {/* Avatar */}
                                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-semibold flex-shrink-0 overflow-hidden border border-border">
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
                                                    <h3 className="font-semibold text-foreground">{getDisplayName(user)}</h3>
                                                    {user.isVerified && (
                                                        <div title="Verified">
                                                            <ShieldCheck className="w-4 h-4 text-green-600 shadow-sm" />
                                                        </div>
                                                    )}
                                                    {user.isAdmin && (
                                                        <div title="Admin">
                                                            <Shield className="w-4 h-4 text-primary shadow-sm" />
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
                                                    className={`px-2 py-1 rounded-full text-xs font-medium ${user.isActive === false
                                                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                                                        : "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                                                        }`}
                                                >
                                                    {user.isActive === false ? "Inactive" : "Active"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                                            <span>{user.totalAds || 0} flyers</span>
                                            <span>{user.activeAds || 0} active</span>
                                            <span className="text-xs text-muted-foreground/60">
                                                Joined {new Date(user._creationTime).toLocaleDateString()}
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() =>
                                                    setExpandedUserId(expandedUserId === user._id ? null : user._id)
                                                }
                                                className="px-3 py-1 border border-border text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center gap-1"
                                            >
                                                <Eye className="w-4 h-4" />
                                                Details
                                                {expandedUserId === user._id ? (
                                                    <ChevronUp className="w-4 h-4" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4" />
                                                )}
                                            </button>

                                            {!user.isAdmin && (
                                                <>
                                                    <button
                                                        onClick={() => handleToggleStatus(user._id)}
                                                        className={`px-3 py-1 border rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${user.isActive === false
                                                            ? "border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
                                                            : "border-destructive/30 text-destructive hover:bg-destructive/5"
                                                            }`}
                                                    >
                                                        {user.isActive === false ? (
                                                            <>
                                                                <UserCheck className="w-4 h-4" />
                                                                Activate
                                                            </>
                                                        ) : (
                                                            <>
                                                                <UserX className="w-4 h-4" />
                                                                Deactivate
                                                            </>
                                                        )}
                                                    </button>

                                                    <button
                                                        onClick={() => handleToggleVerification(user._id)}
                                                        className={`px-3 py-1 border rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${user.isVerified
                                                            ? "border-border text-muted-foreground hover:bg-muted"
                                                            : "border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                                                            }`}
                                                    >
                                                        <ShieldCheck className="w-4 h-4" />
                                                        {user.isVerified ? "Unverify" : "Verify"}
                                                    </button>

                                                    <button
                                                        onClick={() => setShowDeleteConfirm(user._id)}
                                                        className="px-3 py-1 border border-destructive/30 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/5 transition-colors flex items-center gap-1"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
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
                                <div className="border-t border-border bg-muted/30 p-4">
                                    <h4 className="font-semibold text-foreground mb-3">User Activity</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                        <div>
                                            <div className="text-lg font-bold text-foreground">
                                                {userDetails.stats.totalAds}
                                            </div>
                                            <div className="text-xs text-muted-foreground">Total Flyers</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold text-green-600 dark:text-green-400">
                                                {userDetails.stats.activeAds}
                                            </div>
                                            <div className="text-xs text-muted-foreground">Active Flyers</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold text-destructive">
                                                {userDetails.stats.deletedAds}
                                            </div>
                                            <div className="text-xs text-muted-foreground">Deleted Flyers</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                {userDetails.stats.totalViews}
                                            </div>
                                            <div className="text-xs text-muted-foreground">Total Views</div>
                                        </div>
                                    </div>

                                    {userDetails.recentAds.length > 0 && (
                                        <div>
                                            <h5 className="font-medium text-foreground mb-2">Recent Flyers</h5>
                                            <div className="space-y-2">
                                                {userDetails.recentAds.map((ad) => (
                                                    <div
                                                        key={ad._id}
                                                        className="flex items-center gap-3 bg-card p-2 rounded border border-border shadow-sm"
                                                    >
                                                        {ad.images[0] && (
                                                            <ImageDisplay
                                                                imageRef={ad.images[0]}
                                                                alt={ad.title}
                                                                className="w-12 h-12 object-cover rounded"
                                                            />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm text-foreground truncate">
                                                                {ad.title}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">{formatPrice(ad.price ?? 0)}</p>
                                                        </div>
                                                        <span
                                                            className={`px-2 py-1 rounded text-xs font-medium ${ad.isDeleted
                                                                ? "bg-destructive/10 text-destructive"
                                                                : ad.isActive
                                                                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                                                    : "bg-muted text-muted-foreground"
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
                        </div>
                    ))
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-scroll-lock">
                    <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-bold text-foreground mb-2">Delete User Account</h3>
                        <p className="text-muted-foreground mb-6">
                            Are you sure you want to delete this user? This will soft-delete all their flyers and
                            cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteUser(showDeleteConfirm)}
                                className="flex-1 px-4 py-2 bg-destructive text-white rounded-lg hover:opacity-90 transition-colors shadow-sm"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

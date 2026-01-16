import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../../convex/_generated/dataModel";
import { Search, Trash2, Eye, X, Image as ImageIcon } from "lucide-react";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { formatPrice } from "../../lib/priceFormatter";

export function FlyersTab() {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "deleted">("all");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<Id<"ads"> | null>(null);
    const [showImageModal, setShowImageModal] = useState<{
        adId: Id<"ads">;
        images: string[];
    } | null>(null);

    const flyersData = useQuery(api.admin.getAllFlyers, {
        searchTerm: searchTerm || undefined,
        filterStatus: filterStatus === "all" ? undefined : filterStatus,
        paginationOpts: { numItems: 50, cursor: null },
    });

    const deleteFlyer = useMutation(api.admin.deleteFlyerAdmin);
    const deleteImage = useMutation(api.admin.deleteFlyerImage);

    const handleDeleteFlyer = async (adId: Id<"ads">) => {
        try {
            await deleteFlyer({ adId });
            toast.success("Flyer deleted successfully");
            setShowDeleteConfirm(null);
        } catch (error: any) {
            toast.error(error.message || "Failed to delete flyer");
        }
    };

    const handleDeleteImage = async (adId: Id<"ads">, imageRef: string) => {
        try {
            const result = await deleteImage({ adId, imageRef });
            toast.success(`Image deleted. ${result.remainingImages} images remaining.`);

            // Close modal if no images left
            if (result.remainingImages === 0) {
                setShowImageModal(null);
            } else {
                // Update modal images
                setShowImageModal((prev) =>
                    prev ? { ...prev, images: prev.images.filter((img) => img !== imageRef) } : null
                );
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to delete image");
        }
    };

    const flyers = flyersData?.flyers || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Flyer Moderation</h2>
                <p className="text-muted-foreground">Manage and moderate all flyers on the platform</p>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search flyers by title, description, or location..."
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
                    <option value="all">All Flyers</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                    <option value="deleted">Deleted Only</option>
                </select>
            </div>

            {/* Stats */}
            {flyersData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{flyers.length}</div>
                        <div className="text-sm text-muted-foreground">Total Flyers</div>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {flyers.filter((f) => f.isActive && !f.isDeleted).length}
                        </div>
                        <div className="text-sm text-muted-foreground">Active</div>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                            {flyers.filter((f) => !f.isActive && !f.isDeleted).length}
                        </div>
                        <div className="text-sm text-muted-foreground">Inactive</div>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {flyers.filter((f) => f.isDeleted).length}
                        </div>
                        <div className="text-sm text-muted-foreground">Deleted</div>
                    </div>
                </div>
            )}

            {/* Flyers List */}
            <div className="space-y-4">
                {flyersData === undefined ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
                    </div>
                ) : flyers.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">No flyers found</p>
                    </div>
                ) : (
                    flyers.map((flyer) => (
                        <div key={flyer._id} className="border border-border rounded-lg p-4 bg-card/50">
                            <div className="flex flex-col sm:flex-row gap-4">
                                {/* Image Preview */}
                                <div className="flex-shrink-0">
                                    {flyer.images[0] ? (
                                        <ImageDisplay
                                            imageRef={flyer.images[0]}
                                            alt={flyer.title}
                                            className="w-full sm:w-32 h-32 object-cover rounded-lg"
                                        />
                                    ) : (
                                        <div className="w-full sm:w-32 h-32 bg-muted rounded-lg flex items-center justify-center">
                                            <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                                        </div>
                                    )}
                                </div>

                                {/* Flyer Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <h3 className="font-semibold text-foreground mb-1">{flyer.title}</h3>
                                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                                {flyer.description}
                                            </p>
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                <span className="font-bold text-primary-bright">{formatPrice(flyer.price ?? 0)}</span>
                                                <span>📍 {flyer.location}</span>
                                                <span>👁️ {flyer.views} views</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${flyer.isDeleted
                                                    ? "bg-destructive/10 text-destructive"
                                                    : flyer.isActive
                                                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                                        : "bg-muted text-muted-foreground"
                                                    }`}
                                            >
                                                {flyer.isDeleted ? "Deleted" : flyer.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* User Info */}
                                    {flyer.user && (
                                        <div className="text-sm text-muted-foreground mb-3">
                                            Posted by: <span className="font-medium text-foreground">{flyer.user.name}</span> (
                                            {flyer.user.email})
                                        </div>
                                    )}

                                    {/* Category and Date */}
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground/60 mb-3">
                                        {flyer.category && <span>Category: {flyer.category.name}</span>}
                                        <span>Posted {new Date(flyer._creationTime).toLocaleDateString()}</span>
                                        <span>{flyer.images.length} images</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-wrap gap-2">
                                        {flyer.images.length > 0 && (
                                            <button
                                                onClick={() =>
                                                    setShowImageModal({ adId: flyer._id, images: flyer.images })
                                                }
                                                className="px-3 py-1 border border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/10 transition-colors flex items-center gap-1"
                                            >
                                                <Eye className="w-4 h-4" />
                                                Manage Images ({flyer.images.length})
                                            </button>
                                        )}

                                        {!flyer.isDeleted && (
                                            <button
                                                onClick={() => setShowDeleteConfirm(flyer._id)}
                                                className="px-3 py-1 border border-destructive/30 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/10 transition-colors flex items-center gap-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete Flyer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Delete Flyer Confirmation Modal */}
            {showDeleteConfirm && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-scroll-lock">
                    <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-bold text-foreground mb-2">Delete Flyer</h3>
                        <p className="text-muted-foreground mb-6">
                            Are you sure you want to delete this flyer? This will soft-delete it and hide it from
                            public view.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteFlyer(showDeleteConfirm)}
                                className="flex-1 px-4 py-2 bg-destructive text-white rounded-lg hover:opacity-90 transition-colors shadow-sm"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Image Management Modal */}
            {showImageModal && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-scroll-lock">
                    <div className="bg-card border border-border rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-foreground">Manage Images</h3>
                            <button
                                onClick={() => setShowImageModal(null)}
                                className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-muted-foreground mb-6">
                            Click the delete button on any image to remove it from this flyer.
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {showImageModal.images.map((imageRef, index) => (
                                <div key={imageRef} className="relative group">
                                    <ImageDisplay
                                        imageRef={imageRef}
                                        alt={`Image ${index + 1}`}
                                        className="w-full h-48 object-cover rounded-lg"
                                    />
                                    <button
                                        onClick={() => handleDeleteImage(showImageModal.adId, imageRef)}
                                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete this image"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                        Image {index + 1}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {showImageModal.images.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                All images have been deleted
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

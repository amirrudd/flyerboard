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
        <section className="space-y-6">
            {/* Header */}
            <header>
                <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">Flyer Moderation</h3>
                <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground mb-1">All Flyers</h2>
                <p className="text-[15px] text-muted-foreground">Manage and moderate all flyers on the platform</p>
            </header>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" aria-hidden="true" />
                    <label htmlFor="flyer-search" className="sr-only">Search flyers</label>
                    <input
                        id="flyer-search"
                        type="text"
                        placeholder="Search flyers by title, description, or location..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all placeholder:text-muted-foreground/70 text-foreground"
                    />
                </div>
                <label htmlFor="flyer-filter" className="sr-only">Filter flyers</label>
                <select
                    id="flyer-filter"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground"
                >
                    <option value="all">All Flyers</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                    <option value="deleted">Deleted Only</option>
                </select>
            </div>

            {/* Stats */}
            {flyersData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <article className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-4">
                        <div className="font-display text-2xl font-semibold tabular-nums text-foreground">{flyers.length}</div>
                        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mt-1">Total Flyers</div>
                    </article>
                    <article className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-4">
                        <div className="font-display text-2xl font-semibold tabular-nums text-green-600 dark:text-green-400">
                            {flyers.filter((f) => f.isActive && !f.isDeleted).length}
                        </div>
                        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mt-1">Active</div>
                    </article>
                    <article className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-4">
                        <div className="font-display text-2xl font-semibold tabular-nums text-yellow-600 dark:text-yellow-400">
                            {flyers.filter((f) => !f.isActive && !f.isDeleted).length}
                        </div>
                        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mt-1">Inactive</div>
                    </article>
                    <article className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-4">
                        <div className="font-display text-2xl font-semibold tabular-nums text-destructive">
                            {flyers.filter((f) => f.isDeleted).length}
                        </div>
                        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mt-1">Deleted</div>
                    </article>
                </div>
            )}

            {/* Flyers List */}
            <div className="space-y-3">
                {flyersData === undefined ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto" aria-label="Loading flyers"></div>
                    </div>
                ) : flyers.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">No flyers found</p>
                    </div>
                ) : (
                    flyers.map((flyer) => (
                        <article key={flyer._id} className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-4 transition-colors hover:ring-foreground/15">
                            <div className="flex flex-col sm:flex-row gap-4">
                                {/* Image Preview */}
                                <div className="flex-shrink-0">
                                    {flyer.images[0] ? (
                                        <ImageDisplay
                                            imageRef={flyer.images[0]}
                                            alt={flyer.title}
                                            className="w-full sm:w-32 h-32 object-cover rounded-2xl ring-1 ring-border/70"
                                        />
                                    ) : (
                                        <div className="w-full sm:w-32 h-32 bg-muted rounded-2xl ring-1 ring-border/70 flex items-center justify-center">
                                            <ImageIcon className="w-8 h-8 text-muted-foreground/50" aria-hidden="true" />
                                        </div>
                                    )}
                                </div>

                                {/* Flyer Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <h3 className="font-display text-lg font-semibold tracking-tight text-foreground mb-1">{flyer.title}</h3>
                                            <p className="text-[15px] text-foreground/80 line-clamp-2 mb-2 leading-relaxed">
                                                {flyer.description}
                                            </p>
                                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                                <span className="font-display font-semibold tabular-nums text-primary">{formatPrice(flyer.price ?? 0)}</span>
                                                <span>📍 {flyer.location}</span>
                                                <span className="tabular-nums">👁️ {flyer.views} views</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase ring-1 whitespace-nowrap ${flyer.isDeleted
                                                    ? "bg-destructive/10 text-destructive ring-destructive/30"
                                                    : flyer.isActive
                                                        ? "bg-green-500/10 text-green-700 dark:text-green-400 ring-green-500/30"
                                                        : "bg-muted text-muted-foreground ring-border"
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
                                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground/70 mb-3 tabular-nums">
                                        {flyer.category && <span>Category: {flyer.category.name}</span>}
                                        <span>Posted {new Date(flyer._creationTime).toLocaleDateString()}</span>
                                        <span>{flyer.images.length} images</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-wrap gap-2">
                                        {flyer.images.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowImageModal({ adId: flyer._id, images: flyer.images })
                                                }
                                                className="h-8 px-3 inline-flex items-center gap-1 bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] rounded-full text-sm font-medium transition-all"
                                            >
                                                <Eye className="w-4 h-4" aria-hidden="true" />
                                                Manage Images ({flyer.images.length})
                                            </button>
                                        )}

                                        {!flyer.isDeleted && (
                                            <button
                                                type="button"
                                                onClick={() => setShowDeleteConfirm(flyer._id)}
                                                className="h-8 px-3 inline-flex items-center gap-1 bg-transparent text-destructive ring-1 ring-destructive/40 hover:ring-destructive hover:bg-destructive/[0.06] active:scale-[0.98] rounded-full text-sm font-medium transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                                                Delete Flyer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </article>
                    ))
                )}
            </div>

            {/* Delete Flyer Confirmation Modal */}
            {showDeleteConfirm && createPortal(
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-flyer-title"
                    className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-scroll-lock"
                >
                    <div className="bg-card ring-1 ring-border/70 rounded-2xl shadow-xl p-6 max-w-md w-full">
                        <h2 id="delete-flyer-title" className="font-display text-2xl font-semibold tracking-tight text-foreground mb-2">Delete Flyer</h2>
                        <p className="text-[15px] text-foreground/80 leading-relaxed mb-6">
                            Are you sure you want to delete this flyer? This will soft-delete it and hide it from
                            public view.
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
                                onClick={() => handleDeleteFlyer(showDeleteConfirm)}
                                className="flex-1 h-11 px-4 bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98] rounded-full font-semibold shadow-sm shadow-destructive/25 transition-all"
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
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="manage-images-title"
                    className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-scroll-lock"
                >
                    <div className="bg-card ring-1 ring-border/70 rounded-2xl shadow-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 id="manage-images-title" className="font-display text-2xl font-semibold tracking-tight text-foreground">Manage Images</h2>
                            <button
                                type="button"
                                onClick={() => setShowImageModal(null)}
                                aria-label="Close"
                                className="text-muted-foreground hover:text-foreground rounded-full p-2 hover:bg-muted/60 transition-colors"
                            >
                                <X className="w-5 h-5" aria-hidden="true" />
                            </button>
                        </div>
                        <p className="text-[15px] text-foreground/80 leading-relaxed mb-6">
                            Click the delete button on any image to remove it from this flyer.
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {showImageModal.images.map((imageRef, index) => (
                                <div key={imageRef} className="relative group">
                                    <ImageDisplay
                                        imageRef={imageRef}
                                        alt={`Image ${index + 1}`}
                                        className="w-full h-48 object-cover rounded-2xl ring-1 ring-border/70"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteImage(showImageModal.adId, imageRef)}
                                        className="absolute top-2 right-2 p-2 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 active:scale-[0.98] transition-all opacity-0 group-hover:opacity-100 shadow-sm shadow-destructive/25"
                                        aria-label={`Delete image ${index + 1}`}
                                        title="Delete this image"
                                    >
                                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                                    </button>
                                    <div className="absolute bottom-2 left-2 bg-foreground/60 text-background text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full">
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
        </section>
    );
}

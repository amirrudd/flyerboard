import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
    Plus,
    PencilSimple,
    Trash,
    Warning,
    CaretDown,
    X,
    Check,
} from '@phosphor-icons/react';
import { getCategoryIcon, hasIcon, getIconCdnUrl } from "../../lib/categoryIcons";
import { iconMap } from "../../lib/adminIconMap";
import { LucideIconPicker } from "../../components/ui/LucideIconPicker";

interface Category {
    _id: Id<"categories">;
    name: string;
    slug: string;
    icon?: string;
    parentId?: Id<"categories">;
}

interface CategoryFormData {
    name: string;
    slug: string;
    icon: string;
    parentId: Id<"categories"> | null;
}

const initialFormData: CategoryFormData = {
    name: "",
    slug: "",
    icon: "LayoutGrid",
    parentId: null,
};

/**
 * Generate slug from category name
 */
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

export function CategoriesTab() {
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState<CategoryFormData>(initialFormData);
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const categories = useQuery(api.categories.getCategories);
    const createCategory = useMutation(api.categories.createCategory);
    const updateCategory = useMutation(api.categories.updateCategory);
    const deleteCategory = useMutation(api.categories.deleteCategory);

    const parentCategories = categories?.filter((c) => !c.parentId) || [];

    const handleNameChange = (name: string) => {
        setFormData((prev) => ({
            ...prev,
            name,
            slug: generateSlug(name),
        }));
    };

    const handleOpenAddForm = () => {
        setFormData(initialFormData);
        setEditingCategory(null);
        setShowAddForm(true);
    };

    const handleOpenEditForm = (category: Category) => {
        setFormData({
            name: category.name,
            slug: category.slug,
            icon: category.icon || "LayoutGrid",
            parentId: category.parentId || null,
        });
        setEditingCategory(category);
        setShowAddForm(true);
    };

    const handleCloseForm = () => {
        setShowAddForm(false);
        setEditingCategory(null);
        setFormData(initialFormData);
        setShowIconPicker(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim() || !formData.slug.trim()) {
            toast.error("Name and slug are required");
            return;
        }

        setIsSubmitting(true);

        try {
            if (editingCategory) {
                await updateCategory({
                    categoryId: editingCategory._id,
                    name: formData.name.trim(),
                    slug: formData.slug.trim(),
                    icon: formData.icon,
                    parentId: formData.parentId || undefined,
                });
                toast.success("Category updated successfully");
            } else {
                await createCategory({
                    name: formData.name.trim(),
                    slug: formData.slug.trim(),
                    icon: formData.icon,
                    parentId: formData.parentId || undefined,
                });
                toast.success("Category created successfully");
            }
            handleCloseForm();
        } catch (error: any) {
            toast.error(error.message || "Failed to save category");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingCategory) return;

        setIsSubmitting(true);
        try {
            await deleteCategory({ categoryId: deletingCategory._id });
            toast.success("Category deleted successfully");
            setDeletingCategory(null);
        } catch (error: any) {
            toast.error(error.message || "Failed to delete category");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (categories === undefined) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    return (
        <section className="space-y-6">
            {/* Header */}
            <header className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">Taxonomy</h3>
                    <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Categories</h2>
                    <p className="text-[15px] text-muted-foreground mt-1">
                        Manage flyer categories and their icons
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleOpenAddForm}
                    className="inline-flex items-center gap-2 h-11 px-4 bg-primary text-primary-foreground rounded-full font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add Category
                </button>
            </header>

            {/* Categories List */}
            <div className="bg-card ring-1 ring-border/70 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead className="bg-muted/40">
                        <tr>
                            <th scope="col" className="text-left px-4 py-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                                Icon
                            </th>
                            <th scope="col" className="text-left px-4 py-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                                Name
                            </th>
                            <th scope="col" className="text-left px-4 py-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase hidden md:table-cell">
                                Slug
                            </th>
                            <th scope="col" className="text-left px-4 py-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase hidden lg:table-cell">
                                Parent
                            </th>
                            <th scope="col" className="text-right px-4 py-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map((category) => {
                            const Icon = getCategoryIcon(category.icon);
                            const parent = category.parentId
                                ? categories.find((c) => c._id === category.parentId)
                                : null;

                            return (
                                <tr key={category._id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/40 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                                            <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-foreground">
                                            {category.name}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        <code className="text-sm text-muted-foreground bg-muted/60 px-2 py-1 rounded-full tabular-nums">
                                            {category.slug}
                                        </code>
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        {parent ? (
                                            <span className="text-sm text-muted-foreground font-medium">
                                                {parent.name}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-muted-foreground/40">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEditForm(category)}
                                                aria-label={`Edit `}
                                                className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all active:scale-[0.98]"
                                                title="Edit category"
                                            >
                                                <PencilSimple className="w-4 h-4" aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDeletingCategory(category)}
                                                aria-label={`Delete ${category.name}`}
                                                className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-all active:scale-[0.98]"
                                                title="Delete category"
                                            >
                                                <Trash className="w-4 h-4" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {categories.length === 0 && (
                    <div className="px-4 py-12 text-center text-muted-foreground">
                        No categories found. Add your first category to get started.
                    </div>
                )}
            </div>

            {/* Add/Edit Form Modal */}
            {showAddForm &&
                createPortal(
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="category-form-title"
                        className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    >
                        <div className="bg-card ring-1 ring-border/70 rounded-2xl shadow-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 id="category-form-title" className="font-display text-2xl font-semibold tracking-tight text-foreground">
                                    {editingCategory ? "Edit Category" : "Add Category"}
                                </h2>
                                <button
                                    type="button"
                                    onClick={handleCloseForm}
                                    aria-label="Close"
                                    className="text-muted-foreground hover:text-foreground rounded-full p-2 hover:bg-muted/60 transition-colors"
                                >
                                    <X className="w-5 h-5" aria-hidden="true" />
                                </button>
                            </div>

                            <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
                                {/* Name */}
                                <div>
                                    <label htmlFor="category-name" className="block text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">
                                        Name *
                                    </label>
                                    <input
                                        id="category-name"
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => handleNameChange(e.target.value)}
                                        className="w-full h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground placeholder:text-muted-foreground/70"
                                        placeholder="e.g., Electronics"
                                        maxLength={50}
                                        required
                                    />
                                </div>

                                {/* Slug */}
                                <div>
                                    <label htmlFor="category-slug" className="block text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">
                                        Slug *
                                    </label>
                                    <input
                                        id="category-slug"
                                        type="text"
                                        value={formData.slug}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                                            }))
                                        }
                                        className="w-full h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground placeholder:text-muted-foreground/70 font-mono text-sm tabular-nums"
                                        placeholder="e.g., electronics"
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground mt-2">
                                        URL-friendly identifier (auto-generated from name)
                                    </p>
                                </div>

                                {/* Icon Picker */}
                                <div>
                                    <label className="block text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">
                                        Icon *
                                    </label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowIconPicker(!showIconPicker)}
                                            aria-label="Select icon"
                                            aria-expanded={showIconPicker}
                                            className="w-full h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground flex items-center justify-between"
                                        >
                                            <span className="flex items-center gap-2">
                                                {hasIcon(formData.icon) ? (
                                                    (() => {
                                                        const IconComponent = iconMap[formData.icon];
                                                        return (
                                                            <>
                                                                <IconComponent className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                                                                <span>{formData.icon}</span>
                                                            </>
                                                        );
                                                    })()
                                                ) : (
                                                    <>
                                                        <img
                                                            src={getIconCdnUrl(formData.icon)}
                                                            alt=""
                                                            className="w-5 h-5"
                                                        />
                                                        <span>{formData.icon}</span>
                                                    </>
                                                )}
                                            </span>
                                            <CaretDown
                                                aria-hidden="true"
                                                className={`w-5 h-5 text-muted-foreground transition-transform ${showIconPicker ? "rotate-180" : ""}`}
                                            />
                                        </button>

                                        {showIconPicker && (
                                            <LucideIconPicker
                                                value={formData.icon}
                                                onChange={(iconName) => setFormData((prev) => ({ ...prev, icon: iconName }))}
                                                onClose={() => setShowIconPicker(false)}
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Parent Category */}
                                <div>
                                    <label htmlFor="category-parent" className="block text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">
                                        Parent Category (optional)
                                    </label>
                                    <select
                                        id="category-parent"
                                        value={formData.parentId || ""}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                parentId: e.target.value
                                                    ? (e.target.value as Id<"categories">)
                                                    : null,
                                            }))
                                        }
                                        className="w-full h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground"
                                    >
                                        <option value="">No parent (top-level)</option>
                                        {parentCategories
                                            .filter((c) => c._id !== editingCategory?._id)
                                            .map((category) => (
                                                <option key={category._id} value={category._id}>
                                                    {category.name}
                                                </option>
                                            ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Make this a subcategory of another category
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={handleCloseForm}
                                        className="flex-1 h-11 px-4 bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] rounded-full font-medium transition-all disabled:opacity-50"
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 h-11 px-4 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] rounded-full font-semibold shadow-sm shadow-primary/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" aria-hidden="true"></div>
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4" aria-hidden="true" />
                                                {editingCategory ? "Update" : "Create"}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>,
                    document.body
                )}

            {/* Delete Confirmation Modal */}
            {deletingCategory &&
                createPortal(
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-category-title"
                        className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    >
                        <div className="bg-card ring-1 ring-border/70 rounded-2xl shadow-xl p-6 max-w-md w-full">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center ring-1 ring-destructive/20">
                                    <Warning className="w-6 h-6 text-destructive" aria-hidden="true" />
                                </div>
                                <div className="flex-1">
                                    <h2 id="delete-category-title" className="font-display text-2xl font-semibold tracking-tight text-foreground mb-2">
                                        Delete Category
                                    </h2>
                                    <p className="text-[15px] text-foreground/80 leading-relaxed">
                                        Are you sure you want to delete "{deletingCategory.name}"?
                                        This action cannot be undone.
                                    </p>
                                    <p className="text-amber-600 text-xs mt-2">
                                        Note: Categories with flyers cannot be deleted.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setDeletingCategory(null)}
                                    className="flex-1 h-11 px-4 bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] rounded-full font-medium transition-all disabled:opacity-50"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { void handleDelete(); }}
                                    className="flex-1 h-11 px-4 bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98] rounded-full font-semibold shadow-sm shadow-destructive/25 transition-all disabled:opacity-50"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </section>
    );
}

import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
    Plus,
    Pencil,
    Trash2,
    AlertTriangle,
    ChevronDown,
    X,
    Check,
    LayoutGrid,
} from "lucide-react";
import { getCategoryIcon, iconMap, hasIcon, getIconCdnUrl } from "../../lib/categoryIcons";
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-foreground">Categories</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage flyer categories and their icons
                    </p>
                </div>
                <button
                    onClick={handleOpenAddForm}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    Add Category
                </button>
            </div>

            {/* Categories List */}
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead className="bg-muted/50 border-b border-border">
                        <tr>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Icon
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Name
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                                Slug
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                                Parent
                            </th>
                            <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {categories.map((category) => {
                            const Icon = getCategoryIcon(category.icon);
                            const parent = category.parentId
                                ? categories.find((c) => c._id === category.parentId)
                                : null;

                            return (
                                <tr key={category._id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                                            <Icon className="w-5 h-5 text-primary" />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-foreground">
                                            {category.name}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        <code className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
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
                                                onClick={() => handleOpenEditForm(category)}
                                                className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors border border-transparent hover:border-primary/20"
                                                title="Edit category"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setDeletingCategory(category)}
                                                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors border border-transparent hover:border-destructive/20"
                                                title="Delete category"
                                            >
                                                <Trash2 className="w-4 h-4" />
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
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-card border border-border rounded-lg p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-foreground">
                                    {editingCategory ? "Edit Category" : "Add Category"}
                                </h3>
                                <button
                                    onClick={handleCloseForm}
                                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => handleNameChange(e.target.value)}
                                        className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                        placeholder="e.g., Electronics"
                                        maxLength={50}
                                        required
                                    />
                                </div>

                                {/* Slug */}
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                                        Slug *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.slug}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                                            }))
                                        }
                                        className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono text-sm"
                                        placeholder="e.g., electronics"
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        URL-friendly identifier (auto-generated from name)
                                    </p>
                                </div>

                                {/* Icon Picker */}
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                                        Icon *
                                    </label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowIconPicker(!showIconPicker)}
                                            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none flex items-center justify-between"
                                        >
                                            <span className="flex items-center gap-2">
                                                {hasIcon(formData.icon) ? (
                                                    (() => {
                                                        const IconComponent = iconMap[formData.icon];
                                                        return (
                                                            <>
                                                                <IconComponent className="w-5 h-5 text-muted-foreground" />
                                                                <span>{formData.icon}</span>
                                                            </>
                                                        );
                                                    })()
                                                ) : (
                                                    <>
                                                        <img
                                                            src={getIconCdnUrl(formData.icon)}
                                                            alt={formData.icon}
                                                            className="w-5 h-5"
                                                        />
                                                        <span>{formData.icon}</span>
                                                    </>
                                                )}
                                            </span>
                                            <ChevronDown
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
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                                        Parent Category (optional)
                                    </label>
                                    <select
                                        value={formData.parentId || ""}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                parentId: e.target.value
                                                    ? (e.target.value as Id<"categories">)
                                                    : null,
                                            }))
                                        }
                                        className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
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
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Make this a subcategory of another category
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={handleCloseForm}
                                        className="flex-1 px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-muted font-medium transition-colors"
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent"></div>
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4" />
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
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full shadow-2xl">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-destructive" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-foreground mb-2">
                                        Delete Category
                                    </h3>
                                    <p className="text-muted-foreground text-sm">
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
                                    onClick={() => setDeletingCategory(null)}
                                    className="flex-1 px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-muted font-medium transition-colors"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 font-medium transition-opacity disabled:opacity-50"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}

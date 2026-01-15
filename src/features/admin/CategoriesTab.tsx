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
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Categories</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage flyer categories and their icons
                    </p>
                </div>
                <button
                    onClick={handleOpenAddForm}
                    className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                    <Plus className="w-5 h-5" />
                    Add Category
                </button>
            </div>

            {/* Categories List */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Icon
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Name
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                                Slug
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                                Parent
                            </th>
                            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {categories.map((category) => {
                            const Icon = getCategoryIcon(category.icon);
                            const parent = category.parentId
                                ? categories.find((c) => c._id === category.parentId)
                                : null;

                            return (
                                <tr key={category._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                                            <Icon className="w-5 h-5 text-primary-600" />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-gray-900">
                                            {category.name}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        <code className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                            {category.slug}
                                        </code>
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        {parent ? (
                                            <span className="text-sm text-gray-600">
                                                {parent.name}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenEditForm(category)}
                                                className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                title="Edit category"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setDeletingCategory(category)}
                                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                    <div className="px-4 py-12 text-center text-gray-500">
                        No categories found. Add your first category to get started.
                    </div>
                )}
            </div>

            {/* Add/Edit Form Modal */}
            {showAddForm &&
                createPortal(
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {editingCategory ? "Edit Category" : "Add Category"}
                                </h3>
                                <button
                                    onClick={handleCloseForm}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => handleNameChange(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-primary-600 focus:ring-1 focus:ring-primary-600 outline-none"
                                        placeholder="e.g., Electronics"
                                        maxLength={50}
                                        required
                                    />
                                </div>

                                {/* Slug */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-primary-600 focus:ring-1 focus:ring-primary-600 outline-none font-mono text-sm"
                                        placeholder="e.g., electronics"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        URL-friendly identifier (auto-generated from name)
                                    </p>
                                </div>

                                {/* Icon Picker */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Icon *
                                    </label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowIconPicker(!showIconPicker)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-primary-600 focus:ring-1 focus:ring-primary-600 outline-none flex items-center justify-between bg-white"
                                        >
                                            <span className="flex items-center gap-2">
                                                {hasIcon(formData.icon) ? (
                                                    (() => {
                                                        const IconComponent = iconMap[formData.icon];
                                                        return (
                                                            <>
                                                                <IconComponent className="w-5 h-5 text-gray-600" />
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
                                                className={`w-5 h-5 text-gray-400 transition-transform ${showIconPicker ? "rotate-180" : ""}`}
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-primary-600 focus:ring-1 focus:ring-primary-600 outline-none"
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
                                    <p className="text-xs text-gray-500 mt-1">
                                        Make this a subcategory of another category
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={handleCloseForm}
                                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
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
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        Delete Category
                                    </h3>
                                    <p className="text-gray-600 text-sm">
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
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
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

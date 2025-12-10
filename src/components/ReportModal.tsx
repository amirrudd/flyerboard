import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportType: "ad" | "profile" | "chat";
    reportedEntityId: string;
    reportedEntityName?: string; // Optional display name for better UX
}

const REPORT_REASONS = [
    { value: "spam", label: "Spam or misleading" },
    { value: "inappropriate", label: "Inappropriate content" },
    { value: "scam", label: "Scam or fraud" },
    { value: "offensive", label: "Offensive behavior" },
    { value: "other", label: "Other" },
];

export function ReportModal({
    isOpen,
    onClose,
    reportType,
    reportedEntityId,
    reportedEntityName,
}: ReportModalProps) {
    const [reason, setReason] = useState("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submitReport = useMutation(api.reports.submitReport);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!reason) {
            toast.error("Please select a reason for reporting");
            return;
        }

        setIsSubmitting(true);

        try {
            await submitReport({
                reportType,
                reportedEntityId,
                reason,
                description: description.trim() || undefined,
            });

            toast.success("Report submitted successfully. Thank you for helping keep our community safe.");

            // Reset form
            setReason("");
            setDescription("");

            // Close modal
            onClose();
        } catch (error: any) {
            console.error("Error submitting report:", error);
            toast.error(error.message || "Failed to submit report. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setReason("");
            setDescription("");
            onClose();
        }
    };

    if (!isOpen) return null;

    const getReportTypeLabel = () => {
        switch (reportType) {
            case "ad":
                return "flyer";
            case "profile":
                return "user";
            case "chat":
                return "conversation";
            default:
                return "item";
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in modal-scroll-lock"
            onClick={handleClose}
        >
            <div
                className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all border border-white/20 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-neutral-900">Report {getReportTypeLabel()}</h2>
                        {reportedEntityName && (
                            <p className="text-neutral-500 text-sm mt-1">{reportedEntityName}</p>
                        )}
                        <p className="text-neutral-600 text-sm mt-2">
                            Help us understand what's wrong with this {getReportTypeLabel()}.
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors disabled:opacity-50"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Reason Selection */}
                    <div>
                        <label htmlFor="reason" className="block text-sm font-medium text-neutral-700 mb-2">
                            Why are you reporting this?
                        </label>
                        <select
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full px-4 py-3 pr-10 rounded-xl bg-white border border-neutral-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all duration-200 shadow-sm hover:border-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">Select a reason...</option>
                            {REPORT_REASONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Optional Description */}
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-neutral-700 mb-2">
                            Additional details (optional)
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isSubmitting}
                            rows={4}
                            maxLength={500}
                            placeholder="Provide any additional context that might help us review this report..."
                            className="w-full px-4 py-3 rounded-xl bg-white border border-neutral-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all duration-200 shadow-sm hover:border-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                        />
                        <p className="text-xs text-neutral-500 mt-1">{description.length}/500 characters</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-3 rounded-xl bg-neutral-100 text-neutral-700 font-semibold hover:bg-neutral-200 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !reason}
                            className="flex-1 px-4 py-3 rounded-xl bg-primary-500 text-white font-semibold hover:bg-primary-600 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                        />
                                    </svg>
                                    Submitting...
                                </span>
                            ) : (
                                "Submit Report"
                            )}
                        </button>
                    </div>
                </form>

                {/* Privacy Notice */}
                <p className="text-xs text-neutral-500 mt-4 text-center">
                    Reports are reviewed by our team. False reports may result in action against your account.
                </p>
            </div>
        </div>,
        document.body
    );
}

import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";

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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in modal-scroll-lock"
            onClick={handleClose}
        >
            <div
                className="bg-card rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all border border-border max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">Report {getReportTypeLabel()}</h2>
                        {reportedEntityName && (
                            <p className="text-muted-foreground text-sm mt-1">{reportedEntityName}</p>
                        )}
                        <p className="text-muted-foreground text-sm mt-2">
                            Help us understand what's wrong with this {getReportTypeLabel()}.
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Reason Selection */}
                    <div>
                        <label htmlFor="reason" className="block text-sm font-medium text-muted-foreground mb-2">
                            Why are you reporting this?
                        </label>
                        <select
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full px-4 py-3 pr-10 rounded-xl bg-background border border-input focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200 shadow-sm hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
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
                        <label htmlFor="description" className="block text-sm font-medium text-muted-foreground mb-2">
                            Additional details (optional)
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isSubmitting}
                            rows={4}
                            maxLength={500}
                            autoComplete="off"
                            placeholder="Provide any additional context that might help us review this report..."
                            className="w-full px-4 py-3 rounded-xl bg-background border border-input focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200 shadow-sm hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed resize-none text-foreground placeholder:text-muted-foreground"
                        />
                        <p className="text-xs text-muted-foreground mt-1">{description.length}/500 characters</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-3 rounded-xl bg-accent text-foreground font-semibold hover:bg-muted active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !reason}
                            className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Submitting...
                                </span>
                            ) : (
                                "Submit Report"
                            )}
                        </button>
                    </div>
                </form>

                {/* Privacy Notice */}
                <p className="text-xs text-muted-foreground mt-4 text-center">
                    Reports are reviewed by our team. False reports may result in action against your account.
                </p>
            </div>
        </div>,
        document.body
    );
}

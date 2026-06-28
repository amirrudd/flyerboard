import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { X, CircleNotch } from '@phosphor-icons/react';

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
            className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in modal-scroll-lock"
            onClick={handleClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
        >
            <section
                className="bg-card ring-1 ring-border/70 rounded-2xl p-7 sm:p-8 w-full max-w-md shadow-card-hover transform transition-all max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <header className="flex justify-between items-start gap-4 mb-6">
                    <div>
                        <p className="kicker text-muted-foreground mb-1">Report</p>
                        <h2
                            id="report-modal-title"
                            className="font-display text-2xl font-semibold tracking-tight text-foreground"
                        >
                            Report {getReportTypeLabel()}
                        </h2>
                        {reportedEntityName && (
                            <p className="text-muted-foreground text-sm mt-1">{reportedEntityName}</p>
                        )}
                        <p className="text-[15px] leading-relaxed text-foreground/80 mt-2 max-w-prose">
                            Help us understand what's wrong with this {getReportTypeLabel()}.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        aria-label="Close report dialog"
                        className="text-muted-foreground hover:text-foreground rounded-full p-2 hover:bg-muted/60 transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>

                {/* Form */}
                <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-5">
                    {/* Reason Selection */}
                    <div>
                        <label htmlFor="reason" className="kicker block mb-2">
                            Why are you reporting this?
                        </label>
                        <select
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full h-11 px-4 pr-10 rounded-full bg-muted/50 ring-1 ring-transparent focus:ring-ring focus:bg-card outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
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
                        <label htmlFor="description" className="kicker block mb-2">
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
                            className="w-full px-4 py-3 rounded-2xl bg-muted/50 ring-1 ring-transparent focus:ring-ring focus:bg-card outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none text-foreground placeholder:text-muted-foreground/70 text-[15px] leading-relaxed"
                        />
                        <p className="text-xs text-muted-foreground mt-1 tabular">{description.length}/500 characters</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1 h-11 px-4 rounded-full bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !reason}
                            className="flex-1 h-11 px-4 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <CircleNotch className="w-4 h-4 animate-spin" />
                                    Submitting...
                                </span>
                            ) : (
                                "Submit Report"
                            )}
                        </button>
                    </div>
                </form>

                {/* Privacy Notice */}
                <p className="text-xs text-muted-foreground mt-4 text-center max-w-prose mx-auto">
                    Reports are reviewed by our team. False reports may result in action against your account.
                </p>
            </section>
        </div>,
        document.body
    );
}

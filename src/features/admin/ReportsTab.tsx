import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../../convex/_generated/dataModel";
import { AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";

export function ReportsTab() {
    const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "reviewed" | "resolved">(
        "pending"
    );

    const reports = useQuery(
        api.admin.getAllReports,
        filterStatus === "all" ? {} : { status: filterStatus }
    );

    const updateReportStatus = useMutation(api.admin.updateReportStatus);

    const handleUpdateStatus = async (reportId: Id<"reports">, status: string) => {
        try {
            await updateReportStatus({ reportId, status });
            toast.success(`Report marked as ${status}`);
        } catch (error: any) {
            toast.error(error.message || "Failed to update report status");
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "pending":
                return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 ring-yellow-500/30";
            case "reviewed":
                return "bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-blue-500/30";
            case "resolved":
                return "bg-green-500/10 text-green-700 dark:text-green-400 ring-green-500/30";
            default:
                return "bg-muted text-muted-foreground ring-border";
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "ad":
                return "📄";
            case "profile":
                return "👤";
            case "chat":
                return "💬";
            default:
                return "⚠️";
        }
    };

    return (
        <section className="space-y-6">
            {/* Header */}
            <header>
                <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">Moderation</h3>
                <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground mb-1">Reports Management</h2>
                <p className="text-[15px] text-muted-foreground">Review and manage user-submitted reports</p>
            </header>

            {/* Filters */}
            <nav aria-label="Filter reports by status" className="flex gap-2 overflow-x-auto scrollbar-hide">
                {["all", "pending", "reviewed", "resolved"].map((status) => {
                    const isActive = filterStatus === status;
                    return (
                        <button
                            key={status}
                            type="button"
                            onClick={() => setFilterStatus(status as any)}
                            aria-pressed={isActive}
                            className={`h-9 px-4 rounded-full text-sm font-medium transition-all whitespace-nowrap active:scale-[0.98] ${isActive
                                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                                : "bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15"
                                }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    );
                })}
            </nav>

            {/* Stats */}
            {reports && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <article className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-4">
                        <div className="font-display text-2xl font-semibold tabular-nums text-yellow-600 dark:text-yellow-400">
                            {reports.filter((r) => r.status === "pending").length}
                        </div>
                        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mt-1">Pending</div>
                    </article>
                    <article className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-4">
                        <div className="font-display text-2xl font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                            {reports.filter((r) => r.status === "reviewed").length}
                        </div>
                        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mt-1">Reviewed</div>
                    </article>
                    <article className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-4">
                        <div className="font-display text-2xl font-semibold tabular-nums text-green-600 dark:text-green-400">
                            {reports.filter((r) => r.status === "resolved").length}
                        </div>
                        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mt-1">Resolved</div>
                    </article>
                    <article className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-4">
                        <div className="font-display text-2xl font-semibold tabular-nums text-foreground">{reports.length}</div>
                        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mt-1">Total Reports</div>
                    </article>
                </div>
            )}

            {/* Reports List */}
            <div className="space-y-3">
                {reports === undefined ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto" aria-label="Loading reports"></div>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-12">
                        <AlertTriangle className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" aria-hidden="true" />
                        <p className="text-muted-foreground">No reports found</p>
                    </div>
                ) : (
                    reports.map((report) => (
                        <article key={report._id} className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-4 transition-colors hover:ring-foreground/15">
                            <div className="flex items-start gap-4">
                                {/* Icon */}
                                <div className="text-3xl shrink-0" aria-hidden="true">{getTypeIcon(report.reportType)}</div>

                                {/* Report Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
                                                    {report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)}{" "}
                                                    Report
                                                </h3>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase ring-1 ${getStatusColor(report.status)}`}>
                                                    {report.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-foreground/80 mb-1">
                                                <span className="font-medium text-foreground">Reason:</span> {report.reason}
                                            </p>
                                            {report.description && (
                                                <p className="text-sm text-foreground/80 mb-2 leading-relaxed">
                                                    <span className="font-medium text-foreground">Details:</span> {report.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Reporter Info */}
                                    {report.reporter && (
                                        <div className="text-sm text-muted-foreground mb-2">
                                            Reported by:{" "}
                                            <span className="font-medium text-foreground">
                                                {report.reporter.name} ({report.reporter.email})
                                            </span>
                                        </div>
                                    )}

                                    {/* Reported Entity Info */}
                                    {report.reportedEntity && (
                                        <div className="text-sm text-muted-foreground mb-3 p-3 bg-muted/40 rounded-2xl ring-1 ring-border/60">
                                            <span className="font-medium text-foreground">Reported {report.reportType}:</span>{" "}
                                            {report.reportType === "ad" && (report.reportedEntity as any).title}
                                            {report.reportType === "profile" && (report.reportedEntity as any).name}
                                            {report.reportType === "chat" && `Chat ID: ${report.reportedEntityId}`}
                                        </div>
                                    )}

                                    {/* Timestamp */}
                                    <div className="text-xs text-muted-foreground/70 mb-3 tabular-nums">
                                        Reported {new Date(report.createdAt).toLocaleString()}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-wrap gap-2">
                                        {report.status !== "reviewed" && (
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateStatus(report._id, "reviewed")}
                                                className="h-8 px-3 inline-flex items-center gap-1 bg-transparent text-blue-700 dark:text-blue-400 ring-1 ring-blue-500/40 hover:ring-blue-500 hover:bg-blue-500/[0.06] active:scale-[0.98] rounded-full text-sm font-medium transition-all"
                                            >
                                                <CheckCircle className="w-4 h-4" aria-hidden="true" />
                                                Mark as Reviewed
                                            </button>
                                        )}
                                        {report.status !== "resolved" && (
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateStatus(report._id, "resolved")}
                                                className="h-8 px-3 inline-flex items-center gap-1 bg-transparent text-green-700 dark:text-green-400 ring-1 ring-green-500/40 hover:ring-green-500 hover:bg-green-500/[0.06] active:scale-[0.98] rounded-full text-sm font-medium transition-all"
                                            >
                                                <CheckCircle className="w-4 h-4" aria-hidden="true" />
                                                Mark as Resolved
                                            </button>
                                        )}
                                        {report.status !== "pending" && (
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateStatus(report._id, "pending")}
                                                className="h-8 px-3 inline-flex items-center gap-1 bg-transparent text-yellow-700 dark:text-yellow-400 ring-1 ring-yellow-500/40 hover:ring-yellow-500 hover:bg-yellow-500/[0.06] active:scale-[0.98] rounded-full text-sm font-medium transition-all"
                                            >
                                                <Clock className="w-4 h-4" aria-hidden="true" />
                                                Mark as Pending
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </article>
                    ))
                )}
            </div>
        </section>
    );
}

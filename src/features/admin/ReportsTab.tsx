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
                return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20";
            case "reviewed":
                return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
            case "resolved":
                return "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20";
            default:
                return "bg-muted text-muted-foreground border border-border";
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
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Reports Management</h2>
                <p className="text-muted-foreground">Review and manage user-submitted reports</p>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto">
                {["all", "pending", "reviewed", "resolved"].map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status as any)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${filterStatus === status
                            ? "bg-primary text-white"
                            : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            }`}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                ))}
            </div>

            {/* Stats */}
            {reports && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                            {reports.filter((r) => r.status === "pending").length}
                        </div>
                        <div className="text-sm text-muted-foreground">Pending</div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {reports.filter((r) => r.status === "reviewed").length}
                        </div>
                        <div className="text-sm text-muted-foreground">Reviewed</div>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {reports.filter((r) => r.status === "resolved").length}
                        </div>
                        <div className="text-sm text-muted-foreground">Resolved</div>
                    </div>
                    <div className="bg-muted border border-border rounded-lg p-4">
                        <div className="text-2xl font-bold text-foreground">{reports.length}</div>
                        <div className="text-sm text-muted-foreground">Total Reports</div>
                    </div>
                </div>
            )}

            {/* Reports List */}
            <div className="space-y-4">
                {reports === undefined ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-12">
                        <AlertTriangle className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground">No reports found</p>
                    </div>
                ) : (
                    reports.map((report) => (
                        <div key={report._id} className="border border-border rounded-lg p-4 bg-card/50">
                            <div className="flex items-start gap-4">
                                {/* Icon */}
                                <div className="text-3xl shrink-0">{getTypeIcon(report.reportType)}</div>

                                {/* Report Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-foreground">
                                                    {report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)}{" "}
                                                    Report
                                                </h3>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                                                    {report.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-1">
                                                <span className="font-medium text-foreground">Reason:</span> {report.reason}
                                            </p>
                                            {report.description && (
                                                <p className="text-sm text-muted-foreground mb-2">
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
                                        <div className="text-sm text-muted-foreground mb-3 p-3 bg-muted/50 rounded-lg border border-border/50">
                                            <span className="font-medium text-foreground">Reported {report.reportType}:</span>{" "}
                                            {report.reportType === "ad" && (report.reportedEntity as any).title}
                                            {report.reportType === "profile" && (report.reportedEntity as any).name}
                                            {report.reportType === "chat" && `Chat ID: ${report.reportedEntityId}`}
                                        </div>
                                    )}

                                    {/* Timestamp */}
                                    <div className="text-xs text-muted-foreground/60 mb-3">
                                        Reported {new Date(report.createdAt).toLocaleString()}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-wrap gap-2">
                                        {report.status !== "reviewed" && (
                                            <button
                                                onClick={() => handleUpdateStatus(report._id, "reviewed")}
                                                className="px-3 py-1 border border-blue-300 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors flex items-center gap-1"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                Mark as Reviewed
                                            </button>
                                        )}
                                        {report.status !== "resolved" && (
                                            <button
                                                onClick={() => handleUpdateStatus(report._id, "resolved")}
                                                className="px-3 py-1 border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors flex items-center gap-1"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                Mark as Resolved
                                            </button>
                                        )}
                                        {report.status !== "pending" && (
                                            <button
                                                onClick={() => handleUpdateStatus(report._id, "pending")}
                                                className="px-3 py-1 border border-yellow-300 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-50 transition-colors flex items-center gap-1"
                                            >
                                                <Clock className="w-4 h-4" />
                                                Mark as Pending
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

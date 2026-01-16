import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { Header } from "../layout/Header";
import {
    ChevronLeft,
    Users,
    FileText,
    AlertTriangle,
    MessageSquare,
    Shield,
    LayoutGrid,
    Flag,
} from "lucide-react";
import { UsersTab } from "./UsersTab";
import { FlyersTab } from "./FlyersTab";
import { ReportsTab } from "./ReportsTab";
import { ChatsTab } from "./ChatsTab";
import { CategoriesTab } from "./CategoriesTab";
import { FeatureFlagsTab } from "./FeatureFlagsTab";

interface AdminDashboardProps {
    onBack: () => void;
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
    const [activeTab, setActiveTab] = useState<"users" | "flyers" | "reports" | "chats" | "categories" | "flags">("users");

    const isAdmin = useQuery(api.admin.isCurrentUserAdmin);

    // Show loading state while checking admin status
    if (isAdmin === undefined) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    // Show access denied if not admin
    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Shield className="w-16 h-16 text-destructive mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
                    <p className="text-muted-foreground mb-4">You don't have permission to access this page.</p>
                    <button
                        onClick={onBack}
                        className="bg-primary text-white px-6 py-2 rounded-lg hover:opacity-90 transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Header
                leftNode={
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="hidden md:inline">Back</span>
                    </button>
                }
                centerNode={
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary" />
                        <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
                    </div>
                }
                rightNode={
                    <div className="flex items-center gap-2">
                        <span className="hidden md:inline text-sm text-muted-foreground">Admin Mode</span>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                }
            />

            <div className="content-max-width mx-auto container-padding py-6">
                {/* Tabs Navigation */}
                <div className="bg-card border border-border rounded-lg shadow-sm mb-6 p-2">
                    <div className="flex gap-2 overflow-x-auto">
                        {[
                            { id: "users", label: "Users", icon: Users },
                            { id: "flyers", label: "Flyers", icon: FileText },
                            { id: "reports", label: "Reports", icon: AlertTriangle },
                            { id: "chats", label: "Chats", icon: MessageSquare },
                            { id: "categories", label: "Categories", icon: LayoutGrid },
                            { id: "flags", label: "Feature Flags", icon: Flag },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                                    ? "bg-primary text-white"
                                    : "text-muted-foreground hover:bg-muted"
                                    }`}
                            >
                                <tab.icon className="w-5 h-5" />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="bg-card border border-border rounded-lg shadow-sm p-6 text-foreground">
                    {activeTab === "users" && <UsersTab />}
                    {activeTab === "flyers" && <FlyersTab />}
                    {activeTab === "reports" && <ReportsTab />}
                    {activeTab === "chats" && <ChatsTab />}
                    {activeTab === "categories" && <CategoriesTab />}
                    {activeTab === "flags" && <FeatureFlagsTab />}
                </div>
            </div>
        </div>
    );
}

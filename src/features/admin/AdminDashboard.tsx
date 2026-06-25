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
            <main className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Shield className="w-16 h-16 text-destructive mx-auto mb-4" aria-hidden="true" />
                    <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] text-foreground mb-2">Access Denied</h2>
                    <p className="text-muted-foreground mb-6 text-[15px]">You don't have permission to access this page.</p>
                    <button
                        type="button"
                        onClick={onBack}
                        className="bg-primary text-primary-foreground h-11 px-6 rounded-full font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        Go Back
                    </button>
                </div>
            </main>
        );
    }

    const tabs = [
        { id: "users", label: "Users", icon: Users },
        { id: "flyers", label: "Flyers", icon: FileText },
        { id: "reports", label: "Reports", icon: AlertTriangle },
        { id: "chats", label: "Chats", icon: MessageSquare },
        { id: "categories", label: "Categories", icon: LayoutGrid },
        { id: "flags", label: "Feature Flags", icon: Flag },
    ] as const;

    return (
        <div className="min-h-screen bg-background">
            <Header
                leftNode={
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back"
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                        <span className="hidden md:inline">Back</span>
                    </button>
                }
                centerNode={
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary" aria-hidden="true" />
                        <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Admin Dashboard</h1>
                    </div>
                }
                rightNode={
                    <div className="flex items-center gap-2">
                        <span className="hidden md:inline text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Admin Mode</span>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" aria-hidden="true"></div>
                    </div>
                }
            />

            <main className="content-max-width mx-auto container-padding py-6">
                {/* Tabs Navigation */}
                <nav
                    aria-label="Admin sections"
                    className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm mb-6 px-2 pt-2"
                >
                    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id as any)}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`relative flex items-center gap-2 px-4 pt-2.5 pb-3 font-medium whitespace-nowrap transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-xl ${
                                        isActive
                                            ? "text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <tab.icon className="w-4 h-4" aria-hidden="true" />
                                    <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">{tab.label}</span>
                                    {isActive && (
                                        <span
                                            aria-hidden="true"
                                            className="absolute left-2 right-2 -bottom-px h-[1.5px] bg-primary rounded-full"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </nav>

                {/* Tab Content */}
                <section className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm p-6 text-foreground">
                    {activeTab === "users" && <UsersTab />}
                    {activeTab === "flyers" && <FlyersTab />}
                    {activeTab === "reports" && <ReportsTab />}
                    {activeTab === "chats" && <ChatsTab />}
                    {activeTab === "categories" && <CategoriesTab />}
                    {activeTab === "flags" && <FeatureFlagsTab />}
                </section>
            </main>
        </div>
    );
}

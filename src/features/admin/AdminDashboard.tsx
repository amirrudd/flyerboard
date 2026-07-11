import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useHeaderSlots } from "../layout/HeaderSlots";
import {
    CaretLeft,
    Users,
    FileText,
    Warning,
    ChatText,
    Shield,
    GridFour,
    Flag,
    Sliders,
} from '@phosphor-icons/react';
import { UsersTab } from "./UsersTab";
import { FlyersTab } from "./FlyersTab";
import { ReportsTab } from "./ReportsTab";
import { ChatsTab } from "./ChatsTab";
import { CategoriesTab } from "./CategoriesTab";
import { FeatureFlagsTab } from "./FeatureFlagsTab";
import { SettingsTab } from "./SettingsTab";

interface AdminDashboardProps {
    onBack: () => void;
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
    const [activeTab, setActiveTab] = useState<"users" | "flyers" | "reports" | "chats" | "categories" | "flags" | "settings">("users");

    const isAdmin = useQuery(api.admin.isCurrentUserAdmin);

    // Persistent Layout header — the loading / access-denied states never had
    // a header, so hide it there; registered before the early returns (hooks
    // rules) and rebuilt every render by design.
    useHeaderSlots(
        !isAdmin
            ? { hidden: true }
            : {
                leftNode: (
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back"
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <CaretLeft className="w-5 h-5" aria-hidden="true" />
                        <span className="hidden md:inline">Back</span>
                    </button>
                ),
                centerNode: (
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary" aria-hidden="true" />
                        <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Admin Dashboard</h1>
                    </div>
                ),
                rightNode: (
                    <div className="flex items-center gap-2">
                        <span className="hidden md:inline text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Admin Mode</span>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" aria-hidden="true"></div>
                    </div>
                ),
            }
    );

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
            <section className="min-h-screen bg-background flex items-center justify-center py-12 pb-bottom-nav md:pb-12">
                <article className="content-width-reading mx-auto text-center container-padding">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/[0.08] ring-1 ring-destructive/30 mb-8">
                        <Shield className="w-9 h-9 text-destructive" weight="light" aria-hidden="true" />
                    </div>
                    <p className="kicker text-destructive mb-3">Restricted</p>
                    <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-[-0.02em] leading-[1.05] text-foreground mb-4">
                        Access Denied
                    </h1>
                    <p className="text-[15px] leading-relaxed text-foreground/80 max-w-prose mx-auto mb-10">
                        You don't have permission to access this page. If you believe this is
                        a mistake, get in touch with the FlyerBoard team.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
                        <button
                            type="button"
                            onClick={onBack}
                            className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            Go Back
                        </button>
                        <a
                            href="/support"
                            className="inline-flex items-center justify-center h-11 px-5 rounded-full bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            Contact support
                        </a>
                    </div>
                </article>
            </section>
        );
    }

    const tabs = [
        { id: "users", label: "Users", icon: Users },
        { id: "flyers", label: "Flyers", icon: FileText },
        { id: "reports", label: "Reports", icon: Warning },
        { id: "chats", label: "Chats", icon: ChatText },
        { id: "categories", label: "Categories", icon: GridFour },
        { id: "flags", label: "Feature Flags", icon: Flag },
        { id: "settings", label: "Settings", icon: Sliders },
    ] as const;

    return (
        <div className="min-h-screen bg-background">
            {/* Header slots registered on the persistent Layout header above */}
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
                                    onClick={() => setActiveTab(tab.id)}
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
                    {activeTab === "settings" && <SettingsTab />}
                </section>
            </main>
        </div>
    );
}

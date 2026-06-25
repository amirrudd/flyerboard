import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { MessageSquare, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatPrice } from "../../lib/priceFormatter";

export function ChatsTab() {
    const [expandedChatId, setExpandedChatId] = useState<Id<"chats"> | null>(null);

    // For now, we'll show a simple interface
    // In a full implementation, you'd want to fetch all chats
    const chatDetails = useQuery(
        api.admin.getChatForModeration,
        expandedChatId ? { chatId: expandedChatId } : "skip"
    );

    return (
        <section className="space-y-6">
            {/* Header */}
            <header>
                <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">Moderation</h3>
                <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground mb-1">Chat Monitoring</h2>
                <p className="text-[15px] text-muted-foreground">View user conversations for moderation purposes</p>
            </header>

            {/* Info Box */}
            <aside className="bg-blue-500/10 ring-1 ring-blue-500/20 rounded-2xl p-4">
                <div className="flex gap-3">
                    <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                        <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-blue-700 dark:text-blue-300 mb-1">Chat Monitoring</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300/80 leading-relaxed">
                            To view a specific chat, you'll need the Chat ID. You can find Chat IDs in the
                            Reports section when users report inappropriate conversations, or by checking user
                            details in the Users tab.
                        </p>
                    </div>
                </div>
            </aside>

            {/* Chat ID Input */}
            <div>
                <label htmlFor="chat-id-input" className="block text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">
                    Enter Chat ID to view conversation:
                </label>
                <div className="flex gap-2">
                    <input
                        id="chat-id-input"
                        type="text"
                        placeholder="Chat ID (e.g., jx7abc123...)"
                        className="flex-1 h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground placeholder:text-muted-foreground/70 tabular-nums"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                const value = (e.target as HTMLInputElement).value.trim();
                                if (value) {
                                    setExpandedChatId(value as Id<"chats">);
                                }
                            }
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => {
                            const input = document.querySelector('input[placeholder*="Chat ID"]') as HTMLInputElement;
                            const value = input?.value.trim();
                            if (value) {
                                setExpandedChatId(value as Id<"chats">);
                            }
                        }}
                        className="h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] rounded-full font-semibold shadow-sm shadow-primary/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        Load Chat
                    </button>
                </div>
            </div>

            {/* Chat Display */}
            {expandedChatId && (
                <article className="bg-card ring-1 ring-border/70 rounded-2xl overflow-hidden shadow-sm">
                    {chatDetails === undefined ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto" aria-label="Loading chat"></div>
                        </div>
                    ) : chatDetails === null ? (
                        <div className="p-8 text-center">
                            <p className="text-destructive font-medium">Chat not found. Please check the Chat ID.</p>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <header className="bg-muted/40 p-4 border-b border-border/60">
                                <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-3">Chat Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium text-muted-foreground">Buyer:</span>{" "}
                                        <span className="text-foreground">{chatDetails.buyer?.name} ({chatDetails.buyer?.email})</span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-muted-foreground">Seller:</span>{" "}
                                        <span className="text-foreground">{chatDetails.seller?.name} ({chatDetails.seller?.email})</span>
                                    </div>
                                    {chatDetails.ad && (
                                        <div className="md:col-span-2">
                                            <span className="font-medium text-muted-foreground">Flyer:</span>{" "}
                                            <span className="text-foreground">{chatDetails.ad.title} - <span className="font-display font-semibold tabular-nums text-primary">{formatPrice(chatDetails.ad.price || 0)}</span></span>
                                        </div>
                                    )}
                                </div>
                            </header>

                            {/* Messages */}
                            <div className="p-4 bg-muted/30 max-h-96 overflow-y-auto" style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
                                {chatDetails.messages.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">No messages in this chat</p>
                                ) : (
                                    <div className="space-y-3">
                                        {chatDetails.messages.map((message) => (
                                            <div
                                                key={message._id}
                                                className={`flex ${message.senderId === chatDetails.buyer?._id
                                                    ? "justify-start"
                                                    : "justify-end"
                                                    }`}
                                            >
                                                <div
                                                    className={`max-w-xs px-4 py-2 rounded-2xl shadow-sm ${message.senderId === chatDetails.buyer?._id
                                                        ? "bg-card ring-1 ring-border/70 text-foreground"
                                                        : "bg-primary text-primary-foreground"
                                                        }`}
                                                >
                                                    <div className={`text-[11px] font-semibold tracking-wide uppercase mb-1 opacity-70 ${message.senderId === chatDetails.buyer?._id ? "text-muted-foreground" : "text-primary-foreground/80"}`}>
                                                        {message.sender?.name || "Unknown"}
                                                    </div>
                                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                                                    <p
                                                        className={`text-xs mt-1 tabular-nums ${message.senderId === chatDetails.buyer?._id
                                                            ? "text-muted-foreground/70"
                                                            : "text-primary-foreground/70"
                                                            }`}
                                                    >
                                                        {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <footer className="bg-muted/40 p-4 border-t border-border/60">
                                <p className="text-sm text-muted-foreground">
                                    <span className="font-medium">Total Messages:</span> <span className="tabular-nums">{chatDetails.messages.length}</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    This is a read-only view for moderation purposes. Admins cannot send messages in
                                    user chats.
                                </p>
                            </footer>
                        </>
                    )}
                </article>
            )}

            {/* Empty State */}
            {!expandedChatId && (
                <div className="text-center py-12 ring-2 ring-dashed ring-border rounded-2xl bg-card/10">
                    <MessageSquare className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" aria-hidden="true" />
                    <p className="text-muted-foreground">Enter a Chat ID above to view the conversation</p>
                </div>
            )}
        </section>
    );
}

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
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Chat Monitoring</h2>
                <p className="text-muted-foreground">View user conversations for moderation purposes</p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex gap-3">
                    <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-1">Chat Monitoring</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300/80">
                            To view a specific chat, you'll need the Chat ID. You can find Chat IDs in the
                            Reports section when users report inappropriate conversations, or by checking user
                            details in the Users tab.
                        </p>
                    </div>
                </div>
            </div>

            {/* Chat ID Input */}
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Enter Chat ID to view conversation:
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Chat ID (e.g., jx7abc123...)"
                        className="flex-1 px-4 py-2 border border-border bg-background rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground"
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
                        onClick={() => {
                            const input = document.querySelector('input[placeholder*="Chat ID"]') as HTMLInputElement;
                            const value = input?.value.trim();
                            if (value) {
                                setExpandedChatId(value as Id<"chats">);
                            }
                        }}
                        className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors font-medium shadow-sm"
                    >
                        Load Chat
                    </button>
                </div>
            </div>

            {/* Chat Display */}
            {expandedChatId && (
                <div className="border border-border rounded-lg overflow-hidden bg-card">
                    {chatDetails === undefined ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
                        </div>
                    ) : chatDetails === null ? (
                        <div className="p-8 text-center">
                            <p className="text-destructive font-medium">Chat not found. Please check the Chat ID.</p>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div className="bg-muted/50 p-4 border-b border-border">
                                <h3 className="font-semibold text-foreground mb-2">Chat Details</h3>
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
                                            <span className="text-foreground">{chatDetails.ad.title} - {formatPrice(chatDetails.ad.price || 0)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="p-4 bg-muted max-h-96 overflow-y-auto" style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
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
                                                    className={`max-w-xs px-4 py-2 rounded-lg shadow-sm ${message.senderId === chatDetails.buyer?._id
                                                        ? "bg-card border border-border text-foreground"
                                                        : "bg-primary text-white"
                                                        }`}
                                                >
                                                    <div className={`text-xs font-medium mb-1 opacity-70 ${message.senderId === chatDetails.buyer?._id ? "text-muted-foreground" : "text-white/80"}`}>
                                                        {message.sender?.name || "Unknown"}
                                                    </div>
                                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                                    <p
                                                        className={`text-xs mt-1 ${message.senderId === chatDetails.buyer?._id
                                                            ? "text-muted-foreground/60"
                                                            : "text-white/70"
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
                            <div className="bg-muted/50 p-4 border-t border-border">
                                <p className="text-sm text-muted-foreground">
                                    <span className="font-medium">Total Messages:</span> {chatDetails.messages.length}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    This is a read-only view for moderation purposes. Admins cannot send messages in
                                    user chats.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Empty State */}
            {!expandedChatId && (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-lg bg-card/10">
                    <MessageSquare className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground">Enter a Chat ID above to view the conversation</p>
                </div>
            )}
        </div>
    );
}

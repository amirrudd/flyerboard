import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { MessageSquare, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Chat Monitoring</h2>
                <p className="text-gray-600">View user conversations for moderation purposes</p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                    <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-blue-900 mb-1">Chat Monitoring</h3>
                        <p className="text-sm text-blue-800">
                            To view a specific chat, you'll need the Chat ID. You can find Chat IDs in the
                            Reports section when users report inappropriate conversations, or by checking user
                            details in the Users tab.
                        </p>
                    </div>
                </div>
            </div>

            {/* Chat ID Input */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter Chat ID to view conversation:
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Chat ID (e.g., jx7abc123...)"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
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
                        className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                    >
                        Load Chat
                    </button>
                </div>
            </div>

            {/* Chat Display */}
            {expandedChatId && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {chatDetails === undefined ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mx-auto"></div>
                        </div>
                    ) : chatDetails === null ? (
                        <div className="p-8 text-center">
                            <p className="text-red-600">Chat not found. Please check the Chat ID.</p>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div className="bg-gray-50 p-4 border-b border-gray-200">
                                <h3 className="font-semibold text-gray-900 mb-2">Chat Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium text-gray-700">Buyer:</span>{" "}
                                        {chatDetails.buyer?.name} ({chatDetails.buyer?.email})
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700">Seller:</span>{" "}
                                        {chatDetails.seller?.name} ({chatDetails.seller?.email})
                                    </div>
                                    {chatDetails.ad && (
                                        <div className="md:col-span-2">
                                            <span className="font-medium text-gray-700">Flyer:</span>{" "}
                                            {chatDetails.ad.title} - ${chatDetails.ad.price}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="p-4 bg-gray-100 max-h-96 overflow-y-auto" style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
                                {chatDetails.messages.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">No messages in this chat</p>
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
                                                    className={`max-w-xs px-4 py-2 rounded-lg ${message.senderId === chatDetails.buyer?._id
                                                        ? "bg-white border border-gray-200"
                                                        : "bg-primary-600 text-white"
                                                        }`}
                                                >
                                                    <div className="text-xs font-medium mb-1 opacity-70">
                                                        {message.sender?.name || "Unknown"}
                                                    </div>
                                                    <p className="text-sm">{message.content}</p>
                                                    <p
                                                        className={`text-xs mt-1 ${message.senderId === chatDetails.buyer?._id
                                                            ? "text-gray-500"
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
                            <div className="bg-gray-50 p-4 border-t border-gray-200">
                                <p className="text-sm text-gray-600">
                                    <span className="font-medium">Total Messages:</span> {chatDetails.messages.length}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
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
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                    <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Enter a Chat ID above to view the conversation</p>
                </div>
            )}
        </div>
    );
}

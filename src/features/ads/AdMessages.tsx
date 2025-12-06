import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ReportModal } from "../../components/ReportModal";

interface AdMessagesProps {
  adId: Id<"ads">;
  onBack: () => void;
}

export function AdMessages({ adId, onBack }: AdMessagesProps) {
  const [selectedChatId, setSelectedChatId] = useState<Id<"chats"> | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const ad = useQuery(api.adDetail.getAdById, { adId });
  const chats = useQuery(api.messages.getAdChats, { adId });
  const messages = useQuery(
    api.messages.getChatMessages,
    selectedChatId ? { chatId: selectedChatId } : "skip"
  );

  const sendMessage = useMutation(api.messages.sendMessage);
  const markAsRead = useMutation(api.messages.markChatAsRead);

  const selectedChat = chats?.find(chat => chat._id === selectedChatId);

  useEffect(() => {
    if (selectedChatId) {
      markAsRead({ chatId: selectedChatId });
    }
  }, [selectedChatId, markAsRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChatId) return;

    try {
      await sendMessage({
        chatId: selectedChatId,
        content: newMessage.trim(),
      });
      setNewMessage("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    }
  };

  if (!ad) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-6xl mb-4">🔄</div>
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to flyers
            </button>
            <h1 className="text-xl font-semibold text-neutral-800">Messages for "{ad.title}"</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Chat List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
              <div className="p-4 border-b border-neutral-200">
                <h2 className="text-lg font-semibold text-neutral-800">
                  Conversations ({(chats || []).length})
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto">
                {(chats || []).length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="text-4xl mb-4">💬</div>
                    <h3 className="text-lg font-semibold text-neutral-800 mb-2">No messages yet</h3>
                    <p className="text-neutral-600 text-sm">
                      Messages from interested buyers will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {(chats || []).map((chat) => (
                      <button
                        key={chat._id}
                        onClick={() => setSelectedChatId(chat._id)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${selectedChatId === chat._id
                          ? 'bg-primary-600 text-white'
                          : 'hover:bg-neutral-100'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">
                            {chat.buyer?.name || "Unknown User"}
                          </span>
                          {chat.unreadCount > 0 && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedChatId === chat._id
                              ? 'bg-white text-primary-600'
                              : 'bg-primary-600 text-white'
                              }`}>
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                        {chat.latestMessage && (
                          <p className={`text-sm truncate ${selectedChatId === chat._id ? 'text-white/80' : 'text-neutral-600'
                            }`}>
                            {chat.latestMessage.content}
                          </p>
                        )}
                        <p className={`text-xs mt-1 ${selectedChatId === chat._id ? 'text-white/60' : 'text-neutral-500'
                          }`}>
                          {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: true })}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
              {selectedChat ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-neutral-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {selectedChat.buyer?.name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-800">
                            {selectedChat.buyer?.name || "Unknown User"}
                          </h3>
                          <p className="text-sm text-neutral-500">
                            {selectedChat.buyer?.email}
                          </p>
                        </div>
                      </div>

                      {/* Report Button */}
                      <button
                        onClick={() => setShowReportModal(true)}
                        className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                        title="Report conversation"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {(messages || []).map((message) => (
                      <div
                        key={message._id}
                        className={`flex ${message.senderId === ad.userId ? 'justify-end' : 'justify-start'
                          }`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.senderId === ad.userId
                            ? 'bg-primary-600 text-white'
                            : 'bg-neutral-100 text-neutral-900'
                            }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p
                            className={`text-xs mt-1 ${message.senderId === ad.userId
                              ? 'text-white/70'
                              : 'text-neutral-500'
                              }`}
                          >
                            {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-neutral-200">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-4">💬</div>
                    <h3 className="text-xl font-semibold text-neutral-800 mb-2">
                      Select a conversation
                    </h3>
                    <p className="text-neutral-600">
                      Choose a conversation from the left to start messaging
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {selectedChatId && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportType="chat"
          reportedEntityId={selectedChatId}
          reportedEntityName={`Conversation with ${selectedChat?.buyer?.name || 'Unknown User'}`}
        />
      )}
    </div>
  );
}

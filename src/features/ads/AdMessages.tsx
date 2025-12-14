import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ReportModal } from "../../components/ReportModal";
import { Flag, ChevronLeft } from "lucide-react";

interface AdMessagesProps {
  adId: Id<"ads">;
  onBack: () => void;
}

export function AdMessages({ adId, onBack }: AdMessagesProps) {
  const [selectedChatId, setSelectedChatId] = useState<Id<"chats"> | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

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

  // Reset scroll position on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Detect mobile for portal rendering
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const content = (
    <div className="fixed inset-x-0 top-0 bottom-[calc(72px+env(safe-area-inset-bottom))] md:relative md:inset-auto md:h-full bg-white flex flex-col z-40">
      {/* Fixed Header */}
      <header className="absolute top-0 left-0 right-0 h-16 z-50 bg-white border-b border-neutral-200 shadow-sm md:relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
            <button
              onClick={() => {
                // On mobile, if chat is selected, go back to conversations list
                // Otherwise, go back to flyers
                if (selectedChatId) {
                  setSelectedChatId(null);
                } else {
                  onBack();
                }
              }}
              className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back to flyers</span>
            </button>
            <h1 className="text-lg sm:text-xl font-semibold text-neutral-800 truncate mx-2">Messages for "{ad.title}"</h1>
            <div className="w-10 sm:w-20"></div>
          </div>
        </div>
      </header>

      {/* Content area - flex-1 fills space below header */}
      <div className={`flex-1 min-h-0 mt-16 md:mt-0 ${selectedChatId ? 'overflow-hidden' : 'overflow-y-auto mobile-scroll-container px-4 sm:px-6 lg:px-8 py-6 pb-24'} md:overflow-visible md:px-4 md:sm:px-6 md:lg:px-8 md:py-6 md:pb-6 max-w-7xl mx-auto w-full`}>
        <div className={`${selectedChatId ? 'h-full min-h-0' : ''} grid grid-cols-1 lg:grid-cols-3 ${selectedChatId ? 'gap-0' : 'gap-6'} lg:gap-6`}>
          {/* Chat List - Hidden on mobile when chat is selected */}
          <div className={`lg:col-span-1 ${selectedChatId ? 'hidden lg:block' : ''}`}>
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 flex flex-col lg:flex-none lg:max-h-[calc(100vh-200px)]">
              <div className="p-4 border-b border-neutral-200">
                <h2 className="text-lg font-semibold text-neutral-800">
                  Conversations ({(chats || []).length})
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto" style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
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
                          ? 'bg-primary-50 border-l-4 border-primary-600'
                          : 'hover:bg-neutral-100'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">
                            {chat.buyer?.name || "Deleted User"}
                          </span>
                          {chat.unreadCount > 0 && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary-600 text-white">
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                        {chat.latestMessage && (
                          <p className="text-sm truncate text-neutral-600">
                            {chat.latestMessage.content}
                          </p>
                        )}
                        <p className="text-xs mt-1 text-neutral-500">
                          {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: true })}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Messages - Hidden on mobile when no chat is selected */}
          <div className={`lg:col-span-2 ${!selectedChatId ? 'hidden lg:block' : 'h-full min-h-0'}`}>
            {/* Chat container: flex column with scroll in messages */}
            <div className="bg-white h-full min-h-0 flex flex-col lg:rounded-lg lg:shadow-sm lg:border lg:border-neutral-200">
              {selectedChat ? (
                <>
                  {/* Messages - Row 2: fills space, scrollable */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4" style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
                    {(messages || []).map((message) => (
                      <div
                        key={message._id}
                        className={`flex ${message.senderId === ad.userId ? 'justify-end' : 'justify-start'
                          }`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.senderId === ad.userId
                            ? 'bg-primary-50 text-neutral-900'
                            : 'bg-white border border-neutral-200 text-neutral-900'
                            }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p
                            className={`text-xs mt-1 ${message.senderId === ad.userId
                              ? 'text-neutral-500'
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
                  <form onSubmit={handleSendMessage} className="shrink-0 p-4 border-t border-neutral-200">
                    <div className="flex gap-2 items-end">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          // On desktop (Cmd/Ctrl+Enter), submit the form
                          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                            e.preventDefault();
                            handleSendMessage(e as any);
                          }
                        }}
                        placeholder="Type your message..."
                        rows={1}
                        className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none resize-none min-h-[42px] max-h-32 overflow-y-auto"
                        style={{ fieldSizing: 'content' } as any}
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="bg-primary-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        Send
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center p-6">
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
      {
        selectedChatId && (
          <ReportModal
            isOpen={showReportModal}
            onClose={() => setShowReportModal(false)}
            reportType="chat"
            reportedEntityId={selectedChatId}
            reportedEntityName={`Conversation with ${selectedChat?.buyer?.name || 'Unknown User'}`}
          />
        )
      }
    </div >
  );

  // On mobile, render via portal to escape scroll container
  return isMobile && typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : content;
}

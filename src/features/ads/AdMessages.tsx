import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { useSession } from "@descope/react-sdk";
import { useUserSync } from "../../context/UserSyncContext";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ReportModal } from "../../components/ReportModal";
import { useDeviceInfo } from "../../hooks/useDeviceInfo";
import { CaretLeft } from '@phosphor-icons/react';

interface AdMessagesProps {
  adId: Id<"ads">;
  onBack: () => void;
}

export function AdMessages({ adId, onBack }: AdMessagesProps) {
  const [selectedChatId, setSelectedChatId] = useState<Id<"chats"> | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useDeviceInfo();

  // Check authentication and sync status
  const { isAuthenticated, isSessionLoading } = useSession();
  const { isUserSynced } = useUserSync();

  // Only query when authenticated AND user is synced to database
  const ad = useQuery(api.adDetail.getAdById, { adId });
  const chats = useQuery(
    api.messages.getAdChats,
    isAuthenticated && !isSessionLoading && isUserSynced ? { adId } : "skip"
  );
  const messages = useQuery(
    api.messages.getChatMessages,
    selectedChatId && isAuthenticated && !isSessionLoading && isUserSynced ? { chatId: selectedChatId } : "skip"
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

  // Scroll to bottom when chat is opened or new messages arrive
  useEffect(() => {
    if (messages && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selectedChatId]); // Added selectedChatId to scroll when chat opens




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

  if (isSessionLoading || !ad) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center" role="status" aria-live="polite">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground mb-2">Loading...</h2>
        </div>
      </div>
    );
  }

  const content = (
    <div className="fixed inset-x-0 top-0 bottom-[calc(72px+env(safe-area-inset-bottom))] md:relative md:inset-auto md:h-full bg-card flex flex-col z-40">
      {/* Fixed Header */}
      <header className="absolute top-0 left-0 right-0 h-16 z-50 bg-card/95 backdrop-blur-sm ring-1 ring-border/70 md:relative">
        <div className="content-max-width mx-auto container-padding h-full">
          <div className="flex items-center justify-between h-full">
            <button
              type="button"
              onClick={() => {
                // On mobile, if chat is selected, go back to conversations list
                // Otherwise, go back to flyers
                if (selectedChatId) {
                  setSelectedChatId(null);
                } else {
                  onBack();
                }
              }}
              aria-label="Back"
              className="inline-flex items-center gap-2 h-10 px-3 -ml-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all"
            >
              <CaretLeft className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-medium">Back to flyers</span>
            </button>
            <h1 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-foreground truncate mx-2">Messages for "{ad.title}"</h1>
            <div className="w-10 sm:w-20" aria-hidden="true"></div>
          </div>
        </div>
      </header>

      {/* Content area - flex-1 fills space below header */}
      <div className={`flex-1 min-h-0 mt-16 md:mt-0 ${selectedChatId ? 'overflow-hidden' : 'overflow-y-auto mobile-scroll-container container-padding py-6 pb-24'} md:overflow-visible md:container-padding md:py-6 md:pb-6 content-max-width mx-auto w-full`}>
        <div className={`${selectedChatId ? 'h-full min-h-0' : ''} grid grid-cols-1 lg:grid-cols-3 ${selectedChatId ? 'gap-0' : 'gap-6'} lg:gap-6`}>
          {/* Chat List - Hidden on mobile when chat is selected */}
          <aside className={`lg:col-span-1 ${selectedChatId ? 'hidden lg:block' : ''}`}>
            <section className="bg-card rounded-2xl ring-1 ring-border/70 shadow-card flex flex-col lg:flex-none lg:max-h-[calc(100vh-200px)] overflow-hidden">
              <header className="px-5 py-4 border-b border-border/70">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Inbox</span>
                <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground">
                  Conversations <span className="font-sans text-base font-medium text-muted-foreground tabular-nums">({(chats || []).length})</span>
                </h2>
              </header>

              <div className="flex-1 overflow-y-auto" style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
                {(chats || []).length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="flex justify-center mb-4">
                      <span className="text-4xl" aria-hidden="true">💬</span>
                    </div>
                    <h3 className="font-display text-xl font-semibold tracking-tight text-foreground mb-2">No messages yet</h3>
                    <p className="text-[15px] leading-relaxed text-foreground/70 max-w-prose mx-auto">
                      Messages from interested buyers will appear here
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {(chats || []).map((chat) => {
                      const isActive = selectedChatId === chat._id;
                      return (
                        <li key={chat._id}>
                          <button
                            type="button"
                            onClick={() => setSelectedChatId(chat._id)}
                            aria-current={isActive ? "true" : undefined}
                            aria-label={`Conversation with ${chat.buyer?.name || "Deleted User"}`}
                            className={`relative w-full text-left px-5 py-4 transition-colors active:scale-[0.99] ${isActive
                              ? 'bg-muted/50'
                              : 'hover:bg-muted/40'
                              }`}
                          >
                            {isActive && (
                              <span aria-hidden="true" className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary" />
                            )}
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-foreground truncate">
                                {chat.buyer?.name || "Deleted User"}
                              </span>
                              {chat.unreadCount > 0 && (
                                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-2 rounded-full text-[11px] font-semibold tabular-nums bg-primary text-primary-foreground">
                                  {chat.unreadCount}
                                </span>
                              )}
                            </div>
                            {chat.latestMessage && (
                              <p className="text-sm truncate text-muted-foreground">
                                {chat.latestMessage.content}
                              </p>
                            )}
                            <p className="text-xs mt-1 text-muted-foreground/80 tabular-nums">
                              {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: true })}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          </aside>

          {/* Chat Messages - Hidden on mobile when no chat is selected */}
          <section className={`lg:col-span-2 ${!selectedChatId ? 'hidden lg:block' : 'h-full min-h-0'}`}>
            {/* Chat container: flex column with scroll in messages */}
            <div className="bg-card h-full min-h-0 flex flex-col lg:rounded-2xl lg:shadow-card lg:ring-1 lg:ring-border/70 overflow-hidden">
              {selectedChat ? (
                <>
                  {/* Messages - Row 2: fills space, scrollable */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6" style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
                    {/* Wrapper to push messages to bottom while allowing scroll */}
                    <div className="flex flex-col space-y-4 min-h-full justify-end">
                      {(messages || []).map((message) => (
                        <div
                          key={message._id}
                          className={`flex ${message.senderId === ad.userId ? 'justify-end' : 'justify-start'
                            }`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-lg shadow-sm ${message.senderId === ad.userId
                              ? 'bg-primary text-primary-foreground rounded-tr-sm'
                              : 'bg-muted/60 ring-1 ring-border/60 text-foreground rounded-tl-sm'
                              }`}
                          >
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                            <p
                              className={`text-[11px] mt-1 tabular-nums ${message.senderId === ad.userId
                                ? 'text-primary-foreground/75'
                                : 'text-muted-foreground'
                                }`}
                            >
                              {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Message Input */}
                  <form onSubmit={handleSendMessage} className="shrink-0 p-4 border-t border-border/70 bg-card">
                    <label htmlFor="conversation-message-input" className="sr-only">Type your message</label>
                    <div className="flex gap-2 items-end">
                      <textarea
                        id="conversation-message-input"
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
                        autoComplete="off"
                        className="flex-1 px-4 py-2.5 bg-muted/50 ring-1 ring-transparent rounded-2xl focus:ring-ring focus:bg-card focus:outline-none resize-none min-h-[44px] max-h-32 overflow-y-auto text-foreground placeholder:text-muted-foreground/70 transition-all"
                        style={{ fieldSizing: 'content' } as any}
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        aria-label="Send message"
                        className="h-11 px-5 sm:px-6 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-all"
                      >
                        Send
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center p-8 max-w-prose">
                    <div className="flex justify-center mb-4">
                      <span className="text-6xl" aria-hidden="true">💬</span>
                    </div>
                    <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground mb-2">
                      Select a conversation
                    </h3>
                    <p className="text-[15px] leading-relaxed text-foreground/70">
                      Choose a conversation from the left to start messaging
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
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

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { useSession } from "@descope/react-sdk";
import { useUserSync } from "../../context/UserSyncContext";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ReportModal } from "../../components/ReportModal";
import { useDeviceInfo } from "../../hooks/useDeviceInfo";
import { CaretLeft } from '@phosphor-icons/react';
import {
  ConversationThread,
  ConversationHeader,
  MessageComposer,
  InboxRow,
} from "../messages";
import type { ThreadMessage } from "../messages";

interface AdMessagesProps {
  adId: Id<"ads">;
  onBack: () => void;
}

export function AdMessages({ adId, onBack }: AdMessagesProps) {
  const [selectedChatId, setSelectedChatId] = useState<Id<"chats"> | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
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
      void markAsRead({ chatId: selectedChatId });
    }
  }, [selectedChatId, markAsRead]);

  // Reset scroll position on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleSend = async (content: string) => {
    if (!selectedChatId) return;
    await sendMessage({ chatId: selectedChatId, content });
  };

  // getChatMessages rows are structurally ThreadMessage-compatible already.
  const threadMessages: ThreadMessage[] = messages || [];

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
                    {(chats || []).map((chat, index) => {
                      return (
                        <li key={chat._id}>
                          <InboxRow
                            chat={chat}
                            role="selling"
                            onOpen={(chatId) => setSelectedChatId(chatId as Id<"chats">)}
                            isActive={selectedChatId === chat._id}
                            index={index}
                          />
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
                  <ConversationHeader
                    title={selectedChat.buyer?.name || "Deleted User"}
                    onReport={() => setShowReportModal(true)}
                  />

                  <ConversationThread
                    messages={threadMessages}
                    currentUserId={ad.userId}
                  />

                  <MessageComposer onSend={handleSend} />
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

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Id } from "../../../convex/_generated/dataModel";
import { AdDetail } from "../ads/AdDetail";
import { AdMessages } from "../ads/AdMessages";
import { SignOutButton } from "../auth/SignOutButton";

interface UserDashboardProps {
  onBack: () => void;
  onPostAd: () => void;
  onEditAd: (ad: any) => void;
}

export function UserDashboard({ onBack, onPostAd, onEditAd }: UserDashboardProps) {
  const [activeTab, setActiveTab] = useState<"ads" | "chats" | "saved" | "profile" | "archived">("ads");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAccountDeleteConfirm, setShowAccountDeleteConfirm] = useState(false);
  const [profileData, setProfileData] = useState({ name: "", email: "" });
  const [selectedAdId, setSelectedAdId] = useState<Id<"ads"> | null>(null);
  const [showMessagesForAd, setShowMessagesForAd] = useState<Id<"ads"> | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<Id<"chats"> | null>(null);
  const [expandedChatId, setExpandedChatId] = useState<Id<"chats"> | null>(null);
  const [selectedArchivedChats, setSelectedArchivedChats] = useState<Set<Id<"chats">>>(new Set());
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const user = useQuery(api.auth.loggedInUser);
  const userAds = useQuery(api.posts.getUserAds);
  const userStats = useQuery(api.users.getUserStats);
  const sellerChats = useQuery(api.posts.getSellerChats);
  const buyerChats = useQuery(api.posts.getBuyerChats);
  const savedAds = useQuery(api.adDetail.getSavedAds);
  const archivedChats = useQuery(
    api.messages.getArchivedChats,
    user && activeTab === "archived" ? {} : "skip"
  );

  // Get messages for expanded chat
  const chatMessages = useQuery(
    api.messages.getChatMessages,
    expandedChatId ? { chatId: expandedChatId } : "skip"
  );

  // Get unread counts for all user ads
  const unreadCounts = useQuery(
    api.messages.getUnreadCounts,
    userAds ? { adIds: userAds.map(ad => ad._id) } : "skip"
  );

  const deleteAd = useMutation(api.posts.deleteAd);
  const toggleAdStatus = useMutation(api.posts.toggleAdStatus);
  const updateProfile = useMutation(api.users.updateProfile);
  const deleteAccount = useMutation(api.users.deleteAccount);
  const sendMessage = useMutation(api.messages.sendMessage);
  const markAsRead = useMutation(api.messages.markChatAsRead);
  const archiveChat = useMutation(api.messages.archiveChat);
  const deleteArchivedChats = useMutation(api.messages.deleteArchivedChats);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Mark chat as read when expanded
  useEffect(() => {
    if (expandedChatId) {
      markAsRead({ chatId: expandedChatId });
    }
  }, [expandedChatId, markAsRead]);

  const handleDeleteAd = async (adId: string) => {
    try {
      await deleteAd({ adId: adId as any });
      toast.success("Ad deleted successfully");
      setShowDeleteConfirm(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete ad");
    }
  };

  const handleToggleStatus = async (adId: string) => {
    try {
      const result = await toggleAdStatus({ adId: adId as any });
      toast.success(result?.isActive ? "Ad activated" : "Ad deactivated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update ad status");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile(profileData);
      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      toast.success("Account deleted successfully");
      onBack();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete account");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !expandedChatId) return;

    try {
      await sendMessage({
        chatId: expandedChatId,
        content: newMessage.trim(),
      });
      setNewMessage("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    }
  };

  const handleChatClick = (chatId: Id<"chats">) => {
    if (expandedChatId === chatId) {
      setExpandedChatId(null);
    } else {
      setExpandedChatId(chatId);
    }
  };

  const handleViewListing = (adId: Id<"ads">) => {
    setSelectedAdId(adId);
    // Mark as read when viewing listing
    if (expandedChatId) {
      markAsRead({ chatId: expandedChatId });
    }
  };

  const handleArchiveChat = async (chatId: Id<"chats">) => {
    try {
      await archiveChat({ chatId });
      toast.success("Chat archived successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to archive chat");
    }
  };

  const handleDeleteArchivedChats = async () => {
    if (selectedArchivedChats.size === 0) return;

    try {
      await deleteArchivedChats({ chatIds: Array.from(selectedArchivedChats) });
      toast.success("Selected chats deleted successfully");
      setSelectedArchivedChats(new Set());
    } catch (error: any) {
      toast.error(error.message || "Failed to delete chats");
    }
  };

  const handleSelectArchivedChat = (chatId: Id<"chats">) => {
    const newSelected = new Set(selectedArchivedChats);
    if (newSelected.has(chatId)) {
      newSelected.delete(chatId);
    } else {
      newSelected.add(chatId);
    }
    setSelectedArchivedChats(newSelected);
  };

  const handleSelectAllArchivedChats = () => {
    if (selectedArchivedChats.size === (archivedChats || []).length) {
      setSelectedArchivedChats(new Set());
    } else {
      setSelectedArchivedChats(new Set((archivedChats || []).map(chat => chat._id)));
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">Please sign in</h2>
          <button
            onClick={onBack}
            className="text-primary-600 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // Show ad messages if selected
  if (showMessagesForAd) {
    return (
      <AdMessages
        adId={showMessagesForAd}
        onBack={() => setShowMessagesForAd(null)}
      />
    );
  }

  // Show ad detail if an ad is selected
  if (selectedAdId) {
    return (
      <AdDetail
        adId={selectedAdId}
        onBack={() => setSelectedAdId(null)}
        onShowAuth={() => { }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to marketplace
              </button>
              <h1 className="text-xl font-bold text-neutral-900">FlyerBoard</h1>
            </div>

            <div className="flex items-center gap-3">
              <SignOutButton onSignOut={onBack} />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-800">{user.name || "User"}</h3>
                  <p className="text-sm text-neutral-500">{user.email}</p>
                </div>
              </div>

              {userStats && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary-600">{userStats.totalAds}</div>
                    <div className="text-xs text-neutral-500">Total Ads</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary-600">{userStats.totalViews}</div>
                    <div className="text-xs text-neutral-500">Total Views</div>
                  </div>
                </div>
              )}
            </div>

            <nav className="bg-white rounded-lg p-4 shadow-sm">
              <div className="space-y-2">
                {[
                  { id: "ads", label: "My Ads", icon: "📝" },
                  {
                    id: "chats",
                    label: "Messages",
                    icon: "💬",
                    badge: buyerChats ? buyerChats.reduce((total: number, chat: any) => total + (chat.unreadCount || 0), 0) : 0
                  },
                  { id: "saved", label: "Saved Ads", icon: "❤️" },
                  { id: "archived", label: "Archived", icon: "📦" },
                  { id: "profile", label: "Profile", icon: "👤" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${activeTab === tab.id ? 'bg-primary-600 text-white' : 'hover:bg-neutral-100'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </div>
                    {tab.badge && tab.badge > 0 && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${activeTab === tab.id
                          ? 'bg-white text-primary-600'
                          : 'bg-primary-600 text-white'
                        }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === "ads" && (
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-neutral-800">My Listings</h2>
                  <button
                    onClick={onPostAd}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                  >
                    Post New Ad
                  </button>
                </div>

                <div className="space-y-4">
                  {(userAds || []).map((ad) => (
                    <div key={ad._id} className="border border-neutral-200 rounded-lg p-4">
                      <div className="flex items-start gap-4">
                        <img
                          src={ad.images[0] || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop'}
                          alt={ad.title}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-neutral-800 mb-1">{ad.title}</h3>
                              <p className="text-lg font-bold text-primary-600 mb-2">
                                ${ad.price.toLocaleString()} AUD
                              </p>
                              <div className="flex items-center gap-4 text-sm text-neutral-500">
                                <span>{ad.views} views</span>
                                <span className={`px-2 py-1 rounded-full text-xs ${ad.isActive ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-gray-800'
                                  }`}>
                                  {ad.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setShowMessagesForAd(ad._id)}
                                className="relative px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors flex items-center gap-1"
                              >
                                💬 Messages
                                {unreadCounts && unreadCounts[ad._id] > 0 && (
                                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                    {unreadCounts[ad._id]}
                                  </span>
                                )}
                              </button>
                              <button
                                onClick={() => handleToggleStatus(ad._id)}
                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${ad.isActive
                                    ? 'bg-neutral-100 text-neutral-700 hover:bg-gray-200'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                  }`}
                              >
                                {ad.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => onEditAd(ad)}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(ad._id)}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {(userAds || []).length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">📝</div>
                      <h3 className="text-xl font-semibold text-neutral-800 mb-2">No ads yet</h3>
                      <p className="text-neutral-600 mb-4">Start by posting your first listing</p>
                      <button
                        onClick={onPostAd}
                        className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                      >
                        Post Your First Ad
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "chats" && (
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-neutral-800 mb-6">My Messages</h2>
                <p className="text-neutral-600 mb-6">Conversations for listings you're interested in</p>

                <div className="space-y-4">
                  {(buyerChats || []).map((chat: any) => (
                    <div key={chat._id} className="border border-neutral-200 rounded-lg overflow-hidden">
                      {/* Chat Header */}
                      <div
                        onClick={() => handleChatClick(chat._id)}
                        className="p-4 hover:bg-neutral-100 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <img
                              src={chat.ad?.images?.[0] || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop'}
                              alt={chat.ad?.title || "Ad"}
                              className="w-16 h-16 object-cover rounded-lg"
                            />
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="font-semibold text-neutral-800 mb-1">
                                    {chat.ad?.title || "Deleted Ad"}
                                  </h3>
                                  {!chat.ad?.isActive && chat.ad && (
                                    <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full mb-1">
                                      Listing Inactive
                                    </span>
                                  )}
                                  <p className="text-sm text-neutral-600">
                                    Seller: {chat.seller?.name || "Unknown User"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {chat.ad && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewListing(chat.ad!._id);
                                      }}
                                      className="px-3 py-1 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                                    >
                                      View Listing
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleArchiveChat(chat._id);
                                    }}
                                    className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                                  >
                                    Archive
                                  </button>
                                  {chat.unreadCount > 0 && (
                                    <span className="bg-primary-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium">
                                      {chat.unreadCount}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {chat.latestMessage && (
                                <p className="text-sm text-neutral-500 line-clamp-2">
                                  "{chat.latestMessage.content}"
                                </p>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                <p className="text-xs text-gray-400">
                                  {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: true })}
                                </p>
                                <div className="text-lg font-bold text-primary-600">
                                  ${chat.ad?.price?.toLocaleString() || 0} AUD
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Chat Messages */}
                      {expandedChatId === chat._id && (
                        <div className="border-t border-neutral-200">
                          {/* Messages */}
                          <div className="max-h-96 overflow-y-auto p-4 space-y-3 bg-neutral-100">
                            {(chatMessages || []).map((message) => (
                              <div
                                key={message._id}
                                className={`flex ${message.senderId === user._id ? 'justify-end' : 'justify-start'
                                  }`}
                              >
                                <div
                                  className={`max-w-xs px-3 py-2 rounded-lg ${message.senderId === user._id
                                      ? 'bg-primary-600 text-white'
                                      : 'bg-white text-neutral-900 border border-neutral-200'
                                    }`}
                                >
                                  <p className="text-sm">{message.content}</p>
                                  <p
                                    className={`text-xs mt-1 ${message.senderId === user._id
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
                          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-neutral-200">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type your message..."
                                className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                                disabled={!chat.ad?.isActive}
                              />
                              <button
                                type="submit"
                                disabled={!newMessage.trim() || !chat.ad?.isActive}
                                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Send
                              </button>
                            </div>
                            {!chat.ad?.isActive && (
                              <p className="text-xs text-red-600 mt-2">
                                Cannot send messages - listing is inactive or deleted
                              </p>
                            )}
                          </form>
                        </div>
                      )}
                    </div>
                  ))}

                  {(buyerChats || []).length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">💬</div>
                      <h3 className="text-xl font-semibold text-neutral-800 mb-2">No messages yet</h3>
                      <p className="text-neutral-600">Start a conversation by messaging sellers on listings you're interested in</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "saved" && (
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-neutral-800 mb-6">Saved Ads</h2>

                <div className="grid gap-4">
                  {(savedAds || []).filter(savedAd => savedAd.ad).map((savedAd) => (
                    <div
                      key={savedAd._id}
                      onClick={() => setSelectedAdId(savedAd.ad!._id)}
                      className="border border-neutral-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300 hover:border-primary-600 cursor-pointer group"
                    >
                      <div className="flex items-start gap-4">
                        <img
                          src={savedAd.ad!.images[0] || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop'}
                          alt={savedAd.ad!.title}
                          className="w-20 h-20 object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-neutral-800 mb-1 group-hover:text-primary-600 transition-colors">
                            {savedAd.ad!.title}
                          </h3>
                          <p className="text-lg font-bold text-primary-600 mb-2">
                            ${savedAd.ad!.price.toLocaleString()} AUD
                          </p>
                          <p className="text-sm text-neutral-600 mb-2 line-clamp-2">
                            {savedAd.ad!.description}
                          </p>
                          <div className="flex items-center justify-between text-sm text-neutral-500">
                            <span>{savedAd.ad!.location}</span>
                            <span>{savedAd.ad!.views} views</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {(savedAds || []).length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">❤️</div>
                      <h3 className="text-xl font-semibold text-neutral-800 mb-2">No saved ads</h3>
                      <p className="text-neutral-600">Save ads you're interested in to view them here</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "profile" && (
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-neutral-800 mb-6">Profile Settings</h2>

                <form onSubmit={handleUpdateProfile} className="space-y-4 mb-8">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Name</label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                      placeholder={user.name || "Enter your name"}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                      placeholder={user.email || "Enter your email"}
                    />
                  </div>

                  <button
                    type="submit"
                    className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                  >
                    Update Profile
                  </button>
                </form>

                <div className="border-t border-neutral-200 pt-6">
                  <h3 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h3>
                  <p className="text-neutral-600 mb-4">
                    Deleting your account will permanently remove all your data, including ads, messages, and saved items. This action cannot be undone.
                  </p>
                  <button
                    onClick={() => setShowAccountDeleteConfirm(true)}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            )}

            {activeTab === "archived" && (
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-neutral-800">Archived Messages</h2>
                  {(archivedChats || []).length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectAllArchivedChats}
                        className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                      >
                        {selectedArchivedChats.size === (archivedChats || []).length ? 'Deselect All' : 'Select All'}
                      </button>
                      {selectedArchivedChats.size > 0 && (
                        <button
                          onClick={handleDeleteArchivedChats}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                        >
                          Delete Selected ({selectedArchivedChats.size})
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {(archivedChats || []).length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">📦</div>
                      <h3 className="text-xl font-semibold text-neutral-800 mb-2">No archived messages</h3>
                      <p className="text-neutral-600">Archived conversations will appear here</p>
                    </div>
                  ) : (
                    <div>Archived chats will be displayed here</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Ad Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">Delete Ad</h3>
            <p className="text-neutral-600 mb-6">
              Are you sure you want to delete this ad? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAd(showDeleteConfirm)}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showAccountDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-red-600 mb-4">Delete Account</h3>
            <p className="text-neutral-600 mb-6">
              Are you absolutely sure? This will permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowAccountDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { formatDistanceToNow } from 'date-fns';

interface Message {
    _id: string;
    content: string;
    timestamp: number;
    isCurrentUser: boolean;
}

interface ChatMessagesProps {
    messages: Message[];
}

export function ChatMessages({ messages }: ChatMessagesProps) {
    if (!messages || messages.length === 0) {
        return null;
    }

    return (
        <div className="h-64 overflow-y-auto p-4 space-y-3" style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
            {messages.map((message) => (
                <div
                    key={message._id}
                    className={`flex ${message.isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                    <div
                        className={`max-w-xs px-3 py-2 rounded-lg ${message.isCurrentUser
                                ? 'bg-primary-600 text-white'
                                : 'bg-neutral-100 text-neutral-900'
                            }`}
                    >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p
                            className={`text-xs mt-1 ${message.isCurrentUser ? 'text-orange-200' : 'text-neutral-500'
                                }`}
                        >
                            {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}

import { useState } from "react";
import { toast } from "sonner";

export interface MessageComposerProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  /** Shown under the input when `disabled` (e.g. "Flyer is inactive"). */
  disabledReason?: string;
  placeholder?: string;
}

// `field-sizing: content` auto-grows the textarea in supporting browsers;
// min/max-height classes are the fallback. Not yet in React.CSSProperties.
const AUTO_GROW_STYLE = { fieldSizing: "content" } as unknown as React.CSSProperties;

/**
 * Chat input row. One consistent send rule everywhere:
 * - Enter sends, Shift+Enter inserts a newline.
 * - Send disabled while empty / disabled / already sending.
 * - Input clears only after a successful send; errors keep the draft and
 *   surface via a sonner toast.
 */
export function MessageComposer({
  onSend,
  disabled = false,
  disabledReason,
  placeholder = "Type your message...",
}: MessageComposerProps) {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  const submit = async () => {
    const content = value.trim();
    if (!content || disabled || isSending) return;

    setIsSending(true);
    try {
      await onSend(content);
      setValue("");
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Failed to send message"
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="shrink-0 p-4 border-t border-border/70 bg-card"
    >
      <label htmlFor="message-composer-input" className="sr-only">
        Type your message
      </label>
      <div className="flex gap-2 items-end">
        <textarea
          id="message-composer-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={placeholder}
          rows={1}
          autoComplete="off"
          disabled={disabled}
          className="flex-1 px-4 py-2.5 bg-muted/50 ring-1 ring-transparent rounded-2xl focus:ring-ring focus:bg-card focus:outline-none resize-none min-h-[44px] max-h-32 overflow-y-auto text-foreground placeholder:text-muted-foreground/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={AUTO_GROW_STYLE}
        />
        <button
          type="submit"
          disabled={disabled || isSending || !value.trim()}
          aria-label="Send message"
          className="h-11 px-5 sm:px-6 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-all"
        >
          Send
        </button>
      </div>
      {disabled && disabledReason && (
        <p className="text-xs text-destructive mt-2">{disabledReason}</p>
      )}
    </form>
  );
}

import { toast } from "sonner";

/**
 * Share the current page (native share sheet where available, clipboard
 * fallback with a toast elsewhere). Shared by the public sale and bundle
 * pages so the copy/error handling can't drift between them.
 */
export async function sharePage(title: string): Promise<void> {
  const url = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch {
      /* cancelled */
    }
  } else {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }
}

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp } from "@phosphor-icons/react";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";

interface ScrollToTopButtonProps {
  visible: boolean;
  onClick: () => void;
}

export function ScrollToTopButton({ visible, onClick }: ScrollToTopButtonProps) {
  const { reduced } = useMotionPrefs();
  const hiddenState = { opacity: 0, scale: reduced ? 1 : 0.55, y: reduced ? 0 : 8 };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={hiddenState}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={hiddenState}
          transition={{ type: "spring", stiffness: 440, damping: 26, mass: 0.7 }}
          whileHover={reduced ? undefined : { scale: 1.1, y: -3 }}
          whileTap={reduced ? undefined : { scale: 0.88 }}
          onClick={onClick}
          className="group fixed bottom-24 right-4 md:bottom-8 md:right-8 z-40 h-10 w-10 rounded-full bg-background/90 backdrop-blur-sm ring-1 ring-border/60 shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Back to top"
        >
          <span className="flex items-center justify-center transition-transform duration-200 ease-out group-hover:-translate-y-0.5">
            <ArrowUp weight="bold" className="w-[18px] h-[18px]" />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

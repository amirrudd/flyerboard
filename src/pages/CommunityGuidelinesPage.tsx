import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import { useMotionPrefs } from "../hooks/useMotionPrefs";
import { MarkdownContent } from "../components/MarkdownContent";
import { useHeaderSlots } from "../features/layout/HeaderSlots";
import { CaretLeft } from '@phosphor-icons/react';
import guidelinesContent from "../content/community-guidelines.md?raw";

export function CommunityGuidelinesPage() {
    const { hash } = useLocation();
    const navigate = useNavigate();
    const { whileInView } = useMotionPrefs();

    useEffect(() => {
        if (hash) {
            const element = document.getElementById(hash.replace("#", ""));
            if (element) {
                element.scrollIntoView({ behavior: "smooth" });
            }
        } else {
            window.scrollTo(0, 0);
        }
    }, [hash]);

    // Customise the persistent Layout header (config rebuilt every render by design)
    useHeaderSlots({
        leftNode: (
            <button
                type="button"
                onClick={() => { void navigate('/'); }}
                aria-label="Go back to home"
                className="flex items-center gap-2 h-10 px-3 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all"
            >
                <CaretLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back</span>
            </button>
        ),
        centerNode: (
            <span className="font-display text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">Community Guidelines</span>
        ),
        rightNode: <div />,
    });

    return (
        <>
            <section className="min-h-screen bg-background py-12 pb-bottom-nav md:pb-12">
                <div className="content-max-width mx-auto container-padding">
                    <article className="content-width-reading mx-auto">
                        <m.div {...whileInView()}>
                            <MarkdownContent content={guidelinesContent} />
                        </m.div>
                    </article>
                </div>
            </section>
        </>
    );
}

export default CommunityGuidelinesPage;

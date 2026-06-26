import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useMotionPrefs } from "../hooks/useMotionPrefs";
import { MarkdownContent } from "../components/MarkdownContent";
import { Header } from "../features/layout/Header";
import { ChevronLeft } from 'lucide-react';
import aboutContent from "../content/about-us.md?raw";

export function AboutUsPage() {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const { whileInView } = useMotionPrefs();

    return (
        <>
            <Header
                leftNode={
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        aria-label="Go back to home"
                        className="flex items-center gap-2 h-10 px-3 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                }
                centerNode={
                    <span className="font-display text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">About Us</span>
                }
                rightNode={<div />}
            />
            <section className="min-h-screen bg-background py-12 pb-bottom-nav md:pb-12">
                <div className="content-max-width mx-auto container-padding">
                    <article className="content-width-reading mx-auto">
                        {/* Logo Hero */}
                        <motion.header {...whileInView()} className="flex justify-center mb-10">
                            <img
                                src="/icons/icon-512x512.png"
                                alt="FlyerBoard Logo"
                                className="w-32 h-32"
                            />
                        </motion.header>
                        <motion.div {...whileInView(0.05)}>
                            <MarkdownContent content={aboutContent} />
                        </motion.div>
                    </article>
                </div>
            </section>
        </>
    );
}

export default AboutUsPage;

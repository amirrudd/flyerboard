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

    const { fadeUp, whileInView } = useMotionPrefs();

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
            <section className="min-h-screen bg-background pb-bottom-nav md:pb-12">
                <div className="content-max-width mx-auto container-padding">

                    {/* Editorial 2-column hero — brand image + narrative */}
                    <motion.div
                        {...fadeUp()}
                        className="py-10 sm:py-14 flex flex-col sm:flex-row gap-8 sm:gap-12 items-center"
                    >
                        {/* Brand image — double-bezel enclosure */}
                        <div className="w-full sm:w-2/5 flex-shrink-0">
                            <div className="p-1.5 bg-muted/40 ring-1 ring-border/60 rounded-[1.75rem]">
                                <div className="rounded-[calc(1.75rem-0.375rem)] overflow-hidden aspect-[4/3] bg-muted/60 relative">
                                    <img
                                        src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Flinders_St_Station_Melbourne._%2820484830004%29.jpg/960px-Flinders_St_Station_Melbourne._%2820484830004%29.jpg"
                                        alt="Flinders Street Station, Melbourne"
                                        className="w-full h-full object-cover"
                                        loading="eager"
                                    />
                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
                                </div>
                            </div>
                        </div>

                        {/* Narrative */}
                        <div className="flex flex-col gap-4 sm:w-3/5">
                            <span className="kicker text-primary/80">Our Story</span>
                            <h1 className="font-display font-display-var text-3xl sm:text-4xl lg:text-5xl font-medium text-foreground leading-[1.05] tracking-[-0.02em]">
                                A safer way to buy &amp; sell in Australia
                            </h1>
                            <p className="text-base text-muted-foreground leading-relaxed">
                                FlyerBoard was born from a simple frustration — existing classified platforms weren't doing enough to protect Australians from scams and fraud. We're building a marketplace where every transaction feels safe, local, and trustworthy.
                            </p>
                            <div className="flex flex-wrap gap-2.5 mt-1">
                                <div className="bg-card ring-1 ring-border/70 rounded-full px-3.5 py-2 shadow-card">
                                    <span className="text-sm font-semibold text-foreground">🛡️ Safety first</span>
                                </div>
                                <div className="bg-card ring-1 ring-border/70 rounded-full px-3.5 py-2 shadow-card">
                                    <span className="text-sm font-semibold text-foreground">🇦🇺 Made in Melbourne</span>
                                </div>
                                <div className="bg-card ring-1 ring-border/70 rounded-full px-3.5 py-2 shadow-card">
                                    <span className="text-sm font-semibold text-foreground">🌱 Sustainable</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <div className="hairline mb-10" />

                    {/* Body */}
                    <motion.article {...whileInView(0.05)} className="max-w-[1120px] mx-auto pb-4">
                        <MarkdownContent content={aboutContent} />
                    </motion.article>
                </div>
            </section>
        </>
    );
}

export default AboutUsPage;

import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { CaretLeft, ArrowRight } from "@phosphor-icons/react";
import { useMotionPrefs } from "../hooks/useMotionPrefs";
import { Header } from "../features/layout/Header";
import { getAllPosts } from "../lib/blog";

const SITE_URL = "https://flyerboard.com.au";

function formatDate(date: string): string {
    if (!date) return "";
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? date : format(parsed, "d MMM yyyy");
}

export function BlogIndexPage() {
    const navigate = useNavigate();
    const { fadeUp, whileInView, staggerCard } = useMotionPrefs();
    const posts = getAllPosts();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // GEO: an ItemList of every post makes the index machine-readable for AI
    // crawlers and search engines (see docs/guides/blog-content-guideline.md).
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "FlyerBoard Blog",
        description:
            "Practical guides on buying and selling safely on Australia's local marketplace.",
        url: `${SITE_URL}/blog`,
        blogPost: posts.map((post) => ({
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            dateModified: post.updated ?? post.date,
            url: `${SITE_URL}/blog/${post.slug}`,
            author: { "@type": "Organization", name: post.author },
        })),
    };

    return (
        <>
            <title>Blog — FlyerBoard</title>
            <meta
                name="description"
                content="Practical guides on buying and selling safely on FlyerBoard, Australia's local classified marketplace."
            />
            <link rel="canonical" href={`${SITE_URL}/blog`} />
            <meta property="og:title" content="FlyerBoard Blog" />
            <meta
                property="og:description"
                content="Practical guides on buying and selling safely on FlyerBoard, Australia's local marketplace."
            />
            <meta property="og:type" content="website" />
            <meta property="og:url" content={`${SITE_URL}/blog`} />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <Header
                leftNode={
                    <button
                        type="button"
                        onClick={() => { void navigate("/"); }}
                        aria-label="Go back to home"
                        className="flex items-center gap-2 h-10 px-3 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all"
                    >
                        <CaretLeft className="w-5 h-5" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                }
                centerNode={
                    <span className="font-display text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">Blog</span>
                }
                rightNode={<div />}
            />

            <section className="min-h-screen bg-background pb-bottom-nav md:pb-12">
                <div className="content-max-width mx-auto container-padding">

                    {/* Hero */}
                    <motion.header {...fadeUp()} className="py-10 sm:py-14 max-w-2xl">
                        <span className="kicker text-primary/80">FlyerBoard Blog</span>
                        <h1 className="font-display font-display-var text-3xl sm:text-4xl lg:text-5xl font-medium text-foreground leading-[1.05] tracking-[-0.02em] mt-3">
                            Guides for buying &amp; selling locally
                        </h1>
                        <p className="text-base text-muted-foreground leading-relaxed mt-4">
                            Practical, no-nonsense tips on selling faster, buying smarter, and staying safe on Australia's local marketplace.
                        </p>
                    </motion.header>

                    <div className="hairline mb-8" />

                    {/* Post list */}
                    <motion.ul
                        {...whileInView(0.05)}
                        className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-6 list-none"
                    >
                        {posts.map((post, i) => (
                            <motion.li key={post.slug} {...staggerCard(i)}>
                                <Link
                                    to={`/blog/${post.slug}`}
                                    className="group flex flex-col h-full bg-card ring-1 ring-border/70 rounded-2xl p-6 shadow-card hover:ring-primary/40 hover:-translate-y-0.5 transition-all"
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-[0.08em] px-2.5 py-1">
                                            {post.category}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {post.readingTime} min read
                                        </span>
                                    </div>
                                    <h2 className="font-display text-xl font-semibold tracking-tight text-foreground leading-snug">
                                        {post.title}
                                    </h2>
                                    <p className="text-sm text-muted-foreground leading-relaxed mt-2 flex-1">
                                        {post.description}
                                    </p>
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/60">
                                        <time dateTime={post.date} className="text-xs text-muted-foreground">
                                            {formatDate(post.date)}
                                        </time>
                                        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                                            Read
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                        </span>
                                    </div>
                                </Link>
                            </motion.li>
                        ))}
                    </motion.ul>

                    {posts.length === 0 && (
                        <p className="text-muted-foreground py-12 text-center">No posts yet — check back soon.</p>
                    )}
                </div>
            </section>
        </>
    );
}

export default BlogIndexPage;

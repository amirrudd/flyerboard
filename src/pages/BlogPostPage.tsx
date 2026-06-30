import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CaretLeft, ArrowLeft } from "@phosphor-icons/react";
import { useMotionPrefs } from "../hooks/useMotionPrefs";
import { Header } from "../features/layout/Header";
import { MarkdownContent } from "../components/MarkdownContent";
import { getPostBySlug, formatBlogDate } from "../lib/blog";
import { SITE_URL, postUrl } from "../lib/site";

export function BlogPostPage() {
    const navigate = useNavigate();
    const { slug } = useParams<{ slug: string }>();
    const { fadeUp, whileInView } = useMotionPrefs();
    const post = slug ? getPostBySlug(slug) : undefined;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [slug]);

    if (!post) {
        return (
            <>
                <title>Post not found — FlyerBoard Blog</title>
                <Header
                    leftNode={
                        <button
                            type="button"
                            onClick={() => { void navigate("/blog"); }}
                            aria-label="Back to blog"
                            className="flex items-center gap-2 h-10 px-3 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                        >
                            <CaretLeft className="w-5 h-5" />
                            <span className="hidden sm:inline">Blog</span>
                        </button>
                    }
                    centerNode={<span className="font-display text-lg font-semibold text-foreground">Blog</span>}
                    rightNode={<div />}
                />
                <section className="min-h-screen bg-background flex items-center justify-center container-padding">
                    <div className="text-center">
                        <h1 className="font-display text-2xl font-semibold text-foreground mb-2">Post not found</h1>
                        <p className="text-muted-foreground mb-6">This article may have moved or been removed.</p>
                        <Link to="/blog" className="text-primary font-medium hover:underline">← Back to all posts</Link>
                    </div>
                </section>
            </>
        );
    }

    const canonical = postUrl(post.slug);
    const keywordsContent = post.keywords.join(", ");
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.updated ?? post.date,
        author: { "@type": "Organization", name: post.author },
        publisher: {
            "@type": "Organization",
            name: "FlyerBoard",
            url: SITE_URL,
        },
        keywords: keywordsContent,
        articleSection: post.category,
        ...(post.heroImage ? { image: `${SITE_URL}${post.heroImage}` } : {}),
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
        url: canonical,
    };

    return (
        <>
            <title>{`${post.title} — FlyerBoard Blog`}</title>
            <meta name="description" content={post.description} />
            <meta name="keywords" content={keywordsContent} />
            <meta name="author" content={post.author} />
            <link rel="canonical" href={canonical} />
            <meta property="og:type" content="article" />
            <meta property="og:title" content={post.title} />
            <meta property="og:description" content={post.description} />
            <meta property="og:url" content={canonical} />
            <meta property="og:image" content={`${SITE_URL}/og-preview.png`} />
            <meta property="article:published_time" content={post.date} />
            {post.updated && <meta property="article:modified_time" content={post.updated} />}
            <meta property="article:section" content={post.category} />
            <meta name="twitter:card" content="summary_large_image" />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <Header
                leftNode={
                    <button
                        type="button"
                        onClick={() => { void navigate("/blog"); }}
                        aria-label="Back to blog"
                        className="flex items-center gap-2 h-10 px-3 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all"
                    >
                        <CaretLeft className="w-5 h-5" />
                        <span className="hidden sm:inline">Blog</span>
                    </button>
                }
                centerNode={
                    <span className="font-display text-lg font-semibold tracking-tight text-foreground truncate">Blog</span>
                }
                rightNode={<div />}
            />

            <section className="min-h-screen bg-background pb-bottom-nav md:pb-16">
                <div className="content-max-width mx-auto container-padding">
                    <article className="max-w-[760px] mx-auto pt-8 sm:pt-12">
                        {/* Editorial cover image */}
                        {post.heroImage && (
                            <motion.figure
                                {...fadeUp()}
                                className="mb-8 overflow-hidden rounded-2xl ring-1 ring-border/70 bg-muted/40"
                            >
                                <img
                                    src={post.heroImage}
                                    alt={post.heroAlt ?? post.title}
                                    className="w-full aspect-[16/9] object-cover"
                                    loading="eager"
                                />
                            </motion.figure>
                        )}

                        {/* Meta row */}
                        <motion.div {...fadeUp()} className="flex flex-wrap items-center gap-3 mb-6">
                            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-[0.08em] px-2.5 py-1">
                                {post.category}
                            </span>
                            <time dateTime={post.date} className="text-sm text-muted-foreground">
                                {formatBlogDate(post.date, "d MMMM yyyy")}
                            </time>
                            <span className="text-sm text-muted-foreground">·</span>
                            <span className="text-sm text-muted-foreground">{post.readingTime} min read</span>
                        </motion.div>

                        {/* Body — the markdown's own H1 is the article title */}
                        <motion.div {...whileInView(0.05)}>
                            <MarkdownContent content={post.content} />
                        </motion.div>

                        {/* Footer */}
                        <div className="hairline my-10" />
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <Link
                                to="/blog"
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                All posts
                            </Link>
                            <Link
                                to="/post"
                                className="inline-flex items-center justify-center h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all"
                            >
                                Post an ad on FlyerBoard
                            </Link>
                        </div>
                    </article>
                </div>
            </section>
        </>
    );
}

export default BlogPostPage;

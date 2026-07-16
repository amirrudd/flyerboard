import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import { CaretLeft } from "@phosphor-icons/react";
import { useMotionPrefs } from "../hooks/useMotionPrefs";
import { useHeaderSlots } from "../features/layout/HeaderSlots";
import { ThemeToggle } from "../components/ThemeToggle";
import { BlogPostCard } from "../components/BlogPostCard";
import { getAllPosts } from "../lib/blog";
import { SITE_URL, postUrl } from "../lib/site";

export function BlogIndexPage() {
    const navigate = useNavigate();
    const { fadeUp, whileInView, staggerCard } = useMotionPrefs();
    const posts = getAllPosts();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Customise the persistent Layout header (config rebuilt every render by design)
    useHeaderSlots({
        leftNode: (
            <button
                type="button"
                onClick={() => { void navigate("/"); }}
                aria-label="Go to FlyerBoard home"
                className="flex items-center gap-2 h-10 pl-2 pr-3.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all"
            >
                <CaretLeft className="w-5 h-5 flex-shrink-0" />
                <span className="font-display font-semibold">FlyerBoard</span>
            </button>
        ),
        centerNode: (
            <span className="font-display text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">Blog</span>
        ),
        rightNode: <ThemeToggle />,
    });

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
            url: postUrl(post.slug),
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

            <section className="min-h-screen bg-background pb-12">
                <div className="content-max-width mx-auto container-padding">

                    {/* Hero */}
                    <m.header {...fadeUp()} className="py-10 sm:py-14 max-w-2xl">
                        <span className="kicker text-primary/80">FlyerBoard Blog</span>
                        <h1 className="font-display font-display-var text-3xl sm:text-4xl lg:text-5xl font-medium text-foreground leading-[1.05] tracking-[-0.02em] mt-3">
                            Guides for buying &amp; selling locally
                        </h1>
                        <p className="text-base text-muted-foreground leading-relaxed mt-4">
                            Practical, no-nonsense tips on selling faster, buying smarter, and staying safe on Australia's local marketplace.
                        </p>
                    </m.header>

                    <div className="hairline mb-8" />

                    {/* Post list — horizontal cards (image left / preview right) in a grid */}
                    <m.ul
                        {...whileInView(0.05)}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 pb-6 list-none"
                    >
                        {posts.map((post, i) => (
                            <m.li key={post.slug} {...staggerCard(i)}>
                                <BlogPostCard post={post} />
                            </m.li>
                        ))}
                    </m.ul>

                    {posts.length === 0 && (
                        <p className="text-muted-foreground py-12 text-center">No posts yet — check back soon.</p>
                    )}
                </div>
            </section>
        </>
    );
}

export default BlogIndexPage;

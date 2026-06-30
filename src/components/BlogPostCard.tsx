import { Link } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";
import { formatBlogDate, type BlogPost } from "../lib/blog";

/**
 * Horizontal post card — cover image on the left, title + preview on the right.
 * Shared by the blog index list and the "Keep reading" related-posts section so
 * the two never drift. The caller supplies any motion/stagger wrapper.
 */
export function BlogPostCard({ post }: { post: BlogPost }) {
    return (
        <Link
            to={`/blog/${post.slug}`}
            // Tag in-app blog navigation so the post's back button knows to
            // return to the blog list (vs. the home screen for external entry).
            state={{ from: "blog" }}
            className="group flex items-stretch h-full bg-card ring-1 ring-border/70 rounded-2xl overflow-hidden shadow-card hover:ring-primary/40 hover:-translate-y-0.5 transition-all"
        >
            {post.heroImage && (
                <div className="w-28 sm:w-36 md:w-40 flex-shrink-0 bg-muted/40 overflow-hidden">
                    <img
                        src={post.heroImage}
                        alt={post.heroAlt ?? post.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                </div>
            )}
            <div className="flex flex-col flex-1 min-w-0 p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-[0.08em] px-2.5 py-1">
                        {post.category}
                    </span>
                    <span className="text-xs text-muted-foreground">{post.readingTime} min read</span>
                </div>
                <h2 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-foreground leading-snug line-clamp-2">
                    {post.title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-2 flex-1">
                    {post.description}
                </p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
                    <time dateTime={post.date} className="text-xs text-muted-foreground">
                        {formatBlogDate(post.date)}
                    </time>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Read
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                </div>
            </div>
        </Link>
    );
}

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Only ever h1–h6. A narrow literal union (vs `keyof JSX.IntrinsicElements`)
// keeps `children` valid — the full union includes void elements like <br>.
type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

interface MarkdownContentProps {
    content: string;
    /**
     * Shift rendered heading levels by N (so md `#` becomes <h{1+N}>).
     * Use when the surrounding page already provides an <h1>.
     */
    headingShift?: 0 | 1 | 2;
}

export function MarkdownContent({ content, headingShift = 0 }: MarkdownContentProps) {
    const shift = headingShift;
    const HeadingTag = (level: 1 | 2 | 3): HeadingElement => {
        const target = Math.min(6, level + shift);
        return `h${target}` as HeadingElement;
    };

    return (
        <div className="text-foreground/80 text-[15px] leading-relaxed">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => {
                        const Tag = HeadingTag(1);
                        return (
                            <Tag className="font-display text-4xl sm:text-5xl font-semibold tracking-[-0.02em] leading-[1.05] text-foreground mb-6">
                                {children}
                            </Tag>
                        );
                    },
                    h2: ({ children }) => {
                        const Tag = HeadingTag(2);
                        return (
                            <Tag className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mt-12 mb-4">
                                {children}
                            </Tag>
                        );
                    },
                    h3: ({ children }) => {
                        const Tag = HeadingTag(3);
                        return (
                            <Tag className="font-display text-xl font-semibold tracking-tight text-foreground mt-8 mb-3">
                                {children}
                            </Tag>
                        );
                    },
                    p: ({ children }) => (
                        <p className="text-[15px] leading-relaxed text-foreground/80 max-w-prose mb-5">{children}</p>
                    ),
                    ul: ({ children }) => (
                        <ul className="list-disc marker:text-primary pl-5 space-y-2 mb-5 text-foreground/80 max-w-prose">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal marker:text-primary pl-5 space-y-2 mb-5 text-foreground/80 max-w-prose">{children}</ol>
                    ),
                    li: ({ children }) => (
                        <li className="text-[15px] leading-relaxed pl-1">{children}</li>
                    ),
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            className="text-primary font-medium hover:underline underline-offset-2 transition-colors"
                        >
                            {children}
                        </a>
                    ),
                    table: ({ children }) => (
                        <div className="overflow-x-auto mb-6 rounded-2xl ring-1 ring-border/70 bg-card">
                            <table className="min-w-full border-collapse">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-muted/50">{children}</thead>
                    ),
                    th: ({ children }) => (
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-4 py-3 text-foreground/80 border-b border-border/60 text-[15px]">
                            {children}
                        </td>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="bg-muted/40 ring-1 ring-border/70 rounded-2xl p-5 mb-5 text-foreground/80 italic">
                            {children}
                        </blockquote>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-semibold text-foreground">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic text-muted-foreground">{children}</em>
                    ),
                    hr: () => (
                        <hr className="my-10 border-0 h-px bg-border" />
                    ),
                    code: ({ children }) => (
                        <code className="px-1.5 py-0.5 rounded-md bg-muted/60 text-foreground text-[0.9em] font-mono">
                            {children}
                        </code>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

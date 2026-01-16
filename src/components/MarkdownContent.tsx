import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
    content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
    return (
        <div className="prose prose-neutral max-w-none text-foreground dark:prose-invert">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => (
                        <h1 className="text-2xl font-bold text-foreground border-b border-border pb-2 mb-6">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-lg font-semibold text-foreground mt-8 mb-4">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-base font-semibold text-foreground mt-6 mb-3">
                            {children}
                        </h3>
                    ),
                    p: ({ children }) => (
                        <p className="mb-4">{children}</p>
                    ),
                    ul: ({ children }) => (
                        <ul className="list-disc pl-5 space-y-1 mb-4">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal pl-5 space-y-1 mb-4">{children}</ol>
                    ),
                    table: ({ children }) => (
                        <div className="overflow-x-auto mb-6">
                            <table className="min-w-full border-collapse border border-border">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-muted/50">{children}</thead>
                    ),
                    th: ({ children }) => (
                        <th className="border border-border px-4 py-3 text-left font-semibold text-foreground">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="border border-border px-4 py-3 text-foreground/80">
                            {children}
                        </td>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="text-sm text-muted-foreground bg-muted p-4 rounded-lg border border-border mb-4 italic">
                            {children}
                        </blockquote>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic text-sm text-muted-foreground">{children}</em>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

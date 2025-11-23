import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
    content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
    return (
        <div className="prose prose-neutral max-w-none">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => (
                        <h1 className="text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2 mb-6">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-base font-semibold text-neutral-900 mt-6 mb-3">
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
                            <table className="min-w-full border-collapse border border-neutral-300">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-neutral-100">{children}</thead>
                    ),
                    th: ({ children }) => (
                        <th className="border border-neutral-300 px-4 py-3 text-left font-semibold text-neutral-900">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="border border-neutral-300 px-4 py-3">
                            {children}
                        </td>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="text-sm text-neutral-600 bg-neutral-50 p-4 rounded-lg border border-neutral-200 mb-4">
                            {children}
                        </blockquote>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic text-sm text-neutral-500">{children}</em>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

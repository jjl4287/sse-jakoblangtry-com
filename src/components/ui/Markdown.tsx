"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MarkdownProps {
  content: string;
  className?: string;
}

const Markdown: React.FC<MarkdownProps> = ({ content, className }) => {
  // If content is empty or just whitespace, return nothing
  if (!content || !content.trim()) {
    return null;
  }

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Ensure links open in new tab for security
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          // Better header styling to match preview
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold text-foreground mt-6 mb-4 first:mt-0" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-bold text-foreground mt-5 mb-3 first:mt-0" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-bold text-foreground mt-4 mb-2 first:mt-0" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-base font-bold text-foreground mt-3 mb-2 first:mt-0" {...props} />
          ),
          h5: ({ node, ...props }) => (
            <h5 className="text-sm font-bold text-foreground mt-3 mb-2 first:mt-0" {...props} />
          ),
          h6: ({ node, ...props }) => (
            <h6 className="text-sm font-bold text-foreground mt-3 mb-2 first:mt-0" {...props} />
          ),
          // Better code styling
          code: ({ node, inline, ...props }) => (
            inline ? (
              <code 
                className="px-1.5 py-0.5 text-sm bg-muted rounded font-mono border text-foreground" 
                {...props} 
              />
            ) : (
              <code className="block p-3 bg-muted rounded border font-mono text-sm text-foreground" {...props} />
            )
          ),
          // Better blockquote styling
          blockquote: ({ node, ...props }) => (
            <blockquote 
              className="border-l-4 border-border pl-4 italic text-muted-foreground my-3" 
              {...props} 
            />
          ),
          // Handle paragraphs to preserve line breaks
          p: ({ node, ...props }) => (
            <p className="whitespace-pre-wrap text-foreground mb-3 last:mb-0" {...props} />
          ),
          // Better list styling
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-6 mb-3 text-foreground" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-6 mb-3 text-foreground" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="mb-1 text-foreground" {...props} />
          ),
          // Better strong/bold styling
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-foreground" {...props} />
          ),
          // Better emphasis/italic styling
          em: ({ node, ...props }) => (
            <em className="italic text-foreground" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default Markdown; 
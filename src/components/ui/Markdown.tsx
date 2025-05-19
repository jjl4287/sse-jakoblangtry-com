"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw'; // To handle HTML in markdown

interface MarkdownProps {
  content: string;
  className?: string; // This will now apply to the wrapper div
}

const Markdown: React.FC<MarkdownProps> = ({ content, className }) => {
  return (
    <div className={`prose dark:prose-invert max-w-none ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]} // Be careful with XSS if content is user-generated and not sanitized
        components={{
          // You can customize rendering of specific elements here if needed
          // For example, to add target="_blank" to links:
          // a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default Markdown; 
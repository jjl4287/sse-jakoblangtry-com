"use client";

import React from 'react';
import { toggleNthTask, toggleTaskAtLine, getTaskLineNumbers } from '~/lib/utils/markdownTasks';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MarkdownProps {
  content: string;
  className?: string;
  // Optional: when provided, task list checkboxes (- [ ] / - [x]) become clickable and this is called with updated markdown
  onTaskToggle?: (nextMarkdown: string) => void;
}

const Markdown: React.FC<MarkdownProps> = ({ 
  content, 
  className,
  onTaskToggle
}) => {
  // If content is empty or just whitespace, return nothing
  if (!content || !content.trim()) {
    return null;
  }

  // toggling logic moved to ~/lib/utils/markdownTasks

  // Counter to identify which checkbox index we are rendering
  let taskRenderIndex = -1;

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
          code: ({ node, ...props }) => (
            (props as any).inline ? (
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
          // Better strong/bold styling
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-foreground" {...props} />
          ),
          // Better emphasis/italic styling
          em: ({ node, ...props }) => (
            <em className="italic text-foreground" {...props} />
          ),
          // Make GFM task list checkboxes interactive when onTaskToggle is provided
          input: ({ node, ...props }) => {
            const isCheckbox = (props as React.InputHTMLAttributes<HTMLInputElement>).type === 'checkbox';
            if (!isCheckbox || !onTaskToggle) {
              return <input {...props} />;
            }
            taskRenderIndex += 1;
            const indexForThisInput = taskRenderIndex; // capture stable index per element
            const checked = Boolean((props as React.InputHTMLAttributes<HTMLInputElement>).checked);
            return (
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  e.stopPropagation();
                  // Prefer line-based toggle from AST; if unavailable, map index->line based on current content
                  const nodePosition = (node as any)?.position;
                  let lineNumber: number | undefined = nodePosition?.start?.line;
                  if (!lineNumber) {
                    const lines = getTaskLineNumbers(content);
                    lineNumber = lines[indexForThisInput];
                  }
                  const next = lineNumber ? toggleTaskAtLine(content, lineNumber) : toggleNthTask(content, indexForThisInput);
                  onTaskToggle(next);
                }}
                // Prevent markdown-click from toggling focus that could cause scroll jump
                onMouseDown={(e) => e.stopPropagation()}
                // Ensure keyboard toggling works
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const nodePosition = (node as any)?.position;
                    let lineNumber: number | undefined = nodePosition?.start?.line;
                    if (!lineNumber) {
                      const lines = getTaskLineNumbers(content);
                      lineNumber = lines[indexForThisInput];
                    }
                    const next = lineNumber ? toggleTaskAtLine(content, lineNumber) : toggleNthTask(content, indexForThisInput);
                    onTaskToggle(next);
                  }
                }}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default Markdown; 
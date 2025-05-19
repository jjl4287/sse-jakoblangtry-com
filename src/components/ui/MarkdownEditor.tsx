"use client";

import MDEditor from '@uiw/react-md-editor';
import rehypeSanitize from 'rehype-sanitize'; // Recommended for security
import { useEffect, useState } from 'react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  height?: number;
  visible?: boolean; // To control visibility for lazy loading or conditional rendering
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder,
  height = 200,
  visible = true,
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !visible) {
    // Render a textarea placeholder or nothing until mounted/visible to avoid server-client mismatch
    // and to allow for lazy loading of the editor component.
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ height: `${height}px`, width: '100%' }}
        className="p-2 border rounded-md bg-background text-foreground"
      />
    );
  }

  return (
    <div data-color-mode="dark"> {/* or "light" based on your app's theme */} 
      <MDEditor
        value={value}
        onChange={onChange}
        height={height}
        previewOptions={{
          rehypePlugins: [[rehypeSanitize]], // Sanitize HTML in preview
        }}
        textareaProps={{
          placeholder: placeholder,
        }}
      />
    </div>
  );
};

export default MarkdownEditor; 
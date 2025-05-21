"use client";

import MDEditor, { commands, EditorContext } from '@uiw/react-md-editor';
import rehypeSanitize from 'rehype-sanitize'; // Recommended for security
import { useEffect, useState, useContext } from 'react';
import { cn } from '~/lib/utils'; // Assuming you have a cn utility

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  height?: number;
  visible?: boolean; // To control visibility for lazy loading or conditional rendering
  theme?: 'light' | 'dark'; // Allow passing theme
  className?: string;
}

type PreviewMode = 'edit' | 'preview';

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder,
  height = 200,
  visible = true,
  theme = 'dark', // Default to dark
  className,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<PreviewMode>('edit');
  const editorContext = useContext(EditorContext);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Define an explicit list of commands to include, excluding mode buttons and fullscreen
  const customCommands = [
    commands.bold,
    commands.italic,
    commands.strikethrough,
    commands.hr,
    commands.title,
    commands.divider,
    commands.link,
    commands.quote,
    commands.code,
    commands.codeBlock,
    commands.image,
    commands.divider,
    commands.unorderedListCommand,
    commands.orderedListCommand,
    commands.checkedListCommand,
  ];

  if (!isMounted || !visible) {
    // Render a textarea placeholder or nothing until mounted/visible to avoid server-client mismatch
    // and to allow for lazy loading of the editor component.
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ height: `${height}px`, width: '100%' }}
        className={cn(
          "p-3 border rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring text-sm",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "placeholder:text-muted-foreground",
          className
        )}
      />
    );
  }

  return (
    <div
      data-color-mode={theme}
      className={cn(
        "group w-full rounded-md border border-neutral-600 bg-transparent text-sm focus-within:border-blue-500 focus-within:ring-0",
        className
      )}
    >
      {/* Toolbar row: tabs on left, commands on right */}
      <div className="flex items-center justify-between border-b border-input">
        <div className="flex">
          <button
            type="button"
            className={cn(
              "px-3 py-1 text-sm font-medium",
              activeTab === 'edit'
                ? "border-b-2 border-blue-500 text-white bg-[#161b22]"
                : "text-gray-400 hover:text-white hover:bg-[#161b22]",
              "focus:outline-none rounded-tl-md"
            )}
            onClick={() => setActiveTab('edit')}
          >Write</button>
          <button
            type="button"
            className={cn(
              "px-3 py-1 text-sm font-medium",
              activeTab === 'preview'
                ? "border-b-2 border-blue-500 text-white bg-[#161b22]"
                : "text-gray-400 hover:text-white hover:bg-[#161b22]",
              "focus:outline-none rounded-tr-md"
            )}
            onClick={() => setActiveTab('preview')}
          >Preview</button>
        </div>
        {activeTab === 'edit' && (
          <div className="flex space-x-1">
            {customCommands.map((cmd, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                  editorContext?.execCommand(cmd);
                }}
                className="p-1 text-gray-400 hover:text-white hover:bg-[#161b22] rounded"
                title={cmd.name}
              >{cmd.icon}</button>
            ))}
          </div>
        )}
      </div>
      {/* Editor area: toolbar hidden */}
      <MDEditor
        value={value}
        onChange={onChange}
        height={height}
        preview={activeTab}
        commands={customCommands}
        extraCommands={[]}
        hideToolbar={true}
        previewOptions={{ rehypePlugins: [[rehypeSanitize]] }}
        textareaProps={{ placeholder, className: "focus:outline-none border-transparent" }}
        className={cn(
          "[&_.w-md-editor-preview]:bg-transparent [&_.w-md-editor-preview]:p-3",
          "[&_.w-md-editor-input]:p-3 [&_.w-md-editor-input]:min-h-[100px]",
          "[&_.w-md-editor-area]:border-0"
        )}
      />
    </div>
  );
};

export default MarkdownEditor; 
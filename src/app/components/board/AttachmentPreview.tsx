'use client';

import React from 'react';
import { Paperclip } from 'lucide-react';
import Image from 'next/image';

interface AttachmentPreviewProps {
  url: string;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ url }) => {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();

    // YouTube embed
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      const videoId = hostname.includes('youtube.com') 
        ? parsedUrl.searchParams.get('v')
        : parsedUrl.pathname.substring(1);
        
      if (videoId) {
        return (
          <div className="relative pt-[56.25%] w-full overflow-hidden rounded mb-2">
            <iframe 
              className="absolute top-0 left-0 w-full h-full border-0"
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube video preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        );
      }
    }

    // Image embed (common extensions)
    if (/\.(jpeg|jpg|gif|png|webp|svg)$/.exec(pathname)) {
      return (
        <div className="relative w-full h-40 mb-2 overflow-hidden rounded">
          <Image 
            src={url} 
            alt="Attachment preview" 
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
      );
    }

  } catch (error) {
    console.error("Error parsing attachment URL:", error);
    // Fall through to generic link if URL parsing fails or it's not a special type
  }

  // Generic link embed
  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex items-center text-xs text-blue-400 hover:text-blue-300 hover:underline mb-2 truncate"
      onClick={(e) => e.stopPropagation()} // Prevent card click when clicking link
    >
      <Paperclip className="w-3 h-3 mr-1 flex-shrink-0" />
      <span className="truncate">{url}</span>
    </a>
  );
}; 
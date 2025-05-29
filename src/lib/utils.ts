import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function to determine if text should be light or dark based on background color
export function getContrastingTextColor(bgColor: string | undefined | null): string {
  if (!bgColor || typeof bgColor !== 'string') {
    return '#000000'; // Default to black for invalid input
  }

  const preparedColor = bgColor.startsWith('#') ? bgColor.substring(1, 7) : bgColor;
  
  if (preparedColor.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(preparedColor)) {
    return '#000000'; // Default to black for invalid hex format
  }

  try {
    const r = parseInt(preparedColor.substring(0, 2), 16);
    const g = parseInt(preparedColor.substring(2, 4), 16);
    const b = parseInt(preparedColor.substring(4, 6), 16);

    // Formula for luminance (standard for WCAG)
    // Convert RGB to sRGB
    const srgb = [r, g, b].map(val => {
      const s = val / 255.0;
      return (s <= 0.03928) ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });

    const luminance = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];

    // Compare luminance to threshold (0.179 is a common threshold for distinguishing light/dark)
    return (luminance > 0.179) ? '#000000' : '#FFFFFF'; // Return black for light backgrounds, white for dark
  } catch (e) {
    console.error("Error calculating text color:", e);
    return '#000000'; // Default to black on error
  }
}

/**
 * Extracts markdown headers (# or ##) from text, or returns cleaned text if no headers found
 * @param text The input text that may contain markdown
 * @returns The header text if found, or cleaned text without markdown characters
 */
export function extractMarkdownHeader(text: string): string {
  if (!text) return '';
  
  // Look for # or ## headers (followed by a space)
  const headerRegex = /^(##?\s+)(.+)$/m;
  const headerMatch = headerRegex.exec(text);
  
  if (headerMatch) {
    // Return just the header text (without the # symbols)
    return headerMatch[2].trim();
  }
  
  // If no header found, remove common markdown characters and return the text
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold **text**
    .replace(/\*(.+?)\*/g, '$1') // Remove italic *text*
    .replace(/`(.+?)`/g, '$1') // Remove code `text`
    .replace(/~~(.+?)~~/g, '$1') // Remove strikethrough ~~text~~
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links [text](url) -> text
    .replace(/^[-*+]\s+/gm, '') // Remove list bullets
    .replace(/^\d+\.\s+/gm, '') // Remove numbered list
    .replace(/^>\s+/gm, '') // Remove blockquotes
    .replace(/^#{1,6}\s+/gm, '') // Remove any remaining headers
    .trim();
}

/**
 * Returns a consistent pastel class for all cards
 * Using a single, beautiful soft blue that works well for all cards
 */
export function getCardPastelClass(cardId: string): string {
  // Use a single, consistent pastel blue for all cards
  return 'pastel-blue';
}

/**
 * Returns a consistent column color class for all columns
 * Using a subtle neutral tone that doesn't compete with card colors
 */
export function getColumnColorClass(columnId: string): string {
  // Use a single, subtle column color for all columns
  return 'column-neutral';
}

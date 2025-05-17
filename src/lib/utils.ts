import { clsx, type ClassValue } from "clsx"
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

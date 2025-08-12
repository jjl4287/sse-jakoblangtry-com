// Utilities for manipulating GitHub-flavored Markdown task lists

/**
 * Toggle the checkbox state of the nth task list item in the given markdown string.
 * Task list items are lines starting with "- [ ]" or "- [x]" (asterisk also supported).
 * The index is 0-based over all task items across the whole markdown.
 */
export function toggleNthTask(markdown: string, taskIndex: number): string {
  let count = -1;
  const lines = markdown.split(/\n/);
  const taskRegex = /^(\s*[-*]\s+\[([ xX])\])/;
  const updated = lines.map((line) => {
    const match = line.match(taskRegex);
    if (!match || match[1] === undefined || match[2] === undefined) return line;
    count += 1;
    if (count !== taskIndex) return line;
    const isChecked = match[2].toLowerCase() === 'x';
    const marker = match[1];
    const flipped = isChecked
      ? marker.replace('[x]', '[ ]').replace('[X]', '[ ]')
      : marker.replace('[ ]', '[x]');
    return line.replace(marker, flipped);
  });
  return updated.join('\n');
}

/**
 * Toggle the task checkbox at the given 1-based line number if it starts with a GFM task marker.
 * If the line does not contain a task marker at the start, returns the markdown unchanged.
 */
export function toggleTaskAtLine(markdown: string, targetLineNumber: number): string {
  const lines = markdown.split(/\n/);
  const idx = Math.max(0, Math.min(lines.length - 1, targetLineNumber - 1));
  const line = lines[idx] ?? '';
  const taskRegex = /^(\s*[-*]\s+\[([ xX])\])/;
  const match = line.match(taskRegex);
  if (!match || match[1] === undefined || match[2] === undefined) {
    return markdown;
  }
  const isChecked = match[2].toLowerCase() === 'x';
  const marker = match[1];
  const flipped = isChecked
    ? marker.replace('[x]', '[ ]').replace('[X]', '[ ]')
    : marker.replace('[ ]', '[x]');
  lines[idx] = line.replace(marker, flipped);
  return lines.join('\n');
}

/**
 * Return the 1-based line numbers for each GFM task found in the markdown, in render order.
 */
export function getTaskLineNumbers(markdown: string): number[] {
  const result: number[] = [];
  const taskRegex = /^(\s*[-*]\s+\[[ xX]\])/;
  const lines = markdown.split(/\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (taskRegex.test(lines[i])) {
      result.push(i + 1);
    }
  }
  return result;
}



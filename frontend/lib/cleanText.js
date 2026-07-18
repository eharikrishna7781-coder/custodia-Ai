export function cleanMarkdownFromText(text) {
  if (!text) return text;
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold markdown but keep content
    .replace(/\*(.+?)\*/g, '$1')     // Remove italic markdown but keep content
    .replace(/^[-•]\s+/gm, '')       // Remove bullet points at line start
    .replace(/^• /gm, '')             // Remove bullet symbol at line start
    .replace(/__(.+?)__/g, '$1')      // Remove underline markdown but keep content
    .replace(/`(.+?)`/g, '$1')        // Remove code markdown but keep content
    .replace(/~~(.+?)~~/g, '$1')      // Remove strikethrough but keep content
    .replace(/^#+\s+/gm, '')          // Remove heading symbols at line start
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links but keep text
    .trim();
}

const DOC_CONTENT_SEPARATOR = "\n\n";

export function buildStoredDocMarkdown(title: string, content: string) {
  const normalizedTitle = title.trim() || "Document";
  const normalizedContent = content.trim();

  return normalizedContent
    ? `# ${normalizedTitle}${DOC_CONTENT_SEPARATOR}${normalizedContent}\n`
    : `# ${normalizedTitle}\n`;
}

export function parseStoredDocMarkdown(markdown: string, fallbackTitle: string) {
  const normalizedFallbackTitle = fallbackTitle.trim() || "Document";
  const normalizedMarkdown = markdown.replace(/\r\n/g, "\n").trim();

  if (!normalizedMarkdown) {
    return {
      title: normalizedFallbackTitle,
      content: "",
    };
  }

  const headingMatch = normalizedMarkdown.match(/^#\s+(.+)$/m);
  if (!headingMatch) {
    return {
      title: normalizedFallbackTitle,
      content: normalizedMarkdown,
    };
  }

  const title = headingMatch[1].trim() || normalizedFallbackTitle;
  const content = normalizedMarkdown
    .slice(headingMatch.index! + headingMatch[0].length)
    .replace(/^\n+/, "")
    .trim();

  return {
    title,
    content,
  };
}

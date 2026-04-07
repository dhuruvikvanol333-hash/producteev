export function linkifyHtmlText(html: string): string {
  if (!html || typeof window === 'undefined') return html;

  const div = document.createElement('div');
  div.innerHTML = html;

  const processNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentNode as HTMLElement;
      if (parent && parent.tagName !== 'A' && parent.tagName !== 'PRE' && parent.tagName !== 'CODE') {
        const text = node.textContent || '';
        // Basic URL matching regex
        const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
        if (urlRegex.test(text)) {
          const newHtml = text.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-indigo-500 hover:text-indigo-600 hover:underline cursor-pointer transition-colors" onclick="event.stopPropagation()">${url}</a>`;
          });
          const span = document.createElement('span');
          span.innerHTML = newHtml;
          parent.replaceChild(span, node);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName !== 'A' && el.tagName !== 'PRE' && el.tagName !== 'CODE') {
        const children = Array.from(el.childNodes);
        children.forEach(processNode);
      }
    }
  };

  const children = Array.from(div.childNodes);
  children.forEach(processNode);

  // Unwrap the root spans that we created so we don't end up with heavily nested spans over time
  // Wait, replacing node with a span works but it's simpler to just return div.innerHTML
  return div.innerHTML;
}

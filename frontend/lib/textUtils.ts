/**
 * Helper to unescape HTML entities (e.g. &#x27;, &quot;, &amp;)
 * so text rendered in React components displays plain characters correctly.
 */
export function decodeHtmlEntities(text: any): string {
    if (text === null || text === undefined) return '';
    const str = typeof text === 'string' ? text : String(text);
    return str
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

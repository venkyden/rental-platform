/**
 * Sanitise a redirect path before navigation.
 * Only same-origin relative paths are accepted. External URLs
 * (https://evil.com), protocol-relative URLs (//evil.com), and any
 * value carrying a protocol (javascript:, data:) are rejected and the
 * fallback is returned instead — preventing open-redirect attacks via
 * an API-supplied or query-string redirect target.
 */
export function safeRedirectPath(path: unknown, fallback = '/dashboard'): string {
    if (typeof path !== 'string' || !path) return fallback;
    let value = path;
    try {
        value = decodeURIComponent(path);
    } catch {
        return fallback;
    }
    // Browsers normalise "\" to "/" (WHATWG URL), so "/\evil.com" resolves to
    // "//evil.com" — reject before the leading-slash check to close that bypass.
    if (value.includes('\\')) return fallback;
    // Must start with a single / and not //
    if (!value.startsWith('/') || value.startsWith('//')) return fallback;
    // Must not contain a protocol (e.g. http:, javascript:)
    if (/^[a-z][a-z\d+\-.]*:/i.test(value.slice(1))) return fallback;
    return value;
}

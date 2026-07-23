/**
 * Resolve a media URL so it always points to the correct origin.
 *
 * - Full URLs (https://...) are returned as-is (cloud storage).
 * - Relative paths (/uploads/...) are prefixed with the API base URL
 *   so they resolve against the backend, not the frontend.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function resolveMediaUrl(input: any): string {
    if (!input) return '';
    
    let url: string = '';
    if (typeof input === 'string') {
        url = input;
    } else if (typeof input === 'object' && input !== null) {
        url = input.url || input.file_url || input.media_url || input.path || input.src || '';
    }

    if (!url || typeof url !== 'string') return '';
    
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }
    
    // Relative path — prefix with API origin
    return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}


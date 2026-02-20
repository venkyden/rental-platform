import { authenticatedFetch } from './fetch';

export const mediaApi = {
    upload: async (file: File, folder: 'inventory' | 'disputes' | 'general' = 'general'): Promise<string> => {
        const formData = new FormData();
        formData.append('file', file);

        // We cannot use authenticatedFetch easily if it forces Content-Type json
        // So we use raw fetch with the token logic (duplicated specifically for upload)
        // In a real app, authenticatedFetch should handle this better.

        const token = "demo_token"; // Mock

        // Note: Do NOT set Content-Type header when sending FormData, browser does it with boundary
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/media/upload?folder=${folder}`, {
            method: 'POST',
            headers: {
                // 'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        const data = await response.json();
        return data.url;
    }
};

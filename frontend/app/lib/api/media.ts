import { apiClient } from '@/lib/api';

export const mediaApi = {
    upload: async (file: File | Blob, folder: string = 'general'): Promise<string> => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await apiClient.client.post(`/media/upload`, formData, {
            params: { folder },
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        
        return response.data.url;
    }
};

import { apiClient } from '@/lib/api';

export const mediaApi = {
    upload: async (file: File | Blob, folder: string = 'general'): Promise<string> => {
        const formData = new FormData();
        const f = file as File;
        const isVideo = (f.type && f.type.startsWith('video')) || (f.name && /\.(mp4|mov|webm|avi|m4v|3gp)$/i.test(f.name));
        const filename = f.name && f.name !== 'blob' ? f.name : (isVideo ? 'video.mp4' : 'photo.jpg');
        formData.append('file', file, filename);
        formData.append('folder', folder);
        
        const response = await apiClient.client.post(`/media/upload`, formData, {
            params: { folder },
        });
        
        return response.data.url;
    }
};

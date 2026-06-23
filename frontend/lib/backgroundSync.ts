import { offlineQueue } from './offlineQueue';
import { apiClient } from './api';

class BackgroundSyncManager {
    private isSyncing = false;
    private timerId: NodeJS.Timeout | null = null;
    private listeners: ((pendingCount: number) => void)[] = [];

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.sync());
            // Attempt to sync periodically if online (every 15 seconds)
            this.timerId = setInterval(() => {
                if (navigator.onLine) {
                    this.sync();
                }
            }, 15000);
            
            // Sync on startup
            setTimeout(() => this.sync(), 2000);
        }
    }

    subscribe(callback: (pendingCount: number) => void) {
        this.listeners.push(callback);
        this.notifyListeners(); // Immediate update on subscribe
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    async notifyListeners() {
        const count = await offlineQueue.count();
        this.listeners.forEach(l => l(count));
    }

    async enqueueAndSync(file: Blob, metadata: string, code: string, mediaType: 'photo' | 'video') {
        await offlineQueue.addToQueue(file, metadata, code, mediaType);
        await this.notifyListeners();
        // Fire and forget sync attempt
        this.sync().catch(console.error);
    }

    async sync() {
        if (this.isSyncing || typeof window === 'undefined' || !navigator.onLine) return;
        this.isSyncing = true;
        try {
            const queue = await offlineQueue.getQueue();
            if (queue.length === 0) return;

            let synced = 0;
            for (const item of queue) {
                try {
                    await apiClient.uploadPropertyMedia(item.file as File, item.metadata, item.code);
                    if (item.id !== undefined) await offlineQueue.removeFromQueue(item.id);
                    synced++;
                } catch (e: any) {
                    // Ignore 404s for expired verification codes or 400s to avoid stuck items? 
                    // Let's drop them if they are permanently rejected (e.g., 400/404)
                    const status = e?.response?.status;
                    if (status === 400 || status === 404) {
                         if (item.id !== undefined) await offlineQueue.removeFromQueue(item.id);
                    }
                    console.error('Failed to sync item', item.id, e);
                }
            }
            if (synced > 0) {
                console.log(`BackgroundSyncManager: Synced ${synced} items`);
            }
        } finally {
            this.isSyncing = false;
            await this.notifyListeners();
        }
    }
}

export const backgroundSyncManager = new BackgroundSyncManager();

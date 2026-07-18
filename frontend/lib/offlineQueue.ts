import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineUpload {
    id?: number;
    file: Blob; // Works for both File (photo) and Blob (video)
    metadata: string; // JSON string
    code: string; // Verification code
    mediaType: 'photo' | 'video';
    createdAt: number;
}

interface RentalDB extends DBSchema {
    offlineUploads: {
        key: number;
        value: OfflineUpload;
        indexes: { 'by-date': number };
    };
}

const DB_NAME = 'rental-platform-db';
const STORE_NAME = 'offlineUploads';

export class OfflineQueue {
    private dbPromise: Promise<IDBPDatabase<RentalDB>> | null = null;
    /** True when IndexedDB is confirmed unavailable (e.g. mobile private browsing). */
    public readonly unavailable: boolean;

    constructor() {
        try {
            // Probe IndexedDB synchronously — some mobile browsers (Safari private)
            // throw or return null on indexedDB access itself.
            if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
                this.unavailable = true;
                return;
            }
            this.unavailable = false;
            this.dbPromise = openDB<RentalDB>(DB_NAME, 1, {
                upgrade(db) {
                    const store = db.createObjectStore(STORE_NAME, {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                    store.createIndex('by-date', 'createdAt');
                },
            });
            // Swallow the rejection so an unhandled-promise-rejection doesn't crash the page.
            // Individual methods will surface the error to their own callers.
            this.dbPromise.catch(() => {});
        } catch {
            this.unavailable = true;
            this.dbPromise = null;
        }
    }

    private async getDb(): Promise<IDBPDatabase<RentalDB> | null> {
        if (!this.dbPromise) return null;
        try {
            return await this.dbPromise;
        } catch {
            return null;
        }
    }

    async addToQueue(file: Blob, metadata: string, code: string, mediaType: 'photo' | 'video') {
        const db = await this.getDb();
        if (!db) return; // silently skip — offline queueing is best-effort
        await db.add(STORE_NAME, {
            file,
            metadata,
            code,
            mediaType,
            createdAt: Date.now(),
        });
    }

    async getQueue(): Promise<OfflineUpload[]> {
        const db = await this.getDb();
        if (!db) return [];
        return db.getAllFromIndex(STORE_NAME, 'by-date');
    }

    async removeFromQueue(id: number) {
        const db = await this.getDb();
        if (!db) return;
        await db.delete(STORE_NAME, id);
    }

    async count(): Promise<number> {
        const db = await this.getDb();
        if (!db) return 0;
        return db.count(STORE_NAME);
    }
}

export const offlineQueue = new OfflineQueue();

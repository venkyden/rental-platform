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
    private dbPromise: Promise<IDBPDatabase<RentalDB>>;

    constructor() {
        this.dbPromise = openDB<RentalDB>(DB_NAME, 1, {
            upgrade(db) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                store.createIndex('by-date', 'createdAt');
            },
        });
    }

    async addToQueue(file: Blob, metadata: string, code: string, mediaType: 'photo' | 'video') {
        const db = await this.dbPromise;
        await db.add(STORE_NAME, {
            file,
            metadata,
            code,
            mediaType,
            createdAt: Date.now(),
        });
    }

    async getQueue(): Promise<OfflineUpload[]> {
        const db = await this.dbPromise;
        return db.getAllFromIndex(STORE_NAME, 'by-date');
    }

    async removeFromQueue(id: number) {
        const db = await this.dbPromise;
        await db.delete(STORE_NAME, id);
    }

    async count(): Promise<number> {
        const db = await this.dbPromise;
        return db.count(STORE_NAME);
    }
}

export const offlineQueue = new OfflineQueue();

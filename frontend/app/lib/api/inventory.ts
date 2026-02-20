import { authenticatedFetch } from './fetch';

export interface InventoryItem {
    id?: string;
    name: string;
    category: string;
    condition: 'new' | 'good' | 'fair' | 'poor' | 'damaged' | 'missing';
    photos: string[];
    notes?: string;
}

export interface Inventory {
    id: string;
    lease_id: string;
    type: 'move_in' | 'move_out' | 'interim';
    status: 'draft' | 'pending_tenant_sign' | 'pending_landlord_sign' | 'completed' | 'contested';
    date: string;
    items: InventoryItem[];
    property_location?: {
        lat: number;
        lng: number;
    };
    signature_tenant?: any;
    signature_landlord?: any;
}

export const inventoryApi = {
    create: async (leaseId: string, type: string) => {
        return authenticatedFetch<Inventory>('/api/v1/inventory/', {
            method: 'POST',
            body: JSON.stringify({ lease_id: leaseId, type }),
        });
    },

    get: async (id: string) => {
        return authenticatedFetch<Inventory>(`/api/v1/inventory/${id}`);
    },

    addItems: async (id: string, items: InventoryItem[]) => {
        return authenticatedFetch<Inventory>(`/api/v1/inventory/${id}/items`, {
            method: 'POST',
            body: JSON.stringify(items),
        });
    },

    sign: async (id: string, signatures: { signature_tenant?: any, signature_landlord?: any }) => {
        return authenticatedFetch<Inventory>(`/api/v1/inventory/${id}/sign`, {
            method: 'POST',
            body: JSON.stringify(signatures),
        });
    }
};

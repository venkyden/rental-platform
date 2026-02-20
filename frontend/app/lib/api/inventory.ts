import { apiClient } from '@/lib/api';

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
    create: async (leaseId: string, type: string): Promise<Inventory> => {
        const response = await apiClient.client.post('/inventory/', { lease_id: leaseId, type });
        return response.data;
    },

    get: async (id: string): Promise<Inventory> => {
        const response = await apiClient.client.get(`/inventory/${id}`);
        return response.data;
    },

    addItems: async (id: string, items: InventoryItem[]): Promise<Inventory> => {
        const response = await apiClient.client.post(`/inventory/${id}/items`, items);
        return response.data;
    },

    sign: async (id: string, signatures: { signature_tenant?: any; signature_landlord?: any }): Promise<Inventory> => {
        const response = await apiClient.client.post(`/inventory/${id}/sign`, signatures);
        return response.data;
    }
};

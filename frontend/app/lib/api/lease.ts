import { apiClient } from '@/lib/api';

export interface Lease {
    id: string;
    property_id: string;
    tenant_id: string;
    status: string;
    start_date?: string;
    rent_amount?: number;
    deposit_amount?: number;
    charges_amount?: number;
    lease_type?: string;
    created_at?: string;
    property_location?: {
        lat: number;
        lng: number;
    };
}

export const leaseApi = {
    get: async (id: string): Promise<Lease> => {
        const response = await apiClient.client.get(`/leases/${id}`);
        return response.data;
    },
    list: async (propertyId?: string): Promise<Lease[]> => {
        const params = propertyId ? { property_id: propertyId } : {};
        const response = await apiClient.client.get('/leases/', { params });
        return response.data;
    }
};

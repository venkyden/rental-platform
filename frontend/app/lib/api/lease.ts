import { authenticatedFetch } from './fetch';

export interface Lease {
    id: string;
    property_id: string;
    tenant_id: string;
    status: string;
    start_date: string;
    monthly_rent: number;
    property_location?: {
        lat: number;
        lng: number;
    };
}

export const leaseApi = {
    get: async (id: string): Promise<Lease> => {
        return authenticatedFetch(`/api/v1/leases/${id}`);
    },

    // Additional methods can be added as needed
    list: async (): Promise<Lease[]> => {
        return authenticatedFetch('/api/v1/leases/');
    }
};

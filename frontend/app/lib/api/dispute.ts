import { apiClient } from '@/lib/api';

export type DisputeCategory = 'damage' | 'appliance_failure' | 'shared_liability' | 'cleaning' | 'other';

export interface DisputeCreate {
    lease_id: string;
    category: DisputeCategory;
    title: string;
    description: string;
    inventory_id?: string;
    accused_id?: string;
    amount_claimed?: number;
}

export interface Dispute {
    id: string;
    lease_id: string;
    category: DisputeCategory;
    title: string;
    description: string;
    status: string;
    created_at: string;
}

export const disputeApi = {
    create: async (data: DisputeCreate): Promise<Dispute> => {
        const response = await apiClient.client.post('/disputes/', data);
        return response.data;
    },

    listMyDisputes: async (): Promise<Dispute[]> => {
        const response = await apiClient.client.get('/disputes/');
        return response.data;
    }
};

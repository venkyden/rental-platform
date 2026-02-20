import { authenticatedFetch } from './fetch';

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
    create: async (data: DisputeCreate) => {
        return authenticatedFetch<Dispute>('/api/v1/disputes/', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    listMyDisputes: async () => {
        return authenticatedFetch<Dispute[]>('/api/v1/disputes/');
    }
};

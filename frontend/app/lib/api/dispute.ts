import { apiClient } from '@/lib/api';

export type DisputeCategory = 'damage' | 'appliance_failure' | 'shared_liability' | 'cleaning' | 'other';
export type DisputeStatus = 'open' | 'awaiting_response' | 'under_review' | 'closed';

export interface DisputeCreate {
    lease_id: string;
    category: DisputeCategory;
    title: string;
    description: string;
    evidence_urls?: string[];
    inventory_id?: string;
    accused_id?: string;
    amount_claimed?: number;
    location_verified?: string;
    report_distance_meters?: number;
}

export interface DisputeRespond {
    response_description: string;
    response_evidence_urls?: string[];
}

export interface Dispute {
    id: string;
    lease_id: string;
    raised_by_id: string;
    accused_id?: string;
    category: DisputeCategory;
    status: DisputeStatus;
    title: string;
    description: string;
    evidence_urls: string[];
    response_description?: string;
    response_evidence_urls: string[];
    responded_at?: string;
    amount_claimed?: number;
    admin_observations?: string;
    mediation_redirect_url?: string;
    mediation_redirected_at?: string;
    location_verified?: string;
    report_distance_meters?: number;
    created_at: string;
    updated_at?: string;
    closed_at?: string;
}

export const disputeApi = {
    create: async (data: DisputeCreate): Promise<Dispute> => {
        const response = await apiClient.client.post('/disputes/', data);
        return response.data;
    },

    getDetail: async (id: string): Promise<Dispute> => {
        const response = await apiClient.client.get(`/disputes/${id}`);
        return response.data;
    },

    listMyDisputes: async (): Promise<Dispute[]> => {
        const response = await apiClient.client.get('/disputes/');
        return response.data;
    },

    getByLease: async (leaseId: string): Promise<Dispute[]> => {
        const response = await apiClient.client.get(`/disputes/by-lease/${leaseId}`);
        return response.data;
    },

    addEvidence: async (id: string, evidenceUrls: string[]): Promise<Dispute> => {
        const response = await apiClient.client.post(`/disputes/${id}/evidence`, { evidence_urls: evidenceUrls });
        return response.data;
    },

    respond: async (id: string, data: DisputeRespond): Promise<Dispute> => {
        const response = await apiClient.client.post(`/disputes/${id}/respond`, data);
        return response.data;
    },

    // Admin updates (only if needed by frontend admin panel components using this client)
    adminUpdate: async (id: string, data: { admin_observations?: string, status?: DisputeStatus, mediation_redirect_url?: string, close?: boolean }): Promise<Dispute> => {
        const response = await apiClient.client.put(`/disputes/${id}/admin-update`, data);
        return response.data;
    }
};

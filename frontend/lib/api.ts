import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
    public client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: API_URL,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Add request interceptor to attach token
        this.client.interceptors.request.use(
            (config) => {
                const token = this.getToken();
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            (error: AxiosError) => {
                if (error.response?.status === 401) {
                    // Token expired or invalid
                    this.clearToken();
                    if (typeof window !== 'undefined') {
                        window.location.href = '/auth/login';
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    // Token management
    private getToken(): string | null {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('access_token');
        }
        return null;
    }

    setToken(token: string): void {
        if (typeof window !== 'undefined') {
            localStorage.setItem('access_token', token);
        }
    }

    clearToken(): void {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
        }
    }

    // Auth endpoints
    async register(data: {
        email: string;
        password: string;
        full_name: string;
        role: 'tenant' | 'landlord' | 'property_manager';
        marketing_consent?: boolean;
    }) {
        const response = await this.client.post('/auth/register', data);
        return response.data;
    }

    async login(email: string, password: string) {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const response = await this.client.post('/auth/login', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        if (response.data.access_token) {
            this.setToken(response.data.access_token);
        }

        return response.data;
    }

    async getMe() {
        const response = await this.client.get('/auth/me');
        return response.data;
    }

    async googleLogin(credential: string, role?: string) {
        const response = await this.client.post('/auth/google', {
            credential,
            role,
        });

        if (response.data.access_token) {
            this.setToken(response.data.access_token);
        }

        return response.data;
    }

    async forgotPassword(email: string) {
        const response = await this.client.post('/auth/forgot-password', { email });
        return response.data;
    }

    async resetPassword(token: string, new_password: string) {
        const response = await this.client.post('/auth/reset-password', {
            token,
            new_password,
        });
        return response.data;
    }

    async resendVerification() {
        const response = await this.client.post('/auth/resend-verification');
        return response.data;
    }

    logout(): void {
        this.clearToken();
        if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
        }
    }

    // Health check
    async healthCheck() {
        const response = await this.client.get('/health');
        return response.data;
    }

    // Property media upload
    async uploadPropertyMedia(file: File, metadata: Record<string, any> | string, verificationCode: string) {
        const formData = new FormData();
        formData.append('file', file);

        const metadataStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);

        const response = await this.client.post('/properties/media/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            params: {
                metadata: metadataStr,
                verification_code: verificationCode,
            },
        });
        return response.data;
    }
}

export const apiClient = new ApiClient();

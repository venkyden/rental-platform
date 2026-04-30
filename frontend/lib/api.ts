import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
    public client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: API_URL,
            withCredentials: true,
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
            async (error: AxiosError) => {
                const originalRequest = error.config as any;

                // If the error is 401 and we haven't retried yet
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    try {
                        // Attempt to refresh the token using the HttpOnly cookie
                        const refreshResponse = await axios.post(
                            `${API_URL}/auth/refresh`,
                            {},
                            { withCredentials: true }
                        );

                        const newAccessToken = refreshResponse.data.access_token;
                        if (newAccessToken) {
                            this.setToken(newAccessToken);
                            // Retry the original request with the new token
                            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                            return this.client(originalRequest);
                        }
                    } catch (refreshError) {
                        // Refresh token failed or expired
                        this.clearToken();
                        if (typeof window !== 'undefined' && window.location.pathname !== '/auth/login') {
                            window.location.href = '/auth/login?expired=1';
                        }
                        return Promise.reject(refreshError);
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
        phone?: string;
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

    async logout(): Promise<void> {
        this.clearToken();
        try {
            await this.client.post('/auth/logout');
        } catch (e) {
            console.error('Logout error', e);
        }
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

    async updateOnboardingPreferences(responses: Record<string, any>) {
        const response = await this.client.put('/onboarding/preferences', { responses });
        return response.data;
    }
}

export const apiClient = new ApiClient();

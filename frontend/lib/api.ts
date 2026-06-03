import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// Access token lives in module memory only — never in localStorage/sessionStorage.
// XSS cannot read it; the httpOnly refresh cookie is the durable session credential.
let _accessToken: string | null = null;

class ApiClient {
    public client: AxiosInstance;
    // Single-flight refresh: concurrent 401s share ONE /auth/refresh call.
    // The backend rotates the refresh token and bumps refresh_token_version on
    // each refresh, so parallel refreshes would invalidate each other and log
    // the user out across tabs/requests. This promise serialises them.
    private refreshPromise: Promise<string | null> | null = null;

    refreshAccessToken(): Promise<string | null> {
        if (!this.refreshPromise) {
            this.refreshPromise = axios
                .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true, timeout: 10000 })
                .then((res) => {
                    const newAccessToken = res.data?.access_token ?? null;
                    if (newAccessToken) this.setToken(newAccessToken);
                    return newAccessToken;
                })
                .finally(() => {
                    this.refreshPromise = null;
                });
        }
        return this.refreshPromise;
    }

    constructor() {
        this.client = axios.create({
            baseURL: API_URL,
            withCredentials: true,
            headers: {
                'Content-Type': 'application/json',
            },
            paramsSerializer: (params) => {
                const searchParams = new URLSearchParams();
                for (const key in params) {
                    const value = params[key];
                    if (value === undefined || value === null) continue;
                    
                    if (Array.isArray(value)) {
                        value.forEach(item => searchParams.append(key, item));
                    } else {
                        searchParams.append(key, value.toString());
                    }
                }
                return searchParams.toString();
            }
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
                const requestUrl = originalRequest?.url || '';
                const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/auth/login';
                const isPublicPage = typeof window !== 'undefined' && (
                    window.location.pathname === '/search' || 
                    window.location.pathname === '/' || 
                    window.location.pathname.startsWith('/properties/')
                );
                const isAuthRequest = typeof requestUrl === 'string' && (
                    requestUrl.includes('/auth/login') || 
                    requestUrl.includes('/auth/refresh') || 
                    requestUrl.includes('/auth/google') || 
                    requestUrl.includes('/auth/register')
                );
                const authHeader = originalRequest?.headers?.Authorization || originalRequest?.headers?.authorization;
                const hasAuthHeader = !!authHeader;

                // If the error is 401 and we haven't retried yet
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    // If this is an authentication request, do not attempt to refresh
                    if (isAuthRequest) {
                        return Promise.reject(error);
                    }

                    // If the request did not send an Authorization header, bypass refresh and clearing logic
                    if (!hasAuthHeader) {
                        return Promise.reject(error);
                    }

                    // If we're already on the login page, don't try to refresh or redirect
                    if (isLoginPage) {
                        this.clearToken();
                        return Promise.reject(error);
                    }

                    try {
                        // Attempt to refresh via the httpOnly cookie. Concurrent
                        // 401s coalesce into one refresh (see refreshAccessToken).
                        const newAccessToken = await this.refreshAccessToken();
                        if (newAccessToken) {
                            // Retry the original request with the new token
                            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                            return this.client(originalRequest);
                        }
                    } catch (refreshError) {
                        // Refresh token failed or expired
                        this.clearToken();

                        // If it's a public page, just retry the request WITHOUT the auth header
                        if (isPublicPage) {
                            delete originalRequest.headers.Authorization;
                            return this.client(originalRequest);
                        }

                        // Otherwise let ProtectedRoute handle the unauthenticated state.
                        return Promise.reject(refreshError);
                    }
                }

                return Promise.reject(error);
            }
        );
    }

    // Token management — in-memory only (no localStorage/sessionStorage)
    getToken(): string | null {
        return _accessToken;
    }

    setToken(token: string): void {
        _accessToken = token;
    }

    clearToken(): void {
        _accessToken = null;
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

    async switchRole(targetRole: string) {
        const response = await this.client.post('/auth/switch-role', {
            role: targetRole,
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
            params: {
                metadata: metadataStr,
                verification_code: verificationCode,
            },
        });
        return response.data;
    }

    // Generic media upload
    async uploadMedia(file: File, folder: string = 'general') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        const response = await this.client.post('/media/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    }

    async updateOnboardingPreferences(responses: Record<string, any>) {
        const response = await this.client.put('/onboarding/preferences', { responses });
        return response.data;
    }

    async getProperties(params: Record<string, any> = {}) {
        const response = await this.client.get('/properties', { params });
        return response.data;
    }

    async saveProperty(propertyId: string) {
        const response = await this.client.post(`/properties/${propertyId}/save`);
        return response.data;
    }

    async unsaveProperty(propertyId: string) {
        const response = await this.client.delete(`/properties/${propertyId}/save`);
        return response.data;
    }

    async getSavedProperties(params: Record<string, any> = {}) {
        const response = await this.client.get('/properties/wishlist', { params });
        return response.data;
    }
}

export const apiClient = new ApiClient();

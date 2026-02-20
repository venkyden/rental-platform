// import { getSession } from 'next-auth/react';

export async function authenticatedFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
    // In a real app, retrieve token from session/cookie
    // const session = await getSession();
    const token = "demo_token"; // Mock for MVP

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
        // 'Authorization': `Bearer ${token}`, // Enable when Auth is live
    };

    const response = await fetch(process.env.NEXT_PUBLIC_API_URL + url, {
        ...options,
        headers,
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
}

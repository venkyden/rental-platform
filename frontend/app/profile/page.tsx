'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/useAuth';

export default function ProfilePage() {
    const router = useRouter();
    const { user, logout } = useAuth();

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-4 px-4 flex items-center gap-4">
                        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">← Back</button>
                        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                    </div>
                </header>
                <main className="max-w-md mx-auto py-8 px-4">
                    <div className="bg-white rounded-xl shadow p-6 mb-6">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl">👤</div>
                            <div>
                                <h2 className="font-bold text-lg">{user?.full_name}</h2>
                                <p className="text-gray-500">{user?.email}</p>
                            </div>
                        </div>

                        <div className="border-t pt-6 mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-gray-900">Rental Preferences</h3>
                                <Link href="/profile/preferences" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                                    Edit
                                </Link>
                            </div>
                            {user?.preferences && Object.keys(user.preferences).length > 0 ? (
                                <div className="space-y-3 text-sm">
                                    {user.role === 'tenant' ? (
                                        <>
                                            <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-gray-500">Location</span><span className="font-medium text-gray-900">{user.preferences.location_preference?.address || user.preferences.location_preference || 'Any'}</span></div>
                                            <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-gray-500">Max Budget</span><span className="font-medium text-gray-900">{user.preferences.budget ? `€${user.preferences.budget}` : 'Any'}</span></div>
                                            <div className="flex justify-between pb-2"><span className="text-gray-500">Min Surface</span><span className="font-medium text-gray-900">{user.preferences.min_surface_area ? `${user.preferences.min_surface_area} m²` : 'Any'}</span></div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-gray-500">Location</span><span className="font-medium text-gray-900">{user.preferences.location?.name || user.preferences.location || 'Any'}</span></div>
                                            <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-gray-500">Urgency</span><span className="font-medium capitalize text-gray-900">{user.preferences.urgency || 'Any'}</span></div>
                                            <div className="flex justify-between pb-2"><span className="text-gray-500">Target Tenant</span><span className="font-medium capitalize text-gray-900">{(user.preferences.accepted_tenant_types || []).join(', ').replace(/_/g, ' ') || 'Any'}</span></div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm">No preferences set yet. <Link href="/profile/preferences" className="text-teal-600 hover:underline">Set them now</Link></p>
                            )}
                        </div>

                        <div className="space-y-4">
                            <Link href="/settings/account" className="block w-full text-left p-3 hover:bg-gray-50 rounded border transition-colors">⚙️ Account Settings</Link>
                            <Link href="/settings/notifications" className="block w-full text-left p-3 hover:bg-gray-50 rounded border transition-colors">🔔 Notifications</Link>
                            <Link href="/settings/privacy" className="block w-full text-left p-3 hover:bg-gray-50 rounded border transition-colors">
                                🛡️ Privacy (GDPR)
                            </Link>
                        </div>
                    </div>

                    <button onClick={logout} className="w-full py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 font-medium">
                        Logout
                    </button>
                </main>
            </div>
        </ProtectedRoute>
    );
}

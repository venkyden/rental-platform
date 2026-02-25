'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface TeamMember {
    id: string;
    email: string;
    name: string | null;
    permission_level: string;
    status: string;
    property_count: number;
    created_at: string;
    accepted_at: string | null;
}

interface Property {
    id: string;
    title: string;
}

const PERMISSION_LABELS: Record<string, { label: string; description: string; color: string }> = {
    view_only: {
        label: 'View Only',
        description: 'View properties and messages',
        color: 'bg-gray-100 text-gray-700'
    },
    manage_visits: {
        label: 'Manage Visits',
        description: '+ Create time slots, respond to messages',
        color: 'bg-blue-100 text-blue-700'
    },
    full_access: {
        label: 'Full Access',
        description: '+ Edit properties, generate leases',
        color: 'bg-green-100 text-green-700'
    }
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
    active: { label: 'Active', color: 'bg-green-100 text-green-700' },
    revoked: { label: 'Revoked', color: 'bg-red-100 text-red-700' },
    expired: { label: 'Expired', color: 'bg-gray-100 text-gray-700' }
};

export default function TeamManager() {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteLink, setInviteLink] = useState<string | null>(null);

    // Invite form state
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [invitePermission, setInvitePermission] = useState('view_only');
    const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [membersRes, propsRes] = await Promise.all([
                apiClient.client.get('/team/members'),
                apiClient.client.get('/properties')
            ]);
            setMembers(membersRes.data);
            setProperties(propsRes.data);
        } catch (error) {
            console.error('Error loading team data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async () => {
        if (!inviteEmail || !inviteName) return;

        setInviting(true);
        try {
            const response = await apiClient.client.post('/team/members', {
                email: inviteEmail,
                name: inviteName,
                permission_level: invitePermission,
                property_ids: selectedProperties
            });

            setInviteLink(window.location.origin + response.data.invite_link);
            loadData();

            // Reset form
            setInviteEmail('');
            setInviteName('');
            setInvitePermission('view_only');
            setSelectedProperties([]);
        } catch (error: any) {
            alert(error.response?.data?.detail || 'Error sending invitation');
        } finally {
            setInviting(false);
        }
    };

    const handleRevoke = async (memberId: string) => {
        if (!confirm('Are you sure you want to revoke this access?')) return;

        try {
            await apiClient.client.delete(`/team/members/${memberId}`);
            loadData();
        } catch (error) {
            console.error('Error revoking access:', error);
        }
    };

    const copyInviteLink = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink);
            alert('Link copied!');
        }
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-gray-200 rounded-lg" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Team</h2>
                    <p className="text-gray-600">
                        Invite collaborators to manage your properties
                    </p>
                </div>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                >
                    ➕ Invite a Member
                </button>
            </div>

            {/* Team Members List */}
            {members.length === 0 ? (
                <div className="bg-white rounded-xl shadow-md p-8 text-center">
                    <span className="text-5xl mb-4 block">👥</span>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No members on your team
                    </h3>
                    <p className="text-gray-500 mb-4">
                        Invite collaborators to help you manage your properties
                    </p>
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Invite a Member
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Member</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Permission</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Properties</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {members.map(member => (
                                <tr key={member.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold">
                                                {(member.name || member.email).charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">
                                                    {member.name || 'Not set'}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {member.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${PERMISSION_LABELS[member.permission_level]?.color || 'bg-gray-100'}`}>
                                            {PERMISSION_LABELS[member.permission_level]?.label || member.permission_level}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-600">
                                        {member.property_count} {member.property_count !== 1 ? 'properties' : 'property'}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_LABELS[member.status]?.color || 'bg-gray-100'}`}>
                                            {STATUS_LABELS[member.status]?.label || member.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        {member.status !== 'revoked' && (
                                            <button
                                                onClick={() => handleRevoke(member.id)}
                                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                                            >
                                                Revoke
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gray-900">
                                    Invite a Member
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowInviteModal(false);
                                        setInviteLink(null);
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {inviteLink ? (
                            <div className="p-6">
                                <div className="text-center mb-6">
                                    <span className="text-5xl mb-4 block">✅</span>
                                    <h4 className="text-lg font-semibold text-gray-900">
                                        Invitation Created!
                                    </h4>
                                    <p className="text-gray-500 mt-2">
                                        Share this link with your collaborator
                                    </p>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                    <input
                                        type="text"
                                        value={inviteLink}
                                        readOnly
                                        className="w-full bg-transparent text-sm text-gray-600 outline-none"
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={copyInviteLink}
                                        className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                    >
                                        📋 Copy Link
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowInviteModal(false);
                                            setInviteLink(null);
                                        }}
                                        className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 space-y-4">
                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="collaborator@email.com"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={inviteName}
                                        onChange={(e) => setInviteName(e.target.value)}
                                        placeholder="John Doe"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Permission Level */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Permission Level
                                    </label>
                                    <div className="space-y-2">
                                        {Object.entries(PERMISSION_LABELS).map(([key, info]) => (
                                            <label
                                                key={key}
                                                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${invitePermission === key
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="permission"
                                                    value={key}
                                                    checked={invitePermission === key}
                                                    onChange={(e) => setInvitePermission(e.target.value)}
                                                    className="mt-1"
                                                />
                                                <div>
                                                    <div className="font-medium text-gray-900">
                                                        {info.label}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {info.description}
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Properties */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Accessible Properties
                                    </label>
                                    {properties.length === 0 ? (
                                        <p className="text-sm text-gray-500">
                                            No properties available
                                        </p>
                                    ) : (
                                        <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                                            {properties.map(prop => (
                                                <label
                                                    key={prop.id}
                                                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedProperties.includes(prop.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedProperties([...selectedProperties, prop.id]);
                                                            } else {
                                                                setSelectedProperties(selectedProperties.filter(id => id !== prop.id));
                                                            }
                                                        }}
                                                    />
                                                    <span className="text-sm">{prop.title}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Submit */}
                                <button
                                    onClick={handleInvite}
                                    disabled={!inviteEmail || !inviteName || inviting}
                                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                                >
                                    {inviting ? 'Sending...' : 'Send Invitation'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

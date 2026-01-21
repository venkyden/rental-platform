'use client';

import { useToast } from '@/lib/ToastContext';
import { useEffect } from 'react';

const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
};

const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
};

export default function ToastContainer() {
    const { toasts, removeToast } = useToast();

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`${colors[toast.type]} border-2 rounded-lg shadow-lg p-4 flex items-start gap-3 animate-slide-in`}
                >
                    <span className="text-2xl flex-shrink-0">{icons[toast.type]}</span>
                    <p className="flex-1 font-medium">{toast.message}</p>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="flex-shrink-0 text-gray-500 hover:text-gray-700 font-bold"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}

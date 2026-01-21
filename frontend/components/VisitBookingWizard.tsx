import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Video } from 'lucide-react';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface VisitSlot {
    id: string;
    start_time: string;
    end_time: string;
    is_booked: boolean;
}

interface VisitBookingProps {
    propertyId: string;
    onBookingSuccess?: () => void;
}

export default function VisitBookingWizard({ propertyId, onBookingSuccess }: VisitBookingProps) {
    const [slots, setSlots] = useState<VisitSlot[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [booking, setBooking] = useState(false);
    const [successLink, setSuccessLink] = useState<string | null>(null);

    useEffect(() => {
        loadSlots();
    }, [propertyId]);

    const loadSlots = async () => {
        try {
            // Public endpoint to get free slots
            const res = await apiClient.client.get(`/visits/slots/${propertyId}`);
            setSlots(res.data);
        } catch (error) {
            console.error("Failed to load availability", error);
        }
    };

    const confirmBooking = async () => {
        if (!selectedSlot) return;
        setBooking(true);
        try {
            const res = await apiClient.client.post(`/visits/book/${selectedSlot}`);
            setSuccessLink(res.data.meeting_link);
            toast.success("Visit booked successfully!");
            if (onBookingSuccess) onBookingSuccess();
        } catch (error) {
            toast.error("Booking failed. Slot might be taken.");
            loadSlots(); // Refresh
        } finally {
            setBooking(false);
        }
    };

    if (successLink) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Visit Confirmed!</h3>
                <p className="text-gray-600 mb-6">Your virtual tour is scheduled. You will receive an email confirmation.</p>

                <a
                    href={successLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition"
                >
                    <Video className="w-5 h-5" />
                    Join Video Call
                </a>
                <p className="text-xs text-gray-400 mt-4">Safe link via Jitsi Meet</p>
            </div>
        );
    }

    // Group days for display
    const days = [...new Set(slots.map(s => new Date(s.start_time).toDateString()))];

    return (
        <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-4">Schedule a Visit</h3>

            {slots.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No availability listed yet.</p>
                    <button className="text-indigo-600 text-sm mt-2 font-medium hover:underline">
                        Request a time
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 max-h-60 overflow-y-auto pr-2">
                        {days.map(dayStr => (
                            <div key={dayStr}>
                                <p className="text-sm font-semibold text-gray-900 mb-2 sticky top-0 bg-white py-1">
                                    {new Date(dayStr).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    {slots
                                        .filter(s => new Date(s.start_time).toDateString() === dayStr)
                                        .map(slot => (
                                            <button
                                                key={slot.id}
                                                onClick={() => setSelectedSlot(slot.id)}
                                                className={`
                                                    text-sm py-2 px-1 rounded-md border text-center transition
                                                    ${selectedSlot === slot.id
                                                        ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200'
                                                        : 'hover:border-indigo-300 hover:bg-indigo-50 text-gray-700'}
                                                `}
                                            >
                                                {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </button>
                                        ))
                                    }
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={confirmBooking}
                        disabled={!selectedSlot || booking}
                        className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        {booking ? 'Booking...' : 'Confirm Scheduler'}
                    </button>

                    <p className="text-xs text-center text-gray-500">
                        {selectedSlot ? 'Reserve this slot instantly.' : 'Select a time slot.'}
                    </p>
                </div>
            )}
        </div>
    );
}

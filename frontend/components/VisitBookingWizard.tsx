import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Video, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface VisitSlot {
    id: string;
    start_time: string;
    end_time: string;
    is_booked: boolean;
    room_index?: number | null;
    room_label?: string | null;
}

interface RoomGroup {
    room_index: number | null;
    room_label: string;
    slots: {
        id: string;
        start_time: string;
        end_time: string;
        is_booked: boolean;
        meeting_link?: string;
    }[];
}

interface VisitBookingProps {
    propertyId: string;
    rooms?: { label: string; index: number }[];
    onBookingSuccess?: () => void;
}

export default function VisitBookingWizard({ propertyId, rooms = [], onBookingSuccess }: VisitBookingProps) {
    const [slots, setSlots] = useState<VisitSlot[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [booking, setBooking] = useState(false);
    const [successLink, setSuccessLink] = useState<string | null>(null);
    const [step, setStep] = useState<'room' | 'time'>(rooms.length > 0 ? 'room' : 'time');

    useEffect(() => {
        loadSlots();
    }, [propertyId]);

    const loadSlots = async () => {
        try {
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
            loadSlots();
        } finally {
            setBooking(false);
        }
    };

    // Success state
    if (successLink) {
        return (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Visit Confirmed!</h3>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6">Your virtual tour is scheduled. You will receive an email confirmation.</p>

                <a
                    href={successLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-teal-500/25 transition-all"
                >
                    <Video className="w-5 h-5" />
                    Join Video Call
                </a>
                <p className="text-xs text-zinc-400 mt-4">Secure link via Jitsi Meet</p>
            </div>
        );
    }

    // Filter slots for the selected room
    const filteredSlots = selectedRoom !== null
        ? slots.filter(s => s.room_index === selectedRoom && !s.is_booked)
        : slots.filter(s => !s.is_booked);

    // Group by day
    const days = [...new Set(filteredSlots.map(s => new Date(s.start_time).toDateString()))];

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-600" />
                Schedule a Visit
            </h3>

            {/* Step 1: Room Selection (if rooms exist) */}
            {rooms.length > 0 && step === 'room' && (
                <div className="space-y-3">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Which room would you like to visit?</p>
                    <div className="grid gap-2">
                        {rooms.map((room) => {
                            const roomSlotCount = slots.filter(s => s.room_index === room.index && !s.is_booked).length;
                            return (
                                <button
                                    key={room.index}
                                    onClick={() => {
                                        setSelectedRoom(room.index);
                                        setStep('time');
                                    }}
                                    className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-teal-400 dark:hover:border-teal-600 transition-all text-left group"
                                >
                                    <div>
                                        <span className="font-medium text-zinc-900 dark:text-white text-sm">{room.label}</span>
                                        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                                            {roomSlotCount} slot{roomSlotCount !== 1 ? 's' : ''} available
                                        </span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-teal-500 transition-colors" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Step 2: Time Selection */}
            {step === 'time' && (
                <>
                    {rooms.length > 0 && selectedRoom !== null && (
                        <div className="flex items-center gap-2 mb-2">
                            <button
                                onClick={() => {
                                    setStep('room');
                                    setSelectedSlot(null);
                                    setSelectedRoom(null);
                                }}
                                className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium"
                            >
                                ← Back to rooms
                            </button>
                            <span className="text-xs text-zinc-400">|</span>
                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                {rooms.find(r => r.index === selectedRoom)?.label}
                            </span>
                        </div>
                    )}

                    {filteredSlots.length === 0 ? (
                        <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                            <Calendar className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">No availability listed yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-1">
                                {days.map(dayStr => (
                                    <div key={dayStr}>
                                        <p className="text-sm font-semibold text-zinc-900 dark:text-white mb-2 sticky top-0 bg-white dark:bg-zinc-900 py-1">
                                            {new Date(dayStr).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {filteredSlots
                                                .filter(s => new Date(s.start_time).toDateString() === dayStr)
                                                .map(slot => (
                                                    <button
                                                        key={slot.id}
                                                        onClick={() => setSelectedSlot(slot.id)}
                                                        className={`
                                                            text-sm py-2 px-3 rounded-xl border text-center transition-all
                                                            ${selectedSlot === slot.id
                                                                ? 'bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-500/25'
                                                                : 'hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/10 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'}
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
                                className={`w-full py-3 rounded-xl font-bold transition-all ${selectedSlot && !booking
                                        ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:shadow-lg hover:shadow-teal-500/25'
                                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed'
                                    }`}
                            >
                                {booking ? 'Booking...' : 'Confirm Visit'}
                            </button>

                            <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
                                {selectedSlot ? 'Reserve this slot instantly.' : 'Select a time slot.'}
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

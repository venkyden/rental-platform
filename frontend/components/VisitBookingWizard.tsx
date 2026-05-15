"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Video, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';

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
    const { t } = useLanguage();
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
            toast.success(t('visitBooking.success.booked', undefined, 'Visit booked successfully!'));
            if (onBookingSuccess) onBookingSuccess();
        } catch (error) {
            toast.error(t('visitBooking.error.bookingFailed', undefined, 'Booking failed. Slot might be taken.'));
            loadSlots();
        } finally {
            setBooking(false);
        }
    };

    // Success state
    if (successLink) {
        return (
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-6 h-6 text-zinc-900" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 mb-2">{t('visitBooking.confirmed.title', undefined, 'Visit Confirmed!')}</h3>
                <p className="text-zinc-600 mb-6">{t('visitBooking.confirmed.desc', undefined, 'Your virtual tour is scheduled. You will receive an email confirmation.')}</p>

                <a
                    href={successLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-zinc-900 text-white text-white px-6 py-3 rounded-xl font-bold hover:shadow-sm hover: transition-all"
                >
                    <Video className="w-5 h-5" />
                    {t('visitBooking.confirmed.joinButton', undefined, 'Join Video Call')}
                </a>
                <p className="text-xs text-zinc-400 mt-4">{t('visitBooking.confirmed.secureLink', undefined, 'Secure link via Jitsi Meet')}</p>
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
        <div className="space-y-8">
            <h3 className="text-3xl font-black text-zinc-900 flex items-center gap-4 uppercase tracking-tighter">
                <Calendar className="w-8 h-8" />
                {t('visitBooking.title', undefined, 'Visit Protocol')}
            </h3>

            {/* Step 1: Room Selection (if rooms exist) */}
            {rooms.length > 0 && step === 'room' && (
                <div className="space-y-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('visitBooking.selectRoomDesc', undefined, 'Select target asset for inspection')}</p>
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
                                    className="flex items-center justify-between p-6 bg-zinc-50 rounded-[2rem] border border-zinc-100 hover:border-zinc-900 hover:bg-zinc-900 hover:text-white transition-all text-left group shadow-sm"
                                >
                                    <div>
                                        <div className="font-black text-sm uppercase tracking-tight">{room.label}</div>
                                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1 group-hover:text-zinc-400">
                                            {roomSlotCount} {t('visitBooking.slotsAvailable', { count: roomSlotCount }, `slot${roomSlotCount !== 1 ? 's' : ''} available`)}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-white transition-colors" />
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
                        <div className="flex items-center gap-4 mb-6">
                            <button
                                onClick={() => {
                                    setStep('room');
                                    setSelectedSlot(null);
                                    setSelectedRoom(null);
                                }}
                                className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors"
                            >
                                ← {t('visitBooking.backToRooms', undefined, 'Back to assets')}
                            </button>
                            <div className="h-4 w-[1px] bg-zinc-200" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900">
                                {rooms.find(r => r.index === selectedRoom)?.label}
                            </span>
                        </div>
                    )}

                    {filteredSlots.length === 0 ? (
                        <div className="text-center py-8 bg-zinc-50 rounded-xl">
                            <Calendar className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                            <p className="text-sm text-zinc-500">{t('visitBooking.noSlots', undefined, 'No availability listed yet.')}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-1">
                                {days.map(dayStr => (
                                    <div key={dayStr}>
                                        <p className="text-sm font-semibold text-zinc-900 mb-2 sticky top-0 bg-white py-1">
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
                                                            text-[10px] font-black uppercase tracking-[0.2em] py-3 px-4 rounded-full border text-center transition-all
                                                            ${selectedSlot === slot.id
                                                                ? 'bg-zinc-900 text-white border-zinc-900 shadow-xl shadow-zinc-900/20'
                                                                : 'hover:border-zinc-900 text-zinc-400 border-zinc-100 bg-zinc-50/50'}
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
                                className={`w-full py-6 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] transition-all shadow-2xl ${selectedSlot && !booking
                                        ? 'bg-zinc-900 text-white hover:scale-[1.02] active:scale-[0.98]'
                                        : 'bg-zinc-100 text-zinc-300 cursor-not-allowed shadow-none'
                                    }`}
                            >
                                {booking ? t('visitBooking.bookingInProgress', undefined, 'Transmitting...') : t('visitBooking.confirmButton', undefined, 'Finalize Reservation')}
                            </button>

                            <p className="text-xs text-center text-zinc-500">
                                {selectedSlot ? t('visitBooking.reserveInstantly', undefined, 'Reserve this slot instantly.') : t('visitBooking.selectTimeSlot', undefined, 'Select a time slot.')}
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

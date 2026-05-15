"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface VisitSlot {
    id: string;
    start_time: string;
    end_time: string;
    is_booked: boolean;
    tenant_id?: string;
    room_index?: number | null;
    room_label?: string | null;
}

interface RoomInfo {
    label: string;
    index: number;
}

interface VisitSchedulerProps {
    propertyId: string;
    rooms?: RoomInfo[];
}

export default function VisitScheduler({ propertyId, rooms = [] }: VisitSchedulerProps) {
    const [slots, setSlots] = useState<VisitSlot[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState<string>('10:00');
    const [selectedRoom, setSelectedRoom] = useState<number | null>(rooms.length > 0 ? 0 : null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadSlots();
    }, [propertyId]);

    const loadSlots = async () => {
        try {
            const res = await apiClient.client.get(`/visits/slots/${propertyId}`);
            setSlots(res.data);
        } catch (error) {
            console.error("Failed to load slots", error);
        }
    };

    const addSlot = async () => {
        if (!selectedDate || !selectedTime) return;

        setLoading(true);
        const start = new Date(`${selectedDate}T${selectedTime}`);
        const end = new Date(start.getTime() + 30 * 60000);

        const roomLabel = selectedRoom !== null && rooms[selectedRoom]
            ? rooms[selectedRoom].label
            : null;

        try {
            await apiClient.client.post('/visits/slots', [{
                property_id: propertyId,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                room_index: selectedRoom,
                room_label: roomLabel,
            }]);
            toast.success(`Slot added${roomLabel ? ` for ${roomLabel}` : ''}`);
            loadSlots();
        } catch (error) {
            toast.error("Failed to add slot");
        } finally {
            setLoading(false);
        }
    };

    // Filter slots by selected room
    const filteredSlots = selectedRoom !== null
        ? slots.filter(s => s.room_index === selectedRoom)
        : slots;

    const groupedSlots = filteredSlots.reduce((acc, slot) => {
        const day = new Date(slot.start_time).toLocaleDateString();
        if (!acc[day]) acc[day] = [];
        acc[day].push(slot);
        return acc;
    }, {} as Record<string, VisitSlot[]>);

    return (
        <div className="bg-zinc-50 border border-zinc-100 rounded-[2.5rem] p-10 shadow-inner">
            <h3 className="text-2xl font-black text-zinc-900 mb-8 flex items-center gap-4 uppercase tracking-tighter">
                <Calendar className="w-6 h-6" />
                Availability Protocol
            </h3>

            {/* Room Tabs */}
            {rooms.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    <button
                        onClick={() => setSelectedRoom(null)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedRoom === null
                                ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-900/20'
                                : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-400'
                            }`}
                    >
                        All Assets
                    </button>
                    {rooms.map((room) => (
                        <button
                            key={`room-${room.index}`}
                            onClick={() => setSelectedRoom(room.index)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedRoom === room.index
                                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-900/20'
                                    : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-400'
                                }`}
                        >
                            {room.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Add Slot Form */}
            <div className="mb-10 p-8 bg-white rounded-[2rem] border border-zinc-100 grid grid-cols-1 sm:grid-cols-4 gap-6 items-end">
                {rooms.length > 0 && (
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Asset</label>
                        <select
                            value={selectedRoom ?? ''}
                            onChange={(e) => setSelectedRoom(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full border-none bg-zinc-50 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                        >
                            {rooms.map((room) => (
                                <option key={room.index} value={room.index}>{room.label}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Date</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full border-none bg-zinc-50 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                        min={new Date().toISOString().split('T')[0]}
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Time</label>
                    <input
                        type="time"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="w-full border-none bg-zinc-50 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                    />
                </div>
                <button
                    onClick={addSlot}
                    disabled={loading}
                    className="bg-zinc-900 text-white h-12 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Provision Slot
                </button>
            </div>

            {/* Slot Display */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium text-zinc-700">
                    Available Slots {selectedRoom !== null && rooms[selectedRoom] ? `— ${rooms[selectedRoom].label}` : ''}
                </h4>
                {Object.keys(groupedSlots).length === 0 ? (
                    <p className="text-sm text-zinc-500 italic">No slots defined yet.</p>
                ) : (
                    Object.entries(groupedSlots).map(([day, daySlots]) => (
                        <div key={day} className="border-l-4 border-zinc-200 pl-4 py-1">
                            <p className="text-sm font-semibold text-zinc-900 mb-2">{day}</p>
                            <div className="flex flex-wrap gap-2">
                                {daySlots.map(slot => (
                                     <div key={slot.id} className={`
                                         text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full flex items-center gap-2 transition-all
                                         ${slot.is_booked
                                             ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-900/20'
                                             : 'bg-white border border-zinc-100 text-zinc-400 hover:text-zinc-900 hover:border-zinc-900'}
                                     `}>
                                        <Clock className="w-3 h-3" />
                                        {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {slot.room_label && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${slot.is_booked ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-900'}`}>
                                                {slot.room_label}
                                            </span>
                                        )}
                                        {slot.is_booked && <span className="font-bold ml-1">(Booked)</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

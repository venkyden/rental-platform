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
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/10 p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-zinc-900 dark:text-white">
                <Calendar className="w-5 h-5 text-teal-600" />
                Manage Visit Availability
            </h3>

            {/* Room Tabs */}
            {rooms.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    <button
                        onClick={() => setSelectedRoom(null)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${selectedRoom === null
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-teal-300'
                            }`}
                    >
                        All Rooms
                    </button>
                    {rooms.map((room) => (
                        <button
                            key={`room-${room.index}`}
                            onClick={() => setSelectedRoom(room.index)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${selectedRoom === room.index
                                    ? 'bg-teal-600 text-white border-teal-600'
                                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-teal-300'
                                }`}
                        >
                            {room.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Add Slot Form */}
            <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl flex flex-wrap items-end gap-4">
                {rooms.length > 0 && (
                    <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Room</label>
                        <select
                            value={selectedRoom ?? ''}
                            onChange={(e) => setSelectedRoom(e.target.value ? parseInt(e.target.value) : null)}
                            className="border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        >
                            {rooms.map((room) => (
                                <option key={room.index} value={room.index}>{room.label}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Date</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        min={new Date().toISOString().split('T')[0]}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Start Time</label>
                    <input
                        type="time"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                </div>
                <button
                    onClick={addSlot}
                    disabled={loading}
                    className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:shadow-sm hover: disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Add Slot
                </button>
            </div>

            {/* Slot Display */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Available Slots {selectedRoom !== null && rooms[selectedRoom] ? `— ${rooms[selectedRoom].label}` : ''}
                </h4>
                {Object.keys(groupedSlots).length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">No slots defined yet.</p>
                ) : (
                    Object.entries(groupedSlots).map(([day, daySlots]) => (
                        <div key={day} className="border-l-4 border-teal-200 dark:border-teal-800 pl-4 py-1">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">{day}</p>
                            <div className="flex flex-wrap gap-2">
                                {daySlots.map(slot => (
                                    <div key={slot.id} className={`
                                        text-xs px-3 py-1.5 rounded-full flex items-center gap-2
                                        ${slot.is_booked
                                            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                                            : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'}
                                    `}>
                                        <Clock className="w-3 h-3" />
                                        {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {slot.room_label && (
                                            <span className="text-[10px] bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 px-1.5 py-0.5 rounded-full">
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

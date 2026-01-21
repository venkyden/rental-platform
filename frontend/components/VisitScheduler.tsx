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
}

interface VisitSchedulerProps {
    propertyId: string;
}

export default function VisitScheduler({ propertyId }: VisitSchedulerProps) {
    const [slots, setSlots] = useState<VisitSlot[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState<string>('10:00');
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
        // Create a 30 min slot by default
        const start = new Date(`${selectedDate}T${selectedTime}`);
        const end = new Date(start.getTime() + 30 * 60000);

        try {
            await apiClient.client.post('/visits/slots', [{
                property_id: propertyId,
                start_time: start.toISOString(),
                end_time: end.toISOString()
            }]);
            toast.success("Availability slot added");
            loadSlots();
        } catch (error) {
            toast.error("Failed to add slot");
        } finally {
            setLoading(false);
        }
    };

    const groupedSlots = slots.reduce((acc, slot) => {
        const day = new Date(slot.start_time).toLocaleDateString();
        if (!acc[day]) acc[day] = [];
        acc[day].push(slot);
        return acc;
    }, {} as Record<string, VisitSlot[]>);

    return (
        <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                Manage Visit Availability
            </h3>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg flex items-end gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="border rounded-md px-3 py-2 text-sm"
                        min={new Date().toISOString().split('T')[0]}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                    <input
                        type="time"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="border rounded-md px-3 py-2 text-sm"
                    />
                </div>
                <button
                    onClick={addSlot}
                    disabled={loading}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add Slot
                </button>
            </div>

            <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">Available Slots</h4>
                {Object.keys(groupedSlots).length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No slots defined yet.</p>
                ) : (
                    Object.entries(groupedSlots).map(([day, daySlots]) => (
                        <div key={day} className="border-l-4 border-indigo-200 pl-4 py-1">
                            <p className="text-sm font-semibold text-gray-900 mb-2">{day}</p>
                            <div className="flex flex-wrap gap-2">
                                {daySlots.map(slot => (
                                    <div key={slot.id} className={`
                                        text-xs px-3 py-1.5 rounded-full flex items-center gap-2
                                        ${slot.is_booked ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white border border-gray-200 text-gray-600'}
                                    `}>
                                        <Clock className="w-3 h-3" />
                                        {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

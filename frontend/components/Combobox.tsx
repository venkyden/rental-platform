'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, Check, X, Command } from 'lucide-react';

import { useLanguage } from '@/lib/LanguageContext';

interface Option {
    label: string;
    value: string;
    group?: string;
}

interface ComboboxProps {
    options: Option[];
    value: string;
    onChangeAction: (value: string) => void;
    placeholder?: string;
    label?: string;
    error?: string;
    className?: string;
}

export default function Combobox({
    options,
    value,
    onChangeAction,
    placeholder,
    label,
    error,
    className = '',
}: ComboboxProps) {
    const { t } = useLanguage();
    const defaultPlaceholder = t('common.placeholders.selectOption');
    const displayPlaceholder = placeholder || defaultPlaceholder;

    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = useMemo(() => 
        options.find(opt => opt.value === value), 
    [options, value]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const term = searchTerm.toLowerCase();
        return options.filter(opt => 
            opt.label.toLowerCase().includes(term) || 
            opt.group?.toLowerCase().includes(term)
        );
    }, [options, searchTerm]);

    const groupedOptions = useMemo(() => {
        const groups: Record<string, Option[]> = {};
        filteredOptions.forEach(opt => {
            const groupName = opt.group || 'Other';
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(opt);
        });
        return groups;
    }, [filteredOptions]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue: string) => {
        onChangeAction(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className={`relative w-full ${className}`} ref={containerRef}>
            {label && (
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 ml-4">
                    {label}
                </label>
            )}

            <button
                type="button"
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) setTimeout(() => inputRef.current?.focus(), 100);
                }}
                className={`w-full flex items-center justify-between px-8 py-6 text-left text-xl bg-zinc-50 border-2 rounded-[2rem] transition-all duration-300 outline-none group
                    ${isOpen 
                        ? 'border-zinc-900 bg-white shadow-xl' 
                        : 'border-zinc-100 hover:border-zinc-200'
                    }
                    ${error ? 'border-red-500' : ''}
                `}
            >
                <span className={`truncate font-bold tracking-tight ${!selectedOption ? 'text-zinc-300' : 'text-zinc-900'}`}>
                    {selectedOption ? t(selectedOption.label, undefined, selectedOption.label) : displayPlaceholder}
                </span>
                <ChevronDown className={`w-5 h-5 text-zinc-300 transition-transform duration-300 ${isOpen ? 'rotate-180 text-zinc-900' : 'group-hover:text-zinc-500'}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        className="absolute z-[1100] left-0 right-0 mt-3 bg-white border border-zinc-100 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden"
                    >
                        <div className="p-4 border-b border-zinc-50 bg-zinc-50/30">
                            <div className="relative">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={t('common.placeholders.search')}
                                    className="w-full pl-14 pr-12 py-5 text-sm font-bold bg-white border-2 border-zinc-100 rounded-2xl focus:outline-none focus:border-zinc-900 transition-all placeholder:text-zinc-200"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="max-h-80 overflow-y-auto overscroll-contain py-2 custom-scrollbar">
                            {filteredOptions.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Command className="w-8 h-8 text-zinc-100 mx-auto mb-4" />
                                    <p className="text-xs font-black text-zinc-300 uppercase tracking-widest">{t('common.noResults', { term: searchTerm }, `No results for "${searchTerm}"`)}</p>
                                </div>
                            ) : (
                                Object.entries(groupedOptions).map(([group, opts]) => (
                                    <div key={group} className="mb-2 last:mb-0">
                                        {group !== 'Other' && (
                                            <div className="px-8 py-3 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-300 bg-zinc-50/50">
                                                {t(group, undefined, group)}
                                            </div>
                                        )}
                                        <div className="px-2">
                                            {opts.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => handleSelect(opt.value)}
                                                    className={`w-full flex items-center justify-between px-6 py-4 text-left rounded-2xl transition-all duration-200 group/item
                                                        ${value === opt.value 
                                                            ? 'bg-zinc-900 text-white shadow-lg' 
                                                            : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                                                        }
                                                    `}
                                                >
                                                    <span className="text-sm font-bold truncate">{t(opt.label, undefined, opt.label)}</span>
                                                    {value === opt.value && (
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                                            <Check className="w-4 h-4 text-white" />
                                                        </motion.div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {error && <p className="mt-2 text-[10px] font-black text-red-500 uppercase tracking-widest ml-4">{error}</p>}
        </div>
    );
}

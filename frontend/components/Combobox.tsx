'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, Check, X } from 'lucide-react';

import { useLanguage } from '@/lib/LanguageContext';

interface Option {
    label: string;
    value: string;
    group?: string;
}

interface ComboboxProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    error?: string;
    className?: string;
}

export default function Combobox({
    options,
    value,
    onChange,
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
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className={`relative w-full ${className}`} ref={containerRef}>
            {label && (
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ml-1">
                    {label}
                </label>
            )}

            <button
                type="button"
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) setTimeout(() => inputRef.current?.focus(), 100);
                }}
                className={`w-full flex items-center justify-between px-6 py-4 text-left text-lg bg-white/50 dark:bg-zinc-800/50 border-2 rounded-xl transition-all outline-none
                    ${isOpen 
                        ? 'border-teal-500 ring-4 ring-teal-500/10' 
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }
                    ${error ? 'border-red-500 ring-red-500/10' : ''}
                `}
            >
                <span className={`truncate ${!selectedOption ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
                    {selectedOption ? t(selectedOption.label, undefined, selectedOption.label) : displayPlaceholder}
                </span>
                <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-[60] left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
                    >
                        <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={t('common.placeholders.search')}
                                    className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-teal-500 dark:focus:border-teal-400 transition-colors"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="max-h-64 overflow-y-auto overscroll-contain">
                            {filteredOptions.length === 0 ? (
                                <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                                    <p className="text-sm">{t('common.noResults', { term: searchTerm }, `No results found for "${searchTerm}"`)}</p>
                                </div>
                            ) : (
                                Object.entries(groupedOptions).map(([group, opts]) => (
                                    <div key={group}>
                                        {group !== 'Other' && (
                                            <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 bg-zinc-50/30 dark:bg-zinc-800/30">
                                                {t(group, undefined, group)}
                                            </div>
                                        )}
                                        {opts.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => handleSelect(opt.value)}
                                                className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm transition-colors
                                                    ${value === opt.value 
                                                        ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300' 
                                                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                                    }
                                                `}
                                            >
                                                <span>{t(opt.label, undefined, opt.label)}</span>
                                                {value === opt.value && <Check className="w-4 h-4 text-teal-600 dark:text-teal-400" />}
                                            </button>
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {error && <p className="mt-1.5 text-xs text-red-500 ml-1">{error}</p>}
        </div>
    );
}

'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface WizardProgressProps {
    steps: string[];
    currentStep: number;
}

export default function WizardProgress({ steps, currentStep }: WizardProgressProps) {
    return (
        <div className="flex items-center justify-between w-full mb-12 px-4 sm:px-10">
            {steps.map((stepName, index) => {
                const stepNum = index + 1;
                const isActive = stepNum === currentStep;
                const isCompleted = stepNum < currentStep;
                const isLast = index === steps.length - 1;

                return (
                    <div key={stepNum} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
                        {/* Step Marker & Label Container */}
                        <div className="relative flex flex-col items-center">
                            <motion.div
                                initial={false}
                                animate={{
                                    backgroundColor: isActive || isCompleted ? '#4F46E5' : '#F3F4F6',
                                    borderColor: isActive ? '#C7D2FE' : isCompleted ? '#4F46E5' : '#E5E7EB',
                                    scale: isActive ? 1.15 : 1
                                }}
                                transition={{ duration: 0.3 }}
                                className={`w-10 h-10 z-10 rounded-full flex items-center justify-center border-4 text-sm font-bold transition-shadow ${isActive ? 'text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] ring-4 ring-white' :
                                        isCompleted ? 'text-white ring-4 ring-white' : 'text-gray-400 bg-white ring-4 ring-white'
                                    }`}
                            >
                                {isCompleted ? (
                                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>✓</motion.span>
                                ) : (
                                    stepNum
                                )}
                            </motion.div>

                            {/* Step Label */}
                            <div className={`absolute top-12 w-32 text-center text-xs transition-colors duration-300 ${isActive ? 'text-gray-900 font-bold' : isCompleted ? 'text-gray-600 font-medium' : 'text-gray-400 font-medium'}`}>
                                {stepName}
                            </div>
                        </div>

                        {/* Connector Line */}
                        {!isLast && (
                            <div className="flex-1 h-1 mx-2 bg-gray-200 relative overflow-hidden rounded-full">
                                <motion.div
                                    initial={false}
                                    animate={{ width: isCompleted ? '100%' : '0%' }}
                                    transition={{ duration: 0.4, ease: 'easeOut' }}
                                    className="absolute top-0 left-0 h-full bg-indigo-600 rounded-full"
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

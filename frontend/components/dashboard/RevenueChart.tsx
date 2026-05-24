'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ChartPoint {
    date: string;
    views: number;
    applications: number;
    revenue: number;
}

interface RevenueChartProps {
    points: ChartPoint[];
    metric: 'views' | 'revenue' | 'applications';
}

export default function RevenueChart({ points, metric }: RevenueChartProps) {
    if (points.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-zinc-400 text-sm font-black uppercase tracking-widest">
                No data available
            </div>
        );
    }

    const values = points.map(p => p[metric]);
    const maxVal = Math.max(...values, 10); // avoid divide by zero, baseline minimum 10
    const minVal = Math.min(...values, 0);
    const range = maxVal - minVal;

    // SVG coordinates config
    const width = 600;
    const height = 240;
    const padding = 20;
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding * 2;

    // Map data points to SVG coordinates
    const coordinates = points.map((p, index) => {
        const x = padding + (index / (points.length - 1)) * chartWidth;
        const y = height - padding - ((p[metric] - minVal) / range) * chartHeight;
        return { x, y, date: p.date, value: p[metric] };
    });

    // Create polyline path string
    const pathString = coordinates.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

    // Area path string (goes down to baseline)
    const areaString = `${pathString} L ${coordinates[coordinates.length - 1].x} ${height - padding} L ${coordinates[0].x} ${height - padding} Z`;

    const formatXLabel = (dateStr: string) => {
        try {
            const parts = dateStr.split('-');
            if (parts.length < 3) return dateStr;
            // Return e.g. "24/05"
            return `${parts[2]}/${parts[1]}`;
        } catch {
            return dateStr;
        }
    };

    const formatYLabel = (val: number) => {
        if (metric === 'revenue') {
            return `${val}€`;
        }
        return val.toString();
    };

    return (
        <div className="w-full relative">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
                {/* Defs for gradients */}
                <defs>
                    <linearGradient id="chart-area-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgb(24, 24, 27)" stopOpacity="0.08" />
                        <stop offset="100%" stopColor="rgb(24, 24, 27)" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = padding + ratio * chartHeight;
                    const val = maxVal - ratio * range;
                    return (
                        <g key={idx} className="opacity-40">
                            <line
                                x1={padding}
                                y1={y}
                                x2={width - padding}
                                y2={y}
                                stroke="#f4f4f5"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                            />
                            <text
                                x={padding - 5}
                                y={y + 4}
                                fill="#a1a1aa"
                                fontSize="9"
                                fontWeight="800"
                                textAnchor="end"
                                className="font-sans"
                            >
                                {formatYLabel(Math.round(val))}
                            </text>
                        </g>
                    );
                })}

                {/* Gradient Area under curve */}
                <motion.path
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    d={areaString}
                    fill="url(#chart-area-grad)"
                />

                {/* Sparkline curve */}
                <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.5, ease: [0.25, 1, 0.5, 1] }}
                    d={pathString}
                    fill="none"
                    stroke="rgb(24, 24, 27)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Data point circles on hover / interactive */}
                {coordinates.map((c, idx) => {
                    // Only show first, middle, last points by default or all on hover
                    const isSignificant = idx === 0 || idx === Math.floor(coordinates.length / 2) || idx === coordinates.length - 1;
                    if (!isSignificant) return null;

                    return (
                        <g key={idx} className="group cursor-pointer">
                            <circle
                                cx={c.x}
                                cy={c.y}
                                r="4.5"
                                fill="rgb(24, 24, 27)"
                                stroke="white"
                                strokeWidth="2"
                                className="transition-transform group-hover:scale-150"
                            />
                            {/* Date Label under baseline */}
                            <text
                                x={c.x}
                                y={height - 2}
                                fill="#71717a"
                                fontSize="9"
                                fontWeight="800"
                                textAnchor="middle"
                                className="font-sans"
                            >
                                {formatXLabel(c.date)}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

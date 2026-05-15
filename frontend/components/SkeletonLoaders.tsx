export function PropertyCardSkeleton() {
    return (
        <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-2 animate-pulse">
            <div className="h-48 bg-zinc-200 rounded-2xl m-2" />
            <div className="p-5 pt-3 space-y-4">
                <div className="space-y-2">
                    <div className="h-6 bg-zinc-200 rounded-lg w-3/4" />
                    <div className="h-4 bg-zinc-200 rounded-lg w-1/2" />
                </div>
                <div className="flex justify-between items-center py-2">
                    <div className="h-8 bg-zinc-200 rounded-lg w-24" />
                    <div className="h-6 bg-zinc-200 rounded-lg w-20" />
                </div>
                <div className="h-6 bg-zinc-200 rounded-lg w-full" />
                <div className="flex gap-2">
                    <div className="h-10 bg-zinc-200 rounded-xl flex-1" />
                    <div className="h-10 bg-zinc-200 rounded-xl flex-1" />
                    <div className="h-10 bg-zinc-200 rounded-xl w-12" />
                </div>
            </div>
        </div>
    );
}

export function PropertyDetailSkeleton() {
    return (
        <div className="min-h-screen py-8">
            <div className="max-w-6xl mx-auto px-4 animate-pulse">
                <div className="h-8 bg-zinc-200 rounded-xl w-32 mb-8" />

                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 mb-8 border border-white/50">
                    <div className="h-96 bg-zinc-200 rounded-2xl" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white/80 rounded-3xl p-8 border border-white/50">
                            <div className="h-8 bg-zinc-200 rounded-xl w-3/4 mb-6" />
                            <div className="space-y-3">
                                <div className="h-4 bg-zinc-200 rounded-lg w-full" />
                                <div className="h-4 bg-zinc-200 rounded-lg w-5/6" />
                                <div className="h-4 bg-zinc-200 rounded-lg w-4/5" />
                            </div>
                        </div>

                        <div className="bg-white/80 rounded-3xl p-8 border border-white/50">
                            <div className="h-6 bg-zinc-200 rounded-xl w-1/4 mb-6" />
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="h-10 bg-zinc-200 rounded-xl" />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/80 rounded-3xl p-8 border border-white/50 h-fit">
                        <div className="h-10 bg-zinc-200 rounded-xl w-2/3 mb-6" />
                        <div className="h-14 bg-zinc-200 rounded-2xl w-full mb-6" />
                        <div className="h-12 bg-zinc-900/10 rounded-2xl w-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function DashboardCardSkeleton() {
    return (
        <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-6 animate-pulse">
            <div className="h-6 bg-zinc-200 rounded-lg w-1/2 mb-4" />
            <div className="h-12 bg-zinc-200 rounded-xl w-1/3 mb-4" />
            <div className="h-4 bg-zinc-200 rounded-lg w-3/4" />
        </div>
    );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex gap-4 p-4 bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl animate-pulse">
                    <div className="w-14 h-14 bg-zinc-200 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-3 py-1">
                        <div className="h-4 bg-zinc-200 rounded w-3/4" />
                        <div className="h-3 bg-zinc-200 rounded w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function PropertyCardSkeleton() {
    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden animate-pulse">
            <div className="h-48 bg-gray-200" />
            <div className="p-6 space-y-3">
                <div className="h-6 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="flex gap-2 mt-4">
                    <div className="h-6 bg-gray-200 rounded-full w-16" />
                    <div className="h-6 bg-gray-200 rounded-full w-16" />
                </div>
            </div>
        </div>
    );
}

export function PropertyDetailSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
            <div className="max-w-6xl mx-auto px-4 animate-pulse">
                <div className="h-8 bg-gray-300 rounded w-32 mb-8" />

                {/* Photo Gallery Skeleton */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <div className="h-96 bg-gray-200 rounded-lg" />
                </div>

                {/* Info Section Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
                            <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                            <div className="h-4 bg-gray-200 rounded w-5/6" />
                        </div>

                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4" />
                            <div className="grid grid-cols-2 gap-4">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="h-4 bg-gray-200 rounded" />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 h-fit">
                        <div className="h-10 bg-gray-200 rounded w-2/3 mb-4" />
                        <div className="h-12 bg-gray-200 rounded w-full mb-4" />
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function DashboardCardSkeleton() {
    return (
        <div className="bg-white rounded-xl shadow-md p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-4" />
            <div className="h-10 bg-gray-200 rounded w-1/4 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
        </div>
    );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex gap-4 p-4 bg-white rounded-lg shadow animate-pulse">
                    <div className="w-16 h-16 bg-gray-200 rounded" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                </div>
            ))}
        </>
    );
}

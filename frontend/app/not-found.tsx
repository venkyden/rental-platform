import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
            <div className="max-w-md w-full text-center">
                <div className="text-8xl font-extrabold mb-4" style={{ color: '#22B8B8' }}>
                    404
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-3">Page not found</h1>
                <p className="text-gray-500 mb-8 leading-relaxed">
                    Sorry, we couldn&apos;t find the page you&apos;re looking for. It may have been moved or deleted.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/"
                        className="px-6 py-3 text-sm font-semibold text-white rounded-xl shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
                        style={{ background: 'linear-gradient(135deg, #3DD6D0, #22B8B8)' }}
                    >
                        Go home
                    </Link>
                    <Link
                        href="/search"
                        className="px-6 py-3 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-200 rounded-xl hover:border-gray-300 transition-all"
                    >
                        Browse listings
                    </Link>
                </div>
            </div>
        </div>
    );
}

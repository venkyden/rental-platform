'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service like Sentry
        console.error('Unhandled specific client-side error caught by Global Error Boundary:', error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                    <div className="max-w-md w-full text-center">
                        <div className="bg-red-50 text-red-600 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>

                        <h1 className="text-3xl font-bold text-gray-900 mb-4">
                            Oops! Something went wrong.
                        </h1>

                        <p className="text-gray-600 mb-8">
                            Sorry, the platform encountered an unexpected error. Our engineers have been notified.
                        </p>

                        <div className="space-y-4">
                            <button
                                onClick={() => reset()}
                                className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-200"
                            >
                                Try Again
                            </button>

                            <div className="pt-2">
                                <Link
                                    href="/"
                                    className="text-blue-600 hover:text-blue-800 font-medium border border-transparent hover:underline"
                                >
                                    Or return to the homepage
                                </Link>
                            </div>
                        </div>

                        {process.env.NODE_ENV === 'development' && (
                            <div className="mt-8 text-left bg-gray-100 p-4 rounded-md overflow-auto text-xs font-mono text-gray-800">
                                <p className="font-bold text-red-600 mb-2">Error Details (Dev Only):</p>
                                <p>{error.message}</p>
                                {error.digest && <p className="mt-2 text-gray-500">Digest: {error.digest}</p>}
                            </div>
                        )}
                    </div>
                </div>
            </body>
        </html>
    );
}

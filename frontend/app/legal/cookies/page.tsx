import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Cookie Policy | Roomivo',
    description: 'Learn how Roomivo uses cookies and similar technologies to provide a secure, personalized experience on our platform.',
};

export default function CookiesPage() {
    return (
        <div className="prose prose-zinc prose-a:text-teal-600 hover:prose-a:text-teal-500 max-w-none">
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl mb-6">
                Cookie Policy
            </h1>
            <p className="text-lg text-zinc-500 mb-12 border-b border-zinc-100 pb-8">
                Roomivo uses intelligent session management and minimal tracking to ensure a seamless, secure, and fast experience without compromising your privacy.
            </p>

            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-4">Essential vs. Optional Cookies</h2>
                <p>
                    We classify cookies into strict categories to give you full control over your footprint:
                </p>
                <div className="mt-6 space-y-6">
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-zinc-900 mt-0 mb-2">Strictly Necessary Cookies</h3>
                        <p className="text-zinc-600 text-sm m-0">
                            These are vital for the platform to function. They handle secure authentication tokens (JWTs), CSRF protection, and load balancing. You cannot opt-out of these as the application will simply break.
                        </p>
                    </div>

                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-zinc-900 mt-0 mb-2">Performance & Analytics</h3>
                        <p className="text-zinc-600 text-sm m-0">
                            We use anonymized, privacy-first analytics (no cross-site tracking) to understand user flow, identify bottlenecks, and improve application load times.
                        </p>
                    </div>
                </div>
            </section>

            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-4">Managing Your Preferences</h2>
                <p>
                    You remain in the driver's seat. Most modern browsers allow you to block or delete cookies universally.
                    However, blocking essential cookies will immediately log you out of your Roomivo session for security reasons.
                </p>
            </section>

            <div className="mt-16 pt-8 border-t border-zinc-100 text-sm text-zinc-400">
                Last updated: February 28, 2026
            </div>
        </div>
    );
}

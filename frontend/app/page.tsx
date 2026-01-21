import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero section */}
        <div className="text-center py-16">
          <h1 className="text-5xl font-extrabold text-gray-900 mb-6">
            Welcome to Rental Platform
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            AI-powered rental platform serving tenants and landlords with intelligent
            verification, matching, and lease generation.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/auth/register"
              className="px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:text-lg"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 md:text-lg"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl mb-4">🔐</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Secure Verification
            </h3>
            <p className="text-gray-600">
              Advanced identity and employment verification in minutes, not weeks.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl mb-4">🤖</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              AI-Powered Matching
            </h3>
            <p className="text-gray-600">
              Smart algorithms match tenants with perfect properties instantly.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl mb-4">📄</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Digital Leases
            </h3>
            <p className="text-gray-600">
              Generate and sign legally-binding leases in 5 minutes with AI.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

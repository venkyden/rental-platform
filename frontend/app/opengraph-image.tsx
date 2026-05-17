import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Roomivo - Rent securely in France';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#09090b', // Zinc-950
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
          padding: '60px',
        }}
      >
        {/* Subtle dynamic grid background */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.05,
            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Elegant glowing background blur */}
        <div
          style={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '50%',
            filter: 'blur(80px)',
            top: '100px',
            left: '400px',
          }}
        />

        {/* Content Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '60px 80px',
            borderRadius: '24px',
            background: 'rgba(15, 15, 15, 0.6)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Logo badge */}
          <div
            style={{
              display: 'flex',
              padding: '6px 16px',
              borderRadius: '99px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#a1a1aa',
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '0.05em',
              marginBottom: '28px',
              textTransform: 'uppercase',
            }}
          >
            French Rental Platform
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 800,
              color: '#ffffff',
              margin: 0,
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            Roomivo
          </h1>

          {/* Slogan */}
          <p
            style={{
              fontSize: '24px',
              color: '#a1a1aa',
              marginTop: '16px',
              marginBottom: 0,
              fontWeight: 400,
              textAlign: 'center',
              letterSpacing: '-0.01em',
            }}
          >
            Rent securely in France • Louez en toute sécurité
          </p>

          {/* Trust markers */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              marginTop: '48px',
            }}
          >
            <span style={{ color: '#71717a', fontSize: '14px' }}>✓ AES-256 Encrypted</span>
            <span style={{ color: '#71717a', fontSize: '14px' }}>•</span>
            <span style={{ color: '#71717a', fontSize: '14px' }}>✓ GDPR Compliant</span>
            <span style={{ color: '#71717a', fontSize: '14px' }}>•</span>
            <span style={{ color: '#71717a', fontSize: '14px' }}>✓ Verified Profiles</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

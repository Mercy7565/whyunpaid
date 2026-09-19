'use client';

/**
 * The last resort, for a failure in the root layout itself. It ships its own
 * markup and its own colours because by the time this renders, the layout that
 * loads the stylesheet may not have.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#0F1429',
          color: '#E9EEE0',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <main style={{ maxWidth: '44ch' }}>
          <p style={{ letterSpacing: '0.14em', fontSize: 11, textTransform: 'uppercase', opacity: 0.72 }}>
            WhyUnpaid?
          </p>
          <h1 style={{ fontSize: 30, lineHeight: 1.1, margin: '8px 0 0' }}>
            The application failed to start.
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.88, marginTop: 8 }}>
            Nothing was sent anywhere and nothing was stored.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              border: 0,
              cursor: 'pointer',
              background: '#669BBC',
              color: '#0F1429',
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}

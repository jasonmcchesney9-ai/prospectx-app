'use client';
import { useEffect } from 'react';
export default function FilmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Film Hub error:', error);
  }, [error]);
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '400px',
      gap: '16px',
      fontFamily: 'Oswald, sans-serif',
    }}>
      <div style={{
        color: '#0F2942',
        fontSize: '20px',
        fontWeight: 700,
        letterSpacing: '0.04em',
      }}>
        FILM HUB UNAVAILABLE
      </div>
      <div style={{
        color: '#5A7291',
        fontFamily: "'Source Serif 4', serif",
        fontSize: '14px',
      }}>
        Something went wrong loading the Film Hub.
      </div>
      <button
        onClick={reset}
        style={{
          backgroundColor: '#0D9488',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          padding: '10px 24px',
          fontFamily: 'Oswald, sans-serif',
          fontWeight: 600,
          fontSize: '13px',
          letterSpacing: '0.04em',
          cursor: 'pointer',
        }}
      >
        TRY AGAIN
      </button>
    </div>
  );
}

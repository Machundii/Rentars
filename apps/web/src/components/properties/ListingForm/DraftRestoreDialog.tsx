'use client';

import { useEffect, useState } from 'react';

interface DraftRestoreDialogProps {
  hasDraft: boolean;
  onResume: () => void;
  onDiscard: () => void;
  isOpen?: boolean;
}

export default function DraftRestoreDialog({
  hasDraft,
  onResume,
  onDiscard,
  isOpen = true,
}: DraftRestoreDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !hasDraft || !isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '400px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', marginTop: 0 }}>
          Resume Draft?
        </h2>
        <p style={{ marginBottom: '24px', color: '#666', margin: '0 0 24px 0' }}>
          We found a saved draft of your listing. Would you like to resume editing it?
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onDiscard}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Discard
          </button>
          <button
            onClick={onResume}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#2563eb',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Resume
          </button>
        </div>
      </div>
    </div>
  );
}

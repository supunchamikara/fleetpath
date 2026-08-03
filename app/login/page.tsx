'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isConfigured } from '@/utils/supabase/client';
import { Box } from '@/components/Blueprint';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    // refresh() so the server components re-render with the new cookie.
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: 'min(420px, 100%)' }}>
        <div
          style={{
            width: 52,
            height: 52,
            background: 'var(--accent)',
            display: 'grid',
            placeItems: 'center',
            marginBottom: 20,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f2f2f3" strokeWidth="1.6">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div className="kicker">Fleet admin</div>
        <h1 style={{ margin: '4px 0 6px' }}>Sign in</h1>
        <p className="muted" style={{ fontSize: 14, marginBottom: 22 }}>
          Use the same Supabase account the phones sync with — journeys are
          scoped to that account by Row Level Security.
        </p>

        {!isConfigured && (
          <Box style={{ marginBottom: 18, borderColor: 'var(--danger)' }}>
            <strong style={{ fontSize: 14 }}>Not configured</strong>
            <p style={{ fontSize: 13, marginTop: 6 }} className="muted">
              Copy <code>.env.local.example</code> to <code>.env.local</code>, then
              restart the dev server.
            </p>
          </Box>
        )}

        <form onSubmit={submit}>
          <label style={{ fontSize: 12 }} className="muted">EMAIL</label>
          <input
            className="input"
            style={{ margin: '5px 0 16px' }}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
          <label style={{ fontSize: 12 }} className="muted">PASSWORD</label>
          <input
            className="input"
            style={{ margin: '5px 0 20px' }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            className="btn btn-primary"
            style={{ width: '100%', height: 46 }}
            disabled={busy || !isConfigured}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 14 }}>{error}</p>}
      </div>
    </main>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="btn"
      style={{ padding: '6px 12px', fontSize: 13 }}
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

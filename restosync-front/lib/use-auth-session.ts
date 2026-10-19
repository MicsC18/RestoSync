'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useAuthSession() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      const storedToken = localStorage.getItem('token');
      if (!active) return;

      if (!storedToken) {
        router.replace('/login');
      }

      setToken(storedToken);
      setChecking(false);
    });

    return () => {
      active = false;
    };
  }, [router]);

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    router.replace('/login');
  };

  return { token, checking, logout };
}

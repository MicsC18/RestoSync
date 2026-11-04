'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl, authHeaders } from '@/lib/api';

export type RolUsuario = 'ADMIN_RESTAURANTE' | 'GERENTE_LOCAL';

export type LocalInfo = {
  id: number;
  nombre: string;
  direccion?: string | null;
  activo: boolean;
};

export type SesionUsuario = {
  usuarioId: number;
  email: string;
  rol: RolUsuario;
  restauranteId: number;
  restauranteNombre: string;
  localId: number | null;
  locales: LocalInfo[];
};

const LOCAL_ACTIVO_KEY = 'localActivoId';

export function useAuthSession() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [sesion, setSesion] = useState<SesionUsuario | null>(null);
  const [localActivoId, setLocalActivoIdState] = useState<number | null>(null);
  const [checking, setChecking] = useState(true);

  const aplicarLocalActivo = useCallback((perfil: SesionUsuario) => {
    if (perfil.rol === 'GERENTE_LOCAL') {
      const fijo = perfil.localId ?? perfil.locales[0]?.id ?? null;
      setLocalActivoIdState(fijo);
      if (fijo != null) {
        localStorage.setItem(LOCAL_ACTIVO_KEY, String(fijo));
      }
      return;
    }

    const guardado = localStorage.getItem(LOCAL_ACTIVO_KEY);
    const guardadoId = guardado ? Number(guardado) : NaN;
    const existe = perfil.locales.some((local) => local.id === guardadoId);
    const elegido = existe
      ? guardadoId
      : (perfil.locales.find((local) => local.activo)?.id ??
        perfil.locales[0]?.id ??
        null);

    setLocalActivoIdState(elegido);
    if (elegido != null) {
      localStorage.setItem(LOCAL_ACTIVO_KEY, String(elegido));
    } else {
      localStorage.removeItem(LOCAL_ACTIVO_KEY);
    }
  }, []);

  const cargarPerfil = useCallback(
    async (storedToken: string) => {
      const response = await fetch(apiUrl('/api/v1/me'), {
        headers: authHeaders(storedToken),
      });

      if (!response.ok) {
        throw new Error('No se pudo cargar la sesión');
      }

      const data = (await response.json()) as SesionUsuario;
      setSesion(data);
      aplicarLocalActivo(data);
      return data;
    },
    [aplicarLocalActivo]
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      const storedToken = localStorage.getItem('token');
      if (!active) return;

      if (!storedToken) {
        setToken(null);
        setSesion(null);
        setLocalActivoIdState(null);
        setChecking(false);
        router.replace('/login');
        return;
      }

      setToken(storedToken);

      try {
        await cargarPerfil(storedToken);
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem(LOCAL_ACTIVO_KEY);
        if (!active) return;
        setToken(null);
        setSesion(null);
        setLocalActivoIdState(null);
        router.replace('/login');
      } finally {
        if (active) setChecking(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [router, cargarPerfil]);

  const setLocalActivoId = (id: number) => {
    if (sesion?.rol === 'GERENTE_LOCAL') return;
    setLocalActivoIdState(id);
    localStorage.setItem(LOCAL_ACTIVO_KEY, String(id));
  };

  const refrescarSesion = async () => {
    if (!token) return null;
    return cargarPerfil(token);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem(LOCAL_ACTIVO_KEY);
    setToken(null);
    setSesion(null);
    setLocalActivoIdState(null);
    router.replace('/login');
  };

  const esAdmin = sesion?.rol === 'ADMIN_RESTAURANTE';

  return {
    token,
    sesion,
    localActivoId,
    setLocalActivoId,
    checking,
    logout,
    refrescarSesion,
    esAdmin,
  };
}

/** Tras login/register: guarda token y deja que las pantallas carguen /me. */
export async function guardarSesionTrasAuth(token: string) {
  localStorage.setItem('token', token);
  localStorage.removeItem(LOCAL_ACTIVO_KEY);

  const response = await fetch(apiUrl('/api/v1/me'), {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error('No se pudo cargar el perfil tras iniciar sesión');
  }

  const perfil = (await response.json()) as SesionUsuario;
  if (perfil.rol === 'GERENTE_LOCAL') {
    const fijo = perfil.localId ?? perfil.locales[0]?.id;
    if (fijo != null) localStorage.setItem(LOCAL_ACTIVO_KEY, String(fijo));
  } else {
    const primero = perfil.locales.find((l) => l.activo)?.id ?? perfil.locales[0]?.id;
    if (primero != null) localStorage.setItem(LOCAL_ACTIVO_KEY, String(primero));
  }

  return perfil;
}

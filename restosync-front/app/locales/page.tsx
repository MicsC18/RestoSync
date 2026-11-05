'use client';

import { FormEvent, useEffect, useState } from 'react';
import AppHeader from '@/components/app-header';
import ConfirmDialog from '@/components/confirm-dialog';
import { apiUrl, authHeaders } from '@/lib/api';
import { useAuthSession, type LocalInfo } from '@/lib/use-auth-session';

type FormularioLocal = {
  nombre: string;
  direccion: string;
  activo: boolean;
};

const formVacio: FormularioLocal = {
  nombre: '',
  direccion: '',
  activo: true,
};

export default function LocalesPage() {
  const {
    token,
    checking,
    logout,
    sesion,
    localActivoId,
    setLocalActivoId,
    esAdmin,
    refrescarSesion,
  } = useAuthSession();

  const [locales, setLocales] = useState<LocalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormularioLocal>(formVacio);

  // Confirmación de eliminación (reemplaza al confirm() nativo).
  const [localAEliminar, setLocalAEliminar] = useState<LocalInfo | null>(null);

  const cargarLocales = async (storedToken: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/v1/locales'), {
        headers: authHeaders(storedToken),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'No se pudieron cargar los locales');
      }
      const data: LocalInfo[] = await response.json();
      setLocales(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar locales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (checking || !token) return;
    if (!esAdmin) {
      setLoading(false);
      return;
    }
    void cargarLocales(token);
  }, [checking, token, esAdmin]);

  const resetForm = () => {
    setEditandoId(null);
    setForm(formVacio);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setGuardando(true);
    setError('');

    try {
      const payload = {
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim() || null,
        activo: form.activo,
      };

      const response = await fetch(
        apiUrl(editandoId != null ? `/api/v1/locales/${editandoId}` : '/api/v1/locales'),
        {
          method: editandoId != null ? 'PUT' : 'POST',
          headers: authHeaders(token),
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.message || data?.error || 'No se pudo guardar el local'
        );
      }

      resetForm();
      await cargarLocales(token);
      await refrescarSesion();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const editar = (local: LocalInfo) => {
    setEditandoId(local.id);
    setForm({
      nombre: local.nombre,
      direccion: local.direccion ?? '',
      activo: local.activo,
    });
  };

  const eliminar = async (id: number) => {
    if (!token) return;

    setError('');
    try {
      const response = await fetch(apiUrl(`/api/v1/locales/${id}`), {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.message || data?.error || 'No se pudo eliminar el local'
        );
      }
      if (localActivoId === id) {
        localStorage.removeItem('localActivoId');
      }
      await cargarLocales(token);
      await refrescarSesion();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  if (checking || !token) {
    return (
      <main className="min-h-screen bg-resto-manteca flex items-center justify-center text-resto-ciruela">
        <p role="status">Verificando sesión...</p>
      </main>
    );
  }

  if (!esAdmin) {
    return (
      <main className="min-h-screen bg-resto-manteca text-resto-ciruela">
        <AppHeader
          activePage="locales"
          onLogout={logout}
          rol={sesion?.rol}
          locales={sesion?.locales ?? []}
          localActivoId={localActivoId}
          onLocalChange={setLocalActivoId}
        />
        <section className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-black">Acceso solo para admin</h2>
          <p className="mt-3 text-resto-acero">
            Los gerentes ven únicamente su propio local y no administran la lista de locales.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-resto-manteca text-resto-ciruela">
      <AppHeader
        activePage="locales"
        onLogout={logout}
        rol={sesion?.rol}
        locales={sesion?.locales ?? locales}
        localActivoId={localActivoId}
        onLocalChange={setLocalActivoId}
      />

      <section className="max-w-5xl mx-auto px-6 lg:px-10 py-10">
        <div className="mb-10">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-resto-oliva">
            Administración
          </span>
          <h2 className="text-4xl font-black mt-2">
            Locales del <span className="text-resto-oliva">restaurante.</span>
          </h2>
          <p className="mt-3 text-resto-acero max-w-2xl">
            Creá y administrá cada local. El selector del encabezado define sobre cuál estás operando inventario y el resto de la gestión.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-resto-dorado/40 bg-resto-dorado/10 px-4 py-3 text-sm" role="alert">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
          <form
            onSubmit={onSubmit}
            className="rounded-[2rem] border border-resto-ciruela/10 bg-white p-6 md:p-8 space-y-5"
          >
            <h3 className="text-xl font-black">
              {editandoId != null ? 'Editar local' : 'Nuevo local'}
            </h3>

            <div>
              <label htmlFor="nombreLocal" className="block text-sm font-semibold mb-2">
                Nombre
              </label>
              <input
                id="nombreLocal"
                required
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Sucursal Centro"
                className="w-full rounded-xl border border-resto-acero/20 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-resto-oliva"
              />
            </div>

            <div>
              <label htmlFor="direccionLocal" className="block text-sm font-semibold mb-2">
                Dirección (opcional)
              </label>
              <input
                id="direccionLocal"
                value={form.direccion}
                onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                placeholder="Calle y número"
                className="w-full rounded-xl border border-resto-acero/20 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-resto-oliva"
              />
            </div>

            <label className="flex items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                className="size-4 accent-resto-oliva"
              />
              Local activo
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={guardando}
                className="rounded-xl bg-resto-oliva px-5 py-3 text-sm font-bold text-resto-manteca hover:bg-resto-dorado hover:text-resto-ciruela disabled:opacity-60"
              >
                {guardando
                  ? 'Guardando...'
                  : editandoId != null
                    ? 'Guardar cambios'
                    : 'Crear local'}
              </button>
              {editandoId != null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-resto-ciruela/15 px-5 py-3 text-sm font-bold"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="rounded-[2rem] border border-resto-ciruela/10 bg-white overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-resto-acero" role="status">Cargando locales...</div>
            ) : locales.length === 0 ? (
              <div className="py-16 text-center">
                <p className="font-bold">Todavía no hay locales</p>
                <p className="text-sm text-resto-acero mt-1">Creá el primero con el formulario.</p>
              </div>
            ) : (
              <ul className="divide-y divide-resto-ciruela/10">
                {locales.map((local) => (
                  <li key={local.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-lg">{local.nombre}</p>
                        {localActivoId === local.id && (
                          <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-resto-oliva/15 text-resto-oliva px-2 py-1">
                            Activo en selector
                          </span>
                        )}
                        {!local.activo && (
                          <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-resto-acero/10 text-resto-acero px-2 py-1">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-resto-acero mt-1">
                        {local.direccion || 'Sin dirección cargada'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setLocalActivoId(local.id)}
                        className="rounded-lg border border-resto-oliva/30 px-3 py-2 text-xs font-bold text-resto-oliva hover:bg-resto-oliva/10"
                      >
                        Usar
                      </button>
                      <button
                        type="button"
                        onClick={() => editar(local)}
                        className="rounded-lg border border-resto-ciruela/15 px-3 py-2 text-xs font-bold"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocalAEliminar(local)}
                        className="rounded-lg border border-resto-dorado/40 px-3 py-2 text-xs font-bold text-resto-ciruela hover:bg-resto-dorado/10"
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {localAEliminar && (
        <ConfirmDialog
          titulo="Eliminar local"
          mensaje={`¿Eliminar "${localAEliminar.nombre}"? Esta acción no se puede deshacer.`}
          onCancel={() => setLocalAEliminar(null)}
          onConfirm={() => {
            const id = localAEliminar.id;
            setLocalAEliminar(null);
            void eliminar(id);
          }}
        />
      )}
    </main>
  );
}

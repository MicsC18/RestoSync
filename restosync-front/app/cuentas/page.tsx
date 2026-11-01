'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiUrl, authHeaders } from '@/lib/api';
import { useAuthSession } from '@/lib/use-auth-session';
import AppHeader from '@/components/app-header';

type CuentaGerente = {
  id: number;
  email: string;
  localId: number | null;
  localNombre: string | null;
};

type FormCuenta = { email: string; contrasena: string; localId: string };

const formVacio: FormCuenta = { email: '', contrasena: '', localId: '' };

export default function CuentasPage() {
  const { token, checking, logout, sesion, esAdmin, localActivoId, setLocalActivoId } = useAuthSession();

  const [cuentas, setCuentas] = useState<CuentaGerente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Modal alta/edición.
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormCuenta>(formVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState('');

  const locales = sesion?.locales ?? [];

  const cargarCuentas = useCallback(async () => {
    if (!token || !esAdmin) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/v1/cuentas-gerentes'), { headers: authHeaders(token) });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'No se pudieron cargar las cuentas.');
      }
      setCuentas(await response.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de conexión con el backend.');
    } finally {
      setLoading(false);
    }
  }, [token, esAdmin]);

  useEffect(() => {
    if (checking || !token || !esAdmin) return;
    void cargarCuentas();
  }, [checking, token, esAdmin, retryCount, cargarCuentas]);

  const abrirAlta = () => {
    setEditandoId(null);
    setForm({ ...formVacio, localId: locales[0] ? String(locales[0].id) : '' });
    setErrorModal('');
    setModal(true);
  };

  const abrirEdicion = (cuenta: CuentaGerente) => {
    setEditandoId(cuenta.id);
    setForm({ email: cuenta.email, contrasena: '', localId: cuenta.localId != null ? String(cuenta.localId) : '' });
    setErrorModal('');
    setModal(true);
  };

  const cerrarModal = () => {
    if (guardando) return;
    setModal(false);
    setEditandoId(null);
    setErrorModal('');
  };

  const guardarCuenta = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const email = form.email.trim();
    if (!email || !email.includes('@')) {
      setErrorModal('Ingresá un correo válido.');
      return;
    }
    if (editandoId == null && form.contrasena.length < 6) {
      setErrorModal('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (editandoId != null && form.contrasena !== '' && form.contrasena.length < 6) {
      setErrorModal('La nueva contraseña debe tener al menos 6 caracteres (o dejala vacía).');
      return;
    }
    const localId = Number(form.localId);
    if (!form.localId || !Number.isFinite(localId) || localId <= 0) {
      setErrorModal('Asigná un local al gerente.');
      return;
    }

    setGuardando(true);
    setErrorModal('');
    try {
      const payload = {
        email,
        contrasena: form.contrasena === '' ? null : form.contrasena,
        localId,
      };
      const response = await fetch(
        apiUrl(editandoId != null ? `/api/v1/cuentas-gerentes/${editandoId}` : '/api/v1/cuentas-gerentes'),
        {
          method: editandoId != null ? 'PUT' : 'POST',
          headers: authHeaders(token),
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'No se pudo guardar la cuenta.');
      }
      setModal(false);
      setEditandoId(null);
      setExito(
        editandoId != null
          ? 'Cuenta actualizada. Si cambiaste el local, el gerente debe volver a iniciar sesión.'
          : `Cuenta creada. El gerente ya puede iniciar sesión con ${email}.`
      );
      setRetryCount((c) => c + 1);
    } catch (err: unknown) {
      setErrorModal(err instanceof Error ? err.message : 'Error al guardar la cuenta.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarCuenta = async (cuenta: CuentaGerente) => {
    if (!token) return;
    if (!window.confirm(`¿Eliminar la cuenta "${cuenta.email}"? Solo es posible si todavía no registró movimientos.`)) return;
    setError('');
    try {
      const response = await fetch(apiUrl(`/api/v1/cuentas-gerentes/${cuenta.id}`), {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'No se pudo eliminar la cuenta.');
      }
      setExito(`Cuenta "${cuenta.email}" eliminada.`);
      setRetryCount((c) => c + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la cuenta.');
    }
  };

  if (checking || !token) {
    return (
      <main className="min-h-screen bg-resto-manteca flex items-center justify-center text-resto-ciruela">
        <p>Verificando sesión...</p>
      </main>
    );
  }

  // Solo el Admin del restaurante gestiona cuentas de gerentes.
  if (!esAdmin) {
    return (
      <main className="min-h-screen bg-resto-manteca text-resto-ciruela">
        <AppHeader
          activePage="cuentas"
          onLogout={logout}
          rol={sesion?.rol}
          locales={locales}
          localActivoId={localActivoId}
          onLocalChange={setLocalActivoId}
        />
        <section className="max-w-3xl mx-auto px-6 py-20 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-2xl font-black">Sección solo para el administrador</h2>
          <p className="text-resto-acero mt-3">
            Las cuentas de gerentes las gestiona el admin del restaurante. Vos operás tu local
            desde el Inicio.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-resto-manteca text-resto-ciruela">
      <AppHeader
        activePage="cuentas"
        onLogout={logout}
        rol={sesion?.rol}
        locales={locales}
        localActivoId={localActivoId}
        onLocalChange={setLocalActivoId}
      />

      <section className="max-w-5xl mx-auto px-6 lg:px-10 py-10">
        {/* ENCABEZADO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-resto-dorado/10 border border-resto-dorado/20 text-resto-dorado text-xs font-bold uppercase tracking-wider mb-4">
              <span className="w-2 h-2 rounded-full bg-resto-dorado" />
              Administración
            </div>
            <h2 className="text-4xl md:text-5xl font-black leading-tight">
              Cuentas de <span className="text-resto-oliva">gerentes.</span>
            </h2>
            <p className="mt-4 text-resto-acero max-w-xl leading-relaxed">
              Creá una cuenta por cada encargado y asignale un local. El gerente entra directo
              a su local y solo ve sus datos: inventario, menú y mesas.
            </p>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              onClick={abrirAlta}
              disabled={locales.length === 0}
              title={locales.length === 0 ? 'Creá un local primero' : 'Crear cuenta de gerente'}
              className="px-6 py-3.5 rounded-xl bg-resto-oliva text-resto-manteca font-bold hover:bg-resto-dorado hover:text-resto-ciruela transition-all shadow-lg shadow-resto-oliva/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Nueva cuenta
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-resto-dorado/40 bg-resto-dorado/10 px-4 py-3 text-sm" role="alert">
            {error}
          </div>
        )}
        {exito && (
          <div className="mb-6 rounded-xl border border-resto-oliva/40 bg-resto-oliva/10 px-4 py-3 text-sm font-semibold text-resto-oliva" role="status">
            {exito}
          </div>
        )}

        {/* TABLA DE CUENTAS */}
        <div className="bg-white rounded-[2rem] border border-resto-ciruela/10 overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-resto-oliva/20 border-t-resto-oliva animate-spin" />
              <p className="text-resto-acero font-semibold">Cargando las cuentas...</p>
            </div>
          ) : cuentas.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-4">👤</div>
              <h3 className="text-lg font-bold">Todavía no hay gerentes</h3>
              <p className="text-resto-acero text-sm mt-1">
                Creá la primera cuenta con &quot;+ Nueva cuenta&quot; y asignale un local.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-resto-manteca/50 border-b border-resto-ciruela/10 text-xs uppercase tracking-wider font-bold text-resto-acero">
                    <th className="p-5 font-bold">Correo</th>
                    <th className="p-5 font-bold">Local asignado</th>
                    <th className="p-5 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-resto-ciruela/5">
                  {cuentas.map((cuenta) => (
                    <tr key={cuenta.id} className="hover:bg-resto-manteca/30 transition-colors">
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-resto-oliva/10 flex items-center justify-center text-lg shrink-0">
                            👤
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold truncate">{cuenta.email}</p>
                            <p className="text-xs text-resto-acero mt-0.5">Gerente de local</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border bg-resto-manteca border-resto-acero/20 text-resto-ciruela">
                          {cuenta.localNombre ?? 'Sin local'}
                        </span>
                      </td>
                      <td className="p-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(cuenta)}
                          title={`Editar ${cuenta.email}`}
                          aria-label={`Editar ${cuenta.email}`}
                          className="w-9 h-9 rounded-lg border border-resto-ciruela/10 text-resto-acero hover:border-resto-oliva hover:text-resto-oliva transition-colors"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => void eliminarCuenta(cuenta)}
                          title={`Eliminar ${cuenta.email}`}
                          aria-label={`Eliminar ${cuenta.email}`}
                          className="ml-2 w-9 h-9 rounded-lg border border-resto-ciruela/10 text-resto-acero hover:border-resto-dorado hover:text-resto-dorado transition-colors"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[11px] text-resto-acero mt-4">
          Una cuenta con movimientos de stock o platos preparados no se puede eliminar (la auditoría
          se conserva); podés reasignarla de local o cambiarle la contraseña. Si reasignás el local,
          el gerente debe volver a iniciar sesión.
        </p>
      </section>

      {/* MODAL ALTA / EDICIÓN */}
      {modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-resto-ciruela/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <form onSubmit={guardarCuenta} className="w-full max-w-md rounded-[2rem] bg-white p-6 md:p-8 shadow-xl">
            <h3 className="text-2xl font-black">{editandoId != null ? 'Editar cuenta' : 'Nueva cuenta de gerente'}</h3>
            <p className="text-sm text-resto-acero mt-2">
              {editandoId != null
                ? 'Corregí el correo, reasigná el local o blanqueá la contraseña.'
                : 'El gerente inicia sesión con este correo y contraseña, y entra directo a su local.'}
            </p>

            {errorModal && (
              <div className="mt-4 rounded-xl border border-resto-dorado/40 bg-resto-dorado/10 px-4 py-3 text-sm" role="alert">
                {errorModal}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="cuentaEmail" className="block text-sm font-semibold mb-1.5">Correo</label>
                <input
                  id="cuentaEmail"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="gerente@turestaurante.com"
                  className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                />
              </div>
              <div>
                <label htmlFor="cuentaContrasena" className="block text-sm font-semibold mb-1.5">
                  {editandoId != null ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                </label>
                <input
                  id="cuentaContrasena"
                  type="password"
                  required={editandoId == null}
                  minLength={editandoId == null ? 6 : undefined}
                  value={form.contrasena}
                  onChange={(e) => setForm((f) => ({ ...f, contrasena: e.target.value }))}
                  placeholder={editandoId != null ? 'Dejala vacía para mantener la actual' : 'Mínimo 6 caracteres'}
                  className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                />
              </div>
              <div>
                <label htmlFor="cuentaLocal" className="block text-sm font-semibold mb-1.5">Local asignado</label>
                <select
                  id="cuentaLocal"
                  required
                  value={form.localId}
                  onChange={(e) => setForm((f) => ({ ...f, localId: e.target.value }))}
                  className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                >
                  <option value="" disabled>Elegí un local</option>
                  {locales.map((local) => (
                    <option key={local.id} value={local.id}>
                      {local.nombre}
                      {!local.activo ? ' (inactivo)' : ''}
                    </option>
                  ))}
                </select>
                {editandoId != null && (
                  <p className="text-[11px] text-resto-acero mt-1.5">
                    Si cambiás el local, el gerente debe volver a iniciar sesión para verlo.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={guardando}
                className="rounded-xl bg-resto-oliva px-5 py-3 text-sm font-bold text-resto-manteca hover:bg-resto-dorado hover:text-resto-ciruela disabled:opacity-60"
              >
                {guardando ? 'Guardando...' : editandoId != null ? 'Guardar cambios' : 'Crear cuenta'}
              </button>
              <button type="button" onClick={cerrarModal} className="rounded-xl border border-resto-ciruela/15 px-5 py-3 text-sm font-bold">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
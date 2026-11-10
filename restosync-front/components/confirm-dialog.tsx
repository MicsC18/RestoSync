'use client';

import Modal from './modal';

type ConfirmDialogProps = {
  titulo: string;
  /** Mensaje explicativo, p. ej. "¿Eliminar leche del inventario? Se borran también sus lotes." */
  mensaje: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Texto del botón de confirmación (por defecto "Eliminar"). */
  confirmText?: string;
};

/**
 * Diálogo de confirmación para acciones destructivas (reemplaza al confirm()
 * nativo). Reutiliza el Modal compartido: cierra con Escape y click afuera.
 */
export default function ConfirmDialog({
  titulo,
  mensaje,
  onConfirm,
  onCancel,
  confirmText = 'Eliminar',
}: ConfirmDialogProps) {
  return (
    <Modal ariaLabel={titulo} onClose={onCancel} closeOnBackdrop>
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 md:p-8 shadow-xl">
        <h3 className="text-xl font-black text-resto-ciruela">{titulo}</h3>
        <p className="text-sm text-resto-acero mt-3 leading-relaxed">{mensaje}</p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-resto-ciruela px-5 py-3 text-sm font-bold text-resto-manteca hover:opacity-90 transition-opacity"
          >
            {confirmText}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-resto-ciruela/15 px-5 py-3 text-sm font-bold hover:bg-resto-manteca transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}

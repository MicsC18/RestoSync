'use client';

import { useEffect, useRef, type ReactNode } from 'react';

type ModalProps = {
  /** Etiqueta accesible del diálogo (p. ej. "Corregir insumo"). */
  ariaLabel: string;
  /** Se dispara con Escape y, si closeOnBackdrop=true, al clickear el fondo. */
  onClose: () => void;
  /** Permite cerrar clickeando fuera del contenido (modales informativos). */
  closeOnBackdrop?: boolean;
  children: ReactNode;
};

/**
 * Fondo de modal compartido: overlay fijo con semántica de diálogo,
 * cierre por Escape/click-fuera y foco inicial en el contenedor.
 * El contenido (form o panel) queda a cargo de cada página.
 */
export default function Modal({ ariaLabel, onClose, closeOnBackdrop = false, children }: ModalProps) {
  const fondoRef = useRef<HTMLDivElement>(null);
  // Guardamos onClose en una ref para que el efecto de abajo corra solo al
  // montar: si no, cada re-render (p. ej. al tipear en un input) reenfocaría
  // el contenedor del diálogo y se llevaría el foco del input.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKeyDown = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    // Llevar el foco al diálogo al abrir (evita que Escape/lector de pantalla
    // queden en el contenido de fondo).
    fondoRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={fondoRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-resto-ciruela/40 backdrop-blur-sm p-4 outline-none"
    >
      {children}
    </div>
  );
}

package com.restosync.core.model

import jakarta.persistence.*
import java.time.LocalDateTime

/** Tipos de movimiento de stock auditables (es-AR). */
enum class TipoMovimiento {
    ENTRADA,
    SALIDA,
    MERMA,
    PRODUCCION,
    AJUSTE
}

/**
 * Auditoría de stock unificada contra `Insumo` + `Lote` (reemplaza el vínculo legacy a `Alimento`).
 * Las FK nuevas se declaran nullable en el mapping para que `ddl-auto=update` pueda agregarlas
 * a la tabla existente en Neon (PostgreSQL rechaza ADD COLUMN NOT NULL sin default con filas previas);
 * el servicio siempre las completa.
 */
@Entity
@Table(name = "movimientos_stock")
class MovimientoStock(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var tipo: TipoMovimiento = TipoMovimiento.ENTRADA,

    @Column(nullable = false)
    var cantidad: Double = 0.0,

    @Column(nullable = false)
    var fechaHora: LocalDateTime = LocalDateTime.now(),

    /** Detalle legible: "Alta por ticket", "Corrección manual", etc. */
    var motivo: String? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "insumo_id")
    var insumo: Insumo? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lote_id")
    var lote: Lote? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    var usuario: Usuario? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "local_id")
    var local: Local? = null
)
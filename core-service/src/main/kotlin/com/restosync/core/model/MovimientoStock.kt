package com.restosync.core.model

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "movimientos_stock")
class MovimientoStock(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    var tipo: String? = null, // ENTRADA, SALIDA, MERMA
    var cantidad: Double? = null,
    var fechaHora: LocalDateTime? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "alimento_id", nullable = false)
    var alimento: Alimento? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    var usuario: Usuario? = null
)
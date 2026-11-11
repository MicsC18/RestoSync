package com.restosync.core.model

import jakarta.persistence.*
import java.time.LocalDateTime

/**
 * Un plato preparado para una mesa (puente entre el menú y el mapa de mesas).
 *
 * Guarda snapshots de nombre (`platoNombre`, `mesaNombre`) para que el historial de
 * producción sobreviva aunque después se borre el plato o la mesa. Las FK `plato` y
 * `mesa` son nullable: al borrar el plato/mesa se desvinculan, no se borra la auditoría.
 * `local` y `usuario` sí son obligatorios (tabla nueva, sin filas legacy).
 */
@Entity
@Table(name = "producciones")
class Produccion(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plato_id")
    var plato: Plato? = null,

    @Column(nullable = false)
    var platoNombre: String = "",

    @Column(nullable = false)
    var cantidad: Double = 1.0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mesa_id")
    var mesa: Mesa? = null,

    var mesaNombre: String? = null,

    @Column(nullable = false)
    var fechaHora: LocalDateTime = LocalDateTime.now(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "local_id", nullable = false)
    var local: Local? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    var usuario: Usuario? = null
)
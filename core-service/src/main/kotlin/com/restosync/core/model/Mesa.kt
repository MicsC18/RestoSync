package com.restosync.core.model

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import jakarta.persistence.*

/** Estados básicos de una mesa (sin pagos ni cuenta abierta). */
enum class EstadoMesa {
    LIBRE,
    OCUPADA,
    RESERVADA
}

/**
 * Mesa del mapa de un local. El backend (CRUD) se adelanta a Fase 3 para que
 * "preparar un plato para una mesa" tenga una entidad real; el mapa visual
 * `/mesas` (posición, arrastrar, estados) se construye en Fase 4.
 */
@Entity
@Table(name = "mesas")
@JsonIgnoreProperties(ignoreUnknown = true)
data class Mesa(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val nombre: String = "",

    val capacidad: Int? = null,

    val posicionX: Double? = null,

    val posicionY: Double? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    val estado: EstadoMesa = EstadoMesa.LIBRE,

    @JsonIgnore
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "local_id", nullable = false)
    val local: Local? = null
)
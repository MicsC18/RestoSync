package com.restosync.core.model

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import jakarta.persistence.*
import java.time.LocalDateTime

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

    /**
     * Inicio de la ocupación actual (Plan-Mesas-Dictado §1). Solo tiene valor con
     * estado OCUPADA: marca desde qué momento la mesa muestra sus "platos actuales";
     * al liberarse se pone null y la historia sigue intacta en `producciones`.
     */
    val fechaOcupacion: LocalDateTime? = null,

    @JsonIgnore
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "local_id", nullable = false)
    val local: Local? = null
)
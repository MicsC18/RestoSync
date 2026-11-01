package com.restosync.core.model

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import jakarta.persistence.*

/**
 * Ítem del menú de un local. El precio es solo informativo (no hay cobros).
 * Los ingredientes viven en `RecetaInsumo`; al preparar se descuentan del stock
 * agrupando las filas homónimas del local (§4.4 del plan).
 */
@Entity
@Table(name = "platos")
@JsonIgnoreProperties(ignoreUnknown = true)
data class Plato(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val nombre: String = "",

    val descripcion: String? = null,

    /** Informativo; el proyecto no implementa pagos. */
    val precio: Double? = null,

    @Column(nullable = false)
    val activo: Boolean = true,

    @JsonIgnore
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "local_id", nullable = false)
    val local: Local? = null
)
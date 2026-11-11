package com.restosync.core.model

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import jakarta.persistence.*

/**
 * Línea de receta: un ingrediente del plato con su cantidad.
 *
 * `insumo` referencia una fila concreta del inventario (una por vencimiento),
 * pero al preparar el stock se calcula y descuenta **agrupando las filas homónimas**
 * del local por nombre (FIFO por vencimiento). Por eso la fila referenciada
 * nunca se elimina al quedar en cero: rompería esta FK y la auditoría.
 */
@Entity
@Table(name = "receta_insumos")
@JsonIgnoreProperties(ignoreUnknown = true)
data class RecetaInsumo(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plato_id", nullable = false)
    val plato: Plato? = null,

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "insumo_id", nullable = false)
    val insumo: Insumo? = null,

    @Column(nullable = false)
    val cantidad: Double = 0.0
)
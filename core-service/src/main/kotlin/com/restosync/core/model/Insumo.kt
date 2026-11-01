package com.restosync.core.model

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import jakarta.persistence.*

@Entity
@Table(name = "insumos")
@JsonIgnoreProperties(ignoreUnknown = true)
data class Insumo(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    val nombre: String = "",
    val categoria: String? = "Almacén",
    val icono: String? = "📦",
    val unidadMedida: String = "Unidades",
    val stockMinimo: Double? = 1.0,
    val cantidad: Double? = 1.0,
    val diasRestantes: Int = 30,
    val estado: String = "Cerrado",
    val vencimiento: String? = null,

    /** Scope real del inventario (por local). */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "local_id", nullable = true)
    var local: Local? = null,

    /**
     * Columna legacy todavía presente en Neon con NOT NULL.
     * Se rellena desde el local para no romper inserts hasta migrar del todo.
     */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurante_id", nullable = true)
    var restaurante: Restaurante? = null
)

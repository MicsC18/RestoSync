package com.restosync.core.model

import jakarta.persistence.*

@Entity
@Table(name = "alimentos")
class Alimento(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    var nombre: String? = null,
    var categoria: String? = null,
    var unidadMedida: String? = null,
    var stockMinimo: Double? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurante_id", nullable = false)
    var restaurante: Restaurante? = null
)
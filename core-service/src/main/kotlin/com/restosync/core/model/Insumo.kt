package com.restosync.core.model

import jakarta.persistence.*

@Entity
@Table(name = "insumos")
data class Insumo(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    val nombre: String = "",
    val unidadMedida: String = "",
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurante_id", nullable = false)
    val restaurante: Restaurante
)
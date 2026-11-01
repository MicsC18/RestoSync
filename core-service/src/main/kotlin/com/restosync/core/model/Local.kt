package com.restosync.core.model

import jakarta.persistence.*

@Entity
@Table(name = "locales")
data class Local(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val nombre: String = "",

    val direccion: String? = null,

    @Column(nullable = false)
    val activo: Boolean = true,

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "restaurante_id", nullable = false)
    val restaurante: Restaurante
)

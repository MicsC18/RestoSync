package com.restosync.core.model

import jakarta.persistence.*

@Entity
@Table(name = "usuarios")
data class Usuario(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(unique = true, nullable = false)
    val email: String = "",

    @Column(nullable = false)
    val contrasena: String = "", 

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurante_id", nullable = false)
    val restaurante: Restaurante
)
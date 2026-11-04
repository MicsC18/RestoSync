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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @org.hibernate.annotations.ColumnDefault("'ADMIN_RESTAURANTE'")
    val rol: RolUsuario = RolUsuario.ADMIN_RESTAURANTE,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurante_id", nullable = false)
    val restaurante: Restaurante,

    /** Solo para GERENTE_LOCAL. Admin opera con selector de local. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "local_id", nullable = true)
    val local: Local? = null
)

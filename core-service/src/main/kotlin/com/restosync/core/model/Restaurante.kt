package com.restosync.core.model

import jakarta.persistence.*

@Entity
@Table(name = "restaurantes")
data class Restaurante(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    val nombre: String = ""
)
package com.restosync.core.model

import jakarta.persistence.*
import java.time.LocalDate

@Entity
@Table(name = "lotes")
data class Lote(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    val cantidad: Double, 
    val fechaIngreso: LocalDate = LocalDate.now(), 
    val fechaVencimiento: LocalDate,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "insumo_id", nullable = false)
    val insumo: Insumo
)
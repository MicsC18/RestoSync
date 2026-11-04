package com.restosync.core.model

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty
import jakarta.persistence.*
import java.time.LocalDate

@Entity
@Table(name = "lotes")
@JsonIgnoreProperties(ignoreUnknown = true)
data class Lote(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    val cantidad: Double, 
    val fechaIngreso: LocalDate = LocalDate.now(), 
    val fechaVencimiento: LocalDate,
    /** Solo entrada (POST con insumo.id); no se serializa para evitar el proxy lazy. */
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "insumo_id", nullable = false)
    val insumo: Insumo
)
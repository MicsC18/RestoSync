package com.restosync.core.controller

import com.restosync.core.model.Lote
import com.restosync.core.repository.LoteRepository
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/lotes")
class LoteController(
    private val loteRepository: LoteRepository
) {

    @PostMapping
    fun crearLote(@RequestBody lote: Lote): Lote {
        return loteRepository.save(lote)
    }

    @GetMapping("/insumo/{insumoId}")
    fun obtenerPorInsumo(@PathVariable insumoId: Long): List < Lote > {
        return loteRepository.findByInsumoIdOrderByFechaVencimientoAsc(insumoId)
    }
}
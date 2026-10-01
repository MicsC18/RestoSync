package com.restosync.core.controller

import com.restosync.core.model.Insumo
import com.restosync.core.repository.InsumoRepository
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/insumos")
@CrossOrigin(origins = ["http://localhost:3000"])
class InsumoController(
    private val insumoRepository: InsumoRepository
) {

    @GetMapping
    fun obtenerTodos(): List <Insumo> {
        return insumoRepository.findAll()
    }

    @PostMapping
    fun crearInsumo(@RequestBody insumo: Insumo): Insumo {
        return insumoRepository.save(insumo)
    }
}
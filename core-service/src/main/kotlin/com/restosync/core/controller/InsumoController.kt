package com.restosync.core.controller

import com.restosync.core.model.Insumo
import com.restosync.core.repository.InsumoRepository
import com.restosync.core.repository.RestauranteRepository
import com.restosync.core.service.JwtService
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/insumos")
@CrossOrigin(origins = ["http://localhost:3000"])
class InsumoController(
    private val insumoRepository: InsumoRepository,
    private val restauranteRepository: RestauranteRepository,
    private val jwtService: JwtService
) {

    @GetMapping
    fun obtenerTodos(
        @RequestHeader(value = "Authorization", required = false) authHeader: String?
    ): List<Insumo> {
        val restauranteId = authHeader?.let { jwtService.extraerRestauranteId(it) }
        return if (restauranteId != null) {
            val lista = insumoRepository.findByRestauranteId(restauranteId)
            if (lista.isNotEmpty()) lista else insumoRepository.findAll()
        } else {
            insumoRepository.findAll()
        }
    }

    @PostMapping
    fun crearInsumo(
        @RequestBody insumo: Insumo,
        @RequestHeader(value = "Authorization", required = false) authHeader: String?
    ): Insumo {
        val restauranteId = authHeader?.let { jwtService.extraerRestauranteId(it) }
        val restaurante = restauranteId?.let { restauranteRepository.findById(it).orElse(null) }
            ?: restauranteRepository.findAll().firstOrNull()

        insumo.restaurante = restaurante
        return insumoRepository.save(insumo)
    }
}
package com.restosync.core.controller

import com.restosync.core.model.Restaurante
import com.restosync.core.repository.RestauranteRepository
import com.restosync.core.security.SecurityUtils
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/restaurantes")
class RestauranteController(
    private val restauranteRepository: RestauranteRepository
) {

    @GetMapping("/ping")
    fun ping(): String {
        SecurityUtils.principalActual()
        return "¡El backend de RestoSync está vivo y funcionando!"
    }

    @GetMapping
    fun obtenerTodos(): List<Restaurante> {
        val principal = SecurityUtils.principalActual()
        return restauranteRepository.findById(principal.restauranteId)
            .map { listOf(it) }
            .orElse(emptyList())
    }
}

package com.restosync.core.controller

import com.restosync.core.model.Restaurante
import com.restosync.core.repository.RestauranteRepository
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/restaurantes")
class RestauranteController(
    private val restauranteRepository: RestauranteRepository
) {

    @GetMapping("/ping")
    fun ping(): String {
        return "¡El backend de RestoSync está vivo y funcionando!"
    }

    // Endpoint GET para listar todos los restaurantes guardados
   @GetMapping
   fun obtenerTodos(): List<Restaurante> {
        return restauranteRepository.findAll()
    }
    // Endpoint POST para registrar un nuevo restaurante
    @PostMapping
    fun crearRestaurante(@RequestBody restaurante: Restaurante): Restaurante {
        return restauranteRepository.save(restaurante)
    }
}
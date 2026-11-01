package com.restosync.core.service

import com.restosync.core.dto.LocalDto
import com.restosync.core.dto.LocalRequest
import com.restosync.core.model.Local
import com.restosync.core.repository.LocalRepository
import com.restosync.core.repository.RestauranteRepository
import com.restosync.core.security.UsuarioPrincipal
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@Service
class LocalService(
    private val localRepository: LocalRepository,
    private val restauranteRepository: RestauranteRepository,
    private val localContextService: LocalContextService
) {

    @Transactional(readOnly = true)
    fun listar(principal: UsuarioPrincipal): List<LocalDto> {
        localContextService.exigirAdmin(principal)
        return localRepository.findByRestauranteId(principal.restauranteId).map { it.toDto() }
    }

    @Transactional
    fun crear(principal: UsuarioPrincipal, request: LocalRequest): LocalDto {
        localContextService.exigirAdmin(principal)
        validarNombre(request.nombre)

        val restaurante = restauranteRepository.findById(principal.restauranteId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurante no encontrado")
        }

        val local = localRepository.save(
            Local(
                nombre = request.nombre.trim(),
                direccion = request.direccion?.trim()?.ifBlank { null },
                activo = request.activo,
                restaurante = restaurante
            )
        )
        return local.toDto()
    }

    @Transactional
    fun actualizar(principal: UsuarioPrincipal, id: Long, request: LocalRequest): LocalDto {
        localContextService.exigirAdmin(principal)
        validarNombre(request.nombre)

        val existente = localRepository.findByRestauranteIdAndId(principal.restauranteId, id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Local no encontrado")

        val actualizado = localRepository.save(
            existente.copy(
                nombre = request.nombre.trim(),
                direccion = request.direccion?.trim()?.ifBlank { null },
                activo = request.activo
            )
        )
        return actualizado.toDto()
    }

    @Transactional
    fun eliminar(principal: UsuarioPrincipal, id: Long) {
        localContextService.exigirAdmin(principal)
        val existente = localRepository.findByRestauranteIdAndId(principal.restauranteId, id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Local no encontrado")

        val cantidad = localRepository.findByRestauranteId(principal.restauranteId).size
        if (cantidad <= 1) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "No podés eliminar el único local del restaurante"
            )
        }

        localRepository.delete(existente)
    }

    private fun validarNombre(nombre: String) {
        if (nombre.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre del local es obligatorio")
        }
    }

    private fun Local.toDto() = LocalDto(
        id = id,
        nombre = nombre,
        direccion = direccion,
        activo = activo
    )
}

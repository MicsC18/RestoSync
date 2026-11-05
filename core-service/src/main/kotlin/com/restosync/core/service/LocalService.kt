package com.restosync.core.service

import com.restosync.core.dto.LocalDto
import com.restosync.core.dto.LocalRequest
import com.restosync.core.model.Local
import com.restosync.core.repository.InsumoRepository
import com.restosync.core.repository.LocalRepository
import com.restosync.core.repository.MesaRepository
import com.restosync.core.repository.PlatoRepository
import com.restosync.core.repository.ProduccionRepository
import com.restosync.core.repository.RestauranteRepository
import com.restosync.core.repository.UsuarioRepository
import com.restosync.core.security.UsuarioPrincipal
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@Service
class LocalService(
    private val localRepository: LocalRepository,
    private val restauranteRepository: RestauranteRepository,
    private val localContextService: LocalContextService,
    private val insumoRepository: InsumoRepository,
    private val mesaRepository: MesaRepository,
    private val platoRepository: PlatoRepository,
    private val usuarioRepository: UsuarioRepository,
    private val produccionRepository: ProduccionRepository
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

        // Validación de integridad: si el local tiene datos asociados, se rechaza la eliminación
        // con un mensaje amigable para evitar fallos de clave foránea en la base de datos.
        val insumos = insumoRepository.countByLocalId(id)
        val mesas = mesaRepository.countByLocalId(id)
        val platos = platoRepository.countByLocalId(id)
        val gerentes = usuarioRepository.countByLocalId(id)
        val producciones = produccionRepository.countByLocalId(id)

        val dependencias = mutableListOf<String>()
        if (insumos > 0) dependencias.add("$insumos insumo(s)")
        if (mesas > 0) dependencias.add("$mesas mesa(s)")
        if (platos > 0) dependencias.add("$platos plato(s) en el menú")
        if (gerentes > 0) dependencias.add("$gerentes gerente(s) asignado(s)")
        if (producciones > 0) dependencias.add("$producciones preparación(es) registradas")

        if (dependencias.isNotEmpty()) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "No podés eliminar el local '${existente.nombre}': tiene datos asociados (${dependencias.joinToString(", ")}). " +
                    "Reasigná o eliminá estos datos primero para poder borrar la sucursal."
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

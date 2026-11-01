package com.restosync.core.service

import com.restosync.core.dto.LocalDto
import com.restosync.core.dto.MeResponse
import com.restosync.core.model.RolUsuario
import com.restosync.core.repository.LocalRepository
import com.restosync.core.repository.UsuarioRepository
import com.restosync.core.security.UsuarioPrincipal
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@Service
class MeService(
    private val usuarioRepository: UsuarioRepository,
    private val localRepository: LocalRepository
) {

    @Transactional(readOnly = true)
    fun obtenerPerfil(principal: UsuarioPrincipal): MeResponse {
        val usuario = usuarioRepository.findById(principal.usuarioId).orElseThrow {
            ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado")
        }

        val locales = when (usuario.rol) {
            RolUsuario.ADMIN_RESTAURANTE ->
                localRepository.findByRestauranteId(usuario.restaurante.id)
            RolUsuario.GERENTE_LOCAL ->
                listOfNotNull(usuario.local)
        }.map {
            LocalDto(
                id = it.id,
                nombre = it.nombre,
                direccion = it.direccion,
                activo = it.activo
            )
        }

        return MeResponse(
            usuarioId = usuario.id,
            email = usuario.email,
            rol = usuario.rol.name,
            restauranteId = usuario.restaurante.id,
            restauranteNombre = usuario.restaurante.nombre,
            localId = usuario.local?.id,
            locales = locales
        )
    }
}

package com.restosync.core.service

import com.restosync.core.model.Local
import com.restosync.core.model.RolUsuario
import com.restosync.core.repository.LocalRepository
import com.restosync.core.security.UsuarioPrincipal
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException

@Service
class LocalContextService(
    private val localRepository: LocalRepository
) {

    /**
     * Gerente: siempre su local fijo.
     * Admin: usa X-Local-Id y valida que pertenezca a su restaurante.
     */
    fun resolverLocal(principal: UsuarioPrincipal, headerLocalId: Long?): Local {
        if (principal.rol == RolUsuario.GERENTE_LOCAL) {
            val localId = principal.localId
                ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "El gerente no tiene local asignado")
            return localRepository.findById(localId).orElseThrow {
                ResponseStatusException(HttpStatus.FORBIDDEN, "Local del gerente no encontrado")
            }
        }

        if (headerLocalId == null) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Debés indicar el local con el encabezado X-Local-Id"
            )
        }

        val local = localRepository.findByRestauranteIdAndId(principal.restauranteId, headerLocalId)
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "No tenés acceso a ese local")

        if (!local.activo) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "El local está inactivo")
        }

        return local
    }

    fun exigirAdmin(principal: UsuarioPrincipal) {
        if (principal.rol != RolUsuario.ADMIN_RESTAURANTE) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el admin del restaurante puede hacer esto")
        }
    }
}

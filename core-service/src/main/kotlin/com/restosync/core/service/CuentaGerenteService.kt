package com.restosync.core.service

import com.restosync.core.dto.CuentaGerenteDto
import com.restosync.core.dto.CuentaGerenteRequest
import com.restosync.core.model.Local
import com.restosync.core.model.RolUsuario
import com.restosync.core.model.Usuario
import com.restosync.core.repository.LocalRepository
import com.restosync.core.repository.MovimientoStockRepository
import com.restosync.core.repository.ProduccionRepository
import com.restosync.core.repository.RestauranteRepository
import com.restosync.core.repository.UsuarioRepository
import com.restosync.core.security.UsuarioPrincipal
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

/**
 * ABM de cuentas de gerente. Solo el Admin del restaurante puede operarlas;
 * el gerente creado queda con `rol=GERENTE_LOCAL` y un local del mismo restaurante.
 * El signup público sigue creando únicamente Admins.
 */
@Service
class CuentaGerenteService(
    private val usuarioRepository: UsuarioRepository,
    private val restauranteRepository: RestauranteRepository,
    private val localRepository: LocalRepository,
    private val movimientoStockRepository: MovimientoStockRepository,
    private val produccionRepository: ProduccionRepository,
    private val passwordEncoder: PasswordEncoder,
    private val localContextService: LocalContextService
) {

    @Transactional(readOnly = true)
    fun listar(principal: UsuarioPrincipal): List<CuentaGerenteDto> {
        localContextService.exigirAdmin(principal)
        return usuarioRepository.findByRestauranteIdAndRol(principal.restauranteId, RolUsuario.GERENTE_LOCAL)
            .sortedBy { it.email }
            .map { it.aDto() }
    }

    @Transactional
    fun crear(principal: UsuarioPrincipal, request: CuentaGerenteRequest): CuentaGerenteDto {
        localContextService.exigirAdmin(principal)
        val email = normalizarEmail(request.email)
        validarEmailNuevo(email)
        val contrasena = validarContrasena(request.contrasena, obligatoria = true)
        val local = localDelRestaurante(principal, request.localId)

        val restaurante = restauranteRepository.findById(principal.restauranteId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurante no encontrado")
        }

        val gerente = usuarioRepository.save(
            Usuario(
                email = email,
                contrasena = passwordEncoder.encode(contrasena) ?: "",
                rol = RolUsuario.GERENTE_LOCAL,
                restaurante = restaurante,
                local = local
            )
        )
        return gerente.aDto()
    }

    @Transactional
    fun actualizar(principal: UsuarioPrincipal, id: Long, request: CuentaGerenteRequest): CuentaGerenteDto {
        localContextService.exigirAdmin(principal)
        val gerente = gerenteDelRestaurante(principal, id)

        // Email: solo se cambia si se informa uno distinto.
        val email = request.email.trim().lowercase()
        val emailFinal = if (email.isBlank() || email == gerente.email) {
            gerente.email
        } else {
            validarFormatoEmail(email)
            usuarioRepository.findByEmail(email).ifPresent { existente ->
                if (existente.id != gerente.id) {
                    throw ResponseStatusException(HttpStatus.CONFLICT, "El correo ya está registrado")
                }
            }
            email
        }

        // Contraseña: en blanco mantiene la actual (nunca se devuelve el hash).
        val contrasenaFinal = if (request.contrasena.isNullOrBlank()) {
            gerente.contrasena
        } else {
            passwordEncoder.encode(validarContrasena(request.contrasena, obligatoria = true)) ?: ""
        }

        // Local: solo se reasigna si se informa uno válido del mismo restaurante.
        val localFinal = if (request.localId <= 0 || request.localId == gerente.local?.id) {
            gerente.local
        } else {
            localDelRestaurante(principal, request.localId)
        }

        return usuarioRepository.save(
            gerente.copy(email = emailFinal, contrasena = contrasenaFinal, local = localFinal)
        ).aDto()
    }

    @Transactional
    fun eliminar(principal: UsuarioPrincipal, id: Long) {
        localContextService.exigirAdmin(principal)
        val gerente = gerenteDelRestaurante(principal, id)

        // La auditoría referencia al usuario con FK NOT NULL: si ya operó, no se puede borrar.
        val movimientos = movimientoStockRepository.countByUsuarioId(gerente.id)
        val producciones = produccionRepository.countByUsuarioId(gerente.id)
        if (movimientos > 0 || producciones > 0) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "No se puede eliminar la cuenta: tiene $movimientos movimiento(s) de stock y " +
                    "$producciones plato(s) preparados registrados. La auditoría debe conservarse; " +
                    "podés reasignarla a otro local o cambiarle la contraseña."
            )
        }

        usuarioRepository.delete(gerente)
    }

    // =========================
    // Helpers
    // =========================

    /** Valida que el usuario exista, sea gerente y pertenezca al restaurante del admin. */
    private fun gerenteDelRestaurante(principal: UsuarioPrincipal, id: Long): Usuario {
        val usuario = usuarioRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Cuenta de gerente no encontrada")
        }
        if (usuario.rol != RolUsuario.GERENTE_LOCAL || usuario.restaurante.id != principal.restauranteId) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Cuenta de gerente no encontrada")
        }
        return usuario
    }

    private fun localDelRestaurante(principal: UsuarioPrincipal, localId: Long): Local {
        if (localId <= 0) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Asigná un local al gerente")
        }
        val local = localRepository.findByRestauranteIdAndId(principal.restauranteId, localId)
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "El local no pertenece a tu restaurante")
        if (!local.activo) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "El local está inactivo")
        }
        return local
    }

    private fun normalizarEmail(email: String): String {
        val normalizado = email.trim().lowercase()
        validarFormatoEmail(normalizado)
        return normalizado
    }

    private fun validarFormatoEmail(email: String) {
        if (email.isBlank() || !email.contains("@")) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá un correo válido")
        }
    }

    private fun validarEmailNuevo(email: String) {
        if (usuarioRepository.findByEmail(email).isPresent) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "El correo ya está registrado")
        }
    }

    private fun validarContrasena(contrasena: String?, obligatoria: Boolean): String {
        if (contrasena.isNullOrBlank()) {
            if (obligatoria) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "La contraseña es obligatoria")
            }
            return ""
        }
        if (contrasena.length < 6) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "La contraseña debe tener al menos 6 caracteres")
        }
        return contrasena
    }

    private fun Usuario.aDto() = CuentaGerenteDto(
        id = id,
        email = email,
        localId = local?.id,
        localNombre = local?.nombre
    )
}
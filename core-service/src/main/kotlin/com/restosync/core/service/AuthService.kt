package com.restosync.core.service

import com.restosync.core.dto.AuthResponse
import com.restosync.core.dto.LoginRequest
import com.restosync.core.dto.RegisterRequest
import com.restosync.core.model.Local
import com.restosync.core.model.Restaurante
import com.restosync.core.model.RolUsuario
import com.restosync.core.model.Usuario
import com.restosync.core.repository.LocalRepository
import com.restosync.core.repository.RestauranteRepository
import com.restosync.core.repository.UsuarioRepository
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class AuthService(
    private val usuarioRepository: UsuarioRepository,
    private val restauranteRepository: RestauranteRepository,
    private val localRepository: LocalRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtService: JwtService
) {

    @Transactional(readOnly = true)
    fun login(request: LoginRequest): AuthResponse {
        val usuario = usuarioRepository.findByEmail(request.email)
            .orElseThrow { RuntimeException("Usuario no encontrado") }

        if (!passwordEncoder.matches(request.contrasena, usuario.contrasena)) {
            throw RuntimeException("Contraseña incorrecta")
        }

        return AuthResponse(token = emitirToken(usuario))
    }

    @Transactional
    fun register(request: RegisterRequest): AuthResponse {
        if (usuarioRepository.findByEmail(request.email).isPresent) {
            throw RuntimeException("El correo ya está registrado")
        }

        val restaurante = restauranteRepository.save(Restaurante(nombre = request.nombreRestaurante))
        localRepository.save(
            Local(
                nombre = request.nombreRestaurante,
                direccion = null,
                activo = true,
                restaurante = restaurante
            )
        )

        val hashedPassword = passwordEncoder.encode(request.contrasena) ?: ""
        val nuevoUsuario = Usuario(
            email = request.email,
            contrasena = hashedPassword,
            rol = RolUsuario.ADMIN_RESTAURANTE,
            restaurante = restaurante,
            local = null
        )

        val usuarioGuardado = usuarioRepository.save(nuevoUsuario)
        return AuthResponse(token = emitirToken(usuarioGuardado))
    }

    private fun emitirToken(usuario: Usuario): String {
        return jwtService.generarToken(
            usuarioId = usuario.id,
            restauranteId = usuario.restaurante.id,
            email = usuario.email,
            rol = usuario.rol,
            localId = usuario.local?.id
        )
    }
}

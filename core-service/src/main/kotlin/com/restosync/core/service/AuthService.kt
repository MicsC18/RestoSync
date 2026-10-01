package com.restosync.core.service

import com.restosync.core.dto.AuthResponse
import com.restosync.core.dto.LoginRequest
import com.restosync.core.dto.RegisterRequest
import com.restosync.core.model.Restaurante
import com.restosync.core.model.Usuario
import com.restosync.core.repository.RestauranteRepository
import com.restosync.core.repository.UsuarioRepository
import com.restosync.core.service.JwtService 
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service

@Service
class AuthService(
    private val usuarioRepository: UsuarioRepository,
    private val restauranteRepository: RestauranteRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtService: JwtService
) {

    fun login(request: LoginRequest): AuthResponse {
        val usuario = usuarioRepository.findByEmail(request.email)
            .orElseThrow { RuntimeException("Usuario no encontrado") }

        if (!passwordEncoder.matches(request.contrasena, usuario.contrasena)) {
            throw RuntimeException("Contraseña incorrecta")
        }

        val token = jwtService.generarToken(
            usuarioId = usuario.id,
            restauranteId = usuario.restaurante.id,
            email = usuario.email
        )
        return AuthResponse(token = token)
    }

    fun register(request: RegisterRequest): AuthResponse {
        if (usuarioRepository.findByEmail(request.email).isPresent) {
            throw RuntimeException("El correo ya está registrado")
        }

        val restaurante = restauranteRepository.save(Restaurante(nombre = request.nombreRestaurante))

        val hashedPassword = passwordEncoder.encode(request.contrasena) ?: ""
        val nuevoUsuario = Usuario(
            email = request.email,
            contrasena = hashedPassword,
            restaurante = restaurante
        )
        
        val usuarioGuardado = usuarioRepository.save(nuevoUsuario)
   
        val token = jwtService.generarToken(
            usuarioId = usuarioGuardado.id,
            restauranteId = restaurante.id,
            email = usuarioGuardado.email
        )
        
        return AuthResponse(token = token)
    }
}
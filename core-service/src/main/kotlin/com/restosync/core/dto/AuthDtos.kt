package com.restosync.core.dto

data class LoginRequest(
    val email: String,
    val contrasena: String
)

data class AuthResponse(
    val token: String
)

data class LocalDto(
    val id: Long,
    val nombre: String,
    val direccion: String?,
    val activo: Boolean
)

data class MeResponse(
    val usuarioId: Long,
    val email: String,
    val rol: String,
    val restauranteId: Long,
    val restauranteNombre: String,
    val localId: Long?,
    val locales: List<LocalDto>
)

data class LocalRequest(
    val nombre: String,
    val direccion: String? = null,
    val activo: Boolean = true
)

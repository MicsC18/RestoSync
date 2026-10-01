package com.restosync.core.dto

// Lo que nos manda el usuario desde Next.js o Postman
data class LoginRequest(
    val email: String,
    val contrasena: String
)

// Lo que le devolvemos si todo sale bien
data class AuthResponse(
    val token: String
)
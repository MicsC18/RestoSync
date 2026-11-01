package com.restosync.core.security

import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.server.ResponseStatusException

object SecurityUtils {
    fun principalActual(): UsuarioPrincipal {
        val auth = SecurityContextHolder.getContext().authentication
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "No autenticado")
        val principal = auth.principal
        if (principal !is UsuarioPrincipal) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sesión inválida")
        }
        return principal
    }
}

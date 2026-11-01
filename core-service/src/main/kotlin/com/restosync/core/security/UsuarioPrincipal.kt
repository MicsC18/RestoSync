package com.restosync.core.security

import com.restosync.core.model.RolUsuario

data class UsuarioPrincipal(
    val usuarioId: Long,
    val email: String,
    val rol: RolUsuario,
    val restauranteId: Long,
    val localId: Long?
)

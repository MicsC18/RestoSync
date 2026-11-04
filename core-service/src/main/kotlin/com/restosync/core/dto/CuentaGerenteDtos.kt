package com.restosync.core.dto

/**
 * Alta/edición de una cuenta de gerente (solo Admin).
 * En el PUT solo se corrige lo informado: `contrasena` en blanco mantiene la actual.
 */
data class CuentaGerenteRequest(
    val email: String = "",
    val contrasena: String? = null,
    val localId: Long = 0
)

/** Vista de una cuenta de gerente (nunca expone el hash de la contraseña). */
data class CuentaGerenteDto(
    val id: Long,
    val email: String,
    val localId: Long?,
    val localNombre: String?
)
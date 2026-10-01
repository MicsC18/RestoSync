package com.restosync.core.dto

data class RegisterRequest(
    val email: String,
    val contrasena: String,
    val nombreRestaurante: String
)
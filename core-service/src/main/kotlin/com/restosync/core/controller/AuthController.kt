package com.restosync.core.controller

import com.restosync.core.dto.LoginRequest
import com.restosync.core.dto.RegisterRequest
import com.restosync.core.service.AuthService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/auth")
@CrossOrigin(origins = ["http://localhost:3000"])
class AuthController(
    private val authService: AuthService
) {

    @PostMapping("/login")
    fun login(@RequestBody request: LoginRequest): ResponseEntity<*> {
        return try {
            val response = authService.login(request)
            ResponseEntity.ok(response)
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to e.message))
        }
    }

    @PostMapping("/register")
    fun register(@RequestBody request: RegisterRequest): ResponseEntity<*> {
        return try {
            val response = authService.register(request)
            ResponseEntity.ok(response)
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to e.message))
        }
    }
}
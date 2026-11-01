package com.restosync.core.controller

import com.restosync.core.dto.MeResponse
import com.restosync.core.security.SecurityUtils
import com.restosync.core.service.MeService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/me")
class MeController(
    private val meService: MeService
) {

    @GetMapping
    fun yo(): MeResponse {
        return meService.obtenerPerfil(SecurityUtils.principalActual())
    }
}

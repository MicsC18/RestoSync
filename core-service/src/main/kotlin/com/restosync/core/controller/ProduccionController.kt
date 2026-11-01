package com.restosync.core.controller

import com.restosync.core.dto.ProduccionDto
import com.restosync.core.security.SecurityUtils
import com.restosync.core.service.MenuService
import org.springframework.web.bind.annotation.*

/** Historial de platos preparados (opcionalmente filtrado por mesa). */
@RestController
@RequestMapping("/api/v1/producciones")
class ProduccionController(
    private val menuService: MenuService
) {

    @GetMapping
    fun listar(
        @RequestParam(required = false) mesaId: Long?,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): List<ProduccionDto> =
        menuService.listarProducciones(SecurityUtils.principalActual(), localIdHeader, mesaId)
}
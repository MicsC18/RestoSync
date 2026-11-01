package com.restosync.core.controller

import com.restosync.core.dto.MovimientoDto
import com.restosync.core.security.SecurityUtils
import com.restosync.core.service.InventarioService
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/movimientos")
class MovimientoStockController(
    private val inventarioService: InventarioService
) {

    /** Auditoría de stock del insumo, scoped al local autorizado. */
    @GetMapping("/insumo/{insumoId}")
    fun obtenerPorInsumo(
        @PathVariable insumoId: Long,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): List<MovimientoDto> {
        return inventarioService.listarMovimientos(SecurityUtils.principalActual(), localIdHeader, insumoId)
    }
}
package com.restosync.core.controller

import com.restosync.core.dto.LoteRequest
import com.restosync.core.model.Lote
import com.restosync.core.security.SecurityUtils
import com.restosync.core.service.InventarioService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/lotes")
class LoteController(
    private val inventarioService: InventarioService
) {

    @PostMapping
    fun crearLote(
        @RequestBody lote: Lote,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): Lote {
        return inventarioService.crearLote(SecurityUtils.principalActual(), localIdHeader, lote)
    }

    @GetMapping("/insumo/{insumoId}")
    fun obtenerPorInsumo(
        @PathVariable insumoId: Long,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): List<Lote> {
        return inventarioService.listarLotes(SecurityUtils.principalActual(), localIdHeader, insumoId)
    }

    @PutMapping("/{id}")
    fun actualizarLote(
        @PathVariable id: Long,
        @RequestBody request: LoteRequest,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): Lote {
        return inventarioService.actualizarLote(SecurityUtils.principalActual(), localIdHeader, id, request)
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun eliminarLote(
        @PathVariable id: Long,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ) {
        inventarioService.eliminarLote(SecurityUtils.principalActual(), localIdHeader, id)
    }
}
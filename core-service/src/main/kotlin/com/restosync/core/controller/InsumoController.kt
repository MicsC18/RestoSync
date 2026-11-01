package com.restosync.core.controller

import com.restosync.core.dto.InsumoRequest
import com.restosync.core.model.Insumo
import com.restosync.core.security.SecurityUtils
import com.restosync.core.service.InventarioService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/insumos")
class InsumoController(
    private val inventarioService: InventarioService
) {

    @GetMapping
    fun obtenerTodos(
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): List<Insumo> {
        return inventarioService.listarInsumos(SecurityUtils.principalActual(), localIdHeader)
    }

    /** Alta por IA/dictado (principal) o manual (auxiliar). Aplica merge §4.5. */
    @PostMapping
    fun crearInsumo(
        @RequestBody request: InsumoRequest,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): Insumo {
        return inventarioService.registrarCompra(SecurityUtils.principalActual(), localIdHeader, request)
    }

    /** Corrección de errores: cantidad, vencimiento, nombre, categoría, estado. */
    @PutMapping("/{id}")
    fun actualizarInsumo(
        @PathVariable id: Long,
        @RequestBody request: InsumoRequest,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): Insumo {
        return inventarioService.actualizarInsumo(SecurityUtils.principalActual(), localIdHeader, id, request)
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun eliminarInsumo(
        @PathVariable id: Long,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ) {
        inventarioService.eliminarInsumo(SecurityUtils.principalActual(), localIdHeader, id)
    }
}
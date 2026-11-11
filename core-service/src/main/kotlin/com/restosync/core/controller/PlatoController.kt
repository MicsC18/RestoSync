package com.restosync.core.controller

import com.restosync.core.dto.PlatoDetalleDto
import com.restosync.core.dto.PlatoRequest
import com.restosync.core.dto.PreparacionResponse
import com.restosync.core.dto.PrepararRequest
import com.restosync.core.security.SecurityUtils
import com.restosync.core.service.MenuService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/platos")
class PlatoController(
    private val menuService: MenuService
) {

    @GetMapping
    fun listar(
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): List<PlatoDetalleDto> = menuService.listarPlatos(SecurityUtils.principalActual(), localIdHeader)

    @GetMapping("/{id}")
    fun obtener(
        @PathVariable id: Long,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): PlatoDetalleDto = menuService.obtenerPlato(SecurityUtils.principalActual(), localIdHeader, id)

    @PostMapping
    fun crear(
        @RequestBody request: PlatoRequest,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): PlatoDetalleDto = menuService.crearPlato(SecurityUtils.principalActual(), localIdHeader, request)

    @PutMapping("/{id}")
    fun actualizar(
        @PathVariable id: Long,
        @RequestBody request: PlatoRequest,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): PlatoDetalleDto = menuService.actualizarPlato(SecurityUtils.principalActual(), localIdHeader, id, request)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun eliminar(
        @PathVariable id: Long,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ) {
        menuService.eliminarPlato(SecurityUtils.principalActual(), localIdHeader, id)
    }

    /** Prepara el plato: descuenta stock FIFO y lo asocia a una mesa si se indica. */
    @PostMapping("/{id}/preparar")
    fun preparar(
        @PathVariable id: Long,
        @RequestBody(required = false) request: PrepararRequest?,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): PreparacionResponse =
        menuService.prepararPlato(SecurityUtils.principalActual(), localIdHeader, id, request ?: PrepararRequest())
}
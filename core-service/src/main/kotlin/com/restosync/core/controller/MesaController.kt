package com.restosync.core.controller

import com.restosync.core.dto.MesaRequest
import com.restosync.core.model.Mesa
import com.restosync.core.security.SecurityUtils
import com.restosync.core.service.MesaService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/mesas")
class MesaController(
    private val mesaService: MesaService
) {

    @GetMapping
    fun listar(
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): List<Mesa> = mesaService.listarMesas(SecurityUtils.principalActual(), localIdHeader)

    @PostMapping
    fun crear(
        @RequestBody request: MesaRequest,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): Mesa = mesaService.crearMesa(SecurityUtils.principalActual(), localIdHeader, request)

    @PutMapping("/{id}")
    fun actualizar(
        @PathVariable id: Long,
        @RequestBody request: MesaRequest,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): Mesa = mesaService.actualizarMesa(SecurityUtils.principalActual(), localIdHeader, id, request)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun eliminar(
        @PathVariable id: Long,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ) {
        mesaService.eliminarMesa(SecurityUtils.principalActual(), localIdHeader, id)
    }
}
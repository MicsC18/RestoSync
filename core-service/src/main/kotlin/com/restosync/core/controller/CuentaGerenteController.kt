package com.restosync.core.controller

import com.restosync.core.dto.CuentaGerenteDto
import com.restosync.core.dto.CuentaGerenteRequest
import com.restosync.core.security.SecurityUtils
import com.restosync.core.service.CuentaGerenteService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

/** ABM de cuentas de gerente del restaurante (solo Admin; el servicio exige el rol). */
@RestController
@RequestMapping("/api/v1/cuentas-gerentes")
class CuentaGerenteController(
    private val cuentaGerenteService: CuentaGerenteService
) {

    @GetMapping
    fun listar(): List<CuentaGerenteDto> =
        cuentaGerenteService.listar(SecurityUtils.principalActual())

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun crear(@RequestBody request: CuentaGerenteRequest): CuentaGerenteDto =
        cuentaGerenteService.crear(SecurityUtils.principalActual(), request)

    @PutMapping("/{id}")
    fun actualizar(
        @PathVariable id: Long,
        @RequestBody request: CuentaGerenteRequest
    ): CuentaGerenteDto =
        cuentaGerenteService.actualizar(SecurityUtils.principalActual(), id, request)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun eliminar(@PathVariable id: Long) {
        cuentaGerenteService.eliminar(SecurityUtils.principalActual(), id)
    }
}
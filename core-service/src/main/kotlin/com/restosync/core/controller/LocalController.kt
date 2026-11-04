package com.restosync.core.controller

import com.restosync.core.dto.LocalDto
import com.restosync.core.dto.LocalRequest
import com.restosync.core.security.SecurityUtils
import com.restosync.core.service.LocalService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/locales")
class LocalController(
    private val localService: LocalService
) {

    @GetMapping
    fun listar(): List<LocalDto> {
        return localService.listar(SecurityUtils.principalActual())
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun crear(@RequestBody request: LocalRequest): LocalDto {
        return localService.crear(SecurityUtils.principalActual(), request)
    }

    @PutMapping("/{id}")
    fun actualizar(
        @PathVariable id: Long,
        @RequestBody request: LocalRequest
    ): LocalDto {
        return localService.actualizar(SecurityUtils.principalActual(), id, request)
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun eliminar(@PathVariable id: Long) {
        localService.eliminar(SecurityUtils.principalActual(), id)
    }
}

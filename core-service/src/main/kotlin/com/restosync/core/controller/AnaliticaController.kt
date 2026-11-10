package com.restosync.core.controller

import com.restosync.core.dto.HistorialResponse
import com.restosync.core.security.SecurityUtils
import com.restosync.core.service.AnaliticaService
import org.springframework.web.bind.annotation.*

/**
 * Historial agregado del local para el monitor predictivo (contrato §1.1 del Plan-IA).
 * El frontend lo reenvía tal cual a `restosync-ia`; el core no orquesta la IA.
 */
@RestController
@RequestMapping("/api/v1/analitica")
class AnaliticaController(
    private val analiticaService: AnaliticaService
) {

    /** `dias`: default 90, se acota a [7, 365] sin errores de rango. */
    @GetMapping("/historial")
    fun historial(
        @RequestParam(required = false, defaultValue = "90") dias: Int,
        @RequestHeader(value = "X-Local-Id", required = false) localIdHeader: Long?
    ): HistorialResponse =
        analiticaService.obtenerHistorial(SecurityUtils.principalActual(), localIdHeader, dias)
}

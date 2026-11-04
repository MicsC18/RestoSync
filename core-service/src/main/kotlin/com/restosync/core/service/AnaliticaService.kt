package com.restosync.core.service

import com.restosync.core.dto.HistorialResponse
import com.restosync.core.dto.InsumoHistorialDto
import com.restosync.core.dto.LoteHistorialDto
import com.restosync.core.dto.ProduccionDiariaDto
import com.restosync.core.dto.SerieDiariaDto
import com.restosync.core.model.TipoMovimiento
import com.restosync.core.repository.InsumoRepository
import com.restosync.core.repository.LoteRepository
import com.restosync.core.repository.MovimientoStockRepository
import com.restosync.core.repository.ProduccionRepository
import com.restosync.core.security.UsuarioPrincipal
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * Analítica para el monitor predictivo (§1.1 y §2.1 del Plan-IA): arma el historial
 * agregado de un local (insumos + lotes, serie diaria de movimientos y producciones)
 * en el contrato exacto que consume el frontend y reenvía a `restosync-ia`.
 *
 * Solo lectura: no modifica stock ni genera auditoría.
 */
@Service
class AnaliticaService(
    private val localContextService: LocalContextService,
    private val insumoRepository: InsumoRepository,
    private val loteRepository: LoteRepository,
    private val movimientoRepository: MovimientoStockRepository,
    private val produccionRepository: ProduccionRepository
) {

    private val formatoFecha: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")

    /** Ventana en días: default 90; fuera de rango se acota a [7, 365], no da error (§1.1). */
    internal fun acotarDias(dias: Int?): Int =
        (dias ?: DIAS_DEFAULT).coerceIn(DIAS_MINIMO, DIAS_MAXIMO)

    @Transactional(readOnly = true)
    fun obtenerHistorial(principal: UsuarioPrincipal, localIdHeader: Long?, dias: Int?): HistorialResponse {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val ventana = acotarDias(dias)
        val hasta = LocalDate.now()
        val desde = hasta.minusDays((ventana - 1).toLong())

        val movimientos = movimientoRepository
            .findByLocalIdAndFechaHoraBetweenOrderByFechaHoraAsc(
                local.id,
                desde.atStartOfDay(),
                hasta.atTime(23, 59, 59, 999_999_999)
            )

        val producciones = produccionRepository.findByLocalIdAndFechaHoraBetween(
            local.id,
            desde.atStartOfDay(),
            hasta.atTime(23, 59, 59, 999_999_999)
        )

        return HistorialResponse(
            localId = local.id,
            dias = ventana,
            desde = desde.format(formatoFecha),
            hasta = hasta.format(formatoFecha),
            insumos = listarInsumosConLotes(local.id),
            series = agregarSeries(movimientos),
            producciones = agregarProducciones(producciones)
        )
    }

    /** Todos los insumos del local (incluidos agotados) con sus lotes vigentes (> 0) por vencimiento. */
    private fun listarInsumosConLotes(localId: Long): List<InsumoHistorialDto> =
        insumoRepository.findByLocalId(localId).map { insumo ->
            val lotes = loteRepository.findByInsumoIdOrderByFechaVencimientoAsc(insumo.id)
                .filter { it.cantidad > 0 }
                .map { LoteHistorialDto(cantidad = redondear(it.cantidad), fechaVencimiento = it.fechaVencimiento.format(formatoFecha)) }
            InsumoHistorialDto(
                id = insumo.id,
                nombre = insumo.nombre,
                categoria = insumo.categoria,
                icono = insumo.icono,
                unidadMedida = insumo.unidadMedida,
                stockActual = redondear(insumo.cantidad ?: 0.0),
                stockMinimo = insumo.stockMinimo,
                lotes = lotes
            )
        }

    /**
     * Formato disperso: una fila por (fecha, insumo) con al menos un movimiento.
     * consumo = PRODUCCION + SALIDA; entradas = ENTRADA; mermas = MERMA; AJUSTE se ignora.
     */
    private fun agregarSeries(movimientos: List<com.restosync.core.model.MovimientoStock>): List<SerieDiariaDto> =
        movimientos
            .filter { it.insumo != null }
            .groupBy { it.fechaHora.toLocalDate().toEpochDay() * 1_000_000 + it.insumo!!.id }
            .map { (_, movimientosDelDia) ->
                val primero = movimientosDelDia.first()
                SerieDiariaDto(
                    fecha = primero.fechaHora.toLocalDate().format(formatoFecha),
                    insumoId = primero.insumo!!.id,
                    consumo = redondear(movimientosDelDia
                        .filter { it.tipo == TipoMovimiento.PRODUCCION || it.tipo == TipoMovimiento.SALIDA }
                        .sumOf { it.cantidad }),
                    entradas = redondear(movimientosDelDia
                        .filter { it.tipo == TipoMovimiento.ENTRADA }
                        .sumOf { it.cantidad }),
                    mermas = redondear(movimientosDelDia
                        .filter { it.tipo == TipoMovimiento.MERMA }
                        .sumOf { it.cantidad })
                )
            }
            // Un día solo con AJUSTE no aporta información: no se emite fila en cero (§2.4.2).
            .filter { it.consumo != 0.0 || it.entradas != 0.0 || it.mermas != 0.0 }
            .sortedWith(compareBy({ it.fecha }, { it.insumoId }))

    /** Una fila por (fecha, platoNombre) sumando cantidades (snapshot: sobrevive borrados). */
    private fun agregarProducciones(producciones: List<com.restosync.core.model.Produccion>): List<ProduccionDiariaDto> =
        producciones
            .groupBy { it.fechaHora.toLocalDate().format(formatoFecha) to it.platoNombre }
            .map { (clave, filas) ->
                ProduccionDiariaDto(
                    fecha = clave.first,
                    platoNombre = clave.second,
                    cantidad = redondear(filas.sumOf { it.cantidad })
                )
            }
            .sortedWith(compareBy({ it.fecha }, { it.platoNombre }))

    /** Evita artefactos de punto flotante (0.30000000000000004) en el contrato JSON. */
    private fun redondear(valor: Double): Double = Math.round(valor * 100.0) / 100.0

    internal companion object {
        const val DIAS_DEFAULT = 90
        const val DIAS_MINIMO = 7
        const val DIAS_MAXIMO = 365
    }
}

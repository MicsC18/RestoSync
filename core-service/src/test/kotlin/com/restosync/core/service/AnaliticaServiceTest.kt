package com.restosync.core.service

import com.restosync.core.model.Insumo
import com.restosync.core.model.Local
import com.restosync.core.model.Lote
import com.restosync.core.model.MovimientoStock
import com.restosync.core.model.Restaurante
import com.restosync.core.model.RolUsuario
import com.restosync.core.model.TipoMovimiento
import com.restosync.core.repository.InsumoRepository
import com.restosync.core.repository.LocalRepository
import com.restosync.core.repository.LoteRepository
import com.restosync.core.repository.MovimientoStockRepository
import com.restosync.core.repository.ProduccionRepository
import com.restosync.core.security.UsuarioPrincipal
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyLong
import org.mockito.Mockito
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.Optional
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/**
 * Tests de Fase 1 del Plan-IA (§2.4) — `AnaliticaService` sin base de datos.
 * Cubren la agregación del contrato §1.1 (series dispersas, tipos de movimiento),
 * el acotado de la ventana `dias` y el scope por local.
 *
 * Se usa el `LocalContextService` real sobre un `LocalRepository` mockeado (mismo
 * enfoque que `LocalContextServiceTest`): así el scope se valida de verdad y se
 * evitan los matchers sobre tipos no-null de Kotlin.
 */
class AnaliticaServiceTest {

    private val insumoRepository = Mockito.mock(InsumoRepository::class.java)
    private val loteRepository = Mockito.mock(LoteRepository::class.java)
    private val movimientoRepository = Mockito.mock(MovimientoStockRepository::class.java)
    private val produccionRepository = Mockito.mock(ProduccionRepository::class.java)

    private fun contexto(usando: LocalRepository = Mockito.mock(LocalRepository::class.java)) =
        LocalContextService(usando)

    private fun servicio(ctx: LocalContextService): AnaliticaService =
        AnaliticaService(ctx, insumoRepository, loteRepository, movimientoRepository, produccionRepository)

    private val restaurante = Restaurante(id = 1, nombre = "La Farola")
    private val local = Local(id = 10, nombre = "La Farola", restaurante = restaurante)

    private val admin = UsuarioPrincipal(1, "admin@lafarola.com", RolUsuario.ADMIN_RESTAURANTE, 1, null)
    private val gerente = UsuarioPrincipal(2, "gerente@lafarola.com", RolUsuario.GERENTE_LOCAL, 1, 10)

    private val insumo = Insumo(
        id = 1, nombre = "Lechuga", categoria = "Frutas y verduras", icono = "🥬",
        unidadMedida = "Kg", stockMinimo = 1.0, cantidad = 4.0, local = local
    )

    /** Contexto que resuelve el local demo para cualquier header (camino feliz admin). */
    private fun contextoAdminResuelto(): LocalContextService {
        val repoLocal = Mockito.mock(LocalRepository::class.java)
        Mockito.`when`(repoLocal.findByRestauranteIdAndId(1L, 10L)).thenReturn(local)
        return LocalContextService(repoLocal)
    }

    /** Matcher nulo-seguro para parámetros Kotlin no nulos (mismo patrón que MenuServicePrepararTest). */
    private fun <T> cualquiera(): T {
        Mockito.any<T>()
        @Suppress("UNCHECKED_CAST")
        return null as T
    }

    private fun stubVentana(vararg movimientos: MovimientoStock) {
        // Mockito devuelve lista vacía por defecto para los demás repos: solo se fija la ventana.
        Mockito.`when`(
            movimientoRepository.findByLocalIdAndFechaHoraBetweenOrderByFechaHoraAsc(
                // localId es Long primitivo: anyLong() evita el NPE de unboxing; fechas: matcher nulo-seguro.
                anyLong(), cualquiera<LocalDateTime>(), cualquiera<LocalDateTime>()
            )
        ).thenReturn(movimientos.toList())
    }

    private fun movimiento(tipo: TipoMovimiento, cantidad: Double, fecha: LocalDate): MovimientoStock =
        MovimientoStock(
            tipo = tipo, cantidad = cantidad, fechaHora = fecha.atTime(10, 0),
            motivo = "test", insumo = insumo, local = local
        )

    // 1. PRODUCCION + SALIDA se suman en consumo de la fila (fecha, insumo); MERMA y ENTRADA van aparte.
    @Test
    fun `agrega consumo y separa merma y entrada en la misma fecha e insumo`() {
        val dia = LocalDate.now().minusDays(1)
        stubVentana(
            movimiento(TipoMovimiento.PRODUCCION, 2.0, dia),
            movimiento(TipoMovimiento.SALIDA, 1.0, dia),
            movimiento(TipoMovimiento.MERMA, 0.5, dia),
            movimiento(TipoMovimiento.ENTRADA, 10.0, dia)
        )

        val historial = servicio(contextoAdminResuelto()).obtenerHistorial(admin, 10, 90)

        assertEquals(1, historial.series.size)
        val serie = historial.series.first()
        assertEquals(dia.toString(), serie.fecha)
        assertEquals(1L, serie.insumoId)
        assertEquals(3.0, serie.consumo)
        assertEquals(0.5, serie.mermas)
        assertEquals(10.0, serie.entradas)
    }

    // 2. Los movimientos AJUSTE se ignoran por completo.
    @Test
    fun `ignora movimientos de tipo ajuste`() {
        stubVentana(movimiento(TipoMovimiento.AJUSTE, 5.0, LocalDate.now().minusDays(2)))

        val historial = servicio(contextoAdminResuelto()).obtenerHistorial(admin, 10, 90)

        assertEquals(0, historial.series.size)
    }

    // 3. Gerente: usa su local fijo aunque llegue otro X-Local-Id (mismo criterio que LocalContextServiceTest).
    @Test
    fun `gerente usa su local fijo aunque llegue otro header`() {
        val repoLocal = Mockito.mock(LocalRepository::class.java)
        Mockito.`when`(repoLocal.findById(10L)).thenReturn(Optional.of(local))
        Mockito.`when`(insumoRepository.findByLocalId(10L)).thenReturn(emptyList())

        val historial = servicio(LocalContextService(repoLocal)).obtenerHistorial(gerente, 11, 90)

        assertEquals(10L, historial.localId)
        Mockito.verify(repoLocal, Mockito.never()).findByRestauranteIdAndId(anyLong(), anyLong())
    }

    // 3b. Admin que pide un local de otro restaurante recibe 403 (no alcanza con cambiar el header).
    @Test
    fun `admin con local de otro restaurante recibe 403`() {
        val repoLocal = Mockito.mock(LocalRepository::class.java)
        Mockito.`when`(repoLocal.findByRestauranteIdAndId(1L, 99L)).thenReturn(null)

        val error = assertFailsWith<ResponseStatusException> {
            servicio(LocalContextService(repoLocal)).obtenerHistorial(admin, 99, 90)
        }
        assertEquals(HttpStatus.FORBIDDEN, error.statusCode)
    }

    // 4. Admin sin X-Local-Id → 400 (lo exige LocalContextService al resolver).
    @Test
    fun `admin sin header recibe 400`() {
        val error = assertFailsWith<ResponseStatusException> {
            servicio(contexto()).obtenerHistorial(admin, null, 90)
        }
        assertEquals(HttpStatus.BAD_REQUEST, error.statusCode)
    }

    // 5. `dias` fuera de rango se acota: 0 → 7, 999 → 365, null → 90 (sin error).
    @Test
    fun `acota dias fuera de rango`() {
        val servicio = servicio(contextoAdminResuelto())

        assertEquals(7, servicio.acotarDias(0))
        assertEquals(365, servicio.acotarDias(999))
        assertEquals(90, servicio.acotarDias(null))
        assertEquals(14, servicio.acotarDias(14))

        // La ventana devuelta en la respuesta refleja el valor acotado (0 → 7 días).
        val historial = servicio.obtenerHistorial(admin, 10, 0)
        assertEquals(7, historial.dias)
        val hoy = LocalDate.now()
        assertEquals(hoy.toString(), historial.hasta)
        assertEquals(hoy.minusDays(6).toString(), historial.desde)
    }

    // 6. Local sin movimientos: series y producciones vacías, insumos presentes con sus lotes vigentes.
    @Test
    fun `local sin movimientos devuelve series vacias con insumos presentes`() {
        Mockito.`when`(insumoRepository.findByLocalId(10L)).thenReturn(listOf(insumo))
        // Un lote vigente y uno consumido (cantidad 0) → solo el vigente entra al contrato.
        Mockito.`when`(loteRepository.findByInsumoIdOrderByFechaVencimientoAsc(1L)).thenReturn(
            listOf(
                Lote(id = 1, cantidad = 4.0, fechaVencimiento = LocalDate.now().plusDays(3), insumo = insumo),
                Lote(id = 2, cantidad = 0.0, fechaVencimiento = LocalDate.now().minusDays(1), insumo = insumo)
            )
        )

        val historial = servicio(contextoAdminResuelto()).obtenerHistorial(admin, 10, 90)

        assertEquals(0, historial.series.size)
        assertEquals(0, historial.producciones.size)
        assertEquals(1, historial.insumos.size)
        assertEquals("Lechuga", historial.insumos.first().nombre)
        assertEquals(4.0, historial.insumos.first().stockActual)
        assertEquals(1, historial.insumos.first().lotes.size)
    }
}

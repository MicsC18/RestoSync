package com.restosync.core.service

import com.restosync.core.dto.InsumoRequest
import com.restosync.core.model.Insumo
import com.restosync.core.model.Local
import com.restosync.core.model.Lote
import com.restosync.core.model.MovimientoStock
import com.restosync.core.model.Restaurante
import com.restosync.core.model.RolUsuario
import com.restosync.core.model.TipoMovimiento
import com.restosync.core.model.Usuario
import com.restosync.core.repository.InsumoRepository
import com.restosync.core.repository.LoteRepository
import com.restosync.core.repository.MovimientoStockRepository
import com.restosync.core.repository.RecetaInsumoRepository
import com.restosync.core.repository.UsuarioRepository
import com.restosync.core.security.UsuarioPrincipal
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito
import java.time.LocalDate
import java.util.Optional
import kotlin.test.assertEquals

/**
 * Tests del redondeo a dos decimales (`com.restosync.core.util.redondear`), sin base de datos.
 *
 * El dominio acumula sumas y restas de `Double` que traen ruido (`0.1 + 0.2 =
 * 0.30000000000000004`). Ese ruido se persistía en `lotes.cantidad` / `insumos.cantidad`,
 * llegaba a pantalla como `9.200000000000003` y podía rechazar una preparación con stock justo.
 * Estos tests fijan los tres puntos donde se corrige: merge de compra, agregado homónimo y
 * descuento FIFO.
 */
class InventarioServiceRedondeoTest {

    private val insumoRepository = Mockito.mock(InsumoRepository::class.java)
    private val loteRepository = Mockito.mock(LoteRepository::class.java)
    private val movimientoRepository = Mockito.mock(MovimientoStockRepository::class.java)
    private val recetaInsumoRepository = Mockito.mock(RecetaInsumoRepository::class.java)
    private val usuarioRepository = Mockito.mock(UsuarioRepository::class.java)
    private val localContextService = Mockito.mock(LocalContextService::class.java)

    private val service = InventarioService(
        insumoRepository, loteRepository, movimientoRepository, recetaInsumoRepository,
        usuarioRepository, localContextService
    )

    private val restaurante = Restaurante(id = 1, nombre = "La Farola")
    private val local = Local(id = 10, nombre = "La Farola", restaurante = restaurante)
    private val admin = UsuarioPrincipal(1, "admin@lafarola.com", RolUsuario.ADMIN_RESTAURANTE, 1, null)
    private val hoy = LocalDate.now()
    private val harina = Insumo(
        id = 100, nombre = "Harina 000", categoria = "Almacén", unidadMedida = "Kg",
        cantidad = 0.1, diasRestantes = 30, local = local
    )

    /** Lotes que el servicio fue guardando: simula el estado de la tabla `lotes`. */
    private val lotesGuardados = mutableListOf<Lote>()

    /** Matcher nulo-seguro para verificar llamadas con parámetros Kotlin no nulos. */
    private fun <T> cualquiera(): T {
        Mockito.any<T>()
        @Suppress("UNCHECKED_CAST")
        return null as T
    }

    private fun stubBase() {
        Mockito.`when`(localContextService.resolverLocal(admin, null)).thenReturn(local)
        Mockito.`when`(insumoRepository.save(cualquiera<Insumo>()))
            .thenAnswer { it.arguments[0] as Insumo }
        Mockito.`when`(loteRepository.save(cualquiera<Lote>()))
            .thenAnswer { (it.arguments[0] as Lote).also { lote -> lotesGuardados.add(lote) } }
        Mockito.`when`(usuarioRepository.findById(1L)).thenReturn(
            Optional.of(Usuario(id = 1, email = admin.email, contrasena = "hash", restaurante = restaurante))
        )
    }

    @Test
    fun `merge de compra suma al lote existente sin dejar ruido persistido`() {
        stubBase()
        val fecha = hoy.plusDays(30)
        val lotePrevio = Lote(id = 1, cantidad = 0.1, fechaVencimiento = fecha, insumo = harina)
        Mockito.`when`(insumoRepository.findByLocalIdAndNombreIgnoreCase(10L, "Harina 000"))
            .thenReturn(listOf(harina))
        Mockito.`when`(loteRepository.findByInsumoIdAndFechaVencimiento(100L, fecha)).thenReturn(lotePrevio)
        Mockito.`when`(loteRepository.findByInsumoIdOrderByFechaVencimientoAsc(100L))
            .thenAnswer { lotesGuardados.toList() }

        val resultado = service.registrarCompra(admin, null, InsumoRequest(nombre = "Harina 000", cantidad = 0.2))

        // 0.1 + 0.2 = 0.30000000000000004 en `Double` puro: ni el lote ni el agregado lo guardan.
        assertEquals(0.3, lotesGuardados.last().cantidad)
        assertEquals(0.3, resultado.cantidad)
    }

    @Test
    fun `agregado de filas homonimas no propaga el ruido al stock disponible`() {
        val otraFila = harina.copy(id = 101)
        Mockito.`when`(insumoRepository.findByLocalIdAndNombreIgnoreCase(10L, "Harina 000"))
            .thenReturn(listOf(harina, otraFila))
        Mockito.`when`(loteRepository.findByInsumoId(100L))
            .thenReturn(listOf(Lote(id = 1, cantidad = 0.1, fechaVencimiento = hoy.plusDays(10), insumo = harina)))
        Mockito.`when`(loteRepository.findByInsumoId(101L))
            .thenReturn(listOf(Lote(id = 2, cantidad = 0.2, fechaVencimiento = hoy.plusDays(20), insumo = otraFila)))

        assertEquals(0.3, service.stockDisponiblePorNombre(local, "Harina 000"))
    }

    @Test
    fun `descuento con stock justo y ruido no dispara el falso no hay stock`() {
        stubBase()
        // Fila contaminada antes del fix: 9.2 Kilos guardados como 9.199999999999999.
        val lote = Lote(id = 5, cantidad = 9.199999999999999, fechaVencimiento = hoy.plusDays(3), insumo = harina)
        Mockito.`when`(insumoRepository.findByLocalIdAndNombreIgnoreCase(10L, "Harina 000"))
            .thenReturn(listOf(harina))
        Mockito.`when`(loteRepository.findByInsumoIdOrderByFechaVencimientoAsc(100L)).thenReturn(listOf(lote))

        service.descontarFIFO(admin, local, "Harina 000", 9.2, TipoMovimiento.PRODUCCION, "Preparación de plato")

        // Se consumió el lote completo (queda en 0 → se elimina) y la auditoría sale redondeada.
        Mockito.verify(loteRepository).delete(lote)
        val movimiento = ArgumentCaptor.forClass(MovimientoStock::class.java)
        Mockito.verify(movimientoRepository).save(movimiento.capture())
        assertEquals(-9.2, movimiento.value.cantidad)
    }

    @Test
    fun `descuento parcial deja el lote restante sin ruido`() {
        stubBase()
        val lote = Lote(id = 6, cantidad = 1.0, fechaVencimiento = hoy.plusDays(3), insumo = harina)
        Mockito.`when`(insumoRepository.findByLocalIdAndNombreIgnoreCase(10L, "Harina 000"))
            .thenReturn(listOf(harina))
        Mockito.`when`(loteRepository.findByInsumoIdOrderByFechaVencimientoAsc(100L)).thenReturn(listOf(lote))

        service.descontarFIFO(admin, local, "Harina 000", 0.3, TipoMovimiento.MERMA, "Merma")

        // 1.0 - 0.3 = 0.7 en `Double` puro daría 0.7000000000000001.
        assertEquals(0.7, lotesGuardados.last().cantidad)
    }
}

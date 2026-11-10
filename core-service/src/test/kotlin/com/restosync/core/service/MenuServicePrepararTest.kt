package com.restosync.core.service

import com.restosync.core.dto.PrepararRequest
import com.restosync.core.model.EstadoMesa
import com.restosync.core.model.Insumo
import com.restosync.core.model.Local
import com.restosync.core.model.Mesa
import com.restosync.core.model.Plato
import com.restosync.core.model.Produccion
import com.restosync.core.model.RecetaInsumo
import com.restosync.core.model.Restaurante
import com.restosync.core.model.RolUsuario
import com.restosync.core.model.Usuario
import com.restosync.core.repository.InsumoRepository
import com.restosync.core.repository.PlatoRepository
import com.restosync.core.repository.ProduccionRepository
import com.restosync.core.repository.RecetaInsumoRepository
import com.restosync.core.repository.UsuarioRepository
import com.restosync.core.security.UsuarioPrincipal
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime
import java.util.Optional
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * Tests mínimos de Fase 6 — preparar plato (sin base de datos):
 * stock insuficiente no descuenta nada, plato inactivo/ajeno se rechaza,
 * y las filas homónimas se agrupan en un único descuento FIFO por nombre.
 */
class MenuServicePrepararTest {

    private val platoRepository = Mockito.mock(PlatoRepository::class.java)
    private val recetaInsumoRepository = Mockito.mock(RecetaInsumoRepository::class.java)
    private val produccionRepository = Mockito.mock(ProduccionRepository::class.java)
    private val insumoRepository = Mockito.mock(InsumoRepository::class.java)
    private val usuarioRepository = Mockito.mock(UsuarioRepository::class.java)
    private val inventarioService = Mockito.mock(InventarioService::class.java)
    private val mesaService = Mockito.mock(MesaService::class.java)
    private val localContextService = Mockito.mock(LocalContextService::class.java)

    private val service = MenuService(
        platoRepository, recetaInsumoRepository, produccionRepository, insumoRepository,
        usuarioRepository, inventarioService, mesaService, localContextService
    )

    private val restaurante = Restaurante(id = 1, nombre = "La Farola")
    private val local = Local(id = 10, nombre = "La Farola", restaurante = restaurante)
    private val admin = UsuarioPrincipal(1, "admin@lafarola.com", RolUsuario.ADMIN_RESTAURANTE, 1, null)
    private val pollo = Insumo(id = 100, nombre = "Pechuga de pollo", unidadMedida = "Kg", local = local)
    private val plato = Plato(id = 5, nombre = "Milanesa", activo = true, local = local)

    /** Matcher nulo-seguro para verificar llamadas con parámetros Kotlin no nulos. */
    private fun <T> cualquiera(): T {
        Mockito.any<T>()
        @Suppress("UNCHECKED_CAST")
        return null as T
    }

    private fun stubBase(platoActual: Plato = plato) {
        Mockito.`when`(localContextService.resolverLocal(admin, null)).thenReturn(local)
        Mockito.`when`(platoRepository.findById(5L)).thenReturn(Optional.of(platoActual))
    }

    private fun preparar(cantidad: Double = 1.0) =
        service.prepararPlato(admin, null, 5, PrepararRequest(cantidad = cantidad, mesaId = null))

    @Test
    fun `sin stock suficiente rechaza y no descuenta nada`() {
        stubBase()
        Mockito.`when`(recetaInsumoRepository.findByPlatoId(5L))
            .thenReturn(listOf(RecetaInsumo(id = 1, plato = plato, insumo = pollo, cantidad = 2.0)))
        Mockito.`when`(inventarioService.stockDisponiblePorNombre(local, "Pechuga de pollo")).thenReturn(1.0)

        val error = assertFailsWith<ResponseStatusException> { preparar() }

        assertEquals(HttpStatus.BAD_REQUEST, error.statusCode)
        assertTrue(error.reason!!.contains("No hay stock suficiente"))
        Mockito.verify(inventarioService, Mockito.never())
            .descontarFIFO(cualquiera(), cualquiera(), cualquiera(), Mockito.anyDouble(), cualquiera(), cualquiera())
        Mockito.verify(produccionRepository, Mockito.never()).save(cualquiera())
    }

    @Test
    fun `plato inactivo no se puede preparar`() {
        stubBase(plato.copy(activo = false))

        val error = assertFailsWith<ResponseStatusException> { preparar() }

        assertEquals(HttpStatus.BAD_REQUEST, error.statusCode)
        assertTrue(error.reason!!.contains("inactivo"))
    }

    @Test
    fun `plato de otro local recibe 403`() {
        val otroLocal = Local(id = 99, nombre = "Ajeno", restaurante = restaurante)
        stubBase(plato.copy(local = otroLocal))

        val error = assertFailsWith<ResponseStatusException> { preparar() }

        assertEquals(HttpStatus.FORBIDDEN, error.statusCode)
    }

    @Test
    fun `plato sin receta recibe 400`() {
        stubBase()
        Mockito.`when`(recetaInsumoRepository.findByPlatoId(5L)).thenReturn(emptyList())

        val error = assertFailsWith<ResponseStatusException> { preparar() }

        assertEquals(HttpStatus.BAD_REQUEST, error.statusCode)
        assertTrue(error.reason!!.contains("no tiene ingredientes"))
    }

    @Test
    fun `filas homonimas se agrupan en un solo descuento FIFO`() {
        stubBase()
        // Dos filas del mismo ingrediente (vencimientos distintos, §4.5): 1 Kg + 1 Kg.
        val otraFila = pollo.copy(id = 101)
        Mockito.`when`(recetaInsumoRepository.findByPlatoId(5L)).thenReturn(
            listOf(
                RecetaInsumo(id = 1, plato = plato, insumo = pollo, cantidad = 1.0),
                RecetaInsumo(id = 2, plato = plato, insumo = otraFila, cantidad = 1.0)
            )
        )
        // 10 Kg antes de preparar, 8 Kg después del descuento agrupado de 2 Kg.
        Mockito.`when`(inventarioService.stockDisponiblePorNombre(local, "Pechuga de pollo"))
            .thenReturn(10.0, 8.0)
        Mockito.`when`(usuarioRepository.findById(1L)).thenReturn(
            Optional.of(Usuario(id = 1, email = admin.email, contrasena = "hash", restaurante = restaurante))
        )
        Mockito.`when`(produccionRepository.save(cualquiera<Produccion>()))
            .thenAnswer { it.arguments[0] as Produccion }

        val respuesta = preparar()

        // Un solo descuento por nombre, con la suma de las filas homónimas.
        // capture() devuelve null y el parámetro es double primitivo: el ?: evita el NPE de unboxing.
        val cantidadCaptor = ArgumentCaptor.forClass(Double::class.javaObjectType)
        Mockito.verify(inventarioService, Mockito.times(1)).descontarFIFO(
            cualquiera(), cualquiera(), cualquiera(), cantidadCaptor.capture() ?: 0.0, cualquiera(), cualquiera()
        )
        assertEquals(2.0, cantidadCaptor.value)
        assertEquals(8.0, respuesta.stockRestante.single().cantidadRestante)
        Mockito.verify(produccionRepository, Mockito.times(1)).save(cualquiera())
    }

    @Test
    fun `requerido de receta no acumula ruido de Double`() {
        stubBase()
        // 0.1 Kg por plato x 3 platos = 0.30000000000000004 en `Double` puro.
        Mockito.`when`(recetaInsumoRepository.findByPlatoId(5L))
            .thenReturn(listOf(RecetaInsumo(id = 1, plato = plato, insumo = pollo, cantidad = 0.1)))
        Mockito.`when`(inventarioService.stockDisponiblePorNombre(local, "Pechuga de pollo")).thenReturn(10.0)
        Mockito.`when`(usuarioRepository.findById(1L)).thenReturn(
            Optional.of(Usuario(id = 1, email = admin.email, contrasena = "hash", restaurante = restaurante))
        )
        Mockito.`when`(produccionRepository.save(cualquiera<Produccion>()))
            .thenAnswer { it.arguments[0] as Produccion }

        preparar(cantidad = 3.0)

        val cantidadCaptor = ArgumentCaptor.forClass(Double::class.javaObjectType)
        Mockito.verify(inventarioService).descontarFIFO(
            cualquiera(), cualquiera(), cualquiera(), cantidadCaptor.capture() ?: 0.0, cualquiera(), cualquiera()
        )
        assertEquals(0.3, cantidadCaptor.value)
    }

    // ==================== listarProducciones: sesión de platos (Plan-Mesas-Dictado §1) ====================

    private val mesaBase = Mesa(id = 7, nombre = "Mesa 1", estado = EstadoMesa.LIBRE, local = local)

    private fun produccion(id: Long, fecha: LocalDateTime) = Produccion(
        id = id,
        platoNombre = "Milanesa",
        cantidad = 1.0,
        mesa = mesaBase,
        mesaNombre = mesaBase.nombre,
        fechaHora = fecha,
        local = local
    )

    private fun stubListar(mesa: Mesa) {
        Mockito.`when`(localContextService.resolverLocal(admin, null)).thenReturn(local)
        Mockito.`when`(mesaService.mesaDelLocal(local, 7L)).thenReturn(mesa)
    }

    @Test
    fun `mesa LIBRE no muestra producciones y ni siquiera consulta el historial`() {
        // Estado LIBRE con marca rezagada (no deberia pasar, pero el gate es el estado).
        stubListar(mesaBase.copy(estado = EstadoMesa.LIBRE, fechaOcupacion = LocalDateTime.now().minusHours(1)))

        assertEquals(emptyList(), service.listarProducciones(admin, null, 7L))

        Mockito.verify(produccionRepository, Mockito.never())
            .findByLocalIdAndMesaIdOrderByFechaHoraDesc(Mockito.anyLong(), Mockito.anyLong())
    }

    @Test
    fun `mesa OCUPADA sin marca de sesion no muestra producciones`() {
        stubListar(mesaBase.copy(estado = EstadoMesa.OCUPADA))

        assertEquals(emptyList(), service.listarProducciones(admin, null, 7L))

        Mockito.verify(produccionRepository, Mockito.never())
            .findByLocalIdAndMesaIdOrderByFechaHoraDesc(Mockito.anyLong(), Mockito.anyLong())
    }

    @Test
    fun `mesa OCUPADA solo muestra lo producido desde la ocupacion actual`() {
        val inicio = LocalDateTime.now().minusHours(1)
        stubListar(mesaBase.copy(estado = EstadoMesa.OCUPADA, fechaOcupacion = inicio))
        Mockito.`when`(produccionRepository.findByLocalIdAndMesaIdOrderByFechaHoraDesc(10L, 7L))
            .thenReturn(
                listOf(
                    produccion(3, inicio.plusMinutes(30)),   // de la sesión actual
                    produccion(2, inicio),                   // justo al ocupar (borde: entra)
                    produccion(1, inicio.minusMinutes(1))    // de una ocupación anterior: fuera
                )
            )

        val visibles = service.listarProducciones(admin, null, 7L)

        assertEquals(listOf(3L, 2L), visibles.map { it.id })
    }

    @Test
    fun `vista global sin mesaId no se ve afectada por la sesion`() {
        Mockito.`when`(localContextService.resolverLocal(admin, null)).thenReturn(local)
        Mockito.`when`(produccionRepository.findByLocalIdOrderByFechaHoraDesc(10L))
            .thenReturn(listOf(produccion(1, LocalDateTime.now().minusDays(3))))

        val visibles = service.listarProducciones(admin, null, null)

        assertEquals(listOf(1L), visibles.map { it.id })
        Mockito.verify(mesaService, Mockito.never()).mesaDelLocal(cualquiera(), Mockito.anyLong())
    }
}
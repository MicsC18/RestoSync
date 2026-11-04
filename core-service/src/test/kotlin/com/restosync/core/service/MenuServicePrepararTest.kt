package com.restosync.core.service

import com.restosync.core.dto.PrepararRequest
import com.restosync.core.model.Insumo
import com.restosync.core.model.Local
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
}
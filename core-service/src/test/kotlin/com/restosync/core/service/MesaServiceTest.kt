package com.restosync.core.service

import com.restosync.core.dto.MesaRequest
import com.restosync.core.model.EstadoMesa
import com.restosync.core.model.Local
import com.restosync.core.model.Mesa
import com.restosync.core.model.Restaurante
import com.restosync.core.model.RolUsuario
import com.restosync.core.repository.MesaRepository
import com.restosync.core.repository.ProduccionRepository
import com.restosync.core.security.UsuarioPrincipal
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito
import java.time.LocalDateTime
import java.util.Optional
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertSame

/**
 * Tests de sesión de platos por mesa (Plan-Mesas-Dictado §1), sin base de datos:
 * las transiciones de estado mantienen la marca `fechaOcupacion` correcta —
 * entrar a OCUPADA abre sesión, liberarla la cierra, y una sesión en curso no se reinicia.
 */
class MesaServiceTest {

    private val mesaRepository = Mockito.mock(MesaRepository::class.java)
    private val produccionRepository = Mockito.mock(ProduccionRepository::class.java)
    private val localContextService = Mockito.mock(LocalContextService::class.java)

    private val service = MesaService(mesaRepository, produccionRepository, localContextService)

    private val restaurante = Restaurante(id = 1, nombre = "La Farola")
    private val local = Local(id = 10, nombre = "La Farola", restaurante = restaurante)
    private val admin = UsuarioPrincipal(1, "admin@lafarola.com", RolUsuario.ADMIN_RESTAURANTE, 1, null)

    /** Matcher nulo-seguro para verificar llamadas con parámetros Kotlin no nulos. */
    private fun <T> cualquiera(): T {
        Mockito.any<T>()
        @Suppress("UNCHECKED_CAST")
        return null as T
    }

    private fun mesa(estado: EstadoMesa, marca: LocalDateTime? = null) =
        Mesa(id = 7, nombre = "Mesa 1", capacidad = 4, estado = estado, fechaOcupacion = marca, local = local)

    private fun stubSaveDevuelveLoRecibido() {
        Mockito.`when`(mesaRepository.save(cualquiera<Mesa>()))
            .thenAnswer { it.arguments[0] as Mesa }
    }

    private fun stubActualizar(mesaActual: Mesa) {
        Mockito.`when`(localContextService.resolverLocal(admin, null)).thenReturn(local)
        Mockito.`when`(mesaRepository.findById(7L)).thenReturn(Optional.of(mesaActual))
        stubSaveDevuelveLoRecibido()
    }

    private fun capturado(): Mesa {
        val captor = ArgumentCaptor.forClass(Mesa::class.java)
        Mockito.verify(mesaRepository).save(captor.capture())
        return captor.value
    }

    // ==================== marcarOcupada (usado por prepararPlato) ====================

    @Test
    fun `marcarOcupada desde LIBRE abre la sesion de platos`() {
        stubSaveDevuelveLoRecibido()

        val resultado = service.marcarOcupada(mesa(EstadoMesa.LIBRE))

        assertEquals(EstadoMesa.OCUPADA, resultado.estado)
        assertNotNull(resultado.fechaOcupacion)
    }

    @Test
    fun `marcarOcupada sobre mesa OCUPADA con sesion activa no reinicia la marca`() {
        val original = mesa(EstadoMesa.OCUPADA, LocalDateTime.now().minusHours(2))

        val resultado = service.marcarOcupada(original)

        // Devuelve la misma mesa sin guardar: la sesion en curso sigue en su marca original.
        assertSame(original, resultado)
        Mockito.verify(mesaRepository, Mockito.never()).save(cualquiera())
    }

    @Test
    fun `marcarOcupada sobre mesa OCUPADA sin marca abre la sesion`() {
        stubSaveDevuelveLoRecibido()

        val resultado = service.marcarOcupada(mesa(EstadoMesa.OCUPADA))

        assertNotNull(resultado.fechaOcupacion)
    }

    // ==================== actualizarMesa (PUT /mesas) ====================

    @Test
    fun `pasar de LIBRE a OCUPADA inicia la marca de sesion`() {
        stubActualizar(mesa(EstadoMesa.LIBRE))

        service.actualizarMesa(admin, null, 7, MesaRequest(nombre = "Mesa 1", estado = "OCUPADA"))

        val guardada = capturado()
        assertEquals(EstadoMesa.OCUPADA, guardada.estado)
        assertNotNull(guardada.fechaOcupacion)
    }

    @Test
    fun `liberar una mesa OCUPADA borra la marca de sesion`() {
        stubActualizar(mesa(EstadoMesa.OCUPADA, LocalDateTime.now().minusHours(1)))

        service.actualizarMesa(admin, null, 7, MesaRequest(nombre = "Mesa 1", estado = "LIBRE"))

        val guardada = capturado()
        assertEquals(EstadoMesa.LIBRE, guardada.estado)
        assertNull(guardada.fechaOcupacion)
    }

    @Test
    fun `pasar de OCUPADA a RESERVADA tambien borra la marca`() {
        stubActualizar(mesa(EstadoMesa.OCUPADA, LocalDateTime.now().minusHours(1)))

        service.actualizarMesa(admin, null, 7, MesaRequest(nombre = "Mesa 1", estado = "RESERVADA"))

        val guardada = capturado()
        assertEquals(EstadoMesa.RESERVADA, guardada.estado)
        assertNull(guardada.fechaOcupacion)
    }

    @Test
    fun `reafirmar OCUPADA conserva la sesion en curso`() {
        val marca = LocalDateTime.now().minusMinutes(30)
        stubActualizar(mesa(EstadoMesa.OCUPADA, marca))

        service.actualizarMesa(admin, null, 7, MesaRequest(nombre = "Mesa 1", estado = "OCUPADA"))

        val guardada = capturado()
        assertEquals(EstadoMesa.OCUPADA, guardada.estado)
        assertEquals(marca, guardada.fechaOcupacion)
    }

    @Test
    fun `editar sin informar estado no toca la marca`() {
        val marca = LocalDateTime.now().minusMinutes(30)
        stubActualizar(mesa(EstadoMesa.OCUPADA, marca))

        service.actualizarMesa(admin, null, 7, MesaRequest(nombre = "Mesa 1 nueva", capacidad = 6))

        val guardada = capturado()
        assertEquals("Mesa 1 nueva", guardada.nombre)
        assertEquals(EstadoMesa.OCUPADA, guardada.estado)
        assertEquals(marca, guardada.fechaOcupacion)
    }

    // ==================== crearMesa ====================

    @Test
    fun `crearMesa nace sin marca de sesion`() {
        stubSaveDevuelveLoRecibido()
        Mockito.`when`(localContextService.resolverLocal(admin, null)).thenReturn(local)

        val creada = service.crearMesa(admin, null, MesaRequest(nombre = "Mesa 9"))

        assertEquals(EstadoMesa.LIBRE, creada.estado)
        assertNull(creada.fechaOcupacion)
    }
}

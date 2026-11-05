package com.restosync.core.service

import com.restosync.core.model.Local
import com.restosync.core.model.Restaurante
import com.restosync.core.model.RolUsuario
import com.restosync.core.repository.InsumoRepository
import com.restosync.core.repository.LocalRepository
import com.restosync.core.repository.MesaRepository
import com.restosync.core.repository.PlatoRepository
import com.restosync.core.repository.ProduccionRepository
import com.restosync.core.repository.RestauranteRepository
import com.restosync.core.repository.UsuarioRepository
import com.restosync.core.security.UsuarioPrincipal
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class LocalServiceTest {

    private val localRepository = Mockito.mock(LocalRepository::class.java)
    private val restauranteRepository = Mockito.mock(RestauranteRepository::class.java)
    private val insumoRepository = Mockito.mock(InsumoRepository::class.java)
    private val mesaRepository = Mockito.mock(MesaRepository::class.java)
    private val platoRepository = Mockito.mock(PlatoRepository::class.java)
    private val usuarioRepository = Mockito.mock(UsuarioRepository::class.java)
    private val produccionRepository = Mockito.mock(ProduccionRepository::class.java)
    private val localContextService = LocalContextService(localRepository)

    private val service = LocalService(
        localRepository, restauranteRepository, localContextService,
        insumoRepository, mesaRepository, platoRepository, usuarioRepository, produccionRepository
    )

    private val restaurante = Restaurante(id = 1, nombre = "La Farola")
    private val admin = UsuarioPrincipal(1, "admin@lafarola.com", RolUsuario.ADMIN_RESTAURANTE, 1, null)
    private val gerente = UsuarioPrincipal(2, "gerente@lafarola.com", RolUsuario.GERENTE_LOCAL, 1, 10)
    private val local1 = Local(id = 10, nombre = "Sucursal Centro", restaurante = restaurante)
    private val local2 = Local(id = 20, nombre = "Sucursal Norte", restaurante = restaurante)

    @Test
    fun `solo admin puede eliminar un local`() {
        val ex = assertFailsWith<ResponseStatusException> {
            service.eliminar(gerente, 10)
        }
        assertEquals(HttpStatus.FORBIDDEN, ex.statusCode)
    }

    @Test
    fun `no se puede eliminar el unico local del restaurante`() {
        Mockito.`when`(localRepository.findByRestauranteIdAndId(1, 10)).thenReturn(local1)
        Mockito.`when`(localRepository.findByRestauranteId(1)).thenReturn(listOf(local1))

        val ex = assertFailsWith<ResponseStatusException> {
            service.eliminar(admin, 10)
        }
        assertEquals(HttpStatus.BAD_REQUEST, ex.statusCode)
        assert(ex.reason?.contains("único local") == true)
    }

    @Test
    fun `no se puede eliminar un local si tiene dependencias asociadas`() {
        Mockito.`when`(localRepository.findByRestauranteIdAndId(1, 10)).thenReturn(local1)
        Mockito.`when`(localRepository.findByRestauranteId(1)).thenReturn(listOf(local1, local2))

        Mockito.`when`(insumoRepository.countByLocalId(10)).thenReturn(5L)
        Mockito.`when`(mesaRepository.countByLocalId(10)).thenReturn(2L)
        Mockito.`when`(platoRepository.countByLocalId(10)).thenReturn(0L)
        Mockito.`when`(usuarioRepository.countByLocalId(10)).thenReturn(1L)
        Mockito.`when`(produccionRepository.countByLocalId(10)).thenReturn(0L)

        val ex = assertFailsWith<ResponseStatusException> {
            service.eliminar(admin, 10)
        }
        assertEquals(HttpStatus.CONFLICT, ex.statusCode)
        assert(ex.reason?.contains("5 insumo(s)") == true)
        assert(ex.reason?.contains("2 mesa(s)") == true)
        assert(ex.reason?.contains("1 gerente(s)") == true)
    }

    @Test
    fun `elimina exitosamente si no tiene dependencias y hay mas de un local`() {
        Mockito.`when`(localRepository.findByRestauranteIdAndId(1, 10)).thenReturn(local1)
        Mockito.`when`(localRepository.findByRestauranteId(1)).thenReturn(listOf(local1, local2))

        Mockito.`when`(insumoRepository.countByLocalId(10)).thenReturn(0L)
        Mockito.`when`(mesaRepository.countByLocalId(10)).thenReturn(0L)
        Mockito.`when`(platoRepository.countByLocalId(10)).thenReturn(0L)
        Mockito.`when`(usuarioRepository.countByLocalId(10)).thenReturn(0L)
        Mockito.`when`(produccionRepository.countByLocalId(10)).thenReturn(0L)

        service.eliminar(admin, 10)

        Mockito.verify(localRepository).delete(local1)
    }
}

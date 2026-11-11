package com.restosync.core.service

import com.restosync.core.model.Local
import com.restosync.core.model.Restaurante
import com.restosync.core.model.RolUsuario
import com.restosync.core.repository.LocalRepository
import com.restosync.core.security.UsuarioPrincipal
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException
import java.util.Optional
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/**
 * Tests mínimos de roles y scope por local (sin base de datos).
 * Gerente: local fijo del token, ignora el header. Admin: exige X-Local-Id
 * y solo puede operar locales de su propio restaurante.
 */
class LocalContextServiceTest {

    private val localRepository = Mockito.mock(LocalRepository::class.java)
    private val service = LocalContextService(localRepository)

    private val restaurante = Restaurante(id = 1, nombre = "La Farola")
    private val local = Local(id = 10, nombre = "La Farola", restaurante = restaurante)

    private val admin = UsuarioPrincipal(1, "admin@lafarola.com", RolUsuario.ADMIN_RESTAURANTE, 1, null)
    private val gerente = UsuarioPrincipal(2, "gerente@lafarola.com", RolUsuario.GERENTE_LOCAL, 1, 10)

    @Test
    fun `gerente usa su local fijo e ignora el header`() {
        Mockito.`when`(localRepository.findById(10L)).thenReturn(Optional.of(local))

        val resuelto = service.resolverLocal(gerente, headerLocalId = 99)

        assertEquals(10L, resuelto.id)
        Mockito.verify(localRepository, Mockito.never())
            .findByRestauranteIdAndId(Mockito.anyLong(), Mockito.anyLong())
    }

    @Test
    fun `gerente sin local asignado recibe 403`() {
        val sinLocal = gerente.copy(localId = null)

        val error = assertFailsWith<ResponseStatusException> { service.resolverLocal(sinLocal, null) }

        assertEquals(HttpStatus.FORBIDDEN, error.statusCode)
    }

    @Test
    fun `admin sin header X-Local-Id recibe 400`() {
        val error = assertFailsWith<ResponseStatusException> { service.resolverLocal(admin, null) }

        assertEquals(HttpStatus.BAD_REQUEST, error.statusCode)
    }

    @Test
    fun `admin con local de otro restaurante recibe 403`() {
        // findByRestauranteIdAndId no encuentra el local ajeno → null por defecto.
        Mockito.`when`(localRepository.findByRestauranteIdAndId(1L, 99L)).thenReturn(null)

        val error = assertFailsWith<ResponseStatusException> { service.resolverLocal(admin, 99) }

        assertEquals(HttpStatus.FORBIDDEN, error.statusCode)
    }

    @Test
    fun `admin con local inactivo recibe 400`() {
        val inactivo = local.copy(activo = false)
        Mockito.`when`(localRepository.findByRestauranteIdAndId(1L, 10L)).thenReturn(inactivo)

        val error = assertFailsWith<ResponseStatusException> { service.resolverLocal(admin, 10) }

        assertEquals(HttpStatus.BAD_REQUEST, error.statusCode)
    }

    @Test
    fun `admin con local propio resuelve correctamente`() {
        Mockito.`when`(localRepository.findByRestauranteIdAndId(1L, 10L)).thenReturn(local)

        val resuelto = service.resolverLocal(admin, 10)

        assertEquals(10L, resuelto.id)
    }

    @Test
    fun `exigirAdmin rechaza al gerente con 403`() {
        val error = assertFailsWith<ResponseStatusException> { service.exigirAdmin(gerente) }

        assertEquals(HttpStatus.FORBIDDEN, error.statusCode)
    }
}
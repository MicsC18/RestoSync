package com.restosync.core.service

import com.restosync.core.dto.CuentaGerenteRequest
import com.restosync.core.model.Local
import com.restosync.core.model.Restaurante
import com.restosync.core.model.RolUsuario
import com.restosync.core.model.Usuario
import com.restosync.core.repository.LocalRepository
import com.restosync.core.repository.MovimientoStockRepository
import com.restosync.core.repository.ProduccionRepository
import com.restosync.core.repository.RestauranteRepository
import com.restosync.core.repository.UsuarioRepository
import com.restosync.core.security.UsuarioPrincipal
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.server.ResponseStatusException
import java.util.Optional
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/**
 * Tests mínimos de Fase 6 — ABM de gerentes (sin base de datos):
 * solo el Admin opera, email único y normalizado, local del mismo restaurante,
 * contraseña cifrada y baja bloqueada si hay auditoría (FK NOT NULL).
 */
class CuentaGerenteServiceTest {

    private val usuarioRepository = Mockito.mock(UsuarioRepository::class.java)
    private val restauranteRepository = Mockito.mock(RestauranteRepository::class.java)
    private val localRepository = Mockito.mock(LocalRepository::class.java)
    private val movimientoStockRepository = Mockito.mock(MovimientoStockRepository::class.java)
    private val produccionRepository = Mockito.mock(ProduccionRepository::class.java)
    private val passwordEncoder = Mockito.mock(PasswordEncoder::class.java)
    // exigirAdmin real: la regla de rol se prueba sin mockear el guard.
    private val localContextService = LocalContextService(localRepository)

    private val service = CuentaGerenteService(
        usuarioRepository, restauranteRepository, localRepository,
        movimientoStockRepository, produccionRepository, passwordEncoder, localContextService
    )

    private val restaurante = Restaurante(id = 1, nombre = "La Farola")
    private val local = Local(id = 10, nombre = "La Farola", restaurante = restaurante)
    private val admin = UsuarioPrincipal(1, "admin@lafarola.com", RolUsuario.ADMIN_RESTAURANTE, 1, null)
    private val gerentePrincipal = UsuarioPrincipal(2, "gerente@lafarola.com", RolUsuario.GERENTE_LOCAL, 1, 10)
    private val gerente = Usuario(
        id = 7, email = "gerente@lafarola.com", contrasena = "hash",
        rol = RolUsuario.GERENTE_LOCAL, restaurante = restaurante, local = local
    )

    private fun <T> cualquiera(): T {
        Mockito.any<T>()
        @Suppress("UNCHECKED_CAST")
        return null as T
    }

    @Test
    fun `gerente no puede listar cuentas`() {
        val error = assertFailsWith<ResponseStatusException> { service.listar(gerentePrincipal) }

        assertEquals(HttpStatus.FORBIDDEN, error.statusCode)
    }

    @Test
    fun `crear con email duplicado recibe 409`() {
        Mockito.`when`(usuarioRepository.findByEmail("nuevo@x.com")).thenReturn(Optional.of(gerente))

        val error = assertFailsWith<ResponseStatusException> {
            service.crear(admin, CuentaGerenteRequest(email = "nuevo@x.com", contrasena = "123456", localId = 10))
        }

        assertEquals(HttpStatus.CONFLICT, error.statusCode)
    }

    @Test
    fun `crear con local de otro restaurante recibe 403`() {
        Mockito.`when`(usuarioRepository.findByEmail("nuevo@x.com")).thenReturn(Optional.empty())
        Mockito.`when`(localRepository.findByRestauranteIdAndId(1L, 99L)).thenReturn(null)

        val error = assertFailsWith<ResponseStatusException> {
            service.crear(admin, CuentaGerenteRequest(email = "nuevo@x.com", contrasena = "123456", localId = 99))
        }

        assertEquals(HttpStatus.FORBIDDEN, error.statusCode)
    }

    @Test
    fun `crear con contrasena corta recibe 400`() {
        Mockito.`when`(usuarioRepository.findByEmail("nuevo@x.com")).thenReturn(Optional.empty())

        val error = assertFailsWith<ResponseStatusException> {
            service.crear(admin, CuentaGerenteRequest(email = "nuevo@x.com", contrasena = "123", localId = 10))
        }

        assertEquals(HttpStatus.BAD_REQUEST, error.statusCode)
    }

    @Test
    fun `crear normaliza el email y cifra la contrasena`() {
        Mockito.`when`(usuarioRepository.findByEmail("nuevo@x.com")).thenReturn(Optional.empty())
        Mockito.`when`(localRepository.findByRestauranteIdAndId(1L, 10L)).thenReturn(local)
        Mockito.`when`(restauranteRepository.findById(1L)).thenReturn(Optional.of(restaurante))
        Mockito.`when`(passwordEncoder.encode("123456")).thenReturn("hash-bcrypt")
        Mockito.`when`(usuarioRepository.save(cualquiera<Usuario>())).thenAnswer { it.arguments[0] as Usuario }

        val dto = service.crear(
            admin, CuentaGerenteRequest(email = "  Nuevo@X.com ", contrasena = "123456", localId = 10)
        )

        assertEquals("nuevo@x.com", dto.email)
        assertEquals(10L, dto.localId)
        val guardado = ArgumentCaptor.forClass(Usuario::class.java)
        Mockito.verify(usuarioRepository).save(guardado.capture())
        assertEquals(RolUsuario.GERENTE_LOCAL, guardado.value.rol)
        assertEquals("hash-bcrypt", guardado.value.contrasena)
    }

    @Test
    fun `eliminar con auditoria recibe 409 y no borra`() {
        Mockito.`when`(usuarioRepository.findById(7L)).thenReturn(Optional.of(gerente))
        Mockito.`when`(movimientoStockRepository.countByUsuarioId(7L)).thenReturn(3L)
        Mockito.`when`(produccionRepository.countByUsuarioId(7L)).thenReturn(0L)

        val error = assertFailsWith<ResponseStatusException> { service.eliminar(admin, 7) }

        assertEquals(HttpStatus.CONFLICT, error.statusCode)
        Mockito.verify(usuarioRepository, Mockito.never()).delete(cualquiera())
    }

    @Test
    fun `eliminar sin auditoria borra la cuenta`() {
        Mockito.`when`(usuarioRepository.findById(7L)).thenReturn(Optional.of(gerente))
        Mockito.`when`(movimientoStockRepository.countByUsuarioId(7L)).thenReturn(0L)
        Mockito.`when`(produccionRepository.countByUsuarioId(7L)).thenReturn(0L)

        service.eliminar(admin, 7)

        Mockito.verify(usuarioRepository).delete(gerente)
    }

    @Test
    fun `no se puede editar la cuenta de un admin`() {
        val otroAdmin = gerente.copy(rol = RolUsuario.ADMIN_RESTAURANTE)
        Mockito.`when`(usuarioRepository.findById(7L)).thenReturn(Optional.of(otroAdmin))

        val error = assertFailsWith<ResponseStatusException> {
            service.actualizar(admin, 7, CuentaGerenteRequest(email = "x@x.com"))
        }

        assertEquals(HttpStatus.NOT_FOUND, error.statusCode)
    }
}
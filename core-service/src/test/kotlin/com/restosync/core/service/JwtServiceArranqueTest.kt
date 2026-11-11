package com.restosync.core.service

import com.restosync.core.model.RolUsuario
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * Salvapanta: la clave de firma JWT llega solo por configuración
 * (`restosync.jwt.secret`, alimentada por el perfil `local` o la variable `JWT_SECRET`) y el
 * core **no levanta** sin una clave válida de al menos 32 bytes. Con la clave vacía — el caso
 * de arrancar sin perfil, porque la propiedad se define como `${JWT_SECRET:}` — la construcción
 * del bean falla de entrada; por eso la prueba usa `ApplicationContextRunner` en vez del
 * contexto completo, que además exigiría la base de datos.
 */
class JwtServiceArranqueTest {

    private fun runner(): ApplicationContextRunner =
        ApplicationContextRunner().withUserConfiguration(CfgJwtTest::class.java)

    @Test
    fun `sin secreto en la configuracion el core no levanta`() {
        runner()
            .withPropertyValues("restosync.jwt.secret=")
            .run { context ->
                val failure = context.startupFailure
                assertNotNull(failure, "JwtService no puede construirse con la clave vacía")
                assertTrue(
                    generateSequence(failure) { it.cause }.any { it is IllegalStateException },
                    "el fallo de arranque debe venir de la validación de JwtService",
                )
            }
    }

    @Test
    fun `un secreto mas corto de 32 bytes tampoco levanta el core`() {
        runner()
            .withPropertyValues("restosync.jwt.secret=corta")
            .run { context ->
                assertNotNull(context.startupFailure, "una clave de menos de 32 bytes debe bloquear el arranque")
            }
    }

    @Test
    fun `con un secreto valido el contexto levanta y expone JwtService`() {
        runner()
            .withPropertyValues("restosync.jwt.secret=$CLAVE_OK")
            .run { context ->
                assertNull(context.startupFailure, "con clave válida el contexto no puede fallar")
                assertNotNull(context.getBean(JwtService::class.java))
            }
    }

    @Test
    fun `la clave vacía falla con un mensaje que dice donde configurarla`() {
        val error = assertThrows(IllegalStateException::class.java) { JwtService("") }
        assertTrue(
            error.message!!.contains("restosync.jwt.secret"),
            "el mensaje debe nombrar la propiedad a configurar: ${error.message}",
        )
    }

    @Test
    fun `la clave corta falla con un mensaje que explica el mínimo de 32 bytes`() {
        val error = assertThrows(IllegalStateException::class.java) { JwtService("corta") }
        assertTrue(
            error.message!!.contains("32 bytes"),
            "el mensaje debe explicar el mínimo: ${error.message}",
        )
    }

    @Test
    fun `con clave valida genera tokens que se pudieron verificar`() {
        val jwt = JwtService(CLAVE_OK)
        val token = jwt.generarToken(7L, 3L, "gerente@lafarola.com", RolUsuario.GERENTE_LOCAL, 5L)

        val principal = jwt.extraerPrincipal(token)
        assertEquals(7L, principal.usuarioId)
        assertEquals(3L, principal.restauranteId)
        assertEquals(5L, principal.localId)
        assertEquals("gerente@lafarola.com", principal.email)
        assertEquals(RolUsuario.GERENTE_LOCAL, principal.rol)
    }

    @Test
    fun `el token vence a las 12 horas`() {
        val jwt = JwtService(CLAVE_OK)
        val token = jwt.generarToken(1L, 1L, "admin@lafarola.com", RolUsuario.ADMIN_RESTAURANTE)

        val claims = jwt.parseClaims(token)
        val vigenciaMs = claims.expiration.time - claims.issuedAt.time
        assertEquals(1000L * 60 * 60 * 12, vigenciaMs, "la validez debe ser 12 h")
    }

    @Test
    fun `un token firmado con otra clave se rechaza`() {
        val tokenAjeno = JwtService(CLAVE_DISTINTA)
            .generarToken(1L, 1L, "falsario@lafarola.com", RolUsuario.ADMIN_RESTAURANTE)

        assertThrows(Exception::class.java) { JwtService(CLAVE_OK).parseClaims(tokenAjeno) }
    }

    @Configuration(proxyBeanMethods = false)
    class CfgJwtTest {
        @Bean
        fun jwtService(@Value("\${restosync.jwt.secret}") clave: String): JwtService =
            JwtService(clave)
    }

    companion object {
        private const val CLAVE_OK = "ClaveDePruebaSuficientementeLargaParaElHS256DelTp"
        private const val CLAVE_DISTINTA = "OtraClaveDePruebaTambienLargaParaFirmarTokenDistintos"
    }
}

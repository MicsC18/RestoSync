package com.restosync.core

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.io.StringReader
import java.util.Properties

/**
 * Salvapanta de `Plan-Mejoras.md` §1: `application.properties` (versionado) no puede volver a
 * contener credenciales, ni siquiera como default de un placeholder. Sin credenciales de respaldo,
 * arrancar el core sin el perfil `local` ni las variables de entorno falla con
 * `Could not resolve placeholder 'DB_URL'` en vez de conectar contra una base sorpresa.
 *
 * No levanta el contexto de Spring: lee los archivos como recurso, así que la prueba corre sin red
 * ni base de datos (mismo criterio que el resto de los unitarios del proyecto).
 */
class ConfiguracionSinCredencialesTest {

    private fun propiedadesDe(resourceName: String): Properties =
        Properties().apply { StringReader(leerTexto(resourceName)).use { load(it) } }

    private fun leerTexto(resourceName: String): String =
        requireNotNull(javaClass.classLoader.getResourceAsStream(resourceName)) {
            "No se encontró $resourceName en el classpath"
        }.use { String(it.readBytes(), Charsets.UTF_8) }

    @Test
    fun `application properties lee las credenciales del entorno sin defaults`() {
        val props = propiedadesDe("application.properties")

        listOf("spring.datasource.url", "spring.datasource.username", "spring.datasource.password")
            .forEach { clave ->
                val valor = props.getProperty(clave)
                assertTrue(valor != null && valor.contains("\${"), "$clave debe leerse de una variable: $valor")
                assertFalse(valor.contains(":"), "$clave no puede traer un valor de respaldo: $valor")
            }
    }

    @Test
    fun `application properties versionado no contiene secretos`() {
        val crudo = leerTexto("application.properties")

        assertFalse(crudo.contains("neon.tech"), "no debe mencionar el host de la base")
        assertFalse(crudo.contains("npg_"), "no debe contener contraseñas de Neon")
        assertFalse(crudo.contains("neondb_owner"), "no debe contener el rol de la base")
        assertFalse(
            crudo.contains("RestoSyncSuperSecretaClave"),
            "no debe contener la clave de firma JWT",
        )
    }

    @Test
    fun `el perfil local es el unico que lleva los valores reales`() {
        val props = propiedadesDe("application-local.properties")

        assertTrue(props.getProperty("spring.datasource.url").startsWith("jdbc:postgresql://"))
        assertTrue(props.getProperty("spring.datasource.password").isNotBlank())
        assertTrue(
            props.getProperty("restosync.jwt.secret").toByteArray(Charsets.UTF_8).size >= 32,
            "la clave JWT debe tener al menos 32 bytes para HS256",
        )
    }
}

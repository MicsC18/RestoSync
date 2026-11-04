package com.restosync.core

import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest

/**
 * El arranque completo del contexto requiere conexión a la base Neon (red + credenciales).
 * La lógica de negocio se cubre con tests unitarios sin DB en `com.restosync.core.service`.
 */
@SpringBootTest
@Disabled("Requiere conexión a Neon; la lógica se prueba en los tests unitarios de service")
class CoreServiceApplicationTests {

	@Test
	fun contextLoads() {
	}

}
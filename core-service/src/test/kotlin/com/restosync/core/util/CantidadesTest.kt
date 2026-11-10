package com.restosync.core.util

import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test

/** Tests del helper único de cantidades (precisión de dos decimales del dominio). */
class CantidadesTest {

    @Test
    fun `redondear normaliza el ruido de sumas y restas`() {
        assertEquals(0.3, redondear(0.1 + 0.2))
        assertEquals(9.2, redondear(12.3 - 3.1000000000000005))
        assertEquals(9.2, redondear(9.200000000000003))
        assertEquals(0.7, redondear(1.0 - 0.3))
    }

    @Test
    fun `redondear no toca los valores ya limpios`() {
        assertEquals(2.0, redondear(2.0))
        assertEquals(0.5, redondear(0.5))
        assertEquals(-9.2, redondear(-9.2))
    }

    @Test
    fun `cantidadLegible muestra enteros sin punto y decimales sin ruido`() {
        assertEquals("2", cantidadLegible(2.0))
        assertEquals("9.2", cantidadLegible(9.200000000000003))
        assertEquals("0.3", cantidadLegible(0.1 * 3))
    }

    @Test
    fun `tieneRuidoPuntoFlotante detecta solo lo contaminado`() {
        assertTrue(tieneRuidoPuntoFlotante(9.200000000000003))
        assertFalse(tieneRuidoPuntoFlotante(9.2))
        assertFalse(tieneRuidoPuntoFlotante(0.0))
    }
}

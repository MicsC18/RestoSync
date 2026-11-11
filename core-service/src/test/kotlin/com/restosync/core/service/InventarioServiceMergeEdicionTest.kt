package com.restosync.core.service

import com.restosync.core.dto.InsumoRequest
import com.restosync.core.model.Insumo
import com.restosync.core.model.Local
import com.restosync.core.model.Lote
import com.restosync.core.model.MovimientoStock
import com.restosync.core.model.Plato
import com.restosync.core.model.RecetaInsumo
import com.restosync.core.model.Restaurante
import com.restosync.core.model.RolUsuario
import com.restosync.core.model.TipoMovimiento
import com.restosync.core.model.Usuario
import com.restosync.core.repository.InsumoRepository
import com.restosync.core.repository.LoteRepository
import com.restosync.core.repository.MovimientoStockRepository
import com.restosync.core.repository.RecetaInsumoRepository
import com.restosync.core.repository.UsuarioRepository
import com.restosync.core.security.UsuarioPrincipal
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import java.time.LocalDate
import java.util.Optional
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Merge al editar: si la fila corregida queda con el mismo nombre, la misma unidad y el mismo
 * vencimiento (lote más próximo) que otra del local, se fusionan en la existente. Sin base de
 * datos: los repositories se mockean contra mapas en memoria que simulan las tablas, así los
 * tests verifican el estado final (lotes sumados/mudados, recetas reenganchadas, auditoría viva).
 */
class InventarioServiceMergeEdicionTest {

    private val insumoRepository = Mockito.mock(InsumoRepository::class.java)
    private val loteRepository = Mockito.mock(LoteRepository::class.java)
    private val movimientoRepository = Mockito.mock(MovimientoStockRepository::class.java)
    private val recetaInsumoRepository = Mockito.mock(RecetaInsumoRepository::class.java)
    private val usuarioRepository = Mockito.mock(UsuarioRepository::class.java)
    private val localContextService = Mockito.mock(LocalContextService::class.java)

    private val service = InventarioService(
        insumoRepository, loteRepository, movimientoRepository, recetaInsumoRepository,
        usuarioRepository, localContextService
    )

    private val restaurante = Restaurante(id = 1, nombre = "La Farola")
    private val local = Local(id = 10, nombre = "La Farola", restaurante = restaurante)
    private val admin = UsuarioPrincipal(1, "admin@lafarola.com", RolUsuario.ADMIN_RESTAURANTE, 1, null)
    private val usuario = Usuario(id = 1, email = admin.email, contrasena = "hash", restaurante = restaurante)
    private val hoy = LocalDate.now()

    // "Tablas" en memoria: los save/delete de los mocks escriben acá y las queries leen de acá.
    private val insumos = mutableMapOf<Long, Insumo>()
    private val lotes = mutableMapOf<Long, Lote>()
    private val movimientos = mutableListOf<MovimientoStock>()
    private val recetas = mutableMapOf<Long, RecetaInsumo>()
    private var nextId = 10000L

    /** Matcher nulo-seguro para parámetros objeto; los `long` primitivos van con anyLong(). */
    private fun <T> cualquiera(): T {
        Mockito.any<T>()
        @Suppress("UNCHECKED_CAST")
        return null as T
    }

    private fun stubBase() {
        Mockito.`when`(localContextService.resolverLocal(admin, null)).thenReturn(local)
        Mockito.`when`(usuarioRepository.findById(1L)).thenReturn(Optional.of(usuario))

        Mockito.`when`(insumoRepository.save(cualquiera<Insumo>())).thenAnswer { inv ->
            val insumo = inv.arguments[0] as Insumo
            val conId = if (insumo.id == 0L) insumo.copy(id = nextId++) else insumo
            insumos[conId.id] = conId
            conId
        }
        Mockito.`when`(insumoRepository.findById(Mockito.anyLong())).thenAnswer { inv ->
            Optional.ofNullable(insumos[inv.arguments[0] as Long])
        }
        Mockito.`when`(insumoRepository.findByLocalIdAndNombreIgnoreCase(Mockito.anyLong(), cualquiera<String>()))
            .thenAnswer { inv ->
                insumos.values.filter {
                    it.local?.id == inv.arguments[0] as Long && it.nombre.equals(inv.arguments[1] as String, ignoreCase = true)
                }
            }
        Mockito.`when`(insumoRepository.delete(cualquiera<Insumo>())).thenAnswer { inv ->
            insumos.remove((inv.arguments[0] as Insumo).id)
            null
        }

        Mockito.`when`(loteRepository.save(cualquiera<Lote>())).thenAnswer { inv ->
            val lote = inv.arguments[0] as Lote
            val conId = if (lote.id == 0L) lote.copy(id = nextId++) else lote
            lotes[conId.id] = conId
            conId
        }
        Mockito.`when`(loteRepository.findByInsumoIdOrderByFechaVencimientoAsc(Mockito.anyLong()))
            .thenAnswer { inv -> lotes.values.filter { it.insumo.id == inv.arguments[0] as Long }.sortedBy { it.fechaVencimiento } }
        Mockito.`when`(loteRepository.findByInsumoId(Mockito.anyLong()))
            .thenAnswer { inv -> lotes.values.filter { it.insumo.id == inv.arguments[0] as Long } }
        Mockito.`when`(loteRepository.findByInsumoIdAndFechaVencimiento(Mockito.anyLong(), cualquiera<LocalDate>()))
            .thenAnswer { inv ->
                lotes.values.firstOrNull {
                    it.insumo.id == inv.arguments[0] as Long && it.fechaVencimiento == inv.arguments[1] as LocalDate
                }
            }
        Mockito.`when`(loteRepository.delete(cualquiera<Lote>())).thenAnswer { inv ->
            lotes.remove((inv.arguments[0] as Lote).id)
            null
        }

        Mockito.`when`(movimientoRepository.save(cualquiera<MovimientoStock>())).thenAnswer { inv ->
            (inv.arguments[0] as MovimientoStock).also { movimientos.add(it) }
        }
        Mockito.`when`(movimientoRepository.findByInsumoId(Mockito.anyLong()))
            .thenAnswer { inv -> movimientos.filter { it.insumo?.id == inv.arguments[0] as Long } }
        Mockito.`when`(movimientoRepository.findByLoteId(Mockito.anyLong()))
            .thenAnswer { inv -> movimientos.filter { it.lote?.id == inv.arguments[0] as Long } }

        Mockito.`when`(recetaInsumoRepository.save(cualquiera<RecetaInsumo>())).thenAnswer { inv ->
            val linea = inv.arguments[0] as RecetaInsumo
            val conId = if (linea.id == 0L) linea.copy(id = nextId++) else linea
            recetas[conId.id] = conId
            conId
        }
        Mockito.`when`(recetaInsumoRepository.findByInsumoId(Mockito.anyLong()))
            .thenAnswer { inv -> recetas.values.filter { it.insumo?.id == inv.arguments[0] as Long } }
        Mockito.`when`(recetaInsumoRepository.findByPlatoId(Mockito.anyLong()))
            .thenAnswer { inv -> recetas.values.filter { it.plato?.id == inv.arguments[0] as Long } }
        Mockito.`when`(recetaInsumoRepository.delete(cualquiera<RecetaInsumo>())).thenAnswer { inv ->
            recetas.remove((inv.arguments[0] as RecetaInsumo).id)
            null
        }
    }

    /** Fila con sus lotes: `pares` = cantidad a días de vencimiento desde hoy. */
    private fun fila(id: Long, nombre: String, unidad: String, vararg pares: Pair<Double, Long>): Insumo {
        val insumo = Insumo(id = id, nombre = nombre, unidadMedida = unidad, local = local, restaurante = restaurante)
        insumos[id] = insumo
        pares.forEachIndexed { i, (cantidad, dias) ->
            val lote = Lote(id = id * 10 + i, cantidad = cantidad, fechaVencimiento = hoy.plusDays(dias), insumo = insumo)
            lotes[lote.id] = lote
        }
        return insumo
    }

    private fun editar(id: Long, nombre: String, unidad: String, dias: Int, cantidad: Double): Insumo =
        service.actualizarInsumo(
            admin, null, id,
            InsumoRequest(nombre = nombre, cantidad = cantidad, diasRestantes = dias, unidadMedida = unidad)
        )

    @Test
    fun `editar a nombre unidad y vencimiento de otra fila fusiona el stock en la existente`() {
        stubBase()
        fila(100, "Leche", "l", 2.0 to 5L)
        fila(200, "Leche", "l", 3.0 to 5L)

        val resultado = editar(100, "Leche", "l", 5, 2.0)

        assertEquals(200L, resultado.id)
        assertEquals(5.0, resultado.cantidad)
        assertFalse(insumos.containsKey(100L))
        val lotesDestino = lotes.values.filter { it.insumo.id == 200L }
        assertEquals(1, lotesDestino.size)
        assertEquals(5.0, lotesDestino.first().cantidad)
    }

    @Test
    fun `unidad distinta no fusiona aunque coincidan nombre y vencimiento`() {
        stubBase()
        fila(100, "Leche", "l", 2.0 to 5L)
        fila(200, "Leche", "kg", 3.0 to 5L)

        val resultado = editar(100, "Leche", "l", 5, 2.0)

        assertEquals(100L, resultado.id)
        assertEquals(2, insumos.size)
    }

    @Test
    fun `vencimiento distinto no fusiona aunque coincidan nombre y unidad`() {
        stubBase()
        fila(100, "Leche", "l", 2.0 to 5L)
        fila(200, "Leche", "l", 3.0 to 9L)

        val resultado = editar(100, "Leche", "l", 5, 2.0)

        assertEquals(100L, resultado.id)
        assertEquals(2, insumos.size)
    }

    @Test
    fun `lotes con otro vencimiento se mudan a la fila destino sin perderse`() {
        stubBase()
        fila(100, "Leche", "l", 2.0 to 5L, 1.0 to 9L)
        fila(200, "Leche", "l", 3.0 to 5L)

        val resultado = editar(100, "Leche", "l", 5, 3.0)

        assertEquals(200L, resultado.id)
        assertEquals(6.0, resultado.cantidad)
        assertEquals(5, resultado.diasRestantes)
        val lotesDestino = lotes.values.filter { it.insumo.id == 200L }.sortedBy { it.fechaVencimiento }
        assertEquals(listOf(5.0, 1.0), lotesDestino.map { it.cantidad })
        assertFalse(lotes.containsKey(1000L))
    }

    @Test
    fun `recetas de la fila editada se reenganchan y no duplican la linea del plato`() {
        stubBase()
        val editado = fila(100, "Leche", "l", 2.0 to 5L)
        val destino = fila(200, "Leche", "l", 3.0 to 5L)
        val plato = Plato(id = 50, nombre = "Café con leche", local = local)
        recetas[1L] = RecetaInsumo(id = 1, plato = plato, insumo = editado, cantidad = 0.5)
        recetas[2L] = RecetaInsumo(id = 2, plato = plato, insumo = destino, cantidad = 0.25)

        editar(100, "Leche", "l", 5, 2.0)

        assertEquals(1, recetas.size)
        val linea = recetas.values.first()
        assertEquals(200L, linea.insumo?.id)
        assertEquals(0.75, linea.cantidad)
    }

    @Test
    fun `la auditoria de la fila que desaparece sobrevive bajo la fila destino`() {
        stubBase()
        val editado = fila(100, "Leche", "l", 2.0 to 5L)
        fila(200, "Leche", "l", 3.0 to 5L)
        val alta = MovimientoStock(
            tipo = TipoMovimiento.ENTRADA, cantidad = 2.0, motivo = "Alta de compra",
            insumo = editado, lote = lotes[1000L], usuario = usuario, local = local
        )
        movimientos.add(alta)

        editar(100, "Leche", "l", 5, 2.0)

        assertEquals(200L, alta.insumo?.id)
        assertEquals(2000L, alta.lote?.id)
        assertTrue(movimientos.any { it.tipo == TipoMovimiento.AJUSTE && it.cantidad == 2.0 && it.motivo!!.contains("Edición fusionada") })
    }

    @Test
    fun `alta con unidad distinta no suma aunque coincida el vencimiento`() {
        stubBase()
        fila(100, "Harina", "kg", 1.0 to 30L)

        val resultado = service.registrarCompra(
            admin, null,
            InsumoRequest(nombre = "Harina", cantidad = 1.0, diasRestantes = 30, unidadMedida = "l")
        )

        assertTrue(resultado.id != 100L)
        assertEquals(2, insumos.size)
        assertEquals(1.0, lotes.values.first { it.insumo.id == 100L }.cantidad)
    }
}

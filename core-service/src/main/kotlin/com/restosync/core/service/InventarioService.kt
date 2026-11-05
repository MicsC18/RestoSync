package com.restosync.core.service

import com.restosync.core.dto.InsumoRequest
import com.restosync.core.dto.LoteRequest
import com.restosync.core.dto.MovimientoDto
import com.restosync.core.model.Insumo
import com.restosync.core.model.Local
import com.restosync.core.model.Lote
import com.restosync.core.model.MovimientoStock
import com.restosync.core.model.TipoMovimiento
import com.restosync.core.repository.InsumoRepository
import com.restosync.core.repository.LoteRepository
import com.restosync.core.repository.MovimientoStockRepository
import com.restosync.core.repository.RecetaInsumoRepository
import com.restosync.core.repository.UsuarioRepository
import com.restosync.core.security.UsuarioPrincipal
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/**
 * Inventario por local: alta con merge (§4.5 del plan), CRUD correctivo,
 * lotes y movimientos de stock auditables.
 *
 * Regla de merge: mismo nombre (normalizado) + mismo vencimiento en el local → suma
 * cantidad a la fila existente. Mismo nombre con vencimiento distinto → fila nueva e
 * independiente, con su propio lote y vencimiento visible. `cantidad`, `diasRestantes` y
 * `vencimiento` del insumo son agregados de visualización derivados de sus lotes.
 */
@Service
class InventarioService(
    private val insumoRepository: InsumoRepository,
    private val loteRepository: LoteRepository,
    private val movimientoRepository: MovimientoStockRepository,
    private val recetaInsumoRepository: RecetaInsumoRepository,
    private val usuarioRepository: UsuarioRepository,
    private val localContextService: LocalContextService
) {

    private val formatoFecha: DateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy")

    // Íconos por categoría (alineados con los que asigna la IA en restosync-ia).
    private val iconosPorCategoria = mapOf(
        "Lácteos" to "🥛",
        "Carnes" to "🍗",
        "Frutas y verduras" to "🥬",
        "Bebidas" to "🥤",
        "Panadería" to "🍞",
        "Almacén" to "🫙"
    )

    // Palabras clave del nombre → emoji (tiene prioridad sobre la categoría).
    private val iconosPorNombre = listOf(
        "pollo" to "🍗", "carne" to "🥩", "cerdo" to "🥓", "pescado" to "🐟", "salmon" to "🐟",
        "leche" to "🥛", "queso" to "🧀", "yogur" to "🥛", "manteca" to "🧈", "huevo" to "🥚",
        "tomate" to "🍅", "lechuga" to "🥬", "cebolla" to "🧅", "papa" to "🥔", "zanahoria" to "🥕",
        "banana" to "🍌", "manzana" to "🍎", "limon" to "🍋", "naranja" to "🍊", "palta" to "🥑",
        "aceite" to "🫙", "arroz" to "🍚", "fideo" to "🍝", "harina" to "🌾", "pan" to "🍞",
        "azucar" to "🍬", "sal" to "🧂", "cafe" to "☕", "cerveza" to "🍺", "vino" to "🍷",
        "gaseosa" to "🥤", "jugo" to "🧃", "agua" to "💧"
    )

    // =========================
    // INSUMOS
    // =========================

    @Transactional(readOnly = true)
    fun listarInsumos(principal: UsuarioPrincipal, localIdHeader: Long?): List<Insumo> {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        return insumoRepository.findByLocalId(local.id)
    }

    /** Alta principal (IA / dictado) y auxiliar (manual). Aplica merge §4.5. */
    @Transactional
    fun registrarCompra(principal: UsuarioPrincipal, localIdHeader: Long?, request: InsumoRequest): Insumo {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val nombre = request.nombre.trim()
        if (nombre.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre del insumo es obligatorio")
        }
        val cantidad = request.cantidad ?: 1.0
        if (cantidad <= 0) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad debe ser mayor a cero")
        }
        val diasRestantes = request.diasRestantes ?: 30
        if (diasRestantes < 0) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Los días restantes no pueden ser negativos")
        }
        val fechaVencimiento = LocalDate.now().plusDays(diasRestantes.toLong())

        // Merge (§4.5): entre las filas homónimas, solo suma la que ya tenga un lote
        // con este vencimiento exacto. Si el vencimiento es distinto → fila nueva, visible,
        // con su propio lote (no se mezcla con el stock de otro vencimiento).
        var existente: Insumo? = null
        var lotePrevio: Lote? = null
        for (candidato in insumoRepository.findByLocalIdAndNombreIgnoreCase(local.id, nombre)) {
            val lote = loteRepository.findByInsumoIdAndFechaVencimiento(candidato.id, fechaVencimiento)
            if (lote != null) {
                existente = candidato
                lotePrevio = lote
                break
            }
        }

        val base = existente?.copy(
            categoria = request.categoria ?: existente.categoria,
            icono = request.icono ?: existente.icono,
            unidadMedida = request.unidadMedida ?: existente.unidadMedida,
            estado = request.estado ?: existente.estado
        ) ?: Insumo(
            nombre = nombre,
            categoria = request.categoria ?: "Almacén",
            icono = request.icono ?: iconoAutomatico(nombre, request.categoria ?: "Almacén"),
            unidadMedida = request.unidadMedida ?: "Unidades",
            stockMinimo = request.stockMinimo ?: 1.0,
            cantidad = 0.0,
            diasRestantes = diasRestantes,
            estado = request.estado ?: "Cerrado",
            local = local,
            // Compatibilidad con la columna legacy restaurante_id en Neon.
            restaurante = local.restaurante
        )
        val insumo = insumoRepository.save(base)

        val lote = loteRepository.save(
            lotePrevio?.copy(cantidad = lotePrevio.cantidad + cantidad)
                ?: Lote(cantidad = cantidad, fechaVencimiento = fechaVencimiento, insumo = insumo)
        )

        val actualizado = recalcularAgregados(insumo)
        registrarMovimiento(
            tipo = TipoMovimiento.ENTRADA,
            cantidad = cantidad,
            insumo = actualizado,
            lote = lote,
            principal = principal,
            local = local,
            motivo = if (lotePrevio != null) "Alta repetida: cantidad sumada al lote existente" else "Alta de compra"
        )
        return actualizado
    }

    /** CRUD correctivo: corrige metadata, cantidad total y/o vencimiento del lote más próximo. */
    @Transactional
    fun actualizarInsumo(principal: UsuarioPrincipal, localIdHeader: Long?, id: Long, request: InsumoRequest): Insumo {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val insumo = insumoDelLocal(local, id)

        // El mismo nombre con distinto vencimiento es válido (filas independientes, §4.5);
        // no se rechaza el renombre a un nombre ya existente.
        val nombre = request.nombre.trim().ifBlank { insumo.nombre }

        val totalPrevio = loteRepository.findByInsumoId(insumo.id).sumOf { it.cantidad }
        ajustarCantidad(insumo, request)
        ajustarVencimiento(insumo, request)

        // Si cambia la categoría o el nombre y no se mandó un ícono explícito, se recalcula
        // el ícono automático para que acompañe al producto (los emojis que usa la IA).
        val categoriaNueva = request.categoria ?: insumo.categoria
        val iconoNuevo = request.icono
            ?: if (categoriaNueva != insumo.categoria || !nombre.equals(insumo.nombre, ignoreCase = true)) {
                iconoAutomatico(nombre, categoriaNueva)
            } else {
                insumo.icono
            }

        val corregido = insumoRepository.save(
            insumo.copy(
                nombre = nombre,
                categoria = categoriaNueva,
                icono = iconoNuevo,
                unidadMedida = request.unidadMedida ?: insumo.unidadMedida,
                stockMinimo = request.stockMinimo ?: insumo.stockMinimo,
                estado = request.estado ?: insumo.estado
            )
        )
        val actualizado = recalcularAgregados(corregido)

        if (request.cantidad != null || request.diasRestantes != null) {
            registrarMovimiento(
                tipo = TipoMovimiento.AJUSTE,
                cantidad = (request.cantidad ?: totalPrevio) - totalPrevio,
                insumo = actualizado,
                lote = loteRepository.findByInsumoIdOrderByFechaVencimientoAsc(insumo.id).firstOrNull(),
                principal = principal,
                local = local,
                motivo = "Corrección manual de insumo"
            )
        }
        return actualizado
    }

    @Transactional
    fun eliminarInsumo(principal: UsuarioPrincipal, localIdHeader: Long?, id: Long) {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val insumo = insumoDelLocal(local, id)
        // Integridad con el menú: si es ingrediente de algún plato, no se puede borrar
        // (la receta referencia esta fila por id). Hay que quitarlo de las recetas primero.
        val recetas = recetaInsumoRepository.countByInsumoId(insumo.id)
        if (recetas > 0) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "No se puede eliminar: es ingrediente de $recetas plato(s) del menú. Quitálo de las recetas primero."
            )
        }
        movimientoRepository.deleteByInsumoId(insumo.id)
        loteRepository.deleteAll(loteRepository.findByInsumoId(insumo.id))
        insumoRepository.delete(insumo)
    }

    // =========================
    // LOTES
    // =========================

    @Transactional(readOnly = true)
    fun listarLotes(principal: UsuarioPrincipal, localIdHeader: Long?, insumoId: Long): List<Lote> {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        insumoDelLocal(local, insumoId)
        return loteRepository.findByInsumoIdOrderByFechaVencimientoAsc(insumoId)
    }

    @Transactional
    fun crearLote(principal: UsuarioPrincipal, localIdHeader: Long?, lote: Lote): Lote {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val insumo = insumoDelLocal(local, lote.insumo.id)
        if (lote.cantidad <= 0) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad del lote debe ser mayor a cero")
        }
        val previo = loteRepository.findByInsumoIdAndFechaVencimiento(insumo.id, lote.fechaVencimiento)
        val guardado = loteRepository.save(
            previo?.copy(cantidad = previo.cantidad + lote.cantidad) ?: lote.copy(insumo = insumo)
        )
        recalcularAgregados(insumo)
        registrarMovimiento(
            tipo = TipoMovimiento.ENTRADA,
            cantidad = lote.cantidad,
            insumo = insumo,
            lote = guardado,
            principal = principal,
            local = local,
            motivo = "Alta manual de lote"
        )
        return guardado
    }

    @Transactional
    fun actualizarLote(principal: UsuarioPrincipal, localIdHeader: Long?, loteId: Long, request: LoteRequest): Lote {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val lote = loteRepository.findById(loteId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Lote no encontrado")
        }
        val insumo = insumoDelLocal(local, lote.insumo.id)
        val cantidad = request.cantidad ?: lote.cantidad
        if (cantidad < 0) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad del lote no puede ser negativa")
        }
        val fechaVencimiento = request.fechaVencimiento ?: lote.fechaVencimiento
        val guardado = loteRepository.save(lote.copy(cantidad = cantidad, fechaVencimiento = fechaVencimiento))
        recalcularAgregados(insumo)
        registrarMovimiento(
            tipo = TipoMovimiento.AJUSTE,
            cantidad = cantidad - lote.cantidad,
            insumo = insumo,
            lote = guardado,
            principal = principal,
            local = local,
            motivo = "Corrección manual de lote"
        )
        return guardado
    }

    @Transactional
    fun eliminarLote(principal: UsuarioPrincipal, localIdHeader: Long?, loteId: Long) {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val lote = loteRepository.findById(loteId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Lote no encontrado")
        }
        val insumo = insumoDelLocal(local, lote.insumo.id)
        desvincularMovimientosDeLote(lote.id)
        loteRepository.delete(lote)
        recalcularAgregados(insumo)
        registrarMovimiento(
            tipo = TipoMovimiento.AJUSTE,
            cantidad = -lote.cantidad,
            insumo = insumo,
            lote = null,
            principal = principal,
            local = local,
            motivo = "Baja manual de lote"
        )
    }

    // =========================
    // MOVIMIENTOS (auditoría)
    // =========================

    @Transactional(readOnly = true)
    fun listarMovimientos(principal: UsuarioPrincipal, localIdHeader: Long?, insumoId: Long): List<MovimientoDto> {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        insumoDelLocal(local, insumoId)
        return movimientoRepository.findByInsumoIdOrderByFechaHoraDesc(insumoId).map { movimiento ->
            MovimientoDto(
                id = movimiento.id,
                tipo = movimiento.tipo.name,
                cantidad = movimiento.cantidad,
                fechaHora = movimiento.fechaHora.toString(),
                motivo = movimiento.motivo,
                insumoId = movimiento.insumo?.id,
                loteId = movimiento.lote?.id,
                usuarioEmail = movimiento.usuario?.email
            )
        }
    }

    // =========================
    // DESCUENTO FIFO (§4.4)
    // =========================

    /** Stock total disponible de un ingrediente agrupando las filas homónimas del local. */
    @Transactional(readOnly = true)
    fun stockDisponiblePorNombre(local: Local, nombre: String): Double {
        val filas = insumoRepository.findByLocalIdAndNombreIgnoreCase(local.id, nombre.trim())
        return filas.sumOf { fila -> loteRepository.findByInsumoId(fila.id).sumOf { it.cantidad } }
    }

    /**
     * Descuenta `cantidad` consumiendo FIFO por `fechaVencimiento` entre **todas** las filas
     * homónimas del local (§4.4). Audita cada porción consumida con `tipo`/`motivo` y recalcula
     * los agregados de cada fila afectada. La fila que queda en cero **no se elimina**: las
     * recetas la referencian por id y la auditoría debe sobrevivir (solo se borran lotes vacíos).
     * Devuelve las filas afectadas con sus agregados ya actualizados.
     */
    @Transactional
    fun descontarFIFO(
        principal: UsuarioPrincipal,
        local: Local,
        nombre: String,
        cantidad: Double,
        tipo: TipoMovimiento,
        motivo: String
    ): List<Insumo> {
        if (cantidad <= 0) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad a descontar debe ser mayor a cero")
        }
        val filas = insumoRepository.findByLocalIdAndNombreIgnoreCase(local.id, nombre.trim())
        val lotes = filas
            .flatMap { loteRepository.findByInsumoIdOrderByFechaVencimientoAsc(it.id) }
            .sortedBy { it.fechaVencimiento }
        val disponible = lotes.sumOf { it.cantidad }
        if (disponible < cantidad) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "No hay stock suficiente de ${nombre.trim()}")
        }

        var restante = cantidad
        val afectados = LinkedHashMap<Long, Insumo>()
        for (lote in lotes) {
            if (restante <= 0) break
            val quitar = minOf(restante, lote.cantidad)
            restante -= quitar
            val nuevaCantidad = lote.cantidad - quitar
            val insumo = lote.insumo
            val loteRef = if (nuevaCantidad <= 0) {
                desvincularMovimientosDeLote(lote.id)
                loteRepository.delete(lote)
                null
            } else {
                loteRepository.save(lote.copy(cantidad = nuevaCantidad))
            }
            registrarMovimiento(tipo, -quitar, insumo, loteRef, principal, local, motivo)
            afectados[insumo.id] = insumo
        }
        return afectados.values.map { recalcularAgregados(it) }
    }

    // =========================
    // MIGRACIÓN LEGACY (§4.5.7)
    // =========================

    /** Insumos viejos sin lotes → lote inicial con su cantidad y vencimiento estimado. */
    @Transactional
    fun migrarLotesLegacy() {
        insumoRepository.findAll().forEach { insumo ->
            if (!loteRepository.existsByInsumoId(insumo.id)) {
                val cantidad = insumo.cantidad ?: 0.0
                if (cantidad > 0) {
                    loteRepository.save(
                        Lote(
                            cantidad = cantidad,
                            fechaVencimiento = LocalDate.now().plusDays(insumo.diasRestantes.toLong()),
                            insumo = insumo
                        )
                    )
                }
            }
        }
    }

    /** Refresca agregados: los días restantes envejecen con el calendario real. */
    @Transactional
    fun refrescarAgregados() {
        insumoRepository.findAll().forEach { insumo ->
            if (loteRepository.existsByInsumoId(insumo.id)) {
                recalcularAgregados(insumo)
            }
        }
    }

    /**
     * Las filas creadas antes del fix de §4.5 pueden esconder lotes con vencimientos
     * distintos (la tabla mostraba solo el más próximo y el merge sumaba contra lotes
     * invisibles). Se separa en una fila por vencimiento para que todo quede visible.
     * Idempotente: tras la primera pasada cada fila tiene una sola fecha.
     */
    @Transactional
    fun separarFilasPorVencimiento() {
        insumoRepository.findAll().forEach { insumo ->
            val lotes = loteRepository.findByInsumoIdOrderByFechaVencimientoAsc(insumo.id)
            val fechas = lotes.map { it.fechaVencimiento }.distinct()
            if (fechas.size <= 1) return@forEach

            // La fila original conserva el vencimiento más próximo; cada otra fecha
            // pasa a una fila nueva con la misma metadata.
            fechas.drop(1).forEach { fecha ->
                val nuevaFila = insumoRepository.save(
                    insumo.copy(id = 0, cantidad = 0.0, diasRestantes = 0, vencimiento = null)
                )
                lotes.filter { it.fechaVencimiento == fecha }.forEach { lote ->
                    loteRepository.save(lote.copy(insumo = nuevaFila))
                }
                recalcularAgregados(nuevaFila)
            }
            recalcularAgregados(insumo)
        }
    }

    // =========================
    // INTERNOS
    // =========================

    private fun insumoDelLocal(local: Local, insumoId: Long): Insumo {
        val insumo = insumoRepository.findById(insumoId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Insumo no encontrado")
        }
        if (insumo.local?.id != local.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "El insumo no pertenece al local activo")
        }
        return insumo
    }

    /**
     * Ícono automático para altas manuales / dictado (sin ícono explícito de la IA).
     * Primero prueba palabras clave del nombre; si no, cae en la categoría. Usa los
     * mismos emojis que la IA para que todo el inventario quede visualmente consistente.
     */
    private fun iconoAutomatico(nombre: String, categoria: String?): String {
        val n = nombre.lowercase()
        iconosPorNombre.firstOrNull { n.contains(it.first) }?.let { return it.second }
        return iconosPorCategoria[categoria] ?: "📦"
    }

    /** Antes de borrar un lote hay que soltar los movimientos que lo referencian (FK). */
    private fun desvincularMovimientosDeLote(loteId: Long) {
        movimientoRepository.findByLoteId(loteId).forEach { movimiento ->
            movimiento.lote = null
            movimientoRepository.save(movimiento)
        }
    }

    /** Suma o descuenta (FIFO) la diferencia contra el total actual de lotes. */
    private fun ajustarCantidad(insumo: Insumo, request: InsumoRequest) {
        val nueva = request.cantidad ?: return
        if (nueva < 0) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad no puede ser negativa")
        }
        val lotes = loteRepository.findByInsumoIdOrderByFechaVencimientoAsc(insumo.id)
        if (lotes.isEmpty()) {
            val dias = request.diasRestantes ?: insumo.diasRestantes
            loteRepository.save(
                Lote(cantidad = nueva, fechaVencimiento = LocalDate.now().plusDays(dias.toLong()), insumo = insumo)
            )
            return
        }
        val delta = nueva - lotes.sumOf { it.cantidad }
        if (delta > 0) {
            val primero = lotes.first()
            loteRepository.save(primero.copy(cantidad = primero.cantidad + delta))
        } else if (delta < 0) {
            var restante = -delta
            for (lote in lotes) {
                if (restante <= 0) break
                val quitar = minOf(restante, lote.cantidad)
                restante -= quitar
                val nuevaCantidad = lote.cantidad - quitar
                if (nuevaCantidad <= 0) {
                    desvincularMovimientosDeLote(lote.id)
                    loteRepository.delete(lote)
                } else loteRepository.save(lote.copy(cantidad = nuevaCantidad))
            }
        }
    }

    /** Mueve el vencimiento del lote más próximo; si coincide con otro lote, los fusiona. */
    private fun ajustarVencimiento(insumo: Insumo, request: InsumoRequest) {
        val dias = request.diasRestantes ?: return
        if (dias < 0) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Los días restantes no pueden ser negativos")
        }
        val fecha = LocalDate.now().plusDays(dias.toLong())
        val lotes = loteRepository.findByInsumoIdOrderByFechaVencimientoAsc(insumo.id)
        val primero = lotes.firstOrNull()
        if (primero == null) {
            loteRepository.save(
                Lote(cantidad = request.cantidad ?: insumo.cantidad ?: 0.0, fechaVencimiento = fecha, insumo = insumo)
            )
            return
        }
        if (primero.fechaVencimiento == fecha) return
        val destino = lotes.firstOrNull { it.id != primero.id && it.fechaVencimiento == fecha }
        if (destino != null) {
            loteRepository.save(destino.copy(cantidad = destino.cantidad + primero.cantidad))
            desvincularMovimientosDeLote(primero.id)
            loteRepository.delete(primero)
        } else {
            loteRepository.save(primero.copy(fechaVencimiento = fecha))
        }
    }

    /** `cantidad` = suma de lotes; `diasRestantes`/`vencimiento` salen del lote más próximo (0 si no hay lotes). */
    private fun recalcularAgregados(insumo: Insumo): Insumo {
        val lotes = loteRepository.findByInsumoIdOrderByFechaVencimientoAsc(insumo.id)
        val masProximo = lotes.firstOrNull()
        val dias = masProximo?.let {
            ChronoUnit.DAYS.between(LocalDate.now(), it.fechaVencimiento).toInt()
        } ?: 0
        return insumoRepository.save(
            insumo.copy(
                cantidad = lotes.sumOf { it.cantidad },
                diasRestantes = dias,
                vencimiento = masProximo?.fechaVencimiento?.format(formatoFecha)
            )
        )
    }

    private fun registrarMovimiento(
        tipo: TipoMovimiento,
        cantidad: Double,
        insumo: Insumo,
        lote: Lote?,
        principal: UsuarioPrincipal,
        local: Local,
        motivo: String
    ) {
        val usuario = usuarioRepository.findById(principal.usuarioId).orElseThrow {
            ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado")
        }
        movimientoRepository.save(
            MovimientoStock(
                tipo = tipo,
                cantidad = cantidad,
                fechaHora = LocalDateTime.now(),
                motivo = motivo,
                insumo = insumo,
                lote = lote,
                usuario = usuario,
                local = local
            )
        )
    }
}
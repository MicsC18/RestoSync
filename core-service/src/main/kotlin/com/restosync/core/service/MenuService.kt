package com.restosync.core.service

import com.restosync.core.dto.LineaRecetaRequest
import com.restosync.core.dto.PlatoDetalleDto
import com.restosync.core.dto.PlatoRequest
import com.restosync.core.dto.PreparacionResponse
import com.restosync.core.dto.PrepararRequest
import com.restosync.core.dto.ProduccionDto
import com.restosync.core.dto.RecetaLineaDto
import com.restosync.core.dto.StockRestanteDto
import com.restosync.core.model.Insumo
import com.restosync.core.model.Local
import com.restosync.core.model.Plato
import com.restosync.core.model.Produccion
import com.restosync.core.model.RecetaInsumo
import com.restosync.core.model.TipoMovimiento
import com.restosync.core.repository.InsumoRepository
import com.restosync.core.repository.PlatoRepository
import com.restosync.core.repository.ProduccionRepository
import com.restosync.core.repository.RecetaInsumoRepository
import com.restosync.core.repository.UsuarioRepository
import com.restosync.core.security.UsuarioPrincipal
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime

/**
 * Menú por local: CRUD de platos con su receta y preparación con descuento de stock.
 *
 * Al preparar (§4.4) el stock de cada ingrediente se calcula y descuenta **agrupando las
 * filas homónimas** del local (una por vencimiento, §4.5) y consumiendo FIFO por
 * `fechaVencimiento`. Si se indica una mesa, la preparación queda asociada a ella
 * (puente con el mapa de mesas de Fase 4) y la mesa pasa a OCUPADA.
 */
@Service
class MenuService(
    private val platoRepository: PlatoRepository,
    private val recetaInsumoRepository: RecetaInsumoRepository,
    private val produccionRepository: ProduccionRepository,
    private val insumoRepository: InsumoRepository,
    private val usuarioRepository: UsuarioRepository,
    private val inventarioService: InventarioService,
    private val mesaService: MesaService,
    private val localContextService: LocalContextService
) {

    // =========================
    // PLATOS
    // =========================

    @Transactional(readOnly = true)
    fun listarPlatos(principal: UsuarioPrincipal, localIdHeader: Long?): List<PlatoDetalleDto> {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        return platoRepository.findByLocalIdOrderByNombreAsc(local.id).map { aDetalle(it) }
    }

    @Transactional(readOnly = true)
    fun obtenerPlato(principal: UsuarioPrincipal, localIdHeader: Long?, id: Long): PlatoDetalleDto {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        return aDetalle(platoDelLocal(local, id))
    }

    @Transactional
    fun crearPlato(principal: UsuarioPrincipal, localIdHeader: Long?, request: PlatoRequest): PlatoDetalleDto {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val nombre = request.nombre.trim()
        if (nombre.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre del plato es obligatorio")
        }
        if (request.precio != null && request.precio < 0) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "El precio no puede ser negativo")
        }
        val plato = platoRepository.save(
            Plato(
                nombre = nombre,
                descripcion = request.descripcion,
                precio = request.precio,
                activo = request.activo ?: true,
                local = local
            )
        )
        request.ingredientes?.let { sincronizarReceta(plato, it) }
        return aDetalle(plato)
    }

    @Transactional
    fun actualizarPlato(principal: UsuarioPrincipal, localIdHeader: Long?, id: Long, request: PlatoRequest): PlatoDetalleDto {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val plato = platoDelLocal(local, id)
        if (request.precio != null && request.precio < 0) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "El precio no puede ser negativo")
        }
        val corregido = platoRepository.save(
            plato.copy(
                nombre = request.nombre.trim().ifBlank { plato.nombre },
                descripcion = request.descripcion ?: plato.descripcion,
                precio = request.precio ?: plato.precio,
                activo = request.activo ?: plato.activo
            )
        )
        // Si viene la lista de ingredientes (aunque vacía) se reemplaza la receta completa.
        request.ingredientes?.let {
            recetaInsumoRepository.deleteByPlatoId(corregido.id)
            sincronizarReceta(corregido, it)
        }
        return aDetalle(corregido)
    }

    @Transactional
    fun eliminarPlato(principal: UsuarioPrincipal, localIdHeader: Long?, id: Long) {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val plato = platoDelLocal(local, id)
        recetaInsumoRepository.deleteByPlatoId(plato.id)
        // El historial de producción sobrevive: se suelta el plato (queda el snapshot de nombre).
        produccionRepository.findByPlatoId(plato.id).forEach { produccion ->
            produccion.plato = null
            produccionRepository.save(produccion)
        }
        platoRepository.delete(plato)
    }

    // =========================
    // PREPARAR (§4.4)
    // =========================

    @Transactional
    fun prepararPlato(principal: UsuarioPrincipal, localIdHeader: Long?, id: Long, request: PrepararRequest): PreparacionResponse {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val plato = platoDelLocal(local, id)
        if (!plato.activo) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "El plato está inactivo. Activalo para poder prepararlo.")
        }
        val cantidad = request.cantidad ?: 1.0
        if (cantidad <= 0) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad a preparar debe ser mayor a cero")
        }
        val lineas = recetaInsumoRepository.findByPlatoId(plato.id)
        if (lineas.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "El plato no tiene ingredientes cargados")
        }

        // Agrupar los requisitos por nombre normalizado: varias filas homónimas (una por
        // vencimiento) son un mismo ingrediente a efectos de stock (§4.4).
        val grupos = LinkedHashMap<String, GrupoRequisito>()
        for (linea in lineas) {
            val insumo = linea.insumo
                ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Hay un ingrediente sin insumo en la receta")
            if (insumo.local?.id != local.id) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "La receta tiene un ingrediente de otro local")
            }
            if (linea.cantidad <= 0) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad de ${insumo.nombre} en la receta debe ser mayor a cero")
            }
            val clave = insumo.nombre.trim().lowercase()
            val requerido = linea.cantidad * cantidad
            val grupo = grupos[clave]
            if (grupo == null) grupos[clave] = GrupoRequisito(insumo, requerido) else grupo.total += requerido
        }

        // Prevalidar todo el stock antes de tocar nada: un solo error claro con los faltantes.
        val faltantes = mutableListOf<String>()
        for (grupo in grupos.values) {
            val disponible = inventarioService.stockDisponiblePorNombre(local, grupo.insumo.nombre)
            if (disponible < grupo.total) {
                val falta = grupo.total - disponible
                faltantes.add("${grupo.insumo.nombre} (faltan ${cantidadLegible(falta)} ${grupo.insumo.unidadMedida})")
            }
        }
        if (faltantes.isNotEmpty()) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "No hay stock suficiente: ${faltantes.joinToString("; ")}"
            )
        }

        // Mesa destino opcional: al preparar, la mesa queda OCUPADA.
        val mesa = request.mesaId?.let { mesaService.mesaDelLocal(local, it) }
        if (mesa != null) mesaService.marcarOcupada(mesa)

        val motivo = "Preparación de ${plato.nombre} x${cantidadLegible(cantidad)}" +
            (mesa?.let { " para ${it.nombre}" } ?: "")
        for (grupo in grupos.values) {
            inventarioService.descontarFIFO(
                principal, local, grupo.insumo.nombre, grupo.total, TipoMovimiento.PRODUCCION, motivo
            )
        }

        val usuario = usuarioRepository.findById(principal.usuarioId).orElseThrow {
            ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado")
        }
        val produccion = produccionRepository.save(
            Produccion(
                plato = plato,
                platoNombre = plato.nombre,
                cantidad = cantidad,
                mesa = mesa,
                mesaNombre = mesa?.nombre,
                fechaHora = LocalDateTime.now(),
                local = local,
                usuario = usuario
            )
        )

        val stockRestante = grupos.values.map { grupo ->
            StockRestanteDto(
                nombre = grupo.insumo.nombre,
                unidadMedida = grupo.insumo.unidadMedida,
                cantidadRestante = inventarioService.stockDisponiblePorNombre(local, grupo.insumo.nombre)
            )
        }
        return PreparacionResponse(
            produccionId = produccion.id,
            platoId = plato.id,
            platoNombre = plato.nombre,
            cantidad = cantidad,
            mesaId = mesa?.id,
            mesaNombre = mesa?.nombre,
            fechaHora = produccion.fechaHora.toString(),
            stockRestante = stockRestante
        )
    }

    // =========================
    // PRODUCCIONES (historial)
    // =========================

    @Transactional(readOnly = true)
    fun listarProducciones(principal: UsuarioPrincipal, localIdHeader: Long?, mesaId: Long?): List<ProduccionDto> {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val producciones = if (mesaId != null) {
            mesaService.mesaDelLocal(local, mesaId)
            produccionRepository.findByLocalIdAndMesaIdOrderByFechaHoraDesc(local.id, mesaId)
        } else {
            produccionRepository.findByLocalIdOrderByFechaHoraDesc(local.id)
        }
        return producciones.map { aDto(it) }
    }

    // =========================
    // INTERNOS
    // =========================

    /** Requisito de un ingrediente agrupado por nombre (suma de todas sus filas homónimas). */
    private data class GrupoRequisito(val insumo: Insumo, var total: Double)

    private fun platoDelLocal(local: Local, platoId: Long): Plato {
        val plato = platoRepository.findById(platoId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Plato no encontrado")
        }
        if (plato.local?.id != local.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "El plato no pertenece al local activo")
        }
        return plato
    }

    /** Reemplaza las líneas de receta validando que cada insumo sea del local del plato. */
    private fun sincronizarReceta(plato: Plato, ingredientes: List<LineaRecetaRequest>) {
        val porInsumo = LinkedHashMap<Long, Pair<Insumo, Double>>()
        for (linea in ingredientes) {
            val insumo = insumoRepository.findById(linea.insumoId).orElseThrow {
                ResponseStatusException(HttpStatus.NOT_FOUND, "Insumo no encontrado")
            }
            if (insumo.local?.id != plato.local?.id) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "El insumo ${insumo.nombre} no pertenece al local del plato")
            }
            if (linea.cantidad <= 0) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad de ${insumo.nombre} debe ser mayor a cero")
            }
            val previo = porInsumo[insumo.id]
            porInsumo[insumo.id] = insumo to ((previo?.second ?: 0.0) + linea.cantidad)
        }
        for ((insumo, cantidad) in porInsumo.values) {
            recetaInsumoRepository.save(RecetaInsumo(plato = plato, insumo = insumo, cantidad = cantidad))
        }
    }

    private fun aDetalle(plato: Plato): PlatoDetalleDto {
        val ingredientes = recetaInsumoRepository.findByPlatoId(plato.id).mapNotNull { linea ->
            val insumo = linea.insumo ?: return@mapNotNull null
            RecetaLineaDto(
                id = linea.id,
                insumoId = insumo.id,
                insumoNombre = insumo.nombre,
                icono = insumo.icono,
                unidadMedida = insumo.unidadMedida,
                cantidad = linea.cantidad
            )
        }
        return PlatoDetalleDto(
            id = plato.id,
            nombre = plato.nombre,
            descripcion = plato.descripcion,
            precio = plato.precio,
            activo = plato.activo,
            ingredientes = ingredientes
        )
    }

    private fun aDto(produccion: Produccion): ProduccionDto = ProduccionDto(
        id = produccion.id,
        platoId = produccion.plato?.id,
        platoNombre = produccion.platoNombre,
        cantidad = produccion.cantidad,
        mesaId = produccion.mesa?.id,
        mesaNombre = produccion.mesaNombre,
        fechaHora = produccion.fechaHora.toString(),
        usuarioEmail = produccion.usuario?.email
    )

    /** Muestra 2 en vez de 2.0 cuando la cantidad es entera. */
    private fun cantidadLegible(valor: Double): String =
        if (valor == Math.floor(valor) && !valor.isInfinite()) valor.toLong().toString() else valor.toString()
}
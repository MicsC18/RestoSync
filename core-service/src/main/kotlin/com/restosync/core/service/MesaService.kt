package com.restosync.core.service

import com.restosync.core.dto.MesaRequest
import com.restosync.core.model.EstadoMesa
import com.restosync.core.model.Local
import com.restosync.core.model.Mesa
import com.restosync.core.repository.MesaRepository
import com.restosync.core.repository.ProduccionRepository
import com.restosync.core.security.UsuarioPrincipal
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime

/**
 * Mesas por local: entidad real para "preparar un plato para una mesa" y para el
 * mapa visual `/mesas` (posición, arrastrar, estados).
 */
@Service
class MesaService(
    private val mesaRepository: MesaRepository,
    private val produccionRepository: ProduccionRepository,
    private val localContextService: LocalContextService
) {

    @Transactional(readOnly = true)
    fun listarMesas(principal: UsuarioPrincipal, localIdHeader: Long?): List<Mesa> {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        return mesaRepository.findByLocalIdOrderByNombreAsc(local.id)
    }

    @Transactional
    fun crearMesa(principal: UsuarioPrincipal, localIdHeader: Long?, request: MesaRequest): Mesa {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val nombre = request.nombre.trim()
        if (nombre.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre de la mesa es obligatorio")
        }
        return mesaRepository.save(
            Mesa(
                nombre = nombre,
                capacidad = request.capacidad,
                posicionX = request.posicionX,
                posicionY = request.posicionY,
                estado = parseEstado(request.estado) ?: EstadoMesa.LIBRE,
                local = local
            )
        )
    }

    @Transactional
    fun actualizarMesa(principal: UsuarioPrincipal, localIdHeader: Long?, id: Long, request: MesaRequest): Mesa {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val mesa = mesaDelLocal(local, id)
        val nuevoEstado = parseEstado(request.estado) ?: mesa.estado
        // La marca de ocupación sólo se (re)inicia al pasar a
        // OCUPADA desde otro estado; liberar (LIBRE/RESERVADA) la borra. OCUPADA->OCUPADA
        // la conserva para no reiniciar la sesión de platos en curso.
        val nuevaMarca = when {
            nuevoEstado == EstadoMesa.OCUPADA && mesa.estado != EstadoMesa.OCUPADA -> LocalDateTime.now()
            nuevoEstado == EstadoMesa.OCUPADA -> mesa.fechaOcupacion
            else -> null
        }
        return mesaRepository.save(
            mesa.copy(
                nombre = request.nombre.trim().ifBlank { mesa.nombre },
                capacidad = request.capacidad ?: mesa.capacidad,
                posicionX = request.posicionX ?: mesa.posicionX,
                posicionY = request.posicionY ?: mesa.posicionY,
                estado = nuevoEstado,
                fechaOcupacion = nuevaMarca
            )
        )
    }

    @Transactional
    fun eliminarMesa(principal: UsuarioPrincipal, localIdHeader: Long?, id: Long) {
        val local = localContextService.resolverLocal(principal, localIdHeader)
        val mesa = mesaDelLocal(local, id)
        // El historial de producción sobrevive: se suelta la mesa (queda el snapshot de nombre).
        produccionRepository.findByMesaId(mesa.id).forEach { produccion ->
            produccion.mesa = null
            produccionRepository.save(produccion)
        }
        mesaRepository.delete(mesa)
    }

    /** Valida que la mesa exista y pertenezca al local activo. */
    @Transactional(readOnly = true)
    fun mesaDelLocal(local: Local, mesaId: Long): Mesa {
        val mesa = mesaRepository.findById(mesaId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa no encontrada")
        }
        if (mesa.local?.id != local.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "La mesa no pertenece al local activo")
        }
        return mesa
    }

    /** Al preparar un plato para una mesa, la mesa pasa a OCUPADA e inicia su sesión de platos. */
    @Transactional
    fun marcarOcupada(mesa: Mesa): Mesa {
        // Ya ocupada con sesión abierta: no-op (no se reinicia la marca).
        if (mesa.estado == EstadoMesa.OCUPADA && mesa.fechaOcupacion != null) return mesa
        // Si estaba OCUPADA sin marca (mesa creada así o fila legada), se abre la sesión ahora.
        return mesaRepository.save(
            mesa.copy(estado = EstadoMesa.OCUPADA, fechaOcupacion = mesa.fechaOcupacion ?: LocalDateTime.now())
        )
    }

    private fun parseEstado(estado: String?): EstadoMesa? {
        if (estado.isNullOrBlank()) return null
        return try {
            EstadoMesa.valueOf(estado.trim().uppercase())
        } catch (_: IllegalArgumentException) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Estado de mesa inválido. Usá LIBRE, OCUPADA o RESERVADA."
            )
        }
    }
}
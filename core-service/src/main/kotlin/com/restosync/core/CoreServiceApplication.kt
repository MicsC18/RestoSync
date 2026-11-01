package com.restosync.core

import com.restosync.core.model.EstadoMesa
import com.restosync.core.model.Insumo
import com.restosync.core.model.Local
import com.restosync.core.model.Lote
import com.restosync.core.model.Mesa
import com.restosync.core.model.Plato
import com.restosync.core.model.RecetaInsumo
import com.restosync.core.model.Restaurante
import com.restosync.core.model.RolUsuario
import com.restosync.core.model.Usuario
import com.restosync.core.repository.InsumoRepository
import com.restosync.core.repository.LocalRepository
import com.restosync.core.repository.LoteRepository
import com.restosync.core.repository.MesaRepository
import com.restosync.core.repository.PlatoRepository
import com.restosync.core.repository.RecetaInsumoRepository
import com.restosync.core.repository.RestauranteRepository
import com.restosync.core.repository.UsuarioRepository
import com.restosync.core.service.InventarioService
import jakarta.persistence.EntityManager
import org.springframework.boot.CommandLineRunner
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.context.annotation.Bean
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.transaction.support.TransactionTemplate
import java.time.LocalDate

@SpringBootApplication
class CoreServiceApplication {

    @Bean
    fun initData(
        usuarioRepo: UsuarioRepository,
        restauranteRepo: RestauranteRepository,
        localRepo: LocalRepository,
        insumoRepo: InsumoRepository,
        loteRepo: LoteRepository,
        platoRepo: PlatoRepository,
        recetaRepo: RecetaInsumoRepository,
        mesaRepo: MesaRepository,
        passwordEncoder: PasswordEncoder,
        entityManager: EntityManager,
        transactionTemplate: TransactionTemplate,
        inventarioService: InventarioService
    ): CommandLineRunner {
        return CommandLineRunner {
            transactionTemplate.executeWithoutResult {
                migrarRolesNulos(entityManager)
                migrarInsumosDeRestauranteALocal(entityManager)

                val restaurante = restauranteRepo.findAll().firstOrNull()
                    ?: restauranteRepo.save(Restaurante(nombre = "La Farola"))

                val localPrincipal = localRepo.findByRestauranteId(restaurante.id).firstOrNull()
                    ?: localRepo.save(
                        Local(
                            nombre = restaurante.nombre,
                            direccion = null,
                            activo = true,
                            restaurante = restaurante
                        )
                    )

                restauranteRepo.findAll().forEach { resto ->
                    if (localRepo.findByRestauranteId(resto.id).isEmpty()) {
                        localRepo.save(
                            Local(
                                nombre = resto.nombre,
                                activo = true,
                                restaurante = resto
                            )
                        )
                    }
                }

                // Asigna local a insumos huérfanos y reintenta migración de columna vieja.
                migrarInsumosDeRestauranteALocal(entityManager)
                insumoRepo.findByLocalIsNull().forEach { insumo ->
                    insumo.local = localPrincipal
                    insumoRepo.save(insumo)
                }
                // Quita el NOT NULL / columna obsoleta recién cuando ya hay locales.
                liberarColumnaRestauranteEnInsumos(entityManager)
                // Movimientos ahora cuelgan de insumo/lote; la columna legacy alimento_id no debe bloquear inserts.
                liberarColumnaAlimentoEnMovimientos(entityManager)
                // Fase 2 (§4.5.7): insumos legacy sin lotes → lote inicial; agregados frescos en cada arranque.
                inventarioService.migrarLotesLegacy()
                // Filas viejas con lotes de varios vencimientos → una fila visible por vencimiento (§4.5).
                inventarioService.separarFilasPorVencimiento()
                inventarioService.refrescarAgregados()

                if (usuarioRepo.findByEmail("admin@lafarola.com").isEmpty) {
                    val passwordCifrada = passwordEncoder.encode("123456") ?: ""
                    usuarioRepo.save(
                        Usuario(
                            email = "admin@lafarola.com",
                            contrasena = passwordCifrada,
                            rol = RolUsuario.ADMIN_RESTAURANTE,
                            restaurante = restaurante,
                            local = null
                        )
                    )
                    println(">>> Usuario admin creado: admin@lafarola.com / 123456")
                }

                // Fase 6: datos demo para probar todo el flujo sin cargar nada a mano.
                // Solo se siembra en el restaurante demo "La Farola" y solo si falta cada
                // pieza (idempotente): nunca pisa datos reales ni cuentas de usuarios.
                if (restaurante.nombre == "La Farola") {
                    sembrarDatosDemo(
                        restaurante, localPrincipal, usuarioRepo, localRepo, insumoRepo,
                        loteRepo, platoRepo, recetaRepo, mesaRepo, passwordEncoder, inventarioService
                    )
                }
            }
        }
    }

    /**
     * Seed demo (Fase 6): segundo local, gerente de local, insumos con lotes,
     * platos con receta y mesas posicionadas. Cada bloque se ejecuta solo si la
     * pieza no existe todavía, así los reinicios no duplican ni pisan nada.
     */
    private fun sembrarDatosDemo(
        restaurante: Restaurante,
        localPrincipal: Local,
        usuarioRepo: UsuarioRepository,
        localRepo: LocalRepository,
        insumoRepo: InsumoRepository,
        loteRepo: LoteRepository,
        platoRepo: PlatoRepository,
        recetaRepo: RecetaInsumoRepository,
        mesaRepo: MesaRepository,
        passwordEncoder: PasswordEncoder,
        inventarioService: InventarioService
    ) {
        // Segundo local para probar el scope por local y el selector del admin.
        if (localRepo.findByRestauranteId(restaurante.id).size < 2) {
            localRepo.save(
                Local(
                    nombre = "La Farola — Palermo",
                    direccion = "Av. Santa Fe 1234",
                    activo = true,
                    restaurante = restaurante
                )
            )
            println(">>> Local demo creado: La Farola — Palermo")
        }

        // Gerente de local demo: entra directo a su local, sin selector.
        if (usuarioRepo.findByEmail("gerente@lafarola.com").isEmpty) {
            usuarioRepo.save(
                Usuario(
                    email = "gerente@lafarola.com",
                    contrasena = passwordEncoder.encode("123456") ?: "",
                    rol = RolUsuario.GERENTE_LOCAL,
                    restaurante = restaurante,
                    local = localPrincipal
                )
            )
            println(">>> Usuario gerente demo creado: gerente@lafarola.com / 123456")
        }

        // Insumos con su lote inicial (un vencimiento por fila, §4.5).
        if (insumoRepo.findByLocalId(localPrincipal.id).isEmpty()) {
            val hoy = LocalDate.now()
            data class DemoInsumo(
                val nombre: String, val categoria: String, val icono: String,
                val unidad: String, val cantidad: Double, val minimo: Double, val venceEnDias: Long
            )
            val demos = listOf(
                DemoInsumo("Pechuga de pollo", "Carnes", "🍗", "Kg", 10.0, 3.0, 5),
                DemoInsumo("Pan rallado", "Almacén", "🍞", "Kg", 5.0, 1.0, 180),
                DemoInsumo("Huevo", "Lácteos", "🥚", "Unidades", 24.0, 6.0, 12),
                DemoInsumo("Aceite de oliva", "Almacén", "🫒", "Litros", 8.0, 2.0, 365),
                DemoInsumo("Lechuga", "Frutas y verduras", "🥬", "Kg", 4.0, 1.0, 3),
                DemoInsumo("Papa", "Frutas y verduras", "🥔", "Kg", 15.0, 5.0, 10)
            )
            for (demo in demos) {
                val insumo = insumoRepo.save(
                    Insumo(
                        nombre = demo.nombre,
                        categoria = demo.categoria,
                        icono = demo.icono,
                        unidadMedida = demo.unidad,
                        stockMinimo = demo.minimo,
                        cantidad = demo.cantidad,
                        local = localPrincipal
                    ).apply { this.restaurante = restaurante }
                )
                loteRepo.save(
                    Lote(
                        cantidad = demo.cantidad,
                        fechaVencimiento = hoy.plusDays(demo.venceEnDias),
                        insumo = insumo
                    )
                )
            }
            // Deriva cantidad/diasRestantes/vencimiento desde los lotes recién creados.
            inventarioService.refrescarAgregados()
            println(">>> Insumos demo creados: ${demos.size} filas con lote en ${localPrincipal.nombre}")
        }

        // Platos con receta (solo si el local todavía no tiene menú).
        if (platoRepo.findByLocalIdOrderByNombreAsc(localPrincipal.id).isEmpty()) {
            fun insumoDe(nombre: String): Insumo? =
                insumoRepo.findByLocalIdAndNombreIgnoreCase(localPrincipal.id, nombre).firstOrNull()

            data class DemoPlato(
                val nombre: String, val descripcion: String, val precio: Double,
                val receta: List<Pair<String, Double>>
            )
            val platos = listOf(
                DemoPlato(
                    "Milanesa con papas", "Milanesa de pollo con papas fritas", 8500.0,
                    listOf("Pechuga de pollo" to 0.25, "Pan rallado" to 0.1, "Huevo" to 1.0, "Papa" to 0.3, "Aceite de oliva" to 0.05)
                ),
                DemoPlato(
                    "Ensalada mixta", "Lechuga y aceite de oliva", 4200.0,
                    listOf("Lechuga" to 0.2, "Aceite de oliva" to 0.05)
                )
            )
            for (demo in platos) {
                val ingredientes = demo.receta.mapNotNull { (nombre, cantidad) ->
                    insumoDe(nombre)?.let { it to cantidad }
                }
                // Sin todos los ingredientes disponibles no se crea la receta a medias.
                if (ingredientes.size != demo.receta.size) continue
                val plato = platoRepo.save(
                    Plato(
                        nombre = demo.nombre,
                        descripcion = demo.descripcion,
                        precio = demo.precio,
                        activo = true,
                        local = localPrincipal
                    )
                )
                for ((insumo, cantidad) in ingredientes) {
                    recetaRepo.save(RecetaInsumo(plato = plato, insumo = insumo, cantidad = cantidad))
                }
            }
            println(">>> Platos demo creados con receta en ${localPrincipal.nombre}")
        }

        // Mesas posicionadas en el mapa (porcentajes del canvas, Fase 4).
        if (mesaRepo.findByLocalIdOrderByNombreAsc(localPrincipal.id).isEmpty()) {
            data class DemoMesa(val nombre: String, val capacidad: Int, val x: Double, val y: Double)
            val mesas = listOf(
                DemoMesa("Mesa 1", 4, 8.0, 8.0),
                DemoMesa("Mesa 2", 4, 32.0, 8.0),
                DemoMesa("Mesa 3", 6, 56.0, 8.0),
                DemoMesa("Mesa 4", 2, 80.0, 8.0),
                DemoMesa("Barra", 2, 8.0, 45.0)
            )
            for (demo in mesas) {
                mesaRepo.save(
                    Mesa(
                        nombre = demo.nombre,
                        capacidad = demo.capacidad,
                        posicionX = demo.x,
                        posicionY = demo.y,
                        estado = EstadoMesa.LIBRE,
                        local = localPrincipal
                    )
                )
            }
            println(">>> Mesas demo creadas: ${mesas.size} en ${localPrincipal.nombre}")
        }
    }

    private fun migrarRolesNulos(entityManager: EntityManager) {
        try {
            entityManager.createNativeQuery(
                "UPDATE usuarios SET rol = 'ADMIN_RESTAURANTE' WHERE rol IS NULL"
            ).executeUpdate()
        } catch (_: Exception) {
            // La columna puede no existir todavía en el primer arranque previo al ddl.
        }
    }

    /**
     * La tabla vieja tenía restaurante_id NOT NULL. El modelo ahora usa local_id.
     * Rellena local_id desde el local del restaurante y libera la columna antigua.
     */
    private fun migrarInsumosDeRestauranteALocal(entityManager: EntityManager) {
        try {
            entityManager.createNativeQuery(
                """
                UPDATE insumos i
                SET local_id = (
                    SELECT l.id FROM locales l
                    WHERE l.restaurante_id = i.restaurante_id
                    ORDER BY l.id
                    LIMIT 1
                )
                WHERE i.local_id IS NULL
                  AND i.restaurante_id IS NOT NULL
                """.trimIndent()
            ).executeUpdate()
        } catch (_: Exception) {
            // restaurante_id puede no existir si la DB ya está migrada.
        }
    }

    private fun liberarColumnaRestauranteEnInsumos(entityManager: EntityManager) {
        try {
            entityManager.createNativeQuery(
                "ALTER TABLE insumos ALTER COLUMN restaurante_id DROP NOT NULL"
            ).executeUpdate()
            println(">>> insumos.restaurante_id ya no es obligatorio (migración a local_id)")
        } catch (_: Exception) {
            // Columna inexistente o ya nullable.
        }

        try {
            // Rellena valores viejos para no dejar basura inconsistente.
            entityManager.createNativeQuery(
                """
                UPDATE insumos i
                SET restaurante_id = l.restaurante_id
                FROM locales l
                WHERE i.local_id = l.id
                  AND i.restaurante_id IS NULL
                """.trimIndent()
            ).executeUpdate()
        } catch (_: Exception) {
            // Ignore si la columna ya no existe.
        }
    }

    /**
     * movimientos_stock tenía alimento_id NOT NULL (modelo legacy Alimento, ya eliminado).
     * Sin liberar esa columna, ningún insert de auditoría nuevo podría guardarse.
     */
    private fun liberarColumnaAlimentoEnMovimientos(entityManager: EntityManager) {
        try {
            entityManager.createNativeQuery(
                "ALTER TABLE movimientos_stock ALTER COLUMN alimento_id DROP NOT NULL"
            ).executeUpdate()
        } catch (_: Exception) {
            // Tabla o columna inexistente, o ya nullable.
        }
    }
}

fun main(args: Array<String>) {
    runApplication<CoreServiceApplication>(*args)
}

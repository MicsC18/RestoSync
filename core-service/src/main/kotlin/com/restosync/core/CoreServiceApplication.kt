package com.restosync.core

import com.restosync.core.model.Restaurante
import com.restosync.core.model.Usuario
import com.restosync.core.repository.RestauranteRepository
import com.restosync.core.repository.UsuarioRepository
import org.springframework.boot.CommandLineRunner
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.context.annotation.Bean
import org.springframework.security.crypto.password.PasswordEncoder

@SpringBootApplication
class CoreServiceApplication {

    @Bean
    fun initData(
        usuarioRepo: UsuarioRepository,
        restauranteRepo: RestauranteRepository,
        passwordEncoder: PasswordEncoder
    ): CommandLineRunner {
        return CommandLineRunner {
            val restaurante = restauranteRepo.findAll().firstOrNull() 
                ?: restauranteRepo.save(Restaurante(nombre = "La Farola"))

            if (usuarioRepo.findByEmail("admin@lafarola.com").isEmpty) {
                val passwordCifrada = passwordEncoder.encode("123456") ?: ""
                usuarioRepo.save(
                    Usuario(
                        email = "admin@lafarola.com",
                        contrasena = passwordCifrada,
                        restaurante = restaurante
                    )
                )
                println(">>> ¡Usuario admin creado con contraseña encriptada correctamente!")
            }
        }
    }
}

fun main(args: Array<String>) {
    runApplication<CoreServiceApplication>(*args)
}
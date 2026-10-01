package com.restosync.core.repository

import com.restosync.core.model.Usuario
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.Optional

@Repository
interface UsuarioRepository : JpaRepository <Usuario, Long> {
    
    fun findByEmail(email: String): Optional <Usuario>
    
}
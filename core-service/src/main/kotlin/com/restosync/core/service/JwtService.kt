package com.restosync.core.service

import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.stereotype.Service
import java.util.Date
import javax.crypto.SecretKey

@Service
class JwtService {

    private val secretKeyString = "RestoSyncSuperSecretaClaveParaTokensDeAlMenos32Caracteres"

    private fun getSigningKey(): SecretKey {
        return Keys.hmacShaKeyFor(secretKeyString.toByteArray())
    }

  
    fun generarToken(usuarioId: Long, restauranteId: Long, email: String): String {
        val tiempoValidez = 1000 * 60 * 60 * 24 
        return Jwts.builder()
            .subject(email) 
            .claim("usuarioId", usuarioId) 
            .claim("restauranteId", restauranteId) 
            .issuedAt(Date(System.currentTimeMillis()))
            .expiration(Date(System.currentTimeMillis() + tiempoValidez)) 
            .signWith(getSigningKey()) 
            .compact()
    }
}
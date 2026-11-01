package com.restosync.core.service

import com.restosync.core.model.RolUsuario
import com.restosync.core.security.UsuarioPrincipal
import io.jsonwebtoken.Claims
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

    fun generarToken(
        usuarioId: Long,
        restauranteId: Long,
        email: String,
        rol: RolUsuario,
        localId: Long? = null
    ): String {
        val tiempoValidez = 1000L * 60 * 60 * 24
        val builder = Jwts.builder()
            .subject(email)
            .claim("usuarioId", usuarioId)
            .claim("restauranteId", restauranteId)
            .claim("rol", rol.name)
            .issuedAt(Date(System.currentTimeMillis()))
            .expiration(Date(System.currentTimeMillis() + tiempoValidez))
            .signWith(getSigningKey())

        if (localId != null) {
            builder.claim("localId", localId)
        }

        return builder.compact()
    }

    fun parseClaims(token: String): Claims {
        val jwt = if (token.startsWith("Bearer ")) token.substring(7) else token
        return Jwts.parser()
            .verifyWith(getSigningKey())
            .build()
            .parseSignedClaims(jwt)
            .payload
    }

    fun extraerPrincipal(token: String): UsuarioPrincipal {
        val claims = parseClaims(token)
        val rolNombre = claims["rol"] as? String ?: RolUsuario.ADMIN_RESTAURANTE.name
        return UsuarioPrincipal(
            usuarioId = (claims["usuarioId"] as Number).toLong(),
            email = claims.subject,
            rol = RolUsuario.valueOf(rolNombre),
            restauranteId = (claims["restauranteId"] as Number).toLong(),
            localId = (claims["localId"] as? Number)?.toLong()
        )
    }

    fun extraerRestauranteId(token: String): Long? {
        return try {
            extraerPrincipal(token).restauranteId
        } catch (_: Exception) {
            null
        }
    }
}

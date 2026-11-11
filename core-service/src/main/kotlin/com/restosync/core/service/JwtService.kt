package com.restosync.core.service

import com.restosync.core.model.RolUsuario
import com.restosync.core.security.UsuarioPrincipal
import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.util.Date
import javax.crypto.SecretKey

@Service
class JwtService(
    // La clave llega desde restosync.jwt.secret (perfil local o variable JWT_SECRET).
    // El valor real NUNCA va acá: ver README.md "1. Backend".
    @Value("\${restosync.jwt.secret}") private val secretKeyString: String
) {

    init {
        // El core no puede arrancar con una clave ausente o previsible: con la clave se
        // forjan tokens de cualquier rol y local, así que preferimos un arranque roto y
        // explicativo antes que un sistema "funcionando" con la firma comprometida.
        val clave = secretKeyString.toByteArray(Charsets.UTF_8)
        if (clave.size < 32) {
            throw IllegalStateException(
                if (clave.isEmpty())
                    "Falta la clave de firma de JWT: definí restosync.jwt.secret en " +
                        "application-local.properties o en la variable de entorno JWT_SECRET " +
                        "(README.md, sección 1. Backend)."
                else
                    "La clave restosync.jwt.secret es demasiado corta: se necesitan al menos " +
                        "32 bytes para firmar HS256 y se configuraron ${clave.size}. Cambiá el " +
                        "valor en application-local.properties o en JWT_SECRET."
            )
        }
    }

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
        // 12 h: no hay refresh token, así que se busca el balance entre no logout cada
        // dos minutos y no dejar un token robado vigente un día entero. El front ya maneja
        // la expiración redirigiendo a /login cuando /me falla (use-auth-session).
        val tiempoValidez = 1000L * 60 * 60 * 12
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

# core-service — instrucciones para agentes de IA

API principal de RestoSync: Kotlin · Spring Boot · JPA sobre PostgreSQL (Neon). Puerto 8080, todo
bajo `/api/v1/**` protegido por JWT. Arranque y credenciales: `README.md` raíz, sección 1.
Convenciones de proyecto (idioma, alcance, verificación): [`../AGENTS.md`](../AGENTS.md).

## Estructura

Paquete base `com.restosync.core`, capas `controller` / `service` / `repository` / `model` / `dto` /
`security`. Los `*Dtos.kt` agrupan los DTOs de request/response por dominio.

**Ojo con nombres de paquete vs. carpeta**: `SecurityConfig.kt`, `CorsConfig.kt` y `JwtService.kt`
declaran `package com.restosync.core.config` aunque viven en `security/` y `service/`. Está
funcionando —Spring resuelve los beans por anotaciones, no por convención de paquetes— así que
**no se mueven**: "arreglar" el paquete cambia el nombre del componente y rompe imports.

## Reglas que no se pueden romper

- **Nunca bindear una entidad JPA en un controller**: siempre DTO de request. Motivo histórico
  concreto: bindear la entidad permitía inyectar `id`/`local` en el payload y pisar datos de otro local
  (correctivo 1 de Fase 2 y correctivo 1 de Fase 3 de `Plan-General.md`).
- **Toda operación de negocio pasa por `LocalContextService`**: admin elige el local por header
  `X-Local-Id` (validado contra sus permisos), gerente queda fijo al local del claim. Un endpoint
  que saltee esto es una fuga cross-local, no un detalle de estilo.
- Las reglas de lotes (merge por vencimiento exacto, FIFO agrupando homónimas, fila en cero no se
  borra, snapshots en el historial) están en [`../AGENTS.md`](../AGENTS.md) §6 y en `Plan-General.md`
  §4.4/§4.5.

## Configuración

- `spring.jpa.hibernate.ddl-auto=update` **más** migraciones idempotentes escritas a mano que
  corren en el arranque (`migrarRolesNulos`, `migrarInsumosDeRestauranteALocal`,
  `repararInsumosFueraDeSuRestaurante`, `sincronizarSecuencias`, `migrarLotesLegacy`, entre otras).
  La carpeta `src/main/resources/db/migration/` está **vacía a propósito** y no la usa nadie: no
  es un Flyway abandonado, y no se agregan archivos ahí.
- Secretos: `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` / `JWT_SECRET` por variable de entorno, o el
  perfil `local` (`src/main/resources/application-local.properties`, no versionado). **No se
  agregan credenciales reales como default** al `application.properties` versionado, ni una clave
  de firma JWT de respaldo legible en el código. `JwtService` valida al arrancar: clave vacía o de
  menos de 32 bytes y el core **no levanta** (hay test que lo fija).
- CORS: `CorsConfig.kt` debe autorizar los mismos orígenes que `restosync-ia/main.py` (localhost,
  127.0.0.1 y la red local `192.168.x.x:3000`, para probar desde el teléfono). **Ambas listas se
  mantienen sincronizadas a mano**; si se cambia una, se cambia la otra.

## Tests

Unitarios con Mockito, **sin conexión a la base**: se mockean los repositories y `JwtService`.
`CoreServiceApplicationTests.contextLoads` está `@Disabled` a propósito — exigir Neon en cada
corrida es justamente lo que se quiere evitar. Trampas del stack:

- En Spring 7 leer `statusCode` (no `status`) de `ResponseStatusException`.
- Los matchers de Mockito revientan por unboxing contra `double` primitivo: usar `anyDouble()`.
- `ApplicationContextRunner` no tiene `hasFailed()`: leer `context.startupFailure`.
- En parámetros de funciones Kotlin de test evitar el nombre `con` (rompe el parser).

Verificación: `.\gradlew.bat test` (todo) o `.\gradlew.bat compileKotlin` (solo compilación).

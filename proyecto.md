# 🍽️ Proyecto: RestoSync

## Descripción General
**RestoSync** es un Sistema de Gestión Integral para Gastronomía. Es una plataforma moderna y multimodular diseñada para conectar, administrar y optimizar la operatividad de un restaurante, sincronizando el salón, la cocina y la gestión administrativa.

Su principal ventaja competitiva y diferencial es el uso de **Inteligencia Artificial (Google Gemini)** para automatizar tareas tediosas como la carga de facturas de compras y el control de mermas.

---

## 🏗️ Arquitectura del Sistema
El ecosistema de RestoSync está dividido en tres módulos principales y una base de datos en la nube:

1. **Frontend (`restosync-front`)**: Aplicación web desarrollada con Next.js (App Router), React, TypeScript y Tailwind CSS. Interfaz rápida, moderna y amigable.
2. **Backend Core (`core-service`)**: API REST robusta construida con Kotlin y Spring Boot, encargada de la lógica de negocio, seguridad y persistencia de datos.
3. **Microservicio de IA (`restosync-ia`)**: Servidor ligero en Python (FastAPI) que se comunica con Google Gemini para procesamiento inteligente.
4. **Base de Datos**: PostgreSQL alojada en la nube (Neon Tech), conectada a través de Spring Data JPA.

---

## ✨ Funcionalidades Principales

### 🔐 Accesos y Seguridad
- Inicio de sesión para personal y administradores.
- Pantalla de bienvenida / onboarding.

### 📦 Gestión de Inventario Maestro
- **Panel en Tiempo Real**: Vista de stock total, productos abiertos y alertas críticas de productos a punto de vencer (Próximos 3 días).
- **Inventario Detallado (`/inventario`)**: Tabla maestra con filtros por categoría, insignias visuales (badges) y control exacto de stock.

### 🧠 Inteligencia Artificial y Carga Automatizada
- **Escáner Visual de Tickets Multimodal**: Ya no se requiere carga manual. El usuario toma una foto (o sube un PDF) del ticket de compra de sus proveedores. La IA identifica los productos, los categoriza lógicamente, les asigna un emoji y calcula sus días de vida útil.
- **Dictado de Compras por Voz**: Interfaz preparada para que el usuario dicte los insumos verbalmente.

### 📊 Inteligencia de Negocio y Analítica (`/analitica`)
- **Reporte de Mermas**: Cálculo del dinero perdido por productos vencidos en almacén.
- **Distribución de Gastos**: Visualización de los gastos mensuales divididos por categorías (Lácteos, Carnes, Bebidas, etc).
- **Asistente de Compras IA (BETA)**: Motor predictivo que analizará el ritmo histórico de consumo y recomendará qué comprar antes de los fines de semana para evitar quiebres de stock.

---

## 🚀 Actualizaciones y Logros (07 de Octubre de 2026)

Durante la sesión de hoy, se implementaron mejoras significativas que elevaron el proyecto al siguiente nivel:

1. **Migración a Visión Multimodal Nativa (IA)**: 
   - Se eliminó el uso de OCR y librerías tradicionales (`pdfplumber`) en el microservicio de Python.
   - Ahora el backend envía los archivos crudos (Imágenes JPG/PNG y PDFs) directamente al modelo visual de Google Gemini, logrando una precisión absoluta en tickets arrugados o de baja calidad.
2. **Soporte de Cámara Nativa en Frontend**: 
   - Se añadió el soporte `capture="environment"` al botón de escanear ticket, permitiendo que al acceder desde un teléfono celular se abra la cámara directamente para agilizar la carga.
3. **Desarrollo de Nuevas Pantallas Base**: 
   - Implementación de la vista completa de `/inventario` con tabla interactiva, filtros por categorías e indicadores de urgencia.
   - Implementación de la vista `/analitica` con dashboards de negocio y la estructura base del motor de recomendaciones predictivas.
4. **Pruebas Unitarias (Testing)**:
   - Se implementaron y corrieron exitosamente tests con `pytest` en el servidor de IA para asegurar que las conexiones con Gemini y los aislamientos de errores funcionen a la perfección.
5. **Gestión Segura de API Key (Opciones)**:
   - Se creó la pantalla `/opciones` que permite a los usuarios configurar su propia Google Gemini API Key de forma local.
   - Implementación de seguridad visual "write-only" (solo escritura) para evitar que la clave sea leída, expuesta o robada una vez que fue almacenada en el sistema.

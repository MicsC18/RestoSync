# 🍽️ RestoSync — Sistema de Gestión Integral para Gastronomía
RestoSync es una plataforma multimodular diseñada para la gestión operativa y administrativa de restaurantes, combinando un frontend interactivo, un backend robusto en Kotlin/Spring Boot, un microservicio de Inteligencia Artificial para procesamiento automático de datos y una base de datos PostgreSQL alojada en la nube.

## Guía de Instalación Rápida 

### 1. Backend (Spring Boot / Kotlin)
```bash
cd core-service
.\gradlew.bat build
.\gradlew.bat bootRun

## Microservicio de IA (restosync-ia)
cd restosync-ia
copy .env.example .env   # Agregar tu GEMINI_API_KEY en el .env
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000


### Frontend (restosync-frontend)
cd restosync-frontend
copy .env.example .env.local
npm install
npm run dev
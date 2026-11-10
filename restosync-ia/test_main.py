import io
import json
import os
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_verificar_estado():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"estado": "activo", "servicio": "RestoSync IA con Google Gemini"}

@patch("main.client.models.list")
def test_listar_modelos(mock_models_list):
    mock_model = MagicMock()
    mock_model.name = "gemini-3.5-flash"
    mock_models_list.return_value = [mock_model]

    response = client.get("/modelos")
    assert response.status_code == 200
    assert "gemini-3.5-flash" in response.json()["modelos_disponibles"]

@patch("main.client.models.generate_content")
def test_escanear_ticket_exito(mock_generate_content):
    # Simulamos la respuesta exitosa de Gemini en formato JSON
    respuesta_simulada = {
        "itemsEncontrados": [
            {
                "nombre": "Leche Larga Vida",
                "categoria": "Lácteos",
                "icono": "🥛",
                "cantidad": 2,
                "diasRestantes": 30
            }
        ]
    }
    
    mock_response = MagicMock()
    mock_response.text = json.dumps(respuesta_simulada)
    mock_generate_content.return_value = mock_response

    # Simulamos una imagen
    file_content = b"fake image bytes"
    
    response = client.post(
        "/api/v1/ia/escanear-ticket",
        files={"file": ("ticket.jpg", file_content, "image/jpeg")}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["mensaje"] == "Documento procesado inteligentemente por Google Gemini"
    assert len(data["itemsEncontrados"]) == 1
    
    item = data["itemsEncontrados"][0]
    assert item["nombre"] == "Leche Larga Vida"
    # El backend debe asignar estado cerrado automáticamente
    assert item["estado"] == "Cerrado"

@patch("main.client.models.generate_content")
def test_escanear_ticket_falla_api(mock_generate_content):
    # Simulamos que Gemini falla o devuelve vacio
    mock_response = MagicMock()
    mock_response.text = ""
    mock_generate_content.return_value = mock_response

    file_content = b"fake image bytes"
    
    response = client.post(
        "/api/v1/ia/escanear-ticket",
        files={"file": ("ticket.jpg", file_content, "image/jpeg")}
    )

    assert response.status_code == 503
    assert "Servicio de IA no disponible" in response.json()["detail"]


# ---------- POST /api/v1/ia/dictar-insumos (Plan-Mesas-Dictado §2.3 / §2.6) ----------

@patch("main.client.models.generate_content")
def test_dictar_insumos_exito(mock_generate_content):
    # Gemini responde dos ítems; el segundo llega sin unidadMedida ni icono (se completan acá).
    respuesta_simulada = {
        "itemsEncontrados": [
            {
                "nombre": "Tomates",
                "categoria": "Frutas y verduras",
                "icono": "🍅",
                "cantidad": 2,
                "unidadMedida": "Kilos",
                "diasRestantes": 5
            },
            {
                "nombre": "Leche",
                "categoria": "Lácteos",
                "cantidad": 3,
                "diasRestantes": 10
            }
        ]
    }

    mock_response = MagicMock()
    mock_response.text = json.dumps(respuesta_simulada)
    mock_generate_content.return_value = mock_response

    response = client.post(
        "/api/v1/ia/dictar-insumos",
        json={"texto": "dos kilos de tomates y tres litros de leche"}
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["itemsEncontrados"]) == 2

    primer, segundo = data["itemsEncontrados"]
    assert primer["nombre"] == "Tomates"
    assert primer["cantidad"] == 2
    assert primer["unidadMedida"] == "Kilos"
    # Contrato completo en todos los ítems: estado fijo y defaults conservadores.
    assert primer["estado"] == "Cerrado"
    assert segundo["unidadMedida"] == "Unidades"
    assert segundo["icono"] == "🛒"
    assert segundo["estado"] == "Cerrado"


@patch.dict(os.environ, {"GEMINI_API_KEY": ""})
def test_dictar_insumos_sin_clave_valida_devuelve_503():
    # Sin mock del client: el guard de clave debe rechazar antes de llamar a Gemini.
    response = client.post(
        "/api/v1/ia/dictar-insumos",
        json={"texto": "dos kilos de tomates"}
    )

    assert response.status_code == 503
    assert "GEMINI_API_KEY" in response.json()["detail"]


@patch("main.client.models.generate_content")
def test_dictar_insumos_ningun_modelo_responde_devuelve_503(mock_generate_content):
    # La cadena de fallback agota los modelos sin texto: 503 (la atenuación es del front).
    mock_response = MagicMock()
    mock_response.text = ""
    mock_generate_content.return_value = mock_response

    response = client.post(
        "/api/v1/ia/dictar-insumos",
        json={"texto": "dos kilos de tomates"}
    )

    assert response.status_code == 503
    assert "Servicio de IA no disponible" in response.json()["detail"]


@patch("main.client.models.generate_content")
def test_dictar_insumos_texto_vacio_devuelve_400(mock_generate_content):
    response = client.post(
        "/api/v1/ia/dictar-insumos",
        json={"texto": "   "}
    )

    assert response.status_code == 400
    mock_generate_content.assert_not_called()

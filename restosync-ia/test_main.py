import io
import json
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

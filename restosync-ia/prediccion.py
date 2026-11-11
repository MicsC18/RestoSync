"""Motor estadístico del monitor predictivo.

Función pura: recibe el historial agregado por el core y devuelve la
proyección de demanda, las mermas en riesgo y las compras sugeridas.
No realiza llamadas de red ni tiene efectos secundarios.
"""

import math
from datetime import date, datetime, timedelta

import pandas as pd

# Constantes de las fórmulas de proyección
VENTANA_BASE_DIAS = 28       # ventana para consumoDiarioBase
FACTOR_MINIMO = 0.5          # acotado inferior del factor por día de semana
FACTOR_MAXIMO = 2.0          # acotado superior del factor por día de semana
UMBRAL_MERMA = 0.01          # cantidadEnRiesgo mínima para reportar un lote
TOPE_MERMAS_DIAS = 30        # horizonte máximo de consumo esperado para mermas
DIAS_MINIMOS_HISTORIAL = 7   # span mínimo entre primer y último consumo


def _parsear_fecha(valor) -> date:
    if isinstance(valor, date):
        return valor
    return datetime.strptime(valor, "%Y-%m-%d").date()


def _iso(fecha: date) -> str:
    return fecha.strftime("%Y-%m-%d")


def _ddmm(fecha: date) -> str:
    return fecha.strftime("%d/%m")


def hay_historial_suficiente(series: list) -> bool:
    """Hay al menos un movimiento de consumo y >= 7 días entre el primero y el último."""
    fechas = [_parsear_fecha(f["fecha"]) for f in series if float(f.get("consumo", 0) or 0) > 0]
    if not fechas:
        return False
    return (max(fechas) - min(fechas)).days + 1 >= DIAS_MINIMOS_HISTORIAL


def _consumo_diario_por_insumo(series: list, ventana: pd.DatetimeIndex) -> dict:
    """Agrega el consumo diario por insumo con pandas y rellena de ceros los días sin actividad."""
    df = pd.DataFrame(
        [
            {
                "insumoId": int(f["insumoId"]),
                "fecha": pd.Timestamp(_parsear_fecha(f["fecha"])),
                "consumo": float(f.get("consumo", 0) or 0),
            }
            for f in series
        ]
    )
    if df.empty:
        return {}
    agrupado = df.groupby(["insumoId", "fecha"])["consumo"].sum()
    resultado = {}
    for insumo_id, sub_df in agrupado.groupby(level="insumoId"):
        diario = sub_df.droplevel("insumoId").reindex(ventana, fill_value=0.0)
        resultado[int(insumo_id)] = diario
    return resultado


def _consumo_diario_base(diario: pd.Series, ventana: pd.DatetimeIndex) -> float:
    """Fórmula 1: consumo total de los últimos 28 días de la ventana / min(28, días de la ventana)."""
    divisor = min(VENTANA_BASE_DIAS, len(ventana))
    corte = ventana[-1] - pd.Timedelta(days=divisor - 1)
    ultimos = diario[diario.index >= corte]
    return float(ultimos.sum()) / divisor


def _factores_dia_semana(diario: pd.Series, base: float) -> list:
    """Fórmula 2: promedio de consumo por día de semana / base, acotado a [0.5, 2.0].

    Sin datos para un día, o base 0 → factor 1.0.
    """
    factores = [1.0] * 7
    if base <= 0:
        return factores
    por_dia = diario.groupby(diario.index.day_of_week).mean()
    for dia in range(7):
        if dia in por_dia.index:
            factor = float(por_dia[dia]) / base
            factores[dia] = min(FACTOR_MAXIMO, max(FACTOR_MINIMO, factor))
    return factores


def _proyectar(base: float, factores: list, hoy: date, horizonte: int):
    """Fórmula 3: proyección de `horizonte` días desde mañana (fecha, cantidad)."""
    fechas = [hoy + timedelta(days=i + 1) for i in range(horizonte)]
    cantidades = [round(base * factores[d.weekday()], 2) for d in fechas]
    return list(zip(fechas, cantidades))


def _fecha_quiebre(proyeccion: list, stock_actual: float):
    """Fórmula 6: primera fecha cuya suma acumulada supera el stock; None si no ocurre."""
    acumulado = 0.0
    for fecha, cantidad in proyeccion:
        acumulado += cantidad
        if acumulado > stock_actual:
            return fecha
    return None


def _mermas_del_insumo(meta: dict, proyeccion: list, hoy: date) -> list:
    """Fórmula 7: lotes vigentes cuyo vencimiento cae antes de consumir su cantidad."""
    mermas = []
    for lote in meta.get("lotes", []) or []:
        cantidad = float(lote.get("cantidad", 0) or 0)
        if cantidad <= 0:
            continue
        vencimiento = _parsear_fecha(lote["fechaVencimiento"])
        if vencimiento < hoy:
            continue
        tope = min(vencimiento, hoy + timedelta(days=TOPE_MERMAS_DIAS))
        esperado = sum(c for fecha, c in proyeccion if fecha <= tope)
        riesgo = round(max(0.0, cantidad - esperado), 2)
        if riesgo > UMBRAL_MERMA:
            mermas.append({
                "insumoId": int(meta["id"]),
                "nombre": meta["nombre"],
                "icono": meta.get("icono"),
                "unidadMedida": meta["unidadMedida"],
                "cantidadEnRiesgo": riesgo,
                "fechaVencimiento": _iso(vencimiento),
            })
    return mermas


def _compra_del_insumo(meta: dict, total_proyectado: float, cobertura, quiebre,
                      horizonte: int, base: float) -> dict | None:
    """Fórmula 8: cantidad sugerida = ceil(max(0, totalProyectado + stockMinimo − stockActual))."""
    stock_actual = float(meta.get("stockActual", 0) or 0)
    stock_minimo = float(meta.get("stockMinimo") or 0)
    cantidad_sugerida = math.ceil(max(0.0, total_proyectado + stock_minimo - stock_actual))
    if cantidad_sugerida <= 0:
        return None
    if quiebre is not None:
        prioridad = "ALTA"
        motivo = f"Cobertura de {cobertura} días: el stock se agota antes del {_ddmm(quiebre)}."
    elif cobertura is not None and cobertura < horizonte * 2:
        prioridad = "MEDIA"
        motivo = f"Cobertura de {cobertura} días: el stock no llega holgado a los {horizonte} días proyectados."
    else:
        prioridad = "BAJA"
        motivo = f"El stock proyectado queda por debajo del mínimo en los próximos {horizonte} días."
    return {
        "insumoId": int(meta["id"]),
        "nombre": meta["nombre"],
        "icono": meta.get("icono"),
        "unidadMedida": meta["unidadMedida"],
        "cantidadSugerida": float(cantidad_sugerida),
        "prioridad": prioridad,
        "motivo": motivo,
    }


_PRIORIDAD_ORDEN = {"ALTA": 0, "MEDIA": 1, "BAJA": 2}


def calcular_prediccion(historial: dict, horizonte: int) -> dict:
    """Aplica las fórmulas de proyección sobre el HistorialResponse del core.

    Devuelve: {"datosInsuficientes", "demanda", "mermas", "compras"}.
    """
    horizonte = max(1, min(30, horizonte))
    series = historial.get("series", []) or []

    if not hay_historial_suficiente(series):
        return {"datosInsuficientes": True, "demanda": [], "mermas": [], "compras": []}

    hoy = date.today()
    desde = _parsear_fecha(historial["desde"])
    hasta = _parsear_fecha(historial["hasta"])
    ventana = pd.date_range(desde, hasta, freq="D")

    consumos = _consumo_diario_por_insumo(series, ventana)
    meta_por_insumo = {int(i["id"]): i for i in historial.get("insumos", []) or []}

    demanda = []
    proyeccion_por_insumo = {}
    for insumo_id, diario in consumos.items():
        base = _consumo_diario_base(diario, ventana)
        if base <= 0:
            continue
        meta = meta_por_insumo.get(insumo_id)
        if meta is None:
            continue
        factores = _factores_dia_semana(diario, base)
        proyeccion = _proyectar(base, factores, hoy, horizonte)
        proyeccion_por_insumo[insumo_id] = proyeccion
        total_proyectado = round(sum(c for _, c in proyeccion), 2)
        stock_actual = float(meta.get("stockActual", 0) or 0)
        cobertura = round(stock_actual / base, 1)
        quiebre = _fecha_quiebre(proyeccion, stock_actual)
        demanda.append({
            "insumoId": insumo_id,
            "nombre": meta["nombre"],
            "icono": meta.get("icono"),
            "unidadMedida": meta["unidadMedida"],
            "consumoDiarioBase": round(base, 2),
            "proyeccion": [{"fecha": _iso(f), "cantidad": c} for f, c in proyeccion],
            "totalProyectado": total_proyectado,
            "stockActual": stock_actual,
            "coberturaDias": cobertura,
            "fechaQuiebre": _iso(quiebre) if quiebre else None,
        })

    demanda.sort(key=lambda d: d["totalProyectado"], reverse=True)

    mermas = []
    for item in demanda:
        meta = meta_por_insumo[item["insumoId"]]
        mermas.extend(_mermas_del_insumo(meta, proyeccion_por_insumo[item["insumoId"]], hoy))
    mermas.sort(key=lambda m: (m["fechaVencimiento"], -m["cantidadEnRiesgo"]))

    compras = []
    for item in demanda:
        meta = meta_por_insumo[item["insumoId"]]
        quiebre = _parsear_fecha(item["fechaQuiebre"]) if item["fechaQuiebre"] else None
        compra = _compra_del_insumo(meta, item["totalProyectado"], item["coberturaDias"],
                                    quiebre, horizonte, item["consumoDiarioBase"])
        if compra:
            compras.append(compra)
    compras.sort(key=lambda c: (_PRIORIDAD_ORDEN[c["prioridad"]], -c["cantidadSugerida"]))

    return {"datosInsuficientes": False, "demanda": demanda, "mermas": mermas, "compras": compras}

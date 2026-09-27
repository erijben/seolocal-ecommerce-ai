from __future__ import annotations

from datetime import date
from math import ceil
from typing import Literal
import logging

import numpy as np
import pandas as pd
from fastapi import FastAPI, Request
from pydantic import BaseModel, Field
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from app.request_id import RequestIdMiddleware

#Le microservice ML reçoit l’historique des ventes journalières, transforme les données avec pandas, entraîne une régression linéaire avec scikit-learn pour prédire la demande future, puis calcule le risque de rupture et la quantité recommandée à réapprovisionner. Si les données sont insuffisantes, il utilise un fallback basé sur la moyenne mobile.
#analyser les ventes journalières
#prévoir la demande future
#calculer le risque de rupture
#recommander une quantité de réassort


#Un service Python FastAPI avec scikit-learn analyse les ventes et le stock pour estimer les risques de rupture et recommander des quantités de réassort.



app = FastAPI(
    title="SmartCommerce ML Forecast Service",
    description="Microservice ML pour prédire la demande et le risque de rupture de stock.",
    version="1.0.0",
)

app.add_middleware(
    RequestIdMiddleware,
    service_name="smartcommerce-ml-service",
)

logger = logging.getLogger(__name__)


RiskLevel = Literal["critical", "high", "medium", "low"]
ConfidenceLevel = Literal["high", "medium", "low"]
TrendDirection = Literal["increasing", "decreasing", "stable"]
ModelName = Literal["linear_regression", "moving_average_fallback"]


class DailySale(BaseModel):
    date: date
    quantity: int = Field(ge=0)


class ProductSalesInput(BaseModel):
    product_id: int
    product_name: str
    category: str | None = None
    price: float
    current_stock: int = Field(ge=0)
    stock_alert_threshold: int = Field(ge=0)
    daily_sales: list[DailySale]


class StockForecastRequest(BaseModel):
    analysis_window_days: int = Field(default=90, ge=7, le=365)
    forecast_horizon_days: int = Field(default=30, ge=7, le=180)
    products: list[ProductSalesInput]


class ProductForecastResponse(BaseModel):
    product_id: int
    product_name: str
    category: str | None
    price: float
    current_stock: int
    stock_alert_threshold: int

    total_sold: int
    daily_sales_velocity: float
    weekly_demand_estimate: float
    projected_demand_30_days: float
    days_until_stockout: float | None

    risk_level: RiskLevel
    recommended_restock_quantity: int
    recommended_action: str

    ml_model: ModelName
    ml_confidence: ConfidenceLevel
    trend: TrendDirection
    r2_score: float | None
    mae: float | None = None
    rmse: float | None = None
    validation_days: int | None = None


class StockForecastResponse(BaseModel):
    provider: str
    model_version: str
    analysis_window_days: int
    forecast_horizon_days: int
    summary: dict
    products: list[ProductForecastResponse]


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "smartcommerce-ml-service",
    }


@app.post("/forecast/stock", response_model=StockForecastResponse)
def forecast_stock(request: StockForecastRequest, http_request: Request):
    request_id = http_request.state.request_id
    logger.info(
        "ML stock forecast started",
        extra={
            "request_id": request_id,
            "products_count": len(request.products),
        },
    )
    products_forecast = [
        forecast_product(product, request.forecast_horizon_days)
        for product in request.products
    ]

    products_forecast.sort(
        key=lambda item: {
            "critical": 1,
            "high": 2,
            "medium": 3,
            "low": 4,
        }[item.risk_level]
    )

    summary = {
        "total_products_analyzed": len(products_forecast),
        "critical_count": sum(1 for item in products_forecast if item.risk_level == "critical"),
        "high_count": sum(1 for item in products_forecast if item.risk_level == "high"),
        "medium_count": sum(1 for item in products_forecast if item.risk_level == "medium"),
        "low_count": sum(1 for item in products_forecast if item.risk_level == "low"),
    }

    response = StockForecastResponse(
        provider="python_scikit_learn",
        model_version="linear-regression-v1",
        analysis_window_days=request.analysis_window_days,
        forecast_horizon_days=request.forecast_horizon_days,
        summary=summary,
        products=products_forecast,
    )

    logger.info(
        "ML stock forecast finished",
        extra={
            "request_id": request_id,
            "products_count": len(products_forecast),
        },
    )

    return response


def forecast_product(
    product: ProductSalesInput,
    forecast_horizon_days: int,
) -> ProductForecastResponse:
    df = build_daily_sales_dataframe(product.daily_sales)

    total_sold = int(df["quantity"].sum())
    daily_velocity = float(total_sold / max(len(df), 1))
    weekly_demand = daily_velocity * 7

    non_zero_sales_days = int((df["quantity"] > 0).sum())
    evaluation = {
    "mae": None,
    "rmse": None,
    "validation_days": None,
}

    if total_sold == 0 or non_zero_sales_days < 2:
        projected_demand = daily_velocity * forecast_horizon_days
        ml_model: ModelName = "moving_average_fallback"
        confidence: ConfidenceLevel = "low"
        trend: TrendDirection = "stable"
        score = None
    else:
        ml_result = run_linear_regression_forecast(df, forecast_horizon_days)
        evaluation = evaluate_linear_regression(df)
        projected_demand = max(
            ml_result["projected_demand"],
            daily_velocity * forecast_horizon_days,
        )
        ml_model = "linear_regression"
        confidence = calculate_confidence(non_zero_sales_days, ml_result["r2_score"])
        trend = ml_result["trend"]
        score = ml_result["r2_score"]

    projected_demand_30_days = round(float(projected_demand), 2)

    if daily_velocity > 0:
        days_until_stockout = round(product.current_stock / daily_velocity, 1)
    else:
        days_until_stockout = None

    risk_level = calculate_risk_level(
        current_stock=product.current_stock,
        threshold=product.stock_alert_threshold,
        days_until_stockout=days_until_stockout,
        projected_demand=projected_demand_30_days,
    )

    recommended_restock_quantity = calculate_restock_quantity(
        current_stock=product.current_stock,
        threshold=product.stock_alert_threshold,
        projected_demand=projected_demand_30_days,
        risk_level=risk_level,
    )

    return ProductForecastResponse(
        product_id=product.product_id,
        product_name=product.product_name,
        category=product.category,
        price=product.price,
        current_stock=product.current_stock,
        stock_alert_threshold=product.stock_alert_threshold,
        total_sold=total_sold,
        daily_sales_velocity=round(daily_velocity, 3),
        weekly_demand_estimate=round(weekly_demand, 2),
        projected_demand_30_days=projected_demand_30_days,
        days_until_stockout=days_until_stockout,
        risk_level=risk_level,
        recommended_restock_quantity=recommended_restock_quantity,
        recommended_action=get_recommended_action(risk_level),
        ml_model=ml_model,
        ml_confidence=confidence,
        trend=trend,
        r2_score=score,
        mae=evaluation["mae"],
        rmse=evaluation["rmse"],
        validation_days=evaluation["validation_days"],
    )

 #Cette fonction transforme les données JSON en tableau.
def build_daily_sales_dataframe(daily_sales: list[DailySale]) -> pd.DataFrame:
    df = pd.DataFrame([sale.model_dump() for sale in daily_sales])

    if df.empty:
        return pd.DataFrame(
            {
                "date": pd.date_range(end=pd.Timestamp.today(), periods=30),
                "quantity": np.zeros(30),
            }
        )

    df["date"] = pd.to_datetime(df["date"])
    df["quantity"] = df["quantity"].astype(int)

    df = df.sort_values("date").reset_index(drop=True)
    df["day_index"] = np.arange(len(df)) #C’est le numéro du jour dans l’historique.
    df["day_of_week"] = df["date"].dt.dayofweek #le jour de la semaine,Il peut aider à capter des habitudes : par exemple, certains produits se vendent plus le week-end.

    return df



def evaluate_linear_regression(
    df: pd.DataFrame,
) -> dict:
    minimum_training_days = 14
    minimum_total_days = 21

    if len(df) < minimum_total_days:
        return {
            "mae": None,
            "rmse": None,
            "validation_days": None,
        }

    validation_days = max(7, ceil(len(df) * 0.20))
    split_index = len(df) - validation_days

    if split_index < minimum_training_days:
        return {
            "mae": None,
            "rmse": None,
            "validation_days": None,
        }

    training_df = df.iloc[:split_index]
    validation_df = df.iloc[split_index:]

    training_non_zero_days = int(
        (training_df["quantity"] > 0).sum()
    )

    if training_non_zero_days < 2:
        return {
            "mae": None,
            "rmse": None,
            "validation_days": None,
        }

    model = LinearRegression()
    model.fit(
        training_df[["day_index", "day_of_week"]],
        training_df["quantity"],
    )

    validation_predictions = model.predict(
        validation_df[["day_index", "day_of_week"]]
    )
    validation_predictions = np.clip(
        validation_predictions,
        0,
        None,
    )

    actual_values = validation_df["quantity"]

    mae = float(
        mean_absolute_error(
            actual_values,
            validation_predictions,
        )
    )

    rmse = float(
        np.sqrt(
            mean_squared_error(
                actual_values,
                validation_predictions,
            )
        )
    )

    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "validation_days": validation_days,
    }



def run_linear_regression_forecast(
    df: pd.DataFrame,
    forecast_horizon_days: int,
) -> dict:
    features = df[["day_index", "day_of_week"]] #les données utilisées pour prédire
    target = df["quantity"] #ce qu’on veut prédire

    #Entraînement du modèle
    model = LinearRegression() #On crée un modèle de régression linéaire
    model.fit(features, target)  #Les features, ce sont les données utilisées pour prédire.
    #Le target, c’est ce qu’on veut prédire. combien d’unités seront vendues par jour

    train_predictions = model.predict(features)

 #Le modèle regarde les anciennes ventes
#et essaie de trouver une tendance mathématique.

#si les ventes augmentent avec le temps
#→ tendance increasing
#si elles diminuent
#→ tendance decreasing
#si elles changent peu
#→ tendance stable


    if target.nunique() > 1:
        score = round(float(r2_score(target, train_predictions)), 3) #R² mesure à quel point le modèle explique les données passées.
    else:
        score = None

    last_day_index = int(df["day_index"].max())

    future_rows = []
    for step in range(1, forecast_horizon_days + 1):
        future_day_index = last_day_index + step
        future_day_of_week = int((df["day_of_week"].iloc[-1] + step) % 7)

        future_rows.append(
            {
                "day_index": future_day_index,
                "day_of_week": future_day_of_week,
            }
        )

#Prédiction future
    future_features = pd.DataFrame(future_rows)
    future_predictions = model.predict(future_features) #Le modèle prédit la quantité vendue pour chaque futur jour.
    future_predictions = np.clip(future_predictions, 0, None)

    projected_demand = float(future_predictions.sum())


#La tendance
    slope = float(model.coef_[0])

    if slope > 0.01:
        trend: TrendDirection = "increasing" #Si la pente est positive #Les ventes semblent augmenter dans le temps
    elif slope < -0.01:
        trend = "decreasing"
    else:
        trend = "stable"

    return {
        "projected_demand": projected_demand,
        "trend": trend,
        "r2_score": score,
    }

#La confidence du modèle
def calculate_confidence(non_zero_sales_days: int, score: float | None) -> ConfidenceLevel:
    if non_zero_sales_days >= 10 and score is not None and score >= 0.4:
        return "high"

    if non_zero_sales_days >= 5:
        return "medium"

    return "low"

#Calcul du risque
def calculate_risk_level(
    current_stock: int,
    threshold: int,
    days_until_stockout: float | None,
    projected_demand: float,
) -> RiskLevel:
    if current_stock <= threshold:
        return "critical"

    if projected_demand >= current_stock:
        return "high"

    if days_until_stockout is not None and days_until_stockout <= 7:
        return "high"

    if days_until_stockout is not None and days_until_stockout <= 30:
        return "medium"

    return "low"


def calculate_restock_quantity(
    current_stock: int,
    threshold: int,
    projected_demand: float,
    risk_level: RiskLevel,
) -> int:
    if risk_level == "low":
        return 0

#Quantité recommandée
    target_stock = ceil(projected_demand + threshold)

    return max(0, target_stock - current_stock)


def get_recommended_action(risk_level: RiskLevel) -> str:
    if risk_level == "critical":
        return "Réapprovisionner immédiatement."

    if risk_level == "high":
        return "Planifier un réapprovisionnement urgent."

    if risk_level == "medium":
        return "Surveiller le stock et préparer une commande fournisseur."

    return "Stock stable, aucune action urgente."

---
title: "Regressão Linear Múltipla para Preço de Carros"
description: "Primeira implementação de regressão linear múltipla para estimar preços de carros com base em marca, carroceria, motor, quilometragem e ano. Pipeline completo: EDA, tratamento de outliers, transformação logarítmica e interpretação de coeficientes."
technologies: ["Python", "scikit-learn", "statsmodels", "Pandas", "NumPy", "Matplotlib", "Jupyter Notebook"]
mainResult: "R² de 0.773 no teste com preço em escala log. Breusch-Pagan p = 3.2e-6 evidencia heteroscedasticidade residual."
date: "2025-11"
github: "https://github.com/felipetp-ctrl/multi-linear-regression-car-prices"
featured: false
status: "completed"
order: 1
---

## Objetivos

- Explorar os dados e entender variáveis que mais afetam o preço
- Aplicar limpeza e tratamento de outliers
- Transformar o preço para escala logarítmica e interpretar coeficientes como variação percentual aproximada
- Treinar, avaliar e interpretar o modelo
- Documentar insights e próximos passos

## Dataset

Arquivo do **Data Science Bootcamp da 365 Data Science**, com registros de veículos contendo atributos como marca, tipo de carroceria, potência do motor (`EngineV`), quilometragem (`Mileage`) e ano de fabricação (`Year`). Dados incluídos em `data/raw/`.

## Estrutura do Repositório

```
src/
  linear_regression.py   # Script principal
notebooks/
  exploratory.ipynb      # EDA
reports/
  figures/               # Gráficos gerados
  model_summary.md       # Resumo OLS (statsmodels)
data/
  raw/                   # Dados originais
```

## Pipeline

1. **Carregar dados** — `src/linear_regression.py`
2. **Limpeza** — remoção de nulos e outliers em `Price`, `Mileage`, `EngineV`, `Year`
3. **Transformação** — log do preço para linearizar relações; dummies para categóricas
4. **Multicolinearidade** — VIF calculado; `Year` removido por alta correlação com `Mileage`
5. **Treino** — `LinearRegression` do scikit-learn
6. **Avaliação** — R², MAE e RMSE no espaço original (`exp` do log); gráficos de resíduos
7. **Interpretação** — coeficientes convertidos em % aproximado; resumo estatístico via statsmodels

## Resultados

| Métrica | Valor (teste) |
|---|---|
| R² | **0.7727** |
| RMSE | 0.4298 |
| MAE | 0.3157 |

> RMSE e MAE reportados no espaço original após `exp(log_price)`.

**Teste de Breusch-Pagan:** p-value = 3.2e−6 → rejeita homoscedasticidade. Variância dos resíduos não é constante, esperado em dados de preço com amplitude ampla.

## Principais Perguntas Respondidas

- Qual o efeito percentual aproximado da marca no preço, controlando outros fatores?
- Qual a depreciação associada à quilometragem?
- Qual o "premium" de motor maior (`EngineV`)?
- Registro (sim/não) agrega valor?

## Próximos Passos

- Adicionar validação cruzada
- Testar Ridge/Lasso para regularização
- Comparar com modelos baseados em árvore (Random Forest, XGBoost)
- Calcular intervalos de confiança dos coeficientes

## Reprodução

```bash
git clone https://github.com/felipetp-ctrl/multi-linear-regression-car-prices.git
cd multi-linear-regression-car-prices
pip install -r requirements.txt
python src/linear_regression.py
```

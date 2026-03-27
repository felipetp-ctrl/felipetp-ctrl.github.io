---
title: "Regressão Linear Múltipla para Preço de Carros"
titleEn: "Multiple Linear Regression for Car Price Prediction"
description: "Primeira implementação de regressão linear múltipla para estimar preços de carros com base em marca, carroceria, motor, quilometragem e ano. Pipeline completo: EDA, tratamento de outliers, transformação logarítmica e interpretação de coeficientes."
descriptionEn: "First implementation of multiple linear regression to estimate car prices based on brand, body type, engine, mileage and year. Complete pipeline: EDA, outlier treatment, logarithmic transformation and coefficient interpretation."
technologies: ["Python", "scikit-learn", "statsmodels", "Pandas", "NumPy", "Matplotlib", "Jupyter Notebook"]
mainResult: "R² de 0.773 no teste com preço em escala log. Breusch-Pagan p = 3.2e-6 evidencia heteroscedasticidade residual."
mainResultEn: "R² of 0.773 on test set with log-scaled price. Breusch-Pagan p = 3.2e-6 evidences residual heteroscedasticity."
date: "2025-11"
github: "https://github.com/felipetp-ctrl/multi-linear-regression-car-prices"
featured: false
status: "completed"
order: 5
---

<div data-body-lang="pt">

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

1. **Carregar dados**, `src/linear_regression.py`
2. **Limpeza**, remoção de nulos e outliers em `Price`, `Mileage`, `EngineV`, `Year`
3. **Transformação**, log do preço para linearizar relações, dummies para categóricas
4. **Multicolinearidade**, VIF calculado, `Year` removido por alta correlação com `Mileage`
5. **Treino**, `LinearRegression` do scikit-learn
6. **Avaliação**, R², MAE e RMSE no espaço original (`exp` do log), gráficos de resíduos
7. **Interpretação**, coeficientes convertidos em % aproximado, resumo estatístico via statsmodels

## Resultados

| Métrica | Valor (teste) |
|---|---|
| R² | **0.7727** |
| RMSE | 0.4298 |
| MAE | 0.3157 |

> RMSE e MAE reportados no espaço original após `exp(log_price)`.

**Teste de Breusch-Pagan:** p-value = 3.2e-6, rejeita homoscedasticidade. Variância dos resíduos não é constante, esperado em dados de preço com amplitude ampla.

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

</div>

<div data-body-lang="en" style="display:none">

## Objectives

- Explore the data and understand which variables most affect the price
- Apply data cleaning and outlier treatment
- Transform price to log scale and interpret coefficients as approximate percentage changes
- Train, evaluate and interpret the model
- Document insights and next steps

## Dataset

File from the **365 Data Science Bootcamp**, with vehicle records containing attributes such as brand, body type, engine power (`EngineV`), mileage (`Mileage`) and manufacturing year (`Year`). Data included in `data/raw/`.

## Repository Structure

```
src/
  linear_regression.py   # Main script
notebooks/
  exploratory.ipynb      # EDA
reports/
  figures/               # Generated plots
  model_summary.md       # OLS summary (statsmodels)
data/
  raw/                   # Original data
```

## Pipeline

1. **Load data**, `src/linear_regression.py`
2. **Cleaning**, remove nulls and outliers in `Price`, `Mileage`, `EngineV`, `Year`
3. **Transformation**, log of price to linearize relationships, dummies for categoricals
4. **Multicollinearity**, VIF calculated, `Year` removed due to high correlation with `Mileage`
5. **Training**, `LinearRegression` from scikit-learn
6. **Evaluation**, R², MAE and RMSE in original space (`exp` of log), residual plots
7. **Interpretation**, coefficients converted to approximate %, statistical summary via statsmodels

## Results

| Metric | Value (test) |
|---|---|
| R² | **0.7727** |
| RMSE | 0.4298 |
| MAE | 0.3157 |

> RMSE and MAE reported in original space after `exp(log_price)`.

**Breusch-Pagan test:** p-value = 3.2e-6, rejects homoscedasticity. Residual variance is not constant, expected for price data with wide range.

## Main Questions Answered

- What is the approximate percentage effect of brand on price, controlling for other factors?
- What is the depreciation associated with mileage?
- What is the "premium" for a larger engine (`EngineV`)?
- Does registration (yes/no) add value?

## Next Steps

- Add cross-validation
- Test Ridge/Lasso for regularization
- Compare with tree-based models (Random Forest, XGBoost)
- Calculate confidence intervals for coefficients

## Reproduction

```bash
git clone https://github.com/felipetp-ctrl/multi-linear-regression-car-prices.git
cd multi-linear-regression-car-prices
pip install -r requirements.txt
python src/linear_regression.py
```

</div>

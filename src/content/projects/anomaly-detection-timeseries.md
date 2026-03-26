---
title: "Unsupervised Anomaly Detection in Industrial Time Series"
description: "Variational Autoencoder trained on multivariate sensor data from industrial equipment to detect operational anomalies without labeled failure events."
technologies: ["Python", "TensorFlow", "Keras", "NumPy", "Pandas", "Plotly"]
mainResult: "AUC-ROC of 0.94 on a held-out fault simulation dataset, with mean detection latency of 4.2 seconds."
date: "2024-03"
github: "https://github.com/felipetp-ctrl/vae-anomaly-iot"
featured: true
status: "completed"
---

## Problem Statement

Industrial equipment generates continuous streams of sensor readings (temperature, vibration, pressure, current). Labeled anomaly data is scarce because failures are rare and expensive. This project explores unsupervised detection using reconstruction error from a Variational Autoencoder (VAE).

## Data

We used a publicly available bearing fault dataset (CWRU Bearing Data Center) combined with a proprietary dataset of HVAC sensor readings (anonymized). The CWRU dataset contains **ten fault categories** across four operating conditions.

Preprocessing pipeline:
1. Sliding window segmentation (window = 256 samples, stride = 64)
2. Z-score normalization per sensor channel
3. FFT features appended to raw time-domain features

## Architecture

```
Encoder:
  Input(256 × 8) → Conv1D(64, k=7) → Conv1D(128, k=5) → Dense(64)
  → μ ∈ ℝ^32, log σ² ∈ ℝ^32  [reparameterization trick]

Decoder:
  z ∈ ℝ^32 → Dense(64) → ConvTranspose1D(128) → ConvTranspose1D(64)
  → Output(256 × 8)

Loss: ELBO = E[log p(x|z)] - KL(q(z|x) || p(z))
```

The anomaly score at inference time is the **mean squared reconstruction error** averaged over five stochastic forward passes.

## Threshold Calibration

Thresholds were calibrated on a small set of unlabeled data using the 99th percentile of training reconstruction errors, avoiding the need for labeled anomalies during calibration.

## Results

| Method | AUC-ROC | Precision@0.01FPR | Latency (s) |
|---|---|---|---|
| Isolation Forest | 0.81 | 0.62 | < 0.1 |
| LSTM-AE | 0.89 | 0.74 | 1.8 |
| **VAE (ours)** | **0.94** | **0.83** | 4.2 |
| Semi-supervised (oracle labels) | 0.97 | 0.91 | — |

## Limitations

The 4.2-second latency from stochastic sampling is acceptable for predictive maintenance but unsuitable for real-time safety-critical applications. A deterministic decoder variant reduces latency to 0.3 s at a 2-point AUC cost.

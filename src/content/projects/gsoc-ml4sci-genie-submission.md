---
title: "GSoC 2026, ML4SCI GENIE: GNNs e SimCLR para Física de Partículas"
titleEn: "GSoC 2026, ML4SCI GENIE: GNNs and SimCLR for Particle Physics"
description: "Submissão ao Google Summer of Code 2026 (ML4SCI / GENIE). Pipeline completo para representar eventos de jatos de partículas como grafos e treinar GNNs com aprendizado contrastivo, como fundação técnica para detecção de anomalias em buscas por nova física."
descriptionEn: "Submission to Google Summer of Code 2026 (ML4SCI / GENIE). Complete pipeline to represent particle jet events as graphs and train GNNs with contrastive learning, as a technical foundation for anomaly detection in new physics searches."
technologies: ["Python", "PyTorch", "PyTorch Geometric", "EdgeConv", "SimCLR", "NT-Xent", "HDF5", "Jupyter Notebook"]
mainResult: "EdgeConv GNN: AUC 0.779 na classificação quark/gluon. SimCLR sem supervisão: AUC 0.632 via linear probe, treinado em CPU."
mainResultEn: "EdgeConv GNN: AUC 0.779 on quark/gluon classification. Unsupervised SimCLR: AUC 0.632 via linear probe, trained on CPU."
date: "2026-03"
github: "https://github.com/felipetp-ctrl/gsoc-ml4sci-genie-submission"
featured: true
status: "completed"
order: 2
metrics:
  - label: "AUC — EdgeConv GNN"
    labelEn: "AUC — EdgeConv GNN"
    value: "77.9"
  - label: "AUC — SimCLR (linear probe)"
    labelEn: "AUC — SimCLR (linear probe)"
    value: "63.2"
  - label: "Pipeline end-to-end"
    labelEn: "End-to-end pipeline"
    value: "100"
---

<div data-body-lang="pt">

**Felipe Tomé Pereira, Pontifícia Universidade Católica do Paraná (PUCPR)**

## Visão Geral

Este repositório contém a implementação para a submissão ao projeto **ML4SCI GENIE** do GSoC 2026: *Deep Graph Anomaly Detection with Contrastive Learning for New Physics Searches*.

O trabalho demonstra um pipeline completo para representar eventos de jatos de partículas como grafos e aplicar GNNs para classificação e aprendizado de representações, sendo a base técnica para o framework de detecção de anomalias proposto.

## Estrutura

```
gsoc-ml4sci-genie-submission/
├── common_task_1.ipynb       # Autoencoder para reconstrução de imagens de jatos
├── common_task_2.ipynb       # GNN classifier baseado em grafos (quark/gluon)
├── specific_task_1.ipynb     # SimCLR contrastivo em grafos de jatos
├── models/
│   ├── best_autoencoder.pt
│   ├── best_gnn.pt
│   ├── best_CLR.pt
│   └── best_LinClassifier.pt
└── datasets/                 # cache gerado na primeira execução
```

## Dataset

**139.306 eventos quark/gluon**, cada evento como imagem **125×125×3** com canais:
- **ECAL**, Electromagnetic Calorimeter
- **HCAL**, Hadronic Calorimeter
- **Tracker**, rastreador de partículas

[Download do dataset (.hdf5)](https://drive.google.com/file/d/1WO2K-SfU2dntGU4Bb3IYBp9Rh7rtTYEr/view?usp=sharing), não incluído no repositório.

## Tarefas

### Common Task 1, Autoencoder Convolucional

Pipeline: log1p transform, normalização por canal, encoder (4 conv blocks, bottleneck 8×8×32), decoder (transposed conv, Dropout2d, Sigmoid), MSE loss.

| Classe | Erro médio de reconstrução |
|---|---|
| Quarks | 0.000602 |
| Glúons | **0.000772** |

Glúons têm maior erro por formarem jatos mais dispersos, coerente com a física e útil como score de anomalia.

### Common Task 2, Graph-based EdgeConv GNN

**Construção do grafo:** pixels ativos como nós; features de nó: intensidades dos 3 canais, x_norm, y_norm, r_norm (6 features); arestas via **k-NN k=8** no espaço (η, φ), seguindo o ParticleNet; features de aresta: dx, dy, distância euclidiana, diferença de intensidade.

| Modelo | AUC | Accuracy | F1 |
|---|---|---|---|
| Logistic Regression (mean pool) | 0.515 | 0.512 | 0.509 |
| SmallCNN | 0.747 | 0.687 | 0.697 |
| **EdgeConv GNN** | **0.779** | **0.712** | **0.717** |

### Specific Task 1, SimCLR Contrastivo em Grafos

**Fase 1, Pré-treino não supervisionado (SimCLR):** augmentations via node feature dropout (p=0.1) e edge dropout (p=0.1); GNNEncoder com 2 camadas EdgeConv e dual pooling (mean, max); ProjectionHead MLP 2 camadas com BatchNorm; NT-Xent loss com τ=0.5; subconjunto estratificado de 20.000 eventos.

**Fase 2, Linear probe:** encoder congelado; camada linear única treinada para classificação.

| Modelo | AUC | Accuracy | F1 |
|---|---|---|---|
| SimCLR, linear probe | 0.632 | 0.597 | 0.561 |
| EdgeConv supervisionado (Task 2) | 0.779 | 0.712 | 0.717 |

> **Nota:** treinamento realizado em CPU; NT-Xent loss convergiu para ~4.40 (ideal: ~2.0–2.5). GPU no Colab (T4/A100) deve reduzir o tempo de treino em 10–20× e permitir convergência no dataset completo.

## Conexão com o Projeto GSoC

| Componente desta submissão | Papel no projeto completo |
|---|---|
| Pipeline de construção de grafos (Task 2) | Reutilizado para LHC Olympics 2020 e Top Quark Tagging |
| Autoencoder conv (Task 1) | Baseline de reconstrução para detecção de anomalias |
| SimCLR em grafos (Specific Task 1) | Protótipo do framework contrastivo de anomalia |

No projeto GSoC completo, o encoder SimCLR seria treinado apenas em jatos QCD (background), e o score de anomalia seria a distância dos embeddings de teste à distribuição normal aprendida, seguindo Luo et al. (2022).

## Instalação

```bash
git clone https://github.com/felipetp-ctrl/gsoc-ml4sci-genie-submission
cd gsoc-ml4sci-genie-submission
pip install -r requirements.txt
```

Execute os notebooks na ordem: `common_task_1.ipynb`, `common_task_2.ipynb`, `specific_task_1.ipynb`. O cache de grafos (~30 min na primeira execução) é gerado automaticamente e reutilizado.

</div>

<div data-body-lang="en" style="display:none">

**Felipe Tomé Pereira, Pontifical Catholic University of Paraná (PUCPR)**

## Overview

This repository contains the implementation for the submission to the **ML4SCI GENIE** project at GSoC 2026: *Deep Graph Anomaly Detection with Contrastive Learning for New Physics Searches*.

The work demonstrates a complete pipeline to represent particle jet events as graphs and apply GNNs for classification and representation learning, serving as the technical foundation for the proposed anomaly detection framework.

## Structure

```
gsoc-ml4sci-genie-submission/
├── common_task_1.ipynb       # Autoencoder for jet image reconstruction
├── common_task_2.ipynb       # Graph-based GNN classifier (quark/gluon)
├── specific_task_1.ipynb     # Contrastive SimCLR on jet graphs
├── models/
│   ├── best_autoencoder.pt
│   ├── best_gnn.pt
│   ├── best_CLR.pt
│   └── best_LinClassifier.pt
└── datasets/                 # cache generated on first run
```

## Dataset

**139,306 quark/gluon events**, each event as a **125×125×3** image with channels:
- **ECAL**, Electromagnetic Calorimeter
- **HCAL**, Hadronic Calorimeter
- **Tracker**, particle tracker

[Download dataset (.hdf5)](https://drive.google.com/file/d/1WO2K-SfU2dntGU4Bb3IYBp9Rh7rtTYEr/view?usp=sharing), not included in the repository.

## Tasks

### Common Task 1, Convolutional Autoencoder

Pipeline: log1p transform, per-channel normalization, encoder (4 conv blocks, 8×8×32 bottleneck), decoder (transposed conv, Dropout2d, Sigmoid), MSE loss.

| Class | Mean reconstruction error |
|---|---|
| Quarks | 0.000602 |
| Gluons | **0.000772** |

Gluons have higher error because they form more diffuse jets, consistent with physics and useful as an anomaly score.

### Common Task 2, Graph-based EdgeConv GNN

**Graph construction:** active pixels as nodes; node features: intensities of 3 channels, x_norm, y_norm, r_norm (6 features); edges via **k-NN k=8** in (η, φ) space, following ParticleNet; edge features: dx, dy, Euclidean distance, intensity difference.

| Model | AUC | Accuracy | F1 |
|---|---|---|---|
| Logistic Regression (mean pool) | 0.515 | 0.512 | 0.509 |
| SmallCNN | 0.747 | 0.687 | 0.697 |
| **EdgeConv GNN** | **0.779** | **0.712** | **0.717** |

### Specific Task 1, Contrastive SimCLR on Graphs

**Phase 1, Unsupervised pre-training (SimCLR):** augmentations via node feature dropout (p=0.1) and edge dropout (p=0.1); GNNEncoder with 2 EdgeConv layers and dual pooling (mean, max); 2-layer MLP ProjectionHead with BatchNorm; NT-Xent loss with τ=0.5; stratified subset of 20,000 events.

**Phase 2, Linear probe:** frozen encoder; single linear layer trained for classification.

| Model | AUC | Accuracy | F1 |
|---|---|---|---|
| SimCLR, linear probe | 0.632 | 0.597 | 0.561 |
| Supervised EdgeConv (Task 2) | 0.779 | 0.712 | 0.717 |

> **Note:** training performed on CPU; NT-Xent loss converged to ~4.40 (ideal: ~2.0–2.5). GPU on Colab (T4/A100) should reduce training time by 10–20× and allow convergence on the full dataset.

## Connection with the GSoC Project

| Component in this submission | Role in the full project |
|---|---|
| Graph construction pipeline (Task 2) | Reused for LHC Olympics 2020 and Top Quark Tagging |
| Conv autoencoder (Task 1) | Reconstruction baseline for anomaly detection |
| SimCLR on graphs (Specific Task 1) | Prototype of the contrastive anomaly framework |

In the full GSoC project, the SimCLR encoder would be trained exclusively on QCD jets (background), and the anomaly score would be the distance of test embeddings from the learned normal distribution, following Luo et al. (2022).

## Installation

```bash
git clone https://github.com/felipetp-ctrl/gsoc-ml4sci-genie-submission
cd gsoc-ml4sci-genie-submission
pip install -r requirements.txt
```

Run the notebooks in order: `common_task_1.ipynb`, `common_task_2.ipynb`, `specific_task_1.ipynb`. The graph cache (~30 min on first run) is generated automatically and reused.

</div>

---
title: "GSoC 2025, ML4SCI GENIE: GNNs e SimCLR para Física de Partículas"
description: "Submissão ao Google Summer of Code 2025 (ML4SCI / GENIE). Pipeline completo para representar eventos de jatos de partículas como grafos e treinar GNNs com aprendizado contrastivo, como fundação técnica para detecção de anomalias em buscas por nova física."
technologies: ["Python", "PyTorch", "PyTorch Geometric", "EdgeConv", "SimCLR", "NT-Xent", "HDF5", "Jupyter Notebook"]
mainResult: "EdgeConv GNN: AUC 0.779 na classificação quark/gluon. SimCLR sem supervisão: AUC 0.632 via linear probe, treinado em CPU."
date: "2025-03"
github: "https://github.com/felipetp-ctrl/gsoc-ml4sci-genie-submission"
featured: true
status: "completed"
order: 2
---

**Felipe Tomé Pereira, Pontifícia Universidade Católica do Paraná (PUCPR)**

## Visão Geral

Este repositório contém a implementação para a submissão ao projeto **ML4SCI GENIE** do GSoC 2025: *Deep Graph Anomaly Detection with Contrastive Learning for New Physics Searches*.

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

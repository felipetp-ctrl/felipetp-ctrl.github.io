---
title: "Deep Graph-Level Anomaly Detection com Aprendizado Contrastivo"
description: "Reimplementação parcial do framework GLADC (Luo et al., 2022) para detecção não supervisionada de anomalias em grafos. Compara Graph Autoencoder (GAE) e SimCLR em 7 datasets TUDataset, como validação do pipeline proposto para o GSoC 2025 ML4SCI GENIE."
technologies: ["Python", "PyTorch Geometric", "EdgeConv", "SimCLR", "NT-Xent", "AdamW", "TUDatasets", "Jupyter Notebook"]
mainResult: "SimCLR superou o GLADC em ENZYMES (AUC 0.689 vs 0.583) e COX2 (0.647 vs 0.615). GAE atingiu AUC 0.989 em AIDS, próximo ao estado da arte."
date: "2026-03"
github: "https://github.com/felipetp-ctrl/graph-anomaly-detection"
featured: true
status: "completed"
order: 1
---

Desenvolvido como parte do framework de detecção de anomalias proposto para o [ML4SCI GENIE, GSoC 2025](https://github.com/felipetp-ctrl/gsoc-ml4sci-genie-submission).

## Referência

> **Deep graph level anomaly detection with contrastive learning**
> Luo, X. et al. (2022). *Scientific Reports*, 12, 19867.
> DOI: [10.1038/s41598-022-22086-3](https://doi.org/10.1038/s41598-022-22086-3)

Reimplementação parcial do framework GLADC com diferenças arquiteturais descritas abaixo, benchmarked em 7 datasets TUDataset.

## Arquitetura

### Graph Autoencoder (GAE), baseline

- Encoder com camadas **EdgeConv** (em vez do GCN plain do paper original)
- Decoder reconstrói a matriz de adjacência via `sigmoid(Z @ Z.T)` por grafo
- Loss: **MSE de reconstrução** (mais estável que BCE na prática)
- Score de anomalia: erro de reconstrução negativo (menor erro = mais normal)

### SimCLR em Grafos, modelo principal

- Augmentações explícitas: **node feature dropout (p=0.1)** e **edge dropout (p=0.1)** para gerar duas views por grafo (em contraste com perturbação de pesos usada no paper)
- Encoder EdgeConv retorna embeddings em nível de **nó** e de **grafo**
- Projection head: MLP (2×hidden, proj_dim) com BatchNorm, NT-Xent loss com τ=0.5
- Score de anomalia: distância híbrida nó e grafo ao centróide da distribuição de treino (`score = mean_node_error + graph_error`, distâncias L2 ao quadrado, inspirado na Eq. 11 do paper)

### Protocolo de Treino

- Split estratificado 70/15/15 (treino/val/teste)
- Para datasets sem features de nó (ex. IMDB-BINARY): **grau do nó** como feature 1-dim
- Otimizador: **AdamW** com decoupled weight decay
- Early stopping com patience=10 na loss de validação

## Estrutura

```
graph-anomaly-detection/
├── src/
│   ├── dataset.py          # Carregamento TUDataset e estatísticas
│   ├── models.py           # GNNEncoder, GAE, ProjectionHead, SimCLRModel
│   ├── augmentations.py    # node_feature_dropout, edge_dropout, augment
│   └── losses.py           # NTXentLoss
├── results/figures/        # Plots gerados pelo demo.ipynb
├── models/                 # Checkpoints salvos
├── train.py                # Pipeline de treino
├── iterative_train.py      # Itera sobre múltiplos datasets e classes de anomalia
└── demo.ipynb              # EDA e visualização de resultados
```

## Resultados (ROC-AUC no teste)

| Dataset | GAE (ours) | SimCLR (ours) | GLADC (paper) |
|---|---|---|---|
| BZR | 0.5825 | 0.6538 | 0.715 ± 0.067 |
| DHFR | **0.6625** | 0.5539 | 0.612 ± 0.041 |
| COX2 | 0.5795 | **0.6466** | 0.615 ± 0.044 |
| ENZYMES | 0.5929 | **0.6889** | 0.583 ± 0.035 |
| AIDS | **0.9894** | 0.5171 | 0.993 ± 0.005 |
| NCI1 | 0.5519 | 0.5599 | 0.683 ± 0.011 |
| IMDB-BINARY | **0.6384** | 0.5296 | 0.656 ± 0.023 |

> Diferenças em relação ao paper refletem escolhas arquiteturais (EdgeConv vs GCN, augmentações explícitas vs perturbação de pesos) e sensibilidade a hiperparâmetros por dataset. Valores do paper são médias de 5 seeds.

## Datasets

Benchmarked em TUDatasets (PyTorch Geometric): **BZR, DHFR, COX2, ENZYMES, AIDS, NCI1, IMDB-BINARY**. Download automático na primeira execução.

## Reprodução

```bash
git clone https://github.com/felipetp-ctrl/graph-anomaly-detection
cd graph-anomaly-detection
pip install -r requirements.txt
python iterative_train.py
```

Para cada dataset, o script executa: download e pré-processamento, treino do GAE, treino do SimCLR, scores de anomalia e AUC comparativo impresso.

**Google Colab (GPU recomendado):**
```python
!git clone https://github.com/felipetp-ctrl/graph-anomaly-detection
%cd graph-anomaly-detection
!pip install -r requirements.txt
!python iterative_train.py
```

## Conexão com o GSoC

Os TUDatasets validam o pipeline antes de aplicá-lo a dados de física de partículas. No projeto GSoC completo, o mesmo encoder seria treinado em jatos QCD (background do LHC Olympics 2020) e o score contrastivo identificaria candidatos a nova física.

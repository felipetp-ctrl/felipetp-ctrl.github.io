---
title: "Caderno de Estudos: Hands-On ML, Deep Learning, CNNs e GNNs"
description: "Notebooks de estudo em PT-BR seguindo o livro Hands-On Machine Learning (Aurélien Géron), com implementações comentadas de MLPs, DNNs, CNNs e uma trilha complementar de Graph Neural Networks baseada no curso Stanford CS224W."
technologies: ["Python", "TensorFlow", "Keras", "PyTorch Geometric", "scikit-learn", "Jupyter Notebook"]
mainResult: "Cobertura dos capítulos 10, 11, 14 e 17 do HOML com trilha paralela de GNNs (Stanford CS224W). Notebooks didáticos em PT-BR com explicações conceituais e código."
date: "2026-02"
github: "https://github.com/felipetp-ctrl/homl-deep-learning-ensemble-unsupervised"
featured: false
status: "completed"
study: true
order: 3
---

> **Repositório de estudo.** Notebooks com anotações e implementações seguindo o livro *Hands-On Machine Learning with Scikit-Learn, Keras & TensorFlow* (Géron, 3ª ed.), escritos em português.

## Estrutura

```
handson-studies/
  chapter-10/    # MLP, classifier e regression
  chapter-11/    # Treinamento de DNNs profundas
  chapter-14/    # CNNs
  chapter-17/    # Aprendizado não supervisionado
gnns-stanford/   # Graph Neural Networks (Stanford CS224W)
```

## Conteúdo por Capítulo

### Chapter 10, Redes Neurais com Keras

Implementação de MLPs para classificação e regressão. Datasets utilizados: Iris, California Housing. Explora a API Sequential e Functional do Keras.

### Chapter 11, Treinamento de DNNs

Problemas de gradiente (vanishing/exploding), técnicas de inicialização, BatchNorm, Dropout, otimizadores (Adam, RMSprop). Pré-treinamento não supervisionado e transfer learning.

### Chapter 14, Redes Convolucionais (CNNs)

Convoluções, pooling, arquiteturas clássicas. Notebooks combinam explicação visual e implementação comentada.

### Chapter 17, Aprendizado Não Supervisionado

Autoencoders e técnicas de representação não supervisionada.

## Trilha GNNs, Stanford CS224W

Notebooks baseados no curso **Machine Learning with Graphs** da Stanford, cobrindo fundamentos de Graph Neural Networks com PyTorch Geometric. Esta trilha foi base para os projetos [`graph-anomaly-detection`](https://github.com/felipetp-ctrl/graph-anomaly-detection) e [`gsoc-ml4sci-genie-submission`](https://github.com/felipetp-ctrl/gsoc-ml4sci-genie-submission).

## Formato

Cada notebook segue o padrão: conceito teórico em PT-BR, equações, implementação comentada e experimento. Útil como referência e como template de código reutilizável.

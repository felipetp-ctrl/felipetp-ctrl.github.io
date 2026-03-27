---
title: "Caderno de Estudos: Hands-On ML, Deep Learning, CNNs e GNNs"
titleEn: "Study Notebook: Hands-On ML, Deep Learning, CNNs and GNNs"
description: "Notebooks de estudo em PT-BR seguindo o livro Hands-On Machine Learning (Aurélien Géron), com implementações comentadas de MLPs, DNNs, CNNs e uma trilha complementar de Graph Neural Networks baseada no curso Stanford CS224W."
descriptionEn: "Study notebooks following the Hands-On Machine Learning book (Aurélien Géron), with commented implementations of MLPs, DNNs, CNNs and a complementary Graph Neural Networks track based on the Stanford CS224W course."
technologies: ["Python", "TensorFlow", "Keras", "PyTorch Geometric", "scikit-learn", "Jupyter Notebook"]
mainResult: "Cobertura dos capítulos 10, 11, 14 e 17 do HOML com trilha paralela de GNNs (Stanford CS224W). Notebooks didáticos em PT-BR com explicações conceituais e código."
mainResultEn: "Coverage of HOML chapters 10, 11, 14 and 17 with a parallel GNNs track (Stanford CS224W). Didactic notebooks with conceptual explanations and code."
date: "2026-02"
github: "https://github.com/felipetp-ctrl/homl-deep-learning-ensemble-unsupervised"
featured: false
status: "completed"
study: true
order: 3
---

<div data-body-lang="pt">

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

</div>

<div data-body-lang="en" style="display:none">

> **Study repository.** Notebooks with annotations and implementations following *Hands-On Machine Learning with Scikit-Learn, Keras & TensorFlow* (Géron, 3rd ed.).

## Structure

```
handson-studies/
  chapter-10/    # MLP, classifier and regression
  chapter-11/    # Training deep DNNs
  chapter-14/    # CNNs
  chapter-17/    # Unsupervised learning
gnns-stanford/   # Graph Neural Networks (Stanford CS224W)
```

## Chapter Content

### Chapter 10, Neural Networks with Keras

MLP implementations for classification and regression. Datasets used: Iris, California Housing. Explores Keras Sequential and Functional APIs.

### Chapter 11, DNN Training

Gradient problems (vanishing/exploding), initialization techniques, BatchNorm, Dropout, optimizers (Adam, RMSprop). Unsupervised pre-training and transfer learning.

### Chapter 14, Convolutional Networks (CNNs)

Convolutions, pooling, classic architectures. Notebooks combine visual explanation and commented implementation.

### Chapter 17, Unsupervised Learning

Autoencoders and unsupervised representation techniques.

## GNNs Track, Stanford CS224W

Notebooks based on Stanford's **Machine Learning with Graphs** course, covering Graph Neural Networks fundamentals with PyTorch Geometric. This track served as the foundation for the [`graph-anomaly-detection`](https://github.com/felipetp-ctrl/graph-anomaly-detection) and [`gsoc-ml4sci-genie-submission`](https://github.com/felipetp-ctrl/gsoc-ml4sci-genie-submission) projects.

## Format

Each notebook follows the pattern: theoretical concept, equations, commented implementation and experiment. Useful as a reference and as a reusable code template.

</div>

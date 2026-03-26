---
title: "Transformer-based Classification of Brazilian Legal Documents"
description: "Fine-tuned BERTimbau for multi-label classification of Brazilian court decisions, achieving state-of-the-art results on a curated corpus of 120k documents from the Supreme Court (STF)."
technologies: ["Python", "PyTorch", "HuggingFace Transformers", "BERTimbau", "scikit-learn"]
mainResult: "F1-macro of 0.91 on held-out test set, outperforming previous TF-IDF + SVM baseline by 14 pp."
date: "2024-08"
github: "https://github.com/felipetp-ctrl/legal-bert-br"
featured: true
status: "published"
---

## Motivation

Brazilian judicial decisions follow a complex taxonomy of legal themes. Manually categorizing these documents is labor-intensive and inconsistent across different clerks. This project investigates whether pre-trained Portuguese language models can automate this classification reliably enough for production use.

## Dataset

The dataset was sourced from the STF's public API, comprising **120,847 court decisions** published between 2010 and 2023. Documents were de-identified and annotated with 28 legal theme labels following the official taxonomy. The final split was 80/10/10 (train/val/test), stratified by label frequency.

```
Dataset statistics:
  Total documents : 120,847
  Vocabulary size : 142,310 tokens
  Avg. length     : 847 words
  Labels          : 28 (multi-label)
  Label density   : 1.8 labels/doc
```

## Methodology

We fine-tuned **BERTimbau-large** (Souza et al., 2020) on the classification task using a sigmoid output layer for multi-label prediction. The training procedure used:

- **Optimizer**: AdamW with linear warmup + cosine decay
- **Learning rate**: 2e-5 for the transformer, 1e-3 for the classifier head
- **Batch size**: 16 (gradient accumulation × 4)
- **Epochs**: 5, with early stopping on validation macro-F1

Documents exceeding 512 tokens were handled via a sliding window strategy with mean pooling over overlapping segments.

## Results

| Model | F1-macro | F1-micro | Hamming Loss |
|---|---|---|---|
| TF-IDF + SVM (baseline) | 0.77 | 0.81 | 0.048 |
| FastText | 0.82 | 0.85 | 0.039 |
| BERTimbau-base | 0.88 | 0.91 | 0.027 |
| **BERTimbau-large (ours)** | **0.91** | **0.93** | **0.021** |

## Discussion

The model shows strong performance on high-frequency labels but degrades for rare categories (< 500 training examples). Future work should explore data augmentation strategies and hierarchical classification architectures.

## References

- Souza, F., Nogueira, R., & Lotufo, R. (2020). BERTimbau: Pretrained BERT models for Brazilian Portuguese. *BRACIS 2020*.

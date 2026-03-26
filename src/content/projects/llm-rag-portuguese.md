---
title: "RAG Pipeline for Portuguese Document Q&A"
description: "Retrieval-Augmented Generation system for question-answering over corporate documents in Brazilian Portuguese, combining dense retrieval with a locally-hosted LLM."
technologies: ["Python", "LangChain", "FAISS", "Sentence-Transformers", "Ollama", "FastAPI"]
mainResult: "EM score of 0.73 and F1 of 0.84 on a domain-specific Q&A benchmark, running fully on-premise."
date: "2025-01"
github: "https://github.com/felipetp-ctrl/rag-ptbr"
demo: "https://felipetp-ctrl.github.io/rag-demo"
featured: true
status: "in-progress"
---

## Overview

Many Brazilian enterprises hold large archives of internal documents (policies, manuals, contracts) that employees need to query. Sending these documents to commercial LLM APIs raises data privacy concerns. This project implements a fully on-premise RAG pipeline capable of running on commodity hardware.

## System Architecture

```
┌──────────────┐    ┌───────────────┐    ┌──────────────────┐
│  Documents   │───▶│  Chunking &   │───▶│  FAISS Index     │
│  (.pdf, .md) │    │  Embedding    │    │  (dense vectors) │
└──────────────┘    └───────────────┘    └────────┬─────────┘
                                                   │ top-k retrieval
┌──────────────┐    ┌───────────────┐    ┌────────▼─────────┐
│    Answer    │◀───│  LLM (local)  │◀───│  Context Builder │
│              │    │  Mistral 7B   │    │  + Reranker      │
└──────────────┘    └───────────────┘    └──────────────────┘
```

**Embedding model**: `rufimelo/Legal-BERTimbau-sts-large-ma-v3`
**Retriever**: FAISS with HNSW index (M=32, ef=128)
**Reranker**: Cross-encoder `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`
**Generator**: Mistral-7B-Instruct-v0.3 via Ollama

## Chunking Strategy

Documents were chunked using a **semantic chunking** approach rather than fixed-size splits:

1. Segment documents by heading hierarchy (H1 → H2 → H3)
2. Recursively split segments exceeding 512 tokens at sentence boundaries
3. Overlap of 50 tokens between adjacent chunks

This reduced the embedding of partial semantic units compared to naive character-based chunking.

## Evaluation

A domain-specific benchmark of **847 question-answer pairs** was constructed by domain experts from 23 corporate manuals. Questions cover factual lookup, multi-hop reasoning, and numerical extraction.

| Configuration | EM | F1 | Latency/query |
|---|---|---|---|
| BM25 + Mistral-7B | 0.58 | 0.71 | 2.1 s |
| Dense FAISS + Mistral-7B | 0.68 | 0.79 | 2.8 s |
| **Dense + Reranker + Mistral-7B** | **0.73** | **0.84** | 4.1 s |
| GPT-4o (no RAG, zero-shot) | 0.41 | 0.59 | — |

The last row illustrates that domain-specific retrieval is essential — generic LLMs without access to the document corpus perform poorly.

## Deployment

The pipeline is packaged as a FastAPI service with a Streamlit front-end, deployable via Docker Compose on a single machine with 16 GB RAM.

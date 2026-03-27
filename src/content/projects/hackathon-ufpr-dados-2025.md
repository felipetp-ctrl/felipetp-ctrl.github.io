---
title: "Dashboard + RAG para Hackathon de Dados UFPR 2025"
titleEn: "Dashboard + RAG for UFPR Data Hackathon 2025"
description: "Solução colaborativa para o Hackathon de Dados UFPR 2025. Arquitetura RAG híbrida com agente ReAct sobre dados de avaliação institucional da UFPR, com Star Schema e 5 dashboards analíticos interativos deployados ao vivo."
descriptionEn: "Collaborative solution for the UFPR Data Hackathon 2025. Hybrid RAG architecture with a ReAct agent over UFPR institutional assessment data, with Star Schema modeling and 5 live-deployed interactive analytics dashboards."
technologies: ["Python", "Streamlit", "LlamaIndex", "Google Gemini 2.5 Flash", "Pandas", "Docker", "RAG", "ReAct"]
mainResult: "Aplicação deployada ao vivo com agente ReAct capaz de escolher entre análise quantitativa (Pandas) e busca semântica (LlamaIndex) para responder perguntas sobre avaliação institucional da UFPR."
mainResultEn: "Live-deployed app with a ReAct agent that selects between quantitative analysis (Pandas) and semantic search (LlamaIndex) to answer questions about UFPR institutional assessment data."
date: "2025-04"
github: "https://github.com/luis-ota/hackathon-ufpr-dados-2025"
featured: true
status: "completed"
order: 3
---

<div data-body-lang="pt">

Projeto desenvolvido em colaboração com [Luis Ota](https://github.com/luis-ota) para o **Hackathon de Dados UFPR 2025**. A solução combina um dashboard analítico interativo com um chatbot inteligente baseado em RAG híbrido, tudo sobre os dados de avaliação institucional da UFPR.

## Modelagem dos Dados

Os dados brutos foram remodelados para o padrão **Star Schema**, otimizando performance e clareza analítica:

**Tabelas Fato:**
- `FATO_AVCURSOS` — Respostas da avaliação de cursos
- `FATO_AVDISCIPLINAS` — Respostas da avaliação de disciplinas
- `FATO_AVINSTITUCIONAL` — Respostas da avaliação institucional

**Tabelas Dimensão:**
- `DIM_CURSOS`, `DIM_DISCIPLINAS`, `DIM_PERGUNTAS`, `DIM_TIPO_PERGUNTA_SINAES`, `DIM_UNIDADES`

## Dashboards Analíticos

Cinco dashboards interativos cobrindo perspectivas distintas da avaliação:

| Dashboard | Foco |
|---|---|
| Visão Geral | Satisfação média, engajamento, gap de comunicação |
| SINAES | Conformidade e score nos 5 eixos avaliativos |
| Qualidade de Ensino | Didática, carga horária, aderência ao plano |
| Gestão de Cursos | Satisfação por unidade, dispersão score × volume |
| Clima Institucional | Percepção de servidores, transparência, infraestrutura |

## Arquitetura RAG Híbrida

O chatbot usa um agente **ReAct** (LlamaIndex) que analisa cada pergunta e decide automaticamente qual ferramenta executar:

**Ferramentas de Análise de Dados** (perguntas quantitativas):
- `calculate_satisfaction` — % de respostas "Concordo"
- `count_responses` — contagens e filtros
- `get_top_bottom` — rankings top/bottom N
- `join_and_analyze` — cruzamento entre tabelas com auto-join de códigos para nomes legíveis
- `get_table_schema` — inspeção de estrutura

**Busca Semântica** (perguntas conceituais):
- `semantic_search` — indexação vetorial de PDFs e documentos via LlamaIndex, enriquecida com o documento oficial de contextualização do SINAES

O índice vetorial é persistido em disco (`storage/`), eliminando reindexação a cada execução.

## Estrutura do Projeto

```
hackathon-ufpr-dados-2025/
├── app.py                      # Ponto de entrada (Streamlit)
├── data/                       # CSV / Excel / PDF
├── storage/                    # Índice vetorial persistido
├── src/
│   ├── components/
│   │   ├── chat.py             # Interface do chatbot
│   │   └── dashboards/         # 5 dashboards analíticos
│   └── services/
│       ├── rag_engine.py       # Motor RAG híbrido
│       ├── data_tools.py       # Ferramentas de análise
│       └── table_metadata.py   # Metadados e auto-join
├── docker-compose.yml
└── Dockerfile
```

</div>

<div data-body-lang="en" style="display:none">

Project developed in collaboration with [Luis Ota](https://github.com/luis-ota) for the **UFPR Data Hackathon 2025**. The solution combines an interactive analytics dashboard with an intelligent chatbot based on hybrid RAG, all built on UFPR's institutional assessment data.

## Data Modeling

Raw data was reshaped into a **Star Schema** for optimized performance and analytical clarity:

**Fact Tables:**
- `FATO_AVCURSOS` — Course assessment responses
- `FATO_AVDISCIPLINAS` — Subject assessment responses
- `FATO_AVINSTITUCIONAL` — Institutional assessment responses

**Dimension Tables:**
- `DIM_CURSOS`, `DIM_DISCIPLINAS`, `DIM_PERGUNTAS`, `DIM_TIPO_PERGUNTA_SINAES`, `DIM_UNIDADES`

## Analytics Dashboards

Five interactive dashboards covering distinct assessment perspectives:

| Dashboard | Focus |
|---|---|
| Overview | Average satisfaction, engagement, communication gap |
| SINAES | Compliance and score across the 5 evaluation axes |
| Teaching Quality | Pedagogy, workload, syllabus adherence |
| Course Management | Satisfaction by unit, score × response volume scatter |
| Institutional Climate | Staff perception, transparency, infrastructure |

## Hybrid RAG Architecture

The chatbot uses a **ReAct** agent (LlamaIndex) that analyzes each question and automatically decides which tool to execute:

**Data Analysis Tools** (quantitative questions):
- `calculate_satisfaction` — % of "Agree" responses
- `count_responses` — counts and filters
- `get_top_bottom` — top/bottom N rankings
- `join_and_analyze` — cross-table analysis with auto-join of codes to human-readable names
- `get_table_schema` — schema inspection

**Semantic Search** (conceptual questions):
- `semantic_search` — vector indexing of PDFs and documents via LlamaIndex, enriched with the official SINAES contextualization document

The vector index is persisted to disk (`storage/`), eliminating re-indexing on every run.

## Project Structure

```
hackathon-ufpr-dados-2025/
├── app.py                      # Entry point (Streamlit)
├── data/                       # CSV / Excel / PDF
├── storage/                    # Persisted vector index
├── src/
│   ├── components/
│   │   ├── chat.py             # Chatbot interface
│   │   └── dashboards/         # 5 analytics dashboards
│   └── services/
│       ├── rag_engine.py       # Hybrid RAG engine
│       ├── data_tools.py       # Analysis tools
│       └── table_metadata.py   # Metadata and auto-join
├── docker-compose.yml
└── Dockerfile
```

</div>

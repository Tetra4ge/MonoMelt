# Phase 3: AI-Driven Contextual Analysis & Vector Search

## Overview
Phase 3 takes the raw static graph generated in Phase 2 and enriches it with semantic understanding using LLMs and Vector search to identify logical boundaries that static analysis misses.

## 1. LLM Integration Engine
- **FastAPI Service:** Implement a wrapper around the Gemini/OpenRouter API.
- **Prompt Engineering:** Design prompts that accept snippets of code and their graph edges to deduce:
  - **Bounded Contexts:** Which domain does this code belong to (e.g., "Billing", "User Management")?
  - **Transactional Boundaries:** Do these functions need to execute within a single atomic database transaction?
  - **Data Sensitivity:** Does this code handle PII (Personally Identifiable Information)?

## 2. Vector Embeddings (Pinecone)
- **Embedding Generation:** Convert codebase structural patterns (e.g., how the monolith handles user authentication) into vector embeddings using the LLM.
- **Similarity Search:** Query Pinecone against a pre-loaded dataset of open-source microservice patterns to find architectural matches.

## 3. Graph Enrichment (Neo4j)
- **Contextual Edges:** Update Neo4j with new semantic edges based on LLM outputs.
  - Example: `(:Function)-[:BELONGS_TO_CONTEXT {name: "Billing"}]->(:Domain)`
- **Risk Scoring:** Assign weights to edges. If two heavily coupled functions are flagged by the LLM as belonging to different domains, mark the edge as `RISK_LEVEL_HIGH`.

## 4. Asynchronous Queue (Redis/RabbitMQ)
- **Task Workers:** LLM calls take time and are prone to rate limits. Use `Celery` (Python) with Redis to queue code chunks for LLM processing asynchronously.
- **Progress Updates:** Stream progress back to the Node.js API Gateway via WebSockets or long polling.

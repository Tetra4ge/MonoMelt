# Phase 2: Ingestion & Static Analysis Pipeline

## Overview
Phase 2 focuses on getting the monolithic codebase into the system and extracting its raw, static structure before any AI intelligence is applied.

## 1. Monolith Upload Mechanism
- **API Gateway (Node.js):** 
  - Create a `POST /api/upload` endpoint using `multer` to accept `.zip` files.
  - Implement a mechanism to accept GitHub repository URLs and clone them into a temporary volume.
- **Storage:** Temporarily store the raw code in a secure, isolated directory or S3-compatible local bucket for analysis.

## 2. Static Parsing Engine (FastAPI)
- **AST Generation:** 
  - Use Python libraries (e.g., `ast` for Python, `esprima` for JS) to parse the uploaded source code.
  - Extract entities: Functions, Classes, Variables, and Database SQL models.
- **Dependency Extraction:** Map which functions call other functions, and which classes import other classes.

## 3. Graph Database Population (Neo4j)
- **Cypher Queries:** Write scripts to bulk-insert the extracted static entities into Neo4j.
  - `(:Function)-[:CALLS]->(:Function)`
  - `(:Class)-[:IMPORTS]->(:Class)`
  - `(:Function)-[:QUERIES]->(:DatabaseTable)`
- **Indexing:** Create indexes on Node IDs to ensure fast traversal during analysis.

## 4. Relational Storage (PostgreSQL)
- **Project State:** Create a `Project` record in PostgreSQL with metadata (upload time, tech stack detected, size of codebase).
- **Status Tracking:** Track the analysis status (e.g., "Parsing", "Graph Populated", "Completed") so the frontend can display a progress bar.

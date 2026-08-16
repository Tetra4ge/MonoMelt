# Workspace Instructions for AI Agents

> **ATTENTION AI AGENTS:** You are working on the "Legacy Monolith to Microservices Transformation Intelligence Platform". Before generating any code or creating new files, you MUST adhere to the following strict architectural rules for the three microservices in this repository. 

Failure to follow these rules will break the deployment pipeline and system architecture.

---

## 1. Frontend (`/frontend`)
**Tech Stack:** React, TypeScript, Vite, Tailwind CSS v4.

*   **`src/pages/`**: Main view components (e.g., `LandingPage.tsx`). Must act as aggregators with no heavy logic.
*   **`src/components/`**: Must be divided by feature or domain (e.g., `src/components/landing/`, `src/components/ui/`).
*   **Naming Conventions:** 
    *   React Components: **PascalCase** (e.g., `Hero.tsx`).
    *   Utility files/hooks: **camelCase** (e.g., `useNeo4jGraph.ts`).

---

## 2. API Gateway (`/api-gateway`)
**Tech Stack:** Node.js, Express.js.

This service uses a **flat directory structure** at its root. **Do not create a `src/` folder.**

*   **`server.js`**: Main entry point.
*   **`routes/`**, **`controllers/`**, **`services/`**, **`middlewares/`**, **`config/`**, **`utils/`**, **`docs/`**.
*   **Naming Conventions:** Files must strictly use the **`feature.type.js`** convention.
    *   *Examples:* `health.controller.js`, `analysis.routes.js`, `auth.middleware.js`, `ai.service.js`, `auth.docs.js`.
*   **Swagger Documentation:** All Swagger documentation for endpoints (using `swagger-jsdoc`) MUST be separated by feature and placed inside the `docs/` folder (e.g., `docs/auth.docs.js`, `docs/projects.docs.js`).

---

## 3. AI Analysis Service (`/ai-service`)
**Tech Stack:** Python, FastAPI, Pydantic.

This service follows a domain-driven structure. Do not mix database queries directly into API routes.

*   **`main.py`**: Uvicorn entry point.
*   **`api/routes/`**: Thin FastAPI routers (`@router.get(...)`).
*   **`core/`**: Configuration and security.
*   **`db/`**: Connection logic for databases (`neo4j_client.py`, `pg_client.py`, `pinecone_client.py`).
*   **`services/`**: Core business logic (AST parsing, decomposition algorithms).
*   **`llm/`**: Code specifically for interacting with LLMs (`gemini_client.py`, `prompts.py`). **CRITICAL RULE**: We are using OpenRouter as the primary LLM provider, with Google Gemini configured as the fallback. Do NOT implement or use direct OpenAI SDK keys; only use OpenRouter and Gemini API keys.
*   **`models/`**: `schemas.py` for Pydantic models, `domain.py` for internal classes.
*   **Naming Conventions:**
    *   Files and modules: **snake_case** (e.g., `ast_parser.py`).
    *   Classes and Pydantic Models: **PascalCase** (e.g., `CostProjectionResponse`).
    *   Constants (prompts): **UPPER_SNAKE_CASE**.

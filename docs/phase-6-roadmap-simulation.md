# Phase 6: Roadmap, Team Mapping & Simulation

## Overview
Phase 6 prepares the organization for the migration, ensuring teams are aligned and system performance won't degrade after the split.

## 1. Team & Ownership Mapping
- **Input Data:** Allow users to input their current team structure (e.g., Team A handles Frontend, Team B handles Payments).
- **Mapping Algorithm:** Assign proposed microservices to teams based on domain alignment. Flag bottlenecks where one team is responsible for too many critical path services.

## 2. Migration Roadmap Generator
- **Phasing Logic:** 
  - **Phase 1 (Easy Wins):** Extract peripheral services with 0 or 1 inward dependencies (leaf nodes in the graph).
  - **Phase 2 (Medium):** Extract services requiring simple API contracts.
  - **Phase 3 (Hard):** Extract tightly coupled database monolith elements using the Strangler Fig pattern.
- **Output:** Generate a Markdown or PDF roadmap document.

## 3. Performance Impact Simulator
- **Latency Calculation:** 
  - Base Monolith in-process call: ~0.5ms.
  - Microservice network call: ~20ms.
- **Workflow Simulation:** Trace a common user workflow (e.g., "Checkout") through the proposed graph. If it hits 4 services sequentially, add 80ms to the latency budget.
- **Optimization Suggestions:** Suggest Redis caching or asynchronous messaging (RabbitMQ/Kafka) for workflows exceeding the latency budget.

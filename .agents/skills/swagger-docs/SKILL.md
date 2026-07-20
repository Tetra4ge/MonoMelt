---
name: Enforce Swagger Documentation
description: Ensures that Swagger API documentation is always kept in sync when controllers or routes are modified.
---

# Swagger Documentation Maintenance

Whenever you add, remove, or modify an API endpoint, controller, or route in the `api-gateway` service, you **MUST** ensure that the corresponding Swagger documentation is perfectly updated to reflect the changes.

## Guidelines:
- Swagger annotations are stored in the `api-gateway/docs/*.docs.js` files.
- If you create a new endpoint, you must find the corresponding `.docs.js` file (or create one) and write the `@swagger` OpenAPI 3.0 annotations for it.
- If you modify an endpoint's parameters, request body, or response shape, you must update the documentation immediately to match.
- If you remove an endpoint, you must delete its corresponding swagger documentation block.
- Always ensure that the Swagger UI remains perfect and accurate. Never skip this step when dealing with API modifications.

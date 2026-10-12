/**
 * AI Service Proxy
 * ================
 * Handles all HTTP communication from the API Gateway to the AI Analysis Service.
 * Centralises base URL config, timeout, and error handling.
 */

const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL
  || (process.env.NODE_ENV === 'production'
      ? process.env.AI_SERVICE_PRO_URL
      : (process.env.AI_SERVICE_DEV_URL || 'http://localhost:8000'));
const TIMEOUT_MS = 30_000; // 30s — analysis can be slow

// Shared secret checked by the AI service (core/security.py). Optional in local dev.
const internalHeaders = process.env.INTERNAL_API_KEY ? { 'X-Internal-Key': process.env.INTERNAL_API_KEY } : {};

const client = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json', ...internalHeaders },
});

/**
 * Proxy a request to the AI service.
 * @param {'GET'|'POST'|'PUT'|'DELETE'} method
 * @param {string} path - e.g. '/analysis/trigger'
 * @param {object|null} body - request body (for POST/PUT)
 * @param {object} queryParams - URL query parameters
 * @returns {Promise<object>} parsed JSON response
 */
const proxyToAiService = async (method, path, body = null, queryParams = {}, options = {}) => {
  // Remove undefined/null query params
  const params = Object.fromEntries(
    Object.entries(queryParams).filter(([_, v]) => v !== null && v !== undefined)
  );

  try {
    const response = await client.request({
      method,
      url: path,
      params,
      data: body,
      ...(options.timeout ? { timeout: options.timeout } : {}),
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      // The AI service returned an error response
      const { status, data } = error.response;
      const err = new Error(data?.detail || data?.message || 'AI service error');
      err.statusCode = status;
      err.expose = status === 409 || status === 503;
      throw err;
    }
    // Network error or timeout
    const err = new Error(`AI service unreachable: ${error.message}`);
    err.statusCode = 503;
    throw err;
  }
};

module.exports = { proxyToAiService, internalHeaders };

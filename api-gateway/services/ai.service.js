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

const client = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Proxy a request to the AI service.
 * @param {'GET'|'POST'|'PUT'|'DELETE'} method
 * @param {string} path - e.g. '/analysis/trigger'
 * @param {object|null} body - request body (for POST/PUT)
 * @param {object} queryParams - URL query parameters
 * @returns {Promise<object>} parsed JSON response
 */
const proxyToAiService = async (method, path, body = null, queryParams = {}) => {
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

module.exports = { proxyToAiService };

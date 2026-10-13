/**
 * Exponential Backoff Retry Utility
 *
 * Wraps an async function with retry logic for transient HTTP failures.
 * Retries only on specified status codes (default: 429 Too Many Requests).
 * Uses exponential delay with jitter to avoid thundering-herd problems.
 *
 * Usage:
 *   const response = await retryWithBackoff(
 *     () => axios.post(url, payload),
 *     { maxRetries: 3, baseDelayMs: 500, retryOn: [429] }
 *   );
 */

/**
 * @param {() => Promise<any>} fn         - The async function to execute (typically an axios call).
 * @param {object}            [options]
 * @param {number}            [options.maxRetries=3]    - Maximum number of retry attempts.
 * @param {number}            [options.baseDelayMs=500] - Base delay in milliseconds.
 * @param {number[]}          [options.retryOn=[429]]   - HTTP status codes that trigger a retry.
 * @returns {Promise<any>}    The resolved value of `fn`.
 * @throws The last error if all retries are exhausted.
 */
const retryWithBackoff = async (fn, options = {}) => {
  const {
    maxRetries  = 3,
    baseDelayMs = 500,
    retryOn     = [429],
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const status = err?.response?.status;
      const isRetryable = status && retryOn.includes(status);

      // If it's the final attempt or not a retryable status, give up.
      if (attempt >= maxRetries || !isRetryable) {
        throw err;
      }

      // Exponential delay with jitter: baseDelay * 2^attempt + random(0..baseDelay)
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * baseDelayMs);
      const delay = exponentialDelay + jitter;

      console.log(
        `[retry.util] Attempt ${attempt + 1}/${maxRetries} failed with status ${status}. ` +
        `Retrying in ${delay}ms...`
      );

      await sleep(delay);
    }
  }

  // Fallback (should not reach here, but TypeScript-style safety)
  throw lastError;
};

/**
 * Async sleep helper.
 * @param {number} ms - Milliseconds to wait.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = { retryWithBackoff };

/**
 * Telemetry and Error Monitoring Abstractions
 * 
 * This module provides a unified interface for tracking product metrics and logging errors.
 * In a production environment, these functions would be wired up to services like 
 * Sentry, PostHog, DataDog, etc.
 */

// Define standard event types for Phase 8 product metrics
export type TelemetryEvent = 
  | 'project_created'
  | 'source_uploaded'
  | 'analysis_started'
  | 'analysis_completed'
  | 'analysis_failed'
  | 'scenario_selected'
  | 'blueprint_exported'
  | 'page_viewed';

interface TelemetryConfig {
  enabled: boolean;
  environment: 'development' | 'staging' | 'production';
}

const config: TelemetryConfig = {
  enabled: process.env.NODE_ENV !== 'test',
  environment: (import.meta.env.MODE as 'development' | 'staging' | 'production') || 'development',
};

/**
 * Tracks a product metric or user action.
 */
export const trackEvent = (eventName: TelemetryEvent, properties?: Record<string, any>) => {
  if (!config.enabled) return;

  // Placeholder for real telemetry provider (e.g. PostHog)
  console.log(`[Telemetry - ${config.environment}] Event: ${eventName}`, properties);
};

/**
 * Logs a client-side error to a monitoring service.
 */
export const logError = (error: Error, context?: Record<string, any>) => {
  if (!config.enabled) return;

  // Placeholder for real error monitoring provider (e.g. Sentry)
  console.error(`[Error Monitoring - ${config.environment}] Caught Exception:`, error.message, context);
  // Example: Sentry.captureException(error, { extra: context });
};

/**
 * Initializes the telemetry providers (should be called at app startup).
 */
export const initializeTelemetry = () => {
  if (!config.enabled) return;
  console.log(`[Telemetry] Initialized for environment: ${config.environment}`);
};

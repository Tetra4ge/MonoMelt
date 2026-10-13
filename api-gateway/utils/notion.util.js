/**
 * Notion MCP Block Translator
 *
 * Converts the Phase 2 FinalReport JSON payload into Notion MCP-compatible
 * block structures.  Every section is defensively guarded so that a partial
 * or malformed report payload never crashes the translator.
 *
 * Payload shape (from ai-service/models/reports.py → FinalReport):
 *   project_id            : string
 *   executive_summary     : { total_services_extracted, overall_risk_score,
 *                             estimated_timeline_months, business_impact }
 *   decomposition_strategy: [ { service_name, rationale, dependencies[], team_allocation } ]
 *   cost_analysis?        : { current_monolith_cost_monthly, projected_microservices_cost_monthly,
 *                             infrastructure_multiplier, breakdown }
 *   risk_assessment?      : { critical_paths[], data_consistency_flags[], mitigation_strategies[] }
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Translates the MonoMelt JSON Report into Notion MCP Block structures.
 *
 * @param {object} reportData - The `payload` column from `project_reports`.
 * @param {string} projectId  - The project UUID (used for the deep-link).
 * @returns {{ title: string, blocks: object[] }}
 */
const buildNotionPayload = (reportData, projectId) => {
  const blocks = [];

  // ── 1. Title & Executive Summary ──────────────────────────────────────
  blocks.push({
    type: 'heading_1',
    text: 'Monolith Transformation Report',
  });

  const summary = reportData?.executive_summary;

  if (summary?.business_impact) {
    blocks.push({
      type: 'paragraph',
      text: summary.business_impact,
    });
  }

  // ── 2. High-Level Metrics (Callout Block) ─────────────────────────────
  if (summary) {
    const totalServices = summary.total_services_extracted ?? '—';
    const riskScore     = summary.overall_risk_score ?? '—';
    const timeline      = summary.estimated_timeline_months ?? '—';

    blocks.push({
      type: 'callout',
      text: `Total Services: ${totalServices} | Risk: ${riskScore} | Timeline: ${timeline} months`,
      icon: '📊',
    });
  }

  // ── 3. Decomposition Strategy (Bulleted List) ─────────────────────────
  const services = reportData?.decomposition_strategy || [];

  if (services.length > 0) {
    blocks.push({
      type: 'heading_2',
      text: 'Proposed Microservices',
    });

    services.forEach((service) => {
      const name   = service.service_name || 'Unnamed';
      const team   = service.team_allocation ?? '—';
      const reason = service.rationale || 'No rationale provided.';
      const deps   = (service.dependencies || []).join(', ') || 'None';

      blocks.push({
        type: 'bulleted_list_item',
        text: `**${name}** (Team Size: ${team})\nRationale: ${reason}\nDependencies: ${deps}`,
      });
    });
  }

  // ── 4. Financial Projections (Table Block) ────────────────────────────
  const cost = reportData?.cost_analysis;

  if (cost) {
    blocks.push({
      type: 'heading_2',
      text: 'Financial Projections (Monthly)',
    });

    const rows = [
      ['Current Monolith',   `$${formatCurrency(cost.current_monolith_cost_monthly)}`],
      ['Target Microservices', `$${formatCurrency(cost.projected_microservices_cost_monthly)}`],
      ['Infra Multiplier',   `${cost.infrastructure_multiplier ?? '—'}x`],
    ];

    // Include breakdown ranges if present
    if (cost.breakdown) {
      const minCost = cost.breakdown.cost_range_min_usd;
      const maxCost = cost.breakdown.cost_range_max_usd;
      if (minCost != null && maxCost != null) {
        rows.push(['Cost Range', `$${formatCurrency(minCost)} – $${formatCurrency(maxCost)}`]);
      }
      const latency = cost.breakdown.avg_latency_increase_ms;
      if (latency != null) {
        rows.push(['Avg Latency Increase', `${latency}ms`]);
      }
    }

    blocks.push({
      type: 'table',
      headers: ['Metric', 'Value'],
      rows,
    });
  }

  // ── 5. Risk Assessment ────────────────────────────────────────────────
  const risk = reportData?.risk_assessment;

  if (risk) {
    blocks.push({
      type: 'heading_2',
      text: 'Risk Assessment',
    });

    // Critical paths
    if (risk.critical_paths?.length) {
      blocks.push({
        type: 'paragraph',
        text: '**Critical Paths:**',
      });
      risk.critical_paths.forEach((path) => {
        blocks.push({ type: 'bulleted_list_item', text: path });
      });
    }

    // Data consistency flags
    if (risk.data_consistency_flags?.length) {
      blocks.push({
        type: 'paragraph',
        text: '**Data Consistency Flags:**',
      });
      risk.data_consistency_flags.forEach((flag) => {
        blocks.push({ type: 'bulleted_list_item', text: flag });
      });
    }

    // Mitigation strategies
    if (risk.mitigation_strategies?.length) {
      blocks.push({
        type: 'paragraph',
        text: '**Mitigation Strategies:**',
      });
      risk.mitigation_strategies.forEach((strategy) => {
        blocks.push({ type: 'bulleted_list_item', text: strategy });
      });
    }
  }

  // ── 6. Deep Link to Interactive Graph ─────────────────────────────────
  const pid = projectId || reportData?.project_id || 'unknown';

  blocks.push({
    type: 'callout',
    text: `View the interactive Neo4j dependency graph: ${FRONTEND_URL}/dashboard/projects/${pid}/analysis`,
    icon: '🔗',
  });

  return {
    title: `MonoMelt Report: ${pid}`,
    blocks,
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Formats a numeric value as a currency string (no symbol, comma-separated).
 * Returns '—' for null/undefined/NaN inputs.
 */
function formatCurrency(value) {
  if (value == null || isNaN(value)) return '—';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

module.exports = { buildNotionPayload };

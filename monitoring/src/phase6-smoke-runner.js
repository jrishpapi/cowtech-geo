import {
  PHASE6_SMOKE_CONTRACT_VERSION,
  PHASE6_SURFACES
} from './phase6-smoke-contract.js';
import { pool as defaultPool } from './db.js';

export async function readPhase6ExecutionGate(pool = defaultPool) {
  const result = await pool.query(`SELECT * FROM phase6_feature_flags WHERE scope_key='global'`);
  const flags = result.rows[0];
  if (!flags) return Object.freeze({ allowed: false, reason: 'phase6_feature_flags_missing' });
  const allowed =
    flags.smoke_contract_enabled === true &&
    flags.live_execution_enabled === true &&
    flags.evidence_required === true &&
    flags.reconciliation_required === true &&
    flags.paid_transport_enabled === true &&
    flags.external_spend_enabled === true &&
    flags.contract_version === PHASE6_SMOKE_CONTRACT_VERSION &&
    Number(flags.approved_budget_micro_usd) > 0;
  return Object.freeze({
    allowed,
    reason: allowed ? 'armed' : 'phase6_database_gates_disabled',
    flags: Object.freeze({ ...flags })
  });
}

export class Phase6SmokeRunner {
  constructor({ gateReader, runners = {}, resultSink, permitIssuer = null } = {}) {
    if (typeof gateReader !== 'function') throw new TypeError('gateReader is required');
    if (typeof resultSink !== 'function') throw new TypeError('resultSink is required');
    if (permitIssuer && (typeof permitIssuer.issue !== 'function' || typeof permitIssuer.finalize !== 'function')) {
      throw new TypeError('permitIssuer must implement issue and finalize');
    }
    this.gateReader = gateReader;
    this.runners = runners;
    this.resultSink = resultSink;
    this.permitIssuer = permitIssuer;
    this.usedPermitIds = new Set();
  }

  async run({ manifest, preflight, budgetPermits = {}, signal } = {}) {
    if (preflight?.status !== 'ready') throw new Error('Phase 6 live preflight is not ready');
    const gate = await this.gateReader();
    if (gate?.allowed !== true) throw new Error(`Phase 6 database gate is disabled: ${gate?.reason || 'unknown'}`);
    const results = [];
    for (const item of manifest?.items || []) {
      if (signal?.aborted) throw new Error('Phase 6 smoke aborted');
      if (!PHASE6_SURFACES[item.surface]) throw new TypeError('manifest contains an unsupported surface');
      const budgetPermit = budgetPermits[item.item_key] ||
        await this.permitIssuer?.issue({ item, gate, preflight, signal });
      if (
        !budgetPermit?.permit_id ||
        budgetPermit.consumed === true ||
        this.usedPermitIds.has(budgetPermit.permit_id)
      ) {
        throw new Error(`a fresh per-attempt budget permit is required for ${item.item_key}`);
      }
      const runner = this.runners[item.surface];
      if (!runner || typeof runner.run !== 'function') throw new TypeError(`runner missing for ${item.surface}`);
      this.usedPermitIds.add(budgetPermit.permit_id);
      const result = await runner.run({ ...item, budgetPermit, signal });
      let sinkError = null;
      try {
        await this.resultSink({ item, result });
      } catch (error) {
        sinkError = error;
      }
      if (Object.isExtensible(budgetPermit)) budgetPermit.consumed = true;
      if (this.permitIssuer) {
        await this.permitIssuer.finalize({ item, permit: budgetPermit, result, gate, preflight, signal });
      }
      if (sinkError) throw sinkError;
      results.push(result);
    }
    return Object.freeze({ status: 'completed', result_count: results.length, results: Object.freeze(results) });
  }
}

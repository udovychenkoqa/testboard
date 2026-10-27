/**
 * Adapted from upstream playwright-reports-server v6's LLM circuit breaker
 * (apps/backend/src/lib/llm/circuitBreaker.ts) — same state machine, ported
 * near-verbatim since it's already self-contained (in-memory, no DB/queue).
 * Trimmed the multi-provider status-reporting surface we don't expose in UI.
 *
 * Without this, a dead/misconfigured API key means EVERY report generation
 * independently pays the full retry backoff (1s+3s+8s) before giving up —
 * the breaker trips after repeated failures so subsequent reports fail fast
 * instead of each burning ~12s for a guaranteed-identical outcome.
 */
const FAILURE_THRESHOLD = 5;
const OPEN_COOLDOWN_MS = 60 * 1000;
const RATE_LIMIT_DEFAULT_COOLDOWN_MS = 60 * 1000;

type CircuitState = 'closed' | 'open' | 'half-open';
type CircuitReason = 'failures' | 'rate_limit';

export class LLMCircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private openedAt = 0;
  private cooldownMs = OPEN_COOLDOWN_MS;
  private reason: CircuitReason = 'failures';

  constructor(private readonly label: string) {}

  /** Call before attempting a request. False means: don't even try. */
  shouldAttempt(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'half-open') {
      return false;
    }

    // open: transition to half-open (single probe attempt) once cooldown elapsed.
    if (Date.now() - this.openedAt >= this.cooldownMs) {
      this.state = 'half-open';

      return true;
    }

    return false;
  }

  msUntilRetry(): number {
    if (this.state !== 'open') {
      return 0;
    }

    return Math.max(0, this.cooldownMs - (Date.now() - this.openedAt));
  }

  onSuccess(): void {
    this.consecutiveFailures = 0;

    if (this.state !== 'closed') {
      console.log(`[ai-summary] circuit breaker closed for ${this.label} after successful call`);
    }

    this.state = 'closed';
  }

  /**
   * @param isRateLimit honor a 429's Retry-After when known; otherwise a
   * generic transient transport failure (network/timeout/5xx) counts toward
   * the consecutive-failure threshold. Non-retryable errors (bad key, 4xx)
   * intentionally don't trip the breaker — those fail loudly every time by
   * design so a misconfigured key stays visible in logs, not masked as "circuit open".
   */
  onFailure(isRateLimit: boolean, retryAfterMs?: number): void {
    if (isRateLimit) {
      this.trip(Math.max(1000, retryAfterMs ?? RATE_LIMIT_DEFAULT_COOLDOWN_MS), 'rate_limit');

      return;
    }

    this.consecutiveFailures += 1;

    if (this.state === 'half-open') {
      this.trip(OPEN_COOLDOWN_MS, 'failures');

      return;
    }

    if (this.consecutiveFailures >= FAILURE_THRESHOLD) {
      this.trip(OPEN_COOLDOWN_MS, 'failures');
    }
  }

  private trip(cooldownMs: number, reason: CircuitReason): void {
    if (this.state !== 'open') {
      const why = reason === 'rate_limit' ? 'rate limited' : `${this.consecutiveFailures} consecutive failures`;

      console.warn(`[ai-summary] circuit breaker opened for ${this.label} (${why}); cooling down for ${cooldownMs}ms`);
    }

    this.state = 'open';
    this.openedAt = Date.now();
    this.cooldownMs = cooldownMs;
    this.reason = reason;
  }
}

const breakers = new Map<string, LLMCircuitBreaker>();

export function circuitFor(modelId: string): LLMCircuitBreaker {
  let breaker = breakers.get(modelId);

  if (!breaker) {
    breaker = new LLMCircuitBreaker(modelId);
    breakers.set(modelId, breaker);
  }

  return breaker;
}

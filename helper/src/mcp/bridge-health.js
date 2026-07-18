/**
 * Bridge Health Monitor
 * Monitors the health of the Project Synapse bridge process
 */

import { EventEmitter } from 'events';

export class BridgeHealthMonitor extends EventEmitter {
  #bridgeProcess;
  #healthCheckInterval;
  #lastHealthCheck = null;
  #consecutiveFailures = 0;
  #maxFailures;
  #checkInterval;
  #isMonitoring = false;
  #bridge;

  constructor(bridge, options = {}) {
    super();
    this.#bridge = bridge;
    this.#maxFailures = options.maxFailures || 3;
    this.#checkInterval = options.checkIntervalMs || 10000;
  }

  start() {
    if (this.#isMonitoring) {
      return;
    }

    this.#isMonitoring = true;
    this.#performHealthCheck();
    
    this.#healthCheckInterval = setInterval(() => {
      this.#performHealthCheck();
    }, this.#checkInterval);

    this.emit('monitoring_started');
  }

  stop() {
    if (!this.#isMonitoring) {
      return;
    }

    this.#isMonitoring = false;
    
    if (this.#healthCheckInterval) {
      clearInterval(this.#healthCheckInterval);
      this.#healthCheckInterval = null;
    }

    this.emit('monitoring_stopped');
  }

  async #performHealthCheck() {
    try {
      // Check if bridge process is still alive
      if (this.#bridge && this.#bridge.process) {
        if (this.#bridge.process.killed || this.#bridge.process.exitCode !== null) {
          throw new Error(`Bridge process exited with code ${this.#bridge.process.exitCode}`);
        }
      }

      // Check if bridge is responsive via health check
      const isHealthy = await this.#bridge.healthCheck?.() ?? true;
      
      if (isHealthy) {
        this.#consecutiveFailures = 0;
        this.#lastHealthCheck = new Date();
        this.emit('healthy', { timestamp: this.#lastHealthCheck });
      } else {
        this.#handleFailure('Health check returned false');
      }
    } catch (error) {
      this.#handleFailure(error.message);
    }
  }

  #handleFailure(reason) {
    this.#consecutiveFailures++;
    this.emit('unhealthy', { 
      reason, 
      consecutiveFailures: this.#consecutiveFailures,
      maxFailures: this.#maxFailures 
    });

    if (this.#consecutiveFailures >= this.#maxFailures) {
      this.emit('critical_failure', { 
        reason,
        consecutiveFailures: this.#consecutiveFailures 
      });
    }
  }

  getStatus() {
    return {
      isMonitoring: this.#isMonitoring,
      lastHealthCheck: this.#lastHealthCheck,
      consecutiveFailures: this.#consecutiveFailures,
      maxFailures: this.#maxFailures,
      isHealthy: this.#consecutiveFailures === 0,
    };
  }

  resetFailureCount() {
    this.#consecutiveFailures = 0;
  }
}

export function createBridgeHealthMonitor(bridge, options) {
  return new BridgeHealthMonitor(bridge, options);
}
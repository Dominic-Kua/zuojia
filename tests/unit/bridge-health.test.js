import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBridgeHealthMonitor } from '../../helper/src/mcp/bridge-health.js';

describe('BridgeHealthMonitor', () => {
  let mockBridge;
  let monitor;

  beforeEach(() => {
    mockBridge = {
      process: {
        killed: false,
        exitCode: null,
      },
      healthCheck: vi.fn().mockResolvedValue(true),
    };
    
    monitor = createBridgeHealthMonitor(mockBridge, {
      maxFailures: 3,
      checkIntervalMs: 100,
    });
  });

  afterEach(() => {
    monitor.stop();
    vi.clearAllMocks();
  });

  it('should create monitor instance', () => {
    expect(monitor).toBeDefined();
    expect(typeof monitor.start).toBe('function');
    expect(typeof monitor.stop).toBe('function');
    expect(typeof monitor.getStatus).toBe('function');
  });

  it('should start and stop monitoring', () => {
    const startedHandler = vi.fn();
    const stoppedHandler = vi.fn();
    
    monitor.on('monitoring_started', startedHandler);
    monitor.on('monitoring_stopped', stoppedHandler);
    
    monitor.start();
    expect(startedHandler).toHaveBeenCalled();
    
    monitor.stop();
    expect(stoppedHandler).toHaveBeenCalled();
  });

  it('should emit healthy event on successful health check', async () => {
    const healthyHandler = vi.fn();
    monitor.on('healthy', healthyHandler);
    
    mockBridge.healthCheck.mockResolvedValue(true);
    
    monitor.start();
    
    // Wait for first health check
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(healthyHandler).toHaveBeenCalled();
    expect(healthyHandler.mock.calls[0][0]).toHaveProperty('timestamp');
  });

  it('should track consecutive failures', async () => {
    const unhealthyHandler = vi.fn();
    const criticalHandler = vi.fn();
    
    monitor.on('unhealthy', unhealthyHandler);
    monitor.on('critical_failure', criticalHandler);
    
    mockBridge.healthCheck.mockResolvedValue(false);
    
    monitor.start();
    
    // Wait for multiple health checks (3 failures to trigger critical, plus potential extra)
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Should have at least 3 unhealthy calls, and critical should be called
    expect(unhealthyHandler).toHaveBeenCalledTimes(4); // 4 checks in 400ms
    expect(criticalHandler).toHaveBeenCalled();
  });

  it('should reset failure count on successful check', async () => {
    const unhealthyHandler = vi.fn();
    monitor.on('unhealthy', unhealthyHandler);
    
    // First fail
    mockBridge.healthCheck.mockResolvedValueOnce(false);
    
    monitor.start();
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Then succeed
    mockBridge.healthCheck.mockResolvedValueOnce(true);
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Failure count should reset
    const status = monitor.getStatus();
    expect(status.consecutiveFailures).toBe(0);
  });

  it('should report process exit as failure', async () => {
    const unhealthyHandler = vi.fn();
    monitor.on('unhealthy', unhealthyHandler);
    
    mockBridge.process.killed = true;
    mockBridge.process.exitCode = 1;
    
    monitor.start();
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(unhealthyHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: expect.stringContaining('exited with code 1'),
      })
    );
  });

  it('should return correct status', () => {
    const status = monitor.getStatus();
    
    expect(status).toHaveProperty('isMonitoring');
    expect(status).toHaveProperty('consecutiveFailures');
    expect(status).toHaveProperty('maxFailures');
    expect(status).toHaveProperty('isHealthy');
  });

  it('should clean up interval on stop', () => {
    monitor.start();
    
    // Should be able to stop without errors
    expect(() => monitor.stop()).not.toThrow();
  });
});
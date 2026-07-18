import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpClient } from '../../helper/src/mcp/mcp-client.js';

describe('McpClient', () => {
  let mockTransport;
  let client;
  let sentRequests = [];

  beforeEach(() => {
    sentRequests = [];
    mockTransport = {
      on: vi.fn((event, handler) => {
        mockTransport[`_handler_${event}`] = handler;
      }),
      sendRequest: vi.fn((method, params, id) => {
        sentRequests.push({ method, params, id, timestamp: Date.now() });
      }),
      sendNotification: vi.fn(),
      destroy: vi.fn(),
      // Helper to simulate receiving a message
      _simulateMessage: (message) => {
        if (mockTransport._handler_message) {
          mockTransport._handler_message(message);
        }
      },
      // Helper to respond to the most recent pending request
      _respondToLastRequest: (result, error) => {
        const lastRequest = sentRequests[sentRequests.length - 1];
        if (lastRequest) {
          mockTransport._simulateMessage({
            jsonrpc: '2.0',
            id: lastRequest.id,
            result,
            error,
          });
        }
      },
      // Wait for a request to be sent
      _waitForRequest: async (method, timeout = 1000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          const req = sentRequests.find(r => r.method === method);
          if (req) return req;
          await new Promise(r => setTimeout(r, 10));
        }
        throw new Error(`Timeout waiting for ${method} request`);
      },
    };
    
    client = new McpClient({
      transport: mockTransport,
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });
  });

  afterEach(() => {
    client.destroy();
    vi.clearAllMocks();
  });

  it('should create client instance', () => {
    expect(client).toBeInstanceOf(McpClient);
    expect(client.initialized).toBe(false);
  });

  it('should initialize and send initialize request', async () => {
    const initResponse = {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'test-server', version: '1.0.0' },
    };

    const toolsResponse = {
      tools: [
        { name: 'tool1', description: 'Test tool 1', inputSchema: { type: 'object', properties: {} } },
        { name: 'tool2', description: 'Test tool 2', inputSchema: { type: 'object', properties: {} } },
      ],
    };

    const initPromise = client.initialize();
    
    // Wait for initialize request to be sent, then respond
    await mockTransport._waitForRequest('initialize');
    mockTransport._respondToLastRequest(initResponse);
    
    // Simulate server sending initialized notification
    mockTransport._simulateMessage({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });

    // Wait for tools/list request, then respond
    await mockTransport._waitForRequest('tools/list');
    mockTransport._respondToLastRequest(toolsResponse);

    await initPromise;
    
    expect(client.initialized).toBe(true);
    expect(mockTransport.sendNotification).toHaveBeenCalledWith('notifications/initialized', {});
    expect(client.getTools()).toHaveLength(2);
    expect(client.hasTool('tool1')).toBe(true);
    expect(client.hasTool('tool2')).toBe(true);
  });

  it('should fetch tools after initialization', async () => {
    const toolsResponse = {
      tools: [
        { name: 'wiki_list_pages', description: 'List pages', inputSchema: { type: 'object', properties: {} } },
        { name: 'wiki_search', description: 'Search pages', inputSchema: { type: 'object', properties: {} } },
      ],
    };

    const initPromise = client.initialize();
    
    await mockTransport._waitForRequest('initialize');
    mockTransport._respondToLastRequest({
      protocolVersion: '2024-11-05',
      capabilities: {},
      serverInfo: { name: 'test', version: '1.0' },
    });
    mockTransport._simulateMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
    
    await mockTransport._waitForRequest('tools/list');
    mockTransport._respondToLastRequest(toolsResponse);

    await initPromise;
    
    expect(client.getTools()).toHaveLength(2);
    expect(client.hasTool('wiki_list_pages')).toBe(true);
    expect(client.hasTool('wiki_search')).toBe(true);
    expect(client.hasTool('nonexistent')).toBe(false);
  });

  it('should call tool successfully', async () => {
    const toolResponse = { content: [{ type: 'text', text: 'Tool result' }], isError: false };

    const initPromise = client.initialize();
    
    await mockTransport._waitForRequest('initialize');
    mockTransport._respondToLastRequest({
      protocolVersion: '2024-11-05',
      capabilities: {},
      serverInfo: { name: 'test', version: '1.0' },
    });
    mockTransport._simulateMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
    
    await mockTransport._waitForRequest('tools/list');
    mockTransport._respondToLastRequest({
      tools: [{ name: 'wiki_search', description: 'Search', inputSchema: { type: 'object', properties: {} } }],
    });

    await initPromise;
    
    const callPromise = client.callTool('wiki_search', { query: 'test', limit: 10 });
    
    await mockTransport._waitForRequest('tools/call');
    mockTransport._respondToLastRequest(toolResponse);

    const result = await callPromise;
    
    expect(result.content).toEqual([{ type: 'text', text: 'Tool result' }]);
    expect(mockTransport.sendRequest).toHaveBeenCalledWith(
      'tools/call',
      { name: 'wiki_search', arguments: { query: 'test', limit: 10 } },
      expect.any(Number)
    );
  });

  it('should throw error for unknown tool', async () => {
    const initPromise = client.initialize();
    
    await mockTransport._waitForRequest('initialize');
    mockTransport._respondToLastRequest({
      protocolVersion: '2024-11-05',
      capabilities: {},
      serverInfo: { name: 'test', version: '1.0' },
    });
    mockTransport._simulateMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
    
    await mockTransport._waitForRequest('tools/list');
    mockTransport._respondToLastRequest({ tools: [] });

    await initPromise;

    await expect(client.callTool('unknown_tool', {})).rejects.toThrow('Tool not found: unknown_tool');
  });

  it('should throw error if not initialized', async () => {
    await expect(client.callTool('tool', {})).rejects.toThrow('Client not initialized');
  });

  it('should handle tool call error response', async () => {
    const initPromise = client.initialize();
    
    await mockTransport._waitForRequest('initialize');
    mockTransport._respondToLastRequest({
      protocolVersion: '2024-11-05',
      capabilities: {},
      serverInfo: { name: 'test', version: '1.0' },
    });
    mockTransport._simulateMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
    
    await mockTransport._waitForRequest('tools/list');
    mockTransport._respondToLastRequest({
      tools: [{ name: 'test_tool', description: 'Test', inputSchema: { type: 'object', properties: {} } }],
    });

    await initPromise;
    
    const callPromise = client.callTool('test_tool', {});
    
    await mockTransport._waitForRequest('tools/call');
    mockTransport._respondToLastRequest(null, { code: -32603, message: 'Internal error' });
    
    await expect(callPromise).rejects.toThrow('Internal error');
  });

  it('should handle timeout on request', async () => {
    const initPromise = client.initialize();
    
    await mockTransport._waitForRequest('initialize');
    mockTransport._respondToLastRequest({
      protocolVersion: '2024-11-05',
      capabilities: {},
      serverInfo: { name: 'test', version: '1.0' },
    });
    mockTransport._simulateMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
    
    await mockTransport._waitForRequest('tools/list');
    mockTransport._respondToLastRequest({
      tools: [{ name: 'slow_tool', description: 'Slow', inputSchema: { type: 'object', properties: {} } }],
    });

    await initPromise;
    
    const promise = client.callTool('slow_tool', {}, 100); // 100ms timeout
    
    // Don't respond - let it timeout
    await expect(promise).rejects.toThrow();
  });

  it('should emit log notification', async () => {
    const logHandler = vi.fn();
    client.on('log', logHandler);

    const initPromise = client.initialize();
    
    await mockTransport._waitForRequest('initialize');
    mockTransport._respondToLastRequest({
      protocolVersion: '2024-11-05',
      capabilities: {},
      serverInfo: { name: 'test', version: '1.0' },
    });
    mockTransport._simulateMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
    
    await mockTransport._waitForRequest('tools/list');
    mockTransport._respondToLastRequest({ tools: [] });

    await initPromise;

    // Simulate log notification from server
    mockTransport._simulateMessage({
      jsonrpc: '2.0',
      method: 'notifications/log',
      params: { level: 'info', message: 'Test log' },
    });

    expect(logHandler).toHaveBeenCalledWith({ level: 'info', message: 'Test log' });
  });

  it('should handle tools/list_changed notification', async () => {
    const toolsChangedHandler = vi.fn();
    client.on('toolsListChanged', toolsChangedHandler);

    const initPromise = client.initialize();
    
    await mockTransport._waitForRequest('initialize');
    mockTransport._respondToLastRequest({
      protocolVersion: '2024-11-05',
      capabilities: {},
      serverInfo: { name: 'test', version: '1.0' },
    });
    mockTransport._simulateMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
    
    await mockTransport._waitForRequest('tools/list');
    mockTransport._respondToLastRequest({
      tools: [{ name: 'tool1', description: 'Tool 1', inputSchema: { type: 'object', properties: {} } }],
    });

    await initPromise;

    // Simulate tools/list_changed notification
    mockTransport._simulateMessage({
      jsonrpc: '2.0',
      method: 'notifications/tools/list_changed',
    });

    // Should attempt to re-fetch tools - wait for the re-fetch
    await mockTransport._waitForRequest('tools/list', 2000);
    mockTransport._respondToLastRequest({ tools: [] });

    // Wait for the fetch to complete
    await new Promise(r => setTimeout(r, 50));

    expect(mockTransport.sendRequest).toHaveBeenCalledTimes(3); // init + tools/list + tools/list again
    expect(toolsChangedHandler).toHaveBeenCalled();
  });

  it('should shutdown gracefully', async () => {
    const initPromise = client.initialize();
    
    await mockTransport._waitForRequest('initialize');
    mockTransport._respondToLastRequest({
      protocolVersion: '2024-11-05',
      capabilities: {},
      serverInfo: { name: 'test', version: '1.0' },
    });
    mockTransport._simulateMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
    
    await mockTransport._waitForRequest('tools/list');
    mockTransport._respondToLastRequest({ tools: [] });

    await initPromise;
    
    // Start shutdown
    const shutdownPromise = client.shutdown();
    
    // Wait for shutdown request to be sent
    await mockTransport._waitForRequest('shutdown', 2000);
    mockTransport._respondToLastRequest({});
    
await shutdownPromise;
    
    // Check that shutdown was called (3rd call)
    const calls = mockTransport.sendRequest.mock.calls;
    expect(calls.some(c => c[0] === 'shutdown')).toBe(true);
    // Check the last call was shutdown
    expect(calls[calls.length - 1][0]).toBe('shutdown');
    expect(mockTransport.sendNotification).toHaveBeenCalledWith('exit', {});
    expect(client.initialized).toBe(false);
  });

  it('should destroy and cleanup', async () => {
    const initPromise = client.initialize();
    
    await mockTransport._waitForRequest('initialize');
    mockTransport._respondToLastRequest({
      protocolVersion: '2024-11-05',
      capabilities: {},
      serverInfo: { name: 'test', version: '1.0' },
    });
    mockTransport._simulateMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
    
    await mockTransport._waitForRequest('tools/list');
    mockTransport._respondToLastRequest({ tools: [] });

    await initPromise;
    client.destroy();

    expect(mockTransport.destroy).toHaveBeenCalled();
    expect(client.listenerCount('message')).toBe(0);
  });

  it('should handle server capabilities', async () => {
    const initPromise = client.initialize();
    
    await mockTransport._waitForRequest('initialize');
    mockTransport._respondToLastRequest({
      protocolVersion: '2024-11-05',
      capabilities: { tools: { listChanged: true }, resources: {} },
      serverInfo: { name: 'test', version: '1.0' },
    });
    mockTransport._simulateMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
    
    await mockTransport._waitForRequest('tools/list');
    mockTransport._respondToLastRequest({ tools: [] });

    await initPromise;

    expect(client.getCapabilities().tools.listChanged).toBe(true);
    expect(client.getServerInfo().name).toBe('test');
  });
});
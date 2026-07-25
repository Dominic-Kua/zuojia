import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpTransport } from '../../helper/src/mcp/mcp-transport.js';

describe('McpTransport', () => {
  let mockProcess;
  let transport;

  beforeEach(() => {
    mockProcess = {
      stdout: {
        on: vi.fn(),
        removeAllListeners: vi.fn(),
      },
      stderr: {
        on: vi.fn(),
        removeAllListeners: vi.fn(),
      },
      stdin: {
        write: vi.fn(),
      },
      on: vi.fn(),
      removeAllListeners: vi.fn(),
    };

    transport = new McpTransport(mockProcess);
  });

  afterEach(() => {
    transport.destroy();
    vi.clearAllMocks();
  });

  it('should create transport instance', () => {
    expect(transport).toBeInstanceOf(McpTransport);
  });

  it('should send JSON-RPC request', () => {
    transport.sendRequest('testMethod', { param: 'value' }, 1);
    
    expect(mockProcess.stdin.write).toHaveBeenCalledWith(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'testMethod',
        params: { param: 'value' },
        id: 1,
      }) + '\n'
    );
  });

  it('should send JSON-RPC notification', () => {
    transport.sendNotification('testNotification', { data: 'test' });
    
    expect(mockProcess.stdin.write).toHaveBeenCalledWith(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'testNotification',
        params: { data: 'test' },
      }) + '\n'
    );
  });

  it('should handle parse error for invalid JSON', () => {
    const parseErrorHandler = vi.fn();
    transport.on('parseError', parseErrorHandler);
    
    // Simulate receiving invalid JSON
    const dataHandler = mockProcess.stdout.on.mock.calls.find(
      call => call[0] === 'data'
    )[1];
    
    dataHandler(Buffer.from('invalid json\n'));
    
    expect(parseErrorHandler).toHaveBeenCalled();
    expect(parseErrorHandler.mock.calls[0][0]).toHaveProperty('error');
    expect(parseErrorHandler.mock.calls[0][0]).toHaveProperty('line', 'invalid json');
  });

  it('should parse valid JSON messages', () => {
    const messageHandler = vi.fn();
    transport.on('message', messageHandler);
    
    const dataHandler = mockProcess.stdout.on.mock.calls.find(
      call => call[0] === 'data'
    )[1];
    
    dataHandler(Buffer.from('{"jsonrpc":"2.0","id":1,"result":{}}\n'));
    
    expect(messageHandler).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      id: 1,
      result: {},
    });
  });

  it('should handle multiple messages in buffer', () => {
    const messageHandler = vi.fn();
    transport.on('message', messageHandler);
    
    const dataHandler = mockProcess.stdout.on.mock.calls.find(
      call => call[0] === 'data'
    )[1];
    
    dataHandler(Buffer.from(
      '{"jsonrpc":"2.0","id":1,"result":{}}\n' +
      '{"jsonrpc":"2.0","id":2,"result":{"data":"test"}}\n'
    ));
    
    expect(messageHandler).toHaveBeenCalledTimes(2);
    expect(messageHandler.mock.calls[0][0]).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {},
    });
    expect(messageHandler.mock.calls[1][0]).toEqual({
      jsonrpc: '2.0',
      id: 2,
      result: { data: 'test' },
    });
  });

  it('should handle partial messages across chunks', () => {
    const messageHandler = vi.fn();
    transport.on('message', messageHandler);
    
    const dataHandler = mockProcess.stdout.on.mock.calls.find(
      call => call[0] === 'data'
    )[1];
    
    // First chunk - partial message
    dataHandler(Buffer.from('{"jsonrpc":"2.0"'));
    expect(messageHandler).not.toHaveBeenCalled();
    
    // Second chunk - completes message
    dataHandler(Buffer.from(',"id":1,"result":{}}\n'));
    expect(messageHandler).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      id: 1,
      result: {},
    });
  });

  it('should emit stderr data', () => {
    const stderrHandler = vi.fn();
    transport.on('stderr', stderrHandler);
    
    const stderrDataHandler = mockProcess.stderr.on.mock.calls.find(
      call => call[0] === 'data'
    )[1];
    
    stderrDataHandler(Buffer.from('error message'));
    
    expect(stderrHandler).toHaveBeenCalledWith('error message');
  });

  it('should emit close event on process exit', () => {
    const closeHandler = vi.fn();
    transport.on('close', closeHandler);
    
    const exitHandler = mockProcess.on.mock.calls.find(
      call => call[0] === 'exit'
    )[1];
    
    exitHandler(0, 'SIGTERM');
    
    expect(closeHandler).toHaveBeenCalledWith({ code: 0, signal: 'SIGTERM' });
  });

  it('should throw when sending after destroy', () => {
    transport.destroy();
    
    expect(() => {
      transport.sendRequest('test', {}, 1);
    }).toThrow('Transport is destroyed');
  });

  it('should cleanup listeners on destroy', () => {
    transport.destroy();
    
    expect(mockProcess.stdout.removeAllListeners).toHaveBeenCalled();
    expect(mockProcess.stderr.removeAllListeners).toHaveBeenCalled();
    expect(transport.listenerCount('message')).toBe(0);
  });
});
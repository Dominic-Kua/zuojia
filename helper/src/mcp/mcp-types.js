/**
 * MCP Type Definitions
 * TypeScript-style type definitions for the Model Context Protocol
 * These are documented as JSDoc @typedef for use with JS projects
 */

/**
 * @typedef {Object} JsonRpcRequest
 * @property {string} jsonrpc - Always "2.0"
 * @property {string} method - Method name
 * @property {Object} [params] - Method parameters
 * @property {string|number} id - Request ID (must be present)
 */

/**
 * @typedef {Object} JsonRpcNotification
 * @property {string} jsonrpc - Always "2.0"
 * @property {string} method - Method name
 * @property {Object} [params] - Method parameters
 */

/**
 * @typedef {Object} JsonRpcResponse
 * @property {string} jsonrpc - Always "2.0"
 * @property {*} result - Result data
 * @property {string|number} id - Request ID
 */

/**
 * @typedef {Object} JsonRpcError
 * @property {number} code - Error code
 * @property {string} message - Error message
 * @property {*} [data] - Additional error data
 */

/**
 * @typedef {JsonRpcRequest|JsonRpcNotification|JsonRpcResponse|JsonRpcError} JsonRpcMessage
 */

/**
 * @typedef {Object} McpInitializeParams
 * @property {string} protocolVersion - Protocol version (e.g., "2024-11-05")
 * @property {McpClientCapabilities} capabilities - Client capabilities
 * @property {McpClientInfo} clientInfo - Client information
 */

/**
 * @typedef {Object} McpClientInfo
 * @property {string} name - Client name
 * @property {string} version - Client version
 */

/**
 * @typedef {Object} McpServerInfo
 * @property {string} name - Server name
 * @property {string} version - Server version
 */

/**
 * @typedef {Object} McpClientCapabilities
 * @property {McpToolsCapability} [tools] - Tools capability
 * @property {McpResourcesCapability} [resources] - Resources capability
 * @property {McpPromptsCapability} [prompts] - Prompts capability
 */

/**
 * @typedef {Object} McpServerCapabilities
 * @property {McpToolsCapability} [tools] - Tools capability
 * @property {McpResourcesCapability} [resources] - Resources capability
 * @property {McpPromptsCapability} [prompts] - Prompts capability
 */

/**
 * @typedef {Object} McpToolsCapability
 * @property {boolean} [listChanged] - Server supports tools/list_changed notification
 */

/**
 * @typedef {Object} McpResourcesCapability
 * @property {boolean} [subscribe] - Server supports resource subscription
 * @property {boolean} [listChanged] - Server supports resources/list_changed notification
 */

/**
 * @typedef {Object} McpPromptsCapability
 * @property {boolean} [listChanged] - Server supports prompts/list_changed notification
 */

/**
 * @typedef {Object} McpInitializeResult
 * @property {string} protocolVersion - Protocol version
 * @property {McpServerCapabilities} capabilities - Server capabilities
 * @property {McpServerInfo} serverInfo - Server information
 */

/**
 * @typedef {Object} McpTool
 * @property {string} name - Tool name
 * @property {string} description - Tool description
 * @property {McpToolInputSchema} inputSchema - Input schema
 */

/**
 * @typedef {Object} McpToolInputSchema
 * @property {string} type - Always "object"
 * @property {Object<string, McpToolProperty>} properties - Property definitions
 * @property {string[]} [required] - Required property names
 */

/**
 * @typedef {Object} McpToolProperty
 * @property {string} type - JSON Schema type
 * @property {string} [description] - Property description
 * @property {string[]} [enum] - Enum values
 * @property {McpToolProperty[]} [items] - Array item schema
 * @property {Object<string, McpToolProperty>} [properties] - Nested object properties
 */

/**
 * @typedef {Object} McpToolsListResult
 * @property {McpTool[]} tools - List of available tools
 */

/**
 * @typedef {Object} McpToolCallParams
 * @property {string} name - Tool name
 * @property {Object} arguments - Tool arguments
 */

/**
 * @typedef {Object} McpToolCallResult
 * @property {McpToolContent[]} content - Result content
 * @property {boolean} [isError] - Whether result is an error
 */

/**
 * @typedef {Object} McpToolContent
 * @property {string} type - Content type ("text", "image", "resource")
 * @property {string} [text] - Text content
 * @property {string} [data] - Base64 image data
 * @property {string} [mimeType] - Image MIME type
 * @property {McpResource} [resource] - Resource reference
 */

/**
 * @typedef {Object} McpResource
 * @property {string} uri - Resource URI
 * @property {string} [name] - Resource name
 * @property {string} [description] - Resource description
 * @property {string} [mimeType] - Resource MIME type
 */

/**
 * @typedef {Object} McpInitializedNotification
 * @property {string} jsonrpc - Always "2.0"
 * @property {string} method - Always "notifications/initialized"
 * @property {Object} params - Empty params
 */

/**
 * @typedef {Object} McpToolsListChangedNotification
 * @property {string} jsonrpc - Always "2.0"
 * @property {string} method - Always "notifications/tools/list_changed"
 * @property {Object} params - Empty params
 */

/**
 * @typedef {Object} McpLogNotification
 * @property {string} jsonrpc - Always "2.0"
 * @property {string} method - Always "notifications/log"
 * @property {McpLogParams} params - Log parameters
 */

/**
 * @typedef {Object} McpLogParams
 * @property {string} level - Log level ("debug", "info", "warning", "error")
 * @property {string} message - Log message
 * @property {string} [logger] - Logger name
 */

/**
 * @typedef {Object} McpClientOptions
 * @property {McpTransport} transport - Transport instance
 * @property {McpClientInfo} [clientInfo] - Client info
 * @property {McpClientCapabilities} [capabilities] - Client capabilities
 */

/**
 * @typedef {Object} McpTransport
 * @property {Function} sendRequest - Send JSON-RPC request
 * @property {Function} sendNotification - Send JSON-RPC notification
 * @property {Function} on - Event listener
 * @property {Function} destroy - Cleanup
 */

/**
 * @typedef {Object} McpClientEvents
 * @property {Function} initialized - Emitted when client is initialized
 * @property {Function} toolsListChanged - Emitted when tools list changes
 * @property {Function} log - Emitted on log notification
 * @property {Function} error - Emitted on error
 * @property {Function} close - Emitted when transport closes
 * @property {Function} parseError - Emitted on JSON parse error
 * @property {Function} notification - Emitted on unhandled notification
 */

/**
 * @typedef {Object} McpClientInterface
 * @property {boolean} initialized - Whether client is initialized
 * @property {Function} initialize - Initialize client
 * @property {Function} callTool - Call a tool
 * @property {Function} hasTool - Check if tool exists
 * @property {Function} getTools - Get available tools
 * @property {Function} getCapabilities - Get server capabilities
 * @property {Function} getServerInfo - Get server info
 * @property {Function} shutdown - Shutdown client
 * @property {Function} destroy - Destroy client
 * @property {boolean} destroyed - Whether client is destroyed
 * @property {Function} on - Event listener
 * @property {Function} emit - Event emitter
 */
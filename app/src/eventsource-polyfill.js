// Browser shim: re-export the native EventSource so the MCP SDK
// (which imports from the Node 'eventsource' package) works in the browser.
export const EventSource = globalThis.EventSource;
export default EventSource;

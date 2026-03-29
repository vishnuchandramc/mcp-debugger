import React, { useState, useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import SchemaForm from './SchemaForm';

function isFormCompatibleSchema(schema) {
  if (!schema || schema.type !== 'object' || !schema.properties) return false;
  const props = Object.entries(schema.properties);
  if (props.length === 0) return false;
  return props.every(([, prop]) =>
    ['string', 'number', 'integer', 'boolean'].includes(prop.type)
  );
}

const HTTP_TABS = ['Body', 'Headers'];
const MCP_TABS = ['Body', 'Headers', 'Context'];

const TEMPLATES = {
  'Basic Request': JSON.stringify(
    { title: 'foo', body: 'bar', userId: 1 },
    null,
    2
  ),
  'Tool Call Example': JSON.stringify(
    {
      prompt: "What's the weather in Bangalore?",
      tools: [
        {
          name: 'get_weather',
          description: 'Get weather by city',
          input_schema: {
            type: 'object',
            properties: {
              city: { type: 'string' },
            },
            required: ['city'],
          },
        },
      ],
    },
    null,
    2
  ),
};

export default function RequestPanel({ body, setBody, headers, setHeaders, context, setContext, selectedTool, mode }) {
  const [activeTab, setActiveTab] = useState('Body');
  const [jsonError, setJsonError] = useState(null);
  const [contextError, setContextError] = useState(null);
  const [bodyCopied, setBodyCopied] = useState(false);
  const [viewMode, setViewMode] = useState('json');
  const editorRef = useRef(null);
  const contextEditorRef = useRef(null);

  const canShowForm = mode === 'mcp' && selectedTool && isFormCompatibleSchema(selectedTool.inputSchema);

  useEffect(() => {
    setViewMode(canShowForm ? 'form' : 'json');
  }, [selectedTool, canShowForm]);

  useEffect(() => {
    if (mode !== 'mcp' && activeTab === 'Context') {
      setActiveTab('Body');
    }
  }, [mode, activeTab]);

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleEditorChange = useCallback((value) => {
    setBody(value ?? '');
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e) {
      setJsonError(e.message);
    }
  }, [setBody]);

  function handleTemplate(e) {
    const tpl = TEMPLATES[e.target.value];
    if (tpl) {
      setBody(tpl);
      setJsonError(null);
      editorRef.current?.setValue(tpl);
    }
    e.target.value = '';
  }

  function handleFormat() {
    try {
      const formatted = JSON.stringify(JSON.parse(body), null, 2);
      setBody(formatted);
      setJsonError(null);
      editorRef.current?.setValue(formatted);
    } catch (e) {
      setJsonError(e.message);
    }
  }

  function handleHeaderChange(index, field, value) {
    const next = headers.map((h, i) => i === index ? { ...h, [field]: value } : h);
    setHeaders(next);
  }

  function handleAddHeader() {
    setHeaders([...headers, { key: '', value: '' }]);
  }

  function handleRemoveHeader(index) {
    if (headers.length <= 1) {
      setHeaders([{ key: '', value: '' }]);
      return;
    }
    setHeaders(headers.filter((_, i) => i !== index));
  }

  const handleContextMount = useCallback((editor) => {
    contextEditorRef.current = editor;
  }, []);

  const handleContextChange = useCallback((value) => {
    setContext(value ?? '');
    try {
      JSON.parse(value);
      setContextError(null);
    } catch (e) {
      setContextError(e.message);
    }
  }, [setContext]);

  return (
    <div style={styles.panel}>
      <div style={styles.tabBar}>
        {(mode === 'mcp' ? MCP_TABS : HTTP_TABS).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
          >
            {tab}
          </button>
        ))}
        {activeTab === 'Body' && (
          <div style={styles.tabActions}>
            {canShowForm && (
              <>
                <button
                  onClick={() => setViewMode('form')}
                  style={{ ...styles.actionBtn, ...(viewMode === 'form' ? styles.toggleActive : {}) }}
                >
                  Form
                </button>
                <button
                  onClick={() => setViewMode('json')}
                  style={{ ...styles.actionBtn, ...(viewMode === 'json' ? styles.toggleActive : {}) }}
                >
                  JSON
                </button>
                <span style={styles.toggleDivider} />
              </>
            )}
            <button
              onClick={() => {
                if (!body) return;
                navigator.clipboard.writeText(body);
                setBodyCopied(true);
                setTimeout(() => setBodyCopied(false), 2000);
              }}
              style={styles.actionBtn}
            >
              {bodyCopied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={handleFormat} style={styles.actionBtn}>Format</button>
            <select onChange={handleTemplate} style={styles.templateSelect} defaultValue="">
              <option value="" disabled>Templates</option>
              {Object.keys(TEMPLATES).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTab === 'Body' && (
        <div style={styles.editorWrapper}>
          {selectedTool && (
            <div style={styles.toolBanner}>
              <span style={styles.toolBannerName}>{selectedTool.name}</span>
              {selectedTool.description && (
                <span style={styles.toolBannerDesc}> — {selectedTool.description}</span>
              )}
            </div>
          )}
          {viewMode === 'form' && canShowForm ? (
            <SchemaForm
              schema={selectedTool.inputSchema}
              values={(() => { try { return JSON.parse(body) || {}; } catch { return {}; } })()}
              onChange={(newValues) => {
                const json = JSON.stringify(newValues, null, 2);
                setBody(json);
                setJsonError(null);
                editorRef.current?.setValue(json);
              }}
            />
          ) : (
            <>
              {jsonError && (
                <div style={styles.errorBanner}>
                  <span style={styles.errorIcon}>⚠</span> {jsonError}
                </div>
              )}
              <div style={styles.editorContainer}>
                <Editor
                  defaultValue={body}
                  language="json"
                  theme="vs-dark"
                  onMount={handleEditorMount}
                  onChange={handleEditorChange}
                  options={{
                    fontSize: 13,
                    fontFamily: 'monospace',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    lineNumbers: 'on',
                    renderLineHighlight: 'line',
                    tabSize: 2,
                    wordWrap: 'on',
                    automaticLayout: true,
                    padding: { top: 10, bottom: 10 },
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'Headers' && (
        <div style={styles.headersWrapper}>
          <div style={styles.headersToolbar}>
            <button onClick={handleAddHeader} style={styles.actionBtn}>+ Add Header</button>
          </div>
          <div style={styles.headerRows}>
            {headers.map((header, i) => (
              <div key={i} style={styles.headerRow}>
                <input
                  style={styles.headerInput}
                  placeholder="Header name"
                  value={header.key}
                  onChange={(e) => handleHeaderChange(i, 'key', e.target.value)}
                />
                <input
                  style={{ ...styles.headerInput, flex: 2 }}
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => handleHeaderChange(i, 'value', e.target.value)}
                />
                <button
                  onClick={() => handleRemoveHeader(i)}
                  style={styles.removeBtn}
                  title="Remove header"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Context' && (
        <div style={styles.editorWrapper}>
          {contextError && (
            <div style={styles.errorBanner}>
              <span style={styles.errorIcon}>⚠</span> {contextError}
            </div>
          )}
          <div style={styles.editorContainer}>
            <Editor
              defaultValue={context}
              language="json"
              theme="vs-dark"
              onMount={handleContextMount}
              onChange={handleContextChange}
              options={{
                fontSize: 13,
                fontFamily: 'monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                tabSize: 2,
                wordWrap: 'on',
                automaticLayout: true,
                padding: { top: 10, bottom: 10 },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #3c3c3c',
    flexShrink: 0,
  },
  tab: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#888',
    padding: '8px 16px',
    fontSize: '12px',
    fontFamily: 'monospace',
    cursor: 'pointer',
    marginBottom: '-1px',
  },
  tabActive: {
    color: '#d4d4d4',
    borderBottomColor: '#0e639c',
  },
  tabActions: {
    marginLeft: 'auto',
    marginRight: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  actionBtn: {
    backgroundColor: 'transparent',
    color: '#888',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '3px 10px',
    fontSize: '11px',
    fontFamily: 'monospace',
    cursor: 'pointer',
  },
  toggleActive: {
    backgroundColor: '#094771',
    color: '#d4d4d4',
    borderColor: '#094771',
  },
  toggleDivider: {
    width: '1px',
    height: '16px',
    backgroundColor: '#3c3c3c',
  },
  templateSelect: {
    backgroundColor: '#2d2d2d',
    color: '#888',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '11px',
    fontFamily: 'monospace',
    cursor: 'pointer',
    outline: 'none',
  },
  editorWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '12px',
    gap: '8px',
  },
  toolBanner: {
    backgroundColor: '#1a2a3a',
    color: '#d4d4d4',
    border: '1px solid #264f78',
    borderRadius: '4px',
    padding: '6px 10px',
    fontSize: '12px',
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  toolBannerName: {
    color: '#4ec9b0',
    fontWeight: 700,
  },
  toolBannerDesc: {
    color: '#888',
  },
  errorBanner: {
    backgroundColor: '#3a1a1a',
    color: '#f48771',
    border: '1px solid #5a2a2a',
    borderRadius: '4px',
    padding: '6px 10px',
    fontSize: '12px',
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  errorIcon: {
    marginRight: '4px',
  },
  editorContainer: {
    flex: 1,
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  headersWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '12px',
    gap: '8px',
  },
  headersToolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  headerRows: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    overflowY: 'auto',
  },
  headerRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  headerInput: {
    flex: 1,
    backgroundColor: '#2d2d2d',
    color: '#d4d4d4',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '6px 10px',
    fontSize: '13px',
    fontFamily: 'monospace',
    outline: 'none',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#666',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '2px 6px',
    lineHeight: 1,
    borderRadius: '4px',
  },
};

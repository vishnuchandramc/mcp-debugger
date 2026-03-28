import React, { useState, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';

const TABS = ['Body', 'Headers', 'Context'];

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

export default function RequestPanel({ body, setBody, selectedTool }) {
  const [activeTab, setActiveTab] = useState('Body');
  const [jsonError, setJsonError] = useState(null);
  const editorRef = useRef(null);

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

  return (
    <div style={styles.panel}>
      <div style={styles.tabBar}>
        {TABS.map((tab) => (
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
        </div>
      )}

      {activeTab === 'Headers' && (
        <div style={styles.placeholder}>Headers editor coming soon.</div>
      )}
      {activeTab === 'Context' && (
        <div style={styles.placeholder}>AI context configuration coming soon.</div>
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
  placeholder: {
    color: '#555',
    fontSize: '13px',
    fontFamily: 'monospace',
    padding: '12px',
  },
};

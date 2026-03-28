import React from 'react';

function extractPrompt(requestBody) {
  if (!requestBody) return null;
  try {
    const parsed = typeof requestBody === 'string' ? JSON.parse(requestBody) : requestBody;
    // Common prompt field names
    if (typeof parsed.prompt === 'string') return parsed.prompt;
    // OpenAI/Claude messages array — last user message
    if (Array.isArray(parsed.messages)) {
      const last = [...parsed.messages].reverse().find((m) => m.role === 'user');
      if (last) return typeof last.content === 'string' ? last.content : JSON.stringify(last.content, null, 2);
    }
    if (typeof parsed.content === 'string') return parsed.content;
    if (typeof parsed.input === 'string') return parsed.input;
    return null;
  } catch {
    return null;
  }
}

function extractFinalOutput(parsedResponse) {
  if (!parsedResponse || typeof parsedResponse !== 'object') return null;
  // Claude: content[].text
  if (Array.isArray(parsedResponse.content)) {
    const textBlock = parsedResponse.content.find((c) => c.type === 'text');
    if (textBlock?.text) return textBlock.text;
  }
  // OpenAI: choices[0].message.content
  if (Array.isArray(parsedResponse.choices) && parsedResponse.choices[0]?.message?.content) {
    return parsedResponse.choices[0].message.content;
  }
  // Generic
  if (typeof parsedResponse.text === 'string') return parsedResponse.text;
  if (typeof parsedResponse.output === 'string') return parsedResponse.output;
  if (typeof parsedResponse.result === 'string') return parsedResponse.result;
  return null;
}

function formatJson(value) {
  if (value == null) return 'N/A';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function Step({ number, label, color, children }) {
  return (
    <div style={styles.step}>
      <div style={styles.stepHeader}>
        <span style={{ ...styles.stepBadge, backgroundColor: color }}>{number}</span>
        <span style={styles.stepLabel}>{label}</span>
      </div>
      <div style={styles.stepBody}>{children}</div>
    </div>
  );
}

function Arrow() {
  return <div style={styles.arrow}>&#8595;</div>;
}

export default function ExecutionTimeline({ requestBody, response, toolExecution }) {
  let parsedResponse = null;
  try {
    parsedResponse = typeof response === 'string' ? JSON.parse(response) : response;
  } catch { /* not JSON */ }

  const prompt = extractPrompt(requestBody);
  const finalOutput = extractFinalOutput(parsedResponse);
  const hasTool = toolExecution != null;

  return (
    <div style={styles.container}>
      {/* Step 1: Prompt */}
      <Step number={1} label="Prompt" color="#0e639c">
        <pre style={styles.code}>{prompt ?? 'N/A'}</pre>
      </Step>

      <Arrow />

      {hasTool ? (
        <>
          {/* Step 2: Model Decision */}
          <Step number={2} label="Model Decision" color="#c586c0">
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Selected tool:</span>
              <span style={styles.fieldValue}>{toolExecution.name ?? 'N/A'}</span>
            </div>
            {toolExecution.arguments != null && (
              <div style={styles.field}>
                <span style={styles.fieldLabel}>Arguments:</span>
                <pre style={styles.code}>{formatJson(toolExecution.arguments)}</pre>
              </div>
            )}
          </Step>

          <Arrow />

          {/* Step 3: Tool Call */}
          <Step number={3} label="Tool Call" color="#dcdcaa">
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Calling:</span>
              <span style={styles.fieldValue}>
                {toolExecution.name ?? 'N/A'}({toolExecution.arguments != null ? '...' : ''})
              </span>
            </div>
          </Step>

          <Arrow />

          {/* Step 4: Tool Response */}
          <Step number={4} label="Tool Response" color="#4ec9b0">
            <pre style={styles.code}>
              {toolExecution.output != null ? formatJson(toolExecution.output) : 'N/A'}
            </pre>
          </Step>

          <Arrow />

          {/* Step 5: Final Output */}
          <Step number={5} label="Final Output" color="#9cdcfe">
            <pre style={styles.code}>{finalOutput ?? 'N/A'}</pre>
          </Step>
        </>
      ) : (
        <>
          {/* No tool — skip straight to final output */}
          <Step number={2} label="Final Output" color="#9cdcfe">
            <pre style={styles.code}>{finalOutput ?? formatJson(parsedResponse) ?? 'N/A'}</pre>
          </Step>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  step: {
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '6px',
    padding: '10px 12px',
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  stepBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    fontSize: '11px',
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0,
  },
  stepLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#d4d4d4',
    fontFamily: 'monospace',
  },
  stepBody: {
    paddingLeft: '28px',
  },
  arrow: {
    textAlign: 'center',
    color: '#555',
    fontSize: '16px',
    lineHeight: '20px',
    padding: '2px 0',
  },
  field: {
    marginBottom: '6px',
  },
  fieldLabel: {
    fontSize: '11px',
    color: '#888',
    fontFamily: 'monospace',
    marginRight: '6px',
  },
  fieldValue: {
    fontSize: '12px',
    color: '#4ec9b0',
    fontFamily: 'monospace',
  },
  code: {
    margin: 0,
    fontSize: '12px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: '#dcdcaa',
    lineHeight: '1.5',
    backgroundColor: '#1e1e1e',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '6px 8px',
    maxHeight: '150px',
    overflow: 'auto',
  },
};

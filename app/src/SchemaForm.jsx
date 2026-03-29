import React from 'react';

export default function SchemaForm({ schema, values, onChange }) {
  if (!schema || !schema.properties) return null;

  const required = schema.required || [];
  const entries = Object.entries(schema.properties);

  function handleChange(key, prop, rawValue) {
    let value = rawValue;
    if (prop.type === 'number') value = rawValue === '' ? '' : Number(rawValue);
    else if (prop.type === 'integer') value = rawValue === '' ? '' : parseInt(rawValue, 10);
    else if (prop.type === 'boolean') value = rawValue;
    onChange({ ...values, [key]: value });
  }

  return (
    <div style={styles.container}>
      {entries.map(([key, prop]) => {
        const isRequired = required.includes(key);
        const value = values[key] ?? (prop.type === 'boolean' ? false : '');

        return (
          <div key={key} style={{ ...styles.field, ...(isRequired ? styles.fieldRequired : {}) }}>
            <label style={styles.label}>
              {key}
              {isRequired && <span style={styles.asterisk}> *</span>}
            </label>
            {prop.description && <span style={styles.hint}>{prop.description}</span>}
            {renderInput(key, prop, value, handleChange)}
          </div>
        );
      })}
    </div>
  );
}

function renderInput(key, prop, value, handleChange) {
  if (prop.type === 'string' && prop.enum) {
    return (
      <select
        style={styles.input}
        value={value}
        onChange={(e) => handleChange(key, prop, e.target.value)}
      >
        <option value="">— select —</option>
        {prop.enum.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (prop.type === 'boolean') {
    return (
      <div style={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => handleChange(key, prop, e.target.checked)}
          style={styles.checkbox}
        />
        <span style={styles.checkboxLabel}>{value ? 'true' : 'false'}</span>
      </div>
    );
  }

  if (prop.type === 'number' || prop.type === 'integer') {
    return (
      <input
        type="number"
        step={prop.type === 'integer' ? 1 : 'any'}
        style={styles.input}
        value={value}
        onChange={(e) => handleChange(key, prop, e.target.value)}
        placeholder={prop.type}
      />
    );
  }

  // default: string text input
  return (
    <input
      type="text"
      style={styles.input}
      value={value}
      onChange={(e) => handleChange(key, prop, e.target.value)}
      placeholder={prop.type || 'string'}
    />
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    overflowY: 'auto',
    flex: 1,
    padding: '2px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    borderLeft: '3px solid transparent',
    paddingLeft: '10px',
  },
  fieldRequired: {
    borderLeftColor: '#0e639c',
  },
  label: {
    color: '#d4d4d4',
    fontSize: '12px',
    fontFamily: 'monospace',
    fontWeight: 600,
  },
  asterisk: {
    color: '#f48771',
  },
  hint: {
    color: '#888',
    fontSize: '11px',
    fontFamily: 'monospace',
  },
  input: {
    backgroundColor: '#2d2d2d',
    color: '#d4d4d4',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '7px 10px',
    fontSize: '13px',
    fontFamily: 'monospace',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  checkbox: {
    accentColor: '#0e639c',
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  checkboxLabel: {
    color: '#888',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
};

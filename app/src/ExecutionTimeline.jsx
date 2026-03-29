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
    <div className="bg-zinc-950 border border-zinc-800 rounded-md py-2 px-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: color }}>{number}</span>
        <span className="text-[11px] font-semibold text-zinc-200">{label}</span>
      </div>
      <div className="pl-[22px]">{children}</div>
    </div>
  );
}

function Arrow() {
  return <div className="text-center text-zinc-600 text-[14px] leading-none py-0.5">&#8595;</div>;
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
    <div className="flex flex-col gap-0">
      {/* Step 1: Prompt */}
      <Step number={1} label="Prompt" color="#0e639c">
        <pre className="m-0 text-[11px] whitespace-pre-wrap break-words text-zinc-400 leading-relaxed bg-zinc-900 border border-zinc-800 rounded p-1.5 max-h-[150px] overflow-auto font-mono">{prompt ?? 'N/A'}</pre>
      </Step>

      <Arrow />

      {hasTool ? (
        <>
          {/* Step 2: Model Decision */}
          <Step number={2} label="Model Decision" color="#c586c0">
            <div className="mb-1">
              <span className="text-[10px] text-zinc-500 font-semibold mr-1.5">Selected tool:</span>
              <span className="text-[11px] text-zinc-200">{toolExecution.name ?? 'N/A'}</span>
            </div>
            {toolExecution.arguments != null && (
              <div className="mb-1">
                <span className="text-[10px] text-zinc-500 font-semibold mr-1.5">Arguments:</span>
                <pre className="m-0 text-[11px] whitespace-pre-wrap break-words text-zinc-400 leading-relaxed bg-zinc-900 border border-zinc-800 rounded p-1.5 max-h-[150px] overflow-auto font-mono">{formatJson(toolExecution.arguments)}</pre>
              </div>
            )}
          </Step>

          <Arrow />

          {/* Step 3: Tool Call */}
          <Step number={3} label="Tool Call" color="#dcdcaa">
            <div className="mb-1">
              <span className="text-[10px] text-zinc-500 font-semibold mr-1.5">Calling:</span>
              <span className="text-[11px] text-zinc-200">
                {toolExecution.name ?? 'N/A'}({toolExecution.arguments != null ? '...' : ''})
              </span>
            </div>
          </Step>

          <Arrow />

          {/* Step 4: Tool Response */}
          <Step number={4} label="Tool Response" color="#4ec9b0">
            <pre className="m-0 text-[11px] whitespace-pre-wrap break-words text-zinc-400 leading-relaxed bg-zinc-900 border border-zinc-800 rounded p-1.5 max-h-[150px] overflow-auto font-mono">
              {toolExecution.output != null ? formatJson(toolExecution.output) : 'N/A'}
            </pre>
          </Step>

          <Arrow />

          {/* Step 5: Final Output */}
          <Step number={5} label="Final Output" color="#9cdcfe">
            <pre className="m-0 text-[11px] whitespace-pre-wrap break-words text-zinc-400 leading-relaxed bg-zinc-900 border border-zinc-800 rounded p-1.5 max-h-[150px] overflow-auto font-mono">{finalOutput ?? 'N/A'}</pre>
          </Step>
        </>
      ) : (
        <>
          {/* No tool — skip straight to final output */}
          <Step number={2} label="Final Output" color="#9cdcfe">
            <pre className="m-0 text-[11px] whitespace-pre-wrap break-words text-zinc-400 leading-relaxed bg-zinc-900 border border-zinc-800 rounded p-1.5 max-h-[150px] overflow-auto font-mono">{finalOutput ?? formatJson(parsedResponse) ?? 'N/A'}</pre>
          </Step>
        </>
      )}
    </div>
  );
}


import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * LLM Router – Chat UI (React)
 * -----------------------------------------------------
 * A single-file, ChatGPT-style chat page for your Azure Functions router.
 *
 * Assumptions
 * - Your Azure Functions Python v2 app exposes POST /api/classify
 *   Body: { prompt: string }
 *   Response: { category: string, response: any, docs?: any[] }
 *
 * Features
 * - Chat-like history with user + assistant bubbles
 * - Shows detected category and (optional) retrieved docs preview
 * - Endpoint + key configurable in Settings
 * - Supports Shift+Enter for newlines, Enter to send
 * - Copy response, retry, and clear chat
 */

export default function App() {
  const [endpoint, setEndpoint] = useState("http://localhost:7071/api/classify");
  const [functionKey, setFunctionKey] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]); // [{role:"user"|"assistant", content, meta?}]
  const [lastMeta, setLastMeta] = useState(null); // {category, docs}
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const endpointWithKey = useMemo(() => {
    if (!functionKey) return endpoint.trim();
    const url = new URL(endpoint, window.location.origin);
    url.searchParams.set("code", functionKey);
    return url.pathname + url.search; // keep relative
  }, [endpoint, functionKey]);

  async function sendPrompt(promptText) {
    const prompt = (promptText ?? input).trim();
    if (!prompt || loading) return;
    setError("");
    setLoading(true);

    // add user message
    setHistory((h) => [...h, { role: "user", content: prompt }]);
    setInput("");

    try {
      const res = await fetch(endpointWithKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
      }

      const data = await res.json();
      // Expected: { category, response, docs? }
      const category = data.category ?? "unknown";

      // derive a nice assistant message string from common providers
      const assistantText = extractAssistantText(data.response);

      // optional docs preview
      const docs = data.docs || data.response?.docs || [];

      setLastMeta({ category, docs });
      setHistory((h) => [
        ...h,
        {
          role: "assistant",
          content: assistantText || "(No content returned)",
          meta: { category, docs, raw: data.response },
        },
      ]);
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
      setHistory((h) => [
        ...h,
        { role: "assistant", content: "Sorry — I hit an error trying to reach the router." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function extractAssistantText(resp) {
    if (!resp) return "";
    // Azure OpenAI chat format
    if (resp?.choices?.[0]?.message?.content) return resp.choices[0].message.content;
    // Anthropic Claude
    if (resp?.content && Array.isArray(resp.content)) {
      const textPart = resp.content.find((p) => p.type === "text");
      if (textPart?.text) return textPart.text;
    }
    // Gemini
    if (resp?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return resp.candidates[0].content.parts[0].text;
    }
    // Fallbacks
    if (typeof resp === "string") return resp;
    try {
      return JSON.stringify(resp, null, 2);
    } catch {
      return String(resp);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  }

  function retryLast() {
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (lastUser) sendPrompt(lastUser.content);
  }

  function clearChat() {
    setHistory([]);
    setLastMeta(null);
    setError("");
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800/80 sticky top-0 backdrop-blur bg-neutral-950/70 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-lg font-semibold">LLM Router – Chat</h1>
            <p className="text-xs text-neutral-400">Zero-shot classifier + FAISS IR → route to the best model</p>
          </div>
          <Settings
            endpoint={endpoint}
            setEndpoint={setEndpoint}
            functionKey={functionKey}
            setFunctionKey={setFunctionKey}
          />
        </div>
      </header>

      {/* Chat */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 space-y-4">
        {/* Meta strip */}
        <MetaStrip meta={lastMeta} loading={loading} />

        {/* Messages */}
        <div className="space-y-4">
          {history.map((m, idx) => (
            <MessageBubble key={idx} role={m.role} content={m.content} meta={m.meta} />
          ))}
          {error && (
            <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg p-3">{error}</div>
          )}
          {loading && <div className="text-sm text-neutral-400">Thinking…</div>}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Composer */}
      <div className="border-t border-neutral-800/80 sticky bottom-0 bg-neutral-950/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60">
            <textarea
              ref={inputRef}
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
              className="w-full resize-none bg-transparent outline-none p-4 text-sm"
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="text-xs text-neutral-500">
                Endpoint: <span className="text-neutral-300">{endpointWithKey}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearChat}
                  className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800"
                >
                  Clear
                </button>
                <button
                  onClick={retryLast}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800 disabled:opacity-50"
                >
                  Retry
                </button>
                <button
                  onClick={() => sendPrompt()}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 hover:opacity-90 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaStrip({ meta, loading }) {
  if (!meta && !loading) return null;
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3 text-xs text-neutral-300 flex items-start gap-3">
      <div className="shrink-0 w-2 h-2 mt-1 rounded-full bg-sky-500" />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-neutral-500">Routing</span>
          <span className="px-2 py-0.5 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-200">
            {loading ? "Detecting…" : meta?.category ?? "unknown"}
          </span>
        </div>
        {!!meta?.docs?.length && (
          <div className="flex flex-wrap gap-2">
            {meta.docs.slice(0, 4).map((d, i) => (
              <span key={i} className="px-2 py-1 rounded-md bg-neutral-800/70 border border-neutral-700/70">
                {typeof d === "string" ? d.slice(0, 80) : (d.preview || d.source || JSON.stringify(d)).slice(0, 80)}
              </span>
            ))}
            {meta.docs.length > 4 && <span className="text-neutral-500">+{meta.docs.length - 4} more</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ role, content, meta }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm border text-sm whitespace-pre-wrap leading-relaxed ${isUser ? "bg-sky-600/90 border-sky-500/60 text-white" : "bg-neutral-900/70 border-neutral-800"
          }`}
      >
        {!isUser && (
          <div className="mb-2 flex items-center gap-2 text-[10px] text-neutral-400">
            <span className="uppercase tracking-wider">Assistant</span>
            {meta?.category && (
              <span className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300">
                {meta.category}
              </span>
            )}
            <CopyButton text={content} />
          </div>
        )}
        {content}
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch { }
      }}
      className="text-[10px] px-2 py-0.5 rounded border border-neutral-700 hover:bg-neutral-800"
      title="Copy"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Settings({ endpoint, setEndpoint, functionKey, setFunctionKey }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800"
      >
        Settings
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[26rem] rounded-2xl border border-neutral-800 bg-neutral-900/90 backdrop-blur shadow-xl p-4 space-y-3">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Azure Function Endpoint</label>
            <input
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-600"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="/api/classify"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Function Key (optional)</label>
            <input
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-600"
              value={functionKey}
              onChange={(e) => setFunctionKey(e.target.value)}
              placeholder="<function key>"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setOpen(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

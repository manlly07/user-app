import { useEffect, useRef, useState } from "react";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const conversationIdRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userText = input;
    setInput("");

    setMessages((prev) => [...prev, { role: "user", content: userText }]);

    const res = await fetch("http://localhost:3004/messages/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        content: userText,
        conversationId: conversationIdRef.current,
      }),
    });

    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let assistantBuffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const events = text.split("\n\n");

      for (const event of events) {
        if (!event.startsWith("data:")) continue;

        const payload = event.replace("data:", "").trim();
        if (!payload) continue;

        let data;
        try {
          data = JSON.parse(payload);
        } catch {
          continue;
        }

        if (
          typeof data.chunk === "string" &&
          data.chunk.startsWith("conversation_id:")
        ) {
          const id = Number(data.chunk.replace("conversation_id:", ""));
          if (!isNaN(id)) {
            conversationIdRef.current = id;
          }
          continue;
        }

        if (typeof data.chunk === "string") {
          assistantBuffer += data.chunk;

          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];

            if (last && last.role === "assistant") {
              last.content = assistantBuffer;
            } else {
              copy.push({
                role: "assistant",
                content: assistantBuffer,
              });
            }
            return [...copy];
          });
        }
      }
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white text-3xl shadow-2xl hover:scale-105 transition"
      >
        💬
      </button>

      {open && (
        <div className="fixed bottom-28 right-6 w-[520px] h-[760px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-4 px-6 py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl">
              🤖
            </div>
            <div className="flex-1">
              <div className="text-lg font-semibold">AI Assistant</div>
              <div className="text-sm text-blue-100">
                Online • Ready to help
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 px-6 py-5 overflow-y-auto space-y-4 bg-gray-50 text-base">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`px-5 py-3 rounded-3xl max-w-[85%] leading-relaxed ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-lg"
                      : "bg-white text-gray-800 shadow-md rounded-bl-lg"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t bg-white px-5 py-4 flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Nhập tin nhắn..."
              className="flex-1 border rounded-full px-6 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={sendMessage}
              className="bg-blue-600 text-white px-6 py-3 rounded-full text-base hover:bg-blue-700 transition"
            >
              Gửi
            </button>
          </div>
        </div>
      )}
    </>
  );
}

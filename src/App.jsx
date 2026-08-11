import { useEffect, useRef, useState } from "react";
import "./App.css";
import Modal from "./Modal.jsx";

const starterPrompts = [
  "Help me write about ",
  "Explain the topic of ",
  "Brainstorm some ideas for ",
];

function formatMessage(text) {
  return text
    .split(/(\*\*.+?\*\*)/g)
    .map((part, index) => {
      if (
        part.startsWith("**") &&
        part.endsWith("**")
      ) {
        return (
          <strong key={index}>
            {part.slice(2, -2)}
          </strong>
        );
      }

      return part;
    });
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [showStarterPrompts, setShowStarterPrompts] =
    useState(true);

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      160,
    )}px`;
  }, [input]);

  function focusTextarea() {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function clearChat() {
    if (isLoading) return;

    setMessages([]);
    setInput("");
    setError("");
    setShowStarterPrompts(true);
    focusTextarea();
  }

  function selectStarterPrompt(prompt) {
    setInput((currentInput) =>
      currentInput.trim()
        ? `${prompt}${currentInput}`
        : prompt,
    );

    setShowStarterPrompts(false);
    setError("");

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;

      if (!textarea) return;

      textarea.focus();
      textarea.setSelectionRange(
        textarea.value.length,
        textarea.value.length,
      );
    });
  }

  async function sendMessage(messageText) {
    const content = messageText.trim();

    if (!content || isLoading) return;

    const userMessage = {
      role: "user",
      content,
    };

    const conversation = [
      ...messages,
      userMessage,
    ];

    setMessages([
      ...conversation,
      {
        role: "assistant",
        content: "",
      },
    ]);

    setInput("");
    setError("");
    setShowStarterPrompts(false);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          messages: conversation,
        }),
      });

      if (!response.ok || !response.body) {
        const data = await response
          .json()
          .catch(() => null);

        throw new Error(
          data?.error ||
            "OpenToken is currently unavailable.",
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let completeResponse = "";

      while (true) {
        const { value, done } =
          await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (
            !trimmedLine.startsWith("data:")
          ) {
            continue;
          }

          const data = trimmedLine
            .slice(5)
            .trim();

          if (
            !data ||
            data === "[DONE]"
          ) {
            continue;
          }

          try {
            const event = JSON.parse(data);

            const text =
              event.choices?.[0]?.delta
                ?.content || "";

            if (!text) continue;

            completeResponse += text;

            setMessages([
              ...conversation,
              {
                role: "assistant",
                content: completeResponse,
              },
            ]);
          } catch {
            // Ignore provider metadata events.
          }
        }
      }

      if (!completeResponse) {
        throw new Error(
          "No response was returned. Please try again.",
        );
      }
    } catch (requestError) {
      setMessages(conversation);

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong.",
      );
    } finally {
      setIsLoading(false);
      focusTextarea();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <main className="app">
      <header className="header">
        <button
          className="brand"
          type="button"
          onClick={clearChat}
          disabled={isLoading}
          aria-label="Start a new chat"
        >
          <img
            className="brandLogo"
            src="/logo.png"
            alt=""
          />

          <span className="brandName">
            OpenToken
          </span>
        </button>

        <div className="headerActions">
          {messages.length > 0 && (
            <button
              className="clearButton"
              type="button"
              onClick={clearChat}
              disabled={isLoading}
            >
              New chat
            </button>
          )}

          <button
            className="updatesButton"
            type="button"
            onClick={() => setEmailOpen(true)}
          >
            Updates
          </button>
        </div>
      </header>

      <section className="chat">
        {messages.length === 0 ? (
          <div className="welcome">
            <p className="eyebrow">
              FREE AND SIMPLE
            </p>

            <h1>What can I help with?</h1>

            <p className="description">
              Ask a question, explore an idea,
              or get help creating something.
            </p>
          </div>
        ) : (
          <div
            className="messages"
            aria-live="polite"
          >
            {messages.map(
              (message, index) => (
                <article
                  className={`message ${message.role}`}
                  key={`${message.role}-${index}`}
                >
                  <p className="messageAuthor">
                    {message.role === "user"
                      ? "You"
                      : "OpenToken"}
                  </p>

                  <div className="messageText">
                    {message.content ? (
                      message.role === "assistant"
                        ? formatMessage(message.content)
                        : message.content
                    ) : (
                      <span
                        className="typing"
                        aria-label="OpenToken is responding"
                      >
                        <span />
                        <span />
                        <span />
                      </span>
                    )}
                  </div>
                </article>
              ),
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </section>

      <section className="inputArea">
        {messages.length === 0 &&
          showStarterPrompts && (
            <div className="suggestions">
              {starterPrompts.map(
                (prompt) => (
                  <button
                    type="button"
                    key={prompt}
                    onClick={() =>
                      selectStarterPrompt(
                        prompt,
                      )
                    }
                    disabled={isLoading}
                  >
                    {prompt.trim()}...
                  </button>
                ),
              )}
            </div>
          )}

        <form
          className="composer"
          onSubmit={handleSubmit}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) =>
              setInput(event.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder="Message OpenToken..."
            aria-label="Message OpenToken"
            maxLength={4000}
            rows={1}
            disabled={isLoading}
          />

          <button
            className="sendButton"
            type="submit"
            aria-label="Send message"
            disabled={
              !input.trim() || isLoading
            }
          >
            <img
              className="sendIcon"
              src="/arrow.svg"
              alt=""
            />
          </button>
        </form>

        {error && (
          <p
            className="error"
            role="alert"
          >
            {error}
          </p>
        )}

        <footer className="footer">
          <span>
            Lightweight by design. Free by choice.
          </span>
        </footer>
      </section>

      {emailOpen && (
        <Modal
          onClose={() =>
            setEmailOpen(false)
          }
        />
      )}
    </main>
  );
}
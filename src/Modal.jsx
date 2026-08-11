import {
  useEffect,
  useRef,
  useState,
} from "react";

import "./Modal.css";

export default function Modal({ onClose }) {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [submitted, setSubmitted] =
    useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();

    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [onClose]);

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanEmail = email
      .trim()
      .toLowerCase();

    if (!cleanEmail || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch(
        "/api/email-signup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanEmail,
          }),
        },
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Your email could not be saved.",
        );
      }

      setSubmitted(true);

      setNotice(
        data?.message ||
          "You're on the list.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="modalBackdrop"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className="accountModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
      >
        <button
          className="modalClose"
          type="button"
          onClick={onClose}
          aria-label="Close window"
        >
          ×
        </button>

        <div className="modalContent">
          <img
            className="modalLogo"
            src="/logo.png"
            alt=""
          />

          {submitted ? (
            <>
              <p className="modalEyebrow">
                YOU&apos;RE ON THE LIST
              </p>

              <h2 id="account-title">
                Thanks for joining.
              </h2>

              <p className="modalDescription">
                We&apos;ll let you know about stronger
                models and meaningful OpenToken updates.
              </p>
            </>
          ) : (
            <>
              <p className="modalEyebrow">
                STAY UPDATED
              </p>

              <h2 id="account-title">
                Get more from OpenToken.
              </h2>

              <p className="modalDescription">
                Be first in line for access to stronger
                models, new features, and important
                OpenToken updates.
              </p>

              <form
                className="accountForm"
                onSubmit={handleSubmit}
              >
                <label htmlFor="signup-email">
                  Email address
                </label>

                <input
                  ref={inputRef}
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setNotice("");
                    setError("");
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  maxLength={254}
                  required
                />

                <button
                  className="accountSubmit"
                  type="submit"
                  disabled={
                    !email.trim() ||
                    isSubmitting
                  }
                >
                  {isSubmitting
                    ? "Joining..."
                    : "Get updates"}
                </button>
              </form>
            </>
          )}

          {notice && (
            <p
              className="modalNotice"
              role="status"
            >
              {notice}
            </p>
          )}

          {error && (
            <p
              className="modalError"
              role="alert"
            >
              {error}
            </p>
          )}

          {!submitted && (
            <p className="modalPrivacy">
              No spam. Only useful product updates.
              Unsubscribe anytime.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
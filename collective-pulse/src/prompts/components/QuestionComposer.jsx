import { useState } from "react";
import { QueueIcon } from "./QueueIcon.jsx";
export function QuestionComposer({ disabled, busy, canAddNext, onAdd }) {
  const [text, setText] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (await onAdd(text, event.nativeEvent.submitter?.dataset.position || "bottom")) setText("");
  }
  return (
    <form id="add-question" className="queue-composer" onSubmit={submit}>
      <label className="new-question-label" htmlFor="new-question">
        <QueueIcon name="add" />
        <span className="sr-only">Add a question</span>
      </label>
      <input
        id="new-question"
        name="question"
        type="text"
        maxLength="240"
        required
        autoComplete="off"
        placeholder="Add a question"
        value={text}
        disabled={busy}
        onChange={(event) => setText(event.target.value)}
      />
      <button
        id="add-next"
        type="submit"
        data-position="next"
        disabled={disabled || !canAddNext}
        title={
          canAddNext
            ? "Show this question at the next five-minute rotation"
            : "Connect the installation display and wait for it to receive changes"
        }
      >
        <QueueIcon name="next" className="next-icon" />
        <span>Add to next</span>
      </button>
      <button id="add-bottom" type="submit" data-position="bottom" disabled={disabled}>
        <QueueIcon name="next" />
        <span>Add to bottom</span>
      </button>
    </form>
  );
}

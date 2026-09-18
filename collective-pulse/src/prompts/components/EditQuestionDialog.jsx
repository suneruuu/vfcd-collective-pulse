import { useEffect, useRef, useState } from "react";
export function EditQuestionDialog({ question, busy, connected, error, onSave, onClose }) {
  const ref = useRef(null),
    [text, setText] = useState(question.text);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  async function save(event) {
    event.preventDefault();
    await onSave(question.id, text);
  }
  return (
    <dialog id="edit-dialog" ref={ref} aria-labelledby="edit-heading" onCancel={onClose}>
      <form id="edit-question" onSubmit={save}>
        <p>Collective Pulse</p>
        <h2 id="edit-heading">Edit question</h2>
        <label htmlFor="edit-text">Question content</label>
        <textarea
          id="edit-text"
          name="question"
          maxLength="240"
          required
          rows="4"
          value={text}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
          autoFocus
        />
        <p className="edit-note">Updates appear on the connected installation automatically.</p>
        <p id="edit-error" role="alert">
          {error}
        </p>
        <div className="edit-actions">
          <button id="edit-cancel" type="button" onClick={onClose}>
            Cancel
          </button>
          <button id="edit-save" type="submit" disabled={busy || !connected}>
            Save changes
          </button>
        </div>
      </form>
    </dialog>
  );
}

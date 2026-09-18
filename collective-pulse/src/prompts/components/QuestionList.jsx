import { QueueIcon } from "./QueueIcon.jsx";
import { useReordering } from "../hooks/useReordering.js";
export function QuestionList({
  prompts,
  currentId,
  disabled,
  move,
  onVisibility,
  onEdit,
  onDelete,
}) {
  const drag = useReordering({
    prompts,
    disabled,
    move,
  });
  return (
    <div className="queue-list-viewport" role="region" aria-label="Question queue" tabIndex="0">
      <ol id="question-list" aria-label="Questions in loop order">
        {prompts.map((prompt, index) => {
          const current = currentId === prompt.id;
          const className =
            "question-row" +
            (prompt.hidden ? " is-hidden" : "") +
            (current ? " is-current" : "") +
            (drag.draggedId === prompt.id ? " is-dragging" : "") +
            (drag.targetId === prompt.id ? " is-drop-target" : "");
          return (
            <li key={prompt.id} className={className} data-id={prompt.id}>
              <button
                className="drag-handle"
                data-action="drag"
                type="button"
                disabled={disabled}
                aria-label={"Reorder question " + (index + 1) + ". Use up or down arrow keys."}
                {...drag.handleProps(prompt.id)}
              >
                <QueueIcon name="drag" />
              </button>
              <div className="row-actions">
                <button
                  data-action="visibility"
                  type="button"
                  disabled={disabled}
                  aria-label={(prompt.hidden ? "Show" : "Hide") + " question " + (index + 1)}
                  onClick={() => onVisibility(prompt)}
                >
                  <QueueIcon name={prompt.hidden ? "show" : "hide"} />
                  <span>{prompt.hidden ? "Show" : "Hide"}</span>
                </button>
                <button
                  data-action="edit"
                  type="button"
                  disabled={disabled}
                  aria-label={"Edit question " + (index + 1)}
                  onClick={() => onEdit(prompt)}
                >
                  <QueueIcon name="edit" />
                  <span>Edit</span>
                </button>
                <button
                  className="trash-button"
                  data-action="delete"
                  type="button"
                  disabled={disabled}
                  title="Delete question"
                  aria-label={"Delete question " + (index + 1)}
                  onClick={() => onDelete(prompt)}
                >
                  <QueueIcon name="trash" />
                  <span>Delete</span>
                </button>
              </div>
              <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
              <p className="row-content">
                {prompt.text}
                <span className="row-label">{current ? "Current" : ""}</span>
              </p>
              <div className="row-moves">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  aria-label={"Move question " + (index + 1) + " up"}
                  onClick={() => move(prompt.id, index - 1)}
                >
                  {"\u2191"}
                </button>
                <button
                  type="button"
                  disabled={disabled || index === prompts.length - 1}
                  aria-label={"Move question " + (index + 1) + " down"}
                  onClick={() => move(prompt.id, index + 1)}
                >
                  {"\u2193"}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <p id="queue-empty" hidden={prompts.length > 0}>
        No questions yet. Add one below to start the loop.
      </p>
    </div>
  );
}

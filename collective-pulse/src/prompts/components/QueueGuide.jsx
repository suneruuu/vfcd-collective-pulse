import { QueueIcon } from "./QueueIcon.jsx";
export function QueueGuide() {
  return (
    <section className="queue-guide" aria-label="How to manage questions">
      <div>
        <h2>
          <QueueIcon name="drag" />
          Drag
        </h2>
        <p>Reorder questions in the loop.</p>
        <p className="guide-detail">
          Focus a drag handle and use {"\u2191 / \u2193"}, or use the move buttons.
        </p>
      </div>
      <div>
        <h2>
          <QueueIcon name="hide" />
          Hide / <QueueIcon name="show" />
          Show
        </h2>
        <p>Control which questions appear during the installation.</p>
      </div>
      <div>
        <h2>
          <QueueIcon name="edit" />
          Edit
        </h2>
        <p>Change the question content.</p>
      </div>
      <hr />
      <div>
        <h2>
          <QueueIcon name="next" className="next-icon" />
          Add to next
        </h2>
        <p>Insert a new question immediately after the current question.</p>
      </div>
      <div>
        <h2>
          <QueueIcon name="next" />
          Add to bottom
        </h2>
        <p>Add a new question to the end of the queue.</p>
      </div>
      <p className="guide-detail">
        Questions rotate every five minutes. Changes save automatically.
      </p>
      <a className="installation-link" href="/" target="_blank" rel="noopener">
        Open installation {"\u2197"}
      </a>
    </section>
  );
}

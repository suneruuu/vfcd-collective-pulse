import { useEffect, useState } from "react";
import { usePromptQueue } from "./hooks/usePromptQueue.js";
import { getConnectionStatus } from "./connectionStatus.js";
import { SchedulePanel } from "../schedule/SchedulePanel.jsx";
import { QuestionList } from "./components/QuestionList.jsx";
import { QuestionComposer } from "./components/QuestionComposer.jsx";
import { EditQuestionDialog } from "./components/EditQuestionDialog.jsx";
import { QueueGuide } from "./components/QueueGuide.jsx";
export function PromptManagerShell({
  state,
  mutate = async () => false,
  move = async () => false,
}) {
  const [editing, setEditing] = useState(null);
  const connection = getConnectionStatus(state),
    prompts = state.queue?.prompts || [];
  const disabled = state.busy || !state.connected;
  async function save(id, text) {
    if (
      await mutate({
        operation: "edit",
        id,
        text,
      })
    )
      setEditing((current) => (current?.id === id ? null : current));
  }
  return (
    <>
      <main className="queue-main">
        <header className="queue-heading">
          <p>Collective Pulse</p>
          <h1>Question Queue</h1>
          <div className="queue-meta">
            <span id="connection-status" role="status" data-state={connection.state}>
              {connection.text}
            </span>
            <span id="queue-count">
              {state.queue
                ? prompts.filter((prompt) => !prompt.hidden).length +
                  " shown / " +
                  prompts.length +
                  " questions"
                : ""}
            </span>
          </div>
        </header>
        <QuestionList
          prompts={prompts}
          currentId={
            state.connected && state.queue?.installation.online
              ? state.queue.installation.currentId
              : null
          }
          disabled={disabled}
          move={move}
          onVisibility={(prompt) =>
            mutate({
              operation: "visibility",
              id: prompt.id,
              hidden: !prompt.hidden,
            })
          }
          onEdit={setEditing}
        />
        <p id="queue-message" role="status" aria-live="polite" data-error={String(state.error)}>
          {state.message}
        </p>
        <QuestionComposer
          disabled={disabled}
          busy={state.busy}
          canAddNext={connection.received}
          onAdd={(text, position) =>
            mutate({
              operation: "add",
              text,
              position,
            })
          }
        />
      </main>
      <aside className="queue-sidebar" aria-label="Schedule and queue help">
        <SchedulePanel />
        <QueueGuide />
      </aside>
      {editing && (
        <EditQuestionDialog
          key={editing.id}
          question={editing}
          busy={state.busy}
          connected={state.connected}
          error={state.error ? state.message : ""}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
export default function PromptManagerPage() {
  const { state, mutate, move } = usePromptQueue();
  useEffect(() => {
    document.body.classList.add("queue-page");
    return () => document.body.classList.remove("queue-page");
  }, []);
  return <PromptManagerShell state={state} mutate={mutate} move={move} />;
}

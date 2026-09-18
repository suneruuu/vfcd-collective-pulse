export function QueueIcon({ name, className }) {
  return (
    <img
      src={"/assets/queue-" + name + ".svg"}
      width="24"
      height="24"
      className={className}
      alt=""
    />
  );
}

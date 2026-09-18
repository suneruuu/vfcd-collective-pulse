import { assetUrl } from "../../services/paths.js";
export function QueueIcon({ name, className }) {
  return (
    <img
      src={assetUrl("queue-" + name + ".svg")}
      width="24"
      height="24"
      className={className}
      alt=""
    />
  );
}

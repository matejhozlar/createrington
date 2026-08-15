import { useParams } from "react-router";

export function ServerDetail() {
  const { serverId } = useParams();

  return (
    <div>
      <h1>Server {serverId}</h1>
      <p>Server detail page coming soon...</p>
    </div>
  );
}

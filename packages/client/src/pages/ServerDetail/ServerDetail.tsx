import { useParams } from "react-router";

export function ServerDetail() {
  const { serverSlug } = useParams();

  return (
    <div>
      <h1>Server {serverSlug}</h1>
      <p>Server detail page coming soon...</p>
    </div>
  );
}

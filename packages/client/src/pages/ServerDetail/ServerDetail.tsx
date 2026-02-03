import React from "react";
import { useParams } from "react-router-dom";

export const ServerDetail: React.FC = () => {
  const { serverId } = useParams();
  
  return (
    <div>
      <h1>Server {serverId}</h1>
      <p>Server detail page coming soon...</p>
    </div>
  );
};

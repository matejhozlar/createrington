// TODO: Refactor to dynamically open the map for a configured server.
// TODO: Add backend routes to provide the map link per server.
// Currently hardcoded to create-rington.com/bluemap.

export function BlueMap() {
  return (
    <div className="flex h-full w-full flex-1">
      <iframe
        src="https://create-rington.com/bluemap"
        title="BlueMap Viewer"
        className="h-full w-full flex-1 border-none"
      />
    </div>
  );
}

export function TypingIndicator(): React.JSX.Element {
  return (
    <div className="mt-3 flex items-end gap-2 self-start animate-in fade-in slide-in-from-bottom-1 duration-200">
      <img
        src="/assets/logo/createrington-bot.webp"
        alt="Createrington"
        className="size-6 shrink-0 rounded-full bg-muted object-cover"
        loading="lazy"
      />
      <div className="flex items-center gap-1 rounded-lg rounded-bl-sm bg-muted px-3 py-2.5">
        <span
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: "120ms" }}
        />
        <span
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: "240ms" }}
        />
      </div>
    </div>
  );
}

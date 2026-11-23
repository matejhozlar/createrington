import { describe, expect, it } from "vitest";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";

function renderCrashed(props: ConstructorParameters<typeof ErrorBoundary>[0]) {
  const boundary = new ErrorBoundary(props);
  boundary.state = { hasError: true, error: new Error("boom") };
  return boundary.render();
}

describe("ErrorBoundary", () => {
  it("renders nothing after a crash when the fallback is null", () => {
    expect(renderCrashed({ children: "content", fallback: null })).toBeNull();
  });

  it("renders the provided fallback after a crash", () => {
    expect(renderCrashed({ children: "content", fallback: "fallback" })).toBe(
      "fallback",
    );
  });

  it("renders the default error page after a crash when no fallback is given", () => {
    const rendered = renderCrashed({ children: "content" });
    expect(rendered).toMatchObject({ type: ErrorFallback });
  });

  it("renders its children while nothing has crashed", () => {
    const boundary = new ErrorBoundary({ children: "content", fallback: null });
    expect(boundary.render()).toBe("content");
  });
});

import React from "react";

export interface LoadingProps {
  /** Display mode - fullscreen, overlay, or inline */
  mode?: "fullscreen" | "overlay" | "inline";
  /** Size of the loading animation */
  size?: "small" | "medium" | "large";
  /** Loading text to display */
  text?: string;
  /** Additional subtext */
  subtext?: string;
  /** Show progress bar */
  showProgress?: boolean;
  /** Additional CSS class */
  className?: string;
}

const sizeClasses = {
  small: "h-6 w-6 border-2",
  medium: "h-10 w-10 border-3",
  large: "h-16 w-16 border-4",
};

const modeClasses = {
  inline: "flex",
  overlay: "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm",
  fullscreen: "fixed inset-0 z-50 bg-background",
};

/**
 * Loading component with animated spinner
 * Can be used as fullscreen loader, overlay, or inline
 */
export const Loading: React.FC<LoadingProps> = ({
  mode = "inline",
  size = "medium",
  text = "Loading...",
  subtext,
  showProgress = false,
  className,
}) => {
  const isInline = mode === "inline";

  return (
    <div
      className={`${modeClasses[mode]} ${
        isInline ? "items-center justify-center" : "flex items-center justify-center"
      } ${className || ""}`}
      role="status"
      aria-live="polite"
      aria-label={text}
    >
      <div
        className={`flex flex-col items-center gap-4 ${isInline ? "" : "p-8"}`}
      >
        {/* Spinner */}
        <div
          className={`${sizeClasses[size]} animate-spin rounded-full border-primary border-t-transparent`}
        />

        {/* Text */}
        {text && (
          <div className="text-center">
            <div className="text-foreground font-medium">{text}</div>
            {subtext && (
              <div className="text-muted-foreground text-sm mt-1">
                {subtext}
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        {showProgress && (
          <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Simple spinner for inline use
 */
export const LoadingSpinner: React.FC<{
  size?: "small" | "medium" | "large";
  className?: string;
}> = ({ size = "small", className }) => {
  return <Loading mode="inline" size={size} text="" className={className} />;
};

/**
 * Fullscreen loading overlay
 */
export const LoadingScreen: React.FC<{
  text?: string;
  subtext?: string;
}> = ({ text = "Loading...", subtext }) => {
  return (
    <Loading
      mode="fullscreen"
      size="large"
      text={text}
      subtext={subtext}
      showProgress
    />
  );
};

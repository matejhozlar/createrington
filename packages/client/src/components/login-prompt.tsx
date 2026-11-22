import { useNavigate } from "react-router";
import { Home, ArrowLeft, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/auth/";
import { DiscordIcon } from "@/components/icons/discord";
import { StatusPage } from "@/components/status-page";

export function LoginPrompt() {
  const navigate = useNavigate();
  const { login } = useAuth();

  return (
    <StatusPage
      icon={LogIn}
      title="Login required"
      badge="401"
      description="You need to be logged in to access this page."
      actions={[
        {
          icon: DiscordIcon,
          label: "Log in",
          description: "Sign in with Discord",
          onClick: () => void login(),
        },
        {
          icon: ArrowLeft,
          label: "Go back",
          description: "Return to the previous page",
          onClick: () => void navigate(-1),
        },
        {
          icon: Home,
          label: "Home",
          description: "Go to the homepage",
          onClick: () => void navigate("/"),
        },
      ]}
    />
  );
}

import { Component, type ErrorInfo, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Caught by ErrorBoundary:", error, info);
    void supabase.from("app_errors").insert({
      message: error.message,
      stack: error.stack ?? null,
      component_stack: info.componentStack ?? null,
      url: window.location.href,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="font-display text-xl text-text">Something went wrong loading this section.</h2>
          <p className="max-w-md text-sm text-text-soft">
            The error has been logged. You can try again, or use the sidebar to go to a different page.
          </p>
          <Button onClick={() => this.setState({ hasError: false })}>Try again</Button>
        </div>
      );
    }

    return this.props.children;
  }
}

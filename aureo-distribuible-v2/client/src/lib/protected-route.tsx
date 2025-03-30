import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

type RoleType = "SuperAdmin" | "Admin" | "User";

export function ProtectedRoute({
  path,
  component: Component,
  roles = ["SuperAdmin", "Admin", "User"],
}: {
  path: string;
  component: () => React.JSX.Element;
  roles?: RoleType[];
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }
  
  // Check if user has the required role
  if (!roles.includes(user.role as RoleType)) {
    return (
      <Route path={path}>
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-center mb-6">
            You don't have the necessary permissions to access this page.
          </p>
          <a href="/" className="text-primary hover:underline">
            Return to Dashboard
          </a>
        </div>
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}

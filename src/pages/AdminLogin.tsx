import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setAdminToken } from "@/auth";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || "/admin-dashboard";

  const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME;
  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    console.log({
      typedUser: JSON.stringify(username),
      typedPass: JSON.stringify(password),
      envUser: JSON.stringify(ADMIN_USERNAME),
      envPass: JSON.stringify(ADMIN_PASSWORD),
    });

    console.log("import.meta.env:", import.meta.env);

    if (password === ADMIN_PASSWORD && username === ADMIN_USERNAME) {
      setAdminToken();
      sessionStorage.setItem("username", username);
      navigate(from, { replace: true });
    } else {
      setError("Invalid username or password");
    }
  };

  return (
    <div className=" min-h-[70vh] grid place-items-center px-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-3">
        <h2 className="text-xl font-semibold">Admin Login</h2>
        <Input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />

        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="gradient-primary w-full" type="submit">
          Login
        </Button>
      </form>
    </div>
  );
}

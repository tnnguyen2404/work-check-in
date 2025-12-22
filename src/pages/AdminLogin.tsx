import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    const ADMIN_USERNAME = "admin";
    const ADMIN_PASSWORD = "4869";

    if (password === ADMIN_PASSWORD && username === ADMIN_USERNAME) {
      sessionStorage.setItem("isAdmin", "true");
      sessionStorage.setItem("username", username);
      navigate("/admin-dashboard");
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

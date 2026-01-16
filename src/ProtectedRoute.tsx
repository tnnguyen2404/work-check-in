import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAdminAuthed } from "./auth";

export default function ProtectedRoute() {
  const location = useLocation();

  if (!isAdminAuthed()) {
    return (
      <Navigate to="/admin-login" replace state={{ from: location.pathname }} />
    );
  }

  return <Outlet />;
}

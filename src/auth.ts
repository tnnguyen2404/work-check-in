
const KEY = "isAdmin";

export function isAdminAuthed() {
  return sessionStorage.getItem(KEY) === "true";
}

export function setAdminToken() {
  sessionStorage.setItem(KEY, "true");
}

export function clearAdminToken() {
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem("username");
}

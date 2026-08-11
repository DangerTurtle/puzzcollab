"use client";

export function LogoutButton() {
  return (
    <button
      className="button secondary small"
      onClick={async () => {
        await fetch("/oauth/logout", { method: "POST" });
        window.location.href = "/";
      }}
    >
      Sign out
    </button>
  );
}

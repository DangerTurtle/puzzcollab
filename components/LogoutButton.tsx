"use client";

export function LogoutButton() {
  return (
    <button
      className="text-button"
      onClick={async () => {
        await fetch("/oauth/logout", { method: "POST" });
        window.location.href = "/";
      }}
    >
      sign out
    </button>
  );
}

import { useEffect, useState } from "react";

export default function FadeInPanel({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      style={{
        opacity: ready ? 1 : 0,
        transform: ready ? "translateY(0px)" : "translateY(8px)",
        transition: "opacity 220ms ease-out, transform 220ms ease-out",
      }}
    >
      {children}
    </div>
  );
}

import { useEffect, useState } from "react";

export default function FadeScale({ children, delay = 0 }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return <div className={`fade-scale ${show ? "show" : ""}`}>{children}</div>;
}

"use client";

import { useEffect, useState } from "react";

export function LocalDateTimeText({ value }: { value: string }) {
  const [formatted, setFormatted] = useState(value);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFormatted(new Date(value).toLocaleString());
    });
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return formatted;
}

"use client";

import * as React from "react";

export function NutrientViewer({
  file, className, ...props
}: React.ComponentProps<"div"> & { file: File }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [fileBuffer, setFileBuffer] = React.useState<ArrayBuffer | null>(null);

  React.useEffect(() => {
    const reader = new FileReader();
    reader.onload = e => {
      setFileBuffer(e.target?.result as ArrayBuffer);
    }
    reader.readAsArrayBuffer(file);
  }, [file]);
  
  React.useEffect(() => {
    const container = containerRef.current;
    let cleanup = () => {};
    
    (async () => {
      const Viewer = (await import("@nutrient-sdk/viewer")).default;
      Viewer.unload(container);

      if (container && Viewer && fileBuffer) {
        Viewer.load({
          container,
          document: fileBuffer,
          baseUrl: `${window.location.protocol}//${window.location.host}/`,
        });
      }

      cleanup = () => {
        Viewer.unload(container);
      };
    })();

    return cleanup;
  }, [fileBuffer]);

  return (
    <div
      ref={containerRef}
      className={className}
      {...props}
    />
  );
}

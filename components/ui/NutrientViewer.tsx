"use client";

import type * as NutrientType from "@nutrient-sdk/viewer";
import * as React from "react";

export function NutrientViewer({
  file, className, ...props
}: React.ComponentProps<"div"> & { file: File }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewerRef = React.useRef<NutrientType.Instance>(null);
  const [fileBuffer, setFileBuffer] = React.useState<ArrayBuffer | null>(null);

  // Hide toolbar and sidebar when on fullscreen mode
  const onFullScreenChange = () => {
    viewerRef.current?.setViewState(state => {
      const isFullscreen = !!document.fullscreenElement;
      return state
        .set("showToolbar", !isFullscreen)
        .set("sidebarMode", isFullscreen ? null : "THUMBNAILS");
    });
  };

  // Add event listeners
  React.useEffect(() => {
    document.addEventListener("fullscreenchange", onFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullScreenChange);
    };
  }, []);

  // Request file content read into a raw buffer for direct access
  React.useEffect(() => {
    const reader = new FileReader();
    reader.onload = e => {
      setFileBuffer(e.target?.result as ArrayBuffer);
    }
    reader.readAsArrayBuffer(file);
  }, [file]);
  
  // After the file has been read, reload the Nutrient viewer component
  React.useEffect(() => {
    const container = containerRef.current;
    let cleanup = () => {};
    
    (async () => {
      const pspdfKit = (await import("@nutrient-sdk/viewer")).default;
      pspdfKit.unload(container);

      if (container && pspdfKit && fileBuffer) {
        // Define toolbar items, modify if needed
        const toolbarItems: NutrientType.ToolbarItem[] = [
          { type: "search" },
          { type: "highlighter" },
        ];

        // Include fullscreen toggle if browser support fullscreen item
        if (document.fullscreenEnabled) {
          toolbarItems.push({
            type: "custom",
            title: "Toggle fullscreen",
            onPress: async () => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                await containerRef.current?.requestFullscreen();
              }
            },
          });
        }

        pspdfKit.load({
          container,
          document: fileBuffer,
          baseUrl: `${window.location.protocol}//${window.location.host}/`,
          toolbarItems,
          toolbarPlacement: "BOTTOM",
          theme: "DARK",
          initialViewState: new pspdfKit.ViewState({
            layoutMode: "SINGLE",
            scrollMode: "PER_SPREAD",
            sidebarMode: "THUMBNAILS",
            sidebarPlacement: "END",
          })
        }).then(i => {
          viewerRef.current = i;
        });
      }

      cleanup = () => {
        pspdfKit.unload(container);
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

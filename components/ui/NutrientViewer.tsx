"use client";

import type * as NutrientType from "@nutrient-sdk/viewer";
import * as React from "react";

export interface NutrientViewerRef {
  toggleFullscreen: () => Promise<void>;
  setCurrentPage: (i: number) => void;
  nextPage: () => void;
  previousPage: () => void;
}

export type NutrientViewerProps = React.ComponentProps<"div"> & {
  file: File;
}

export const NutrientViewer = React.forwardRef<NutrientViewerRef, NutrientViewerProps>(function NutrientViewer({
  file, className, ...props
}, ref) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewerRef = React.useRef<NutrientType.Instance>(null);

  const [fileBuffer, setFileBuffer] = React.useState<ArrayBuffer | null>(null);
  
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      await containerRef.current?.requestFullscreen();
    }
  };

  const setCurrentPage = (i: number) => {
    const viewer = viewerRef.current;
    if (viewer && 0 <= i && i < viewer.totalPageCount) {
      viewer.setViewState(state => state
        .set("currentPageIndex", i)
      );
    }
  };
  
  const nextPage = () => viewerRef.current && setCurrentPage(viewerRef.current.viewState.currentPageIndex + 1);
  const previousPage = () => viewerRef.current && setCurrentPage(viewerRef.current.viewState.currentPageIndex - 1);

  // Forward handles to parent component to control fullscreen mode
  React.useImperativeHandle(ref, () => ({
    toggleFullscreen,
    setCurrentPage,
    nextPage,
    previousPage,
  }));

  // Hide toolbar and sidebar when on fullscreen mode
  const onFullScreenChange = () => {
    const isFullscreen = !!document.fullscreenElement;
    viewerRef.current?.setViewState(state => state
      .set("showToolbar", !isFullscreen)
      .set("sidebarMode", isFullscreen ? null : "THUMBNAILS")
    );
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
          
          // Call onFullScreenChange() once to handle the case when the page is already in fullscreen mode
          onFullScreenChange();
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
});

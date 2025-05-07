"use client";

import { useEffect } from "react";

export function GrammarlyRemover() {
    useEffect(() => {
        // Remove Grammarly attributes from DOM elements after client-side hydration
        const elementsWithGrammarly = document.querySelectorAll(
            "[data-gr-ext-installed], [data-new-gr-c-s-check-loaded]"
        );

        elementsWithGrammarly.forEach((element) => {
            element.removeAttribute("data-gr-ext-installed");
            element.removeAttribute("data-new-gr-c-s-check-loaded");
        });
    }, []);

    // This component doesn't render anything to the DOM
    return null;
}

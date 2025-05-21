import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Loads a script from the given source URL.
 * @param src The URL to the external file that contains the source code.
 * @param onLoad Called after the script is loaded.
 * @param onError Called when an error occurred during loading.
 * @returns A cleanup function that removes the script element.
 */
export function loadScript(
    src: string,
    onLoad?: HTMLScriptElement["onload"],
    onError?: HTMLScriptElement["onerror"]
) {
    const scriptElement = document.createElement("script");
    scriptElement.src = src;
    scriptElement.async = true;

    if (onLoad) scriptElement.onload = onLoad;
    if (onError) scriptElement.onerror = onError;

    document.body.appendChild(scriptElement);
    return () => {
        try {
            if (scriptElement.parentNode) {
                scriptElement.parentNode.removeChild(scriptElement);
            }
        } catch (e) {
            console.error(`Error when removing script ${src}: `, e);
        }
    };
}

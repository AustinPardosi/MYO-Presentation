import { loadScript } from "@/lib/utils";
import { MyoStatic } from "Myo";
import { useEffect, useState } from "react";

let myoJsLoading: Promise<void> | null = null;
let myoVecLoading: Promise<void> | null = null;

interface UseMyoArgs {
    vector?: boolean;
}

export function useMyo(
    args: UseMyoArgs = {}
): [MyoStatic, true, null] | [null, false, Error | null] {
    const [myoStatic, setMyoStatic] = useState<MyoStatic | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (window.Myo) {
            console.log("useMyo: Using existing Myo static object");
            setMyoStatic(window.Myo);
            setLoaded(true);
            return;
        }

        const promises: Promise<void>[] = [];
        if (!myoJsLoading) {
            myoJsLoading = new Promise((resolve, reject) => {
                loadScript(
                    "/myo.js",
                    () => resolve(),
                    (e) => reject(e)
                );
            });
            promises.push(myoJsLoading);

            if (args.vector) {
                if (!myoVecLoading) {
                    myoVecLoading = new Promise((resolve, reject) => {
                        loadScript(
                            "/vector.myo.js",
                            () => resolve(),
                            (e) => reject(e)
                        );
                    });
                }
                promises.push(myoVecLoading);
            }
        }

        Promise.all(promises)
            .then(() => {
                if (window.Myo) {
                    console.log("useMyo: Loaded Myo");
                    setMyoStatic(window.Myo);
                    setLoaded(true);
                } else {
                    throw new Error(
                        "useMyo: Failed to retrieve Myo static object"
                    );
                }
            })
            .catch((e) => {
                setError(e);
                console.error(e);
            });
    }, [args.vector]);

    return loaded ? [myoStatic!, true, null] : [null, false, error!];
}

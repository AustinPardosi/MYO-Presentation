import { useMyo } from "@/hooks/use-myo";
import { VectorData } from "Myo";
import { useEffect, useRef, useState } from "react";

type Vec2 = { x: number; y: number };

export function PointerOverlay() {
    const eventHandlersRef = useRef<Record<string, string>>({});

    const [myo, myoLoaded, myoLoadError] = useMyo({ vector: true });
    const [normPointerPos, setNormPointerPos] = useState<Vec2 | null>(null);

    const updatePointerPos = (vec: VectorData) => {
        setNormPointerPos(() => {
            const clampedVec: Vec2 = {
                x: Math.max(-1, Math.min(1, vec.x)),
                y: Math.max(-1, Math.min(1, vec.y)),
            };
            return {
                x: 50 + clampedVec.x * 50,
                y: 50 - clampedVec.y * 50,
            };
        });
    };

    useEffect(() => {
        if (myoLoaded) {
            if (eventHandlersRef.current["vector"]) {
                myo.off(eventHandlersRef.current["vector"]);
            }
            
            eventHandlersRef.current["vector"] = myo.on(
                "vector",
                updatePointerPos
            );
            if (myo.myos.length > 0) {
                myo.myos[0].zeroOrientation();
            }
        } else if (myoLoadError) {
            console.log("Error when loading Myo:", myoLoadError);
        }
    }, [myo, myoLoadError, myoLoaded]);

    return (
        normPointerPos && (
            <div
                className="absolute w-4 h-4 z-50 rounded-full bg-red-400 shadow-2xl shadow-red-500/50"
                style={{
                    left: `${normPointerPos.x}%`,
                    top: `${normPointerPos.y}%`,
                    transform: "translate(-50%, -50%)",
                }}
            />
        )
    );
}

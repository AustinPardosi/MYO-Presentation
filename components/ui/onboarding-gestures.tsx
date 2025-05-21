import Image from "next/image";
import { Button } from "./button";
import { useRef } from "react";
import { NutrientViewerRef } from "./NutrientViewer";
import { MyoController } from "./MyoController";
import React from "react";
import { MyoInstance, Pose } from "Myo";

type GestureKey =
    | "unlock"
    | "next"
    | "prev"
    | "fullscreen"
    | "activatePointer"
    | "deactivatePointer"
    | "end";

const gestures: Record<
    GestureKey,
    {
        name: string;
        icon: string;
        description: string;
    }
> = {
    unlock: {
        name: "Double Tap",
        icon: "/gesture-icons/double-tap.png",
        description: "**Double tap** to unlock gesture",
    },
    next: {
        name: "Wave Left",
        icon: "/gesture-icons/wave-left.png",
        description:
            "**Double tap** to unlock\n**Wave left** to go to the next slide",
    },
    prev: {
        name: "Wave Right",
        icon: "/gesture-icons/wave-right.png",
        description:
            "**Double tap** to unlock\n**Wave right** to go to the previous slide",
    },
    fullscreen: {
        name: "Fist",
        icon: "/gesture-icons/fist.png",
        description:
            "**Double tap** to unlock\n**Clench your fist** to exit fullscreen",
    },
    activatePointer: {
        name: "Spread",
        icon: "/gesture-icons/spread.png",
        description:
            "**Double tap** to unlock\n**Spread your fingers** to go to activate pointer\nThe starting point is at the center of the screen",
    },
    deactivatePointer: {
        name: "Spread",
        icon: "/gesture-icons/spread.png",
        description:
            "**Double tap** to unlock\n**Spread your fingers** to go to deactivate pointer",
    },
    end: {
        name: "End",
        icon: "",
        description:
            "Great! You’ve learned all the gestures. Now you can present with Myo",
    },
};

function formatDescription(description: string) {
    const lines = description.split("\n");

    return lines.map((line, idx) => (
        <p key={idx} className="text-xl text-white">
            {line
                .split(/(\*\*[^*]+\*\*)/g)
                .map((part, i) =>
                    part.startsWith("**") && part.endsWith("**") ? (
                        <strong key={i}>{part.slice(2, -2)}</strong>
                    ) : (
                        <span key={i}>{part}</span>
                    )
                )}
        </p>
    ));
}

export default function OnboardingGestures({
    gesture,
    handleBackClick,
    handleNextStep,
    handleHandledPose,
}: {
    gesture: GestureKey;
    handleBackClick: () => void;
    handleNextStep: () => void;
    handleHandledPose?: (gesture: Exclude<Pose, "rest">, myo: MyoInstance) => void;
}) {
    const data = gestures[gesture];
    const isUnlock = gesture === "unlock";
    const isEnd = gesture === "end";

    const viewerRef = useRef<NutrientViewerRef>(null);
    // const unlockedRef = React.useRef(false);

    return (
        <>
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="flex flex-col rounded-xl p-6 shadow-lg text-center space-y-4 max-w-sm w-full">
                    {/* Always show unlock gesture first if not "unlock" */}
                    <div className="flex flex-row gap-8 mb-10">
                        {!isUnlock && !isEnd && (
                            <Image
                                src={gestures.unlock.icon}
                                alt={gestures.unlock.name}
                                width={150}
                                height={150}
                                className="mx-auto"
                            />
                        )}
                        {!isEnd && (
                            <Image
                                src={data.icon}
                                alt={data.name}
                                width={150}
                                height={150}
                                className="mx-auto"
                            />
                        )}
                    </div>
                    {formatDescription(data.description)}
                    {!isEnd && (
                        <Button
                            variant="outline"
                            onClick={handleNextStep}
                            className="w-fit self-center mt-8 mb-0 cursor-pointer hover:bg-white/10 hover:text-white"
                        >
                            Next
                        </Button>
                    )}
                    <Button
                        variant="link"
                        className="w-fit self-center p-0 text-white text-right text-xs font-semibold cursor-pointer"
                        onClick={handleBackClick}
                    >
                        {isEnd ? "Exit tutorial" : "Skip"}
                    </Button>
                </div>
            </div>

            <MyoController
                onGesture={(myoGesture, myo) => {
                    if (isEnd) return;

                    if (myoGesture === "double_tap") {
                        handleHandledPose?.("double_tap", myo);
                        // unlockedRef.current = true;

                        if (isUnlock) {
                            handleNextStep(); // go to next step immediately
                            myo.vibrate("short");
                            console.log(`onboarding: gestureLearned=${gesture}, myoGesture=${myoGesture}`);
                        }

                        return;
                    }

                    // Filter hanya gesture yang diinginkan (kecuali 'rest')
                    if (!isUnlock && myoGesture !== "rest") {
                        console.log("onboarding ", myoGesture);
                        if (
                            myoGesture === "fist" ||
                            myoGesture === "wave_in" ||
                            myoGesture === "wave_out" ||
                            myoGesture === "fingers_spread"
                        ) {
                            handleHandledPose?.(
                                myoGesture,
                                myo
                            );
                            handleNextStep();
                            myo.vibrate("short");
                            console.log(`onboarding: gestureLearned=${gesture}, myoGesture=${myoGesture}`);
                        }
                    }
                }}
                onConnect={viewerRef.current?.handleMyoConnect}
                onDisconnect={viewerRef.current?.handleMyoDisconnect}
                onError={viewerRef.current?.handleMyoError}
                onStatusChange={viewerRef.current?.handleMyoStatusChange}
                appName="myo.presentation.app"
            />
        </>
    );
}

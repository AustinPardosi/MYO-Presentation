import Image from "next/image";
import { Button } from "./button";

type GestureKey = "unlock" | "next" | "prev" | "fullscreen" | "activatePointer" | "deactivatePointer" | "end";

const gestures: Record<GestureKey, {
    name: string;
    icon: string;
    description: string;
}> = {
    unlock: {
        name: "Double Tap",
        icon: "/gesture-icons/double-tap.png",
        description: "**Double tap** to unlock gesture",
    },
    next: {
        name: "Wave Left",
        icon: "/gesture-icons/wave-left.png",
        description: "**Double tap** to unlock\n**Wave left** to go to the next slide",
    },
    prev: {
        name: "Wave Right",
        icon: "/gesture-icons/wave-right.png",
        description: "**Double tap** to unlock\n**Wave right** to go to the previous slide",
    },
    fullscreen: {
        name: "Fist",
        icon: "/gesture-icons/fist.png",
        description: "**Double tap** to unlock\n**Clench your fist** to exit fullscreen",
    },
    activatePointer: {
        name: "Spread",
        icon: "/gesture-icons/spread.png",
        description: "**Double tap** to unlock\n**Spread your fingers** to go to activate pointer\nThe starting point is at the center of the screen",
    },
    deactivatePointer: {
        name: "Spread",
        icon: "/gesture-icons/spread.png",
        description: "**Double tap** to unlock\n**Spread your fingers** to go to deactivate pointer",
    },
    end: {
        name: "End",
        icon: "",
        description: "Great! You’ve learned all the gestures. Now you can present with Myo",
    }
};

function formatDescription(description: string) {
    const lines = description.split("\n");

    return lines.map((line, idx) => (
        <p key={idx} className="text-xl text-white">
            {line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
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
    handleNextStep
}: { 
    gesture: GestureKey,
    handleBackClick: () => void,
    handleNextStep: () => void
}) {
    const data = gestures[gesture];
    const isUnlock = gesture === "unlock";
    const isEnd = gesture === "end";

    return (
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
                    {!isEnd && <Image
                        src={data.icon}
                        alt={data.name}
                        width={150}
                        height={150}
                        className="mx-auto"
                    />}
                </div>
                <p>
                    {formatDescription(data.description)}
                </p>
                {!isEnd && <Button 
                    variant="outline"
                    onClick={handleNextStep}
                    className="w-fit self-center mt-8 mb-0 cursor-pointer hover:bg-white/10 hover:text-white"
                >
                    Next
                </Button>}
                <Button
                    variant="link" 
                    className="w-fit self-center p-0 text-white text-right text-xs font-semibold cursor-pointer"
                    onClick={handleBackClick}
                >
                    {isEnd ? 'Exit tutorial' : 'Skip'}
                </Button>
            </div>
        </div>
    );
}

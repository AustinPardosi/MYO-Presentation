import Image from "next/image"
import { Button } from "./button";

export default function OnboardingPresent({ handleBackClick } : { handleBackClick: () => void }) {
    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex gap-4 items-start justify-end pt-20 pr-20 pointer-events-auto">
            {/* Add any hint or guidance text here if needed */}
            <div className="flex flex-col gap-4 w-[20%] items-end text-white text-right">
                <p className="text-lg">Click <strong>Present</strong> to start the presentation mode</p>
                <Button
                    variant="link" 
                    className="w-fit p-0 text-white text-right text-xs underline font-semibold hover:cursor-pointer"
                    onClick={handleBackClick}
                >
                    Skip
                </Button>
            </div>
            <Image
                src="/arc-dash.png"
                alt="arc dashed line"
                width={28}
                height={20}
                style={{ width: "auto" }}
                priority
            />
        </div>
    );
}

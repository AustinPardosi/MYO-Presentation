import { Button } from "./button";

export default function OnboardingClosing({ 
    handleBackClick, 
    handleDisableOnboarding 
} : { 
    handleBackClick: () => void, 
    handleDisableOnboarding: () => void, 
}) {
    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex gap-4 items-start justify-end pt-20 pr-20 pointer-events-auto">
            <div className="flex flex-col rounded-xl p-6 shadow-lg text-center space-y-4 max-w-sm w-full">
                Great! You’ve learned all the gestures. Now you can present with Myo.
                <Button 
                    variant="outline"
                    onClick={handleDisableOnboarding}
                    className="w-fit self-center mt-8 mb-0 cursor-pointer hover:bg-white/10 hover:text-white"
                >
                    Continue with sample presentation
                </Button>
                <Button
                    variant="link" 
                    className="w-fit p-0 text-white text-right text-xs underline font-semibold hover:cursor-pointer"
                    onClick={handleBackClick}
                >
                    Back to upload
                </Button>
            </div>
        </div>
    );
}
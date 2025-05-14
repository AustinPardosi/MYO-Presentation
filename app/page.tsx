"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Upload } from "@deemlol/next-icons";
import {
    NutrientViewer,
    NutrientViewerRef,
} from "@/components/ui/NutrientViewer";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import OnboardingGestures from "@/components/ui/onboarding-gestures";
import OnboardingPresent from "@/components/ui/onboarding-present";
import { MyoController } from "@/components/ui/MyoController";

// Type untuk Recent Files
type RecentFile = {
    id: string;
    name: string;
    size: number;
    date: string;
    path: string;
};

// Komponen file uploader yang hanya dirender di sisi klien
export default function Home() {
    const [isDragging, setIsDragging] = useState(false);
    const [showViewer, setShowViewer] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
    const [onboardingStep, setOnboardingStep] = useState<GestureKey | null>(null);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [showOnboardingPresent, setShowOnboardingPresent] = useState(false);

    const [showTutorial, setShowTutorial] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const viewerRef = useRef<NutrientViewerRef>(null);
    const router = useRouter();
    const onboardingSequence: GestureKey[] = [
        "unlock",
        "next",
        "prev",
        "activatePointer",
        "deactivatePointer",
        "fullscreen",
        "end"
    ];

    // Load recent files from localStorage
    useEffect(() => {
        const savedRecentFiles = localStorage.getItem("recentFiles");
        if (savedRecentFiles) {
            try {
                setRecentFiles(JSON.parse(savedRecentFiles));
            } catch (error) {
                console.error(
                    "Error parsing recent files from localStorage:",
                    error
                );
                localStorage.removeItem("recentFiles");
            }
        }
    }, []);

    // Save recent files to localStorage whenever it changes
    useEffect(() => {
        if (recentFiles.length > 0) {
            localStorage.setItem("recentFiles", JSON.stringify(recentFiles));
        }
    }, [recentFiles]);

    const addToRecentFiles = (file: File) => {
        // Gunakan nilai stabil untuk id
        const newRecentFile: RecentFile = {
            id: `${file.name}-${file.size}-${file.lastModified}`,
            name: file.name,
            size: file.size,
            // Format tanggal dengan timestamp tidak sebagai string untuk menghindari perbedaan format locale
            date: new Date().toISOString(),
            path: URL.createObjectURL(file),
        };

        // Update recent files list (keep maximum 10 files)
        setRecentFiles((prev) => {
            // Remove duplicates by name
            const filteredFiles = prev.filter((f) => f.name !== file.name);
            // Add new file at the beginning and limit to 10 files
            return [newRecentFile, ...filteredFiles].slice(0, 10);
        });
    };

    const handleFile = (file: File) => {
        // Check if file is PPTX or PPT - more detailed check
        if (
            file.name.toLowerCase().endsWith(".pptx") ||
            file.name.toLowerCase().endsWith(".ppt") ||
            file.type ===
                "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
            file.type === "application/vnd.ms-powerpoint"
        ) {
            setIsLoading(true);

            // Create object URL for the file (hanya berjalan di client)
            const url = URL.createObjectURL(file);
            setFileUrl(url);

            setSelectedFile(file);
            setShowViewer(true);
            router.push("?viewer=true");

            // Add to recent files
            addToRecentFiles(file);

            // Set loading to false since we're not actually loading anything
            setIsLoading(false);
        } else {
            toast.error("Please upload a PPTX or PPT file");
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            handleFile(file);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            handleFile(file);
        }
    };

    const handleBrowseClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleBackClick = () => {
        // Release object URL if exists
        if (fileUrl) {
            URL.revokeObjectURL(fileUrl);
        }
        setShowViewer(false);
        router.push("/");

        setSelectedFile(null);
        setFileUrl(null);
    };

    const handlePresentClick = () => {
    if (showOnboardingPresent) {
        setShowOnboardingPresent(false); // hide onboarding overlay
        viewerRef.current?.toggleFullscreen();
        // show gestures after fullscreen enters (delay to wait for fullscreen)
        setTimeout(() => {
            setShowOnboarding(true);
            setOnboardingStep("unlock");
        }, 500);
    } else {
        viewerRef.current?.toggleFullscreen();
    }
};

    // const startOnboarding = () => {
    //     setShowOnboarding(true);
    //     setOnboardingStep("unlock");
    // };
    const startOnboarding = () => {
        setShowOnboardingPresent(true);
    };

    const handleNextStep = () => {
        const currentIndex = onboardingSequence.indexOf(onboardingStep!);
        const nextStep = onboardingSequence[currentIndex + 1];
        if (nextStep) setOnboardingStep(nextStep);
        else setShowOnboarding(false); // End onboarding

    const toggleTutorial = () => {
        setShowTutorial(!showTutorial);
    };

    return (
        <>
            {!showViewer ? (
                <div className="flex flex-col items-center justify-center w-full min-h-screen h-full p-8">
                    <div className="flex flex-col items-center justify-center flex-grow w-full">
                        {/* Logo */}
                        <div className="mb-10">
                            <Image
                                src="/logo-image.svg"
                                alt="Logo"
                                width={200}
                                height={50}
                                style={{ height: "auto" }}
                                priority
                            />
                        </div>

                        {/* Drag & Drop Area */}
                        <div
                            className={`w-full max-w-[500px] h-[300px] border border-dashed ${
                                isDragging
                                    ? "border-[#27592A] bg-[#131913]"
                                    : "border-gray-500"
                            } rounded-md p-8 flex flex-col items-center justify-center cursor-pointer`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={handleBrowseClick}
                        >
                            <div className="mb-6">
                                <Upload size={40} color="#FFFFFF" />
                            </div>
                            <p className="mb-4 text-center">
                                Drag & Drop PPTX/PPT File
                            </p>
                            <p className="mb-4 text-center text-sm text-gray-500">
                                or
                            </p>
                            <Button
                                className="bg-primary text-white hover:bg-[#27592A]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleBrowseClick();
                                }}
                                disabled={isLoading}
                            >
                                {isLoading ? "Loading..." : "Browse File"}
                            </Button>
                            <Input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".pptx,.ppt"
                                onChange={handleFileInputChange}
                            />
                        </div>

                        {/* Tutorial Link */}
                        <div className="mt-4 text-sm">
                            <span>First time using Myo for presentation? </span>
                            <Button variant="link" className="font-bold text-accent underline p-0" onClick={async () => {
                                const response = await fetch("/TerraFarm.pptx");
                                const blob = await response.blob();
                                const file = new File([blob], "TerraFarm.pptx", { type: blob.type });
                                handleFile(file);
                                setTimeout(() => startOnboarding(), 4000);
                            }}>
                                See tutorial
                            </Button>
                            <button
                                onClick={toggleTutorial}
                                className="font-bold text-accent underline"
                            >
                                See tutorial
                            </button>
                        </div>

                        {/* Tutorial Panel */}
                        {showTutorial && (
                            <div className="mt-6 p-6 bg-gray-800 rounded-lg max-w-[500px] text-left">
                                <h3 className="text-xl font-bold mb-4">
                                    Tutorial Menggunakan Myo untuk Presentasi
                                </h3>
                                <p className="mb-4">
                                    Pastikan Anda telah menginstal{" "}
                                    <a
                                        href="https://support.getmyo.com/hc/en-us/articles/360018409792-Myo-Connect-for-Windows-and-Mac"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-accent underline"
                                    >
                                        Myo Connect
                                    </a>{" "}
                                    dan perangkat Myo Anda sudah terhubung.
                                </p>

                                <h4 className="text-lg font-bold mt-4 mb-2">
                                    Gestur yang Didukung:
                                </h4>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>
                                        <strong>Wave In</strong> - Pindah ke
                                        slide sebelumnya
                                    </li>
                                    <li>
                                        <strong>Wave Out</strong> - Pindah ke
                                        slide berikutnya
                                    </li>
                                    <li>
                                        <strong>Fist</strong> -
                                        Aktifkan/nonaktifkan mode layar penuh
                                    </li>
                                    <li>
                                        <strong>Fingers Spread</strong> -
                                        Tampilkan/sembunyikan thumbnail slide
                                    </li>
                                    <li>
                                        <strong>Double Tap</strong> - Reset
                                        tampilan (zoom dan sidebar)
                                    </li>
                                </ul>

                                <h4 className="text-lg font-bold mt-4 mb-2">
                                    Langkah Persiapan:
                                </h4>
                                <ol className="list-decimal pl-6 space-y-2">
                                    <li>
                                        Pastikan Myo Connect berjalan di
                                        komputer Anda
                                    </li>
                                    <li>
                                        Kenakan perangkat Myo pada lengan Anda
                                    </li>
                                    <li>
                                        Lakukan gerakan sync (terentang lalu
                                        mengepal)
                                    </li>
                                    <li>
                                        Unggah file presentasi Anda di aplikasi
                                        ini
                                    </li>
                                    <li>
                                        Status koneksi Myo akan ditampilkan di
                                        toolbar presentasi
                                    </li>
                                </ol>

                                <Button
                                    onClick={toggleTutorial}
                                    className="mt-6 bg-primary text-white hover:bg-[#27592A]"
                                >
                                    Tutup Tutorial
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col w-full h-screen overflow-hidden">
                    {showOnboardingPresent && <OnboardingPresent handleBackClick={handleBackClick} />}
                    {showOnboarding && onboardingStep && <OnboardingGestures gesture={onboardingStep} handleBackClick={handleBackClick} handleNextStep={handleNextStep} />
                        }
                        {/* Header (File Info) */}
                        <div className="my-6 mx-4 flex justify-between items-center shrink-0">
                            <Button onClick={handleBackClick} className="bg-transparent hover:bg-transparent">
                                <Image src="/logo-image.svg" alt="Logo" width={80} height={20} style={{ height: "auto" }} priority />
                            </Button>
                            <div>
                                <h2 className="text-xl font-medium">{selectedFile?.name}</h2>
                            </div>
                            {/* <Button onClick={handleBackClick} className="bg-gray-200 text-black hover:bg-gray-300">
                                Back to Upload
                            </Button> */}
                            <Button onClick={handlePresentClick} className="z-60 bg-gray-200 text-black hover:bg-gray-300 cursor-pointer">
                                Present
                            </Button>
                        </div>
                        <Button
                            onClick={handlePresentClick}
                            className="bg-gray-200 text-black hover:bg-gray-300"
                        >
                            Present
                        </Button>
                    </div>

                        {/* Basic File Display */}
                        {selectedFile && (
                            <div className="flex-grow w-full overflow-hidden">
                                <NutrientViewer 
                                    ref={viewerRef} 
                                    file={selectedFile} 
                                    className="w-full h-full"
                                    overlay={
                                        showOnboarding && onboardingStep && (
                                            <OnboardingGestures 
                                                gesture={onboardingStep} 
                                                handleBackClick={handleBackClick} 
                                                handleNextStep={handleNextStep} />
                                        )
                                    }
                                />
                            </div>
                        )}
                </div>
            )}
        </>
    );
}

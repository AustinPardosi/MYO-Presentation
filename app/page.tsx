"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";

// Type untuk Recent Files
type RecentFile = {
    id: string;
    name: string;
    size: number;
    date: string;
    path: string;
};

export default function Home() {
    const [isDragging, setIsDragging] = useState(false);
    const [showViewer, setShowViewer] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
    const [isBrowser, setIsBrowser] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Check if code is running in browser
    useEffect(() => {
        setIsBrowser(true);
    }, []);

    // Load recent files from localStorage
    useEffect(() => {
        if (!isBrowser) return;

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
    }, [isBrowser]);

    // Save recent files to localStorage whenever it changes
    useEffect(() => {
        if (!isBrowser) return;
        localStorage.setItem("recentFiles", JSON.stringify(recentFiles));
    }, [recentFiles, isBrowser]);

    const addToRecentFiles = (file: File) => {
        if (!isBrowser) return;

        // Create a new recent file entry
        const newRecentFile: RecentFile = {
            id: Date.now().toString(),
            name: file.name,
            size: file.size,
            date: new Date().toISOString(),
            path: URL.createObjectURL(file), // This URL will be invalid after page refresh
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
        // Log file details for debugging
        console.log("File info:", {
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: new Date(file.lastModified),
        });

        // Check if file is PPTX or PPT - more detailed check
        if (
            file.name.toLowerCase().endsWith(".pptx") ||
            file.name.toLowerCase().endsWith(".ppt") ||
            file.type ===
                "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
            file.type === "application/vnd.ms-powerpoint"
        ) {
            setIsLoading(true);

            // Create object URL for the file
            if (isBrowser) {
                const url = URL.createObjectURL(file);
                setFileUrl(url);
            }

            setSelectedFile(file);
            setShowViewer(true);

            // Add to recent files
            addToRecentFiles(file);

            // Set loading to false since we're not actually loading anything
            setIsLoading(false);
        } else {
            alert("Please upload a PPTX or PPT file");
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
        if (isBrowser && fileUrl) {
            URL.revokeObjectURL(fileUrl);
        }
        setShowViewer(false);
        setSelectedFile(null);
        setFileUrl(null);
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + " bytes";
        else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + " KB";
        else return (bytes / 1048576).toFixed(2) + " MB";
    };

    return (
        <div className="flex flex-col items-center justify-center w-full min-h-screen h-full p-8">
            {!showViewer ? (
                <div className="flex flex-col items-center justify-center flex-grow w-full">
                    {/* Logo */}
                    <div className="mb-10">
                        <Image
                            src="/logo-image.svg"
                            alt="Logo"
                            width={180}
                            height={50}
                            style={{ height: "auto" }}
                            priority
                        />
                    </div>

                    {/* Drag & Drop Area */}
                    <div
                        className={`w-full max-w-[500px] h-[300px] border border-dashed ${
                            isDragging
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-300"
                        } rounded-md p-8 flex flex-col items-center justify-center cursor-pointer`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={handleBrowseClick}
                    >
                        <div className="mb-6">
                            <Image
                                src="/icon-image.svg"
                                alt="Upload icon"
                                width={64}
                                height={64}
                                style={{ height: "auto" }}
                            />
                        </div>
                        <p className="mb-4 text-center">
                            Drag & Drop PPTX/PPT File
                        </p>
                        <p className="mb-4 text-center text-sm text-gray-500">
                            or
                        </p>
                        <Button
                            className="bg-gray-200 text-black hover:bg-gray-300"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleBrowseClick();
                            }}
                            disabled={isLoading}
                        >
                            {isLoading ? "Loading..." : "Browse File"}
                        </Button>
                        <input
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
                        <a href="#" className="text-blue-500 underline">
                            See tutorial
                        </a>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center flex-grow w-full">
                    {/* Simple Viewer (Lo-Fi version) */}
                    <div className="w-full max-w-5xl mb-4">
                        {/* File Info */}
                        <div className="mb-4 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-medium">
                                    {selectedFile?.name}
                                </h2>
                                <p className="text-gray-500 text-sm">
                                    {selectedFile &&
                                        formatFileSize(selectedFile.size)}
                                </p>
                            </div>
                            <Button
                                onClick={handleBackClick}
                                className="bg-gray-200 text-black hover:bg-gray-300"
                            >
                                Back to Upload
                            </Button>
                        </div>

                        {/* Basic File Display */}
                        <div className="w-full min-h-[600px] border border-gray-200 rounded-md overflow-auto bg-white p-8 flex flex-col items-center justify-center">
                            <div className="text-center max-w-md">
                                <Image
                                    src="/icon-image.svg"
                                    alt="PowerPoint file"
                                    width={100}
                                    height={100}
                                    style={{
                                        height: "auto",
                                        margin: "0 auto 20px",
                                    }}
                                />
                                <h3 className="text-xl font-medium mb-2">
                                    {selectedFile?.name}
                                </h3>
                                <p className="text-gray-500 mb-4">
                                    {selectedFile &&
                                        formatFileSize(selectedFile.size)}
                                </p>
                                <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
                                    <p className="mb-2">
                                        File berhasil diunggah.
                                    </p>
                                    <p className="text-gray-500 text-sm">
                                        Untuk melihat presentasi, siapkan
                                        implementasi viewer PowerPoint sesuai
                                        kebutuhan.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

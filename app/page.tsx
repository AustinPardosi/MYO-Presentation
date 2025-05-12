"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Upload } from "@deemlol/next-icons";
import { NutrientViewer } from "@/components/ui/NutrientViewer";

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
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                        <a href="#" className="font-bold text-accent underline">
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
                        {selectedFile && <NutrientViewer
                            file={selectedFile}
                            className="w-full h-[600px]"
                        />}
                        {/* <div className="w-full min-h-[600px] border border-gray-700 rounded-md overflow-auto bg-[#141614] p-8 flex flex-col items-center justify-center">
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
                                        File uploaded successfully.
                                    </p>
                                    <p className="text-gray-500 text-sm">
                                        To view the presentation, prepare a
                                        PowerPoint viewer implementation as
                                        needed.
                                    </p>
                                </div>
                            </div>
                        </div> */}
                    </div>
                </div>
            )}
        </div>
    );
}

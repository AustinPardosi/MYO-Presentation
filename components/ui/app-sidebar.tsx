"use client";

import {  Clock } from "lucide-react";
import { useState, useEffect } from "react";

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
} from "@/components/ui/sidebar";

// Type untuk Recent Files
type RecentFile = {
    id: string;
    name: string;
    size: number;
    date: string;
    path: string;
};

// Fungsi untuk format ukuran file
const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + " KB";
    else return (bytes / 1048576).toFixed(2) + " MB";
};

export function AppSidebar() {
    const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

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

    const openRecentFile = (recentFile: RecentFile) => {
        // For demo purposes, we just show details
        alert(`This would open: ${recentFile.name}`);
    };

    return (
        <Sidebar>
            <SidebarContent>
                {/* Recent Files Section */}
                <SidebarGroup>
                    <SidebarGroupLabel>Recent Files</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <div className="px-2 space-y-4">
                            {recentFiles.length > 0 ? (
                                recentFiles.map((file) => (
                                    <div
                                        key={file.id}
                                        className="w-full h-auto border border-gray-200 rounded-md flex flex-col p-2 cursor-pointer hover:bg-gray-50"
                                        onClick={() => openRecentFile(file)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-gray-400" />
                                            <p className="font-medium text-sm truncate">
                                                {file.name}
                                            </p>
                                        </div>
                                        <p className="text-gray-500 text-xs ml-6">
                                            {formatFileSize(file.size)}
                                        </p>
                                        <p className="text-gray-400 text-xs ml-6 mt-1">
                                            {new Date(
                                                file.date
                                            ).toLocaleDateString()}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-gray-500 text-xs p-2">
                                    No recent files
                                </div>
                            )}
                        </div>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}

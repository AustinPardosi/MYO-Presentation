"use client";

import { useEffect, useState } from "react";

// Type untuk listener function
export type GestureHandler = <T>(timestamp: number, data?: T) => void;

// Type untuk mencatat timestamps gerakan
export interface GestureLog<T> {
    gesture: string;
    timestamp: number;
    data?: T;
}

// Props interface
interface MyoTutorialListenerProps {
    // Handler khusus untuk setiap gerakan
    onDoubleTap?: GestureHandler;
    onWaveRight?: GestureHandler;
    onWaveLeft?: GestureHandler;
    onFingersSpread?: GestureHandler;
    onFist?: GestureHandler;
    onRotate?: GestureHandler;
    onRest?: GestureHandler;

    // Handler umum untuk semua gerakan
    onAnyGesture?: (gesture: string, timestamp: number, data?: unknown) => void;

    // Flag untuk menampilkan log di console
    logToConsole?: boolean;

    // Flag untuk melacak semua gerakan dalam history
    keepHistory?: boolean;

    // Nama aplikasi untuk koneksi Myo
    appName?: string;
}

// Komponen utama
export function MyoTutorialListener({
    onDoubleTap,
    onWaveRight,
    onWaveLeft,
    onFingersSpread,
    onFist,
    onRotate,
    onRest,
    onAnyGesture,
    logToConsole = true,
    keepHistory = false,
    appName = "myo.tutorial.app",
}: MyoTutorialListenerProps) {
    // State untuk koneksi
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [connected, setConnected] = useState(false);

    // State untuk history gerakan jika diperlukan
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [gestureHistory, setGestureHistory] = useState<GestureLog<unknown>[]>([]);

    // Fungsi untuk tracking gerakan
    const trackGesture = (gesture: string, data?: unknown) => {
        const timestamp = Date.now();

        // Log ke console jika diminta
        if (logToConsole) {
            console.log(`Gesture detected: ${gesture}`, { timestamp, data });
        }

        // Simpan ke history jika diminta
        if (keepHistory) {
            setGestureHistory((prev) => [
                ...prev,
                { gesture, timestamp, data },
            ]);
        }

        // Panggil handler umum jika ada
        onAnyGesture?.(gesture, timestamp, data);

        // Return timestamp untuk digunakan di handler spesifik
        return timestamp;
    };
    
    // Inisialisasi dan setup Myo
    useEffect(() => {
        let scriptAdded = false;

        // Function untuk menginisialisasi Myo
        const initMyoListener = () => {
            if (!window.Myo) {
                console.error("Myo library not available");
                return;
            }

            try {
                // Hubungkan ke Myo Connect
                window.Myo.connect(appName);

                // Listener untuk koneksi
                window.Myo.on("connected", function () {
                    console.log("Myo connected!");
                    setConnected(true);

                    // Unlock Myo agar bisa menerima semua gerakan
                    try {
                        // Disable locking untuk tutorial
                        this.unlock(true);
                    } catch (e) {
                        console.warn("Failed to unlock Myo:", e);
                    }
                });

                // Listener untuk terputus
                window.Myo.on("disconnected", function () {
                    console.log("Myo disconnected!");
                    setConnected(false);
                });

                // GESTURE LISTENERS

                // Double Tap
                window.Myo.on("double_tap", function () {
                    const timestamp = trackGesture("double_tap");
                    onDoubleTap?.(timestamp);
                });

                // Wave In (Right)
                window.Myo.on("wave_in", function () {
                    const timestamp = trackGesture("wave_in");
                    onWaveRight?.(timestamp);
                });

                // Wave Out (Left)
                window.Myo.on("wave_out", function () {
                    const timestamp = trackGesture("wave_out");
                    onWaveLeft?.(timestamp);
                });

                // Fingers Spread
                window.Myo.on("fingers_spread", function () {
                    const timestamp = trackGesture("fingers_spread");
                    onFingersSpread?.(timestamp);
                });

                // Fist
                window.Myo.on("fist", function () {
                    const timestamp = trackGesture("fist");
                    onFist?.(timestamp);
                });

                // Rest position
                window.Myo.on("rest", function () {
                    const timestamp = trackGesture("rest");
                    onRest?.(timestamp);
                });

                // ORIENTATION LISTENER (Diperlukan untuk rotasi)
                window.Myo.on("orientation", function (orientation) {
                    // Implementasi deteksi rotasi sederhana
                    // Perhatikan bahwa ini hanyalah deteksi rotasi sederhana
                    if (Math.abs(orientation.x) > 0.7) {
                        const rotateType =
                            orientation.x > 0 ? "rotate_cw" : "rotate_ccw";
                        const timestamp = trackGesture(rotateType, orientation);
                        onRotate?.(timestamp, { type: rotateType, q: orientation });
                    }
                });
            } catch (error) {
                console.error("Error initializing Myo:", error);
            }
        };

        // Load Myo.js script
        try {
            const script = document.createElement("script");
            script.src = "/myo.js";
            script.async = true;

            script.onload = () => {
                // Inisialisasi setelah script di-load
                setTimeout(initMyoListener, 500);
            };

            script.onerror = () => {
                console.error("Failed to load Myo.js script");
            };

            document.body.appendChild(script);
            scriptAdded = true;
        } catch (error) {
            console.error("Error loading Myo script:", error);
        }

        // Cleanup saat komponen unmount
        return () => {
            if (window.Myo) {
                // Matikan semua event listener
                try {
                    window.Myo.off("connected");
                    window.Myo.off("disconnected");
                    window.Myo.off("double_tap");
                    window.Myo.off("wave_in");
                    window.Myo.off("wave_out");
                    window.Myo.off("fingers_spread");
                    window.Myo.off("fist");
                    window.Myo.off("rest");
                    window.Myo.off("orientation");
                } catch (e) {
                    console.warn("Error removing Myo listeners:", e);
                }
            }

            if (scriptAdded) {
                try {
                    const scriptElement = document.querySelector(
                        'script[src="/myo.js"]'
                    );
                    if (scriptElement && scriptElement.parentNode) {
                        scriptElement.parentNode.removeChild(scriptElement);
                    }
                } catch (e) {
                    console.warn("Error removing script:", e);
                }
            }
        };
    }, [
        onDoubleTap,
        onWaveRight,
        onWaveLeft,
        onFingersSpread,
        onFist,
        onRotate,
        onRest,
        onAnyGesture,
        logToConsole,
        appName,
    ]);

    // // Fungsi publik untuk mendapatkan status koneksi
    // const isConnected = () => connected;

    // // Fungsi publik untuk mendapatkan history gerakan
    // const getGestureHistory = () => gestureHistory;

    // Komponen ini tidak merender apa-apa (headless)
    return null;
}

// Helper hook untuk menggunakan MyoTutorialListener dalam functional components
export function useMyoGestures(
    options?: Omit<MyoTutorialListenerProps, "onAnyGesture">
) {
    const [lastGesture, setLastGesture] = useState<GestureLog<unknown> | null>(null);
    const [gestureHistory, setGestureHistory] = useState<GestureLog<unknown>[]>([]);

    // Handler untuk menangkap semua gerakan
    const handleAnyGesture = (
        gesture: string,
        timestamp: number,
        data?: unknown
    ) => {
        const gestureLog = { gesture, timestamp, data };
        setLastGesture(gestureLog);
        setGestureHistory((prev) => [...prev, gestureLog]);
    };

    return {
        MyoListener: (
            props: Omit<MyoTutorialListenerProps, "onAnyGesture">
        ) => (
            <MyoTutorialListener
                {...options}
                {...props}
                onAnyGesture={handleAnyGesture}
            />
        ),
        lastGesture,
        gestureHistory,
        clearHistory: () => setGestureHistory([]),
    };
}

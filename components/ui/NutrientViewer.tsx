"use client";

import type * as NutrientType from "@nutrient-sdk/viewer";
import * as React from "react";
import { MyoController } from "./MyoController";
import { toast } from "sonner";
import { MyoInstance, Pose } from "Myo";

type HandledPose = Exclude<Pose, "rest">;

// Tipe intensitas getaran
type VibrateIntensity = "short" | "medium" | "long";

// Mapping untuk nama gesture yang lebih user-friendly
const gestureNames = {
    wave_in: "Wave Right",
    wave_out: "Wave Left",
    fist: "Fist",
    fingers_spread: "Fingers Spread",
    double_tap: "Double Tap",
};

// Konfigurasi getaran untuk masing-masing gesture
const gestureVibrations: Record<HandledPose, VibrateIntensity> = {
    wave_in: "short",
    wave_out: "short",
    fist: "medium",
    fingers_spread: "short",
    double_tap: "short",
};

// Konfigurasi pesan toast untuk masing-masing gesture
const gestureMessages: Record<HandledPose, (isActive?: boolean) => string> = {
    wave_in: () => "Slide sebelumnya",
    wave_out: () => "Slide berikutnya",
    fist: (isEnteringFullscreen) =>
        isEnteringFullscreen
            ? "Masuk mode layar penuh"
            : "Keluar dari mode layar penuh",
    fingers_spread: (showSidebar) =>
        showSidebar ? "Membuka thumbnail" : "Menutup thumbnail",
    double_tap: (isUnlocked) =>
        isUnlocked ? "Myo Unlocked - Gesture dikontrol" : "Reset tampilan",
};

export interface NutrientViewerRef {
    toggleFullscreen: () => Promise<void>;
    setCurrentPage: (i: number) => void;
    handleHandledPose: (
        gesture: Exclude<Pose, "rest">,
        myo: MyoInstance
    ) => void;
    handleMyoConnect: (myo: MyoInstance) => void;
    handleMyoDisconnect: () => void;
    handleMyoError: (error: Error) => void;
    handleMyoStatusChange: (status: string) => void;
}

export const NutrientViewer = React.forwardRef<
    NutrientViewerRef,
    React.ComponentProps<"div"> & { file: File; overlay?: React.ReactNode }
>(function NutrientViewer({ file, className, overlay, ...props }, ref) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const viewerRef = React.useRef<NutrientType.Instance>(null);
    const [fileBuffer, setFileBuffer] = React.useState<ArrayBuffer | null>(
        null
    );
    const [pdfInitialized, setPdfInitialized] = React.useState(false);

    // Ref untuk menyimpan waktu terakhir gesture diproses
    const lastGestureTimeRef = React.useRef<number>(0);

    // Ref untuk melacak gerakan yang sudah diproses sejak unlock terakhir
    const processedGesturesRef = React.useRef<Set<HandledPose>>(new Set());

    // Helper untuk simulasi shortcut keyboard
    const simulateKeyboardShortcut = (
        key: string,
        keyCode: number,
        modifiers: {
            ctrlKey?: boolean;
            altKey?: boolean;
            shiftKey?: boolean;
        } = {}
    ) => {
        try {
            // Simulasi keydown event
            const event = new KeyboardEvent("keydown", {
                key,
                code: `Key${key.toUpperCase()}`,
                keyCode,
                ...modifiers,
                bubbles: true,
                cancelable: true,
            });
            document.dispatchEvent(event);

            // Simulasi keyup dengan delay kecil
            setTimeout(() => {
                const upEvent = new KeyboardEvent("keyup", {
                    key,
                    code: `Key${key.toUpperCase()}`,
                    keyCode,
                    ...modifiers,
                    bubbles: true,
                    cancelable: true,
                });
                document.dispatchEvent(upEvent);
            }, 50);

            return true;
        } catch (err) {
            console.error(`Error simulating keyboard shortcut ${key}:`, err);
            return false;
        }
    };

    // Fungsi untuk toggle fullscreen menggunakan simulasi Ctrl+M
    const toggleFullscreen = async () => {
        // simulateKeyboardShortcut("m", 77, { ctrlKey: true });
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            await containerRef.current?.requestFullscreen();
        }
    };

    // Fungsi untuk mengubah halaman
    const setCurrentPage = (i: number) => {
        if (
            viewerRef.current &&
            0 <= i &&
            i < viewerRef.current?.totalPageCount
        ) {
            viewerRef.current?.setViewState((state) =>
                state.set("currentPageIndex", i)
            );
        }
    };

    // Ekspos fungsi ke komponen parent
    React.useImperativeHandle(ref, () => ({
        toggleFullscreen,
        setCurrentPage,
        handleHandledPose,
        handleMyoConnect,
        handleMyoDisconnect,
        handleMyoError,
        handleMyoStatusChange,
    }));

    // Cek status WebSocket
    const isWebSocketOpen = () => {
        const myoAny = window.Myo as { socket?: WebSocket };
        return myoAny?.socket?.readyState === WebSocket.OPEN;
    };

    // Helper function untuk getaran dan feedback yang aman
    const handleVibrationAndToast = (
        gesture: HandledPose,
        myo: MyoInstance,
        param?: boolean
    ) => {
        try {
            // Toast pesan sesuai gesture
            const message = `${gestureNames[gesture]}: ${gestureMessages[
                gesture
            ](param)}`;
            toast.success(message, {
                style: {
                    fontWeight: "bold",
                    fontSize: "16px",
                    backgroundColor: "rgba(0, 0, 0, 0.8)",
                    color: "white",
                },
                duration: 2000,
            });

            // Cek apakah myo memiliki properti socket dan WebSocket sudah OPEN
            if (myo.connected && isWebSocketOpen()) {
                // Getaran sesuai konfigurasi
                myo.vibrate(gestureVibrations[gesture]);
            }
        } catch {
            // Error silenced
        }
    };

    // Handle Myo gestures for presentation control
    const handleHandledPose = (gesture: HandledPose, myo: MyoInstance) => {
        if (!viewerRef.current) return;

        // Update waktu terakhir gesture
        lastGestureTimeRef.current = Date.now();

        // Cek apakah gerakan sudah diproses sejak unlock terakhir
        if (processedGesturesRef.current.has(gesture)) {
            toast.info(
                `Gesture ${gestureNames[gesture]} sudah digunakan, double tap untuk reset`,
                {
                    style: {
                        fontWeight: "bold",
                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                        color: "#a2e9ff",
                    },
                    duration: 2000,
                }
            );
            return;
        }

        // Handle gesture berdasarkan jenisnya
        switch (gesture) {
            case "wave_in": {
                if (viewerRef.current) {
                    // Gunakan salah satu metode saja, tidak keduanya
                    if (document.fullscreenElement) {
                        // Dalam mode fullscreen, gunakan keyboard simulation
                        simulateKeyboardShortcut("ArrowRight", 39);
                    } else {
                        // Di luar fullscreen, gunakan setCurrentPage
                        const currentPage =
                            viewerRef.current.viewState.currentPageIndex;
                        setCurrentPage(currentPage + 1);
                    }

                    // Berikan feedback ke user
                    handleVibrationAndToast(gesture, myo);

                    // Tandai gesture ini sudah diproses
                    processedGesturesRef.current.add(gesture);
                }
                break;
            }
            case "wave_out": {
                if (viewerRef.current) {
                    // Gunakan salah satu metode saja, tidak keduanya
                    if (document.fullscreenElement) {
                        // Dalam mode fullscreen, gunakan keyboard simulation
                        simulateKeyboardShortcut("ArrowLeft", 37);
                    } else {
                        // Di luar fullscreen, gunakan setCurrentPage
                        const currentPage =
                            viewerRef.current.viewState.currentPageIndex;
                        setCurrentPage(currentPage - 1);
                    }

                    // Berikan feedback ke user
                    handleVibrationAndToast(gesture, myo);

                    // Tandai gesture ini sudah diproses
                    processedGesturesRef.current.add(gesture);
                }
                break;
            }
            case "fist": // Simulasi Ctrl+M untuk toggle fullscreen
                try {
                    // Dapatkan status sebelum simulasi
                    const isEnteringFullscreen = !document.fullscreenElement;

                    // Gunakan helper function yang sama
                    simulateKeyboardShortcut("m", 77, { ctrlKey: true });

                    // Tambahkan delay untuk feedback
                    setTimeout(() => {
                        handleVibrationAndToast(
                            gesture,
                            myo,
                            isEnteringFullscreen
                        );

                        // Tandai gesture ini sudah diproses
                        processedGesturesRef.current.add(gesture);
                    }, 500);
                } catch (err) {
                    console.error("Error processing fist gesture:", err);
                }
                break;
            case "fingers_spread": // Show all slides (thumbnails)
                try {
                    viewerRef.current.setViewState((state) => {
                        const showingSidebar = !state.sidebarMode;
                        const newSidebarMode = state.sidebarMode
                            ? null
                            : "THUMBNAILS";
                        handleVibrationAndToast(gesture, myo, showingSidebar);

                        // Tandai gesture ini sudah diproses
                        processedGesturesRef.current.add(gesture);
                        return state.set("sidebarMode", newSidebarMode);
                    });
                } catch (err) {
                    console.error(
                        "Error processing fingers_spread gesture:",
                        err
                    );
                }
                break;
        }
    };

    // Helper function untuk vibrate pada koneksi yang aman
    const vibrateOnEvent = (
        myo: MyoInstance,
        intensity: VibrateIntensity = "short"
    ) => {
        // Hanya kirim getaran jika WebSocket sudah OPEN
        setTimeout(() => {
            try {
                if (myo.connected && isWebSocketOpen()) {
                    myo.vibrate(intensity);
                }
            } catch {
                // Error silenced
            }
        }, 500); // Tambahkan delay untuk memastikan WebSocket siap
    };

    // Handle Myo connection
    const handleMyoConnect = (myo: MyoInstance) => {
        toast.success("Myo terhubung! Lakukan Double Tap untuk unlock gesture");
        vibrateOnEvent(myo);
    };

    // Handle Myo disconnection
    const handleMyoDisconnect = () => {
        toast.error("Myo terputus!");
    };

    const handleMyoLocked = () => {
        processedGesturesRef.current.clear();
        console.log("Myo locked");
    };

    // Handle Myo error
    const handleMyoError = (error: Error) => {
        toast.error(`Myo error: ${error.message}`);
    };

    // Handle Myo status change
    const handleMyoStatusChange = (status: string) => {
        if (status === "synced") {
            toast.success("Myo tersinkronisasi dengan lengan Anda");
        } else if (status === "unsynced") {
            // setUnlocked(false);
            toast.warning("Myo tidak tersinkronisasi. Lakukan gerakan sync");
        }
    };

    // Hide toolbar and sidebar when on fullscreen mode
    const onFullScreenChange = () => {
        viewerRef.current?.setViewState((state) => {
            const isFullscreen = !!document.fullscreenElement;
            return state
                .set("showToolbar", !isFullscreen)
                .set("sidebarMode", isFullscreen ? null : "THUMBNAILS");
        });
    };

    // Add event listeners
    React.useEffect(() => {
        document.addEventListener("fullscreenchange", onFullScreenChange);
        return () => {
            document.removeEventListener(
                "fullscreenchange",
                onFullScreenChange
            );
        };
    }, []);

    // Request file content read into a raw buffer for direct access
    React.useEffect(() => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setFileBuffer(e.target?.result as ArrayBuffer);
        };
        reader.readAsArrayBuffer(file);
    }, [file]);

    // After the file has been read, reload the Nutrient viewer component
    React.useEffect(() => {
        const container = containerRef.current;
        let cleanup = () => {};

        (async () => {
            // Skip jika sudah diinisialisasi
            if (pdfInitialized) return;

            const pspdfKit = (await import("@nutrient-sdk/viewer")).default;

            if (container && pspdfKit && fileBuffer) {
                try {
                    // Unload dulu jika ada instance sebelumnya
                    pspdfKit.unload(container);

                    // Definisi toolbarItems dan konfigurasi lainnya
                    const toolbarItems: NutrientType.ToolbarItem[] = [
                        { type: "search" },
                        { type: "highlighter" },
                    ];

                    // Load file
                    const instance = await pspdfKit.load({
                        container,
                        document: fileBuffer,
                        baseUrl: `${window.location.protocol}//${window.location.host}/`,
                        toolbarItems,
                        toolbarPlacement: "BOTTOM",
                        theme: "DARK",
                        initialViewState: new pspdfKit.ViewState({
                            layoutMode: "SINGLE",
                            scrollMode: "PER_SPREAD",
                            sidebarMode: "THUMBNAILS",
                            sidebarPlacement: "END",
                        }),
                    });

                    viewerRef.current = instance;
                    setPdfInitialized(true); // <-- Tandai sudah diinisialisasi

                    toast.info(
                        "Lakukan Double Tap untuk unlock gesture kontrol"
                    );
                } catch (error) {
                    console.error("Error loading document:", error);
                    // Perbaikan linter error dengan checking tipe
                    if (error instanceof Error) {
                        toast.error("Gagal memuat dokumen: " + error.message);
                    } else {
                        toast.error("Gagal memuat dokumen");
                    }
                }
            }

            cleanup = () => {
                if (container) {
                    try {
                        pspdfKit.unload(container);
                    } catch {
                        // Silence errors on cleanup (tidak perlu variabel e)
                    }
                }
            };
        })();

        return cleanup;
    }, [fileBuffer, pdfInitialized]); // Hapus myoConnected dan unlocked dari dependencies agar tidak re-mount

    return (
        <>
            <MyoController
                onGesture={(gesture, myo) => {
                    // Always process double_tap immediately no matter what
                    if (gesture === "double_tap") {
                        handleHandledPose("double_tap", myo);
                        return;
                    }

                    // Filter hanya gesture yang diinginkan (kecuali 'rest')
                    if (gesture !== "rest") {
                        // Check for unlocked state before passing gesture
                        // Hanya proses gesture lain jika dalam daftar
                        if (
                            gesture === "fist" ||
                            gesture === "wave_in" ||
                            gesture === "wave_out" ||
                            gesture === "fingers_spread"
                        ) {
                            handleHandledPose(gesture, myo);
                        }
                    }
                }}
                onConnect={handleMyoConnect}
                onDisconnect={handleMyoDisconnect}
                onLocked={handleMyoLocked}
                onError={handleMyoError}
                onStatusChange={handleMyoStatusChange}
                appName="myo.presentation.app"
            />
            <div ref={containerRef} className={className} {...props}>
                {overlay && (
                    <div className="absolute inset-0 z-50">{overlay}</div>
                )}
            </div>
        </>
    );
});

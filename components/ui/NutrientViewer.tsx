"use client";

import type * as NutrientType from "@nutrient-sdk/viewer";
import * as React from "react";
import { MyoController } from "./MyoController";
import { toast } from "sonner";

// Tentukan tipe gesture Myo yang digunakan
type MyoGesture =
    | "fist"
    | "wave_in"
    | "wave_out"
    | "fingers_spread"
    | "double_tap";

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
const gestureVibrations: Record<MyoGesture, VibrateIntensity> = {
    wave_in: "short",
    wave_out: "short",
    fist: "medium",
    fingers_spread: "short",
    double_tap: "medium",
};

// Konfigurasi pesan toast untuk masing-masing gesture
const gestureMessages: Record<MyoGesture, (isActive?: boolean) => string> = {
    wave_in: () => "Slide sebelumnya",
    wave_out: () => "Slide berikutnya",
    fist: (isFullscreen) =>
        isFullscreen
            ? "Keluar dari mode layar penuh"
            : "Masuk mode layar penuh",
    fingers_spread: (showSidebar) =>
        showSidebar ? "Membuka thumbnail" : "Menutup thumbnail",
    double_tap: (isUnlocked) =>
        isUnlocked ? "Myo Unlocked - Gesture dikontrol" : "Reset tampilan",
};

export interface NutrientViewerRef {
    toggleFullscreen: () => Promise<void>;
    setCurrentPage: (i: number) => void;
    nextPage: () => void;
    previousPage: () => void;
}

export const NutrientViewer = React.forwardRef<NutrientViewerRef, React.ComponentProps<"div"> & { file: File }>(function NutrientViewer({
    file,
    className,
    ...props
}, ref) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const viewerRef = React.useRef<NutrientType.Instance>(null);
    const [fileBuffer, setFileBuffer] = React.useState<ArrayBuffer | null>(
        null
    );
    const [myoConnected, setMyoConnected] = React.useState(false);
    const [unlocked, setUnlocked] = React.useState(false);
    const [debugInfo, setDebugInfo] = React.useState(""); // State untuk debug info

    // Ref untuk menyimpan waktu auto-lock
    const autoLockTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Ref untuk menyimpan waktu terakhir gesture diproses
    const lastGestureTimeRef = React.useRef<number>(0);

    const toggleFullscreen = async () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            await containerRef.current?.requestFullscreen();
        }
    };

    const setCurrentPage = (i: number) => {
        if (viewerRef.current && 0 <= i && i < viewerRef.current?.totalPageCount) {
            viewerRef.current?.setViewState(state => state
                .set("currentPageIndex", i)
            );
        }
    }

    React.useImperativeHandle(ref, () => ({
        toggleFullscreen,
        setCurrentPage,
        nextPage: () => viewerRef.current && setCurrentPage(viewerRef.current.viewState.currentPageIndex + 1),
        previousPage: () => viewerRef.current && setCurrentPage(viewerRef.current.viewState.currentPageIndex - 1),
    }));

    // Fungsi untuk mengatur mode unlocked dengan debounce protection
    const setUnlockedMode = (value: boolean) => {
        console.log(`Setting unlocked to ${value}`);

        // Jika mengunci, hapus timeout untuk menghindari race condition
        if (!value && autoLockTimeoutRef.current) {
            console.log("Clearing existing auto-lock timeout");
            clearTimeout(autoLockTimeoutRef.current);
            autoLockTimeoutRef.current = null;
        }

        // Set state
        setUnlocked(value);

        // Jika unlock, atur timer auto-lock baru
        if (value) {
            console.log("Setting new 30s auto-lock timer");

            // Clear existing timeout if any
            if (autoLockTimeoutRef.current) {
                clearTimeout(autoLockTimeoutRef.current);
            }

            // Set new timeout
            autoLockTimeoutRef.current = setTimeout(() => {
                console.log("Auto-lock triggered after 30s");
                setUnlocked(false);
                toast.info("Myo Locked - Gesture tidak aktif", {
                    style: {
                        fontWeight: "bold",
                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                        color: "#ffbdbd",
                    },
                    duration: 3000,
                });
            }, 30000);
        }
    };

    // Debug info update
    const updateDebugInfo = (info: string) => {
        console.log("Debug:", info);
        setDebugInfo(`${new Date().toLocaleTimeString()}: ${info}`);
    };

    // Cleanup timeout pada unmount
    React.useEffect(() => {
        return () => {
            if (autoLockTimeoutRef.current) {
                clearTimeout(autoLockTimeoutRef.current);
            }
        };
    }, []);

    // Cek status WebSocket
    const isWebSocketOpen = () => {
        const myoAny = window.Myo as { socket?: WebSocket };
        return myoAny?.socket?.readyState === WebSocket.OPEN;
    };

    // Helper function untuk getaran dan feedback yang aman
    const handleVibrationAndToast = (
        gesture: MyoGesture,
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
                duration: 3000,
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

    // Menambahkan indikator visual saat unlocked berubah
    React.useEffect(() => {
        if (unlocked) {
            toast.success("Myo Unlocked! Gesture aktif untuk 30 detik", {
                id: "myo-unlock-status",
            });
        } else {
            toast.info("Myo Locked. Lakukan Double Tap untuk unlock", {
                id: "myo-unlock-status",
            });
        }
    }, [unlocked]);

    // Helper untuk mengirim keyboard event
    const sendKeyboardEvent = (key: string) => {
        if (!containerRef.current) return;

        try {
            console.log(`Sending keyboard event: ${key}`);

            // Fokuskan container terlebih dahulu
            containerRef.current.focus();

            // Kirim keydown event
            const event = new KeyboardEvent("keydown", {
                key,
                bubbles: true,
                cancelable: true,
            });
            containerRef.current.dispatchEvent(event);

            // Kirim keyup setelah jeda singkat
            setTimeout(() => {
                const upEvent = new KeyboardEvent("keyup", {
                    key,
                    bubbles: true,
                    cancelable: true,
                });
                containerRef.current?.dispatchEvent(upEvent);
            }, 50);

            console.log(`Keyboard event ${key} sent`);
        } catch (error) {
            console.error("Error sending keyboard event:", error);
        }
    };

    // Fungsi helper untuk berpindah slide
    const goToPage = (page: number) => {
        console.log(`Trying all methods to go to page: ${page}`);

        if (!viewerRef.current) {
            console.error("viewerRef.current is null - cannot navigate");
            return;
        }

        try {
            // Metode 1: Dengan set langsung
            const newViewState = viewerRef.current.viewState.set(
                "currentPageIndex",
                page
            );
            viewerRef.current.setViewState(newViewState);
            console.log("Method 1 executed");

            // Metode 2: Mencoba melalui metode API Nutrient yang mungkin tersedia
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const instance = viewerRef.current as any;
            if (typeof instance.goToPage === "function") {
                instance.goToPage(page);
                console.log("Method 2 executed");
            }

            // Metode 3: Mencoba menggunakan API lain
            if (typeof instance.setPageIndex === "function") {
                instance.setPageIndex(page);
                console.log("Method 3 executed");
            }

            // Metode 4: Mencoba mensimulasikan keypress (Nutrient mendukung keyboard navigation)
            if (typeof instance.dispatchKeyEvent === "function") {
                const key =
                    page > viewerRef.current.viewState.currentPageIndex
                        ? "ArrowRight"
                        : "ArrowLeft";
                instance.dispatchKeyEvent({ key });
                console.log("Method 4 executed");
            }

            // Metode 5: Mencoba simulator keyboard event
            const currentPage = viewerRef.current.viewState.currentPageIndex;
            if (page > currentPage) {
                sendKeyboardEvent("ArrowRight");
            } else if (page < currentPage) {
                sendKeyboardEvent("ArrowLeft");
            }
            console.log("Method 5 executed");
        } catch (error) {
            console.error("Error in goToPage helper:", error);

            // Fallback - coba simulator keyboard tanpa pengecekan error
            const currentPage =
                viewerRef.current.viewState.currentPageIndex || 0;
            if (page > currentPage) {
                sendKeyboardEvent("ArrowRight");
            } else if (page < currentPage) {
                sendKeyboardEvent("ArrowLeft");
            }
        }
    };

    // Helper function untuk debugging status API Nutrient
    const debugNutrientAPI = () => {
        if (!viewerRef.current) return "viewerRef.current is null";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const instance = viewerRef.current as any;
        const methods: string[] = [];

        // Check methods existence
        if (typeof instance.goToPage === "function") methods.push("goToPage");
        if (typeof instance.setPageIndex === "function")
            methods.push("setPageIndex");
        if (typeof instance.dispatchKeyEvent === "function")
            methods.push("dispatchKeyEvent");

        // Get current page
        const currentPage = viewerRef.current.viewState.currentPageIndex;

        // Get total pages
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const viewStateAny = viewerRef.current.viewState as any;
        const totalPages =
            viewStateAny.totalPageCount ||
            viewStateAny.pageCount ||
            viewStateAny.documentPageCount ||
            "unknown";

        return `Current page: ${currentPage}, Total: ${totalPages}, Methods: ${methods.join(
            ", "
        )}`;
    };

    // Handle Myo gestures for presentation control
    const handleMyoGesture = (gesture: MyoGesture, myo: MyoInstance) => {
        if (!viewerRef.current) return;

        // Log semua gesture yang terdeteksi untuk debugging dengan lebih detil
        toast.info(`Gesture terdeteksi: ${gestureNames[gesture]}`, {
            id: "gesture-debug",
            duration: 1000,
            style: {
                fontSize: "14px",
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                color: "#a2e9ff",
            },
        });

        // Debug Nutrient API untuk menulis ke console informasi yang berguna
        console.log("Nutrient API Debug:", debugNutrientAPI());

        console.log(
            `Debug - Gesture: ${gesture}, Unlocked: ${unlocked}, Myo.locked: ${myo.locked}`
        );
        updateDebugInfo(
            `Gesture: ${gesture}, Unlocked: ${unlocked}, Myo.locked: ${myo.locked}`
        );

        // Double tap untuk unlock
        if (gesture === "double_tap") {
            console.log("Double tap terdeteksi - Mengubah unlocked ke true");
            updateDebugInfo(
                "Double tap terdeteksi - Mengubah unlocked ke true"
            );

            // Set unlocked dengan fungsi baru
            setUnlockedMode(true);

            // Coba unlock Myo jika masih terkunci
            if (myo.locked) {
                try {
                    myo.unlock(true);
                    console.log("Myo hardware unlocked via double tap");
                    updateDebugInfo("Myo hardware unlocked");
                } catch (error) {
                    console.error("Error unlocking Myo:", error);
                    updateDebugInfo("Error unlocking Myo: " + String(error));
                }
            }

            handleVibrationAndToast(gesture, myo, true);

            // Catat waktu terakhir gesture diproses
            lastGestureTimeRef.current = Date.now();
            return;
        }

        // Rate limiting untuk gesture processing
        const currentTime = Date.now();
        const timeSinceLastGesture = currentTime - lastGestureTimeRef.current;

        // Pastikan tidak memproses gesture terlalu sering (min 300ms antara gesture)
        if (timeSinceLastGesture < 300) {
            console.log(
                `Gesture ${gesture} ditolak - terlalu cepat (${timeSinceLastGesture}ms)`
            );
            return;
        }

        // Update waktu terakhir gesture
        lastGestureTimeRef.current = currentTime;

        // Hanya proses gesture lain jika sudah unlocked
        if (!unlocked) {
            console.log(
                `Gesture ${gesture} ditolak - Myo masih terkunci (unlocked state: ${unlocked})`
            );
            updateDebugInfo(
                `Gesture ditolak - Myo masih terkunci (locked: ${myo.locked})`
            );
            toast.warning("Lakukan Double Tap terlebih dahulu untuk unlock", {
                id: "unlock-warning",
                style: {
                    fontWeight: "bold",
                    fontSize: "16px",
                    backgroundColor: "rgba(255, 180, 0, 0.9)",
                    color: "black",
                },
                duration: 2000,
            });
            return;
        }

        // Log jika kode mencapai titik ini (artinya unlocked adalah true)
        console.log(
            `Processing gesture ${gesture} because unlocked=${unlocked}`
        );

        // Handle gesture berdasarkan jenisnya
        switch (gesture) {
            case "wave_out": // Wave Left - Next slide (sesuai user task)
                console.log("Processing wave_out gesture - next slide");
                try {
                    // Debugging untuk memeriksa status viewerRef
                    console.log(
                        "viewerRef.current exists:",
                        !!viewerRef.current
                    );

                    if (viewerRef.current) {
                        const currentPage =
                            viewerRef.current.viewState.currentPageIndex;
                        console.log("Current page before change:", currentPage);

                        // Hitung total halaman dengan metode yang lebih andal
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const viewStateAny = viewerRef.current.viewState as any;
                        const totalPages =
                            viewStateAny.totalPageCount ||
                            viewStateAny.pageCount ||
                            viewStateAny.documentPageCount ||
                            100; // Default tinggi untuk menghindari masalah

                        console.log("Total pages detected:", totalPages);

                        // Hitung halaman baru
                        const newPage = Math.min(
                            totalPages - 1,
                            currentPage + 1
                        );
                        console.log(
                            `Trying to move from page ${currentPage} to ${newPage}`
                        );

                        // Gunakan helper untuk mencoba berbagai metode navigasi
                        goToPage(newPage);
                    } else {
                        console.error(
                            "viewerRef.current is null - cannot navigate"
                        );
                    }

                    handleVibrationAndToast(gesture, myo);
                    console.log("Successfully processed wave_out gesture");
                } catch (err) {
                    console.error("Error processing wave_out gesture:", err);
                }
                break;

            case "wave_in": // Wave Right - Previous slide (sesuai user task)
                console.log("Processing wave_in gesture - previous slide");
                try {
                    // Debugging untuk memeriksa status viewerRef
                    console.log(
                        "viewerRef.current exists:",
                        !!viewerRef.current
                    );

                    if (viewerRef.current) {
                        const currentPage =
                            viewerRef.current.viewState.currentPageIndex;
                        console.log("Current page before change:", currentPage);

                        // Hitung halaman baru
                        const newPage = Math.max(0, currentPage - 1);
                        console.log(
                            `Trying to move from page ${currentPage} to ${newPage}`
                        );

                        // Gunakan helper untuk mencoba berbagai metode navigasi
                        goToPage(newPage);
                    } else {
                        console.error(
                            "viewerRef.current is null - cannot navigate"
                        );
                    }

                    handleVibrationAndToast(gesture, myo);
                    console.log("Successfully processed wave_in gesture");
                } catch (err) {
                    console.error("Error processing wave_in gesture:", err);
                }
                break;

            case "fist": // Toggle fullscreen
                console.log("Processing fist gesture - toggle fullscreen");
                try {
                    const isEnteringFullscreen = !document.fullscreenElement;
                    toggleFullscreen();
                    handleVibrationAndToast(gesture, myo, isEnteringFullscreen);
                    console.log("Successfully processed fist gesture");
                } catch (err) {
                    console.error("Error processing fist gesture:", err);
                }
                break;

            case "fingers_spread": // Show all slides (thumbnails)
                console.log(
                    "Processing fingers_spread gesture - toggle thumbnails"
                );
                try {
                    viewerRef.current.setViewState((state) => {
                        const showingSidebar = !state.sidebarMode;
                        const newSidebarMode = state.sidebarMode
                            ? null
                            : "THUMBNAILS";
                        handleVibrationAndToast(gesture, myo, showingSidebar);
                        console.log(
                            "Successfully processed fingers_spread gesture"
                        );
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
        intensity: VibrateIntensity = "medium"
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
        setMyoConnected(true);
        toast.success("Myo terhubung! Lakukan Double Tap untuk unlock gesture");
        vibrateOnEvent(myo);
    };

    // Handle Myo disconnection
    const handleMyoDisconnect = () => {
        setMyoConnected(false);
        setUnlocked(false);
        toast.error("Myo terputus!");
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
            setUnlocked(false);
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
            const pspdfKit = (await import("@nutrient-sdk/viewer")).default;
            pspdfKit.unload(container);

            if (container && pspdfKit && fileBuffer) {
                // Define toolbar items, modify if needed
                const toolbarItems: NutrientType.ToolbarItem[] = [
                    { type: "search" },
                    { type: "highlighter" },
                ];

                // Add Myo control status and unlock status item
                toolbarItems.push({
                    type: "custom",
                    title: myoConnected
                        ? `Myo ${unlocked ? "Unlocked ✅" : "Locked 🔒"}`
                        : "Myo tidak terhubung ❌",
                    onPress: () => {
                        if (myoConnected) {
                            if (unlocked) {
                                toast.info(
                                    "Myo Unlocked - Gesture aktif. Gunakan gerakan untuk navigasi."
                                );
                            } else {
                                toast.info(
                                    "Myo Locked - Lakukan Double Tap untuk unlock."
                                );
                            }
                        } else {
                            toast.info(
                                "Myo tidak terhubung. Pastikan Myo terpasang dan Myo Connect berjalan."
                            );
                        }
                    },
                });

                pspdfKit
                    .load({
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
                    })
                    .then((i) => {
                        viewerRef.current = i;
                        // Tampilkan instruksi setelah presentasi dimuat
                        toast.info(
                            "Lakukan Double Tap untuk unlock gesture kontrol",
                            {
                                duration: 5000,
                            }
                        );
                    });
            }

            cleanup = () => {
                pspdfKit.unload(container);
            };
        })();

        return cleanup;
    }, [fileBuffer, myoConnected, unlocked]);

    return (
        <>
            {/* Menambahkan indikator status unlocked */}
            <div
                style={{
                    position: "fixed",
                    top: "10px",
                    right: "10px",
                    padding: "12px 15px",
                    background: unlocked
                        ? "rgba(0, 255, 0, 0.8)"
                        : "rgba(255, 0, 0, 0.8)",
                    color: "white",
                    borderRadius: "8px",
                    zIndex: 9999,
                    fontSize: "16px",
                    fontWeight: "bold",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: "220px",
                    border: unlocked
                        ? "2px solid #00ff00"
                        : "2px solid #ff0000",
                }}
            >
                <div
                    style={{
                        fontSize: "18px",
                        marginBottom: "8px",
                        textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                    }}
                >
                    Myo {unlocked ? "UNLOCKED ✅" : "LOCKED 🔒"}
                </div>
                <div
                    style={{
                        fontSize: "14px",
                        marginBottom: "5px",
                        textAlign: "center",
                    }}
                >
                    {unlocked ? (
                        <span style={{ color: "#8effb9", fontWeight: "bold" }}>
                            Gesture aktif - Double Tap untuk reset
                        </span>
                    ) : (
                        <span style={{ color: "#ffbdbd", fontWeight: "bold" }}>
                            Double Tap untuk unlock
                        </span>
                    )}
                </div>
                {myoConnected ? (
                    <span
                        style={{
                            fontSize: "13px",
                            color: "#a2e9ff",
                            padding: "4px 8px",
                            backgroundColor: "rgba(0,0,0,0.3)",
                            borderRadius: "4px",
                            marginTop: "3px",
                        }}
                    >
                        Status: Terhubung ✓
                    </span>
                ) : (
                    <span
                        style={{
                            fontSize: "13px",
                            color: "#ffcfa2",
                            padding: "4px 8px",
                            backgroundColor: "rgba(0,0,0,0.3)",
                            borderRadius: "4px",
                            marginTop: "3px",
                        }}
                    >
                        Status: Tidak terhubung ✗
                    </span>
                )}
                {debugInfo && (
                    <div
                        style={{
                            fontSize: "11px",
                            opacity: 0.9,
                            marginTop: "8px",
                            maxWidth: "100%",
                            overflowX: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            backgroundColor: "rgba(0,0,0,0.5)",
                            padding: "5px",
                            borderRadius: "4px",
                            width: "100%",
                        }}
                    >
                        {debugInfo}
                    </div>
                )}
            </div>
            <MyoController
                onGesture={(gesture, myo) => {
                    console.log(
                        `Raw gesture from Myo: ${gesture}, Unlocked state: ${unlocked}`
                    );
                    updateDebugInfo(`Raw gesture: ${gesture}`);

                    // Always process double_tap immediately no matter what
                    if (gesture === "double_tap") {
                        console.log(
                            "Double tap detected - forwarding to handler"
                        );
                        handleMyoGesture("double_tap", myo);
                        return;
                    }

                    // Filter hanya gesture yang diinginkan (kecuali 'rest')
                    if (gesture !== "rest") {
                        // Check again for unlocked state before passing gesture
                        if (unlocked) {
                            console.log(
                                `Forwarding ${gesture} gesture because unlocked=${unlocked}`
                            );

                            // Hanya proses gesture lain jika dalam daftar
                            if (
                                gesture === "fist" ||
                                gesture === "wave_in" ||
                                gesture === "wave_out" ||
                                gesture === "fingers_spread"
                            ) {
                                handleMyoGesture(gesture, myo);
                            }
                        } else {
                            console.log(
                                `Skipping ${gesture} gesture because unlocked=${unlocked}`
                            );
                            toast.warning(
                                "Myo locked - Double Tap untuk unlock",
                                {
                                    id: "skipped-gesture",
                                    duration: 1000,
                                }
                            );
                        }
                    }
                }}
                onConnect={handleMyoConnect}
                onDisconnect={handleMyoDisconnect}
                onError={handleMyoError}
                onStatusChange={handleMyoStatusChange}
                appName="myo.presentation.app"
            />
            <div ref={containerRef} className={className} {...props} />
        </>
    );
});

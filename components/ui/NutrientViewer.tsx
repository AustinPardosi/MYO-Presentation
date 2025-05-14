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
    nextPage: () => void;
    previousPage: () => void;
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
    const [myoConnected, setMyoConnected] = React.useState(false);
    const [unlocked, setUnlocked] = React.useState(false);
    const [debugInfo, setDebugInfo] = React.useState("");
    const [pdfInitialized, setPdfInitialized] = React.useState(false);

    // Ref untuk status unlocked agar selalu akses nilai terbaru
    const unlockedRef = React.useRef(false);

    // Ref untuk menyimpan waktu auto-lock
    const autoLockTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Ref untuk menyimpan waktu terakhir gesture diproses
    const lastGestureTimeRef = React.useRef<number>(0);

    // Fungsi untuk toggle fullscreen
    const toggleFullscreen = async () => {
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
        nextPage: () =>
            viewerRef.current &&
            setCurrentPage(viewerRef.current.viewState.currentPageIndex + 1),
        previousPage: () =>
            viewerRef.current &&
            setCurrentPage(viewerRef.current.viewState.currentPageIndex - 1),
    }));

    // Update ref saat state unlocked berubah
    React.useEffect(() => {
        unlockedRef.current = unlocked;
    }, [unlocked]);

    // Fungsi untuk mengatur mode unlocked dengan debounce protection
    const setUnlockedMode = (value: boolean) => {
        console.log(`Setting unlocked to ${value}`);

        // Update ref juga saat state diubah langsung
        unlockedRef.current = value;

        // Jika mengunci, hapus timeout untuk menghindari race condition
        if (!value && autoLockTimeoutRef.current) {
            clearTimeout(autoLockTimeoutRef.current);
            autoLockTimeoutRef.current = null;
        }

        // Set state
        setUnlocked(value);

        // Jika unlock, atur timer auto-lock baru
        if (value) {
            // Clear existing timeout if any
            if (autoLockTimeoutRef.current) {
                clearTimeout(autoLockTimeoutRef.current);
            }

            // Set new timeout
            autoLockTimeoutRef.current = setTimeout(() => {
                setUnlocked(false);
                // Pastikan ref juga diupdate saat auto-lock
                unlockedRef.current = false;
                toast.info("Myo Locked - Gesture tidak aktif", {
                    style: {
                        fontWeight: "bold",
                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                        color: "#ffbdbd",
                    },
                    duration: 300,
                });
            }, 3000);
        }
    };

    // Debug info update (simpel)
    const updateDebugInfo = (info: string) => {
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
                duration: 300,
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

    // Handle Myo gestures for presentation control
    const handleMyoGesture = (gesture: MyoGesture, myo: MyoInstance) => {
        if (!viewerRef.current) return;

        // Log gesture yang terdeteksi
        updateDebugInfo(
            `Gesture: ${gesture}, Unlocked: ${unlockedRef.current}`
        );

        // Double tap untuk unlock
        if (gesture === "double_tap") {
            // Set unlocked dengan fungsi baru
            setUnlockedMode(true);

            // Coba unlock Myo jika masih terkunci
            if (myo.locked) {
                try {
                    myo.unlock(true);
                } catch (error) {
                    console.error("Error unlocking Myo:", error);
                }
            }

            handleVibrationAndToast(gesture, myo, true);

            // Catat waktu terakhir gesture diproses
            lastGestureTimeRef.current = Date.now();
            return;
        }

        // Update waktu terakhir gesture
        lastGestureTimeRef.current = Date.now();

        // Hanya proses gesture lain jika sudah unlocked
        if (!unlockedRef.current) {
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

        // Handle gesture berdasarkan jenisnya
        switch (gesture) {
            case "wave_in": {
                if (viewerRef.current) {
                    const currentPage =
                        viewerRef.current.viewState.currentPageIndex;

                    // Coba setCurrentPage normal
                    setCurrentPage(currentPage + 1);

                    // Jika dalam mode fullscreen, tambahkan simulator keyboard sebagai backup
                    if (document.fullscreenElement) {
                        // Simulasi key press untuk ArrowRight
                        try {
                            const event = new KeyboardEvent("keydown", {
                                key: "ArrowRight",
                                bubbles: true,
                                cancelable: true,
                                keyCode: 39,
                            });
                            document.dispatchEvent(event);

                            // Tambah delay untuk keyup
                            setTimeout(() => {
                                const upEvent = new KeyboardEvent("keyup", {
                                    key: "ArrowRight",
                                    bubbles: true,
                                    cancelable: true,
                                    keyCode: 39,
                                });
                                document.dispatchEvent(upEvent);
                            }, 50);
                        } catch (err) {
                            console.error(
                                "Error simulating keyboard event:",
                                err
                            );
                        }
                    }

                    // Berikan feedback ke user
                    handleVibrationAndToast(gesture, myo);
                }
                break;
            }
            case "wave_out": {
                if (viewerRef.current) {
                    const currentPage =
                        viewerRef.current.viewState.currentPageIndex;

                    // Coba setCurrentPage normal
                    setCurrentPage(currentPage - 1);

                    // Jika dalam mode fullscreen, tambahkan simulator keyboard sebagai backup
                    if (document.fullscreenElement) {
                        // Simulasi key press untuk ArrowLeft
                        try {
                            const event = new KeyboardEvent("keydown", {
                                key: "ArrowLeft",
                                bubbles: true,
                                cancelable: true,
                                keyCode: 37,
                            });
                            document.dispatchEvent(event);

                            // Tambah delay untuk keyup
                            setTimeout(() => {
                                const upEvent = new KeyboardEvent("keyup", {
                                    key: "ArrowLeft",
                                    bubbles: true,
                                    cancelable: true,
                                    keyCode: 37,
                                });
                                document.dispatchEvent(upEvent);
                            }, 50);
                        } catch (err) {
                            console.error(
                                "Error simulating keyboard event:",
                                err
                            );
                        }
                    }

                    // Berikan feedback ke user
                    handleVibrationAndToast(gesture, myo);
                }
                break;
            }
            case "fist": // Simulasi Ctrl+M untuk toggle fullscreen
                try {
                    // Dapatkan status sebelum simulasi
                    const isEnteringFullscreen = !document.fullscreenElement;

                    // Simulasi keyboard shortcut Ctrl+M
                    const event = new KeyboardEvent("keydown", {
                        key: "m",
                        code: "KeyM",
                        keyCode: 77, // Kode untuk tombol M
                        ctrlKey: true, // Set modifier Ctrl
                        bubbles: true,
                        cancelable: true,
                    });
                    document.dispatchEvent(event);

                    // Tambahkan delay untuk feedback
                    setTimeout(() => {
                        handleVibrationAndToast(
                            gesture,
                            myo,
                            isEnteringFullscreen
                        );
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
            {/* Menambahkan indikator status unlocked */}
            <div
                style={{
                    position: "fixed",
                    bottom: "50px",
                    left: "10px",
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
                    updateDebugInfo(`Raw gesture: ${gesture}`);

                    // Always process double_tap immediately no matter what
                    if (gesture === "double_tap") {
                        handleMyoGesture("double_tap", myo);
                        return;
                    }

                    // Filter hanya gesture yang diinginkan (kecuali 'rest')
                    if (gesture !== "rest") {
                        // Check for unlocked state before passing gesture
                        if (unlockedRef.current) {
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
            <div ref={containerRef} className={className} {...props}>
                {overlay && (
                    <div className="absolute inset-0 z-50">{overlay}</div>
                )}
            </div>
        </>
    );
});

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
    wave_in: "Wave Left",
    wave_out: "Wave Right",
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
    wave_in: () => "Slide berikutnya",
    wave_out: () => "Slide sebelumnya",
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
    _handleMyoConnect: (myo: MyoInstance) => void;
    handleMyoDisconnect: () => void;
    handleMyoError: (error: Error) => void;
    handleMyoStatusChange: (status: string) => void;
    setTimer: (minutes: number) => void;
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

    // State untuk Timer
    const [timerDuration, setTimerDuration] = React.useState<number>(0); // Durasi dalam menit
    const [timeLeft, setTimeLeft] = React.useState<number>(0); // Sisa waktu dalam detik
    const [isTimerRunning, setIsTimerRunning] = React.useState<boolean>(false);
    const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const myoInstanceRef = React.useRef<MyoInstance | null>(null); // Ref untuk instance Myo

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

    // Fungsi internal untuk menangani koneksi Myo, berbeda dari prop
    const internalHandleMyoConnect = (myo: MyoInstance) => {
        myoInstanceRef.current = myo; // Simpan instance Myo
        toast.success("Myo terhubung! Lakukan Double Tap untuk unlock gesture");
        vibrateOnEvent(myo);
    };

    // Ekspos fungsi ke komponen parent
    React.useImperativeHandle(ref, () => ({
        toggleFullscreen,
        setCurrentPage,
        handleHandledPose,
        _handleMyoConnect: internalHandleMyoConnect,
        handleMyoDisconnect,
        handleMyoError,
        handleMyoStatusChange,
        setTimer: (minutes: number) => {
            if (!isTimerRunning) {
                const newDuration = Math.max(0, minutes); // Pastikan tidak negatif
                setTimerDuration(newDuration);
                setTimeLeft(newDuration * 60);
                toast.info(
                    `Timer diatur ke ${newDuration} menit. Masuk fullscreen untuk memulai.`
                );
            } else {
                toast.warning(
                    "Timer sedang berjalan. Hentikan dulu untuk mengubah durasi."
                );
            }
        },
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

    // Handle Myo disconnection
    const handleMyoDisconnect = () => {
        myoInstanceRef.current = null; // Hapus instance Myo saat diskonek
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
            if (isFullscreen && timerDuration > 0) {
                // Mulai atau lanjutkan timer hanya jika durasi sudah diatur
                startTimer();
            } else if (!isFullscreen && isTimerRunning) {
                // Hentikan timer saat keluar fullscreen
                stopTimer();
            }
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
    }, [isTimerRunning, timerDuration]);

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

    // Helper function untuk getaran Myo terkait timer
    const vibrateMyoForTimer = (
        intensity: VibrateIntensity | VibrateIntensity[],
        myoToUse?: MyoInstance | null
    ) => {
        const currentMyo = myoToUse || myoInstanceRef.current;
        if (currentMyo && currentMyo.connected && isWebSocketOpen()) {
            try {
                if (Array.isArray(intensity)) {
                    let delay = 0;
                    intensity.forEach((int) => {
                        setTimeout(() => {
                            try {
                                currentMyo.vibrate(int);
                            } catch (e) {
                                /* silent */
                            }
                        }, delay);
                        delay += int === "long" ? 700 : 500; // Jeda lebih lama setelah getaran panjang
                    });
                } else {
                    currentMyo.vibrate(intensity);
                }
            } catch (e) {
                console.warn("Gagal melakukan getaran Myo untuk timer:", e);
            }
        }
    };

    // Countdown logic for timer
    React.useEffect(() => {
        if (isTimerRunning && timeLeft > 0) {
            timerIntervalRef.current = setInterval(() => {
                setTimeLeft((prevTime) => {
                    const newTimeLeft = prevTime - 1;

                    if (newTimeLeft <= 0) {
                        if (timerIntervalRef.current)
                            clearInterval(timerIntervalRef.current!);
                        setIsTimerRunning(false);
                        toast.info("Waktu presentasi habis!");
                        vibrateMyoForTimer(["long", "long"]); // Notifikasi waktu habis
                        // Optional: Keluar dari fullscreen saat waktu habis
                        // if (document.fullscreenElement) {
                        // document.exitFullscreen();
                        // }
                        return 0;
                    }

                    // Notifikasi getaran
                    if (newTimeLeft === 5 * 60) {
                        // 5 menit
                        toast.info("Sisa waktu 5 menit");
                        vibrateMyoForTimer("short");
                    } else if (newTimeLeft === 3 * 60) {
                        // 3 menit
                        toast.info("Sisa waktu 3 menit");
                        vibrateMyoForTimer("medium");
                    } else if (newTimeLeft === 1 * 60) {
                        // 1 menit
                        toast.info("Sisa waktu 1 menit");
                        vibrateMyoForTimer("long");
                    }
                    return newTimeLeft;
                });
            }, 1000);
        } else if (timeLeft <= 0 && isTimerRunning) {
            setIsTimerRunning(false); // Pastikan timer berhenti jika waktu habis secara manual diubah
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        }

        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, [isTimerRunning, timeLeft]);

    const startTimer = () => {
        if (timerDuration > 0) {
            // Jika timer sudah berjalan dan di-start lagi (misal karena re-fullscreen),
            // kita lanjutkan dari timeLeft jika masih ada, atau reset jika sudah 0.
            if (timeLeft <= 0 || !isTimerRunning) {
                // Reset jika waktu habis atau belum berjalan
                setTimeLeft(timerDuration * 60);
            }
            setIsTimerRunning(true);
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            toast.success(
                `Timer dimulai: ${minutes} menit ${seconds} detik tersisa.`
            );
        } else {
            toast.warning(
                "Atur durasi timer terlebih dahulu (minimal 1 menit)."
            );
        }
    };

    const stopTimer = () => {
        setIsTimerRunning(false);
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }
        // Jangan reset timeLeft agar bisa dilanjutkan
        // setTimeLeft(0);
        if (timeLeft > 0) {
            toast.info("Timer dijeda. Masuk fullscreen untuk melanjutkan.");
        } else {
            toast.info("Timer selesai. Atur ulang durasi untuk memulai lagi.");
        }
    };

    return (
        <>
            <MyoController
                onGesture={(gesture, myo) => {
                    // Selalu simpan instance Myo terbaru jika berubah
                    if (myo && myoInstanceRef.current !== myo) {
                        myoInstanceRef.current = myo;
                    }
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
                onConnect={internalHandleMyoConnect}
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
            {/* UI untuk Timer Input */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-gray-800 bg-opacity-80 p-3 rounded-lg shadow-xl flex items-center space-x-3 text-white">
                <label htmlFor="timerInput" className="text-sm font-medium">
                    Timer (menit):
                </label>
                <input // Menggunakan input HTML standar untuk kesederhanaan
                    id="timerInput"
                    type="number"
                    min="0"
                    className="w-20 p-2 rounded bg-gray-700 border border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-white"
                    value={timerDuration}
                    onChange={(e) => {
                        if (!isTimerRunning) {
                            const newDuration =
                                parseInt(e.target.value, 10) || 0;
                            setTimerDuration(newDuration);
                            setTimeLeft(newDuration * 60); // Update timeLeft juga saat durasi diubah manual
                        }
                    }}
                    disabled={isTimerRunning}
                    placeholder="Menit"
                />
                {isTimerRunning ? (
                    <div className="text-lg font-semibold tabular-nums">
                        {Math.floor(timeLeft / 60)}:
                        {("0" + (timeLeft % 60)).slice(-2)}
                    </div>
                ) : (
                    <button
                        onClick={() => {
                            if (timerDuration > 0 && containerRef.current) {
                                containerRef.current.requestFullscreen(); // Ini akan memicu onFullScreenChange dan startTimer
                            } else if (timerDuration <= 0) {
                                toast.warning(
                                    "Masukkan durasi timer terlebih dahulu (minimal 1 menit)."
                                );
                            }
                        }}
                        disabled={timerDuration <= 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium disabled:opacity-50"
                    >
                        Mulai & Fullscreen
                    </button>
                )}
                {isTimerRunning && (
                    <button
                        onClick={stopTimer}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium"
                    >
                        Jeda Timer
                    </button>
                )}
            </div>
        </>
    );
});

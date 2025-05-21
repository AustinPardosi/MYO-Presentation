"use client";

import { useMyo } from "@/hooks/use-myo";
import { MyoGestureEvent, MyoInstance } from "Myo";
import { useCallback, useEffect, useRef, useState } from "react";

interface MyoControllerProps {
    onGesture?: (gesture: MyoGestureEvent, myo: MyoInstance) => void;
    onConnect?: (myo: MyoInstance) => void;
    onDisconnect?: () => void;
    onLocked?: () => void;
    onUnlocked?: () => void;
    onError?: (error: Error) => void;
    onStatusChange?: (status: string) => void;
    appName?: string;
    enableEMG?: boolean;
    disableRest?: boolean;
}

export function MyoController({
    onGesture,
    onConnect,
    onDisconnect,
    onLocked,
    onUnlocked,
    onError,
    onStatusChange,
    appName = "myo.presentation.app",
    enableEMG = false,
    disableRest = true,
}: MyoControllerProps) {
    const [myo, myoLoaded, myoLoadError] = useMyo({ vector: true });
    const [myoInitialized, setMyoInitialized] = useState(false);

    const eventHandlersRef = useRef<Record<string, string>>({});

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [connected, setConnected] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [status, setStatus] = useState("waiting");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [myoInstance, setMyoInstance] = useState<MyoInstance | null>(null);
    // Ref untuk melacak apakah event listeners sudah didaftarkan
    const listenersRegistered = useRef(false);

    // Fungsi untuk memperbarui status
    const updateStatus = useCallback(
        (newStatus: string) => {
            setStatus(newStatus);
            onStatusChange?.(newStatus);
        },
        [onStatusChange]
    );

    // Fungsi untuk menangani error
    const handleError = useCallback(
        (error: Error, context: string = "") => {
            console.error(`Myo error (${context}):`, error);
            onError?.(error);
        },
        [onError]
    );

    // Fungsi untuk mencegah gerakan terduplikasi
    const createGestureHandler = useCallback(
        (gesture: MyoGestureEvent, myo: MyoInstance) => {
            // Gunakan debounce untuk mencegah trigger berulang
            let lastTriggered = 0;
            const DEBOUNCE_TIME = 200; // waktu dalam milidetik

            return function () {
                const now = Date.now();
                if (now - lastTriggered > DEBOUNCE_TIME) {
                    lastTriggered = now;
                    console.log(
                        `Gerakan ${gesture} terdeteksi (locked=${myo.locked}, synced=${myo.synced})`
                    );

                    // Panggil callback onGesture jika disediakan
                    onGesture?.(gesture, myo);
                } else {
                    console.log(
                        `Mengabaikan gerakan ${gesture} (terlalu cepat setelah gerakan terakhir)`
                    );
                }
            };
        },
        [onGesture]
    );

    const cleanupGestureListeners = useCallback(() => {
        if (!myo) return;

        const gestures: MyoGestureEvent[] = [
            "fist",
            "wave_in",
            "wave_out",
            "fingers_spread",
            "double_tap",
            "rest",
        ];

        gestures.forEach((gesture) => {
            try {
                myo.off(eventHandlersRef.current[gesture]);
            } catch (e) {
                console.warn(`Error saat membersihkan listener ${gesture}:`, e);
            }
        });

        listenersRegistered.current = false;
        console.log("Semua gesture listeners dibersihkan");
    }, [myo]);

    const registerEventListeners = useCallback(
        (myo: MyoInstance) => {
            if (listenersRegistered.current) {
                console.log(
                    "Event listeners sudah terdaftar, tidak mendaftarkan ulang"
                );
                return;
            }

            // Mendeteksi gerakan yang diinginkan (kecuali rest jika disableRest = true)
            const gestures: MyoGestureEvent[] = [
                "fist",
                "wave_in",
                "wave_out",
                "fingers_spread",
                "double_tap",
            ];

            if (!disableRest) {
                gestures.push("rest");
            }

            // Pastikan semua listener dihapus terlebih dahulu
            // cleanupGestureListeners();

            // Tambahkan listener baru dengan handler anti-duplikasi
            gestures.forEach((gesture) => {
                const handler = createGestureHandler(gesture, myo);
                eventHandlersRef.current[gesture] = myo.on(gesture, handler);
            });

            listenersRegistered.current = true;
            console.log("Event listeners berhasil didaftarkan");
        },
        [/*cleanupGestureListeners*/, createGestureHandler, disableRest]
    );

    const initializeMyo = useCallback(() => {
        if (!myo) {
            updateStatus("myo_not_available");
            handleError(
                new Error("Myo object not available"),
                "availability_check"
            );
            return;
        }

        try {
            // Konfigurasi custom error handler untuk Myo
            try {
                // TypeScript mungkin menganggap ini tidak ada, tapi ini ada di library
                myo.onError = (error: unknown) => {
                    handleError(
                        new Error(
                            "Myo Connect error: " +
                                (String(error) || "Unknown error")
                        ),
                        "myo_connect"
                    );
                    updateStatus("connection_error");
                };
            } catch (e) {
                console.warn(
                    "Tidak dapat mengatur onError handler untuk Myo",
                    e
                );
            }

            // Hubungkan ke Myo Connect
            myo.connect(appName);
            updateStatus("connecting");

            // Deteksi ketika WebSocket terhubung
            eventHandlersRef.current["ready"] = myo.on("ready", () => {
                console.log("WebSocket connection ready");
                updateStatus("websocket_ready");
            });

            // Deteksi ketika WebSocket terputus
            eventHandlersRef.current["socket_closed"] = myo.on("socket_closed", () => {
                console.log("WebSocket connection closed");
                updateStatus("websocket_closed");
                cleanupGestureListeners();
            });

            // Mendeteksi ketika Myo terhubung
            eventHandlersRef.current["connected"] = myo.on("connected", function () {
                try {
                    console.log("Myo terhubung!", this.name);
                    setConnected(true);
                    setMyoInstance(this);
                    updateStatus("connected");

                    // Daftarkan event listeners setelah terhubung
                    registerEventListeners(this);

                    // Aktifkan streaming EMG jika diminta
                    if (enableEMG) {
                        try {
                            this.streamEMG(true);
                        } catch (emgError) {
                            console.warn(
                                "Tidak dapat mengaktifkan EMG streaming:",
                                emgError
                            );
                        }
                    }

                    // Panggil callback onConnect jika disediakan
                    onConnect?.(this);
                } catch (error) {
                    handleError(error as Error, "on_connected_handler");
                }
            });

            // Mendeteksi ketika Myo terputus
            eventHandlersRef.current["disconnected"] = myo.on("disconnected", function () {
                try {
                    console.log("Myo terputus!");
                    setConnected(false);
                    setMyoInstance(null);
                    updateStatus("disconnected");
                    cleanupGestureListeners();

                    // Panggil callback onDisconnect jika disediakan
                    onDisconnect?.();
                } catch (error) {
                    handleError(error as Error, "on_disconnected_handler");
                }
            });

            eventHandlersRef.current["locked"] = myo.on("locked", () => {
                onLocked?.();
            });

            eventHandlersRef.current["unlocked"] = myo.on("unlocked", () => {
                onUnlocked?.();
            });

            // Deteksi sinkronisasi dengan lengan
            eventHandlersRef.current["arm_synced"] = myo.on("arm_synced", function (data) {
                try {
                    console.log(`Myo tersinkronisasi dengan ${data.arm} arm`);
                    updateStatus("synced");

                    // Unlock myo kembali setelah sync
                    try {
                        this.unlock(true);
                    } catch (unlockError) {
                        console.warn(
                            "Tidak dapat unlock Myo setelah sync:",
                            unlockError
                        );
                    }
                } catch (error) {
                    handleError(error as Error, "arm_synced_handler");
                }
            });

            eventHandlersRef.current["arm_unsynced"] = myo.on("arm_unsynced", function () {
                try {
                    console.log("Myo tidak tersinkronisasi");
                    updateStatus("unsynced");
                } catch (error) {
                    handleError(error as Error, "arm_unsynced_handler");
                }
            });
        } catch (error) {
            handleError(error as Error, "initialization_process");
            updateStatus("init_error");
        }
    }, [
        appName,
        cleanupGestureListeners,
        enableEMG,
        handleError,
        myo,
        onConnect,
        onDisconnect,
        onLocked,
        onUnlocked,
        registerEventListeners,
        updateStatus,
    ]);

    const initializeVec = useCallback(() => {
        if (!myo) {
            updateStatus("myo_not_available");
            handleError(
                new Error("Myo object not available"),
                "availability_check"
            );
            return;
        }

        eventHandlersRef.current["vector"] = myo.on("vector", (vector) => {
            console.log(
                `Vector stream data: [${vector.x}, ${vector.y}; ${vector.theta}]`
            );
        });
    }, [handleError, myo, updateStatus]);

    const cleanupMyo = useCallback(() => {
        if (myo) {
            try {
                // Matikan semua event listener
                myo.off(eventHandlersRef.current["ready"]);
                myo.off(eventHandlersRef.current["socket_closed"]);
                myo.off(eventHandlersRef.current["connected"]);
                myo.off(eventHandlersRef.current["disconnected"]);
                myo.off(eventHandlersRef.current["arm_synced"]);
                myo.off(eventHandlersRef.current["arm_unsynced"]);

                // Bersihkan gesture listeners
                cleanupGestureListeners();

                // Coba putuskan koneksi jika masih tersambung
                if (myo.socket && myo.socket.readyState === WebSocket.OPEN) {
                    myo.disconnect();
                }
            } catch (error) {
                console.error("Error during Myo cleanup:", error);
            }
        }
    }, [cleanupGestureListeners, myo]);

    const cleanupVec = useCallback(() => {
        if (myo && myo.plugins?.vector) {
            try {
                myo.off(eventHandlersRef.current["vector"]);
            } catch (error) {
                console.error("Error during Myo Vector cleanup:", error);
            }
        }
    }, [myo]);

    useEffect(() => {
        if (myoLoaded) {
            try {
                if (!myoInitialized) {
                    initializeMyo();
                    initializeVec();
                    setMyoInitialized(true);
                }
            } catch (e) {
                handleError(e as Error, "initialization");
            }
        } else if (myoLoadError) {
            handleError(myoLoadError, "script_loading");
            updateStatus("script_error");
        }

        return () => {
            try {
                // cleanupMyo();
                // cleanupVec();
            } catch (e) {
                console.error("Error during cleanup:", e);
            }
        };
    }, [
        myoInitialized,
        initializeMyo,
        initializeVec,
        myoLoadError,
        myoLoaded,
        updateStatus,
        handleError,
        cleanupMyo,
        cleanupVec,
    ]);

    return null; // Komponen ini tidak memiliki UI, hanya logika
}

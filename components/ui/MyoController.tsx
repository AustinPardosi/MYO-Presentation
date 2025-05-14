/* eslint-disable */
"use client";

import { useEffect, useState } from "react";

// Deklarasi interface untuk Myo yang lebih lengkap
declare global {
    interface MyoInstance {
        name: string;
        macAddress: string;
        connectIndex: number;
        connected: boolean;
        synced: boolean;
        batteryLevel: number;
        arm?: string;
        direction?: string;
        locked: boolean;
        warmupState?: string;
        lastIMU?: any;
        lastPose?: string;
        streamEMG: (enabled: boolean) => MyoInstance;
        vibrate: (intensity?: "short" | "medium" | "long") => MyoInstance;
        requestBatteryLevel: () => MyoInstance;
        requestBluetoothStrength: () => MyoInstance;
        lock: () => MyoInstance;
        unlock: (hold?: boolean) => MyoInstance;
        zeroOrientation: () => MyoInstance;
        on: (eventName: string, callback: (...args: any[]) => void) => string;
        off: (eventName: string) => MyoInstance;
        trigger: (eventName: string, ...args: any[]) => MyoInstance;
    }

    interface MyoStatic {
        defaults: {
            api_version: number;
            socket_url: string;
            app_id: string;
        };
        socket?: WebSocket;
        lockingPolicy: string;
        events: any[];
        myos: MyoInstance[];
        on: (eventName: string, callback: (...args: any[]) => void) => string;
        off: (eventName: string) => MyoStatic;
        connect: (appId?: string, socketLib?: any) => void;
        disconnect: () => void;
        trigger: (eventName: string, ...args: any[]) => MyoStatic;
        onError: (error?: any) => void;
        setLockingPolicy: (policy: string) => MyoStatic;
    }
}

// Mendefinisikan Myo secara global dengan casting types untuk menghindari konflik
declare global {
    interface Window {
        Myo: any; // Menggunakan any secara eksplisit dan terpisah
    }
}

type MyoEvent =
    | "fist"
    | "wave_in"
    | "wave_out"
    | "fingers_spread"
    | "double_tap"
    | "rest";

interface MyoControllerProps {
    onGesture?: (gesture: MyoEvent, myo: MyoInstance) => void;
    onConnect?: (myo: MyoInstance) => void;
    onDisconnect?: () => void;
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
    onError,
    onStatusChange,
    appName = "myo.presentation.app",
    enableEMG = false,
    disableRest = true,
}: MyoControllerProps) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [connected, setConnected] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [status, setStatus] = useState("waiting");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [myoInstance, setMyoInstance] = useState<MyoInstance | null>(null);

    // Fungsi untuk memperbarui status
    const updateStatus = (newStatus: string) => {
        setStatus(newStatus);
        onStatusChange?.(newStatus);
    };

    // Fungsi untuk menangani error
    const handleError = (error: Error, context: string = "") => {
        console.error(`Myo error (${context}):`, error);
        onError?.(error);
    };

    useEffect(() => {
        // Impor Myo.js
        let scriptAdded = false;
        let initTimeout: NodeJS.Timeout;

        try {
            const script = document.createElement("script");
            script.src = "/myo.js";
            script.async = true;

            script.onload = () => {
                updateStatus("script_loaded");
                // Tunda inisialisasi untuk memastikan script dimuat dengan benar
                initTimeout = setTimeout(() => {
                    try {
                        initializeMyo();
                    } catch (error) {
                        handleError(error as Error, "initialization");
                    }
                }, 500);
            };

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            script.onerror = (_e) => {
                handleError(
                    new Error("Failed to load Myo.js script"),
                    "script_loading"
                );
                updateStatus("script_error");
            };

            document.body.appendChild(script);
            scriptAdded = true;
        } catch (error) {
            handleError(error as Error, "script_setup");
            updateStatus("setup_error");
        }

        return () => {
            if (initTimeout) {
                clearTimeout(initTimeout);
            }

            try {
                cleanupMyo();
            } catch (error) {
                console.error("Error during cleanup:", error);
            }

            if (scriptAdded) {
                try {
                    const scriptElement = document.querySelector(
                        'script[src="/myo.js"]'
                    );
                    if (scriptElement && scriptElement.parentNode) {
                        scriptElement.parentNode.removeChild(scriptElement);
                    }
                } catch (error) {
                    console.error("Error removing script:", error);
                }
            }
        };
    }, []);

    const initializeMyo = () => {
        if (!window.Myo) {
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window.Myo as any).onError = (error: any) => {
                    handleError(
                        new Error(
                            "Myo Connect error: " +
                                (error?.message || "Unknown error")
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

            // Ubah kebijakan penguncian agar tetap terbuka (tidak lock otomatis)
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window.Myo as any).setLockingPolicy("none");
            } catch (e) {
                console.warn("Tidak dapat mengatur locking policy:", e);
            }

            // Hubungkan ke Myo Connect
            window.Myo.connect(appName);
            updateStatus("connecting");

            // Deteksi ketika WebSocket terhubung
            window.Myo.on("ready", () => {
                console.log("WebSocket connection ready");
                updateStatus("websocket_ready");
            });

            // Deteksi ketika WebSocket terputus
            window.Myo.on("socket_closed", () => {
                console.log("WebSocket connection closed");
                updateStatus("websocket_closed");
            });

            // Mendeteksi ketika Myo terhubung
            window.Myo.on("connected", function (this: MyoInstance) {
                try {
                    console.log("Myo terhubung!", this.name);
                    setConnected(true);
                    setMyoInstance(this);
                    updateStatus("connected");

                    // Unlock myo segera dan tahan (hold) supaya tidak lock otomatis
                    try {
                        console.log("Trying to unlock Myo on connect...");
                        setTimeout(() => {
                            try {
                                this.unlock(true);
                                console.log("Myo unlocked with hold=true");

                                // Getaran konfirmasi bahwa terhubung
                                setTimeout(() => {
                                    try {
                                        if (this.connected) {
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            const socket = (window.Myo as any)
                                                .socket;
                                            if (
                                                socket?.readyState ===
                                                WebSocket.OPEN
                                            ) {
                                                this.vibrate("medium");
                                                console.log(
                                                    "Sent vibration confirmation"
                                                );
                                            }
                                        }
                                    } catch (e) {
                                        console.warn(
                                            "Error sending vibration:",
                                            e
                                        );
                                    }
                                }, 1000);
                            } catch (e) {
                                console.error("Failed to unlock myo:", e);
                            }
                        }, 1000);
                    } catch (unlockError) {
                        console.warn("Tidak dapat unlock Myo:", unlockError);
                    }

                    // Aktifkan streaming EMG jika diminta
                    if (enableEMG && typeof this.streamEMG === "function") {
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
            window.Myo.on("disconnected", function (this: MyoInstance) {
                try {
                    console.log("Myo terputus!");
                    setConnected(false);
                    setMyoInstance(null);
                    updateStatus("disconnected");

                    // Panggil callback onDisconnect jika disediakan
                    onDisconnect?.();
                } catch (error) {
                    handleError(error as Error, "on_disconnected_handler");
                }
            });

            // Deteksi sinkronisasi dengan lengan
            window.Myo.on(
                "arm_synced",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                function (this: MyoInstance, data: any) {
                    try {
                        console.log(
                            `Myo tersinkronisasi dengan ${data.arm} arm`
                        );
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
                }
            );

            window.Myo.on("arm_unsynced", function (this: MyoInstance) {
                try {
                    console.log("Myo tidak tersinkronisasi");
                    updateStatus("unsynced");
                } catch (error) {
                    handleError(error as Error, "arm_unsynced_handler");
                }
            });

            // Mendeteksi gerakan yang diinginkan (kecuali rest jika disableRest = true)
            const gestures: MyoEvent[] = [
                "fist",
                "wave_in",
                "wave_out",
                "fingers_spread",
                "double_tap",
            ];

            if (!disableRest) {
                gestures.push("rest");
            }

            // Pastikan listener dihapus sebelum ditambahkan untuk menghindari duplikasi
            gestures.forEach((gesture) => {
                window.Myo.off(gesture);
            });

            // Variabel untuk memantau status locked global
            let lastLockState = false;

            // Tambahkan listener baru
            gestures.forEach((gesture) => {
                window.Myo.on(gesture, function (this: MyoInstance) {
                    try {
                        console.log(`Gerakan ${gesture} terdeteksi`);

                        // Debug locking status pada gesture
                        console.log(
                            `Myo locked status: ${this.locked}, synced: ${this.synced}`
                        );

                        // Deteksi perubahan status lock
                        if (lastLockState !== this.locked) {
                            console.log(
                                `Lock state changed: ${lastLockState} -> ${this.locked}`
                            );
                            lastLockState = this.locked;
                        }

                        // Otomatis unlock jika terkunci dan gesture adalah double_tap
                        if (this.locked && gesture === "double_tap") {
                            try {
                                console.log("Auto unlocking Myo on double tap");
                                // Unlock dengan delay untuk memastikan prosesnya lengkap
                                setTimeout(() => {
                                    try {
                                        this.unlock(true);
                                        console.log(
                                            "Myo unlocked after double tap"
                                        );
                                    } catch (e) {
                                        console.warn(
                                            "Error auto unlocking with delay:",
                                            e
                                        );
                                    }
                                }, 100);
                            } catch (e) {
                                console.warn(
                                    "Error in initial auto unlocking:",
                                    e
                                );
                            }
                        }

                        // Panggil callback onGesture jika disediakan, dengan delay kecil untuk stabilitas
                        setTimeout(() => {
                            try {
                                onGesture?.(gesture, this);
                            } catch (e) {
                                console.error(
                                    "Error in delayed gesture callback:",
                                    e
                                );
                            }
                        }, 10);
                    } catch (error) {
                        handleError(
                            error as Error,
                            `gesture_${gesture}_handler`
                        );
                    }
                });
            });
        } catch (error) {
            handleError(error as Error, "initialization_process");
            updateStatus("init_error");
        }
    };

    const cleanupMyo = () => {
        if (window.Myo) {
            try {
                // Matikan semua event listener
                window.Myo.off("ready");
                window.Myo.off("socket_closed");
                window.Myo.off("connected");
                window.Myo.off("disconnected");
                window.Myo.off("arm_synced");
                window.Myo.off("arm_unsynced");

                const gestures: MyoEvent[] = [
                    "fist",
                    "wave_in",
                    "wave_out",
                    "fingers_spread",
                    "double_tap",
                    "rest",
                ];
                gestures.forEach((gesture) => {
                    window.Myo.off(gesture);
                });

                // Coba putuskan koneksi jika masih tersambung
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const myoAny = window.Myo as any;
                if (
                    myoAny.socket &&
                    myoAny.socket.readyState === WebSocket.OPEN
                ) {
                    if (typeof myoAny.disconnect === "function") {
                        myoAny.disconnect();
                    }
                }
            } catch (error) {
                console.error("Error during Myo cleanup:", error);
            }
        }
    };

    return null; // Komponen ini tidak memiliki UI, hanya logika
}

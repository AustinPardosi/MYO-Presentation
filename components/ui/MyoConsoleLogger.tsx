"use client";

import { useEffect, useRef } from "react";

// Tipe untuk callback events
type MyoCallback<T = unknown> = (data: T) => void;

// Definisi tipe untuk Myo
interface MyoInstance {
    id: number;
    name?: string;
    macAddress?: string;
    streamEMG: (enabled: boolean) => void;
    vibrate: (intensity: "light" | "medium" | "heavy" | "short") => void;
    unlock: (hold?: boolean) => void;
    lock: () => void;
    zeroOrientation: () => void;
    on: <T>(eventName: string, callback: MyoCallback<T>) => string;
    off: (eventName: string, handlerId?: string) => void;
    requestBatteryLevel: () => void;
    requestBluetoothStrength: () => void;
    synced: boolean;
    arm?: string;
    direction?: string;
    isConnected: boolean;
    connectIndex?: number;
    batteryLevel?: number;
}

interface MyoStatic {
    connect: (appId: string, options?: { timeOut?: number }) => void;
    on: <T>(eventName: string, callback: MyoCallback<T>) => string;
    off: (eventName: string, handlerId?: string) => void;
    myos: MyoInstance[];
    get: (id: number | string) => MyoInstance;
}

declare global {
    interface Window {
        Myo: MyoStatic;
    }
}

// Komponen untuk mendeteksi dan log semua gerakan Myo ke konsol
export function MyoConsoleLogger() {
    // Referensi untuk interval timer
    const batteryCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Impor Myo.js
        const script = document.createElement("script");
        script.src = "/myo.js";
        script.async = true;

        script.onload = () => {
            console.log("Myo.js berhasil dimuat");
            initializeMyo();
        };

        document.body.appendChild(script);

        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
            // Bersihkan interval jika ada
            if (batteryCheckIntervalRef.current) {
                clearInterval(batteryCheckIntervalRef.current);
            }
            cleanupMyo();
        };
    }, []);

    // Fungsi untuk memperbarui status baterai setiap perangkat Myo
    const updateBatteryStatus = () => {
        if (window.Myo && window.Myo.myos && window.Myo.myos.length > 0) {
            window.Myo.myos.forEach((myo) => {
                try {
                    if (typeof myo.requestBatteryLevel === "function") {
                        myo.requestBatteryLevel();
                    }
                    if (typeof myo.requestBluetoothStrength === "function") {
                        myo.requestBluetoothStrength();
                    }
                } catch (error) {
                    console.error(
                        "Gagal meminta status baterai atau kekuatan bluetooth:",
                        error
                    );
                }
            });
        }
    };

    // Fungsi untuk mencatat informasi detail tentang perangkat Myo
    const logMyoDetails = () => {
        if (!window.Myo || !window.Myo.myos) {
            console.warn("Myo tidak tersedia atau belum terhubung");
            return;
        }

        console.log("======= INFORMASI PERANGKAT MYO =======");
        console.log(`Jumlah perangkat terdeteksi: ${window.Myo.myos.length}`);

        window.Myo.myos.forEach((myo, index) => {
            console.log(`\n---- Perangkat #${index + 1} ----`);
            console.log(`ID: ${myo.id || "tidak diketahui"}`);
            console.log(`Nama: ${myo.name || "tidak diketahui"}`);
            console.log(`Alamat MAC: ${myo.macAddress || "tidak diketahui"}`);
            console.log(
                `Status sinkronisasi: ${
                    myo.synced
                        ? "✅ Tersinkronisasi"
                        : "❌ Belum tersinkronisasi"
                }`
            );
            console.log(`Lengan: ${myo.arm || "belum terpasang"}`);
            console.log(`Arah: ${myo.direction || "belum terpasang"}`);
            console.log(
                `Status koneksi: ${
                    myo.isConnected ? "🟢 Terhubung" : "🔴 Terputus"
                }`
            );
            console.log(
                `Level baterai: ${
                    myo.batteryLevel !== undefined
                        ? `${myo.batteryLevel}%`
                        : "tidak tersedia"
                }`
            );
        });

        console.log("\nGunakan gerakan Myo untuk mengontrol presentasi.");
        console.log("=================================");
    };

    const initializeMyo = () => {
        if (!window.Myo) {
            console.error("Myo library tidak ditemukan");
            return;
        }

        // Hubungkan ke Myo Connect dengan ID aplikasi
        window.Myo.connect("myo.console.logger");
        console.log("Mencoba menghubungkan ke Myo Connect...");

        // Mendeteksi ketika Myo terhubung
        window.Myo.on("connected", () => {
            console.log("�� Myo terhubung!");

            // Myo.myos berisi daftar perangkat yang terhubung
            if (window.Myo.myos && window.Myo.myos.length > 0) {
                console.log(
                    `Jumlah perangkat Myo terdeteksi: ${window.Myo.myos.length}`
                );

                // Konfigurasi myo setelah connected
                window.Myo.myos.forEach((myo, index) => {
                    console.log(
                        `Konfigurasi Myo #${index + 1} (ID: ${
                            myo.id || "tidak diketahui"
                        })`
                    );

                    try {
                        // Jangan panggil langsung, gunakan timeout untuk memberi waktu inisialisasi lengkap
                        setTimeout(() => {
                            try {
                                // Buka kuncian agar selalu mendengarkan gerakan
                                if (myo.unlock) {
                                    myo.unlock(true);
                                    console.log("Myo unlock diaktifkan");
                                }

                                // Aktifkan streaming EMG jika tersedia
                                if (myo.streamEMG) {
                                    myo.streamEMG(true);
                                    console.log("EMG streaming diaktifkan");
                                }

                                // Minta status baterai jika tersedia
                                if (myo.requestBatteryLevel) {
                                    myo.requestBatteryLevel();
                                }

                                // Tampilkan detail perangkat
                                logMyoDetails();

                                // Set interval untuk memperbarui status baterai secara berkala
                                if (batteryCheckIntervalRef.current === null) {
                                    batteryCheckIntervalRef.current =
                                        setInterval(updateBatteryStatus, 30000); // Cek setiap 30 detik
                                }
                            } catch (innerError) {
                                console.error(
                                    "Error saat konfigurasi delayed:",
                                    innerError
                                );
                            }
                        }, 1000);
                    } catch (error) {
                        console.error(
                            "Error saat menyiapkan konfigurasi delayed:",
                            error
                        );
                    }
                });
            } else {
                console.warn("Tidak ada perangkat Myo yang terdeteksi");
            }
        });

        // Log ketika Myo tidak terhubung
        window.Myo.on("disconnected", () => {
            console.log("🔴 Myo terputus!");
            // Bersihkan interval jika ada
            if (batteryCheckIntervalRef.current) {
                clearInterval(batteryCheckIntervalRef.current);
                batteryCheckIntervalRef.current = null;
            }
        });

        // Log saat pemasangan dengan lengan (synced)
        window.Myo.on<{ arm: string; x_direction: string }>(
            "arm_synced",
            (data) => {
                console.log(
                    `🦾 Myo terpasang ke lengan: ${data.arm} dengan arah ${data.x_direction}`
                );
                // Tampilkan detail perangkat yang diperbarui
                setTimeout(logMyoDetails, 500);
            }
        );

        // Log saat pelepasan dari lengan (unsynced)
        window.Myo.on("arm_unsynced", () => {
            console.log("💪 Myo dilepas dari lengan");
            // Tampilkan detail perangkat yang diperbarui
            setTimeout(logMyoDetails, 500);
        });

        // Log data baterai
        window.Myo.on<{ battery_level: number }>("battery_level", (data) => {
            console.log(`🔋 Level baterai Myo: ${data.battery_level}%`);
            // Tampilkan detail perangkat yang diperbarui
            setTimeout(logMyoDetails, 500);
        });

        // Log kekuatan bluetooth
        window.Myo.on<{ rssi: number; bluetooth_strength: number }>(
            "rssi",
            (data) => {
                console.log(
                    `📶 Kekuatan sinyal Bluetooth: ${data.bluetooth_strength}% (RSSI: ${data.rssi})`
                );
            }
        );

        // Mendeteksi semua gerakan dan mencetaknya ke konsol
        const gestures = [
            "fist",
            "wave_in",
            "wave_out",
            "fingers_spread",
            "double_tap",
            "rest",
        ];

        gestures.forEach((gesture) => {
            window.Myo.on(gesture, () => {
                const timestamp = new Date().toISOString();
                console.log(`⚡ [${timestamp}] Gerakan terdeteksi: ${gesture}`);

                // Hanya mencoba memainkan getaran jika bukan gerakan istirahat
                if (gesture !== "rest" && window.Myo.myos.length > 0) {
                    try {
                        // Ambil semua perangkat yang terhubung dan coba vibrate
                        window.Myo.myos.forEach((myo) => {
                            try {
                                if (typeof myo.vibrate === "function") {
                                    myo.vibrate("light");
                                }
                                // eslint-disable-next-line @typescript-eslint/no-empty-function
                            } catch {
                                // Kesalahan per perangkat diabaikan
                            }
                        });
                    } catch (error) {
                        console.error(
                            "Tidak dapat mengaktifkan getaran:",
                            error
                        );
                    }
                }
            });
        });

        // Log semua data pose untuk debugging
        window.Myo.on<string>("pose", (pose) => {
            console.log(`Pose terdeteksi: ${pose}`);
        });
    };

    const cleanupMyo = () => {
        if (window.Myo) {
            console.log("Membersihkan listener Myo");

            const events = [
                "connected",
                "disconnected",
                "arm_synced",
                "arm_unsynced",
                "fist",
                "wave_in",
                "wave_out",
                "fingers_spread",
                "double_tap",
                "rest",
                "pose",
                "battery_level",
                "rssi",
            ];

            try {
                events.forEach((event) => {
                    window.Myo.off(event);
                });
            } catch (error) {
                console.error("Error saat membersihkan listener:", error);
            }
        }
    };

    return null; // Komponen ini tidak memiliki UI, hanya logika
}

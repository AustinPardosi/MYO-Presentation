"use client";

import { useMyo } from "@/hooks/use-myo";
import { useCallback, useEffect, useRef } from "react";

// Komponen untuk mendeteksi dan log semua gerakan Myo ke konsol
export function MyoConsoleLogger() {
    const [myo, myoLoaded, myoLoadError] = useMyo({ vector: true });

    const eventHandlersRef = useRef<Record<string, string>>({});

    // Referensi untuk interval timer
    const batteryCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Fungsi untuk memperbarui status baterai setiap perangkat Myo
    const updateBatteryStatus = useCallback(() => {
        if (myo && myo.myos && myo.myos.length > 0) {
            myo.myos.forEach((myo) => {
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
    }, [myo]);

    // Fungsi untuk mencatat informasi detail tentang perangkat Myo
    const logMyoDetails = useCallback(() => {
        if (!myo || !myo.myos) {
            console.warn("Myo tidak tersedia atau belum terhubung");
            return;
        }

        console.log("======= INFORMASI PERANGKAT MYO =======");
        console.log(`Jumlah perangkat terdeteksi: ${myo.myos.length}`);

        myo.myos.forEach((myo, index) => {
            console.log(`\n---- Perangkat #${index + 1} ----`);
            // console.log(`ID: ${myo.id || "tidak diketahui"}`);
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
                    myo.connected ? "🟢 Terhubung" : "🔴 Terputus"
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
    }, [myo]);

    const initializeMyo = useCallback(() => {
        if (!myo) {
            console.error("Myo library tidak ditemukan");
            return;
        }

        // Hubungkan ke Myo Connect dengan ID aplikasi
        myo.connect("myo.console.logger");
        console.log("Mencoba menghubungkan ke Myo Connect...");

        // Mendeteksi ketika Myo terhubung
        eventHandlersRef.current["connected"] = myo.on("connected", () => {
            console.log("�� Myo terhubung!");

            // Myo.myos berisi daftar perangkat yang terhubung
            if (myo.myos.length > 0) {
                console.log(
                    `Jumlah perangkat Myo terdeteksi: ${myo.myos.length}`
                );

                // Konfigurasi myo setelah connected
                myo.myos.forEach((myo, index) => {
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
        eventHandlersRef.current["disconnected"] = myo.on(
            "disconnected",
            () => {
                console.log("🔴 Myo terputus!");
                // Bersihkan interval jika ada
                if (batteryCheckIntervalRef.current) {
                    clearInterval(batteryCheckIntervalRef.current);
                    batteryCheckIntervalRef.current = null;
                }
            }
        );

        // Log saat pemasangan dengan lengan (synced)
        eventHandlersRef.current["arm_synced"] = myo.on(
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
        eventHandlersRef.current["arm_unsynced"] = myo.on(
            "arm_unsynced",
            () => {
                console.log("💪 Myo dilepas dari lengan");
                // Tampilkan detail perangkat yang diperbarui
                setTimeout(logMyoDetails, 500);
            }
        );

        // Log data baterai
        eventHandlersRef.current["battery_level"] = myo.on(
            "battery_level",
            (batteryLevel) => {
                console.log(`🔋 Level baterai Myo: ${batteryLevel}%`);
                // Tampilkan detail perangkat yang diperbarui
                setTimeout(logMyoDetails, 500);
            }
        );

        // Log kekuatan bluetooth
        eventHandlersRef.current["rssi"] = myo.on(
            "bluetooth_strength",
            (bluetoothStrength) => {
                console.log(
                    `📶 Kekuatan sinyal Bluetooth: ${bluetoothStrength}%`
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
            eventHandlersRef.current[gesture] = myo.on(gesture, () => {
                const timestamp = new Date().toISOString();
                console.log(`⚡ [${timestamp}] Gerakan terdeteksi: ${gesture}`);

                // Hanya mencoba memainkan getaran jika bukan gerakan istirahat
                if (gesture !== "rest" && myo.myos.length > 0) {
                    try {
                        // Ambil semua perangkat yang terhubung dan coba vibrate
                        myo.myos.forEach((myo) => {
                            try {
                                if (typeof myo.vibrate === "function") {
                                    myo.vibrate("short");
                                }
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
        eventHandlersRef.current["pose"] = myo.on("pose", (pose) => {
            console.log(`Pose terdeteksi: ${pose}`);
        });
    }, [logMyoDetails, myo, updateBatteryStatus]);

    const cleanupMyo = useCallback(() => {
        if (myo) {
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
                    myo.off(eventHandlersRef.current[event]);
                });
            } catch (error) {
                console.error("Error saat membersihkan listener:", error);
            }
        }
    }, [myo]);

    useEffect(() => {
        // Impor Myo.js
        if (myoLoaded) {
            console.log("Myo.js berhasil dimuat");
            if (myo.plugins?.vector) {
                console.log("Myo Vector berhasil dimuat");
            }

            initializeMyo();
        } else if (myoLoadError) {
            console.error("Gagal memuat Myo.js:", myoLoadError);
        }

        return () => {
            if (batteryCheckIntervalRef.current) {
                clearInterval(batteryCheckIntervalRef.current);
            }
            cleanupMyo();
        };
    }, [
        cleanupMyo,
        initializeMyo,
        logMyoDetails,
        myo,
        myoLoadError,
        myoLoaded,
        updateBatteryStatus,
    ]);

    return null; // Komponen ini tidak memiliki UI, hanya logika
}

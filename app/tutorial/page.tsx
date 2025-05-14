"use client";

import React, { useEffect, useState } from "react";
import {
    MyoTutorialListener,
    GestureLog,
    useMyoGestures,
} from "@/components/tutorial/MyoTutorialListener";
import { GestureDebugPanel } from "@/components/tutorial/GestureDebugPanel";

export default function TutorialPage() {
    // State untuk menyimpan gesture terakhir
    const [lastGesture, setLastGesture] = useState<string | null>(null);
    const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);
    const [gestureCount, setGestureCount] = useState<Record<string, number>>(
        {}
    );
    const [connected, setConnected] = useState(false);

    // Menggunakan hook untuk gesture history
    const { MyoListener, gestureHistory, clearHistory } = useMyoGestures({
        logToConsole: true,
        keepHistory: true,
    });

    // Update status koneksi saat komponen dimuat
    useEffect(() => {
        const checkMyo = setInterval(() => {
            if (window.Myo?.myos.length > 0) {
                setConnected(window.Myo.myos[0].isConnected || false);
            }
        }, 1000);

        return () => clearInterval(checkMyo);
    }, []);

    // Handler untuk semua gesture
    const handleAnyGesture = (gesture: string, timestamp: number) => {
        // Filter hanya gesture dasar
        const basicGestures = [
            "double_tap",
            "wave_in",
            "wave_out",
            "fingers_spread",
            "fist",
            "rest",
        ];
        if (!basicGestures.includes(gesture)) return;

        setLastGesture(gesture);
        setLastTimestamp(timestamp);

        // Update counter
        setGestureCount((prev) => ({
            ...prev,
            [gesture]: (prev[gesture] || 0) + 1,
        }));
    };

    // Format timestamp
    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
        });
    };

    return (
        <div className="container mx-auto p-4 bg-gray-900 text-white min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-white">
                Tutorial Myo Armband
            </h1>

            {/* Deskripsi Halaman */}
            <div className="bg-blue-800 p-4 rounded-lg mb-6 border-l-4 border-blue-400">
                <h2 className="text-xl font-semibold mb-2 text-white">
                    Apa itu Halaman Tutorial?
                </h2>
                <p className="text-blue-100">
                    Halaman ini membantu Anda mempelajari dan menguji gerakan
                    Myo Armband. Anda bisa melihat gerakan yang terdeteksi
                    secara real-time, statistik penggunaan, dan data sensor
                    mentah dari Myo. Fokus pada 5 gesture dasar: Double Tap,
                    Wave In/Out, Fingers Spread, dan Fist.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    {/* Status koneksi */}
                    <div className="bg-gray-800 p-4 rounded-lg mb-6 border border-gray-700">
                        <h2 className="text-xl font-semibold mb-2 text-white">
                            Status Koneksi
                        </h2>
                        <p
                            className={`text-lg ${
                                connected ? "text-green-400" : "text-red-400"
                            }`}
                        >
                            {connected ? "Terhubung ✅" : "Tidak Terhubung ❌"}
                        </p>
                    </div>

                    {/* Gesture terakhir */}
                    <div className="bg-blue-900 p-4 rounded-lg mb-6 border border-blue-700">
                        <h2 className="text-xl font-semibold mb-2 text-white">
                            Gesture Terakhir
                        </h2>
                        {lastGesture ? (
                            <div>
                                <p className="text-2xl font-bold text-blue-300">
                                    {lastGesture}
                                </p>
                                <p className="text-sm text-blue-200">
                                    {lastTimestamp && formatTime(lastTimestamp)}
                                </p>
                            </div>
                        ) : (
                            <p className="text-blue-300">
                                Belum ada gesture terdeteksi
                            </p>
                        )}
                    </div>

                    {/* Statistik Gesture */}
                    <div className="bg-gray-800 p-4 rounded-lg mb-6 border border-gray-700">
                        <h2 className="text-xl font-semibold mb-2 text-white">
                            Statistik Gesture
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            {Object.entries(gestureCount).map(
                                ([gesture, count]) => (
                                    <div
                                        key={gesture}
                                        className="bg-blue-800 p-3 rounded shadow border border-blue-700"
                                    >
                                        <p className="font-medium text-blue-200">
                                            {gesture}
                                        </p>
                                        <p className="text-2xl font-bold text-white">
                                            {count}
                                        </p>
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    {/* Petunjuk */}
                    <div className="bg-yellow-900 p-4 rounded-lg border border-yellow-700">
                        <h2 className="text-xl font-semibold mb-2 text-white">
                            Petunjuk Gerakan
                        </h2>
                        <ul className="list-disc pl-5 space-y-2 text-yellow-100">
                            <li>
                                <strong className="text-yellow-200">
                                    Double Tap
                                </strong>{" "}
                                - Ketuk dua kali dengan jari
                            </li>
                            <li>
                                <strong className="text-yellow-200">
                                    Wave In
                                </strong>{" "}
                                - Gerakan telapak tangan ke dalam (kanan)
                            </li>
                            <li>
                                <strong className="text-yellow-200">
                                    Wave Out
                                </strong>{" "}
                                - Gerakan telapak tangan ke luar (kiri)
                            </li>
                            <li>
                                <strong className="text-yellow-200">
                                    Fingers Spread
                                </strong>{" "}
                                - Buka jari-jari telapak tangan
                            </li>
                            <li>
                                <strong className="text-yellow-200">
                                    Fist
                                </strong>{" "}
                                - Kepalkan telapak tangan
                            </li>
                        </ul>
                    </div>
                </div>

                <div>
                    {/* Detail Gesture & Data Sensor */}
                    <div className="mb-6">
                        <GestureDebugPanel
                            gestureData={
                                gestureHistory.length > 0
                                    ? gestureHistory[gestureHistory.length - 1]
                                    : null
                            }
                            title="Detail Gesture Terakhir"
                        />
                    </div>

                    {/* History Gesture */}
                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-xl font-semibold text-white">
                                Riwayat Gesture
                            </h2>
                            <button
                                onClick={clearHistory}
                                className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                            >
                                Hapus Riwayat
                            </button>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            <table className="min-w-full bg-gray-900">
                                <thead>
                                    <tr className="bg-gray-700">
                                        <th className="py-2 px-4 border-b border-gray-600 text-white">
                                            Waktu
                                        </th>
                                        <th className="py-2 px-4 border-b border-gray-600 text-white">
                                            Gesture
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gestureHistory.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={2}
                                                className="py-4 text-center text-gray-400"
                                            >
                                                Belum ada data gesture
                                            </td>
                                        </tr>
                                    ) : (
                                        gestureHistory
                                            .slice()
                                            .reverse()
                                            .map((log, i) => {
                                                // Filter hanya gesture dasar
                                                const basicGestures = [
                                                    "double_tap",
                                                    "wave_in",
                                                    "wave_out",
                                                    "fingers_spread",
                                                    "fist",
                                                    "rest",
                                                ];
                                                if (
                                                    !basicGestures.includes(
                                                        log.gesture
                                                    )
                                                )
                                                    return null;

                                                return (
                                                    <tr
                                                        key={i}
                                                        className={
                                                            i % 2 === 0
                                                                ? "bg-gray-800"
                                                                : "bg-gray-700"
                                                        }
                                                    >
                                                        <td className="py-2 px-4 border-b border-gray-600 text-gray-300">
                                                            {formatTime(
                                                                log.timestamp
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-4 border-b border-gray-600 font-medium text-blue-300">
                                                            {log.gesture}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                            .filter(Boolean)
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-900 p-4 rounded-lg mt-6 border border-blue-700">
                <h2 className="text-xl font-semibold mb-2 text-white">
                    Cara Menggunakan
                </h2>
                <ol className="list-decimal pl-5 space-y-2 text-blue-100">
                    <li>
                        Pastikan Myo Armband terhubung ke komputer Anda dan Myo
                        Connect berjalan
                    </li>
                    <li>Pasang Myo Armband di lengan Anda sesuai instruksi</li>
                    <li>
                        Lakukan gerakan-gerakan sesuai petunjuk untuk melihat
                        deteksi gerakan
                    </li>
                    <li>
                        Perhatikan data sensor yang muncul untuk memahami cara
                        kerjanya
                    </li>
                </ol>
            </div>

            {/* Listener Komponen - tidak terlihat tapi memproses semua event */}
            <MyoListener
                logToConsole={true}
                keepHistory={true}
                onDoubleTap={(timestamp) =>
                    handleAnyGesture("double_tap", timestamp)
                }
                onWaveRight={(timestamp) =>
                    handleAnyGesture("wave_in", timestamp)
                }
                onWaveLeft={(timestamp) =>
                    handleAnyGesture("wave_out", timestamp)
                }
                onFingersSpread={(timestamp) =>
                    handleAnyGesture("fingers_spread", timestamp)
                }
                onFist={(timestamp) => handleAnyGesture("fist", timestamp)}
                onRest={(timestamp) => handleAnyGesture("rest", timestamp)}
            />
        </div>
    );
}

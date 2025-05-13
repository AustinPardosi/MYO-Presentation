"use client";

import React from "react";
import { GestureLog } from "./MyoTutorialListener";

interface GestureDebugPanelProps {
    gestureData: GestureLog | null;
    title?: string;
}

export function GestureDebugPanel({
    gestureData,
    title = "Gesture Debug Panel",
}: GestureDebugPanelProps) {
    if (!gestureData) {
        return (
            <div className="border border-gray-600 rounded-lg p-4 bg-gray-800">
                <h3 className="text-lg font-semibold mb-2 text-white">
                    {title}
                </h3>
                <p className="text-gray-400">Belum ada data gesture</p>
            </div>
        );
    }

    // Format timestamp
    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
        });
    };

    // Format objek data untuk ditampilkan
    const formatDataObject = (data: any) => {
        if (!data) return "No data";

        try {
            // Coba deteksi tipe data
            if (data.type) {
                // Bila ada "type" property, kemungkinan data pergerakan/rotasi
                return (
                    <div>
                        <p className="font-medium mb-1 text-blue-300">
                            Type: {data.type}
                        </p>
                        {data.data && (
                            <div className="ml-2">
                                <DataVisualization data={data.data} />
                            </div>
                        )}
                    </div>
                );
            } else {
                // Tampilkan data langsung
                return <DataVisualization data={data} />;
            }
        } catch (e) {
            // Fallback jika error
            return (
                <pre className="text-xs bg-gray-800 p-2 rounded text-blue-300 border border-gray-700">
                    {JSON.stringify(data, null, 2)}
                </pre>
            );
        }
    };

    // Komponen visualisasi data sensor
    const DataVisualization = ({ data }: { data: any }) => {
        // Jika data berisi sumbu x, y, z (IMU data)
        if (
            data.x !== undefined ||
            data.y !== undefined ||
            data.z !== undefined
        ) {
            return (
                <div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        {["x", "y", "z"].map(
                            (axis) =>
                                data[axis] !== undefined && (
                                    <div
                                        key={axis}
                                        className="text-center bg-gray-700 p-2 rounded shadow-sm border border-gray-600"
                                    >
                                        <p className="text-xs font-medium text-gray-300">
                                            {axis.toUpperCase()}
                                        </p>
                                        <p className="font-bold text-white">
                                            {data[axis].toFixed(3)}
                                        </p>
                                        {/* Progress bar untuk visualisasi */}
                                        <div className="w-full bg-gray-900 rounded-full h-2.5 mt-1">
                                            <div
                                                className={`h-2.5 rounded-full ${
                                                    axis === "x"
                                                        ? "bg-red-500"
                                                        : axis === "y"
                                                        ? "bg-green-500"
                                                        : "bg-blue-500"
                                                }`}
                                                style={{
                                                    width: `${Math.min(
                                                        Math.abs(
                                                            data[axis] * 50
                                                        ) + 50,
                                                        100
                                                    )}%`,
                                                    marginLeft:
                                                        data[axis] < 0
                                                            ? 0
                                                            : undefined,
                                                    marginRight:
                                                        data[axis] >= 0
                                                            ? 0
                                                            : undefined,
                                                }}
                                            />
                                        </div>
                                    </div>
                                )
                        )}
                    </div>
                    {/* Raw values */}
                    <pre className="text-xs mt-2 bg-gray-800 p-2 rounded text-blue-300 border border-gray-700">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            );
        }

        // Fallback untuk tipe data lain
        return (
            <pre className="text-xs bg-gray-800 p-2 rounded overflow-auto max-h-32 text-blue-300 border border-gray-700">
                {JSON.stringify(data, null, 2)}
            </pre>
        );
    };

    return (
        <div className="border border-gray-600 rounded-lg p-4 bg-gray-800 shadow-sm">
            <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>

            <div className="mb-3 bg-gray-700 p-3 rounded border border-gray-600">
                <div className="flex justify-between">
                    <span className="text-gray-300 font-medium">Gesture:</span>
                    <span className="font-bold text-blue-300">
                        {gestureData.gesture}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-300 font-medium">
                        Timestamp:
                    </span>
                    <span className="text-blue-300">
                        {formatTime(gestureData.timestamp)}
                    </span>
                </div>
            </div>

            <div className="mt-4">
                <h4 className="text-sm font-semibold text-blue-300 mb-2">
                    Data Detail:
                </h4>
                <div className="bg-gray-700 p-3 rounded border border-gray-600">
                    {formatDataObject(gestureData.data)}
                </div>
            </div>
        </div>
    );
}

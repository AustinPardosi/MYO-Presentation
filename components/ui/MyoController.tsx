"use client";

import { MyoEvent, MyoInstance } from "Myo";
import { useEffect, useRef, useState } from "react";

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
  // Ref untuk melacak apakah event listeners sudah didaftarkan
  const listenersRegistered = useRef(false);

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

  // Fungsi untuk mencegah gerakan terduplikasi
  const createGestureHandler = (gesture: MyoEvent, myo: MyoInstance) => {
    // Gunakan debounce untuk mencegah trigger berulang
    let lastTriggered = 0;
    const DEBOUNCE_TIME = 200; // waktu dalam milidetik

    return function () {
      const now = Date.now();
      if (now - lastTriggered > DEBOUNCE_TIME) {
        lastTriggered = now;
        console.log(`Gerakan ${gesture} terdeteksi`);

        // Debug locking status pada gesture
        console.log(
            `Myo locked status: ${myo.locked}, synced: ${myo.synced}`
        );

        // Otomatis unlock jika terkunci dan gesture adalah double_tap
        if (myo.locked && gesture === "double_tap") {
          try {
            console.log("Auto unlocking Myo on double tap");
            // Unlock dengan delay untuk memastikan prosesnya lengkap
            setTimeout(() => {
              try {
                myo.unlock(true);
                console.log("Myo unlocked after double tap");
              } catch (e) {
                  console.warn(
                      "Error auto unlocking with delay:",
                      e
                  );
              }
            }, 100);
          } catch (e) {
            console.warn("Error in initial auto unlocking:", e);
          }
        }

        // Panggil callback onGesture jika disediakan
        onGesture?.(gesture, myo);
      } else {
        console.log(
          `Mengabaikan gerakan ${gesture} (terlalu cepat setelah gerakan terakhir)`
        );
      }
    };
  };

  const registerEventListeners = (myo: MyoInstance) => {
    if (listenersRegistered.current) {
      console.log(
          "Event listeners sudah terdaftar, tidak mendaftarkan ulang"
      );
      return;
    }

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

    // Pastikan semua listener dihapus terlebih dahulu
    cleanupGestureListeners();

    // Tambahkan listener baru dengan handler anti-duplikasi
    gestures.forEach((gesture) => {
      const handler = createGestureHandler(gesture, myo);
      window.Myo.on(gesture, handler);
    });

    listenersRegistered.current = true;
    console.log("Event listeners berhasil didaftarkan");
  };

  const cleanupGestureListeners = () => {
    if (!window.Myo) return;

    const gestures: MyoEvent[] = [
      "fist",
      "wave_in",
      "wave_out",
      "fingers_spread",
      "double_tap",
      "rest",
    ];

    gestures.forEach((gesture) => {
      try {
        window.Myo.off(gesture);
      } catch (e) {
        console.warn(`Error saat membersihkan listener ${gesture}:`, e);
      }
    });

    listenersRegistered.current = false;
    console.log("Semua gesture listeners dibersihkan");
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

            script.onerror = () => {
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
                window.Myo.onError = (error: any) => {
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
                window.Myo.setLockingPolicy("none");
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
        cleanupGestureListeners();
      });

            // Mendeteksi ketika Myo terhubung
            window.Myo.on("connected", function () {
                try {
                    console.log("Myo terhubung!", this.name);
                    setConnected(true);
                    setMyoInstance(this);
                    updateStatus("connected");

          // Daftarkan event listeners setelah terhubung
          registerEventListeners(this);

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
                                            const socket = window.Myo.socket;
                                            if (
                                                socket?.readyState ===
                                                WebSocket.OPEN
                                            ) {
                                                this.vibrate("short");
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
            window.Myo.on("disconnected", function () {
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

            // Deteksi sinkronisasi dengan lengan
            window.Myo.on(
                "arm_synced",
                function (data) {
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

      window.Myo.on("arm_unsynced", function () {
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

        // Bersihkan gesture listeners
        cleanupGestureListeners();

                // Coba putuskan koneksi jika masih tersambung
                if (
                    window.Myo.socket &&
                    window.Myo.socket.readyState === WebSocket.OPEN
                ) {
                    window.Myo.disconnect();
                }
            } catch (error) {
                console.error("Error during Myo cleanup:", error);
            }
        }
    };

  return null; // Komponen ini tidak memiliki UI, hanya logika
}

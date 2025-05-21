"use client";

declare module "Myo" {
    type Vec3 = { x: number, y: number, z: number };
    type Quaternion = { w: number, x: number, y: number, z: number };

    type IMUData = {
        orientation: Quaternion,
        accelerometer: Vec3,
        gyroscope: Vec3,
    };
    type ConnectedData = { version: string[] };
    type ArmSyncData = { arm: string, x_direction: string, warmup_state: string };
    type RSSIData = { rssi: number, bluetooth_strength: number };

    type Pose =
        "fist"
        | "wave_in"
        | "wave_out"
        | "fingers_spread"
        | "double_tap"
        | "rest";

    type MyoGestureEvent =
        "fist" | "fist_off"
        | "wave_in" | "wave_in_off"
        | "wave_out" | "wave_out_off"
        | "fingers_spread" | "fingers_spread_off"
        | "double_tap" | "double_tap_off"
        | "rest";
    type MyoStreamEvent = "pose" | "pose_off" | "orientation" | "accelerometer" | "gyroscope" | "imu" | "emg";
    type MyoStatusEvent =
        "status"
        | "arm_synced" | "arm_unsynced"
        | "connected" | "disconnected"
        | "locked" | "unlocked"
        | "warmup_completed";
    type MyoRequestEvent = "rssi" | "bluetooth_strength" | "battery_level";
    type MyoEvent = MyoGestureEvent | MyoStreamEvent | MyoStatusEvent | MyoRequestEvent;

    type MyoLockingPolicy = "default" | "none";
    
    interface MyoInstance {
        id: string;
        name: string;
        macAddress: string;
        connectIndex: number;
        connected: boolean;
        connectVersion?: string;
        synced: boolean;
        batteryLevel: number;
        locked: boolean;
        arm?: string;
        direction?: string;
        warmupState?: string;
        lastIMU?: IMUData;
        lastPose?: string;

        streamEMG(enabled: boolean): MyoInstance;
        vibrate(intensity?: "short" | "medium" | "long"): MyoInstance;
        requestBatteryLevel(): MyoInstance;
        requestBluetoothStrength(): MyoInstance;
        lock(): MyoInstance;
        unlock(hold?: boolean): MyoInstance;
        zeroOrientation(): MyoInstance;

        on(eventName: string, callback: (...args: unknown[]) => void): string;
        off(eventName: MyoEvent | string): MyoInstance;
        trigger(eventName: string, ...args: unknown[]): MyoInstance;
    }
    
    interface MyoStatic {
        socket?: WebSocket;
        myos: MyoInstance[];
        onError: (e: unknown) => void;

        connect(appId: string, options?: { timeOut?: number }): void;
        disconnect(): void;
        get(id: number | string): MyoInstance;
        setLockingPolicy(policy: MyoLockingPolicy);

        on(eventName: "rest", callback: (this: MyoInstance) => void): string;
        on(eventName: Exclude<Pose, "rest">, callback: (this: MyoInstance) => void): string;
        on(eventName: `${Exclude<Pose, "rest">}_off`, callback: (this: MyoInstance) => void): string

        on(eventName: "pose", callback: (this: MyoInstance, pose: string) => void): string;
        on(eventName: "pose_off", callback: (this: MyoInstance, lastPose: string) => void): string;

        on(eventName: "orientation", callback: (this: MyoInstance, orientation: Quaternion, timestamp: number) => void): string;
        on(eventName: "accelerometer", callback: (this: MyoInstance, accelerometer: Vec3, timestamp: number) => void): string;
        on(eventName: "gyroscope", callback: (this: MyoInstance, gyroscope: Vec3, timestamp: number) => void): string;
        on(eventName: "imu", callback: (this: MyoInstance, imu: IMUData, timestamp: number) => void): string;

        on(eventName: "arm_synced", callback: (this: MyoInstance, data: ArmSyncData, timestamp: number) => void): string;
        on(eventName: "arm_unsynced", callback: (this: MyoInstance, _: unknown, timestamp: number) => void): string;
        on(eventName: "connected", callback: (this: MyoInstance, data: ConnectedData, timestamp: number) => void): string;
        on(eventName: "disconnected", callback: (this: MyoInstance, _: unknown, timestamp: number) => void): string;
        on(eventName: "locked", callback: (this: MyoInstance, _: unknown, timestamp: number) => void): string;
        on(eventName: "unlocked", callback: (this: MyoInstance, _: unknown, timestamp: number) => void): string;
        on(eventName: "warmup_completed", callback: (this: MyoInstance, _: unknown, timestamp: number) => void): string

        on(eventName: "rssi", callback: (this: MyoInstance, data: RSSIData) => void): string;
        on(eventName: "rssi", callback: (this: MyoInstance, rssi: number, timestamp: number) => void): string;
        on(eventName: "bluetooth_strength", callback: (this: MyoInstance, bluetoothStrength: number, timestamp: number) => void): string;
        on(eventName: "battery_level", callback: (this: MyoInstance, batteryLevel: number, timestamp: number) => void): string

        on<T extends unknown[]>(eventName: string, callback: (this: MyoInstance, ...data: T) => void): string;

        off(eventName: MyoEvent, handlerId?: string): void;
        off(eventName: string, handlerId?: string): void;
    }
    
    global {
        interface Window {
            Myo: MyoStatic;
        }
    }
}

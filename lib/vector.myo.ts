"use client";

declare module "Myo" {
    type VectorData = {
        x: number;
        y: number;
        theta: number;
    };

    interface MyoStatic {
        on(eventName: "vector", callback: (this: MyoInstance, vector: VectorData) => void): string;
    }
}

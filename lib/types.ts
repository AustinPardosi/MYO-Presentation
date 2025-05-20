import { Vec3 } from "Myo";

export function isVec3(obj: unknown): obj is Vec3 {
    return (
        typeof obj === "object"
        && obj !== null
        && "x" in obj && typeof obj.x === "number"
        && "y" in obj && typeof obj.y === "number"
        && "z" in obj && typeof obj.z === "number"
    );
}

import { networkInterfaces } from "os";
import { NextRequest, NextResponse } from "next/server";
import { authorizeOwner } from "@/lib/auth-owner";

export async function GET(req: NextRequest) {
    if (!(await authorizeOwner(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const nets = networkInterfaces();
    for (const iface of Object.values(nets)) {
        for (const net of iface ?? []) {
            if (net.family === "IPv4" && !net.internal) {
                return NextResponse.json({ ip: net.address });
            }
        }
    }
    return NextResponse.json({ ip: null });
}

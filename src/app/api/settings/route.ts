import { secureRoute, isDatabaseFailure } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { restaurants, applicationSettings, branches, auditLogs } from "@/db/schema";
import { requirePermission } from "@/lib/guard";
import { eq } from "drizzle-orm";

async function handleGET() {
  try {
    const [restaurant] = await db.select().from(restaurants).limit(1);
    const branchList = await db.select().from(branches);
    const settingsList = await db.select().from(applicationSettings);

    const settingsMap: Record<string, string> = {};
    for (const s of settingsList) {
      settingsMap[s.key] = s.value;
    }

    return NextResponse.json({
      restaurant,
      branches: branchList,
      settings: settingsMap,
    });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handlePOST(req: Request) {
  try {
    const guard = await requirePermission("canManageSettings", "POST /api/settings");
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const { restaurantData, settingsData } = body;

    if (restaurantData) {
      const [first] = await db.select().from(restaurants).limit(1);
      if (first) {
        await db
          .update(restaurants)
          .set({
            ...Object.fromEntries(Object.entries(restaurantData).filter(([key]) => ["name", "legalName", "currency", "currencySymbol", "phone", "email", "address", "taxNumber", "logoUrl", "receiptHeader", "receiptFooter", "defaultTaxRate", "defaultServiceCharge"].includes(key))),
            updatedAt: new Date(),
          })
          .where(eq(restaurants.id, first.id));
      }
    }

    // Saving a valid VAT rate is the owner's confirmation; until then the till refuses sales.
    const savedRate = restaurantData?.defaultTaxRate;
    if (savedRate !== undefined && savedRate !== "" && Number.isFinite(Number(savedRate)) && Number(savedRate) >= 0 && Number(savedRate) <= 100) {
      await db.update(applicationSettings).set({ value: "true", updatedAt: new Date() }).where(eq(applicationSettings.key, "tax_rate_confirmed"));
    }

    if (settingsData && typeof settingsData === "object") {
      for (const [key, value] of Object.entries(settingsData)) {
        const [existing] = await db.select().from(applicationSettings).where(eq(applicationSettings.key, key)).limit(1);
        if (existing) {
          await db
            .update(applicationSettings)
            .set({ value: String(value), updatedAt: new Date() })
            .where(eq(applicationSettings.key, key));
        } else {
          await db.insert(applicationSettings).values({
            key,
            value: String(value),
          });
        }
      }
    }

    await db.insert(auditLogs).values({
      userId: guard.user.id,
      userName: guard.user.name,
      action: "settings_updated",
      entityType: "system",
      entityId: "SYS-SETTINGS",
      details: `Application tax, branding, and hardware settings updated by ${guard.user.name}`,
    });

    return NextResponse.json({ success: true, message: "Settings updated successfully" });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "session");

export const POST = secureRoute(handlePOST, "canManageSettings");

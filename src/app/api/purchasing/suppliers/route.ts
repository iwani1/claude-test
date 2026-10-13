import { secureRoute, isDatabaseFailure } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { suppliers, auditLogs } from "@/db/schema";
import { asc } from "drizzle-orm";

async function handleGET() {
  try {
    const list = await db.select().from(suppliers).orderBy(asc(suppliers.name));
    return NextResponse.json({ suppliers: list });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handlePOST(req: Request) {
  try {
    const body = await req.json();
    const { name, contactPerson, email, phone, address, paymentTerms, leadTimeDays } = body;

    if (!name) {
      return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
    }

    const [newSup] = await db
      .insert(suppliers)
      .values({
        name,
        contactPerson: contactPerson || "",
        email: email || "",
        phone: phone || "",
        address: address || "",
        paymentTerms: paymentTerms || "Net 30",
        leadTimeDays: Number(leadTimeDays) || 2,
      })
      .returning();

    await db.insert(auditLogs).values({
      action: "supplier_created",
      entityType: "inventory",
      entityId: String(newSup.id),
      details: `Added new supplier: ${newSup.name}`,
    });

    return NextResponse.json({ success: true, supplier: newSup });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canModifyInventory");

export const POST = secureRoute(handlePOST, "canModifyInventory");

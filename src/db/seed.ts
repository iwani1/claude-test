/** Bootstrap a NEW database only. Never truncates or installs demo credentials. */
import "dotenv/config";
import { Pool } from "pg";
import { hashPassword, pinDigest, authSecret } from "../lib/auth";
async function main() {
  authSecret();
  const email = process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_PASSWORD;
  const pin = process.env.BOOTSTRAP_PIN;
  if (!process.env.MIGRATION_DATABASE_URL || !email || !password || password.length < 12 || password.length > 256 || (pin && !/^\d{4,8}$/.test(pin))) throw new Error("Set MIGRATION_DATABASE_URL, BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD (12–256 characters), and optionally BOOTSTRAP_PIN (4–8 digits)");
  const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(834923)");
    // Bootstrap needs a maintenance role that can see all rows despite FORCE RLS.
    const role = await client.query("SELECT rolsuper OR rolbypassrls AS maintenance FROM pg_roles WHERE rolname=current_user");
    if (!role.rows[0].maintenance) throw new Error("Bootstrap requires a maintenance role with BYPASSRLS (never use it for the web app)");
    if ((await client.query("SELECT 1 FROM restaurants LIMIT 1")).rowCount) throw new Error("Refusing to bootstrap a nonempty installation");
    const restaurant = (await client.query("INSERT INTO restaurants(name,currency,currency_symbol,default_tax_rate) VALUES($1,'GHS','GH₵',15) RETURNING id", [process.env.BOOTSTRAP_RESTAURANT || "Restaurant"])).rows[0].id;
    const branch = (await client.query("INSERT INTO branches(restaurant_id,name,code) VALUES($1,'Main Branch','MAIN') RETURNING id", [restaurant])).rows[0].id;
    // The VAT rate is a default until the owner saves it; the till refuses sales until then.
    await client.query("INSERT INTO application_settings(branch_id,key,value,description) VALUES($1,'tax_rate_confirmed','false','Set to true when the owner saves the VAT rate in Settings')", [branch]);
    await client.query("INSERT INTO users(restaurant_id,branch_id,name,email,password_hash,pin,pin_lookup,role) VALUES($1,$2,'Owner',$3,$4,$5,$6,'super_admin')", [restaurant, branch, email, hashPassword(password), pin ? hashPassword(pin) : null, pin ? pinDigest(pin) : null]);
    await client.query("COMMIT");
    console.log("Created restaurant, branch, and owner. Save the VAT rate in Settings before trading; sales are refused until you do.");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

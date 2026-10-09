import type { Pool } from "pg";
import { hashPassword, pinDigest } from "../src/lib/auth";
export async function seedSecurityFixtures(pool: Pool) {
  await pool.query(`INSERT INTO restaurants(id,name,default_tax_rate) VALUES (1,'First restaurant',0),(2,'Other restaurant',0);
    INSERT INTO branches(id,restaurant_id,name,code) VALUES(1,1,'First branch','A'),(2,1,'Second branch','B'),(3,2,'Other tenant','C');`);
  const roles = ["super_admin", "manager", "cashier", "accountant", "inventory_officer", "cook", "cashier", "super_admin", "super_admin"];
  for (let i = 0; i < roles.length; i++) {
    const id = i + 1, branch = id < 7 ? 1 : id < 9 ? 2 : 3;
    await pool.query(`INSERT INTO users(id,restaurant_id,branch_id,name,email,password_hash,pin,pin_lookup,role) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, branch === 3 ? 2 : 1, branch, `Test ${roles[i]}`, `user${id}@test.invalid`, hashPassword("Test-password-only-123!"), hashPassword(`${id}${id}${id}${id}`), pinDigest(`${id}${id}${id}${id}`), roles[i]]);
  }
  for (const branch of [1,2,3]) {
    await pool.query(`INSERT INTO menu_categories(id,branch_id,name,slug) VALUES($1,$1,'Food','food');
    `, [branch]);
    await pool.query(`INSERT INTO menu_items(id,branch_id,category_id,name,price,has_recipe) VALUES($1,$1,$1,'Meal',10,true)`,[branch]);
    await pool.query(`INSERT INTO ingredients(id,branch_id,name,current_stock,unit) VALUES($1,$1,'Rice',100,'kg')`,[branch]);
    await pool.query(`INSERT INTO recipes(id,branch_id,menu_item_id) VALUES($1,$1,$1)`,[branch]);
    await pool.query(`INSERT INTO recipe_ingredients(branch_id,recipe_id,ingredient_id,quantity,unit) VALUES($1,$1,$1,2,'kg')`,[branch]);
    await pool.query(`INSERT INTO dining_areas(id,branch_id,name) VALUES($1,$1,'Main')`,[branch]);
    await pool.query(`INSERT INTO dining_tables(id,branch_id,area_id,table_number) VALUES($1,$1,$1,'T1')`,[branch]);
    await pool.query(`INSERT INTO application_settings(branch_id,key,value) VALUES($1,'tax_rate','0')`,[branch]);
  }
  for (const table of ["restaurants","branches","users","menu_categories","menu_items","ingredients","recipes","dining_areas","dining_tables"]) {
    await pool.query(`SELECT setval(pg_get_serial_sequence('${table}','id'), (SELECT max(id) FROM ${table}))`);
  }
}

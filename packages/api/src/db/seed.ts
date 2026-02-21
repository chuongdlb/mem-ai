import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  console.log("Seeding database...");

  // Create admin user
  const [admin] = await db
    .insert(schema.users)
    .values({
      email: "admin@memai.dev",
      name: "Admin",
      role: "admin",
    })
    .onConflictDoNothing()
    .returning();

  if (admin) {
    console.log("Created admin user:", admin.id);

    // Create a demo group
    const [group] = await db
      .insert(schema.groups)
      .values({
        name: "Demo Group",
        description: "A demo thesis group",
        createdBy: admin.id,
      })
      .returning();

    // Add admin as group member
    await db.insert(schema.groupMembers).values({
      groupId: group.id,
      userId: admin.id,
    });

    // Create a demo project
    const [project] = await db
      .insert(schema.projects)
      .values({
        name: "Demo Project",
        description: "A demo thesis project",
        groupId: group.id,
      })
      .returning();

    console.log("Created demo group:", group.id);
    console.log("Created demo project:", project.id);
  } else {
    console.log("Admin user already exists, skipping seed.");
  }

  // Seed default retention policies
  await db
    .insert(schema.retentionPolicies)
    .values([
      { resource: "session_events", days: 90, enabled: true },
      { resource: "memory_versions", days: 180, enabled: true },
      { resource: "audit_logs", days: 365, enabled: true },
    ])
    .onConflictDoNothing();

  console.log("Seeded retention policies.");

  await client.end();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

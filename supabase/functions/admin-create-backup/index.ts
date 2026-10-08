import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveAdmin } from "../_shared/session.ts";
import postgres from "npm:pg@8.13.1";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

const BUCKET = "database-backups";

const BACKUP_LABELS: Record<string, string> = {
  full: "Full Backup",
  schema_data: "Database Schema & Data",
  data_only: "Data Only",
  schema_only: "Schema Only",
  roles: "Roles",
  linked: "Linked Supabase Project",
  pg_dump: "Full PostgreSQL Control (pg_dump)",
  storage: "Storage — Files/Images/PDFs",
  edge_functions: "Edge Functions",
  cron_jobs: "Cron Jobs",
  auth_users: "Auth Users",
  project_config: "Project Configuration & Secrets",
  storage_bucket_files: "Storage Bucket Files (KYC + Tickets)",
};

async function getDbConnection(): Promise<any> {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) throw new Error("SUPABASE_DB_URL not configured");
  const client = new postgres.Client({ connectionString: dbUrl, ssl: "prefer" });
  await client.connect();
  return client;
}

serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let dbClient: any = null;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { adminId, backupType } = await req.json();

    if (!adminId) {
      return new Response(
        JSON.stringify({ error: "Missing adminId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!backupType || !BACKUP_LABELS[backupType]) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing backupType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: admin } = await supabase
      .from("admin_users")
      .select("id, full_name")
      .eq("id", adminId)
      .maybeSingle();

    if (!admin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    dbClient = await getDbConnection();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (backupType === "full") {
      // Full backup: combine everything into one file, one history entry
      const fileName = `backup_full_${timestamp}.sql`;
      const filePath = `${adminId}/${fileName}`;

      try {
        const content = await exportFullBackup(dbClient, supabase);
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, content, { contentType: "application/sql", upsert: false });

        if (uploadError) throw uploadError;

        const fileSize = new Blob([content]).size;

        await supabase.from("backup_history").insert({
          backup_type: "full",
          backup_label: BACKUP_LABELS["full"],
          status: "completed",
          file_path: filePath,
          file_name: fileName,
          file_size_bytes: fileSize,
          file_count: 1,
          storage_bucket: BUCKET,
          created_by_admin_id: adminId,
          created_by_admin_name: admin.full_name || "Admin",
          completed_at: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({
            success: true,
            backupType: "full",
            allSuccess: true,
            message: "Full backup completed successfully",
            fileName,
            fileSize,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        await supabase.from("backup_history").insert({
          backup_type: "full",
          backup_label: BACKUP_LABELS["full"],
          status: "failed",
          created_by_admin_id: adminId,
          created_by_admin_name: admin.full_name || "Admin",
          error_message: errorMsg,
          completed_at: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({
            success: false,
            backupType: "full",
            allSuccess: false,
            message: `Full backup failed: ${errorMsg}`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Storage Bucket Files backup: produces a ZIP, not SQL text
    if (backupType === "storage_bucket_files") {
      const fileName = `backup_storage_bucket_files_${timestamp}.zip`;
      const filePath = `${adminId}/${fileName}`;

      try {
        const { buffer: zipBuffer, fileCount } = await exportStorageBucketFiles(supabase);
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, zipBuffer, { contentType: "application/zip", upsert: false });

        if (uploadError) throw uploadError;

        const fileSize = zipBuffer.byteLength;

        await supabase.from("backup_history").insert({
          backup_type: "storage_bucket_files",
          backup_label: BACKUP_LABELS["storage_bucket_files"],
          status: "completed",
          file_path: filePath,
          file_name: fileName,
          file_size_bytes: fileSize,
          file_count: fileCount,
          storage_bucket: BUCKET,
          created_by_admin_id: adminId,
          created_by_admin_name: admin.full_name || "Admin",
          completed_at: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({
            success: true,
            backupType: "storage_bucket_files",
            allSuccess: true,
            message: `Storage Bucket Files backup completed successfully (${fileCount} files)`,
            fileName,
            fileSize,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        await supabase.from("backup_history").insert({
          backup_type: "storage_bucket_files",
          backup_label: BACKUP_LABELS["storage_bucket_files"],
          status: "failed",
          created_by_admin_id: adminId,
          created_by_admin_name: admin.full_name || "Admin",
          error_message: errorMsg,
          completed_at: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({
            success: false,
            backupType: "storage_bucket_files",
            allSuccess: false,
            message: `Storage Bucket Files backup failed: ${errorMsg}`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Single backup type
    const typeInfo = BACKUP_LABELS[backupType];
    const fileName = `backup_${backupType}_${timestamp}.sql`;
    const filePath = `${adminId}/${fileName}`;

    try {
      const content = await exportByType(backupType, dbClient, supabase);
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, content, { contentType: "application/sql", upsert: false });

      if (uploadError) throw uploadError;

      const fileSize = new Blob([content]).size;

      await supabase.from("backup_history").insert({
        backup_type: backupType,
        backup_label: typeInfo,
        status: "completed",
        file_path: filePath,
        file_name: fileName,
        file_size_bytes: fileSize,
        file_count: 1,
        storage_bucket: BUCKET,
        created_by_admin_id: adminId,
        created_by_admin_name: admin.full_name || "Admin",
        completed_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          backupType,
          allSuccess: true,
          message: `${typeInfo} completed successfully`,
          fileName,
          fileSize,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      await supabase.from("backup_history").insert({
        backup_type: backupType,
        backup_label: typeInfo,
        status: "failed",
        created_by_admin_id: adminId,
        created_by_admin_name: admin.full_name || "Admin",
        error_message: errorMsg,
        completed_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: false,
          backupType,
          allSuccess: false,
          message: `${typeInfo} failed: ${errorMsg}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error in admin-create-backup:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error: " + (error instanceof Error ? error.message : "unknown") }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (dbClient) {
      try { await dbClient.end(); } catch { /* ignore */ }
    }
  }
});

// --- Dispatcher ---

async function exportByType(type: string, db: any, supabase: any): Promise<string> {
  switch (type) {
    case "schema_data": return await exportSchemaData(db, false);
    case "data_only": return await exportSchemaData(db, true);
    case "schema_only": return await exportSchemaOnly(db);
    case "roles": return await exportRoles(db, supabase);
    case "linked": return await exportLinkedProject(db, supabase);
    case "pg_dump": return await exportFullPgDump(db);
    case "storage": return await exportStorageList(supabase);
    case "edge_functions": return await exportEdgeFunctionsList(supabase, db);
    case "cron_jobs": return await exportCronJobs(db);
    case "auth_users": return await exportAuthUsers(supabase);
    case "project_config": return await exportProjectConfig(db, supabase);
    default: throw new Error(`Unknown backup type: ${type}`);
  }
}

// --- SQL query helpers ---

async function sqlQuery(db: any, sql: string, params?: any[]): Promise<any[]> {
  const res = await db.query(sql, params || []);
  return res.rows || [];
}

function formatSqlValue(value: any): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

// --- Export functions using direct Postgres connection ---

async function exportSchemaData(db: any, dataOnly: boolean): Promise<string> {
  const tables = await sqlQuery(db,
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );

  let output = `-- PayByCard Database Backup\n-- Type: ${dataOnly ? "Data Only" : "Schema & Data"}\n-- Generated: ${new Date().toISOString()}\n\n`;

  if (!dataOnly) {
    for (const { table_name } of tables) {
      const columns = await sqlQuery(db,
        `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length, numeric_precision, numeric_scale
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table_name]
      );

      output += `-- Table: ${table_name}\n`;
      output += `CREATE TABLE IF NOT EXISTS "${table_name}" (\n`;
      output += columns.map((col: any) => {
        let line = `  "${col.column_name}" ${col.data_type}`;
        if (col.character_maximum_length) line += `(${col.character_maximum_length})`;
        else if (col.numeric_precision && col.numeric_scale && col.data_type === "numeric")
          line += `(${col.numeric_precision},${col.numeric_scale})`;
        if (col.is_nullable === "NO") line += " NOT NULL";
        if (col.column_default) line += ` DEFAULT ${col.column_default}`;
        return line;
      }).join(",\n");

      // Add primary keys
      const pks = await sqlQuery(db,
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
         WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
         ORDER BY kcu.ordinal_position`,
        [table_name]
      );
      if (pks.length > 0) {
        output += `,\n  PRIMARY KEY (${pks.map((p: any) => `"${p.column_name}"`).join(", ")})`;
      }

      output += "\n);\n\n";
    }

    // Export indexes
    const indexes = await sqlQuery(db,
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname`
    );
    if (indexes.length > 0) {
      output += "-- Indexes\n";
      for (const idx of indexes) {
        output += `${idx.indexdef};\n`;
      }
      output += "\n";
    }

    // Export RLS policies
    const policies = await sqlQuery(db,
      `SELECT tablename, policyname, cmd, qual, with_check, roles
       FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname`
    );
    if (policies.length > 0) {
      output += "-- RLS Policies\n";
      for (const pol of policies) {
        output += `CREATE POLICY "${pol.policyname}" ON "${pol.tablename}" FOR ${pol.cmd}`;
        if (pol.roles && pol.roles.length > 0) {
          output += ` TO ${pol.roles.map((r: string) => `"${r}"`).join(", ")}`;
        }
        if (pol.qual) output += ` USING (${pol.qual})`;
        if (pol.with_check) output += ` WITH CHECK (${pol.with_check})`;
        output += ";\n";
      }
      output += "\n";
    }

    // RLS enabled status
    const rlsTables = await sqlQuery(db,
      `SELECT relname, relrowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity = true`
    );
    if (rlsTables.length > 0) {
      output += "-- RLS Enabled Tables\n";
      for (const t of rlsTables) {
        output += `ALTER TABLE "${t.relname}" ENABLE ROW LEVEL SECURITY;\n`;
      }
      output += "\n";
    }
  }

  // Export data
  output += "-- Data\n";
  for (const { table_name } of tables) {
    try {
      const rows = await sqlQuery(db, `SELECT * FROM public."${table_name}" LIMIT 50000`);
      if (rows.length > 0) {
        output += `\n-- Data for table: ${table_name} (${rows.length} rows)\n`;
        for (const row of rows) {
          const columns = Object.keys(row);
          const values = columns.map((col) => formatSqlValue(row[col]));
          output += `INSERT INTO "${table_name}" ("${columns.join('", "')}") VALUES (${values.join(", ")});\n`;
        }
      } else {
        output += `\n-- Table ${table_name}: empty\n`;
      }
    } catch (err) {
      output += `\n-- Error exporting data from ${table_name}: ${err}\n`;
    }
  }

  return output;
}

async function exportSchemaOnly(db: any): Promise<string> {
  const tables = await sqlQuery(db,
    `SELECT table_name, table_type FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`
  );

  let output = `-- PayByCard Schema-Only Backup\n-- Generated: ${new Date().toISOString()}\n\n`;

  for (const table of tables) {
    const columns = await sqlQuery(db,
      `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table.table_name]
    );

    if (columns.length > 0) {
      output += `-- ${table.table_type}: ${table.table_name}\n`;
      output += `CREATE TABLE IF NOT EXISTS "${table.table_name}" (\n`;
      output += columns.map((col: any) => {
        let line = `  "${col.column_name}" ${col.data_type}`;
        if (col.character_maximum_length) line += `(${col.character_maximum_length})`;
        if (col.is_nullable === "NO") line += " NOT NULL";
        if (col.column_default) line += ` DEFAULT ${col.column_default}`;
        return line;
      }).join(",\n");
      output += "\n);\n\n";
    }
  }

  const indexes = await sqlQuery(db,
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname`
  );
  if (indexes.length > 0) {
    output += "-- Indexes\n";
    for (const idx of indexes) output += `${idx.indexdef};\n`;
  }

  const policies = await sqlQuery(db,
    `SELECT tablename, policyname, cmd, qual, with_check, roles FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname`
  );
  if (policies.length > 0) {
    output += "\n-- RLS Policies\n";
    for (const pol of policies) {
      output += `CREATE POLICY "${pol.policyname}" ON "${pol.tablename}" FOR ${pol.cmd}`;
      if (pol.roles && pol.roles.length > 0)
        output += ` TO ${pol.roles.map((r: string) => `"${r}"`).join(", ")}`;
      if (pol.qual) output += ` USING (${pol.qual})`;
      if (pol.with_check) output += ` WITH CHECK (${pol.with_check})`;
      output += ";\n";
    }
  }

  const triggers = await sqlQuery(db,
    `SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
     FROM information_schema.triggers WHERE trigger_schema = 'public'`
  );
  if (triggers.length > 0) {
    output += "\n-- Triggers\n";
    for (const trg of triggers) {
      output += `-- Trigger: ${trg.trigger_name} on ${trg.event_object_table}\n`;
      output += `${trg.action_timing} ${trg.event_manipulation} ON "${trg.event_object_table}" ${trg.action_statement}\n`;
    }
  }

  const functions = await sqlQuery(db,
    `SELECT routine_name, routine_type, data_type, routine_definition
     FROM information_schema.routines WHERE routine_schema = 'public'`
  );
  if (functions.length > 0) {
    output += "\n-- Functions\n";
    for (const fn of functions) {
      output += `-- Function: ${fn.routine_name} (returns ${fn.data_type || "void"})\n`;
      if (fn.routine_definition) output += `${fn.routine_definition}\n`;
      output += "\n";
    }
  }

  const views = await sqlQuery(db,
    `SELECT table_name, view_definition FROM information_schema.views WHERE table_schema = 'public'`
  );
  if (views.length > 0) {
    output += "\n-- Views\n";
    for (const view of views) {
      output += `-- View: ${view.table_name}\n`;
      if (view.view_definition) output += `${view.view_definition};\n`;
      output += "\n";
    }
  }

  return output;
}

async function exportRoles(db: any, supabase: any): Promise<string> {
  let output = `-- PayByCard Roles Backup\n-- Generated: ${new Date().toISOString()}\n\n`;

  // Get roles from pg_roles
  const roles = await sqlQuery(db,
    `SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolconnlimit, rolvaliduntil
     FROM pg_roles WHERE rolname NOT IN ('pg_signal_backend','pg_read_server_files','pg_write_server_files','pg_execute_server_program')
     ORDER BY rolname`
  );

  output += "-- Database Roles\n";
  for (const role of roles) {
    output += `-- Role: ${role.rolname}\n`;
    output += `--   Superuser: ${role.rolsuper}, Login: ${role.rolcanlogin}, CreateDB: ${role.rolcreatedb}, CreateRole: ${role.rolcreaterole}\n`;
  }

  // Get role grants
  const grants = await sqlQuery(db,
    `SELECT r.rolname AS role_name, m.rolname AS member_name
     FROM pg_auth_members am
     JOIN pg_roles r ON am.roleid = r.oid
     JOIN pg_roles m ON am.member = m.oid
     ORDER BY r.rolname, m.rolname`
  );
  if (grants.length > 0) {
    output += "\n-- Role Memberships\n";
    for (const g of grants) {
      output += `-- ${g.member_name} is member of ${g.role_name}\n`;
    }
  }

  // Table privileges
  const tablePrivs = await sqlQuery(db,
    `SELECT grantee, table_name, privilege_type
     FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
     ORDER BY grantee, table_name, privilege_type`
  );
  if (tablePrivs.length > 0) {
    output += "\n-- Table Privileges\n";
    for (const tp of tablePrivs) {
      output += `-- GRANT ${tp.privilege_type} ON "${tp.table_name}" TO "${tp.grantee}";\n`;
    }
  }

  // Application role permissions
  const { data: rolePerms } = await supabase
    .from("role_permissions")
    .select("role, page_id, can_view, can_edit, admin_pages(page_key, page_name)");

  if (rolePerms && rolePerms.length > 0) {
    output += "\n-- Application Role Permissions\n";
    for (const perm of rolePerms) {
      const page = (perm as any).admin_pages;
      output += `-- Role: ${perm.role}, Page: ${page?.page_name || perm.page_id}, View: ${perm.can_view}, Edit: ${perm.can_edit}\n`;
    }
  }

  return output;
}

async function exportLinkedProject(db: any, supabase: any): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  let output = `-- PayByCard Linked Project Backup\n-- Generated: ${new Date().toISOString()}\n\n`;
  output += `-- Project URL: ${supabaseUrl}\n`;
  const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");
  output += `-- Project Reference: ${projectRef}\n\n`;

  const exts = await sqlQuery(db, `SELECT extname, extversion FROM pg_extension ORDER BY extname`);
  output += "-- Installed Extensions\n";
  for (const ext of exts) output += `-- ${ext.extname} (v${ext.extversion})\n`;

  const schemas = await sqlQuery(db,
    `SELECT schema_name FROM information_schema.schemata
     WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
     ORDER BY schema_name`
  );
  output += "\n-- Schemas\n";
  for (const s of schemas) output += `-- ${s.schema_name}\n`;

  const allTables = await sqlQuery(db,
    `SELECT table_schema, table_name, table_type FROM information_schema.tables
     WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
     ORDER BY table_schema, table_name`
  );
  output += "\n-- All Tables\n";
  for (const t of allTables) output += `-- [${t.table_schema}] ${t.table_name} (${t.table_type})\n`;

  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets && buckets.length > 0) {
    output += "\n-- Storage Buckets\n";
    for (const bucket of buckets) output += `-- ${bucket.name} (public: ${bucket.public})\n`;
  }

  return output;
}

async function exportFullPgDump(db: any): Promise<string> {
  let output = `-- PayByCard Full PostgreSQL Dump\n-- Generated: ${new Date().toISOString()}\n\n`;
  output += "-- Includes schema, data, indexes, policies, triggers, functions, and views.\n\n";

  output += await exportSchemaData(db, false);

  // Triggers
  const triggers = await sqlQuery(db,
    `SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
     FROM information_schema.triggers WHERE trigger_schema = 'public'`
  );
  if (triggers.length > 0) {
    output += "\n-- Triggers\n";
    for (const trg of triggers) {
      output += `-- Trigger: ${trg.trigger_name} on ${trg.event_object_table}\n`;
      output += `${trg.action_timing} ${trg.event_manipulation} ON "${trg.event_object_table}" ${trg.action_statement}\n`;
    }
  }

  // Functions
  const functions = await sqlQuery(db,
    `SELECT routine_name, routine_type, data_type, routine_definition
     FROM information_schema.routines WHERE routine_schema = 'public'`
  );
  if (functions.length > 0) {
    output += "\n-- Functions\n";
    for (const fn of functions) {
      output += `-- Function: ${fn.routine_name} (returns ${fn.data_type || "void"})\n`;
      if (fn.routine_definition) output += `${fn.routine_definition}\n`;
      output += "\n";
    }
  }

  // Views
  const views = await sqlQuery(db,
    `SELECT table_name, view_definition FROM information_schema.views WHERE table_schema = 'public'`
  );
  if (views.length > 0) {
    output += "\n-- Views\n";
    for (const view of views) {
      output += `-- View: ${view.table_name}\n`;
      if (view.view_definition) output += `${view.view_definition};\n`;
      output += "\n";
    }
  }

  // Foreign keys
  const fks = await sqlQuery(db,
    `SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
     JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
     ORDER BY tc.table_name`
  );
  if (fks.length > 0) {
    output += "\n-- Foreign Keys\n";
    for (const fk of fks) {
      output += `-- FK: ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table}.${fk.foreign_column}\n`;
    }
  }

  return output;
}

async function exportStorageList(supabase: any): Promise<string> {
  let output = `-- PayByCard Storage Backup (File Manifest)\n-- Generated: ${new Date().toISOString()}\n\n`;
  output += "-- Manifest of all files in storage buckets.\n\n";

  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets) return output + "-- No buckets found\n";

  for (const bucket of buckets) {
    output += `\n-- Bucket: ${bucket.name} (public: ${bucket.public})\n`;
    try {
      const { data: files } = await supabase.storage.from(bucket.name).list("", { limit: 1000 });
      if (files && files.length > 0) {
        let count = 0;
        for (const file of files) {
          if (file.id) {
            count++;
            output += `-- ${file.name} (${file.metadata?.size || "unknown"} bytes)\n`;
            // Recurse into subfolders
            const { data: subFiles } = await supabase.storage.from(bucket.name).list(file.name, { limit: 1000 });
            if (subFiles) {
              for (const sf of subFiles) {
                if (sf.id) {
                  count++;
                  output += `-- ${file.name}/${sf.name} (${sf.metadata?.size || "unknown"} bytes)\n`;
                }
              }
            }
          }
        }
        output += `-- Total files in ${bucket.name}: ${count}\n`;
      } else {
        output += "-- (empty bucket)\n";
      }
    } catch (err) {
      output += `-- Error listing files: ${err}\n`;
    }
  }

  return output;
}

async function exportEdgeFunctionsList(supabase: any, db: any): Promise<string> {
  let output = `-- PayByCard Edge Functions Backup (Manifest)\n-- Generated: ${new Date().toISOString()}\n\n`;

  // List cron jobs that call edge functions
  const cronJobs = await sqlQuery(db,
    `SELECT jobname, schedule, command, active FROM cron.job ORDER BY jobname`
  );
  if (cronJobs.length > 0) {
    output += "-- Cron Jobs (may trigger edge functions):\n";
    for (const job of cronJobs) {
      output += `-- Job: ${job.jobname}, Schedule: ${job.schedule}, Active: ${job.active}\n`;
      output += `-- Command: ${job.command}\n\n`;
    }
  }

  // List all function names from the database config
  const { data: configRows } = await supabase.from("app_config").select("key, value").ilike("key", "%function%");
  if (configRows && configRows.length > 0) {
    output += "\n-- Function-related config:\n";
    for (const row of configRows) {
      output += `-- ${row.key}: ${row.value}\n`;
    }
  }

  output += "\n-- Note: Edge function source code is stored in the project repository under supabase/functions/.\n";
  output += "-- This manifest lists cron jobs that invoke them.\n";

  return output;
}

async function exportCronJobs(db: any): Promise<string> {
  let output = `-- PayByCard Cron Jobs Backup\n-- Generated: ${new Date().toISOString()}\n\n`;

  const jobs = await sqlQuery(db,
    `SELECT jobid, jobname, schedule, command, nodename, nodeport, database, username, active
     FROM cron.job ORDER BY jobid`
  );

  if (jobs.length === 0) {
    output += "-- No cron jobs found.\n";
    return output;
  }

  output += `-- Total cron jobs: ${jobs.length}\n\n`;
  for (const job of jobs) {
    output += `-- Job ID: ${job.jobid}\n`;
    output += `-- Name: ${job.jobname}\n`;
    output += `-- Schedule: ${job.schedule}\n`;
    output += `-- Command: ${job.command}\n`;
    output += `-- Database: ${job.database}\n`;
    output += `-- Username: ${job.username}\n`;
    output += `-- Active: ${job.active}\n`;
    if (job.jobname && job.schedule && job.command) {
      output += `-- Recreate:\n`;
      output += `-- SELECT cron.schedule('${job.jobname}', '${job.schedule}', '${job.command.replace(/'/g, "''")}');\n`;
    }
    output += "\n";
  }

  // Recent run details
  const runs = await sqlQuery(db,
    `SELECT jobid, runid, job_pid, database, username, start_time, end_time, return_status, output
     FROM cron.job_run_details ORDER BY start_time DESC LIMIT 100`
  );
  if (runs.length > 0) {
    output += `-- Recent job run details (last ${runs.length} runs):\n`;
    for (const run of runs) {
      output += `-- Run ${run.runid}: Job ${run.jobid}, Status: ${run.return_status}, Started: ${run.start_time}, Ended: ${run.end_time || "running"}\n`;
    }
  }

  return output;
}

async function exportAuthUsers(supabase: any): Promise<string> {
  let output = `-- PayByCard Auth Users Backup\n-- Generated: ${new Date().toISOString()}\n\n`;

  const { data: authUsers, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    output += `-- Error fetching auth users: ${error.message}\n`;
    return output;
  }

  if (!authUsers || !authUsers.users || authUsers.users.length === 0) {
    output += "-- No auth users found.\n";
    return output;
  }

  output += `-- Total auth users: ${authUsers.users.length}\n\n`;
  for (const user of authUsers.users) {
    output += `-- User: ${user.id}\n`;
    output += `-- Email: ${user.email}\n`;
    output += `-- Created: ${user.created_at}\n`;
    output += `-- Last Sign In: ${user.last_sign_in_at || "never"}\n`;
    output += `-- Email Confirmed: ${user.email_confirmed_at ? "yes" : "no"}\n`;
    output += `-- Provider: ${user.app_metadata?.provider || "email"}\n`;
    if (user.user_metadata && Object.keys(user.user_metadata).length > 0) {
      output += `-- User Metadata: ${JSON.stringify(user.user_metadata)}\n`;
    }
    if (user.app_metadata) {
      const safeMeta = { ...user.app_metadata };
      delete safeMeta.password_hash;
      delete safeMeta.password;
      if (Object.keys(safeMeta).length > 0) {
        output += `-- App Metadata: ${JSON.stringify(safeMeta)}\n`;
      }
    }
    output += "\n";
  }

  return output;
}

async function exportProjectConfig(db: any, supabase: any): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  let output = `-- PayByCard Project Configuration Backup\n-- Generated: ${new Date().toISOString()}\n\n`;
  output += `-- Project URL: ${supabaseUrl}\n`;
  const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");
  output += `-- Project Reference: ${projectRef}\n\n`;

  // Storage buckets
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets && buckets.length > 0) {
    output += "-- Storage Buckets Configuration\n";
    for (const bucket of buckets) {
      output += `-- Bucket: ${bucket.name}\n`;
      output += `--   Public: ${bucket.public}\n`;
      if (bucket.file_size_limit) output += `--   File Size Limit: ${bucket.file_size_limit}\n`;
      if (bucket.allowed_mime_types) output += `--   Allowed Mime Types: ${JSON.stringify(bucket.allowed_mime_types)}\n`;
      output += "\n";
    }
  }

  // Extensions
  const exts = await sqlQuery(db, `SELECT extname, extversion FROM pg_extension ORDER BY extname`);
  output += "-- Database Extensions\n";
  for (const ext of exts) output += `-- ${ext.extname} (v${ext.extversion})\n`;

  // Schemas
  const schemas = await sqlQuery(db,
    `SELECT schema_name FROM information_schema.schemata
     WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') ORDER BY schema_name`
  );
  output += "\n-- Database Schemas\n";
  for (const s of schemas) output += `-- ${s.schema_name}\n`;

  // Master settings (safe fields only)
  const { data: settings } = await supabase.from("master_settings").select("*").limit(1).maybeSingle();
  if (settings) {
    const safeSettings = { ...settings };
    delete safeSettings.api_keys;
    delete safeSettings.secrets;
    output += `\n-- Master Settings (safe fields only):\n-- ${JSON.stringify(safeSettings, null, 2)}\n`;
  }

  output += "\n-- Note: Secrets and API keys are NOT included in this backup for security.\n";
  output += "-- They must be reconfigured manually from the Supabase dashboard if needed.\n";

  return output;
}

// --- Full Backup: single file combining everything ---

async function exportFullBackup(db: any, supabase: any): Promise<string> {
  let output = `-- PayByCard FULL BACKUP\n-- Generated: ${new Date().toISOString()}\n\n`;
  output += "-- This is a comprehensive backup combining all backup types.\n";
  output += "-- ============================================================\n\n";

  const sections: Array<[string, () => Promise<string>]> = [
    ["SCHEMA & DATA", () => exportSchemaData(db, false)],
    ["ROLES", () => exportRoles(db, supabase)],
    ["LINKED PROJECT", () => exportLinkedProject(db, supabase)],
    ["FULL POSTGRESQL DUMP", () => exportFullPgDump(db)],
    ["STORAGE MANIFEST", () => exportStorageList(supabase)],
    ["EDGE FUNCTIONS MANIFEST", () => exportEdgeFunctionsList(supabase, db)],
    ["CRON JOBS", () => exportCronJobs(db)],
    ["AUTH USERS", () => exportAuthUsers(supabase)],
    ["PROJECT CONFIG", () => exportProjectConfig(db, supabase)],
  ];

  for (let i = 0; i < sections.length; i++) {
    const [name, fn] = sections[i];
    output += `\n\n========================================\n`;
    output += `SECTION ${i + 1}: ${name}\n`;
    output += `========================================\n\n`;
    try {
      output += await fn();
    } catch (err) {
      output += `-- Error exporting ${name}: ${err}\n`;
    }
  }

  output += "\n\n-- END OF FULL BACKUP\n";
  return output;
}

// --- Storage Bucket Files: download actual files as ZIP ---

async function exportStorageBucketFiles(supabase: any): Promise<{ buffer: ArrayBuffer; fileCount: number }> {
  const zip = new JSZip();
  const bucketsToBackup = ["kyc-documents", "support-tickets"];
  let totalFiles = 0;

  for (const bucketName of bucketsToBackup) {
    const bucketFolder = zip.folder(bucketName);
    if (!bucketFolder) continue;

    try {
      const count = await downloadBucketFilesRecursive(supabase, bucketName, bucketFolder, "");
      totalFiles += count;
      bucketFolder.file("_file_count.txt", `Files in this bucket: ${count}\n`);
    } catch (err) {
      bucketFolder.file("_backup_error.txt", `Error backing up bucket ${bucketName}: ${err}\n`);
    }
  }

  const manifest = `Storage Bucket Files Backup\nGenerated: ${new Date().toISOString()}\nBuckets: ${bucketsToBackup.join(", ")}\nTotal files: ${totalFiles}\n`;
  zip.file("_manifest.txt", manifest);

  const buffer = await zip.generateAsync({ type: "arraybuffer" });
  return { buffer, fileCount: totalFiles };
}

async function downloadBucketFilesRecursive(supabase: any, bucketName: string, zipFolder: any, prefix: string): Promise<number> {
  let count = 0;
  const { data: items, error } = await supabase.storage.from(bucketName).list(prefix, { limit: 1000, offset: 0 });
  if (error || !items) return 0;

  for (const item of items) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;

    if (item.id) {
      const { data: fileData, error: dlError } = await supabase.storage.from(bucketName).download(itemPath);
      if (!dlError && fileData) {
        const buf = await fileData.arrayBuffer();
        zipFolder.file(item.name, buf);
        count++;
      }
    } else {
      const subFolder = zipFolder.folder(item.name);
      if (subFolder) {
        count += await downloadBucketFilesRecursive(supabase, bucketName, subFolder, itemPath);
      }
    }
  }

  return count;
}

// redeploy

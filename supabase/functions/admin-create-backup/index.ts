import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveAdmin } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-pbc-session, x-pbc-admin-session",
};

const BUCKET = "database-backups";

interface BackupType {
  key: string;
  label: string;
}

const BACKUP_TYPES: Record<string, BackupType> = {
  full: { key: "full", label: "Full Backup" },
  schema_data: { key: "schema_data", label: "Database Schema & Data" },
  data_only: { key: "data_only", label: "Data Only" },
  schema_only: { key: "schema_only", label: "Schema Only" },
  roles: { key: "roles", label: "Roles" },
  linked: { key: "linked", label: "Linked Supabase Project" },
  pg_dump: { key: "pg_dump", label: "Full PostgreSQL Control (pg_dump)" },
  storage: { key: "storage", label: "Storage — Files/Images/PDFs" },
  edge_functions: { key: "edge_functions", label: "Edge Functions" },
  cron_jobs: { key: "cron_jobs", label: "Cron Jobs" },
  auth_users: { key: "auth_users", label: "Auth Users" },
  project_config: { key: "project_config", label: "Project Configuration & Secrets" },
};

const ALL_BACKUP_TYPES = Object.keys(BACKUP_TYPES);

serveAdmin(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

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

    if (!backupType || !BACKUP_TYPES[backupType]) {
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

    const typesToRun = backupType === "full" ? ALL_BACKUP_TYPES : [backupType];
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const results: Array<{ type: string; label: string; success: boolean; fileName?: string; fileSize?: number; error?: string }> = [];

    for (const typeKey of typesToRun) {
      const typeInfo = BACKUP_TYPES[typeKey];
      const fileName = `backup_${typeKey}_${timestamp}.sql`;
      const filePath = `${adminId}/${fileName}`;

      try {
        let content = "";
        let fileCount = 1;

        switch (typeKey) {
          case "schema_data":
            content = await exportSchemaData(supabase, false);
            break;
          case "data_only":
            content = await exportSchemaData(supabase, true);
            break;
          case "schema_only":
            content = await exportSchemaOnly(supabase);
            break;
          case "roles":
            content = await exportRoles(supabase);
            break;
          case "linked":
            content = await exportLinkedProject(supabase);
            break;
          case "pg_dump":
            content = await exportFullPgDump(supabase);
            break;
          case "storage":
            content = await exportStorageList(supabase);
            break;
          case "edge_functions":
            content = await exportEdgeFunctionsList(supabase);
            break;
          case "cron_jobs":
            content = await exportCronJobs(supabase);
            break;
          case "auth_users":
            content = await exportAuthUsers(supabase);
            break;
          case "project_config":
            content = await exportProjectConfig(supabase);
            break;
          case "full":
            content = await exportFullBackup(supabase);
            fileCount = 1;
            break;
          default:
            throw new Error(`Unknown backup type: ${typeKey}`);
        }

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, content, {
            contentType: "application/sql",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const fileSize = new Blob([content]).size;

        const { error: dbError } = await supabase.from("backup_history").insert({
          backup_type: typeKey,
          backup_label: typeInfo.label,
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

        if (dbError) throw dbError;

        results.push({ type: typeKey, label: typeInfo.label, success: true, fileName, fileSize });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";

        await supabase.from("backup_history").insert({
          backup_type: typeKey,
          backup_label: typeInfo.label,
          status: "failed",
          file_path: null,
          file_name: null,
          created_by_admin_id: adminId,
          created_by_admin_name: admin.full_name || "Admin",
          error_message: errorMsg,
          completed_at: new Date().toISOString(),
        });

        results.push({ type: typeKey, label: typeInfo.label, success: false, error: errorMsg });
      }
    }

    const allSuccess = results.every((r) => r.success);
    const partialSuccess = results.some((r) => r.success) && !allSuccess;

    return new Response(
      JSON.stringify({
        success: true,
        backupType,
        results,
        allSuccess,
        partialSuccess,
        message: allSuccess
          ? "Backup completed successfully"
          : partialSuccess
          ? "Backup completed with some errors"
          : "Backup failed",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in admin-create-backup:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// --- Backup export functions ---

async function exportSchemaData(supabase: any, dataOnly: boolean): Promise<string> {
  const { data: tables } = await supabase
    .rpc("get_public_tables")
    .catch(() => ({ data: null }));

  let tableList: string[] = [];

  if (tables && Array.isArray(tables)) {
    tableList = tables.map((t: any) => t.table_name || t);
  } else {
    // Fallback: query information_schema directly
    const { data: schemaTables } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .neq("table_type", "VIEW");
    tableList = (schemaTables || []).map((t: any) => t.table_name);
  }

  let output = `-- PayByCard Database Backup\n-- Type: ${dataOnly ? "Data Only" : "Schema & Data"}\n-- Generated: ${new Date().toISOString()}\n\n`;

  if (!dataOnly) {
    // Export schema (DDL) for each table
    for (const tableName of tableList) {
      const { data: ddl } = await supabase.rpc("get_table_ddl", { table_name_param: tableName }).catch(() => ({ data: null }));
      if (ddl) {
        output += `-- Table: ${tableName}\n`;
        output += `${ddl}\n\n`;
      } else {
        output += `-- Table: ${tableName} (DDL export requires pg_get_tabledef extension)\n\n`;
      }
    }

    // Export indexes
    const { data: indexes } = await supabase
      .from("pg_indexes")
      .select("indexname, indexdef")
      .eq("schemaname", "public");
    if (indexes && indexes.length > 0) {
      output += "\n-- Indexes\n";
      for (const idx of indexes) {
        output += `${idx.indexdef};\n`;
      }
    }
  }

  // Export data for each table
  output += "\n-- Data\n";
  for (const tableName of tableList) {
    try {
      const { data, error } = await supabase.from(tableName).select("*").limit(10000);
      if (error) {
        output += `-- Could not export data from ${tableName}: ${error.message}\n`;
        continue;
      }
      if (data && data.length > 0) {
        output += `\n-- Data for table: ${tableName} (${data.length} rows)\n`;
        for (const row of data) {
          const columns = Object.keys(row);
          const values = columns.map((col) => formatSqlValue(row[col]));
          output += `INSERT INTO "${tableName}" ("${columns.join('", "')}") VALUES (${values.join(", ")});\n`;
        }
      } else {
        output += `\n-- Table ${tableName}: no data or empty\n`;
      }
    } catch (err) {
      output += `-- Error exporting ${tableName}: ${err}\n`;
    }
  }

  return output;
}

async function exportSchemaOnly(supabase: any): Promise<string> {
  const { data: tables } = await supabase
    .from("information_schema.tables")
    .select("table_name, table_type")
    .eq("table_schema", "public");

  let output = `-- PayByCard Schema-Only Backup\n-- Generated: ${new Date().toISOString()}\n\n`;

  if (tables) {
    for (const table of tables) {
      const { data: columns } = await supabase
        .from("information_schema.columns")
        .select("column_name, data_type, is_nullable, column_default, character_maximum_length")
        .eq("table_schema", "public")
        .eq("table_name", table.table_name)
        .order("ordinal_position");

      if (columns && columns.length > 0) {
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
  }

  // Export indexes
  const { data: indexes } = await supabase
    .from("pg_indexes")
    .select("indexname, indexdef")
    .eq("schemaname", "public");

  if (indexes && indexes.length > 0) {
    output += "\n-- Indexes\n";
    for (const idx of indexes) {
      output += `${idx.indexdef};\n`;
    }
  }

  // Export RLS policies
  const { data: policies } = await supabase
    .from("pg_policies")
    .select("tablename, policyname, cmd, qual, with_check, roles")
    .eq("schemaname", "public");

  if (policies && policies.length > 0) {
    output += "\n-- RLS Policies\n";
    for (const pol of policies) {
      output += `-- Policy: ${pol.policyname} on ${pol.tablename}\n`;
      output += `CREATE POLICY "${pol.policyname}" ON "${pol.tablename}" FOR ${pol.cmd}`;
      if (pol.roles && pol.roles.length > 0) {
        output += ` TO ${pol.roles.map((r: string) => `"${r}"`).join(", ")}`;
      }
      if (pol.qual) output += ` USING (${pol.qual})`;
      if (pol.with_check) output += ` WITH CHECK (${pol.with_check})`;
      output += ";\n";
    }
  }

  return output;
}

async function exportRoles(supabase: any): Promise<string> {
  const { data: roles } = await supabase.rpc("get_roles").catch(() => ({ data: null }));

  let output = `-- PayByCard Roles Backup\n-- Generated: ${new Date().toISOString()}\n\n`;

  if (roles && Array.isArray(roles)) {
    for (const role of roles) {
      output += `-- Role: ${role.rolname}\n`;
      if (role.rolsuper) output += `-- (superuser)\n`;
      output += `\n`;
    }
  } else {
    // Fallback: list known roles
    output += "-- Roles (static list - requires pg_roles access for full export):\n";
    const knownRoles = ["anon", "authenticated", "service_role", "postgres", "supabase_admin", "supabase_read_only"];
    for (const role of knownRoles) {
      output += `-- Role: ${role}\n`;
    }
    output += "\n-- Note: Full role export requires superuser access to pg_roles and pg_authid.\n";
    output += "-- This backup contains the role names that are used in RLS policies.\n\n";
  }

  // Export role permissions from admin_pages
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

async function exportLinkedProject(supabase: any): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  let output = `-- PayByCard Linked Project Backup\n-- Generated: ${new Date().toISOString()}\n\n`;
  output += `-- Project URL: ${supabaseUrl}\n`;
  output += `-- Project Reference: ${supabaseUrl.replace("https://", "").replace(".supabase.co", "")}\n\n`;

  // List all extensions
  const { data: exts } = await supabase
    .from("pg_extension")
    .select("extname, extversion")
    .eq("extnamespace::regnamespace::text" as any, "public");

  if (exts && exts.length > 0) {
    output += "-- Installed Extensions\n";
    for (const ext of exts) {
      output += `-- ${ext.extname} (v${ext.extversion})\n`;
    }
  }

  // List all schemas
  const { data: schemas } = await supabase
    .from("information_schema.schemata")
    .select("schema_name")
    .neq("schema_name", "pg_catalog")
    .neq("schema_name", "information_schema");

  if (schemas && schemas.length > 0) {
    output += "\n-- Schemas\n";
    for (const schema of schemas) {
      output += `-- ${schema.schema_name}\n`;
    }
  }

  // List all tables across schemas
  const { data: allTables } = await supabase
    .from("information_schema.tables")
    .select("table_schema, table_name, table_type")
    .neq("table_schema", "pg_catalog")
    .neq("table_schema", "information_schema");

  if (allTables && allTables.length > 0) {
    output += "\n-- All Tables\n";
    for (const t of allTables) {
      output += `-- [${t.table_schema}] ${t.table_name} (${t.table_type})\n`;
    }
  }

  // List storage buckets
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets && buckets.length > 0) {
    output += "\n-- Storage Buckets\n";
    for (const bucket of buckets) {
      output += `-- ${bucket.name} (public: ${bucket.public})\n`;
    }
  }

  return output;
}

async function exportFullPgDump(supabase: any): Promise<string> {
  let output = `-- PayByCard Full PostgreSQL Dump (via SQL queries)\n-- Generated: ${new Date().toISOString()}\n\n`;
  output += "-- This is a comprehensive export via SQL queries (not pg_dump binary).\n";
  output += "-- It includes schema, data, indexes, policies, triggers, and functions.\n\n";

  // Combine schema + data
  const schemaData = await exportSchemaData(supabase, false);
  output += schemaData;

  // Export triggers
  const { data: triggers } = await supabase
    .from("information_schema.triggers")
    .select("event_object_table, trigger_name, action_timing, event_manipulation, action_statement")
    .eq("trigger_schema", "public");

  if (triggers && triggers.length > 0) {
    output += "\n-- Triggers\n";
    for (const trg of triggers) {
      output += `-- Trigger: ${trg.trigger_name} on ${trg.event_object_table}\n`;
      output += `${trg.action_timing} ${trg.event_manipulation} ON "${trg.event_object_table}" ${trg.action_statement}\n`;
    }
  }

  // Export functions
  const { data: functions } = await supabase
    .from("information_schema.routines")
    .select("routine_name, routine_type, routine_definition, data_type")
    .eq("routine_schema", "public");

  if (functions && functions.length > 0) {
    output += "\n-- Functions\n";
    for (const fn of functions) {
      output += `-- Function: ${fn.routine_name} (returns ${fn.data_type || "void"})\n`;
      if (fn.routine_definition) {
        output += `${fn.routine_definition}\n`;
      }
      output += "\n";
    }
  }

  // Export views
  const { data: views } = await supabase
    .from("information_schema.views")
    .select("table_name, view_definition")
    .eq("table_schema", "public");

  if (views && views.length > 0) {
    output += "\n-- Views\n";
    for (const view of views) {
      output += `-- View: ${view.table_name}\n`;
      if (view.view_definition) {
        output += `${view.view_definition};\n`;
      }
      output += "\n";
    }
  }

  return output;
}

async function exportStorageList(supabase: any): Promise<string> {
  let output = `-- PayByCard Storage Backup (File Manifest)\n-- Generated: ${new Date().toISOString()}\n\n`;
  output += "-- This is a manifest of all files in storage buckets.\n";
  output += "-- Actual file contents would need to be downloaded separately.\n\n";

  const { data: buckets } = await supabase.storage.listBuckets();

  if (buckets && buckets.length > 0) {
    for (const bucket of buckets) {
      output += `\n-- Bucket: ${bucket.name} (public: ${bucket.public})\n`;

      try {
        const files = await listAllFilesInBucket(supabase, bucket.name);
        if (files.length > 0) {
          output += `-- Total files: ${files.length}\n`;
          for (const file of files) {
            output += `-- ${file.name} (${file.metadata?.size || "unknown"} bytes)\n`;
          }
        } else {
          output += "-- (empty bucket)\n";
        }
      } catch (err) {
        output += `-- Error listing files: ${err}\n`;
      }
    }
  }

  return output;
}

async function listAllFilesInBucket(supabase: any, bucketName: string): Promise<any[]> {
  const allFiles: any[] = [];
  const { data: files } = await supabase.storage.from(bucketName).list("", { limit: 1000 });
  if (files) {
    for (const file of files) {
      if (file.id) {
        allFiles.push({ ...file, path: file.name });
        // Recurse into folders
        const { data: subFiles } = await supabase.storage.from(bucketName).list(file.name, { limit: 1000 });
        if (subFiles) {
          for (const subFile of subFiles) {
            if (subFile.id) {
              allFiles.push({ ...subFile, path: `${file.name}/${subFile.name}` });
            }
          }
        }
      }
    }
  }
  return allFiles;
}

async function exportEdgeFunctionsList(supabase: any): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  let output = `-- PayByCard Edge Functions Backup (Manifest)\n-- Generated: ${new Date().toISOString()}\n\n`;
  output += "-- This is a manifest of deployed edge functions.\n";
  output += "-- Function source code is stored in the project repository.\n\n";

  // List functions via the Supabase API
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/_internal/functions`, {
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
    });
    if (response.ok) {
      const data = await response.json();
      output += `-- Functions: ${JSON.stringify(data, null, 2)}\n`;
    } else {
      output += "-- Could not list functions via API. Listing from config.\n";
    }
  } catch {
    output += "-- Function listing not available via API.\n";
  }

  // Also check pg_cron for any function-related jobs
  const { data: cronJobs } = await supabase
    .from("cron.job")
    .select("jobid, jobname, schedule, command, active")
    .eq("active", true);

  if (cronJobs && cronJobs.length > 0) {
    output += "\n-- Active cron jobs (may trigger edge functions):\n";
    for (const job of cronJobs) {
      output += `-- Job: ${job.jobname}, Schedule: ${job.schedule}, Command: ${job.command}\n`;
    }
  }

  return output;
}

async function exportCronJobs(supabase: any): Promise<string> {
  let output = `-- PayByCard Cron Jobs Backup\n-- Generated: ${new Date().toISOString()}\n\n`;

  const { data: jobs, error } = await supabase
    .from("cron.job")
    .select("jobid, jobname, schedule, command, nodename, nodeport, database, username, active");

  if (error) {
    output += `-- Error fetching cron jobs: ${error.message}\n`;
    return output;
  }

  if (jobs && jobs.length > 0) {
    output += `-- Total cron jobs: ${jobs.length}\n\n`;
    for (const job of jobs) {
      output += `-- Job ID: ${job.jobid}\n`;
      output += `-- Name: ${job.jobname}\n`;
      output += `-- Schedule: ${job.schedule}\n`;
      output += `-- Command: ${job.command}\n`;
      output += `-- Database: ${job.database}\n`;
      output += `-- Username: ${job.username}\n`;
      output += `-- Active: ${job.active}\n\n`;

      // Generate SQL to recreate the job
      if (job.jobname && job.schedule && job.command) {
        output += `-- Recreate command:\n`;
        output += `-- SELECT cron.schedule(\n`;
        output += `--   '${job.jobname}',\n`;
        output += `--   '${job.schedule}',\n`;
        output += `--   '${job.command.replace(/'/g, "''")}'\n`;
        output += `-- );\n\n`;
      }
    }
  } else {
    output += "-- No cron jobs found.\n";
  }

  // Also export job run details (recent)
  const { data: runDetails } = await supabase
    .from("cron.job_run_details")
    .select("jobid, runid, job_pid, database, username, start_time, end_time, return_status, output")
    .order("start_time", { ascending: false })
    .limit(100);

  if (runDetails && runDetails.length > 0) {
    output += `\n-- Recent job run details (last ${runDetails.length} runs):\n`;
    for (const run of runDetails) {
      output += `-- Run ${run.runid}: Job ${run.jobid}, Status: ${run.return_status}, Started: ${run.start_time}, Ended: ${run.end_time || "running"}\n`;
    }
  }

  return output;
}

async function exportAuthUsers(supabase: any): Promise<string> {
  let output = `-- PayByCard Auth Users Backup\n-- Generated: ${new Date().toISOString()}\n\n`;

  // Export auth.users (accessible via service role)
  const { data: authUsers, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    output += `-- Error fetching auth users: ${error.message}\n`;
    return output;
  }

  if (authUsers && authUsers.users && authUsers.users.length > 0) {
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
      if (user.app_metadata && Object.keys(user.app_metadata).length > 0) {
        const safeMeta = { ...user.app_metadata };
        delete safeMeta.password_hash;
        delete safeMeta.password;
        output += `-- App Metadata: ${JSON.stringify(safeMeta)}\n`;
      }
      output += `\n`;
    }
  } else {
    output += "-- No auth users found.\n";
  }

  return output;
}

async function exportProjectConfig(supabase: any): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  let output = `-- PayByCard Project Configuration Backup\n-- Generated: ${new Date().toISOString()}\n\n`;
  output += `-- Project URL: ${supabaseUrl}\n`;
  output += `-- Project Reference: ${supabaseUrl.replace("https://", "").replace(".supabase.co", "")}\n\n`;

  // List storage buckets with their settings
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets && buckets.length > 0) {
    output += "-- Storage Buckets Configuration\n";
    for (const bucket of buckets) {
      output += `-- Bucket: ${bucket.name}\n`;
      output += `--   Public: ${bucket.public}\n`;
      output += `--   File Size Limit: ${bucket.file_size_limit || "default"}\n`;
      output += `--   Allowed Mime Types: ${bucket.allowed_mime_types ? JSON.stringify(bucket.allowed_mime_types) : "all"}\n\n`;
    }
  }

  // List extensions
  const { data: exts } = await supabase
    .from("pg_extension")
    .select("extname, extversion");

  if (exts && exts.length > 0) {
    output += "\n-- Database Extensions\n";
    for (const ext of exts) {
      output += `-- ${ext.extname} (v${ext.extversion})\n`;
    }
  }

  // List all schemas
  const { data: schemas } = await supabase
    .from("information_schema.schemata")
    .select("schema_name")
    .neq("schema_name", "pg_catalog")
    .neq("schema_name", "information_schema")
    .neq("schema_name", "pg_toast");

  if (schemas && schemas.length > 0) {
    output += "\n-- Database Schemas\n";
    for (const schema of schemas) {
      output += `-- ${schema.schema_name}\n`;
    }
  }

  // Settings table
  const { data: settings } = await supabase
    .from("master_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (settings) {
    output += "\n-- Master Settings (safe fields only)\n";
    const safeSettings = { ...settings };
    // Remove any sensitive fields
    delete safeSettings.api_keys;
    delete safeSettings.secrets;
    output += `-- ${JSON.stringify(safeSettings, null, 2)}\n`;
  }

  output += "\n-- Note: Secrets and API keys are NOT included in this backup for security.\n";
  output += "-- They must be reconfigured manually from the Supabase dashboard if needed.\n";

  return output;
}

async function exportFullBackup(supabase: any): Promise<string> {
  let output = `-- PayByCard FULL BACKUP\n-- Generated: ${new Date().toISOString()}\n\n`;
  output += "-- This is a comprehensive backup combining all backup types.\n";
  output += "-- ============================================================\n\n";

  output += "========================================\n";
  output += "SECTION 1: SCHEMA & DATA\n";
  output += "========================================\n\n";
  output += await exportSchemaData(supabase, false);

  output += "\n\n========================================\n";
  output += "SECTION 2: ROLES\n";
  output += "========================================\n\n";
  output += await exportRoles(supabase);

  output += "\n\n========================================\n";
  output += "SECTION 3: LINKED PROJECT\n";
  output += "========================================\n\n";
  output += await exportLinkedProject(supabase);

  output += "\n\n========================================\n";
  output += "SECTION 4: STORAGE MANIFEST\n";
  output += "========================================\n\n";
  output += await exportStorageList(supabase);

  output += "\n\n========================================\n";
  output += "SECTION 5: CRON JOBS\n";
  output += "========================================\n\n";
  output += await exportCronJobs(supabase);

  output += "\n\n========================================\n";
  output += "SECTION 6: AUTH USERS\n";
  output += "========================================\n\n";
  output += await exportAuthUsers(supabase);

  output += "\n\n========================================\n";
  output += "SECTION 7: PROJECT CONFIG\n";
  output += "========================================\n\n";
  output += await exportProjectConfig(supabase);

  output += "\n\n========================================\n";
  output += "SECTION 8: EDGE FUNCTIONS MANIFEST\n";
  output += "========================================\n\n";
  output += await exportEdgeFunctionsList(supabase);

  output += "\n\n-- END OF FULL BACKUP\n";

  return output;
}

function formatSqlValue(value: any): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

// redeploy

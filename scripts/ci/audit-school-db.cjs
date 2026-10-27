#!/usr/bin/env node
/* Read-only per-school database audit. Runs inside the deployed backend image. */
const fs = require('node:fs');
const path = require('node:path');
const prismaClientPath = require.resolve('@prisma/client', { paths: [process.cwd(), '/app'] });
const { Prisma, PrismaClient } = require(prismaClientPath);

const prisma = new PrismaClient({ log: [] });
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
const issues = { critical: [], warnings: [], info: [] };
const add = (kind, message) => issues[kind].push(message);

async function main() {
  await prisma.$executeRawUnsafe("SET statement_timeout = '30000'");
  const datamodel = Prisma.dmmf.datamodel;
  const models = datamodel.models.filter((model) => !model.isIgnored);
  const enumNames = new Map(datamodel.enums.map((item) => [item.name, item.dbName || item.name]));
  const migrationRoot = path.join(process.cwd(), 'prisma', 'migrations');
  const migrationDirs = fs.readdirSync(migrationRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const expectedMigrationCount = migrationDirs.length;

  const tables = await prisma.$queryRawUnsafe(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
  );
  const tableNames = new Set(tables.map((row) => row.table_name));
  const columns = await prisma.$queryRawUnsafe(
    "SELECT table_name, column_name, data_type, udt_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public'",
  );
  const columnMap = new Map();
  for (const column of columns) {
    if (!columnMap.has(column.table_name)) columnMap.set(column.table_name, new Map());
    columnMap.get(column.table_name).set(column.column_name, column);
  }

  const missingTables = [];
  const missingColumns = [];
  const nullabilityMismatches = [];
  const typeMismatches = [];
  const expectedForeignKeys = [];
  const expectedIndexes = [];
  const scalarTypeAllowlist = {
    String: ['text', 'character varying', 'varchar', 'character', 'char', 'uuid'],
    Int: ['integer', 'smallint'],
    BigInt: ['bigint'],
    Boolean: ['boolean'],
    Float: ['double precision', 'real'],
    Decimal: ['numeric', 'decimal'],
    DateTime: ['timestamp without time zone', 'timestamp with time zone', 'date', 'time without time zone', 'time with time zone'],
    Json: ['json', 'jsonb'],
    Bytes: ['bytea'],
  };

  for (const model of models) {
    const table = model.dbName || model.name;
    if (!tableNames.has(table)) {
      missingTables.push(table);
      continue;
    }
    const actualColumns = columnMap.get(table) || new Map();
    for (const field of model.fields) {
      if (field.isIgnored || field.kind === 'object' || field.kind === 'unsupported') continue;
      const columnName = field.dbName || field.name;
      const actual = actualColumns.get(columnName);
      const label = `${table}.${columnName}`;
      if (!actual) {
        missingColumns.push(label);
        continue;
      }
      if (field.isRequired !== (actual.is_nullable === 'NO')) {
        nullabilityMismatches.push(`${label}: Prisma required=${field.isRequired}, DB nullable=${actual.is_nullable === 'YES'}`);
      }
      if (field.isList) {
        if (actual.data_type !== 'ARRAY') typeMismatches.push(`${label}: expected array of ${field.type}, found ${actual.data_type}`);
      } else if (field.kind === 'enum') {
        const enumDbName = enumNames.get(field.type);
        if (actual.udt_name !== enumDbName) typeMismatches.push(`${label}: expected enum ${enumDbName}, found ${actual.udt_name}`);
      } else if (scalarTypeAllowlist[field.type] && !scalarTypeAllowlist[field.type].includes(actual.data_type)) {
        typeMismatches.push(`${label}: expected ${field.type}, found ${actual.data_type}`);
      }
    }
    for (const field of model.fields) {
      if (field.isUnique) expectedIndexes.push({ table, columns: [field.dbName || field.name], primary: false });
      if (field.kind === 'object' && field.relationFromFields?.length) {
        expectedForeignKeys.push({ table, columns: field.relationFromFields.map((name) => {
          const relationField = model.fields.find((candidate) => candidate.name === name);
          return relationField?.dbName || name;
        }), parentTable: (models.find((candidate) => candidate.name === field.type)?.dbName || field.type), parentColumns: field.relationToFields.map((name) => {
          const parentModel = models.find((candidate) => candidate.name === field.type);
          const parentField = parentModel?.fields.find((candidate) => candidate.name === name);
          return parentField?.dbName || name;
        }) });
      }
    }
    const primaryFields = model.primaryKey?.fields || model.fields.filter((field) => field.isId).map((field) => field.name);
    if (primaryFields?.length) expectedIndexes.push({
      table,
      columns: primaryFields.map((name) => {
        const field = model.fields.find((candidate) => candidate.name === name);
        return field?.dbName || name;
      }),
      primary: true,
    });
    for (const fields of model.uniqueFields || []) expectedIndexes.push({
      table,
      columns: fields.map((name) => {
        const field = model.fields.find((candidate) => candidate.name === name);
        return field?.dbName || name;
      }),
      primary: false,
    });
    for (const index of model.uniqueIndexes || []) expectedIndexes.push({
      table,
      columns: index.fields.map((name) => {
        const field = model.fields.find((candidate) => candidate.name === name);
        return field?.dbName || name;
      }),
      primary: false,
    });
  }
  if (missingTables.length) add('critical', `missing tables (${missingTables.length}): ${missingTables.join(', ')}`);
  if (missingColumns.length) add('critical', `missing columns (${missingColumns.length}): ${missingColumns.slice(0, 30).join(', ')}${missingColumns.length > 30 ? ', …' : ''}`);
  if (nullabilityMismatches.length) add('critical', `nullability mismatches (${nullabilityMismatches.length}): ${nullabilityMismatches.slice(0, 20).join(', ')}${nullabilityMismatches.length > 20 ? ', …' : ''}`);
  if (typeMismatches.length) add('critical', `column type mismatches (${typeMismatches.length}): ${typeMismatches.slice(0, 20).join(', ')}${typeMismatches.length > 20 ? ', …' : ''}`);
  const expectedTableNames = new Set(models.map((model) => model.dbName || model.name).concat('_prisma_migrations'));
  const extraTables = [...tableNames].filter((name) => !expectedTableNames.has(name));
  const extraColumns = [];
  for (const model of models) {
    const table = model.dbName || model.name;
    const actualColumns = columnMap.get(table);
    if (!actualColumns) continue;
    const expectedColumns = new Set(model.fields.filter((field) => !field.isIgnored && field.kind !== 'object' && field.kind !== 'unsupported').map((field) => field.dbName || field.name));
    for (const name of actualColumns.keys()) if (!expectedColumns.has(name)) extraColumns.push(`${table}.${name}`);
  }
  if (extraTables.length || extraColumns.length) add('info', `database has ${extraTables.length} extra table(s) and ${extraColumns.length} extra column(s); these may be legacy data structures`);

  let migrationRows = [];
  try {
    migrationRows = await prisma.$queryRawUnsafe(
      'SELECT migration_name, checksum, finished_at, rolled_back_at, started_at FROM "_prisma_migrations" ORDER BY started_at',
    );
  } catch (error) {
    add('critical', `migration history table unavailable: ${error.message.split('\n')[0]}`);
  }
  const applied = new Map(migrationRows.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => [row.migration_name, row]));
  const failed = migrationRows.filter((row) => !row.finished_at && !row.rolled_back_at);
  const rolledBack = migrationRows.filter((row) => row.rolled_back_at);
  const pending = migrationDirs.filter((name) => !applied.has(name));
  const unknown = [...applied.keys()].filter((name) => !migrationDirs.includes(name));
  const checksumMismatch = [];
  for (const [name, row] of applied) {
    const file = path.join(migrationRoot, name, 'migration.sql');
    if (!fs.existsSync(file)) continue;
    const digest = require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (digest !== row.checksum) checksumMismatch.push(name);
  }
  if (pending.length) add('critical', `migrations pending (${pending.length}/${expectedMigrationCount}): ${pending.slice(0, 20).join(', ')}${pending.length > 20 ? ', …' : ''}`);
  if (failed.length) add('critical', `failed/incomplete migration records: ${failed.map((row) => row.migration_name).join(', ')}`);
  if (checksumMismatch.length) add('critical', `migration checksum mismatch: ${checksumMismatch.join(', ')}`);
  if (unknown.length) add('warnings', `applied migrations absent from this image: ${unknown.join(', ')}`);
  if (rolledBack.length) add('info', `rolled-back migration attempts: ${rolledBack.map((row) => row.migration_name).join(', ')}`);

  const dbEnums = await prisma.$queryRawUnsafe(
    `SELECT t.typname AS name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
       FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typnamespace = 'public'::regnamespace GROUP BY t.typname`,
  );
  const dbEnumMap = new Map(dbEnums.map((item) => [item.name, new Set(item.enum_values)]));
  const missingEnumValues = [];
  for (const item of datamodel.enums) {
    const dbName = item.dbName || item.name;
    const actual = dbEnumMap.get(dbName);
    if (!actual) {
      missingEnumValues.push(`${dbName} (enum missing)`);
      continue;
    }
    for (const value of item.values) {
      const enumValue = typeof value === 'string' ? value : value.name;
      if (!actual.has(enumValue)) missingEnumValues.push(`${dbName}.${enumValue}`);
    }
  }
  if (missingEnumValues.length) add('critical', `missing enum types/values (${missingEnumValues.length}): ${missingEnumValues.slice(0, 30).join(', ')}`);

  const foreignKeys = await prisma.$queryRawUnsafe(
    `SELECT con.conname AS name, child_ns.nspname AS child_schema, child.relname AS child_table,
            parent_ns.nspname AS parent_schema, parent.relname AS parent_table,
            ARRAY(SELECT a.attname FROM unnest(con.conkey) WITH ORDINALITY k(attnum, ord)
                  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum ORDER BY k.ord) AS child_columns,
            ARRAY(SELECT a.attname FROM unnest(con.confkey) WITH ORDINALITY k(attnum, ord)
                  JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.attnum ORDER BY k.ord) AS parent_columns,
            con.convalidated AS validated
       FROM pg_constraint con
       JOIN pg_class child ON child.oid = con.conrelid
       JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
       JOIN pg_class parent ON parent.oid = con.confrelid
       JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
      WHERE con.contype = 'f' AND child_ns.nspname = 'public'`,
  );
  const actualFkKeys = new Set(foreignKeys.map((fk) => `${fk.child_table}|${fk.child_columns.join(',')}|${fk.parent_table}|${fk.parent_columns.join(',')}`));
  const uniqueExpectedForeignKeys = [...new Map(expectedForeignKeys.map((fk) => [`${fk.table}|${fk.columns.join(',')}|${fk.parentTable}|${fk.parentColumns.join(',')}`, fk])).values()];
  const expectedFkKeys = new Set(uniqueExpectedForeignKeys.map((fk) => `${fk.table}|${fk.columns.join(',')}|${fk.parentTable}|${fk.parentColumns.join(',')}`));
  const missingForeignKeyRows = uniqueExpectedForeignKeys.filter((fk) => !actualFkKeys.has(`${fk.table}|${fk.columns.join(',')}|${fk.parentTable}|${fk.parentColumns.join(',')}`));
  const missingForeignKeys = [...expectedFkKeys].filter((key) => !actualFkKeys.has(key));
  if (missingForeignKeys.length) add('critical', `missing foreign keys (${missingForeignKeys.length}): ${missingForeignKeys.join(', ')}`);
  const unvalidated = foreignKeys.filter((fk) => !fk.validated);
  if (unvalidated.length) add('critical', `unvalidated foreign keys: ${unvalidated.map((fk) => fk.name).join(', ')}`);

  const actualIndexes = await prisma.$queryRawUnsafe(
    `SELECT table_class.relname AS table_name, index_data.indisprimary AS is_primary,
            index_data.indisunique AS is_unique,
            ARRAY(SELECT attribute.attname FROM unnest(index_data.indkey) WITH ORDINALITY k(attnum, ord)
                  JOIN pg_attribute attribute ON attribute.attrelid = index_data.indrelid AND attribute.attnum = k.attnum
                 WHERE k.attnum > 0 ORDER BY k.ord) AS columns
       FROM pg_index index_data JOIN pg_class table_class ON table_class.oid = index_data.indrelid
       JOIN pg_namespace namespace ON namespace.oid = table_class.relnamespace
      WHERE namespace.nspname = 'public'`,
  );
  const actualIndexKeys = new Set(actualIndexes.filter((index) => index.is_primary || index.is_unique)
    .map((index) => `${index.table_name}|${index.columns.join(',')}|${index.is_primary ? 'primary' : 'unique'}`));
  const uniqueExpectedIndexes = [...new Map(expectedIndexes.map((index) => [`${index.table}|${index.columns.join(',')}|${index.primary ? 'primary' : 'unique'}`, index])).values()];
  const missingIndexes = uniqueExpectedIndexes.filter((index) => !actualIndexKeys.has(`${index.table}|${index.columns.join(',')}|${index.primary ? 'primary' : 'unique'}`));
  if (missingIndexes.length) add('critical', `missing primary/unique indexes (${missingIndexes.length}): ${missingIndexes.slice(0, 30).map((index) => `${index.table}(${index.columns.join(',')})`).join(', ')}${missingIndexes.length > 30 ? ', …' : ''}`);

  const orphanChecks = [];
  const orphanRelations = [
    ...foreignKeys.filter((fk) => !fk.validated).map((fk) => ({ childSchema: fk.child_schema, childTable: fk.child_table, childColumns: fk.child_columns, parentSchema: fk.parent_schema, parentTable: fk.parent_table, parentColumns: fk.parent_columns })),
    ...missingForeignKeyRows.map((fk) => ({ childSchema: 'public', childTable: fk.table, childColumns: fk.columns, parentSchema: 'public', parentTable: fk.parentTable, parentColumns: fk.parentColumns })),
  ].filter((fk) => tableNames.has(fk.childTable) && tableNames.has(fk.parentTable)
    && fk.childColumns.every((name) => columnMap.get(fk.childTable)?.has(name))
    && fk.parentColumns.every((name) => columnMap.get(fk.parentTable)?.has(name)));
  for (const fk of orphanRelations) {
    const childTable = `${quote(fk.childSchema)}.${quote(fk.childTable)}`;
    const parentTable = `${quote(fk.parentSchema)}.${quote(fk.parentTable)}`;
    const childColumns = fk.childColumns.map(quote);
    const parentColumns = fk.parentColumns.map(quote);
    const nonNull = childColumns.map((column) => `c.${column} IS NOT NULL`).join(' AND ');
    const matches = childColumns.map((column, index) => `p.${parentColumns[index]} = c.${column}`).join(' AND ');
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM ${childTable} c WHERE ${nonNull} AND NOT EXISTS (SELECT 1 FROM ${parentTable} p WHERE ${matches})`,
    );
    if (Number(rows[0].count) > 0) orphanChecks.push(`${fk.childTable}(${fk.childColumns.join(',')})→${fk.parentTable}: ${rows[0].count}`);
  }
  if (orphanChecks.length) add('warnings', `orphaned foreign-key rows: ${orphanChecks.join('; ')}`);

  const rowCounts = {};
  for (const table of ['users', 'classes', 'learners', 'students', 'enrollments', 'class_teacher_assignments']) {
    if (!tableNames.has(table)) continue;
    const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM ${quote(table)}`);
    rowCounts[table] = Number(count[0].count);
  }
  if (tableNames.has('classes') && tableNames.has('class_teacher_assignments') && columnMap.get('classes')?.has('teacherId')) {
    const counts = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "classes" c
        WHERE c."teacherId" IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM "class_teacher_assignments" a
           WHERE a."classId" = c."id" AND a."teacherId" = c."teacherId")`,
    );
    if (Number(counts[0].count) > 0) add('warnings', `legacy class teachers missing join-table backfill: ${counts[0].count}`);
  }

  const status = issues.critical.length ? 'FAIL' : issues.warnings.length ? 'WARN' : 'OK';
  console.log(JSON.stringify({
    school: process.env.AUDIT_SCHOOL_ID || 'unknown',
    image: process.env.AUDIT_IMAGE_TAG || 'unknown',
    status,
    migrations: { expected: expectedMigrationCount, applied: applied.size, pending: pending.length, failed: failed.length, checksumMismatch: checksumMismatch.length },
    schema: { models: models.length, tables: tableNames.size, missingTables: missingTables.length, missingColumns: missingColumns.length, extraTables: extraTables.length, extraColumns: extraColumns.length, nullabilityMismatches: nullabilityMismatches.length, typeMismatches: typeMismatches.length, enumIssues: missingEnumValues.length, missingForeignKeys: missingForeignKeys.length, unvalidatedForeignKeys: unvalidated.length, missingPrimaryOrUniqueIndexes: missingIndexes.length },
    schemaDetails: {
      missingTables,
      missingColumns,
      extraTables,
      extraColumns,
      nullabilityMismatches,
      typeMismatches,
      missingEnumValues,
      missingForeignKeys,
      unvalidatedForeignKeys: unvalidated.map((fk) => fk.name),
      missingIndexes: missingIndexes.map((index) => `${index.table}(${index.columns.join(',')})`),
    },
    rowCounts,
    issues,
  }));
  await prisma.$disconnect();
  if (status === 'FAIL') process.exitCode = 2;
}

main().catch(async (error) => {
  console.log(JSON.stringify({ school: process.env.AUDIT_SCHOOL_ID || 'unknown', status: 'ERROR', error: error.message.split('\n')[0] }));
  await prisma.$disconnect().catch(() => {});
  process.exitCode = 2;
});

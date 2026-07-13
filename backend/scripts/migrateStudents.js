import "dotenv/config";
import connectDB, { disconnectDB } from "../src/config/db.js";
import {
  migrateStudents,
  rollbackStudentMigration,
} from "../src/services/studentMigrationService.js";

const args = new Set(process.argv.slice(2));
const valueFor = (name) => {
  const prefix = `${name}=`;
  return [...args].find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
};

const main = async () => {
  const apply = args.has("--apply");
  const rollback = args.has("--rollback");
  const runId = valueFor("--run-id");
  const batchSize = Number(valueFor("--batch-size") || 100);

  if (apply && rollback) throw new Error("Choose either --apply or --rollback.");
  if ((apply || rollback) && !runId) {
    throw new Error("--run-id is mandatory for apply and rollback operations.");
  }

  await connectDB();
  const result = rollback
    ? await rollbackStudentMigration({ runId })
    : await migrateStudents({ apply, runId, batchSize });
  console.log(JSON.stringify(result, null, 2));
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());

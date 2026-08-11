import { migrate } from "../lib/db/migrations";

migrate();
console.log("database is ready");

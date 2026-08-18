import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import {
  configureRuntime,
  resolveRuntimeConfig,
  type RuntimeConfig,
} from "./config";

export const PROFILE_NAMES = ["local", "dev", "production"] as const;
export type ProfileName = (typeof PROFILE_NAMES)[number];

type Environment = Record<string, string>;
type EnvironmentInput = Readonly<Record<string, string | undefined>>;

export type RuntimeProfile = {
  name: ProfileName;
  development: boolean;
  publishLexicons: boolean;
  config: RuntimeConfig;
  environment: Environment;
};

export async function loadRuntimeProfile(
  name: ProfileName,
  cwd = process.cwd(),
  processEnvironment: EnvironmentInput = process.env,
): Promise<RuntimeProfile> {
  const environment: Environment = {
    ...(await readEnvironmentFile(resolve(cwd, "env", "common.env"), true)),
    ...(await readEnvironmentFile(resolve(cwd, "env", `${name}.env`), true)),
    ...(await readEnvironmentFile(resolve(cwd, ".env"))),
    ...(await readEnvironmentFile(resolve(cwd, ".env.local"))),
    ...(await readEnvironmentFile(resolve(cwd, `.env.${name}.local`))),
    ...definedEnvironment(processEnvironment),
    BULLETIN_PROFILE: name,
    NODE_ENV: name === "production" ? "production" : "development",
  };
  return {
    name,
    development: name !== "production",
    publishLexicons: name === "local",
    config: resolveRuntimeConfig(environment),
    environment,
  };
}

export function applyRuntimeProfile(profile: RuntimeProfile): void {
  Object.assign(process.env, profile.environment);
  configureRuntime(profile.config);
}

export function parseProfileName(args: string[]): ProfileName {
  const flag = args.find((argument) => argument.startsWith("--profile="));
  const flagValue = flag?.slice("--profile=".length);
  const index = args.indexOf("--profile");
  const value = flagValue ?? (index >= 0 ? args[index + 1] : undefined);
  if (PROFILE_NAMES.includes(value as ProfileName)) return value as ProfileName;
  throw new Error(`--profile must be one of: ${PROFILE_NAMES.join(", ")}`);
}

async function readEnvironmentFile(
  path: string,
  required = false,
): Promise<Environment> {
  try {
    return definedEnvironment(parseEnv(await readFile(path, "utf8")));
  } catch (error) {
    if (!required && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function definedEnvironment(
  environment: EnvironmentInput,
): Environment {
  return Object.fromEntries(
    Object.entries(environment).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

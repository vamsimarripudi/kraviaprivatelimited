import { parse } from "yaml";

export type WorkflowStep = {
  env?: Record<string, unknown>;
  if?: string;
  name?: string;
  uses?: string;
};

export type WorkflowJob = {
  env?: Record<string, unknown>;
  if?: string;
  steps?: WorkflowStep[];
};

type WorkflowDocument = {
  env?: Record<string, unknown>;
  jobs?: Record<string, WorkflowJob>;
};

export function parseReleaseWorkflow(source: string, jobName: string) {
  const document = parse(source) as WorkflowDocument;
  const job = document.jobs?.[jobName];

  if (!job || !Array.isArray(job.steps)) {
    throw new Error(`Expected ${jobName} to be a workflow job with steps.`);
  }

  return { document, job };
}

export function getStep(job: WorkflowJob, name: string) {
  const step = job.steps?.find((candidate) => candidate.name === name);
  if (!step) {
    throw new Error(`Expected workflow step named ${name}.`);
  }
  return step;
}

export function getSecretStepNames(job: WorkflowJob, secretName: string) {
  const expression = `secrets.${secretName}`;
  return (job.steps ?? [])
    .filter((step) => JSON.stringify(step.env ?? {}).includes(expression))
    .map((step) => step.name);
}

export function getActionReferences(job: WorkflowJob) {
  return (job.steps ?? [])
    .map((step) => step.uses)
    .filter((reference): reference is string => typeof reference === "string");
}
